// SPDX-License-Identifier: GPL-3.0-or-later
// Original initial-world spatial source/resolution policy. See ../MISSION_WORLD_PROVENANCE.md.
import { isMissionCueCatalog, missionCueSourceParameters, type MissionCueCatalog } from '../../content/src/mission-cues.ts';
import { isMissionAudioPolicyCatalog, missionAudioPolicyContext, type MissionAudioPolicyCatalog } from '../../content/src/mission-audio-policy.ts';
import { isMissionBindingCatalog, missionBindingSourceContext, type MissionBindingCatalog } from './mission-bindings.ts';
import { worldContentTraversal } from './world-content.ts';
import { assertWorldModel, createWorldModel, type WorldModel } from './world-model.ts';
import { WorldSimulation, readWorldEntityPresence, type WorldSave } from './world.ts';
import { worldAddress, worldHash, worldInteger, worldPosition, worldRecord } from './world-values.ts';

export const MISSION_SPATIAL_AUDIO_SOURCE_POLICY = 'webra2-initial-flat-spatial-audio-1' as const;
export const MISSION_SPATIAL_AUDIO_LIMITS = Object.freeze({ instructions: 8192, actors: 2048, cells: 130816, references: 262144, work: 8_388_608 });
type Limits = { -readonly [K in keyof typeof MISSION_SPATIAL_AUDIO_LIMITS]: number };
export interface MissionSpatialAudioInstruction {
  readonly instructionId: string; readonly triggerId: string; readonly opcode: 99 | 116;
  readonly parameters: readonly string[];
  readonly waypoint: number | null;
  readonly cell: Readonly<{ x: number; y: number }> | null;
  readonly position: Readonly<{ x: number; y: number; z: number }> | null;
  readonly buildingIds: readonly number[]; readonly terrainIds: readonly number[];
  readonly soundIndex: number | null;
  readonly status: 'supported-initial-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionSpatialAudioSource {
  readonly policy: typeof MISSION_SPATIAL_AUDIO_SOURCE_POLICY; readonly sha256: string;
  readonly profile: 'ra2' | 'yr'; readonly missionSha256: string; readonly bindingsSha256: string;
  readonly baseWorldSha256: string; readonly traversalSha256: string; readonly cuesSha256: string; readonly audioSha256: string;
  readonly instructions: readonly MissionSpatialAudioInstruction[];
  readonly diagnostics: readonly Readonly<{ subjectId: string; code: string }>[];
  readonly geometry: 'initial-packed-map-flat-unoverlaid';
  readonly objectOrder: 'unique-building-before-unique-terrain';
  readonly nativeBehaviorVerified: false; readonly canStartCampaign: false;
}
export type MissionSpatialAudioTarget =
  | Readonly<{ kind: 'object'; entityId: number; family: 'structure' | 'terrain' }>
  | Readonly<{ kind: 'position'; x: number; y: number; z: number }>;
const sources = new WeakMap<MissionSpatialAudioSource, Readonly<{ bindings: MissionBindingCatalog; cues: MissionCueCatalog; audio: MissionAudioPolicyCatalog }>>();
function fail(code: string): never { throw new Error(`mission-spatial-audio-${code}`); }
function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const x of Object.values(v)) freeze(x); Object.freeze(v); } return v;
}
export const isMissionSpatialAudioSource = (v: unknown): v is MissionSpatialAudioSource => !!v && typeof v === 'object' && sources.has(v as MissionSpatialAudioSource);
export function missionSpatialAudioSourceContext(source: MissionSpatialAudioSource) { return sources.get(source) ?? fail('source-brand'); }
function limits(input: Partial<Limits>): Limits {
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('limits');
  const result: Limits = { ...MISSION_SPATIAL_AUDIO_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(result, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !d.enumerable) fail('limits');
    result[key as keyof Limits] = worldInteger(d.value, 0, result[key as keyof Limits]);
  }
  return result;
}
/** Native initial packed-map level is signed8. Flat GetCoords uses the paired
 * initialized scale104, adds0.5, then truncates. TMP height is not added here. */
function initialFlatZ(level: number): number {
  const raw = worldInteger(level, 0, 255), signed = raw < 128 ? raw : raw - 256;
  return Math.trunc(signed * 104 + 0.5);
}

/** Complete source records for the bounded initial-world route, not VM invocation
 * or playback authority. Ambiguous native object-list order remains unsupported. */
