// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../COMBAT_DEATH_PROVENANCE.md.
import { isCombatActors, type CombatActors } from './combat-actors.ts';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from './entity-definitions.ts';
import { isWeaponDefinitions, type WeaponDefinitions } from './weapon-definitions.ts';
import { isAnimationEffects, type AnimationEffects } from './animation-effects.ts';
import { createIniSourceView, findIniSourceSections, findIniSourceEntries, type IniSourceEntry, type IniSourceSection } from './ini-source-view.ts';
import { combatActorFingerprint as hash } from './combat-actor-values.ts';
import { weaponBoolean, weaponInteger, weaponDecimal, weaponFloatStore } from './weapon-numbers.ts';
import type { RuntimeIni, IniOrigin } from './runtime-ini.ts';

export const COMBAT_DEATH_POLICY = 'webra2-combat-death-prerequisites-1' as const;
export const COMBAT_DEATH_LIMITS = Object.freeze({ stages: 64, occurrences: 262144, types: 16384,
  placements: 32768, history: 524288, references: 131072, diagnostics: 32768, work: 4_194_304,
  characters: 64 * 1024 * 1024, nodes: 2_000_000, serializedBytes: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof COMBAT_DEATH_LIMITS]: number };
type Value = boolean | number | string | readonly string[] | readonly number[];
export type CombatDeathField = EntityField<Value>;
export interface CombatDeathAnimationReference {
  readonly field: string; readonly names: readonly string[] | null;
  readonly status: 'empty' | 'presentation-fields-only' | 'active-effects' | 'unsupported';
  readonly reachableIds: readonly string[]; readonly reasons: readonly string[];
}
export interface CombatDeathType {
  readonly typeId: string; readonly name: string; readonly kind: CombatActors['definitions'][number]['kind'];
  readonly status: 'typed-prerequisites' | 'unsupported' | 'not-applicable';
  readonly fields: Readonly<Record<string, CombatDeathField>>;
  readonly animationReferences: readonly CombatDeathAnimationReference[];
  readonly weaponReference: Readonly<{ name: string | null; recordId: string | null; status: 'none' | 'record-present' | 'unsupported' }>;
  /** These predicates are requirements, not permission to omit other native/runtime state. */
  readonly branches: readonly Readonly<{ id: string; sourceState: 'inactive' | 'conditional' | 'unsupported'; requirements: readonly string[] }>[];
  readonly reasons: readonly string[];
}
export interface CombatDeath {
  readonly schemaVersion: 1; readonly policy: typeof COMBAT_DEATH_POLICY; readonly profile: RuntimeIni['profile'];
  readonly source: EntityDefinitions['source']; readonly sources: EntityDefinitions['sources'];
  readonly actorFingerprint: string; readonly entityFingerprint: string; readonly weaponFingerprint: string; readonly effectFingerprint: string;
  readonly globalDeathWeapon: CombatDeathField;
  readonly types: readonly CombatDeathType[];
  readonly placements: readonly Readonly<{ rowId: string; typeId: string | null }>[];
  readonly diagnostics: readonly Readonly<{ code: string; typeId: string; field: string; origin: IniOrigin | null }>[];
  readonly requiredRuntimeWork: readonly string[]; readonly fingerprint: string;
  readonly nativeExecutionVerified: false; readonly canExecuteCombat: false;
}
export class CombatDeathError extends Error { constructor(readonly code: string) { super(`combat-death-${code}`); this.name = 'CombatDeathError'; } }
function fail(code: string): never { throw new CombatDeathError(code); }
const brand = new WeakSet<object>();
export const isCombatDeath = (v: unknown): v is CombatDeath => !!v && typeof v === 'object' && brand.has(v);
const fold = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
function record(v: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('record');
  const own = Reflect.ownKeys(v), out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  if (keys && (own.length !== keys.length || !keys.every(k => Object.hasOwn(v, k)))) fail('fields');
  for (const k of own) { if (typeof k !== 'string') fail('fields'); const d = Object.getOwnPropertyDescriptor(v, k)!;
    if (!('value' in d) || !d.enumerable) fail('fields'); out[k] = d.value; }
  return out;
}
function limits(v: Partial<Limits>): Limits {
  const r = record(v), cap: Limits = { ...COMBAT_DEATH_LIMITS };
  for (const k of Object.keys(r)) { const value = r[k]; if (!Object.hasOwn(cap, k) || !Number.isSafeInteger(value) || Object.is(value, -0) ||
    (value as number) < 0 || (value as number) > cap[k as keyof Limits]) fail('limit'); cap[k as keyof Limits] = value as number; }
  return cap;
}
function frozen<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(frozen); Object.freeze(v); } return v; }
const initial = (value: Value | null, rule = 'fresh-native-constructor', status: CombatDeathField['status'] = 'default'): CombatDeathField => ({ value, rule, status, origin: null, history: [] });
type Spec = { key: string; value: Value | null; family?: 'infantry' | 'unit'; parser: 'boolean' | 'integer' | 'float32' | 'name' | 'animations' | 'voxel-anims' | 'integers' };
const specs: readonly Spec[] = [
  { key: 'Explodes', value: false, parser: 'boolean' }, { key: 'DeathWeapon', value: null, parser: 'name' },
  { key: 'DeathWeaponDamageModifier', value: 1, parser: 'float32' },
  { key: 'MaxDebris', value: 0, parser: 'integer' }, { key: 'MinDebris', value: 0, parser: 'integer' },
  { key: 'DebrisTypes', value: [], parser: 'voxel-anims' }, { key: 'DebrisMaximums', value: [], parser: 'integers' },
  ...['DebrisAnims', 'Explosion', 'DestroyAnim'].map(key => ({ key, value: [], parser: 'animations' as const })),
  { key: 'Crewed', value: false, parser: 'boolean' }, { key: 'Passengers', value: 0, parser: 'integer' },
  { key: 'Organic', value: false, parser: 'boolean' }, { key: 'Crashable', value: false, parser: 'boolean' },
  { key: 'Cyborg', value: false, family: 'infantry', parser: 'boolean' }, { key: 'NotHuman', value: false, family: 'infantry', parser: 'boolean' },
  { key: 'DeathAnims', value: [], family: 'infantry', parser: 'animations' }, { key: 'DeadBodies', value: [], family: 'infantry', parser: 'animations' },
];
const name = (s: string): boolean => /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,23}$/.test(s);
const none = (s: string): boolean => ['none', '<none>'].includes(fold(s));

