// SPDX-License-Identifier: GPL-3.0-or-later
// Original saved presentation-intent policy; see ../MISSION_WORLD_PROVENANCE.md.
import { missionSpatialAudioSourceContext, validateMissionSpatialAudioWorld,
  type MissionSpatialAudioSource, type MissionSpatialAudioInstruction, type MissionSpatialAudioTarget } from './mission-spatial-audio-source.ts';
import { readWorldEntityPresence, type WorldSimulation } from './world.ts';
import { worldInteger, worldList, worldRecord } from './world-values.ts';

/** D03: retain object desires and indefinitely looping positional intents. Old
 * transient starts are not replayed by save restore. Device clocks are absent. */
export const MISSION_SPATIAL_INTENT_POLICY = 'webra2-spatial-intent-resume-1' as const;
export const MISSION_SPATIAL_INTENT_LIMITS = Object.freeze({ objects: 2048, loops: 4096, requests: 1024, total: 1_000_000, work: 8_388_608 });
export interface MissionSpatialObjectIntent {
  readonly entityId: number; readonly family: 'structure' | 'terrain';
  readonly sequence: number; readonly instructionId: string; readonly soundIndex: number;
}
export interface MissionSpatialLoopIntent {
  readonly sequence: number; readonly instructionId: string; readonly soundIndex: number;
  readonly position: Readonly<{ x: number; y: number; z: number }>; readonly flags: 1;
}
export interface MissionSpatialIntentState {
  readonly policy: typeof MISSION_SPATIAL_INTENT_POLICY; readonly sourceSha256: string;
  readonly nextSequence: number; readonly objects: readonly MissionSpatialObjectIntent[];
  readonly loops: readonly MissionSpatialLoopIntent[];
}
/** Caller-driven component input. Only the compound adapter supplies actual
 * private VM requests; accepting this record alone confers no invocation power. */
export interface MissionSpatialIntentRequest {
  readonly sequence: number; readonly instructionId: string; readonly opcode: 99 | 116;
  readonly soundIndex: number | null; readonly target: MissionSpatialAudioTarget;
}
type Prepared = { readonly instructions: ReadonlyMap<string, MissionSpatialAudioInstruction>; readonly loops: ReadonlySet<string>; readonly work: number };
const prepared = new WeakMap<MissionSpatialAudioSource, Prepared>();
const states = new WeakMap<MissionSpatialIntentState, MissionSpatialAudioSource>();
function fail(code: string): never { throw new Error(`mission-spatial-intent-${code}`); }
function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v;
}
function budget(limit: number) {
  worldInteger(limit, 0, MISSION_SPATIAL_INTENT_LIMITS.work); let work = 0;
  return { charge(n: number) { if (n > limit - work) fail('work-limit'); work += n; }, get work() { return work; }, get remaining() { return limit - work; } };
}
function sourceData(source: MissionSpatialAudioSource, b: ReturnType<typeof budget>): Prepared {
  const context = missionSpatialAudioSourceContext(source);
  b.charge(source.instructions.length + context.audio.bindings.length);
  const cached = prepared.get(source); if (cached) return cached;
  const audio = new Map(context.audio.bindings.map(row => [row.instructionId, row]));
  const instructions = new Map(source.instructions.filter(i => i.status === 'supported-initial-source').map(i => [i.instructionId, i]));
  const loops = new Set<string>();
  for (const i of instructions.values()) if (i.opcode === 99) {
    const row = audio.get(i.instructionId);
    if (!row || row.status !== 'supported-source' || row.reference.registryOrdinal !== i.soundIndex || row.selection?.kind !== 'sound-sample-partitions') fail('sound-source');
    if (row.selection.loopRule === 'unbounded') loops.add(i.instructionId);
  }
  const result = { instructions, loops, work: source.instructions.length + context.audio.bindings.length }; prepared.set(source, result); return result;
}
function instruction(data: Prepared, id: unknown, opcode: unknown, sound: unknown): MissionSpatialAudioInstruction {
  const row = typeof id === 'string' ? data.instructions.get(id) : undefined;
  if (!row || row.opcode !== opcode || row.soundIndex !== sound) fail('instruction'); return row;
}
function target(row: MissionSpatialAudioInstruction, input: unknown): MissionSpatialAudioTarget {
  if (!input || typeof input !== 'object') fail('target');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'kind');
  const kind = descriptor && 'value' in descriptor ? descriptor.value : undefined;
  if (kind === 'object') {
    const r = worldRecord(input, ['kind', 'entityId', 'family']);
    const id = worldInteger(r.entityId, 1, 2147483647);
    if (r.kind !== 'object' || r.family !== 'structure' && r.family !== 'terrain') fail('object-family');
    if (!(r.family === 'structure' ? row.buildingIds : row.terrainIds).includes(id)) fail('object-source');
    return { kind, entityId: id, family: r.family };
  }
  const r = worldRecord(input, ['kind', 'x', 'y', 'z']);
  if (kind !== 'position' || r.kind !== 'position' || !row.position || r.x !== row.position.x || r.y !== row.position.y || r.z !== row.position.z) fail('position-source');
  return { kind, ...row.position };
}
function own(source: MissionSpatialAudioSource, nextSequence: number, objects: MissionSpatialObjectIntent[], loops: MissionSpatialLoopIntent[]): MissionSpatialIntentState {
  const state = freeze({ policy: MISSION_SPATIAL_INTENT_POLICY, sourceSha256: source.sha256, nextSequence, objects, loops });
  states.set(state, source); return state;
}
export function createMissionSpatialIntents(source: MissionSpatialAudioSource): MissionSpatialIntentState {
  sourceData(source, budget(MISSION_SPATIAL_INTENT_LIMITS.work)); return own(source, 0, [], []);
}
/** Restored data is component state, not proof of historic source execution. */
export function restoreMissionSpatialIntents(source: MissionSpatialAudioSource, input: unknown,
  workLimit: number = MISSION_SPATIAL_INTENT_LIMITS.work): Readonly<{ state: MissionSpatialIntentState; work: number }> {
  const b = budget(workLimit), data = sourceData(source, b), r = worldRecord(input, ['policy', 'sourceSha256', 'nextSequence', 'objects', 'loops']);
  if (r.policy !== MISSION_SPATIAL_INTENT_POLICY || r.sourceSha256 !== source.sha256) fail('state-identity');
  const next = worldInteger(r.nextSequence, 0, MISSION_SPATIAL_INTENT_LIMITS.total);
  const objectRows = worldList(r.objects, MISSION_SPATIAL_INTENT_LIMITS.objects), loopRows = worldList(r.loops, MISSION_SPATIAL_INTENT_LIMITS.loops);
  b.charge(objectRows.length + loopRows.length); if (!next && (objectRows.length || loopRows.length)) fail('initial-state');
  const seen = new Set<number>(); let previousObject = 0, previousLoop = -1;
  const sequence = (v: unknown) => { const n = worldInteger(v, 0, next - 1); if (seen.has(n)) fail('sequence-duplicate'); seen.add(n); return n; };
  const objects = objectRows.map(value => {
    const q = worldRecord(value, ['entityId', 'family', 'sequence', 'instructionId', 'soundIndex']);
    const row = instruction(data, q.instructionId, 99, q.soundIndex), selected = target(row, { kind: 'object', entityId: q.entityId, family: q.family });
    if (selected.kind !== 'object' || selected.entityId <= previousObject) fail('object-order'); previousObject = selected.entityId;
    return { entityId: selected.entityId, family: selected.family, sequence: sequence(q.sequence), instructionId: row.instructionId, soundIndex: row.soundIndex! };
  });
  const loops = loopRows.map(value => {
    const q = worldRecord(value, ['sequence', 'instructionId', 'soundIndex', 'position', 'flags']);
    const row = instruction(data, q.instructionId, 99, q.soundIndex), p = worldRecord(q.position, ['x', 'y', 'z']);
    const selected = target(row, { kind: 'position', ...p }), id = sequence(q.sequence);
    if (selected.kind !== 'position' || !data.loops.has(row.instructionId) || q.flags !== 1 || id <= previousLoop) fail('loop-source'); previousLoop = id;
    return { sequence: id, instructionId: row.instructionId, soundIndex: row.soundIndex!, position: { x: selected.x, y: selected.y, z: selected.z }, flags: 1 as const };
  });
  return { state: own(source, next, objects, loops), work: b.work };
}
/** Apply component records atomically. The genuine world provides current
 * presence; no caller-owned health/death list or audio clock is consulted. */
