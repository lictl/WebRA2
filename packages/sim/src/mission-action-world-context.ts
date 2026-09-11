// SPDX-License-Identifier: GPL-3.0-or-later
// Original private candidate-world transaction. See ../MISSION_WORLD_PROVENANCE.md.
import { isMissionBindingAuthority, missionBindingSourceContext, type MissionBindingAuthority } from './mission-bindings.ts';
import { missionProgramSpatialAudioSource, missionProgramHouseSource, missionProgramTeamActions, type MissionProgram } from './mission-logic.ts';
import { missionHouseSourceContext } from './mission-house-source.ts';
import { assertWorldModel, type WorldModel } from './world-model.ts';
import { WorldSimulation, worldHouseTransferFacts, type WorldSave } from './world.ts';
import { worldHash, worldInteger, worldRecord, WORLD_LIMITS } from './world-values.ts';
import { missionTeamRuntimeData, type MissionTeamRuntime } from './mission-team-context.ts';
import { restoreMissionTeamCheckpointWithWork, transferMissionTeamOwnership, type MissionTeamCheckpoint } from './mission-team-runtime.ts';
import { restoreMissionTeamOwnedWorld } from './mission-team-owned-binding.ts';

import { missionSpatialAudioSourceContext, resolveMissionSpatialAudioInWorld, restoreMissionSpatialAudioWorld, type MissionSpatialAudioTarget } from './mission-spatial-audio-source.ts';

export const MISSION_ACTION_WORLD_POLICY = 'webra2-private-action-world-1' as const;
/** An opaque one-use handle. Its metadata is not authority when copied. */
export interface MissionActionWorldContext {
  readonly policy: typeof MISSION_ACTION_WORLD_POLICY;
  readonly programSha256: string; readonly worldSha256: string;
  readonly fromStateSha256: string; readonly missionNextTick: number;
}
type Owned = {
  readonly bindings: MissionBindingAuthority; readonly model: WorldModel;
  readonly sourceHouses: ReadonlyMap<string, number>;
  readonly owners: Map<number, number | null>;
  readonly limit: number; work: number;
  readonly teamRuntime: MissionTeamRuntime | null; teams: MissionTeamCheckpoint | null;
  state: 'fresh' | 'running' | 'finished' | 'aborted'; world: WorldSimulation | null;
};
const contexts = new WeakMap<object, Owned>();
function fail(code: string): never { throw new Error(`mission-action-world-${code}`); }
function owned(context: MissionActionWorldContext, program: MissionProgram, state: Owned['state']): Owned {
  const data = contexts.get(context);
  if (!data || data.bindings.program !== program || data.state !== state || !data.world) fail('context');
  return data;
}
function charge(data: Owned, n: number): void {
  if (!Number.isSafeInteger(n) || n < 0 || n > data.limit - data.work) fail('work-limit'); data.work += n;
}

/** The caller checkpoint is cloned. Failed VM work cannot mutate its world or an
 * external WorldSimulation. Only the compound adapter promotes a result to a
 * mission checkpoint; this factory does not certify a mission invocation. */
