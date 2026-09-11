// SPDX-License-Identifier: GPL-3.0-or-later
// Original component and compound fixtures; no audible/native save claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialAudioFixture } from './mission-spatial-audio-fixture.ts';
import { createMissionSpatialIntents, restoreMissionSpatialIntents, appendMissionSpatialIntents,
  type MissionSpatialIntentRequest } from '../../packages/sim/src/mission-spatial-intents.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { worldHash } from '../../packages/sim/src/world-model.ts';
import { resolveMissionSpatialAudioInWorld } from '../../packages/sim/src/mission-spatial-audio-source.ts';
import { prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileMissionWorld, createMissionWorld, stepMissionWorld, restoreMissionWorld,
  replayMissionWorld, isMissionWorldSpatialAudio } from '../../packages/sim/src/mission-world.ts';

const sound = (name = 'Alert', waypoint = 'A') => `99,7,${name},0,0,0,0,${waypoint}`;
const stop = (waypoint = 'A') => `116,0,688,0,0,0,0,${waypoint}`;
const script = (actions: string[], once = false) => `[Triggers]\nStart=Blue,<none>,Spatial,0,1,1,1,0\n[Tags]\nShared=${once ? 0 : 2},Spatial,Start\n[Events]\nStart=1,8,0,0\n[Actions]\nStart=${actions.length},${actions.join(',')}\n`;
const sounds = (control = 'loop', loop = 0) => `[SoundList]\n0=Alert\n1=Alternate\n[Alert]\nSounds=click\nControl=${control}\nLoop=${loop}\n[Alternate]\nSounds=click\nControl=loop\n`;
const objects = {
  infantryRows: '', extraRules: '[BuildingTypes]\n0=Hub\n[TerrainTypes]\n0=Tree\n[Hub]\nStrength=100\n[Tree]\nName=Original\n',
  extraArt: '[Hub]\nFoundation=1x1\n[Tree]\nFoundation=1x1\n',
  extraMap: '[Structures]\n0=Commander,Hub,256,3,3,0,None,0,0,1,0,0,None,None,None,0,0\n[Terrain]\n3003=Tree\n',
};
async function fixture(profile: 'ra2' | 'yr', actions = [sound(), stop()], object = false, audio?: string, once = false) {
  const f = await spatialAudioFixture(profile, { ...(object ? objects : {}), waypoint: '0=3003\n1=3004' },
    script(actions, once) + (object ? objects.extraMap : ''), audio);
  const world = WorldSimulation.create(f.model), initial = createMissionSpatialIntents(f.spatial);
  function request(index: number, sequence: number): MissionSpatialIntentRequest {
    const i = f.spatial.instructions[index]!;
    return { sequence, instructionId: i.instructionId, opcode: i.opcode, soundIndex: i.soundIndex,
      target: resolveMissionSpatialAudioInWorld(f.spatial, world, i.instructionId).target };
  }
  return { ...f, world, initial, request };
}

test('positional loop identities remain distinct and stop matches exact coordinates across sound indices', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, [sound(), sound('Alternate'), sound('Alert', 'B'), stop()], false, sounds());
    const started = appendMissionSpatialIntents(f.spatial, f.initial,
      [f.request(0, 0), f.request(0, 1), f.request(1, 2), f.request(2, 3)], f.world);
    assert.equal(started.sourceDispatchVerified, false);
    assert.deepEqual(started.state.loops.map(p => [p.sequence, p.soundIndex]), [[0, 0], [1, 0], [2, 1], [3, 0]]);
    assert.equal(started.state.loops[0]!.flags, 1); assert(Object.isFrozen(started.state.loops[0]!.position));
    const ended = appendMissionSpatialIntents(f.spatial, started.state, [f.request(3, 4)], f.world);
    assert.deepEqual(ended.state.loops.map(p => p.sequence), [3]); assert.equal(ended.state.nextSequence, 5);
    assert.equal(started.state.loops.length, 4); assert.equal(f.initial.nextSequence, 0);
    assert.deepEqual(restoreMissionSpatialIntents(f.spatial, JSON.parse(JSON.stringify(ended.state))).state, ended.state);
  }
});

