// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, canonicalHash, LIMITS, type SimSave, type TraceEvent } from '../../packages/sim/src/index.ts';
import { scenario, content, digest, commands, move, attack } from './fixtures.ts';

test('original grid scenario performs movement, delayed damage, RNG and stable reinforcement allocation', async () => {
  const sim = Simulation.create(scenario(), content); sim.admitCommands(commands());
  const result = sim.step(8), state = sim.save();
  assert.equal(result.nextTick, 8);
  assert.deepEqual(state.state.entities.map(e => [e.id, e.owner, e.x, e.y, e.hp]), [[1, 0, 2, 0, 3], [2, 1, 3, 0, 6], [3, 0, 0, 1, 8], [4, 1, 6, 4, 7]]);
  assert.equal(state.state.nextEntityId, 5); assert.equal(state.state.resolvedEvents, 5);
  assert.deepEqual(state.rngStates.simulation, { algorithm: 'webra2-lcg32-1', value: 3981355051, draws: 4 });
  assert.deepEqual(result.events.filter(e => e.kind === 'damage').map(e => [e.tick, e.entityId, e.otherId, e.value]), [[2, 2, 1, 4], [3, 1, 2, 3], [6, 1, 2, 2], [6, 2, 1, 5]]);
  assert.equal((await canonicalHash(state, digest)).length, 64);
});
test('command arrival permutation, property insertion and step grouping preserve canonical state and traces', () => {
  const a = Simulation.create(scenario(), content), b = Simulation.create(scenario(), content);
  a.admitCommands(commands()); b.admitCommands(commands().reverse().map(c => ({ payload: c.payload, kind: c.kind, sequence: c.sequence, playerId: c.playerId, tick: c.tick, schemaVersion: c.schemaVersion })));
  const trace = a.step(8).events, split: TraceEvent[] = [];
  for (let i = 0; i < 8; i++) split.push(...b.step().events);
  assert.equal(a.saveText(), b.saveText()); assert.deepEqual(trace, split);
});
test('restore at every tick boundary preserves pending commands, work, advanced RNG and admission cursors', async () => {
  const control = Simulation.create(scenario(), content); control.admitCommands(commands()); control.step(8);
  for (let boundary = 0; boundary <= 8; boundary++) {
    const source = Simulation.create(scenario(), content); source.admitCommands(commands()); if (boundary) source.step(boundary);
    const restored = Simulation.restore(source.saveText(), content);
    if (boundary < 8) assert.deepEqual(restored.step(8 - boundary), source.step(8 - boundary));
    assert.equal(restored.saveText(), control.saveText());
    assert.equal(await canonicalHash(restored.save(), digest), await canonicalHash(control.save(), digest));
    assert.throws(() => restored.admitCommands([attack(8, 0, 2, 1, 2)]), /command-sequence-reused/);
  }
});
test('stable-ID occupancy ties and X-before-Y blocking are specified rather than input-dependent', () => {
  const config = scenario(); config.entities = [{ owner: 0, x: 0, y: 0, hp: 5 }, { owner: 1, x: 2, y: 0, hp: 5 }]; config.reinforcements = [];
  const sim = Simulation.create(config, content); sim.admitCommands([move(0, 1, 0, 2, 1, 0), move(0, 0, 0, 1, 1, 0)]);
  const result = sim.step(); assert.deepEqual(sim.save().state.entities.map(e => e.x), [1, 2]); assert.ok(result.events.some(e => e.entityId === 2 && e.kind === 'blocked'));
  sim.admitCommands([move(1, 0, 1, 1, 2, 1)]); sim.step(); assert.deepEqual(sim.save().state.entities[0]!.destination, { x: 2, y: 1 }); assert.equal(sim.save().state.entities[0]!.y, 0);
});
test('dead targets, ownership failure and in-flight impacts have explicit deterministic outcomes', () => {
  const config = scenario(); config.entities[1]!.hp = 1; config.reinforcements = [];
  const sim = Simulation.create(config, content);
  sim.admitCommands([attack(0, 0, 0, 1, 2), attack(0, 0, 1, 1, 2), move(0, 1, 0, 1, 4, 0), attack(1, 1, 1, 2, 1)]);
  const events = sim.step(4).events;
  assert.ok(events.some(e => e.kind === 'not-owner')); assert.ok(events.some(e => e.kind === 'impact-target-missing'));
  assert.ok(events.some(e => e.tick === 3 && e.kind === 'damage' && e.entityId === 2)); // Already-launched impact survives attacker death.
  assert.equal((sim.save().rngStates.simulation as { draws: number }).draws, 2);
});
test('malformed/late/duplicate/unsupported admission fails atomically, and snapshots cannot mutate live state', () => {
  const sim = Simulation.create(scenario(), content); sim.admitCommands([move(1, 0, 2, 1, 1, 0)]); sim.step(); const before = sim.saveText();
  const bad = [move(0, 0, 3, 1, 1, 0), move(2, 0, 2, 1, 1, 0), move(2, 0, 3, 1, 128, 0), move(2, 0, 3, 1, 0.5, 0), { ...move(2, 0, 3, 1, 1, 0), kind: 'native.win' }, move(1 + LIMITS.futureTicks + 1, 0, 3, 1, 1, 0)];
  for (const value of bad) { assert.throws(() => sim.admitCommands([move(2, 1, 5, 2, 4, 0), value])); assert.equal(sim.saveText(), before); }
  assert.throws(() => sim.admitCommands([move(2, 0, 3, 1, 1, 0), move(3, 0, 3, 1, 1, 0)]), /duplicate-command/);
  const save = sim.save(); save.state.entities[0]!.hp = 1; assert.equal(sim.saveText(), before);
  const command = move(2, 0, 3, 1, 1, 0); sim.admitCommands([command]); (command.payload as { x: number }).x = 127; assert.equal((sim.save().queuedCommands.at(-1)!.payload as { x: number }).x, 1);
});
test('fatal work/counter/trace bounds roll back the entire multi-tick transaction', () => {
  const base = Simulation.create(scenario(), content).save();
  base.state.nextWorkOrder = Number.MAX_SAFE_INTEGER;
  const sim = Simulation.restore(base, content); sim.admitCommands([move(0, 0, 0, 1, 1, 0), attack(1, 0, 1, 1, 2)]); const before = sim.saveText();
  assert.throws(() => sim.step(2), /work-order-overflow/); assert.equal(sim.saveText(), before);
  const eventOverflow = Simulation.create(scenario(), content).save(); eventOverflow.state.resolvedEvents = Number.MAX_SAFE_INTEGER;
  const other = Simulation.restore(eventOverflow, content), saved = other.saveText(); assert.throws(() => other.step(5), /event-counter-overflow/); assert.equal(other.saveText(), saved);
  for (const ticks of [0, -1, 0.5, LIMITS.stepTicks + 1, Infinity]) { assert.throws(() => sim.step(ticks)); assert.equal(sim.saveText(), before); }
  const crowded = scenario(); crowded.height = 64; crowded.reinforcements = [];
  crowded.entities = Array.from({ length: 64 }, (_, y) => ({ owner: 0, x: 0, y, hp: 1 }));
  crowded.blocked = Array.from({ length: 64 }, (_, y) => ({ x: 1, y }));
  const tracing = Simulation.create(crowded, content); tracing.admitCommands(crowded.entities.map((_, i) => move(0, 0, i, i + 1, 2, i)));
  const traceBefore = tracing.saveText(); assert.throws(() => tracing.step(512), /trace-limit/); assert.equal(tracing.saveText(), traceBefore);
  const full = scenario(); full.reinforcements = Array.from({ length: LIMITS.work }, () => ({ dueTick: 5, owner: 0, x: 7, y: 5, hp: 1 }));
  const scheduling = Simulation.create(full, content); scheduling.admitCommands([attack(0, 0, 0, 1, 2)]); const workBefore = scheduling.saveText();
  assert.throws(() => scheduling.step(), /scheduled-work-limit/); assert.equal(scheduling.saveText(), workBefore);
});
test('strict restore rejects inconsistent state, source identity and old versions without altering an existing simulation', () => {
  const sim = Simulation.create(scenario(), content); const original = sim.saveText();
  const cases: ((save: SimSave) => void)[] = [
    s => { (s as unknown as { schemaVersion: number }).schemaVersion = 2; }, s => { (s as { simulationRulesVersion: string }).simulationRulesVersion = 'native-unknown'; },
    s => { s.state.entities[0]!.x = -1; }, s => { s.state.entities[1]!.id = 1; }, s => { s.state.entities[1]!.x = 0; }, s => { s.state.nextEntityId = 1; },
    s => { (s.rngStates.simulation as { algorithm: string }).algorithm = 'unknown'; }, s => { (s.scheduledWork as unknown[]).push(s.scheduledWork[0]); }, s => { s.state.admissionCursors = [{ playerId: 0, sequence: -1 }]; },
  ];
  for (const change of cases) { const save = sim.save(); change(save); assert.throws(() => Simulation.restore(save, content)); assert.equal(sim.saveText(), original); }
  for (const expected of [{ ...content, profile: 'yr' as const }, { ...content, rulesSha256: '5'.repeat(64) }, { ...content, orderedModHashes: [...content.orderedModHashes].reverse() }]) assert.throws(() => Simulation.restore(original, expected), /content-mismatch/);
});
test('terminal tick boundary cannot admit or schedule work that could never execute', () => {
  const initial = Simulation.create(scenario(), content).save();
  const end = Simulation.restore({ ...initial, nextTick: LIMITS.tick - 1, scheduledWork: [] }, content);
  assert.throws(() => end.admitCommands([move(LIMITS.tick, 0, 0, 1, 1, 0)]), /tick-bounds/);
  end.step(); const boundary = end.saveText(); assert.equal(end.nextTick, LIMITS.tick); assert.throws(() => end.step(), /tick-overflow/); assert.equal(end.saveText(), boundary);
  const attackEnd = Simulation.restore({ ...initial, nextTick: LIMITS.tick - 2, scheduledWork: [] }, content);
  attackEnd.admitCommands([attack(LIMITS.tick - 2, 0, 0, 1, 2)]); const before = attackEnd.saveText(); assert.throws(() => attackEnd.step(), /work-tick-overflow/); assert.equal(attackEnd.saveText(), before);
});