export function createMissionActionWorldContext(input: Readonly<{
  world: WorldModel; bindings: MissionBindingAuthority; checkpoint: WorldSave; missionNextTick: number;
  teams?: Readonly<{ runtime: MissionTeamRuntime; checkpoint: MissionTeamCheckpoint }>;
}>, workLimit: number): MissionActionWorldContext {
  const hasTeams = !!input && typeof input === 'object' && Object.hasOwn(input, 'teams');
  const r = worldRecord(input, ['world', 'bindings', 'checkpoint', 'missionNextTick', ...(hasTeams ? ['teams'] : [])]);
  if (!isMissionBindingAuthority(r.bindings)) fail('authority');
  const bindings = r.bindings, model = r.world as WorldModel; assertWorldModel(model);
  const house = missionProgramHouseSource(bindings.program), spatial = missionProgramSpatialAudioSource(bindings.program);
  if (missionProgramTeamActions(bindings.program) && !hasTeams) fail('team-source');
  if ((!house && !spatial) || (model.ownership ?? null) !== house ||
    (house && (house.bindingsSha256 !== bindings.catalogSha256 || house.baseWorldSha256 !== bindings.worldSha256)) ||
    (spatial && (spatial.bindingsSha256 !== bindings.catalogSha256 || spatial.baseWorldSha256 !== bindings.worldSha256))) fail('source');
  const source = house ? missionHouseSourceContext(house).bindings : missionSpatialAudioSourceContext(spatial!).bindings;
  if (spatial && missionSpatialAudioSourceContext(spatial).bindings !== source) fail('source');
  const original = missionBindingSourceContext(source);
  const limit = worldInteger(workLimit, 0, 16_777_216);
  const initialWork = (house ? house.instructions.length * (source.triggers.length + original.houses.length + house.houses.length + 1) : 0) + model.entities.length +
    (spatial ? spatial.instructions.length + model.footprints.reduce((n, p) => n + p.cells.length + 1, 0) : 0);
  if (initialWork > limit) fail('work-limit');
  // The bounded restore below performs and reserves the complete source/model
  // join. Do not repeat that scan here outside its navigation/blocker budget.
  const sourceHouses = new Map<string, number>();
  for (const instruction of house?.instructions ?? []) if (instruction.kind === 'action') {
    // SourceHouse is the first house of Trigger.Type's owner country. It is
    // separate from YR's nullable, event-derived Trigger.House used by8997.
    const trigger = source.triggers.find(t => t.id === instruction.triggerId);
    const first = trigger ? original.houses.find(h => h.country.index === trigger.countryIndex) : undefined;
    const player = first ? house!.houses.find(h => h.houseId === first.id) : undefined;
    if (!player || instruction.selector.kind === 'current-trigger-house') fail('trigger-house');
    sourceHouses.set(instruction.triggerId, player.playerId);
  }
  const tick = worldInteger(r.missionNextTick, 0, WORLD_LIMITS.tick - 1);
  let work = initialWork, teamRuntime: MissionTeamRuntime | null = null, teams: MissionTeamCheckpoint | null = null;
  if (hasTeams) {
    const t = worldRecord(r.teams, ['runtime', 'checkpoint']), runtime = t.runtime as MissionTeamRuntime;
    const data = missionTeamRuntimeData(runtime);
    if (!house || !data.owned || data.baseModel !== model || data.source !== missionProgramTeamActions(bindings.program)) fail('team-source');
    const restored = restoreMissionTeamCheckpointWithWork(runtime, t.checkpoint, Math.min(runtime.limits.tickWork, limit - work));
    // Reserve the later complete world equality check as well as reconstruction.
    if (restored.work * 2 > limit - work) fail('work-limit'); work += restored.work * 2;
    if (restored.checkpoint.pending) fail('team-pending');
    teamRuntime = runtime; teams = restored.checkpoint;
  }
  const restored = spatial ? restoreMissionSpatialAudioWorld(spatial, model, r.checkpoint as WorldSave, Math.min(8_388_608, limit - work)) : null;
  work += restored?.work ?? 0;
  const ownedWorld = teamRuntime && !restored ? restoreMissionTeamOwnedWorld(missionTeamRuntimeData(teamRuntime).owned!, r.checkpoint, limit - work) : null;
  if (ownedWorld) { if (ownedWorld.work * 2 > limit - work) fail('work-limit'); work += ownedWorld.work * 2; }
  const world = restored?.world ?? WorldSimulation.restore(model, ownedWorld?.world ?? r.checkpoint);
  if (world.nextTick !== tick + 1) fail('clock');
  const checkpoint = world.save();
  if (teams && worldHash(teams.team.world) !== worldHash(checkpoint)) fail('team-world');
  const owners = new Map(checkpoint.state.entities.map((e, i) => [e.id, house ? e.owner! : model.entities[i]!.owner]));
  const result = Object.freeze({ policy: MISSION_ACTION_WORLD_POLICY, programSha256: bindings.program.sha256,
    worldSha256: model.sha256, fromStateSha256: worldHash(checkpoint), missionNextTick: tick });
  const data: Owned = { bindings, model, sourceHouses, owners, limit, work, teamRuntime, teams, state: 'fresh', world };
  contexts.set(result, data); return result;
}

