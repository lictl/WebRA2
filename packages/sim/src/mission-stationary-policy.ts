// SPDX-License-Identifier: GPL-3.0-or-later
// Original replay-derived stationary mission witness; never native scheduling authority.
import { type MissionStationarySource, missionStationarySourceData, missionStationaryFail as fail } from './mission-stationary-source.ts';
import { WorldSimulation, readWorldStationaryBoundary, worldStationaryBoundaryHash, readWorldStationaryOperation,
  type WorldStationaryBoundary, type WorldStationaryOperationInput } from './world.ts';
import { missionTeamContextData, missionTeamRuntimeData, type MissionTeamContext, type MissionTeamRecord } from './mission-team-context.ts';
import { missionTeamSnapshot } from './mission-team-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { worldHash, worldInteger, worldList, worldRecord, WORLD_LIMITS as W } from './world-values.ts';
import { worldHouseInvocation } from './world-ownership.ts';

export const MISSION_STATIONARY_POLICY = 'webra2-untouched-infantry-guard-witness-1' as const;
export const MISSION_STATIONARY_LIMITS = Object.freeze({ journalRows: 4096, operations: 20000, commands: 4096,
  ticks: 10000, work: W.replayWork });
export type MissionStationaryLimits = { -readonly [K in keyof typeof MISSION_STATIONARY_LIMITS]: number };
export type MissionStationaryJournalRow = WorldStationaryOperationInput & { readonly repetitions: number };
export interface MissionStationaryActorState {
  readonly entityId: number; readonly currentMission: 0 | 5 | null; readonly queuedMission: -1 | null;
  readonly ownershipRevision: number; readonly invalidatedAtTick: number | null; readonly reasons: readonly string[];
}
export interface MissionStationaryWitness {
  readonly policy: typeof MISSION_STATIONARY_POLICY; readonly sourceSha256: string;
  readonly nextTick: number; readonly operationCount: number;
}
export interface MissionStationarySave {
  readonly schemaVersion: 1; readonly policy: typeof MISSION_STATIONARY_POLICY; readonly sourceSha256: string;
  readonly worldStateSha256: string; readonly nextTick: number; readonly journal: readonly MissionStationaryJournalRow[];
  readonly teamRecords: readonly MissionTeamRecord[]; readonly actors: readonly MissionStationaryActorState[];
}
interface JournalNode { previous: JournalNode | null; row: MissionStationaryJournalRow }
interface WitnessData {
  source: MissionStationarySource; boundary: WorldStationaryBoundary; cap: MissionStationaryLimits;
  actors: readonly MissionStationaryActorState[]; indexes: ReadonlyMap<number, number>;
  journal: JournalNode | null; journalRows: number; commands: number; ticks: number;
  teamRecords: readonly MissionTeamRecord[]; teamRecordsSha256: string;
  guardActors: ReadonlyMap<string, ReadonlySet<number>>;
}
const witnesses = new WeakMap<object, WitnessData>();
const data = (w: MissionStationaryWitness) => witnesses.get(w) ?? fail('witness-brand');
function meter(limit: number) {
  worldInteger(limit, 0, W.replayWork); let work = 0;
  return { charge(n = 1) { if (n > limit - work) fail('witness-work'); work += n; }, get work() { return work; }, get remaining() { return limit - work; } };
}
function limits(value: Partial<MissionStationaryLimits>): MissionStationaryLimits {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return fail('witness-limits');
  const out: MissionStationaryLimits = { ...MISSION_STATIONARY_LIMITS };
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.hasOwn(out, key)) return fail('witness-limits');
    const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d) || !d.enumerable) return fail('witness-limits');
    const k = key as keyof MissionStationaryLimits; out[k] = worldInteger(d.value, 0, out[k]);
  }
  return Object.freeze(out);
}
function publish(source: MissionStationarySource, nextTick: number, operationCount: number, d: WitnessData): MissionStationaryWitness {
  const w = Object.freeze({ policy: MISSION_STATIONARY_POLICY, sourceSha256: source.sha256, nextTick, operationCount });
  witnesses.set(w, d); return w;
}
function check(source: MissionStationarySource, witness: MissionStationaryWitness) {
  const d = data(witness); missionStationarySourceData(source); if (d.source !== source) fail('witness-source'); return d;
}
function creationWork(source: MissionStationarySource): number {
  const model = missionStationarySourceData(source).model;
  return 32 * model.entities.length + model.blocked.length * 2 + model.navigation.length * 4 +
    model.footprints.reduce((n, f) => n + f.cells.length * 3 + 1, 0);
}
/** Initial current/queue values describe the admitted fresh campaign placement
 * branch. The policy freezes autonomous native mission scheduling under D03. */
