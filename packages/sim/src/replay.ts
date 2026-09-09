// SPDX-License-Identifier: MIT
import { orderCommands } from '../../contracts/src/index.ts';
import { canonicalHash, canonicalText, parseJson } from './canonical.ts';
import { Simulation } from './kernel.ts';
import { array, command, detached, fail, identity, integer, record } from './validation.ts';
import { ENGINE_VERSION, RULES_VERSION, LIMITS, type CommandEnvelope, type ContentIdentity, type Digest, type ReplayDocument, type SimSave, type StepResult, type TraceEvent } from './types.ts';

/** Records accepted batches separately from execution timestamps. The initial pending queue is not re-admitted. */
export class ReplayRecorder {
  #simulation: Simulation;
  #initial: SimSave;
  #commands: CommandEnvelope[] = [];
  #admissions: ReplayDocument['admissions'] = [];
  #checkpoints: { nextTick: number; stateSha256: string }[] = [];
  #traceCount = 0;
  #hashing = false;
  constructor(initial: SimSave) { const copy = detached(initial) as SimSave; this.#simulation = Simulation.restore(copy, copy.contentIdentity); this.#initial = this.#simulation.save(); this.document(); }
  get nextTick(): number { return this.#simulation.nextTick; }
  save(): SimSave { return this.#simulation.save(); }
  #ready() { if (this.#hashing) fail('checkpoint-in-progress'); }
  #raw(commands = this.#commands, admissions = this.#admissions, checkpoints = this.#checkpoints, finalNextTick = this.nextTick) {
    return { schemaVersion: 1, replay: { schemaVersion: 1, engineVersion: ENGINE_VERSION, simulationRulesVersion: RULES_VERSION, contentIdentity: this.#initial.contentIdentity, initialCheckpoint: this.#initial, commands, checkpoints }, admissions, finalNextTick };
  }
  admitCommands(values: readonly unknown[]): CommandEnvelope[] {
    this.#ready();
    if (this.#checkpoints.at(-1)?.nextTick === this.nextTick) fail('admission-after-checkpoint');
    if (!Array.isArray(values) || values.length > LIMITS.commands - this.#commands.length) fail('replay-command-limit');
    const candidate = Simulation.restore(this.save(), this.#initial.contentIdentity), accepted = candidate.admitCommands(values);
    if (accepted.length) {
      const admissions = [...this.#admissions, { nextTick: this.nextTick, commandIndexes: accepted.map((_, index) => this.#commands.length + index) }], commands = [...this.#commands, ...accepted];
      canonicalText(this.#raw(commands, admissions)); // Recording capacity must reject before simulation admission commits.
      this.#commands = commands; this.#admissions = admissions;
    }
    this.#simulation = candidate;
    return detached(accepted) as CommandEnvelope[];
  }
  step(ticks = 1): StepResult {
    this.#ready(); integer(ticks, 1, LIMITS.stepTicks, 'step-tick-limit'); if (this.nextTick + ticks - this.#initial.nextTick > LIMITS.replayTicks) fail('replay-tick-limit');
    canonicalText(this.#raw(this.#commands, this.#admissions, this.#checkpoints, this.nextTick + ticks));
    const candidate = Simulation.restore(this.save(), this.#initial.contentIdentity), result = candidate.step(ticks);
    if (result.events.length > LIMITS.trace - this.#traceCount) fail('replay-trace-limit');
    this.#simulation = candidate; this.#traceCount += result.events.length;
    return result;
  }
  /** Call after this boundary's admissions. No later admission at the same checkpoint tick is allowed. */
  async checkpoint(digest: Digest): Promise<string> {
    this.#ready(); if (this.#checkpoints.at(-1)?.nextTick === this.nextTick) fail('duplicate-checkpoint');
    if (this.#checkpoints.length >= LIMITS.commands) fail('checkpoint-limit');
    this.#hashing = true;
    try {
      const stateSha256 = await canonicalHash(this.save(), digest), checkpoints = [...this.#checkpoints, { nextTick: this.nextTick, stateSha256 }];
      canonicalText(this.#raw(this.#commands, this.#admissions, checkpoints)); this.#checkpoints = checkpoints; return stateSha256;
    }
    finally { this.#hashing = false; }
  }
  document(): ReplayDocument {
    this.#ready();
    return detached(this.#raw()) as ReplayDocument;
  }
}

export async function replay(input: unknown, expectedContent: ContentIdentity, digest: Digest): Promise<{ simulation: Simulation; events: TraceEvent[]; verifiedCheckpoints: number }> {
  const raw = typeof input === 'string' || input instanceof Uint8Array ? parseJson(input) : input;
  const doc = record(detached(raw), ['schemaVersion', 'replay', 'admissions', 'finalNextTick']); if (doc.schemaVersion !== 1) fail('unsupported-replay-version');
  const envelope = record(doc.replay, ['schemaVersion', 'engineVersion', 'simulationRulesVersion', 'contentIdentity', 'initialCheckpoint', 'commands', 'checkpoints']);
  if (envelope.schemaVersion !== 1 || envelope.engineVersion !== ENGINE_VERSION || envelope.simulationRulesVersion !== RULES_VERSION) fail('unsupported-replay-version');
  if (canonicalText(identity(envelope.contentIdentity)) !== canonicalText(identity(detached(expectedContent)))) fail('content-mismatch');
  const simulation = Simulation.restore(envelope.initialCheckpoint, expectedContent), initial = simulation.save();
  const finalTick = integer(doc.finalNextTick, initial.nextTick, Math.min(LIMITS.tick, initial.nextTick + LIMITS.replayTicks), 'replay-tick-limit');
  const commands = array(envelope.commands, LIMITS.commands).map(c => command(c, initial.state.width, initial.state.height));
  try { orderCommands(commands); } catch { fail('duplicate-replay-command'); }
  let cursor = 0, previousTick = initial.nextTick;
  const admissions = array(doc.admissions, LIMITS.commands).map(item => {
    const r = record(item, ['nextTick', 'commandIndexes']); const nextTick = integer(r.nextTick, previousTick, finalTick, 'admission-tick'); previousTick = nextTick;
    const indexes = array(r.commandIndexes, LIMITS.commands); if (!indexes.length) fail('empty-admission');
    const batch = indexes.map(index => { if (integer(index, 0, commands.length - 1) !== cursor++) fail('admission-index-order'); return commands[index as number]!; });
    return { nextTick, batch };
  });
  if (cursor !== commands.length) fail('unassigned-replay-command');
  previousTick = initial.nextTick - 1;
  const checkpoints = array(envelope.checkpoints, LIMITS.commands).map(item => {
    const r = record(item, ['nextTick', 'stateSha256']); const nextTick = integer(r.nextTick, previousTick + 1, finalTick, 'checkpoint-tick'); previousTick = nextTick;
    if (typeof r.stateSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.stateSha256)) fail('checkpoint-hash');
    return { nextTick, stateSha256: r.stateSha256 };
  });
  const events: TraceEvent[] = []; let admission = 0, checkpoint = 0;
  while (true) {
    while (admissions[admission]?.nextTick === simulation.nextTick) simulation.admitCommands(admissions[admission++]!.batch);
    if (checkpoints[checkpoint]?.nextTick === simulation.nextTick) {
      if (await canonicalHash(simulation.save(), digest) !== checkpoints[checkpoint]!.stateSha256) fail('replay-checkpoint-mismatch'); checkpoint++;
    }
    if (simulation.nextTick === finalTick) break;
    const boundary = Math.min(admissions[admission]?.nextTick ?? finalTick, checkpoints[checkpoint]?.nextTick ?? finalTick, finalTick);
    const result = simulation.step(Math.min(LIMITS.stepTicks, boundary - simulation.nextTick));
    if (result.events.length > LIMITS.trace - events.length) fail('replay-trace-limit'); events.push(...result.events);
  }
  return { simulation, events, verifiedCheckpoints: checkpoint };
}