export function compileMissionSpatialAudioSource(input: Readonly<{ bindings: MissionBindingCatalog; cues: MissionCueCatalog; audio: MissionAudioPolicyCatalog }>, options: Partial<Limits> = {}): MissionSpatialAudioSource {
  const r = worldRecord(input, ['bindings', 'cues', 'audio']), cap = limits(options);
  if (!isMissionBindingCatalog(r.bindings) || !isMissionCueCatalog(r.cues) || !isMissionAudioPolicyCatalog(r.audio)) fail('factory');
  const { bindings, cues, audio } = r as unknown as typeof input;
  const original = missionBindingSourceContext(bindings), base = original.world.model, traversal = worldContentTraversal(original.world);
  if (missionAudioPolicyContext(audio).cues !== cues || cues.source.sha256 !== base.sourceSha256 || cues.profile !== bindings.profile ||
    !cues.spatialAudioPolicy || !cues.initialWaypointsSha256) fail('source-join');
  if (base.entities.length > cap.actors || traversal.cells.length > cap.cells) fail('count-limit');
  let work = 0, references = 0;
  const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const reference = (n = 1) => { if (n > cap.references - references) fail('reference-limit'); references += n; charge(n); };
  const instructions: MissionSpatialAudioInstruction[] = [], diagnostics: { subjectId: string; code: string }[] = [];
  const terrain = new Map(traversal.cells.map(c => { charge(); return [worldAddress(c.x, c.y), c] as const; }));
  const byId = new Map(base.entities.map(e => { charge(); return [e.id, e] as const; }));
  const members = new Map<number, { buildingIds: number[]; terrainIds: number[] }>();
  function member(at: number, id: number, kind: string) {
    reference(); const row = members.get(at) ?? { buildingIds: [], terrainIds: [] };
    const values = kind === 'structure' ? row.buildingIds : row.terrainIds;
    if (!values.includes(id)) values.push(id); members.set(at, row);
  }
  for (const entity of base.entities) if (entity.kind === 'structure' || entity.kind === 'terrain') member(worldAddress(entity.x, entity.y), entity.id, entity.kind);
  for (const footprint of base.footprints) {
    charge(); const entity = byId.get(footprint.entityId)!;
    if (entity.kind === 'structure' || entity.kind === 'terrain') for (const at of footprint.cells) member(at, entity.id, entity.kind);
  }
  charge(audio.bindings.length);
  const sounds = new Map(audio.bindings.map(b => [b.instructionId, b]));
  for (const cue of cues.instructions) {
    charge(); if (cue.opcode !== 99 && cue.opcode !== 116) continue;
    if (instructions.length >= cap.instructions) fail('instruction-limit');
    const reasons: string[] = [], location = cue.spatialLocation;
    const parameters = missionCueSourceParameters(cues, cue.id); if (!parameters) fail('source-parameters'); reference(parameters.length);
    if (cue.opcode === 116 ? cue.status !== 'resolved-reference' : cue.reasons.some(x => x !== 'sound-definition-sample-closure-unresolved')) reasons.push('cue-source');
    const selected = location ? terrain.get(worldAddress(location.x, location.y)) : undefined;
    const row = location ? members.get(worldAddress(location.x, location.y)) : undefined;
    let position: MissionSpatialAudioInstruction['position'] = null;
    if (!location || !selected) reasons.push('missing-waypoint-cell');
    else {
      if (selected.tmp.rampTypeByte !== 0) reasons.push('ramp-height');
      if (selected.overlayType !== 255) reasons.push('overlay-bridge-context');
      if (selected.extraTileWord !== 0 || selected.iceRaw !== 0) reasons.push('initial-cell-extra-state');
      if (!reasons.length) position = { x: location.x * 256 + 128, y: location.y * 256 + 128, z: initialFlatZ(selected.elevation) };
    }
    const buildingIds = row?.buildingIds ?? [], terrainIds = row?.terrainIds ?? []; reference(buildingIds.length + terrainIds.length);
    if (buildingIds.length > 1 || terrainIds.length > 1) reasons.push('native-object-order');
    const sound = sounds.get(cue.id); let soundIndex: number | null = null;
    if (cue.opcode === 99) {
      if (!sound || sound.opcode !== 99 || sound.instruction !== cue || sound.status !== 'supported-source' || sound.caller?.type !== 'spatial-sound' ||
        sound.reference.registryOrdinal === null) reasons.push('sound-source');
      else soundIndex = sound.reference.registryOrdinal;
    }
    instructions.push({ instructionId: cue.id, triggerId: cue.triggerId, opcode: cue.opcode, parameters,
      waypoint: location?.waypoint ?? null, cell: location ? { x: location.x, y: location.y } : null, position,
      buildingIds: [...buildingIds], terrainIds: [...terrainIds], soundIndex, status: reasons.length ? 'unsupported' : 'supported-initial-source', reasons });
    for (const code of reasons) diagnostics.push({ subjectId: cue.id, code });
  }
  const data = { policy: MISSION_SPATIAL_AUDIO_SOURCE_POLICY, profile: bindings.profile, missionSha256: base.sourceSha256,
    bindingsSha256: bindings.fingerprint, baseWorldSha256: base.sha256, traversalSha256: traversal.sha256,
    cuesSha256: cues.sha256, audioSha256: audio.sha256, instructions, diagnostics,
    geometry: 'initial-packed-map-flat-unoverlaid' as const, objectOrder: 'unique-building-before-unique-terrain' as const,
    nativeBehaviorVerified: false as const, canStartCampaign: false as const };
  const result = freeze({ ...data, sha256: worldHash(data) }); sources.set(result, freeze({ bindings, cues, audio })); return result;
}

