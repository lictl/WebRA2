// SPDX-License-Identifier: GPL-3.0-or-later
// Original single-world team transaction and bounded saved request scheduler.
import type { CommandEnvelope } from '../../contracts/src/index.ts';
import { type WorldSave, type WorldStep, type WorldTrace, WorldSimulation } from './world.ts';
import { worldHouseInvocation, type WorldHouseInvocation, type WorldHouseTransferResult } from './world-ownership.ts';
import type { WorldModel } from './world-model.ts';
import { worldHash, worldInteger, worldList, worldRecord, worldSymbol, worldSourceHash, worldAddress } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { bindMissionTeamActors, migrateMissionTeamCheckpoint, migrateMissionTeamCheckpointWithWork, createTeamCheckpoint, restoreTeamCheckpoint,
  prepareTeamTick, type TeamCheckpoint, type TeamOrder, type TeamEvent } from './team-runtime.ts';
import { admitTeamWorldCommands, commitTeamTick, teamWorldStep } from './team-runtime-world.ts';
import { missionTeamActionSourceContext } from './mission-team-action-source.ts';
import { MISSION_TEAM_RUNTIME_POLICY, missionTeamRuntimeData, missionTeamContextData, restoreMissionTeamContext, missionTeamAction,
  type MissionTeamRuntime, type MissionTeamRecord, type MissionTeamContext } from './mission-team-context.ts';
