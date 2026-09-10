// SPDX-License-Identifier: GPL-3.0-or-later
// Original composition of reviewed content compilers and the separable MIT world core.
import { sha256 } from '@noble/hashes/sha2.js';
import { compileScenarioObjects } from '../../content/src/scenario-objects.ts';
import { assembleScenarioDefinitions } from '../../content/src/scenario-construction.ts';
import { createIniSourceView, findIniSourceSections, findIniSourceEntries } from '../../content/src/ini-source-view.ts';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from '../../content/src/entity-definitions.ts';
import { isTerrainTraversal, type TerrainTraversal } from '../../content/src/terrain-traversal.ts';
import { isFoundationOccupancy, type FoundationOccupancy } from '../../content/src/foundation-occupancy.ts';
import type { RuntimeIni } from '../../content/src/runtime-ini.ts';
import { canonicalText } from './canonical.ts';
import { createNavigationGrid, navigationCell } from './navigation.ts';
import { createWorldModel, type WorldModel, type WorldEntityDefinition, type WorldFootprint } from './world-model.ts';
import { worldAddress, worldHash, worldRecord, worldInteger, WORLD_LIMITS } from './world-values.ts';

export const WORLD_CONTENT_POLICY = 'webra2-opening-world-1' as const;
export const WORLD_CONTENT_LIMITS = Object.freeze({ mapBytes: 16 * 1024 ** 2, entities: WORLD_LIMITS.entities,
  players: WORLD_LIMITS.players, grids: WORLD_LIMITS.grids, blocked: WORLD_LIMITS.blocked });
