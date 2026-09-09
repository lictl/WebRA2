// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Composes verified readers and content compilers.
import { assertJsonValue, type ContentIdentity, type ProfileId } from '../../contracts/src/index.ts';
import { normalizeAssetPath } from '../../vfs/src/profile.ts';
import { hashByteSource } from '../../vfs/src/hash-source.ts';
import type { BrowserMemberIdentity, BrowserVerifiedSession } from '../../vfs/src/browser-verified.ts';
import { throwIfImportAborted } from '../../vfs/src/browser-source.ts';
import { compileRuntimeIni, RUNTIME_INI_POLICY, type RuntimeIni, type RuntimeIniLayer } from './runtime-ini.ts';
import { decodeCsf, type CsfCatalog } from './csf-decode.ts';

export const PROFILE_CONTENT_POLICY = 'webra2-profile-content-1';
export const PROFILE_CONTENT_LIMITS = Object.freeze({ files: 128, bytes: 32 * 1024 * 1024, fileBytes: 16 * 1024 * 1024, mods: 32 });
const roles = ['rules', 'art', 'ai', 'battle', 'mapsel', 'briefing', 'sound', 'mission', 'strings', 'font'] as const;
export type ProfileContentRole = typeof roles[number];
export interface ProfileContentFile {
  readonly profile: ProfileId;
  readonly path: string;
  readonly role: ProfileContentRole;
  readonly order: number;
  readonly kind: RuntimeIniLayer['kind'];
  readonly source: BrowserMemberIdentity;
}
export interface ProfileContentPlan {
  readonly profile: ProfileId;
  /** Compatibility version of the consuming engine, not an installation version. */
  readonly engineVersion: string;
  readonly orderedModHashes: readonly string[];
  readonly files: readonly ProfileContentFile[];
}
export interface ProfileContentProgress { readonly filesRead: number; readonly totalFiles: number; readonly bytesRead: number; readonly totalBytes: number; readonly path: string }
export interface CompiledProfileContent {
  readonly policy: typeof PROFILE_CONTENT_POLICY;
  readonly scope: 'definitions-and-opening-mission';
  readonly canStartCampaign: false;
  readonly contentIdentity: ContentIdentity;
  readonly engineVersion: string;
  readonly files: readonly ProfileContentFile[];
  readonly rules: RuntimeIni;
  readonly mission: RuntimeIni;
  readonly tables: Readonly<Record<'art' | 'ai' | 'battle' | 'mapsel' | 'briefing' | 'sound', RuntimeIni>>;
  readonly strings: CsfCatalog;
}
export class ProfileContentError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'ProfileContentError'; }
}
function fail(code: string): never { throw new ProfileContentError(code); }
function hash(value: string): string { if (typeof value !== 'string' || !/^[a-f\d]{64}$/i.test(value)) fail('content-hash'); return value.toLowerCase(); }
function natural(value: number): number { if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) fail('content-range'); return value; }
function fields(input: object, keys: readonly string[]): void {
  if (!input || typeof input !== 'object' || Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key))) fail('content-fields');
}
function prepare(input: ProfileContentPlan): ProfileContentPlan {
  // Count gates precede the general bounded JSON validator; no byte payloads belong in a plan.
  if (!input || typeof input !== 'object') fail('content-plan-limit');
  for (const [key, limit] of [['files', PROFILE_CONTENT_LIMITS.files], ['orderedModHashes', PROFILE_CONTENT_LIMITS.mods]] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !Array.isArray(descriptor.value) || descriptor.value.length > limit) fail('content-plan-limit');
  }
  assertJsonValue(input); fields(input, ['profile', 'engineVersion', 'orderedModHashes', 'files']);
  if (input.profile !== 'ra2' && input.profile !== 'yr') fail('content-profile');
  if (typeof input.engineVersion !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(input.engineVersion)) fail('content-engine-version');
  const orders = new Set<number>(), counts = new Map<ProfileContentRole, number>(); let total = 0;
  const files = input.files.map(file => {
    fields(file, ['profile', 'path', 'role', 'order', 'kind', 'source']);
    if (file.profile !== input.profile) fail('content-profile-mismatch');
    if (!roles.includes(file.role)) fail('content-role');
    if (!['base', 'expansion', 'map', 'mod'].includes(file.kind)) fail('content-kind');
    const path = normalizeAssetPath(file.path), order = natural(file.order);
    if (orders.has(order)) fail('content-order-conflict'); orders.add(order);
    fields(file.source, ['root', 'absoluteOffset', 'size', 'sha256']);
    fields(file.source.root, ['sourceId', 'size', 'sha256']);
    const rootSize = natural(file.source.root.size), absoluteOffset = natural(file.source.absoluteOffset), size = natural(file.source.size);
    if (rootSize > 4_296_000_000 || absoluteOffset > rootSize || size > rootSize - absoluteOffset) fail('content-range');
    if (size > PROFILE_CONTENT_LIMITS.fileBytes || (total += size) > PROFILE_CONTENT_LIMITS.bytes) fail('content-byte-limit');
    const sourceId = file.source.root.sourceId;
    if (typeof sourceId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(sourceId)) fail('content-source-id');
    counts.set(file.role, (counts.get(file.role) ?? 0) + 1);
    return Object.freeze({ profile: file.profile, path, role: file.role, order, kind: file.kind,
      source: Object.freeze({ root: Object.freeze({ sourceId, size: rootSize, sha256: hash(file.source.root.sha256) }), absoluteOffset, size, sha256: hash(file.source.sha256) }) });
  }).sort((a, b) => a.order - b.order);
  if (roles.some(role => !counts.has(role))) fail('content-required-role');
  if (roles.some(role => counts.get(role)! > 64) || counts.get('rules')! >= 64) fail('content-layer-limit');
  if (['mission', 'strings', 'font'].some(role => counts.get(role as ProfileContentRole) !== 1)) fail('content-singular-role');
  // Multiple layers may intentionally use one logical path, but cannot give it different roles.
  const paths = new Map<string, ProfileContentRole>();
  for (const file of files) {
    if (paths.has(file.path) && paths.get(file.path) !== file.role) fail('content-path-conflict'); paths.set(file.path, file.role);
  }
  const mission = files.find(file => file.role === 'mission')!;
  if (files.some(file => file.role === 'rules' && file.order >= mission.order)) fail('content-mission-order');
  const mods = input.orderedModHashes.map(hash);
  if (new Set(mods).size !== mods.length) fail('content-duplicate-mod');
  return Object.freeze({ profile: input.profile, engineVersion: input.engineVersion, orderedModHashes: Object.freeze(mods), files: Object.freeze(files) });
}
async function digest(bytes: Uint8Array, signal?: AbortSignal): Promise<string> {
  return (await hashByteSource({ size: bytes.length, async read(offset, length) { return bytes.subarray(offset, offset + length); } }, { ...(signal ? { signal } : {}) })).hex;
}

