// SPDX-License-Identifier: GPL-3.0-or-later
// Original single-world team transaction and bounded saved request scheduler.
import type { CommandEnvelope } from '../../contracts/src/index.ts';
import { type WorldSave, type WorldStep, type WorldTrace, WorldSimulation } from './world.ts';
import type { WorldModel } from './world-model.ts';
import { worldHash, worldInteger, worldList, worldRecord, worldSymbol, worldSourceHash } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { bindMissionTeamActors, migrateMissionTeamCheckpoint, createTeamCheckpoint, restoreTeamCheckpoint,
  prepareTeamTick, type TeamCheckpoint, type TeamOrder, type TeamEvent } from './team-runtime.ts';
import { admitTeamWorldCommands, commitTeamTick, teamWorldStep } from './team-runtime-world.ts';
import { missionTeamActionSourceContext } from './mission-team-action-source.ts';
import { MISSION_TEAM_RUNTIME_POLICY, missionTeamRuntimeData, missionTeamContextData, restoreMissionTeamContext, missionTeamAction,
  type MissionTeamRuntime, type MissionTeamRecord, type MissionTeamContext } from './mission-team-context.ts';
import { planMissionTeamClaim } from './mission-team-selection.ts';
import { missionTeamFail as fail, missionTeamSnapshot } from './mission-team-values.ts';
export interface MissionTeamReceipt {
  readonly effectOrder: number; readonly emittedAtTick: number; readonly dueTick: number;
  readonly instructionId: string; readonly bindingId: string; readonly triggerId: string; readonly opcode: 4 | 7 | 80;
}
export interface MissionTeamRequest extends MissionTeamReceipt {
  readonly id: number; readonly status: 'queued' | 'spawned' | 'recruited' | 'exhausted';
  readonly attempts: number; readonly nextAttemptTick: number | null; readonly recordOrdinal: number | null;
}
export interface MissionTeamCheckpoint {
  readonly schemaVersion: 1; readonly policy: typeof MISSION_TEAM_RUNTIME_POLICY; readonly runtimeSha256: string;
  readonly history: readonly MissionTeamRecord[]; readonly nextRequestId: number; readonly lastEffectOrder: number;
  readonly requests: readonly MissionTeamRequest[]; readonly team: TeamCheckpoint; readonly pending: MissionTeamTick | null;
}
export interface MissionTeamEvent {
  readonly tick: number; readonly requestId: number; readonly instructionId: string;
  readonly kind: 'spawned' | 'recruited' | 'blocked' | 'exhausted' | 'released'; readonly recordOrdinal: number | null;
}
export interface MissionTeamTick {
  readonly policy: typeof MISSION_TEAM_RUNTIME_POLICY; readonly runtimeSha256: string; readonly baseSha256: string;
  readonly tick: number; readonly checkpoint: MissionTeamCheckpoint; readonly actionEvents: readonly MissionTeamEvent[];
  readonly orders: readonly TeamOrder[]; readonly events: readonly (TeamEvent & { tick: number })[];
  readonly worldEvents: readonly WorldTrace[]; readonly work: number; readonly sha256: string;
}
export interface MissionTeamResult {
  readonly checkpoint: MissionTeamCheckpoint; readonly actionEvents: readonly MissionTeamEvent[];
  readonly orders: readonly TeamOrder[]; readonly events: readonly (TeamEvent & { tick: number })[];
  readonly worldEvents: readonly WorldTrace[]; readonly work: number;
}
const receipts = new WeakMap<object, Readonly<{ model: WorldModel; step: WorldStep }>>();
/** Internal observation seam: only genuine single-tick results, never copied or replay-aggregated metadata. */
export function missionTeamWorldStep(result: MissionTeamResult): Readonly<{ model: WorldModel; step: WorldStep }> {
  const receipt = receipts.get(result); if (!receipt) fail('world-step-receipt'); return receipt;
}
const receiptKeys = ['effectOrder', 'emittedAtTick', 'dueTick', 'instructionId', 'bindingId', 'triggerId', 'opcode'] as const;
function sourceReceipt(runtime: MissionTeamRuntime, input: unknown): MissionTeamReceipt {
  const r = worldRecord(input, receiptKeys), cap = runtime.limits, instructionId = worldSymbol(r.instructionId), bindingId = worldSymbol(r.bindingId), triggerId = worldSymbol(r.triggerId);
  const { action } = missionTeamAction(runtime, instructionId), source = missionTeamRuntimeData(runtime).source;
  const binding = missionTeamActionSourceContext(source).bindings.tags.find(t => t.id === bindingId);
  if (action.triggerId !== triggerId || r.opcode !== action.opcode || !binding || !binding.allocated || !binding.runtimeChain.includes(triggerId)) fail('receipt-source');
  const effectOrder = worldInteger(r.effectOrder, 0, Number.MAX_SAFE_INTEGER), emittedAtTick = worldInteger(r.emittedAtTick, 0, cap.tick - 2);
  const dueTick = worldInteger(r.dueTick, 1, cap.tick - 1); if (dueTick !== emittedAtTick + 1) fail('receipt-due');
  return { effectOrder, emittedAtTick, dueTick, instructionId, bindingId, triggerId, opcode: action.opcode };
}
function baseCheckpoint(runtime: MissionTeamRuntime, input: unknown): { checkpoint: MissionTeamCheckpoint; context: MissionTeamContext } {
  const cap = runtime.limits, r = worldRecord(input, ['schemaVersion', 'policy', 'runtimeSha256', 'history', 'nextRequestId', 'lastEffectOrder', 'requests', 'team', 'pending']);
  if (r.schemaVersion !== 1 || r.policy !== MISSION_TEAM_RUNTIME_POLICY || r.runtimeSha256 !== runtime.sha256 || r.pending !== null) fail('checkpoint-identity');
  const context = restoreMissionTeamContext(runtime, r.history), data = missionTeamContextData(context), roster = bindMissionTeamActors(context), team = restoreTeamCheckpoint(roster, r.team), tick = team.world.nextTick;
  if (team.pending || team.team.startedTick !== 0 || team.team.instances.some(i => i.phase === 'finished' || i.phase === 'lost')) fail('checkpoint-team');
  if (data.records.some(h => h.kind === 'released' ? h.atTick > tick : h.bornAtTick >= tick)) fail('checkpoint-history-tick');
  const entities = new Map(team.world.state.entities.map(e => [e.id, e]));
  for (const record of data.records) if (record.kind === 'released' && record.reason === 'lost') {
    const binding = data.historyBindings.find(b => b.id === record.instanceId)!;
    if (binding.actorIds.some(id => entities.get(id)?.health !== 0)) fail('release-death-state');
  }
  const rows = worldList(r.requests, cap.requests), nextRequestId = worldInteger(r.nextRequestId, 0, cap.requests), lastEffectOrder = worldInteger(r.lastEffectOrder, -1, Number.MAX_SAFE_INTEGER);
  if (nextRequestId !== rows.length) fail('request-sequence');
  let lastOrder = -1, lastEmission = 0, queued = 0; const requests: MissionTeamRequest[] = [], completed = new Map<number, number>();
  for (let id = 0; id < rows.length; id++) {
    const q = worldRecord(rows[id], [...receiptKeys, 'id', 'status', 'attempts', 'nextAttemptTick', 'recordOrdinal']);
    const receipt = sourceReceipt(runtime, Object.fromEntries(receiptKeys.map(k => [k, q[k]])));
    if (q.id !== id || receipt.effectOrder <= lastOrder || receipt.emittedAtTick < lastEmission || receipt.emittedAtTick > tick ||
      !['queued', 'spawned', 'recruited', 'exhausted'].includes(q.status as string)) fail('request-state');
    lastOrder = receipt.effectOrder; lastEmission = receipt.emittedAtTick;
    const attempts = worldInteger(q.attempts, 0, cap.retries), status = q.status as MissionTeamRequest['status'];
    const nextAttemptTick = q.nextAttemptTick === null ? null : worldInteger(q.nextAttemptTick, tick, cap.tick - 1);
    const recordOrdinal = q.recordOrdinal === null ? null : worldInteger(q.recordOrdinal, 0, data.records.length - 1);
    const nextDue = receipt.dueTick + attempts * cap.retryTicks, lastAttempt = receipt.dueTick + (attempts - 1) * cap.retryTicks;
    if (status === 'queued') {
      if (++queued > cap.pending || attempts >= cap.retries || recordOrdinal !== null || nextAttemptTick !== nextDue || attempts > 0 && lastAttempt >= tick) fail('queued-request');
    } else {
      if (nextAttemptTick !== null || attempts < 1 || lastAttempt >= tick) fail('completed-request');
      if (status === 'exhausted') { if (attempts !== cap.retries || recordOrdinal !== null) fail('exhausted-request'); }
      else {
        const record = recordOrdinal === null ? null : data.records[recordOrdinal];
        if (!record || record.kind !== status || record.actionId !== receipt.instructionId || record.bornAtTick !== lastAttempt || completed.has(recordOrdinal!)) fail('request-record');
        completed.set(recordOrdinal!, id);
      }
    }
    requests.push({ ...receipt, id, status, attempts, nextAttemptTick, recordOrdinal });
  }
  if (lastEffectOrder !== lastOrder || completed.size !== data.records.filter(h => h.kind !== 'released').length) fail('request-history');
  let priorBirth = -1, priorRequest = -1;
  for (const record of data.records) if (record.kind !== 'released') {
    const requestId = completed.get(record.ordinal)!;
    if (record.bornAtTick === priorBirth && requestId <= priorRequest) fail('history-request-order');
    priorBirth = record.bornAtTick; priorRequest = requestId;
  }
  return { context, checkpoint: freeze({ schemaVersion: 1, policy: MISSION_TEAM_RUNTIME_POLICY, runtimeSha256: runtime.sha256,
    history: data.records, nextRequestId, lastEffectOrder, requests, team, pending: null }) };
}
export function createMissionTeamCheckpoint(runtime: MissionTeamRuntime): MissionTeamCheckpoint {
  const context = restoreMissionTeamContext(runtime, []), roster = bindMissionTeamActors(context);
  return baseCheckpoint(runtime, { schemaVersion: 1, policy: MISSION_TEAM_RUNTIME_POLICY, runtimeSha256: runtime.sha256,
    history: [], nextRequestId: 0, lastEffectOrder: -1, requests: [], team: createTeamCheckpoint(roster), pending: null }).checkpoint;
}
function computeTick(runtime: MissionTeamRuntime, base: MissionTeamCheckpoint, workLimit = runtime.limits.tickWork): MissionTeamTick {
  const cap = runtime.limits, budget = worldInteger(workLimit, 0, cap.tickWork), checked = baseCheckpoint(runtime, base), tick = checked.checkpoint.team.world.nextTick;
  if (tick >= cap.tick) fail('tick-limit');
  let context = checked.context, team = checked.checkpoint.team, work = 0;
  const charge = (n = 1) => { if (n > budget - work) fail('tick-work'); work += n; };
  const requests: MissionTeamRequest[] = [], actionEvents: MissionTeamEvent[] = [];
  for (const request of base.requests) {
    charge(); if (request.status !== 'queued' || request.nextAttemptTick !== tick) { requests.push(request); continue; }
    const plan = planMissionTeamClaim(context, team.world, request.instructionId, budget - work); charge(plan.work);
    const attempts = request.attempts + 1;
    if (!plan.record) {
      const exhausted = attempts >= cap.retries, nextAttemptTick = exhausted ? null : tick + cap.retryTicks;
      if (nextAttemptTick !== null && nextAttemptTick >= cap.tick) fail('retry-tick-limit');
      requests.push({ ...request, attempts, status: exhausted ? 'exhausted' : 'queued', nextAttemptTick });
      actionEvents.push({ tick, requestId: request.id, instructionId: request.instructionId, kind: exhausted ? 'exhausted' : 'blocked', recordOrdinal: null }); continue;
    }
    const record = plan.record; if (record.kind === 'released') fail('claim-kind');
    const old = missionTeamContextData(context), next = restoreMissionTeamContext(runtime, [...old.records, record]), nextData = missionTeamContextData(next);
    charge(1 + old.records.length + (record.kind === 'spawned' ? record.actors.length : record.actorIds.length));
    let nextWorld: WorldSave = team.world;
    if (record.kind === 'spawned') {
      const added = record.actors.map(a => ({ id: a.entityId, x: a.x, y: a.y, health: a.initialHealth, goal: null, route: [], progress: 0, waitTicks: 0 }));
      nextWorld = WorldSimulation.restore(nextData.model, { ...team.world, state: { ...team.world.state, modelSha256: nextData.model.sha256,
        entities: [...team.world.state.entities, ...added] } }).save();
    }
    team = migrateMissionTeamCheckpoint(context, team, next, nextWorld); context = next;
    requests.push({ ...request, attempts, status: record.kind, nextAttemptTick: null, recordOrdinal: record.ordinal });
    actionEvents.push({ tick, requestId: request.id, instructionId: request.instructionId, kind: record.kind, recordOrdinal: record.ordinal });
  }
  const before = missionTeamContextData(context), roster = bindMissionTeamActors(context);
  const step = commitTeamTick(roster, prepareTeamTick(roster, team), budget - work); charge(step.work); team = step.checkpoint;
  const actualStep = teamWorldStep(before.model, step);
  for (const instance of step.checkpoint.team.instances) {
    if (instance.phase !== 'finished' && instance.phase !== 'lost') continue;
    const data = missionTeamContextData(context), claim = data.records.find(r => r.kind !== 'released' && r.instanceId === instance.id);
    if (!claim || claim.kind === 'released') fail('release-claim');
    const request = requests.find(r => r.recordOrdinal === claim.ordinal); if (!request) fail('release-request');
    const record = { kind: 'released' as const, ordinal: data.records.length, instanceId: instance.id, atTick: team.world.nextTick, reason: instance.phase };
    charge(1 + data.records.length + instance.activeMembers.length);
    const next = restoreMissionTeamContext(runtime, [...data.records, record]);
    team = migrateMissionTeamCheckpoint(context, team, next, team.world); context = next;
    actionEvents.push({ tick: team.world.nextTick, requestId: request.id, instructionId: request.instructionId, kind: 'released', recordOrdinal: record.ordinal });
  }
  if (actionEvents.length + step.orders.length + step.events.length + step.worldEvents.length > cap.trace) fail('tick-trace');
  const checkpoint = baseCheckpoint(runtime, { ...base, history: missionTeamContextData(context).records, requests, team, pending: null }).checkpoint;
  const value = { policy: MISSION_TEAM_RUNTIME_POLICY, runtimeSha256: runtime.sha256, baseSha256: worldHash(base), tick,
    checkpoint, actionEvents, orders: step.orders, events: step.events, worldEvents: step.worldEvents, work };
  const plan = freeze({ ...value, sha256: worldHash(value) }); receipts.set(plan, freeze({ model: before.model, step: actualStep })); return plan;
}
/** Pending plans are recomputed from source and the committed base; saved candidate bytes never grant authority. */
function restoreWithBudget(runtime: MissionTeamRuntime, input: unknown, budget: number): MissionTeamCheckpoint {
  const r = worldRecord(missionTeamSnapshot(input), ['schemaVersion', 'policy', 'runtimeSha256', 'history', 'nextRequestId', 'lastEffectOrder', 'requests', 'team', 'pending']);
  const base = baseCheckpoint(runtime, { ...r, pending: null }).checkpoint;
  if (r.pending === null) return base;
  const expected = computeTick(runtime, base, budget); if (worldHash(r.pending) !== worldHash(expected)) fail('pending-mismatch');
  return freeze({ ...base, pending: expected });
}
export function restoreMissionTeamCheckpoint(runtime: MissionTeamRuntime, input: unknown): MissionTeamCheckpoint {
  missionTeamRuntimeData(runtime); return restoreWithBudget(runtime, input, runtime.limits.tickWork);
}
export interface MissionTeamAdmission { readonly requests: readonly MissionTeamReceipt[]; readonly commands: readonly CommandEnvelope[] }
/** Explicit receipt input is not trigger authority. Root may feed only its own genuine VM effects. */
export function admitMissionTeamInput(runtime: MissionTeamRuntime, input: unknown, admission: MissionTeamAdmission): MissionTeamCheckpoint {
  const checkpoint = restoreMissionTeamCheckpoint(runtime, input), r = worldRecord(missionTeamSnapshot(admission), ['requests', 'commands']), cap = runtime.limits;
  if (checkpoint.pending) fail('pending-admission');
  const incoming = worldList(r.requests, cap.pending).map(r => sourceReceipt(runtime, r)), commands = worldList(r.commands, 256);
  if (!incoming.length && !commands.length) fail('empty-admission');
  const context = restoreMissionTeamContext(runtime, checkpoint.history), roster = bindMissionTeamActors(context), tick = checkpoint.team.world.nextTick;
  const team = commands.length ? admitTeamWorldCommands(roster, checkpoint.team, commands) : checkpoint.team;
  if (incoming.length && (!cap.retries || !cap.retryTicks || incoming.length > cap.pending - checkpoint.requests.filter(r => r.status === 'queued').length ||
    incoming.length > cap.requests - checkpoint.requests.length)) fail('request-capacity');
  const requests = [...checkpoint.requests]; let lastOrder = checkpoint.lastEffectOrder, lastEmission = requests.at(-1)?.emittedAtTick ?? 0;
  for (const receipt of incoming) {
    if (receipt.effectOrder <= lastOrder || receipt.emittedAtTick < lastEmission || receipt.emittedAtTick > tick || receipt.dueTick < tick) fail('receipt-order');
    lastOrder = receipt.effectOrder; lastEmission = receipt.emittedAtTick;
    requests.push({ ...receipt, id: requests.length, status: 'queued', attempts: 0, nextAttemptTick: receipt.dueTick, recordOrdinal: null });
  }
  return baseCheckpoint(runtime, { ...checkpoint, requests, nextRequestId: requests.length, lastEffectOrder: lastOrder, team }).checkpoint;
}
export function prepareMissionTeamTick(runtime: MissionTeamRuntime, input: unknown): MissionTeamCheckpoint {
  const base = restoreMissionTeamCheckpoint(runtime, input); return base.pending ? base : freeze({ ...base, pending: computeTick(runtime, base) });
}
function result(plan: MissionTeamTick, work: number): MissionTeamResult {
  const value = freeze({ checkpoint: plan.checkpoint, actionEvents: plan.actionEvents, orders: plan.orders, events: plan.events, worldEvents: plan.worldEvents, work });
  const receipt = receipts.get(plan); if (!receipt) fail('missing-tick-receipt'); receipts.set(value, receipt); return value;
}
export function commitMissionTeamTick(runtime: MissionTeamRuntime, input: unknown): MissionTeamResult {
  const base = restoreMissionTeamCheckpoint(runtime, input); if (!base.pending) fail('missing-pending');
  if (base.pending.work > Math.floor(runtime.limits.tickWork / 2)) fail('pending-work'); return result(base.pending, 2 * base.pending.work);
}
/** One call advances exactly one authoritative world tick. Batch/replay composition remains all-or-nothing. */
export function stepMissionTeamWorld(runtime: MissionTeamRuntime, input: unknown, workLimit?: number): MissionTeamResult {
  missionTeamRuntimeData(runtime); const budget = workLimit === undefined ? runtime.limits.tickWork : worldInteger(workLimit, 0, runtime.limits.tickWork);
  const base = restoreWithBudget(runtime, input, budget);
  const plan = base.pending ?? computeTick(runtime, base, budget); return result(plan, plan.work);
}
export interface MissionTeamReplay {
  readonly schemaVersion: 1; readonly runtimeSha256: string; readonly initialCheckpoint: MissionTeamCheckpoint;
  readonly admissions: readonly (MissionTeamAdmission & { readonly nextTick: number })[];
  readonly finalNextTick: number; readonly finalStateSha256: string;
}
export function replayMissionTeamWorld(runtime: MissionTeamRuntime, input: unknown): MissionTeamResult {
  const cap = runtime.limits, r = worldRecord(missionTeamSnapshot(input), ['schemaVersion', 'runtimeSha256', 'initialCheckpoint', 'admissions', 'finalNextTick', 'finalStateSha256']);
  if (r.schemaVersion !== 1 || r.runtimeSha256 !== runtime.sha256) fail('replay-identity'); worldSourceHash(r.finalStateSha256);
  let checkpoint = restoreMissionTeamCheckpoint(runtime, r.initialCheckpoint), work = 0, inputs = 0;
  const finalNextTick = worldInteger(r.finalNextTick, checkpoint.team.world.nextTick, Math.min(cap.tick, checkpoint.team.world.nextTick + cap.replayTicks));
  const admissions = worldList(r.admissions, cap.requests).map(a => worldRecord(a, ['nextTick', 'requests', 'commands']));
  const actionEvents: MissionTeamEvent[] = [], orders: TeamOrder[] = [], events: (TeamEvent & { tick: number })[] = [], worldEvents: WorldTrace[] = [];
  const advance = (tick: number) => { while (checkpoint.team.world.nextTick < tick) {
    const step = stepMissionTeamWorld(runtime, checkpoint), count = step.actionEvents.length + step.orders.length + step.events.length + step.worldEvents.length;
    if (step.work > cap.replayWork - work || count > cap.trace - actionEvents.length - orders.length - events.length - worldEvents.length) fail('replay-output');
    work += step.work; checkpoint = step.checkpoint; actionEvents.push(...step.actionEvents); orders.push(...step.orders); events.push(...step.events); worldEvents.push(...step.worldEvents);
  } };
  for (const admission of admissions) {
    const tick = worldInteger(admission.nextTick, checkpoint.team.world.nextTick, finalNextTick), requests = worldList(admission.requests, cap.pending), commands = worldList(admission.commands, 256);
    inputs += requests.length + commands.length; if (inputs > cap.requests) fail('replay-input');
    advance(tick); checkpoint = admitMissionTeamInput(runtime, checkpoint, { requests: requests as MissionTeamReceipt[], commands: commands as CommandEnvelope[] });
  }
  advance(finalNextTick); if (worldHash(checkpoint) !== r.finalStateSha256) fail('replay-final-hash');
  return freeze({ checkpoint, actionEvents, orders, events, worldEvents, work });
}