export function createMissionStationaryWitness(source: MissionStationarySource, lowerLimits: Partial<MissionStationaryLimits> = {}): Readonly<{
  witness: MissionStationaryWitness; world: WorldSimulation; work: number;
}> {
  const { model } = missionStationarySourceData(source), cap = limits(lowerLimits), m = meter(cap.work); m.charge(creationWork(source));
  const missions = new Map<number, 'Guard' | 'Sleep' | null>();
  for (const c of source.catalogs) for (const a of c.actors) {
    m.charge(); if (missions.has(a.entityId) && missions.get(a.entityId) !== a.initialMission) fail('initial-mission-conflict');
    missions.set(a.entityId, a.initialMission);
  }
  const actors = model.entities.map(e => {
    m.charge(); const mission = missions.get(e.id);
    return Object.freeze({ entityId: e.id, currentMission: mission === 'Guard' ? 5 as const : mission === 'Sleep' ? 0 as const : null,
      queuedMission: mission ? -1 as const : null, ownershipRevision: 0, invalidatedAtTick: null, reasons: Object.freeze([] as string[]) });
  });
  const world = WorldSimulation.create(model), boundary = readWorldStationaryBoundary(world).boundary;
  const guardActors = new Map<string, ReadonlySet<number>>();
  for (const a of source.actions) {
    m.charge(a.guardEntityIds.length + 1);
    if (a.status === 'supported-source') guardActors.set(a.instructionId, new Set(a.guardEntityIds));
  }
  const witness = publish(source, 0, 0, { source, boundary, cap, actors: Object.freeze(actors), indexes: new Map(actors.map((a, i) => [a.entityId, i])),
    journal: null, journalRows: 0, commands: 0, ticks: 0, teamRecords: Object.freeze([]), teamRecordsSha256: worldHash([]), guardActors });
  return { witness, world, work: m.work };
}
function sameBoundary(source: MissionStationarySource, expected: WorldStationaryBoundary, actual: WorldStationaryBoundary, m: ReturnType<typeof meter>): void {
  m.charge(); if (expected === actual) return;
  const model = missionStationarySourceData(source).model;
  const a = worldStationaryBoundaryHash(model, expected, m.remaining); m.charge(a.work);
  const b = worldStationaryBoundaryHash(model, actual, m.remaining); m.charge(b.work);
  if (a.sha256 !== b.sha256) fail('operation-gap');
}
function invalidate(a: MissionStationaryActorState, tick: number, reason: string): MissionStationaryActorState {
  const reasons = a.reasons.includes(reason) ? a.reasons : Object.freeze([...a.reasons, reason].sort());
  return Object.freeze({ ...a, currentMission: null, queuedMission: null, reasons,
    invalidatedAtTick: Math.min(a.invalidatedAtTick ?? tick, tick) });
}
/** Only genuine successful core returns are accepted. Missing, reordered, copied
 * or cross-model receipts never advance the witness. Earlier witnesses stay valid. */
