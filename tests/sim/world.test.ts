// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationGrid } from '../../packages/sim/src/navigation.ts';
import { createWorldModel, WORLD_LIMITS, WorldError, type WorldEntityDefinition, type WorldModelInput } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation, worldEntityDefinition, type WorldSave } from '../../packages/sim/src/world.ts';
import { WorldReplayRecorder, replayWorld } from '../../packages/sim/src/world-replay.ts';
import { worldHash } from '../../packages/sim/src/world-model.ts';

const contentIdentity = { profile: 'ra2' as const, manifestSha256: 'a'.repeat(64), rulesSha256: 'b'.repeat(64), orderedModHashes: [] as string[] };
const grid = (width = 7, height = 5, cost = 1) => createNavigationGrid({ contentIdentity, movementClass: 'foot',
  cells: Array.from({ length: width * height }, (_, i) => ({ x: i % width, y: Math.floor(i / width), cost, exits: 255 })) });
const actor = (id = 1, x = 0, y = 2, overrides: Partial<WorldEntityDefinition> = {}): WorldEntityDefinition => ({
  id, rowId: `units:${id}`, typeId: 'unit:original', owner: 0, kind: 'unit', x, y, initialHealth: 100, maximumHealth: 100,
  movementPerTick: 128, navigationClass: 'foot', blocksCell: true, ...overrides });
function input(entities = [actor()], blocked: WorldModelInput['blocked'] = [], cost = 1): WorldModelInput {
  return { contentIdentity, sourceSha256: 'c'.repeat(64), definitionsSha256: 'd'.repeat(64), entities,
    navigation: [{ grid: grid(7, 5, cost), costScale: 1 }], blocked };
}
const move = (sequence: number, x: number, y: number, entityId = 1, tick = 0, playerId = 0) => ({ schemaVersion: 1, tick, playerId, sequence, kind: 'move', payload: { entityId, x, y } });
const stop = (sequence: number, entityId = 1, tick = 0) => ({ schemaVersion: 1, tick, playerId: 0, sequence, kind: 'stop', payload: { entityId } });
const error = (code: string) => (e: unknown) => e instanceof WorldError && e.code === code;

test('world model binds content, placements, costs and movement policy with canonical input ordering', () => {
  const a = input([actor(2, 6), actor(1)]), model = createWorldModel(a);
  assert.equal(model.entities[0]!.id, 1); assert(Object.isFrozen(model.entities[0]));
  const b = createWorldModel({ ...a, entities: [...a.entities].reverse() }); assert.equal(b.sha256, model.sha256);
  assert.notEqual(createWorldModel({ ...a, definitionsSha256: 'e'.repeat(64) }).sha256, model.sha256);
  assert.notEqual(createWorldModel({ ...a, entities: [actor(2, 6), actor(1, 0, 2, { movementPerTick: 127 })] }).sha256, model.sha256);
  assert.equal(worldEntityDefinition(model, 2)?.rowId, 'units:2'); assert.equal(worldEntityDefinition(model, 3), null);
  assert.throws(() => WorldSimulation.create({ ...model }), error('world-model'));
});

test('movement reserves a partial edge, consumes integer credit and reaches the ordered destination', () => {
  const sim = WorldSimulation.create(createWorldModel(input())); sim.admitCommands([move(0, 3, 2)]);
  const first = sim.step(); assert(first.events.some(e => e.kind === 'path-found'));
  let e = sim.save().state.entities[0]!; assert.equal(e.x, 0); assert.equal(e.progress, 128); assert.equal(e.route[1], 1025);
  sim.step(); e = sim.save().state.entities[0]!; assert.equal(e.x, 1); assert.equal(e.progress, 0); assert.equal(e.route[0], 1025);
  sim.step(4); e = sim.save().state.entities[0]!; assert.equal(e.x, 3); assert.equal(e.goal, null); assert.deepEqual(e.route, []); assert.equal(e.health, 100);
});

test('route costs affect velocity with explicit costScale and no frame-clock dependency', () => {
  const a = input([actor()], [], 2), model = createWorldModel(a), sim = WorldSimulation.create(model);
  sim.admitCommands([move(0, 1, 2)]); sim.step(3); assert.equal(sim.save().state.entities[0]!.x, 0); sim.step(); assert.equal(sim.save().state.entities[0]!.x, 1);
  const scaled = WorldSimulation.create(createWorldModel({ ...a, navigation: [{ grid: a.navigation[0]!.grid, costScale: 2 }] }));
  scaled.admitCommands([move(0, 1, 2)]); scaled.step(2); assert.equal(scaled.save().state.entities[0]!.x, 1);
});

