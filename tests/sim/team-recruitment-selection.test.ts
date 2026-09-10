// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { recruitmentFixture } from './team-recruitment-fixture.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
import { prepareTeamRecruitmentSelection as prepare, commitTeamRecruitmentSelection as commit } from '../../packages/sim/src/team-recruitment-selection.ts';
import { restoreTeamRecruitmentContext as restore, teamRecruitmentContextData as data } from '../../packages/sim/src/team-recruitment-context.ts';

test('both profiles select full source forces by distance, preserve rank and prevent duplicate ownership', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = recruitmentFixture({ profile }), save = WorldSimulation.create(f.world.model).save(), context = restore(f.catalog, []), action = f.input.actionIds[0]!;
    const initialHash = worldHash(save), p = prepare(f.catalog, context, save, action);
    assert.equal(p.status, 'selected'); assert.deepEqual(p.actorIds, [2]);
    const first = commit(f.catalog, context, save, p); assert.deepEqual(data(first.context).actors.map(a => a.rankRaw), [100]);
    const q = prepare(f.catalog, first.context, save, action); assert.deepEqual(q.actorIds, [1]);
    const second = commit(f.catalog, first.context, save, q), third = prepare(f.catalog, second.context, save, action);
    assert.equal(third.status, 'unavailable'); assert.deepEqual(third.actorIds, []); assert(third.reasons.includes('claimed-member'));
    assert.equal(worldHash(save), initialHash); assert.equal(data(context).records.length, 0);
    assert.deepEqual(data(restore(f.catalog, JSON.parse(JSON.stringify(data(second.context).records)))), data(second.context));
    assert.throws(() => commit(f.catalog, first.context, save, p), /selection-plan/);
    assert.throws(() => prepare(f.catalog, { ...context }, save, action), /context-brand/);
  }
});
test('stable IDs break distance ties; source group and recruitment flags retain independent native gates', () => {
  const tied = recruitmentFixture({ extraTeam: 'Waypoint=B' }), save = WorldSimulation.create(tied.world.model).save();
  // A missing source recruitment anchor is not replaced with a synthetic coordinate.
  assert.equal(prepare(tied.catalog, restore(tied.catalog, []), save, tied.input.actionIds[0]!).status, 'unsupported-source');
  const row = (n: number, rank: number, group: number, a: number, b: number) => `${n}=Commander,Walker,256,2,3,0,Guard,0,None,${rank},${group},0,${a},${b}`;
  const f = recruitmentFixture({ infantryRows: row(0, 0, -1, 1, 1)+'\n'+row(1, 100, -1, 1, 1) });
  assert.deepEqual(prepare(f.catalog, restore(f.catalog, []), WorldSimulation.create(f.world.model).save(), f.input.actionIds[0]!).actorIds, [1]);
  for (const [extraTeam, a, b, group, expected] of [
    ['Waypoint=A', 0, 1, -1, false], ['Waypoint=A\nAutocreate=yes', 0, 1, -1, true],
    ['Waypoint=A\nAutocreate=yes', 1, 0, -1, false], ['Waypoint=A', 1, 0, -1, true],
    ['Waypoint=A\nGroup=7', 1, 1, -1, false], ['Waypoint=A\nGroup=7\nRecruiter=yes', 1, 1, -1, true],
    ['Waypoint=A\nGroup=-2', 1, 1, 99, true],
  ] as const) {
    const f = recruitmentFixture({ extraTeam, infantryRows: row(0, 0, group, a, b) });
    const p = prepare(f.catalog, restore(f.catalog, []), WorldSimulation.create(f.world.model).save(), f.input.actionIds[0]!);
    assert.equal(p.status === 'selected', expected);
    if (expected) {
      const next = commit(f.catalog, restore(f.catalog, []), WorldSimulation.create(f.world.model).save(), p);
      assert.equal(data(next.context).eligibility[0]!.group, f.catalog.templates[0]!.group);
    }
  }
});
test('busy/dead/queued/insufficient members return no partial force; work failure and rejected commit are atomic', () => {
  const f = recruitmentFixture({ count: 2 }), context = restore(f.catalog, []), action = f.input.actionIds[0]!, sim = WorldSimulation.create(f.world.model);
  sim.admitCommands([{ schemaVersion: 1, tick: 10, playerId: 0, sequence: 0, kind: 'stop', payload: { entityId: 2 } }]);
  const save = sim.save(), p = prepare(f.catalog, context, save, action); assert.equal(p.status, 'unavailable'); assert.deepEqual(p.actorIds, []);
  assert(p.reasons.includes('busy-member')); assert.throws(() => commit(f.catalog, context, save, p));
  const fresh = WorldSimulation.create(f.world.model).save(), dead = structuredClone(fresh); dead.state.entities[1]!.health = 0;
  assert(prepare(f.catalog, context, dead, action).reasons.includes('dead-member'));
  const moving = WorldSimulation.create(f.world.model);
  moving.admitCommands([{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 2, x: 3, y: 3 } }]); moving.step(1);
  assert(prepare(f.catalog, context, moving.save(), action).reasons.includes('busy-member'));
  const budget = prepare(f.catalog, context, fresh, action, 1); assert.equal(budget.status, 'budget-exhausted'); assert.deepEqual(budget.actorIds, []);
  assert.equal(data(context).records.length, 0); assert.deepEqual(sim.save(), save);
  const good = prepare(f.catalog, context, fresh, action), hostile = { ...good }; let calls = 0;
  Object.defineProperty(hostile, 'actionId', { enumerable: true, get() { calls++; return action; } });
  assert.throws(() => commit(f.catalog, context, fresh, hostile)); assert.equal(calls, 0);
  assert.throws(() => commit(f.catalog, context, fresh, { ...good, actorIds: [3, 2] }));
  assert.throws(() => prepare(f.catalog, context, { ...fresh, schemaVersion: 99 }, action));
});
test('append-only release retains group/B mutations, disallows invented owner history, and gates unproved idle mission reuse', () => {
  const f = recruitmentFixture({ extraTeam: 'Waypoint=A\nGroup=7\nRecruiter=yes\nAreTeamMembersRecruitable=no' });
  const context = restore(f.catalog, []), save = WorldSimulation.create(f.world.model).save(), action = f.input.actionIds[0]!;
  const first = commit(f.catalog, context, save, prepare(f.catalog, context, save, action));
  const release = { kind: 'released', ordinal: 1, instanceId: first.record.instanceId, atTick: 1, reason: 'finished' };
  const next = restore(f.catalog, [first.record, release]), state = data(next).eligibility.find(a => a.entityId === first.record.actorIds[0])!;
  assert.equal(state.group, 7); assert.equal(state.recruitableB, false); assert.equal(state.claimedBy, null);
  assert.equal(state.releasedMissionUnverified, true); assert.equal(data(next).instances.length, 0);
  const sim = WorldSimulation.create(f.world.model); sim.step(1);
  const selected = prepare(f.catalog, next, sim.save(), action); assert.deepEqual(selected.actorIds, [1]);
  assert(selected.reasons.includes('released-mission-unverified'));
  assert.throws(() => restore(f.catalog, [first.record, { ...first.record, ordinal: 1, instanceId: 'recruit-team:1' }]));
  assert.throws(() => restore(f.catalog, [first.record, { ...release, atTick: 0 }]));
  assert.throws(() => restore(f.catalog, [first.record, release, { ...release, ordinal: 2 }]));
  assert.throws(() => restore(f.catalog, [{ ...first.record, actorIds: [3] }]));
  assert.throws(() => restore(f.catalog, [first.record, release, { ...first.record, ordinal: 2, instanceId: 'recruit-team:2', bornAtTick: 2 }]));
});
