// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-derived construction transactions and adversarial joins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { constructorFixture, constructorBirths } from './mission-team-constructor-fixture.ts';
import { createMissionTeamCheckpoint, admitMissionTeamInput, stepMissionTeamWorld } from '../../packages/sim/src/mission-team-runtime.ts';
import { restoreMissionTeamConstructorHistory, missionTeamConstructorHistoryData } from '../../packages/sim/src/mission-team-constructor-history.ts';
import { createWorldModel, worldPosition } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation, readWorldConstructionMigration, readWorldStationaryBoundary, worldStationaryBoundaryHash } from '../../packages/sim/src/world.ts';
import type { MissionTeamConstructorBirth } from '../../packages/sim/src/mission-team-constructor-types.ts';
import { createCombatModel, combatFactor } from '../../packages/sim/src/combat-model.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
import { compileInfantryPassageCatalog } from '../../packages/sim/src/infantry-passage-catalog.ts';
import { createInfantryOccupancy } from '../../packages/sim/src/infantry-passage-occupancy.ts';
import { restoreWorldOwnership } from '../../packages/sim/src/world-ownership.ts';

function fixture(profile: 'ra2' | 'yr') {
  const f = constructorFixture(profile), base = f.world.model;
  let checkpoint = admitMissionTeamInput(f.runtime, createMissionTeamCheckpoint(f.runtime), { requests: [f.receipt(1, 0)], commands: [] });
  for (let n = 0; n < 2; n++) checkpoint = stepMissionTeamWorld(f.runtime, checkpoint).checkpoint;
  const birth = constructorBirths(checkpoint.history)[0]!;
  const input = (births: readonly MissionTeamConstructorBirth[] = []) => {
    const construction = restoreMissionTeamConstructorHistory(f.catalog, births), data = missionTeamConstructorHistoryData(construction);
    return { contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256, definitionsSha256: base.definitionsSha256,
      entities: [...base.entities, ...data.entities], navigation: base.navigation, blocked: base.blocked.map(worldPosition),
      footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: f.input.houses, construction };
  };
  return { ...f, birth, input };
}

test('constructed model proves the entire original world and exact source-derived unit prefix', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), input = f.input([f.birth]);
    const model = createWorldModel(input);
    assert.equal(model.construction, input.construction);
    assert.equal(model.initialSharedCells, f.world.model.initialSharedCells);
    for (const patch of [
      { construction: { ...input.construction } }, { ownership: undefined },
      { sourceSha256: '0'.repeat(64) }, { definitionsSha256: '0'.repeat(64) },
      { navigation: input.navigation.map(n => ({ ...n, costScale: n.costScale + 1 })) },
      { entities: input.entities.map((e, i) => i ? e : { ...e, owner: 1 }) },
      { entities: input.entities.map((e, i) => i === input.entities.length - 1 ? { ...e, maximumHealth: 111 } : e) },
      { entities: input.entities.slice(0, -1) },
    ]) assert.throws(() => createWorldModel({ ...input, ...patch } as typeof input));
    assert.throws(() => WorldSimulation.create(model), /requires-migration/);
  }
});

test('migration is atomic at the exact work limit and preserves active movement and queued orders', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), initial = createWorldModel(f.input()), next = createWorldModel(f.input([f.birth]));
    const world = WorldSimulation.create(initial);
    world.admitCommands([{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 1, x: 2, y: 4 } }]);
    world.step();
    world.admitCommands([{ schemaVersion: 1, tick: 5, playerId: 0, sequence: 1, kind: 'stop', payload: { entityId: 1 } }]);
    const before = world.save(), beforeText = world.saveText(), result = WorldSimulation.migrateConstruction(world, next);
    assert.deepEqual(result.world.save().state.entities.slice(0, 2), before.state.entities);
    assert.deepEqual(result.world.save().queuedCommands, before.queuedCommands);
    assert.deepEqual(result.world.save().state.admissionCursors, before.state.admissionCursors);
    assert.equal(WorldSimulation.migrateConstruction(world, next, result.work).world.saveText(), result.world.saveText());
    assert.throws(() => WorldSimulation.migrateConstruction(world, next, result.work - 1), /construction-work/);
    assert.equal(world.saveText(), beforeText);
    for (const fake of [{ ...world }, new Proxy(world, {})]) assert.throws(() => WorldSimulation.migrateConstruction(fake as WorldSimulation, next), /world-instance/);
    assert.throws(() => WorldSimulation.migrateConstruction(result.world, next), /construction-prefix/);
    const restored = WorldSimulation.restore(next, JSON.parse(result.world.saveText()));
    for (let n = 0; n < 8; n++) { assert.deepEqual(restored.step(), result.world.step()); assert.equal(restored.saveText(), result.world.saveText()); }
  }
});

