// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature missions. No retail playback or native save assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialAudioFixture } from './mission-spatial-audio-fixture.ts';
import { prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { createWorldModel, worldHash, worldPosition } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { MissionLogic, missionProgramSpatialAudioSource } from '../../packages/sim/src/mission-logic.ts';
import { createMissionActionWorldContext } from '../../packages/sim/src/mission-action-world-context.ts';
import { compileMissionWorld, createMissionWorld, stepMissionWorld, restoreMissionWorld, replayMissionWorld,
  isMissionWorldSpatialAudio } from '../../packages/sim/src/mission-world.ts';
import { resolveMissionSpatialAudioTarget, resolveMissionSpatialAudioInWorld } from '../../packages/sim/src/mission-spatial-audio-source.ts';

const script = (actions: string) => `[Triggers]
Start=Blue,<none>,Spatial,0,1,1,1,0
[Tags]
Shared=2,Spatial,Start
[Events]
Start=1,8,0,0
[Actions]
Start=${actions}`;
const sound = '99,7,Alert,0,0,0,0,A', stop = '116,0,688,0,0,0,0,A';
async function fixture(profile: 'ra2' | 'yr', actions = `2,${sound},${stop}`, houses = false) {
  const f = await spatialAudioFixture(profile, {}, script(actions)), b = f.model;
  const house = houses ? compileMissionHouseSource({ bindings: f.input.bindings, definitions: f.f.definitions, rules: f.f.rules, mission: f.f.mission }) : undefined;
  const world = house ? createWorldModel({ contentIdentity: b.contentIdentity, sourceSha256: b.sourceSha256,
    definitionsSha256: b.definitionsSha256, entities: b.entities, navigation: b.navigation,
    blocked: b.blocked.map(worldPosition), footprints: b.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: house }) : b;
  const prepared = await prepareMissionBindings(f.input.bindings, f.input.cues, undefined, undefined, undefined, f.input.audio,
    { spatialAudioSource: f.spatial, ...(house ? { houseSource: house } : {}) });
  const flags = compileMissionInitialFlags({ bindings: f.input.bindings, bytes: f.f.mission.bytes, initialization: 'new-campaign' });
  assert(prepared.authority, JSON.stringify(prepared));
  const model = compileMissionWorld({ world, bindings: prepared.authority, flags });
  return { ...f, world, prepared, flags, house, compound: model };
}

test('ordered spatial requests use exact targets and survive save/replay without playback authority', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile), initial = createMissionWorld(f.compound), result = stepMissionWorld(f.compound, initial);
    assert.equal(missionProgramSpatialAudioSource(f.prepared.authority!.program), f.spatial);
    const batch = result.spatialAudio!;
    assert(isMissionWorldSpatialAudio(f.compound, batch)); assert(!isMissionWorldSpatialAudio(f.compound, { ...batch }));
    assert.deepEqual(batch.requests.map(r => [r.sequence, r.vmOrder, r.opcode, r.soundIndex, r.playbackAuthorized]), [[0, 1, 99, 0, false], [1, 2, 116, null, false]]);
    assert.deepEqual(batch.requests.map(r => r.target), [{ kind: 'position', x: 896, y: 896, z: 0 }, { kind: 'position', x: 896, y: 896, z: 0 }]);
    assert.deepEqual(result.effects.map(e => [e.opcode, e.kind, e.spatialTarget]), batch.requests.map(r => [r.opcode, 'spatial-audio-request', r.target]));
    assert.equal(result.audio!.requests.length, 0); assert.equal(result.presentation!.requests.length, 0);
    assert.equal(result.checkpoint.spatialAudio!.nextSequence, 2); assert.equal(initial.spatialAudio!.nextSequence, 0);
    assert.deepEqual(restoreMissionWorld(f.compound, result.checkpoint), result.checkpoint);
    const next = stepMissionWorld(f.compound, result.checkpoint);
    assert.deepEqual(next.spatialAudio!.requests.map(r => r.sequence), [2, 3]);
    assert.deepEqual(stepMissionWorld(f.compound, restoreMissionWorld(f.compound, result.checkpoint)), next);
    assert.deepEqual(replayMissionWorld(f.compound, { schemaVersion: 1, modelSha256: f.compound.sha256, initialCheckpoint: initial,
      admissions: [], finalNextTick: 2, finalStateSha256: worldHash(next.checkpoint) }).checkpoint, next.checkpoint);
    assert.equal(batch.nativePlaybackVerified, false); assert.equal(f.compound.canStartCampaign, false);
  }
});

