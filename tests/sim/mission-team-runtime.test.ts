// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-transaction-fixture.ts';
import { createMissionTeamCheckpoint, admitMissionTeamInput, stepMissionTeamWorld, prepareMissionTeamTick, commitMissionTeamTick,
  restoreMissionTeamCheckpoint, replayMissionTeamWorld, missionTeamWorldStep, type MissionTeamCheckpoint } from '../../packages/sim/src/mission-team-runtime.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
import { worldStepCombatObservations } from '../../packages/sim/src/world.ts';
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function run(f: ReturnType<typeof missionTeamFixture>, checkpoint: MissionTeamCheckpoint, ticks: number) {
  let next = checkpoint; for (let i = 0; i < ticks; i++) next = stepMissionTeamWorld(f.runtime, next).checkpoint; return next;
}
test('4/7/80 share history, one tick, actor IDs and Flash/release across both profiles', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = missionTeamFixture({ profile }), base = createMissionTeamCheckpoint(f.runtime), before = worldHash(base);
    const admitted = admitMissionTeamInput(f.runtime, base, { requests: [f.receipt(0, 0), f.receipt(1, 2), f.receipt(2, 3)], commands: [] });
    const first = stepMissionTeamWorld(f.runtime, admitted); assert.equal(first.checkpoint.team.world.nextTick, 1); assert.equal(first.checkpoint.history.length, 0);
    const second = stepMissionTeamWorld(f.runtime, first.checkpoint), c = second.checkpoint;
    assert.equal(c.team.world.nextTick, 2); assert.deepEqual(c.history.map(h => h.kind), ['recruited', 'spawned', 'spawned']);
    assert.equal(c.team.team.instances.length, 3); assert.equal(c.team.team.flashes.length, 3); assert.equal(c.team.world.state.entities.length, 4);
    assert.deepEqual(c.history.map(h => h.ordinal), [0, 1, 2]); assert.equal(worldHash(base), before);
    const receipt = missionTeamWorldStep(second); assert.equal(receipt.step.nextTick, 2); assert.equal(receipt.model.sha256, c.team.world.state.modelSha256);
    assert.doesNotThrow(() => worldStepCombatObservations(receipt.model, receipt.step)); assert.throws(() => missionTeamWorldStep({ ...second }));
    const released = stepMissionTeamWorld(f.runtime, c).checkpoint; assert.equal(released.team.team.instances.length, 0);
    assert.equal(released.history.filter(h => h.kind === 'released').length, 3); assert.equal(released.team.team.flashes.length, 3);
    const settled = run(f, released, 7); assert(settled.team.team.flashes.every(x => !x.flashingNow && x.remaining === 0));
  }
});
test('repeated occurrence receipts contend on common claims and never spawn a replacement for shortage', () => {
  const f = missionTeamFixture(), base = createMissionTeamCheckpoint(f.runtime);
  const input = admitMissionTeamInput(f.runtime, base, { requests: [0,1,2].map(n => f.receipt(0, n)), commands: [] });
  const c = run(f, input, 2); assert.deepEqual(c.requests.map(r => r.status), ['recruited','recruited','queued']);
  assert.equal(c.team.world.state.entities.length, 2); assert.equal(c.requests[2]!.nextAttemptTick, 16);
  const after = run(f, c, 15); assert.equal(after.requests[2]!.status, 'queued'); assert.equal(after.requests[2]!.attempts, 2);
  assert.equal(after.history.filter(r => r.kind === 'spawned').length, 0);
});
test('pending candidates, every-boundary restore and replay preserve one transcript', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = missionTeamFixture({ profile, script: '0=3,0\n1=50,4\n2=11,0' }), initial = createMissionTeamCheckpoint(f.runtime);
    const admission = { requests: [f.receipt(1, 5)], commands: [] }, admitted = admitMissionTeamInput(f.runtime, initial, admission);
    const pending = prepareMissionTeamTick(f.runtime, admitted), restored = restoreMissionTeamCheckpoint(f.runtime, JSON.stringify(pending));
    assert.deepEqual(restored, pending); assert.deepEqual(commitMissionTeamTick(f.runtime, restored).checkpoint, stepMissionTeamWorld(f.runtime, admitted).checkpoint);
    const altered = copy(pending); (altered.pending as {tick:number}).tick++; assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, altered));
    let c = admitted;
    for (let i = 0; i < 18; i++) { const direct = stepMissionTeamWorld(f.runtime, c).checkpoint, reload = stepMissionTeamWorld(f.runtime, JSON.stringify(c)).checkpoint; assert.deepEqual(reload, direct); c = direct; }
    const replay = replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, ...admission }], finalNextTick: c.team.world.nextTick, finalStateSha256: worldHash(c) });
    assert.deepEqual(replay.checkpoint, c); assert(replay.work > 0); assert.throws(() => missionTeamWorldStep(replay));
    assert.equal(c.team.team.instances[0]!.phase, 'sleep'); assert(c.team.world.state.entities.filter(e => e.id > 2).every(e => e.goal === null && e.progress === 0));
  }
});
test('queued commands exclude recruitment; current team ownership rejects external Stop atomically', () => {
  const f = missionTeamFixture(), base = createMissionTeamCheckpoint(f.runtime), command = { schemaVersion: 1 as const, tick: 4, playerId: 0, sequence: 0, kind: 'stop' as const, payload: { entityId: 1 } };
  const input = admitMissionTeamInput(f.runtime, base, { requests: [f.receipt(0, 0)], commands: [command] }), c = run(f, input, 2);
  const claim = c.history[0]!; assert.equal(claim.kind, 'recruited'); if (claim.kind !== 'recruited') throw new Error('kind'); assert.deepEqual(claim.actorIds, [2]);
  const before = worldHash(c); assert.throws(() => admitMissionTeamInput(f.runtime, c, { requests: [], commands: [{ ...command, tick: 2, sequence: 1, payload: {entityId: 2} }] }));
  assert.equal(worldHash(c), before); assert.equal(c.team.world.queuedCommands.length, 1);
});
test('receipt impersonation, reordering, malformed input and late aggregate failures publish no state', () => {
  const f = missionTeamFixture(), initial = createMissionTeamCheckpoint(f.runtime), receipt = f.receipt(1, 2);
  for (const patch of [{opcode:4}, {instructionId:'missing'}, {triggerId:'other'}, {bindingId:'other'}, {dueTick:2}, {effectOrder:-1}, {emittedAtTick:2,dueTick:3}])
    assert.throws(() => admitMissionTeamInput(f.runtime, initial, { requests: [{ ...receipt, ...patch } as typeof receipt], commands: [] }));
  const admitted = admitMissionTeamInput(f.runtime, initial, { requests: [receipt], commands: [] });
  assert.throws(() => admitMissionTeamInput(f.runtime, admitted, { requests: [receipt], commands: [] }));
  assert.throws(() => admitMissionTeamInput(f.runtime, initial, { requests: Array(1), commands: [] }));
  const safe = new Proxy(receipt, { get() { throw new Error('unexpected-get'); } });
  assert.deepEqual(admitMissionTeamInput(f.runtime, initial, { requests: [safe], commands: [] }), admitted);
  const small = missionTeamFixture({}, { tickWork: 10 }), smallInitial = createMissionTeamCheckpoint(small.runtime);
  const smallAdmitted = admitMissionTeamInput(small.runtime, smallInitial, {requests:[small.receipt(1,0)],commands:[]});
  const at1 = stepMissionTeamWorld(small.runtime, smallAdmitted).checkpoint, hash = worldHash(at1);
  assert.throws(() => stepMissionTeamWorld(small.runtime, at1)); assert.equal(worldHash(at1), hash); assert.equal(at1.history.length, 0);
});
test('a failure after world stepping rolls back claims, command cursors, Flash and all candidate output', () => {
  const f = missionTeamFixture({}, { trace: 0 }), initial = createMissionTeamCheckpoint(f.runtime);
  const admitted = admitMissionTeamInput(f.runtime, initial, { requests: [f.receipt(0,0), f.receipt(1,1)], commands: [] });
  const at1 = stepMissionTeamWorld(f.runtime, admitted).checkpoint, before = JSON.stringify(at1);
  assert.throws(() => prepareMissionTeamTick(f.runtime, at1), /tick-trace/);
  assert.throws(() => stepMissionTeamWorld(f.runtime, at1), /tick-trace/);
  assert.equal(JSON.stringify(at1), before); assert.equal(at1.team.world.state.entities.length, 2);
  assert.deepEqual(at1.team.world.state.admissionCursors, []); assert.equal(at1.history.length, 0);
});

