// SPDX-License-Identifier: GPL-3.0-or-later
// Original complete mission/team source fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalText } from '../../packages/sim/src/canonical.ts';
import { createHash } from 'node:crypto';
import { missionTeamFixture } from './mission-team-fixture.ts';
import { compileMissionTeamActionSource } from '../../packages/sim/src/mission-team-action-source.ts';
import { prepareMissionBindings, missionBindingSourceContext } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionProgram, missionProgramTeamActions, MissionLogic, replayMission, MISSION_TIMING_POLICY } from '../../packages/sim/src/mission-logic.ts';
const digest = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function setup(options: Parameters<typeof missionTeamFixture>[0] = {}) {
  const f = missionTeamFixture(options), prepared = await prepareMissionBindings(f.bindings, undefined, undefined, undefined, f.source);
  assert.ok(prepared.authority, JSON.stringify(prepared.compilation?.diagnostics));
  assert.ok(prepared.compilation!.coverage.filter(c => c.namespace === 'action' && [4, 7, 80].includes(c.opcode)).every(c => c.effectOnly));
  const program = prepared.authority.program, initial = { bindings: prepared.authority.bindings, globals: Array<boolean>(50).fill(false), locals: Array<boolean>(100).fill(false) };
  return { ...f, program, initial, vm: () => MissionLogic.create(program, initial) };
}
test('genuine complete source admits exact 4/7/80 requests with saved global effect order', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await setup({ profile }), vm = f.vm(), result = vm.step();
    assert.equal(missionProgramTeamActions(f.program), f.source);
    assert.equal(f.program.teamActionSourceSha256, f.source.sha256);
    assert.deepEqual(result.effects.map(e => [e.order, e.tick, e.opcode, e.kind, e.value, e.target]),
      [4, 7, 80].map((opcode, i) => [i + 1, 0, opcode, 'team-request', 0, null]));
    assert.deepEqual(result.effects.map(e => e.instructionId), f.source.actions.map(a => a.instructionId));
    assert.equal(vm.save().nextEffectOrder, 4);
    const restored = MissionLogic.restore(f.program, JSON.stringify(vm.save()));
    assert.deepEqual(restored.step(), vm.step()); assert.deepEqual(restored.save(), vm.save());
    await assert.rejects(replayMission(f.program, {} as never, digest), /team-replay-requires-world/);
  }
});
test('forced repeated instructions and deletion retain exact entered action order', async () => {
  const extraMap = '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\nOther=Blue,<none>,Other,0,1,1,1,0\n'+
    '[Tags]\nShared=0,Shared,Start\nOtherTag=2,Other,Other\n[Events]\nStart=1,8,0,0\nOther=1,0,0,0\n'+
    '[Actions]\nStart=5,22,2,Other,0,0,0,0,A,22,2,Other,0,0,0,0,A,12,2,Start,0,0,0,0,A,7,1,Squad,0,0,0,0,A,28,0,2,0,0,0,0,A\n'+
    'Other=1,80,1,Squad,0,0,0,0,A\n[CellTags]\n2003=OtherTag';
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await setup({ profile, extraMap }), vm = f.vm(), result = vm.step();
    assert.deepEqual(result.effects.map(e => e.opcode), [22, 80, 22, 80, 12, 7, 28]);
    const requests = result.effects.filter(e => e.kind === 'team-request');
    assert.deepEqual(requests.map(e => e.order), [2, 4, 6]);
    assert.equal(requests[0]!.instructionId, requests[1]!.instructionId);
    assert.notEqual(requests[0]!.order, requests[1]!.order);
    assert.equal(vm.save().globals[2], true); assert.equal(vm.save().nextEffectOrder, 8);
    assert.deepEqual(vm.step().effects, []);
  }
});
test('source readiness, exact bindings and complete declaration/operand identity cannot be replaced by metadata', async () => {
  const f = missionTeamFixture(), other = missionTeamFixture();
  await assert.rejects(prepareMissionBindings(f.bindings, undefined, undefined, undefined, { ...f.source }), /team-source/);
  await assert.rejects(prepareMissionBindings(f.bindings, undefined, undefined, undefined, other.source), /team-source/);
  let reads = 0;
  await assert.rejects(prepareMissionBindings(f.bindings, undefined, undefined, undefined, new Proxy(f.source, { get() { reads++; throw Error('read'); } })), /team-source/);
  assert.equal(reads, 0);
  const config = { contentIdentity: f.world.model.contentIdentity, difficulty: 1 as const, timingPolicy: MISSION_TIMING_POLICY };
  const compile = (logic: ReturnType<typeof missionBindingSourceContext>['logic']) => compileMissionProgram(logic, config, digest, undefined, undefined, undefined, f.source);
  const altered = structuredClone(missionBindingSourceContext(f.bindings).logic);
  Object.defineProperty(altered.actions[0]!.instructions[0]!, 'parameters', { value: ['1', 'Wrong', '0', '0', '0', '0', 'A'] });
  const operand = await compile(altered); assert.equal(operand.program, null); assert.ok(operand.diagnostics.some(d => d.code === 'unsupported-action-team-source'));
  const declaration = structuredClone(missionBindingSourceContext(f.bindings).logic);
  Object.defineProperty(declaration, 'teams', { value: [{ id: 'team:uncovered' }] });
  const covered = await compile(declaration); assert.equal(covered.program, null); assert.ok(covered.diagnostics.some(d => d.code === 'unsupported-team-declaration-identity'));
  const partial = compileMissionTeamActionSource({ ...f.input, spawnCatalogs: [] });
  assert.equal((await prepareMissionBindings(f.bindings, undefined, undefined, undefined, partial)).authority, null);
  const automatic = missionTeamFixture({ extraTeam: 'Waypoint=A\nAutocreate=yes' });
  assert.equal((await prepareMissionBindings(automatic.bindings, undefined, undefined, undefined, automatic.source)).authority, null);
});