export function advanceMissionStationaryWitness(source: MissionStationarySource, witness: MissionStationaryWitness,
  receipt: unknown, workLimit?: number): Readonly<{ witness: MissionStationaryWitness; work: number }> {
  const d = check(source, witness), m = meter(workLimit === undefined ? d.cap.work : worldInteger(workLimit, 0, d.cap.work));
  if (witness.operationCount >= d.cap.operations) fail('operation-limit');
  const operation = readWorldStationaryOperation(missionStationarySourceData(source).model, receipt, m.remaining); m.charge(operation.work);
  if (operation.fromNextTick !== witness.nextTick) fail('operation-clock');
  sameBoundary(source, d.boundary, operation.fromBoundary, m);
  const input = operation.input, commands = d.commands + (input.kind === 'commands' ? input.commands.length : 0);
  const ticks = d.ticks + (input.kind === 'step' ? input.ticks : 0);
  if (commands > d.cap.commands || ticks > d.cap.ticks) fail('journal-budget');
  const prior = d.journal?.row;
  const coalesce = input.kind === 'step' && prior?.kind === 'step' && prior.ticks === input.ticks && prior.workLimit === input.workLimit;
  const journalRows = d.journalRows + (coalesce ? 0 : 1);
  if (journalRows > d.cap.journalRows) fail('journal-limit');
  m.charge(operation.invalidated.length + operation.transferred.length + 1);
  let actors = d.actors;
  if (operation.invalidated.length || operation.transferred.length) {
    m.charge(d.actors.length); const next = [...d.actors];
    for (const v of operation.invalidated) { const i = d.indexes.get(v.entityId); if (i !== undefined) next[i] = invalidate(next[i]!, operation.fromNextTick, v.reason); }
    for (const v of operation.transferred) {
      const i = d.indexes.get(v.entityId); if (i === undefined) continue;
      let a = next[i]!;
      if (a.currentMission !== 5 || a.queuedMission !== -1 || a.reasons.length) a = invalidate(a, operation.fromNextTick, 'transfer-mission-unproved');
      next[i] = Object.freeze({ ...a, ownershipRevision: v.revision });
    }
    actors = Object.freeze(next);
  }
  const row = Object.freeze({ ...input, repetitions: coalesce ? prior!.repetitions + 1 : 1 });
  const journal = { previous: coalesce ? d.journal!.previous : d.journal, row };
  return { witness: publish(source, operation.toNextTick, witness.operationCount + 1, { ...d, boundary: operation.toBoundary,
    journal, journalRows, commands, ticks, actors }), work: m.work };
}
function teamContext(source: MissionStationarySource, context: MissionTeamContext) {
  const d = missionTeamContextData(context), runtime = missionTeamRuntimeData(d.runtime), s = missionStationarySourceData(source);
  if (runtime.source !== s.source || runtime.owned !== s.binding || d.model !== s.model) fail('team-context-source');
  return d;
}
/** Root supplies the actual complete team context at the same compound boundary.
 * Team history is monotonic even for Flash-only claims that never move an actor. */
export function observeMissionStationaryTeams(source: MissionStationarySource, witness: MissionStationaryWitness,
  context: MissionTeamContext, workLimit?: number): Readonly<{ witness: MissionStationaryWitness; work: number }> {
  const d = check(source, witness), c = teamContext(source, context), m = meter(workLimit === undefined ? d.cap.work : worldInteger(workLimit, 0, d.cap.work));
  m.charge();
  // The context factory already hashes its owned complete records. Unchanged
  // history needs neither another serialization nor an actor-plane copy.
  if (context.recordsSha256 === d.teamRecordsSha256) return { witness, work: m.work };
  if (c.records.length < d.teamRecords.length) fail('team-history-gap');
  for (let i = 0; i < d.teamRecords.length; i++) {
    const before = d.teamRecords[i]!, after = c.records[i]!;
    const size = (r: MissionTeamRecord) => r.kind === 'recruited' ? r.actorIds.length : r.kind === 'spawned' ? r.actors.length * 16 : 0;
    m.charge(256 + size(before) + size(after));
    if (before !== after && worldHash(before) !== worldHash(after)) fail('team-history-gap');
  }
  let actors: MissionStationaryActorState[] | null = null;
  for (let n = d.teamRecords.length; n < c.records.length; n++) {
    const record = c.records[n]!; m.charge();
    if ((record.kind === 'released' ? record.atTick : record.bornAtTick) > witness.nextTick) fail('team-history-clock');
    if (record.kind !== 'recruited') continue;
    for (const id of record.actorIds) {
      m.charge(); const i = d.indexes.get(id); if (i === undefined) continue;
      if (!actors) { m.charge(d.actors.length); actors = [...d.actors]; }
      actors[i] = invalidate(actors[i]!, record.bornAtTick, 'team');
    }
  }
  return { witness: publish(source, witness.nextTick, witness.operationCount, { ...d, actors: actors ? Object.freeze(actors) : d.actors,
    teamRecords: c.records, teamRecordsSha256: context.recordsSha256 }), work: m.work };
}
/** This answers only the extra mission-state predicate. Existing current-owner,
 * full-force selection, claim/capture and complete-source gates still apply. */
