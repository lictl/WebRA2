// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../COMBAT_MODIFIERS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { isCombatActors, type CombatActors } from './combat-actors.ts';
import { combatActorFingerprint as fingerprint } from './combat-actor-values.ts';
import type { EntityField } from './entity-definitions.ts';
import { compileRuntimeIni, type RuntimeIni } from './runtime-ini.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections, type IniSourceSection } from './ini-source-view.ts';
import { compileScenarioObjects } from './scenario-objects.ts';
import { assembleScenarioDefinitions, type ConstructionCountry } from './scenario-construction.ts';
import { weaponDecimal, weaponFloatStore } from './weapon-numbers.ts';

export const COMBAT_MODIFIERS_POLICY = 'webra2-campaign-house-modifiers-1' as const;
export const COMBAT_MODIFIERS_LIMITS = Object.freeze({ missionBytes: 16 * 1024 * 1024, stages: 64,
  occurrences: 262144, countries: 256, houses: 256, placements: 32768, fields: 262144,
  history: 262144, work: 4_194_304, characters: 64 * 1024 * 1024, nodes: 2_000_000,
  serializedBytes: 32 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof COMBAT_MODIFIERS_LIMITS]: number };
type Load = Readonly<{ layerId: string; section: string; line: number }>;
export interface CountryCombatFields {
  readonly firepower: EntityField<number>; readonly armor: EntityField<number>; readonly rof: EntityField<number>;
  readonly armorInfantry: EntityField<number>; readonly armorUnits: EntityField<number>;
}
export interface CountryCombatModifiers {
  readonly id: string; readonly name: string; readonly index: number;
  readonly allocation: ConstructionCountry['allocation']; readonly parentCountry: ConstructionCountry['parentCountry'];
  readonly fields: CountryCombatFields; readonly loadStages: readonly Load[];
}
export interface DifficultyCombatModifiers {
  readonly index: 0 | 1 | 2; readonly section: 'Easy' | 'Normal' | 'Difficult'; readonly loadStages: readonly Load[];
  readonly fields: Readonly<{ firepower: EntityField<number>; armor: EntityField<number>; rof: EntityField<number> }>;
}
export interface CampaignHouseModifiers {
  readonly houseId: string; readonly houseIndex: number; readonly countryId: string | null; readonly difficultyIndex: 0 | 1 | 2;
  readonly fields: Readonly<{ firepower: EntityField<number>; storedArmor: EntityField<number>; rof: EntityField<number>;
    countryArmorInfantry: EntityField<number>; countryArmorUnits: EntityField<number> }>;
  /** These names identify unavailable numerical inputs, not permission to skip their consumers. */
  readonly unavailableFields: readonly string[];
}
export interface CombatModifiers {
  readonly policy: typeof COMBAT_MODIFIERS_POLICY; readonly profile: RuntimeIni['profile'];
  readonly source: CombatActors['source']; readonly sources: RuntimeIni['layers']; readonly actorFingerprint: string;
  readonly countries: readonly CountryCombatModifiers[]; readonly difficulties: readonly DifficultyCombatModifiers[];
  readonly houses: readonly CampaignHouseModifiers[]; readonly fingerprint: string;
  readonly nativeExecutionVerified: false; readonly canExecuteCombat: false;
  readonly requiredRuntimeWork: readonly string[];
}
export interface CombatModifierInput {
  readonly actors: CombatActors; readonly rules: RuntimeIni;
  readonly mission: Readonly<{ source: CombatActors['source']; bytes: Uint8Array }>;
  /** Complete explicit choices; this component does not guess human/AI difficulty mapping. */
  readonly houseDifficultyIndices: readonly Readonly<{ houseId: string; index: 0 | 1 | 2 }>[];
}
export class CombatModifiersError extends Error {
  constructor(readonly code: string) { super(`combat-modifiers-${code}`); this.name = 'CombatModifiersError'; }
}
const brand = new WeakSet<object>();
export const isCombatModifiers = (value: unknown): value is CombatModifiers => value !== null && typeof value === 'object' && brand.has(value);
function fail(code: string): never { throw new CombatModifiersError(code); }
function record(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) fail('record');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d) || !d.enumerable) fail('fields'); }
}
function settings(value: Partial<Limits>): Limits {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('limits');
  const limits: Limits = { ...COMBAT_MODIFIERS_LIMITS };
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.hasOwn(limits, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > limits[key as keyof Limits]) fail('limits');
    limits[key as keyof Limits] = d.value;
  }
  return limits;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const initial = (value: number | null, rule: string): EntityField<number> => ({ value, status: value === null ? 'unsupported' : 'default', rule, origin: null, history: [] });