test('a future actor command or occupied birth cell cannot gain authority through migration', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), combat = createCombatModel({ allies: [],
      weapons: [{ id: 'original:gun', damage: 1, range: 2048, minimumRange: 0, reloadTicks: 2, burst: 1, burstDelayTicks: 1,
        delivery: 'instant', speed: 0, ground: true, air: false, verses: Array.from({ length: 11 }, () => combatFactor(1)) }],
      actors: f.world.model.entities.map(e => ({ entityId: e.id, armor: 0, layer: 'ground', weapons: ['original:gun'], initialAmmo: -1 })) });
    const initial = createWorldModel({ ...f.input(), combat }), next = createWorldModel({ ...f.input([f.birth]), combat });
    for (const order of [
      { kind: 'move', payload: { entityId: 3, x: 4, y: 3 } },
      { kind: 'attack', payload: { entityId: 1, targetId: 3 } },
    ]) {
      const world = WorldSimulation.create(initial); world.step();
      world.admitCommands([{ schemaVersion: 1, tick: 4, playerId: 0, sequence: 0, ...order }]);
      const before = world.saveText();
      assert.throws(() => WorldSimulation.migrateConstruction(world, next), /queued-actor/);
      assert.equal(world.saveText(), before);
    }
    const world = WorldSimulation.create(initial); world.step();
    const actor = f.world.model.entities[0]!, collided = createWorldModel({ ...f.input([{ ...f.birth,
      actors: [{ ...f.birth.actors[0]!, x: actor.x, y: actor.y }] }]), combat });
    const before = world.saveText();
    assert.throws(() => WorldSimulation.migrateConstruction(world, collided), /anchor-overlap/);
    assert.equal(world.saveText(), before);
  }
});

test('appended units participate in the full passage index without receiving source slot permissions', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), actors = compileCombatActors({ definitions: f.definitions, rules: f.rules, mission: f.mission });
    const infantryPassage = compileInfantryPassageCatalog({ world: f.world, definitions: f.definitions, actors, rules: f.rules, mission: f.mission });
    const initial = createWorldModel({ ...f.input(), infantryPassage }), next = createWorldModel({ ...f.input([f.birth]), infantryPassage });
    const world = WorldSimulation.create(initial); world.step();
    const migrated = WorldSimulation.migrateConstruction(world, next).world, save = migrated.save();
    assert.equal(save.state.infantrySlots!.length, world.save().state.infantrySlots!.length);
    const ownership = restoreWorldOwnership(next, save.state.ownership, save.state.entities, save.nextTick);
    const index = createInfantryOccupancy(infantryPassage, { entities: save.state.entities, infantrySlots: save.state.infantrySlots!, retiredEntityIds: [] }, ownership);
    assert.equal(index.choose(3, 2051).reason, 'unsupported-actor'); assert.equal(index.indexedClaims, 3);
    assert.throws(() => WorldSimulation.migrateConstruction(world, createWorldModel(f.input([f.birth]))), /construction-prefix/);
    const forged = structuredClone(save); forged.state.infantrySlots!.push({ entityId: 3, subcell: 2, reservedSubcell: null });
    assert.throws(() => WorldSimulation.restore(next, forged), /slot-entity-order/);
    migrated.admitCommands([{ schemaVersion: 1, tick: 1, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 3, x: 4, y: 3 } }]);
    const restored = WorldSimulation.restore(next, migrated.save());
    for (let n = 0; n < 4; n++) { assert.deepEqual(restored.step(), migrated.step()); assert.equal(restored.saveText(), migrated.saveText()); }
    assert.equal(migrated.save().state.entities[2]!.x, 4);
  }
});

test('only genuine migrations expose stable source histories and lazy before/after boundaries', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), initial = createWorldModel(f.input()), next = createWorldModel(f.input([f.birth]));
    const world = WorldSimulation.create(initial); world.step();
    const before = readWorldStationaryBoundary(world), beforeHash = worldStationaryBoundaryHash(initial, before.boundary);
    const result = WorldSimulation.migrateConstruction(world, next), after = readWorldStationaryBoundary(result.world);
    const afterHash = worldStationaryBoundaryHash(next, after.boundary), facts = readWorldConstructionMigration(result);
    assert.equal(facts.previousModel, initial); assert.equal(facts.model, next);
    assert.equal(facts.fromBoundary, before.boundary); assert.equal(facts.toBoundary, after.boundary);
    assert.equal(facts.source, f.catalog); assert.equal(facts.history, next.construction);
    assert.deepEqual(facts.births, [f.birth]); assert.equal(facts.fromNextTick, 1); assert.equal(facts.toNextTick, 1);
    assert(Object.isFrozen(facts)); assert(Object.isFrozen(facts.births)); assert(Object.isFrozen(facts.births[0]!.actors));
    assert.deepEqual(readWorldConstructionMigration(result, facts.work), facts);
    assert.throws(() => readWorldConstructionMigration(result, facts.work - 1), /construction-work/);
    for (const fake of [{ ...result }, { world: result.world, work: result.work }, new Proxy(result, {})])
      assert.throws(() => readWorldConstructionMigration(fake), /construction-receipt/);
    world.step(); result.world.step(2);
    assert.deepEqual(readWorldConstructionMigration(result), facts);
    assert.deepEqual(worldStationaryBoundaryHash(initial, facts.fromBoundary), beforeHash);
    assert.deepEqual(worldStationaryBoundaryHash(next, facts.toBoundary), afterHash);
    assert.throws(() => worldStationaryBoundaryHash(next, facts.fromBoundary), /stationary-boundary/);
  }
});
