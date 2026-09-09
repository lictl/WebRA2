// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original bounded compiler; see ../ENTITY_DEFINITIONS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import type { IniOrigin, RuntimeIni } from './runtime-ini.ts';
import { createIniSourceView, findIniSourceEntries, type IniSourceEntry, type IniSourceSection } from './ini-source-view.ts';
import { assembleScenarioDefinitions } from './scenario-construction.ts';
import type { PlacementKind, ScenarioObjects } from './scenario-objects.ts';

export const ENTITY_DEFINITIONS_POLICY = 'webra2-entity-definitions-1' as const;
export const ENTITY_DEFINITIONS_LIMITS = Object.freeze({ stages: 64, occurrences: 262144, types: 16384,
  placements: 32768, fieldReads: 1_048_576, diagnostics: 32768, characters: 64 * 1024 * 1024,
  nodes: 2_000_000, history: 262144, serializedBytes: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof ENTITY_DEFINITIONS_LIMITS]: number };
type State = 'default' | 'explicit' | 'derived' | 'unsupported' | 'not-applicable';
export interface EntityField<T> {
  readonly value: T | null; readonly status: State; readonly rule: string;
  readonly origin: IniOrigin | null; readonly history: readonly IniOrigin[];
}
export interface EntityDiagnostic { readonly code: string; readonly subjectId: string; readonly field: string; readonly origin: IniOrigin | null }
export interface FoundationDefinition {
  readonly nativeIndex: number; readonly width: number; readonly height: number;
  readonly shape: 'rectangle' | 'refinery'; readonly occupancyVerified: false;
}
export interface LocomotorDefinition { readonly guid: string; readonly kind: string | null }
export interface EntityDefinition {
  readonly id: string; readonly name: string; readonly kind: PlacementKind;
  readonly strength: EntityField<number>; readonly armor: EntityField<number>;
  /** Native integer scale, not cells per tick or a completed locomotion implementation. */
  readonly speed: EntityField<number>; readonly speedType: EntityField<number>; readonly movementZone: EntityField<number>;
  readonly locomotor: EntityField<LocomotorDefinition>; readonly crusher: EntityField<boolean>;
  /** PhysicalSize and Size are distinct native scalars; neither is a cell occupancy mask. */
  readonly physicalSize: EntityField<number>; readonly transportSize: EntityField<number>;
  readonly primary: EntityField<string>; readonly secondary: EntityField<string>;
  readonly foundation: EntityField<FoundationDefinition>; readonly smudgeWidth: EntityField<number>; readonly smudgeHeight: EntityField<number>;
}
export interface EntityDefinitions {
  readonly schemaVersion: 1; readonly policy: typeof ENTITY_DEFINITIONS_POLICY;
  readonly profile: RuntimeIni['profile']; readonly source: ScenarioObjects['source'];
  readonly sources: Readonly<{ rules: RuntimeIni['layers']; art: RuntimeIni['layers'] }>;
  readonly definitions: readonly EntityDefinition[];
  readonly placements: readonly Readonly<{ rowId: string; typeId: string | null; ownerId: string | null;
    rawStrength: number | null; initialHealth: EntityField<number> }>[];
  readonly diagnostics: readonly EntityDiagnostic[];
  readonly coverage: Readonly<{ identityComplete: boolean; typedDefinitions: number; placedTypes: number;
    unsupportedFields: number; unsupportedPlacementHealth: number }>;
  readonly requiredRuntimeWork: readonly string[];
  readonly fingerprint: string; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
const compiledDefinitions = new WeakSet<object>();
/** True only for an immutable result produced by this module instance; not JSON/source authentication. */
export function isEntityDefinitions(value: unknown): value is EntityDefinitions {
  return typeof value === 'object' && value !== null && compiledDefinitions.has(value);
}
export class EntityDefinitionsError extends Error { constructor(readonly code: string) { super(`entity-definitions-${code}`); this.name = 'EntityDefinitionsError'; } }
const fail = (code: string): never => { throw new EntityDefinitionsError(code); };
const lower = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
const ARMOR = ['none', 'flak', 'plate', 'light', 'medium', 'heavy', 'wood', 'steel', 'concrete', 'special_1', 'special_2'];
const SPEED = ['foot', 'track', 'wheel', 'hover', 'winged', 'float', 'amphibious', 'floatbeach'];
const ZONE_RA2 = ['normal', 'crusher', 'destroyer', 'amphibiousdestroyer', 'amphibiouscrusher', 'amphibious',
  'subterrannean', 'infantry', 'infantrydestroyer', 'fly', 'water', 'waterbeach'];
const ZONE_YR = [...ZONE_RA2, 'crusherall'];
const FOUNDATIONS = ['1x1', '2x1', '1x2', '2x2', '2x3', '3x2', '3x3', '3x5', '4x2', '3x3refinery',
  '1x3', '3x1', '4x3', '1x4', '1x5', '2x6', '2x5', '5x3', '4x4', '3x4', '6x4', '0x0'];
const LOCOMOTORS = new Map([
  ['4a582741-9839-11d1-b709-00a024ddafd1', 'drive'], ['4a582742-9839-11d1-b709-00a024ddafd1', 'hover'],
  ['4a582743-9839-11d1-b709-00a024ddafd1', 'tunnel'], ['4a582744-9839-11d1-b709-00a024ddafd1', 'walk'],
  ['4a582745-9839-11d1-b709-00a024ddafd1', 'droppod'], ['4a582746-9839-11d1-b709-00a024ddafd1', 'fly'],
  ['4a582747-9839-11d1-b709-00a024ddafd1', 'teleport'], ['55d141b8-db94-11d1-ac98-006008055bb5', 'mech'],
  ['2bea74e1-7cca-11d3-be14-00104b62a16c', 'ship'], ['92612c46-f71f-11d1-ac9f-006008055bb5', 'jumpjet'],
  ['b7b49766-e576-11d3-9bd9-00104b972fe8', 'rocket'],
]);
function field<T>(value: T | null, status: State, rule: string, origin: IniOrigin | null = null, history: readonly IniOrigin[] = []): EntityField<T> {
  return { value, status, rule, origin, history };
}
function plain(v: unknown): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('record');
}
function settings(options: Partial<Limits>): Limits {
  plain(options); const cap: Limits = { ...ENTITY_DEFINITIONS_LIMITS };
  for (const k of Reflect.ownKeys(options)) {
    if (typeof k !== 'string' || !Object.hasOwn(cap, k)) fail('limit');
    const d = Object.getOwnPropertyDescriptor(options, k)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[k as keyof Limits]) fail('limit');
    cap[k as keyof Limits] = d.value;
  }
  return cap;
}
function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const child of Object.values(v)) freeze(child); Object.freeze(v); }
  return v;
}
/** Sorted keys, ordered arrays, JSON scalar spelling; bytes are fed incrementally, never one huge JSON allocation. */
function fingerprintFor(value: unknown, maxBytes: number): string {
  const hash = sha256.create(), encoder = new TextEncoder(); let remaining = maxBytes;
  function emit(s: string): void { if (s.length > remaining) fail('serialization-limit'); const bytes = encoder.encode(s); if (bytes.length > remaining) fail('serialization-limit'); remaining -= bytes.length; hash.update(bytes); }
  function scalar(s: string): void {
    // Six bytes per UTF-16 code unit bounds JSON escaping and UTF-8 before materializing a token.
    if (s.length > Math.floor((remaining - 2) / 6)) fail('serialization-limit'); emit(JSON.stringify(s));
  }
  function visit(v: unknown): void {
    if (typeof v === 'string') scalar(v);
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') emit(JSON.stringify(v));
    else if (Array.isArray(v)) { emit('['); v.forEach((x, i) => { if (i) emit(','); visit(x); }); emit(']'); }
    else { const record = v as Record<string, unknown>; emit('{'); Object.keys(record).sort().forEach((k, i) => { if (i) emit(','); scalar(k); emit(':'); visit(record[k]); }); emit('}'); }
  }
  visit(value); return Array.from(hash.digest(), b => b.toString(16).padStart(2, '0')).join('');
}
/** Narrow unambiguous atoi/hex inputs. Overflow, mixed suffixes and empty values stay unsupported. */
function integer(s: string): number | null {
  let n: number;
  if (/^\$[0-9a-f]+$/i.test(s)) n = Number.parseInt(s.slice(1), 16);
  else if (/^[0-9a-f]+h$/i.test(s)) n = Number.parseInt(s.slice(0, -1), 16);
  else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) {
    const prefix = /^[+-]?\d+/.exec(s); n = prefix ? Number(prefix[0]) : 0;
    return Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647 ? n || 0 : null;
  } else return null;
  return Number.isSafeInteger(n) && n <= 0xffffffff ? (n > 0x7fffffff ? n - 0x100000000 : n) : null;
}
function decimal(s: string): number | null {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(s)) return null;
  const percent = s.endsWith('%'), parsed = Number(percent ? s.slice(0, -1) : s), f = Math.fround(parsed);
  if (!Number.isFinite(f)) return null;
  // The pinned CRT software rounding differs at exact halves. Also exclude decimal inputs
  // rounded by Number onto a half: this policy must not silently substitute ties-to-even.
  const a = Math.abs(parsed), rounded = Math.abs(f);
  if (a !== rounded) {
    const buffer = new DataView(new ArrayBuffer(4)); buffer.setFloat32(0, rounded);
    buffer.setUint32(0, buffer.getUint32(0) + (a > rounded ? 1 : -1));
    if (a === (rounded + buffer.getFloat32(0)) / 2) return null;
  }
  const value = percent ? f * 0.01 : f;
  return Number.isFinite(value) ? value || 0 : null;
}
const bool = (s: string): boolean | null => /^(?:yes|true|1)$/i.test(s) ? true : /^(?:no|false|0)$/i.test(s) ? false : null;
const enumeration = (s: string, names: string[]): number | null => { const i = names.indexOf(lower(s)); return i < 0 ? null : i; };
function foundation(index: number): FoundationDefinition {
  const name = FOUNDATIONS[index]!, width = Number(name[0]), height = Number(name[2]);
  return { nativeIndex: index, width, height, shape: name.endsWith('refinery') ? 'refinery' : 'rectangle', occupancyVerified: false };
}