export function missionStationaryGuardCandidate(source: MissionStationarySource, witness: MissionStationaryWitness,
  context: MissionTeamContext, world: WorldSimulation, instructionId: string, entityId: number, workLimit?: number): Readonly<{ eligible: boolean; reasons: readonly string[]; work: number }> {
  const d = check(source, witness), m = meter(workLimit === undefined ? d.cap.work : worldInteger(workLimit, 0, d.cap.work));
  teamContext(source, context);
  if (context.recordsSha256 !== d.teamRecordsSha256) fail('query-team-history');
  const boundary = readWorldStationaryBoundary(world);
  if (boundary.model !== missionStationarySourceData(source).model || boundary.nextTick !== witness.nextTick) fail('query-world');
  sameBoundary(source, d.boundary, boundary.boundary, m);
  worldInteger(entityId, 1, 2147483647);
  if (typeof instructionId !== 'string' || instructionId.length > 255) fail('query-instruction');
  m.charge();
  const i = d.indexes.get(entityId), a = i === undefined ? undefined : d.actors[i];
  const reasons: string[] = [];
  if (!d.guardActors.get(instructionId)?.has(entityId)) reasons.push('source-actor');
  if (!a || a.currentMission !== 5 || a.queuedMission !== -1 || a.reasons.length) reasons.push('mission-unverified');
  if (a?.reasons.includes('team')) reasons.push('team-history');
  return { eligible: !reasons.length, reasons: Object.freeze(reasons), work: m.work };
}
function journal(d: WitnessData): MissionStationaryJournalRow[] {
  const rows: MissionStationaryJournalRow[] = []; for (let node = d.journal; node; node = node.previous) rows.push(node.row); return rows.reverse();
}
export function saveMissionStationaryWitness(source: MissionStationarySource, witness: MissionStationaryWitness, workLimit?: number): Readonly<{ save: MissionStationarySave; work: number }> {
  const d = check(source, witness), m = meter(workLimit === undefined ? d.cap.work : worldInteger(workLimit, 0, d.cap.work));
  const hash = worldStationaryBoundaryHash(missionStationarySourceData(source).model, d.boundary, m.remaining); m.charge(hash.work + d.journalRows);
  const value = { schemaVersion: 1 as const, policy: MISSION_STATIONARY_POLICY, sourceSha256: source.sha256,
    worldStateSha256: hash.sha256, nextTick: witness.nextTick, journal: journal(d), teamRecords: d.teamRecords, actors: d.actors };
  const save = freeze(missionTeamSnapshot(value, n => m.charge(n))) as MissionStationarySave;
  return { save, work: m.work };
}

/** Untrusted serialized state is reconstructed from the source world. Lowered
 * execution work limits preserve original call boundaries and output semantics;
 * the recorded requested caps remain audit metadata. No live update calls this. */
