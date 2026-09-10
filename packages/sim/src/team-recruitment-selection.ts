// SPDX-License-Identifier: GPL-3.0-or-later
// Original all-or-nothing D03 selection. Native incremental claims and container tie order are not reproduced.
import { WorldSimulation } from './world.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { worldHash, worldInteger, worldSymbol, worldRecord } from './world-values.ts';
import { teamRecruitmentFail as fail, teamRecruitmentCatalogData, type TeamRecruitmentCatalog } from './team-recruitment-catalog.ts';
import { teamRecruitmentContextData, restoreTeamRecruitmentContext, type TeamRecruitmentContext, type TeamRecruitmentClaim } from './team-recruitment-context.ts';
export interface TeamRecruitmentSelection {
  readonly policy: 'webra2-full-force-nearest-1'; readonly catalogSha256: string; readonly contextSha256: string;
  readonly worldSha256: string; readonly tick: number; readonly actionId: string; readonly actorIds: readonly number[];
  readonly status: 'selected' | 'unavailable' | 'unsupported-source' | 'budget-exhausted';
  readonly reasons: readonly string[]; readonly work: number; readonly sha256: string;
}
export function prepareTeamRecruitmentSelection(catalog: TeamRecruitmentCatalog, context: TeamRecruitmentContext,
  worldInput: unknown, actionInput: string, workLimit?: number): TeamRecruitmentSelection {
  const { program, world } = teamRecruitmentCatalogData(catalog), data = teamRecruitmentContextData(context), cap = catalog.limits;
  if (data.catalog !== catalog || data.program !== program || data.model !== world.model) fail('selection-context');
  const actionId = worldSymbol(actionInput), action = catalog.actions.find(a => a.id === actionId), t = catalog.templates.find(t => t.teamId === action?.teamId);
  if (!action || !t) fail('selection-action');
  const save = WorldSimulation.restore(world.model, worldInput).save(), tick = save.nextTick;
  if (tick >= cap.tick || data.records.some(r => (r.kind === 'recruited' ? r.bornAtTick : r.atTick) > tick)) fail('selection-tick');
  const budget = workLimit === undefined ? cap.work : worldInteger(workLimit, 0, cap.work);
  let work = 0; const selected: number[] = [], reasons = new Set<string>();
  const result = (status: TeamRecruitmentSelection['status']): TeamRecruitmentSelection => {
    const value = { policy: 'webra2-full-force-nearest-1' as const, catalogSha256: catalog.sha256, contextSha256: context.sha256,
      worldSha256: worldHash(save), tick, actionId, actorIds: status === 'selected' ? selected : [], status, reasons: [...reasons].sort(), work };
    return freeze({ ...value, sha256: worldHash(value) });
  };
  if (t.status !== 'supported-source') { t.reasons.forEach(r => reasons.add(r)); return result('unsupported-source'); }
  if (data.instances.length >= program.limits.teams || t.memberTypeIds.length > program.limits.members - data.actors.length || data.records.length >= cap.history) {
    reasons.add('context-capacity'); return result('unavailable');
  }
  const current = new Map(save.state.entities.map(e => [e.id, e])), eligibility = new Map(data.eligibility.map(e => [e.entityId, e]));
  const queued = new Set(save.queuedCommands.map(c => (c.payload as { entityId: number }).entityId));
  const chosen = new Set<number>();
  for (const typeId of t.memberTypeIds) {
    let best: number | null = null, bestScore = Infinity;
    for (const source of catalog.actors) {
      if (work >= budget) { reasons.add('selection-work'); return result('budget-exhausted'); } work++;
      if (source.typeId !== typeId || source.houseId !== t.houseId || source.playerId !== t.playerId || chosen.has(source.entityId)) continue;
      if (source.status !== 'source-candidate') { reasons.add('unsupported-actor-source'); continue; }
      const state = current.get(source.entityId)!, member = eligibility.get(source.entityId)!;
      if (member.claimedBy !== null) { reasons.add('claimed-member'); continue; }
      if (member.releasedMissionUnverified) { reasons.add('released-mission-unverified'); continue; }
      if (state.health === 0) { reasons.add('dead-member'); continue; }
      if (state.health === null || state.goal !== null || state.progress || state.route.length || queued.has(source.entityId)) { reasons.add('busy-member'); continue; }
      if (!(source.recruitableA || t.autocreate) || (!member.recruitableB && t.autocreate)) { reasons.add('recruitment-flags'); continue; }
      const sameGroup = t.group === -2 || member.group === t.group;
      if (!sameGroup && !t.recruiter) { reasons.add('group-mismatch'); continue; }
      // Safe exact JS integer squared cell-center lepton distance; unlike native signed32, it never wraps.
      const dx = state.x - t.anchor!.x, dy = state.y - t.anchor!.y, score = 65536 * (dx * dx + dy * dy) + (sameGroup ? 0 : 12800);
      if (score < bestScore || score === bestScore && (best === null || source.entityId < best)) { best = source.entityId; bestScore = score; }
    }
    if (best === null) { reasons.add('insufficient-members'); return result('unavailable'); }
    chosen.add(best); selected.push(best);
  }
  return result('selected');
}
/** Recompute at the exact checkpoint; no caller acknowledgement can substitute for source/live eligibility. */
export function commitTeamRecruitmentSelection(catalog: TeamRecruitmentCatalog, context: TeamRecruitmentContext,
  worldInput: unknown, input: TeamRecruitmentSelection): Readonly<{ context: TeamRecruitmentContext; record: TeamRecruitmentClaim }> {
  const r = worldRecord(input, ['policy', 'catalogSha256', 'contextSha256', 'worldSha256', 'tick', 'actionId', 'actorIds', 'status', 'reasons', 'work', 'sha256']);
  const expected = prepareTeamRecruitmentSelection(catalog, context, worldInput, worldSymbol(r.actionId));
  if (worldHash(input) !== worldHash(expected) || expected.status !== 'selected') fail('selection-plan');
  const data = teamRecruitmentContextData(context), ordinal = data.records.length;
  const action = catalog.actions.find(a => a.id === expected.actionId)!;
  const record: TeamRecruitmentClaim = freeze({ kind: 'recruited', ordinal, actionId: action.id, instanceId: `recruit-team:${ordinal}`,
    teamId: action.teamId!, bornAtTick: expected.tick, actorIds: expected.actorIds });
  return freeze({ context: restoreTeamRecruitmentContext(catalog, [...data.records, record]), record });
}
