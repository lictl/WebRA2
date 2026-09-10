// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../INSTANT_WEAPONS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { isWeaponDefinitions, type WeaponDefinitions, type WeaponField } from './weapon-definitions.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections } from './ini-source-view.ts';
import type { RuntimeIni } from './runtime-ini.ts';
import { weaponDecimal, weaponInteger } from './weapon-numbers.ts';

export const INSTANT_WEAPONS_POLICY = 'webra2-flat-instant-context-1' as const;
export const INSTANT_WEAPONS_LIMITS = Object.freeze({ records: 8192, stages: 64, occurrences: 262144,
  nodes: 2_000_000, characters: 64 * 1024 * 1024, work: 4_194_304, cells: 4096, occupants: 4096, serializedBytes: 32 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof INSTANT_WEAPONS_LIMITS]: number };
export interface InstantWeaponRecord {
  readonly weaponId: string; readonly projectileId: string | null; readonly warheadId: string | null;
  readonly status: 'context-supported' | 'unsupported'; readonly reasons: readonly string[];
  readonly fields: Readonly<Record<'subjectToElevation' | 'subjectToCliffs' | 'subjectToWalls' | 'wall' | 'wood' | 'conventional', WeaponField<boolean> | null>>;
}
export interface InstantWeaponContexts {
  readonly policy: typeof INSTANT_WEAPONS_POLICY; readonly profile: WeaponDefinitions['profile'];
  readonly weaponDefinitionsSha256: string; readonly entityDefinitionsSha256: string;
  readonly sources: WeaponDefinitions['sources'];
  readonly globals: Readonly<Record<'maxDamage' | 'elevationIncrement' | 'elevationIncrementBonus' | 'elevationBonusCap', WeaponField<number>>>;
  readonly records: readonly InstantWeaponRecord[]; readonly fingerprint: string;
  readonly requiredOtherGates: readonly string[]; readonly nativeExecutionVerified: false; readonly canExecute: false;
}
export interface InstantContextActor {
  readonly id: string; readonly kind: 'infantry' | 'unit' | 'other';
  readonly x: number; readonly y: number; readonly z: number;
  readonly alive: boolean; readonly standing: boolean; readonly ground: boolean;
}
export interface InstantContextCell {
  readonly x: number; readonly y: number; readonly level: number; readonly floorZ: number;
  readonly land: 'dry' | 'water' | 'unknown'; readonly overlay: 'none' | 'present' | 'unknown'; readonly bridge: boolean;
}
/** Caller enumerates ALL impact-cell occupants, including unsupported/unknown occupants. */
export interface InstantWeaponContext {
  readonly source: InstantContextActor; readonly target: InstantContextActor;
  readonly targetMode: 'entity' | 'ground' | 'force-fire';
  readonly impact: Readonly<{ x: number; y: number; z: number }>;
  readonly specialBarriers: 'absent' | 'present' | 'unknown';
  readonly occupancy: 'complete' | 'incomplete';
  readonly occupants: readonly Readonly<{ id: string; kind: 'infantry' | 'unit' | 'other' | 'unknown' }>[];
  /** Complete source-target cell rectangle plus a one-cell margin; order is immaterial. */
  readonly cells: readonly InstantContextCell[];
}
export interface InstantWeaponContextResult {
  readonly status: 'eligible-context' | 'unsupported'; readonly reasons: readonly string[];
  readonly rangeBonus: 0 | null; readonly impactDistance: 0 | null; readonly maximumDamage: number | null;
  readonly requiredOtherGates: readonly string[]; readonly canExecute: false;
}
export class InstantWeaponsError extends Error {
  constructor(readonly code: string) { super(`instant-weapons-${code}`); this.name = 'InstantWeaponsError'; }
}
function fail(code: string): never { throw new InstantWeaponsError(code); }
const factories = new WeakMap<object, { records: Map<string, InstantWeaponRecord>; limits: Limits }>();
export const isInstantWeaponContexts = (v: unknown): v is InstantWeaponContexts => !!v && typeof v === 'object' && factories.has(v);
const OTHER_GATES = Object.freeze(['weapon-special-effects-and-animation-closure', 'actor-modifiers-and-death-effects',
  'current-complete-source-world-occupancy', 'range-and-target-authorization', 'native-damage-clamp-application',
  'explicit-simulation-impact-scheduling']);