import { planMissionTeamClaim } from './mission-team-selection.ts';
import { combatDyingActorIds } from './combat.ts';
import { missionTeamOwnedConstructionModel } from './mission-team-owned-binding.ts';
import type { MissionTeamConstructorBirth } from './mission-team-constructor-types.ts';
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
function baseCheckpoint(runtime: MissionTeamRuntime, input: unknown, workLimit = runtime.limits.tickWork): { checkpoint: MissionTeamCheckpoint; context: MissionTeamContext; work: number } {
  const cap = runtime.limits, r = worldRecord(input, ['schemaVersion', 'policy', 'runtimeSha256', 'history', 'nextRequestId', 'lastEffectOrder', 'requests', 'team', 'pending']);
  if (r.schemaVersion !== 1 || r.policy !== MISSION_TEAM_RUNTIME_POLICY || r.runtimeSha256 !== runtime.sha256 || r.pending !== null) fail('checkpoint-identity');
  const worldInput = worldRecord(r.team, ['schemaVersion', 'policy', 'rosterSha256', 'world', 'team', 'pending']).world;
  const context = restoreMissionTeamContext(runtime, r.history, worldInput, workLimit), data = missionTeamContextData(context);
  const work = data.work + data.worldRestoreWork; if (work > workLimit) fail('checkpoint-work');
  const roster = bindMissionTeamActors(context), team = restoreTeamCheckpoint(roster, r.team), tick = team.world.nextTick;
  if (team.pending || team.team.startedTick !== 0 || team.team.instances.some(i => i.phase === 'finished' || i.phase === 'lost')) fail('checkpoint-team');
  if (data.records.some(h => h.kind === 'released' ? h.atTick > tick : h.bornAtTick >= tick)) fail('checkpoint-history-tick');
  const entities = new Map(team.world.state.entities.map(e => [e.id, e]));
  // Historical constructor coordinates are not original map overlap permissions.
  // Only the base world's source actors may retain its initially shared anchors.
  const baseIds = new Set(missionTeamRuntimeData(runtime).baseModel.entities.map(e => e.id));
  const dying = combatDyingActorIds(team.world.state.combat);
  const counts = new Map<number, number>(), add = (at: number) => counts.set(at, (counts.get(at) ?? 0) + 1);
  for (const at of data.model.blocked) add(at);
  for (let i = 0; i < team.world.state.entities.length; i++) {
    const e = team.world.state.entities[i]!, definition = data.model.entities[i]!;
    if ((e.health !== 0 || dying.has(e.id)) && definition.blocksCell) { add(worldAddress(e.x, e.y)); if (e.progress > 0) add(e.route[1]!); }
  }
  for (const footprint of data.model.footprints) if (entities.get(footprint.entityId)!.health !== 0) for (const at of footprint.cells) add(at);
  for (let i = 0; i < team.world.state.entities.length; i++) {
    const e = team.world.state.entities[i]!, definition = data.model.entities[i]!;
    if (!baseIds.has(e.id) && e.health !== 0 && definition.blocksCell && counts.get(worldAddress(e.x, e.y)) !== 1) fail('constructed-anchor-overlap');
  }

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
  return { context, work, checkpoint: freeze({ schemaVersion: 1, policy: MISSION_TEAM_RUNTIME_POLICY, runtimeSha256: runtime.sha256,
    history: data.records, nextRequestId, lastEffectOrder, requests, team, pending: null }) };
}
export function createMissionTeamCheckpoint(runtime: MissionTeamRuntime): MissionTeamCheckpoint {
  const initialWorld = missionTeamRuntimeData(runtime).owned ? WorldSimulation.create(missionTeamRuntimeData(runtime).baseModel).save() : undefined;
  const context = restoreMissionTeamContext(runtime, [], initialWorld), roster = bindMissionTeamActors(context);
  return baseCheckpoint(runtime, { schemaVersion: 1, policy: MISSION_TEAM_RUNTIME_POLICY, runtimeSha256: runtime.sha256,
    history: [], nextRequestId: 0, lastEffectOrder: -1, requests: [], team: createTeamCheckpoint(roster), pending: null }).checkpoint;
}
function computeTick(runtime: MissionTeamRuntime, base: MissionTeamCheckpoint, workLimit = runtime.limits.tickWork): MissionTeamTick {
  const cap = runtime.limits, budget = worldInteger(workLimit, 0, cap.tickWork), checked = baseCheckpoint(runtime, base, budget), tick = checked.checkpoint.team.world.nextTick;
  if (tick >= cap.tick) fail('tick-limit');
  let context = checked.context, team = checked.checkpoint.team, work = checked.work;
  if (work > budget) fail('tick-work');
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
    const old = missionTeamContextData(context), records = [...old.records, record], owned = missionTeamRuntimeData(runtime).owned;
    let nextWorld: WorldSave = team.world;
    if (owned && record.kind === 'spawned') {
      const births = records.filter((r): r is Extract<MissionTeamRecord, { kind: 'spawned' }> => r.kind === 'spawned')
        .map(({ kind: _kind, ...birth }) => birth as MissionTeamConstructorBirth);
      const prepared = missionTeamOwnedConstructionModel(owned, births, budget - work); charge(prepared.work);
      charge(old.worldRestoreWork);
      const migrated = WorldSimulation.migrateConstruction(WorldSimulation.restore(old.model, team.world), prepared.model, budget - work);
      charge(migrated.work); nextWorld = migrated.world.save();
    }
    const next = restoreMissionTeamContext(runtime, records, nextWorld, budget - work), nextData = missionTeamContextData(next);
    charge(nextData.work + nextData.worldRestoreWork * 3 + 1 + old.records.length + (record.kind === 'spawned' ? record.actors.length : record.actorIds.length));
    if (!owned && record.kind === 'spawned') {
      const added = record.actors.map(a => ({ id: a.entityId, x: a.x, y: a.y, health: a.initialHealth, goal: null, route: [], progress: 0, waitTicks: 0 }));
      nextWorld = WorldSimulation.restore(nextData.model, { ...team.world, state: { ...team.world.state, modelSha256: nextData.model.sha256,
        entities: [...team.world.state.entities, ...added] } }).save();
    }
    const migration = migrateMissionTeamCheckpointWithWork(context, team, next, nextWorld, budget - work); charge(migration.work);
    team = migration.checkpoint; context = next;
    requests.push({ ...request, attempts, status: record.kind, nextAttemptTick: null, recordOrdinal: record.ordinal });
    actionEvents.push({ tick, requestId: request.id, instructionId: request.instructionId, kind: record.kind, recordOrdinal: record.ordinal });
  }
  const before = missionTeamContextData(context), roster = bindMissionTeamActors(context);
  // Reserve full owning restores in the existing roster/migration helpers;
  // each active instance can invoke one destination planner. The world's own
  // transition and slot work is charged separately by its returned receipt.
  charge(before.worldRestoreWork * (3 + before.instances.length));
  const step = commitTeamTick(roster, prepareTeamTick(roster, team, budget - work), budget - work); charge(step.work); team = step.checkpoint;
  const actualStep = teamWorldStep(before.model, step);
  for (const instance of step.checkpoint.team.instances) {
    if (instance.phase !== 'finished' && instance.phase !== 'lost') continue;
    const data = missionTeamContextData(context), claim = data.records.find(r => r.kind !== 'released' && r.instanceId === instance.id);
    if (!claim || claim.kind === 'released') fail('release-claim');
    const request = requests.find(r => r.recordOrdinal === claim.ordinal); if (!request) fail('release-request');
    const record = { kind: 'released' as const, ordinal: data.records.length, instanceId: instance.id, atTick: team.world.nextTick, reason: instance.phase,
      ...(missionTeamRuntimeData(runtime).owned ? { ownershipRevision: team.world.state.ownership!.transfers.length } : {}) };
    charge(1 + data.records.length + instance.activeMembers.length);
    const next = restoreMissionTeamContext(runtime, [...data.records, record], team.world, budget - work);
    charge(missionTeamContextData(next).work + missionTeamContextData(next).worldRestoreWork * 3);
    team = migrateMissionTeamCheckpoint(context, team, next, team.world); context = next;
    actionEvents.push({ tick: team.world.nextTick, requestId: request.id, instructionId: request.instructionId, kind: 'released', recordOrdinal: record.ordinal });
  }
  if (actionEvents.length + step.orders.length + step.events.length + step.worldEvents.length > cap.trace) fail('tick-trace');
  const finalized = baseCheckpoint(runtime, { ...base, history: missionTeamContextData(context).records, requests, team, pending: null }, budget - work);
  charge(finalized.work);
  const checkpoint = finalized.checkpoint;
  const value = { policy: MISSION_TEAM_RUNTIME_POLICY, runtimeSha256: runtime.sha256, baseSha256: worldHash(base), tick,
    checkpoint, actionEvents, orders: step.orders, events: step.events, worldEvents: step.worldEvents, work };
  const plan = freeze({ ...value, sha256: worldHash(value) }); receipts.set(plan, freeze({ model: before.model, step: actualStep })); return plan;
}
/** Pending plans are recomputed from source and the committed base; saved candidate bytes never grant authority. */
const restorationWork = new WeakMap<object, number>();
const admissionWork = new WeakMap<object, number>();
function restoreWithBudget(runtime: MissionTeamRuntime, input: unknown, budget: number): MissionTeamCheckpoint {
  const owned = missionTeamRuntimeData(runtime).owned; let work = 0;
  const charge = (n: number) => { if (n > budget - work) fail('restore-work'); work += n; };
  const r = worldRecord(missionTeamSnapshot(input, owned ? charge : undefined), ['schemaVersion', 'policy', 'runtimeSha256', 'history', 'nextRequestId', 'lastEffectOrder', 'requests', 'team', 'pending']);
  const checked = baseCheckpoint(runtime, { ...r, pending: null }, budget - work), base = checked.checkpoint;
  if (owned) charge(checked.work);
  if (r.pending === null) { restorationWork.set(base, work); return base; }
  const expected = computeTick(runtime, base, budget - work); if (worldHash(r.pending) !== worldHash(expected)) fail('pending-mismatch');
  if (owned) charge(expected.work);
  const result = freeze({ ...base, pending: expected }); restorationWork.set(result, work); return result;
}
export function restoreMissionTeamCheckpoint(runtime: MissionTeamRuntime, input: unknown): MissionTeamCheckpoint {
  missionTeamRuntimeData(runtime); return restoreWithBudget(runtime, input, runtime.limits.tickWork);
}
/** Compound adapters charge the existing owned reconstruction counter without
 * repeating the operation. This does not authenticate a mission invocation. */
