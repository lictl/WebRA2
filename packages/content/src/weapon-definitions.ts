// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../WEAPON_DEFINITIONS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from './entity-definitions.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections, type IniSourceSection } from './ini-source-view.ts';
import type { IniOrigin, RuntimeIni } from './runtime-ini.ts';
import { weaponBoolean, weaponCalculatedSpeed, weaponDecimal, weaponInteger, weaponVerse, weaponFloatStore } from './weapon-numbers.ts';

export const WEAPON_DEFINITIONS_POLICY = 'webra2-weapon-definitions-1' as const;
export const WEAPON_DEFINITIONS_LIMITS = Object.freeze({ stages: 64, occurrences: 262144, definitions: 8192,
  links: 65536, fieldReads: 1_048_576, history: 524288, diagnostics: 32768, nodes: 2_000_000,
  characters: 64 * 1024 * 1024, serializedBytes: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof WEAPON_DEFINITIONS_LIMITS]: number };
type Kind = 'weapon' | 'projectile' | 'warhead';
type Scalar = number | boolean | string | readonly number[];
export type WeaponField<T> = EntityField<T>;
export interface WeaponScalars {
  readonly damage: WeaponField<number>; readonly rof: WeaponField<number>; readonly burst: WeaponField<number>;
  /** Native 256-units-per-cell integer distance; not a world path distance. */
  readonly range: WeaponField<number>; readonly minimumRange: WeaponField<number>;
  /** Last INI-scaled input and state after the separate native CalculateSpeed pass. */
  readonly configuredSpeed: WeaponField<number>; readonly speed: WeaponField<number>;
  readonly projectile: WeaponField<string>; readonly warhead: WeaponField<string>;
}
export interface ProjectileScalars {
  readonly aa: WeaponField<boolean>; readonly ag: WeaponField<boolean>; readonly inviso: WeaponField<boolean>;
  readonly arcing: WeaponField<boolean>; readonly floater: WeaponField<boolean>; readonly dropping: WeaponField<boolean>;
  readonly level: WeaponField<boolean>; readonly rot: WeaponField<number>;
  readonly airburstWeapon: WeaponField<string>; readonly shrapnelWeapon: WeaponField<string>;
}
export interface WarheadScalars {
  /** Armor order matches entity armor indices 0..10. Damage application remains a separate runtime. */
  readonly verses: WeaponField<readonly number[]>; readonly cellSpread: WeaponField<number>;
  readonly cellInset: WeaponField<number>; readonly percentAtMax: WeaponField<number>; readonly proneDamage: WeaponField<number>;
}
export interface WeaponRecord<T> {
  readonly id: string; readonly name: string; readonly kind: Kind;
  readonly allocation: Readonly<{ stage: string; phase: 'entity-links' | 'warhead-registry' | 'weapon-load' | 'projectile-load'; origin: IniOrigin }>;
  readonly references: readonly IniOrigin[]; readonly loadStages: readonly string[];
  readonly fields: T & Readonly<Record<string, WeaponField<Scalar>>>;
  readonly unhandledFields: readonly IniOrigin[];
  readonly resets: readonly Readonly<{ field: 'verses'; layerId: string; sourceSha256: string; sectionLine: number }>[];
  readonly referenceClosure: 'typed' | 'unsupported';
  readonly status: 'typed' | 'unsupported'; readonly unsupportedReasons: readonly string[];
}
export interface WeaponDefinitions {
  readonly schemaVersion: 1; readonly policy: typeof WEAPON_DEFINITIONS_POLICY; readonly profile: RuntimeIni['profile'];
  readonly entityFingerprint: string; readonly sources: RuntimeIni['layers']; readonly fingerprint: string;
  readonly gravity: WeaponField<number>;
  readonly links: readonly Readonly<{ typeId: string; slot: 'primary' | 'secondary'; field: WeaponField<string> }>[];
  readonly weapons: readonly WeaponRecord<WeaponScalars>[]; readonly projectiles: readonly WeaponRecord<ProjectileScalars>[];
  readonly warheads: readonly WeaponRecord<WarheadScalars>[];
  readonly diagnostics: readonly Readonly<{ code: string; subjectId: string; field: string; origin: IniOrigin | null }>[];
  readonly coverage: Readonly<{ rootLinksResolved: boolean; rootClosuresTyped: boolean; linkedWeaponCount: number; unsupportedRecords: number;
    allocationScope: 'first-two-normal-history-and-warhead-registry'; nativeAllocationComplete: false }>;
  readonly requiredRuntimeWork: readonly string[]; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
const compiled = new WeakSet<object>();
/** Same-module immutable compiler result only; this is not source authentication or a JSON loader. */
export function isWeaponDefinitions(value: unknown): value is WeaponDefinitions { return !!value && typeof value === 'object' && compiled.has(value); }
export class WeaponDefinitionsError extends Error { constructor(readonly code: string) { super(`weapon-definitions-${code}`); this.name = 'WeaponDefinitionsError'; } }
const fail = (code: string): never => { throw new WeaponDefinitionsError(code); };
const lower = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
const semantic = (s: string): string => s.split(';', 1)[0]!.trim();
const field = <T>(value: T | null, status: EntityField<T>['status'], rule: string, origin: IniOrigin | null = null, history: readonly IniOrigin[] = []): EntityField<T> => ({ value, status, rule, origin, history });
function plain(v: unknown): asserts v is Record<string, unknown> { if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('record'); }
function limits(options: Partial<Limits>): Limits {
  plain(options); const cap: Limits = { ...WEAPON_DEFINITIONS_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limit');
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[key as keyof Limits]) fail('limit');
    cap[key as keyof Limits] = d.value;
  }
  return cap;
}
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function fingerprint(value: unknown, cap: number): string {
  const h = sha256.create(), encoder = new TextEncoder(); let remaining = cap;
  function emit(s: string): void { if (s.length > remaining) fail('serialization-limit'); const b = encoder.encode(s); if (b.length > remaining) fail('serialization-limit'); remaining -= b.length; h.update(b); }
  function string(s: string): void { if (s.length > Math.floor((remaining - 2) / 6)) fail('serialization-limit'); emit(JSON.stringify(s)); }
  function walk(v: unknown): void {
    if (typeof v === 'string') string(v);
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') emit(JSON.stringify(v));
    else if (Array.isArray(v)) { emit('['); v.forEach((e, i) => { if (i) emit(','); walk(e); }); emit(']'); }
    else { const r = v as Record<string, unknown>; emit('{'); Object.keys(r).sort().forEach((k, i) => { if (i) emit(','); string(k); emit(':'); walk(r[k]); }); emit('}'); }
  }
  walk(value); return Array.from(h.digest(), n => n.toString(16).padStart(2, '0')).join('');
}
type Spec = { key: string; name: string; initial: number | boolean; parse: (s: string) => number | boolean | null; yr?: boolean };
const numberSpec = (key: string, name: string, initial = 0, parse: Spec['parse'] = weaponInteger): Spec => ({ key, name, initial, parse });
const boolSpec = (key: string, initial = false, yr = false): Spec => ({ key, name: key[0]!.toLowerCase() + key.slice(1), initial, parse: weaponBoolean, yr });
const bools = (names: string): Spec[] => names.split(' ').map(k => boolSpec(k));
const WEAPON_SPECS: readonly Spec[] = [numberSpec('Damage', 'damage'), numberSpec('ROF', 'rof'), numberSpec('Burst', 'burst', 1),
  numberSpec('AmbientDamage', 'ambientDamage'), numberSpec('RadLevel', 'radLevel'),
  ...bools('IsSonic Spawner LimboLaunch CellRangefinding FireOnce NeverUse TerrainFire SabotageCursor DisguiseFireOnly Suicide Supress Camera IsLaser IsHouseColor Charges TurboBoost UseFireParticles UseSparkParticles OmniFire DistributedWeaponFire IsRailgun Lobber IsBigLaser Bright IonSensitive AreaFire IsElectricBolt DrawBoltAsLaser IsAlternateColor IsRadBeam IsRadEruption'),
  boolSpec('DecloakToFire', true), boolSpec('RevealOnFire', true),
  ...bools('MigAttackCursor InfiniteMindControl DrainWeapon DiskLaser IsLine IsMagBeam').map(s => ({ ...s, yr: true })),
  boolSpec('FireWhileMoving', true, true), boolSpec('FireInTransport', true, true)];
