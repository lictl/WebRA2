// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound motion/reservation fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { infantryPassageFixture, infantryRow } from './infantry-passage-fixture.ts';
import { bindInfantryPassageWorld } from '../../packages/sim/src/world-infantry-passage.ts';
import { createWorldModel, worldPosition, type WorldModel } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation, type WorldSave } from '../../packages/sim/src/world.ts';
import { WorldReplayRecorder, replayWorld } from '../../packages/sim/src/world-replay.ts';
const at = (x: number, y: number) => x + y * 512;
const move = (tick: number, sequence: number, id: number, x: number, y: number, playerId = 0) =>
  ({ schemaVersion: 1, tick, playerId, sequence, kind: 'move', payload: { entityId: id, x, y } });
const stop = (tick: number, sequence: number, id: number) =>
  ({ schemaVersion: 1, tick, playerId: 0, sequence, kind: 'stop', payload: { entityId: id } });
const modelInput = (m: WorldModel) => ({ contentIdentity: m.contentIdentity, sourceSha256: m.sourceSha256, definitionsSha256: m.definitionsSha256,
  entities: m.entities, navigation: m.navigation, blocked: m.blocked.map(worldPosition), footprints: m.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })) });

test('genuine passage binds the entire base with a new save policy while old worlds retain exact whole-cell behavior', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = infantryPassageFixture({ profile }), m = bindInfantryPassageWorld(f.catalog, f.world.model), r = new WorldReplayRecorder(m);
    const old = WorldSimulation.create(f.world.model).save();
    assert.equal(old.engineVersion, 'webra2-world-1'); assert.equal(r.save().engineVersion, 'webra2-world-7'); assert.notEqual(m.sha256, f.world.model.sha256);
    assert.deepEqual(m.entities, f.world.model.entities); assert.deepEqual(m.footprints, f.world.model.footprints);
    assert.throws(() => WorldSimulation.restore(m, old), /version/); assert.throws(() => WorldSimulation.restore(f.world.model, r.save()), /version/);
    assert.throws(() => bindInfantryPassageWorld({ ...f.catalog }, f.world.model), /brand/);
    assert.throws(() => bindInfantryPassageWorld(new Proxy(f.catalog, {}), f.world.model), /brand/);
    assert.throws(() => bindInfantryPassageWorld(f.catalog, m), /already-bound/);
    assert.throws(() => createWorldModel({ ...modelInput(m), entities: m.entities.map(e => e.id === 1 ? { ...e, maximumHealth: 200 } : e), infantryPassage: f.catalog }), /join/);
    r.admitCommands([move(0, 0, 1, 2, 3)]); r.step(); const pending = r.save();
    assert(pending.state.entities[0]!.progress > 0); assert.equal(pending.state.infantrySlots![0]!.reservedSubcell, 2);
    const restored = WorldSimulation.restore(m, pending); assert.deepEqual(restored.step(), r.step()); assert.deepEqual(restored.save(), r.save());
    assert.deepEqual(r.save().state.entities[0], { ...r.save().state.entities[1], id: 1 });
    assert.deepEqual(r.save().state.infantrySlots!.map(s => [s.subcell, s.reservedSubcell]), [[2, null], [4, null]]);
    assert.deepEqual(replayWorld(m, r.document()).simulation.save(), r.save());
    const legacy = WorldSimulation.create(f.world.model); legacy.admitCommands([move(0, 0, 1, 2, 3)]); legacy.step(8);
    assert.deepEqual([legacy.save().state.entities[0]!.x, legacy.save().state.entities[0]!.y], [2, 2]);
  }
});

test('Stop releases only the in-flight slot and retarget finishes its reserved edge before replanning', () => {
  for (const profile of ['ra2', 'yr'] as const) for (const stopping of [true, false]) {
    const f = infantryPassageFixture({ profile }), m = bindInfantryPassageWorld(f.catalog, f.world.model), r = new WorldReplayRecorder(m);
    r.admitCommands([move(0, 0, 1, 2, 3)]); r.step();
    r.admitCommands([stopping ? stop(1, 1, 1) : move(1, 1, 1, 3, 3)]);
    const checkpoint = r.save(), restored = WorldSimulation.restore(m, checkpoint);
    for (let i = 0; i < 8; i++) { assert.deepEqual(restored.step(), r.step()); assert.deepEqual(restored.save(), r.save()); }
    const e = r.save().state.entities[0]!; assert.deepEqual([e.x, e.y], stopping ? [2, 2] : [3, 3]);
    assert.equal(r.save().state.infantrySlots![0]!.reservedSubcell, null); assert.deepEqual(replayWorld(m, r.document()).simulation.save(), r.save());
  }
});

