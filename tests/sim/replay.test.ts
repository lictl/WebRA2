// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplayRecorder, Simulation, replay, canonicalText, canonicalHash, type ReplayDocument, type TraceEvent } from '../../packages/sim/src/index.ts';
import { scenario, content, digest, commands, move, attack } from './fixtures.ts';

async function recording() {
  const sim = Simulation.create(scenario(), content); sim.admitCommands([commands()[0]!]); // Initial checkpoint already owns this pending command.
  const record = new ReplayRecorder(sim.save()); const traces: TraceEvent[] = [];
  record.admitCommands([commands()[2]!, commands()[1]!]); await record.checkpoint(digest);
  traces.push(...record.step(3).events);
  record.admitCommands([commands()[4]!, commands()[3]!]); await record.checkpoint(digest);
  traces.push(...record.step(3).events); await record.checkpoint(digest);
  traces.push(...record.step(2).events); await record.checkpoint(digest);
  return { record, traces };
}
test('interactive replay reproduces admission boundaries, pending initial commands, scheduled work, RNG and exact trace', async () => {
  const { record, traces } = await recording(), document = record.document();
  assert.equal(document.replay.initialCheckpoint.queuedCommands.length, 1); assert.equal(document.replay.commands.length, 4);
  assert.deepEqual(document.admissions.map(a => a.nextTick), [0, 3]);
  const result = await replay(canonicalText(document), content, digest);
  assert.equal(result.verifiedCheckpoints, 4); assert.deepEqual(result.events, traces); assert.deepEqual(result.simulation.save(), record.save());
  assert.equal(await canonicalHash(result.simulation.save(), digest), await canonicalHash(record.save(), digest));
});
test('invalid replay identity, admission coverage and checkpoint data fail explicitly', async () => {
  const { record } = await recording();
  const cases: ((d: ReplayDocument) => void)[] = [
    d => { d.admissions[0]!.commandIndexes[0] = 1; }, d => { d.admissions.pop(); }, d => { d.admissions[1]!.nextTick = 0; },
    d => { d.finalNextTick = 2; }, d => { (d.replay.checkpoints[0] as { stateSha256: string }).stateSha256 = '0'.repeat(64); },
    d => { (d.replay as { engineVersion: string }).engineVersion = 'old'; }, d => { (d.replay as unknown as { commands: unknown[] }).commands.push(d.replay.commands[0]); },
  ];
  for (const change of cases) { const document = record.document(); change(document); await assert.rejects(replay(document, content, digest)); }
  await assert.rejects(replay(record.document(), { ...content, profile: 'yr' }, digest), /content-mismatch/);
});
test('recording prevents a checkpoint/admission race and failed hashing leaves the recorder reusable', async () => {
  const record = new ReplayRecorder(Simulation.create(scenario(), content).save());
  let release!: (hash: string) => void;
  const pending = record.checkpoint(() => new Promise(resolve => { release = resolve; }));
  assert.throws(() => record.step(), /checkpoint-in-progress/); assert.throws(() => record.admitCommands([move(0, 0, 0, 1, 1, 0)]), /checkpoint-in-progress/);
  release('invalid'); await assert.rejects(pending, /invalid-digest-result/);
  record.admitCommands([move(0, 0, 0, 1, 1, 0)]); await record.checkpoint(digest);
  const before = canonicalText(record.document()); assert.throws(() => record.admitCommands([attack(1, 0, 1, 1, 2)]), /admission-after-checkpoint/); assert.equal(canonicalText(record.document()), before);
  record.step(); record.admitCommands([attack(1, 0, 1, 1, 2)]); assert.equal(record.save().queuedCommands.length, 1);
});
test('rejected admission does not append to the replay or mutate its simulation', () => {
  const record = new ReplayRecorder(Simulation.create(scenario(), content).save()); const before = canonicalText(record.document());
  assert.throws(() => record.admitCommands([move(0, 0, 0, 1, 1, 0), move(0, 0, 0, 1, 2, 0)]));
  assert.equal(canonicalText(record.document()), before);
});
