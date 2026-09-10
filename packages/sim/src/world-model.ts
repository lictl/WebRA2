// SPDX-License-Identifier: MIT
// Original content-bound world model. Native interpretation belongs to the content adapter.
import type { ContentIdentity } from '../../contracts/src/index.ts';
import { canonicalText } from './canonical.ts';
import { combatInfantryPrograms, combatDeathBinding, assertCombatModel, type CombatModel } from './combat-model.ts';
import { worldFail, worldRecord, worldList, worldInteger, worldSymbol as symbol, worldSourceHash as hash, worldContent, worldAddress, worldPosition, worldHash, WORLD_LIMITS } from './world-values.ts';
export * from './world-values.ts';
import { navigationCell, NAVIGATION_POLICY, type NavigationGrid } from './navigation.ts';

export const WORLD_MODEL_POLICY = 'webra2-world-model-1' as const;
export const WORLD_MOTION_POLICY = 'webra2-cell-motion-1' as const;
export const WORLD_ENGINE_VERSION = 'webra2-world-1' as const;
export interface WorldEntityDefinition {
  readonly id: number; readonly rowId: string; readonly typeId: string; readonly owner: number | null;
  readonly kind: 'infantry' | 'unit' | 'aircraft' | 'structure' | 'terrain' | 'smudge';
  readonly x: number; readonly y: number; readonly initialHealth: number | null; readonly maximumHealth: number | null;
  /** Explicit WebRA2 integer credit per tick, prior to the grid's costScale. Not native locomotor fidelity. */
  readonly movementPerTick: number; readonly navigationClass: string | null; readonly blocksCell: boolean;
}
export interface WorldNavigationBinding { readonly grid: NavigationGrid; readonly costScale: number }
export interface WorldFootprint { readonly entityId: number; readonly cells: readonly Readonly<{ x: number; y: number }>[] }
export interface WorldModelInput {
  readonly contentIdentity: ContentIdentity; readonly sourceSha256: string; readonly definitionsSha256: string;
  readonly entities: readonly WorldEntityDefinition[]; readonly navigation: readonly WorldNavigationBinding[];
  /** Additional explicit occupied cells, e.g. supported foundation cells beyond each entity's anchor. */
  readonly blocked: readonly Readonly<{ x: number; y: number }>[];
  /** Extra absolute occupied cells belonging to stationary entities; omit each anchor handled by blocksCell. */
  readonly footprints?: readonly WorldFootprint[];
  readonly combat?: CombatModel;
}
export interface WorldModel {
  readonly policy: typeof WORLD_MODEL_POLICY; readonly motionPolicy: typeof WORLD_MOTION_POLICY;
  readonly contentIdentity: ContentIdentity; readonly sourceSha256: string; readonly definitionsSha256: string;
  readonly sha256: string; readonly entities: readonly WorldEntityDefinition[];
  readonly navigation: readonly WorldNavigationBinding[]; readonly blocked: readonly number[];
  readonly footprints: readonly Readonly<{ entityId: number; cells: readonly number[] }>[];
  readonly initialSharedCells: number; readonly nativeBehaviorVerified: false;
  readonly combat?: CombatModel;
}
const models = new WeakSet<WorldModel>();
export function assertWorldModel(model: WorldModel): void { if (!models.has(model)) worldFail('world-model'); }