export function appendMissionSpatialIntents(source: MissionSpatialAudioSource, state: MissionSpatialIntentState,
  requests: readonly MissionSpatialIntentRequest[], world: WorldSimulation,
  workLimit: number = MISSION_SPATIAL_INTENT_LIMITS.work): Readonly<{ state: MissionSpatialIntentState; work: number; sourceDispatchVerified: false }> {
  const b = budget(workLimit), data = sourceData(source, b);
  if (states.get(state) !== source) fail('state-brand');
  const rows = worldList(requests, MISSION_SPATIAL_INTENT_LIMITS.requests);
  if (rows.length > MISSION_SPATIAL_INTENT_LIMITS.total - state.nextSequence) fail('sequence-limit');
  b.charge(state.objects.length + state.loops.length + rows.length);
  const objects = new Map(state.objects.map(o => [o.entityId, o])); let loops = [...state.loops];
  for (let at = 0; at < rows.length; at++) {
    const r = worldRecord(rows[at], ['sequence', 'instructionId', 'opcode', 'soundIndex', 'target']);
    if (r.sequence !== state.nextSequence + at) fail('sequence');
    const row = instruction(data, r.instructionId, r.opcode, r.soundIndex), selected = target(row, r.target), id = state.nextSequence + at;
    if (selected.kind === 'object') {
      if (row.opcode === 116) objects.delete(selected.entityId);
      else {
        if (!objects.has(selected.entityId) && objects.size >= MISSION_SPATIAL_INTENT_LIMITS.objects) fail('object-limit');
        objects.set(selected.entityId, { entityId: selected.entityId, family: selected.family, sequence: id, instructionId: row.instructionId, soundIndex: row.soundIndex! });
      }
    } else if (row.opcode === 116) {
      b.charge(loops.length);
      loops = loops.filter(p => p.position.x !== selected.x || p.position.y !== selected.y || p.position.z !== selected.z);
    } else if (data.loops.has(row.instructionId)) {
      if (loops.length >= MISSION_SPATIAL_INTENT_LIMITS.loops) fail('loop-limit');
      loops.push({ sequence: id, instructionId: row.instructionId, soundIndex: row.soundIndex!, position: { x: selected.x, y: selected.y, z: selected.z }, flags: 1 });
    }
  }
  const presence = readWorldEntityPresence(world, [...objects.keys()], b.remaining); b.charge(presence.work);
  b.charge(validateMissionSpatialAudioWorld(source, presence.model, b.remaining));
  for (const actor of presence.entities) if (!actor.present) objects.delete(actor.entityId);
  return { state: own(source, state.nextSequence + rows.length, [...objects.values()].sort((a, z) => a.entityId - z.entityId), loops), work: b.work, sourceDispatchVerified: false };
}