test('house transfers and spatial effects share one ordered private transaction', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, `4,${sound},36,0,1,0,0,0,0,A,${stop},28,0,3,0,0,0,0,A`, true);
    const initial = createMissionWorld(f.compound), step = stepMissionWorld(f.compound, initial);
    assert.deepEqual(step.effects.map(e => e.opcode), [99, 36, 116, 28]);
    assert.deepEqual(step.spatialAudio!.requests.map(r => r.vmOrder), [1, 3]);
    assert.equal(step.checkpoint.world.state.ownership!.transfers.length, 1);
    assert.equal(step.checkpoint.mission.globals[3], true);
    assert.deepEqual(stepMissionWorld(f.compound, initial, 1, step.work), step);
    assert.throws(() => stepMissionWorld(f.compound, initial, 1, step.work - 1), /work/);
    assert.equal(initial.world.state.ownership!.transfers.length, 0); assert.equal(initial.mission.globals[3], false);
  }
});

test('attached requests identify the current building and keep assignment distinct from voice start', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await spatialAudioFixture(profile, { infantryRows: '',
      extraRules: '[BuildingTypes]\n0=Hub\n[TerrainTypes]\n0=Tree\n[Hub]\nStrength=100\n[Tree]\nName=Original\n',
      extraArt: '[Hub]\nFoundation=1x1\n[Tree]\nFoundation=1x1\n',
      extraMap: '[Structures]\n0=Commander,Hub,256,3,3,0,None,0,0,1,0,0,None,None,None,0,0\n[Terrain]\n3003=Tree\n' });
    const prepared = await prepareMissionBindings(f.input.bindings, f.input.cues, undefined, undefined, undefined, f.input.audio, { spatialAudioSource: f.spatial });
    assert(prepared.authority);
    const flags = compileMissionInitialFlags({ bindings: f.input.bindings, bytes: f.f.mission.bytes, initialization: 'new-campaign' });
    const model = compileMissionWorld({ world: f.model, bindings: prepared.authority, flags });
    const step = stepMissionWorld(model, createMissionWorld(model)), building = f.model.entities.find(e => e.kind === 'structure')!;
    assert.deepEqual(step.spatialAudio!.requests.map(r => [r.opcode, r.target, r.playbackAuthorized]),
      [[99, { kind: 'object', entityId: building.id, family: 'structure' }, false], [116, { kind: 'object', entityId: building.id, family: 'structure' }, false]]);
    assert.equal(step.spatialAudio!.requests[1]!.soundIndex, null);
    assert.equal(step.checkpoint.spatialAudio!.nextSequence, 2);
  }
});

test('spatial source admission keeps disabled and unrelated unsupported actions explicit', async () => {
  const f = await spatialAudioFixture('ra2');
  const base = await prepareMissionBindings(f.input.bindings, f.input.cues, undefined, undefined, undefined, f.input.audio);
  assert.equal(base.authority, null); assert(base.compilation!.diagnostics.some(d => d.code === 'unsupported-action-opcode'));
  await assert.rejects(prepareMissionBindings(f.input.bindings, f.input.cues, undefined, undefined, undefined, f.input.audio,
    { spatialAudioSource: { ...f.spatial } }), /spatial-audio-source/);
  const other = await spatialAudioFixture('ra2');
  await assert.rejects(prepareMissionBindings(f.input.bindings, f.input.cues, undefined, undefined, undefined, f.input.audio,
    { spatialAudioSource: other.spatial }), /spatial-audio-source/);
  const gated = await spatialAudioFixture('yr', { ramp: 1 });
  const noRamp = await prepareMissionBindings(gated.input.bindings, gated.input.cues, undefined, undefined, undefined, gated.input.audio, { spatialAudioSource: gated.spatial });
  assert.equal(noRamp.authority, null); assert(noRamp.compilation!.diagnostics.some(d => d.code === 'unsupported-action-spatial-audio-source'));
  const unknown = await spatialAudioFixture('ra2', {}, script(`3,${sound},${stop},63,0,1,0,0,0,0,A`));
  const held = await prepareMissionBindings(unknown.input.bindings, unknown.input.cues, undefined, undefined, undefined, unknown.input.audio, { spatialAudioSource: unknown.spatial });
  assert.equal(held.authority, null); assert(held.compilation!.diagnostics.some(d => d.code === 'unsupported-action-opcode'));
});

