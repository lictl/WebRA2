// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded source compiler; see ../COMBAT_INITIAL_RUNTIME_PROVENANCE.md.
import { compileCombatActors, isCombatActors, type CombatActors } from './combat-actors.ts';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from './entity-definitions.ts';
import { combatActorFingerprint as fingerprint } from './combat-actor-values.ts';
import { compileScenarioObjects } from './scenario-objects.ts';
import { assembleScenarioDefinitions } from './scenario-construction.ts';
import { createIniSourceView, findIniSourceSections, findIniSourceEntries, type IniSourceEntry } from './ini-source-view.ts';
import type { RuntimeIni, IniOrigin } from './runtime-ini.ts';
import { weaponInteger, weaponVerse, weaponFloatStore } from './weapon-numbers.ts';

export const COMBAT_INITIAL_RUNTIME_POLICY = 'webra2-fresh-placed-fire-source-1' as const;
export const COMBAT_INITIAL_RUNTIME_LIMITS = Object.freeze({ missionBytes: 16 * 1024 * 1024, types: 16384,
  placements: 32768, stages: 64, occurrences: 262144, fields: 1_048_576, history: 524288,
  work: 4_194_304, nodes: 2_000_000, characters: 64 * 1024 * 1024, serializedBytes: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof COMBAT_INITIAL_RUNTIME_LIMITS]: number };
export type FireFrameKey = 'FireUp' | 'FireProne' | 'SecondaryFire' | 'SecondaryProne';
export interface InitialFireType {
  readonly typeId: string; readonly kind: CombatActors['definitions'][number]['kind'];
  readonly image: EntityField<string>; readonly frames: Readonly<Record<FireFrameKey, EntityField<number>>>;
  readonly visits: readonly Readonly<{ layerId: string; image: string | null; reads: readonly Readonly<{ key: FireFrameKey; origin: IniOrigin | null }>[] }>[];
  /** This admits source timing only, never a live shot or a weapon selector. */
  readonly standingPrimary: Readonly<{ status: 'ready' | 'unsupported' | 'not-applicable'; reasons: readonly string[] }>;
}
export interface InitialCombatPlacement {
  readonly rowId: string; readonly actorId: number; readonly typeId: string | null;
  readonly actorArmor: 1 | null; readonly actorFirepower: 1 | null;
  readonly rankPercent: number | null; readonly veterancy: number | null;
  readonly rankOrigin: IniOrigin; readonly status: 'ready' | 'unsupported' | 'not-applicable'; readonly reasons: readonly string[];
}
export interface CombatInitialRuntime {
  readonly policy: typeof COMBAT_INITIAL_RUNTIME_POLICY; readonly profile: RuntimeIni['profile'];
  readonly source: CombatActors['source']; readonly sources: Readonly<{ rules: RuntimeIni['layers']; art: RuntimeIni['layers'] }>;
  readonly actorFingerprint: string; readonly entityFingerprint: string;
  readonly types: readonly InitialFireType[]; readonly placements: readonly InitialCombatPlacement[];
  readonly fingerprint: string; readonly nativeExecutionVerified: false; readonly canExecuteCombat: false;
}
export interface InfantryFiringProgram {
  readonly policy: typeof COMBAT_INITIAL_RUNTIME_POLICY; readonly sourceFingerprint: string; readonly profile: RuntimeIni['profile'];
  readonly rowId: string; readonly actorId: number; readonly typeId: string; readonly fireUp: number;
  readonly slot: 'primary'; readonly pose: 'standing-walk'; readonly fingerprint: string;
}
export class CombatInitialRuntimeError extends Error {
  constructor(readonly code: string) { super(`combat-initial-runtime-${code}`); this.name = 'CombatInitialRuntimeError'; }
}
function fail(code: string): never { throw new CombatInitialRuntimeError(code); }
const sources = new WeakSet<object>(), programs = new WeakSet<object>();
export const isCombatInitialRuntime = (v: unknown): v is CombatInitialRuntime => !!v && typeof v === 'object' && sources.has(v);
export const isInfantryFiringProgram = (v: unknown): v is InfantryFiringProgram => !!v && typeof v === 'object' && programs.has(v);
function owned<T>(v: T, keys: readonly string[]): T {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Reflect.ownKeys(v).length !== keys.length) fail('input');
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(v, key); if (!d || !('value' in d) || !d.enumerable) fail('input'); result[key] = d.value; }
  return result as T;
}
function limits(v: Partial<Limits>): Limits {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('limits');
  const cap: Limits = { ...COMBAT_INITIAL_RUNTIME_LIMITS };
  for (const k of Reflect.ownKeys(v)) { if (typeof k !== 'string' || !Object.hasOwn(cap, k)) fail('limits'); const d = Object.getOwnPropertyDescriptor(v, k)!;
    if (!('value' in d) || !d.enumerable || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[k as keyof Limits]) fail('limits'); cap[k as keyof Limits] = d.value; }
  return cap;
}
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const initial = <T>(value: T | null): EntityField<T> => ({ value, status: value === null ? 'not-applicable' : 'default', rule: 'native-constructor', origin: null, history: [] });
const imageName = (v: string): boolean => /^[A-Za-z0-9_-]{1,24}$/.test(v);