test('one-shot and finite positional starts advance receipts without entering the resume store', async () => {
  for (const profile of ['ra2', 'yr'] as const) for (const [control, count] of [['random', 0], ['loop', 2]] as const) {
    const f = await fixture(profile, [sound()], false, sounds(control, count));
    const started = appendMissionSpatialIntents(f.spatial, f.initial, [f.request(0, 0)], f.world);
    assert.equal(started.state.nextSequence, 1); assert.deepEqual(started.state.loops, []);
    const restored = restoreMissionSpatialIntents(f.spatial, started.state).state;
    assert.deepEqual(appendMissionSpatialIntents(f.spatial, restored, [], f.world).state, started.state);
  }
});

test('object assignment coalesces to the latest desire while stop clears only the selected controller', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, [sound(), sound('Alternate'), stop()], true, sounds());
    const r = appendMissionSpatialIntents(f.spatial, f.initial, [f.request(0, 0), f.request(1, 1), f.request(1, 2)], f.world);
    assert.equal(r.state.objects.length, 1); assert.equal(r.state.objects[0]!.soundIndex, 1);
    assert.equal(r.state.objects[0]!.sequence, 2); assert.deepEqual(r.state.loops, []);
    assert.deepEqual(appendMissionSpatialIntents(f.spatial, r.state, [], f.world).state, r.state);
    const stopped = appendMissionSpatialIntents(f.spatial, r.state, [f.request(2, 3)], f.world);
    assert.deepEqual(stopped.state.objects, []); assert.equal(stopped.state.nextSequence, 4);
    // This store claims desired state only; no active voice/instance is fabricated.
    assert.deepEqual(Object.keys(r.state.objects[0]!).sort(), ['entityId', 'family', 'instructionId', 'sequence', 'soundIndex']);
  }
});

test('genuine current-world retirement prunes object intent and leaves nullable-health terrain present', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, [sound(), stop()], true);
    const started = appendMissionSpatialIntents(f.spatial, f.initial, [f.request(0, 0)], f.world);
    const checkpoint = f.world.save(), building = started.state.objects[0]!.entityId;
    const removed = structuredClone(checkpoint); removed.state.entities.find(e => e.id === building)!.health = 0;
    // A validated component checkpoint, not a fabricated claim of native destruction.
    const retired = WorldSimulation.restore(f.model, removed);
    const cleaned = appendMissionSpatialIntents(f.spatial, started.state, [], retired);
    assert.deepEqual(cleaned.state.objects, []); assert.equal(cleaned.state.nextSequence, 1);
    const i = f.spatial.instructions[0]!, target = resolveMissionSpatialAudioInWorld(f.spatial, retired, i.instructionId).target;
    assert.equal(target.kind, 'object'); if (target.kind !== 'object') throw Error('expected terrain');
    assert.equal(target.family, 'terrain');
    const tree = appendMissionSpatialIntents(f.spatial, cleaned.state, [{ ...f.request(0, 1), target }], retired);
    assert.equal(tree.state.objects[0]!.family, 'terrain');
    assert.deepEqual(appendMissionSpatialIntents(f.spatial, tree.state, [], retired).state, tree.state);
    assert.equal(f.world.save().state.entities.find(e => e.id === building)!.health, 100);
  }
});

test('source joins, owned state, ordered sequences and exact work budgets reject atomically', async () => {
  const f = await fixture('ra2'), other = await fixture('yr'), requests = [f.request(0, 0), f.request(1, 1)], before = worldHash(f.initial);
  const result = appendMissionSpatialIntents(f.spatial, f.initial, requests, f.world);
  assert.deepEqual(appendMissionSpatialIntents(f.spatial, f.initial, requests, f.world, result.work), result);
  assert.throws(() => appendMissionSpatialIntents(f.spatial, f.initial, requests, f.world, result.work - 1), /work/);
  assert.throws(() => appendMissionSpatialIntents(f.spatial, { ...f.initial }, requests, f.world), /state-brand/);
  assert.throws(() => appendMissionSpatialIntents(other.spatial, f.initial, requests, other.world), /state-brand/);
  assert.throws(() => appendMissionSpatialIntents(f.spatial, f.initial, requests, other.world), /world-join/);
  assert.throws(() => appendMissionSpatialIntents(f.spatial, f.initial, [f.request(0, 1)], f.world), /sequence/);
  assert.throws(() => appendMissionSpatialIntents(f.spatial, f.initial, [{ ...f.request(0, 0), soundIndex: 99 }], f.world), /instruction/);
  assert.throws(() => appendMissionSpatialIntents(f.spatial, f.initial, [{ ...f.request(0, 0), target: { kind: 'position', x: 0, y: 0, z: 0 } }], f.world), /position-source/);
  const accessor = { ...f.request(0, 0) }; Object.defineProperty(accessor, 'target', { enumerable: true, get() { throw Error('not read'); } });
  assert.throws(() => appendMissionSpatialIntents(f.spatial, f.initial, [accessor], f.world), /world-fields/);
  let observed = false; const emptyBudget = new Proxy(requests, { getOwnPropertyDescriptor() { observed = true; throw Error('unbudgeted'); } });
  assert.throws(() => appendMissionSpatialIntents(f.spatial, f.initial, emptyBudget, f.world, 0), /work/); assert.equal(observed, false);
  assert.equal(worldHash(f.initial), before);
});

