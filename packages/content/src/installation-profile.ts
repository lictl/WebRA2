// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original composition of verified catalog and content APIs.
import { assertJsonValue, type ProfileId } from '../../contracts/src/index.ts';
import { BROWSER_CATALOG_POLICY, type BrowserCatalog, type BrowserAssetCandidate } from '../../vfs/src/browser-catalog.ts';
import type { BrowserMemberIdentity } from '../../vfs/src/browser-verified.ts';
import type { BrowserImportArchive } from '../../vfs/src/browser-types.ts';
import { throwIfImportAborted } from '../../vfs/src/browser-source.ts';
import { hashByteSource } from '../../vfs/src/hash-source.ts';
import { normalizeAssetPath } from '../../vfs/src/profile.ts';
import { assembleProfileContent, type CompiledProfileContent, type ProfileContentFile, type ProfileContentRole } from './profile-content.ts';

export const INSTALLATION_PROFILE_POLICY = 'webra2-standard-definitions-1';
export interface InstallationProfileLimits { readonly candidates: number; readonly memberBytes: number; readonly candidateBytes: number; readonly rootBytes: number }
export const INSTALLATION_PROFILE_LIMITS: InstallationProfileLimits = Object.freeze({ candidates: 256, memberBytes: 16 * 1024 ** 2,
  candidateBytes: 32 * 1024 ** 2, rootBytes: 1024 ** 3 });
