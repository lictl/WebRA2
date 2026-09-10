// SPDX-License-Identifier: GPL-3.0-or-later
// Original atomic whole-cell reinforcement placement; no native formation or entry-edge equivalence claim.
import { WorldSimulation, type WorldSave } from './world.ts';
import { navigationCell } from './navigation.ts';
import { worldAddress, worldClone, worldHash, worldInteger, worldRecord, worldSymbol, WORLD_LIMITS } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { TEAM_SPAWN_POLICY, teamSpawnFail as fail, teamSpawnCatalogData, teamSpawnContextData, restoreTeamSpawnContext,
  type TeamSpawnCatalog, type TeamSpawnContext, type TeamSpawnRecord } from './team-spawn-context.ts';

export interface TeamSpawnInsertion {
  readonly policy: typeof TEAM_SPAWN_POLICY; readonly catalogSha256: string; readonly contextSha256: string;
  readonly worldSha256: string; readonly tick: number; readonly actionId: string;
  readonly status: 'ready' | 'blocked' | 'budget-exhausted'; readonly reason: string | null;
  readonly record: TeamSpawnRecord | null; readonly work: number; readonly sha256: string;
}
export interface TeamSpawnInsertionResult { readonly context: TeamSpawnContext; readonly world: WorldSave; readonly record: TeamSpawnRecord; readonly work: number }
/** Stable source-member order; target distance squared, y, x. Occupancy includes current anchors, foundations, and active edge destinations. */
export function prepareTeamSpawnInsertion(catalog: TeamSpawnCatalog, context: TeamSpawnContext, worldInput: unknown, actionIdInput: string): TeamSpawnInsertion {
  const { program } = teamSpawnCatalogData(catalog), data = teamSpawnContextData(context), cap = catalog.limits;
  if (context.catalogSha256 !== catalog.sha256 || data.program !== program) fail('context-catalog');
  const world = WorldSimulation.restore(data.model, worldInput).save(), tick = world.nextTick, actionId = worldSymbol(actionIdInput);
  const action = catalog.actions.find(a => a.id === actionId), template = action?.teamId ? catalog.templates.find(t => t.teamId === action.teamId) : undefined;
  if (!action || !template) fail('insertion-action');
  if (data.records.some(r => r.bornAtTick > tick)) fail('future-record');
  if (data.records.length >= Math.min(cap.records, program.limits.teams) || template.memberTypeIds.length > Math.min(cap.historicalActors, program.limits.members) - data.actors.length) fail('history-limit');
  let work = 0;
  const result = (status: TeamSpawnInsertion['status'], reason: string | null, record: TeamSpawnRecord | null): TeamSpawnInsertion => {
    const r = { policy: TEAM_SPAWN_POLICY, catalogSha256: catalog.sha256, contextSha256: context.sha256,
      worldSha256: worldHash(world), tick, actionId, status, reason, record, work };
    return freeze({ ...r, sha256: worldHash(r) });
  };
  const charge = () => { if (work >= cap.insertionWork) return false; work++; return true; };
  const occupied = new Set<number>(), live = new Map<number, boolean>(); let living = 0;
  for (const at of data.model.blocked) { if (!charge()) return result('budget-exhausted', 'occupancy-work', null); occupied.add(at); }
  for (let i = 0; i < world.state.entities.length; i++) {
    if (!charge()) return result('budget-exhausted', 'occupancy-work', null);
    const e = world.state.entities[i]!, d = data.model.entities[i]!, alive = e.health !== 0; live.set(e.id, alive);
    if (!alive) continue; living++;
    if (d.blocksCell) { occupied.add(worldAddress(e.x, e.y)); if (e.progress > 0) occupied.add(e.route[1]!); }
  }
  if (template.memberTypeIds.length > cap.livingActors - living || template.memberTypeIds.length > WORLD_LIMITS.entities - data.model.entities.length) fail('living-limit');
  for (const p of data.model.footprints) if (live.get(p.entityId)) for (const at of p.cells) {
    if (!charge()) return result('budget-exhausted', 'occupancy-work', null); occupied.add(at);
  }
  const firstId = (data.model.entities.at(-1)?.id ?? 0) + 1;
  worldInteger(firstId + template.memberTypeIds.length - 1, 1, 2147483647);
  for (const c of world.queuedCommands) {
    if (!charge()) return result('budget-exhausted', 'queue-work', null);
    const id = (c.payload as { entityId: number }).entityId;
    if (id >= firstId && id < firstId + template.memberTypeIds.length) fail('preexisting-command-new-actor');
  }
  const candidates: { x: number; y: number; distance: number }[] = [];
  const x0 = action.waypoint.x!, y0 = action.waypoint.y!;
  for (let y = Math.max(0, y0 - cap.radius); y <= Math.min(511, y0 + cap.radius); y++) for (let x = Math.max(0, x0 - cap.radius); x <= Math.min(511, x0 + cap.radius); x++) {
    if (!charge()) return result('budget-exhausted', 'candidate-work', null);
    if (candidates.length >= cap.candidates) return result('budget-exhausted', 'candidate-limit', null);
    candidates.push({ x, y, distance: (x - x0) ** 2 + (y - y0) ** 2 });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  const types = new Map(catalog.archetypes.map(t => [t.typeId, t])), grids = new Map(data.model.navigation.map(b => [b.grid.movementClass, b.grid]));
  const actors: TeamSpawnRecord['actors'][number][] = [];
  for (const typeId of template.memberTypeIds) {
    const d = types.get(typeId)!; let selected: { x: number; y: number } | null = null;
    for (const c of candidates) {
      if (!charge()) return result('budget-exhausted', 'placement-work', null);
      if (!occupied.has(worldAddress(c.x, c.y)) && navigationCell(grids.get(d.navigationClass)!, { x: c.x, y: c.y })) { selected = c; break; }
    }
    if (!selected) return result('blocked', 'no-distinct-passable-cells', null);
    occupied.add(worldAddress(selected.x, selected.y));
    actors.push({ entityId: firstId + actors.length, typeId, houseId: template.houseId, playerId: template.playerId,
      initialHealth: d.maximumHealth, x: selected.x, y: selected.y });
  }
  const ordinal = data.records.length;
  return result('ready', null, { ordinal, actionId, teamId: template.teamId, instanceId: `spawn-team:${ordinal}`, bornAtTick: tick, actors });
}
/** Recomputes the complete proposed record before expanding the genuine model. All failures leave caller state and ID allocation unchanged. */
export function commitTeamSpawnInsertion(catalog: TeamSpawnCatalog, context: TeamSpawnContext, worldInput: unknown, planInput: unknown): TeamSpawnInsertionResult {
  const raw = worldRecord(worldClone(planInput), ['policy', 'catalogSha256', 'contextSha256', 'worldSha256', 'tick', 'actionId', 'status', 'reason', 'record', 'work', 'sha256']);
  const plan = prepareTeamSpawnInsertion(catalog, context, worldInput, worldSymbol(raw.actionId));
  if (worldHash(raw) !== worldHash(plan)) fail('pending-insertion-mismatch');
  if (plan.status !== 'ready' || !plan.record) fail(`insertion-${plan.status}`);
  const data = teamSpawnContextData(context), world = WorldSimulation.restore(data.model, worldInput).save();
  const nextContext = restoreTeamSpawnContext(catalog, [...data.records, plan.record]), nextData = teamSpawnContextData(nextContext);
  const nextWorld = WorldSimulation.restore(nextData.model, { ...world, state: { ...world.state, modelSha256: nextData.model.sha256,
    entities: [...world.state.entities, ...plan.record.actors.map(a => ({ id: a.entityId, x: a.x, y: a.y, health: a.initialHealth,
      goal: null, route: [], progress: 0, waitTicks: 0 }))] } }).save();
  return freeze({ context: nextContext, world: nextWorld, record: plan.record, work: plan.work });
}
