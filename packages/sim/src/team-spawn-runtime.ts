// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-admission scheduler and compound replay; see ../TEAM_SPAWN_PROVENANCE.md.
import { parseJson } from './canonical.ts';
import type { CommandEnvelope } from '../../contracts/src/index.ts';
import { WorldSimulation, type WorldSave, type WorldTrace } from './world.ts';
import { worldClone, worldHash, worldInteger, worldList, worldRecord, worldSourceHash, worldSymbol } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { bindSpawnTeamActors, migrateSpawnTeamCheckpoint, createTeamCheckpoint, restoreTeamCheckpoint, type TeamCheckpoint, type TeamOrder, type TeamEvent } from './team-runtime.ts';
import { admitTeamWorldCommands, stepTeamWorld } from './team-runtime-world.ts';
import { prepareTeamSpawnInsertion, commitTeamSpawnInsertion } from './team-spawn-insertion.ts';
import { teamSpawnFail as fail, teamSpawnCatalogData, teamSpawnContextData, restoreTeamSpawnContext, type TeamSpawnCatalog, type TeamSpawnRecord, type TeamSpawnContext } from './team-spawn-context.ts';

export const TEAM_SPAWN_TRANSACTION_POLICY = 'webra2-team-spawn-transaction-1' as const;
export interface TeamSpawnRequest {
  readonly id: number; readonly actionId: string; readonly admittedAtTick: number;
  readonly status: 'queued' | 'spawned' | 'exhausted'; readonly attempts: number;
  readonly nextAttemptTick: number | null; readonly recordOrdinal: number | null;
}
export interface TeamSpawnCheckpoint {
  readonly schemaVersion: 1; readonly policy: typeof TEAM_SPAWN_TRANSACTION_POLICY; readonly catalogSha256: string;
  readonly records: readonly TeamSpawnRecord[]; readonly nextRequestId: number; readonly requests: readonly TeamSpawnRequest[];
  readonly team: TeamCheckpoint; readonly pending: TeamSpawnTick | null;
}
export interface TeamSpawnEvent { readonly tick: number; readonly requestId: number; readonly actionId: string;
  readonly kind: 'spawned' | 'blocked' | 'exhausted'; readonly recordOrdinal: number | null }