/** Content adapters supply interpreted health, occupancy and traversal. No art/pixel inference occurs here. */
export function createWorldModel(input: WorldModelInput): WorldModel {
  const hasFootprints = !!input && Object.hasOwn(input, 'footprints'), hasCombat = !!input && Object.hasOwn(input, 'combat');
  const r = worldRecord(input, ['contentIdentity', 'sourceSha256', 'definitionsSha256', 'entities', 'navigation', 'blocked',
    ...(hasFootprints ? ['footprints'] : []), ...(hasCombat ? ['combat'] : [])]);
  const contentIdentity = worldContent(r.contentIdentity), sourceSha256 = hash(r.sourceSha256), definitionsSha256 = hash(r.definitionsSha256);
  const classes = new Set<string>(), navigation: WorldNavigationBinding[] = [];
  for (const item of worldList(r.navigation, WORLD_LIMITS.grids)) {
    const b = worldRecord(item, ['grid', 'costScale']), grid = b.grid as NavigationGrid;
    // Public metadata alone cannot forge the navigation factory's private storage.
    try { navigationCell(grid, { x: 0, y: 0 }); } catch { worldFail('world-navigation-grid'); }
    if (grid.policy !== NAVIGATION_POLICY || canonicalText(grid.contentIdentity) !== canonicalText(contentIdentity) || classes.has(grid.movementClass)) worldFail('world-navigation-identity');
    classes.add(grid.movementClass); navigation.push(Object.freeze({ grid, costScale: worldInteger(b.costScale, 1, 256) }));
  }
  navigation.sort((a, b) => a.grid.movementClass < b.grid.movementClass ? -1 : a.grid.movementClass > b.grid.movementClass ? 1 : 0);
  const entities: WorldEntityDefinition[] = [], ids = new Set<number>(), rows = new Set<string>();
  for (const item of worldList(r.entities, WORLD_LIMITS.entities)) {
    const e = worldRecord(item, ['id', 'rowId', 'typeId', 'owner', 'kind', 'x', 'y', 'initialHealth', 'maximumHealth', 'movementPerTick', 'navigationClass', 'blocksCell']);
    const id = worldInteger(e.id, 1, 2147483647), rowId = symbol(e.rowId), typeId = symbol(e.typeId), owner = e.owner === null ? null : worldInteger(e.owner, 0, WORLD_LIMITS.players - 1);
    if (ids.has(id) || rows.has(rowId)) worldFail('world-duplicate-entity'); ids.add(id); rows.add(rowId);
    if (!['infantry', 'unit', 'aircraft', 'structure', 'terrain', 'smudge'].includes(e.kind as string)) worldFail('world-kind');
    const at = worldAddress(e.x, e.y), maximumHealth = e.maximumHealth === null ? null : worldInteger(e.maximumHealth, 1, WORLD_LIMITS.health);
    const initialHealth = e.initialHealth === null ? null : worldInteger(e.initialHealth, 0, maximumHealth ?? 0);
    if ((initialHealth === null) !== (maximumHealth === null)) worldFail('world-health');
    const movementPerTick = worldInteger(e.movementPerTick, 0, 255), navigationClass = e.navigationClass === null ? null : symbol(e.navigationClass);
    if ((navigationClass !== null && !classes.has(navigationClass)) || (movementPerTick > 0 && (navigationClass === null || initialHealth === null || owner === null))) worldFail('world-movement-binding');
    if (typeof e.blocksCell !== 'boolean') worldFail('world-occupancy');
    entities.push(Object.freeze({ id, rowId, typeId, owner, kind: e.kind as WorldEntityDefinition['kind'], ...worldPosition(at),
      initialHealth, maximumHealth, movementPerTick, navigationClass, blocksCell: e.blocksCell }));
  }
  entities.sort((a, b) => a.id - b.id);
  const blocked: number[] = [], blockedSet = new Set<number>();
  for (const item of worldList(r.blocked, WORLD_LIMITS.blocked)) {
    const p = worldRecord(item, ['x', 'y']), at = worldAddress(p.x, p.y); if (blockedSet.has(at)) worldFail('world-duplicate-blocker'); blockedSet.add(at); blocked.push(at);
  }
  blocked.sort((a, b) => a - b);
  const byId = new Map(entities.map(e => [e.id, e])), footprintIds = new Set<number>();
  const footprints: { entityId: number; cells: readonly number[] }[] = []; let footprintCells = 0;
  for (const item of worldList(hasFootprints ? r.footprints : [], WORLD_LIMITS.entities)) {
    const p = worldRecord(item, ['entityId', 'cells']), entityId = worldInteger(p.entityId, 1, 2147483647), d = byId.get(entityId);
    if (!d || d.movementPerTick || footprintIds.has(entityId)) worldFail('world-footprint-entity'); footprintIds.add(entityId);
    const cells: number[] = [], seen = new Set<number>();
    for (const item of worldList(p.cells, WORLD_LIMITS.blocked)) {
      if (++footprintCells > WORLD_LIMITS.blocked) worldFail('world-footprint-limit');
      const c = worldRecord(item, ['x', 'y']), at = worldAddress(c.x, c.y);
      if (seen.has(at) || d.blocksCell && at === worldAddress(d.x, d.y)) worldFail('world-footprint-duplicate'); seen.add(at); cells.push(at);
    }
    if (!cells.length) worldFail('world-footprint-empty');
    cells.sort((a, b) => a - b); footprints.push(Object.freeze({ entityId, cells: Object.freeze(cells) }));
  }
  footprints.sort((a, b) => a.entityId - b.entityId);
  const occupied = new Map<number, number>(blocked.map(at => [at, 1]));
  for (const e of entities) if (e.blocksCell && e.initialHealth !== 0) { const at = worldAddress(e.x, e.y); occupied.set(at, (occupied.get(at) ?? 0) + 1); }
  for (const p of footprints) if (byId.get(p.entityId)!.initialHealth !== 0) for (const at of p.cells) occupied.set(at, (occupied.get(at) ?? 0) + 1);
  const initialSharedCells = [...occupied.values()].filter(n => n > 1).length;
  const combat = r.combat as CombatModel | undefined;
  if (hasCombat) {
    assertCombatModel(combat!);
    for (const a of combat!.actors) {
      const d = byId.get(a.entityId);
      if (!d || d.maximumHealth === null || a.weapons.length > 0 && d.owner === null) worldFail('world-combat-actor');
    }
    const firing=combatInfantryPrograms(combat!);
    if(firing)for(const p of firing){
      const d=byId.get(p.actorId)!;
      if(p.profile!==contentIdentity.profile||p.rowId!==d.rowId||p.typeId!==d.typeId||d.kind!=='infantry'||d.initialHealth===0)worldFail('world-infantry-program');
    }
    const death=combatDeathBinding(combat!);
    if(death)for(const a of death.rules.actors){
      const d=byId.get(a.entityId)!;
      if(d.kind!=='infantry'||d.owner===null||!d.blocksCell||d.initialHealth===0||d.navigationClass===null||footprintIds.has(d.id))worldFail('world-death-actor');
    }
  }
  const common = { policy: WORLD_MODEL_POLICY, motionPolicy: WORLD_MOTION_POLICY, contentIdentity, sourceSha256, definitionsSha256,
    entities: Object.freeze(entities), blocked: Object.freeze(blocked), footprints: Object.freeze(footprints), initialSharedCells, nativeBehaviorVerified: false as const };
  const sha256 = worldHash({ ...common, ...(combat ? { combatSha256: combat.sha256 } : {}), navigation: navigation.map(b => ({ gridSha256: b.grid.sha256, costScale: b.costScale })) });
  const model = Object.freeze({ ...common, ...(combat ? { combat } : {}), navigation: Object.freeze(navigation), sha256 }); models.add(model); return model;
}

/** Local adjacency/cost check used to validate persisted routes against the immutable grid policy. */
export function worldEdgeCost(grid: NavigationGrid, from: number, to: number, blocked: { has(address: number): boolean }): number | null {
  const a = worldPosition(from), b = worldPosition(to), dx = b.x - a.x, dy = b.y - a.y;
  const directions = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const d = directions.findIndex(([x, y]) => x === dx && y === dy);
  if (d < 0 || blocked.has(to)) return null;
  const current = navigationCell(grid, a), target = navigationCell(grid, b);
  if (!current || !target || !(current.exits & 2 ** d)) return null;
  if (dx && dy) {
    const h = navigationCell(grid, { x: b.x, y: a.y }), v = navigationCell(grid, { x: a.x, y: b.y });
    const hBit = dx > 0 ? 4 : 64, vBit = dy > 0 ? 16 : 1;
    if (!h || !v || blocked.has(b.x + 512 * a.y) || blocked.has(a.x + 512 * b.y) ||
      !(current.exits & hBit) || !(current.exits & vBit) || !(h.exits & vBit) || !(v.exits & hBit)) return null;
  }
  return (dx && dy ? 362 : 256) * target.cost;
}
