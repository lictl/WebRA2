// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original bounded identity construction; see ../CONSTRUCTION_PROVENANCE.md.
import type { ProfileId } from '../../contracts/src/index.ts';
import type { IniOrigin, RuntimeIni } from './runtime-ini.ts';
import type { PlacementKind, ScenarioObjects, ScenarioRow } from './scenario-objects.ts';

export const SCENARIO_CONSTRUCTION_POLICY = 'webra2-scenario-construction-1' as const;
export const SCENARIO_CONSTRUCTION_LIMITS = Object.freeze({ stages: 64, occurrences: 262144, registrations: 16384,
  definitions: 65536, fields: 262144, houses: 256, placements: 32768, diagnostics: 32768,
  work: 4_194_304, nodes: 2_000_000, characters: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof SCENARIO_CONSTRUCTION_LIMITS]: number };
const registries: Readonly<Record<PlacementKind, string>> = Object.freeze({ infantry: 'InfantryTypes', unit: 'VehicleTypes',
  aircraft: 'AircraftTypes', structure: 'BuildingTypes', terrain: 'TerrainTypes', smudge: 'SmudgeTypes' });
const kinds = Object.keys(registries) as PlacementKind[];
// Native Read_General visits these known BuildingType FindOrAllocate fields in this fixed order.
const generalBuildings = ['GDIGateOne', 'GDIGateTwo', 'NodGateOne', 'NodGateTwo'] as const;
const fold = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const semantic = (s: string): string => s.slice(0, s.indexOf(';') < 0 ? s.length : s.indexOf(';')).replace(/^[ \t]+|[ \t]+$/g, '');
/** Exact source key spelling; native key lookup is case-sensitive, unlike canonical entity IDs. */
export interface ConstructionField { readonly key: string; readonly value: string; readonly selected: IniOrigin; readonly shadowed: readonly IniOrigin[] }
export interface DefinitionStage { readonly layerId: string; readonly sectionLines: readonly number[]; readonly origins: readonly IniOrigin[] }
export interface ConstructionType {
  readonly id: string; readonly index: number; readonly kind: PlacementKind; readonly name: string;
  readonly allocation: 'registry' | 'general-reference' | 'terrain-placement'; readonly allocationOrigin: IniOrigin;
  readonly registrations: readonly IniOrigin[]; readonly definitionStages: readonly DefinitionStage[];
  /** Raw INI fields loaded at/after registration, not native parsed stats or defaults. */
  readonly fields: readonly ConstructionField[];
}
export interface ConstructionCountry {
  readonly id: string; readonly index: number; readonly name: string; readonly allocation: 'registry' | 'house-country';
  readonly allocationOrigin: IniOrigin; readonly registrations: readonly IniOrigin[];
  readonly definitionStages: readonly DefinitionStage[]; readonly fields: readonly ConstructionField[];
  readonly alias: Readonly<{ value: string; origin: IniOrigin | null }>;
  /** Declared ID reference only (not the native inheritance resolver); no properties are inherited. Null means constructor state, before any section load. */
  readonly parentCountry: Readonly<{ value: string | null; origin: IniOrigin | null; targetId: string | null; status: 'constructor' | 'self' | 'reference' | 'missing' | 'unsupported' }>;
}
export interface ConstructionHouse {
  readonly id: string; readonly index: number; readonly name: string; readonly declaration: ScenarioRow | null;
  readonly allocation: 'map-list' | 'country-fallback';
  readonly country: Readonly<{ id: string | null; index: number | null; raw: string | null; origin: IniOrigin | null;
    status: 'lookup' | 'implicit' | 'default-zero' | 'fallback' | 'unsupported' }>;
}
export interface ConstructionDiagnostic { readonly code: string; readonly severity: 'info' | 'unsupported'; readonly subjectId: string; readonly origin: IniOrigin | null }
export interface ScenarioConstruction {
  readonly policy: typeof SCENARIO_CONSTRUCTION_POLICY; readonly profile: ProfileId; readonly source: ScenarioObjects['source'];
  readonly orderedStages: RuntimeIni['layers']; readonly registries: readonly Readonly<{ kind: PlacementKind; entries: readonly ConstructionType[] }>[];
  readonly countries: readonly ConstructionCountry[]; readonly houses: readonly ConstructionHouse[];
  readonly placements: readonly Readonly<{ rowId: string; typeId: string | null; typeIndex: number | null; typeStatus: 'registered' | 'implicit' | 'missing' | 'wrong-family' | 'unsupported';
    owner: Readonly<{ raw: string | null; houseId: string | null; houseIndex: number | null; status: 'house' | 'none' | 'missing' | 'unsupported' }> }>[];
  readonly diagnostics: readonly ConstructionDiagnostic[]; readonly identityComplete: boolean;
  readonly indexScope: 'modeled-allocation-order';
  readonly nativeBehaviorVerified: false; readonly canStartCampaign: false;
}
export class ScenarioConstructionError extends Error { constructor(readonly code: string) { super(code); this.name = 'ScenarioConstructionError'; } }
function fail(code: string): never { throw new ScenarioConstructionError(code); }
// Frozen compiler inputs only; not a serialized wire loader. Whole-graph bounds precede semantic expansion.
function plain(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('construction-record');
}
function limits(options: Partial<Limits>): Limits {
  plain(options); const cap: Limits = { ...SCENARIO_CONSTRUCTION_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('construction-limit');
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || d.value < 0 || Object.is(d.value, -0) || d.value > cap[key as keyof Limits]) fail('construction-limit');
    cap[key as keyof Limits] = d.value;
  }
  return cap;
}
function immutable(inputs: readonly unknown[], cap: Limits): void {
  const seen = new Set<object>(), active = new Set<object>(); let nodes = 0, characters = 0;
  function walk(value: unknown, depth: number): void {
    if (++nodes > cap.nodes || depth > 32) fail('construction-structure-limit');
    if (typeof value === 'string') { characters += value.length; if (characters > cap.characters) fail('construction-character-limit'); return; }
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0))) return;
    if (!value || typeof value !== 'object') fail('construction-immutable-input');
    if (active.has(value)) fail('construction-input-cycle'); if (seen.has(value)) return;
    if (!Object.isFrozen(value)) fail('construction-immutable-input');
    const array = Array.isArray(value);
    if (array) { if (Object.getPrototypeOf(value) !== Array.prototype || value.length > cap.nodes - nodes) fail('construction-array'); } else plain(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length > cap.nodes - nodes || (array && keys.length !== value.length + 1)) fail('construction-structure-limit');
    active.add(value); seen.add(value);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) fail('construction-input-key');
      characters += key.length; if (characters > cap.characters) fail('construction-character-limit');
      const d = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in d) || !d.enumerable) fail('construction-input-property'); walk(d.value, depth + 1);
    }
    active.delete(value);
  }
  for (const input of inputs) walk(input, 0);
}
const integer = (n: number): boolean => Number.isSafeInteger(n) && n >= 0 && !Object.is(n, -0);
const identifier = (s: string, max: number): boolean => typeof s === 'string' && s.length > 0 && s.length <= max && /^[\x20-\x7e]+$/.test(s) && !/[,;\[\]=]/.test(s) && s === s.trim();
const special = (s: string): boolean => /^(?:<.*>|none)$/i.test(s);
type Section = { lines: number[]; occurrenceLines: Map<number, number>; origins: IniOrigin[] };
type Stage = { layer: RuntimeIni['layers'][number]; sections: Map<string, Section>; headerLines: Set<number>; lines: Map<number, IniOrigin> };
type MutableDefinition = { id: string; index: number; name: string; allocation: 'registry' | 'general-reference' | 'terrain-placement' | 'house-country'; allocationOrigin: IniOrigin;
  registrations: IniOrigin[]; definitionStages: DefinitionStage[]; fields: Map<string, ConstructionField>;
  alias: { value: string; origin: IniOrigin | null }; parent: { value: string | null; origin: IniOrigin | null } };

