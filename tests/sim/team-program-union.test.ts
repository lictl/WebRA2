// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature source fixtures, no retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamProgram, unionTeamPrograms, teamProgramWorld, isTeamProgram } from '../../packages/sim/src/team-runtime-program.ts';
import { bindTeamActors, createTeamCheckpoint, prepareTeamTick, restoreTeamCheckpoint } from '../../packages/sim/src/team-runtime.ts';
import { commitTeamTick, stepTeamWorld, teamWorldStep } from '../../packages/sim/src/team-runtime-world.ts';
import { worldStepCombatObservations } from '../../packages/sim/src/world.ts';

function fixture(profile: 'ra2' | 'yr' = 'ra2') {
  const f = teamSpawnFixture({ profile, extraTeamTypes: '1=Reserve', extraAI: '[Reserve]\nHouse=Blue\nTaskForce=Troop\nScript=Route\nWaypoint=A' });
  const other = compileTeamProgram({ teams: f.teams, world: f.world, mission: f.mission, teamIds: ['team:reserve'] });
  const both = compileTeamProgram({ teams: f.teams, world: f.world, mission: f.mission, teamIds: ['team:squad', 'team:reserve'] });
  assert.ok(f.compilation.program); assert.ok(other.program); assert.ok(both.program);
  return { f, first: f.compilation.program, other: other.program, both: both.program };
}
test('complete program union has canonical order, exact overlapping templates and aggregate bounds', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const s = fixture(profile), before = JSON.stringify(s.first);
    const union = unionTeamPrograms([s.first, s.other]);
    assert.equal(isTeamProgram(union), true); assert.equal(teamProgramWorld(union), s.f.world);
    assert.deepEqual(union, unionTeamPrograms([s.other, s.first]));
    assert.deepEqual(union.templates, s.both.templates);
    assert.deepEqual(unionTeamPrograms([s.both, s.first]).templates, s.both.templates);
    assert.ok(Object.isFrozen(union)); assert.ok(Object.isFrozen(union.sourceProgramSha256s));
    assert.notEqual(union.sha256, s.both.sha256); assert.equal(JSON.stringify(s.first), before);
    assert.throws(() => unionTeamPrograms([s.first, s.other], { teams: 1 }), /union-limit/);
    assert.throws(() => unionTeamPrograms([s.first, s.other], { members: 1 }), /union-limit/);
    assert.throws(() => unionTeamPrograms([s.first, s.other], { steps: 3 }), /union-limit/);
    assert.throws(() => unionTeamPrograms([s.first, s.other], { work: 0 }), /union-work/);
    const small = compileTeamProgram({ teams: s.f.teams, world: s.f.world, mission: s.f.mission, teamIds: ['team:squad'] }, { trace: 5 }).program!;
    assert.equal(unionTeamPrograms([small, s.other], { trace: 10 }).limits.trace, 5);
  }
});
test('union refuses copied or hostile programs, duplicate selection and conflicting source worlds', () => {
  const s = fixture();
  assert.throws(() => unionTeamPrograms([]), /union-empty/);
  assert.throws(() => unionTeamPrograms([s.first, s.first]), /union-program/);
  assert.throws(() => unionTeamPrograms([{ ...s.first }]), /union-program/);
  let reads = 0;
  assert.throws(() => unionTeamPrograms([new Proxy(s.first, { get() { reads++; throw Error('read'); } })]), /union-program/);
  assert.equal(reads, 0);
  assert.throws(() => unionTeamPrograms([s.first, fixture('yr').first]), /union-source/);
  const different = teamSpawnFixture({ speed: 64 }).compilation.program!;
  assert.throws(() => unionTeamPrograms([s.first, different]), /union-source/);
  assert.throws(() => unionTeamPrograms([s.first], { teams: 65 }), /integer/);
});
test('one team commit retains its own immutable world transition; copies and batches confer no receipt', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const s = fixture(profile), union = unionTeamPrograms([s.first, s.other]);
    const roster = bindTeamActors(union, [{ id: 'first', teamId: 'team:squad', actorIds: [1] }, { id: 'second', teamId: 'team:reserve', actorIds: [2] }]);
    const initial = createTeamCheckpoint(roster), prepared = prepareTeamTick(roster, initial);
    const result = commitTeamTick(roster, prepared), step = teamWorldStep(s.f.world.model, result);
    assert.equal(step.nextTick, initial.world.nextTick + 1); assert.deepEqual(step.events, result.worldEvents);
    assert.ok(Object.isFrozen(step)); assert.ok(Object.isFrozen(step.work));
    const facts = worldStepCombatObservations(s.f.world.model, step);
    assert.equal(facts.fromNextTick, 0); assert.equal(facts.toNextTick, 1); assert.deepEqual(facts.damage, []);
    assert.deepEqual(result, stepTeamWorld(roster, initial));
    assert.throws(() => teamWorldStep(s.f.world.model, { ...result }), /world-step-brand/);
    assert.throws(() => teamWorldStep(s.f.world.model, stepTeamWorld(roster, initial)), /world-step-brand/);
    let reads = 0;
    assert.throws(() => teamWorldStep(s.f.world.model, new Proxy(result, { get() { reads++; throw Error('read'); } })), /world-step-brand/);
    assert.equal(reads, 0);
    assert.throws(() => teamWorldStep(fixture(profile).f.world.model, result), /world-step-brand/);
    assert.throws(() => commitTeamTick(roster, prepared, 0), /work-limit/);
    assert.deepEqual(createTeamCheckpoint(roster), initial);
  }
});

test('bounded planning and exact prepared reuse preserve results and reject exhausted or altered plans', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const s = fixture(profile), roster = bindTeamActors(s.first, [{ id: 'first', teamId: 'team:squad', actorIds: [1] }]);
    const initial = createTeamCheckpoint(roster), prepared = prepareTeamTick(roster, initial), work = prepared.pending!.work;
    assert.ok(work > 0);
    assert.deepEqual(prepareTeamTick(roster, initial, work), prepared);
    assert.equal(prepareTeamTick(roster, prepared, work), prepared);
    assert.equal(restoreTeamCheckpoint(roster, prepared, work), prepared);
    const parsed = restoreTeamCheckpoint(roster, JSON.stringify(prepared), work);
    assert.notEqual(parsed, prepared); assert.deepEqual(parsed, prepared);
    assert.deepEqual(commitTeamTick(roster, parsed), commitTeamTick(roster, prepared));
    for (const input of [initial, prepared, structuredClone(prepared)]) {
      assert.throws(() => prepareTeamTick(roster, input, work - 1), /budget|work-limit/);
      assert.throws(() => commitTeamTick(roster, input, 0));
    }
    const altered = structuredClone(prepared); altered.pending!.work--;
    assert.throws(() => restoreTeamCheckpoint(roster, altered), /pending-plan-mismatch/);
    assert.throws(() => prepareTeamTick(roster, initial, -1), /integer/);
    const result = commitTeamTick(roster, prepared);
    assert.deepEqual(stepTeamWorld(roster, initial, 1, result.work), result);
    assert.throws(() => stepTeamWorld(roster, initial, 1, result.work - 1));
    assert.deepEqual(initial, createTeamCheckpoint(roster));
  }
});
