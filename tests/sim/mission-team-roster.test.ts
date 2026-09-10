// SPDX-License-Identifier: GPL-3.0-or-later
// Original direct migration tests, separate from whole mission execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-fixture.ts';
import { restoreMissionTeamContext, missionTeamContextData, type MissionTeamRecord, type MissionTeamContext } from '../../packages/sim/src/mission-team-context.ts';
import { planMissionTeamClaim } from '../../packages/sim/src/mission-team-selection.ts';
import { bindMissionTeamActors, migrateMissionTeamCheckpoint, createTeamCheckpoint, prepareTeamTick, type TeamCheckpoint } from '../../packages/sim/src/team-runtime.ts';
import { commitTeamTick } from '../../packages/sim/src/team-runtime-world.ts';
import { WorldSimulation, type WorldSave } from '../../packages/sim/src/world.ts';

function appendWorld(context: MissionTeamContext, prior: WorldSave, record: MissionTeamRecord): WorldSave {
  const data = missionTeamContextData(context);
  return WorldSimulation.restore(data.model, record.kind === 'spawned' ? { ...prior, state: { ...prior.state, modelSha256: data.model.sha256,
    entities: [...prior.state.entities, ...record.actors.map(a => ({ id: a.entityId, x: a.x, y: a.y, health: a.initialHealth, goal: null, route: [], progress: 0, waitTicks: 0 }))] } } : prior).save();
}
function claim(context: MissionTeamContext, prior: TeamCheckpoint, actionId: string) {
  const data = missionTeamContextData(context), plan = planMissionTeamClaim(context, prior.world, actionId, data.runtime.limits.tickWork);
  assert.equal(plan.status, 'ready'); assert.ok(plan.record);
  const next = restoreMissionTeamContext(data.runtime, [...data.records, plan.record]);
  return { context: next, record: plan.record, checkpoint: migrateMissionTeamCheckpoint(context, prior, next, appendWorld(next, prior.world, plan.record)) };
}
test('mixed source claims conserve one world and controller state, and release preserves historical Flash', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = missionTeamFixture({ profile }), empty = restoreMissionTeamContext(f.runtime, []), initial = createTeamCheckpoint(bindMissionTeamActors(empty));
    const recruited = claim(empty, initial, f.source.actions.find(a => a.opcode === 4)!.instructionId);
    const spawned = claim(recruited.context, recruited.checkpoint, f.source.actions.find(a => a.opcode === 7)!.instructionId);
    assert.equal(spawned.checkpoint.world.nextTick, 0); assert.equal(spawned.checkpoint.team.instances.length, 2);
    assert.deepEqual(spawned.checkpoint.world.state.entities.slice(0, initial.world.state.entities.length), initial.world.state.entities);
    const roster = bindMissionTeamActors(spawned.context); let state = spawned.checkpoint;
    for (let tick = 0; tick < 2; tick++) state = commitTeamTick(roster, prepareTeamTick(roster, state)).checkpoint;
    assert.ok(state.team.instances.every(s => s.phase === 'finished')); assert.ok(state.team.flashes.length > 0);
    let context = spawned.context;
    for (const instance of state.team.instances) {
      const data = missionTeamContextData(context), next = restoreMissionTeamContext(f.runtime, [...data.records,
        { kind: 'released', ordinal: data.records.length, instanceId: instance.id, atTick: state.world.nextTick, reason: 'finished' }]);
      const after = migrateMissionTeamCheckpoint(context, state, next, state.world);
      assert.deepEqual(after.world, state.world); assert.deepEqual(after.team.flashes, state.team.flashes);
      state = after; context = next;
    }
    assert.equal(state.team.instances.length, 0); assert.equal(missionTeamContextData(context).historyBindings.length, 2);
    assert.ok(missionTeamContextData(context).eligibility.filter(a => a.releasedMissionUnverified).length === 2);
    assert.deepEqual(createTeamCheckpoint(bindMissionTeamActors(empty)), initial);
  }
});
test('migration refuses a busy claim, changed world, multiple records and uncommitted team plans atomically', () => {
  const f = missionTeamFixture(), empty = restoreMissionTeamContext(f.runtime, []), roster = bindMissionTeamActors(empty), initial = createTeamCheckpoint(roster);
  const id = f.source.actions.find(a => a.opcode === 4)!.instructionId, plan = planMissionTeamClaim(empty, initial.world, id, f.runtime.limits.tickWork);
  assert.ok(plan.record && plan.record.kind === 'recruited');
  const next = restoreMissionTeamContext(f.runtime, [plan.record]), actorId = plan.record.actorIds[0]!;
  const world = WorldSimulation.restore(f.world.model, initial.world);
  world.admitCommands([{ schemaVersion: 1, tick: 0, sequence: 0, playerId: 0, kind: 'stop', payload: { entityId: actorId } }]);
  const busy = { ...initial, world: world.save() };
  assert.throws(() => migrateMissionTeamCheckpoint(empty, busy, next, busy.world), /migration-busy/);
  const changed = structuredClone(initial.world); changed.state.entities[0]!.health = 50;
  assert.throws(() => migrateMissionTeamCheckpoint(empty, initial, next, changed), /migration-world/);
  assert.throws(() => migrateMissionTeamCheckpoint(empty, prepareTeamTick(roster, initial), next, initial.world), /migration-pending/);
  const first = claim(empty, initial, id), second = claim(first.context, first.checkpoint, id);
  assert.throws(() => migrateMissionTeamCheckpoint(empty, initial, second.context, second.checkpoint.world), /migration-prefix/);
  assert.throws(() => bindMissionTeamActors({ ...next }), /context-brand/);
  assert.deepEqual(createTeamCheckpoint(roster), initial);
});
test('a structurally valid constructed history cannot bypass live occupancy or constructor conservation', () => {
  const f = missionTeamFixture(), empty = restoreMissionTeamContext(f.runtime, []), initial = createTeamCheckpoint(bindMissionTeamActors(empty));
  const plan = planMissionTeamClaim(empty, initial.world, f.source.actions.find(a => a.opcode === 80)!.instructionId, f.runtime.limits.tickWork);
  assert.ok(plan.record && plan.record.kind === 'spawned');
  const record = { ...plan.record, actors: plan.record.actors.map((a, index) => index === 0 ?
    { ...a, x: initial.world.state.entities[0]!.x, y: initial.world.state.entities[0]!.y } : { ...a }) };
  const occupied = restoreMissionTeamContext(f.runtime, [record]);
  assert.throws(() => migrateMissionTeamCheckpoint(empty, initial, occupied, appendWorld(occupied, initial.world, record)), /occupied/);
  const proper = restoreMissionTeamContext(f.runtime, [plan.record]), changed = appendWorld(proper, initial.world, plan.record);
  changed.state.entities.at(-1)!.health!--;
  assert.throws(() => migrateMissionTeamCheckpoint(empty, initial, proper, changed), /migration-world/);
  assert.deepEqual(createTeamCheckpoint(bindMissionTeamActors(empty)), initial);
});
