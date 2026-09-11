// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature source fixtures only. No native execution or playback claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileMissionCues, missionCueSourceParameters } from '../../packages/content/src/mission-cues.ts';
import { MISSION_SPATIAL_AUDIO_CUE_POLICY } from '../../packages/content/src/mission-cue-types.ts';
import { compileMissionAudioPlan } from '../../packages/content/src/mission-audio.ts';
import { prepareMissionAudioSamples } from '../../packages/content/src/mission-audio-samples.ts';
import { compileMissionAudioPolicy, missionAudioPolicyContext } from '../../packages/content/src/mission-audio-policy.ts';
import { appendMissionCues, createMissionCueState } from '../../packages/sim/src/mission-cues.ts';
import { cueInput, hashCueFixture } from './mission-cue.fixture.ts';
import { audioFixture, planRoots } from './mission-audio.fixture.ts';
const actions = ['19,7,Alert,0,0,0,0,A', '99,7,Alert,0,0,0,0,A', '116,0,32,0,0,0,0,A', '21,6,Notice,0,0,0,0,A'];

for (const profile of ['ra2', 'yr'] as const) test(`${profile}: spatial cue opt-in retains canonical waypoint and authenticated sound reference`, async () => {
  const input = cueInput(profile, actions), baseline = compileMissionCues(input), cues = compileMissionCues({ ...input, spatialAudio: true });
  assert.deepEqual(baseline.instructions.map(i => i.opcode), [19, 21]);
  assert(!Object.hasOwn(baseline, 'spatialAudioPolicy')); assert(!Object.hasOwn(baseline, 'initialWaypointsSha256'));
  assert.equal(cues.spatialAudioPolicy, MISSION_SPATIAL_AUDIO_CUE_POLICY); assert.match(cues.initialWaypointsSha256!, /^[a-f0-9]{64}$/);
  assert.notEqual(cues.sha256, baseline.sha256); assert.deepEqual(cues.instructions.filter(i => [19, 21].includes(i.opcode)), baseline.instructions);
  const sound = cues.instructions[1]!, stop = cues.instructions[2]!;
  assert.equal(sound.status, 'unsupported'); assert.deepEqual(sound.reasons, ['sound-definition-sample-closure-unresolved']);
  assert.equal(stop.status, 'resolved-reference'); assert.deepEqual(stop.reasons, []);
  assert.deepEqual(stop.spatialLocation, { waypoint: 0, x: 5, y: 6, selection: 'current-building-first-terrain-otherwise-position' });
  assert.deepEqual(sound.spatialLocation, stop.spatialLocation);
  assert.deepEqual(missionCueSourceParameters(cues, sound.id), ['7', 'Alert', '0', '0', '0', '0', 'A']);
  const fixture = audioFixture(profile, actions), plan = compileMissionAudioPlan({ ...fixture.input, cues });
  assert.deepEqual(plan.bindings.map(b => b.opcode), [19, 99, 21]);
  assert(plan.bindings.every(b => b.status === 'planned-reference'));
  assert.deepEqual(plan.bindings[1]!.samples, plan.bindings[0]!.samples);
  const audio = await prepareMissionAudioSamples(plan, planRoots(plan, fixture.roots));
  const policy = compileMissionAudioPolicy({ cues, audio, initialization: 'fresh-process-audio-load' });
  assert(policy.bindings.every(b => b.status === 'supported-source'));
  const bound = policy.bindings.find(b => b.opcode === 99)!;
  assert.deepEqual(bound.caller, { type: 'spatial-sound', ...sound.spatialLocation, positionalFlags: 1 });
  assert.deepEqual(bound.values, policy.bindings[0]!.values); assert.deepEqual(bound.selection, policy.bindings[0]!.selection);
  assert(bound.requiredState.includes('custom-object-controller-and-limbo-lifecycle'));
  assert.equal(missionAudioPolicyContext(policy).cues, cues);
  for (const value of [cues, plan, audio, policy]) { assert.equal(value.canStartCampaign, false); assert.equal(value.playbackReady, false); }
  assert.equal(policy.runtimeAuthority, false);
  for (const instructionId of [sound.id, stop.id]) assert.throws(() => appendMissionCues(cues, createMissionCueState(cues),
    { tick: 0, invocations: [{ instructionId, instanceId: 'original' }] }), /unsupported-invocation/);
  assert.throws(() => compileMissionAudioPolicy({ cues: baseline, audio, initialization: 'fresh-process-audio-load' }), /source-identity/);
  assert.throws(() => compileMissionAudioPlan({ ...fixture.input, cues: structuredClone(cues) }), /cue-brand/);
});