export interface TeamSpawnTick {
  readonly policy: typeof TEAM_SPAWN_TRANSACTION_POLICY; readonly catalogSha256: string; readonly baseSha256: string;
  readonly tick: number; readonly checkpoint: TeamSpawnCheckpoint; readonly spawnEvents: readonly TeamSpawnEvent[];
  readonly orders: readonly TeamOrder[]; readonly events: readonly (TeamEvent & { tick: number })[];
  readonly worldEvents: readonly WorldTrace[]; readonly work: number; readonly sha256: string;
}
export interface TeamSpawnWorldResult {
  readonly checkpoint: TeamSpawnCheckpoint; readonly spawnEvents: readonly TeamSpawnEvent[]; readonly orders: readonly TeamOrder[];
  readonly events: readonly (TeamEvent & { tick: number })[]; readonly worldEvents: readonly WorldTrace[]; readonly work: number;
}
function baseCheckpoint(catalog: TeamSpawnCatalog, value: unknown): { checkpoint: TeamSpawnCheckpoint; context: TeamSpawnContext } {
  const { program } = teamSpawnCatalogData(catalog), cap = catalog.limits;
  const r = worldRecord(value, ['schemaVersion', 'policy', 'catalogSha256', 'records', 'nextRequestId', 'requests', 'team', 'pending']);
  if (r.schemaVersion !== 1 || r.policy !== TEAM_SPAWN_TRANSACTION_POLICY || r.catalogSha256 !== catalog.sha256 || r.pending !== null) fail('checkpoint-identity');
  const context = restoreTeamSpawnContext(catalog, r.records), data = teamSpawnContextData(context), roster = bindSpawnTeamActors(context);
  const team = restoreTeamCheckpoint(roster, r.team), tick = team.world.nextTick;
  if (team.pending) fail('nested-team-plan');
  if (data.records.some(record => record.bornAtTick >= tick)) fail('checkpoint-birth-tick');
  const requests: TeamSpawnRequest[] = [], actions = new Map(catalog.actions.map(a => [a.id, a])), completed = new Map<number, number>();
  const rows = worldList(r.requests, cap.replayAdmissions), nextRequestId = worldInteger(r.nextRequestId, 0, cap.replayAdmissions);
  if (nextRequestId !== rows.length) fail('request-sequence'); let priorAdmission = 0, queued = 0;
  for (let i = 0; i < rows.length; i++) {
    const q = worldRecord(rows[i], ['id', 'actionId', 'admittedAtTick', 'status', 'attempts', 'nextAttemptTick', 'recordOrdinal']);
    if (q.id !== i || !['queued', 'spawned', 'exhausted'].includes(q.status as string)) fail('request-state');
    const actionId = worldSymbol(q.actionId), action = actions.get(actionId); if (!action) fail('request-action');
    const admittedAtTick = worldInteger(q.admittedAtTick, priorAdmission, tick); priorAdmission = admittedAtTick;
    const attempts = worldInteger(q.attempts, 0, cap.retries), status = q.status as TeamSpawnRequest['status'];
    const nextAttemptTick = q.nextAttemptTick === null ? null : worldInteger(q.nextAttemptTick, tick, cap.tick - 1);
    const recordOrdinal = q.recordOrdinal === null ? null : worldInteger(q.recordOrdinal, 0, data.records.length - 1);
    const nextDue = admittedAtTick + attempts * cap.retryTicks, lastAttempt = admittedAtTick + (attempts - 1) * cap.retryTicks;
    if (status === 'queued') {
      if (++queued > cap.pending || attempts >= cap.retries || recordOrdinal !== null || nextAttemptTick !== nextDue || (attempts > 0 && lastAttempt >= tick)) fail('queued-request');
    } else if (nextAttemptTick !== null || attempts < 1 || lastAttempt >= tick) fail('completed-request');
    if (status === 'spawned') {
      if (recordOrdinal === null || completed.has(recordOrdinal)) fail('request-record'); const record = data.records[recordOrdinal]!;
      if (record.actionId !== actionId || record.teamId !== action.teamId || record.bornAtTick !== lastAttempt) fail('request-record'); completed.set(recordOrdinal, i);
    } else if (recordOrdinal !== null || status === 'exhausted' && attempts !== cap.retries) fail('request-record');
    requests.push({ id: i, actionId, admittedAtTick, status, attempts, nextAttemptTick, recordOrdinal });
  }
  if (completed.size !== data.records.length || program !== data.program) fail('orphan-record');
  for (let i = 1; i < data.records.length; i++) if (data.records[i]!.bornAtTick === data.records[i - 1]!.bornAtTick && completed.get(i)! <= completed.get(i - 1)!) fail('record-request-order');
  return { context, checkpoint: freeze({ schemaVersion: 1, policy: TEAM_SPAWN_TRANSACTION_POLICY, catalogSha256: catalog.sha256,
    records: data.records, nextRequestId, requests, team, pending: null }) };
}
export function createTeamSpawnCheckpoint(catalog: TeamSpawnCatalog, worldInput?: WorldSave): TeamSpawnCheckpoint {
  const { world } = teamSpawnCatalogData(catalog), context = restoreTeamSpawnContext(catalog, []), roster = bindSpawnTeamActors(context);
  const save = worldInput === undefined ? WorldSimulation.create(world.model).save() : WorldSimulation.restore(world.model, worldInput).save();
  return baseCheckpoint(catalog, { schemaVersion: 1, policy: TEAM_SPAWN_TRANSACTION_POLICY, catalogSha256: catalog.sha256,
    records: [], nextRequestId: 0, requests: [], team: createTeamCheckpoint(roster, save), pending: null }).checkpoint;
}
function computeTick(catalog: TeamSpawnCatalog, base: TeamSpawnCheckpoint): TeamSpawnTick {
  const cap = catalog.limits, checked = baseCheckpoint(catalog, base), tick = checked.checkpoint.team.world.nextTick;
  if (tick >= cap.tick) fail('tick-limit');
  let context = checked.context, team = checked.checkpoint.team, work = 0;
  const requests: TeamSpawnRequest[] = [], spawnEvents: TeamSpawnEvent[] = [];
  for (const request of base.requests) {
    if (++work > cap.replayWork) fail('tick-work-limit');
    if (request.status !== 'queued' || request.nextAttemptTick !== tick) { requests.push(request); continue; }
    const plan = prepareTeamSpawnInsertion(catalog, context, team.world, request.actionId);
    if (plan.work > Math.floor((cap.replayWork - work) / 2)) fail('tick-work-limit'); work += 2 * plan.work;
    if (plan.status === 'budget-exhausted') fail('tick-insertion-budget');
    const attempts = request.attempts + 1;
    if (plan.status === 'blocked') {
      const exhausted = attempts >= cap.retries, nextAttemptTick = exhausted ? null : tick + cap.retryTicks;
      if (nextAttemptTick !== null && nextAttemptTick >= cap.tick) fail('retry-tick-limit');
      requests.push({ ...request, status: exhausted ? 'exhausted' : 'queued', attempts, nextAttemptTick, recordOrdinal: null });
      spawnEvents.push({ tick, requestId: request.id, actionId: request.actionId, kind: exhausted ? 'exhausted' : 'blocked', recordOrdinal: null });
    } else {
      const next = commitTeamSpawnInsertion(catalog, context, team.world, plan);
      team = migrateSpawnTeamCheckpoint(context, team, next.context, next.world); context = next.context;
      requests.push({ ...request, status: 'spawned', attempts, nextAttemptTick: null, recordOrdinal: next.record.ordinal });
      spawnEvents.push({ tick, requestId: request.id, actionId: request.actionId, kind: 'spawned', recordOrdinal: next.record.ordinal });
    }
  }
  const step = stepTeamWorld(bindSpawnTeamActors(context), team, 1, cap.replayWork - work); work += step.work;
  if (spawnEvents.length + step.orders.length + step.events.length + step.worldEvents.length > cap.trace) fail('tick-trace-limit');
  const checkpoint = baseCheckpoint(catalog, { ...base, records: teamSpawnContextData(context).records, requests, team: step.checkpoint, pending: null }).checkpoint;
  const plan = { policy: TEAM_SPAWN_TRANSACTION_POLICY, catalogSha256: catalog.sha256, baseSha256: worldHash(base), tick,
    checkpoint, spawnEvents, orders: step.orders, events: step.events, worldEvents: step.worldEvents, work };
  return freeze({ ...plan, sha256: worldHash(plan) });
}
/** Restored pending candidates are accepted only after deterministic source/world recomputation. */
export function restoreTeamSpawnCheckpoint(catalog: TeamSpawnCatalog, input: unknown): TeamSpawnCheckpoint {
  const value = typeof input === 'string' || input instanceof Uint8Array ? parseJson(input) : worldClone(input);
  const r = worldRecord(value, ['schemaVersion', 'policy', 'catalogSha256', 'records', 'nextRequestId', 'requests', 'team', 'pending']);
  const base = baseCheckpoint(catalog, { ...r, pending: null }).checkpoint;
  if (r.pending === null) return base;
  const expected = computeTick(catalog, base); if (worldHash(r.pending) !== worldHash(expected)) fail('pending-tick-mismatch');
  return freeze({ ...base, pending: expected });
}
/** Source action admissions and unrelated core commands share one atomic between-tick boundary. */
export function admitTeamSpawnInput(catalog: TeamSpawnCatalog, input: unknown, admission: { readonly actions: readonly string[]; readonly commands: readonly CommandEnvelope[] }): TeamSpawnCheckpoint {
  const checkpoint = restoreTeamSpawnCheckpoint(catalog, input), r = worldRecord(admission, ['actions', 'commands']), cap = catalog.limits;
  if (checkpoint.pending) fail('pending-admission');
  const ids = worldList(r.actions, cap.pending).map(worldSymbol), commands = worldList(r.commands, 256) as CommandEnvelope[];
  if (!ids.length && !commands.length) fail('empty-admission');
  const tick = checkpoint.team.world.nextTick, context = restoreTeamSpawnContext(catalog, checkpoint.records), roster = bindSpawnTeamActors(context);
  const team = commands.length ? admitTeamWorldCommands(roster, checkpoint.team, commands) : checkpoint.team;
  if (ids.length && (!cap.retries || !cap.retryTicks || tick >= cap.tick || ids.length > cap.pending - checkpoint.requests.filter(r => r.status === 'queued').length ||
    ids.length > cap.replayAdmissions - checkpoint.requests.length)) fail('request-limit');
  const valid = new Set(catalog.actions.map(a => a.id)), requests = [...checkpoint.requests];
  for (const actionId of ids) { if (!valid.has(actionId)) fail('admission-action'); requests.push({ id: requests.length, actionId, admittedAtTick: tick,
    status: 'queued', attempts: 0, nextAttemptTick: tick, recordOrdinal: null }); }
  return baseCheckpoint(catalog, { ...checkpoint, team, requests, nextRequestId: requests.length }).checkpoint;
}
export function prepareTeamSpawnTick(catalog: TeamSpawnCatalog, input: unknown): TeamSpawnCheckpoint {
  const base = restoreTeamSpawnCheckpoint(catalog, input); if (base.pending) return base;
  return freeze({ ...base, pending: computeTick(catalog, base) });
}
export function commitTeamSpawnTick(catalog: TeamSpawnCatalog, input: unknown): TeamSpawnWorldResult {
  const checkpoint = restoreTeamSpawnCheckpoint(catalog, input), plan = checkpoint.pending; if (!plan) fail('missing-pending-tick');
  return freeze({ checkpoint: plan.checkpoint, spawnEvents: plan.spawnEvents, orders: plan.orders, events: plan.events, worldEvents: plan.worldEvents, work: 2 * plan.work });
}
function traceCount(r: TeamSpawnWorldResult): number { return r.spawnEvents.length + r.orders.length + r.events.length + r.worldEvents.length; }
export function stepTeamSpawnWorld(catalog: TeamSpawnCatalog, input: unknown, ticks = 1): TeamSpawnWorldResult {
  const cap = catalog.limits, { program } = teamSpawnCatalogData(catalog); worldInteger(ticks, 1, program.limits.ticks);
  // Every iteration validates through prepare/commit; avoid an extra pending-plan execution before that pair.
  let checkpoint = input as TeamSpawnCheckpoint, work = 0;
  const spawnEvents: TeamSpawnEvent[] = [], orders: TeamOrder[] = [], events: (TeamEvent & { tick: number })[] = [], worldEvents: WorldTrace[] = [];
  for (let i = 0; i < ticks; i++) {
    const step = commitTeamSpawnTick(catalog, prepareTeamSpawnTick(catalog, checkpoint));
    if (traceCount(step) > cap.trace - spawnEvents.length - orders.length - events.length - worldEvents.length || step.work > cap.replayWork - work) fail('batch-output-limit');
    checkpoint = step.checkpoint; work += step.work; spawnEvents.push(...step.spawnEvents); orders.push(...step.orders); events.push(...step.events); worldEvents.push(...step.worldEvents);
  }
  return freeze({ checkpoint, spawnEvents, orders, events, worldEvents, work });
}
export interface TeamSpawnReplay {
  readonly schemaVersion: 1; readonly catalogSha256: string; readonly initialCheckpoint: TeamSpawnCheckpoint;
  readonly admissions: readonly Readonly<{ nextTick: number; actions: readonly string[]; commands: readonly CommandEnvelope[] }>[];
  readonly finalNextTick: number; readonly finalStateSha256: string;
}
/** Initial pending plan/records/requests already belong to the checkpoint; admissions contain only subsequent inputs. */
export function replayTeamSpawnWorld(catalog: TeamSpawnCatalog, input: unknown): TeamSpawnWorldResult {
  const cap = catalog.limits, value = typeof input === 'string' || input instanceof Uint8Array ? parseJson(input) : worldClone(input);
  const r = worldRecord(value, ['schemaVersion', 'catalogSha256', 'initialCheckpoint', 'admissions', 'finalNextTick', 'finalStateSha256']);
  if (r.schemaVersion !== 1 || r.catalogSha256 !== catalog.sha256) fail('replay-identity'); worldSourceHash(r.finalStateSha256);
  let checkpoint = restoreTeamSpawnCheckpoint(catalog, r.initialCheckpoint), work = 0, inputs = 0;
  const finalNextTick = worldInteger(r.finalNextTick, checkpoint.team.world.nextTick, Math.min(cap.tick, checkpoint.team.world.nextTick + cap.replayTicks));
  const admissions = worldList(r.admissions, cap.replayAdmissions).map(a => worldRecord(a, ['nextTick', 'actions', 'commands']));
  const spawnEvents: TeamSpawnEvent[] = [], orders: TeamOrder[] = [], events: (TeamEvent & { tick: number })[] = [], worldEvents: WorldTrace[] = [];
  function advance(tick: number) { while (checkpoint.team.world.nextTick < tick) {
    const step = stepTeamSpawnWorld(catalog, checkpoint); if (traceCount(step) > cap.trace - spawnEvents.length - orders.length - events.length - worldEvents.length || step.work > cap.replayWork - work) fail('replay-output-limit');
    checkpoint = step.checkpoint; work += step.work; spawnEvents.push(...step.spawnEvents); orders.push(...step.orders); events.push(...step.events); worldEvents.push(...step.worldEvents);
  } }
  for (const a of admissions) {
    const tick = worldInteger(a.nextTick, checkpoint.team.world.nextTick, finalNextTick);
    const actions = worldList(a.actions, cap.pending).map(worldSymbol), commands = worldList(a.commands, 256) as CommandEnvelope[];
    inputs += actions.length + commands.length; if (!actions.length && !commands.length || inputs > cap.replayAdmissions) fail('replay-input-limit');
    advance(tick); checkpoint = admitTeamSpawnInput(catalog, checkpoint, { actions, commands });
  }
  advance(finalNextTick); if (worldHash(checkpoint) !== r.finalStateSha256) fail('replay-final-hash');
  return freeze({ checkpoint, spawnEvents, orders, events, worldEvents, work });
}