function record(v: unknown, keys: readonly string[]): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('record');
  if (Reflect.ownKeys(v).length !== keys.length || keys.some(k => {
    const d = Object.getOwnPropertyDescriptor(v, k); return !d || !('value' in d) || !d.enumerable;
  })) fail('fields');
}
function list(v: unknown, cap: number): asserts v is readonly unknown[] {
  if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype || v.length > cap || Reflect.ownKeys(v).length !== v.length + 1) fail('list');
  for (let i = 0; i < v.length; i++) { const d = Object.getOwnPropertyDescriptor(v, String(i)); if (!d || !('value' in d) || !d.enumerable) fail('list'); }
}
function integer(v: unknown, min: number, max: number): asserts v is number {
  if (!Number.isSafeInteger(v) || Object.is(v, -0) || (v as number) < min || (v as number) > max) fail('integer');
}
function string(v: unknown): asserts v is string { if (typeof v !== 'string' || !/^[\x21-\x7e]{1,256}$/.test(v)) fail('identifier'); }
function bool(v: unknown): asserts v is boolean { if (typeof v !== 'boolean') fail('boolean'); }
function choice(v: unknown, values: readonly string[]): void { if (typeof v !== 'string' || !values.includes(v)) fail('enum'); }
function limits(options: Partial<Limits>): Limits {
  if (!options || typeof options !== 'object') fail('limits');
  const keys = Reflect.ownKeys(options); if (keys.some(k => typeof k !== 'string' || !Object.hasOwn(INSTANT_WEAPONS_LIMITS, k))) fail('limits');
  record(options, keys as string[]); const out: Limits = { ...INSTANT_WEAPONS_LIMITS };
  for (const k of keys as (keyof Limits)[]) { const value = options[k]; integer(value, 0, out[k]); out[k] = value; }
  return out;
}
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function hash(value: unknown, cap: number): string {
  const h = sha256.create(), encoder = new TextEncoder(); let remaining = cap;
  function emit(s: string): void { if (s.length > remaining) fail('serialization-limit'); const b = encoder.encode(s); if (b.length > remaining) fail('serialization-limit'); remaining -= b.length; h.update(b); }
  function text(s: string): void { if (s.length > Math.floor((remaining - 2) / 6)) fail('serialization-limit'); emit(JSON.stringify(s)); }
  function walk(v: unknown): void {
    if (typeof v === 'string') text(v);
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') emit(JSON.stringify(v));
    else if (Array.isArray(v)) { emit('['); v.forEach((e, i) => { if (i) emit(','); walk(e); }); emit(']'); }
    else { const r = v as Record<string, unknown>; emit('{'); Object.keys(r).sort().forEach((k, i) => { if (i) emit(','); text(k); emit(':'); walk(r[k]); }); emit('}'); }
  }
  walk(value); return Array.from(h.digest(), b => b.toString(16).padStart(2, '0')).join('');
}
const semantic = (s: string): string => s.split(';', 1)[0]!.replace(/^[ \t]+|[ \t]+$/g, '');
const newField = (value: number): WeaponField<number> => ({ value, status: 'default', rule: 'fresh-native-rules-constructor', origin: null, history: [] });