type Limits = { -readonly [K in keyof typeof WORLD_CONTENT_LIMITS]: number };
export interface WorldContentInput {
  readonly mapBytes: Uint8Array; readonly rules: RuntimeIni;
  readonly definitions: EntityDefinitions; readonly traversal: TerrainTraversal;
  readonly footprints: FoundationOccupancy;
}
export interface WorldPlacement {
  readonly rowId: string; readonly entityId: number; readonly typeId: string | null;
  readonly ownerId: string | null; readonly playerId: number | null;
  readonly status: 'mobile' | 'stationary' | 'passive' | 'unavailable';
  readonly reasons: readonly string[];
}
export interface WorldPlayer { readonly playerId: number; readonly houseId: string; readonly name: string }
export interface WorldContent {
  readonly policy: typeof WORLD_CONTENT_POLICY; readonly sha256: string; readonly model: WorldModel;
  readonly definitionsSha256: string; readonly traversalSha256: string;
  readonly footprintsSha256: string;
  readonly placements: readonly WorldPlacement[]; readonly players: readonly WorldPlayer[];
  readonly defaultPlayerId: number | null;
  readonly coverage: Readonly<{ placements: number; mobile: number; stationary: number; passive: number; unavailable: number; sharedAnchors: number; footprintCells: number }>;
  readonly limitations: readonly string[]; readonly nativeBehaviorVerified: false; readonly canStartCampaign: false;
}
export class WorldContentError extends Error { constructor(readonly code: string, readonly subjectId: string | null = null) { super(`world-content-${code}`); this.name = 'WorldContentError'; } }
function fail(code: string, subjectId: string | null = null): never { throw new WorldContentError(code, subjectId); }
const known = <T>(field: EntityField<T>): T | null => field.status === 'unsupported' || field.status === 'not-applicable' ? null : field.value;
const whole = (n: number | null, low: number, high: number): n is number => n !== null && Number.isSafeInteger(n) && n >= low && n <= high;
function limits(options: Partial<Limits>): Limits {
  if (!options || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('limits');
  const cap: Limits = { ...WORLD_CONTENT_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(options, key)!; if (!('value' in d) || !d.enumerable) fail('limits');
    cap[key as keyof Limits] = worldInteger(d.value, 0, cap[key as keyof Limits]);
  }
  return cap;
}
function ownedMap(input: Uint8Array, max: number): Uint8Array {
  if (!input || Object.getPrototypeOf(input) !== Uint8Array.prototype) fail('map-bytes');
  const proto = Object.getPrototypeOf(Uint8Array.prototype) as object;
  const size = Object.getOwnPropertyDescriptor(proto, 'byteLength')!.get!.call(input) as number;
  const buffer: unknown = Object.getOwnPropertyDescriptor(proto, 'buffer')!.get!.call(input);
  if (!(buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(buffer) || size < 1 || size > max) fail('map-bytes');
  const bytes = new Uint8Array(size); Uint8Array.prototype.set.call(bytes, input); return bytes;
}
const results = new WeakSet<object>();
export const isWorldContent = (input: unknown): input is WorldContent => !!input && typeof input === 'object' && results.has(input);

/** Recompile authentic map geometry/joins; source-authenticated rules remain the import pipeline's responsibility. */
export function compileWorldContent(input: WorldContentInput, options: Partial<Limits> = {}): WorldContent {
  worldRecord(input, ['mapBytes', 'rules', 'definitions', 'traversal', 'footprints']); const cap = limits(options);
  const definitions = input.definitions, traversal = input.traversal, occupancy = input.footprints;
  if (!isEntityDefinitions(definitions) || !isTerrainTraversal(traversal) || !isFoundationOccupancy(occupancy)) fail('factory');
  if (definitions.profile !== traversal.contentIdentity.profile || canonicalText(definitions.source) !== canonicalText(traversal.source)) fail('profile-source');
  if (occupancy.profile !== definitions.profile || occupancy.definitionsSha256 !== definitions.fingerprint ||
    canonicalText(occupancy.source) !== canonicalText(definitions.source)) fail('footprint-source');
  const rules = createIniSourceView(input.rules);
  if (rules.profile !== definitions.profile || canonicalText(input.rules.layers) !== canonicalText(definitions.sources.rules) ||
    canonicalText(input.rules.layers) !== canonicalText(traversal.ruleLayers)) fail('rule-sources');
  const bytes = ownedMap(input.mapBytes, cap.mapBytes);
  if (Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('') !== definitions.source.sha256) fail('map-hash');
  const objects = compileScenarioObjects({ profile: definitions.profile, source: definitions.source, bytes }, { objects: cap.entities, houses: cap.players });
  const construction = assembleScenarioDefinitions({ objects, rules: input.rules }, { placements: cap.entities, houses: cap.players });
  if (objects.placements.length !== definitions.placements.length || construction.houses.length > cap.players || traversal.movementClasses.length > cap.grids) fail('counts');
  const expected = new Map(construction.placements.map(p => [p.rowId, p])), typed = new Map(definitions.placements.map(p => [p.rowId, p]));
  if (typed.size !== objects.placements.length) fail('placement-join');
  for (const p of objects.placements) {
    const d = typed.get(p.row.id), e = expected.get(p.row.id);
    if (!d || !e || d.typeId !== e.typeId || d.ownerId !== e.owner.houseId || d.rawStrength !== p.strengthRaw) fail('placement-join');
  }
  const players = Object.freeze(construction.houses.map(h => Object.freeze({ playerId: h.index, houseId: h.id, name: h.name })));
  const owners = new Map(players.map(p => [p.houseId, p.playerId]));
  // Explicit development-control selection, not proof of native campaign player setup.
  const map = rules.stages.at(-1)!, basic = findIniSourceSections(rules, map.layer.id, 'Basic');
  const requested = basic.length === 1 ? findIniSourceEntries(basic[0]!, 'Player') : [];
  const matches = requested.length === 1 ? players.filter(p => p.name === requested[0]!.value) : [];
  const defaultPlayerId = matches.length === 1 ? matches[0]!.playerId : null;
  const navigation = traversal.movementClasses.filter(c => c.status === 'ground-subset').map(c => Object.freeze({
    grid: createNavigationGrid({ contentIdentity: traversal.contentIdentity, movementClass: c.id, cells: c.cells }), costScale: c.costScale }));
  const bySpeed = new Map(traversal.movementClasses.map(c => [c.speedType, c]));
  const grids = new Map(navigation.map(b => [b.grid.movementClass, b.grid]));
  const terrain = new Set(traversal.cells.map(c => worldAddress(c.x, c.y)));
  const types = new Map(definitions.definitions.map(d => [d.id, d]));
  const masks = new Map(occupancy.types.map(t => [t.typeId, t]));
  const placements: WorldPlacement[] = [], entities: WorldEntityDefinition[] = [], footprints: WorldFootprint[] = []; let footprintCells = 0;
  for (let i = 0; i < objects.placements.length; i++) {
    const p = objects.placements[i]!, binding = typed.get(p.row.id)!, d = binding.typeId === null ? undefined : types.get(binding.typeId);
    const entityId = i + 1, owner = binding.ownerId === null ? null : owners.get(binding.ownerId) ?? null, reasons: string[] = [];
    if (!d) reasons.push('unresolved-type');
    const passive = p.kind === 'smudge' || p.kind === 'terrain', mobile = p.kind === 'infantry' || p.kind === 'unit' || p.kind === 'aircraft';
    let maximumHealth: number | null = null, initialHealth: number | null = null;
    if (!passive) {
      const maximum = d ? known(d.strength) : null, initial = known(binding.initialHealth);
      if (whole(maximum, 1, WORLD_LIMITS.health) && whole(initial, 0, maximum)) { maximumHealth = maximum; initialHealth = initial; }
      else reasons.push('unsupported-health');
      if (owner === null) reasons.push('unresolved-owner');
    }
    const at = worldAddress(p.x, p.y);
    if (!p.insideDiamond || !terrain.has(at)) reasons.push('outside-terrain');
    let movementPerTick = 0, navigationClass: string | null = null;
    if (mobile) {
      const speed = d ? known(d.speed) : null, speedType = d ? known(d.speedType) : null, locomotor = d ? known(d.locomotor) : null;
      const zone = d ? known(d.movementZone) : null;
      if (!whole(speed, 0, 255)) reasons.push('unsupported-speed');
      if (!whole(zone, 0, definitions.profile === 'yr' ? 12 : 11)) reasons.push('unsupported-movement-zone');
      if (!locomotor || !['walk', 'drive', 'hover', 'mech', 'ship'].includes(locomotor.kind ?? '')) reasons.push('unsupported-locomotor');
      const c = speedType === null ? undefined : bySpeed.get(speedType), grid = c ? grids.get(c.id) : undefined;
      if (!grid) reasons.push('unsupported-navigation-class');
      else if (!navigationCell(grid, { x: p.x, y: p.y })) reasons.push('unavailable-start-cell');
      if (!reasons.length && speed !== null && speed > 0 && initialHealth !== 0) { movementPerTick = speed; navigationClass = c!.id; }
    }
    let blocksCell = p.kind !== 'smudge' && p.kind !== 'aircraft';
    if (p.kind === 'structure' || p.kind === 'terrain') {
      const mask = binding.typeId === null ? undefined : masks.get(binding.typeId);
      if (!mask || mask.kind !== p.kind || mask.status !== 'ready') fail('unsupported-required-footprint', p.row.id);
      blocksCell = false; const cells: { x: number; y: number }[] = [];
      for (const c of mask.cells) {
        if (++footprintCells > cap.blocked) fail('footprint-limit');
        const x = p.x + c.x, y = p.y + c.y;
        if (x < 0 || x > 511 || y < 0 || y > 511) fail('footprint-bounds', p.row.id);
        if (x === p.x && y === p.y) blocksCell = true; else cells.push({ x, y });
      }
      if (cells.length) footprints.push({ entityId, cells });
    }
    const status = reasons.length ? 'unavailable' as const : passive ? 'passive' as const : movementPerTick ? 'mobile' as const : 'stationary' as const;
    placements.push(Object.freeze({ rowId: p.row.id, entityId, typeId: binding.typeId, ownerId: binding.ownerId, playerId: owner, status, reasons: Object.freeze(reasons) }));
    entities.push({ id: entityId, rowId: p.row.id, typeId: binding.typeId ?? `unresolved-${entityId}`, owner, kind: p.kind,
      x: p.x, y: p.y, initialHealth, maximumHealth, movementPerTick, navigationClass, blocksCell });
  }
  const limitations = Object.freeze(['stationary-native-base-masks-with-WebRA2-lifetime', 'gate-wall-conversion-and-occupation-counters-not-executed', 'integer-15hz-motion-not-native-locomotion',
    'MovementZone-special-actions-not-executed', 'no-infantry-subcells', 'no-flight-or-transports', 'no-combat-or-runtime-spawns', 'no-mission-logic-or-campaign-execution']);
  const metadata = { policy: WORLD_CONTENT_POLICY, definitionsSha256: definitions.fingerprint, traversalSha256: traversal.sha256, footprintsSha256: occupancy.sha256,
    placements: Object.freeze(placements), players, defaultPlayerId, limitations, nativeBehaviorVerified: false as const, canStartCampaign: false as const };
  const digest = worldHash(metadata), model = createWorldModel({ contentIdentity: traversal.contentIdentity,
    sourceSha256: definitions.source.sha256, definitionsSha256: digest, entities, navigation, footprints, blocked: [] });
  const coverage = Object.freeze({ placements: placements.length, mobile: placements.filter(p => p.status === 'mobile').length,
    stationary: placements.filter(p => p.status === 'stationary').length, passive: placements.filter(p => p.status === 'passive').length,
    unavailable: placements.filter(p => p.status === 'unavailable').length, sharedAnchors: model.initialSharedCells, footprintCells });
  const result = Object.freeze({ ...metadata, sha256: digest, model, coverage }); results.add(result); return result;
}