const names = ['Easy', 'Normal', 'Difficult'] as const;
const countryKeys = { firepower: 'Firepower', armor: 'Armor', rof: 'ROF', armorInfantry: 'ArmorInfantryMult', armorUnits: 'ArmorUnitsMult' } as const;
const difficultyKeys = { firepower: 'FirePower', armor: 'Armor', rof: 'ROF' } as const;

/** Typed source state and explicit campaign difficulty application; not a live actor capability. */
export function compileCombatModifiers(input: CombatModifierInput, options: Partial<Limits> = {}): CombatModifiers {
  const cap = settings(options);
  record(input, ['actors', 'rules', 'mission', 'houseDifficultyIndices']); record(input.mission, ['source', 'bytes']);
  if (!isCombatActors(input.actors)) fail('actors-brand');
  const { actors, rules, mission } = input, profile = actors.profile;
  record(mission.source, ['id', 'profile', 'sha256']);
  if (mission.source.id !== actors.source.id || mission.source.profile !== profile || mission.source.sha256 !== actors.source.sha256) fail('mission-identity');
  const raw = mission.bytes;
  if (!(raw instanceof Uint8Array) || Object.getPrototypeOf(raw) !== Uint8Array.prototype ||
      ['byteLength', 'buffer', 'byteOffset', 'slice'].some(key => Object.hasOwn(raw, key)) || raw.byteLength > cap.missionBytes ||
      !(raw.buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(raw.buffer)) fail('mission-bytes');
  const bytes = new Uint8Array(raw.byteLength); bytes.set(raw);
  const hash = Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== mission.source.sha256) fail('mission-hash');
  const viewLimits = { stages: cap.stages, occurrences: cap.occurrences, nodes: cap.nodes, characters: cap.characters, work: cap.work };
  const view = createIniSourceView(rules, viewLimits);
  if (view.profile !== profile || fingerprint(rules.layers, cap.serializedBytes) !== fingerprint(actors.sources, cap.serializedBytes)) fail('rules-identity');
  const map = view.stages.at(-1);
  if (!map || map.layer.kind !== 'map' || map.layer.sourceSha256 !== hash) fail('mission-stage');
  const { encoding: _encoding, bytes: _count, ...layer } = map.layer;
  const ownedMap = createIniSourceView(compileRuntimeIni(profile, [{ ...layer, bytes }]), viewLimits);
  if (fingerprint(map, cap.serializedBytes) !== fingerprint(ownedMap.stages[0], cap.serializedBytes)) fail('mission-table');
  const objects = compileScenarioObjects({ profile, source: { ...mission.source }, bytes }, { objects: cap.placements, houses: cap.houses });
  const construction = assembleScenarioDefinitions({ objects, rules }, { stages: cap.stages, occurrences: cap.occurrences,
    houses: cap.houses, placements: cap.placements, fields: cap.fields, nodes: cap.nodes, characters: cap.characters, work: cap.work });
  if (construction.countries.length > cap.countries || construction.houses.length > cap.houses || actors.houses.length !== construction.houses.length) fail('count');
  const actorHouses = new Map(actors.houses.map(h => [h.houseId, h]));
  for (const house of construction.houses) {
    const actor = actorHouses.get(house.id);
    if (!actor || actor.houseIndex !== house.index || actor.name !== house.name || actor.countryId !== house.country.id) fail('house-identity');
  }
  const choices = input.houseDifficultyIndices;
  if (!Array.isArray(choices) || Object.getPrototypeOf(choices) !== Array.prototype || choices.length !== actors.houses.length || choices.length > cap.houses || Reflect.ownKeys(choices).length !== choices.length + 1) fail('difficulty-list');
  const difficultyByHouse = new Map<string, 0 | 1 | 2>();
  for (let i = 0; i < choices.length; i++) {
    const d = Object.getOwnPropertyDescriptor(choices, String(i)); if (!d || !('value' in d) || !d.enumerable) fail('difficulty-list');
    const choice = d.value as unknown; record(choice, ['houseId', 'index']);
    if (typeof choice.houseId !== 'string' || !actorHouses.has(choice.houseId) || difficultyByHouse.has(choice.houseId) ||
        !Number.isInteger(choice.index) || Object.is(choice.index, -0) || (choice.index as number) < 0 || (choice.index as number) > 2) fail('difficulty-choice');
    difficultyByHouse.set(choice.houseId, choice.index as 0 | 1 | 2);
  }
  let work = 0, fields = 0, history = 0;
  const charge = (amount = 1): void => { if (amount > cap.work - work) fail('work-limit'); work += amount; };
  const remember = (amount: number): void => { if (amount > cap.history - history) fail('history-limit'); history += amount; };
  function section(layerId: string, name: string): IniSourceSection | undefined {
    charge(); const sections = findIniSourceSections(view, layerId, name); if (sections.length > 1) fail('duplicate-section'); return sections[0];
  }
  function read(old: EntityField<number>, section: IniSourceSection, key: string, floatStore: boolean, reset: boolean): EntityField<number> {
    charge(); if (++fields > cap.fields) fail('field-limit');
    const entries = findIniSourceEntries(section, key); if (entries.length > 1) fail('duplicate-key'); const e = entries[0];
    const current = reset ? initial(1, 'native-existing-difficulty-section-default-one') : old;
    // Every difficulty section visit resets missing/empty values to one; country reads retain state.
    const lineage = [...old.history, ...(e ? [e.origin] : [])]; remember(lineage.length);
    if (!e?.value) return { ...current, history: lineage };
    let value = weaponDecimal(e.value); if (value !== null && floatStore) value = weaponFloatStore(value);
    return { value, status: value === null ? 'unsupported' : 'explicit',
      rule: value === null ? 'unsupported-native-parser-input' : floatStore ? 'native-current-double-read-float-store' : reset ? 'native-difficulty-double-read' : 'native-current-double-read',
      origin: e.origin, history: lineage };
  }
  const difficulties: DifficultyCombatModifiers[] = names.map((name, index) => {
    const fields = { firepower: initial(null, 'difficulty-before-any-section-unverified'), armor: initial(null, 'difficulty-before-any-section-unverified'), rof: initial(null, 'difficulty-before-any-section-unverified') };
    const loadStages: Load[] = [];
    for (const stage of view.stages) {
      const s = section(stage.layer.id, name); if (!s) continue;
      loadStages.push({ layerId: stage.layer.id, section: name, line: s.line });
      for (const key of Object.keys(difficultyKeys) as (keyof typeof difficultyKeys)[]) fields[key] = read(fields[key], s, difficultyKeys[key], false, true);
    }
    return { index: index as 0 | 1 | 2, section: name, fields, loadStages };
  });
  const countries: CountryCombatModifiers[] = construction.countries.map(country => {
    const fields = { firepower: initial(1, 'native-country-constructor'), armor: initial(1, 'native-country-constructor'), rof: initial(1, 'native-country-constructor'),
      armorInfantry: initial(1, 'native-country-float-constructor'), armorUnits: initial(1, 'native-country-float-constructor') };
    const loadStages: Load[] = [];
    for (const stage of country.definitionStages) {
      const s = section(stage.layerId, country.name); if (!s) fail('country-stage');
      loadStages.push({ layerId: stage.layerId, section: country.name, line: s.line });
      for (const key of Object.keys(countryKeys) as (keyof typeof countryKeys)[]) fields[key] = read(fields[key], s, countryKeys[key], key === 'armorInfantry' || key === 'armorUnits', false);
    }
    return { id: country.id, name: country.name, index: country.index, allocation: country.allocation, parentCountry: country.parentCountry, fields, loadStages };
  });
  const countryById = new Map(countries.map(c => [c.id, c]));
  const houses: CampaignHouseModifiers[] = construction.houses.map(house => {
    charge(); const difficultyIndex = difficultyByHouse.get(house.id)!, difficulty = difficulties[difficultyIndex]!, country = house.country.id === null ? undefined : countryById.get(house.country.id);
    const unavailable = initial(null, 'unresolved-country');
    const fields = { firepower: difficulty.fields.firepower, storedArmor: difficulty.fields.armor, rof: difficulty.fields.rof,
      countryArmorInfantry: country?.fields.armorInfantry ?? unavailable, countryArmorUnits: country?.fields.armorUnits ?? unavailable };
    const unavailableFields = Object.entries(fields).filter(([, field]) => field.value === null).map(([key]) => key);
    return { houseId: house.id, houseIndex: house.index, countryId: house.country.id, difficultyIndex, fields, unavailableFields };
  });
  const common = { policy: COMBAT_MODIFIERS_POLICY, profile, source: { ...actors.source }, sources: actors.sources, actorFingerprint: actors.fingerprint,
    countries, difficulties, houses, nativeExecutionVerified: false as const, canExecuteCombat: false as const,
    requiredRuntimeWork: ['campaign-difficulty-selection', 'current-house-country-binding', 'actor-current-firepower-and-armor', 'veteran-and-elite-ability-selection',
      'numeric-domain-admission', 'firing-authorization-and-timing', 'derived-damage-and-death-effects'] };
  const result = freeze({ ...common, fingerprint: fingerprint(common, cap.serializedBytes) }); brand.add(result); return result;
}
