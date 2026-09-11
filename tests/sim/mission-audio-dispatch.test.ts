// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature runtime fixtures; no retail payloads or native playback claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { audioMission, audioSource, audioWorld, audioWorldFixture, soundAction, evaAction, textAction } from './mission-audio-fixture.ts';
import { missionTeamFixture } from './mission-team-fixture.ts';
import { missionBindingsFixture } from './mission-bindings-fixture.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionTeamCellSource } from '../../packages/sim/src/mission-team-cell-source.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { compileMissionBindings, prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileScenarioLogic } from '../../packages/content/src/scenario-logic.ts';
import { compileMissionProgram, missionProgramAudioPolicy, MISSION_TIMING_POLICY } from '../../packages/sim/src/mission-logic.ts';
import { hashCueFixture } from '../content/mission-cue.fixture.ts';
import { compileMissionWorld, createMissionWorld, stepMissionWorld, restoreMissionWorld, replayMissionWorld,
  admitMissionWorld, isMissionWorldAudio, missionWorldAudioPolicy, type MissionWorldAudioRequest } from '../../packages/sim/src/mission-world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';

test('both profiles require genuine, exact and complete audio source joins before program authority', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await audioWorldFixture(profile); assert.ok(f.model, JSON.stringify(f.prepared.diagnostics));
    assert.equal((await prepareMissionBindings(f.bindings, f.cues)).authority, null);
    const forged = await prepareMissionBindings(f.bindings, f.cues, undefined, undefined, undefined, { ...f.audio });
    assert.equal(forged.authority, null); assert(forged.diagnostics.includes('vm:mission-audio-source'));
    const other = await audioWorldFixture(profile, { sound: '[SoundList]\n0=Alert\n[Alert]\nSounds=click\nVolume=40' });
    assert.equal((await prepareMissionBindings(f.bindings, f.cues, undefined, undefined, undefined, other.audio)).authority, null);
    for (const sound of ['[SoundList]\n0=Alert\n[Alert]\nSounds=missing', '[SoundList]\n0=Alert\n[Alert]\nSounds=click\nControl=unknown']) {
      const rejected = await audioWorldFixture(profile, { sound }); assert.equal(rejected.model, null);
      assert(rejected.prepared.compilation!.diagnostics.some(d => d.code === 'unsupported-action-audio-source'));
    }
    const theme = await audioWorldFixture(profile, { actions: [soundAction, '20,8,March,0,0,0,0,A'] });
    assert.equal(theme.model, null); assert(theme.prepared.compilation!.diagnostics.some(d => d.code === 'unsupported-action-opcode'));
    assert.equal(missionProgramAudioPolicy(f.prepared.authority!.program), f.audio);
    assert.equal(missionWorldAudioPolicy(f.model), f.audio); assert.equal(f.model.audioPolicySha256, f.audio.sha256);
    assert.equal(f.model.canStartCampaign, false);
  }
});

test('owned source operands and coverage cannot be replaced with stale instruction rows', async () => {
  const f = await audioWorldFixture(), logic = compileScenarioLogic({ profile: 'ra2', ...f.f.mission });
  const options = { contentIdentity: f.f.world.model.contentIdentity, difficulty: 1 as const, timingPolicy: MISSION_TIMING_POLICY };
  for (const edit of [(r: any) => { r.actions[0].instructions[0].parameters[1] = 'Other'; },
    (r: any) => { r.actions[0].instructions[0].opcode = 21; }]) {
    const changed = structuredClone(logic); edit(changed);
    const result = await compileMissionProgram(changed, options, async b => hashCueFixture(b), f.cues, undefined, undefined, undefined, f.audio);
    assert.equal(result.program, null); assert(result.diagnostics.some(d => d.code === 'unsupported-action-cue'));
  }
  const valid = f.prepared.compilation!;
  assert.deepEqual(valid.coverage.filter(c => [19, 21].includes(c.opcode)).map(c => [c.opcode, c.occurrences, c.supported, c.effectOnly]), [[19, 1, 1, true], [21, 1, 1, true]]);
});