export interface InstallationProfileRequest {
  readonly profile: ProfileId;
  readonly engineVersion: string;
  readonly missionPath: string;
}
export interface InstallationCandidate {
  readonly candidate: BrowserAssetCandidate;
  /** Greater wins. null means this policy cannot rank this mount. */
  readonly priority: number | null;
  readonly sourcePolicy: 'loose' | 'numbered-expansion' | 'standard-archive' | 'unsupported-mount';
  readonly identity: BrowserMemberIdentity | null;
}
export interface InstallationDefinition {
  readonly role: ProfileContentRole;
  readonly path: string;
  readonly status: 'pending' | 'resolved' | 'missing' | 'blocked' | 'name-collision' | 'unsupported-mount' | 'content-conflict';
  /** Every equivalent highest-priority copy, never a first-enumerated content winner. */
  readonly selected: readonly string[];
  readonly candidates: readonly InstallationCandidate[];
}
export interface InstallationProfileResult {
  readonly policy: typeof INSTALLATION_PROFILE_POLICY;
  readonly status: 'resolved' | 'unresolved';
  readonly canStartCampaign: false;
  readonly definitions: readonly InstallationDefinition[];
  readonly content: CompiledProfileContent | null;
}
export interface InstallationProfileProgress {
  readonly phase: 'verify' | 'compile';
  readonly completed: number;
  readonly total: number;
  readonly path: string;
}
export class InstallationProfileError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'InstallationProfileError'; }
}
function fail(code: string): never { throw new InstallationProfileError(code); }
const roles = ['rules', 'art', 'ai', 'battle', 'mapsel', 'briefing', 'sound', 'strings', 'font', 'mission'] as const;
const paths = Object.freeze({
  ra2: Object.freeze(['rules.ini', 'art.ini', 'ai.ini', 'battle.ini', 'mapsel.ini', 'mission.ini', 'sound.ini', 'ra2.csf', 'game.fnt']),
  yr: Object.freeze(['rulesmd.ini', 'artmd.ini', 'aimd.ini', 'battlemd.ini', 'mapselmd.ini', 'missionmd.ini', 'soundmd.ini', 'ra2md.csf', 'game.fnt']),
});
// This deliberately excludes arbitrary directories and custom mount classes.
function rank(candidate: BrowserAssetCandidate, profile: ProfileId, archives: ReadonlyMap<string, BrowserImportArchive>): Pick<InstallationCandidate, 'priority' | 'sourcePolicy'> {
  if (candidate.kind === 'literal') return { priority: 200, sourcePolicy: 'loose' };
  let archive = archives.get(candidate.archiveId!);
  if (!archive) fail('installation-archive');
  while (archive.parentId !== null) {
    if (archive.nameCandidates.length !== 1 || !/^(?:local|localmd|cache|cachemd|language|langmd)\.mix$/.test(archive.nameCandidates[0]!)) {
      return { priority: null, sourcePolicy: 'unsupported-mount' };
    }
    archive = archives.get(archive.parentId);
    if (!archive) fail('installation-archive');
  }
  const name = candidate.rootPath;
  const expansion = (profile === 'ra2' ? /^expand(\d{2})\.mix$/ : /^expandmd(\d{2})\.mix$/).exec(name);
  if (expansion) return { priority: 1 + Number(expansion[1]), sourcePolicy: 'numbered-expansion' };
  const standard = profile === 'ra2' ? /^(?:ra2|language|local|cache|maps\d{2})\.mix$/ :
    /^(?:ra2|ra2md|language|langmd|local|localmd|cache|cachemd|maps\d{2}|mapsmd\d{2})\.mix$/;
  return standard.test(name) ? { priority: 0, sourcePolicy: 'standard-archive' } : { priority: null, sourcePolicy: 'unsupported-mount' };
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function identityKey(source: BrowserMemberIdentity): string {
  return JSON.stringify([source.root.sourceId, source.root.size, source.root.sha256, source.absoluteOffset, source.size, source.sha256]);
}
function finish(definitions: readonly InstallationDefinition[], content: CompiledProfileContent | null): InstallationProfileResult {
  return Object.freeze({ policy: INSTALLATION_PROFILE_POLICY, status: content ? 'resolved' : 'unresolved', canStartCampaign: false,
    definitions: Object.freeze([...definitions]), content });
}
function definition(role: ProfileContentRole, path: string, status: InstallationDefinition['status'], candidates: readonly InstallationCandidate[], selected: readonly string[] = []): InstallationDefinition {
  return Object.freeze({ role, path, status, candidates: Object.freeze([...candidates]), selected: Object.freeze([...selected]) });
}
const active = new WeakSet<BrowserCatalog>();
/** Use a catalog from inspectBrowserCatalog. Caller owns its lifetime and shares the signal for prompt read cancellation. */
export async function loadInstallationProfile(catalog: BrowserCatalog, input: InstallationProfileRequest,
  options: { readonly signal?: AbortSignal; readonly onProgress?: (progress: InstallationProfileProgress) => void;
    readonly limits?: Partial<InstallationProfileLimits> } = {}): Promise<InstallationProfileResult> {
  if (active.has(catalog)) fail('installation-busy');
  active.add(catalog);
  const cache = new Map<string, { bytes: Uint8Array; identity: BrowserMemberIdentity }>();
  try {
    assertJsonValue(input);
    if (Object.keys(input).length !== 3 || !['profile', 'engineVersion', 'missionPath'].every(key => Object.hasOwn(input, key))) fail('installation-request');
    const profile = input.profile, engineVersion = input.engineVersion;
    if (profile !== 'ra2' && profile !== 'yr') fail('installation-profile');
    if (typeof engineVersion !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(engineVersion)) fail('installation-engine-version');
    const missionPath = normalizeAssetPath(input.missionPath);
    if (!/\.(map|mpr)$/.test(missionPath)) fail('installation-mission-path');
    const signal = options.signal, onProgress = options.onProgress, limits = { ...INSTALLATION_PROFILE_LIMITS, ...options.limits };
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
      if (!Object.hasOwn(INSTALLATION_PROFILE_LIMITS, key) || !Number.isSafeInteger(limits[key]) || limits[key] < 0 || limits[key] > INSTALLATION_PROFILE_LIMITS[key]) fail('installation-limit');
    }
    const guard = () => throwIfImportAborted(signal); guard();
    if (catalog.policy !== BROWSER_CATALOG_POLICY || catalog.report.profile !== profile) fail('installation-catalog-profile');
    if (catalog.report.status !== 'inspected') fail('installation-incomplete-index');
    const roots = new Map(catalog.report.files.map(file => [file.id, file]));
    const archives = new Map(catalog.report.archives.map(archive => [archive.id, archive]));
    const unique = new Map<string, { candidate: BrowserAssetCandidate; path: string }>(), rootIds = new Set<string>();
    const collisions = new Set<string>();
    let candidateCount = 0, candidateBytes = 0, rootBytes = 0;
    let definitions = roles.map((role, order) => {
      const path = order === 9 ? missionPath : paths[profile][order]!, lookup = catalog.lookup(path);
      if (lookup.candidates.length > limits.candidates - candidateCount) fail('installation-candidate-limit');
      candidateCount += lookup.candidates.length;
      const candidates = lookup.candidates.map(candidate => {
        if (unique.has(candidate.id) && unique.get(candidate.id)!.path !== path) collisions.add(candidate.id);
        if (!unique.has(candidate.id)) {
          if (candidate.size > limits.memberBytes || candidate.size > limits.candidateBytes - candidateBytes) fail('installation-byte-limit');
          candidateBytes += candidate.size; unique.set(candidate.id, { candidate, path });
          if (!rootIds.has(candidate.sourceId)) {
            const root = roots.get(candidate.sourceId); if (!root) fail('installation-root');
            if (root.size > limits.rootBytes - rootBytes) fail('installation-root-budget');
            rootBytes += root.size; rootIds.add(root.id);
          }
        }
        return Object.freeze({ candidate, ...rank(candidate, profile, archives), identity: null });
      });
      const status = !candidates.length ? 'missing' : candidates.some(row => !row.candidate.allowed) ? 'blocked' :
        candidates.some(row => row.candidate.ambiguousName || (row.candidate.knownNames.length > 0 && !row.candidate.knownNames.includes(path))) ? 'name-collision' :
        candidates.some(row => row.priority === null) ? 'unsupported-mount' : 'pending';
      return definition(role, path, status, candidates);
    });
    definitions = definitions.map(row => row.candidates.some(value => collisions.has(value.candidate.id)) ?
      definition(row.role, row.path, 'name-collision', row.candidates) : row);
    // Resolve structural problems before hashing even one potentially large root.
    if (definitions.some(row => row.status !== 'pending')) return finish(definitions, null);
    let completed = 0;
    for (const { candidate, path } of unique.values()) {
      guard(); const found = await catalog.discover(candidate.id); guard();
      // Capture identity scalars before validation or any further await. Even an
      // adapter wrapping the genuine catalog cannot mutate a validated range later.
      const reported = found.identity;
      const source = Object.freeze({ root: Object.freeze({ sourceId: reported.root.sourceId, size: reported.root.size, sha256: reported.root.sha256 }),
        absoluteOffset: reported.absoluteOffset, size: reported.size, sha256: reported.sha256 });
      if (source.root.sourceId !== candidate.sourceId || source.root.size !== roots.get(candidate.sourceId)!.size ||
        source.absoluteOffset !== candidate.absoluteOffset || source.size !== candidate.size || !/^[a-f\d]{64}$/.test(source.sha256) || !/^[a-f\d]{64}$/.test(source.root.sha256)) fail('installation-read-identity');
      if (!(found.bytes instanceof Uint8Array) || found.bytes.byteLength !== candidate.size ||
        (typeof SharedArrayBuffer !== 'undefined' && found.bytes.buffer instanceof SharedArrayBuffer)) fail('installation-read-bytes');
      const bytes = new Uint8Array(found.bytes);
      const digest = await hashByteSource({ size: bytes.length, async read(offset, length) { return bytes.subarray(offset, offset + length); } }, { ...(signal ? { signal } : {}) });
      guard(); if (digest.hex !== source.sha256) fail('installation-read-hash');
      cache.set(candidate.id, { bytes, identity: source });
      onProgress?.(Object.freeze({ phase: 'verify', completed: ++completed, total: unique.size, path })); guard();
    }
    definitions = definitions.map(row => {
      const candidates = row.candidates.map(value => Object.freeze({ ...value, identity: cache.get(value.candidate.id)!.identity }));
      const highest = Math.max(...candidates.map(value => value.priority!)), contenders = candidates.filter(value => value.priority === highest);
      const identities = new Set(contenders.map(value => `${value.identity.size}:${value.identity.sha256}`));
      return definition(row.role, row.path, identities.size === 1 ? 'resolved' : 'content-conflict', candidates,
        identities.size === 1 ? contenders.map(value => value.candidate.id) : []);
    });
    if (definitions.some(row => row.status !== 'resolved')) return finish(definitions, null);
    const selected = new Map<string, Uint8Array>();
    const files: ProfileContentFile[] = definitions.map((row, order) => {
      // This chooses physical storage only after all top candidates have identical bytes.
      const candidates = row.candidates.filter(value => row.selected.includes(value.candidate.id)).sort((a, b) =>
        compare(a.candidate.rootPath, b.candidate.rootPath) || a.candidate.absoluteOffset - b.candidate.absoluteOffset || compare(a.candidate.id, b.candidate.id));
      const chosen = candidates[0]!, source = chosen.identity!;
      selected.set(identityKey(source), cache.get(chosen.candidate.id)!.bytes);
      return { profile, path: row.path, role: row.role, order, kind: row.role === 'mission' ? 'map' : profile === 'yr' ? 'expansion' : 'base', source };
    });
    const content = await assembleProfileContent({ async read(identity) {
      guard(); const bytes = selected.get(identityKey(identity)); if (!bytes) fail('installation-unselected-read'); return bytes.slice();
    } }, { profile, engineVersion, orderedModHashes: [], files }, { ...(signal ? { signal } : {}),
      onProgress(value) { onProgress?.(Object.freeze({ phase: 'compile', completed: value.filesRead, total: value.totalFiles, path: value.path })); guard(); } });
    guard(); return finish(definitions, content);
  } finally { cache.clear(); active.delete(catalog); }
}
