// SPDX-License-Identifier: GPL-3.0-or-later
// Original source and execution fixtures only; no retail strings or geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionBindingsFixture } from './mission-bindings-fixture.ts';
import { cueCsf, hashCueFixture } from '../content/mission-cue.fixture.ts';
import { compileMissionCues, missionCueSourceParameters } from '../../packages/content/src/mission-cues.ts';
import { compileMissionBindings, prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileMissionProgram, missionProgramCues } from '../../packages/sim/src/mission-logic.ts';
import { compileScenarioLogic } from '../../packages/content/src/scenario-logic.ts';
import { appendMissionCues, createMissionCueState } from '../../packages/sim/src/mission-cues.ts';
import { compileMissionWorld, createMissionWorld, stepMissionWorld, restoreMissionWorld, replayMissionWorld, admitMissionWorld, isMissionWorldPresentation } from '../../packages/sim/src/mission-world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
const defaultActions = ['11,4,MSG,0,0,0,0,A', '48,0,2,0,0,0,0,A', '55,0,16,0,0,0,0,A'];
async function fixture(profile: 'ra2' | 'yr' = 'ra2', { actions = defaultActions, event = '8,0,0', repeat = false, extra = '', text = 'Original 提示', sourceMap = undefined as string | undefined } = {}) {
  const f = missionBindingsFixture({ profile, extraMap: sourceMap ?? `[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=${repeat ? 2 : 0},Sharing,Start\n[Events]\nStart=1,${event}\n[Actions]\nStart=${actions.length},${actions.join(',')}\n${extra}` });
  const strings = cueCsf([{ label: 'MSG', text }]);
  const cues = compileMissionCues({ profile, mission: { ...f.mission, path: 'fixture.map' }, strings: { path: profile === 'ra2' ? 'ra2.csf' : 'ra2md.csf', sha256: hashCueFixture(strings), bytes: strings } });
  const bindings = compileMissionBindings(f), prepared = await prepareMissionBindings(bindings, cues);
  const flags = compileMissionInitialFlags({ bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  const model = prepared.authority ? compileMissionWorld({ world: f.world.model, bindings: prepared.authority, flags }) : null;
  return { f, cues, bindings, prepared, model };
}
test('both profiles require genuine complete source references and retain original no-cue refusal', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const a = await fixture(profile); assert.ok(a.model, JSON.stringify(a.prepared));
    assert.equal((await prepareMissionBindings(a.bindings)).authority, null);
    assert.equal(missionProgramCues(a.prepared.authority!.program), a.cues);
    assert.equal(a.model.cueCatalogSha256, a.cues.sha256);
    assert.ok(Object.isFrozen(missionCueSourceParameters(a.cues, a.cues.instructions[0]!.id)));
    assert.equal((await prepareMissionBindings(a.bindings, { ...a.cues })).authority, null);
    const wrongSource = await fixture(profile, { text: 'Different selected CSF' });
    assert.notEqual(wrongSource.model!.sha256, a.model.sha256);
    assert.throws(() => restoreMissionWorld(wrongSource.model!, createMissionWorld(a.model!)), /checkpoint-identity/);
    for (const actions of [[...defaultActions, '19,7,Sample,0,0,0,0,A'], [...defaultActions, '99,0,0,0,0,0,0,A'], ['11,4,MISSING,0,0,0,0,A']]) {
      const blocked = await fixture(profile, { actions }); assert.equal(blocked.prepared.authority, null);
    }
    assert.equal((await fixture(profile, { event: '2,0,0' })).prepared.authority, null);
  }
});
test('exact owned operands prevent stale source compiler rows from changing presentation references', async () => {
  const a = await fixture(), logic = compileScenarioLogic({ profile: 'ra2', ...a.f.mission });
  const options = { contentIdentity: a.f.world.model.contentIdentity, difficulty: 1 as const, timingPolicy: 'yr-static-15-frame-1' as const };
  const copied = JSON.parse(JSON.stringify(logic)); copied.actions[0].instructions[0].parameters[1] = 'OTHER';
  const changed = await compileMissionProgram(copied, options, async b => hashCueFixture(b), a.cues);
  assert.equal(changed.program, null); assert.ok(changed.diagnostics.some(d => d.code === 'unsupported-action-cue'));
  const other = await fixture('yr'); await assert.rejects(() => compileMissionProgram(logic, options, async b => hashCueFixture(b), other.cues), /mission-cue-source/);
});
test('actual private source steps produce bounded branded requests in action order and old cursors confer no authority', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const a = await fixture(profile), model = a.model!, initial = createMissionWorld(model), result = stepMissionWorld(model, initial);
    const batch = result.presentation!; assert.ok(isMissionWorldPresentation(model, batch));
    assert.equal(isMissionWorldPresentation(model, { ...batch }), false);
    assert.deepEqual(batch.requests.map(e => e.payload.kind), ['text', 'camera-waypoint', 'radar-waypoint']);
    assert.deepEqual(batch.requests.map(e => e.sequence), [0, 1, 2]); assert.deepEqual(batch.requests.map(e => e.vmOrder), [1, 2, 3]);
    assert.ok(batch.requests.every(e => e.bindingId === e.instanceId && e.triggerId === 'trigger:start' && !e.playbackAuthorized));
    assert.equal(batch.stateSha256, worldHash(result.checkpoint)); assert.equal(batch.sourceDispatchVerified, true); assert.equal(batch.nativePresentationVerified, false);
    assert.equal(initial.presentation!.nextSequence, 0); assert.equal(result.checkpoint.presentation!.nextSequence, 3);
    const caller = appendMissionCues(a.cues, createMissionCueState(a.cues), { tick: 0, invocations: [{ instructionId: a.cues.instructions[0]!.id, instanceId: 'invented' }] });
    assert.equal(isMissionWorldPresentation(model, caller), false);
    assert.ok(Object.isFrozen(batch.requests[0]!.payload)); assert.equal(stepMissionWorld(model, result.checkpoint).presentation!.requests.length, 0);
  }
});
test('repeating cues restore every boundary, share clocks with orders and replay their exact cursor', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const a = await fixture(profile, { repeat: true }), model = a.model!;
    const initial = admitMissionWorld(model, createMissionWorld(model), { commands: [{ schemaVersion: 1, tick: 2, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 1, x: 3, y: 3 } }], flags: [] });
    let state = initial; const requests = [];
    for (let tick = 0; tick < 8; tick++) {
      const result = stepMissionWorld(model, state); assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, JSON.stringify(state))), result);
      requests.push(...result.presentation!.requests); state = result.checkpoint;
      assert.equal(state.presentation!.tick, tick); assert.equal(state.presentation!.nextSequence, (tick + 1) * 3);
    }
    const grouped = stepMissionWorld(model, initial, 8); assert.deepEqual(grouped.checkpoint, state); assert.deepEqual(grouped.presentation!.requests, requests);
    const replayed = replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial, admissions: [], finalNextTick: 8, finalStateSha256: worldHash(state) });
    assert.deepEqual(replayed.checkpoint, state); assert.deepEqual(replayed.presentation!.requests, requests);
    assert.ok(isMissionWorldPresentation(model, replayed.presentation));
  }
});
test('cursor substitution, clock corruption and late payload/work failures reject atomically', async () => {
  const a = await fixture('ra2', { repeat: true, text: 'X'.repeat(4096), actions: Array(3).fill(defaultActions[0]!) }), model = a.model!, initial = createMissionWorld(model), before = JSON.stringify(initial);
  for (const changed of [{ catalogSha256: '0'.repeat(64) }, { tick: 1 }, { nextSequence: 1 }]) {
    assert.throws(() => restoreMissionWorld(model, { ...initial, presentation: { ...initial.presentation, ...changed } }));
  }
  assert.throws(() => restoreMissionWorld(model, { ...initial, presentation: undefined }));
  assert.throws(() => stepMissionWorld(model, initial, 86), /cue-payload-limit/); assert.equal(JSON.stringify(initial), before);
  const one = stepMissionWorld(model, initial); assert.throws(() => stepMissionWorld(model, initial, 2, one.work), /work-limit/);
  assert.equal(JSON.stringify(initial), before); assert.equal(initial.presentation!.nextSequence, 0);
});