test('actual VM execution emits immutable model-bound requests in mixed action order without authorizing playback', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await audioWorldFixture(profile), model = f.model!, initial = createMissionWorld(model), result = stepMissionWorld(model, initial), batch = result.audio!;
    assert(isMissionWorldAudio(model, batch)); assert(!isMissionWorldAudio(model, { ...batch }));
    assert(!isMissionWorldAudio(model, JSON.parse(JSON.stringify(batch))));
    const other = await audioWorldFixture(profile); assert.equal(isMissionWorldAudio(other.model!, batch), false);
    assert.deepEqual(batch.requests.map(r => [r.opcode, r.sequence, r.vmOrder, r.tick]), [[19, 0, 1, 0], [21, 1, 3, 0]]);
    assert.equal(result.presentation!.requests[0]!.vmOrder, 2);
    assert(batch.requests.every(r => r.triggerId === 'trigger:start' && r.bindingId === f.bindings.tags[0]!.id && r.playbackAuthorized === false));
    assert.equal(batch.stateSha256, worldHash(result.checkpoint)); assert.equal(batch.sourceDispatchVerified, true);
    assert.equal(batch.nativePlaybackVerified, false); assert.equal(batch.policyCatalogSha256, f.audio.sha256);
    assert.equal(batch.audioCatalogSha256, f.samples.sha256); assert.equal(batch.missionSha256, f.f.mission.source.sha256);
    assert.deepEqual([batch.fromNextTick, batch.toNextTick], [0, 1]); assert(Object.isFrozen(batch.requests[0]));
    assert.equal(initial.audio!.nextSequence, 0); assert.equal(result.checkpoint.audio!.nextSequence, 2);
    assert.equal(stepMissionWorld(model, result.checkpoint).audio!.requests.length, 0);
    assert.equal(Object.hasOwn(result.checkpoint.world.state, 'audio'), false);
    const baseline = WorldSimulation.create(f.f.world.model); baseline.step();
    assert.deepEqual(result.checkpoint.world, baseline.save());
  }
});

test('repeating audio shares command clocks and restores every boundary with identical grouped steps and replay', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await audioWorldFixture(profile, { repeat: true }), model = f.model!, initial = createMissionWorld(model);
    const input = { commands: [{ schemaVersion: 1 as const, tick: 2, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 1, x: 3, y: 3 } }], flags: [] };
    const pending = admitMissionWorld(model, initial, input); let state = pending; const requests: MissionWorldAudioRequest[] = [];
    for (let tick = 0; tick < 12; tick++) {
      const result = stepMissionWorld(model, state);
      assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, JSON.stringify(state))), result);
      requests.push(...result.audio!.requests); state = result.checkpoint;
      assert.equal(state.audio!.tick, tick); assert.equal(state.audio!.nextSequence, (tick + 1) * 2);
    }
    const grouped = stepMissionWorld(model, pending, 12); assert.deepEqual(grouped.checkpoint, state); assert.deepEqual(grouped.audio!.requests, requests);
    const replay = replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, input }], finalNextTick: 12, finalStateSha256: worldHash(state) });
    assert.deepEqual(replay, grouped); assert(isMissionWorldAudio(model, replay.audio));
    const saved = stepMissionWorld(model, pending, 5).checkpoint;
    const tail = replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: saved,
      admissions: [], finalNextTick: 12, finalStateSha256: worldHash(state) });
    assert.deepEqual(tail.audio!.requests, requests.slice(10)); assert.equal(tail.audio!.requests[0]!.sequence, 10);
    assert.deepEqual([state.world.state.entities[0]!.x, state.world.state.entities[0]!.y], [3, 3]);
  }
});

