// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Structural joins; no native type defaults or house allocation.
import type { ProfileId } from '../../contracts/src/index.ts';
import type { IniOrigin, RuntimeIni, RuntimeIniEntry } from './runtime-ini.ts';
import type { PlacementKind, ScenarioObjects, ScenarioRow } from './scenario-objects.ts';

export const SCENARIO_BINDING_POLICY = 'webra2-scenario-bindings-1' as const;
export const SCENARIO_BINDING_LIMITS = Object.freeze({ placements: 32768, declarations: 16384, houses: 256,
  fields: 262144, nodes: 2_000_000, characters: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof SCENARIO_BINDING_LIMITS]: number };
const registries: Readonly<Record<PlacementKind, string>> = Object.freeze({ infantry: 'infantrytypes', unit: 'vehicletypes',
  aircraft: 'aircrafttypes', structure: 'buildingtypes', terrain: 'terraintypes', smudge: 'smudgetypes' });
const kinds = Object.keys(registries) as PlacementKind[];
export interface BoundType {
  readonly id: string; readonly kind: PlacementKind; readonly name: string; readonly registry: string;
  readonly status: 'resolved' | 'undeclared' | 'wrong-family' | 'missing-section';
  readonly declarations: readonly RuntimeIniEntry[]; readonly otherFamilies: readonly PlacementKind[];
  readonly sectionPresent: boolean; readonly fields: readonly RuntimeIniEntry[];
}
export interface BoundCountry {
  readonly id: string; readonly name: string; readonly declarations: readonly RuntimeIniEntry[];
  readonly status: 'resolved' | 'missing-section'; readonly sectionPresent: boolean; readonly fields: readonly RuntimeIniEntry[];
}
export interface BoundHouse {
  readonly id: string; readonly name: string; readonly declaration: ScenarioRow; readonly definitionPresent: boolean;
  readonly fields: readonly ScenarioRow[];
  readonly country: Readonly<{ raw: string | null; rowId: string | null; targetId: string | null;
    status: 'resolved' | 'missing' | 'absent' | 'missing-section' | 'effective-conflict' }>;
}
export interface BoundOwner {
  readonly raw: string | null; readonly houseId: string | null; readonly countryId: string | null;
  readonly status: 'house' | 'country-only' | 'ambiguous' | 'missing' | 'none' | 'missing-house-section';
}
export interface ScenarioBindings {
  readonly policy: typeof SCENARIO_BINDING_POLICY; readonly profile: ProfileId; readonly source: ScenarioObjects['source'];
  readonly nativeBehaviorVerified: false; readonly canStartCampaign: false;
  readonly types: readonly BoundType[]; readonly countries: readonly BoundCountry[]; readonly houses: readonly BoundHouse[];
  readonly placements: readonly Readonly<{ rowId: string; typeId: string; owner: BoundOwner }>[];
  /** Historical names are candidates only; native list construction is not inferred from effective key replacement. */
  readonly shadowedRegistrations: readonly Readonly<{ registry: string; name: string | null; origin: IniOrigin }>[];
  readonly unresolved: Readonly<{ types: number; owners: number; houseCountries: number }>;
}
export class ScenarioBindingError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'ScenarioBindingError'; }
}
function fail(code: string): never { throw new ScenarioBindingError(code); }
const fold = (value: string): string => value.replace(/[A-Z]/g, c => c.toLowerCase());
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
function plain(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('bindings-record');
}
function limits(options: Partial<Limits>): Limits {
  plain(options); const cap: Limits = { ...SCENARIO_BINDING_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('bindings-limit');
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || d.value < 0 || Object.is(d.value, -0) || d.value > cap[key as keyof Limits]) fail('bindings-limit');
    cap[key as keyof Limits] = d.value;
  }
  return cap;
}
/** Compiler outputs are immutable JSON graphs, not arbitrary serialized wire records. Validate before retaining references. */
function immutable(inputs: readonly unknown[], cap: Limits): void {
  const seen = new Set<object>(), active = new Set<object>(); let nodes = 0, characters = 0;
  function walk(value: unknown, depth: number): void {
    if (++nodes > cap.nodes || depth > 32) fail('bindings-structure-limit');
    if (typeof value === 'string') { characters += value.length; if (characters > cap.characters) fail('bindings-character-limit'); return; }
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0))) return;
    if (!value || typeof value !== 'object') fail('bindings-immutable-input');
    if (active.has(value)) fail('bindings-input-cycle'); if (seen.has(value)) return;
    if (!Object.isFrozen(value)) fail('bindings-immutable-input');
    const array = Array.isArray(value);
    if (array) { if (Object.getPrototypeOf(value) !== Array.prototype || value.length > cap.nodes - nodes) fail('bindings-array'); }
    else plain(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length > cap.nodes - nodes || (array && keys.length !== value.length + 1)) fail('bindings-structure-limit');
    active.add(value); seen.add(value);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) fail('bindings-input-key');
      characters += key.length; if (characters > cap.characters) fail('bindings-character-limit');
      const d = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in d) || !d.enumerable) fail('bindings-input-property'); walk(d.value, depth + 1);
    }
    active.delete(value);
  }
  for (const input of inputs) walk(input, 0);
}
function symbol(value: string): string {
  if (typeof value !== 'string' || !value || value.length > 255 || /[\x00-\x1f\x7f,;\[\]=]/.test(value)) fail('bindings-symbol');
  return fold(value);
}

