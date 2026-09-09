// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original bounded compiler; see ../FOUNDATION_OCCUPANCY_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { isEntityDefinitions, type EntityDefinition, type EntityDefinitions } from './entity-definitions.ts';

export const FOUNDATION_OCCUPANCY_POLICY = 'webra2-base-foundation-1' as const;
export const FOUNDATION_OCCUPANCY_LIMITS = Object.freeze({ types: 16384, cells: 393216, serializedBytes: 32 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof FOUNDATION_OCCUPANCY_LIMITS]: number };
export interface FoundationCell { readonly x: number; readonly y: number }
export interface FoundationOccupancyType {
  readonly typeId: string; readonly kind: EntityDefinition['kind'];
  /** Ready means the static base attachment geometry is known, not full runtime blocking. */
  readonly status: 'ready' | 'unsupported' | 'not-applicable';
  readonly foundationIndex: number | null;
  /** Preserved candidate geometry on unsupported load proof; consumers must inspect status. */
  readonly cells: readonly FoundationCell[];
  readonly loadEvidence: 'retained-field-history' | 'terrain-strength-load' | 'unproven' | 'not-applicable';
  readonly reasons: readonly string[];
}
export interface FoundationOccupancy {
  readonly schemaVersion: 1; readonly policy: typeof FOUNDATION_OCCUPANCY_POLICY;
  readonly profile: EntityDefinitions['profile']; readonly definitionsSha256: string;
  readonly source: EntityDefinitions['source'];
  readonly geometry: 'native-static-base-attachment'; readonly coordinates: 'relative-map-x-y';
  readonly orientation: 'anchor-addition-without-facing-rotation'; readonly includesBib: false;
  readonly types: readonly FoundationOccupancyType[];
  readonly coverage: Readonly<{ types: number; ready: number; unsupported: number; notApplicable: number; cells: number }>;
  readonly runtimeBlockingVerified: false; readonly nativeExecutionVerified: false;
  readonly requiredRuntimeWork: readonly string[]; readonly sha256: string;
}
export class FoundationOccupancyError extends Error {
  constructor(readonly code: string) { super(`foundation-occupancy-${code}`); this.name = 'FoundationOccupancyError'; }
}
const fail = (code: string): never => { throw new FoundationOccupancyError(code); };
const branded = new WeakSet<object>();
/** Same-realm owned result, not deserialized metadata or external source authentication. */
export function isFoundationOccupancy(value: unknown): value is FoundationOccupancy {
  return value !== null && typeof value === 'object' && branded.has(value);
}
function plain(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('record');
}
function limits(input: Partial<Limits>): Limits {
  plain(input); const result: Limits = { ...FOUNDATION_OCCUPANCY_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(result, key)) fail('limit');
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || d.value < 0 || Object.is(d.value, -0) || d.value > result[key as keyof Limits]) fail('limit');
    result[key as keyof Limits] = d.value;
  }
  return result;
}
// These dimensions describe independently inspected initialized cell lists, not the enum-name table.
// Each row's emitted cells/order was compared with static propagation of both native initializers.
const BUILDING_SHAPES = [[1, 1], [2, 1], [1, 2], [2, 2], [2, 3], [3, 2], [3, 3], [3, 5], [4, 2], [3, 3],
  [1, 3], [3, 1], [4, 3], [1, 4], [1, 5], [2, 6], [2, 5], [5, 3], [4, 4], [3, 4], [6, 4], [0, 0]] as const;
const TERRAIN_SHAPES = [[1, 1], [2, 1], [1, 2], [2, 2], [2, 3], [3, 2], [3, 3], [4, 2]] as const;
const requiredRuntimeWork = Object.freeze(['gate-state-and-wall-to-overlay-or-tile-conversion', 'terrain-theater-occupation-subcells',
  'bridge-altitude-and-alternate-occupation-flags', 'occupy-height-and-add-remove-occupy-counters',
  'object-lifetime-and-overlapping-occupant-updates', 'native-placement-validation-and-extension-foundations']);
