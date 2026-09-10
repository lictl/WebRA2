// SPDX-License-Identifier: GPL-3.0-or-later
// Original context derived from genuine common team construction history.
import { teamFingerprint } from '../../content/src/team-values.ts';
import { missionTeamCellSourceContext } from './mission-team-cell-source.ts';
import { isMissionTeamContext, missionTeamContextData, missionTeamRuntimeData, type MissionTeamRuntime } from './mission-team-context.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import type { WorldModel } from './world-model.ts';
import { worldRecord } from './world-values.ts';
import { missionTeamCellFail as fail, missionTeamCellLimits } from './mission-team-cell-values.ts';
import { MISSION_TEAM_CELL_CONTEXT_POLICY, type MissionTeamCellContextInput, type MissionTeamCellContext,
  type MissionTeamCellActor, type MissionTeamCellLimits } from './mission-team-cell-types.ts';
export type { MissionTeamCellContextInput, MissionTeamCellContext, MissionTeamCellActor } from './mission-team-cell-types.ts';
export interface MissionTeamCellContextData extends MissionTeamCellContextInput {
  readonly cells: ReturnType<typeof missionTeamCellSourceContext>['cells'];
  readonly actions: ReturnType<typeof missionTeamCellSourceContext>['actions'];
  readonly runtime: MissionTeamRuntime; readonly model: WorldModel;
  readonly actors: readonly MissionTeamCellActor[];
  /** Deterministic charged indexing/output work, independent of the supplied sufficient cap. */
  readonly contextWork: number;
}
const contexts = new WeakMap<object, MissionTeamCellContextData>();
export const isMissionTeamCellContext = (v: unknown): v is MissionTeamCellContext => !!v && typeof v === 'object' && contexts.has(v);
export function missionTeamCellContextData(context: MissionTeamCellContext): MissionTeamCellContextData {
  return contexts.get(context) ?? fail('context-brand');
}

/** Valid construction history is not a caller observation. Actual moved events are supplied by the root transaction separately. */
export function compileMissionTeamCellContext(input: MissionTeamCellContextInput, lowerLimits: Partial<MissionTeamCellLimits> = {}): MissionTeamCellContext {
  const r = worldRecord(input, ['source', 'teams']);
  const source = r.source as MissionTeamCellContextInput['source'], sc = missionTeamCellSourceContext(source);
  if (!isMissionTeamContext(r.teams)) fail('team-context-brand');
  const teams = r.teams, td = missionTeamContextData(teams), rd = missionTeamRuntimeData(td.runtime);
  const cap = missionTeamCellLimits(lowerLimits, source.limits);
  let work = 0;
  const charge = (n = 1) => { if (n > cap.contextWork - work) fail('context-work-limit'); work += n; };
  charge();
  if (rd.source !== sc.actions || rd.baseModel !== sc.world.model || td.model.sourceSha256 !== source.source.sha256 ||
    teams.runtimeSha256 !== td.runtime.sha256 || teams.modelSha256 !== td.model.sha256) fail('context-identity');
  if (td.model.entities.length > cap.actors || td.records.length > cap.history || source.archetypes.length > cap.types || source.actions.length > cap.actions) fail('context-count-limit');
  charge(td.model.entities.length + sc.cells.actors.length + source.archetypes.length + source.actions.length + sc.world.players.length + source.invariant.initialActors.length);
  const model = new Map(td.model.entities.map(e => [e.id, e])), initial = new Map(sc.cells.actors.map(a => [a.entityId, a]));
  const archetypes = new Map(source.archetypes.map(a => [a.typeId, a])), actions = new Map(source.actions.map(a => [a.instructionId, a]));
  const players = new Map(sc.world.players.map(p => [p.houseId, p.playerId]));
  const initialPrerequisites = new Map(source.invariant.initialActors.map(a => [a.entityId, a]));
  const output = new Map<number, MissionTeamCellActor>();
  for (const base of sc.world.model.entities) {
    charge(); const original = initial.get(base.id), entity = model.get(base.id);
    if (!original || !entity || entity.typeId !== original.typeId || entity.rowId !== original.rowId || entity.owner !== original.playerId) fail('initial-actor-identity');
    const extra = initialPrerequisites.get(base.id)?.reasons ?? []; charge(original.reasons.length + extra.length);
    const reasons = [...original.reasons, ...extra.map(reason => `initial-context:${reason}`)];
    if (!source.coverage.supportedWorldInvariantReady) reasons.push('unsupported-world-invariant');
    output.set(entity.id, { entityId: entity.id, typeId: original.typeId, ownerId: original.ownerId, playerId: original.playerId,
      provenance: { kind: 'initial', cellActorRowId: original.rowId }, status: reasons.length ? 'unsupported' : 'supported', reasons });
  }
  // Active bindings deliberately omit released actors. Historical births do not:
  // their permanent model rows and constructor provenance remain available for later movement.
  for (const record of td.records) {
    charge(); if (record.kind !== 'spawned') continue;
    const action = actions.get(record.actionId);
    if (!action || action.kind !== 'spawn' || action.typeIds.length !== record.actors.length) fail('birth-action');
    charge(record.actors.length);
    for (let slot = 0; slot < record.actors.length; slot++) {
      charge(); const birth = record.actors[slot]!, entity = model.get(birth.entityId), archetype = archetypes.get(birth.typeId);
      if (!entity || !archetype || output.has(birth.entityId) || entity.kind !== archetype.kind ||
        action.typeIds[slot] !== birth.typeId || entity.typeId !== birth.typeId || entity.owner !== birth.playerId ||
        players.get(birth.houseId) !== birth.playerId || entity.initialHealth !== birth.initialHealth) fail('birth-actor-identity');
      const reasons = [...action.reasons, ...archetype.reasons]; charge(reasons.length);
      if (!source.coverage.supportedWorldInvariantReady) reasons.push('unsupported-world-invariant');
      output.set(entity.id, { entityId: entity.id, typeId: birth.typeId, ownerId: birth.houseId, playerId: birth.playerId,
        provenance: { kind: 'constructed', birthRecordOrdinal: record.ordinal, actionId: record.actionId, instanceId: record.instanceId,
          teamId: record.teamId, taskForceSlot: slot, bornAtTick: record.bornAtTick }, status: reasons.length ? 'unsupported' : 'supported', reasons });
    }
  }
  if (output.size !== model.size) fail('unrepresented-actor');
  charge(td.model.entities.length); const actors = td.model.entities.map(e => output.get(e.id)!);
  const common = { policy: MISSION_TEAM_CELL_CONTEXT_POLICY, sourceSha256: source.sha256, teamContextSha256: teams.sha256,
    runtimeSha256: td.runtime.sha256, modelSha256: td.model.sha256, actors };
  // Charge the owned serialization graph before hash/freeze. Neither a lower budget
  // nor this counter participates in semantic identity.
  let nodes = 0, characters = 0;
  function audit(value: unknown): void {
    charge(); if (++nodes > cap.nodes) fail('context-node-limit');
    if (typeof value === 'string') { if (value.length > cap.characters - characters) fail('context-character-limit'); characters += value.length; }
    else if (value && typeof value === 'object') {
      const keys = Object.keys(value); charge(keys.length);
      for (const key of keys) audit((value as Record<string, unknown>)[key]);
    }
  }
  audit(common);
  const result: MissionTeamCellContext = freeze({ ...common, sha256: teamFingerprint(common, cap.serializedBytes) });
  contexts.set(result, Object.freeze({ source, cells: sc.cells, actions: sc.actions, teams, runtime: td.runtime, model: td.model, actors: result.actors, contextWork: work }));
  return result;
}
