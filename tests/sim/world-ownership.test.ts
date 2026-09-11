// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound ownership cases; no retail mission bytes or IDs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseFixture } from './mission-house-fixture.ts';
import { createWorldModel, worldPosition, worldHash, type WorldModel } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation, worldHouseTransferFacts } from '../../packages/sim/src/world.ts';
import { WorldReplayRecorder, replayWorld } from '../../packages/sim/src/world-replay.ts';
import { createCombatModel, combatFactor } from '../../packages/sim/src/combat-model.ts';
import { createOrdinaryCombatRules } from '../../packages/sim/src/ordinary-combat-rules.ts';
import { createOrdinaryDeathRules } from '../../packages/sim/src/ordinary-death-rules.ts';

function fixture(profile: 'ra2' | 'yr') {
  const f = houseFixture({ profile }), base = f.world.model;
  const input = { contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256, definitionsSha256: base.definitionsSha256,
    entities: base.entities, navigation: base.navigation, blocked: base.blocked.map(worldPosition),
    footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })) };
  return { ...f, input, model: createWorldModel({ ...input, ownership: f.source }) };
}
const order = (entityId: number, playerId: number, sequence: number, tick: number, x = 3, y = 2) =>
  ({ schemaVersion: 1, tick, playerId, sequence, kind: 'move', payload: { entityId, x, y } });

test('world-8 binds genuine full source and preserves legacy model/save identities exactly', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), legacy = createWorldModel(f.input);
    assert.equal(legacy.sha256, f.world.model.sha256);
    assert.equal(worldHash(WorldSimulation.create(legacy).save()), worldHash(WorldSimulation.create(f.world.model).save()));
    assert.notEqual(f.model.sha256, legacy.sha256);
    assert.throws(() => createWorldModel({ ...f.input, ownership: { ...f.source } }), /world-ownership-source/);
    assert.throws(() => createWorldModel({ ...f.input, entities: f.input.entities.map((e, i) => i ? e : { ...e, owner: 1 }), ownership: f.source }), /world-ownership-source/);
    const sim = WorldSimulation.create(f.model), save = sim.save();
    assert.equal(save.engineVersion, 'webra2-world-8');
    assert.deepEqual(save.state.entities.map(e => e.owner), [0, 0, 1]);
    assert.throws(() => WorldSimulation.restore(legacy, save), /world-save-version/);
    assert.throws(() => WorldSimulation.restore(f.model, WorldSimulation.create(legacy).save()), /world-save-version/);
    assert.equal(WorldSimulation.restore(f.model, save).saveText(), sim.saveText());
  }
});

test('tag transfer changes actual command authority, cancels movement and retains initial definition ownership', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), sim = WorldSimulation.create(f.model);
    sim.admitCommands([order(1, 0, 0, 0)]); sim.step();
    const action = f.source.instructions.find(i => i.opcode === 14)!;
    const before = sim.save(), result = sim.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: 0 });
    assert.deepEqual(result.entityIds, [1, 3]); assert.deepEqual(result.changedEntityIds, [1]);
    assert.deepEqual(sim.save().state.entities.map(e => e.owner), [1, 0, 1]);
    assert.deepEqual(f.model.entities.map(e => e.owner), [0, 0, 1]);
    assert.equal(sim.save().state.entities[0]!.goal, null); assert.equal(sim.save().state.entities[0]!.progress, 0);
    assert.equal(worldHash(WorldSimulation.restore(f.model, before).save()), worldHash(before));
    const restored = WorldSimulation.restore(f.model, sim.save());
    const commands = [order(1, 0, 1, 1, 3, 3), order(1, 1, 0, 1, 3, 2)];
    sim.admitCommands(commands); restored.admitCommands(commands);
    const step = sim.step(); assert.deepEqual(restored.step(), step);
    assert(step.events.some(e => e.kind === 'not-owner' && e.entityId === 1));
    assert(step.events.some(e => e.kind === 'move-accepted' && e.entityId === 1));
    assert.equal(sim.saveText(), restored.saveText());
  }
});

test('house transfer selection, current owners and saved counters reject omissions and forged edits', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), sim = WorldSimulation.create(f.model), action = f.source.instructions.find(i => i.opcode === 36)!;
    const result = sim.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: 0 });
    assert.deepEqual(result.entityIds, [1, 2]);
    const save = sim.save(); assert.deepEqual(save.state.entities.map(e => e.owner), [1, 1, 1]);
    const owner = structuredClone(save); owner.state.entities[2]!.owner = 0;
    assert.throws(() => WorldSimulation.restore(f.model, owner), /world-ownership-owner-history/);
    const omitted = structuredClone(save); omitted.state.ownership!.transfers[0]!.entityIds.pop();
    assert.throws(() => WorldSimulation.restore(f.model, omitted), /world-ownership-transfer-selection/);
    const counter = structuredClone(save) as any; counter.state.ownership.counts[0].registered.infantry++;
    assert.throws(() => WorldSimulation.restore(f.model, counter), /world-ownership-counts/);
    const source = structuredClone(save); source.state.ownership!.sourceSha256 = '0'.repeat(64);
    assert.throws(() => WorldSimulation.restore(f.model, source), /world-ownership-identity/);
  }
});