export function restoreMissionTeamCheckpointWithWork(runtime: MissionTeamRuntime, input: unknown, workLimit: number) {
  missionTeamRuntimeData(runtime);
  const checkpoint = restoreWithBudget(runtime, input, worldInteger(workLimit, 0, runtime.limits.tickWork));
  return freeze({ checkpoint, work: restorationWork.get(checkpoint)! });
}
/** Explicit component inputs; a transfer is a separate ordered admission. */
export interface MissionTeamAdmission { readonly requests: readonly MissionTeamReceipt[]; readonly commands: readonly CommandEnvelope[];
  readonly ownershipTransfers?: readonly WorldHouseInvocation[] }
export function transferMissionTeamOwnership(runtime: MissionTeamRuntime, input: unknown, invocation: WorldHouseInvocation,
  workLimit: number = runtime.limits.tickWork): Readonly<{ checkpoint: MissionTeamCheckpoint; result: WorldHouseTransferResult; work: number }> {
  const data = missionTeamRuntimeData(runtime), budget = worldInteger(workLimit, 0, runtime.limits.tickWork);
  if (!data.owned) fail('owned-runtime-required');
  let snapshotWork = 0;
  const snapshot = missionTeamSnapshot(input, n => { if (n > budget - snapshotWork) fail('ownership-work'); snapshotWork += n; }) as MissionTeamCheckpoint;
  if (snapshot?.pending) fail('pending-ownership');
  const checked = baseCheckpoint(runtime, snapshot, budget - snapshotWork), checkpoint = checked.checkpoint, active = missionTeamContextData(checked.context);
  const beforeWork = snapshotWork + checked.work + active.worldRestoreWork; if (beforeWork > budget) fail('ownership-work');
  const simulation = WorldSimulation.restore(active.model, checkpoint.team.world);
  const result = simulation.transferOwnership(worldHouseInvocation(invocation), budget - beforeWork);
  const claimed = new Set(active.instances.flatMap(i => [...i.actorIds]));
  if (result.changedEntityIds.some(id => claimed.has(id))) fail('active-owner-change');
  const nextWorld = simulation.save(), nextContext = restoreMissionTeamContext(runtime, checkpoint.history, nextWorld, budget - beforeWork - result.work);
  const reboundWork = missionTeamContextData(nextContext).work;
  const next = baseCheckpoint(runtime, { ...checkpoint, team: { ...checkpoint.team, world: nextWorld,
    rosterSha256: bindMissionTeamActors(nextContext).sha256 } }, budget - beforeWork - result.work - reboundWork);
  const work = beforeWork + result.work + reboundWork + next.work;
  if (work > budget) fail('ownership-work');
  return freeze({ checkpoint: next.checkpoint, result, work });
}
/** Explicit receipt input is not trigger authority. Root may feed only its own genuine VM effects. */
export function admitMissionTeamInput(runtime: MissionTeamRuntime, input: unknown, admission: MissionTeamAdmission, workLimit = runtime.limits.tickWork): MissionTeamCheckpoint {
  const budget = worldInteger(workLimit, 0, runtime.limits.tickWork), owned = missionTeamRuntimeData(runtime).owned;
  const checkpoint = restoreWithBudget(runtime, input, budget); let work = owned ? restorationWork.get(checkpoint)! : 0;
  const charge = (n: number) => { if (n > budget - work) fail('admission-work'); work += n; };
  const copied = missionTeamSnapshot(admission, owned ? charge : undefined);
  const hasTransfers = !!copied && typeof copied === 'object' && Object.hasOwn(copied, 'ownershipTransfers');
  const r = worldRecord(copied, ['requests', 'commands', ...(hasTransfers ? ['ownershipTransfers'] : [])]), cap = runtime.limits;
  if (checkpoint.pending) fail('pending-admission');
  const incoming = worldList(r.requests, cap.pending).map(r => sourceReceipt(runtime, r)), commands = worldList(r.commands, 256);
  if (hasTransfers) {
    if (incoming.length || commands.length) fail('ownership-admission-order');
    const transfers = worldList(r.ownershipTransfers, 1); if (transfers.length !== 1) fail('ownership-admission-count');
    const transfer = transferMissionTeamOwnership(runtime, checkpoint, worldHouseInvocation(transfers[0]), budget - work);
    charge(transfer.work); admissionWork.set(transfer.checkpoint, work); return transfer.checkpoint;
  }
  if (!incoming.length && !commands.length) fail('empty-admission');
  const context = restoreMissionTeamContext(runtime, checkpoint.history, checkpoint.team.world, budget - work), data = missionTeamContextData(context);
  charge(data.work + (commands.length ? 3 * data.worldRestoreWork : 0));
  const roster = bindMissionTeamActors(context), tick = checkpoint.team.world.nextTick;
  const team = commands.length ? admitTeamWorldCommands(roster, checkpoint.team, commands) : checkpoint.team;
  if (incoming.length && (!cap.retries || !cap.retryTicks || incoming.length > cap.pending - checkpoint.requests.filter(r => r.status === 'queued').length ||
    incoming.length > cap.requests - checkpoint.requests.length)) fail('request-capacity');
  const requests = [...checkpoint.requests]; let lastOrder = checkpoint.lastEffectOrder, lastEmission = requests.at(-1)?.emittedAtTick ?? 0;
  for (const receipt of incoming) {
    if (receipt.effectOrder <= lastOrder || receipt.emittedAtTick < lastEmission || receipt.emittedAtTick > tick || receipt.dueTick < tick) fail('receipt-order');
    lastOrder = receipt.effectOrder; lastEmission = receipt.emittedAtTick;
    requests.push({ ...receipt, id: requests.length, status: 'queued', attempts: 0, nextAttemptTick: receipt.dueTick, recordOrdinal: null });
  }
  const checked = baseCheckpoint(runtime, { ...checkpoint, requests, nextRequestId: requests.length, lastEffectOrder: lastOrder, team }, budget - work);
  charge(checked.work); admissionWork.set(checked.checkpoint, work); return checked.checkpoint;
}
export function prepareMissionTeamTick(runtime: MissionTeamRuntime, input: unknown): MissionTeamCheckpoint {
  const base = restoreMissionTeamCheckpoint(runtime, input), work = missionTeamRuntimeData(runtime).owned ? restorationWork.get(base)! : 0;
  return base.pending ? base : freeze({ ...base, pending: computeTick(runtime, base, runtime.limits.tickWork - work) });
}
/** Exposes the work already charged by admission, preserving legacy identities. */
export function admitMissionTeamInputWithWork(runtime: MissionTeamRuntime, input: unknown, admission: MissionTeamAdmission, workLimit: number) {
  const checkpoint = admitMissionTeamInput(runtime, input, admission, workLimit);
  return freeze({ checkpoint, work: admissionWork.get(checkpoint)! });
}
function result(plan: MissionTeamTick, work: number): MissionTeamResult {
  const value = freeze({ checkpoint: plan.checkpoint, actionEvents: plan.actionEvents, orders: plan.orders, events: plan.events, worldEvents: plan.worldEvents, work });
  const receipt = receipts.get(plan); if (!receipt) fail('missing-tick-receipt'); receipts.set(value, receipt); return value;
}
export function commitMissionTeamTick(runtime: MissionTeamRuntime, input: unknown): MissionTeamResult {
  const base = restoreMissionTeamCheckpoint(runtime, input); if (!base.pending) fail('missing-pending');
  if (missionTeamRuntimeData(runtime).owned) return result(base.pending, restorationWork.get(base)!);
  if (base.pending.work > Math.floor(runtime.limits.tickWork / 2)) fail('pending-work'); return result(base.pending, 2 * base.pending.work);
}
/** One call advances exactly one authoritative world tick. Batch/replay composition remains all-or-nothing. */
export function stepMissionTeamWorld(runtime: MissionTeamRuntime, input: unknown, workLimit?: number): MissionTeamResult {
  missionTeamRuntimeData(runtime); const budget = workLimit === undefined ? runtime.limits.tickWork : worldInteger(workLimit, 0, runtime.limits.tickWork);
  const base = restoreWithBudget(runtime, input, budget);
  const restored = missionTeamRuntimeData(runtime).owned ? restorationWork.get(base)! : 0;
  const plan = base.pending ?? computeTick(runtime, base, budget - restored);
  return result(plan, restored + (base.pending && missionTeamRuntimeData(runtime).owned ? 0 : plan.work));
}
export interface MissionTeamReplay {
  readonly schemaVersion: 1; readonly runtimeSha256: string; readonly initialCheckpoint: MissionTeamCheckpoint;
  readonly admissions: readonly (MissionTeamAdmission & { readonly nextTick: number })[];
  readonly finalNextTick: number; readonly finalStateSha256: string;
}
export function replayMissionTeamWorld(runtime: MissionTeamRuntime, input: unknown): MissionTeamResult {
  const cap = runtime.limits, r = worldRecord(missionTeamSnapshot(input), ['schemaVersion', 'runtimeSha256', 'initialCheckpoint', 'admissions', 'finalNextTick', 'finalStateSha256']);
  if (r.schemaVersion !== 1 || r.runtimeSha256 !== runtime.sha256) fail('replay-identity'); worldSourceHash(r.finalStateSha256);
  let checkpoint = restoreWithBudget(runtime, r.initialCheckpoint, Math.min(cap.tickWork, cap.replayWork)), work = 0, inputs = 0;
  work += missionTeamRuntimeData(runtime).owned ? restorationWork.get(checkpoint)! : checkpoint.pending?.work ?? 0;
  const finalNextTick = worldInteger(r.finalNextTick, checkpoint.team.world.nextTick, Math.min(cap.tick, checkpoint.team.world.nextTick + cap.replayTicks));
  const admissions = worldList(r.admissions, cap.requests).map(a => worldRecord(a, ['nextTick', 'requests', 'commands', ...(Object.hasOwn(a as object, 'ownershipTransfers') ? ['ownershipTransfers'] : [])]));
  const actionEvents: MissionTeamEvent[] = [], orders: TeamOrder[] = [], events: (TeamEvent & { tick: number })[] = [], worldEvents: WorldTrace[] = [];
  const advance = (tick: number) => { while (checkpoint.team.world.nextTick < tick) {
    const step = stepMissionTeamWorld(runtime, checkpoint, Math.min(cap.tickWork, cap.replayWork - work)), count = step.actionEvents.length + step.orders.length + step.events.length + step.worldEvents.length;
    if (step.work > cap.replayWork - work || count > cap.trace - actionEvents.length - orders.length - events.length - worldEvents.length) fail('replay-output');
    work += step.work; checkpoint = step.checkpoint; actionEvents.push(...step.actionEvents); orders.push(...step.orders); events.push(...step.events); worldEvents.push(...step.worldEvents);
  } };
  for (const admission of admissions) {
    const tick = worldInteger(admission.nextTick, checkpoint.team.world.nextTick, finalNextTick), requests = worldList(admission.requests, cap.pending), commands = worldList(admission.commands, 256);
    const transfers = Object.hasOwn(admission, 'ownershipTransfers') ? worldList(admission.ownershipTransfers, 1).map(worldHouseInvocation) : null;
    inputs += requests.length + commands.length + (transfers?.length ?? 0); if (inputs > cap.requests) fail('replay-input');
    advance(tick);
    if (transfers) {
      if (requests.length || commands.length || transfers.length !== 1) fail('ownership-admission-order');
      const result = transferMissionTeamOwnership(runtime, checkpoint, transfers[0]!, Math.min(cap.tickWork, cap.replayWork - work));
      work += result.work; checkpoint = result.checkpoint;
    } else {
      checkpoint = admitMissionTeamInput(runtime, checkpoint, { requests: requests as MissionTeamReceipt[], commands: commands as CommandEnvelope[] }, Math.min(cap.tickWork, cap.replayWork - work));
      if (missionTeamRuntimeData(runtime).owned) work += admissionWork.get(checkpoint)!;
    }
  }
  advance(finalNextTick); if (worldHash(checkpoint) !== r.finalStateSha256) fail('replay-final-hash');
  return freeze({ checkpoint, actionEvents, orders, events, worldEvents, work });
}
