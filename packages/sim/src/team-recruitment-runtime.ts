// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-admission scheduler and compound replay; see ../TEAM_RECRUITMENT_PROVENANCE.md.
import { parseJson } from './canonical.ts';
import type { CommandEnvelope } from '../../contracts/src/index.ts';
import { WorldSimulation, type WorldTrace } from './world.ts';
import { worldClone, worldHash, worldInteger, worldList, worldRecord, worldSourceHash, worldSymbol } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { bindRecruitedTeamActors, migrateRecruitedTeamCheckpoint, createTeamCheckpoint, restoreTeamCheckpoint, type TeamCheckpoint, type TeamOrder, type TeamEvent } from './team-runtime.ts';
import { admitTeamWorldCommands, stepTeamWorld } from './team-runtime-world.ts';
import { prepareTeamRecruitmentSelection, commitTeamRecruitmentSelection } from './team-recruitment-selection.ts';
import { teamRecruitmentFail as fail, teamRecruitmentCatalogData, type TeamRecruitmentCatalog } from './team-recruitment-catalog.ts';
import { teamRecruitmentContextData, restoreTeamRecruitmentContext, type TeamRecruitmentRecord, type TeamRecruitmentContext } from './team-recruitment-context.ts';

export const TEAM_RECRUITMENT_TRANSACTION_POLICY = 'webra2-team-recruitment-transaction-1' as const;
export interface TeamRecruitmentRequest {
  readonly id: number; readonly actionId: string; readonly admittedAtTick: number;
  readonly status: 'queued' | 'recruited' | 'exhausted'; readonly attempts: number;
  readonly nextAttemptTick: number | null; readonly recordOrdinal: number | null;
}
export interface TeamRecruitmentCheckpoint {
  readonly schemaVersion: 1; readonly policy: typeof TEAM_RECRUITMENT_TRANSACTION_POLICY; readonly catalogSha256: string;
  readonly records: readonly TeamRecruitmentRecord[]; readonly nextRequestId: number; readonly requests: readonly TeamRecruitmentRequest[];
  readonly team: TeamCheckpoint; readonly pending: TeamRecruitmentTick | null;
}
export interface TeamRecruitmentEvent { readonly tick: number; readonly requestId: number; readonly actionId: string;
  readonly kind: 'recruited' | 'blocked' | 'exhausted' | 'released'; readonly recordOrdinal: number | null }