/** Scoped interpretation only. This does not admit a weapon's remaining effects or authorize firing. */
export function compileInstantWeaponContexts(input: { readonly weapons: WeaponDefinitions; readonly rules: RuntimeIni }, options: Partial<Limits> = {}): InstantWeaponContexts {
  const cap = limits(options); record(input, ['weapons', 'rules']); const { weapons, rules } = input;
  if (!isWeaponDefinitions(weapons)) fail('weapon-factory');
  const view = createIniSourceView(rules, { stages: cap.stages, occurrences: cap.occurrences, nodes: cap.nodes, characters: cap.characters, work: cap.work });
  if (view.profile !== weapons.profile || view.stages.length !== weapons.sources.length ||
      view.stages.some((s, i) => Object.entries(s.layer).some(([k, v]) => weapons.sources[i]![k as keyof typeof s.layer] !== v))) fail('rules-source');
  if (weapons.weapons.length + weapons.projectiles.length + weapons.warheads.length > cap.records) fail('record-limit');
  let work = 0; const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const globals = { maxDamage: newField(1000), elevationIncrement: newField(0), elevationIncrementBonus: newField(1), elevationBonusCap: newField(0) };
  const specs = [ ['CombatDamage', 'MaxDamage', 'maxDamage', weaponInteger], ['ElevationModel', 'ElevationIncrement', 'elevationIncrement', weaponInteger],
    ['ElevationModel', 'ElevationIncrementBonus', 'elevationIncrementBonus', weaponDecimal], ['ElevationModel', 'ElevationBonusCap', 'elevationBonusCap', weaponDecimal] ] as const;
  for (const stage of view.stages) for (const [section, key, dest, parse] of specs) {
    charge(); const sections = findIniSourceSections(view, stage.layer.id, section);
    if (sections.length > 1) fail('repeated-consumed-section');
    if (!sections[0]) continue;
    const entries = findIniSourceEntries(sections[0], key); if (entries.length > 1) fail('repeated-consumed-key');
    const entry = entries[0]; if (!entry) continue;
    const old = globals[dest], raw = semantic(entry.origin.rawValue), parsed = parse(raw);
    charge(old.history.length + 1);
    // Empty native numeric reads retain the current default. Unsupported nonempty conversions stay unknown.
    globals[dest] = { value: !raw ? old.value : parsed, status: !raw ? old.status : parsed === null ? 'unsupported' : 'explicit',
      rule: !raw ? 'empty-retains-current' : parsed === null ? 'unsupported-native-number' : 'native-source-field',
      origin: !raw ? old.origin : entry.origin, history: [...old.history, entry.origin] };
  }
  const projectiles = new Map(weapons.projectiles.map(p => [p.id, p])), warheads = new Map(weapons.warheads.map(h => [h.id, h]));
  const records: InstantWeaponRecord[] = [];
  for (const w of weapons.weapons) {
    charge(); const p = projectiles.get(w.fields.projectile.value ?? ''), h = warheads.get(w.fields.warhead.value ?? '');
    const reasons: string[] = [];
    for (const r of [w, p, h]) if (!r || r.status !== 'typed' || r.referenceClosure !== 'typed') reasons.push('unresolved-native-definition');
    const fields: InstantWeaponRecord['fields'] = { subjectToElevation: p?.fields.subjectToElevation as WeaponField<boolean> ?? null,
      subjectToCliffs: p?.fields.subjectToCliffs as WeaponField<boolean> ?? null, subjectToWalls: p?.fields.subjectToWalls as WeaponField<boolean> ?? null,
      wall: h?.fields.wall as WeaponField<boolean> ?? null, wood: h?.fields.wood as WeaponField<boolean> ?? null,
      conventional: h?.fields.conventional as WeaponField<boolean> ?? null };
    if (Object.values(fields).some(f => !f || typeof f.value !== 'boolean' || f.status === 'unsupported')) reasons.push('unsupported-context-field');
    if (p?.fields.inviso.value !== true || p.fields.ag.value !== true || p.fields.rot.value !== 0 ||
        ['arcing', 'floater', 'dropping', 'level', 'ranged', 'inaccurate', 'proximity', 'bouncy', 'vertical'].some(k => p.fields[k]?.value !== false)) reasons.push('outside-invisible-trajectory');
    if (h?.fields.cellSpread.value !== 0 || h.fields.cellInset.value !== 0) reasons.push('outside-zero-spread');
    const max = globals.maxDamage.value;
    if (max === null || !Number.isSafeInteger(max) || max < 1 || max > 1_000_000) reasons.push('unsupported-maximum-damage');
    if (fields.subjectToElevation?.value === true && (globals.elevationIncrement.value === null || globals.elevationIncrement.value < 1 ||
      globals.elevationIncrementBonus.value === null || globals.elevationIncrementBonus.value < 0 ||
      globals.elevationBonusCap.value === null || globals.elevationBonusCap.value < 0)) reasons.push('unsupported-elevation-model');
    records.push({ weaponId: w.id, projectileId: p?.id ?? null, warheadId: h?.id ?? null,
      status: reasons.length ? 'unsupported' : 'context-supported', reasons: [...new Set(reasons)].sort(), fields });
  }
  const common = freeze({ policy: INSTANT_WEAPONS_POLICY, profile: weapons.profile, weaponDefinitionsSha256: weapons.fingerprint,
    entityDefinitionsSha256: weapons.entityFingerprint, sources: weapons.sources, globals, records, requiredOtherGates: OTHER_GATES,
    nativeExecutionVerified: false as const, canExecute: false as const });
  const result = Object.freeze({ ...common, fingerprint: hash(common, cap.serializedBytes) });
  factories.set(result, { records: new Map(records.map(r => [r.weaponId, r])), limits: cap }); return result;
}

