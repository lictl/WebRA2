// SPDX-License-Identifier: GPL-3.0-or-later
// Original engine-input ledger. This is not UI or mission-dispatch authority.
import { teamFingerprint } from '../../content/src/team-values.ts';
import { worldList, worldRecord } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { isMissionHouseSource } from './mission-house-source.ts';
import { houseFail as fail, houseInteger as integer, houseBoolean as bool } from './mission-house-values.ts';
import { MISSION_HOUSE_STATE_POLICY, type MissionHouseSource, type MissionHouseState, type MissionHouseActor,
  type MissionHouseParticipation, type MissionHouseChange, type MissionHouseCounts, type MissionHouseTransferPlan } from './mission-house-types.ts';
export type MissionHouseSave = Omit<MissionHouseState, 'counts'>;
const contexts = new WeakMap<object, MissionHouseSource>(), plans = new WeakMap<object, MissionHouseState>();
export const isMissionHouseState = (value: unknown): value is MissionHouseState => !!value && typeof value === 'object' && contexts.has(value);
function sourceOf(state: MissionHouseState) { return contexts.get(state) ?? fail('state-brand'); }
const actorKeys = ['entityId', 'typeId', 'owner', 'tagId', 'exists', 'registered', 'present', 'tagEligible'];
const participationKeys = ['entityId', 'exists', 'registered', 'present', 'tagEligible'];
function participation(value: unknown): MissionHouseParticipation {
  const r = worldRecord(value, participationKeys), result = { entityId: integer(r.entityId), exists: bool(r.exists),
    registered: bool(r.registered), present: bool(r.present), tagEligible: bool(r.tagEligible) };
  if ((!result.exists && (result.registered || result.present || result.tagEligible)) || (result.present && !result.registered)) fail('participation');
  return result;
}
function actor(value: unknown): MissionHouseActor {
  const r = worldRecord(value, actorKeys);
  if (typeof r.typeId !== 'string' || r.typeId.length > 255 || (r.tagId !== null && (typeof r.tagId !== 'string' || r.tagId.length > 255))) fail('actor');
  return { ...participation(Object.fromEntries(participationKeys.map(k => [k, r[k]]))), typeId: r.typeId, owner: r.owner === null ? null : integer(r.owner), tagId: r.tagId as string | null };
}
function meter(source: MissionHouseSource, lowerWork: number | undefined) {
  const limit = lowerWork === undefined ? source.limits.work : integer(lowerWork, source.limits.work); let work = 0;
  return (n = 1) => { if (n > limit - work) fail('work-limit'); work += n; };
}
function publish(source: MissionHouseSource, actors: MissionHouseActor[], nextEntityId: number, revision: number,
  charge: (n?: number) => void): MissionHouseState {
  charge(source.types.length + source.houses.length + source.tagChains.length + source.initialActors.length + actors.length * 2);
  if (actors.length > source.limits.actors) fail('actor-limit');
  const types = new Map(source.types.map(t => [t.typeId, t])), owners = new Set(source.houses.map(h => h.playerId)), tags = new Set(source.tagChains.map(t => t.tagId));
  const initial = new Map(source.initialActors.map(a => [a.entityId, a]));
  const empty = () => ({ building: 0, unit: 0, infantry: 0, aircraft: 0 });
  const counters = new Map(source.houses.map(h => [h.playerId, { playerId: h.playerId, registered: empty(), present: empty(), unknownRegistered: 0, unknownPresent: 0 }]));
  let previous = -1;
  for (const a of actors) {
    charge(); const type = types.get(a.typeId), original = initial.get(a.entityId);
    if (a.entityId <= previous || a.entityId >= nextEntityId || !type || (a.owner !== null && !owners.has(a.owner)) ||
      (a.owner === null && ['unit', 'infantry', 'structure', 'aircraft'].includes(type.kind)) || (a.tagId !== null && !tags.has(a.tagId))) fail('actor-identity');
    if (original && (original.typeId !== a.typeId || original.tagId !== a.tagId)) fail('initial-actor-identity');
    previous = a.entityId; initial.delete(a.entityId);
    if (a.owner === null) continue;
    const count = counters.get(a.owner)!;
    if (a.registered) { if (type.registeredClass === null) count.unknownRegistered++; else if (type.registeredClass !== 'none') count.registered[type.registeredClass]++; }
    if (a.present) { if (type.presentClass === null) count.unknownPresent++; else if (type.presentClass !== 'none') count.present[type.presentClass]++; }
  }
  if (initial.size) fail('initial-actor-omission');
  const initialNext = source.initialActors.reduce((n, a) => Math.max(n, a.entityId + 1), 0);
  if (nextEntityId !== Math.max(initialNext, previous + 1)) fail('next-entity-id');
  // Every constructed ID remains as an owned tombstone after removal. No ID reuse
  // or arbitrary gap can bypass a constructor or remove another actor's history.
  const born = actors.filter(a => a.entityId >= initialNext);
  if (born.some((a, i) => a.entityId !== initialNext + i)) fail('constructed-identity-gap');
  const body = { schemaVersion: 1 as const, policy: MISSION_HOUSE_STATE_POLICY, sourceSha256: source.sha256,
    actors, nextEntityId, revision };
  const result: MissionHouseState = freeze({ ...body, counts: [...counters.values()], sha256: teamFingerprint(body, source.limits.serializedBytes) });
  contexts.set(result, source); return result;
}

