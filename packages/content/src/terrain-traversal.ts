// SPDX-License-Identifier: GPL-3.0-or-later
// Original WebRA2 traversal policy composing GPL format/content readers; see ../TERRAIN_TRAVERSAL_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import type { ContentIdentity } from '../../contracts/src/index.ts';
import { parseTmpIndex, TMP_LIMITS } from '../../formats/src/tmp.ts';
import type { BrowserMemberIdentity } from '../../vfs/src/browser-verified.ts';
import { compileScenarioTerrain, type ScenarioTerrain, type TerrainCell } from './scenario-terrain.ts';
import { findIniSourceSections, findIniSourceEntries, type IniSourceView } from './ini-source-view.ts';
import type { IniOrigin } from './runtime-ini.ts';
import type { TerrainPreviewAsset } from './terrain-preview.ts';

export const TERRAIN_TRAVERSAL_POLICY = 'webra2-flat-terrain-1' as const;
export const TERRAIN_FACTOR_POLICY = 'webra2-exact-staged-land-decimal-f32-1' as const;
export const TERRAIN_TRAVERSAL_LIMITS = Object.freeze({ cells: 130816, assets: 1024, sourceBytes: 128 * 1024 ** 2,
  mapBytes: 16 * 1024 ** 2, indexSlots: 65536, classes: 8, fields: 32768, graphWork: 8_388_608,
  outputCells: 1_046_528, outputBytes: 128 * 1024 ** 2 });