test('static occupancy produces a detour and full save/restore trace equivalence during motion', () => {
  const model = createWorldModel(input([actor()], [{ x: 2, y: 2 }])), continuous = WorldSimulation.create(model);
  continuous.admitCommands([move(0, 4, 2)]); continuous.step(3);
  const checkpoint = continuous.save(), restored = WorldSimulation.restore(model, checkpoint);
  assert(!checkpoint.state.entities[0]!.route.includes(1026));
  assert.deepEqual(restored.step(14), continuous.step(14)); assert.equal(restored.saveText(), continuous.saveText());
  assert.equal(restored.save().state.entities[0]!.x, 4); assert.equal(restored.save().state.entities[0]!.y, 2);
  checkpoint.state.entities[0]!.x = 99; assert.equal(restored.save().state.entities[0]!.x, 4);
});

test('competing routes reserve the free destination in stable entity-ID order', () => {
  const sim = WorldSimulation.create(createWorldModel(input([actor(2, 2, 2), actor(1, 0, 2)])));
  sim.admitCommands([move(0, 1, 2, 2), move(1, 1, 2, 1)]); const events = sim.step().events;
  const [a, b] = sim.save().state.entities; assert.equal(a!.progress, 128); assert.equal(b!.progress, 0); assert.deepEqual(b!.route, []);
  assert(events.some(e => e.kind === 'blocked' && e.entityId === 2));
  const restored = WorldSimulation.restore(sim.model, sim.save()); assert.deepEqual(restored.step(18), sim.step(18));
  assert.equal(sim.save().state.entities[0]!.x, 1); assert.equal(sim.save().state.entities[1]!.x, 2);
});

test('replacing an in-flight move finishes its current edge; stop releases it at the completed cell', () => {
  const sim = WorldSimulation.create(createWorldModel(input())); sim.admitCommands([move(0, 5, 2)]); sim.step();
  sim.admitCommands([move(1, 0, 2, 1, 1)]); sim.step();
  assert.equal(sim.save().state.entities[0]!.x, 1); assert.equal(sim.save().state.entities[0]!.goal, 1024);
  const restored = WorldSimulation.restore(sim.model, sim.save()); assert.deepEqual(restored.step(2), sim.step(2));
  assert.equal(sim.save().state.entities[0]!.x, 0);
  sim.admitCommands([move(2, 4, 2, 1, 4)]); sim.step(); sim.admitCommands([stop(3, 1, 5)]); sim.step();
  const e = sim.save().state.entities[0]!; assert.equal(e.x, 0); assert.equal(e.progress, 0); assert.equal(e.goal, null); assert.deepEqual(e.route, []);
});

test('ownership, nonexistent actors and immovable entities reject as ordered gameplay events', () => {
  const sim = WorldSimulation.create(createWorldModel(input([actor(), actor(2, 6, 2, { movementPerTick: 0, navigationClass: null })])));
  sim.admitCommands([move(0, 2, 2, 1, 0, 1), move(0, 2, 2, 77), move(1, 2, 2, 2)]);
  assert.deepEqual(sim.step().events.map(e => e.kind), ['missing-entity', 'immovable', 'not-owner']);
  assert.equal(sim.save().state.admissionCursors.length, 2); assert(sim.save().state.entities.every(e => e.goal === null));
});

test('shared initial anchors remain represented and can be exited without inventing a placement winner', () => {
  const model = createWorldModel(input([actor(1), actor(2)])); assert.equal(model.initialSharedCells, 1);
  const sim = WorldSimulation.create(model); sim.admitCommands([move(0, 1, 2, 1), move(1, 0, 3, 2)]);
  sim.step(2); assert.deepEqual(sim.save().state.entities.map(e => [e.x, e.y]), [[1, 2], [0, 3]]);
});

test('planning cursor is saved and fairly rotates beyond the per-tick query limit', () => {
  const actors = Array.from({ length: 12 }, (_, i) => actor(i + 1, 0, 0));
  const sim = WorldSimulation.create(createWorldModel(input(actors)));
  sim.admitCommands(actors.map((e, i) => move(i, 6, 4, e.id))); const first = sim.step();
  assert.equal(first.events.filter(e => e.phase === 'navigation').length, WORLD_LIMITS.routeQueriesPerTick);
  const checkpoint = sim.save(); assert.equal(checkpoint.state.planningCursor, 8);
  const restored = WorldSimulation.restore(sim.model, checkpoint); assert.deepEqual(restored.step(), sim.step());
  assert(sim.save().state.planningCursor !== 8);
});

