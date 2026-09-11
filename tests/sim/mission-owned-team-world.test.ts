// SPDX-License-Identifier: GPL-3.0-or-later
// Original complete miniature missions, no retail rows or expected native saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-fixture.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { createWorldModel, worldPosition, worldHash } from '../../packages/sim/src/world-model.ts';
import { compileMissionWorld, createMissionWorld, stepMissionWorld, restoreMissionWorld, replayMissionWorld, admitMissionWorld } from '../../packages/sim/src/mission-world.ts';
import { compileMissionTeamOwnedBinding } from '../../packages/sim/src/mission-team-owned-binding.ts';
import { compileMissionTeamRuntime } from '../../packages/sim/src/mission-team-context.ts';
import { restoreMissionTeamCheckpointWithWork, admitMissionTeamInputWithWork, stepMissionTeamWorld } from '../../packages/sim/src/mission-team-runtime.ts';
import { createMissionActionWorldContext } from '../../packages/sim/src/mission-action-world-context.ts';
import { MissionLogic } from '../../packages/sim/src/mission-logic.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionSpatialAudioSource } from '../../packages/sim/src/mission-spatial-audio-source.ts';
import { compileMissionCues } from '../../packages/content/src/mission-cues.ts';
import { compileMissionAudioPlan } from '../../packages/content/src/mission-audio.ts';
import { prepareMissionAudioSamples } from '../../packages/content/src/mission-audio-samples.ts';
import { compileMissionAudioPolicy } from '../../packages/content/src/mission-audio-policy.ts';
import { audioFixture, planRoots } from '../content/mission-audio.fixture.ts';

const mission = (capture = false) => `[Triggers]
Start=Red,<none>,Transfer and recruit,0,1,1,1,0
Check=Red,<none>,Current population,0,1,1,1,0
${capture ? 'Capture=Blue,<none>,Capture active members,0,1,1,1,0' : ''}
[Tags]
AStart=0,Start,Start
ZCheck=0,Check,Check
${capture ? 'ZCapture=0,Capture,Capture' : ''}
[Events]
Start=1,8,0,0
Check=1,9,0,1
${capture ? 'Capture=1,36,0,0' : ''}
[Actions]
Start=2,36,0,0,0,0,0,0,A,4,1,Squad,0,0,0,0,A
Check=1,28,0,1,0,0,0,0,A
${capture ? 'Capture=1,36,0,1,0,0,0,0,A' : ''}`;

