// SPDX-License-Identifier: GPL-3.0-or-later
// Original world/population composition; no native runtime or mission-dispatch claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { constructorFixture, constructorBirths } from './mission-team-constructor-fixture.ts';
import { createMissionTeamCheckpoint, admitMissionTeamInput, stepMissionTeamWorld } from '../../packages/sim/src/mission-team-runtime.ts';
import { restoreMissionTeamConstructorHistory, missionTeamConstructorHistoryData } from '../../packages/sim/src/mission-team-constructor-history.ts';
import type { MissionTeamConstructorBirth } from '../../packages/sim/src/mission-team-constructor-types.ts';
import { createWorldModel, worldPosition, worldHash } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { appendWorldOwnership, restoreWorldOwnership, worldOwnershipAtRevision, worldOwnershipOwnerAt } from '../../packages/sim/src/world-ownership.ts';
const profiles = ['ra2', 'yr'] as const;
function fixture(profile: 'ra2' | 'yr') {
  const f = constructorFixture(profile, '', undefined, false, { transfers: true }), base = f.world.model;
  const initial = admitMissionTeamInput(f.runtime, createMissionTeamCheckpoint(f.runtime), { requests: [f.receipt(1, 0)], commands: [] });
  const result = stepMissionTeamWorld(f.runtime, stepMissionTeamWorld(f.runtime, initial).checkpoint);
  const birth = constructorBirths(result.checkpoint.history)[0]!;
  const model = (births: readonly MissionTeamConstructorBirth[] = []) => {
    const construction = restoreMissionTeamConstructorHistory(f.catalog, births), data = missionTeamConstructorHistoryData(construction);
    return createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256, definitionsSha256: base.definitionsSha256,
      entities: [...base.entities, ...data.entities], navigation: base.navigation, blocked: base.blocked.map(worldPosition),
      footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: f.input.houses, construction });
  };
  const transfers = f.input.houses.instructions.filter(i => i.kind === 'action' && i.opcode === 36);
  const invocation = (index: number, sourceHouse = 0) => ({ instructionId: transfers[index]!.instructionId, sourceHouse, triggerHouse: null });
  return { ...f, birth, model, invocation };
}
test('genuine empty construction capability appends an actual owned unit and source population at one boundary', () => {
  for (const profile of profiles) {
    const f = fixture(profile), initial = f.model(), previous = WorldSimulation.create(initial); previous.step();
    const before = previous.saveText(), next = f.model([f.birth]), result = WorldSimulation.migrateConstruction(previous, next), save = result.world.save();
    assert.equal(save.engineVersion, 'webra2-world-9'); assert.equal(save.nextTick, 1);
    assert.equal(previous.saveText(), before); assert.equal(save.state.entities.length, 3);
    assert.equal(save.state.entities[2]!.owner, 0); assert.equal(save.state.entities[2]!.health, 110);
    assert.equal(save.state.ownership!.counts[0]!.registered.unit, 1);
    assert.equal(save.state.ownership!.counts[0]!.present.unit, profile === 'ra2' ? 0 : 1);
    assert.equal(WorldSimulation.restore(next, save).saveText(), result.world.saveText());
    assert.throws(() => WorldSimulation.create(next));
    assert.throws(() => WorldSimulation.restore(initial, save));
    assert(Object.isFrozen(result)); assert(result.work > 0);
  }
});
test('same-tick transfers bracket birth registration and preserve exact later change-back history', () => {
  for (const profile of profiles) {
    const f = fixture(profile), initial = f.model(), previous = WorldSimulation.create(initial); previous.step();
    previous.transferOwnership(f.invocation(0));
    const birth = { ...f.birth, ownershipRevision: 1 }, next = f.model([birth]), migrated = WorldSimulation.migrateConstruction(previous, next).world;
    assert.deepEqual(migrated.save().state.entities.map(e => e.owner), [1, 1, 0]);
    assert.deepEqual(migrated.transferOwnership(f.invocation(0)).entityIds, [3]);
    assert.deepEqual(migrated.transferOwnership(f.invocation(1, 1)).entityIds, [1, 2, 3]);
    const save = migrated.save(), ownership = restoreWorldOwnership(next, save.state.ownership, save.state.entities, save.nextTick);
    assert.deepEqual(worldOwnershipAtRevision(next, ownership, 3, 1), { owner: 0, lastChangeRevision: 1 });
    assert.deepEqual(worldOwnershipAtRevision(next, ownership, 3, 2), { owner: 1, lastChangeRevision: 2 });
    assert.deepEqual(worldOwnershipAtRevision(next, ownership, 3, 3), { owner: 0, lastChangeRevision: 3 });
    assert.throws(() => worldOwnershipAtRevision(next, ownership, 3, 0), /before-birth/);
    assert.throws(() => worldOwnershipOwnerAt(next, ownership, 3, 0), /before-birth/);
    assert.equal(worldOwnershipOwnerAt(next, ownership, 3, 1), 0);
    assert.equal(WorldSimulation.restore(next, save).saveText(), migrated.saveText());
    const omitted = structuredClone(save); omitted.state.ownership!.transfers[1]!.entityIds = [];
    assert.throws(() => WorldSimulation.restore(next, omitted), /transfer-selection/);
    const wrongRevision = f.model([{ ...birth, ownershipRevision: 0 }]);
    assert.throws(() => restoreWorldOwnership(wrongRevision, save.state.ownership, save.state.entities, save.nextTick), /transfer-selection/);
  }
});
test('constructor migration rejects wrong birth boundaries and invalid new states without changing its source', () => {
  for (const profile of profiles) {
    const f = fixture(profile), initial = f.model(), previous = WorldSimulation.create(initial); previous.step();
    const before = previous.saveText();
    for (const patch of [{ bornAtTick: 0 }, { bornAtTick: 2 }, { ownershipRevision: 1 }])
      assert.throws(() => WorldSimulation.migrateConstruction(previous, f.model([{ ...f.birth, ...patch }])));
    assert.equal(previous.saveText(), before);
    const next = f.model([f.birth]), result = WorldSimulation.migrateConstruction(previous, next), state = result.world.save().state;
    const changed = structuredClone(state.entities); changed[2]!.owner = 1;
    assert.throws(() => appendWorldOwnership(initial, next, previous.save().state, changed, 1), /construction-initial/);
    changed[2]!.owner = 0; changed[0]!.x++;
    assert.throws(() => appendWorldOwnership(initial, next, previous.save().state, changed, 1), /construction-state/);
    const count = structuredClone(result.world.save()); Object.assign(count.state.ownership!.counts[0]!.registered, { unit: 0 });
    assert.throws(() => WorldSimulation.restore(next, count), /ownership-counts/);
    const premature = structuredClone(result.world.save()); premature.state.entities[2]!.health = 0;
    premature.state.ownership!.lifecycle[2]!.lethalTick = 1; premature.state.ownership!.lifecycle[2]!.removedTick = 1;
    assert.throws(() => WorldSimulation.restore(next, premature));
    assert.equal(previous.saveText(), before);
  }
});
test('appended ownership owns descriptors and enforces its exact sufficient work boundary', () => {
  for (const profile of profiles) {
    const f = fixture(profile), initial = f.model(), previous = WorldSimulation.create(initial); previous.step();
    const next = f.model([f.birth]), result = WorldSimulation.migrateConstruction(previous, next), entities = result.world.save().state.entities, state = previous.save().state;
    const append = appendWorldOwnership(initial, next, state, entities, 1), before = worldHash([state, entities]);
    assert.deepEqual(appendWorldOwnership(initial, next, state, entities, 1, append.work), append);
    assert.throws(() => appendWorldOwnership(initial, next, state, entities, 1, append.work - 1), /ownership-work/);
    let gets = 0;
    const proxy = new Proxy(entities, { get() { gets++; throw Error('get'); } });
    assert.deepEqual(appendWorldOwnership(initial, next, state, proxy, 1), append); assert.equal(gets, 0);
    assert.throws(() => appendWorldOwnership(initial, next, { ...state, get ownership() { gets++; return state.ownership!; } }, entities, 1));
    assert.equal(gets, 0); assert.equal(worldHash([state, entities]), before);
  }
});