export interface TeamRecruitmentTick {
  readonly policy: typeof TEAM_RECRUITMENT_TRANSACTION_POLICY; readonly catalogSha256: string; readonly baseSha256: string;
  readonly tick: number; readonly checkpoint: TeamRecruitmentCheckpoint; readonly recruitmentEvents: readonly TeamRecruitmentEvent[];
  readonly orders: readonly TeamOrder[]; readonly events: readonly (TeamEvent & { tick: number })[];
  readonly worldEvents: readonly WorldTrace[]; readonly work: number; readonly sha256: string;
}
export interface TeamRecruitmentWorldResult {
  readonly checkpoint: TeamRecruitmentCheckpoint; readonly recruitmentEvents: readonly TeamRecruitmentEvent[]; readonly orders: readonly TeamOrder[];
  readonly events: readonly (TeamEvent & { tick: number })[]; readonly worldEvents: readonly WorldTrace[]; readonly work: number;
}
function baseCheckpoint(catalog: TeamRecruitmentCatalog, value: unknown): { checkpoint: TeamRecruitmentCheckpoint; context: TeamRecruitmentContext } {
  const { program } = teamRecruitmentCatalogData(catalog), cap = catalog.limits;
  const r = worldRecord(value, ['schemaVersion', 'policy', 'catalogSha256', 'records', 'nextRequestId', 'requests', 'team', 'pending']);
  if (r.schemaVersion !== 1 || r.policy !== TEAM_RECRUITMENT_TRANSACTION_POLICY || r.catalogSha256 !== catalog.sha256 || r.pending !== null) fail('checkpoint-identity');
  const context = restoreTeamRecruitmentContext(catalog, r.records), data = teamRecruitmentContextData(context), roster = bindRecruitedTeamActors(context);
  const team = restoreTeamCheckpoint(roster, r.team), tick = team.world.nextTick;
  if (team.pending) fail('nested-team-plan');
  if (team.team.instances.some(s => s.phase === 'finished' || s.phase === 'lost')) fail('missing-terminal-release');
  if (team.team.startedTick !== 0 || data.records.some(record => record.kind === 'recruited' ? record.bornAtTick >= tick : record.atTick > tick)) fail('checkpoint-birth-tick');
  const current = new Map(team.world.state.entities.map(e => [e.id, e]));
  for (const record of data.records) if (record.kind === 'released' && record.reason === 'lost') {
    const claim = data.records.find(r => r.kind === 'recruited' && r.instanceId === record.instanceId);
    if (!claim || claim.kind !== 'recruited' || claim.actorIds.some(id => current.get(id)!.health !== 0)) fail('release-death-state');
  }
  const supported = new Set(catalog.templates.filter(t => t.status === 'supported-source').map(t => t.teamId));
  const requests: TeamRecruitmentRequest[] = [], actions = new Map(catalog.actions.map(a => [a.id, a])), completed = new Map<number, number>();
  const rows = worldList(r.requests, cap.replayAdmissions), nextRequestId = worldInteger(r.nextRequestId, 0, cap.replayAdmissions);
  if (nextRequestId !== rows.length) fail('request-sequence'); let priorAdmission = 0, queued = 0;
  for (let i = 0; i < rows.length; i++) {
    const q = worldRecord(rows[i], ['id', 'actionId', 'admittedAtTick', 'status', 'attempts', 'nextAttemptTick', 'recordOrdinal']);
    if (q.id !== i || !['queued', 'recruited', 'exhausted'].includes(q.status as string)) fail('request-state');
    const actionId = worldSymbol(q.actionId), action = actions.get(actionId); if (!action || !supported.has(action.teamId!)) fail('request-action');
    const admittedAtTick = worldInteger(q.admittedAtTick, priorAdmission, tick); priorAdmission = admittedAtTick;
    const attempts = worldInteger(q.attempts, 0, cap.retries), status = q.status as TeamRecruitmentRequest['status'];
    const nextAttemptTick = q.nextAttemptTick === null ? null : worldInteger(q.nextAttemptTick, tick, cap.tick - 1);
    const recordOrdinal = q.recordOrdinal === null ? null : worldInteger(q.recordOrdinal, 0, data.records.length - 1);
    const nextDue = admittedAtTick + attempts * cap.retryTicks, lastAttempt = admittedAtTick + (attempts - 1) * cap.retryTicks;
    if (status === 'queued') {
      if (++queued > cap.pending || attempts >= cap.retries || recordOrdinal !== null || nextAttemptTick !== nextDue || (attempts > 0 && lastAttempt >= tick)) fail('queued-request');
    } else if (nextAttemptTick !== null || attempts < 1 || lastAttempt >= tick) fail('completed-request');
    if (status === 'recruited') {
      if (recordOrdinal === null || completed.has(recordOrdinal)) fail('request-record'); const record = data.records[recordOrdinal]!;
      if (record.kind !== 'recruited' || record.actionId !== actionId || record.teamId !== action.teamId || record.bornAtTick !== lastAttempt) fail('request-record'); completed.set(recordOrdinal, i);
    } else if (recordOrdinal !== null || status === 'exhausted' && attempts !== cap.retries) fail('request-record');
    requests.push({ id: i, actionId, admittedAtTick, status, attempts, nextAttemptTick, recordOrdinal });
  }
  const claims = data.records.filter(r => r.kind === 'recruited');
  if (completed.size !== claims.length || program !== data.program) fail('orphan-record');
  for (let i = 1; i < claims.length; i++) if (claims[i]!.bornAtTick === claims[i - 1]!.bornAtTick && completed.get(claims[i]!.ordinal)! <= completed.get(claims[i - 1]!.ordinal)!) fail('record-request-order');
  return { context, checkpoint: freeze({ schemaVersion: 1, policy: TEAM_RECRUITMENT_TRANSACTION_POLICY, catalogSha256: catalog.sha256,
    records: data.records, nextRequestId, requests, team, pending: null }) };
}
export function createTeamRecruitmentCheckpoint(catalog: TeamRecruitmentCatalog): TeamRecruitmentCheckpoint {
  const { world } = teamRecruitmentCatalogData(catalog), context = restoreTeamRecruitmentContext(catalog, []), roster = bindRecruitedTeamActors(context);
  const save = WorldSimulation.create(world.model).save();
  return baseCheckpoint(catalog, { schemaVersion: 1, policy: TEAM_RECRUITMENT_TRANSACTION_POLICY, catalogSha256: catalog.sha256,
    records: [], nextRequestId: 0, requests: [], team: createTeamCheckpoint(roster, save), pending: null }).checkpoint;
}
function computeTick(catalog: TeamRecruitmentCatalog, base: TeamRecruitmentCheckpoint): TeamRecruitmentTick {
  const cap = catalog.limits, checked = baseCheckpoint(catalog, base), tick = checked.checkpoint.team.world.nextTick;
  if (tick >= cap.tick) fail('tick-limit');
  let context = checked.context, team = checked.checkpoint.team, work = 0;
  const requests: TeamRecruitmentRequest[] = [], recruitmentEvents: TeamRecruitmentEvent[] = [];
  for (const request of base.requests) {
    if (++work > cap.replayWork) fail('tick-work-limit');
    if (request.status !== 'queued' || request.nextAttemptTick !== tick) { requests.push(request); continue; }
    const plan = prepareTeamRecruitmentSelection(catalog, context, team.world, request.actionId);
    if (plan.work > Math.floor((cap.replayWork - work) / 2)) fail('tick-work-limit'); work += 2 * plan.work;
    if (plan.status === 'budget-exhausted') fail('tick-selection-budget');
    if (plan.status === 'unsupported-source') fail('unsupported-source-template');
    const attempts = request.attempts + 1;
    if (plan.status === 'unavailable') {
      const exhausted = attempts >= cap.retries, nextAttemptTick = exhausted ? null : tick + cap.retryTicks;
      if (nextAttemptTick !== null && nextAttemptTick >= cap.tick) fail('retry-tick-limit');
      requests.push({ ...request, status: exhausted ? 'exhausted' : 'queued', attempts, nextAttemptTick, recordOrdinal: null });
      recruitmentEvents.push({ tick, requestId: request.id, actionId: request.actionId, kind: exhausted ? 'exhausted' : 'blocked', recordOrdinal: null });
    } else {
      const next = commitTeamRecruitmentSelection(catalog, context, team.world, plan);
      team = migrateRecruitedTeamCheckpoint(context, team, next.context); context = next.context;
      requests.push({ ...request, status: 'recruited', attempts, nextAttemptTick: null, recordOrdinal: next.record.ordinal });
      recruitmentEvents.push({ tick, requestId: request.id, actionId: request.actionId, kind: 'recruited', recordOrdinal: next.record.ordinal });
    }
  }
  const step = stepTeamWorld(bindRecruitedTeamActors(context), team, 1, cap.replayWork - work); work += step.work; team = step.checkpoint;
  // Terminal instances release claims at the completed tick boundary. Flash lives outside instances and survives release.
  for (const instance of step.checkpoint.team.instances) {
    if (instance.phase !== 'finished' && instance.phase !== 'lost') continue;
    const data = teamRecruitmentContextData(context), claim = data.records.find(r => r.kind === 'recruited' && r.instanceId === instance.id);
    if (!claim || claim.kind !== 'recruited') fail('release-claim');
    const request = requests.find(q => q.recordOrdinal === claim.ordinal); if (!request) fail('release-request');
    const record = { kind: 'released' as const, ordinal: data.records.length, instanceId: instance.id, atTick: team.world.nextTick, reason: instance.phase };
    work += 1 + data.records.length + instance.activeMembers.length; if (work > cap.replayWork) fail('release-work');
    const next = restoreTeamRecruitmentContext(catalog, [...data.records, record]);
    team = migrateRecruitedTeamCheckpoint(context, team, next); context = next;
    recruitmentEvents.push({ tick: team.world.nextTick, requestId: request.id, actionId: claim.actionId, kind: 'released', recordOrdinal: record.ordinal });
  }
  if (recruitmentEvents.length + step.orders.length + step.events.length + step.worldEvents.length > cap.trace) fail('tick-trace-limit');
  const checkpoint = baseCheckpoint(catalog, { ...base, records: teamRecruitmentContextData(context).records, requests, team, pending: null }).checkpoint;
  const plan = { policy: TEAM_RECRUITMENT_TRANSACTION_POLICY, catalogSha256: catalog.sha256, baseSha256: worldHash(base), tick,
    checkpoint, recruitmentEvents, orders: step.orders, events: step.events, worldEvents: step.worldEvents, work };
  return freeze({ ...plan, sha256: worldHash(plan) });
}
/** Restored pending candidates are accepted only after deterministic source/world recomputation. */
export function restoreTeamRecruitmentCheckpoint(catalog: TeamRecruitmentCatalog, input: unknown): TeamRecruitmentCheckpoint {
  const value = typeof input === 'string' || input instanceof Uint8Array ? parseJson(input) : worldClone(input);
  const r = worldRecord(value, ['schemaVersion', 'policy', 'catalogSha256', 'records', 'nextRequestId', 'requests', 'team', 'pending']);
  const base = baseCheckpoint(catalog, { ...r, pending: null }).checkpoint;
  if (r.pending === null) return base;
  const expected = computeTick(catalog, base); if (worldHash(r.pending) !== worldHash(expected)) fail('pending-tick-mismatch');
  return freeze({ ...base, pending: expected });
}
/** Source action admissions and unrelated core commands share one atomic between-tick boundary. */
export function admitTeamRecruitmentInput(catalog: TeamRecruitmentCatalog, input: unknown, admission: { readonly actions: readonly string[]; readonly commands: readonly CommandEnvelope[] }): TeamRecruitmentCheckpoint {
  const checkpoint = restoreTeamRecruitmentCheckpoint(catalog, input), r = worldRecord(admission, ['actions', 'commands']), cap = catalog.limits;
  if (checkpoint.pending) fail('pending-admission');
  const ids = worldList(r.actions, cap.pending).map(worldSymbol), commands = worldList(r.commands, 256) as CommandEnvelope[];
  if (!ids.length && !commands.length) fail('empty-admission');
  const tick = checkpoint.team.world.nextTick, context = restoreTeamRecruitmentContext(catalog, checkpoint.records), roster = bindRecruitedTeamActors(context);
  const team = commands.length ? admitTeamWorldCommands(roster, checkpoint.team, commands) : checkpoint.team;
  if (ids.length && (!cap.retries || !cap.retryTicks || tick >= cap.tick || ids.length > cap.pending - checkpoint.requests.filter(r => r.status === 'queued').length ||
    ids.length > cap.replayAdmissions - checkpoint.requests.length)) fail('request-limit');
  const supported = new Set(catalog.templates.filter(t => t.status === 'supported-source').map(t => t.teamId));
  const valid = new Set(catalog.actions.filter(a => supported.has(a.teamId!)).map(a => a.id)), requests = [...checkpoint.requests];
  for (const actionId of ids) { if (!valid.has(actionId)) fail('admission-action'); requests.push({ id: requests.length, actionId, admittedAtTick: tick,
    status: 'queued', attempts: 0, nextAttemptTick: tick, recordOrdinal: null }); }
  return baseCheckpoint(catalog, { ...checkpoint, team, requests, nextRequestId: requests.length }).checkpoint;
}
export function prepareTeamRecruitmentTick(catalog: TeamRecruitmentCatalog, input: unknown): TeamRecruitmentCheckpoint {
  const base = restoreTeamRecruitmentCheckpoint(catalog, input); if (base.pending) return base;
  return freeze({ ...base, pending: computeTick(catalog, base) });
}
export function commitTeamRecruitmentTick(catalog: TeamRecruitmentCatalog, input: unknown): TeamRecruitmentWorldResult {
  const checkpoint = restoreTeamRecruitmentCheckpoint(catalog, input), plan = checkpoint.pending; if (!plan) fail('missing-pending-tick');
  return freeze({ checkpoint: plan.checkpoint, recruitmentEvents: plan.recruitmentEvents, orders: plan.orders, events: plan.events, worldEvents: plan.worldEvents, work: 2 * plan.work });
}
function traceCount(r: TeamRecruitmentWorldResult): number { return r.recruitmentEvents.length + r.orders.length + r.events.length + r.worldEvents.length; }
export function stepTeamRecruitmentWorld(catalog: TeamRecruitmentCatalog, input: unknown, ticks = 1): TeamRecruitmentWorldResult {
  const cap = catalog.limits, { program } = teamRecruitmentCatalogData(catalog); worldInteger(ticks, 1, program.limits.ticks);
  // Every iteration validates through prepare/commit; avoid an extra pending-plan execution before that pair.
  let checkpoint = input as TeamRecruitmentCheckpoint, work = 0;
  const recruitmentEvents: TeamRecruitmentEvent[] = [], orders: TeamOrder[] = [], events: (TeamEvent & { tick: number })[] = [], worldEvents: WorldTrace[] = [];
  for (let i = 0; i < ticks; i++) {
    const step = commitTeamRecruitmentTick(catalog, prepareTeamRecruitmentTick(catalog, checkpoint));
    if (traceCount(step) > cap.trace - recruitmentEvents.length - orders.length - events.length - worldEvents.length || step.work > cap.replayWork - work) fail('batch-output-limit');
    checkpoint = step.checkpoint; work += step.work; recruitmentEvents.push(...step.recruitmentEvents); orders.push(...step.orders); events.push(...step.events); worldEvents.push(...step.worldEvents);
  }
  return freeze({ checkpoint, recruitmentEvents, orders, events, worldEvents, work });
}
export interface TeamRecruitmentReplay {
  readonly schemaVersion: 1; readonly catalogSha256: string; readonly initialCheckpoint: TeamRecruitmentCheckpoint;
  readonly admissions: readonly Readonly<{ nextTick: number; actions: readonly string[]; commands: readonly CommandEnvelope[] }>[];
  readonly finalNextTick: number; readonly finalStateSha256: string;
}
/** Initial pending plan/records/requests already belong to the checkpoint; admissions contain only subsequent inputs. */
export function replayTeamRecruitmentWorld(catalog: TeamRecruitmentCatalog, input: unknown): TeamRecruitmentWorldResult {
  const cap = catalog.limits, value = typeof input === 'string' || input instanceof Uint8Array ? parseJson(input) : worldClone(input);
  const r = worldRecord(value, ['schemaVersion', 'catalogSha256', 'initialCheckpoint', 'admissions', 'finalNextTick', 'finalStateSha256']);
  if (r.schemaVersion !== 1 || r.catalogSha256 !== catalog.sha256) fail('replay-identity'); worldSourceHash(r.finalStateSha256);
  let checkpoint = restoreTeamRecruitmentCheckpoint(catalog, r.initialCheckpoint), work = 0, inputs = 0;
  const finalNextTick = worldInteger(r.finalNextTick, checkpoint.team.world.nextTick, Math.min(cap.tick, checkpoint.team.world.nextTick + cap.replayTicks));
  const admissions = worldList(r.admissions, cap.replayAdmissions).map(a => worldRecord(a, ['nextTick', 'actions', 'commands']));
  const recruitmentEvents: TeamRecruitmentEvent[] = [], orders: TeamOrder[] = [], events: (TeamEvent & { tick: number })[] = [], worldEvents: WorldTrace[] = [];
  function advance(tick: number) { while (checkpoint.team.world.nextTick < tick) {
    const step = stepTeamRecruitmentWorld(catalog, checkpoint); if (traceCount(step) > cap.trace - recruitmentEvents.length - orders.length - events.length - worldEvents.length || step.work > cap.replayWork - work) fail('replay-output-limit');
    checkpoint = step.checkpoint; work += step.work; recruitmentEvents.push(...step.recruitmentEvents); orders.push(...step.orders); events.push(...step.events); worldEvents.push(...step.worldEvents);
  } }
  for (const a of admissions) {
    const tick = worldInteger(a.nextTick, checkpoint.team.world.nextTick, finalNextTick);
    const actions = worldList(a.actions, cap.pending).map(worldSymbol), commands = worldList(a.commands, 256) as CommandEnvelope[];
    inputs += actions.length + commands.length; if (!actions.length && !commands.length || inputs > cap.replayAdmissions) fail('replay-input-limit');
    advance(tick); checkpoint = admitTeamRecruitmentInput(catalog, checkpoint, { actions, commands });
  }
  advance(finalNextTick); if (worldHash(checkpoint) !== r.finalStateSha256) fail('replay-final-hash');
  return freeze({ checkpoint, recruitmentEvents, orders, events, worldEvents, work });
}
