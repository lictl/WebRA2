// SPDX-License-Identifier: MIT
// Original small worlds; no retail source data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFactor, createCombatModel, type CombatWeapon } from '../../packages/sim/src/combat-model.ts';
import { createNavigationGrid } from '../../packages/sim/src/navigation.ts';
import { createWorldModel } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation, worldStepCombatObservations } from '../../packages/sim/src/world.ts';

function model(delayed = false) {
  const contentIdentity = { profile: 'ra2' as const, manifestSha256: '1'.repeat(64), rulesSha256: '2'.repeat(64), orderedModHashes: [] };
  const weapon: CombatWeapon = { id: 'original:gun', damage: delayed ? 100 : 30, range: 4096, minimumRange: 0,
    reloadTicks: 1, burst: 1, burstDelayTicks: 1, delivery: delayed ? 'tracked' : 'instant', speed: delayed ? 4096 : 0,
    ground: true, air: false, verses: Array.from({ length: 11 }, () => combatFactor(1)) };
  return createWorldModel({ contentIdentity, sourceSha256: '3'.repeat(64), definitionsSha256: '4'.repeat(64),
    entities: [1, 2, 3].map(id => ({ id, rowId: `original:${id}`, typeId: 'original:actor', owner: id === 3 ? 1 : 0,
      kind: 'unit' as const, x: id, y: 1, initialHealth: 100, maximumHealth: 100, movementPerTick: 128,
      navigationClass: 'ground', blocksCell: true })), blocked: [],
    navigation: [{ costScale: 1, grid: createNavigationGrid({ contentIdentity, movementClass: 'ground',
      cells: Array.from({ length: 18 }, (_, i) => ({ x: i % 6, y: Math.floor(i / 6), cost: 1, exits: 255 })) }) }],
    combat: createCombatModel({ weapons: [weapon], actors: [1, 2, 3].map(entityId => ({ entityId, armor: 0,
      layer: 'ground', weapons: entityId === 3 ? [] : [weapon.id], initialAmmo: -1 })), allies: [] }) });
}
function admitted(m: ReturnType<typeof model>) {
  const sim = WorldSimulation.create(m);
  sim.admitCommands([1, 2].map((entityId, sequence) => ({ schemaVersion: 1, tick: 0, playerId: 0, sequence,
    kind: 'attack', payload: { entityId, targetId: 3 } })));
  return sim;
}

test('private combat facts retain each attacker and health application in actual hit order', () => {
  const m = model(), sim = admitted(m), initial = sim.save(), step = sim.step(2);
  const facts = worldStepCombatObservations(m, step);
  assert.deepEqual(Object.keys(step), ['nextTick', 'events', 'work']);
  assert.equal(facts.modelSha256, m.sha256); assert.equal(facts.fromNextTick, 0); assert.equal(facts.toNextTick, 2);
  assert.deepEqual(facts.damage.map(v => [v.tick, v.sourceId, v.targetId, v.damage, v.healthBefore, v.healthAfter]),
    [[0, 1, 3, 30, 100, 70], [0, 2, 3, 30, 70, 40], [1, 1, 3, 30, 40, 10], [1, 2, 3, 10, 10, 0]]);
  assert.equal(facts.damage.every(v => v.weaponId === 'original:gun'), true);
  const split = WorldSimulation.restore(m, initial), first = split.step(), saved = split.save();
  const resumed = WorldSimulation.restore(m, saved), second = resumed.step();
  assert.deepEqual([...worldStepCombatObservations(m, first).damage, ...worldStepCombatObservations(m, second).damage], facts.damage);
  assert.deepEqual(resumed.save(), sim.save());
  assert.deepEqual([...first.events, ...second.events], step.events);
  for (const key of ['entityVisits', 'navigationExpansions', 'transitions'] as const)
    assert.equal(first.work[key] + second.work[key], step.work[key]);
  assert.deepEqual(worldStepCombatObservations(m, sim.step(4)).damage, []);
});

test('missed impacts and already dead targets cannot create another damage observation', () => {
  const m = model(true), sim = admitted(m), queued = sim.step();
  assert.deepEqual(worldStepCombatObservations(m, queued).damage, []);
  const impact = sim.step(); assert.equal(impact.events.filter(e => e.kind === 'impact-missed').length, 1);
  const facts = worldStepCombatObservations(m, impact);
  assert.equal(facts.damage.length, 1); assert.equal(facts.damage[0]!.sourceId, 1); assert.equal(facts.damage[0]!.healthAfter, 0);
  assert.deepEqual(worldStepCombatObservations(m, sim.step()).damage, []);
});

test('mutable public trace data, copied steps and foreign models cannot forge retained facts', () => {
  const m = model(), result = admitted(m).step(), facts = worldStepCombatObservations(m, result);
  assert.ok(Object.isFrozen(facts)); assert.ok(Object.isFrozen(facts.damage)); assert.ok(Object.isFrozen(facts.damage[0]));
  result.events[0]!.entityId = 999; result.nextTick = 999; result.work.transitions = 0;
  assert.equal(worldStepCombatObservations(m, result), facts); assert.equal(facts.toNextTick, 1); assert.equal(facts.damage[0]!.sourceId, 1);
  assert.throws(() => worldStepCombatObservations(m, structuredClone(result)), /observations/);
  assert.throws(() => worldStepCombatObservations(model(), result), /observations/);
  let reads = 0; assert.throws(() => worldStepCombatObservations(m, new Proxy(result, { get() { reads++; throw Error('read'); } })), /observations/);
  assert.equal(reads, 0);
});

test('a late world work failure rolls back hits while earlier successful facts remain immutable', () => {
  const m = model(), sim = admitted(m), initial = sim.save(), measured = WorldSimulation.restore(m, initial).step(2);
  const used = Object.values(measured.work).reduce((a, b) => a + b, 0);
  assert.throws(() => sim.step(2, used - 1), /work-limit/); assert.deepEqual(sim.save(), initial);
  const first = sim.step(), facts = worldStepCombatObservations(m, first), checkpoint = sim.save();
  assert.throws(() => sim.step(1, 0), /work-limit/); assert.deepEqual(sim.save(), checkpoint);
  assert.equal(worldStepCombatObservations(m, first), facts); assert.equal(facts.damage.length, 2);
  assert.deepEqual(sim.step().events, measured.events.filter(e => e.tick === 1));
});
