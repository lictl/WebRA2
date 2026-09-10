// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { combatDamage, combatFactor, createCombatModel, type CombatActor, type CombatWeapon } from '../../packages/sim/src/combat-model.ts';
import { createNavigationGrid } from '../../packages/sim/src/navigation.ts';
import { createWorldModel, WorldError, worldHash, type WorldEntityDefinition, type WorldModelInput } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation, type WorldSave } from '../../packages/sim/src/world.ts';
import { replayWorld, WorldReplayRecorder } from '../../packages/sim/src/world-replay.ts';

const contentIdentity = { profile: 'ra2' as const, manifestSha256: 'a'.repeat(64), rulesSha256: 'b'.repeat(64), orderedModHashes: [] };
const weapon = (overrides: Partial<CombatWeapon> = {}): CombatWeapon => ({ id: 'original:gun', damage: 25, range: 2048, minimumRange: 0,
  reloadTicks: 4, burst: 1, burstDelayTicks: 2, delivery: 'instant', speed: 0, ground: true, air: false,
  verses: Array.from({ length: 11 }, () => combatFactor(1)), ...overrides });
const entity = (id: number, x: number, owner: number, overrides: Partial<WorldEntityDefinition> = {}): WorldEntityDefinition => ({
  id, rowId: `original:${id}`, typeId: 'original:actor', owner, kind: 'unit', x, y: 1, initialHealth: 100, maximumHealth: 100,
  movementPerTick: 128, navigationClass: 'ground', blocksCell: true, ...overrides });
const binding = (entityId: number, overrides: Partial<CombatActor> = {}): CombatActor => ({ entityId, armor: 0, layer: 'ground', weapons: ['original:gun'], initialAmmo: -1, ...overrides });
function input(entities = [entity(1, 0, 0), entity(2, 4, 1)]): WorldModelInput {
  return { contentIdentity, sourceSha256: 'c'.repeat(64), definitionsSha256: 'd'.repeat(64), entities, blocked: [],
    navigation: [{ costScale: 1, grid: createNavigationGrid({ contentIdentity, movementClass: 'ground',
      cells: Array.from({ length: 24 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8), cost: 1, exits: 255 })) }) }] };
}
function model(w = weapon(), entities = [entity(1, 0, 0), entity(2, 4, 1)], actors = entities.map(e => binding(e.id))) {
  return createWorldModel({ ...input(entities), combat: createCombatModel({ weapons: [w], actors, allies: [] }) });
}
const attack = (sequence = 0, entityId = 1, targetId = 2, tick = 0, playerId = 0) => ({ schemaVersion: 1, tick, playerId, sequence, kind: 'attack', payload: { entityId, targetId } });
const move = (sequence: number, entityId: number, x: number, tick: number, playerId: number) => ({ schemaVersion: 1, tick, playerId, sequence, kind: 'move', payload: { entityId, x, y: 1 } });
const stop = (sequence: number, entityId: number, tick: number, playerId: number) => ({ schemaVersion: 1, tick, playerId, sequence, kind: 'stop', payload: { entityId } });

test('optional combat binds owned canonical definitions without changing movement-only save shape', () => {
  const w = weapon(), a = binding(1), base = input(), plain = createWorldModel(base);
  const config = createCombatModel({ weapons: [w], actors: [binding(2), a], allies: [] });
  const enriched = createWorldModel({ ...base, combat: config }); assert.notEqual(plain.sha256, enriched.sha256);
  assert.equal(config.sha256, createCombatModel({ weapons: [w], actors: [a, binding(2)], allies: [] }).sha256);
  assert.equal(WorldSimulation.create(plain).save().engineVersion, 'webra2-world-1');
  assert(!Object.hasOwn(WorldSimulation.create(plain).save().state, 'combat'));
  assert.equal(WorldSimulation.create(enriched).save().engineVersion, 'webra2-world-2');
  assert.throws(() => createWorldModel({ ...base, combat: { ...config } }), /combat-model/);
  assert.throws(() => createWorldModel({ ...base, combat: createCombatModel({ weapons: [w], actors: [binding(99)], allies: [] }) }), /world-combat-actor/);
  assert(Object.isFrozen(config.weapons[0]!.verses[0]));
  assert.throws(() => WorldSimulation.create(plain).admitCommands([attack()]), /world-command-kind/);
  assert.notEqual(createCombatModel({ weapons: [weapon({ damage: 26 })], actors: [a], allies: [] }).sha256,
    createCombatModel({ weapons: [w], actors: [a], allies: [] }).sha256);
});