/** Source prerequisites only. Live death/warhead/owner/attachment state must be evaluated by a separate runtime adapter. */
export function compileCombatDeath(input: { readonly actors: CombatActors; readonly definitions: EntityDefinitions;
  readonly weapons: WeaponDefinitions; readonly effects: AnimationEffects; readonly rules: RuntimeIni; readonly art: RuntimeIni }, options: Partial<Limits> = {}): CombatDeath {
  const r = record(input, ['actors', 'definitions', 'weapons', 'effects', 'rules', 'art']), cap = limits(options);
  const { actors, definitions, weapons, effects } = r as unknown as typeof input;
  if (!isCombatActors(actors) || !isEntityDefinitions(definitions) || !isWeaponDefinitions(weapons) || !isAnimationEffects(effects)) fail('factory');
  if (actors.entityFingerprint !== definitions.fingerprint || weapons.entityFingerprint !== definitions.fingerprint ||
    effects.entityFingerprint !== definitions.fingerprint || effects.weaponFingerprint !== weapons.fingerprint) fail('definition-identity');
  if ([actors, weapons, effects].some(v => v.profile !== definitions.profile)) fail('profile');
  if (actors.definitions.length > cap.types || actors.placements.length > cap.placements || effects.animations.length > cap.references || weapons.weapons.length > cap.references) fail('input-limit');
  const viewLimits = { stages: cap.stages, occurrences: cap.occurrences, nodes: cap.nodes, characters: cap.characters, work: cap.work };
  const rv = createIniSourceView(r.rules as RuntimeIni, viewLimits), av = createIniSourceView(r.art as RuntimeIni, viewLimits);
  const same = (a: unknown, b: unknown): boolean => hash(a, cap.serializedBytes) === hash(b, cap.serializedBytes);
  if (rv.profile !== definitions.profile || av.profile !== definitions.profile || !same(actors.source, definitions.source) ||
    !same(actors.sources, rv.stages.map(s => s.layer)) || !same(weapons.sources, actors.sources) ||
    !same(definitions.sources, effects.sources) || !same(definitions.sources, { rules: actors.sources, art: av.stages.map(s => s.layer) })) fail('source-identity');
  if (actors.definitions.length !== definitions.definitions.length || actors.placements.length !== definitions.placements.length) fail('actor-identity');
  const typed = new Map(definitions.definitions.map(t => [t.id, t]));
  for (const t of actors.definitions) { const d = typed.get(t.id); if (!d || t.name !== d.name || t.kind !== d.kind) fail('actor-identity'); }
  const placements = new Map(definitions.placements.map(p => [p.rowId, p]));
  for (const p of actors.placements) if (placements.get(p.rowId)?.typeId !== p.typeId) fail('placement-identity');
  let work = 0, history = 0, references = 0;
  const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const remember = (n: number) => { if (n > cap.history - history) fail('history-limit'); history += n; };
  const reference = (n = 1) => { if (n > cap.references - references) fail('reference-limit'); references += n; charge(n); };
  const diagnostics: { code: string; typeId: string; field: string; origin: IniOrigin | null }[] = [];
  const diagnostic = (code: string, typeId: string, field: string, origin: IniOrigin | null) => {
    if (diagnostics.length >= cap.diagnostics) fail('diagnostic-limit'); diagnostics.push({ code, typeId, field, origin }); };
  const section = (layer: string, name: string): IniSourceSection | undefined => {
    charge(); const found = findIniSourceSections(rv, layer, name); if (found.length > 1) fail('ambiguous-section'); return found[0]; };
  const read = (s: IniSourceSection | undefined, key: string): IniSourceEntry | undefined => {
    charge(); if (!s) return undefined; const found = findIniSourceEntries(s, key); if (found.length > 1) fail('ambiguous-key'); return found[0]; };
  function apply(old: CombatDeathField, e: IniSourceEntry | undefined, spec: Spec, typeId: string): CombatDeathField {
    if (!e) return old; remember(old.history.length + 1); const history = [...old.history, e.origin];
    if (!e.value) return { ...old, history };
    let value: Value | null = null, valid = e.value.length <= (spec.parser === 'integers' ? 511 : 127);
    if (valid) {
      if (spec.parser === 'boolean') value = weaponBoolean(e.value);
      else if (spec.parser === 'integer') value = weaponInteger(e.value);
      else if (spec.parser === 'float32') { const v = weaponDecimal(e.value); value = v === null ? null : weaponFloatStore(v); }
      else if (spec.parser === 'name') { valid = name(e.value) || none(e.value); value = none(e.value) ? null : e.value; }
      else { const tokens = e.value.split(',').filter(Boolean); reference(tokens.length);
        if (spec.parser === 'integers') {
          // This vector loader calls decimal atoi, not the INI reader's hex path.
          const values = tokens.map(t => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(t) ? weaponInteger(t) : null);
          valid = values.every(v => v !== null); value = valid ? values as number[] : null;
        }
        else { valid = tokens.every(t => name(t) || none(t)); value = tokens.filter(t => !none(t)); }
      }
      if (!['name', 'animations', 'voxel-anims', 'integers'].includes(spec.parser) && value === null) valid = false;
    }
    if (!valid || typeof value === 'number' && !Number.isFinite(value)) { diagnostic('unsupported-value', typeId, spec.key, e.origin);
      return { value: null, status: 'unsupported', rule: 'unsupported-native-parser-input', origin: e.origin, history }; }
    return { value, status: 'explicit', rule: 'native-read-current-default', origin: e.origin, history };
  }
  const animations = new Map(effects.animations.map(a => [a.id, a]));
  function animation(field: string, f: CombatDeathField): CombatDeathAnimationReference {
    const names = Array.isArray(f.value) ? f.value as readonly string[] : null, reasons = new Set<string>();
    if (f.status === 'unsupported' || names === null) return { field, names: null, status: 'unsupported', reachableIds: [], reasons: ['unsupported-reference'] };
    const visited = new Set<string>(), active = new Set<string>(), pending: { id: string; exit: boolean }[] = [];
    let gameplay = false;
    for (const raw of names) { const id = `animation:${fold(raw)}`, found = animations.get(id); reference();
      if (!found || !found.initialRegistrySpelling || found.name !== raw) reasons.add('unproven-first-allocation-or-spelling'); pending.push({ id, exit: false }); }
    while (pending.length) { charge(); const item = pending.pop()!;
      if (item.exit) { active.delete(item.id); continue; }
      if (active.has(item.id)) { reasons.add('animation-cycle'); continue; }
      if (visited.has(item.id)) continue; visited.add(item.id); active.add(item.id); reference();
      const n = animations.get(item.id); if (!n) { reasons.add('animation-record-not-in-scoped-effect-compiler'); continue; }
      if (n.localStatus === 'gameplay-active') gameplay = true;
      for (const reason of n.reasons) { charge(); reasons.add(`${n.id}:${reason}`); }
      pending.push({ id: item.id, exit: true }); reference(n.edges.length);
      for (let i = n.edges.length - 1; i >= 0; i--) pending.push({ id: n.edges[i]!.targetId, exit: false });
    }
    return { field, names, status: gameplay ? 'active-effects' : reasons.size ? 'unsupported' : names.length ? 'presentation-fields-only' : 'empty', reachableIds: [...visited].sort(), reasons: [...reasons].sort() };
  }
  let globalDeathWeapon = initial(null);
  for (const stage of rv.stages) globalDeathWeapon = apply(globalDeathWeapon, read(section(stage.layer.id, 'CombatDamage'), 'DeathWeapon'), specs[1]!, 'global');
  const weaponById = new Map(weapons.weapons.map(w => [w.id, w]));
  const types: CombatDeathType[] = [];
  for (const type of actors.definitions) {
    charge(); const ordinary = type.kind === 'infantry' || type.kind === 'unit', fields: Record<string, CombatDeathField> = {}, reasons: string[] = [];
    for (const spec of specs) fields[spec.key] = !ordinary || spec.family && type.kind !== spec.family ? initial(null, 'type-family', 'not-applicable') :
      initial(spec.key === 'Organic' ? type.kind === 'infantry' : spec.value, spec.key === 'Organic' ? 'fresh-native-subtype-constructor' : undefined);
    if (ordinary) {
      // Genuine actors retain every visited property section. Empty sections change no field; the fresh defaults still apply.
      let cursor = 0;
      while (cursor < type.rawFields.length) {
        const origin = type.rawFields[cursor]!, s = section(origin.layerId, type.name);
        if (!s || s.name !== origin.sectionSpelling || !s.entries.length) fail('actor-source-section');
        // Check the complete retained section, including fields outside this component.
        // Consume each visit separately rather than deduplicating later native loads.
        charge(s.entries.length);
        if (cursor + s.entries.length > type.rawFields.length || !same(s.entries.map(e => e.origin), type.rawFields.slice(cursor, cursor + s.entries.length))) fail('actor-source-fields');
        cursor += s.entries.length;
        for (const spec of specs) if (!spec.family || spec.family === type.kind) fields[spec.key] = apply(fields[spec.key]!, read(s, spec.key), spec, type.id);
        const min = fields.MinDebris!, max = fields.MaxDebris!;
        if (typeof min.value === 'number' && min.value < 0) fields.MinDebris = { ...min, value: 0, status: 'derived', rule: 'native-negative-min-debris-zero' };
        const adjusted = fields.MinDebris!;
        if (typeof max.value === 'number' && typeof adjusted.value === 'number' && max.value < adjusted.value) {
          const dependency = adjusted.origin && !max.history.includes(adjusted.origin) ? [adjusted.origin] : [];
          remember(max.history.length + dependency.length);
          fields.MaxDebris = { ...max, value: adjusted.value, status: 'derived', rule: 'native-max-debris-at-least-min',
            origin: adjusted.origin, history: [...max.history, ...dependency] };
        } else if (adjusted.status === 'unsupported') fields.MaxDebris = { ...max, value: null, status: 'unsupported', rule: 'unknown-min-debris-clamp', origin: adjusted.origin };
      }
      for (const [key, f] of Object.entries(fields)) if (f.status === 'unsupported') reasons.push(`unsupported-field:${key}`);
    }
    const refs = ordinary ? specs.filter(s => s.parser === 'animations' && (!s.family || s.family === type.kind)).map(s => animation(s.key, fields[s.key]!)) : [];
    const dw = fields.DeathWeapon!, raw = typeof dw.value === 'string' ? dw.value : null, matched = raw ? weaponById.get(`weapon:${fold(raw)}`) : undefined;
    const weaponReference: CombatDeathType['weaponReference'] = { name: raw, recordId: matched?.name === raw ? matched.id : null,
      status: dw.status === 'unsupported' || raw && matched?.name !== raw ? 'unsupported' : raw ? 'record-present' : 'none' };
    const branches: CombatDeathType['branches'][number][] = ordinary ? [
      { id: 'death-explosion', sourceState: fields.Explodes!.status === 'unsupported' ? 'unsupported' : 'conditional', requirements: ['lethal-dry-path', 'type-explodes-or-active-veteran-explodes-or-current-weapon-suicide', 'explicit-then-normal-then-global-weapon-selection', 'death-weapon-runtime-and-effect-closure'] },
      { id: 'death-debris', sourceState: fields.MaxDebris!.status === 'unsupported' ? 'unsupported' : fields.MaxDebris!.value === 0 ? 'inactive' : 'conditional', requirements: ['lethal-dry-path', 'native-count-and-rng-sequencing', 'voxel-type-or-type/global-animation-effect-closure'] },
      { id: 'passenger-state', sourceState: 'conditional', requirements: ['complete-live-passenger-driver-and-attachment-state', 'death-explosion-destruction-versus-unit-ejection'] },
      { id: 'actor-death-lifecycle', sourceState: 'conditional', requirements: ['ordinary-warhead-and-derived-class-return-path', 'dry-ground-no-bridge-no-transport-no-crash-or-warp-state', 'sequence-deletion-and-occupancy-timing', 'owner-team-veterancy-and-kill-accounting'] },
    ] : [];
    if (type.kind === 'infantry') branches.push({ id: 'infantry-death-animation', sourceState: fields.DeathAnims!.status === 'unsupported' ? 'unsupported' : 'conditional', requirements: ['effective-InfDeath-after-sequence-and-killer-overrides', 'custom-index-or-first-reference-then-default-sequence-path', 'custom-root-allocation-and-effect-closure', 'Cyborg-NotHuman-jumpjet-crash-and-water-context', 'DeadBodies-usage-not-established'] });
    if (type.kind === 'unit') branches.push({ id: 'unit-death-animation', sourceState: [fields.Explosion!, fields.DestroyAnim!].some(f => f.status === 'unsupported') ? 'unsupported' :
      [fields.Explosion!, fields.DestroyAnim!].every(f => Array.isArray(f.value) && f.value.length === 0) ? 'inactive' : 'conditional',
      requirements: ['derived-unit-lethal-path-selected', 'global-rng-modulo-list-selection-even-for-singleton', 'active-explodes-and-ammo-select-last-explosion', 'ore-and-bounty-conditions-between-animation-constructors', 'global-art-effect-and-allocation-closure'] });
    if (type.kind === 'unit') branches.push({ id: 'crew-survivor', sourceState: fields.Crewed!.status === 'unsupported' ? 'unsupported' : 'conditional', requirements: ['live-driver-index', 'crewed-and-no-capacity-passengers-and-death-argument', 'global-crew-escape-chance-and-country-crew-selection', 'spawn-placement-health-and-rng-sequencing'] });
    types.push({ typeId: type.id, name: type.name, kind: type.kind, status: !ordinary ? 'not-applicable' : reasons.length ? 'unsupported' : 'typed-prerequisites', fields, animationReferences: refs, weaponReference, branches, reasons });
  }
  const result = { schemaVersion: 1 as const, policy: COMBAT_DEATH_POLICY, profile: definitions.profile, source: definitions.source, sources: definitions.sources,
    actorFingerprint: actors.fingerprint, entityFingerprint: definitions.fingerprint, weaponFingerprint: weapons.fingerprint, effectFingerprint: effects.fingerprint,
    globalDeathWeapon, types, placements: actors.placements.map(p => ({ rowId: p.rowId, typeId: p.typeId })), diagnostics,
    requiredRuntimeWork: ['conditional-native-death-context-evaluator', 'default-InfDeath-and-special-derived-death-paths', 'death-weapon-allocation-and-execution',
      'complete-death-animation-root-allocation', 'debris-survivor-passenger-effects', 'native-global-rng-sequencing', 'source-authenticated-world-integration'],
    nativeExecutionVerified: false as const, canExecuteCombat: false as const };
  const out = frozen({ ...result, fingerprint: hash(result, cap.serializedBytes) }); brand.add(out); return out;
}