test('restore preserves only original overlapping anchors and fixed static positions', () => {
  const model = createWorldModel(input([actor(1), actor(2), actor(3, 6, 2),
    actor(4, 5, 4, { movementPerTick: 0, navigationClass: null })], [{ x: 4, y: 4 }]));
  const sim = WorldSimulation.create(model); sim.admitCommands([move(0, 1, 2)]); sim.step(2);
  const save = sim.save(); assert.deepEqual(WorldSimulation.restore(model, save).save(), save);
  for (const [index, x, y, code] of [[2, 0, 2, 'world-save-anchor-overlap'],
    [2, 4, 4, 'world-save-anchor-overlap'], [3, 6, 4, 'world-save-static-position']] as const) {
    const edited = structuredClone(save); Object.assign(edited.state.entities[index]!, { x, y });
    assert.throws(() => WorldSimulation.restore(model, edited), error(code));
  }
  // Shared initial anchors also remain valid during partial departure.
  const partial = WorldSimulation.create(model); partial.admitCommands([move(0, 1, 2)]); partial.step();
  assert.deepEqual(WorldSimulation.restore(model, partial.save()).step(), partial.step());
});

test('malformed batches, reused sequences and excess queues reject atomically', () => {
  const sim = WorldSimulation.create(createWorldModel(input())), before = sim.saveText();
  assert.throws(() => sim.admitCommands([move(0, 1, 2), { ...move(1, 1, 2), payload: { entityId: 1, x: -1, y: 2 } }]), error('world-integer'));
  assert.equal(sim.saveText(), before);
  assert.throws(() => sim.admitCommands([move(0, 1, 2), move(0, 3, 2)]), error('world-command-duplicate'));
  assert.equal(sim.saveText(), before);
  sim.admitCommands([move(2, 1, 2, 1, 1)]); const admitted = sim.saveText();
  assert.throws(() => sim.admitCommands([move(1, 3, 2)]), error('world-command-sequence')); assert.equal(sim.saveText(), admitted);
  assert.throws(() => sim.admitCommands([move(3, 3, 2, 1, WORLD_LIMITS.futureTicks + 1)]), error('world-command-horizon'));
  assert.throws(() => sim.admitCommands(Array.from({ length: 256 }, (_, i) => move(i + 3, 3, 2))), error('world-command-queue'));
});

test('saves reject policy/model/content mismatches, forged routes, reservations and hidden state', () => {
  const model = createWorldModel(input([actor(), actor(2, 6, 2)])), sim = WorldSimulation.create(model);
  sim.admitCommands([move(0, 3, 2)]); sim.step(); const save = sim.save();
  const mutate = (fn: (s: WorldSave) => void) => { const s = structuredClone(save); fn(s); assert.throws(() => WorldSimulation.restore(model, s), WorldError); };
  mutate(s => { s.state.modelSha256 = 'f'.repeat(64); });
  mutate(s => { s.state.entities[0]!.route[1] = 1030; });
  mutate(s => { s.state.entities[0]!.progress = 256; });
  mutate(s => { s.state.entities[0]!.health = 101; });
  mutate(s => { s.state.entities[1]!.x = 1; });
  mutate(s => { s.state.entities[0]!.route.push(s.state.entities[0]!.route[0]!); });
  assert.throws(() => WorldSimulation.restore(model, { ...save, engineVersion: 'other' }), error('world-save-version'));
  assert.throws(() => WorldSimulation.restore(model, { ...save, contentIdentity: { ...contentIdentity, profile: 'yr' } }), error('world-save-content'));
  const accessor = Object.defineProperty({ ...save }, 'state', { enumerable: true, get() { throw new Error('getter must not run'); } });
  assert.throws(() => WorldSimulation.restore(model, accessor), error('world-json-limit'));
  const before = sim.saveText(); assert.throws(() => sim.step(WORLD_LIMITS.stepTicks + 1), WorldError); assert.equal(sim.saveText(), before);
});