test('ownership failure is atomic and repeated action boundaries remain explicit', () => {
  const f = fixture('ra2'), sim = WorldSimulation.create(f.model), action = f.source.instructions.find(i => i.opcode === 36)!;
  const invocation = { instructionId: action.instructionId, sourceHouse: 0, triggerHouse: 0 }, before = sim.saveText();
  assert.throws(() => sim.transferOwnership(invocation, 0), /world-ownership-work/); assert.equal(sim.saveText(), before);
  assert.throws(() => sim.transferOwnership({ ...invocation, instructionId: 'made-up' }), /transfer-instruction/); assert.equal(sim.saveText(), before);
  const first = sim.transferOwnership(invocation), second = sim.transferOwnership(invocation);
  assert.deepEqual(first.changedEntityIds, [1, 2]); assert.deepEqual(second.entityIds, []);
  assert.equal(sim.save().state.ownership!.transfers.length, 2);
  assert.equal(WorldSimulation.restore(f.model, sim.save()).saveText(), sim.saveText());
  const minimum = WorldSimulation.create(f.model), below = WorldSimulation.create(f.model);
  assert.deepEqual(minimum.transferOwnership(invocation, first.work), first);
  assert.throws(() => below.transferOwnership(invocation, first.work - 1), /world-ownership-work/);
  assert.equal(below.saveText(), before);
});

test('population queries and private transaction receipts join the exact source instruction and whole save', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), sim = WorldSimulation.create(f.model), action = f.source.instructions.find(i => i.opcode === 36)!;
    const event = f.source.instructions.find(i => i.opcode === 9)!;
    assert.deepEqual(sim.housePopulation(event.instructionId), { status: 'supported', value: false });
    const before = worldHash(sim.save()), result = sim.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: 0 });
    assert.deepEqual(sim.housePopulation(event.instructionId), { status: 'supported', value: true });
    const facts = worldHouseTransferFacts(f.model, result);
    assert.equal(facts.sourceSha256, f.source.sha256); assert.equal(facts.bindingsSha256, f.bindings.fingerprint);
    assert.equal(facts.fromStateSha256, before); assert.equal(facts.toStateSha256, worldHash(sim.save()));
    assert.equal(facts.instructionId, action.instructionId); assert(Object.isFrozen(facts));
    assert.throws(() => worldHouseTransferFacts(f.model, { ...result }), /world-house-transfer-facts/);
    assert.throws(() => worldHouseTransferFacts(createWorldModel(f.input), result), /world-house-transfer-facts/);
    assert.deepEqual(sim.housePopulation(action.instructionId), { status: 'unsupported', value: null });
  }
});

test('version2 replay preserves interleaved admissions and ownership operations at the same boundary', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), r = new WorldReplayRecorder(f.model), action = f.source.instructions.find(i => i.opcode === 14)!;
    r.admitCommands([order(1, 0, 0, 0)]);
    r.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: 0 });
    r.admitCommands([order(1, 1, 0, 0, 3, 3)]); r.step(2);
    const d = r.document(); assert.equal(d.schemaVersion, 2);
    assert.deepEqual(d.operations!.map(o => o.kind), ['commands', 'ownership', 'commands']);
    assert.equal(replayWorld(f.model, d).stateSha256, worldHash(r.save()));
    const resumed = new WorldReplayRecorder(f.model, r.save()); resumed.step(2);
    assert.equal(replayWorld(f.model, resumed.document()).stateSha256, worldHash(resumed.save()));
    const missing = structuredClone(d); missing.operations!.shift();
    assert.throws(() => replayWorld(f.model, missing), /world-replay-operation-order/);
    const reordered = structuredClone(d); reordered.operations!.reverse();
    assert.throws(() => replayWorld(f.model, reordered), /world-replay-operation-order/);
    const prior = r.document(); assert.throws(() => r.transferOwnership({ instructionId: 'unknown', sourceHouse: 0, triggerHouse: 0 }), /transfer-instruction/);
    assert.deepEqual(r.document(), prior);
  }
});