test('spatial references reject missing, aliased, zero, outside and profile-unloaded waypoints', () => {
  const cases = [
    ['A', '1=6005'], ['A', '00=6005'], ['A', '0=0'], ['A', '0=100100'],
    ['DX', '127=6005'], ['AAA', '0=6005'],
  ];
  for (const [waypoint, rows] of cases) {
    const cues = compileMissionCues({ ...cueInput('ra2', [`99,7,Alert,0,0,0,0,${waypoint}`, `116,0,0,0,0,0,0,${waypoint}`], rows), spatialAudio: true });
    assert(cues.instructions.every(i => i.status === 'unsupported' && i.reasons.includes('spatial-waypoint-source')));
  }
  assert.throws(() => compileMissionCues({ ...cueInput('ra2', [actions[1]!], '0=6005\n[Waypoints]\n0=6005'), spatialAudio: true }), /source-section/);
  const yr = compileMissionCues({ ...cueInput('yr', ['99,7,Alert,0,0,0,0,DX'], '127=6005'), spatialAudio: true });
  assert.deepEqual(yr.instructions[0]!.spatialLocation, { waypoint: 127, x: 5, y: 6, selection: 'current-building-first-terrain-otherwise-position' });
});

test('spatial operand and source failures remain unsupported through reference preparation', () => {
  const mutations = ['99,0,Alert,0,0,0,0,A', '99,7,Alert,1,0,0,0,A', '116,0,invalid,0,0,0,0,A'];
  for (const action of mutations) {
    const cues = compileMissionCues({ ...cueInput('ra2', [action]), spatialAudio: true });
    assert.equal(cues.instructions[0]!.status, 'unsupported'); assert(cues.instructions[0]!.reasons.length);
    const fixture = audioFixture('ra2', [action]), plan = compileMissionAudioPlan({ ...fixture.input, cues });
    if (action.startsWith('99')) assert.equal(plan.bindings[0]!.status, 'unsupported');
    else assert.deepEqual(plan.bindings, []);
  }
  const input = cueInput('ra2', [actions[1]!]); input.mission.bytes[0] = input.mission.bytes[0]! ^ 1;
  assert.throws(() => compileMissionCues({ ...input, spatialAudio: true }), /source-hash/);
  assert.throws(() => compileMissionCues({ ...cueInput(), spatialAudio: false } as never), /spatial-audio-mode/);
});

test('spatial source capture and lowered instruction budgets cannot bypass descriptor or aggregate gates', () => {
  const input = { ...cueInput('yr', actions), spatialAudio: true as const }; let gets = 0;
  const cues = compileMissionCues(new Proxy(input, { get() { gets++; throw new Error('must not read'); } }));
  assert.equal(gets, 0); assert.equal(cues.instructions.length, 4);
  assert.throws(() => compileMissionCues(input, { instructions: 3 }), /instruction-limit/);
  assert.doesNotThrow(() => compileMissionCues(input, { instructions: 4 }));
  assert.throws(() => compileMissionCues({ ...input, get spatialAudio(): true { gets++; return true; } }), /field/);
  assert.equal(gets, 0);
  const changed = new TextEncoder().encode(new TextDecoder().decode(input.mission.bytes).replace('99,7,Alert', '99,7,Missing'));
  const other = compileMissionCues({ ...input, mission: { ...input.mission, bytes: changed, source: { ...input.mission.source, sha256: hashCueFixture(changed) } } });
  assert.notEqual(other.sha256, cues.sha256);
  const fixture = audioFixture('yr', actions), plan = compileMissionAudioPlan({ ...fixture.input, cues: other });
  assert.equal(plan.bindings.find(b => b.opcode === 99)!.status, 'unsupported');
});

test('stop source retains its ignored signed integer while selecting only the canonical waypoint', () => {
  for (const profile of ['ra2', 'yr'] as const) for (const value of ['0', '32', '688', '-1', '-2147483648', '2147483647']) {
    const cues = compileMissionCues({ ...cueInput(profile, [`116,0,${value},0,0,0,0,A`]), spatialAudio: true });
    const stop = cues.instructions[0]!; assert.equal(stop.status, 'resolved-reference');
    assert.deepEqual(stop.spatialLocation, { waypoint: 0, x: 5, y: 6, selection: 'current-building-first-terrain-otherwise-position' });
    assert.equal(missionCueSourceParameters(cues, stop.id)![1], value);
  }
  for (const value of ['2147483648', '-2147483649', '1.5']) {
    const cues = compileMissionCues({ ...cueInput('ra2', [`116,0,${value},0,0,0,0,A`]), spatialAudio: true });
    assert.equal(cues.instructions[0]!.status, 'unsupported');
  }
});