export function restoreMissionStationaryWitness(source: MissionStationarySource, input: unknown, currentWorld: unknown,
  context: MissionTeamContext, lowerLimits: Partial<MissionStationaryLimits> = {}): Readonly<{ witness: MissionStationaryWitness; world: WorldSimulation; work: number }> {
  const cap = limits(lowerLimits), m = meter(cap.work), copied = missionTeamSnapshot(input, n => m.charge(n));
  const r = worldRecord(copied, ['schemaVersion', 'policy', 'sourceSha256', 'worldStateSha256', 'nextTick', 'journal', 'teamRecords', 'actors']);
  if (r.schemaVersion !== 1 || r.policy !== MISSION_STATIONARY_POLICY || r.sourceSha256 !== source.sha256) fail('save-source');
  const rows = worldList(r.journal, cap.journalRows), c = teamContext(source, context);
  m.charge(c.records.length * 32); if (worldHash(r.teamRecords) !== worldHash(c.records)) fail('save-team-history');
  const created = createMissionStationaryWitness(source, { ...cap, work: m.remaining }); m.charge(created.work);
  let witness = created.witness; const world = created.world;
  for (const value of rows) {
    const keys = Reflect.ownKeys(value as object) as string[], row = worldRecord(value, keys);
    const repetitions = worldInteger(row.repetitions, 1, cap.operations);
    if (row.kind !== 'step' && repetitions !== 1) fail('journal-repetition');
    const expected = row.kind === 'commands' ? ['kind', 'commands', 'repetitions'] : row.kind === 'step' ? ['kind', 'ticks', 'workLimit', 'repetitions'] :
      row.kind === 'transfer' ? ['kind', 'invocation', 'workLimit', 'repetitions'] : fail('journal-kind');
    worldRecord(row, expected);
    if (witness.operationCount + repetitions > cap.operations) fail('operation-limit');
    for (let repeat = 0; repeat < repetitions; repeat++) {
      // Reserve bounded core validation work before each temporary transaction.
      m.charge(creationWork(source)); let receipt: unknown;
      if (row.kind === 'commands') {
        const commands = worldList(row.commands, W.commands); m.charge(commands.length * 256);
        receipt = world.admitCommands(commands);
      } else if (row.kind === 'step') {
        const ticks = worldInteger(row.ticks, 1, W.stepTicks), limit = worldInteger(row.workLimit, 0, W.replayWork);
        receipt = world.step(ticks, Math.min(limit, m.remaining));
        const w = (receipt as { work: { entityVisits: number; navigationExpansions: number; transitions: number } }).work;
        m.charge(w.entityVisits + w.navigationExpansions + w.transitions);
      } else {
        const limit = worldInteger(row.workLimit, 0, W.replayWork);
        const result = world.transferOwnership(worldHouseInvocation(row.invocation), Math.min(limit, m.remaining)); m.charge(result.work); receipt = result;
      }
      const updated = advanceMissionStationaryWitness(source, witness, receipt, m.remaining); m.charge(updated.work); witness = updated.witness;
    }
  }
  const observed = observeMissionStationaryTeams(source, witness, context, m.remaining); m.charge(observed.work); witness = observed.witness;
  const saved = saveMissionStationaryWitness(source, witness, m.remaining); m.charge(saved.work);
  // Replayed limited caps are replaced only after complete successful replay;
  // operation contents, current state and actor invalidations remain verified.
  if (saved.save.worldStateSha256 !== r.worldStateSha256 || saved.save.nextTick !== r.nextTick || worldHash(saved.save.actors) !== worldHash(r.actors)) fail('save-reconstruction');
  const model = missionStationarySourceData(source).model;
  m.charge(creationWork(source)); const expectedWorld = WorldSimulation.restore(model, missionTeamSnapshot(currentWorld, n => m.charge(n)));
  const b = readWorldStationaryBoundary(expectedWorld), hash = worldStationaryBoundaryHash(model, b.boundary, m.remaining); m.charge(hash.work);
  if (hash.sha256 !== r.worldStateSha256) fail('save-world');
  // Keep original journal audit caps and compression after validation. These
  // cannot change live state, and all later commits still require genuine receipts.
  let head: JournalNode | null = null;
  for (const row of rows) head = { previous: head, row: freeze(row) as MissionStationaryJournalRow };
  const d = data(witness); witness = publish(source, witness.nextTick, witness.operationCount, { ...d, cap, journal: head, journalRows: rows.length });
  return { witness, world, work: m.work };
}