/** Same-realm compiled inputs, not an untrusted JSON loader. Caller authenticates source bytes. */
export function compileEntityDefinitions(input: { readonly objects: ScenarioObjects; readonly rules: RuntimeIni; readonly art: RuntimeIni }, options: Partial<Limits> = {}): EntityDefinitions {
  const cap = settings(options); plain(input);
  if (Reflect.ownKeys(input).length !== 3 || !['objects', 'rules', 'art'].every(k => { const d = Object.getOwnPropertyDescriptor(input, k); return d && 'value' in d; })) fail('input');
  const { objects, rules, art } = input;
  function profile(v: unknown): unknown { if (!v || typeof v !== 'object') fail('profile'); const d = Object.getOwnPropertyDescriptor(v, 'profile'); if (!d || !('value' in d)) fail('profile'); return d!.value; }
  if (!['ra2', 'yr'].includes(profile(rules) as string) || profile(rules) !== profile(art) || profile(rules) !== profile(objects)) fail('profile');
  // The existing compilers validate frozen inputs/provenance before imported values are consumed.
  const viewLimits = { stages: cap.stages, occurrences: cap.occurrences, nodes: cap.nodes, characters: cap.characters };
  const rv = createIniSourceView(rules, viewLimits), av = createIniSourceView(art, viewLimits);
  if (rv.profile !== av.profile) fail('profile');
  if (rv.stages.length + av.stages.length > cap.stages) fail('stage-limit');
  let occurrences = 0, text = 0;
  for (const v of [rv, av]) for (const s of v.stages) for (const section of s.sections) {
    occurrences += 1 + section.entries.length; text += section.name.length;
    for (const e of section.entries) text += e.key.length + e.origin.rawValue.length;
    if (occurrences > cap.occurrences || text > cap.characters) fail('source-limit');
  }
  const construction = assembleScenarioDefinitions({ objects, rules }, { stages: cap.stages, occurrences: cap.occurrences,
    placements: cap.placements, nodes: cap.nodes, characters: cap.characters });
  // Provenance-bearing plain records are not a factory brand: verify the consumed placement projections.
  for (const p of objects.placements) {
    const row = p.row, end = row.origin.rawValue.indexOf(';'), raw = end < 0 ? row.origin.rawValue : row.origin.rawValue.slice(0, end);
    if (row.tokens.length > 64 || row.tokens.length !== row.values.length) fail('placement-projection');
    let offset = 0, i = 0;
    while (true) {
      const comma = raw.indexOf(',', offset), token = raw.slice(offset, comma < 0 ? raw.length : comma);
      if (i >= row.tokens.length || row.tokens[i] !== token || row.values[i] !== token.trim()) fail('placement-projection');
      i++; if (comma < 0) break; offset = comma + 1;
    }
    if (i !== row.tokens.length) fail('placement-projection');
    const passive = p.kind === 'terrain' || p.kind === 'smudge';
    if (passive ? p.strengthRaw !== null : !/^[0-9]+$/.test(row.values[2] ?? '') || !Number.isSafeInteger(p.strengthRaw) ||
      p.strengthRaw! < 0 || p.strengthRaw! > 256 || Object.is(p.strengthRaw, -0) || p.strengthRaw !== Number(row.values[2])) fail('placement-strength');
  }
  if (construction.registries.reduce((n, r) => n + r.entries.length, 0) > cap.types) fail('type-limit');
  const types = construction.registries.flatMap(r => r.entries);
  let reads = 0, history = 0;
  const diagnostics: EntityDiagnostic[] = [];
  function diagnostic(code: string, subjectId: string, name: string, origin: IniOrigin | null): void {
    if (diagnostics.length >= cap.diagnostics) fail('diagnostic-limit'); diagnostics.push({ code, subjectId, field: name, origin });
  }
  for (const d of construction.diagnostics) if (d.severity === 'unsupported') diagnostic(d.code, d.subjectId, 'identity', d.origin);
  function extend(origins: readonly IniOrigin[], additions: readonly IniOrigin[]): readonly IniOrigin[] {
    const size = origins.length + additions.length;
    if (size > cap.history - history) fail('history-limit'); history += size;
    return [...origins, ...additions];
  }
  function read(section: IniSourceSection | undefined, key: string): IniSourceEntry | undefined {
    if (++reads > cap.fieldReads) fail('field-read-limit');
    if (!section) return undefined;
    const found = findIniSourceEntries(section, key); if (found.length > 1) fail('repeated-consumed-key');
    return found[0];
  }
  const ruleSections = new Map<string, Map<string, IniSourceSection>>();
  for (const stage of rv.stages) {
    const sections = new Map<string, IniSourceSection>();
    for (const s of stage.sections) { if (sections.has(s.name)) continue; sections.set(s.name, s); }
    ruleSections.set(stage.layer.id, sections);
  }
  // Explicit art layers are composed by exact section/key; within-layer repeats are never guessed.
  const artSections = new Map<string, { section: IniSourceSection; layerId: string }[]>();
  const readOrigins = new Map<IniSourceEntry, readonly IniOrigin[]>();
  for (const stage of av.stages) {
    for (const s of stage.sections) {
      let list = artSections.get(s.name); if (!list) { list = []; artSections.set(s.name, list); } list.push({ section: s, layerId: stage.layer.id });
    }
  }
  function artRead(section: string, key: string): IniSourceEntry | undefined {
    let found: IniSourceEntry | undefined;
    const stages = new Set<string>(), origins: IniOrigin[] = [];
    for (const { section: s, layerId } of artSections.get(section) ?? []) {
      if (stages.has(layerId)) fail('repeated-art-section'); stages.add(layerId);
      const e = read(s, key); if (e) { found = e; origins.push(e.origin); }
    }
    if (found) readOrigins.set(found, origins);
    return found;
  }
  function apply<T>(current: EntityField<T>, entry: IniSourceEntry | undefined, parse: (s: string) => T | null, id: string, key: string, rule: string,
    accept: (v: T) => boolean = () => true): EntityField<T> {
    if (!entry) return current;
    const origins = extend(current.history, readOrigins.get(entry) ?? [entry.origin]), value = parse(entry.value);
    if (value === null || !accept(value)) { diagnostic('unsupported-value', id, key, entry.origin); return field<T>(null, 'unsupported', rule, entry.origin, origins); }
    return field(value, 'explicit', rule, entry.origin, origins);
  }
  function weapon(current: EntityField<string>, entry: IniSourceEntry | undefined, id: string, key: string): EntityField<string> {
    if (!entry) return current;
    if (!entry.value) return { ...current, history: extend(current.history, [entry.origin]) };
    if (/^(?:none|<none>)$/i.test(entry.value)) return field<string>(null, 'explicit', 'weapon-none', entry.origin, extend(current.history, [entry.origin]));
    return apply(current, entry, s => s.length <= 24 && /^[\x21-\x7e]+$/.test(s) && !/[,;\[\]=<>]/.test(s) ? `weapon:${lower(s)}` : null, id, key, 'weapon-id-casefold');
  }
  const treeByStage = new Map<string, EntityField<number>>(); let tree = field(25, 'default', 'rules-tree-strength-default');
  for (const stage of rv.stages) {
    const candidates = stage.sections.filter(s => s.name === 'General');
    if (candidates.length > 1 && candidates.some(s => s.entries.some(e => e.key === 'TreeStrength'))) fail('repeated-general-section');
    tree = apply(tree, read(candidates[0], 'TreeStrength'), integer, 'global', 'TreeStrength', 'integer-current-default');
    treeByStage.set(stage.layer.id, tree);
  }
  const definitions: EntityDefinition[] = [];
  for (const type of types) {
    const techno = ['infantry', 'unit', 'aircraft', 'structure'].includes(type.kind);
    const na = <T>(): EntityField<T> => field<T>(null, 'not-applicable', 'type-family');
    let strength = field(type.kind === 'terrain' ? -1 : 0, 'default', 'type-strength-constructor');
    let armor = field(type.kind === 'terrain' ? 6 : 0, 'default', 'type-armor-constructor');
    let speed = techno ? field(0, 'default', 'techno-speed-constructor') : na<number>();
    let speedType = techno ? field(type.kind === 'unit' ? -1 : type.kind === 'aircraft' ? 4 : 0, 'default', 'speed-type-constructor') : na<number>();
    let movementZone = techno ? field(0, 'default', 'movement-zone-constructor') : na<number>();
    const initialGuid = '4a582747-9839-11d1-b709-00a024ddafd1';
    let locomotor = techno ? field<LocomotorDefinition>({ guid: initialGuid, kind: 'teleport' }, 'default', 'locomotor-constructor') : na<LocomotorDefinition>();
    let crusher = techno ? field(false, 'default', 'crusher-constructor') : na<boolean>();
    let physicalSize = techno ? field(2, 'default', 'physical-size-constructor') : na<number>();
    let transportSize = techno ? field(1, 'default', 'size-constructor') : na<number>();
    let primary = techno ? field<string>(null, 'default', 'weapon-constructor') : na<string>(), secondary = techno ? field<string>(null, 'default', 'weapon-constructor') : na<string>();
    let fp = ['structure', 'terrain'].includes(type.kind) ? field(foundation(0), 'default', 'foundation-constructor') : na<FoundationDefinition>();
    let smudgeWidth = type.kind === 'smudge' ? field(1, 'default', 'smudge-dimensions-constructor') : na<number>();
    let smudgeHeight = type.kind === 'smudge' ? field(1, 'default', 'smudge-dimensions-constructor') : na<number>();
    let image: string | null = type.name;
    let turretCount = field(0, 'default', 'turret-count-constructor');
    let weaponCount = field<number>(null, 'unsupported', 'weapon-count-default-unverified');
    let clearWeapons = field(false, 'default', 'clear-weapons-constructor');
    for (const stage of type.definitionStages) {
      const section = ruleSections.get(stage.layerId)!.get(type.name)!;
      strength = apply(strength, read(section, 'Strength'), integer, type.id, 'Strength', 'integer-current-default');
      armor = apply(armor, read(section, 'Armor'), s => enumeration(s, ARMOR), type.id, 'Armor', 'armor-current-default');
      const imageEntry = read(section, 'Image');
      if (imageEntry?.value) {
        if (imageEntry.value.length > 24 || !/^[\x21-\x7e]+$/.test(imageEntry.value)) { diagnostic('unsupported-image-name', type.id, 'Image', imageEntry.origin); image = null; }
        else image = imageEntry.value;
      }
      if (type.kind === 'terrain' && strength.value === -1) {
        const fallback = treeByStage.get(stage.layerId)!;
        strength = field(fallback.value, fallback.status === 'unsupported' ? 'unsupported' : 'derived', 'terrain-tree-strength', fallback.origin, extend(strength.history, fallback.history));
      }
      if (techno) {
        speedType = apply(speedType, read(section, 'SpeedType'), s => enumeration(s, SPEED), type.id, 'SpeedType', 'speed-type-current-default');
        movementZone = apply(movementZone, read(section, 'MovementZone'), s => enumeration(s, construction.profile === 'yr' ? ZONE_YR : ZONE_RA2), type.id, 'MovementZone', 'movement-zone-current-default');
        crusher = apply(crusher, read(section, 'Crusher'), bool, type.id, 'Crusher', 'bool-current-default');
        const se = read(section, 'Speed');
        if (se && integer(se.value) !== -1) speed = apply(speed, se, s => { const n = integer(s); return n === null ? null : Math.min(255, Math.trunc(Math.max(0, Math.min(100, n)) * 256 / 100)); }, type.id, 'Speed', 'speed-clamp-256-over-100');
        else if (se) speed = { ...speed, history: extend(speed.history, [se.origin]) };
        physicalSize = apply(physicalSize, read(section, 'PhysicalSize'), decimal, type.id, 'PhysicalSize', 'bounded-float32-webra2', v => v >= 0);
        transportSize = apply(transportSize, read(section, 'Size'), decimal, type.id, 'Size', 'bounded-float32-webra2', v => v >= 0);
        locomotor = apply(locomotor, read(section, 'Locomotor'), s => {
          const guid = lower(s.replace(/^\{(.*)\}$/, '$1'));
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(guid) ? { guid, kind: LOCOMOTORS.get(guid) ?? null } : null;
        }, type.id, 'Locomotor', 'guid-current-default');
        if (locomotor.value && !locomotor.value.kind) { diagnostic('unsupported-locomotor-class', type.id, 'Locomotor', locomotor.origin); locomotor = { ...locomotor, status: 'unsupported' }; }
        turretCount = apply(turretCount, read(section, 'TurretCount'), integer, type.id, 'TurretCount', 'integer-current-default');
        weaponCount = apply(weaponCount, read(section, 'WeaponCount'), integer, type.id, 'WeaponCount', 'integer-current-default');
        clearWeapons = apply(clearWeapons, read(section, 'ClearAllWeapons'), bool, type.id, 'ClearAllWeapons', 'bool-current-default');
        const controls = [...turretCount.history, ...weaponCount.history, ...clearWeapons.history];
        primary = { ...primary, history: extend(primary.history, controls) };
        secondary = { ...secondary, history: extend(secondary.history, controls) };
        const numbered = turretCount.value !== null && turretCount.value > 0;
        if (turretCount.value === null || clearWeapons.value === null || numbered &&
          (weaponCount.value === null || weaponCount.value < 0 || weaponCount.value > (construction.profile === 'yr' ? 18 : 15))) {
          diagnostic('unsupported-weapon-load-mode', type.id, 'Primary/Secondary', weaponCount.origin ?? turretCount.origin);
          primary = field<string>(null, 'unsupported', 'weapon-load-mode', weaponCount.origin ?? turretCount.origin, primary.history);
          secondary = field<string>(null, 'unsupported', 'weapon-load-mode', weaponCount.origin ?? turretCount.origin, secondary.history);
        } else {
          if (numbered) {
            if (weaponCount.value! >= 1) primary = weapon(primary, read(section, 'Weapon1'), type.id, 'Weapon1');
            if (weaponCount.value! >= 2) secondary = weapon(secondary, read(section, 'Weapon2'), type.id, 'Weapon2');
          } else if (!clearWeapons.value) {
            primary = weapon(primary, read(section, 'Primary'), type.id, 'Primary');
            secondary = weapon(secondary, read(section, 'Secondary'), type.id, 'Secondary');
          }
          if (clearWeapons.value) {
            primary = field<string>(null, 'derived', 'clear-all-weapons', clearWeapons.origin, primary.history);
            secondary = field<string>(null, 'derived', 'clear-all-weapons', clearWeapons.origin, secondary.history);
          }
        }
        if (type.kind === 'unit' && speedType.value === -1) speedType = field(crusher.value === null ? null : crusher.value ? 1 : 2,
          crusher.value === null ? 'unsupported' : 'derived', 'unit-crusher-speed-type-fallback', crusher.origin, crusher.history);
        if (type.kind === 'unit') speedType = apply(speedType, read(section, 'SpeedType'), s => enumeration(s, SPEED), type.id, 'SpeedType', 'unit-speed-type-reread');
      }
      if (type.kind === 'structure' || type.kind === 'terrain') {
        if (image === null) fp = field<FoundationDefinition>(null, 'unsupported', 'unknown-image-foundation', imageEntry?.origin ?? null, fp.history);
        else fp = apply(fp, artRead(image, 'Foundation'), s => { const i = enumeration(s, FOUNDATIONS); return i === null ? null : foundation(i); }, type.id, 'Foundation', 'image-art-foundation');
        if (type.kind === 'structure') {
          const idEntry = artRead(type.name, 'Foundation');
          if (idEntry && enumeration(idEntry.value, FOUNDATIONS) !== 0) fp = apply(fp, idEntry, s => { const i = enumeration(s, FOUNDATIONS); return i === null ? null : foundation(i); }, type.id, 'Foundation', 'id-art-nonzero-foundation');
          else if (idEntry) fp = { ...fp, history: extend(fp.history, readOrigins.get(idEntry) ?? [idEntry.origin]) };
        }
      }
      if (type.kind === 'smudge') {
        smudgeWidth = apply(smudgeWidth, read(section, 'Width'), integer, type.id, 'Width', 'integer-current-default', n => n >= 0 && n <= 64);
        smudgeHeight = apply(smudgeHeight, read(section, 'Height'), integer, type.id, 'Height', 'integer-current-default', n => n >= 0 && n <= 64);
      }
    }
    definitions.push({ id: type.id, name: type.name, kind: type.kind, strength, armor, speed, speedType, movementZone, locomotor,
      crusher, physicalSize, transportSize, primary, secondary, foundation: fp, smudgeWidth, smudgeHeight });
  }
  const byType = new Map(definitions.map(d => [d.id, d])), rows = new Map(objects.placements.map(p => [p.row.id, p]));
  const placed = new Set<string>();
  const placements = construction.placements.map(p => {
    const row = rows.get(p.rowId)!, d = p.typeId ? byType.get(p.typeId) : undefined;
    if (p.typeId) placed.add(p.typeId);
    const rawStrength = row.strengthRaw;
    let health = field<number>(null, 'not-applicable', 'passive-placement');
    if (rawStrength !== null) {
      const max = d?.strength.value;
      if (max === undefined || max === null || max < 0) { diagnostic('unsupported-placement-health', p.rowId, 'Strength', row.row.origin); health = field<number>(null, 'unsupported', 'placement-health', row.row.origin); }
      else {
        let value = Math.trunc(rawStrength * max / 256); if (value > max - 3) value = max;
        if (row.kind !== 'structure') value = Math.max(1, value);
        health = field(value, 'derived', 'placement-scale-snap-family-minimum', row.row.origin, d!.strength.history);
      }
    }
    return { rowId: p.rowId, typeId: p.typeId, ownerId: p.owner.houseId, rawStrength, initialHealth: health };
  });
  const body = { schemaVersion: 1 as const, policy: ENTITY_DEFINITIONS_POLICY, profile: construction.profile, source: construction.source,
    sources: { rules: construction.orderedStages, art: art.layers }, definitions, placements, diagnostics,
    coverage: { identityComplete: construction.identityComplete, typedDefinitions: definitions.length, placedTypes: placed.size,
      unsupportedFields: definitions.reduce((n, d) => n + Object.values(d).filter(f => f && typeof f === 'object' && 'status' in f && f.status === 'unsupported').length, 0),
      unsupportedPlacementHealth: placements.filter(p => p.initialHealth.status === 'unsupported').length },
    requiredRuntimeWork: ['cell-occupancy-and-subcells', 'locomotor-execution-and-speed-modifiers', 'weapon-warhead-projectile-statistics', 'weapon-slot-selection-and-elite-weapons',
      'country-difficulty-veterancy-modifiers', 'terrain-object-initial-health', 'spawn-and-mission-execution'],
    nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const fingerprint = fingerprintFor(body, cap.serializedBytes);
  const result = freeze({ ...body, fingerprint }); compiledDefinitions.add(result); return result;
}