test('exact binary rational damage floors fractional health, saturates and retains subnormal factors', () => {
  assert.deepEqual(combatFactor(0), { significand: 0, exponent: 0 });
  assert.deepEqual(combatFactor(Number.MIN_VALUE), { significand: 1, exponent: -1074 });
  assert.deepEqual(combatFactor(0.75), { significand: 3, exponent: -2 });
  const w = weapon({ damage: 7, verses: [0, 0.75, 1.5, Number.MIN_VALUE, Number.MAX_VALUE, ...Array(6).fill(1)].map(combatFactor) });
  assert.deepEqual([0, 1, 2, 3, 4].map(armor => combatDamage(w, armor)), [0, 5, 10, 0, 1_000_000]);
  for (const n of [-1, -0, Infinity, NaN]) assert.throws(() => combatFactor(n), /combat-factor/);
  assert.throws(() => createCombatModel({ weapons: [weapon({ verses: Array(11).fill({ significand: 2, exponent: -1 }) })], actors: [], allies: [] }), /combat-factor-canonical/);
});

test('ownership, diplomacy, layer, immunity and unsupported actors reject before target admission', () => {
  const entities = [entity(1, 0, 0), entity(2, 4, 1), entity(3, 6, 2), entity(4, 7, 0)];
  const m = createWorldModel({ ...input(entities), combat: createCombatModel({ weapons: [weapon()], actors: [binding(1), binding(2, { layer: 'air' }), binding(3), binding(4, { weapons: [] })], allies: [{ playerId: 0, allyId: 2 }] }) });
  const s = WorldSimulation.create(m);
  s.admitCommands([attack(0, 1, 2, 0, 1), attack(0, 1, 3), attack(1, 1, 4), attack(2, 1, 2), attack(3, 4, 2), attack(4, 1, 99)]);
  const kinds = s.step().events.filter(e => e.phase === 'command').map(e => e.kind);
  assert.deepEqual(kinds, ['illegal-target', 'illegal-target', 'ineffective-weapon', 'unsupported-weapon', 'illegal-target', 'not-owner']);
  assert(s.save().state.combat!.actors.every(a => a.targetId === null));
  const immune = WorldSimulation.create(model(weapon({ verses: Array(11).fill(combatFactor(0)) })));
  immune.admitCommands([attack()]); assert(immune.step().events.some(e => e.kind === 'ineffective-weapon'));
});

test('range boundaries include exact endpoints and hold out-of-range targets without invented pursuit', () => {
  for (const [range, minimumRange, fires] of [[1024, 1024, true], [1023, 0, false], [2048, 1025, false]] as const) {
    const s = WorldSimulation.create(model(weapon({ range, minimumRange }))); s.admitCommands([attack()]);
    assert.equal(s.step().events.some(e => e.kind === 'fired'), fires);
    assert.equal(s.save().state.entities[0]!.goal, null); assert.equal(s.save().state.combat!.actors[0]!.targetId, 2);
  }
});

