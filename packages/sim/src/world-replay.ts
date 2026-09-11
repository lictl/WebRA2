// SPDX-License-Identifier: MIT
import type { CommandEnvelope } from '../../contracts/src/index.ts';
import { WorldSimulation, type WorldSave, type WorldStep } from './world.ts';
import { assertWorldModel, worldClone, worldFail, worldHash, worldInteger, worldList, worldRecord, WORLD_LIMITS as C, type WorldModel } from './world-model.ts';
import { worldHouseInvocation, type WorldHouseInvocation, type WorldHouseTransferResult } from './world-ownership.ts';

export type WorldAdmission = { nextTick: number; commands: CommandEnvelope[] };
export type WorldReplayOperation = { kind: 'commands'; admissionIndex: number } | { kind: 'ownership'; nextTick: number; invocation: WorldHouseInvocation };
export type WorldReplay = { schemaVersion: 1 | 2; modelSha256: string; initialCheckpoint: WorldSave;
  admissions: WorldAdmission[]; operations?: WorldReplayOperation[]; finalNextTick: number; finalStateSha256: string };
export type WorldReplayResult = { simulation: WorldSimulation; stateSha256: string; work: number };

/** Recorder owns its simulation; callers cannot admit unrecorded orders through an exposed instance. */
export class WorldReplayRecorder {
  readonly #simulation: WorldSimulation;
  readonly #initial: WorldSave;
  #admissions: WorldAdmission[] = [];
  #operations: WorldReplayOperation[] = [];
  #work = 0;
  constructor(model: WorldModel, checkpoint?: unknown) {
    this.#simulation = checkpoint === undefined ? WorldSimulation.create(model) : WorldSimulation.restore(model, checkpoint);
    this.#initial = this.#simulation.save();
    worldClone(this.document());
  }
  get nextTick(): number { return this.#simulation.nextTick; }
  save(): WorldSave { return this.#simulation.save(); }
  admitCommands(input: readonly unknown[]): CommandEnvelope[] {
    if (this.#admissions.length >= C.replayAdmissions) worldFail('world-replay-admission-limit');
    if (this.#simulation.model.ownership && this.#operations.length >= C.replayAdmissions) worldFail('world-replay-operation-limit');
    // A detached simulation validates the command and resulting combined replay before either owned state commits.
    const candidate = WorldSimulation.restore(this.#simulation.model, this.#simulation.save());
    const commands = candidate.admitCommands(input);
    if (!commands.length) return [];
    const admissions = [...this.#admissions, { nextTick: this.nextTick, commands }];
    const operations = [...this.#operations, { kind: 'commands' as const, admissionIndex: this.#admissions.length }];
    worldClone({ ...this.document(), admissions, ...(this.#simulation.model.ownership ? { operations } : {}), finalStateSha256: worldHash(candidate.save()) });
    this.#simulation.admitCommands(commands); this.#admissions = admissions; this.#operations = operations; return worldClone(commands);
  }
  transferOwnership(input: WorldHouseInvocation): WorldHouseTransferResult {
    if (!this.#simulation.model.ownership || this.#operations.length >= C.replayAdmissions) worldFail('world-replay-operation-limit');
    const invocation = worldHouseInvocation(input), candidate = WorldSimulation.restore(this.#simulation.model, this.#simulation.save());
    const result = candidate.transferOwnership(invocation, C.replayWork - this.#work);
    const operations = [...this.#operations, { kind: 'ownership' as const, nextTick: this.nextTick, invocation }];
    worldClone({ ...this.document(), operations, finalStateSha256: worldHash(candidate.save()) });
    this.#simulation.transferOwnership(invocation, C.replayWork - this.#work); this.#operations = operations; this.#work += result.work;
    return result;
  }
  step(ticks = 1): WorldStep {
    worldInteger(ticks, 1, C.stepTicks);
    if (ticks > C.replayTicks - (this.nextTick - this.#initial.nextTick)) worldFail('world-replay-tick-limit');
    const result = this.#simulation.step(ticks, C.replayWork - this.#work);
    this.#work += result.work.entityVisits + result.work.navigationExpansions + result.work.transitions; return result;
  }
  document(): WorldReplay {
    return worldClone({ schemaVersion: this.#simulation.model.ownership ? 2 : 1, modelSha256: this.#simulation.model.sha256, initialCheckpoint: this.#initial,
      admissions: this.#admissions, ...(this.#simulation.model.ownership ? { operations: this.#operations } : {}), finalNextTick: this.nextTick, finalStateSha256: worldHash(this.#simulation.save()) });
  }
}

/** Re-executes admission timing and verifies the complete terminal checkpoint. No retail data is embedded. */
export function replayWorld(model: WorldModel, input: unknown): WorldReplayResult {
  assertWorldModel(model);
  const r = worldRecord(worldClone(input), ['schemaVersion', 'modelSha256', 'initialCheckpoint', 'admissions', 'finalNextTick', 'finalStateSha256', ...(model.ownership ? ['operations'] : [])]);
  if (r.schemaVersion !== (model.ownership ? 2 : 1) || r.modelSha256 !== model.sha256 || typeof r.finalStateSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.finalStateSha256)) worldFail('world-replay-identity');
  const simulation = WorldSimulation.restore(model, r.initialCheckpoint), initialTick = simulation.nextTick;
  const finalNextTick = worldInteger(r.finalNextTick, initialTick, Math.min(C.tick, initialTick + C.replayTicks));
  const admissions: { nextTick: number; commands: unknown[] }[] = []; let previousTick = initialTick;
  // Preflight every admission's framing/timing before executing the first tick.
  for (const item of worldList(r.admissions, C.replayAdmissions)) {
    const a = worldRecord(item, ['nextTick', 'commands']), nextTick = worldInteger(a.nextTick, previousTick, finalNextTick);
    const commands = worldList(a.commands, C.commands); if (!commands.length) worldFail('world-replay-empty-admission');
    admissions.push({ nextTick, commands }); previousTick = nextTick;
  }
  const operations: ({ kind: 'commands'; admissionIndex: number } | { kind: 'ownership'; nextTick: number; invocation: WorldHouseInvocation })[] = [];
  if (model.ownership) {
    let commandIndex = 0, previous = initialTick;
    for (const value of worldList(r.operations, C.replayAdmissions)) {
      const kind = value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'kind') : undefined;
      if (!kind || !('value' in kind)) worldFail('world-replay-operation');
      if (kind.value === 'commands') {
        const row = worldRecord(value, ['kind', 'admissionIndex']), index = worldInteger(row.admissionIndex, 0, admissions.length - 1);
        if (index !== commandIndex++ || admissions[index]!.nextTick < previous) worldFail('world-replay-operation-order');
        previous = admissions[index]!.nextTick; operations.push({ kind: 'commands', admissionIndex: index });
      } else if (kind.value === 'ownership') {
        const row = worldRecord(value, ['kind', 'nextTick', 'invocation']), nextTick = worldInteger(row.nextTick, previous, finalNextTick);
        operations.push({ kind: 'ownership', nextTick, invocation: worldHouseInvocation(row.invocation) }); previous = nextTick;
      } else worldFail('world-replay-operation');
    }
    if (commandIndex !== admissions.length) worldFail('world-replay-operation-coverage');
  }
  let work = 0;
  function advance(tick: number): void {
    while (simulation.nextTick < tick) {
      if (work >= C.replayWork) worldFail('world-replay-work-limit');
      const step = simulation.step(1, C.replayWork - work); work += step.work.entityVisits + step.work.navigationExpansions + step.work.transitions;
      if (work > C.replayWork) worldFail('world-replay-work-limit');
    }
  }
  if (model.ownership) for (const operation of operations) {
    if (operation.kind === 'commands') { const admission = admissions[operation.admissionIndex]!; advance(admission.nextTick); simulation.admitCommands(admission.commands); }
    else { advance(operation.nextTick); work += simulation.transferOwnership(operation.invocation, C.replayWork - work).work; }
  } else for (const admission of admissions) { advance(admission.nextTick); simulation.admitCommands(admission.commands); }
  advance(finalNextTick);
  const stateSha256 = worldHash(simulation.save()); if (stateSha256 !== r.finalStateSha256) worldFail('world-replay-final-state');
  return { simulation, stateSha256, work };
}