test('forced, disabled and deleted source instances preserve nested cue order without invented polling', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const actions = ['11,4,MSG,0,0,0,0,A', '22,2,Target,0,0,0,0,A', '53,2,Target,0,0,0,0,A', '22,2,Target,0,0,0,0,A', '12,2,Target,0,0,0,0,A', '22,2,Target,0,0,0,0,A', '55,0,16,0,0,0,0,A'];
    const sourceMap = `[Triggers]\nCaller=Blue,<none>,Caller,0,1,1,1,0\nTarget=Blue,<none>,Target,1,1,1,1,0\n[Tags]\nRoot=0,Root,Caller\nTarget=2,Target,Target\n[Events]\nCaller=1,8,0,0\nTarget=1,14,0,0\n[Actions]\nCaller=${actions.length},${actions.join(',')}\nTarget=1,48,0,2,0,0,0,0,A`;
    const a = await fixture(profile, { sourceMap }); assert.ok(a.model, JSON.stringify(a.prepared));
    const initial = createMissionWorld(a.model), result = stepMissionWorld(a.model, initial);
    assert.deepEqual(result.presentation!.requests.map(e => e.payload.kind), ['text', 'camera-waypoint', 'radar-waypoint']);
    assert.deepEqual(result.presentation!.requests.map(e => e.vmOrder), [1, 5, 8]);
    assert.deepEqual(result.presentation!.requests.map(e => e.triggerId), ['trigger:caller', 'trigger:target', 'trigger:caller']);
    assert.equal(stepMissionWorld(a.model, result.checkpoint).presentation!.requests.length, 0);
    assert.deepEqual(replayMissionWorld(a.model, { schemaVersion: 1, modelSha256: a.model.sha256, initialCheckpoint: initial, admissions: [], finalNextTick: 1, finalStateSha256: worldHash(result.checkpoint) }).presentation!.requests, result.presentation!.requests);
  }
});
test('programs without cue selection keep their checkpoint schema and legacy identities', async () => {
  const a = await fixture('ra2', { actions: ['28,0,0,0,0,0,0,A'] });
  const first = await prepareMissionBindings(a.bindings), second = await prepareMissionBindings(a.bindings, undefined); assert.ok(first.authority); assert.ok(second.authority);
  assert.equal(first.authority.program.sha256, second.authority.program.sha256); assert.equal(missionProgramCues(first.authority.program), null);
  const flags = compileMissionInitialFlags({ bindings: a.bindings, bytes: a.f.mission.bytes, initialization: 'new-campaign' });
  const model = compileMissionWorld({ world: a.f.world.model, bindings: first.authority, flags });
  assert.equal(Object.hasOwn(model, 'cueCatalogSha256'), false);
  const initial = createMissionWorld(model); assert.equal(Object.hasOwn(initial, 'presentation'), false);
  const result = stepMissionWorld(model, initial); assert.equal(Object.hasOwn(result, 'presentation'), false);
  assert.throws(() => restoreMissionWorld(model, { ...initial, presentation: createMissionCueState(a.cues) }));
});