/** Authenticates mission bytes again; physical rules/art authentication belongs to the verified import session. */
export function compileCombatInitialRuntime(input: { readonly actors: CombatActors; readonly definitions: EntityDefinitions;
  readonly rules: RuntimeIni; readonly art: RuntimeIni; readonly mission: { readonly source: CombatActors['source']; readonly bytes: Uint8Array } }, options: Partial<Limits> = {}): CombatInitialRuntime {
  input = owned(input, ['actors', 'definitions', 'rules', 'art', 'mission']); const cap = limits(options);
  if (!isCombatActors(input.actors) || !isEntityDefinitions(input.definitions)) fail('brand');
  const { actors, definitions, rules, art } = input;
  const supplied = owned(input.mission, ['source', 'bytes']), source = owned(supplied.source, ['id', 'profile', 'sha256']);
  const raw = supplied.bytes;
  if (!(raw instanceof Uint8Array) || !ArrayBuffer.isView(raw) || Object.getPrototypeOf(raw) !== Uint8Array.prototype ||
    ['byteLength', 'buffer', 'byteOffset', 'slice'].some(key => Object.hasOwn(raw, key)) || raw.byteLength > cap.missionBytes ||
    !(raw.buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(raw.buffer)) fail('mission-bytes');
  const bytes = new Uint8Array(raw.byteLength); bytes.set(raw); const mission = { source, bytes };
  if (actors.entityFingerprint !== definitions.fingerprint) fail('entity-identity');
  const checked = compileCombatActors({ definitions, rules, mission }, cap);
  if (checked.fingerprint !== actors.fingerprint) fail('actor-identity');
  const av = createIniSourceView(art, { stages: cap.stages, occurrences: cap.occurrences, nodes: cap.nodes, characters: cap.characters, work: cap.work });
  if (av.profile !== actors.profile || fingerprint(art.layers, cap.serializedBytes) !== fingerprint(definitions.sources.art, cap.serializedBytes)) fail('art-identity');
  const objects = compileScenarioObjects({ profile: actors.profile, source: { ...mission.source }, bytes: mission.bytes }, { objects: cap.placements });
  const construction = assembleScenarioDefinitions({ objects, rules }, { placements: cap.placements, nodes: cap.nodes, characters: cap.characters });
  const constructed = construction.registries.flatMap(r => r.entries);
  if (constructed.length > cap.types || actors.placements.length > cap.placements) fail('count-limit');
  let work = 0, fields = 0, history = 0;
  const charge = (n = 1): void => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const lineage = (old: readonly IniOrigin[], origin: IniOrigin): readonly IniOrigin[] => {
    if (old.length + 1 > cap.history - history) fail('history-limit'); history += old.length + 1; return [...old, origin];
  };
  const cache = new Map<string, IniSourceEntry | null>();
  function lookup(section: string, key: string): IniSourceEntry | undefined {
    charge(); if (++fields > cap.fields) fail('field-limit');
    const id = section + '\0' + key; if (cache.has(id)) return cache.get(id) ?? undefined;
    let selected: IniSourceEntry | undefined;
    for (const stage of av.stages) {
      charge(); const sections = findIniSourceSections(av, stage.layer.id, section); if (sections.length > 1) fail('duplicate-art-section');
      if (!sections.length) continue;
      const entries = findIniSourceEntries(sections[0]!, key); if (entries.length > 1) fail('duplicate-art-key');
      if (entries.length) selected = entries[0];
    }
    cache.set(id, selected ?? null); return selected;
  }
  const entities = new Map(definitions.definitions.map(t => [t.id, t])), actorTypes = new Map(actors.definitions.map(t => [t.id, t]));
  const keys: readonly FireFrameKey[] = actors.profile === 'yr' ? ['FireUp', 'FireProne', 'SecondaryFire', 'SecondaryProne'] : ['FireUp', 'FireProne'];
  const types: InitialFireType[] = constructed.map(type => {
    charge(); const infantry = type.kind === 'infantry', entity = entities.get(type.id), actor = actorTypes.get(type.id);
    if (!entity || !actor) fail('type-identity');
    let image = initial<string>(imageName(type.name) ? type.name : null);
    const frames: Record<FireFrameKey, EntityField<number>> = { FireUp: initial(infantry ? 0 : null), FireProne: initial(infantry ? 0 : null),
      SecondaryFire: initial(infantry && actors.profile === 'yr' ? 0 : null), SecondaryProne: initial(infantry && actors.profile === 'yr' ? 0 : null) };
    const visits: InitialFireType['visits'][number][] = [];
    if (infantry) for (const stage of type.definitionStages) {
      charge(); const origins = stage.origins.filter(o => o.keySpelling === 'Image'); if (origins.length > 1) fail('duplicate-image');
      if (origins.length) {
        const origin = origins[0]!, text = origin.rawValue.split(';', 1)[0]!.replace(/^[ \t]+|[ \t]+$/g, '');
        image = { value: imageName(text) ? text : null, status: imageName(text) ? 'explicit' : 'unsupported', rule: 'exact-staged-type-image', origin, history: lineage(image.history, origin) };
      }
      const reads: InitialFireType['visits'][number]['reads'][number][] = [];
      for (const key of keys) {
        charge(); const old = frames[key];
        if (image.value === null) { frames[key] = { ...old, value: null, status: 'unsupported', rule: 'unsupported-image' }; reads.push({ key, origin: null }); continue; }
        const e = lookup(image.value, key); reads.push({ key, origin: e?.origin ?? null }); if (!e) continue;
        const history = lineage(old.history, e.origin);
        if (!e.value) { frames[key] = { ...old, history }; continue; }
        const value = e.value.length <= 127 ? weaponInteger(e.value) : null;
        frames[key] = { value, status: value === null ? 'unsupported' : 'explicit', rule: 'global-art-native-current-integer', origin: e.origin, history };
      }
      visits.push({ layerId: stage.layerId, image: image.value, reads });
    }
    const reasons: string[] = [];
    if (infantry) {
      if (!type.definitionStages.length) reasons.push('unloaded-type');
      if (entity.locomotor.value?.kind !== 'walk') reasons.push('not-walk-locomotor');
      if (actor.normalSlots.mode !== 'ordinary') reasons.push('nonordinary-weapon-slots');
      if (image.value === null) reasons.push('unsupported-image');
      if (frames.FireUp.value === null || frames.FireUp.value < 0 || frames.FireUp.value > 65535) reasons.push('unsupported-fire-up');
    }
    return { typeId: type.id, kind: type.kind, image, frames, visits,
      standingPrimary: { status: !infantry ? 'not-applicable' : reasons.length ? 'unsupported' : 'ready', reasons } };
  });
  const placements: InitialCombatPlacement[] = actors.placements.map((p, index) => {
    charge(); const kind = p.sourcePlacement.kind, relevant = kind === 'infantry' || kind === 'unit', reasons: string[] = [];
    let rankPercent: number | null = null, veterancy: number | null = null;
    if (relevant) {
      const row = p.sourcePlacement.row, text = row.origin.rawValue.split(';', 1)[0]!.replace(/^[ \t]+|[ \t]+$/g, '');
      if (text.length > 127 || /[^\x20-\x7e]/.test(text)) reasons.push('unsupported-native-row-buffer');
      if (row.values.length !== 14 || row.values.some(v => v === '')) reasons.push('unsupported-native-row-shape');
      if (!reasons.length) {
        const token = row.values[kind === 'infantry' ? 9 : 8]!;
        if (/^[+-]?\d+$/.test(token)) {
          const n = Number(token);
          if (Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647) {
            rankPercent = n || 0;
            const v = weaponVerse(`${rankPercent}%`);
            if (v !== null && v >= -65536 && v <= 65536) veterancy = actors.profile === 'yr' ? weaponFloatStore(v) : v;
          }
        }
        if (veterancy === null) reasons.push('unsupported-explicit-rank');
      }
      if (p.typeId === null) reasons.push('unresolved-type');
    }
    return { rowId: p.rowId, actorId: index + 1, typeId: p.typeId, actorArmor: relevant ? 1 : null, actorFirepower: relevant ? 1 : null,
      rankPercent, veterancy, rankOrigin: p.sourcePlacement.row.origin, status: !relevant ? 'not-applicable' : reasons.length ? 'unsupported' : 'ready', reasons };
  });
  const payload = { policy: COMBAT_INITIAL_RUNTIME_POLICY, profile: actors.profile, source: actors.source, sources: { rules: actors.sources, art: av.stages.map(s => s.layer) },
    actorFingerprint: actors.fingerprint, entityFingerprint: definitions.fingerprint, types, placements, nativeExecutionVerified: false as const, canExecuteCombat: false as const };
  const result = freeze({ ...payload, fingerprint: fingerprint(payload, cap.serializedBytes) }); sources.add(result); return result;
}

/** A primary-standing timing program, not authority to attack or proof of current live actor state. */
export function createInfantryFiringProgram(source: CombatInitialRuntime, rowId: string): InfantryFiringProgram {
  if (!isCombatInitialRuntime(source) || typeof rowId !== 'string' || rowId.length > 1024) fail('program-source');
  const placement = source.placements.find(p => p.rowId === rowId), type = source.types.find(t => t.typeId === placement?.typeId);
  if (!placement || placement.status !== 'ready' || !type || type.standingPrimary.status !== 'ready' || type.frames.FireUp.value === null) fail('program-unsupported');
  const payload = { policy: COMBAT_INITIAL_RUNTIME_POLICY, sourceFingerprint: source.fingerprint, profile: source.profile,
    rowId, actorId: placement.actorId, typeId: type.typeId, fireUp: type.frames.FireUp.value, slot: 'primary' as const, pose: 'standing-walk' as const };
  const result = freeze({ ...payload, fingerprint: fingerprint(payload, 65536) }); programs.add(result); return result;
}