function combatFixture(profile: 'ra2' | 'yr', delayedDeath = false) {
  const f = fixture(profile), weapons = [{ id: 'original:gun', damage: 100, range: 2048, minimumRange: 0, reloadTicks: 2,
    burst: 1, burstDelayTicks: 1, delivery: 'instant' as const, speed: 0, ground: true, air: false, verses: Array.from({ length: 11 }, () => combatFactor(1)) }];
  const actors = f.model.entities.map(e => ({ entityId: e.id, armor: 0, layer: 'ground' as const, weapons: ['original:gun'], initialAmmo: -1 }));
  const ordinary = createOrdinaryCombatRules({ seed: 0, actors: actors.map(a => ({ entityId: a.entityId, houseFirepower: 1, actorFirepower: 1,
    veteranCombat: 1, countryArmor: 1, actorArmor: 1, veteranArmor: 1, houseRof: 1, veteranRof: 1 })), weapons: [{ weaponId: 'original:gun', maxDamage: 1000 }] });
  const combat = createCombatModel({ weapons, actors, allies: [], ...(delayedDeath ? { ordinary,
    ordinaryDeath: createOrdinaryDeathRules({ actors: actors.map(a => ({ entityId: a.entityId, corpseAnimationIds: ['original:corpse'], sequence11Ticks: 2, sequence12Ticks: 3 })),
      weapons: [{ weaponId: 'original:gun', infDeath: 1 }] }) } : {}) });
  return { ...f, model: createWorldModel({ ...f.input, ownership: f.source, combat }) };
}
const attack = (entityId: number, targetId: number, playerId: number, sequence = 0, tick = 0) =>
  ({ schemaVersion: 1, tick, playerId, sequence, kind: 'attack', payload: { entityId, targetId } });

test('capture invalidates existing allied targets and accepts the new owner hostile target', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = combatFixture(profile), sim = WorldSimulation.create(f.model), action = f.source.instructions.find(i => i.opcode === 14)!;
    sim.admitCommands([attack(1, 3, 0)]);
    sim.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: 0 });
    const old = sim.step(); assert(old.events.some(e => e.kind === 'not-owner')); assert(!old.events.some(e => e.kind === 'fired'));
    sim.admitCommands([attack(1, 3, 1, 0, 1), attack(1, 2, 1, 1, 1)]);
    const step = sim.step(); assert(step.events.some(e => e.kind === 'illegal-target')); assert(step.events.some(e => e.kind === 'destroyed' && e.entityId === 2));
    const save = sim.save(); assert.equal(save.state.ownership!.counts.find(h => h.playerId === 0)!.registered.infantry, 0);
    assert.equal(WorldSimulation.restore(f.model, save).saveText(), sim.saveText());
  }
});

test('pending death retains population until completion and capture preserves damage-time attribution', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = combatFixture(profile, true), r = new WorldReplayRecorder(f.model);
    r.admitCommands([attack(1, 3, 0)]); r.step();
    const pending = r.save(), action = f.source.instructions.find(i => i.opcode === 36)!;
    assert.equal(pending.state.ownership!.counts.find(h => h.playerId === 1)!.registered.infantry, 1);
    r.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: 0 });
    assert.equal(r.save().state.entities[0]!.owner, 1);
    assert.equal(r.save().state.combat!.deaths![0]!.sourceOwner, 0);
    r.step(2); const completed = r.save();
    assert.equal(completed.state.ownership!.lifecycle[2]!.lethalTick, 1);
    assert.equal(completed.state.ownership!.lifecycle[2]!.removedTick, 3);
    assert.equal(completed.state.ownership!.counts.find(h => h.playerId === 1)!.registered.infantry, 2);
    assert.equal(replayWorld(f.model, r.document()).stateSha256, worldHash(completed));
    const forged = structuredClone(completed); forged.state.combat!.deaths![0]!.sourceOwner = 1;
    assert.throws(() => WorldSimulation.restore(f.model, forged), /death-save-owner/);
    const premature = structuredClone(pending); premature.state.ownership!.lifecycle[2]!.removedTick = 1;
    assert.throws(() => WorldSimulation.restore(f.model, premature), /world-ownership-counts/);
  }
});


test('missing current-trigger house remains null and is not replaced by the source owner', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), r = new WorldReplayRecorder(f.model), action = f.source.instructions.find(i => i.opcode === 36)!;
    const result = r.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: null });
    assert.deepEqual(result.changedEntityIds, [1, 2]);
    assert.equal(r.save().state.ownership!.transfers[0]!.triggerHouse, null);
    assert.equal(replayWorld(f.model, r.document()).stateSha256, worldHash(r.save()));
    assert.deepEqual(WorldSimulation.restore(f.model, r.save()).save(), r.save());
  }
});
