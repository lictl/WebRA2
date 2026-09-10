// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { recruitmentFixture } from './team-recruitment-fixture.ts';
import { compileTeamProgram } from '../../packages/sim/src/team-runtime-program.ts';
import { createTeamCheckpoint, bindTeamActors, bindRecruitedTeamActors, migrateRecruitedTeamCheckpoint, prepareTeamTick, restoreTeamCheckpoint } from '../../packages/sim/src/team-runtime.ts';
import { stepTeamWorld, replayTeamWorld, admitTeamWorldCommands } from '../../packages/sim/src/team-runtime-world.ts';
import { restoreTeamRecruitmentContext as restoreContext, teamRecruitmentContextData as data } from '../../packages/sim/src/team-recruitment-context.ts';
import { prepareTeamRecruitmentSelection as prepare, commitTeamRecruitmentSelection as commit } from '../../packages/sim/src/team-recruitment-selection.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
const command = (id: number, tick = 0) => ({ schemaVersion: 1, tick, playerId: 1, sequence: 0, kind: 'stop', payload: { entityId: id } });

test('Flash50 assigns once, decays per tick and preserves native zero-counter bit through Sleep/restore/replay', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = recruitmentFixture({ profile, script: '0=50,4\n1=50,0\n2=11,0\n3=50,8' });
    const roster = bindTeamActors(f.program, [{ id: 'script', teamId: 'team:squad', actorIds: [1] }]);
    const initial = prepareTeamTick(roster, createTeamCheckpoint(roster));
    assert.deepEqual(initial.pending!.nextTeam.flashes, [{ entityId: 1, remaining: 4, flashingNow: false }]);
    let checkpoint = initial;
    for (let tick = 0; tick < 20; tick++) {
      const run = stepTeamWorld(roster, checkpoint); checkpoint = run.checkpoint;
      assert.deepEqual(restoreTeamCheckpoint(roster, JSON.stringify(checkpoint)), checkpoint);
      assert.deepEqual(replayTeamWorld(roster, { schemaVersion: 1, rosterSha256: roster.sha256, initialCheckpoint: initial,
        admissions: [], finalNextTick: checkpoint.world.nextTick, finalStateSha256: worldHash(checkpoint) }).checkpoint, checkpoint);
      if (tick === 0) assert.equal(checkpoint.team.flashes[0]!.remaining, 4);
      else assert.deepEqual(checkpoint.team.flashes, [{ entityId: 1, remaining: 0, flashingNow: true }]);
    }
    assert.equal(checkpoint.team.instances[0]!.phase, 'sleep'); assert.equal(checkpoint.team.instances[0]!.cursor, 2);
    assert.equal(checkpoint.team.nextOrderId, 1);
    const hostile = structuredClone(initial); hostile.pending!.nextTeam.flashes[0] = { entityId: 1, remaining: 5, flashingNow: false };
    assert.throws(() => restoreTeamCheckpoint(roster, hostile), /pending-plan-mismatch/);
    const over = structuredClone(checkpoint); over.team.flashes[0] = { entityId: 1, remaining: 9, flashingNow: false };
    assert.throws(() => restoreTeamCheckpoint(roster, over), /checkpoint-flash-source/);
    const actor = structuredClone(checkpoint); actor.team.flashes[0] = { entityId: 3, remaining: 1, flashingNow: false };
    assert.throws(() => restoreTeamCheckpoint(roster, actor), /checkpoint-flash-source/);
    actor.team.flashes[0] = { entityId: 2, remaining: 1, flashingNow: false };
    assert.throws(() => restoreTeamCheckpoint(roster, actor), /checkpoint-flash-source/);
  }
});
test('Flash does not permit negative wrapping or hide later unsupported instructions', () => {
  const f = recruitmentFixture();
  for (const script of ['0=50,-1', '0=50,4\n1=5,1', '0=50,4\n1=11,1']) {
    assert.throws(() => recruitmentFixture({ script }), /unsupported-script/);
  }
  assert(compileTeamProgram({ teams: f.teams, world: f.world, mission: f.mission, teamIds: ['team:squad'] }).program);
});
test('recruitment migration preserves unrelated queues, advancing state and Flash after terminal release', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = recruitmentFixture({ profile, script: '0=50,8' }), c0 = restoreContext(f.catalog, []), r0 = bindRecruitedTeamActors(c0);
    let checkpoint = stepTeamWorld(r0, createTeamCheckpoint(r0), 3).checkpoint;
    checkpoint = admitTeamWorldCommands(r0, checkpoint, [command(3, 8)]);
    const selected = commit(f.catalog, c0, checkpoint.world, prepare(f.catalog, c0, checkpoint.world, f.input.actionIds[0]!));
    const r1 = bindRecruitedTeamActors(selected.context), migrated = migrateRecruitedTeamCheckpoint(c0, checkpoint, selected.context);
    assert.deepEqual(migrated.world, checkpoint.world); assert.equal(migrated.team.startedTick, 0); assert.equal(r1.bindings[0]!.bornAtTick, 3);
    const pending = prepareTeamTick(r1, migrated); assert.throws(() => migrateRecruitedTeamCheckpoint(selected.context, pending, selected.context));
    const terminal = stepTeamWorld(r1, pending, 2).checkpoint; assert.equal(terminal.team.instances[0]!.phase, 'finished');
    assert.equal(terminal.team.flashes[0]!.remaining, 7);
    const release = { kind: 'released', ordinal: 1, instanceId: selected.record.instanceId, atTick: terminal.world.nextTick, reason: 'finished' };
    const c2 = restoreContext(f.catalog, [selected.record, release]), released = migrateRecruitedTeamCheckpoint(selected.context, terminal, c2), r2 = bindRecruitedTeamActors(c2);
    assert.equal(released.team.instances.length, 0); assert.deepEqual(released.team.flashes, terminal.team.flashes); assert.deepEqual(released.world, terminal.world);
    const final = stepTeamWorld(r2, released, 10).checkpoint; assert.equal(final.team.flashes[0]!.remaining, 0); assert.equal(final.team.flashes[0]!.flashingNow, false);
    assert.deepEqual(restoreTeamCheckpoint(r2, JSON.stringify(final)), final);
    assert.throws(() => migrateRecruitedTeamCheckpoint(selected.context, migrated, restoreContext(f.catalog, [selected.record, { ...release, atTick: 4 }])), /release/);
    const wrong = restoreContext(f.catalog, [selected.record, { ...release, reason: 'lost' }]);
    assert.throws(() => migrateRecruitedTeamCheckpoint(selected.context, terminal, wrong), /release/);
    assert.equal(data(c2).eligibility.find(e => e.entityId === 2)!.releasedMissionUnverified, true);
  }
});
test('recruitment cannot take queued actors, alter existing cursors or release a sleeping live member', () => {
  const f = recruitmentFixture({ script: '0=11,0' }), c0 = restoreContext(f.catalog, []), r0 = bindRecruitedTeamActors(c0), start = createTeamCheckpoint(r0);
  const first = commit(f.catalog, c0, start.world, prepare(f.catalog, c0, start.world, f.input.actionIds[0]!));
  const before = migrateRecruitedTeamCheckpoint(c0, start, first.context), r1 = bindRecruitedTeamActors(first.context);
  const asleep = stepTeamWorld(r1, before).checkpoint;
  const second = commit(f.catalog, first.context, asleep.world, prepare(f.catalog, first.context, asleep.world, f.input.actionIds[0]!));
  const after = migrateRecruitedTeamCheckpoint(first.context, asleep, second.context);
  assert.deepEqual(after.team.instances.find(i => i.id === first.record.instanceId), asleep.team.instances[0]);
  assert.equal(after.team.nextOrderId, asleep.team.nextOrderId); assert.deepEqual(after.world, asleep.world);
  const release = restoreContext(f.catalog, [first.record, { kind: 'released', ordinal: 1, instanceId: first.record.instanceId, atTick: 1, reason: 'finished' }]);
  assert.throws(() => migrateRecruitedTeamCheckpoint(first.context, asleep, release), /release/);
  const queued = admitTeamWorldCommands(r0, start, [{ ...command(2, 8), playerId: 0 }]);
  assert.throws(() => migrateRecruitedTeamCheckpoint(c0, queued, first.context), /busy/);
  assert.throws(() => admitTeamWorldCommands(r1, asleep, [{ ...command(2, 1), playerId: 0, sequence: 1 }]), /competing-actor/);
  const dead = structuredClone(asleep); dead.world.state.entities[1]!.health = 0;
  const lost = stepTeamWorld(r1, dead).checkpoint;
  const c2 = restoreContext(f.catalog, [first.record, { kind: 'released', ordinal: 1, instanceId: first.record.instanceId, atTick: 2, reason: 'lost' }]);
  assert.equal(migrateRecruitedTeamCheckpoint(first.context, lost, c2).team.instances.length, 0);
});