const PROJECTILE_SPECS: readonly Spec[] = [numberSpec('ROT', 'rot'), numberSpec('Arm', 'arm'), numberSpec('Acceleration', 'acceleration', 3),
  numberSpec('CourseLockDuration', 'courseLockDuration'), numberSpec('Cluster', 'cluster', 1), numberSpec('ShrapnelCount', 'shrapnelCount'),
  numberSpec('DetonationAltitude', 'detonationAltitude'), numberSpec('Elasticity', 'elasticity', 0.75, weaponDecimal),
  { ...boolSpec('AA'), name: 'aa' }, { ...boolSpec('AG', true), name: 'ag' },
  ...bools('Arcing Floater SubjectToCliffs SubjectToElevation SubjectToWalls VeryHigh Dropping Level Inviso Proximity Ranged Inaccurate FlakScatter Degenerates Bouncy Airburst Scalable Vertical')];
const WARHEAD_SPECS: readonly Spec[] = [numberSpec('CellSpread', 'cellSpread', 0, weaponDecimal), numberSpec('CellInset', 'cellInset', 0, weaponDecimal),
  numberSpec('PercentAtMax', 'percentAtMax', 1, weaponDecimal), numberSpec('ProneDamage', 'proneDamage', 1, weaponDecimal),
  numberSpec('InfDeath', 'infDeath'), numberSpec('Paralyzes', 'paralyzes'),
  ...bools('CausesDelayKill Conventional Wall WallAbsoluteDestroyer Wood Tiberium Sparky Sonic Rocker Fire EMEffect MindControl IvanBomb ElectricAssault Parasite Temporal BombDisarm Culling MakesDisguise NukeMaker Radiation PsychicDamage Bullets Veinhole'),
  ...bools('PenetratesBunker DirectRocker Poison IsLocomotor Airstrike Psychedelic').map(s => ({ ...s, yr: true })), boolSpec('AffectsAllies', true, true)];
