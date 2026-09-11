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
import { missionTeamConstructorSourceData } from './mission-team-constructor-source.ts';
import { missionTeamConstructorHistoryData, restoreMissionTeamConstructorHistory } from './mission-team-constructor-history.ts';
import type { MissionTeamConstructorBirth, MissionTeamConstructorSource } from './mission-team-constructor-types.ts';

export const MISSION_TEAM_OWNED_POLICY = 'webra2-fixed-actor-team-ownership-1' as const;
export const MISSION_TEAM_CONSTRUCTED_OWNED_POLICY = 'webra2-ordinary-unit-team-ownership-1' as const;
export interface MissionTeamOwnedBinding {
  readonly policy: typeof MISSION_TEAM_OWNED_POLICY | typeof MISSION_TEAM_CONSTRUCTED_OWNED_POLICY;
  readonly constructorSourceSha256?: string;
  readonly sourceSha256: string; readonly modelSha256: string; readonly houseSourceSha256: string;
  readonly actions: readonly Readonly<{ instructionId: string; opcode: 4 | 7 | 80;
    status: 'supported' | 'unsupported'; reasons: readonly string[]; postTransferRecruitment: 'stationary-guard-sleep' | 'unsupported' }>[];
  readonly allRequiredActionsSupported: boolean; readonly allRequiredTransfersSupported: boolean; readonly sha256: string;
}
const bindings = new WeakMap<object, Readonly<{ source: MissionTeamActionSource; model: WorldModel; constructors?: MissionTeamConstructorSource }>>();
export function missionTeamOwnedBindingData(binding: MissionTeamOwnedBinding) {
  return bindings.get(binding) ?? fail('owned-binding');
}
/** Bounded owning restore for revision-qualified claim validation. Reserve both
 * core and explicit ownership reconstruction before either runs. The counter is
 * a deterministic resource policy, not a wall-clock or native instruction count. */
export function restoreMissionTeamOwnedWorld(binding: MissionTeamOwnedBinding, input: unknown, workLimit: number = WORLD_LIMITS.replayWork, currentModel?: WorldModel) {
  const data = missionTeamOwnedBindingData(binding), model = currentModel ?? data.model;
  assertWorldModel(model); const source = model.ownership!;
  const construction = model.construction ? missionTeamConstructorHistoryData(model.construction) : null;
  if (model !== data.model && (!data.constructors || construction?.source !== data.constructors ||
    model.ownership !== data.model.ownership || model.combat !== data.model.combat || model.infantryPassage !== data.model.infantryPassage)) fail('owned-current-model');
  const limit = worldInteger(workLimit, 0, WORLD_LIMITS.replayWork); let work = 0;
  const charge = (n: number) => { if (n > limit - work) fail('owned-world-work'); work += n; };
  charge(model.entities.length * 10 + model.blocked.length + model.navigation.length + model.footprints.reduce((n, f) => n + f.cells.length + 1, 0));
  const copied = missionTeamSnapshot(input, charge) as WorldSave;
  const ownership = copied?.state?.ownership;
  if (!ownership || !Array.isArray(ownership.transfers) || ownership.transfers.length > WORLD_LIMITS.replayAdmissions ||
    !Array.isArray(ownership.lifecycle) || ownership.lifecycle.length !== model.entities.length) fail('owned-world-state');
  const pass = source.types.length + source.houses.length + source.tagChains.length + (construction ? model.entities.length : source.initialActors.length) * 12 + source.instructions.length;
  let reserve = ownership.lifecycle.length * 6 + pass * (ownership.transfers.length * 3 + 2 + (construction?.births.length ?? 0) * 2);
  if (construction) reserve += construction.births.length + construction.entities.length * 3 + model.entities.length;
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
  return { world, ownership: restored, work, model };
}
/** Source declarations remain complete. A supported recruitment subset cannot
 * turn unrepresented constructors or unrelated source diagnostics into authority. */
