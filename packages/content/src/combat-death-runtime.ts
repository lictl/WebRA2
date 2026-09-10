// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../COMBAT_DEATH_PROVENANCE.md.
import { compileCombatDeath, isCombatDeath, COMBAT_DEATH_LIMITS, type CombatDeath, type CombatDeathField } from './combat-death.ts';
import { createIniSourceView, findIniSourceSections, findIniSourceEntries, type IniSourceSection, type IniSourceEntry } from './ini-source-view.ts';
import { combatActorFingerprint as hash } from './combat-actor-values.ts';
import { compileCombatVeterancy, isCombatVeterancy, selectCombatVeterancy, COMBAT_VETERANCY_LIMITS, type CombatVeterancy, type SelectedCombatVeterancy } from './combat-veterancy.ts';
import { weaponBoolean } from './weapon-numbers.ts';

export const ORDINARY_DEATH_POLICY = 'webra2-ordinary-human-death-1' as const;
export const ORDINARY_DEATH_LIMITS = COMBAT_DEATH_LIMITS;
type Limits = { -readonly [K in keyof typeof ORDINARY_DEATH_LIMITS]: number };
type Inputs = Parameters<typeof compileCombatDeath>[0] & { readonly death: CombatDeath; readonly veterancy: CombatVeterancy };
export interface OrdinaryCorpseClosure {
  readonly source: 'type' | 'global'; readonly field: CombatDeathField;
  readonly candidates: readonly Readonly<{ name: string; animationId: string }>[];
  readonly reachableIds: readonly string[]; readonly reasons: readonly string[];
  readonly status: 'presentation-fields-only' | 'unsupported';
}
export interface OrdinaryDeathType {
  readonly typeId: string; readonly kind: CombatDeath['types'][number]['kind'];
  readonly jumpJet: CombatDeathField; readonly corpse: OrdinaryCorpseClosure | null;
  readonly status: 'conditional-human' | 'unsupported'; readonly reasons: readonly string[];
}
export interface OrdinaryDeath {
  readonly schemaVersion: 1; readonly policy: typeof ORDINARY_DEATH_POLICY;
  readonly profile: CombatDeath['profile']; readonly source: CombatDeath['source']; readonly sources: CombatDeath['sources'];
  readonly deathFingerprint: string; readonly veterancyFingerprint: string; readonly globalDeadBodies: CombatDeathField;
  readonly types: readonly OrdinaryDeathType[]; readonly fingerprint: string;
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
/** Current world identities. A matching source row does not authenticate current owner, location or state. */
export interface OrdinaryDeathActor {
  readonly id: string; readonly rowId: string; readonly typeId: string; readonly ownerId: string;
}
/** Every fact must come from the complete authoritative actor/world state, not an optimistic UI assertion. */
export interface OrdinaryDeathContext {
  readonly complete: boolean; readonly standing: boolean; readonly dryGround: boolean; readonly onBridge: boolean;
  readonly heightAboveGround: number; readonly sequence: number; readonly currentLocomotor: 'walk' | 'other' | 'unknown';
  readonly inTransport: boolean; readonly passengerCount: number; readonly driverIndex: number;
  readonly attachedEffects: boolean; readonly spawnManager: boolean; readonly slaveManager: boolean;
  readonly mindControl: boolean; readonly temporal: boolean; readonly warping: boolean; readonly immobilized: boolean;
  /** Current authoritative rank storage: binary64 RA2, exact float32 YR. */
  readonly veterancy: number;
}
export interface OrdinaryDeathSelection {
  readonly victim: OrdinaryDeathActor; readonly attacker: OrdinaryDeathActor;
  readonly attackWeaponId: string; readonly warheadId: string; readonly currentWeaponId: string | null;
  /** Supplied after the separately verified complete damage stages and health transition. */
  readonly lethal: boolean; readonly context: OrdinaryDeathContext;
}
export interface OrdinaryDeathDecision {
  readonly policy: typeof ORDINARY_DEATH_POLICY; readonly planFingerprint: string; readonly source: CombatDeath['source'];
  readonly victim: OrdinaryDeathActor; readonly attacker: OrdinaryDeathActor;
  readonly attackWeaponId: string; readonly warheadId: string;
  readonly status: 'nonlethal' | 'ready-ordinary-human' | 'unsupported'; readonly reasons: readonly string[];
  readonly sequence: 11 | 12 | null; readonly selectedVeterancy: SelectedCombatVeterancy | null;
  readonly terminal: Readonly<{ corpseCandidates: OrdinaryCorpseClosure['candidates']; selection: 'one-native-word-modulo-count';
    removal: 'at-explicit-sequence-completion'; occupancy: 'release-owned-walk-occupancy'; duration: 'caller-WebRA2-tick-policy';
    accounting: 'victim-owner-attacker-source-event-required' }> | null;
  readonly excludedWork: readonly string[]; readonly canStartCampaign: false;
}
export class OrdinaryDeathError extends Error { constructor(readonly code: string) { super(`ordinary-death-${code}`); this.name = 'OrdinaryDeathError'; } }
function fail(code: string): never { throw new OrdinaryDeathError(code); }
const fold = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
function record(v: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('record');
  const own = Reflect.ownKeys(v), out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  if (keys && (own.length !== keys.length || !keys.every(k => Object.hasOwn(v, k)))) fail('fields');
  for (const k of own) { if (typeof k !== 'string') fail('fields'); const d = Object.getOwnPropertyDescriptor(v, k)!;
    if (!('value' in d) || !d.enumerable) fail('fields'); out[k] = d.value; }
  return out;
}
function settings(v: Partial<Limits>): Limits {
  const r = record(v), cap: Limits = { ...ORDINARY_DEATH_LIMITS };
  for (const k of Object.keys(r)) { const n = r[k]; if (!Object.hasOwn(cap, k) || !Number.isSafeInteger(n) || Object.is(n, -0) ||
    (n as number) < 0 || (n as number) > cap[k as keyof Limits]) fail('limit'); cap[k as keyof Limits] = n as number; }
  return cap;
}
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const field = (value: CombatDeathField['value'], rule: string): CombatDeathField => ({ value, status: 'default', rule, origin: null, history: [] });
const known = (f: CombatDeathField | undefined): boolean => !!f && !['unsupported', 'not-applicable'].includes(f.status);
type Private = { types: ReadonlyMap<string, OrdinaryDeathType>; placements: ReadonlyMap<string, Inputs['actors']['placements'][number]>;
  weapons: ReadonlyMap<string, Inputs['weapons']['weapons'][number]>; warheads: ReadonlyMap<string, Inputs['weapons']['warheads'][number]>;
  normalWeapons: ReadonlyMap<string, ReadonlySet<string>>; unknownWeapons: ReadonlySet<string>; veterancy: CombatVeterancy };
const plans = new WeakMap<object, Private>();
export const isOrdinaryDeath = (v: unknown): v is OrdinaryDeath => !!v && typeof v === 'object' && plans.has(v);

/** Cold source preparation. It neither authenticates caller source bytes nor schedules, draws randomness, or changes a world. */
export function compileOrdinaryDeath(input: Inputs, options: Partial<Limits> = {}): OrdinaryDeath {
  const cap = settings(options), r = record(input, ['death', 'actors', 'definitions', 'weapons', 'effects', 'rules', 'art', 'veterancy']);
  const owned = r as unknown as Inputs;
  if (!isCombatDeath(owned.death)) fail('death-factory');
  if (!isCombatVeterancy(owned.veterancy)) fail('veterancy-factory');
  // Reconstruct the reviewed prerequisite proof from the exact current source views.
  const reconstructed = compileCombatDeath({ actors: owned.actors, definitions: owned.definitions, weapons: owned.weapons,
    effects: owned.effects, rules: owned.rules, art: owned.art }, cap);
  if (reconstructed.fingerprint !== owned.death.fingerprint) fail('death-source-identity');
  const veteranLimits = { ...COMBAT_VETERANCY_LIMITS, types: cap.types, stages: cap.stages, occurrences: cap.occurrences,
    history: cap.history, work: cap.work, nodes: cap.nodes, characters: cap.characters,
    serializedBytes: Math.min(cap.serializedBytes, COMBAT_VETERANCY_LIMITS.serializedBytes) };
  if (compileCombatVeterancy({ actors: owned.actors, rules: owned.rules }, veteranLimits).fingerprint !== owned.veterancy.fingerprint) fail('veterancy-source-identity');
  const rv = createIniSourceView(owned.rules, { stages: cap.stages, occurrences: cap.occurrences,
    nodes: cap.nodes, characters: cap.characters, work: cap.work });
  let work = 0, references = 0, histories = 0, reasonCharacters = 0;
  const charge = (n = 1): void => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const reference = (n = 1): void => { if (n > cap.references - references) fail('reference-limit'); references += n; charge(n); };
  function section(stage: string, name: string): IniSourceSection | undefined { charge(); const a = findIniSourceSections(rv, stage, name); if (a.length > 1) fail('repeated-consumed-section'); return a[0]; }
  function entry(s: IniSourceSection | undefined, key: string): IniSourceEntry | undefined { charge(); if (!s) return undefined;
    const a = findIniSourceEntries(s, key); if (a.length > 1) fail('repeated-consumed-key'); return a[0]; }
  function update(old: CombatDeathField, e: IniSourceEntry | undefined, kind: 'names' | 'bool'): CombatDeathField {
    if (!e) return old;
    if (old.history.length + 1 > cap.history - histories) fail('history-limit'); histories += old.history.length + 1;
    const history = [...old.history, e.origin], text = e.origin.rawValue.split(';', 1)[0]!.replace(/^[ \t]+|[ \t]+$/g, '');
    if (!text.length) return { ...old, origin: e.origin, history };
    let value: CombatDeathField['value'] = null;
    if (text.length <= 127 && /^[\x20-\x7e]+$/.test(text)) {
      if (kind === 'bool') value = weaponBoolean(text);
      else { const names = text.split(',').filter(Boolean).filter(s => !['none', '<none>'].includes(fold(s)));
        reference(names.length); if (names.every(s => /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,23}$/.test(s))) value = names; }
    }
    return { value, status: value === null ? 'unsupported' : 'explicit', rule: 'incoming-native-current-value-list-or-boolean', origin: e.origin, history };
  }
  let global = field([], 'fresh-native-rules-constructor');
  for (const stage of rv.stages) global = update(global, entry(section(stage.layer.id, owned.death.profile === 'ra2' ? 'AudioVisual' : 'General'), 'DeadBodies'), 'names');
  const animations = new Map(owned.effects.animations.map(a => [a.id, a]));
  function closure(f: CombatDeathField, source: 'type' | 'global'): OrdinaryCorpseClosure {
    const reasons = new Set<string>(), candidates: { name: string; animationId: string }[] = [], reachable = new Set<string>(), active = new Set<string>();
    const reason = (text: string): void => { if (reasons.has(text)) return; if (text.length > cap.characters - reasonCharacters) fail('reason-character-limit'); reasonCharacters += text.length; reasons.add(text); };
    const pending: { id: string; exit: boolean }[] = [];
    if (!known(f) || !Array.isArray(f.value)) reason('unsupported-corpse-vector');
    else for (const name of f.value as readonly string[]) { reference(); const id = `animation:${fold(name)}`, a = animations.get(id);
      candidates.push({ name, animationId: id }); pending.push({ id, exit: false });
      if (!a || !a.initialRegistrySpelling || a.name !== name) reason('corpse-first-allocation-or-spelling-unproven'); }
    if (!candidates.length) reason('empty-global-corpse-fallback-native-division-unchecked');
    while (pending.length) { charge(); const v = pending.pop()!; if (v.exit) { active.delete(v.id); continue; }
      if (active.has(v.id)) { reason('corpse-animation-cycle'); continue; } if (reachable.has(v.id)) continue;
      reference(); reachable.add(v.id); active.add(v.id); const a = animations.get(v.id);
      if (!a) { reason('corpse-animation-not-compiled'); continue; }
      if (a.localStatus !== 'presentation-only' || !a.loadStages.length) reason('corpse-animation-effects-not-closed');
      for (const why of a.reasons) { charge(); reason(`${a.id}:${why}`); }
      pending.push({ id: v.id, exit: true }); reference(a.edges.length);
      for (let i = a.edges.length - 1; i >= 0; i--) pending.push({ id: a.edges[i]!.targetId, exit: false });
    }
    return { source, field: f, candidates, reachableIds: [...reachable].sort(), reasons: [...reasons].sort(), status: reasons.size ? 'unsupported' : 'presentation-fields-only' };
  }
  const deathTypes = new Map(owned.death.types.map(t => [t.typeId, t])), definitions = new Map(owned.definitions.definitions.map(t => [t.id, t]));
  const types: OrdinaryDeathType[] = [];
  for (const a of owned.actors.definitions) { charge(); const t = deathTypes.get(a.id)!, d = definitions.get(a.id)!, reasons: string[] = [];
    let jumpJet = field(false, 'fresh-native-techno-constructor');
    if (a.kind === 'infantry') { let cursor = 0;
      while (cursor < a.rawFields.length) { const o = a.rawFields[cursor]!, s = section(o.layerId, a.name)!;
        // The complete, repeated stage sequence was checked by prerequisite reconstruction above.
        if (!s || !s.entries.length) fail('actor-source-section'); cursor += s.entries.length;
        jumpJet = update(jumpJet, entry(s, 'JumpJet'), 'bool'); }
    }
    const corpse = a.kind === 'infantry' ? closure(known(t.fields.DeadBodies) && Array.isArray(t.fields.DeadBodies!.value) && t.fields.DeadBodies!.value.length ? t.fields.DeadBodies! :
      !known(t.fields.DeadBodies) ? t.fields.DeadBodies! : global, known(t.fields.DeadBodies) && Array.isArray(t.fields.DeadBodies!.value) && t.fields.DeadBodies!.value.length ? 'type' : 'global') : null;
    if (a.kind !== 'infantry') reasons.push('ordinary-human-infantry-only');
    else {
      for (const key of ['Cyborg', 'NotHuman', 'Crashable', 'Explodes']) if (!known(t.fields[key]) || t.fields[key]!.value !== false) reasons.push(`active-or-unknown:${key}`);
      if (!known(jumpJet) || jumpJet.value !== false) reasons.push('active-or-unknown:JumpJet');
      if (!known(t.fields.MaxDebris) || t.fields.MaxDebris!.value !== 0) reasons.push('active-or-unknown:MaxDebris');
      if (!known(t.fields.DeathAnims) || !Array.isArray(t.fields.DeathAnims!.value) || t.fields.DeathAnims!.value.length) reasons.push('custom-death-animation-not-supported');
      if (d.locomotor.status === 'unsupported' || d.locomotor.value?.kind !== 'walk') reasons.push('source-walk-locomotor-required');
      if (corpse?.status !== 'presentation-fields-only') reasons.push(...corpse!.reasons);
    }
    types.push({ typeId: a.id, kind: a.kind, jumpJet, corpse, status: reasons.length ? 'unsupported' : 'conditional-human', reasons: [...new Set(reasons)].sort() });
  }
  const normal = new Map<string, Set<string>>(), unknownWeapons = new Set<string>();
  for (const link of owned.weapons.links) { charge(); if (!normal.has(link.typeId)) normal.set(link.typeId, new Set());
    if (link.field.status === 'unsupported') unknownWeapons.add(link.typeId);
    if (link.field.status !== 'unsupported' && typeof link.field.value === 'string') normal.get(link.typeId)!.add(link.field.value); }
  const output = { schemaVersion: 1 as const, policy: ORDINARY_DEATH_POLICY, profile: owned.death.profile, source: owned.death.source,
    sources: owned.death.sources, deathFingerprint: owned.death.fingerprint, veterancyFingerprint: owned.veterancy.fingerprint, globalDeadBodies: global, types,
    nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result = freeze({ ...output, fingerprint: hash(output, cap.serializedBytes) });
  plans.set(result, { types: new Map(types.map(t => [t.typeId, t])), placements: new Map(owned.actors.placements.map(p => [p.rowId, p])),
    weapons: new Map(owned.weapons.weapons.map(w => [w.id, w])), warheads: new Map(owned.weapons.warheads.map(w => [w.id, w])), normalWeapons: normal, unknownWeapons, veterancy: owned.veterancy });
  return result;
}

function id(v: unknown): string { if (typeof v !== 'string' || !v.length || v.length > 160 || !/^[\x21-\x7e]+$/.test(v)) fail('identity'); return v; }
function actor(v: unknown): OrdinaryDeathActor { const r = record(v, ['id', 'rowId', 'typeId', 'ownerId']); return { id: id(r.id), rowId: id(r.rowId), typeId: id(r.typeId), ownerId: id(r.ownerId) }; }
const booleans = ['complete', 'standing', 'dryGround', 'onBridge', 'inTransport', 'attachedEffects', 'spawnManager', 'slaveManager', 'mindControl', 'temporal', 'warping', 'immobilized'] as const;
const counts = ['heightAboveGround', 'sequence', 'passengerCount', 'driverIndex'] as const;
/** A conditional decision, not an authentication mechanism. The coordinator must bind every fact to current authoritative state. */
export function selectOrdinaryInfantryDeath(plan: OrdinaryDeath, selection: OrdinaryDeathSelection): OrdinaryDeathDecision {
  const saved = plan && typeof plan === 'object' ? plans.get(plan) : undefined; if (!saved) fail('plan-factory');
  const s = record(selection, ['victim', 'attacker', 'attackWeaponId', 'warheadId', 'currentWeaponId', 'lethal', 'context']);
  const victim = actor(s.victim), attacker = actor(s.attacker), attackWeaponId = id(s.attackWeaponId), warheadId = id(s.warheadId);
  const currentWeaponId = s.currentWeaponId === null ? null : id(s.currentWeaponId);
  if (typeof s.lethal !== 'boolean') fail('lethal');
  const c = record(s.context, [...booleans, ...counts, 'currentLocomotor', 'veterancy']);
  for (const k of booleans) if (typeof c[k] !== 'boolean') fail('context');
  for (const k of counts) if (!Number.isSafeInteger(c[k]) || Object.is(c[k], -0) || (c[k] as number) < (k === 'driverIndex' ? -1 : 0) || (c[k] as number) > 65535) fail('context');
  if (typeof c.veterancy !== 'number' || !Number.isFinite(c.veterancy) || Object.is(c.veterancy, -0) || c.veterancy < -65536 || c.veterancy > 65536 ||
    (plan.profile === 'yr' && Math.fround(c.veterancy) !== c.veterancy)) fail('context-veterancy');
  if (!['walk', 'other', 'unknown'].some(v => c.currentLocomotor === v)) fail('context');
  const reasons: string[] = [], add = (v: string): void => { reasons.push(v); };
  for (const a of [victim, attacker]) { const p = saved.placements.get(a.rowId);
    if (!p || p.typeId !== a.typeId || p.ownerId !== a.ownerId) add('current-actor-source-placement-join-required'); }
  if (victim.id === attacker.id || victim.rowId === attacker.rowId) add('distinct-attacker-required');
  const type = saved.types.get(victim.typeId), attackingType = saved.types.get(attacker.typeId), weapon = saved.weapons.get(attackWeaponId), warhead = saved.warheads.get(warheadId);
  const selectedVeterancy = type && ['infantry', 'unit', 'aircraft', 'structure'].includes(type.kind)
    ? selectCombatVeterancy(saved.veterancy, { typeId: victim.typeId, veterancy: c.veterancy }) : null;
  if (!type) add('victim-type');
  if (saved.unknownWeapons.has(victim.typeId) || saved.unknownWeapons.has(attacker.typeId)) add('unknown-normal-weapon-links');
  if (!attackingType || !['infantry', 'unit'].includes(attackingType.kind)) add('ordinary-ground-attacker-required');
  if (!weapon || weapon.status !== 'typed' || !weapon.loadStages.length || !saved.normalWeapons.get(attacker.typeId)?.has(attackWeaponId) || weapon.fields.warhead.status === 'unsupported' ||
    typeof weapon.fields.warhead.value !== 'string' || weapon.fields.warhead.value !== warheadId) add('attack-weapon-warhead-join');
  if (!warhead || warhead.status !== 'typed' || !warhead.loadStages.length) add('warhead-source-unsupported');
  if (currentWeaponId !== null) { const current = saved.weapons.get(currentWeaponId);
    if (!saved.normalWeapons.get(victim.typeId)?.has(currentWeaponId) || !current || current.status !== 'typed' || !current.loadStages.length) add('current-weapon-join'); }
  if (currentWeaponId === null && saved.normalWeapons.get(victim.typeId)?.size) add('armed-victim-current-weapon-required');
  if (!c.complete) add('complete-authoritative-context-required');
  if (s.lethal) {
    if (type?.status !== 'conditional-human') reasons.push(...type?.reasons ?? ['victim-type']);
    if (!c.standing || !c.dryGround || c.onBridge || c.heightAboveGround !== 0 || c.currentLocomotor !== 'walk' || c.sequence !== 0) add('standing-dry-walk-sequence-zero-required');
    for (const k of ['inTransport', 'attachedEffects', 'spawnManager', 'slaveManager', 'mindControl', 'temporal', 'warping', 'immobilized'] as const) if (c[k]) add(`active-context:${k}`);
    if (c.passengerCount !== 0 || c.driverIndex !== -1) add('passenger-or-driver-context');
    if (selectedVeterancy?.enabled.explodes !== false) add('active-or-unknown-veterancy-explodes');
    if (currentWeaponId !== null) { const f = saved.weapons.get(currentWeaponId)?.fields.suicide;
      if (!f || f.status === 'unsupported' || f.value !== false) add('active-or-unknown-current-weapon-suicide'); }
    if (!warhead || ![1, 2].includes(warhead.fields.infDeath?.value as number)) add('ordinary-InfDeath-one-or-two-required');
  }
  const status = reasons.length ? 'unsupported' as const : !s.lethal ? 'nonlethal' as const : 'ready-ordinary-human' as const;
  const sequence = status === 'ready-ordinary-human' ? (warhead!.fields.infDeath!.value === 1 ? 11 : 12) : null;
  return freeze({ policy: ORDINARY_DEATH_POLICY, planFingerprint: plan.fingerprint, source: plan.source, victim, attacker, attackWeaponId, warheadId,
    status, reasons: [...new Set(reasons)].sort(), sequence, selectedVeterancy, terminal: sequence === null ? null : {
      corpseCandidates: type!.corpse!.candidates, selection: 'one-native-word-modulo-count' as const, removal: 'at-explicit-sequence-completion' as const,
      occupancy: 'release-owned-walk-occupancy' as const, duration: 'caller-WebRA2-tick-policy' as const, accounting: 'victim-owner-attacker-source-event-required' as const },
    excludedWork: ['damage-and-health-transition', 'native-global-rng-order-and-animation-construction', 'world-occupancy-and-scheduling',
      'mission-house-team-accounting', 'native-death-presentation-resource-preparation'], canStartCampaign: false as const });
}
