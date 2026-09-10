// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded Sleep policy. Source/native scope: ../TEAM_SLEEP_PROVENANCE.md.
import { WORLD_LIMITS, worldInteger, worldList, worldRecord } from './world-values.ts';

export const TEAM_SLEEP_POLICY = 'webra2-team-sleep-stationary-1' as const;
export const TEAM_SLEEP_LIMITS = Object.freeze({ members: 64, steps: 50, orders: 64 });
export interface TeamSleepInstruction { readonly opcode: 11; readonly mission: 0; readonly sourceSlot: number }
export type TeamSleepFlowInstruction = Readonly<{ opcode: 3 }> | Readonly<{ opcode: 6; target: number }> | TeamSleepInstruction;
export interface TeamSleepFlow { readonly reachableSteps: readonly number[]; readonly canFinish: boolean }
export interface TeamSleepMember {
  readonly entityId: number; readonly health: number | null; readonly goal: number | null;
  readonly progress: number; readonly routeLength: number;
}
export interface TeamSleepPlan {
  readonly policy: typeof TEAM_SLEEP_POLICY; readonly phase: 'sleep' | 'lost'; readonly enteredAt: number | null;
  readonly activeMembers: readonly number[]; readonly stopActorIds: readonly number[]; readonly work: number;
}
export class TeamSleepError extends Error {
  constructor(readonly code: string) { super(`team-sleep-${code}`); this.name = 'TeamSleepError'; }
}
function fail(code: string): never { throw new TeamSleepError(code); }

/** Numeric recognition only. The caller must establish the genuine full source/program join. */
export function teamSleepInstruction(opcode: number | null, argument: number | null, sourceSlot: number): TeamSleepInstruction | null {
  if (opcode !== 11 || argument !== 0 || Object.is(argument, -0)) return null;
  return Object.freeze({ opcode: 11, mission: 0, sourceSlot: worldInteger(sourceSlot, 0, TEAM_SLEEP_LIMITS.steps - 1) });
}

/** Follow only the admitted deterministic control flow. Sleep is a barrier, never an implicit completion. */
export function teamSleepFlow(steps: readonly TeamSleepFlowInstruction[]): TeamSleepFlow {
  const raw = worldList(steps, TEAM_SLEEP_LIMITS.steps), next: (number | null)[] = [];
  if (!raw.length) fail('empty-script');
  // Check every instruction before following the path; unreachable unsupported rows are not skipped.
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as TeamSleepFlowInstruction;
    if (!s || typeof s !== 'object' || !Object.hasOwn(s, 'opcode')) fail('instruction');
    const d = Object.getOwnPropertyDescriptor(s, 'opcode');
    if (!d || !('value' in d)) fail('instruction');
    if (d.value === 3) next.push(i + 1);
    else if (d.value === 6) {
      const target = Object.getOwnPropertyDescriptor(s, 'target');
      if (!target || !('value' in target)) fail('instruction');
      next.push(worldInteger(target.value, 0, raw.length - 1));
    } else if (d.value === 11) {
      const mission = Object.getOwnPropertyDescriptor(s, 'mission');
      if (!mission || !('value' in mission) || mission.value !== 0 || Object.is(mission.value, -0)) fail('mission');
      next.push(null);
    } else fail('instruction');
  }
  const reachable = new Set<number>(); let cursor: number | null = 0;
  while (cursor !== null && cursor < raw.length && !reachable.has(cursor)) {
    reachable.add(cursor); cursor = next[cursor]!;
  }
  return Object.freeze({ reachableSteps: Object.freeze([...reachable].sort((a, b) => a - b)), canFinish: cursor === raw.length });
}

/** Whole-cell D03 policy over validated actor observations; this function owns no world and submits no commands. */
export function planTeamSleep(input: { readonly tick: number; readonly enteredAt: number | null; readonly members: readonly TeamSleepMember[] },
  lowerLimits: { readonly members?: number; readonly orders?: number } = {}): TeamSleepPlan {
  const fields = Reflect.ownKeys(lowerLimits);
  if (fields.some(k => k !== 'members' && k !== 'orders')) fail('limits');
  const limits = worldRecord(lowerLimits, fields as string[]);
  const memberLimit = Object.hasOwn(limits, 'members') ? worldInteger(limits.members, 0, TEAM_SLEEP_LIMITS.members) : TEAM_SLEEP_LIMITS.members;
  const orderLimit = Object.hasOwn(limits, 'orders') ? worldInteger(limits.orders, 0, TEAM_SLEEP_LIMITS.orders) : TEAM_SLEEP_LIMITS.orders;
  const r = worldRecord(input, ['tick', 'enteredAt', 'members']), tick = worldInteger(r.tick);
  const enteredAt = r.enteredAt === null ? null : worldInteger(r.enteredAt, 0, tick - 1);
  const raw = worldList(r.members, memberLimit), active: number[] = []; let previous = 0;
  for (const row of raw) {
    const m = worldRecord(row, ['entityId', 'health', 'goal', 'progress', 'routeLength']);
    const id = worldInteger(m.entityId, 1, 2147483647);
    if (id <= previous) fail('member-order'); previous = id;
    const health = m.health === null ? null : worldInteger(m.health, 0, WORLD_LIMITS.health);
    const goal = m.goal === null ? null : worldInteger(m.goal, 0, 512 * 512 - 1);
    const progress = worldInteger(m.progress, 0, Number.MAX_SAFE_INTEGER), routeLength = worldInteger(m.routeLength, 0, WORLD_LIMITS.paths);
    if (health === null) fail('untyped-health');
    if (health === 0) continue;
    if (enteredAt !== null && (goal !== null || progress !== 0 || routeLength !== 0)) fail('world-motion');
    active.push(id);
  }
  if (enteredAt === null && active.length > orderLimit) fail('order-limit');
  return Object.freeze({ policy: TEAM_SLEEP_POLICY, phase: active.length ? 'sleep' : 'lost',
    enteredAt: active.length ? enteredAt ?? tick : null, activeMembers: Object.freeze(active),
    stopActorIds: Object.freeze(enteredAt === null ? [...active] : []), work: 1 + raw.length });
}
