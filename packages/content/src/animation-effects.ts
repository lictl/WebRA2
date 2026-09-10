// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../ANIMATION_EFFECTS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from './entity-definitions.ts';
import { isWeaponDefinitions, type WeaponDefinitions } from './weapon-definitions.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections, type IniSourceEntry, type IniSourceSection, type IniSourceView } from './ini-source-view.ts';
import type { IniOrigin, RuntimeIni } from './runtime-ini.ts';
import { weaponBoolean, weaponDecimal, weaponInteger } from './weapon-numbers.ts';

export const ANIMATION_EFFECTS_POLICY = 'webra2-animation-effects-1' as const;
export const ANIMATION_EFFECTS_LIMITS = Object.freeze({ stages: 64, occurrences: 262144, animations: 8192,
  roots: 32768, references: 131072, history: 524288, work: 4_194_304, diagnostics: 32768,
  nodes: 2_000_000, characters: 64 * 1024 * 1024, serializedBytes: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof ANIMATION_EFFECTS_LIMITS]: number };
type Scalar = number | boolean | string | readonly number[];
export type AnimationEffectStatus = 'presentation-only' | 'gameplay-active' | 'unknown' | 'unsupported';
export interface AnimationEffectRecord {
  readonly id: string; readonly name: string;
  readonly allocation: Readonly<{ stage: string; phase: 'registry' | 'general' | 'animation-load' | 'weapon-load' | 'warhead-load'; origin: IniOrigin }>;
  /** The initial registry precedes omitted external allocation paths; no complete native array index is claimed. */
  readonly initialRegistrySpelling: boolean;
  readonly references: readonly IniOrigin[]; readonly loadStages: readonly string[];
  readonly fields: Readonly<Record<string, EntityField<Scalar>>>;
  readonly retainedFields: readonly IniOrigin[];
  readonly edges: readonly Readonly<{ field: string; targetId: string; origin: IniOrigin | null }>[];
  readonly localStatus: AnimationEffectStatus; readonly reasons: readonly string[];
}
export interface AnimationEffectRoot {
  readonly id: string; readonly ownerId: string; readonly key: 'Anim' | 'AnimList' | 'WeatherConBoltExplosion';
  readonly context: 'ordinary-firing' | 'ordinary-impact' | 'lightning-warhead-impact';
  readonly animations: EntityField<readonly string[]>;
  readonly status: AnimationEffectStatus; readonly reasons: readonly string[]; readonly reachableIds: readonly string[];
}
export interface AnimationEffects {
  readonly schemaVersion: 1; readonly policy: typeof ANIMATION_EFFECTS_POLICY; readonly profile: RuntimeIni['profile'];
  readonly entityFingerprint: string; readonly weaponFingerprint: string; readonly sources: EntityDefinitions['sources'];
  readonly roots: readonly AnimationEffectRoot[]; readonly animations: readonly AnimationEffectRecord[];
  readonly globals: Readonly<{ dropZoneAnim: EntityField<string>; lightningWarhead: EntityField<string>; weatherConBoltExplosion: EntityField<string> }>;
  readonly diagnostics: readonly Readonly<{ code: string; subjectId: string; origin: IniOrigin | null }>[];
  readonly coverage: Readonly<{ presentationOnlyRoots: number; blockedRoots: number; allocationScope: 'initial-animation-registry-and-scoped-reference-history'; nativeAllocationComplete: false }>;
  readonly excludedContexts: readonly string[]; readonly fingerprint: string;
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
const branded = new WeakSet<object>();
/** Same-module factory identity only; not a JSON loader or source-byte authentication. */
export function isAnimationEffects(value: unknown): value is AnimationEffects { return !!value && typeof value === 'object' && branded.has(value); }
export class AnimationEffectsError extends Error { constructor(readonly code: string) { super(`animation-effects-${code}`); this.name = 'AnimationEffectsError'; } }
const fail = (code: string): never => { throw new AnimationEffectsError(code); };
const fold = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
const field = <T>(value: T | null, status: EntityField<T>['status'] = 'default', rule = 'fresh-native-constructor', origin: IniOrigin | null = null, history: readonly IniOrigin[] = []): EntityField<T> => ({ value, status, rule, origin, history });
function plain(v: unknown): asserts v is Record<string, unknown> { if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('record'); }
function settings(options: Partial<Limits>): Limits {
  plain(options); const cap: Limits = { ...ANIMATION_EFFECTS_LIMITS };
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
type Spec = { key: string; initial: Scalar | null; parse: (s: string) => Scalar | null; yr?: boolean };
const bools = 'Flamer Scorch Crater ForceBigCraters Sticky PsiWarning TiberiumChainReaction IsTiberium IsMeteor IsVeins IsAnimatedTiberium IsFlamingGuy Bouncer'.split(' ');
const specs: readonly Spec[] = [
  { key: 'Damage', initial: 0, parse: weaponDecimal }, ...bools.map(key => ({ key, initial: false, parse: weaponBoolean })),
  ...['SpawnCount', 'DamageRadius', 'TiberiumSpreadRadius', 'TrailerSeperation'].map(key => ({ key, initial: 0, parse: weaponInteger })),
  { key: 'MakeInfantry', initial: -1, parse: weaponInteger, yr: true }, { key: 'NumParticles', initial: 0, parse: weaponInteger, yr: true },
  // A nonempty named particle requires separate particle allocation/effect semantics, so it cannot prove safety.
  { key: 'SpawnsParticle', initial: -1, parse: () => null, yr: true },
  ...['RandomRate', 'RandomLoopDelay'].map(key => ({ key, initial: [0, 0], parse: (s: string): readonly number[] | null => {
    if (s.length > 127 || !/^[+-]?\d+,[+-]?\d+$/.test(s)) return null;
    const values = s.split(',').map(weaponInteger); return values.every(v => v !== null) ? values as number[] : null;
  } })),
];
const chains = ['Next', 'Spawns', 'BounceAnim', 'ExpireAnim', 'TrailerAnim'] as const;
const otherReferences = ['Warhead', 'TiberiumSpawnType'] as const;
// Exact native loader keys with no effect eligibility decision of their own. Their raw text remains retained.
const presentationKeys = new Set('Image Name UIName Shadow Theater NewTheater Layer AltPalette Flat Normalized Translucent Rate Start End LoopStart LoopEnd LoopCount DetailLevel TranslucencyDetailLevel Translucency HideIfNoOre YSortAdjust Elasticity MaxXYVel MinZVel ShouldFogRemove RunningFrames YDrawOffset ZAdjust StartSound Report StopSound Tiled ShouldUseCellDrawer UseNormalLight PingPong Reverse DoubleThick DemandLoad FreeAfterPlaying'.split(' '));
type Mutable = { id: string; name: string; allocation: AnimationEffectRecord['allocation']; initialRegistrySpelling: boolean; references: IniOrigin[];
  loadStages: string[]; fields: Record<string, EntityField<Scalar>>; retainedFields: IniOrigin[]; reasons: Set<string> };
type Root = { id: string; ownerId: string; key: AnimationEffectRoot['key']; context: AnimationEffectRoot['context']; animations: EntityField<readonly string[]>; reasons: Set<string> };

/** Source-only eligibility proof for ordinary weapon animation contexts; it never schedules or executes an effect. */
export function compileAnimationEffects(input: { readonly weapons: WeaponDefinitions; readonly definitions: EntityDefinitions; readonly rules: RuntimeIni; readonly art: RuntimeIni }, options: Partial<Limits> = {}): AnimationEffects {
  const cap = settings(options); plain(input);
  if (Reflect.ownKeys(input).length !== 4 || !['weapons', 'definitions', 'rules', 'art'].every(k => { const d = Object.getOwnPropertyDescriptor(input, k); return d && 'value' in d; })) fail('input');
  const { weapons, definitions, rules, art } = input;
  if (!isWeaponDefinitions(weapons) || !isEntityDefinitions(definitions)) fail('factory');
  if (weapons.entityFingerprint !== definitions.fingerprint) fail('entity-identity');
  for (const table of [rules, art]) { const d = table && typeof table === 'object' ? Object.getOwnPropertyDescriptor(table, 'profile') : null; if (!d || !('value' in d) || d.value !== definitions.profile) fail('profile-source'); }
  const viewOptions = { stages: cap.stages, occurrences: cap.occurrences, nodes: cap.nodes, characters: cap.characters, work: cap.work };
  const rv = createIniSourceView(rules, viewOptions), av = createIniSourceView(art, viewOptions);
  function pins(a: RuntimeIni['layers'], b: RuntimeIni['layers']): void { if (a.length !== b.length || a.some((v, i) => Object.keys(v).some(k => v[k as keyof typeof v] !== b[i]![k as keyof typeof v]))) fail('profile-source'); }
  pins(definitions.sources.rules, rules.layers); pins(weapons.sources, rules.layers); pins(definitions.sources.art, art.layers);
  let work = 0, histories = 0, references = 0;
  const charge = (n = 1): void => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const diagnostics: { code: string; subjectId: string; origin: IniOrigin | null }[] = [];
  function diagnostic(code: string, subjectId: string, origin: IniOrigin | null): void { if (diagnostics.length >= cap.diagnostics) fail('diagnostic-limit'); diagnostics.push({ code, subjectId, origin }); }
  function history(old: readonly IniOrigin[], add: readonly IniOrigin[]): readonly IniOrigin[] { if (old.length + add.length > cap.history - histories) fail('history-limit'); histories += old.length + add.length; return [...old, ...add]; }
  function section(v: IniSourceView, stage: string, name: string): IniSourceSection | undefined { charge(); const matches = findIniSourceSections(v, stage, name); if (matches.length > 1) fail('repeated-consumed-section'); return matches[0]; }
  function entry(s: IniSourceSection | undefined, key: string): IniSourceEntry | undefined { charge(); if (!s) return undefined; const found = findIniSourceEntries(s, key); if (found.length > 1) fail('repeated-consumed-key'); return found[0]; }
  const initial = rv.stages[0], policyReasons: string[] = [];
  if (!initial || !['base', 'expansion'].includes(initial.layer.kind)) policyReasons.push('fresh-initial-rules-stage-unproven');
  if (av.stages.length !== 1) policyReasons.push('multiple-or-missing-global-art-stage');
  const byId = new Map<string, Mutable>(), allocated: Mutable[] = []; let currentStage = initial?.layer.id ?? '';
  function name(value: string): boolean { return value.length <= 24 && /^[\x21-\x7e]+$/.test(value) && !/[,;\[\]=]/.test(value) && !/^<.*>$/.test(value); }
  function allocate(value: string, origin: IniOrigin, phase: Mutable['allocation']['phase'], initialRegistry = false): string | null {
    charge(); if (++references > cap.references) fail('reference-limit');
    if (/^(none|<none>)$/i.test(value)) return null;
    if (!name(value)) { diagnostic('unsupported-reference', 'animation-reference', origin); return null; }
    const id = `animation:${fold(value)}`; let r = byId.get(id);
    if (!r) {
      if (allocated.length >= cap.animations) fail('animation-limit');
      r = { id, name: value, allocation: { stage: currentStage, phase, origin }, initialRegistrySpelling: initialRegistry,
        references: [], loadStages: [], fields: Object.create(null) as Mutable['fields'], retainedFields: [], reasons: new Set() };
      for (const spec of specs) r.fields[spec.key] = spec.yr && rv.profile === 'ra2' ? field<Scalar>(null, 'not-applicable', 'profile-field-not-loaded') : field(spec.initial);
      for (const key of [...chains, ...otherReferences]) r.fields[key] = field<Scalar>(null);
      byId.set(id, r); allocated.push(r);
    } else if (r.name !== value) r.reasons.add('case-variant-allocation');
    if (++histories > cap.history) fail('history-limit'); r.references.push(origin); return id;
  }
  const roots: Root[] = [];
  function root(ownerId: string, key: Root['key'], context: Root['context']): Root { if (roots.length >= cap.roots) fail('root-limit'); const r: Root = { id: `${ownerId}:${key}`, ownerId, key, context, animations: field([]), reasons: new Set() }; roots.push(r); return r; }
  if (weapons.weapons.length + weapons.warheads.length + 1 > cap.roots) fail('root-limit');
  const sourceRecords = [...weapons.weapons, ...weapons.warheads];
  const recordRoots = sourceRecords.map(r => { const out = root(r.id, r.kind === 'weapon' ? 'Anim' : 'AnimList', r.kind === 'weapon' ? 'ordinary-firing' : 'ordinary-impact'); if (r.status === 'unsupported') out.reasons.add('unsupported-owner-definition'); return { record: r, root: out }; });
  const weatherRoot = root('general', 'WeatherConBoltExplosion', 'lightning-warhead-impact');
  const globals = { dropZoneAnim: field<string>(null), lightningWarhead: field<string>(null), weatherConBoltExplosion: field<string>(null) };
  function reference(old: EntityField<Scalar>, e: IniSourceEntry, phase: Mutable['allocation']['phase'], animation: boolean): EntityField<Scalar> {
    const h = history(old.history, [e.origin]); if (!e.value) return { ...old, history: h };
    const clear = /^(none|<none>)$/i.test(e.value), valid = clear || name(e.value);
    const value = clear ? null : valid ? animation ? allocate(e.value, e.origin, phase) : e.value : null;
    return field(value, valid ? 'explicit' : 'unsupported', clear ? 'reference-none' : 'native-current-default-reference', e.origin, h);
  }
  function list(r: Root, e: IniSourceEntry | undefined, phase: Mutable['allocation']['phase']): void {
    if (!e) return;
    const h = history(r.animations.history, [e.origin]); if (!e.value) { r.animations = { ...r.animations, history: h }; return; }
    // Native comma-only strtok and a 128-byte buffer. Longer source remains unsupported, never truncated here.
    if (e.value.length > 127) { r.animations = field<readonly string[]>(null, 'unsupported', 'native-string-truncation', e.origin, h); return; }
    const values: string[] = []; let valid = true;
    for (const token of e.value.split(',')) {
      charge(); if (!token) continue;
      const clear = /^(none|<none>)$/i.test(token); const id = allocate(token, e.origin, phase);
      if (id) values.push(id); else if (!clear) valid = false;
    }
    r.animations = field(valid ? values : null, valid ? 'explicit' : 'unsupported', 'native-comma-list-replaces-on-nonempty', e.origin, h);
  }
  const knownKeys = new Set([...specs.map(s => s.key), ...chains, ...otherReferences, ...presentationKeys]);
  for (const stage of rv.stages) {
    const id = stage.layer.id; currentStage = id; const registry = section(rv, id, 'Animations');
    if (registry) { const keys = new Set<string>(); for (const e of registry.entries) { charge(); if (keys.has(e.key)) fail('repeated-registry-key'); keys.add(e.key); allocate(e.value, e.origin, 'registry', stage === initial); } }
    const general = section(rv, id, 'General');
    // Weather and DropZone precede the animation pass. Other native global allocations are outside this proof.
    for (const [key, property] of [['WeatherConBoltExplosion', 'weatherConBoltExplosion'], ['DropZoneAnim', 'dropZoneAnim'], ['LightningWarhead', 'lightningWarhead']] as const) {
      const e = entry(general, key); if (e) globals[property] = reference(globals[property], e, 'general', key !== 'LightningWarhead') as EntityField<string>;
    }
    for (let index = 0; index < allocated.length; index++) {
      charge(); const r = allocated[index]!;
      if (av.stages.length !== 1) continue;
      charge(); const found = findIniSourceSections(av, av.stages[0]!.layer.id, r.name);
      if (found.length > 1) {
        r.reasons.add('repeated-art-section');
        for (const occurrence of found) for (const e of occurrence.entries) { charge(); if (++histories > cap.history) fail('history-limit'); r.retainedFields.push(e.origin); }
        continue;
      }
      const s = found[0]; if (!s) continue;
      if (++histories > cap.history) fail('history-limit'); r.loadStages.push(id);
      for (const e of s.entries) {
        charge(); if (findIniSourceEntries(s, e.key).length > 1) r.reasons.add('repeated-art-key');
        if (++histories > cap.history) fail('history-limit'); r.retainedFields.push(e.origin);
        if (!knownKeys.has(e.key)) r.reasons.add('unknown-art-field');
      }
      for (const spec of specs) {
        const matches = findIniSourceEntries(s, spec.key); charge(); if (matches.length > 1) continue; const e = matches[0]; if (!e) continue;
        const old = r.fields[spec.key]!, h = history(old.history, [e.origin]);
        if (spec.yr && rv.profile === 'ra2') { r.fields[spec.key] = { ...old, history: h }; continue; }
        if (!e.value) { r.fields[spec.key] = { ...old, history: h }; continue; }
        const value = spec.parse(e.value);
        r.fields[spec.key] = field(value, value === null ? 'unsupported' : 'explicit', 'native-current-default-read', e.origin, h);
      }
      for (const key of [...chains, ...otherReferences]) { charge(); const matches = findIniSourceEntries(s, key), e = matches.length === 1 ? matches[0] : undefined; if (e) r.fields[key] = reference(r.fields[key]!, e, 'animation-load', chains.includes(key as typeof chains[number])); }
    }
    // Existing genuine graph loadStages preserve source/property-phase allocation timing.
    for (const pair of recordRoots) { charge(); if (pair.record.loadStages.includes(id)) list(pair.root, entry(section(rv, id, pair.record.name), pair.root.key), pair.record.kind === 'weapon' ? 'weapon-load' : 'warhead-load'); }
  }
  weatherRoot.animations = { ...globals.weatherConBoltExplosion, value: globals.weatherConBoltExplosion.value ? [globals.weatherConBoltExplosion.value] : globals.weatherConBoltExplosion.value === null && globals.weatherConBoltExplosion.status !== 'unsupported' ? [] : null };
  const records: AnimationEffectRecord[] = allocated.map(r => {
    charge(); const reasons = new Set([...policyReasons, ...r.reasons]); let active = false;
    if (!r.initialRegistrySpelling) reasons.add('initial-registry-spelling-unproven');
    if (!r.loadStages.length) reasons.add('no-loaded-art-section');
    for (const [key, f] of Object.entries(r.fields)) { charge(); if (f.status === 'unsupported') reasons.add(`unsupported-field:${key}`); }
    const value = (k: string) => r.fields[k]!.value;
    if (typeof value('Damage') === 'number' && (value('Damage') as number) > 0) { active = true; reasons.add('positive-damage'); }
    if (typeof value('Damage') === 'number' && (value('Damage') as number) < 0) reasons.add('negative-damage-policy');
    if (rv.profile === 'yr' && value('MakeInfantry') !== -1 && value('MakeInfantry') !== null) { active = true; reasons.add('make-infantry'); }
    for (const key of bools) if (value(key) === true) reasons.add(`effect-or-state-path:${key}`);
    for (const key of ['SpawnCount', 'DamageRadius', 'TiberiumSpreadRadius', 'TrailerSeperation', 'NumParticles']) {
      if (typeof value(key) === 'number' && value(key) !== 0) reasons.add(`conditional-effect-parameter:${key}`);
    }
    for (const key of ['RandomRate', 'RandomLoopDelay']) { const v = value(key); if (Array.isArray(v) && v.some(n => n !== 0)) reasons.add(`scenario-rng-or-timing:${key}`); }
    if (globals.dropZoneAnim.status === 'unsupported') reasons.add('drop-zone-identity-unknown');
    if (globals.dropZoneAnim.value === r.id) { active = true; reasons.add('drop-zone-map-reveal'); }
    const edges = chains.flatMap(key => { const f = r.fields[key]!; return typeof f.value === 'string' ? [{ field: key, targetId: f.value, origin: f.origin }] : []; });
    for (const key of otherReferences) if (value(key) !== null) reasons.add(`external-effect-reference:${key}`);
    const localStatus: AnimationEffectStatus = active ? 'gameplay-active' : reasons.size ? 'unknown' : 'presentation-only';
    return { id: r.id, name: r.name, allocation: r.allocation, initialRegistrySpelling: r.initialRegistrySpelling,
      references: r.references, loadStages: r.loadStages, fields: r.fields, retainedFields: r.retainedFields, edges, localStatus, reasons: [...reasons].sort() };
  });
  const recordsById = new Map(records.map(r => [r.id, r]));
  const outputRoots: AnimationEffectRoot[] = roots.map(r => {
    const reasons = new Set([...policyReasons, ...r.reasons]); let active = false, unsupported = r.animations.status === 'unsupported';
    if (unsupported) reasons.add('unsupported-root-reference');
    const visited = new Set<string>(), visiting = new Set<string>();
    const pending: { id: string; exit: boolean }[] = (r.animations.value ?? []).map(id => ({ id, exit: false })).reverse();
    while (pending.length) {
      charge(); const item = pending.pop()!;
      if (item.exit) { visiting.delete(item.id); continue; }
      if (visiting.has(item.id)) { reasons.add('animation-cycle'); continue; }
      if (visited.has(item.id)) continue;
      visited.add(item.id); visiting.add(item.id); const n = recordsById.get(item.id);
      if (!n) { reasons.add('missing-animation-record'); unsupported = true; continue; }
      for (const reason of n.reasons) { charge(); reasons.add(`${n.id}:${reason}`); }
      if (n.localStatus === 'gameplay-active') active = true;
      charge(n.edges.length); pending.push({ id: item.id, exit: true });
      for (let i = n.edges.length - 1; i >= 0; i--) pending.push({ id: n.edges[i]!.targetId, exit: false });
    }
    return { id: r.id, ownerId: r.ownerId, key: r.key, context: r.context, animations: r.animations,
      status: unsupported ? 'unsupported' : active ? 'gameplay-active' : reasons.size ? 'unknown' : 'presentation-only', reasons: [...reasons].sort(), reachableIds: [...visited].sort() };
  });
  const result = { schemaVersion: 1 as const, policy: ANIMATION_EFFECTS_POLICY, profile: rv.profile, entityFingerprint: definitions.fingerprint,
    weaponFingerprint: weapons.fingerprint, sources: definitions.sources, roots: outputRoots, animations: records, globals, diagnostics,
    coverage: { presentationOnlyRoots: outputRoots.filter(r => r.status === 'presentation-only').length, blockedRoots: outputRoots.filter(r => r.status !== 'presentation-only').length,
      allocationScope: 'initial-animation-registry-and-scoped-reference-history' as const, nativeAllocationComplete: false as const },
    excludedContexts: ['water-height-bridge-splash-selection', 'actor-death-and-InfDeath-sequences', 'attached-or-extra-animation-instance-state', 'ambient-map-and-superweapon-effects', 'sound-engine-rng-and-presentation-scheduling', 'complete-native-allocation-order'],
    nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const out = freeze({ ...result, fingerprint: fingerprint(result, cap.serializedBytes) }); branded.add(out); return out;
}