/** Exactly one explicit participation row per initial model actor. Initial owner,
 * type and tag come from the genuine source, never the caller's observation. */
export function createMissionHouseState(source: MissionHouseSource, values: readonly MissionHouseParticipation[], workLimit?: number): MissionHouseState {
  if (!isMissionHouseSource(source)) fail('source-brand'); const charge = meter(source, workLimit);
  charge(source.initialActors.length);
  const rows = worldList(values, source.limits.actors); charge(rows.length * 5);
  const byId = new Map<number, MissionHouseParticipation>();
  for (const value of rows) { const a = participation(value); if (byId.has(a.entityId)) fail('duplicate-actor'); byId.set(a.entityId, a); }
  if (rows.length !== source.initialActors.length) fail('initial-actor-omission');
  const actors = source.initialActors.map(a => ({ ...a, ...(byId.get(a.entityId) ?? fail('initial-actor-omission')) })).sort((a, b) => a.entityId - b.entityId);
  const next = actors.length ? actors.at(-1)!.entityId + 1 : 0; integer(next);
  return publish(source, actors, next, 0, charge);
}
/** All changes publish together. The owning world transaction must establish
 * construction/removal/limbo facts and update orders, targets and occupancy too. */
export function applyMissionHouseChanges(state: MissionHouseState, values: readonly MissionHouseChange[], workLimit?: number): MissionHouseState {
  const source = sourceOf(state), charge = meter(source, workLimit), rows = worldList(values, source.limits.changes);
  charge(rows.length * 10 + state.actors.length);
  const actors = new Map(state.actors.map(a => [a.entityId, a])); let next = state.nextEntityId;
  for (const value of rows) {
    if (!value || typeof value !== 'object') fail('change');
    const kind = Object.getOwnPropertyDescriptor(value, 'kind'); if (!kind || !('value' in kind)) fail('change');
    if (kind.value === 'insert') {
      const r = worldRecord(value, ['kind', 'actor']), a = actor(r.actor);
      if (a.entityId !== next || actors.has(a.entityId) || !a.exists || next >= 0x7fffffff || actors.size >= source.limits.actors) fail('insert');
      actors.set(next++, a);
    } else if (kind.value === 'participation') {
      const r = worldRecord(value, ['kind', 'participation']), p = participation(r.participation), old = actors.get(p.entityId);
      if (!old || !old.exists || !p.exists) fail('participation-transition');
      actors.set(p.entityId, { ...old, ...p });
    } else if (kind.value === 'transfer') {
      const r = worldRecord(value, ['kind', 'entityId', 'owner']), id = integer(r.entityId), old = actors.get(id);
      if (!old?.exists || !old.registered) fail('transfer-actor'); actors.set(id, { ...old, owner: integer(r.owner) });
    } else if (kind.value === 'remove') {
      const r = worldRecord(value, ['kind', 'entityId']), id = integer(r.entityId), old = actors.get(id);
      if (!old?.exists) fail('remove-actor');
      actors.set(id, { ...old, exists: false, registered: false, present: false, tagEligible: false });
    } else fail('change');
  }
  return publish(source, [...actors.values()].sort((a, b) => a.entityId - b.entityId), next, integer(state.revision + 1), charge);
}
export function saveMissionHouseState(state: MissionHouseState): MissionHouseSave {
  sourceOf(state); const { counts: _counts, ...save } = state; return freeze(save);
}
export function restoreMissionHouseState(source: MissionHouseSource, value: unknown, workLimit?: number): MissionHouseState {
  if (!isMissionHouseSource(source)) fail('source-brand'); const charge = meter(source, workLimit);
  const r = worldRecord(value, ['schemaVersion', 'policy', 'sourceSha256', 'actors', 'nextEntityId', 'revision', 'sha256']);
  if (r.schemaVersion !== 1 || r.policy !== MISSION_HOUSE_STATE_POLICY || r.sourceSha256 !== source.sha256) fail('save-identity');
  const rows = worldList(r.actors, source.limits.actors); charge(rows.length * 8);
  const state = publish(source, rows.map(actor), integer(r.nextEntityId), integer(r.revision), charge);
  if (r.sha256 !== state.sha256) fail('save-hash'); return state;
}
/** Selection only. The caller's source-house context must be authenticated by the
 * mission VM. Static tag chains follow the existing logical retained-action policy;
 * dynamic tag reassignment is not represented by this source catalog. */
