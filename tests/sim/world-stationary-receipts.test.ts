// SPDX-License-Identifier: GPL-3.0-or-later
// Original lazy provenance checks; no native mission-state authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseFixture } from './mission-house-fixture.ts';
import { createWorldModel, worldPosition, worldHash } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation, readWorldStationaryBoundary, readWorldStationaryOperation, worldStationaryBoundaryHash } from '../../packages/sim/src/world.ts';
function fixture(profile: 'ra2' | 'yr') {
  const f = houseFixture({ profile }), b = f.world.model;
  return { ...f, model: createWorldModel({ contentIdentity: b.contentIdentity, sourceSha256: b.sourceSha256,
    definitionsSha256: b.definitionsSha256, entities: b.entities, navigation: b.navigation, blocked: b.blocked.map(worldPosition),
    footprints: b.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: f.source }) };
}
test('lazy receipts join exact private boundaries and retain owned commands after caller mutation', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), world = WorldSimulation.create(f.model), initial = readWorldStationaryBoundary(world), saved = world.save();
    const commands = world.admitCommands([{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 1, x: 3, y: 2 } }]);
    commands.length = 0;
    const admitted = readWorldStationaryOperation(f.model, commands);
    assert.equal(admitted.fromBoundary, initial.boundary);
    assert.equal(admitted.toBoundary, readWorldStationaryBoundary(world).boundary);
    assert.equal(admitted.input.kind, 'commands');
    if (admitted.input.kind === 'commands') assert.equal(admitted.input.commands.length, 1);
    assert.deepEqual(admitted.invalidated, [{ entityId: 1, reason: 'command' }]);
    const step = world.step(), stepped = readWorldStationaryOperation(f.model, step);
    assert.equal(stepped.fromBoundary, admitted.toBoundary);
    assert(stepped.invalidated.some(a => a.entityId === 1 && a.reason === 'movement'));
    const restored = readWorldStationaryBoundary(WorldSimulation.restore(f.model, saved));
    assert.notEqual(restored.boundary, initial.boundary);
    assert.equal(worldStationaryBoundaryHash(f.model, initial.boundary).sha256, worldHash(saved));
    assert.deepEqual(worldStationaryBoundaryHash(f.model, restored.boundary), worldStationaryBoundaryHash(f.model, initial.boundary));
    assert.equal(worldStationaryBoundaryHash(f.model, initial.boundary).sha256, worldHash(saved));
    const action = f.source.instructions.find(i => i.opcode === 36)!;
    const transfer = world.transferOwnership({ instructionId: action.instructionId, sourceHouse: 0, triggerHouse: null });
    const changed = readWorldStationaryOperation(f.model, transfer);
    assert.equal(changed.fromBoundary, stepped.toBoundary);
    assert.deepEqual(changed.transferred, [{ entityId: 1, revision: 1 }, { entityId: 2, revision: 1 }]);
    assert.equal(worldStationaryBoundaryHash(f.model, changed.toBoundary).sha256, worldHash(world.save()));
  }
});
test('copied receipt/token/model and insufficient work cannot certify a world boundary', () => {
  const f = fixture('yr'), world = WorldSimulation.create(f.model), step = world.step();
  const result = readWorldStationaryOperation(f.model, step), state = world.saveText();
  assert.deepEqual(readWorldStationaryOperation(f.model, step, result.work), result);
  assert.throws(() => readWorldStationaryOperation(f.model, step, result.work - 1), /stationary-work/);
  for (const fake of [{ ...step }, structuredClone(step), new Proxy(step, {})]) assert.throws(() => readWorldStationaryOperation(f.model, fake), /stationary-receipt/);
  assert.throws(() => readWorldStationaryOperation(f.world.model, step), /stationary-receipt/);
  const boundary = readWorldStationaryBoundary(world).boundary, hash = worldStationaryBoundaryHash(f.model, boundary);
  assert.deepEqual(worldStationaryBoundaryHash(f.model, boundary, hash.work), hash);
  assert.throws(() => worldStationaryBoundaryHash(f.model, boundary, hash.work - 1), /stationary-work/);
  assert.throws(() => worldStationaryBoundaryHash(f.model, { ...boundary }), /stationary-boundary/);
  assert.throws(() => worldStationaryBoundaryHash(f.world.model, boundary), /stationary-boundary/);
  assert.equal(world.saveText(), state);
});