test('one-use world context and cursor limits cannot fabricate spatial invocation', async () => {
  const f = await fixture('ra2'), initial = createMissionWorld(f.compound), p = f.prepared.authority!.program;
  const vm = MissionLogic.restore(p, initial.mission); assert.throws(() => vm.step(), /world-context-required/);
  const world = WorldSimulation.create(f.world); world.step();
  const context = createMissionActionWorldContext({ world: f.world, checkpoint: world.save(), bindings: f.prepared.authority!, missionNextTick: 0 }, 1_000_000);
  assert.throws(() => vm.stepWorldContext({ ...context }), /context/);
  assert.equal(vm.stepWorldContext(context).effects.length, 2); assert.throws(() => vm.stepWorldContext(context), /context/);
  for (const changed of [{ ...initial.spatialAudio!, nextSequence: 1 }, { ...initial.spatialAudio!, tick: 1 }, { ...initial.spatialAudio!, sourceSha256: '0'.repeat(64) }])
    assert.throws(() => restoreMissionWorld(f.compound, { ...initial, spatialAudio: changed }), /spatial/);
  const result = stepMissionWorld(f.compound, initial); assert.equal(result.spatialAudio!.requests.length, 2);
  const foreign = await fixture('yr'); assert(!isMissionWorldSpatialAudio(foreign.compound, result.spatialAudio));
});

test('standalone restore reserves history work and private target queries do not grow with transfer history', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, `3,${sound},${stop},36,0,1,0,0,0,0,A`, true), world = WorldSimulation.create(f.world);
    const id = f.spatial.instructions[0]!.instructionId, before = world.save();
    const baseline = resolveMissionSpatialAudioTarget(f.spatial, f.world, before, id), query = resolveMissionSpatialAudioInWorld(f.spatial, world, id);
    const transfer = f.house!.instructions.find(i => i.opcode === 36)!;
    for (let i = 0; i < 64; i++) world.transferOwnership({ instructionId: transfer.instructionId, sourceHouse: 0, triggerHouse: null });
    const after = world.save(), longer = resolveMissionSpatialAudioTarget(f.spatial, f.world, after, id);
    assert(longer.work > baseline.work); assert.deepEqual(longer.target, baseline.target);
    assert.throws(() => resolveMissionSpatialAudioTarget(f.spatial, f.world, after, id, baseline.work), /work/);
    assert.deepEqual(resolveMissionSpatialAudioTarget(f.spatial, f.world, after, id, longer.work), longer);
    assert.throws(() => resolveMissionSpatialAudioTarget(f.spatial, f.world, after, id, longer.work - 1), /work/);
    Object.defineProperty(world, 'save', { value() { throw Error('must not serialize'); } });
    assert.deepEqual(resolveMissionSpatialAudioInWorld(f.spatial, world, id, query.work), query);
    assert.throws(() => resolveMissionSpatialAudioInWorld(f.spatial, world, id, query.work - 1), /work/);
    let reads = 0; const untouched = new Proxy(after, { getOwnPropertyDescriptor() { reads++; throw Error('checkpoint-read'); } });
    assert.throws(() => resolveMissionSpatialAudioTarget(f.spatial, f.world, untouched, id, 0), /work/); assert.equal(reads, 0);
    const accessor = { ...after }; Object.defineProperty(accessor, 'state', { enumerable: true, get() { throw Error('checkpoint-getter'); } });
    assert.throws(() => resolveMissionSpatialAudioTarget(f.spatial, f.world, accessor, id), /checkpoint-data/);
  }
});