/** Bounded staged identity construction. Caller authenticates the compiler inputs and physical source bytes. */
export function assembleScenarioDefinitions(input: { readonly objects: ScenarioObjects; readonly rules: RuntimeIni }, options: Partial<Limits> = {}): ScenarioConstruction {
  const cap = limits(options); plain(input);
  if (Reflect.ownKeys(input).length !== 2 || !['objects', 'rules'].every(k => { const d = Object.getOwnPropertyDescriptor(input, k); return d && 'value' in d; })) fail('construction-input');
  const { objects, rules } = input; immutable([objects, rules], cap);
  if (objects.policy !== 'webra2-objects-1' || objects.schemaVersion !== 1 || !objects.placementsComplete || objects.iniPolicy !== 'webra2-ini-1' ||
      rules.policy !== 'webra2-ini-1' || rules.schemaVersion !== 1 || !['ra2', 'yr'].includes(objects.profile) || rules.profile !== objects.profile || objects.source.profile !== objects.profile) fail('construction-profile');
  if (!/^[a-f0-9]{64}$/.test(objects.source.sha256)) fail('construction-source');
  if (rules.layers.length > cap.stages || objects.placements.length > cap.placements || objects.houses.length > cap.houses) fail('construction-count-limit');
  const stages: Stage[] = [], byLayer = new Map<string, Stage>(); let previousOrder = -1;
  for (const layer of rules.layers) {
    if (!identifier(layer.id, 256) || byLayer.has(layer.id) || !integer(layer.order) || layer.order <= previousOrder || layer.profile !== objects.profile ||
        !['base', 'expansion', 'mod', 'map'].includes(layer.kind) || !/^[a-f0-9]{64}$/.test(layer.sourceSha256)) fail('construction-stage');
    previousOrder = layer.order;
    const stage: Stage = { layer, sections: new Map(), headerLines: new Set(), lines: new Map() }; stages.push(stage); byLayer.set(layer.id, stage);
  }
  const maps = stages.filter(s => s.layer.kind === 'map'), map = maps[0];
  if (maps.length !== 1 || !map || map !== stages.at(-1) || map.layer.sourceSha256 !== objects.source.sha256) fail('construction-map-identity');
  let occurrences = 0, work = 0, registrationCount = 0, definitions = 0, fieldCount = 0;
  function budget(n = 1): void { if (n > cap.work - work) fail('construction-work-limit'); work += n; }
  const diagnostics: ConstructionDiagnostic[] = [];
  function diagnostic(code: string, subjectId: string, origin: IniOrigin | null, severity: 'info' | 'unsupported' = 'unsupported'): void {
    if (diagnostics.length >= cap.diagnostics) fail('construction-diagnostic-limit'); diagnostics.push(Object.freeze({ code, severity, subjectId, origin }));
  }
  const sectionNames = new Set<string>();
  for (const section of rules.sections) {
    if (typeof section.name !== 'string' || fold(section.name) !== section.name || sectionNames.has(section.name)) fail('construction-section'); sectionNames.add(section.name);
    for (const occurrence of section.occurrences) {
      if (++occurrences > cap.occurrences) fail('construction-occurrence-limit');
      const stage = byLayer.get(occurrence.layerId);
      if (!stage || !integer(occurrence.line) || !occurrence.line || fold(occurrence.spelling) !== section.name) fail('construction-section-origin');
      if (!integer(occurrence.occurrence)) fail('construction-section-origin');
      let value = stage.sections.get(occurrence.spelling);
      if (!value) { value = { lines: [], occurrenceLines: new Map(), origins: [] }; stage.sections.set(occurrence.spelling, value); }
      if (stage.headerLines.has(occurrence.line) || value.occurrenceLines.has(occurrence.occurrence)) fail('construction-section-origin');
      value.lines.push(occurrence.line); value.occurrenceLines.set(occurrence.occurrence, occurrence.line); stage.headerLines.add(occurrence.line);
    }
  }
  const entryKeys = new Set<string>();
  for (const entry of rules.entries) {
    if (typeof entry.section !== 'string' || typeof entry.key !== 'string' || fold(entry.section) !== entry.section || fold(entry.key) !== entry.key) fail('construction-entry');
    const id = `${entry.section}\0${entry.key}`; if (entryKeys.has(id)) fail('construction-duplicate-entry'); entryKeys.add(id);
    if (semantic(entry.selected.rawValue) !== entry.value) fail('construction-entry-value');
    if (entry.shadowed.length + 1 > cap.occurrences - occurrences) fail('construction-occurrence-limit');
    for (const origin of [...entry.shadowed, entry.selected]) {
      if (++occurrences > cap.occurrences) fail('construction-occurrence-limit');
      const stage = byLayer.get(origin.layerId), section = stage?.sections.get(origin.sectionSpelling);
      if (!stage || !section || origin.sourceSha256 !== stage.layer.sourceSha256 || !integer(origin.line) || !origin.line ||
          fold(origin.sectionSpelling) !== entry.section || fold(origin.keySpelling) !== entry.key || stage.lines.has(origin.line) || stage.headerLines.has(origin.line) ||
          !integer(origin.sectionOccurrence) || !integer(origin.keyOccurrence) ||
          !section.occurrenceLines.has(origin.sectionOccurrence) || origin.line <= section.occurrenceLines.get(origin.sectionOccurrence)!) fail('construction-entry-origin');
      section.origins.push(origin); stage.lines.set(origin.line, origin);
    }
  }
  for (const stage of stages) for (const section of stage.sections.values()) section.origins.sort((a, b) => a.line - b.line);
  function unique(section: Section | undefined): void {
    if (!section) return;
    if (section.lines.length !== 1) fail('construction-repeated-section');
    const keys = new Set<string>();
    for (const origin of section.origins) { budget(); const key = origin.keySpelling; if (keys.has(key)) fail('construction-repeated-key'); keys.add(key); }
  }
  function originMatches(row: ScenarioRow): void {
    const original = map!.lines.get(row.origin.line);
    if (!original || row.origin.sourceSha256 !== objects.source.sha256 || row.origin.rawValue !== original.rawValue ||
        fold(row.origin.sectionSpelling) !== fold(original.sectionSpelling) || fold(row.origin.keySpelling) !== fold(original.keySpelling)) fail('construction-object-origin');
  }
  const catalogs = new Map<PlacementKind, MutableDefinition[]>(), typeMaps = new Map<PlacementKind, Map<string, MutableDefinition>>();
  for (const kind of kinds) { catalogs.set(kind, []); typeMaps.set(kind, new Map()); }
  const countries: MutableDefinition[] = [], countryIds = new Map<string, MutableDefinition>();
  function allocate(name: string, allocation: MutableDefinition['allocation'], origin: IniOrigin, array: MutableDefinition[], ids: Map<string, MutableDefinition>, prefix: string): MutableDefinition {
    if (++registrationCount > cap.registrations) fail('construction-registration-limit');
    const existing = ids.get(fold(name)); if (existing) return existing;
    const value: MutableDefinition = { id: `${prefix}:${fold(name)}`, index: array.length, name, allocation, allocationOrigin: origin,
      registrations: [], definitionStages: [], fields: new Map(), alias: { value: name, origin: null }, parent: { value: null, origin: null } };
    array.push(value); ids.set(fold(name), value); return value;
  }
  function register(stage: Stage, registry: string, array: MutableDefinition[], ids: Map<string, MutableDefinition>, prefix: string): void {
    const section = stage.sections.get(registry); unique(section);
    for (const origin of section?.origins ?? []) {
      budget(); const name = semantic(origin.rawValue);
      if (!name || /^(?:none|<none>)$/i.test(name)) { diagnostic('ignored-empty-registration', registry, origin, 'info'); continue; }
      if (!identifier(name, 24) || special(name)) { diagnostic('unsupported-registration-name', registry, origin); continue; }
      allocate(name, 'registry', origin, array, ids, prefix).registrations.push(origin);
    }
  }
  function load(stage: Stage, value: MutableDefinition, country: boolean): void {
    budget(); const section = stage.sections.get(value.name); if (!section) return; unique(section);
    if (++definitions > cap.definitions || section.origins.length > cap.fields - fieldCount) fail('construction-definition-limit'); fieldCount += section.origins.length;
    value.definitionStages.push(Object.freeze({ layerId: stage.layer.id, sectionLines: Object.freeze([...section.lines]), origins: Object.freeze([...section.origins]) }));
    let parent: IniOrigin | undefined;
    for (const origin of section.origins) {
      budget(); const key = origin.keySpelling, previous = value.fields.get(key), text = semantic(origin.rawValue);
      value.fields.set(key, Object.freeze({ key, value: text, selected: origin, shadowed: Object.freeze(previous ? [...previous.shadowed, previous.selected] : []) }));
      if (country && key === 'Name') {
        if (!identifier(text, 48)) diagnostic('unsupported-country-alias', value.id, origin);
        else value.alias = { value: text, origin };
      }
      if (country && key === 'ParentCountry') parent = origin;
    }
    if (country) value.parent = { value: parent ? semantic(parent.rawValue) : value.name, origin: parent ?? null };
  }
  for (const stage of stages) {
    register(stage, 'Countries', countries, countryIds, 'country');
    for (const kind of kinds) register(stage, registries[kind], catalogs.get(kind)!, typeMaps.get(kind)!, `type:${kind}`);
    const general = stage.sections.get('General');
    for (const key of generalBuildings) {
      budget(general?.origins.length ?? 0);
      let origin: IniOrigin | undefined;
      for (const candidate of general?.origins ?? []) if (candidate.keySpelling === key) {
        if (origin || general!.lines.length !== 1) fail('construction-repeated-general-reference'); origin = candidate;
      }
      if (!origin) continue;
      const name = semantic(origin.rawValue); if (!name || /^(?:none|<none>)$/i.test(name)) continue;
      if (!identifier(name, 24) || special(name)) { diagnostic('unsupported-general-reference', `general:${key}`, origin); continue; }
      allocate(name, 'general-reference', origin, catalogs.get('structure')!, typeMaps.get('structure')!, 'type:structure');
    }
    for (const country of countries) load(stage, country, true);
    for (const kind of kinds) for (const value of catalogs.get(kind)!) load(stage, value, false);
  }
  // Native country lookup scans each type's Name then ID, returning the first array entry matching either.
  const countryAliases = new Map<string, MutableDefinition>();
  for (const country of countries) for (const alias of [country.alias.value, country.name]) if (!countryAliases.has(fold(alias))) countryAliases.set(fold(alias), country);
  const houses: ConstructionHouse[] = [], houseNames = new Set<string>();
  const declarations = [...objects.houses].sort((a, b) => a.row.origin.line - b.row.origin.line);
  unique(map.sections.get('Houses'));
  if ((map.sections.get('Houses')?.origins.length ?? 0) !== declarations.length) fail('construction-house-declarations');
  for (const house of declarations) {
    budget(); originMatches(house.row);
    if (house.row.section !== 'houses' || house.name !== semantic(house.row.origin.rawValue) || houseNames.has(house.name)) fail('construction-house-identity'); houseNames.add(house.name);
    const index = houses.length, id = house.row.id, definition = map.sections.get(house.name); unique(definition);
    const origin = definition?.origins.find(o => o.keySpelling === 'Country') ?? null, raw = origin ? semantic(origin.rawValue) : null;
    let country: MutableDefinition | undefined, status: ConstructionHouse['country']['status'] = 'unsupported';
    if (!identifier(house.name, 19)) diagnostic('unsupported-house-name', id, house.row.origin);
    else if (!raw) { country = countries[0]; status = country ? 'default-zero' : 'unsupported'; }
    else if (!identifier(raw, 48) || special(raw)) diagnostic('unsupported-country-selector', id, origin);
    else {
      country = countryAliases.get(fold(raw)); status = country ? 'lookup' : 'implicit';
      if (!country && raw.length > 24) { status = 'unsupported'; diagnostic('unsupported-country-selector', id, origin); }
      else if (!country) { country = allocate(raw, 'house-country', origin!, countries, countryIds, 'country'); countryAliases.set(fold(raw), country); }
    }
    if (!country) diagnostic('unresolved-house-country', id, origin ?? house.row.origin);
    houses.push(Object.freeze({ id, index, name: house.name, declaration: house.row, allocation: 'map-list',
      country: Object.freeze({ id: country?.id ?? null, index: country?.index ?? null, raw, origin, status }) }));
  }
  if (!declarations.length) {
    if (countries.length > cap.houses) fail('construction-house-limit');
    for (const country of countries) {
      if (!identifier(country.name, 19)) diagnostic('unsupported-fallback-house-name', country.id, country.allocationOrigin);
      houses.push(Object.freeze({ id: `house:fallback:${country.index}`, index: houses.length, name: country.name, declaration: null, allocation: 'country-fallback',
        country: Object.freeze({ id: country.id, index: country.index, raw: null, origin: null, status: 'fallback' }) }));
    }
  }
  const houseByName = new Map<string, ConstructionHouse>();
  for (const house of houses) if (!houseByName.has(house.name)) houseByName.set(house.name, house);
  const seenRows = new Set<string>();
  const placementRows = [...objects.placements].sort((a, b) => a.row.origin.line - b.row.origin.line);
  const placements: ScenarioConstruction['placements'][number][] = [];
  for (const placement of placementRows) {
    budget(); originMatches(placement.row);
    if (!kinds.includes(placement.kind) || seenRows.has(placement.row.id)) fail('construction-placement'); seenRows.add(placement.row.id);
    const ownerless = placement.kind === 'terrain' || placement.kind === 'smudge';
    if (placement.type !== placement.row.values[ownerless ? 0 : 1] || placement.owner !== (ownerless ? null : placement.row.values[0])) fail('construction-placement-fields');
    const validType = identifier(placement.type, 24) && !special(placement.type), ids = typeMaps.get(placement.kind)!;
    let type = validType ? ids.get(fold(placement.type)) : undefined;
    if (!type && validType && placement.kind === 'terrain') type = allocate(placement.type, 'terrain-placement', placement.row.origin, catalogs.get('terrain')!, ids, 'type:terrain');
    const typeStatus = !validType ? 'unsupported' : type ? type.allocation !== 'registry' ? 'implicit' : 'registered' :
      kinds.some(kind => typeMaps.get(kind)!.has(fold(placement.type))) ? 'wrong-family' : 'missing';
    if (!type) diagnostic(`placement-type-${typeStatus}`, placement.row.id, placement.row.origin);
    const house = placement.owner === null ? undefined : houseByName.get(placement.owner);
    const status = ownerless ? 'none' : !placement.owner || !identifier(placement.owner, 19) ? 'unsupported' : !house ? 'missing' : house.country.id === null ? 'unsupported' : 'house';
    if (!['none', 'house'].includes(status)) diagnostic(`placement-owner-${status}`, placement.row.id, placement.row.origin);
    placements.push(Object.freeze({ rowId: placement.row.id, typeId: type?.id ?? null, typeIndex: type?.index ?? null, typeStatus,
      owner: Object.freeze({ raw: placement.owner, houseId: house?.id ?? null, houseIndex: house?.index ?? null, status }) }));
  }
  function definition(value: MutableDefinition) { return { id: value.id, index: value.index, name: value.name, allocationOrigin: value.allocationOrigin,
    registrations: Object.freeze(value.registrations), definitionStages: Object.freeze(value.definitionStages), fields: Object.freeze([...value.fields.values()].sort((a, b) => compare(a.key, b.key))) }; }
  const countryOutput: ConstructionCountry[] = countries.map(value => {
    const raw = value.parent.value, supported = raw !== null && identifier(raw, 24) && !special(raw), target = supported ? countryIds.get(fold(raw)) : undefined;
    const status = raw === null ? 'constructor' : !supported ? 'unsupported' : !target ? 'missing' : target === value ? 'self' : 'reference';
    if (status === 'missing' || status === 'unsupported') diagnostic(`parent-country-${status}`, value.id, value.parent.origin);
    return Object.freeze({ ...definition(value), allocation: value.allocation as ConstructionCountry['allocation'], alias: Object.freeze(value.alias),
      parentCountry: Object.freeze({ value: raw, origin: value.parent.origin, targetId: target?.id ?? null, status }) });
  });
  return Object.freeze({ policy: SCENARIO_CONSTRUCTION_POLICY, profile: objects.profile, source: objects.source, orderedStages: rules.layers,
    registries: Object.freeze(kinds.map(kind => Object.freeze({ kind, entries: Object.freeze(catalogs.get(kind)!.map(value => Object.freeze({ ...definition(value), kind, allocation: value.allocation as ConstructionType['allocation'] }))) }))),
    countries: Object.freeze(countryOutput), houses: Object.freeze(houses), placements: Object.freeze(placements.sort((a, b) => compare(a.rowId, b.rowId))),
    diagnostics: Object.freeze(diagnostics), identityComplete: diagnostics.every(d => d.severity !== 'unsupported'), indexScope: 'modeled-allocation-order', nativeBehaviorVerified: false, canStartCampaign: false });
}