test('stable concurrent reservations choose distinct slots and a fourth arrival remains blocked', () => {
  const f = infantryPassageFixture({ rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 2), infantryRow(2, 3, 2, 2), infantryRow(3, 4, 3, 2)] });
  const m = bindInfantryPassageWorld(f.catalog, f.world.model), r = new WorldReplayRecorder(m);
  r.admitCommands([1, 2, 3, 4].map(id => move(0, id - 1, id, 3, 3)));
  for (let i = 0; i < 10; i++) { const s = WorldSimulation.restore(m, r.save()); assert.deepEqual(s.step(), r.step()); assert.deepEqual(s.save(), r.save()); }
  const final = r.save(), arrivals = final.state.entities.filter(e => at(e.x, e.y) === at(3, 3));
  assert.equal(arrivals.length, 3); assert.equal(new Set(final.state.infantrySlots!.filter(s => arrivals.some(e => e.id === s.entityId)).map(s => s.subcell)).size, 3);
  assert.deepEqual(replayWorld(m, r.document()).simulation.save(), final);
});

test('one-way allies permit only mover-directed admission; unsupported slots and unknown relations stay blocked', () => {
  for (const direction of [0, 1]) {
    const f = infantryPassageFixture({ rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 4, 'Rival')] });
    const m = bindInfantryPassageWorld(f.catalog, f.world.model), r = new WorldReplayRecorder(m);
    r.admitCommands([direction ? move(0, 0, 2, 2, 2, 1) : move(0, 0, 1, 2, 3)]); r.step(8);
    const e = r.save().state.entities[direction]!; assert.deepEqual([e.x, e.y], [2, 3]);
    assert.deepEqual(replayWorld(m, r.document()).simulation.save(), r.save());
  }
  for (const unsupported of [true, false]) {
    const f = infantryPassageFixture({ allies: 'Unknown', rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, unsupported ? 0 : 4, 'Rival')] });
    const m = bindInfantryPassageWorld(f.catalog, f.world.model), s = WorldSimulation.create(m); s.admitCommands([move(0, 0, 1, 2, 3)]); s.step(8);
    assert.deepEqual([s.save().state.entities[0]!.x, s.save().state.entities[0]!.y], [2, 2]);
  }
});

test('malformed, colliding and injected retirement saves reject without changing live pending state', () => {
  const f = infantryPassageFixture(), m = bindInfantryPassageWorld(f.catalog, f.world.model), s = WorldSimulation.create(m);
  s.admitCommands([move(0, 0, 1, 2, 3)]); s.step(); const original = s.saveText();
  for (const mutate of [
    (v: WorldSave) => { v.state.infantrySlots = []; },
    (v: WorldSave) => { v.state.infantrySlots!.reverse(); },
    (v: WorldSave) => { v.state.infantrySlots![0]!.reservedSubcell = 4; },
    (v: WorldSave) => { v.state.infantrySlots![0]!.reservedSubcell = null; },
    (v: WorldSave) => { (v.state as unknown as Record<string, unknown>).retiredEntityIds = [2]; },
    (v: WorldSave) => { delete v.state.infantrySlots; },
    (v: WorldSave) => { v.state.entities[0]!.route = [at(2, 2), at(4, 3)]; },
  ]) { const v = s.save(); mutate(v); assert.throws(() => WorldSimulation.restore(m, v)); assert.equal(s.saveText(), original); }
  assert.throws(() => s.step(2, 0), /work-limit/); assert.equal(s.saveText(), original);
});

test('source infantry combat and passage independently authenticate the same original world and preserve shots/death/replay', async () => {
  const { ordinaryFixtureSource } = await import('./ordinary-infantry-fixture.ts');
  const { compileOrdinaryInfantryBridge } = await import('../../packages/sim/src/ordinary-infantry-bridge.ts');
  const { bindOrdinaryInfantryWorld } = await import('../../packages/sim/src/source-infantry-world.ts');
  const { compileInfantryPassageCatalog } = await import('../../packages/sim/src/infantry-passage-catalog.ts');
  for (const profile of ['ra2', 'yr'] as const) {
    const { rules, mission, ...f } = ordinaryFixtureSource({ profile, subcells: true, ground: true }), bridge = compileOrdinaryInfantryBridge(f), catalog = compileInfantryPassageCatalog({ world: f.world, definitions: f.definitions, actors: f.actors, rules, mission });
    const combat = bindOrdinaryInfantryWorld(bridge, f.world.model), m = bindInfantryPassageWorld(catalog, combat), r = new WorldReplayRecorder(m);
    assert.equal(m.combat, combat.combat); assert.equal(m.infantryPassage, catalog); assert.equal(m.infantryPassage.actors.filter(a => a.status === 'ordinary-slots').length, 2);
    const other = ordinaryFixtureSource({ profile, subcells: true, ground: false });
    assert.throws(() => bindInfantryPassageWorld(compileInfantryPassageCatalog({ world: other.world, definitions: other.definitions, actors: other.actors, rules: other.rules, mission: other.mission }), combat), /join/);
    assert.throws(() => createWorldModel({ ...modelInput(m), entities: m.entities.map(e => e.id === 1 ? { ...e, initialHealth: 99 } : e), combat: m.combat!, infantryPassage: catalog }), /join/);
    r.admitCommands([{ schemaVersion: 1, tick: 0, sequence: 0, playerId: 0, kind: 'attack', payload: { entityId: 1, targetId: 2 } }]);
    for (let i = 0; i < 100; i++) { const restored = WorldSimulation.restore(m, r.save()); assert.deepEqual(restored.step(), r.step()); assert.deepEqual(restored.save(), r.save()); }
    const final = r.save(); assert.equal(final.state.entities[1]!.health, 0); assert.notEqual(final.state.combat!.deaths![0]!.corpseIndex, null);
    assert.deepEqual(final.state.infantrySlots, [{ entityId: 1, subcell: 2, reservedSubcell: null }, { entityId: 2, subcell: 4, reservedSubcell: null }]);
    assert.deepEqual(replayWorld(m, r.document()).simulation.save(), final);
  }
});

