// SPDX-License-Identifier: GPL-3.0-or-later
// Original fixed-actor ownership composition. See MISSION_TEAM_RUNTIME_PROVENANCE.md.
import { missionTeamActionSourceContext, type MissionTeamActionSource } from './mission-team-action-source.ts';
import { missionHouseSourceContext } from './mission-house-source.ts';
import { assertWorldModel, createWorldModel, type WorldModel } from './world-model.ts';
import { worldHash, worldInteger, worldPosition, worldRecord, WORLD_LIMITS } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { missionTeamFail as fail, missionTeamSnapshot } from './mission-team-values.ts';
import { WorldSimulation, type WorldSave } from './world.ts';
import { restoreWorldOwnership } from './world-ownership.ts';

export const MISSION_TEAM_OWNED_POLICY = 'webra2-fixed-actor-team-ownership-1' as const;
export interface MissionTeamOwnedBinding {
  readonly policy: typeof MISSION_TEAM_OWNED_POLICY;
  readonly sourceSha256: string; readonly modelSha256: string; readonly houseSourceSha256: string;
  readonly actions: readonly Readonly<{ instructionId: string; opcode: 4 | 7 | 80;
    status: 'supported' | 'unsupported'; reasons: readonly string[]; postTransferRecruitment: 'stationary-guard-sleep' | 'unsupported' }>[];
  readonly allRequiredActionsSupported: boolean; readonly allRequiredTransfersSupported: boolean; readonly sha256: string;
}
const bindings = new WeakMap<object, Readonly<{ source: MissionTeamActionSource; model: WorldModel }>>();
export function missionTeamOwnedBindingData(binding: MissionTeamOwnedBinding) {
  return bindings.get(binding) ?? fail('owned-binding');
}
/** Bounded owning restore for revision-qualified claim validation. Reserve both
 * core and explicit ownership reconstruction before either runs. The counter is
 * a deterministic resource policy, not a wall-clock or native instruction count. */
export function restoreMissionTeamOwnedWorld(binding: MissionTeamOwnedBinding, input: unknown, workLimit: number = WORLD_LIMITS.replayWork) {
  const { model } = missionTeamOwnedBindingData(binding), source = model.ownership!;
  const limit = worldInteger(workLimit, 0, WORLD_LIMITS.replayWork); let work = 0;
  const charge = (n: number) => { if (n > limit - work) fail('owned-world-work'); work += n; };
  charge(model.entities.length * 10 + model.blocked.length + model.navigation.length + model.footprints.reduce((n, f) => n + f.cells.length + 1, 0));
  const copied = missionTeamSnapshot(input, charge) as WorldSave;
  const ownership = copied?.state?.ownership;
  if (!ownership || !Array.isArray(ownership.transfers) || ownership.transfers.length > WORLD_LIMITS.replayAdmissions ||
    !Array.isArray(ownership.lifecycle) || ownership.lifecycle.length !== model.entities.length) fail('owned-world-state');
  const pass = source.types.length + source.houses.length + source.tagChains.length + source.initialActors.length * 12 + source.instructions.length;
  let reserve = ownership.lifecycle.length * 6 + pass * (ownership.transfers.length * 3 + 2);
  for (const transfer of ownership.transfers) {
    if (!transfer || !Array.isArray(transfer.entityIds) || transfer.entityIds.length > WORLD_LIMITS.entities) fail('owned-world-state');
    reserve += 1 + transfer.entityIds.length;
  }
  if (model.infantryPassage) {
    if (!Array.isArray(ownership.sharing) || ownership.sharing.length > WORLD_LIMITS.entities) fail('owned-world-state');
    reserve += model.entities.length * 4 + model.infantryPassage.alliances.length + model.blocked.length +
      model.footprints.reduce((n, f) => n + f.cells.length, 0) + ownership.sharing.length * (64 + model.infantryPassage.alliances.length * 18);
  }
  charge(reserve * 2);
  const world = WorldSimulation.restore(model, copied).save();
  const restored = restoreWorldOwnership(model, world.state.ownership, world.state.entities, world.nextTick, reserve);
  return { world, ownership: restored, work };
}
/** Source declarations remain complete. A supported recruitment subset cannot
 * turn unrepresented constructors or unrelated source diagnostics into authority. */
export function compileMissionTeamOwnedBinding(input: Readonly<{
  source: MissionTeamActionSource; world: WorldModel;
}>): MissionTeamOwnedBinding {
  const r = worldRecord(input, ['source', 'world']), source = r.source as MissionTeamActionSource;
  const data = missionTeamActionSourceContext(source), model = r.world as WorldModel; assertWorldModel(model);
  const houses = model.ownership;
  if (!houses || missionHouseSourceContext(houses).bindings !== data.bindings) fail('owned-source');
  const base = createWorldModel({ contentIdentity: model.contentIdentity, sourceSha256: model.sourceSha256,
    definitionsSha256: model.definitionsSha256, entities: model.entities, navigation: model.navigation,
    blocked: model.blocked.map(worldPosition),
    footprints: model.footprints.map(f => ({ entityId: f.entityId, cells: f.cells.map(worldPosition) })) });
  if (base.sha256 !== data.world.model.sha256 || houses.baseWorldSha256 !== base.sha256) fail('owned-model');
  const recruitmentBySha = new Map(data.recruitmentCatalogs.map(c => [c.sha256, c]));
  const actions = source.actions.map(a => {
    const reasons: string[] = [];
    if (a.status !== 'supported-source') reasons.push('team-action-source');
    if (a.opcode !== 4) reasons.push('dynamic-ownership-constructor-required');
    const catalog = a.catalogSha256 === null ? undefined : recruitmentBySha.get(a.catalogSha256);
    // Transfer may change native mission state. This bounded ordinary policy
    // requires both supported stationary mission controls to permit recruitment.
    const postTransferRecruitment = a.opcode === 4 && catalog && catalog.missionControl.every(m => m.recruitable === true) ? 'stationary-guard-sleep' as const : 'unsupported' as const;
    return { instructionId: a.instructionId, opcode: a.opcode,
      status: reasons.length ? 'unsupported' as const : 'supported' as const, reasons, postTransferRecruitment };
  });
  const value = { policy: MISSION_TEAM_OWNED_POLICY, sourceSha256: source.sha256,
    modelSha256: model.sha256, houseSourceSha256: houses.sha256, actions,
    allRequiredActionsSupported: actions.every(a => a.status === 'supported'),
    allRequiredTransfersSupported: actions.every(a => a.status === 'supported' && a.postTransferRecruitment !== 'unsupported') };
  const binding = freeze({ ...value, sha256: worldHash(value) }); bindings.set(binding, freeze({ source, model })); return binding;
}
