// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSleepInstruction, teamSleepFlow, planTeamSleep, type TeamSleepMember } from '../../packages/sim/src/team-sleep-policy.ts';

const alive = (entityId: number): TeamSleepMember => ({ entityId, health: 100, goal: null, progress: 0, routeLength: 0 });
test('Sleep recognizes only exact numeric mission zero; script jumps can bypass but never complete a Sleep barrier', () => {
  const sleep = teamSleepInstruction(11, 0, 7)!;
  assert.deepEqual(sleep, { opcode: 11, mission: 0, sourceSlot: 7 });
  for (const [op, arg] of [[11, 11], [11, 6], [11, -1], [11, -0], [null, 0], [50, 0], [11, null]] as const) assert.equal(teamSleepInstruction(op, arg, 0), null);
  assert.throws(() => teamSleepInstruction(11, 0, 50));
  assert.deepEqual(teamSleepFlow([{ opcode: 3 }, sleep, { opcode: 3 }]), { reachableSteps: [0, 1], canFinish: false });
  assert.deepEqual(teamSleepFlow([{ opcode: 6, target: 2 }, sleep, { opcode: 3 }]), { reachableSteps: [0, 2], canFinish: true });
  assert.deepEqual(teamSleepFlow([{ opcode: 3 }, { opcode: 6, target: 0 }, sleep]), { reachableSteps: [0, 1], canFinish: false });
  assert.throws(() => teamSleepFlow([sleep, { opcode: 99 } as never]), /instruction/);
  assert.throws(() => teamSleepFlow([sleep, { opcode: 6, target: 4 }]), /integer/);
});
test('entry stops each living member once; persistent sleep requires stationary observations and retains the entry tick', () => {
  const members = [{ ...alive(1), goal: 3000, progress: 5, routeLength: 2 }, { ...alive(2), health: 0 }, alive(3)];
  const input = { tick: 8, enteredAt: null, members }, before = structuredClone(input);
  assert.deepEqual(planTeamSleep(input), { policy: 'webra2-team-sleep-stationary-1', phase: 'sleep', enteredAt: 8,
    activeMembers: [1, 3], stopActorIds: [1, 3], work: 4 });
  assert.deepEqual(input, before);
  assert.throws(() => planTeamSleep({ ...input, tick: 9, enteredAt: 8 }), /world-motion/);
  const held = planTeamSleep({ tick: 100, enteredAt: 8, members: [alive(1), { ...alive(3), health: 0 }] });
  assert.equal(held.phase, 'sleep'); assert.equal(held.enteredAt, 8); assert.deepEqual(held.activeMembers, [1]); assert.deepEqual(held.stopActorIds, []);
  const lost = planTeamSleep({ tick: 101, enteredAt: 8, members: [{ ...alive(1), health: 0 }] });
  assert.equal(lost.phase, 'lost'); assert.equal(lost.enteredAt, null); assert.deepEqual(lost.stopActorIds, []);
  assert.ok(Object.isFrozen(held) && Object.isFrozen(held.activeMembers));
});
test('policy rejects ambiguous identities/ticks, untyped health, hostile getters and resource overflow before expansion', () => {
  const input = { tick: 0, enteredAt: null, members: [alive(1)] };
  assert.throws(() => planTeamSleep(input, { orders: 0 }), /order-limit/);
  assert.throws(() => planTeamSleep(input, { members: 0 }), /array-limit/);
  assert.throws(() => planTeamSleep({ ...input, members: [alive(1), alive(1)] }), /member-order/);
  assert.throws(() => planTeamSleep({ ...input, members: [{ ...alive(1), health: null }] }), /untyped-health/);
  assert.throws(() => planTeamSleep({ ...input, enteredAt: 0 }), /integer/);
  assert.throws(() => planTeamSleep({ ...input, tick: -0 }), /integer/);
  let calls = 0;
  const hostile = Object.defineProperty({}, 'entityId', { enumerable: true, get() { calls++; return 1; } });
  assert.throws(() => planTeamSleep({ ...input, members: [hostile as TeamSleepMember] }));
  assert.throws(() => planTeamSleep(input, Object.defineProperty({}, 'members', { enumerable: true, get() { calls++; return 1; } })));
  assert.throws(() => teamSleepFlow([Object.defineProperty({}, 'opcode', { get() { calls++; return 11; } }) as never]));
  assert.equal(calls, 0);
});
