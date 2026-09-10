// SPDX-License-Identifier: GPL-3.0-or-later
// Original complete source fixtures; no retail data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-fixture.ts';
import { prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileMissionWorld, createMissionWorld, stepMissionWorld, restoreMissionWorld, admitMissionWorld, replayMissionWorld, isMissionWorldPresentation } from '../../packages/sim/src/mission-world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
import { compileMissionCues } from '../../packages/content/src/mission-cues.ts';
import { cueCsf, hashCueFixture } from '../content/mission-cue.fixture.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionObjectEventSource } from '../../packages/sim/src/mission-object-event-source.ts';
import { prepareMissionTeamTick } from '../../packages/sim/src/mission-team-runtime.ts';
const base = '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=0,Shared,Start\n[Events]\nStart=1,8,0,0\n[Actions]\n';
async function setup(options: Parameters<typeof missionTeamFixture>[0] = {}, withCues = false) {
  const f = missionTeamFixture(options), profile = f.world.model.contentIdentity.profile, strings = cueCsf([{ label: 'MSG', text: 'Original 提示' }]);
  const cues = withCues ? compileMissionCues({ profile, mission: { ...f.mission, path: 'fixture.map' },
    strings: { path: profile === 'ra2' ? 'ra2.csf' : 'ra2md.csf', sha256: hashCueFixture(strings), bytes: strings } }) : undefined;
  const prepared = await prepareMissionBindings(f.bindings, cues, undefined, undefined, f.source);
  assert.ok(prepared.authority, JSON.stringify(prepared.compilation?.diagnostics));
  const flags = compileMissionInitialFlags({ bindings: f.bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  const model = compileMissionWorld({ world: f.world.model, bindings: prepared.authority, flags });
  return { ...f, prepared, model, initial: createMissionWorld(model) };
}
test('private VM receipts queue for the next tick and mixed claims share one world and release history', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await setup({ profile }), initial = f.initial;
    assert.equal(f.model.teamActionSourceSha256, f.source.sha256); assert.equal(f.model.canStartCampaign, false);
    const first = stepMissionWorld(f.model, initial);
    assert.equal(first.checkpoint.world.nextTick, 1); assert.equal(first.checkpoint.world.state.entities.length, 3);
    assert.deepEqual(first.teams, { actions: [], orders: [], events: [] });
    assert.deepEqual(first.checkpoint.teams!.requests.map(q => [q.effectOrder, q.emittedAtTick, q.dueTick, q.attempts]), [[1, 0, 1, 0], [2, 0, 1, 0], [3, 0, 1, 0]]);
    const second = stepMissionWorld(f.model, first.checkpoint);
    assert.equal(second.checkpoint.world.nextTick, 2); assert.equal(second.checkpoint.mission.nextTick, 2);
    assert.deepEqual(second.checkpoint.world, second.checkpoint.teams!.team.world);
    assert.deepEqual(second.teams!.actions.map(e => e.kind), ['recruited', 'spawned', 'spawned']);
    assert.equal(second.checkpoint.world.state.entities.length, 5);
    const instances = second.checkpoint.teams!.team.team.instances; assert.equal(instances.length, 3);
    assert.deepEqual(instances.map(i => i.activeMembers[0]), [2, 4, 5]);
    assert.equal(second.checkpoint.teams!.team.team.flashes.length, 3);
    const third = stepMissionWorld(f.model, second.checkpoint);
    assert.equal(third.teams!.actions.filter(e => e.kind === 'released').length, 3);
    assert.equal(third.checkpoint.teams!.team.team.instances.length, 0);
    assert.equal(third.checkpoint.teams!.team.team.flashes.length, 3);
    assert.equal(third.checkpoint.teams!.requests.length, 3); assert.deepEqual(third.effects, []);
    assert.deepEqual(initial, createMissionWorld(f.model));
  }
});
test('every completed boundary restores, batches and replay reproduce requests, movement and Flash without extra clocks', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await setup({ profile, script: '0=3,0\n1=50,8' });
    const admission = { commands: [{ schemaVersion: 1 as const, tick: 0, playerId: 1, sequence: 0, kind: 'stop', payload: { entityId: 3 } }],
      flags: [{ tick: 2, sequence: 0, kind: 'local' as const, index: 0, value: true }] };
    const initial = admitMissionWorld(f.model, f.initial, admission); let checkpoint = initial;
    for (let tick = 0; tick < 20; tick++) {
      const a = stepMissionWorld(f.model, checkpoint), b = stepMissionWorld(f.model, restoreMissionWorld(f.model, JSON.stringify(checkpoint)));
      assert.deepEqual(a, b); checkpoint = a.checkpoint;
      assert.equal(checkpoint.world.nextTick, tick + 1); assert.equal(checkpoint.teams!.team.team.nextTick, tick + 1);
    }
    const batch = stepMissionWorld(f.model, initial, 20);
    assert.deepEqual(batch.checkpoint, checkpoint); assert.equal(checkpoint.mission.locals[0], true);
    const replay = replayMissionWorld(f.model, { schemaVersion: 1, modelSha256: f.model.sha256, initialCheckpoint: f.initial,
      admissions: [{ nextTick: 0, input: admission }], finalNextTick: 20, finalStateSha256: worldHash(checkpoint) });
    assert.deepEqual(replay, batch);
    const savedRequests = stepMissionWorld(f.model, initial).checkpoint;
    const continuation = replayMissionWorld(f.model, { schemaVersion: 1, modelSha256: f.model.sha256, initialCheckpoint: savedRequests,
      admissions: [], finalNextTick: 20, finalStateSha256: worldHash(checkpoint) });
    assert.deepEqual(continuation.checkpoint, checkpoint);
  }
});
test('forced repeated actions, deletion and presentation preserve global order and saved receipt identity', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const extraMap = '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\nOther=Blue,<none>,Other,0,1,1,1,0\n'+
      '[Tags]\nShared=0,Shared,Start\nOtherTag=2,Other,Other\n[Events]\nStart=1,8,0,0\nOther=1,0,0,0\n'+
      '[Actions]\nStart=5,22,2,Other,0,0,0,0,A,11,4,MSG,0,0,0,0,A,22,2,Other,0,0,0,0,A,12,2,Start,0,0,0,0,A,7,1,Squad,0,0,0,0,A\nOther=1,80,1,Squad,0,0,0,0,A\n[CellTags]\n2003=OtherTag';
    const f = await setup({ profile, extraMap }, true), first = stepMissionWorld(f.model, f.initial);
    assert.deepEqual(first.effects.map(e => e.opcode), [22, 80, 11, 22, 80, 12, 7]);
    assert.deepEqual(first.checkpoint.teams!.requests.map(q => q.effectOrder), [2, 5, 7]);
    assert.equal(first.checkpoint.teams!.requests[0]!.instructionId, first.checkpoint.teams!.requests[1]!.instructionId);
    assert.ok(isMissionWorldPresentation(f.model, first.presentation)); assert.equal(first.presentation!.requests[0]!.vmOrder, 3);
    const second = stepMissionWorld(f.model, first.checkpoint); assert.equal(second.teams!.actions.filter(e => e.kind === 'spawned').length, 3);
    assert.equal(second.presentation!.requests.length, 0);
    const replay = replayMissionWorld(f.model, { schemaVersion: 1, modelSha256: f.model.sha256, initialCheckpoint: f.initial,
      admissions: [], finalNextTick: 2, finalStateSha256: worldHash(second.checkpoint) });
    assert.deepEqual(replay.checkpoint, second.checkpoint); assert.deepEqual(replay.presentation!.requests, first.presentation!.requests);
  }
});
test('commands, forged clocks/receipts, pending team candidates and late resource failure roll back atomically', async () => {
  const f = await setup(), first = stepMissionWorld(f.model, f.initial), second = stepMissionWorld(f.model, first.checkpoint), before = JSON.stringify(second.checkpoint);
  const command = { schemaVersion: 1 as const, tick: 2, playerId: 0, sequence: 0, kind: 'stop', payload: { entityId: 2 } };
  assert.throws(() => admitMissionWorld(f.model, second.checkpoint, { commands: [command], flags: [] }), /competing-actor-command/);
  assert.throws(() => admitMissionWorld(f.model, second.checkpoint, { commands: [], flags: [], requests: [] } as never));
  for (const edit of [
    (v: any) => { v.world = structuredClone(v.world); v.world.state.entities[0].health--; },
    (v: any) => { v.teams.requests[0].effectOrder = v.mission.nextEffectOrder; },
    (v: any) => { v.teams.requests[0].effectOrder = 0; },
    (v: any) => { v.teams.requests[0].emittedAtTick = v.mission.nextTick; },
    (v: any) => { v.teams.requests[0].bindingId = 'forged'; },
    (v: any) => { v.mission.nextTick++; },
  ]) { const changed = structuredClone(second.checkpoint); edit(changed); assert.throws(() => restoreMissionWorld(f.model, changed)); }
  const pending = prepareMissionTeamTick(f.runtime, second.checkpoint.teams!);
  assert.throws(() => restoreMissionWorld(f.model, { ...second.checkpoint, teams: pending }), /team-world/);
  const one = stepMissionWorld(f.model, second.checkpoint);
  assert.deepEqual(stepMissionWorld(f.model, second.checkpoint, 1, one.work), one);
  assert.throws(() => stepMissionWorld(f.model, second.checkpoint, 1, one.work - 1), /work/);
  assert.throws(() => stepMissionWorld(f.model, first.checkpoint, 2, second.work), /work|budget/);
  assert.equal(JSON.stringify(second.checkpoint), before);
});
test('competing CreateTeam claims retry without reusing actors and persistent Sleep remains owned', async () => {
  const f = await setup({ script: '0=11,0', extraMap: base + 'Start=3,4,1,Squad,0,0,0,0,A,4,1,Squad,0,0,0,0,A,4,1,Squad,0,0,0,0,A' });
  const at2 = stepMissionWorld(f.model, f.initial, 2).checkpoint;
  assert.deepEqual(at2.teams!.requests.map(q => q.status), ['recruited', 'recruited', 'queued']);
  assert.equal(at2.teams!.requests[2]!.nextAttemptTick, 16);
  const later = stepMissionWorld(f.model, at2, 16).checkpoint;
  assert.deepEqual(later.teams!.team.team.instances.map(i => i.phase), ['sleep', 'sleep']);
  assert.equal(later.teams!.requests[2]!.attempts, 2); assert.equal(later.teams!.requests[2]!.nextAttemptTick, 31);
});

test('initial actor event catalogs cannot authorize dynamic constructed actors through the compound', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await setup({ profile });
    const cells = compileMissionCellEntrySource({ bindings: f.bindings }), objects = compileMissionObjectEventSource({ bindings: f.bindings });
    const flags = compileMissionInitialFlags({ bindings: f.bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
    for (const [cell, object] of [[cells, undefined], [undefined, objects]] as const) {
      const prepared = await prepareMissionBindings(f.bindings, undefined, cell, object, f.source);
      assert.ok(prepared.authority, JSON.stringify(prepared.compilation?.diagnostics));
      assert.throws(() => compileMissionWorld({ world: f.world.model, bindings: prepared.authority!, flags }), /team-dynamic-event-context/);
    }
  }
});