const joinedModels = new WeakMap<MissionSpatialAudioSource, WeakSet<WorldModel>>();
function sourceWorldWork(source: MissionSpatialAudioSource, model: WorldModel): number {
  return source.instructions.length + model.entities.length + model.navigation.length + model.blocked.length +
    model.footprints.reduce((n, p) => n + p.cells.length + 1, 0);
}
function joinWorld(source: MissionSpatialAudioSource, model: WorldModel): void {
  const original = missionSpatialAudioSourceContext(source); assertWorldModel(model);
  let joined = joinedModels.get(source); if (joined?.has(model)) return;
  const base = createWorldModel({ contentIdentity: model.contentIdentity, sourceSha256: model.sourceSha256,
    definitionsSha256: model.definitionsSha256, entities: model.entities, navigation: model.navigation,
    blocked: model.blocked.map(worldPosition), footprints: model.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })) });
  if (base.sha256 !== source.baseWorldSha256 || base.sha256 !== original.bindings.worldSha256) fail('world-join');
  if (!joined) { joined = new WeakSet(); joinedModels.set(source, joined); } joined.add(model);
}
/** Own caller descriptors with a deterministic structural reservation before any
 * restore. The returned work is a resource policy, not a CPU instruction count. */
function captureCheckpoint(value: unknown, charge: (n: number) => void): WorldSave {
  const active = new WeakSet<object>();
  function copy(v: unknown, depth: number): unknown {
    charge(1); if (depth > 32) fail('checkpoint-depth');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { if (!Number.isFinite(v)) fail('checkpoint-number'); return v; }
    if (typeof v === 'string') { charge(v.length); return v; }
    if (!v || typeof v !== 'object' || active.has(v)) fail('checkpoint-data');
    const prototype = Object.getPrototypeOf(v), array = Array.isArray(v);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('checkpoint-data');
    active.add(v);
    if (array) {
      const length = Object.getOwnPropertyDescriptor(v, 'length');
      const n = worldInteger(length && 'value' in length ? length.value : undefined, 0, 65536); charge(n);
      if (Reflect.ownKeys(v).length !== n + 1) fail('checkpoint-array');
      const out: unknown[] = [];
      for (let i = 0; i < n; i++) { const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !('value' in d) || !d.enumerable) fail('checkpoint-data'); out.push(copy(d.value, depth + 1)); }
      active.delete(v); return out;
    }
    const keys = Reflect.ownKeys(v); charge(keys.length); if (keys.length > 64) fail('checkpoint-record');
    const out = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== 'string') fail('checkpoint-data'); charge(key.length);
      const d = Object.getOwnPropertyDescriptor(v, key); if (!d || !('value' in d) || !d.enumerable) fail('checkpoint-data');
      out[key] = copy(d.value, depth + 1);
    }
    active.delete(v); return out;
  }
  return copy(value, 0) as WorldSave;
}
/** Reserve the existing world ownership reconstruction scans, including no-op
 * transfers. Structural capture has already bounded/owned all nested input. */