test('forced disabled and deleted triggers retain actual nested audio invocation order', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const actions = [soundAction, '22,2,Target,0,0,0,0,A', '53,2,Target,0,0,0,0,A', '22,2,Target,0,0,0,0,A', '12,2,Target,0,0,0,0,A', '22,2,Target,0,0,0,0,A', textAction];
    const extraMap = `[Triggers]\nCaller=Blue,<none>,Caller,0,1,1,1,0\nTarget=Blue,<none>,Target,1,1,1,1,0\n[Tags]\nRoot=0,Root,Caller\nTarget=2,Target,Target\n[Events]\nCaller=1,8,0,0\nTarget=1,14,0,0\n[Actions]\nCaller=${actions.length},${actions.join(',')}\nTarget=1,${evaAction}`;
    const f = await audioWorldFixture(profile, { extraMap }); assert(f.model, JSON.stringify(f.prepared.diagnostics));
    const result = stepMissionWorld(f.model, createMissionWorld(f.model));
    assert.deepEqual(result.audio!.requests.map(r => [r.opcode, r.vmOrder, r.triggerId]), [[19, 1, 'trigger:caller'], [21, 5, 'trigger:target']]);
    assert.equal(result.presentation!.requests[0]!.vmOrder, 8);
    assert.equal(stepMissionWorld(f.model, result.checkpoint).audio!.requests.length, 0);
  }
});

test('audio and source team spawning compose with one world, saved receipts and replay', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const team = missionTeamFixture({ profile, extraMap: audioMission([soundAction, '80,1,Squad,0,0,0,0,A', evaAction, textAction]) });
    const f = await audioWorld({ ...team, difficulty: 1 }, undefined, team.source); assert(f.model, JSON.stringify(f.prepared.diagnostics));
    const model = f.model, initial = createMissionWorld(model), first = stepMissionWorld(model, initial);
    assert.deepEqual(first.audio!.requests.map(r => r.vmOrder), [1, 3]); assert.equal(first.checkpoint.teams!.requests[0]!.effectOrder, 2);
    const second = stepMissionWorld(model, first.checkpoint); assert.equal(second.teams!.actions.filter(a => a.kind === 'spawned').length, 1);
    assert.equal(second.audio!.requests.length, 0); assert.deepEqual(second.checkpoint.world, second.checkpoint.teams!.team.world);
    const grouped = stepMissionWorld(model, initial, 5); assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, first.checkpoint), 4).checkpoint, grouped.checkpoint);
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [], finalNextTick: 5, finalStateSha256: worldHash(grouped.checkpoint) }), grouped);
  }
});

test('cursor identity, impossible clocks, forged input and late work failure reject without modifying caller state', async () => {
  const f = await audioWorldFixture('ra2', { repeat: true }), model = f.model!, initial = createMissionWorld(model), before = JSON.stringify(initial);
  for (const change of [{ policy: 'other' }, { policyCatalogSha256: '0'.repeat(64) }, { tick: 1 }, { nextSequence: 1 }, { nextSequence: 1_000_001 }]) {
    assert.throws(() => restoreMissionWorld(model, { ...initial, audio: { ...initial.audio, ...change } }));
  }
  assert.throws(() => restoreMissionWorld(model, { ...initial, audio: undefined }));
  let reads = 0; const malicious = { ...initial }; Object.defineProperty(malicious, 'audio', { enumerable: true, get() { reads++; return initial.audio; } });
  assert.throws(() => restoreMissionWorld(model, malicious)); assert.equal(reads, 0);
  assert.throws(() => admitMissionWorld(model, initial, { commands: [], flags: [], audio: [] } as never));
  const one = stepMissionWorld(model, initial); assert.deepEqual(stepMissionWorld(model, initial, 1, one.work), one);
  assert.throws(() => stepMissionWorld(model, initial, 1, one.work - 1), /work-limit/);
  assert.throws(() => stepMissionWorld(model, initial, 2, one.work), /work-limit/);
  assert.equal(JSON.stringify(initial), before); assert.deepEqual(stepMissionWorld(model, initial), one);
  assert.throws(() => restoreMissionWorld(model, { ...one.checkpoint, audio: { ...one.checkpoint.audio, nextSequence: one.checkpoint.mission.nextEffectOrder - 1 } }), /audio-cursor/);
});