/** Pure caller-context check; it cannot authenticate that a caller enumerated the real world. */
export function evaluateInstantWeaponContext(compiled: InstantWeaponContexts, weaponId: string, input: InstantWeaponContext): InstantWeaponContextResult {
  const state = factories.get(compiled); if (!state) fail('context-factory'); string(weaponId);
  const weapon = state.records.get(weaponId); if (!weapon) fail('weapon-id');
  record(input, ['source', 'target', 'targetMode', 'impact', 'specialBarriers', 'occupancy', 'occupants', 'cells']);
  const actor = (v: InstantContextActor): InstantContextActor => {
    record(v, ['id', 'kind', 'x', 'y', 'z', 'alive', 'standing', 'ground']); string(v.id); choice(v.kind, ['infantry', 'unit', 'other']);
    integer(v.x, 0, 0x7fffff); integer(v.y, 0, 0x7fffff); integer(v.z, 0, 0x7fffff); bool(v.alive); bool(v.standing); bool(v.ground); return { ...v };
  };
  const source = actor(input.source), target = actor(input.target);
  record(input.impact, ['x', 'y', 'z']); for (const value of Object.values(input.impact)) integer(value, 0, 0x7fffff);
  const impact = { ...input.impact }; choice(input.targetMode, ['entity', 'ground', 'force-fire']);
  choice(input.specialBarriers, ['absent', 'present', 'unknown']); choice(input.occupancy, ['complete', 'incomplete']);
  list(input.occupants, state.limits.occupants); list(input.cells, state.limits.cells);
  const reasons = [...weapon.reasons];
  if (input.targetMode !== 'entity') reasons.push('unsupported-target-mode');
  if (source.id === target.id || [source, target].some(a => a.kind === 'other' || !a.alive || !a.standing || !a.ground)) reasons.push('outside-standing-ground-actors');
  if (input.specialBarriers !== 'absent') reasons.push('special-barrier-closure-required');
  if (input.occupancy !== 'complete') reasons.push('incomplete-impact-occupancy');
  const occupantIds = new Set<string>();
  for (const o of input.occupants) { record(o, ['id', 'kind']); string(o.id); choice(o.kind, ['infantry', 'unit', 'other', 'unknown']); if (occupantIds.has(o.id)) fail('duplicate-occupant'); occupantIds.add(o.id); }
  if (input.occupants.length !== 1 || input.occupants[0]!.id !== target.id || input.occupants[0]!.kind !== target.kind) reasons.push('outside-singleton-impact-cell');
  if (impact.x !== target.x || impact.y !== target.y || impact.z !== target.z) reasons.push('nonzero-impact-distance');
  const sx = Math.floor(source.x / 256), sy = Math.floor(source.y / 256), tx = Math.floor(target.x / 256), ty = Math.floor(target.y / 256);
  const minX = Math.min(sx, tx) - 1, maxX = Math.max(sx, tx) + 1, minY = Math.min(sy, ty) - 1, maxY = Math.max(sy, ty) + 1;
  const count = (maxX - minX + 1) * (maxY - minY + 1);
  if (minX < 0 || minY < 0 || maxX > 32766 || maxY > 32766 || count > state.limits.cells) reasons.push('context-rectangle-limit');
  const cellIds = new Set<string>(); let level: number | null = null;
  for (const c of input.cells) {
    record(c, ['x', 'y', 'level', 'floorZ', 'land', 'overlay', 'bridge']); integer(c.x, 0, 32766); integer(c.y, 0, 32766);
    integer(c.level, 0, 255); integer(c.floorZ, 0, 0x7fffff); bool(c.bridge); choice(c.land, ['dry', 'water', 'unknown']); choice(c.overlay, ['none', 'present', 'unknown']);
    const id = `${c.x}:${c.y}`; if (cellIds.has(id)) fail('duplicate-cell'); cellIds.add(id);
    if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) reasons.push('outside-context-rectangle');
    if (level === null) level = c.level;
    if (c.level !== level || c.floorZ !== source.z || c.floorZ !== target.z) reasons.push('nonflat-ground');
    if (c.land !== 'dry' || c.overlay !== 'none' || c.bridge) reasons.push('terrain-effect-closure-required');
  }
  if (input.cells.length !== count) reasons.push('incomplete-context-rectangle');
  const unique = Object.freeze([...new Set(reasons)].sort()), ready = unique.length === 0;
  return Object.freeze({ status: ready ? 'eligible-context' : 'unsupported', reasons: unique, rangeBonus: ready ? 0 : null,
    impactDistance: ready ? 0 : null, maximumDamage: ready ? compiled.globals.maxDamage.value : null, requiredOtherGates: OTHER_GATES, canExecute: false });
}