type Limits = { -readonly [K in keyof typeof TERRAIN_TRAVERSAL_LIMITS]: number };
export const TERRAIN_LAND_NAMES = Object.freeze(['Clear', 'Road', 'Water', 'Rock', 'Wall', 'Tiberium', 'Beach', 'Rough', 'Ice', 'Railroad', 'Tunnel', 'Weeds'] as const);
export const TERRAIN_SPEED_NAMES = Object.freeze(['Foot', 'Track', 'Wheel', 'Hover', 'Winged', 'Float', 'Amphibious', 'FloatBeach'] as const);
// Identical signed-byte lookup tables in both pinned native images. Outside this supported 16-entry domain is unavailable.
const LAND_FROM_TMP = [0, 8, 8, 8, 8, 10, 9, 3, 3, 2, 6, 1, 1, 0, 7, 3] as const;
export interface TraversalMovementClass { readonly id: string; readonly speedType: number }
export interface TerrainTraversalInput {
  readonly contentIdentity: ContentIdentity; readonly terrain: ScenarioTerrain; readonly mapBytes: Uint8Array;
  readonly rules: IniSourceView; readonly assets: readonly TerrainPreviewAsset[];
  readonly choices: readonly Readonly<{ sourceRecord: number; assetId: string; subtile: number }>[];
  readonly movementClasses: readonly TraversalMovementClass[];
}
export interface TerrainFactorStep {
  readonly layerId: string; readonly sectionLine: number | null;
  readonly state: 'retained' | 'default' | 'explicit' | 'forced-winged' | 'unsupported';
  readonly value: number | null; readonly origin: IniOrigin | null;
}
export interface TerrainLandFactor {
  readonly speedType: number; readonly name: string; readonly value: number | null;
  readonly status: 'known' | 'unresolved'; readonly history: readonly TerrainFactorStep[];
}
export interface TerrainLandRow { readonly landType: number; readonly name: string; readonly factors: readonly TerrainLandFactor[] }
export type TraversalBlocker = 'unknown-land' | 'ramp' | 'tmp-height' | 'extra-plane' | 'extra-tile-word' | 'ice-byte' | 'overlay' | 'land-ice' | 'land-tunnel';
export interface TerrainTraversalCell {
  readonly sourceRecord: number; readonly x: number; readonly y: number; readonly elevation: number;
  readonly assetId: string; readonly subtile: number; readonly tileIndex: number; readonly extraTileWord: number;
  readonly iceRaw: number; readonly overlayType: number; readonly overlayData: number;
  readonly tmp: Readonly<{ heightByte: number; terrainTypeByte: number; rampTypeByte: number; flags: number; hasExtra: boolean; hasZ: boolean; hasDamaged: boolean }>;
  readonly landType: number | null; readonly blockers: readonly TraversalBlocker[];
}
export interface TerrainTraversalClass {
  readonly id: string; readonly speedType: number; readonly costScale: 256;
  readonly status: 'ground-subset' | 'unsupported-winged';
  readonly cells: readonly Readonly<{ x: number; y: number; cost: number; exits: number }>[];
  readonly unavailable: Readonly<{ terrain: number; factorUnknown: number; factorNonpositive: number; costRange: number }>;
}
export interface TerrainTraversal {
  readonly policy: typeof TERRAIN_TRAVERSAL_POLICY; readonly factorPolicy: typeof TERRAIN_FACTOR_POLICY;
  readonly sha256: string; readonly contentIdentity: ContentIdentity; readonly traversalComplete: false; readonly nativeBehaviorVerified: false;
  readonly source: ScenarioTerrain['source']; readonly mapVerification: 'sha256-and-recompiled';
  readonly rulesVerification: 'factory-view-caller-identity'; readonly sourceViewPolicy: IniSourceView['policy'];
  readonly ruleLayers: readonly IniSourceView['stages'][number]['layer'][];
  readonly assets: readonly Readonly<{ id: string; path: string; sha256: string; source: BrowserMemberIdentity }>[];
  readonly land: readonly TerrainLandRow[]; readonly cells: readonly TerrainTraversalCell[]; readonly movementClasses: readonly TerrainTraversalClass[];
  readonly unresolved: readonly string[];
  readonly allocations: Readonly<{ sourceBytes: number; indexSlots: number; fields: number; graphWork: number; outputCells: number; outputBytes: number }>;
}
export class TerrainTraversalError extends Error {
  constructor(readonly code: string) { super(`traversal-${code}`); this.name = 'TerrainTraversalError'; }
}
const compiled = new WeakSet<object>();
/** Same-realm, fully verified and frozen compiler results only; serialized metadata is not authority. */
export function isTerrainTraversal(value: unknown): value is TerrainTraversal {
  return !!value && typeof value === 'object' && compiled.has(value);
}
function fail(code: string): never { throw new TerrainTraversalError(code); }
// Internal owned records only: sorted UTF-16 keys, ECMAScript finite-number JSON, exact array order.
function canonicalText(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('nonfinite-output'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(canonicalText).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalText((value as Record<string, unknown>)[k])).join(',') + '}';
  return fail('output-type');
}
function fields(value: unknown, names: readonly string[], exact = true): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('record');
  if (exact && Reflect.ownKeys(value).length !== names.length) fail('fields');
  for (const name of names) { const d = Object.getOwnPropertyDescriptor(value, name); if (!d || !('value' in d) || !d.enumerable) fail('fields'); }
}
function array(value: unknown, max: number): asserts value is readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) fail('array-limit');
  for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d) || !d.enumerable) fail('array'); }
}
function integer(v: unknown, min: number, max: number): asserts v is number {
  if (!Number.isSafeInteger(v) || Object.is(v, -0) || (v as number) < min || (v as number) > max) fail('integer');
}
function id(v: unknown): asserts v is string { if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(v)) fail('id'); }
function hash(v: unknown): asserts v is string { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) fail('hash'); }
const freeze = Object.freeze, compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const hex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const digest = (bytes: Uint8Array): string => hex(sha256(bytes));
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!, bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function byteSize(value: unknown, max: number): number {
  if (!value || Object.getPrototypeOf(value) !== Uint8Array.prototype) fail('bytes');
  const size = lengthOf.call(value) as number, buffer: unknown = bufferOf.call(value);
  if (!(buffer instanceof ArrayBuffer) || resizableOf?.call(buffer) || size < 1 || size > max) fail('byte-limit'); return size;
}
function snapshot(value: Uint8Array, size: number): Uint8Array { const out = new Uint8Array(size); Uint8Array.prototype.set.call(out, value); return out; }
function limits(input: Partial<Limits>): Limits {
  fields(input, [], false); const out: Limits = { ...TERRAIN_TRAVERSAL_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(out, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key)!; if (!('value' in d) || !d.enumerable) fail('limits');
    integer(d.value, 0, out[key as keyof Limits]); out[key as keyof Limits] = d.value;
  } return out;
}
function identity(input: ContentIdentity): ContentIdentity {
  fields(input, ['profile', 'manifestSha256', 'rulesSha256', 'orderedModHashes']);
  if (input.profile !== 'ra2' && input.profile !== 'yr') fail('profile'); hash(input.manifestSha256); hash(input.rulesSha256);
  array(input.orderedModHashes, 256); input.orderedModHashes.forEach(hash);
  return freeze({ profile: input.profile, manifestSha256: input.manifestSha256, rulesSha256: input.rulesSha256, orderedModHashes: freeze([...input.orderedModHashes]) });
}
function member(input: BrowserMemberIdentity): BrowserMemberIdentity {
  fields(input, ['root', 'absoluteOffset', 'size', 'sha256']); fields(input.root, ['sourceId', 'size', 'sha256']);
  id(input.root.sourceId); hash(input.root.sha256); hash(input.sha256); integer(input.root.size, 1, 8 * 1024 ** 3);
  integer(input.absoluteOffset, 0, input.root.size); integer(input.size, 1, input.root.size - input.absoluteOffset);
  return freeze({ root: freeze({ sourceId: input.root.sourceId, size: input.root.size, sha256: input.root.sha256 }), absoluteOffset: input.absoluteOffset, size: input.size, sha256: input.sha256 });
}
// Supported decimal subset; exact original CRT grammar/halfway/x87 rounding is deliberately not claimed.
function factor(value: string): number | null {
  if (value.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?%?$/.test(value)) return null;
  const percent = value.endsWith('%'), number = Number(percent ? value.slice(0, -1) : value);
  if (!Number.isFinite(number)) return null;
  const input = Math.fround(number); if (!Number.isFinite(input)) return null;
  // The pinned CRT differs at exact float32 halves. Exclude those boundaries, including
  // decimals rounded onto a half by Number, instead of claiming its ties-to-even rule.
  const magnitude = Math.abs(number), rounded = Math.abs(input);
  if (magnitude !== rounded) {
    const bits = new DataView(new ArrayBuffer(4)); bits.setFloat32(0, rounded, true);
    bits.setUint32(0, bits.getUint32(0, true) + (magnitude > rounded ? 1 : -1), true);
    if (magnitude === (rounded + bits.getFloat32(0, true)) / 2) return null;
  }
  const output = Math.fround(Math.min(1, percent ? input * 0.01 : input)); return Number.isFinite(output) ? (output === 0 ? 0 : output) : null;
}
const CELL_KEYS = ['x', 'y', 'projectedColumn', 'projectedRow', 'tileIndex', 'extraTileWord', 'rawTileIndex', 'subtile', 'elevation', 'iceRaw', 'overlayType', 'overlayData', 'sourceRecord'] as const;

