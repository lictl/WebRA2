// SPDX-License-Identifier: GPL-3.0-or-later
// Original common-world application of the reviewed full-force spawn/recruitment policies.
import { type MissionTeamContext, type MissionTeamSpawnActor, type MissionTeamRecord, missionTeamContextData, missionTeamAction, missionTeamRuntimeData } from './mission-team-context.ts';
import { restoreMissionTeamOwnedWorld } from './mission-team-owned-binding.ts';
import { currentWorldOwner, worldOwnershipAtRevision } from './world-ownership.ts';
import { combatDyingActorIds } from './combat.ts';
import { WorldSimulation } from './world.ts';
import { worldAddress, worldInteger, WORLD_LIMITS } from './world-values.ts';
import { navigationCell } from './navigation.ts';
import { missionTeamFail as fail, missionTeamSnapshot } from './mission-team-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
export interface MissionTeamClaimPlan { readonly status: 'ready' | 'blocked'; readonly record: MissionTeamRecord | null; readonly work: number }
/** No partial force is returned. Context and caller world remain unchanged on any budget/source failure. */
export function planMissionTeamClaim(context: MissionTeamContext, input: unknown, actionId: string, workLimit: number): MissionTeamClaimPlan {
  const data = missionTeamContextData(context), cap = data.runtime.limits, selected = missionTeamAction(data.runtime, actionId);
  const familyCap = selected.spawn ? Math.min(cap.insertionWork, selected.spawn.limits.insertionWork) : Math.min(cap.selectionWork, selected.recruitment!.limits.work);
  const budget = Math.min(worldInteger(workLimit, 0, cap.tickWork), familyCap);
  const owned = missionTeamRuntimeData(data.runtime).owned;
  const restored = owned ? restoreMissionTeamOwnedWorld(owned, input, budget, data.model) : null;
  const world = restored?.world ?? WorldSimulation.restore(data.model, missionTeamSnapshot(input)).save(), tick = world.nextTick;
  let work = restored?.work ?? 0;
  const charge = (n = 1) => { if (n > budget - work) fail('claim-work'); work += n; };
  if (owned) charge(owned.actions.length);
  const postTransferReady = !owned || owned.actions.some(a => a.instructionId === actionId && a.postTransferRecruitment === 'stationary-guard-sleep');
  const result = (record: MissionTeamRecord | null): MissionTeamClaimPlan => freeze({ status: record ? 'ready' : 'blocked', record, work });
  if (data.records.some(r => (r.kind === 'released' ? r.atTick : r.bornAtTick) > tick)) fail('future-history');
  const catalog = selected.spawn ?? selected.recruitment!, t = catalog.templates.find(t => t.teamId === selected.action.teamId)!;
  if (!t || data.instances.length >= cap.activeTeams || t.memberTypeIds.length > cap.members - data.actors.length ||
    data.records.length + 2 + data.instances.length > cap.history) fail('claim-capacity');
  const ordinal = data.records.length, instanceId = `mission-team:${ordinal}`, base = { ordinal, actionId, instanceId, teamId: t.teamId, bornAtTick: tick };
  if (selected.spawn) {
    const c = selected.spawn, occupied = new Set<number>(), live = new Map<number, boolean>(), dying = combatDyingActorIds(world.state.combat); let living = 0;
    for (const at of data.model.blocked) { charge(); occupied.add(at); }
    for (let i = 0; i < world.state.entities.length; i++) {
      charge(); const e = world.state.entities[i]!, d = data.model.entities[i]!, alive = e.health !== 0 || dying.has(e.id); live.set(e.id, alive);
      if (!alive) continue; living++; if (d.blocksCell) { occupied.add(worldAddress(e.x, e.y)); if (e.progress > 0) occupied.add(e.route[1]!); }
    }
    if (t.memberTypeIds.length > c.limits.livingActors - living || t.memberTypeIds.length > WORLD_LIMITS.entities - data.model.entities.length) fail('living-capacity');
    for (const p of data.model.footprints) if (live.get(p.entityId)) for (const at of p.cells) { charge(); occupied.add(at); }
    const firstId = (data.model.entities.at(-1)?.id ?? 0) + 1;
    worldInteger(firstId + t.memberTypeIds.length - 1, 1, 2147483647);
    for (const command of world.queuedCommands) { charge(); const id = (command.payload as { entityId: number }).entityId;
      const target = (command.payload as { targetId?: number }).targetId;
      if (id >= firstId && id < firstId + t.memberTypeIds.length || target !== undefined && target >= firstId && target < firstId + t.memberTypeIds.length) fail('queued-new-actor'); }
    const wx = selected.action.plan.waypoint.x!, wy = selected.action.plan.waypoint.y!, candidates: { x: number; y: number; distance: number }[] = [];
    for (let y = Math.max(0, wy - c.limits.radius); y <= Math.min(511, wy + c.limits.radius); y++) for (let x = Math.max(0, wx - c.limits.radius); x <= Math.min(511, wx + c.limits.radius); x++) {
      charge(); candidates.push({ x, y, distance: (x - wx) ** 2 + (y - wy) ** 2 }); }
    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x); candidates.length = Math.min(candidates.length, c.limits.candidates);
    const types = new Map(c.archetypes.map(a => [a.typeId, a])), grids = new Map(data.model.navigation.map(n => [n.grid.movementClass, n.grid])), actors: MissionTeamSpawnActor[] = [];
    for (const typeId of t.memberTypeIds) {
      const type = types.get(typeId)!; let found: { x: number; y: number } | undefined;
      for (const candidate of candidates) { charge(); if (!occupied.has(worldAddress(candidate.x, candidate.y)) && navigationCell(grids.get(type.navigationClass)!, { x: candidate.x, y: candidate.y })) { found = candidate; break; } }
      if (!found) return result(null); occupied.add(worldAddress(found.x, found.y));
      actors.push({ entityId: firstId + actors.length, typeId, houseId: t.houseId, playerId: t.playerId, initialHealth: type.maximumHealth, x: found.x, y: found.y });
    }
    return result({ ...base, kind: 'spawned', actors, ...(owned ? { ownershipRevision: world.state.ownership!.transfers.length } : {}) });
  }
  const c = selected.recruitment!, template = c.templates.find(t => t.teamId === selected.action.teamId)!;
  if (template.status !== 'supported-source' || !template.anchor) fail('recruit-source');
  const current = new Map(world.state.entities.map(e => [e.id, e])), eligibility = new Map(data.eligibility.map(e => [e.entityId, e]));
  const queued = new Set(world.queuedCommands.map(command => (command.payload as { entityId: number }).entityId)), chosen = new Set<number>(), ids: number[] = [];
  for (const typeId of template.memberTypeIds) {
    let best: { id: number; score: number } | null = null;
    for (const a of c.actors) {
      charge(); if (a.typeId !== typeId || (!owned && (a.houseId !== template.houseId || a.playerId !== template.playerId)) || a.status !== 'source-candidate' || chosen.has(a.entityId)) continue;
      const e = current.get(a.entityId), member = eligibility.get(a.entityId);
      if (!e || (owned && (currentWorldOwner(data.model, e) !== template.playerId || (worldOwnershipAtRevision(data.model, restored!.ownership, e.id, restored!.ownership.transfers.length).lastChangeRevision > 0 && !postTransferReady))) || !member || member.claimedBy !== null || member.releasedMissionUnverified || e.health === 0 || e.goal !== null || e.progress !== 0 || e.route.length || queued.has(e.id)) continue;
      if (!(a.recruitableA || template.autocreate) || (!member.recruitableB && template.autocreate) ||
        (template.group !== -2 && member.group !== template.group && !template.recruiter)) continue;
      const dx = e.x - template.anchor.x, dy = e.y - template.anchor.y, score = 65536 * (dx * dx + dy * dy) + (member.group === template.group ? 0 : 12800);
      if (!Number.isSafeInteger(score)) fail('recruit-score');
      if (!best || score < best.score || score === best.score && e.id < best.id) best = { id: e.id, score };
    }
    if (!best) return result(null); chosen.add(best.id); ids.push(best.id);
  }
  return result({ ...base, kind: 'recruited', actorIds: ids, ...(owned ? { ownershipRevision: world.state.ownership!.transfers.length } : {}) });
}
