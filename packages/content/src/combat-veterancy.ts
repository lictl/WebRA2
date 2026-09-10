// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound ability and numerical modifier selection. See ../COMBAT_VETERANCY_PROVENANCE.md.
import { isCombatActors, type CombatActors } from './combat-actors.ts';
import { combatActorFingerprint as fingerprint } from './combat-actor-values.ts';
import type { EntityField } from './entity-definitions.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections, type IniSourceEntry } from './ini-source-view.ts';
import type { RuntimeIni, IniOrigin } from './runtime-ini.ts';
import { weaponDecimal } from './weapon-numbers.ts';

export const COMBAT_VETERANCY_POLICY = 'webra2-source-combat-veterancy-1' as const;
export const COMBAT_VETERANCY_LIMITS = Object.freeze({ types: 16384, stages: 64, occurrences: 262144,
  fields: 262144, history: 524288, tokens: 524288, work: 4_194_304, nodes: 2_000_000,
  characters: 64 * 1024 * 1024, serializedBytes: 32 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof COMBAT_VETERANCY_LIMITS]: number };
export const COMBAT_ABILITY_NAMES = Object.freeze(['FASTER', 'STRONGER', 'FIREPOWER', 'SCATTER', 'ROF',
  'SIGHT', 'CLOAK', 'TIBERIUM_PROOF', 'VEIN_PROOF', 'SELF_HEAL', 'EXPLODES', 'RADAR_INVISIBLE',
  'SENSORS', 'FEARLESS', 'C4', 'TIBERIUM_HEAL', 'GUARD_AREA', 'CRUSHER'] as const);
export type CombatAbility = typeof COMBAT_ABILITY_NAMES[number];
export interface CombatVeterancyType {
  readonly typeId: string; readonly kind: CombatActors['definitions'][number]['kind'];
  readonly veteran: EntityField<readonly CombatAbility[]>; readonly elite: EntityField<readonly CombatAbility[]>;
}
export interface CombatVeterancy {
  readonly policy: typeof COMBAT_VETERANCY_POLICY; readonly profile: RuntimeIni['profile'];
  readonly sources: RuntimeIni['layers']; readonly source: CombatActors['source']; readonly actorFingerprint: string;
  readonly general: Readonly<{ combat: EntityField<number>; armor: EntityField<number>; rof: EntityField<number> }>;
  readonly types: readonly CombatVeterancyType[]; readonly fingerprint: string;
  readonly nativeExecutionVerified: false; readonly canExecuteCombat: false;
}
export interface SelectedCombatVeterancy {
  readonly policy: typeof COMBAT_VETERANCY_POLICY; readonly sourceFingerprint: string; readonly typeId: string;
  readonly veterancy: number; readonly rank: 'negative' | 'rookie' | 'veteran' | 'elite';
  readonly enabled: Readonly<{ firepower: boolean | null; stronger: boolean | null; rof: boolean | null; explodes: boolean | null }>;
  readonly modifiers: Readonly<{ combat: number | null; armor: number | null; rof: number | null }>;
  readonly canExecuteCombat: false;
}
export class CombatVeterancyError extends Error {
  constructor(readonly code: string) { super(`combat-veterancy-${code}`); this.name = 'CombatVeterancyError'; }
}
function fail(code: string): never { throw new CombatVeterancyError(code); }
const brands = new WeakSet<object>();
export const isCombatVeterancy = (value: unknown): value is CombatVeterancy => !!value && typeof value === 'object' && brands.has(value);
function record(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) fail('record');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d) || !d.enumerable) fail('fields'); }
}
function settings(value: Partial<Limits>): Limits {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('limits');
  const cap: Limits = { ...COMBAT_VETERANCY_LIMITS };
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in d) || !d.enumerable || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[key as keyof Limits]) fail('limits');
    cap[key as keyof Limits] = d.value;
  }
  return cap;
}
function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v;
}
const initial = <T>(value: T | null, rule = 'native-constructor'): EntityField<T> => ({ value, status: value === null ? 'not-applicable' : 'default', rule, origin: null, history: [] });
const fold = (s: string): string => s.replace(/[a-z]/g, c => c.toUpperCase());