test('a lethal hit in settled sharing preserves other slots, cancels an incoming edge and releases only the completed death', async () => {
  const { createCombatModel, combatFactor } = await import('../../packages/sim/src/combat-model.ts');
  const { createOrdinaryCombatRules } = await import('../../packages/sim/src/ordinary-combat-rules.ts');
  const { createOrdinaryDeathRules } = await import('../../packages/sim/src/ordinary-death-rules.ts');
  for (const profile of ['ra2', 'yr'] as const) {
    const f = infantryPassageFixture({ profile, rows: [infantryRow(0, 2, 2, 2, 'Rival'), infantryRow(1, 2, 3, 4), infantryRow(2, 3, 3, 2), infantryRow(3, 3, 2, 3)] });
    const actors = f.world.model.entities.map(e => ({ entityId: e.id, armor: 0, layer: 'ground' as const, weapons: e.id === 1 ? ['original:gun'] : [], initialAmmo: -1 }));
    const ordinary = createOrdinaryCombatRules({ seed: 0, actors: actors.map(a => ({ entityId: a.entityId, houseFirepower: 1, actorFirepower: 1, veteranCombat: 1, countryArmor: 1, actorArmor: 1, veteranArmor: 1, houseRof: 0, veteranRof: 0 })), weapons: [{ weaponId: 'original:gun', maxDamage: 1000 }] });
    const ordinaryDeath = createOrdinaryDeathRules({ actors: [{ entityId: 2, corpseAnimationIds: ['original:corpse'], sequence11Ticks: 3, sequence12Ticks: 4 }], weapons: [{ weaponId: 'original:gun', infDeath: 1 }] });
    const combat = createCombatModel({ actors, weapons: [{ id: 'original:gun', damage: 100, range: 2048, minimumRange: 0, reloadTicks: 1, burst: 1, burstDelayTicks: 1, delivery: 'instant', speed: 0, ground: true, air: false, verses: Array.from({ length: 11 }, () => combatFactor(1)) }], allies: [], ordinary, ordinaryDeath });
    const m = bindInfantryPassageWorld(f.catalog, createWorldModel({ ...modelInput(f.world.model), combat })), r = new WorldReplayRecorder(m);
    r.admitCommands([move(0, 0, 3, 2, 3)]); r.step(2); assert.deepEqual([r.save().state.entities[2]!.x, r.save().state.entities[2]!.y], [2, 3]);
    r.admitCommands([move(2, 1, 4, 2, 3), { schemaVersion: 1, tick: 2, sequence: 0, playerId: 1, kind: 'attack', payload: { entityId: 1, targetId: 2 } }]);
    const result = r.step(); assert(result.events.some(e => e.kind === 'infantry-dying-blocked' && e.entityId === 4));
    const pending = r.save(); assert.equal(pending.state.entities[1]!.health, 0); assert.equal(pending.state.entities[3]!.progress, 0); assert.equal(pending.state.infantrySlots![1]!.subcell, 4);
    assert.deepEqual([pending.state.entities[2]!.x, pending.state.entities[2]!.y], [2, 3]); assert.equal(pending.state.infantrySlots![2]!.subcell, 2);
    for (let i = 0; i < 20; i++) { const restored = WorldSimulation.restore(m, r.save()); assert.deepEqual(restored.step(), r.step()); assert.deepEqual(restored.save(), r.save()); }
    assert.notEqual(r.save().state.combat!.deaths![0]!.corpseIndex, null); assert.deepEqual([r.save().state.entities[3]!.x, r.save().state.entities[3]!.y], [2, 3]);
    assert.deepEqual(replayWorld(m, r.document()).simulation.save(), r.save());
  }
});