export function compileMissionTeamOwnedBinding(input: Readonly<{
  source: MissionTeamActionSource; world: WorldModel; constructors?: MissionTeamConstructorSource;
}>): MissionTeamOwnedBinding {
  const hasConstructors = !!input && Object.hasOwn(input, 'constructors');
  const r = worldRecord(input, ['source', 'world', ...(hasConstructors ? ['constructors'] : [])]), source = r.source as MissionTeamActionSource;
  const data = missionTeamActionSourceContext(source), model = r.world as WorldModel; assertWorldModel(model);
  const houses = model.ownership;
  if (!houses || missionHouseSourceContext(houses).bindings !== data.bindings) fail('owned-source');
  const base = createWorldModel({ contentIdentity: model.contentIdentity, sourceSha256: model.sourceSha256,
    definitionsSha256: model.definitionsSha256, entities: model.entities, navigation: model.navigation,
    blocked: model.blocked.map(worldPosition),
    footprints: model.footprints.map(f => ({ entityId: f.entityId, cells: f.cells.map(worldPosition) })) });
  if (base.sha256 !== data.world.model.sha256 || houses.baseWorldSha256 !== base.sha256) fail('owned-model');
  const constructors = hasConstructors ? r.constructors as MissionTeamConstructorSource : undefined;
  if (constructors) {
    const data = missionTeamConstructorSourceData(constructors), history = model.construction && missionTeamConstructorHistoryData(model.construction);
    if (data.actions !== source || data.houses !== houses || !history || history.source !== constructors || history.births.length) fail('owned-constructor-source');
  } else if (hasConstructors || model.construction) fail('owned-constructor-source');
  const constructorActions = new Map(constructors?.actions.map(a => [a.instructionId, a]));
  const recruitmentBySha = new Map(data.recruitmentCatalogs.map(c => [c.sha256, c]));
  const actions = source.actions.map(a => {
    const reasons: string[] = [];
    if (a.status !== 'supported-source') reasons.push('team-action-source');
    if (a.opcode !== 4) {
      const constructor = constructorActions.get(a.instructionId);
      if (!constructor || constructor.status !== 'supported') reasons.push(...(constructor?.reasons.length ? constructor.reasons : ['dynamic-ownership-constructor-required']));
    }
    const catalog = a.catalogSha256 === null ? undefined : recruitmentBySha.get(a.catalogSha256);
    // Transfer may change native mission state. This bounded ordinary policy
    // requires both supported stationary mission controls to permit recruitment.
    const postTransferRecruitment = a.opcode === 4 && catalog && catalog.missionControl.every(m => m.recruitable === true) ? 'stationary-guard-sleep' as const : 'unsupported' as const;
    return { instructionId: a.instructionId, opcode: a.opcode,
      status: reasons.length ? 'unsupported' as const : 'supported' as const, reasons, postTransferRecruitment };
  });
  const value = { policy: constructors ? MISSION_TEAM_CONSTRUCTED_OWNED_POLICY : MISSION_TEAM_OWNED_POLICY,
    ...(constructors ? { constructorSourceSha256: constructors.sha256 } : {}), sourceSha256: source.sha256,
    modelSha256: model.sha256, houseSourceSha256: houses.sha256, actions,
    allRequiredActionsSupported: actions.every(a => a.status === 'supported'),
    allRequiredTransfersSupported: actions.every(a => a.status === 'supported' && (a.opcode !== 4 || a.postTransferRecruitment !== 'unsupported')) };
  const binding = freeze({ ...value, sha256: worldHash(value) }); bindings.set(binding, freeze({ source, model, ...(constructors ? { constructors } : {}) })); return binding;
}

/** Derives only the exact source-born model. Common history/receipt and current
 * save validation still run afterward; this is not a source-action invocation. */
export function missionTeamOwnedConstructionModel(binding: MissionTeamOwnedBinding, births: readonly MissionTeamConstructorBirth[],
  workLimit: number): Readonly<{ model: WorldModel; work: number }> {
  const { model: base, constructors } = missionTeamOwnedBindingData(binding);
  if (!constructors) fail('owned-constructor-source');
  const limit = worldInteger(workLimit, 0, WORLD_LIMITS.replayWork);
  const history = restoreMissionTeamConstructorHistory(constructors, births, Math.min(limit, constructors.limits.work));
  const data = missionTeamConstructorHistoryData(history);
  const work = data.work + (base.entities.length + data.entities.length) * 64 + base.navigation.length + base.blocked.length +
    base.footprints.reduce((n, f) => n + f.cells.length * 2 + 1, 0);
  if (work > limit) fail('owned-constructor-work');
  if (!history.births.length) return Object.freeze({ model: base, work });
  const model = createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256,
    definitionsSha256: base.definitionsSha256, entities: [...base.entities, ...data.entities], navigation: base.navigation,
    blocked: base.blocked.map(worldPosition), footprints: base.footprints.map(f => ({ entityId: f.entityId, cells: f.cells.map(worldPosition) })),
    ownership: base.ownership!, construction: history, ...(base.combat ? { combat: base.combat } : {}),
    ...(base.infantryPassage ? { infantryPassage: base.infantryPassage } : {}) });
  return Object.freeze({ model, work });
}