/** Join compiler-produced placements and map-overridden rules; no asset selection or runtime entity allocation. */
export function bindScenarioObjects(input: { readonly objects: ScenarioObjects; readonly rules: RuntimeIni }, options: Partial<Limits> = {}): ScenarioBindings {
  const cap = limits(options); plain(input);
  if (Reflect.ownKeys(input).length !== 2 || !['objects', 'rules'].every(key => {
    const d = Object.getOwnPropertyDescriptor(input, key); return d && 'value' in d;
  })) fail('bindings-fields');
  const { objects, rules } = input; immutable([objects, rules], cap);
  if (objects.policy !== 'webra2-objects-1' || objects.schemaVersion !== 1 || !objects.placementsComplete ||
      rules.policy !== 'webra2-ini-1' || rules.schemaVersion !== 1 || (objects.profile !== 'ra2' && objects.profile !== 'yr') ||
      rules.profile !== objects.profile || objects.source.profile !== objects.profile) fail('bindings-profile');
  if (!/^[a-f0-9]{64}$/i.test(objects.source.sha256)) fail('bindings-source');
  const maps = rules.layers.filter(layer => layer.kind === 'map');
  if (maps.length !== 1 || maps[0]!.sourceSha256.toLowerCase() !== objects.source.sha256.toLowerCase()) fail('bindings-map-identity');
  if (objects.placements.length > cap.placements || objects.houses.length > cap.houses || rules.entries.length > cap.fields) fail('bindings-count-limit');
  const sections = new Set(rules.sections.map(section => section.name));
  const bySection = new Map<string, RuntimeIniEntry[]>();
  for (const entry of rules.entries) {
    let rows = bySection.get(entry.section); if (!rows) { rows = []; bySection.set(entry.section, rows); } rows.push(entry);
  }
  const fields = (name: string): readonly RuntimeIniEntry[] => Object.freeze([...(bySection.get(name) ?? [])]);
  const declared = new Map<string, Map<string, RuntimeIniEntry[]>>(); let declarationCount = 0;
  const shadowedRegistrations: { readonly registry: string; readonly name: string | null; readonly origin: IniOrigin }[] = [];
  for (const registry of [...Object.values(registries), 'countries']) {
    const names = new Map<string, RuntimeIniEntry[]>(); declared.set(registry, names);
    for (const entry of bySection.get(registry) ?? []) {
      if (++declarationCount > cap.declarations) fail('bindings-declaration-limit');
      for (const origin of entry.shadowed) {
        if (++declarationCount > cap.declarations) fail('bindings-declaration-limit');
        const value = origin.rawValue.split(';', 1)[0]!.replace(/^[ \t]+|[ \t]+$/g, '');
        const name = value && value.length <= 255 && !/[\x00-\x1f\x7f,;\[\]=]/.test(value) ? fold(value) : null;
        shadowedRegistrations.push(Object.freeze({ registry, name, origin }));
      }
      const name = symbol(entry.value); let rows = names.get(name); if (!rows) { rows = []; names.set(name, rows); } rows.push(entry);
    }
  }
  const countries: BoundCountry[] = [...declared.get('countries')!].map(([name, declarations]) => Object.freeze({ id: `country:${name}`, name,
    declarations: Object.freeze(declarations), status: sections.has(name) ? 'resolved' as const : 'missing-section' as const,
    sectionPresent: sections.has(name), fields: fields(name) })).sort((a, b) => compare(a.id, b.id));
  const countryByName = new Map(countries.map(country => [country.name, country]));
  const houses: BoundHouse[] = objects.houses.map(house => {
    const name = symbol(house.name), countryRow = house.fields.find(row => fold(row.key) === 'country'), raw = countryRow?.values[0] || null;
    const country = raw ? countryByName.get(fold(raw)) : undefined;
    const effective = bySection.get(name)?.find(entry => entry.key === 'country');
    const conflict = (effective?.value ? fold(effective.value) : null) !== (raw ? fold(raw) : null);
    return Object.freeze({ id: house.row.id, name, declaration: house.row, definitionPresent: house.definitionPresent, fields: house.fields,
      country: Object.freeze({ raw, rowId: countryRow?.id ?? null, targetId: country?.id ?? null,
        status: conflict ? 'effective-conflict' as const : raw === null ? 'absent' as const : !country ? 'missing' as const : country.status }) });
  }).sort((a, b) => compare(a.id, b.id));
  const houseByName = new Map(houses.map(house => [house.name, house]));
  if (houseByName.size !== houses.length) fail('bindings-duplicate-house');
  const types = new Map<string, BoundType>(); const rowIds = new Set<string>();
  const placements = objects.placements.map(placement => {
    if (!kinds.includes(placement.kind)) fail('bindings-kind');
    if (rowIds.has(placement.row.id)) fail('bindings-duplicate-placement'); rowIds.add(placement.row.id);
    const name = symbol(placement.type), registry = registries[placement.kind], typeId = `type:${placement.kind}:${name}`;
    if (!types.has(typeId)) {
      const declarations = declared.get(registry)!.get(name) ?? [], otherFamilies = kinds.filter(kind => kind !== placement.kind && declared.get(registries[kind])!.has(name));
      types.set(typeId, Object.freeze({ id: typeId, kind: placement.kind, name, registry,
        status: !declarations.length ? otherFamilies.length ? 'wrong-family' as const : 'undeclared' as const : sections.has(name) ? 'resolved' as const : 'missing-section' as const,
        declarations: Object.freeze(declarations), otherFamilies: Object.freeze(otherFamilies), sectionPresent: sections.has(name), fields: fields(name) }));
    }
    const raw = placement.owner, house = raw ? houseByName.get(fold(raw)) : undefined, country = raw ? countryByName.get(fold(raw)) : undefined;
    const owner: BoundOwner = Object.freeze({ raw, houseId: house?.id ?? null, countryId: country?.id ?? null,
      status: raw === null || raw === '' ? 'none' : house && country ? 'ambiguous' : house ? house.definitionPresent ? 'house' : 'missing-house-section' : country ? 'country-only' : 'missing' });
    return Object.freeze({ rowId: placement.row.id, typeId, owner });
  }).sort((a, b) => compare(a.rowId, b.rowId));
  const typeRows = Object.freeze([...types.values()].sort((a, b) => compare(a.id, b.id)));
  return Object.freeze({ policy: SCENARIO_BINDING_POLICY, profile: objects.profile, source: objects.source, nativeBehaviorVerified: false, canStartCampaign: false,
    types: typeRows, countries: Object.freeze(countries), houses: Object.freeze(houses), placements: Object.freeze(placements), shadowedRegistrations: Object.freeze(shadowedRegistrations),
    unresolved: Object.freeze({ types: typeRows.filter(type => type.status !== 'resolved').length,
      owners: placements.filter(row => !['house', 'none'].includes(row.owner.status)).length,
      houseCountries: houses.filter(house => house.country.status !== 'resolved').length }) });
}
