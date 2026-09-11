// SPDX-License-Identifier: GPL-3.0-or-later
// Original component fixtures. No mission invocation or native runtime is implied.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationGrid } from '../../packages/sim/src/navigation.ts';
import { createWorldModel, worldPosition, type WorldEntityDefinition } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation, readWorldEntityPresence } from '../../packages/sim/src/world.ts';
import { houseFixture } from './mission-house-fixture.ts';
import { createCombatModel, combatFactor } from '../../packages/sim/src/combat-model.ts';
import { createOrdinaryCombatRules } from '../../packages/sim/src/ordinary-combat-rules.ts';
import { createOrdinaryDeathRules } from '../../packages/sim/src/ordinary-death-rules.ts';

function fixture(profile: 'ra2' | 'yr' = 'ra2') {
  const identity = { profile, manifestSha256: '1'.repeat(64), rulesSha256: '2'.repeat(64), orderedModHashes: [] };
  const grid = createNavigationGrid({ contentIdentity: identity, movementClass: 'foot',
    cells: Array.from({ length: 12 }, (_, i) => ({ x: i % 4, y: Math.floor(i / 4), cost: 1, exits: 255 })) });
  const actor = (id: number, x: number, changes: Partial<WorldEntityDefinition> = {}): WorldEntityDefinition => ({
    id, rowId: `infantry:${id}`, typeId: 'infantry:original', kind: 'infantry', owner: 0, x, y: 1,
    initialHealth: 100, maximumHealth: 100, movementPerTick: 128, navigationClass: 'foot', blocksCell: true, ...changes });
  const input = { contentIdentity: identity, sourceSha256: '3'.repeat(64), definitionsSha256: '4'.repeat(64),
    entities: [actor(3, 2, { owner: 1 }), actor(1, 0), actor(5, 3, { kind: 'terrain', owner: null,
      initialHealth: null, maximumHealth: null, movementPerTick: 0, navigationClass: null }),
    actor(4, 3, { initialHealth: 0, movementPerTick: 0, navigationClass: null, blocksCell: false })],
    navigation: [{ grid, costScale: 1 }], blocked: [] };
  const model = createWorldModel(input); return { input, model, world: WorldSimulation.create(model) };
}
const move = { schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 1, x: 1, y: 1 } };

test('owned presence follows the current checkpoint in stable ID order without changing saves', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), before = f.world.saveText(), initial = readWorldEntityPresence(f.world, [5, 3, 1, 4]);
    assert.equal(initial.model, f.model); assert.equal(initial.nextTick, 0); assert.equal(initial.work, 8);
    assert.deepEqual(initial.entities.map(e => [e.entityId, e.owner, e.health, e.dying, e.present]),
      [[1, 0, 100, false, true], [3, 1, 100, false, true], [4, 0, 0, false, false], [5, null, null, false, true]]);
    assert(Object.isFrozen(initial)); assert(Object.isFrozen(initial.entities)); assert(Object.isFrozen(initial.entities[0]));
    assert.throws(() => { (initial.entities[0] as { x: number }).x = 99; });
    assert.equal(f.world.saveText(), before);
    f.world.admitCommands([move]); f.world.step(2);
    const now = readWorldEntityPresence(f.world, [1]); assert.equal(now.nextTick, 2); assert.equal(now.entities[0]!.x, 1);
    assert.equal(initial.entities[0]!.x, 0);
    const restored = WorldSimulation.restore(f.model, f.world.save());
    assert.deepEqual(readWorldEntityPresence(restored, [1]), now);
  }
});

test('instance authentication rejects forged constructors, wrappers and subclasses without calling public methods', () => {
  const f = fixture(), checkpoint = f.world.save();
  for (const fake of [{ ...f.world }, Object.create(WorldSimulation.prototype), new Proxy(f.world, { get() { throw Error('get'); } })]) {
    assert.throws(() => readWorldEntityPresence(fake as WorldSimulation, [1]), /world-instance/);
  }
  assert.throws(() => Reflect.construct(WorldSimulation, [f.model, checkpoint]), /world-instance/);
  const Base = WorldSimulation as unknown as new (...args: unknown[]) => WorldSimulation;
  class Derived extends Base {}
  assert.throws(() => new Derived(f.model, checkpoint), /world-instance/);
  Object.defineProperties(f.world, {
    model: { get() { throw Error('public-model'); } },
    save: { value() { throw Error('public-save'); } },
    saveText: { value() { throw Error('public-save-text'); } },
  });
  assert.equal(readWorldEntityPresence(f.world, [1]).model, f.model);
  const altered = fixture().world; Object.setPrototypeOf(altered, Object.create(WorldSimulation.prototype));
  assert.throws(() => readWorldEntityPresence(altered, [1]), /world-instance/);
});