async function fixture(profile: 'ra2' | 'yr', options: { capture?: boolean; rules?: string; script?: string; cells?: boolean; spatial?: boolean } = {}) {
  let map = mission(options.capture);
  if (options.cells) map = map.replace('[Tags]', 'Cross=Blue,<none>,Arrival,0,1,1,1,0\n[Tags]')
    .replace('[Events]', 'Cell=0,Arrival,Cross\n[Events]').replace('[Actions]', 'Cross=1,1,0,0\n[Actions]') +
    '\nCross=1,28,0,2,0,0,0,0,A\n[CellTags]\n3003=Cell';
  if (options.spatial) map = map.replace('[Tags]', 'Stop=Blue,<none>,Stop loops,0,1,1,1,0\n[Tags]')
    .replace('[Events]', 'Stop=0,Stop,Stop\n[Events]').replace('[Actions]', 'Stop=1,36,0,0\n[Actions]')
    .replace('Start=2,36', 'Start=4,36').replace('Check=1,28', 'Stop=2,116,0,688,0,0,0,0,A,116,0,688,0,0,0,0,B\nCheck=1,28')
    .replace('4,1,Squad,0,0,0,0,A\n', '4,1,Squad,0,0,0,0,A,99,7,Alert,0,0,0,0,A,99,7,Finite,0,0,0,0,B\n');
  const f = missionTeamFixture({ profile, extraRules: options.rules ?? '', script: options.script ?? '0=3,0\n1=50,5',
    extraMap: map, waypoint: '0=3003\n1=4003', infantryRows: '0=Rival,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1' });
  const houses = compileMissionHouseSource({ bindings: f.bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const b = f.world.model, world = createWorldModel({ contentIdentity: b.contentIdentity, sourceSha256: b.sourceSha256,
    definitionsSha256: b.definitionsSha256, entities: b.entities, navigation: b.navigation, blocked: b.blocked.map(worldPosition),
    footprints: b.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: houses });
  const cells = options.cells ? compileMissionCellEntrySource({ bindings: f.bindings }) : undefined;
  const cues = options.spatial ? compileMissionCues({ profile, spatialAudio: true, mission: { ...f.mission, path: 'original.map' }, strings: null }) : undefined;
  let audio: ReturnType<typeof compileMissionAudioPolicy> | undefined;
  if (cues) {
    const source = audioFixture(profile), path = profile === 'ra2' ? 'sound.ini' : 'soundmd.ini';
    const sources = source.input.sources.map(s => s.path === path ? source.source(path,
      '[SoundList]\n0=Alert\n1=Finite\n[Alert]\nSounds=click\nControl=loop\nLoop=0\n[Finite]\nSounds=click\nControl=loop\nLoop=2\n') : s);
    const plan = compileMissionAudioPlan({ ...source.input, sources, cues });
    const samples = await prepareMissionAudioSamples(plan, planRoots(plan, source.roots));
    audio = compileMissionAudioPolicy({ cues, audio: samples, initialization: 'fresh-process-audio-load' });
  }
  const spatial = cues && audio ? compileMissionSpatialAudioSource({ bindings: f.bindings, cues, audio }) : undefined;
  const prepared = await prepareMissionBindings(f.bindings, cues, cells, undefined, f.source, audio, { houseSource: houses, ...(spatial ? { spatialAudioSource: spatial } : {}) });
  assert(prepared.authority, JSON.stringify(prepared.compilation?.diagnostics));
  const flags = compileMissionInitialFlags({ bindings: f.bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  return { ...f, houses, world, authority: prepared.authority, flags };
}

test('recruited fixed actors deliver source cell predicates only at actual current-owner crossings', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, { cells: true }), model = compileMissionWorld({ world: f.world, bindings: f.authority, flags: f.flags });
    const initial = createMissionWorld(model); let state = initial, crossings = 0, assignments = 0;
    for (let tick = 0; tick < 12; tick++) {
      const result = stepMissionWorld(model, state);
      const arrived = result.worldEvents.filter(e => e.kind === 'moved' && e.cell === 1539).length;
      const fired = result.effects.filter(e => e.opcode === 28 && e.target === 'global:2').length;
      assert.equal(fired, arrived); crossings += arrived; assignments += fired;
      assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, JSON.stringify(state))), result); state = result.checkpoint;
    }
    assert.equal(crossings, 1); assert.equal(assignments, 1); assert.equal(state.mission.globals[2], true);
    assert.deepEqual(stepMissionWorld(model, initial, 12).checkpoint, state);
  }
});

test('team movement preserves saved positional loop intent and does not replay finite starts after restore', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, { spatial: true }), model = compileMissionWorld({ world: f.world, bindings: f.authority, flags: f.flags });
    const initial = createMissionWorld(model), first = stepMissionWorld(model, initial), boundaries = [initial, first.checkpoint];
    assert.deepEqual(first.effects.map(e => e.opcode), [36, 4, 99, 99, 28]);
    assert.equal(first.spatialAudio!.requests.length, 2); assert.equal(first.checkpoint.spatialIntents!.loops.length, 1);
    for (let tick = 1; tick < 5; tick++) {
      const result = stepMissionWorld(model, boundaries.at(-1)!);
      assert.deepEqual(result.spatialAudio!.requests, []); assert.equal(result.checkpoint.spatialIntents!.loops.length, 1);
      boundaries.push(result.checkpoint);
    }
    const input = { commands: [], flags: [{ tick: 5, sequence: 0, kind: 'local' as const, index: 0, value: true }] };
    const armed = admitMissionWorld(model, boundaries.at(-1)!, input), stopped = stepMissionWorld(model, armed);
    assert.equal(stopped.spatialAudio!.requests.length, 2); assert.deepEqual(stopped.checkpoint.spatialIntents!.loops, []);
    assert.equal(stopped.checkpoint.spatialIntents!.nextSequence, 4);
    for (const boundary of boundaries) {
      const restored = restoreMissionWorld(model, JSON.stringify(boundary));
      const replay = replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: restored,
        admissions: [{ nextTick: 5, input }], finalNextTick: 6, finalStateSha256: worldHash(stopped.checkpoint) });
      assert.deepEqual(replay.checkpoint, stopped.checkpoint);
      assert.equal(replay.spatialAudio!.requests.length, boundary.world.nextTick === 0 ? 4 : 2);
    }
    assert.deepEqual(stepMissionWorld(model, initial, 1, first.work), first);
    assert.throws(() => stepMissionWorld(model, initial, 1, first.work - 1), /work/);
  }
});