/** Reader lifetime belongs to the caller. Share its AbortSignal with this operation for prompt I/O cancellation. */
export async function assembleProfileContent(reader: Pick<BrowserVerifiedSession, 'read'>, input: ProfileContentPlan,
  options: { readonly signal?: AbortSignal; readonly onProgress?: (progress: ProfileContentProgress) => void } = {}): Promise<CompiledProfileContent> {
  const plan = prepare(input), signal = options.signal, onProgress = options.onProgress;
  const guard = () => throwIfImportAborted(signal); guard();
  const ini = new Map<number, RuntimeIniLayer>(); let strings: CsfCatalog | undefined, bytesRead = 0, filesRead = 0;
  const totalBytes = plan.files.reduce((sum, file) => sum + file.source.size, 0);
  for (const file of plan.files) {
    guard(); const bytes = await reader.read(file.source); guard();
    // Verify the adapter's returned buffer as well; hashes of supplied metadata alone are insufficient.
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== file.source.size) fail('content-read-size');
    if (typeof SharedArrayBuffer !== 'undefined' && bytes.buffer instanceof SharedArrayBuffer) fail('content-shared-bytes');
    const snapshot = new Uint8Array(bytes);
    if (await digest(snapshot, signal) !== file.source.sha256) fail('content-read-hash'); guard();
    if (file.role === 'strings') strings = decodeCsf(snapshot);
    else if (file.role !== 'font') ini.set(file.order, { id: `content-${file.order}`, profile: plan.profile, order: file.order,
      kind: file.kind, sourceSha256: file.source.sha256, bytes: snapshot });
    filesRead++; bytesRead += snapshot.length;
    onProgress?.(Object.freeze({ filesRead, totalFiles: plan.files.length, bytesRead, totalBytes, path: file.path })); guard();
  }
  const compile = (selected: readonly ProfileContentFile[]) => compileRuntimeIni(plan.profile, selected.map(file => ini.get(file.order)!));
  const ruleFiles = plan.files.filter(file => file.role === 'rules' || file.role === 'mission');
  const rules = compile(ruleFiles), mission = compile(plan.files.filter(file => file.role === 'mission'));
  const tables = Object.freeze({ art: compile(plan.files.filter(file => file.role === 'art')), ai: compile(plan.files.filter(file => file.role === 'ai')),
    battle: compile(plan.files.filter(file => file.role === 'battle')), mapsel: compile(plan.files.filter(file => file.role === 'mapsel')),
    briefing: compile(plan.files.filter(file => file.role === 'briefing')), sound: compile(plan.files.filter(file => file.role === 'sound')) });
  guard();
  // Physical root locations and opaque picker IDs are provenance, not semantic identity.
  // Equivalent archived/loose source bytes therefore retain save compatibility.
  const semantic = (files: readonly ProfileContentFile[]) => files.map(file => ({ path: file.path, role: file.role, order: file.order, kind: file.kind, size: file.source.size, sha256: file.source.sha256 }));
  const version = { policy: PROFILE_CONTENT_POLICY, iniPolicy: RUNTIME_INI_POLICY, csfPolicy: 'v3-ambiguous-labels-1', engineVersion: plan.engineVersion,
    profile: plan.profile, orderedModHashes: plan.orderedModHashes };
  const manifestSha256 = await digest(new TextEncoder().encode(JSON.stringify({ ...version, files: semantic(plan.files) })), signal);
  const rulesSha256 = await digest(new TextEncoder().encode(JSON.stringify({ ...version, files: semantic(ruleFiles) })), signal); guard();
  return Object.freeze({ policy: PROFILE_CONTENT_POLICY, scope: 'definitions-and-opening-mission', canStartCampaign: false,
    engineVersion: plan.engineVersion, contentIdentity: Object.freeze({ profile: plan.profile, manifestSha256, rulesSha256, orderedModHashes: plan.orderedModHashes }),
    files: plan.files, rules, mission, tables, strings: strings! });
}