test('definition validation rejects ambiguous identity, missing grid bindings and mutable source tricks', () => {
  const a = input();
  assert.throws(() => createWorldModel({ ...a, entities: [actor(), actor()] }), error('world-duplicate-entity'));
  assert.throws(() => createWorldModel({ ...a, entities: [actor(1, 0, 2, { initialHealth: 101 })] }), error('world-integer'));
  assert.throws(() => createWorldModel({ ...a, navigation: [] }), error('world-movement-binding'));
  assert.throws(() => createWorldModel({ ...a, navigation: [{ grid: { ...a.navigation[0]!.grid }, costScale: 1 }] }), error('world-navigation-grid'));
  assert.throws(() => createWorldModel({ ...a, blocked: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }), error('world-duplicate-blocker'));
  assert.throws(() => createWorldModel({ ...a, entities: [actor(1, 0, 2, { blocksCell: Object(true) as boolean })] }), error('world-occupancy'));
});

test('world replay preserves admission timing, pending future orders, motion and terminal hashes', () => {
  const model = createWorldModel(input([actor(), actor(2, 6, 4)])), recorder = new WorldReplayRecorder(model);
  recorder.admitCommands([move(0, 6, 2), move(1, 4, 4, 2, 8)]); recorder.step(3);
  recorder.admitCommands([move(2, 0, 2, 1, 3)]); recorder.step(3);
  recorder.admitCommands([stop(3, 1, 9)]); recorder.step(6);
  recorder.admitCommands([move(4, 2, 4, 2, 15)]);
  const document = recorder.document(), replayed = replayWorld(model, document);
  assert.deepEqual(replayed.simulation.save(), recorder.save()); assert.equal(replayed.stateSha256, worldHash(recorder.save()));
  assert.equal(replayed.simulation.save().queuedCommands.length, 1);
  const continuous = WorldSimulation.restore(model, recorder.save()); assert.deepEqual(replayed.simulation.step(10), continuous.step(10));
  const altered = structuredClone(document); altered.admissions[1]!.nextTick = 4;
  assert.throws(() => replayWorld(model, altered), WorldError);
  assert.throws(() => replayWorld(model, { ...document, finalStateSha256: 'f'.repeat(64) }), error('world-replay-final-state'));
  assert.throws(() => replayWorld(model, { ...document, finalNextTick: 10001 }), error('world-integer'));
});

test('recording can begin at a moving checkpoint and rejected admissions leave both records and state intact', () => {
  const model = createWorldModel(input()), base = WorldSimulation.create(model); base.admitCommands([move(0, 6, 2)]); base.step(3);
  const recorder = new WorldReplayRecorder(model, base.save()); recorder.step(2); const before = recorder.document();
  assert.throws(() => recorder.admitCommands([move(0, 1, 2, 1, 5)]), error('world-command-sequence'));
  assert.deepEqual(recorder.document(), before);
  recorder.admitCommands([stop(1, 1, 5)]); recorder.step();
  assert.deepEqual(replayWorld(model, recorder.document()).simulation.save(), recorder.save());
});

test('single ticks and batches have identical authoritative states and traces', () => {
  const model = createWorldModel(input([actor(), actor(2, 0, 4)])), batched = WorldSimulation.create(model), individual = WorldSimulation.create(model);
  const commands = [move(0, 6, 2), move(1, 6, 4, 2), stop(2, 2, 5), move(3, 0, 2, 1, 6)];
  batched.admitCommands(commands); individual.admitCommands(commands);
  const many = batched.step(20), events = []; for (let i = 0; i < 20; i++) events.push(...individual.step().events);
  assert.deepEqual(many.events, events); assert.equal(batched.saveText(), individual.saveText());
});

test('fatal work or trace exhaustion rolls back all ticks and queued command consumption', () => {
  const sim = WorldSimulation.create(createWorldModel(input())); sim.admitCommands([move(0, 3, 2)]); const before = sim.saveText();
  assert.throws(() => sim.step(4, 0), error('world-work-limit')); assert.equal(sim.saveText(), before);
  const actors = Array.from({ length: 1024 }, (_, i) => actor(i + 1, 0, 0, { blocksCell: false, movementPerTick: 1 }));
  const busy = WorldSimulation.create(createWorldModel(input(actors, [], 65535)));
  for (let batch = 0; batch < 4; batch++) {
    busy.admitCommands(actors.slice(batch * 256, (batch + 1) * 256).map(e => move(e.id, 1, 0, e.id, batch))); busy.step();
  }
  const checkpoint = busy.saveText(); assert.throws(() => busy.step(128), error('world-trace-limit')); assert.equal(busy.saveText(), checkpoint);
});