function proof(type: EntityDefinition): FoundationOccupancyType['loadEvidence'] {
  // All EntityField histories/origins are produced in 113's property-stage loop. The brand owns those fields.
  const fields = [type.strength, type.armor, type.speed, type.speedType, type.movementZone, type.locomotor, type.crusher,
    type.physicalSize, type.transportSize, type.primary, type.secondary, type.foundation, type.smudgeWidth, type.smudgeHeight];
  if (fields.some(field => field.origin !== null || field.history.length > 0)) return 'retained-field-history';
  if (type.kind === 'terrain' && type.strength.rule === 'terrain-tree-strength' && type.strength.status === 'derived') return 'terrain-strength-load';
  return 'unproven';
}
function fingerprint(value: unknown, maximum: number): string {
  const h = sha256.create(), encoder = new TextEncoder(); let remaining = maximum;
  function emit(text: string): void {
    if (text.length > remaining) fail('serialization-limit');
    const bytes = encoder.encode(text); if (bytes.length > remaining) fail('serialization-limit'); remaining -= bytes.length; h.update(bytes);
  }
  function string(text: string): void {
    if (text.length > Math.floor((remaining - 2) / 6)) fail('serialization-limit'); emit(JSON.stringify(text));
  }
  function visit(v: unknown): void {
    if (typeof v === 'string') string(v);
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') emit(JSON.stringify(v));
    else if (Array.isArray(v)) { emit('['); v.forEach((x, i) => { if (i) emit(','); visit(x); }); emit(']'); }
    else { const r = v as Record<string, unknown>; emit('{'); Object.keys(r).sort().forEach((k, i) => { if (i) emit(','); string(k); emit(':'); visit(r[k]); }); emit('}'); }
  }
  visit(value); return Array.from(h.digest(), b => b.toString(16).padStart(2, '0')).join('');
}
/** Compile static masks from a genuine typed-definition result. No assets, I/O, placements or runtime winner selection. */
export function compileFoundationOccupancy(input: { readonly definitions: EntityDefinitions }, options: Partial<Limits> = {}): FoundationOccupancy {
  const cap = limits(options); plain(input);
  const property = Object.getOwnPropertyDescriptor(input, 'definitions');
  if (Reflect.ownKeys(input).length !== 1 || !property || !('value' in property) || !isEntityDefinitions(property.value)) fail('definitions');
  const definitions: EntityDefinitions = property!.value;
  if (definitions.definitions.length > cap.types) fail('type-limit');
  // Exact aggregate preflight precedes cells/results allocation; every native row has at most 24 owned cells.
  const prepared = definitions.definitions.map(type => {
    const applicable = type.kind === 'structure' || type.kind === 'terrain';
    const index = applicable ? type.foundation.value?.nativeIndex ?? null : null;
    const dimensions = index === null ? undefined : (type.kind === 'structure' ? BUILDING_SHAPES : TERRAIN_SHAPES)[index];
    const count = dimensions ? dimensions[0] * dimensions[1] - (type.kind === 'structure' && index === 9 ? 1 : 0) : 0;
    return { type, applicable, index, dimensions, count };
  });
  let total = 0;
  for (const row of prepared) { if (row.count > cap.cells - total) fail('cell-limit'); total += row.count; }
  const types: FoundationOccupancyType[] = prepared.map(({ type, applicable, index, dimensions }) => {
    const reasons: string[] = [];
    const loadEvidence = applicable ? proof(type) : 'not-applicable';
    if (applicable) {
      if (index === null || type.foundation.status === 'unsupported') reasons.push('unsupported-foundation-definition');
      else if (!dimensions) reasons.push('unterminated-native-terrain-row');
      if (loadEvidence === 'unproven') reasons.push('foundation-pointer-initialization-unproven');
    }
    const cells: FoundationCell[] = [];
    if (dimensions) for (let y = 0; y < dimensions[1]; y++) for (let x = 0; x < dimensions[0]; x++) {
      if (type.kind === 'structure' && index === 9 && x === 2 && y === 1) continue;
      cells.push(Object.freeze({ x, y }));
    }
    return Object.freeze({ typeId: type.id, kind: type.kind, status: !applicable ? 'not-applicable' : reasons.length ? 'unsupported' : 'ready',
      foundationIndex: index, cells: Object.freeze(cells), loadEvidence, reasons: Object.freeze(reasons) });
  });
  const body = Object.freeze({ schemaVersion: 1 as const, policy: FOUNDATION_OCCUPANCY_POLICY, profile: definitions.profile,
    definitionsSha256: definitions.fingerprint, source: Object.freeze({ ...definitions.source }),
    geometry: 'native-static-base-attachment' as const, coordinates: 'relative-map-x-y' as const,
    orientation: 'anchor-addition-without-facing-rotation' as const, includesBib: false as const, types: Object.freeze(types),
    coverage: Object.freeze({ types: types.length, ready: types.filter(t => t.status === 'ready').length,
      unsupported: types.filter(t => t.status === 'unsupported').length, notApplicable: types.filter(t => t.status === 'not-applicable').length, cells: total }),
    runtimeBlockingVerified: false as const, nativeExecutionVerified: false as const, requiredRuntimeWork });
  const result = Object.freeze({ ...body, sha256: fingerprint(body, cap.serializedBytes) }); branded.add(result); return result;
}