test('large complete declaration comparisons use bounded source shape and preserve mismatch diagnostics', async () => {
  const names = Array.from({ length: 80 }, (_, i) => 'Original' + i);
  const extraMap = '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=0,Shared,Start\n[Events]\nStart=1,8,0,0\n[Actions]\nStart=1,4,1,Squad,0,0,0,0,A\n[ScriptTypes]\n' +
    names.map((n, i) => i + '=' + n).join('\n') + '\n' + names.map(n => '[' + n + ']\n' + Array.from({ length: 12 }, (_, i) => i + '=50,1').join('\n')).join('\n');
  const f = missionTeamFixture({ extraMap }), logic = missionBindingSourceContext(f.bindings).logic;
  assert.throws(() => canonicalText(logic.scripts), /json-structure-limit/);
  const options = { contentIdentity: f.world.model.contentIdentity, difficulty: 1 as const, timingPolicy: MISSION_TIMING_POLICY };
  const clone = structuredClone(logic), result = await compileMissionProgram(clone, options, digest, undefined, undefined, undefined, f.source);
  assert.equal(result.program, null); assert.ok(!result.diagnostics.some(d => d.code === 'unsupported-team-declaration-identity'));
  Object.defineProperty(clone.scripts[0]!, 'name', { value: 'Changed' });
  assert.ok((await compileMissionProgram(clone, options, digest, undefined, undefined, undefined, f.source)).diagnostics.some(d => d.code === 'unsupported-team-declaration-identity'));
  let calls = 0; Object.defineProperty(clone.scripts[0]!, 'name', { get() { calls++; return 'Original0'; } });
  assert.ok((await compileMissionProgram(clone, options, digest, undefined, undefined, undefined, f.source)).diagnostics.some(d => d.code === 'unsupported-team-declaration-identity'));
  assert.equal(calls, 0);
});