test('restored loop records require exact source, unique ordinals, ordering and bounded capacity', async () => {
  const f = await fixture('ra2');
  const started = appendMissionSpatialIntents(f.spatial, f.initial, [f.request(0, 0), f.request(0, 1)], f.world).state;
  const restored = restoreMissionSpatialIntents(f.spatial, structuredClone(started));
  assert.deepEqual(restoreMissionSpatialIntents(f.spatial, started, restored.work), restored);
  assert.throws(() => restoreMissionSpatialIntents(f.spatial, started, restored.work - 1), /work/);
  for (const changed of [
    { ...started, sourceSha256: '0'.repeat(64) }, { ...started, nextSequence: 0 },
    { ...started, loops: [started.loops[1], started.loops[0]] }, { ...started, loops: [started.loops[0], started.loops[0]] },
    { ...started, loops: [{ ...started.loops[0], flags: 2 }] },
    { ...started, loops: [{ ...started.loops[0], position: { x: 1, y: 2, z: 3 } }] },
  ]) assert.throws(() => restoreMissionSpatialIntents(f.spatial, changed));
  const full = restoreMissionSpatialIntents(f.spatial, { ...started, nextSequence: 4096,
    loops: Array.from({ length: 4096 }, (_, sequence) => ({ ...started.loops[0]!, sequence })) }).state;
  assert.throws(() => appendMissionSpatialIntents(f.spatial, full, [f.request(0, 4096)], f.world), /loop-limit/);
  assert.equal(full.loops.length, 4096);
  const exhausted = restoreMissionSpatialIntents(f.spatial, { ...f.initial, nextSequence: 1_000_000 }).state;
  assert.throws(() => appendMissionSpatialIntents(f.spatial, exhausted, [f.request(0, 1_000_000)], f.world), /sequence-limit/);
});

test('compound state retains loop intent across idle ticks, save restore and every replay boundary', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, [sound()], false, sounds(), true);
    const binding = await prepareMissionBindings(f.input.bindings, f.input.cues, undefined, undefined, undefined, f.input.audio, { spatialAudioSource: f.spatial });
    assert(binding.authority);
    const flags = compileMissionInitialFlags({ bindings: f.input.bindings, bytes: f.f.mission.bytes, initialization: 'new-campaign' });
    const model = compileMissionWorld({ world: f.model, bindings: binding.authority, flags }), initial = createMissionWorld(model), boundaries = [initial];
    for (let tick = 0; tick < 4; tick++) boundaries.push(stepMissionWorld(model, boundaries.at(-1)).checkpoint);
    const final = boundaries.at(-1)!;
    assert.equal(final.spatialIntents!.loops.length, 1); assert.equal(final.spatialIntents!.nextSequence, 1);
    for (let tick = 0; tick < 4; tick++) {
      const restored = restoreMissionWorld(model, JSON.stringify(boundaries[tick]));
      const grouped = stepMissionWorld(model, restored, 4 - tick);
      const replay = replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: restored,
        admissions: [], finalNextTick: 4, finalStateSha256: worldHash(final) });
      assert.deepEqual(grouped, replay); assert.deepEqual(replay.checkpoint, final);
      assert(isMissionWorldSpatialAudio(model, replay.spatialAudio)); assert.equal(replay.spatialAudio.intents, replay.checkpoint.spatialIntents);
      if (tick > 0) assert.deepEqual(replay.spatialAudio.requests, []);
    }
    assert.throws(() => restoreMissionWorld(model, { ...final, spatialIntents: { ...final.spatialIntents!, nextSequence: 0 } }), /initial-state|cursor/);
    const step = stepMissionWorld(model, initial);
    assert.deepEqual(stepMissionWorld(model, initial, 1, step.work), step);
    assert.throws(() => stepMissionWorld(model, initial, 1, step.work - 1), /work|integer/);
    assert.deepEqual(initial.spatialIntents!.loops, []); assert.equal(model.canStartCampaign, false);
  }
});