test('instant damage, cooldown and stable actor order suppress a destroyed opposing shooter', () => {
  const s = WorldSimulation.create(model(weapon({ damage: 100 })));
  s.admitCommands([attack(), attack(0, 2, 1, 0, 1)]); const events = s.step().events;
  assert.deepEqual(events.filter(e => e.kind === 'fired').map(e => e.entityId), [1]);
  assert.deepEqual(s.save().state.entities.map(e => e.health), [100, 0]);
  assert(s.save().state.combat!.actors.every(a => a.targetId === null));
  const t = WorldSimulation.create(model()); t.admitCommands([attack()]);
  assert.deepEqual(t.step(13).events.filter(e => e.kind === 'fired').map(e => e.tick), [0, 4, 8, 12]);
  assert.equal(t.save().state.entities[1]!.health, 0);
});

test('bursts, last-shot reload and finite ammo survive restore at every boundary', () => {
  const m = model(weapon({ damage: 5, burst: 3, burstDelayTicks: 2, reloadTicks: 5 }), undefined, [binding(1, { initialAmmo: 4 }), binding(2)]);
  const s = WorldSimulation.create(m); s.admitCommands([attack()]); const shotTicks: number[] = [];
  for (let i = 0; i < 15; i++) {
    const restored = WorldSimulation.restore(m, s.save()); const step = s.step(); assert.deepEqual(restored.step(), step);
    assert.equal(restored.saveText(), s.saveText()); shotTicks.push(...step.events.filter(e => e.kind === 'fired').map(e => e.tick));
  }
  assert.deepEqual(shotTicks, [0, 2, 4, 9]); assert.equal(s.save().state.combat!.actors[0]!.ammo, 0);
  assert.equal(s.save().state.entities[1]!.health, 80);
});

test('scheduled projectiles persist after shooter death and execute in due-tick then stable-ID order', () => {
  const s = WorldSimulation.create(model(weapon({ damage: 100, delivery: 'tracked', speed: 512 })));
  s.admitCommands([attack(), attack(0, 2, 1, 0, 1)]); s.step(); const checkpoint = s.save();
  assert.deepEqual(checkpoint.state.combat!.impacts.map(p => [p.id, p.dueTick]), [[1, 2], [2, 2]]);
  const restored = WorldSimulation.restore(s.model, checkpoint); assert.deepEqual(s.step(2), restored.step(2));
  assert.deepEqual(s.save().state.entities.map(e => e.health), [0, 0]); assert.equal(s.save().state.combat!.impacts.length, 0);
});

test('fixed-cell impacts miss a moved target while tracked impacts damage its current logical cell', () => {
  for (const delivery of ['fixed-cell', 'tracked'] as const) {
    const s = WorldSimulation.create(model(weapon({ delivery, speed: 256, reloadTicks: 10 })));
    s.admitCommands([attack(), move(0, 2, 5, 1, 1)]); s.step(5);
    assert.equal(s.save().state.entities[1]!.x, 5);
    assert.equal(s.save().state.entities[1]!.health, delivery === 'tracked' ? 75 : 100);
  }
});

test('stop and move cancel target/burst without erasing cooldown or already launched impacts', () => {
  const m = model(weapon({ delivery: 'tracked', speed: 256, burst: 3, burstDelayTicks: 2 }));
  for (const order of [stop(1, 1, 1, 0), move(1, 1, 1, 1, 0)]) {
    const s = WorldSimulation.create(m); s.admitCommands([attack(), order]); s.step(2);
    const a = s.save().state.combat!.actors[0]!; assert.equal(a.targetId, null); assert.equal(a.burstRemaining, 0); assert.equal(a.readyTick, 4);
    assert.equal(s.save().state.combat!.impacts.length, 1); s.step(3); assert.equal(s.save().state.entities[1]!.health, 75);
  }
});