/** Source state only. Verified import sessions remain responsible for authenticating physical rules bytes. */
export function compileCombatVeterancy(input: { readonly actors: CombatActors; readonly rules: RuntimeIni }, options: Partial<Limits> = {}): CombatVeterancy {
  record(input, ['actors', 'rules']); const cap = settings(options);
  if (!isCombatActors(input.actors)) fail('actors-brand');
  const { actors, rules } = input, view = createIniSourceView(rules, { stages: cap.stages, occurrences: cap.occurrences,
    nodes: cap.nodes, characters: cap.characters, work: cap.work });
  if (view.profile !== actors.profile || fingerprint(rules.layers, cap.serializedBytes) !== fingerprint(actors.sources, cap.serializedBytes)) fail('source-identity');
  if (actors.definitions.length > cap.types) fail('type-limit');
  let work = 0, fields = 0, history = 0, tokens = 0;
  const charge = (n = 1): void => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const lineage = (old: readonly IniOrigin[], origin: IniOrigin): readonly IniOrigin[] => {
    if (old.length + 1 > cap.history - history) fail('history-limit'); history += old.length + 1; return [...old, origin];
  };
  function entry(layer: string, section: string, key: string): IniSourceEntry | undefined {
    charge(); if (++fields > cap.fields) fail('field-limit');
    const s = findIniSourceSections(view, layer, section); if (s.length > 1) fail('duplicate-section');
    if (!s.length) return undefined;
    const e = findIniSourceEntries(s[0]!, key); if (e.length > 1) fail('duplicate-key'); return e[0];
  }
  const general = { combat: initial(1), armor: initial(1), rof: initial(1) };
  for (const stage of view.stages) for (const [field, key] of [['combat', 'VeteranCombat'], ['armor', 'VeteranArmor'], ['rof', 'VeteranROF']] as const) {
    const e = entry(stage.layer.id, 'General', key); if (!e) continue;
    const old = general[field], history = lineage(old.history, e.origin);
    if (!e.value) { general[field] = { ...old, history }; continue; }
    const value = e.value.length <= 127 ? weaponDecimal(e.value) : null;
    general[field] = { value, status: value === null ? 'unsupported' : 'explicit', rule: 'native-current-double-read', origin: e.origin, history };
  }
  function abilities(old: EntityField<readonly CombatAbility[]>, origin: IniOrigin): EntityField<readonly CombatAbility[]> {
    const e = entry(origin.layerId, origin.sectionSpelling, origin.keySpelling);
    if (!e || fingerprint(e.origin, cap.serializedBytes) !== fingerprint(origin, cap.serializedBytes)) fail('ability-source');
    const history = lineage(old.history, origin);
    if (!e.value) return { ...old, history };
    if (e.value.length > 127 || /[^\x20-\x7e]/.test(e.value)) return { value: null, status: 'unsupported', rule: 'unsupported-native-string-buffer', origin, history };
    const parts = e.value.split(',').filter(Boolean); if (parts.length > cap.tokens - tokens) fail('token-limit'); tokens += parts.length; charge(parts.length);
    // Native strtok skips empty tokens, splits commas only and does not trim each token.
    const recognized = new Set(parts.map(fold));
    return { value: COMBAT_ABILITY_NAMES.filter(name => recognized.has(name)), status: 'explicit', rule: 'native-nonempty-ability-list-replaces', origin, history };
  }
  const types: CombatVeterancyType[] = actors.definitions.map(type => {
    charge(); const techno = ['infantry', 'unit', 'aircraft', 'structure'].includes(type.kind);
    let veteran = initial<readonly CombatAbility[]>(techno ? [] : null), elite = initial<readonly CombatAbility[]>(techno ? [] : null);
    if (techno) for (const origin of type.rawFields) {
      charge(); if (origin.keySpelling === 'VeteranAbilities') veteran = abilities(veteran, origin);
      else if (origin.keySpelling === 'EliteAbilities') elite = abilities(elite, origin);
    }
    return { typeId: type.id, kind: type.kind, veteran, elite };
  });
  const common = { policy: COMBAT_VETERANCY_POLICY, profile: actors.profile, sources: actors.sources, source: actors.source,
    actorFingerprint: actors.fingerprint, general, types, nativeExecutionVerified: false as const, canExecuteCombat: false as const };
  const result = freeze({ ...common, fingerprint: fingerprint(common, cap.serializedBytes) }); brands.add(result); return result;
}

/** Four inspected combat consumers only; other ability consumers and promotion/experience timing are separate work. */
export function selectCombatVeterancy(source: CombatVeterancy, input: { readonly typeId: string; readonly veterancy: number }): SelectedCombatVeterancy {
  if (!isCombatVeterancy(source)) fail('brand'); record(input, ['typeId', 'veterancy']);
  if (typeof input.typeId !== 'string') fail('type');
  const type = source.types.find(t => t.typeId === input.typeId);
  if (!type || !['infantry', 'unit', 'aircraft', 'structure'].includes(type.kind)) fail('type');
  const v = input.veterancy;
  if (!Number.isFinite(v) || Object.is(v, -0) || (source.profile === 'yr' && Math.fround(v) !== v) || v < -65536 || v > 65536) fail('veterancy');
  const rank = v < 0 ? 'negative' : v < 1 ? 'rookie' : v < 2 ? 'veteran' : 'elite';
  function enabled(name: CombatAbility): boolean | null {
    if (rank === 'negative' || rank === 'rookie') return false;
    const veteran = type!.veteran.value?.includes(name) ?? null;
    if (rank === 'veteran') return veteran;
    const elite = type!.elite.value?.includes(name) ?? null;
    return veteran === true || elite === true ? true : veteran === null || elite === null ? null : false;
  }
  const active = { firepower: enabled('FIREPOWER'), stronger: enabled('STRONGER'), rof: enabled('ROF'), explodes: enabled('EXPLODES') };
  const factor = (flag: boolean | null, field: EntityField<number>): number | null => flag === false ? 1 : flag === true ? field.value : null;
  return freeze({ policy: COMBAT_VETERANCY_POLICY, sourceFingerprint: source.fingerprint, typeId: type.typeId, veterancy: v, rank,
    enabled: active, modifiers: { combat: factor(active.firepower, source.general.combat), armor: factor(active.stronger, source.general.armor),
      rof: factor(active.rof, source.general.rof) }, canExecuteCombat: false as const });
}
