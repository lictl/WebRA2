// SPDX-License-Identifier: GPL-3.0-or-later
// Original source/geometry fixtures. No game executable, native saved state or playback.
import test from 'node:test';
import { spatialAudioFixture as fixture } from './mission-spatial-audio-fixture.ts';
import assert from 'node:assert/strict';
import { compileMissionSpatialAudioSource, isMissionSpatialAudioSource, resolveMissionSpatialAudioTarget } from '../../packages/sim/src/mission-spatial-audio-source.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { worldHash } from '../../packages/sim/src/world-model.ts';


const objects = (health = 256, duplicate = false) => ({
  infantryRows: '', extraRules: '[BuildingTypes]\n0=Hub\n[TerrainTypes]\n0=Tree\n[Hub]\nStrength=100\n[Tree]\nName=Original\n',
  extraArt: '[Hub]\nFoundation=1x1\n[Tree]\nFoundation=1x1\n',
  extraMap: `[Structures]\n0=Commander,Hub,${health},3,3,0,None,0,0,1,0,0,None,None,None,0,0\n${duplicate ? '1=Rival,Hub,256,3,3,0,None,0,0,1,0,0,None,None,None,0,0\n' : ''}[Terrain]\n3003=Tree\n`,
});

test('both spatial instructions retain exact source and share flat initial-map coordinates', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const s = await fixture(profile);
    assert.deepEqual(s.spatial.diagnostics, []); assert(isMissionSpatialAudioSource(s.spatial));
    assert(!isMissionSpatialAudioSource({ ...s.spatial }));
    assert.deepEqual(s.spatial.instructions.map(i => [i.opcode, i.soundIndex]), [[99, 0], [116, null]]);
    assert.equal(s.spatial.instructions[1]!.parameters[1], '688');
    const world = WorldSimulation.create(s.model).save();
    for (const instruction of s.spatial.instructions) {
      assert.deepEqual(instruction.position, { x: 896, y: 896, z: 0 });
      assert.deepEqual(resolveMissionSpatialAudioTarget(s.spatial, s.model, world, instruction.instructionId).target,
        { kind: 'position', x: 896, y: 896, z: 0 });
    }
    assert.equal(s.spatial.canStartCampaign, false);
  }
});

test('source level is signed and TMP height does not alter initial flat coordinates', async () => {
  for (const profile of ['ra2', 'yr'] as const) for (const [level, z] of [[0, 0], [1, 104], [127, 13208], [128, -13311], [255, -103]]) {
    const s = await fixture(profile, { level, tmpHeight: 4 });
    assert.deepEqual(s.spatial.diagnostics, []);
    assert.equal(s.spatial.instructions[0]!.position!.z, z);
    assert.equal(s.spatial.instructions[1]!.position!.z, z);
  }
});

test('unique building precedes terrain and a current removed building falls back to terrain', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const s = await fixture(profile, objects()); assert.deepEqual(s.spatial.diagnostics, []);
    const building = s.model.entities.find(e => e.kind === 'structure')!, tree = s.model.entities.find(e => e.kind === 'terrain')!;
    assert(building); assert(tree);
    const checkpoint = WorldSimulation.create(s.model).save(), instructionId = s.spatial.instructions[0]!.instructionId;
    assert.deepEqual(resolveMissionSpatialAudioTarget(s.spatial, s.model, checkpoint, instructionId).target,
      { kind: 'object', entityId: building.id, family: 'structure' });
    // Component resolver input, not a claimed native death or genuine mission callback.
    const removed = structuredClone(checkpoint); removed.state.entities.find(e => e.id === building.id)!.health = 0;
    const checked = WorldSimulation.restore(s.model, removed).save();
    assert.deepEqual(resolveMissionSpatialAudioTarget(s.spatial, s.model, checked, instructionId).target,
      { kind: 'object', entityId: tree.id, family: 'terrain' });
    assert.equal(checkpoint.state.entities.find(e => e.id === building.id)!.health, 100);
  }
});

test('ramps, overlays and ambiguous native object order remain explicit source gates', async () => {
  for (const [options, reason] of [[{ ramp: 1 }, 'ramp-height'], [{ overlay: 1 }, 'overlay-bridge-context'], [objects(256, true), 'native-object-order']] as const) {
    const s = await fixture('ra2', options);
    assert(s.spatial.instructions.every(i => i.status === 'unsupported' && i.reasons.includes(reason)));
    assert.throws(() => resolveMissionSpatialAudioTarget(s.spatial, s.model, WorldSimulation.create(s.model).save(), s.spatial.instructions[0]!.instructionId), /instruction/);
  }
});

test('source joins and exact work limits cannot grant a stale or partial target', async () => {
  const s = await fixture('ra2'), other = await fixture('ra2', { level: 1 });
  assert.throws(() => compileMissionSpatialAudioSource({ ...s.input, bindings: { ...s.input.bindings } }), /factory/);
  assert.throws(() => compileMissionSpatialAudioSource({ ...s.input, cues: other.input.cues }), /source-join/);
  assert.throws(() => compileMissionSpatialAudioSource(s.input, { instructions: 1 }), /instruction-limit/);
  assert.throws(() => compileMissionSpatialAudioSource(s.input, { work: 0 }), /work-limit/);
  const world = WorldSimulation.create(s.model).save(), before = worldHash(world), id = s.spatial.instructions[0]!.instructionId;
  const result = resolveMissionSpatialAudioTarget(s.spatial, s.model, world, id);
  assert.deepEqual(resolveMissionSpatialAudioTarget(s.spatial, s.model, world, id, result.work), result);
  assert.throws(() => resolveMissionSpatialAudioTarget(s.spatial, s.model, world, id, result.work - 1), /work-limit/);
  assert.throws(() => resolveMissionSpatialAudioTarget({ ...s.spatial }, s.model, world, id), /source-brand/);
  assert.throws(() => resolveMissionSpatialAudioTarget(s.spatial, other.model, WorldSimulation.create(other.model).save(), id), /world-join/);
  assert.equal(worldHash(world), before);
});