test('destruction clears a partial-edge reservation and stationary extra cells for subsequent ticks', () => {
  const entities = [entity(1, 0, 0), entity(2, 4, 1, { movementPerTick: 0, navigationClass: null, kind: 'structure' }), entity(3, 7, 0)];
  const m = createWorldModel({ ...input(entities), footprints: [{ entityId: 2, cells: [{ x: 5, y: 1 }] }],
    combat: createCombatModel({ weapons: [weapon({ damage: 100 })], actors: entities.map(e => binding(e.id)), allies: [] }) });
  const s = WorldSimulation.create(m); s.admitCommands([attack(), move(1, 3, 5, 1, 0)]);
  const events = s.step(6).events; assert(events.some(e => e.kind === 'destroyed' && e.entityId === 2));
  assert.equal(s.save().state.entities[2]!.x, 5);
  const moving = WorldSimulation.create(model(weapon({ damage: 100 })));
  moving.admitCommands([attack(), move(0, 2, 5, 0, 1)]); moving.step();
  const dead = moving.save().state.entities[1]!; assert.equal(dead.health, 0); assert.equal(dead.progress, 0); assert.deepEqual(dead.route, []);
});

test('pending combat save framing, joins, timing, ammunition and model checks reject corruption', () => {
  const m = model(weapon({ delivery: 'tracked', speed: 256, burst: 3 })), s = WorldSimulation.create(m); s.admitCommands([attack()]); s.step();
  const save = s.save();
  const bad = (change: (s: WorldSave) => void) => { const altered = structuredClone(save); change(altered); assert.throws(() => WorldSimulation.restore(m, altered), WorldError); };
  bad(s => { s.state.combat!.actors[0]!.targetId = 1; });
  bad(s => { s.state.combat!.actors[0]!.weaponId = 'forged'; });
  bad(s => { s.state.combat!.actors[0]!.burstTick = 0; });
  bad(s => { s.state.combat!.actors[0]!.ammo = 100; });
  bad(s => { s.state.combat!.impacts[0]!.dueTick++; });
  bad(s => { s.state.combat!.impacts[0]!.sourceId = 2; });
  bad(s => { s.state.combat!.impacts[0]!.weaponId = 'forged'; });
  bad(s => { s.state.combat!.impacts.push({ ...s.state.combat!.impacts[0]! }); });
  bad(s => { s.state.combat!.nextImpactId = 1; });
  bad(s => { delete s.state.combat; });
  assert.throws(() => WorldSimulation.restore(model(weapon({ damage: 26 })), save), /world-save-model/);
});

test('combat and moving checkpoints replay with identical admissions, pending impacts and terminal state', () => {
  const m = model(weapon({ delivery: 'tracked', speed: 128, damage: 3, burst: 3, reloadTicks: 6 }));
  const r = new WorldReplayRecorder(m); r.admitCommands([attack(), move(0, 2, 6, 0, 1)]); r.step(3);
  const checkpoint = r.save(), restored = new WorldReplayRecorder(m, checkpoint);
  const commands = [stop(1, 1, 7, 0), attack(2, 1, 2, 10)]; r.admitCommands(commands); restored.admitCommands(commands);
  assert.deepEqual(r.step(12), restored.step(12)); assert.deepEqual(r.save(), restored.save());
  for (const recorder of [r, restored]) assert.equal(replayWorld(m, recorder.document()).stateSha256, worldHash(recorder.save()));
  assert(checkpoint.state.combat!.impacts.length > 0); assert(checkpoint.state.entities[1]!.progress > 0);
});

test('malformed attack batches and exhausted whole-step work leave the checkpoint untouched', () => {
  const s = WorldSimulation.create(model(weapon({ delivery: 'tracked', speed: 256 }))), start = s.saveText();
  assert.throws(() => s.admitCommands([attack(), { ...attack(1), payload: { entityId: 1, targetId: -1 } }]), WorldError);
  assert.equal(s.saveText(), start); s.admitCommands([attack()]); const before = s.saveText();
  assert.throws(() => s.step(4, 1), /world-work-limit/); assert.equal(s.saveText(), before);
  const step = s.step(4), same = WorldSimulation.create(s.model); same.admitCommands([attack()]);
  assert.deepEqual(same.step(4, step.work.entityVisits + step.work.navigationExpansions + step.work.transitions), step);
});