test('one actual VM transfer feeds later population and next-tick recruitment in the same world', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile), model = compileMissionWorld({ world: f.world, bindings: f.authority, flags: f.flags });
    assert(model.teamOwnershipPolicy); assert.equal(model.canStartCampaign, false);
    const initial = createMissionWorld(model), first = stepMissionWorld(model, initial);
    assert.deepEqual(first.effects.map(e => e.opcode), [36, 4, 28]);
    assert.equal(first.checkpoint.world.state.ownership!.transfers.length, 1);
    assert.equal(first.checkpoint.world.state.entities[0]!.owner, 0);
    assert.equal(first.checkpoint.mission.globals[1], true);
    assert.equal(first.checkpoint.teams!.requests[0]!.status, 'queued');
    assert.equal(first.checkpoint.teams!.requests[0]!.dueTick, 1);
    const second = stepMissionWorld(model, first.checkpoint);
    assert.equal(second.teams!.actions[0]!.kind, 'recruited');
    assert.equal(second.checkpoint.teams!.history[0]!.kind === 'recruited' && second.checkpoint.teams!.history[0]!.ownershipRevision, 1);
    assert.equal(second.checkpoint.world.state.ownership!.transfers.length, 1);
    let current = initial, moved = false, flashed = false;
    for (let tick = 0; tick < 12; tick++) {
      const step = stepMissionWorld(model, current);
      assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, JSON.stringify(current))), step);
      assert.deepEqual(step.checkpoint.world, step.checkpoint.teams!.team.world);
      assert.equal(step.checkpoint.world.nextTick, tick + 1);
      moved ||= step.worldEvents.some(e => e.kind === 'moved'); flashed ||= step.teams!.events.some(e => e.kind === 'flash');
      current = step.checkpoint;
    }
    assert(moved); assert(flashed); assert.equal(current.teams!.history.at(-1)!.kind, 'released');
    const batch = stepMissionWorld(model, initial, 12);
    assert.deepEqual(batch.checkpoint, current);
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [], finalNextTick: 12, finalStateSha256: worldHash(current) }), batch);
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: second.checkpoint,
      admissions: [], finalNextTick: 12, finalStateSha256: worldHash(current) }).checkpoint, current);
    assert.deepEqual(initial, createMissionWorld(model));
  }
});

test('active transfer and exhausted compound work preserve both caller clocks and state', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await fixture(profile, { capture: true, script: '0=11,0' }), model = compileMissionWorld({ world: f.world, bindings: f.authority, flags: f.flags });
    const initial = createMissionWorld(model), first = stepMissionWorld(model, initial);
    assert.deepEqual(stepMissionWorld(model, initial, 1, first.work), first);
    assert.throws(() => stepMissionWorld(model, initial, 1, first.work - 1), /work/);
    const second = stepMissionWorld(model, first.checkpoint).checkpoint;
    const armed = admitMissionWorld(model, second, { commands: [], flags: [{ tick: 2, sequence: 0, kind: 'local', index: 0, value: true }] });
    const before = worldHash(armed);
    assert.throws(() => stepMissionWorld(model, armed), /active-owner-change/);
    assert.equal(worldHash(armed), before); assert.equal(armed.world.nextTick, 2); assert.equal(armed.mission.nextTick, 2);
    assert.deepEqual(restoreMissionWorld(model, JSON.stringify(armed)), armed);
  }
});