export function planMissionHouseTransfer(state: MissionHouseState, instructionId: string,
  invocation: Readonly<{ sourceHouse: number; triggerHouse: number }>, workLimit?: number): MissionHouseTransferPlan {
  const source = sourceOf(state), charge = meter(source, workLimit), context = worldRecord(invocation, ['sourceHouse', 'triggerHouse']);
  const sourceHouse = integer(context.sourceHouse), triggerHouse = integer(context.triggerHouse);
  charge(source.instructions.length + source.types.length + source.tagChains.length + source.houses.length);
  const instruction = source.instructions.find(i => i.instructionId === instructionId);
  if (!instruction || instruction.kind !== 'action' || instruction.status !== 'supported-source' ||
    !source.houses.some(h => h.playerId === sourceHouse) || !source.houses.some(h => h.playerId === triggerHouse)) fail('transfer-instruction');
  const destinationHouse = instruction.selector.kind === 'current-trigger-house' ? triggerHouse : instruction.selector.playerId;
  if (destinationHouse === null) fail('transfer-instruction');
  const types = new Map(source.types.map(t => [t.typeId, t])), tags = new Map(source.tagChains.map(t => [t.tagId, t.triggerIds]));
  const first: number[] = [], last: number[] = [], changed: number[] = [];
  for (const a of state.actors) {
    charge(); const type = types.get(a.typeId)!;
    if (!a.exists || !['unit', 'infantry', 'structure', 'aircraft'].includes(type.kind)) continue;
    let selected = a.owner === sourceHouse;
    if (instruction.opcode === 14) { const chain = a.tagId === null ? [] : tags.get(a.tagId) ?? []; charge(chain.length); selected = a.tagEligible && chain.includes(instruction.triggerId); }
    if (!selected) continue;
    if (!a.registered) fail('unregistered-transfer-context');
    if (instruction.opcode === 36 && type.transferPhase === null) fail('transfer-pass');
    (instruction.opcode === 36 && type.transferPhase === 1 ? last : first).push(a.entityId);
  }
  const ids = [...first, ...last], byId = new Map(state.actors.map(a => [a.entityId, a])); charge(state.actors.length + ids.length);
  for (const id of ids) if (byId.get(id)!.owner !== destinationHouse) changed.push(id);
  const plan: MissionHouseTransferPlan = freeze({ sourceSha256: source.sha256, stateSha256: state.sha256, instructionId, sourceHouse,
    destinationHouse, entityIds: ids, changedEntityIds: changed, orderPolicy: 'stable-entity-id-with-yr-powered-second-pass' });
  plans.set(plan, state); return plan;
}
export function applyMissionHouseTransfer(state: MissionHouseState, plan: MissionHouseTransferPlan, workLimit?: number): MissionHouseState {
  if (plans.get(plan) !== state) fail('transfer-plan-brand');
  return applyMissionHouseChanges(state, plan.changedEntityIds.map(entityId => ({ kind: 'transfer' as const, entityId, owner: plan.destinationHouse })), workLimit);
}
export function evaluateMissionHousePopulation(state: MissionHouseState, instructionId: string): Readonly<{ status: 'supported' | 'unsupported'; value: boolean | null }> {
  const source = sourceOf(state), instruction = source.instructions.find(i => i.instructionId === instructionId);
  if (!instruction || instruction.kind !== 'event' || instruction.status !== 'supported-source') return freeze({ status: 'unsupported', value: null });
  const count = state.counts.find(c => c.playerId === instruction.selector.playerId) ?? fail('population-house');
  const mobile = source.profile === 'ra2' ? count.registered : count.present;
  if ((instruction.opcode !== 9 && count.unknownRegistered) || (instruction.opcode !== 10 && (source.profile === 'ra2' ? count.unknownRegistered : count.unknownPresent))) return freeze({ status: 'unsupported', value: null });
  const value = instruction.opcode === 9 ? mobile.unit === 0 && mobile.infantry === 0 : instruction.opcode === 10 ? count.registered.building === 0 :
    count.registered.building === 0 && mobile.unit === 0 && mobile.infantry === 0;
  return freeze({ status: 'supported', value });
}
