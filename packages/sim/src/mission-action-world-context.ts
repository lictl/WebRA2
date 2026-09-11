// SPDX-License-Identifier: GPL-3.0-or-later
// Original private candidate-world transaction. See ../MISSION_WORLD_PROVENANCE.md.
import { isMissionBindingAuthority, missionBindingSourceContext, type MissionBindingAuthority } from './mission-bindings.ts';
import { missionProgramHouseSource, type MissionProgram } from './mission-logic.ts';
import { missionHouseSourceContext } from './mission-house-source.ts';
import { assertWorldModel, type WorldModel } from './world-model.ts';
import { WorldSimulation, worldHouseTransferFacts, type WorldSave } from './world.ts';
import { worldHash, worldInteger, worldRecord, WORLD_LIMITS } from './world-values.ts';

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
  readonly limit: number; work: number;
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
}>, workLimit: number): MissionActionWorldContext {
  const r = worldRecord(input, ['world', 'bindings', 'checkpoint', 'missionNextTick']);
  if (!isMissionBindingAuthority(r.bindings)) fail('authority');
  const bindings = r.bindings, model = r.world as WorldModel; assertWorldModel(model);
  const house = missionProgramHouseSource(bindings.program);
  if (!house || model.ownership !== house || house.bindingsSha256 !== bindings.catalogSha256 ||
    house.baseWorldSha256 !== bindings.worldSha256) fail('source');
  const source = missionHouseSourceContext(house).bindings;
  const original = missionBindingSourceContext(source);
  const limit = worldInteger(workLimit, 0, 16_777_216);
  const initialWork = house.instructions.length * (source.triggers.length + original.houses.length + house.houses.length + 1) + model.entities.length;
  if (initialWork > limit) fail('work-limit');
  const sourceHouses = new Map<string, number>();
  for (const instruction of house.instructions) if (instruction.kind === 'action') {
    // SourceHouse is the first house of Trigger.Type's owner country. It is
    // separate from YR's nullable, event-derived Trigger.House used by8997.
    const trigger = source.triggers.find(t => t.id === instruction.triggerId);
    const first = trigger ? original.houses.find(h => h.country.index === trigger.countryIndex) : undefined;
    const player = first ? house.houses.find(h => h.houseId === first.id) : undefined;
    if (!player || instruction.selector.kind === 'current-trigger-house') fail('trigger-house');
    sourceHouses.set(instruction.triggerId, player.playerId);
  }
  const tick = worldInteger(r.missionNextTick, 0, WORLD_LIMITS.tick - 1);
  const world = WorldSimulation.restore(model, r.checkpoint);
  if (world.nextTick !== tick + 1) fail('clock');
  const result = Object.freeze({ policy: MISSION_ACTION_WORLD_POLICY, programSha256: bindings.program.sha256,
    worldSha256: model.sha256, fromStateSha256: worldHash(world.save()), missionNextTick: tick });
  const data: Owned = { bindings, model, sourceHouses, limit, work: initialWork, state: 'fresh', world };
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
  const result = data.world!.transferOwnership({ instructionId, sourceHouse, triggerHouse: null },
    Math.min(WORLD_LIMITS.replayWork, data.limit - data.work));
  const receipt = worldHouseTransferFacts(data.model, result);
  if (receipt.instructionId !== instructionId || receipt.sourceSha256 !== source.sha256 ||
    receipt.bindingsSha256 !== data.bindings.catalogSha256 || receipt.nextTick !== context.missionNextTick + 1) fail('receipt');
  charge(data, result.work);
}
/** Read a detached current candidate, so later action consumers see earlier
 * transfers. This is never a post-poll reconstruction from an effect list. */
export function missionActionWorldSnapshot(context: MissionActionWorldContext, program: MissionProgram): WorldSave {
  const data = owned(context, program, 'running'); charge(data, data.model.entities.length); return data.world!.save();
}
export function finishMissionActionWorld(context: MissionActionWorldContext, program: MissionProgram): Readonly<{ world: WorldSave; work: number }> {
  const data = owned(context, program, 'running'), world = data.world!.save();
  data.state = 'finished'; data.world = null; return { world, work: data.work };
}
export function abortMissionActionWorld(context: MissionActionWorldContext, program: MissionProgram): void {
  const data = contexts.get(context);
  if (data?.bindings.program === program && data.state !== 'finished') { data.state = 'aborted'; data.world = null; }
}
