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
/** Capture descriptor values once; neither validation nor later use invokes a caller's get trap. */
function record(v: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!v || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('record');
  const names = Reflect.ownKeys(v), captured: Record<string, unknown> = Object.create(null);
  if (keys && (names.length !== keys.length || keys.some(k => !names.includes(k)))) fail('record');
  for (const key of names) { const d = Object.getOwnPropertyDescriptor(v, key);
    if (typeof key !== 'string' || !d || !d.enumerable || !('value' in d)) fail('record');
    captured[key] = d.value; }
  return captured;
}
function limits(value: Partial<Limits>): Limits {
  const snapshot = record(value), cap: Limits = { ...INITIAL_WAYPOINT_LIMITS };
  for (const key of Object.keys(snapshot)) { if (!Object.hasOwn(cap, key)) fail('limits');
    const n = snapshot[key]; if (typeof n !== 'number' || !Number.isSafeInteger(n) || Object.is(n, -0) || n < 0 || n > cap[key as keyof Limits]) fail('limits');
    cap[key as keyof Limits] = n; }
  return cap;
}
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const bufferOf = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
const byteLengthOf = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const arrayBufferLengthOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function ownBytes(raw: unknown, maximum: number): Uint8Array {
  try {
    if (!raw || Object.getPrototypeOf(raw) !== Uint8Array.prototype || ['buffer', 'byteOffset', 'byteLength'].some(k => Object.hasOwn(raw, k))) fail('bytes');
    const buffer = bufferOf.call(raw), length = byteLengthOf.call(raw);
    // The intrinsic ArrayBuffer getter rejects SharedArrayBuffer; typed-array getters reject proxies.
    arrayBufferLengthOf.call(buffer);
    if (resizableOf?.call(buffer) || length < 1 || length > maximum) fail('bytes');
    const bytes = new Uint8Array(length); Uint8Array.prototype.set.call(bytes, raw as Uint8Array); return bytes;
  } catch { return fail('bytes'); }
}
const sources = new WeakMap<object, Map<number, InitialWaypointResolution>>();
export const isInitialWaypointSource = (v: unknown): v is InitialWaypointSource => !!v && typeof v === 'object' && sources.has(v);
const unsupported = (...reasons: string[]): InitialWaypointResolution => Object.freeze({ status: 'unsupported', reasons: Object.freeze(reasons) });
/** Metadata rows remain broad. Only this byte-authenticated initial table can resolve an execution reference. */
export function compileInitialWaypointSource(input: ScenarioObjectsInput, options: Partial<Limits> = {}): InitialWaypointSource {
  const snapshot = record(input, ['profile', 'source', 'bytes']), identity = record(snapshot.source, ['id', 'profile', 'sha256']);
  const profile = snapshot.profile;
  if ((profile !== 'ra2' && profile !== 'yr') || identity.profile !== profile) fail('profile');
  if (typeof identity.id !== 'string' || !/^[A-Za-z0-9_.:/#-]{1,256}$/.test(identity.id) ||
    typeof identity.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(identity.sha256)) fail('source');
  const cap = limits(options), bytes = ownBytes(snapshot.bytes, cap.bytes);
  if (Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('') !== identity.sha256) fail('source-hash');
  const source = Object.freeze({ id: identity.id, profile, sha256: identity.sha256 }), maximumIndex = profile === 'ra2' ? 100 : 701;
  const table = compileRuntimeIni(profile, [{ id: source.id, profile, order: 0, kind: 'map', sourceSha256: source.sha256, bytes }], { bytes: cap.bytes });
  const objects = compileScenarioObjects({ profile, source, bytes }, { inputBytes: cap.bytes, waypoints: cap.rows });
  const sourceEncodingSupported = table.layers[0]?.encoding === 'byte-preserving-ascii-compatible';
  // These source/geometry parsers retain their independent byte/row/token bounds. `work` bounds this join only.
  let work = 0; const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const headers = table.sections.find(s => s.name === 'waypoints')?.occurrences ?? [];
  charge(table.sections.length + headers.length + objects.waypoints.length);
  const exactHeaders = headers.filter(h => h.spelling === 'Waypoints');
  const suffixLines = new Set<number>(); for (const d of table.diagnostics) { charge(); if (d.code === 'ignored-section-suffix') suffixLines.add(d.line); }
  const normalizedHeader = exactHeaders.some(h => suffixLines.has(h.line));
  const rows: InitialWaypointRow[] = objects.waypoints.map(waypoint => {
    charge(); const reasons: string[] = [];
    if (!sourceEncodingSupported) reasons.push('source-encoding');
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