test('selected IDs are captured by descriptors before taking current state', () => {
  const f = fixture();
  f.world.admitCommands([move]);
  let captured = false;
  const ids = new Proxy([1], {
    get() { throw Error('no public read'); },
    getOwnPropertyDescriptor(target, key) {
      if (key === '0' && !captured) { captured = true; f.world.step(2); }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const result = readWorldEntityPresence(f.world, ids);
  assert(captured); assert.equal(result.nextTick, 2); assert.equal(result.entities[0]!.x, 1);
  const accessor = [1]; Object.defineProperty(accessor, '0', { enumerable: true, get() { throw Error('getter'); } });
  assert.throws(() => readWorldEntityPresence(f.world, accessor), /world-array/);
});

test('empty selections, exact minimum budgets and malformed ID bounds are atomic', () => {
  const { world } = fixture(), before = world.saveText();
  const empty = readWorldEntityPresence(world, []); assert.equal(empty.work, 4); assert.deepEqual(empty.entities, []);
  assert.deepEqual(readWorldEntityPresence(world, [], 4), empty);
  const one = readWorldEntityPresence(world, [1]); assert.equal(one.work, 5);
  assert.deepEqual(readWorldEntityPresence(world, [1], 5), one);
  assert.throws(() => readWorldEntityPresence(world, [1], 4), /world-presence-work/);
  assert.throws(() => readWorldEntityPresence(world, [], 3), /world-presence-work/);
  for (const ids of [[1, 1], [99], [0], [-0], [NaN], new Array(1), Array.from({ length: 2049 }, (_, i) => i + 1)]) {
    assert.throws(() => readWorldEntityPresence(world, ids));
  }
  const extra = Object.assign([1], { extra: true }); assert.throws(() => readWorldEntityPresence(world, extra), /world-array/);
  const hidden = new Proxy(Array.from({ length: 2049 }, (_, i) => i + 1), { get(t, key) { return key === 'length' ? 1 : Reflect.get(t, key); } });
  assert.throws(() => readWorldEntityPresence(world, hidden), /world-integer/);
  assert.equal(world.saveText(), before);
});

test('current owner changes survive restore while historical transfers do not increase query work', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = houseFixture({ profile }), b = f.world.model;
    const model = createWorldModel({ contentIdentity: b.contentIdentity, sourceSha256: b.sourceSha256,
      definitionsSha256: b.definitionsSha256, entities: b.entities, navigation: b.navigation, blocked: b.blocked.map(worldPosition),
      footprints: b.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: f.source });
    const world = WorldSimulation.create(model), initial = readWorldEntityPresence(world, [1, 2, 3]);
    const action = f.source.instructions.find(i => i.opcode === 36)!;
    for (let i = 0; i < 32; i++) world.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: null });
    const current = readWorldEntityPresence(world, [1, 2, 3]);
    assert.deepEqual(initial.entities.map(e => e.owner), [0, 0, 1]); assert.deepEqual(current.entities.map(e => e.owner), [1, 1, 1]);
    assert.deepEqual(model.entities.map(e => e.owner), [0, 0, 1]); assert.equal(current.work, initial.work);
    const checkpoint = world.save(); assert.equal(checkpoint.state.ownership!.transfers.length, 32);
    assert.deepEqual(readWorldEntityPresence(WorldSimulation.restore(model, checkpoint), [1, 2, 3]), current);
    Object.defineProperty(world, 'save', { value() { throw Error('cannot serialize'); } });
    assert.deepEqual(readWorldEntityPresence(world, [1, 2, 3], initial.work), current);
  }
});

test('health-zero pending death retains presence and completed death releases it', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), actors = [1, 3].map(entityId => ({ entityId, armor: 0, layer: 'ground' as const, weapons: ['test:gun'], initialAmmo: -1 }));
    const ordinary = createOrdinaryCombatRules({ seed: 0, actors: actors.map(a => ({ entityId: a.entityId, houseFirepower: 1,
      actorFirepower: 1, veteranCombat: 1, countryArmor: 1, actorArmor: 1, veteranArmor: 1, houseRof: 1, veteranRof: 1 })),
      weapons: [{ weaponId: 'test:gun', maxDamage: 1000 }] });
    const combat = createCombatModel({ actors, allies: [], ordinary, weapons: [{ id: 'test:gun', damage: 100, range: 2048,
      minimumRange: 0, reloadTicks: 2, burst: 1, burstDelayTicks: 1, delivery: 'instant', speed: 0, ground: true, air: false,
      verses: Array.from({ length: 11 }, () => combatFactor(1)) }],
      ordinaryDeath: createOrdinaryDeathRules({ actors: actors.map(a => ({ entityId: a.entityId, corpseAnimationIds: ['test:corpse'],
        sequence11Ticks: 3, sequence12Ticks: 3 })), weapons: [{ weaponId: 'test:gun', infDeath: 1 }] }) });
    const model = createWorldModel({ ...f.input, combat }), world = WorldSimulation.create(model);
    world.admitCommands([{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'attack', payload: { entityId: 1, targetId: 3 } }]);
    world.step();
    const pending = readWorldEntityPresence(world, [3]);
    assert.equal(pending.work, 6); assert.deepEqual([pending.entities[0]!.health, pending.entities[0]!.dying, pending.entities[0]!.present], [0, true, true]);
    const restored = WorldSimulation.restore(model, world.save());
    assert.deepEqual(readWorldEntityPresence(restored, [3]), pending);
    world.step(3); restored.step(3);
    const completed = readWorldEntityPresence(world, [3]);
    assert.equal(completed.work, 6); assert.deepEqual([completed.entities[0]!.health, completed.entities[0]!.dying, completed.entities[0]!.present], [0, false, false]);
    assert.deepEqual(readWorldEntityPresence(restored, [3]), completed);
    assert.equal(pending.entities[0]!.present, true);
  }
});
