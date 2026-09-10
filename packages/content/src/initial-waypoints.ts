// SPDX-License-Identifier: GPL-3.0-or-later
// Original initial-source execution gate; see ../INITIAL_WAYPOINTS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { compileScenarioObjects, type ScenarioObjectsInput, type ScenarioWaypoint } from './scenario-objects.ts';
import { compileRuntimeIni } from './runtime-ini.ts';
import { teamFingerprint } from './team-values.ts';

export const INITIAL_WAYPOINT_POLICY = 'webra2-initial-source-waypoints-1' as const;
export const INITIAL_WAYPOINT_LIMITS = Object.freeze({ bytes: 16 * 1024 ** 2, rows: 4096,
  work: 262144, serializedBytes: 16 * 1024 ** 2 });
type Limits = { -readonly [K in keyof typeof INITIAL_WAYPOINT_LIMITS]: number };
export interface InitialWaypointRow {
  readonly waypoint: ScenarioWaypoint;
  readonly status: 'supported-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface InitialWaypointSource {
  readonly policy: typeof INITIAL_WAYPOINT_POLICY; readonly source: ScenarioObjectsInput['source'];
  readonly maximumIndex: 100 | 701; readonly rows: readonly InitialWaypointRow[];
  readonly sha256: string; readonly dynamicWaypoints: false; readonly nativeParserVerified: false;
}
export type InitialWaypointResolution = Readonly<{ status: 'supported-source'; waypoint: ScenarioWaypoint }> |
  Readonly<{ status: 'unsupported'; reasons: readonly string[] }>;
export class InitialWaypointError extends Error {
  constructor(readonly code: string) { super(`initial-waypoint-${code}`); this.name = 'InitialWaypointError'; }
}
function fail(code: string): never { throw new InitialWaypointError(code); }
function record(v: unknown, keys?: readonly string[]): asserts v is Record<string, unknown> {
  if (!v || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('record');
  if (keys && (Reflect.ownKeys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k)))) fail('record');
  for (const key of Reflect.ownKeys(v)) { const d = Object.getOwnPropertyDescriptor(v, key)!;
    if (typeof key !== 'string' || !d.enumerable || !('value' in d)) fail('record'); }
}
function limits(value: Partial<Limits>): Limits {
  record(value); const cap: Limits = { ...INITIAL_WAYPOINT_LIMITS };
  for (const key of Object.keys(value)) { if (!Object.hasOwn(cap, key)) fail('limits');
    const n = value[key as keyof Limits]; if (!Number.isSafeInteger(n) || Object.is(n, -0) || n! < 0 || n! > cap[key as keyof Limits]) fail('limits');
    cap[key as keyof Limits] = n!; }
  return cap;
}
const sources = new WeakMap<object, Map<number, InitialWaypointResolution>>();
export const isInitialWaypointSource = (v: unknown): v is InitialWaypointSource => !!v && typeof v === 'object' && sources.has(v);
const unsupported = (...reasons: string[]): InitialWaypointResolution => Object.freeze({ status: 'unsupported', reasons: Object.freeze(reasons) });
/** Metadata rows remain broad. Only this byte-authenticated initial table can resolve an execution reference. */
export function compileInitialWaypointSource(input: ScenarioObjectsInput, options: Partial<Limits> = {}): InitialWaypointSource {
  record(input, ['profile', 'source', 'bytes']); record(input.source, ['id', 'profile', 'sha256']);
  if (!['ra2', 'yr'].includes(input.profile) || input.source.profile !== input.profile) fail('profile');
  if (typeof input.source.id !== 'string' || !/^[A-Za-z0-9_.:/#-]{1,256}$/.test(input.source.id) ||
    typeof input.source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.source.sha256)) fail('source');
  const cap = limits(options), raw = input.bytes;
  if (!raw || Object.getPrototypeOf(raw) !== Uint8Array.prototype || ['buffer', 'byteOffset', 'byteLength'].some(k => Object.hasOwn(raw, k)) ||
    !(raw.buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(raw.buffer) || raw.byteLength < 1 || raw.byteLength > cap.bytes) fail('bytes');
  const bytes = new Uint8Array(raw.byteLength); Uint8Array.prototype.set.call(bytes, raw);
  if (Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('') !== input.source.sha256) fail('source-hash');
  const source = Object.freeze({ ...input.source }), maximumIndex = input.profile === 'ra2' ? 100 : 701;
  const table = compileRuntimeIni(input.profile, [{ id: source.id, profile: input.profile, order: 0, kind: 'map', sourceSha256: source.sha256, bytes }], { bytes: cap.bytes });
  const objects = compileScenarioObjects({ profile: input.profile, source, bytes }, { inputBytes: cap.bytes, waypoints: cap.rows });
  // These source/geometry parsers retain their independent byte/row/token bounds. `work` bounds this join only.
  let work = 0; const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const headers = table.sections.find(s => s.name === 'waypoints')?.occurrences ?? [];
  charge(table.sections.length + headers.length + objects.waypoints.length);
  const exactHeaders = headers.filter(h => h.spelling === 'Waypoints');
  const suffixLines = new Set<number>(); for (const d of table.diagnostics) { charge(); if (d.code === 'ignored-section-suffix') suffixLines.add(d.line); }
  const normalizedHeader = exactHeaders.some(h => suffixLines.has(h.line));
  const rows: InitialWaypointRow[] = objects.waypoints.map(waypoint => {
    charge(); const reasons: string[] = [];
    if (waypoint.number > maximumIndex) reasons.push('index-not-initially-loaded');
    if (waypoint.row.key !== String(waypoint.number) || waypoint.row.origin.keySpelling !== String(waypoint.number)) reasons.push('noncanonical-key');
    if (waypoint.row.origin.sectionSpelling !== 'Waypoints' || exactHeaders.length === 0) reasons.push('exact-section');
    if (exactHeaders.length > 1) reasons.push('repeated-exact-section');
    if (normalizedHeader) reasons.push('normalized-section-suffix');
    if (waypoint.packedCoordinate === 0) reasons.push('zero-invalid-sentinel');
    if (!waypoint.insideDiamond) reasons.push('outside-supported-map');
    return Object.freeze({ waypoint, status: reasons.length ? 'unsupported' as const : 'supported-source' as const, reasons: Object.freeze(reasons) });
  });
  const data = { policy: INITIAL_WAYPOINT_POLICY, source, maximumIndex: maximumIndex as 100 | 701, rows: Object.freeze(rows), dynamicWaypoints: false as const, nativeParserVerified: false as const };
  const result: InitialWaypointSource = Object.freeze({ ...data, sha256: teamFingerprint(data, cap.serializedBytes) });
  const index = new Map<number, InitialWaypointResolution>();
  for (const row of rows) { charge(); index.set(row.waypoint.number, row.status === 'supported-source' ? Object.freeze({ status: 'supported-source', waypoint: row.waypoint }) : unsupported(...row.reasons)); }
  sources.set(result, index); return result;
}
/** This resolver has no dynamic-world fallback. A decoded operand alone grants no source location. */
export function resolveInitialWaypoint(source: InitialWaypointSource, number: number): InitialWaypointResolution {
  const index = sources.get(source); if (!index) fail('source-brand');
  if (!Number.isSafeInteger(number) || Object.is(number, -0) || number < 0 || number > source.maximumIndex) return unsupported('index-not-initially-loaded');
  return index.get(number) ?? unsupported('missing-canonical-key');
}