test('released ownership accepts external Stop but cannot satisfy later recruitment from an invented mission', () => {
  const f = missionTeamFixture(), initial = createMissionTeamCheckpoint(f.runtime);
  const admitted = admitMissionTeamInput(f.runtime, initial, { requests:[f.receipt(0,0),f.receipt(0,1)], commands:[] });
  const released = run(f, admitted, 3), command = {schemaVersion:1 as const,tick:3,playerId:0,sequence:0,kind:'stop' as const,payload:{entityId:1}};
  const next = admitMissionTeamInput(f.runtime, released, {requests:[f.receipt(0,5,3)],commands:[command]});
  const outcome = run(f, next, 2); assert.equal(outcome.requests.at(-1)!.status,'queued');
  assert.equal(outcome.team.world.queuedCommands.length,0); assert.equal(outcome.team.team.instances.length,0);
});

test('saved finished releases cannot erase persistent Sleep, cycles or too-early finite programs', () => {
  for (const profile of ['ra2','yr'] as const) for (const index of [0,1]) for (const script of ['0=11,0','0=6,1','0=50,8\n1=50,6']) {
    const f = missionTeamFixture({profile,script}), initial = createMissionTeamCheckpoint(f.runtime);
    const admitted = admitMissionTeamInput(f.runtime,initial,{requests:[f.receipt(index,0)],commands:[]});
    const c = run(f,admitted,2), claim = c.history[0]!; if(claim.kind==='released') throw new Error('claim');
    const forged={...c,history:[...c.history,{kind:'released',ordinal:1,instanceId:claim.instanceId,atTick:2,reason:'finished'}]};
    assert.throws(()=>restoreMissionTeamCheckpoint(f.runtime,forged));
    if(script==='0=50,8\n1=50,6') {
      const actual=run(f,c,2); assert.equal(actual.history.at(-1)!.kind,'released');
      assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime,JSON.stringify(actual)),actual);
    }
  }
});

test('caller work budget constrains preparation and pending recomputation without changing sufficient-budget results',()=>{
  const f=missionTeamFixture(),initial=createMissionTeamCheckpoint(f.runtime);
  const admitted=admitMissionTeamInput(f.runtime,initial,{requests:[f.receipt(1,0)],commands:[]});
  const at1=stepMissionTeamWorld(f.runtime,admitted).checkpoint, full=stepMissionTeamWorld(f.runtime,at1), before=worldHash(at1);
  assert.deepEqual(stepMissionTeamWorld(f.runtime,at1,full.work),full);
  assert.throws(()=>stepMissionTeamWorld(f.runtime,at1,full.work-1));assert.equal(worldHash(at1),before);
  const pending=prepareMissionTeamTick(f.runtime,at1);assert.deepEqual(stepMissionTeamWorld(f.runtime,pending,full.work).checkpoint,full.checkpoint);
  assert.throws(()=>stepMissionTeamWorld(f.runtime,JSON.stringify(pending),0),/work/);
});