test('an unselected audio capability adds no model, checkpoint or result fields', async () => {
  const f = await audioWorldFixture('ra2', { actions: ['28,0,0,0,0,0,0,A'] });
  const without = await prepareMissionBindings(f.bindings), explicit = await prepareMissionBindings(f.bindings, undefined, undefined, undefined, undefined, undefined);
  assert(without.authority && explicit.authority); assert.equal(without.authority.program.sha256, explicit.authority.program.sha256);
  assert.equal(missionProgramAudioPolicy(without.authority.program), null);
  const model = compileMissionWorld({ world: f.f.world.model, bindings: without.authority, flags: f.flags });
  assert.equal(missionWorldAudioPolicy(model), null); assert.equal(Object.hasOwn(model, 'audioPolicySha256'), false);
  const initial = createMissionWorld(model), result = stepMissionWorld(model, initial);
  assert.equal(Object.hasOwn(initial, 'audio'), false); assert.equal(Object.hasOwn(result, 'audio'), false);
  assert.throws(() => restoreMissionWorld(model, { ...initial, audio: createMissionWorld(f.model!).audio }));
});

test('per-tick request caps and aggregate audio payload limits reject the whole transaction', async () => {
  const mission = (names: string[], repeat: boolean) => {
    const actions = Array(17).fill(soundAction);
    return `[Triggers]\n${names.map(id => `${id}=Blue,<none>,Original,0,1,1,1,0`).join('\n')}\n` +
      `[Tags]\n${names.map(id => `${id}=${repeat ? 2 : 0},Original,${id}`).join('\n')}\n` +
      `[Events]\n${names.map(id => `${id}=1,8,0,0`).join('\n')}\n` +
      `[Actions]\n${names.map(id => `${id}=17,${actions.join(',')}`).join('\n')}`;
  };
  const source = mission(Array.from({ length: 61 }, (_, i) => `Node${i}`), false);
  const f = await audioWorldFixture('ra2', { extraMap: source }); assert(f.model, JSON.stringify(f.prepared.diagnostics));
  const initial = createMissionWorld(f.model), before = JSON.stringify(initial);
  assert.throws(() => stepMissionWorld(f.model!, initial), /audio-request-limit/);
  assert.equal(JSON.stringify(initial), before);
  const large = mission(Array.from({ length: 40 }, (_, i) => `Node${i}`), true);
  const g = await audioWorldFixture('ra2', { extraMap: large }); assert(g.model, JSON.stringify(g.prepared.diagnostics));
  const start = createMissionWorld(g.model), saved = JSON.stringify(start), one = stepMissionWorld(g.model, start);
  assert.equal(one.audio!.requests.length, 680);
  assert.throws(() => stepMissionWorld(g.model!, start, 64), /audio-payload-limit/);
  assert.equal(JSON.stringify(start), saved); assert.deepEqual(stepMissionWorld(g.model, start), one);
});

test('programs without audio retain exact pre-dispatch program, model and save hashes in both profiles', async () => {
  // Captured from the source-policy dependency at 15fcc45 before dispatch changes.
  const expected = {
    ra2: ['143c335ae95aa035b8e6b0f3d62d04294d2b090b71e78ddbf22c59ffdcfc4575', '70d55f7cfd29b1559d7f4d289e9ff39ff02d5f98eca70867abe74054715aabde', '44a11ead79e8c2dcb9df4fa6252131e4a5d43222c890b28337a6a5a8732e637d', 'a8b2937f464483b5899ab7f954db918497b3bbd1d2efaa71b5add82e8d71bc70'],
    yr: ['9c784d3ecf84c73320d16aff66a80b148f7130729a7c2c0ec33172d269c273b5', '3ad2d9ccc595d1cb27e0970f602e9e6617126393f560165900da067dea1e4e28', '796c93e8067c7fde62b3d0bb770b7ad105a6c1bc9e306975cadacce111712267', 'd225acadcd221e72209597968dd58b7f1aea25cf0c491eb87fab4440ebb472ea']
  };
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await audioWorldFixture(profile, { actions: ['28,0,0,0,0,0,0,A'] }), prepared = await prepareMissionBindings(f.bindings);
    assert(prepared.authority);
    const model = compileMissionWorld({ world: f.f.world.model, bindings: prepared.authority, flags: f.flags });
    const initial = createMissionWorld(model), final = stepMissionWorld(model, initial).checkpoint;
    assert.deepEqual([prepared.authority.program.sha256, model.sha256, worldHash(initial), worldHash(final)], expected[profile]);
  }
});