test('source transfer eligibility and exact budget wrappers stay explicit', async () => {
  const unsupported = await fixture('ra2', { rules: '[Sleep]\nRecruitable=no' });
  assert.throws(() => compileMissionWorld({ world: unsupported.world, bindings: unsupported.authority, flags: unsupported.flags }), /owned-team-source/);
  const f = await fixture('ra2'), binding = compileMissionTeamOwnedBinding({ source: f.source, world: f.world });
  const runtime = compileMissionTeamRuntime(f.source, {}, binding), model = compileMissionWorld({ world: f.world, bindings: f.authority, flags: f.flags });
  const initial = createMissionWorld(model).teams!, capture = restoreMissionTeamCheckpointWithWork(runtime, initial, runtime.limits.tickWork);
  assert(capture.work > 0); assert.deepEqual(restoreMissionTeamCheckpointWithWork(runtime, initial, capture.work), capture);
  assert.throws(() => restoreMissionTeamCheckpointWithWork(runtime, initial, capture.work - 1), /work/);
  const command = { schemaVersion: 1 as const, tick: 0, playerId: 1, sequence: 0, kind: 'stop', payload: { entityId: 1 } };
  const admission = { requests: [], commands: [command] }, admitted = admitMissionTeamInputWithWork(runtime, initial, admission, runtime.limits.tickWork);
  assert(admitted.work > 0); assert.deepEqual(admitMissionTeamInputWithWork(runtime, initial, admission, admitted.work), admitted);
  assert.throws(() => admitMissionTeamInputWithWork(runtime, initial, admission, admitted.work - 1), /work/);
});

test('the owned action context requires complete matching team state and is consumed on success or rollback', async () => {
  const f = await fixture('ra2'), model = compileMissionWorld({ world: f.world, bindings: f.authority, flags: f.flags });
  const initial = createMissionWorld(model), binding = compileMissionTeamOwnedBinding({ source: f.source, world: f.world });
  const runtime = compileMissionTeamRuntime(f.source, {}, binding), advanced = stepMissionTeamWorld(runtime, initial.teams!).checkpoint;
  const input = { world: f.world, bindings: f.authority, checkpoint: advanced.team.world, missionNextTick: 0,
    teams: { runtime, checkpoint: advanced } };
  const { teams: _teams, ...omitted } = input;
  assert.throws(() => createMissionActionWorldContext(omitted, 16_777_216), /team-source/);
  assert.throws(() => createMissionActionWorldContext({ ...input, teams: { ...input.teams, runtime: { ...runtime } } }, 16_777_216));
  assert.throws(() => createMissionActionWorldContext({ ...input, teams: { runtime, checkpoint: initial.teams! } }, 16_777_216), /team-world/);
  let gets = 0;
  assert.throws(() => createMissionActionWorldContext({ ...input, get teams() { gets++; return input.teams; } }, 16_777_216)); assert.equal(gets, 0);
  const context = createMissionActionWorldContext(input, 16_777_216), vm = MissionLogic.restore(f.authority.program, initial.mission), before = worldHash(advanced);
  const result = vm.stepWorldContext(context);
  assert.deepEqual(result.effects.map(e => e.opcode), [36, 4, 28]); assert(result.teams);
  assert.deepEqual(result.world, result.teams.team.world); assert.equal(result.world.state.ownership!.transfers.length, 1);
  assert.throws(() => vm.stepWorldContext(context), /context/); assert.equal(vm.save().nextTick, 1); assert.equal(worldHash(advanced), before);
  const failed = createMissionActionWorldContext(input, 16_777_216), fresh = MissionLogic.restore(f.authority.program, initial.mission);
  assert.throws(() => fresh.stepWorldContext(failed, [{ cellId: 'missing', entityId: 1 }]), /observation/);
  assert.deepEqual(fresh.save(), initial.mission); assert.throws(() => fresh.stepWorldContext(failed), /context/);
  assert.equal(worldHash(advanced), before);
});