/** Synchronous worker-intended content compiler. No pixels, native execution, I/O or object occupancy. */
export function compileTerrainTraversal(input: TerrainTraversalInput, options: Partial<Limits> = {}): TerrainTraversal {
  const cap = limits(options);
  fields(input, ['contentIdentity', 'terrain', 'mapBytes', 'rules', 'assets', 'choices', 'movementClasses']);
  const contentIdentity = identity(input.contentIdentity), supplied = input.terrain;
  fields(supplied, ['source', 'profile', 'schemaVersion', 'policy', 'geometryComplete', 'size', 'localSize', 'theater', 'cells'], false);
  fields(supplied.source, ['id', 'profile', 'sha256']); id(supplied.source.id); hash(supplied.source.sha256);
  if (supplied.profile !== contentIdentity.profile || supplied.source.profile !== contentIdentity.profile || supplied.schemaVersion !== 1 ||
      supplied.policy !== 'webra2-terrain-1' || supplied.geometryComplete !== true || !Object.isFrozen(supplied)) fail('terrain');
  const source = freeze({ id: supplied.source.id, profile: contentIdentity.profile, sha256: supplied.source.sha256 });
  fields(supplied.size, ['x', 'y', 'width', 'height']); fields(supplied.localSize, ['x', 'y', 'width', 'height']);
  const size = { ...supplied.size }, localSize = { ...supplied.localSize }, theater = supplied.theater;
  for (const value of [...Object.values(size), ...Object.values(localSize)]) integer(value, 0, 512);
  if (typeof theater !== 'string' || theater.length > 32) fail('theater');
  array(supplied.cells, cap.cells);
  const expectedCells = supplied.cells.map(c => { fields(c, CELL_KEYS); const out = {} as Record<typeof CELL_KEYS[number], number>;
    for (const key of CELL_KEYS) { integer(c[key], 0, 0xffffffff); out[key] = c[key]; } return out; });
  const rules = input.rules;
  fields(rules, ['profile', 'policy', 'stages'], false); array(rules.stages, 64);
  if (rules.profile !== contentIdentity.profile || rules.policy !== 'webra2-ini-source-view-1' || !rules.stages.length) fail('rules');
  // Brand before reading nested caller properties; a view is not a cryptographic source authentication service.
  fields(rules.stages[0], ['layer'], false); fields(rules.stages[0]!.layer, ['id'], false); id(rules.stages[0]!.layer.id);
  findIniSourceSections(rules, rules.stages[0]!.layer.id, 'Clear');
  if (rules.stages.length * TERRAIN_LAND_NAMES.length * 9 > cap.fields) fail('field-limit');
  const maps = rules.stages.filter(s => s.layer.kind === 'map');
  if (maps.length !== 1 || maps[0]!.layer.sourceSha256 !== source.sha256 || maps[0] !== rules.stages.at(-1)) fail('map-stage');
  array(input.assets, cap.assets); array(input.choices, cap.cells); array(input.movementClasses, cap.classes);
  const mapSize = byteSize(input.mapBytes, cap.mapBytes); let sourceBytes = mapSize;
  const assets = new Map<string, TerrainPreviewAsset & { size: number }>(), roots = new Map<string, BrowserMemberIdentity['root']>();
  const ranges = new Map<string, BrowserMemberIdentity[]>();
  for (const a of input.assets) {
    fields(a, ['id', 'path', 'sha256', 'source', 'bytes']); id(a.id); hash(a.sha256);
    if (typeof a.path !== 'string' || !/^[a-z0-9][a-z0-9_.-]{0,127}$/.test(a.path)) fail('asset-path');
    const s = member(a.source), size = byteSize(a.bytes, TMP_LIMITS.fileBytes);
    if (a.sha256 !== s.sha256 || size !== s.size) fail('member-identity');
    if (assets.has(a.id)) fail('asset-id'); sourceBytes += size; if (sourceBytes > cap.sourceBytes) fail('source-limit');
    const prior = roots.get(s.root.sourceId);
    if (prior && (prior.sha256 !== s.root.sha256 || prior.size !== s.root.size)) fail('root-identity'); roots.set(s.root.sourceId, s.root);
    const key = `${s.root.sha256}:${s.root.size}`, group = ranges.get(key) ?? []; group.push(s); ranges.set(key, group);
    assets.set(a.id, { id: a.id, path: a.path, sha256: a.sha256, source: s, bytes: a.bytes, size });
  }
  if (sourceBytes > cap.sourceBytes) fail('source-limit');
  for (const group of ranges.values()) {
    group.sort((a, b) => a.absoluteOffset - b.absoluteOffset);
    for (let i = 1; i < group.length; i++) if (group[i]!.absoluteOffset < group[i - 1]!.absoluteOffset + group[i - 1]!.size) fail('aliased-member');
  }
  const choices = new Map<number, { sourceRecord: number; assetId: string; subtile: number }>(), used = new Set<string>();
  if (input.choices.length !== expectedCells.length) fail('choice-count');
  const byRecord = new Map(expectedCells.map(c => [c.sourceRecord, c]));
  for (const c of input.choices) {
    fields(c, ['sourceRecord', 'assetId', 'subtile']); integer(c.sourceRecord, 0, cap.cells); id(c.assetId); integer(c.subtile, 0, 255);
    if (choices.has(c.sourceRecord) || !assets.has(c.assetId) || byRecord.get(c.sourceRecord)?.subtile !== c.subtile) fail('choice');
    choices.set(c.sourceRecord, { sourceRecord: c.sourceRecord, assetId: c.assetId, subtile: c.subtile }); used.add(c.assetId);
  }
  if (used.size !== assets.size) fail('unused-asset');
  const classes: TraversalMovementClass[] = [], ids = new Set<string>(), speeds = new Set<number>();
  for (const c of input.movementClasses) {
    fields(c, ['id', 'speedType']); id(c.id); integer(c.speedType, 0, 7);
    if (ids.has(c.id) || speeds.has(c.speedType)) fail('duplicate-class'); ids.add(c.id); speeds.add(c.speedType); classes.push(freeze({ id: c.id, speedType: c.speedType }));
  }
  classes.sort((a, b) => compare(a.id, b.id));
  if (classes.length * expectedCells.length > cap.outputCells || classes.length * expectedCells.length * 8 > cap.graphWork) fail('graph-limit');
  const mapBytes = snapshot(input.mapBytes, mapSize);
  if (digest(mapBytes) !== source.sha256) fail('map-hash');
  const terrain = compileScenarioTerrain({ profile: contentIdentity.profile, source, bytes: mapBytes }, { cells: cap.cells, inputBytes: cap.mapBytes });
  if (canonicalText(size) !== canonicalText(terrain.size) || canonicalText(localSize) !== canonicalText(terrain.localSize) || theater !== terrain.theater || expectedCells.length !== terrain.cells.length) fail('terrain-identity');
  // Compare each bounded, descriptor-validated cell without allocating a whole-map canonical string.
  for (let i = 0; i < expectedCells.length; i++) for (const key of CELL_KEYS) if (expectedCells[i]![key] !== terrain.cells[i]![key]) fail('terrain-identity');
  let indexSlots = 0;
  const snapshots = new Map<string, Uint8Array>();
  for (const a of [...assets.values()].sort((a, b) => compare(a.id, b.id))) {
    const bytes = snapshot(a.bytes, a.size); if (digest(bytes) !== a.sha256) fail('asset-hash');
    if (bytes.length < 16) fail('tmp-header'); const view = new DataView(bytes.buffer), x = view.getUint32(0, true), y = view.getUint32(4, true);
    if (!x || !y || x > TMP_LIMITS.tiles || y > Math.floor(TMP_LIMITS.tiles / x)) fail('index-limit');
    indexSlots += x * y; if (indexSlots > cap.indexSlots) fail('index-limit'); snapshots.set(a.id, bytes);
  }
  const indexes = new Map([...snapshots].map(([id, bytes]) => [id, parseTmpIndex(bytes)]));
  let fieldReads = 0, outputBytes = 0;
  const output = <T>(value: T): T => { outputBytes += new TextEncoder().encode(canonicalText(value)).length; if (outputBytes > cap.outputBytes) fail('output-limit'); return freeze(value); };
  const charge = (): void => { if (++fieldReads > cap.fields) fail('field-limit'); };
  const land = TERRAIN_LAND_NAMES.map((name, landType): TerrainLandRow => {
    const values: (number | null)[] = Array.from({ length: 8 }, () => null), histories: TerrainFactorStep[][] = Array.from({ length: 8 }, () => []);
    for (const stage of rules.stages) {
      charge(); const sections = findIniSourceSections(rules, stage.layer.id, name);
      for (let speedType = 0; speedType < 8; speedType++) {
        charge(); let state: TerrainFactorStep['state'] = 'retained', origin: IniOrigin | null = null;
        if (sections.length > 1) { values[speedType] = null; state = 'unsupported'; }
        else if (sections.length === 1) {
          const entries = findIniSourceEntries(sections[0]!, TERRAIN_SPEED_NAMES[speedType]!);
          if (speedType === 4) { values[speedType] = 1; state = 'forced-winged'; }
          else if (entries.length > 1) { values[speedType] = null; state = 'unsupported'; }
          else if (!entries.length) { values[speedType] = 1; state = 'default'; }
          else { origin = entries[0]!.origin; values[speedType] = factor(entries[0]!.value); state = values[speedType] === null ? 'unsupported' : 'explicit'; }
        }
        histories[speedType]!.push(output({ layerId: stage.layer.id, sectionLine: sections.length === 1 ? sections[0]!.line : null, state, value: values[speedType]!, origin }));
      }
    }
    return freeze({ landType, name, factors: freeze(TERRAIN_SPEED_NAMES.map((name, speedType) => freeze({ speedType, name, value: values[speedType]!, status: values[speedType] === null ? 'unresolved' as const : 'known' as const, history: freeze(histories[speedType]!) }))) });
  });
  const cells = terrain.cells.map((c: TerrainCell): TerrainTraversalCell => {
    const choice = choices.get(c.sourceRecord)!; const tile = indexes.get(choice.assetId)!.tiles[choice.subtile]; if (!tile) fail('missing-subtile');
    const landType = LAND_FROM_TMP[tile.terrainTypeByte] ?? null, blockers: TraversalBlocker[] = [];
    if (landType === null) blockers.push('unknown-land'); if (tile.rampTypeByte) blockers.push('ramp');
    if (tile.heightByte) blockers.push('tmp-height'); if (tile.hasExtra) blockers.push('extra-plane');
    if (c.extraTileWord) blockers.push('extra-tile-word'); if (c.iceRaw) blockers.push('ice-byte');
    if (c.overlayType !== 255 || c.overlayData !== 0) blockers.push('overlay');
    if (landType === 8) blockers.push('land-ice'); if (landType === 10) blockers.push('land-tunnel');
    return output({ sourceRecord: c.sourceRecord, x: c.x, y: c.y, elevation: c.elevation, assetId: choice.assetId, subtile: choice.subtile,
      tileIndex: c.tileIndex, extraTileWord: c.extraTileWord, iceRaw: c.iceRaw, overlayType: c.overlayType, overlayData: c.overlayData,
      tmp: freeze({ heightByte: tile.heightByte, terrainTypeByte: tile.terrainTypeByte, rampTypeByte: tile.rampTypeByte,
        flags: tile.flags, hasExtra: tile.hasExtra, hasZ: tile.hasZ, hasDamaged: tile.hasDamaged }), landType, blockers: freeze(blockers) });
  });
  let graphWork = 0, outputCells = 0;
  const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];
  const movementClasses = classes.map((c): TerrainTraversalClass => {
    const unavailable = { terrain: 0, factorUnknown: 0, factorNonpositive: 0, costRange: 0 };
    const eligible = new Map<number, { cell: TerrainTraversalCell; cost: number }>();
    for (const cell of cells) {
      if (c.speedType === 4 || cell.blockers.length) { unavailable.terrain++; continue; }
      const value = land[cell.landType!]!.factors[c.speedType]!.value;
      if (value === null) { unavailable.factorUnknown++; continue; } if (value <= 0) { unavailable.factorNonpositive++; continue; }
      const cost = Math.ceil(256 / value); if (!Number.isSafeInteger(cost) || cost > 65535) { unavailable.costRange++; continue; }
      eligible.set(cell.x + 512 * cell.y, { cell, cost });
    }
    const rows = [...eligible.values()].sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x).map(({ cell, cost }) => {
      let exits = 0;
      for (let d = 0; d < 8; d++) {
        graphWork++; const x = cell.x + DX[d]!, y = cell.y + DY[d]!;
        const to = x >= 0 && x < 512 && y >= 0 && y < 512 ? eligible.get(x + y * 512)?.cell : undefined;
        if (to && to.elevation === cell.elevation) exits |= 1 << d;
      }
      outputCells++; return output({ x: cell.x, y: cell.y, cost, exits });
    });
    return freeze({ id: c.id, speedType: c.speedType, costScale: 256, status: c.speedType === 4 ? 'unsupported-winged' : 'ground-subset', cells: freeze(rows), unavailable: freeze(unavailable) });
  });
  const result = {
    policy: TERRAIN_TRAVERSAL_POLICY, factorPolicy: TERRAIN_FACTOR_POLICY, contentIdentity, traversalComplete: false as const, nativeBehaviorVerified: false as const,
    source, mapVerification: 'sha256-and-recompiled' as const, rulesVerification: 'factory-view-caller-identity' as const, sourceViewPolicy: rules.policy,
    ruleLayers: freeze(rules.stages.map(s => s.layer)), assets: freeze([...assets.values()].sort((a, b) => compare(a.id, b.id)).map(a => freeze({ id: a.id, path: a.path, sha256: a.sha256, source: a.source }))),
    land: freeze(land), cells: freeze(cells), movementClasses: freeze(movementClasses),
    unresolved: freeze(['native-INI-merge-and-CRT-boundaries', 'initial-land-table', 'ramps-and-elevation-crossings', 'overlay-and-bridges', 'ice-and-tunnels', 'extra-tile-semantics', 'MovementZone-and-locomotors', 'object-occupancy']),
    allocations: freeze({ sourceBytes, indexSlots, fields: fieldReads, graphWork, outputCells, outputBytes }),
  };
  // Canonical streaming rows keep hash allocation bounded independently of the graph size.
  const hashState = sha256.create(); let hashBytes = 0;
  const write = (v: unknown): void => { const text = canonicalText(v) + '\n'; if (text.length > cap.outputBytes - hashBytes) fail('output-limit');
    const bytes = new TextEncoder().encode(text); hashBytes += bytes.length; if (hashBytes > cap.outputBytes) fail('output-limit'); hashState.update(bytes); };
  const { land: _land, cells: _cells, movementClasses: _classes, allocations: _allocations, ...header } = result;
  write(header);
  for (const row of land) write(row); for (const cell of cells) write(cell);
  for (const c of movementClasses) { const { cells: _rows, ...metadata } = c; write(metadata); for (const cell of c.cells) write(cell); }
  const owned = freeze({ ...result, allocations: freeze({ ...result.allocations, outputBytes: hashBytes }), sha256: hex(hashState.digest()) });
  compiled.add(owned); return owned;
}