function ownershipRestoreWork(model: WorldModel, checkpoint: WorldSave): number {
  const source = model.ownership; if (!source) return 0;
  const value = checkpoint?.state?.ownership;
  if (!value || !Array.isArray(value.lifecycle) || !Array.isArray(value.transfers) ||
    value.lifecycle.length > 2048 || value.transfers.length > 1024) fail('checkpoint-ownership');
  const pass = source.types.length + source.houses.length + source.tagChains.length + source.initialActors.length * 12 + source.instructions.length;
  let work = value.lifecycle.length * 6 + pass * (value.transfers.length * 3 + 2);
  for (const transfer of value.transfers) {
    if (!transfer || !Array.isArray(transfer.entityIds) || transfer.entityIds.length > 2048) fail('checkpoint-ownership');
    work += transfer.entityIds.length + 1;
  }
  if (model.infantryPassage) {
    if (!Array.isArray(value.sharing) || value.sharing.length > 2048) fail('checkpoint-ownership');
    work += model.entities.length * 4 + model.infantryPassage.alliances.length + model.blocked.length +
      model.footprints.reduce((n, p) => n + p.cells.length, 0) + value.sharing.length * (64 + model.infantryPassage.alliances.length * 18);
  }
  return work;
}
/** One-time bounded checkpoint ownership/restore. A genuine world is component
 * state; it does not prove an actual mission action occurred. */
export function restoreMissionSpatialAudioWorld(source: MissionSpatialAudioSource, model: WorldModel, checkpoint: WorldSave,
  workLimit: number = MISSION_SPATIAL_AUDIO_LIMITS.work): Readonly<{ world: WorldSimulation; work: number }> {
  missionSpatialAudioSourceContext(source); assertWorldModel(model);
  const limit = worldInteger(workLimit, 0, MISSION_SPATIAL_AUDIO_LIMITS.work); let work = 0;
  const charge = (n: number) => { if (n > limit - work) fail('work-limit'); work += n; };
  charge(sourceWorldWork(source, model)); joinWorld(source, model);
  const owned = captureCheckpoint(checkpoint, charge); charge(ownershipRestoreWork(model, owned));
  return Object.freeze({ world: WorldSimulation.restore(model, owned), work });
}
/** Query the exact current private world without serializing or revalidating its
 * history per action. The core authenticates the instance and occupancy lifetime. */
export function resolveMissionSpatialAudioInWorld(source: MissionSpatialAudioSource, world: WorldSimulation, instructionId: string,
  workLimit: number = MISSION_SPATIAL_AUDIO_LIMITS.work): Readonly<{ target: MissionSpatialAudioTarget; work: number }> {
  missionSpatialAudioSourceContext(source);
  const limit = worldInteger(workLimit, 0, MISSION_SPATIAL_AUDIO_LIMITS.work);
  if (source.instructions.length > limit) fail('work-limit');
  const instruction = source.instructions.find(i => i.instructionId === instructionId);
  if (!instruction || instruction.status !== 'supported-initial-source' || !instruction.position) fail('instruction');
  const presence = readWorldEntityPresence(world, [...instruction.buildingIds, ...instruction.terrainIds], limit - source.instructions.length);
  const work = sourceWorldWork(source, presence.model) + presence.work;
  if (work > limit) fail('work-limit'); joinWorld(source, presence.model);
  const actors = new Map(presence.entities.map(e => [e.entityId, e]));
  for (const [family, ids] of [['structure', instruction.buildingIds], ['terrain', instruction.terrainIds]] as const)
    for (const id of ids) if (actors.get(id)?.present) return freeze({ target: { kind: 'object' as const, entityId: id, family }, work });
  return freeze({ target: { kind: 'position' as const, ...instruction.position }, work });
}
/** Standalone read-only resolver. Input capture and ownership reconstruction are
 * charged before restore; repeated private actions use the already-owned seam. */
export function resolveMissionSpatialAudioTarget(source: MissionSpatialAudioSource, model: WorldModel, checkpoint: WorldSave, instructionId: string,
  workLimit: number = MISSION_SPATIAL_AUDIO_LIMITS.work): Readonly<{ target: MissionSpatialAudioTarget; work: number }> {
  const restored = restoreMissionSpatialAudioWorld(source, model, checkpoint, workLimit);
  const result = resolveMissionSpatialAudioInWorld(source, restored.world, instructionId, workLimit - restored.work);
  return Object.freeze({ target: result.target, work: restored.work + result.work });
}