type Mutable = { id: string; name: string; kind: Kind; allocation: WeaponRecord<unknown>['allocation']; references: IniOrigin[];
  loadStages: string[]; fields: Record<string, WeaponField<Scalar>>; unhandledFields: IniOrigin[]; resets: { field: 'verses'; layerId: string; sourceSha256: string; sectionLine: number }[]; unsupportedReasons: Set<string> };

/** Compile owned first-two normal-link history, with native field/load evidence and explicitly incomplete external allocation closure. */
export function compileWeaponDefinitions(input: { readonly definitions: EntityDefinitions; readonly rules: RuntimeIni }, options: Partial<Limits> = {}): WeaponDefinitions {
  const cap = limits(options); plain(input);
  if (Reflect.ownKeys(input).length !== 2 || !['definitions', 'rules'].every(k => { const d = Object.getOwnPropertyDescriptor(input, k); return d && 'value' in d; })) fail('input');
  const { definitions, rules } = input;
  if (!isEntityDefinitions(definitions)) fail('entity-brand');
  const pd = rules && typeof rules === 'object' ? Object.getOwnPropertyDescriptor(rules, 'profile') : null;
  if (!pd || !('value' in pd) || pd.value !== definitions.profile) fail('profile-source');
  const rv = createIniSourceView(rules, { stages: cap.stages, occurrences: cap.occurrences, nodes: cap.nodes, characters: cap.characters });
  if (definitions.profile !== rv.profile || definitions.sources.rules.length !== rules.layers.length) fail('profile-source');
  for (let i = 0; i < rules.layers.length; i++) {
    const a = definitions.sources.rules[i]!, b = rules.layers[i]!;
    if (Object.keys(a).some(k => a[k as keyof typeof a] !== b[k as keyof typeof b])) fail('profile-source');
  }
  if (definitions.definitions.length > cap.links / 2) fail('link-limit');
  const diagnostics: { code: string; subjectId: string; field: string; origin: IniOrigin | null }[] = [];
  const maps = { weapon: new Map<string, Mutable>(), projectile: new Map<string, Mutable>(), warhead: new Map<string, Mutable>() };
  const lists = { weapon: [] as Mutable[], projectile: [] as Mutable[], warhead: [] as Mutable[] };
  let historyCount = 0, linkCount = definitions.definitions.length * 2, recordCount = 0, readCount = 0;
  function diagnostic(code: string, subjectId: string, field: string, origin: IniOrigin | null): void {
    if (diagnostics.length >= cap.diagnostics) fail('diagnostic-limit'); diagnostics.push({ code, subjectId, field, origin });
  }
  function history(old: readonly IniOrigin[], add: readonly IniOrigin[]): readonly IniOrigin[] {
    if (old.length + add.length > cap.history - historyCount) fail('history-limit'); historyCount += old.length + add.length; return [...old, ...add];
  }
  function section(stage: string, name: string): IniSourceSection | undefined {
    if (++readCount > cap.fieldReads) fail('field-read-limit');
    const found = findIniSourceSections(rv, stage, name); if (found.length > 1) fail('repeated-consumed-section'); return found[0];
  }
  function entry(s: IniSourceSection | undefined, key: string) {
    if (++readCount > cap.fieldReads) fail('field-read-limit'); if (!s) return undefined;
    const found = findIniSourceEntries(s, key); if (found.length > 1) fail('repeated-consumed-key'); return found[0];
  }
  function specs(kind: Kind): readonly Spec[] { return kind === 'weapon' ? WEAPON_SPECS : kind === 'projectile' ? PROJECTILE_SPECS : WARHEAD_SPECS; }
  function allocate(kind: Kind, value: string, origin: IniOrigin, phase: Mutable['allocation']['phase']): string | null {
    if (++linkCount > cap.links) fail('link-limit');
    if (!value || /^(none|<none>)$/i.test(value)) return null;
    if (value.length > 24 || !/^[\x21-\x7e]+$/.test(value) || /[,;\[\]=]/.test(value) || /^<.*>$/.test(value)) {
      diagnostic('unsupported-reference', `${kind}:${lower(value)}`, 'reference', origin); return null;
    }
    const id = `${kind}:${lower(value)}`; let r = maps[kind].get(id);
    if (r) {
      if (r.name !== value) {
        r.unsupportedReasons.add('case-variant-allocation-order'); diagnostic('case-variant-allocation-order', id, 'reference', origin);
      }
      if (++historyCount > cap.history) fail('history-limit'); r.references.push(origin); return id;
    }
    if (++recordCount > cap.definitions) fail('definition-limit');
    r = { id, name: value, kind, allocation: { stage: origin.layerId, phase, origin }, references: [], loadStages: [],
      fields: Object.create(null) as Mutable['fields'], unhandledFields: [], resets: [], unsupportedReasons: new Set() };
    if (++historyCount > cap.history) fail('history-limit'); r.references.push(origin);
    for (const spec of specs(kind)) r.fields[spec.name] = spec.yr && rv.profile === 'ra2' ? field<Scalar>(null, 'not-applicable', 'profile-field-absent') : field(spec.initial, 'default', 'native-constructor');
    if (kind === 'weapon') {
      for (const key of ['range', 'minimumRange', 'configuredSpeed', 'speed']) r.fields[key] = field(0, 'default', 'native-constructor');
      for (const key of ['projectile', 'warhead']) r.fields[key] = field<Scalar>(null, 'default', 'native-constructor');
    } else if (kind === 'projectile') {
      for (const key of ['airburstWeapon', 'shrapnelWeapon']) r.fields[key] = field<Scalar>(null, 'default', 'native-constructor');
    } else r.fields.verses = field(Array<number>(11).fill(1), 'default', 'native-constructor');
    maps[kind].set(id, r); lists[kind].push(r); return id;
  }
  function assign(r: Mutable, s: IniSourceSection, spec: Spec): void {
    const e = entry(s, spec.key); if (!e) return;
    const old = r.fields[spec.name]!, origins = history(old.history, [e.origin]);
    if (spec.yr && rv.profile === 'ra2') { diagnostic('profile-field-not-loaded', r.id, spec.key, e.origin); return; }
    if (!e.value) { r.fields[spec.name] = { ...old, history: origins }; return; }
    let value = spec.parse(e.value);
    if (r.kind === 'warhead' && ['cellSpread', 'cellInset', 'percentAtMax'].includes(spec.name) && typeof value === 'number') value = weaponFloatStore(value);
    r.fields[spec.name] = field(value, value === null ? 'unsupported' : 'explicit', value === null ? 'unsupported-numeric-or-boolean' : 'native-current-default-read', e.origin, origins);
    if (value === null) diagnostic('unsupported-field-value', r.id, spec.key, e.origin);
  }
  function reference(r: Mutable, s: IniSourceSection, key: string, name: string, kind: Kind): void {
    const e = entry(s, key); if (!e) return;
    const old = r.fields[name]!, origins = history(old.history, [e.origin]);
    if (!e.value) { r.fields[name] = { ...old, history: origins }; return; }
    const value = allocate(kind, e.value, e.origin, r.kind === 'weapon' ? 'weapon-load' : 'projectile-load');
    const clear = /^(none|<none>)$/i.test(e.value);
    r.fields[name] = field(value, value === null && !clear ? 'unsupported' : 'explicit', clear ? 'reference-none' : 'native-find-or-allocate', e.origin, origins);
  }
  const seedStages = new Map<string, Map<string, IniOrigin>>();
  const links: { typeId: string; slot: 'primary' | 'secondary'; field: EntityField<string> }[] = [];
  for (const type of definitions.definitions) for (const slot of ['primary', 'secondary'] as const) {
    const f = type[slot]; links.push({ typeId: type.id, slot, field: f });
    if (f.status === 'unsupported') diagnostic('unsupported-entity-slot', type.id, slot, f.origin);
    for (const origin of f.history) {
      if (++readCount > cap.fieldReads) fail('field-read-limit');
      if (!['Primary', 'Secondary', 'Weapon1', 'Weapon2'].includes(origin.keySpelling)) continue;
      let stage = seedStages.get(origin.layerId); if (!stage) { stage = new Map(); seedStages.set(origin.layerId, stage); }
      const key = `${origin.line}`;
      if (!stage.has(key)) { if (++historyCount > cap.history) fail('history-limit'); stage.set(key, origin); }
    }
  }
  let gravity: EntityField<number> = field(3, 'default', 'native-rules-constructor');
  for (const stage of rv.stages) {
    const layer = stage.layer.id, general = section(layer, 'General'), ge = entry(general, 'Gravity');
    if (ge) {
      const h = history(gravity.history, [ge.origin]);
      if (!ge.value) gravity = { ...gravity, history: h };
      else { const value = weaponInteger(ge.value); gravity = field(value, value === null ? 'unsupported' : 'explicit', 'native-general-current-default', ge.origin, h); }
    }
    const warheads = section(layer, 'Warheads');
    if (warheads) {
      const keys = new Set<string>();
      for (const e of warheads.entries) { if (keys.has(e.key)) fail('repeated-consumed-key'); keys.add(e.key); allocate('warhead', e.value, e.origin, 'warhead-registry'); }
    }
    // All normal Techno slots precede the weapon pass. Within this scope source line order
    // is stable; case-variant spelling conflicts are unsupported, not a native index claim.
    for (const origin of [...(seedStages.get(layer)?.values() ?? [])].sort((a, b) => a.line - b.line)) allocate('weapon', semantic(origin.rawValue), origin, 'entity-links');
    for (const kind of ['weapon', 'projectile', 'warhead'] as const) for (let i = 0; i < lists[kind].length; i++) {
      const r = lists[kind][i]!, s = section(layer, r.name); if (!s) continue;
      if (++historyCount > cap.history) fail('history-limit'); r.loadStages.push(layer);
      const consumed = new Set(specs(kind).map(x => x.key));
      for (const spec of specs(kind)) assign(r, s, spec);
      if (kind === 'weapon') {
        for (const [key, name] of [['Range', 'range'], ['MinimumRange', 'minimumRange'], ['Speed', 'configuredSpeed']] as const) {
          consumed.add(key); const e = entry(s, key); if (!e) continue;
          const old = key === 'Speed' ? r.fields.speed! : r.fields[name]!, h = history(old.history, [e.origin]);
          const parsed = !e.value ? -1 : key === 'Speed' ? weaponInteger(e.value) : weaponDecimal(e.value);
          if (parsed === -1) { r.fields[name] = { ...old, history: h }; if (key === 'Speed') r.fields.speed = r.fields[name]!; continue; }
          let value: number | null = null;
          if (parsed !== null) value = key === 'Speed' ? Math.min(255, Math.floor(Math.max(0, Math.min(100, parsed)) * 256 / 100)) : Math.trunc(parsed * 256);
          if (value !== null && (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647)) value = null;
          r.fields[name] = field(value === 0 ? 0 : value, value === null ? 'unsupported' : 'explicit', key === 'Speed' ? 'native-percent-speed-0-255' : 'native-cell-distance-256', e.origin, h);
          if (key === 'Speed') r.fields.speed = r.fields[name]!;
        }
        for (const [key, name, target] of [['Warhead', 'warhead', 'warhead'], ['Projectile', 'projectile', 'projectile']] as const) {
          consumed.add(key); reference(r, s, key, name, target);
        }
      } else if (kind === 'projectile') {
        for (const [key, name] of [['AirburstWeapon', 'airburstWeapon'], ['ShrapnelWeapon', 'shrapnelWeapon']] as const) {
          consumed.add(key); reference(r, s, key, name, 'weapon');
        }
      } else {
        consumed.add('Verses'); const e = entry(s, 'Verses'), old = r.fields.verses!;
        // Native missing-key ReadString default is a nonempty 11-token 100% string,
        // whereas an explicitly empty key returns zero and preserves prior storage.
        if (!e) {
          if (++historyCount > cap.history) fail('history-limit');
          r.resets.push({ field: 'verses', layerId: layer, sourceSha256: stage.layer.sourceSha256, sectionLine: s.line });
          r.fields.verses = field(Array<number>(11).fill(1), 'derived', 'present-section-missing-verses-resets', null, old.history);
        }
        else if (!e.value) r.fields.verses = { ...old, history: history(old.history, [e.origin]) };
        else {
          const h = history(old.history, [e.origin]); let values: number[] | null = null;
          if (e.value.length <= 127 && e.value.split(',').length === 11) {
            const parsed = e.value.split(',').map(v => weaponVerse(v.trim())); if (parsed.every(v => v !== null)) values = parsed as number[];
          }
          r.fields.verses = field(values, values === null ? 'unsupported' : 'explicit', values === null ? 'unsupported-verses-framing-or-number' : 'native-eleven-verses', e.origin, h);
          if (values === null) diagnostic('unsupported-verses', r.id, 'Verses', e.origin);
        }
      }
      const keys = new Set<string>();
      for (const e of s.entries) {
        if (keys.has(e.key)) fail('repeated-consumed-key'); keys.add(e.key);
        if (!consumed.has(e.key)) { if (++historyCount > cap.history) fail('history-limit'); r.unhandledFields.push(e.origin); }
      }
    }
    for (const w of lists.weapon) {
      if (++readCount > cap.fieldReads) fail('field-read-limit');
      const p = typeof w.fields.projectile!.value === 'string' ? maps.projectile.get(w.fields.projectile!.value) : undefined;
      if (!p) { if (w.fields.projectile!.status === 'unsupported') w.fields.speed = field<Scalar>(null, 'unsupported', 'unknown-projectile-speed'); continue; }
      const rot = p.fields.rot!, floater = p.fields.floater!;
      if (rot.value === null) { w.fields.speed = field<Scalar>(null, 'unsupported', 'unknown-projectile-rot', rot.origin, history([], rot.history)); continue; }
      if (rot.value !== 0) continue;
      const range = w.fields.range!, h = history([], [...range.history, ...gravity.history, ...rot.history, ...floater.history]);
      const value = typeof range.value === 'number' && gravity.value !== null && typeof floater.value === 'boolean' ? weaponCalculatedSpeed(range.value, gravity.value, floater.value) : null;
      w.fields.speed = field(value, value === null ? 'unsupported' : 'derived', 'native-range-gravity-quantized-sqrt', range.origin, h);
    }
  }
  function finish(r: Mutable): WeaponRecord<unknown> {
    if (!r.loadStages.length) r.unsupportedReasons.add('no-loaded-definition-section');
    for (const [name, f] of Object.entries(r.fields)) if (f.status === 'unsupported') r.unsupportedReasons.add(`unsupported-field:${name}`);
    if (r.kind === 'weapon') for (const name of ['projectile', 'warhead']) if (r.fields[name]!.value === null) r.unsupportedReasons.add(`missing-reference:${name}`);
    for (const reason of r.unsupportedReasons) diagnostic(reason, r.id, 'definition', r.allocation.origin);
    return { ...r, referenceClosure: r.unsupportedReasons.size ? 'unsupported' : 'typed', unsupportedReasons: [...r.unsupportedReasons].sort(), status: r.unsupportedReasons.size ? 'unsupported' : 'typed' };
  }
  const weapons = lists.weapon.map(finish) as WeaponRecord<WeaponScalars>[], projectiles = lists.projectile.map(finish) as WeaponRecord<ProjectileScalars>[], warheads = lists.warhead.map(finish) as WeaponRecord<WarheadScalars>[];
  const all = [...weapons, ...projectiles, ...warheads], byId = new Map(all.map(x => [x.id, x]));
  // Reverse edges propagate unsupported descendants once; reference cycles remain legal data.
  const reverse = new Map<string, WeaponRecord<unknown>[]>();
  for (const r of all) for (const key of r.kind === 'weapon' ? ['projectile', 'warhead'] : r.kind === 'projectile' ? ['airburstWeapon', 'shrapnelWeapon'] : []) {
    const target = r.fields[key]!.value;
    if (typeof target === 'string') {
      if (++linkCount > cap.links) fail('link-limit');
      let parents = reverse.get(target); if (!parents) { parents = []; reverse.set(target, parents); } parents.push(r);
      if (!byId.has(target)) fail('internal-reference');
    }
  }
  const queue = all.filter(r => r.status === 'unsupported');
  for (let i = 0; i < queue.length; i++) for (const parent of reverse.get(queue[i]!.id) ?? []) {
    if (parent.referenceClosure === 'unsupported') continue;
    (parent as { referenceClosure: string }).referenceClosure = 'unsupported'; queue.push(parent as typeof queue[number]);
    diagnostic('unsupported-reference-target', parent.id, 'closure', parent.allocation.origin);
  }
  const linked = new Set(links.flatMap(l => l.field.value ? [l.field.value] : []));
  const body = { schemaVersion: 1 as const, policy: WEAPON_DEFINITIONS_POLICY, profile: rv.profile,
    entityFingerprint: definitions.fingerprint, sources: rules.layers, gravity, links, weapons, projectiles, warheads, diagnostics,
    coverage: { rootLinksResolved: links.every(l => l.field.status !== 'unsupported' && (l.field.value === null || byId.has(l.field.value))),
      rootClosuresTyped: links.every(l => l.field.status !== 'unsupported' && (l.field.value === null || byId.get(l.field.value)?.referenceClosure === 'typed')),
      linkedWeaponCount: linked.size, unsupportedRecords: all.filter(x => x.status === 'unsupported').length,
      allocationScope: 'first-two-normal-history-and-warhead-registry' as const, nativeAllocationComplete: false as const },
    requiredRuntimeWork: ['external-elite-numbered-special-weapon-allocation-order', 'complete-projectile-object-art-properties',
      'weapon-selection-and-target-legality', 'rof-burst-ammunition-and-veterancy', 'projectile-trajectory-and-impact',
      'armor-damage-and-spread-application', 'special-weapon-warhead-effects', 'native-parser-and-decimal-boundary-parity'],
    nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result = freeze({ ...body, fingerprint: fingerprint(body, cap.serializedBytes) }); compiled.add(result); return result;
}