export function beginMissionActionWorld(context: MissionActionWorldContext, program: MissionProgram, nextTick: number): void {
  const data = owned(context, program, 'fresh');
  if (context.missionNextTick !== nextTick) fail('clock'); data.state = 'running';
}
export function missionActionPopulation(context: MissionActionWorldContext, program: MissionProgram, instructionId: string): boolean {
  const data = owned(context, program, 'running'), source = data.model.ownership!;
  charge(data, source.instructions.length + source.houses.length + 1);
  const value = data.world!.housePopulation(instructionId);
  if (value.status !== 'supported' || value.value === null) fail('population'); return value.value;
}
export function missionActionTransfer(context: MissionActionWorldContext, program: MissionProgram,
  instructionId: string, bindingId: string, triggerId: string): void {
  const data = owned(context, program, 'running'), source = data.model.ownership!;
  charge(data, source.instructions.length + data.bindings.bindings.length + source.tagChains.length + 1);
  const instruction = source.instructions.find(i => i.instructionId === instructionId);
  const binding = data.bindings.bindings.find(b => b.id === bindingId);
  const chain = binding ? source.tagChains.find(t => t.tagId === binding.tagId) : undefined;
  if (!instruction || instruction.kind !== 'action' || instruction.triggerId !== triggerId ||
    !chain?.triggerIds.includes(triggerId)) fail('invocation');
  const sourceHouse = data.sourceHouses.get(triggerId); if (sourceHouse === undefined) fail('trigger-house');
  const invocation = { instructionId, sourceHouse, triggerHouse: null };
  const transferred = data.teamRuntime ? transferMissionTeamOwnership(data.teamRuntime, data.teams!, invocation,
    Math.min(data.teamRuntime.limits.tickWork, data.limit - data.work)) : null;
  if (transferred) charge(data, transferred.work);
  const result = transferred?.result ?? data.world!.transferOwnership(invocation,
    Math.min(WORLD_LIMITS.replayWork, data.limit - data.work));
  const receipt = worldHouseTransferFacts(data.model, result);
  if (receipt.instructionId !== instructionId || receipt.sourceSha256 !== source.sha256 ||
    receipt.bindingsSha256 !== data.bindings.catalogSha256 || receipt.nextTick !== context.missionNextTick + 1) fail('receipt');
  charge(data, (transferred ? 0 : result.work) + result.changedEntityIds.length);
  if (transferred) {
    const restored = restoreMissionTeamOwnedWorld(missionTeamRuntimeData(data.teamRuntime!).owned!, transferred.checkpoint.team.world, data.limit - data.work);
    charge(data, restored.work * 2);
    data.world = WorldSimulation.restore(data.model, restored.world); data.teams = transferred.checkpoint;
  }
  for (const entityId of result.changedEntityIds) {
    if (!data.owners.has(entityId)) fail('actor-owner');
    data.owners.set(entityId, result.destinationHouse);
  }
}
/** Target selection belongs to the actual action boundary. The returned target
 * is source/world component data, never a caller-minted trigger invocation. */
export function missionActionSpatialTarget(context: MissionActionWorldContext, program: MissionProgram,
  instructionId: string, bindingId: string, triggerId: string): MissionSpatialAudioTarget {
  const data = owned(context, program, 'running'), spatial = missionProgramSpatialAudioSource(program);
  if (!spatial) fail('spatial-source');
  const source = missionSpatialAudioSourceContext(spatial).bindings;
  charge(data, spatial.instructions.length + data.bindings.bindings.length + source.tags.length + 1);
  const instruction = spatial.instructions.find(i => i.instructionId === instructionId);
  const binding = data.bindings.bindings.find(b => b.id === bindingId), tag = source.tags.find(t => t.tagId === binding?.tagId);
  charge(data, tag?.runtimeChain.length ?? 0);
  if (!instruction || instruction.triggerId !== triggerId || instruction.status !== 'supported-initial-source' ||
    !tag?.runtimeChain.includes(triggerId)) fail('spatial-invocation');
  const resolved = resolveMissionSpatialAudioInWorld(spatial, data.world!, instructionId, Math.min(8_388_608, data.limit - data.work));
  charge(data, resolved.work); return resolved.target;
}
/** The source row proves actor identity; each predicate reads its current owner
 * here, after any earlier action in this exact private invocation. */
export function missionActionActorOwner(context: MissionActionWorldContext, program: MissionProgram, entityId: number): number | null {
  const data = owned(context, program, 'running'); charge(data, 1);
  if (!data.owners.has(entityId)) fail('actor-owner'); return data.owners.get(entityId)!;
}
/** Read a detached current candidate, so later action consumers see earlier
 * transfers. This is never a post-poll reconstruction from an effect list. */
export function missionActionWorldSnapshot(context: MissionActionWorldContext, program: MissionProgram): WorldSave {
  const data = owned(context, program, 'running'); charge(data, data.model.entities.length); return data.world!.save();
}
export function finishMissionActionWorld(context: MissionActionWorldContext, program: MissionProgram): Readonly<{ world: WorldSave; work: number; teams?: MissionTeamCheckpoint }> {
  const data = owned(context, program, 'running'), world = data.world!.save();
  const teams = data.teams; data.teams = null;
  data.state = 'finished'; data.world = null; data.owners.clear(); return { world, work: data.work, ...(teams ? { teams } : {}) };
}
export function abortMissionActionWorld(context: MissionActionWorldContext, program: MissionProgram): void {
  const data = contexts.get(context);
  if (data?.bindings.program === program && data.state !== 'finished') { data.state = 'aborted'; data.world = null; data.teams = null; data.owners.clear(); }
}