test('completed ordinary cell crossings alone dispatch audio and preserve replay boundaries', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = missionBindingsFixture({ profile, infantryRows: '0=Commander,Walker,256,2,2,0,Guard,0,None,0,0,0,0,0',
      extraMap: audioMission([soundAction, evaAction], true, '1,0,0') + '\n[CellTags]\n2003=Shared\n3003=Shared' });
    const bindings = compileMissionBindings(f), cells = compileMissionCellEntrySource({ bindings }), { cues, audio } = await audioSource(f);
    const prepared = await prepareMissionBindings(bindings, cues, cells, undefined, undefined, audio); assert(prepared.authority, JSON.stringify(prepared.diagnostics));
    const flags = compileMissionInitialFlags({ bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
    const model = compileMissionWorld({ world: f.world.model, bindings: prepared.authority, flags });
    const initial = admitMissionWorld(model, createMissionWorld(model), { commands: [{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 1, x: 3, y: 2 } }], flags: [] });
    let state = initial, total = 0;
    for (let tick = 0; tick < 8; tick++) {
      const result = stepMissionWorld(model, state), crossings = result.worldEvents.filter(e => e.phase === 'movement' && e.kind === 'moved' && e.cell === 1027).length;
      assert.equal(result.audio!.requests.length, crossings * 2); total += crossings;
      assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, JSON.stringify(state))), result); state = result.checkpoint;
    }
    assert.equal(total, 1); assert.equal(state.audio!.nextSequence, 2);
    const grouped = stepMissionWorld(model, initial, 8);
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [], finalNextTick: 8, finalStateSha256: worldHash(state) }), grouped);
  }
});

test('spawned team actors deliver cell audio after actual movement with no spawn-time or idle invocation', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const extraMap = '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\nEnter=Blue,<none>,Enter,0,1,1,1,0\n' +
      '[Tags]\nStarter=0,Starter,Start\nCrossing=2,Crossing,Enter\n[Events]\nStart=1,8,0,0\nEnter=1,1,0,-1\n' +
      `[Actions]\nStart=1,7,1,Squad,0,0,0,0,A\nEnter=2,${soundAction},${evaAction}\n` +
      '[CellTags]\n1003=Crossing\n2003=Crossing\n3003=Crossing\n3004=Crossing';
    const f = missionTeamFixture({ profile, script: '0=3,1\n1=50,3', speed: 128, waypoint: '0=1003\n1=3003', extraMap });
    const cells = compileMissionCellEntrySource({ bindings: f.bindings });
    const teamCells = compileMissionTeamCellSource({ cells, actions: f.source, definitions: f.definitions, rules: f.rules, mission: f.mission });
    const { cues, audio } = await audioSource({ ...f, difficulty: 1 });
    const prepared = await prepareMissionBindings(f.bindings, cues, cells, undefined, f.source, audio); assert(prepared.authority, JSON.stringify(prepared.diagnostics));
    const flags = compileMissionInitialFlags({ bindings: f.bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
    const model = compileMissionWorld({ world: f.world.model, bindings: prepared.authority, flags, teamCells }), initial = createMissionWorld(model);
    let state = initial, total = 0;
    for (let tick = 0; tick < 12; tick++) {
      const result = stepMissionWorld(model, state);
      const crossings = result.worldEvents.filter(e => e.phase === 'movement' && e.kind === 'moved' && cells.cells.some(c => c.y * 512 + c.x === e.cell)).length;
      assert.equal(result.audio!.requests.length, crossings * 2); total += crossings;
      assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, state)), result); state = result.checkpoint;
    }
    assert(total > 0); assert.equal(state.audio!.nextSequence, total * 2);
    const grouped = stepMissionWorld(model, initial, 12);
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [], finalNextTick: 12, finalStateSha256: worldHash(state) }), grouped);
  }
});
