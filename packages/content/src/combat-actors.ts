// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded native initialization compiler; see ../COMBAT_ACTORS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from './entity-definitions.ts';
import { compileScenarioObjects, type ScenarioObjects, type ScenarioPlacement } from './scenario-objects.ts';
import { assembleScenarioDefinitions, type ConstructionHouse } from './scenario-construction.ts';
import { compileRuntimeIni, type RuntimeIni, type IniOrigin } from './runtime-ini.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections, type IniSourceSection, type IniSourceEntry } from './ini-source-view.ts';
import { weaponBoolean, weaponInteger } from './weapon-numbers.ts';
import { combatActorFingerprint as fingerprint } from './combat-actor-values.ts';

export const COMBAT_ACTORS_POLICY = 'webra2-combat-actors-1' as const;
export const COMBAT_ACTORS_LIMITS = Object.freeze({ missionBytes: 16 * 1024 * 1024, stages: 64, occurrences: 262144,
  types: 16384, placements: 32768, houses: 256, fields: 1_048_576, history: 524288, rawFields: 524288,
  tokens: 32768, pairs: 65536, diagnostics: 32768, characters: 64 * 1024 * 1024, nodes: 2_000_000,
  work: 4_194_304, serializedBytes: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof COMBAT_ACTORS_LIMITS]: number };
export interface CombatActorFields {
  readonly initialAmmo: EntityField<number>; readonly ammo: EntityField<number>;
  readonly immune: EntityField<boolean>; readonly typeImmune: EntityField<boolean>;
  readonly turretCount: EntityField<number>; readonly weaponCount: EntityField<number>;
  readonly clearAllWeapons: EntityField<boolean>; readonly gunner: EntityField<boolean>;
  readonly isChargeTurret: EntityField<boolean>; readonly isGattling: EntityField<boolean>;
}
export interface CombatActorDefinition {
  readonly id: string; readonly name: string; readonly kind: ScenarioPlacement['kind'];
  readonly fields: CombatActorFields; readonly startingAmmo: EntityField<number>;
  readonly normalSlots: Readonly<{ mode: 'ordinary' | 'conditional' | 'cleared' | 'unsupported' | 'not-applicable'; reasons: readonly string[] }>;
  /** Every source field loaded for this type, including modifiers interpreted by other components or still unknown. */
  readonly rawFields: readonly IniOrigin[];
}
export interface InitialHouseAlliance {
  readonly houseId: string; readonly houseIndex: number; readonly name: string;
  readonly declaration: ConstructionHouse['declaration']; readonly countryId: string | null;
  readonly allies: EntityField<number>;
  /** Comma tokens are not case-folded or individually trimmed. Unknown tokens never establish hostility. */
  readonly tokens: readonly Readonly<{ raw: string; houseId: string | null; houseIndex: number | null; status: 'resolved' | 'unknown' | 'unsupported' }>[];
  readonly targetHouseIds: readonly string[]; readonly status: 'typed' | 'unsupported';
  readonly rawFields: readonly IniOrigin[];
}
export interface CombatActors {
  readonly schemaVersion: 1; readonly policy: typeof COMBAT_ACTORS_POLICY; readonly profile: RuntimeIni['profile'];
  readonly source: ScenarioObjects['source']; readonly sources: RuntimeIni['layers']; readonly entityFingerprint: string;
  readonly definitions: readonly CombatActorDefinition[];
  readonly placements: readonly Readonly<{ rowId: string; typeId: string | null; ownerId: string | null; ownerIndex: number | null;
    rawStrength: number | null; initialHealth: EntityField<number>; sourcePlacement: ScenarioPlacement }>[];
  readonly houses: readonly InitialHouseAlliance[];
  /** Non-self, directed pairs only, usable only when initialAlliancesComplete is true. */
  readonly directedAllies: readonly Readonly<{ houseId: string; allyHouseId: string; houseIndex: number; allyHouseIndex: number }>[];
  readonly diagnostics: readonly Readonly<{ code: string; subjectId: string; field: string; origin: IniOrigin | null }>[];
  readonly coverage: Readonly<{ identityComplete: boolean; initialAlliancesComplete: boolean; ordinaryTypes: number;
    conditionalTypes: number; unsupportedStartingAmmo: number; allianceScope: 'fresh-campaign-map-house-initialization' }>;
  readonly requiredRuntimeWork: readonly string[]; readonly fingerprint: string;
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export class CombatActorsError extends Error { constructor(readonly code: string) { super(`combat-actors-${code}`); this.name = 'CombatActorsError'; } }
const fail = (s: string): never => { throw new CombatActorsError(s); };
const brand = new WeakSet<object>();
/** Factory identity only; not a JSON loader or authentication of caller-supplied rules bytes. */
export const isCombatActors = (v: unknown): v is CombatActors => !!v && typeof v === 'object' && brand.has(v);
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function exact(v: unknown, keys: readonly string[]): asserts v is Record<string, unknown> {
  if (!plain(v) || Reflect.ownKeys(v).length !== keys.length || !keys.every(k => { const d = Object.getOwnPropertyDescriptor(v, k); return d && 'value' in d; })) fail('input');
}
function settings(v: Partial<Limits>): Limits {
  if (!plain(v)) fail('limits'); const cap: Limits = { ...COMBAT_ACTORS_LIMITS };
  for (const k of Reflect.ownKeys(v)) { if (typeof k !== 'string' || !Object.hasOwn(cap, k)) fail('limits'); const d = Object.getOwnPropertyDescriptor(v, k)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[k as keyof Limits]) fail('limits'); cap[k as keyof Limits] = d.value; }
  return cap;
}
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const initial = <T>(value: T | null, rule = 'native-constructor', status: EntityField<T>['status'] = 'default'): EntityField<T> => ({ value, status, rule, origin: null, history: [] });
type FieldName = keyof CombatActorFields;
const specs: readonly Readonly<{ name: FieldName; key: string; value: number | boolean | null; techno?: boolean; yr?: boolean }>[] = [
  { name: 'immune', key: 'Immune', value: false }, { name: 'initialAmmo', key: 'InitialAmmo', value: -1, techno: true },
  { name: 'ammo', key: 'Ammo', value: -1, techno: true }, { name: 'typeImmune', key: 'TypeImmune', value: false, techno: true },
  { name: 'turretCount', key: 'TurretCount', value: 0, techno: true }, { name: 'weaponCount', key: 'WeaponCount', value: null, techno: true },
  { name: 'clearAllWeapons', key: 'ClearAllWeapons', value: false, techno: true }, { name: 'gunner', key: 'Gunner', value: false, techno: true },
  { name: 'isChargeTurret', key: 'IsChargeTurret', value: false, techno: true }, { name: 'isGattling', key: 'IsGattling', value: false, techno: true, yr: true },
];

/** Owns and authenticates mission bytes; ordered rules pins still require caller-verified source sessions. */
export function compileCombatActors(input: { readonly definitions: EntityDefinitions; readonly rules: RuntimeIni;
  readonly mission: { readonly source: ScenarioObjects['source']; readonly bytes: Uint8Array } }, options: Partial<Limits> = {}): CombatActors {
  const cap = settings(options); exact(input, ['definitions', 'rules', 'mission']); exact(input.mission, ['source', 'bytes']);
  if (!isEntityDefinitions(input.definitions)) fail('entity-brand');
  const { definitions, rules, mission } = input, profile = definitions.profile;
  exact(mission.source, ['id', 'profile', 'sha256']);
  if (!plain(rules) || Object.getOwnPropertyDescriptor(rules, 'profile')?.value !== profile) fail('profile');
  if (mission.source.profile !== profile || mission.source.id !== definitions.source.id || mission.source.sha256 !== definitions.source.sha256) fail('mission-identity');
  if (definitions.definitions.length > cap.types || definitions.placements.length > cap.placements) fail('definition-limit');
  const raw = mission.bytes;
  if (!(raw instanceof Uint8Array) || Object.getPrototypeOf(raw) !== Uint8Array.prototype ||
      ['byteLength', 'buffer', 'byteOffset', 'slice'].some(k => Object.hasOwn(raw, k)) || raw.byteLength > cap.missionBytes ||
      !(raw.buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(raw.buffer)) fail('mission-bytes');
  const bytes = new Uint8Array(raw.byteLength); bytes.set(raw);
  const hash = Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== mission.source.sha256) fail('mission-hash');
  const limits = { stages: cap.stages, occurrences: cap.occurrences, characters: cap.characters, nodes: cap.nodes, work: cap.work };
  const rv = createIniSourceView(rules, limits);
  if (fingerprint(rules.layers, cap.serializedBytes) !== fingerprint(definitions.sources.rules, cap.serializedBytes)) fail('rules-identity');
  const map = rv.stages.at(-1)!;
  if (!map || map.layer.kind !== 'map' || map.layer.sourceSha256 !== hash) fail('mission-stage');
  const { encoding: _encoding, bytes: _byteCount, ...missionLayer } = map.layer;
  const mv = createIniSourceView(compileRuntimeIni(profile, [{ ...missionLayer, bytes }]), limits);
  if (fingerprint(map, cap.serializedBytes) !== fingerprint(mv.stages[0], cap.serializedBytes)) fail('mission-table-mismatch');
  const objects = compileScenarioObjects({ profile, source: { ...mission.source }, bytes }, { objects: cap.placements, houses: cap.houses });
  const construction = assembleScenarioDefinitions({ objects, rules }, { houses: cap.houses, placements: cap.placements, nodes: cap.nodes, characters: cap.characters });
  if (construction.registries.reduce((n, r) => n + r.entries.length, 0) > cap.types) fail('type-limit');
  const types = construction.registries.flatMap(r => r.entries), byDefinition = new Map(definitions.definitions.map(d => [d.id, d]));
  if (types.length !== definitions.definitions.length || types.some(t => { const d = byDefinition.get(t.id); return !d || d.name !== t.name || d.kind !== t.kind; })) fail('type-identity');
  if (construction.placements.length !== definitions.placements.length || construction.placements.some((p, i) => p.rowId !== definitions.placements[i]!.rowId || p.typeId !== definitions.placements[i]!.typeId || p.owner.houseId !== definitions.placements[i]!.ownerId)) fail('construction-identity');
  const placedRows = new Map(objects.placements.map(p => [p.row.id, p]));
  if (definitions.placements.some(p => placedRows.get(p.rowId)?.strengthRaw !== p.rawStrength)) fail('placement-identity');
  let work = 0, fields = 0, history = 0, rawFields = 0, tokenCount = 0, pairs = 0;
  const diagnostics: { code: string; subjectId: string; field: string; origin: IniOrigin | null }[] = [];
  const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const remember = (n: number) => { if (n > cap.history - history) fail('history-limit'); history += n; };
  const diagnostic = (code: string, subjectId: string, field: string, origin: IniOrigin | null = null) => { if (diagnostics.length >= cap.diagnostics) fail('diagnostic-limit'); diagnostics.push({ code, subjectId, field, origin }); };
  function section(layer: string, name: string): IniSourceSection | undefined {
    charge(); const found = findIniSourceSections(rv, layer, name); if (found.length > 1) fail('duplicate-section'); return found[0];
  }
  function read(s: IniSourceSection | undefined, key: string): IniSourceEntry | undefined {
    charge(); if (++fields > cap.fields) fail('field-limit'); if (!s) return undefined;
    const found = findIniSourceEntries(s, key); if (found.length > 1) fail('duplicate-key'); return found[0];
  }
  function retain(s: IniSourceSection, list: IniOrigin[]): void {
    if (s.entries.length > cap.rawFields - rawFields) fail('raw-field-limit'); rawFields += s.entries.length; charge(s.entries.length);
    for (const e of s.entries) list.push(e.origin);
  }
  function apply<T extends number | boolean>(old: EntityField<T>, e: IniSourceEntry | undefined, numeric: boolean, id: string, key: string): EntityField<T> {
    if (!e) return old; remember(old.history.length + 1); const history = [...old.history, e.origin];
    if (!e.value) return { ...old, history };
    const value = e.value.length <= 127 ? (numeric ? weaponInteger(e.value) : weaponBoolean(e.value)) : null;
    if (value === null) { diagnostic('unsupported-value', id, key, e.origin); return { value: null, status: 'unsupported', rule: 'unsupported-native-parser-input', origin: e.origin, history }; }
    return { value: value as T, status: 'explicit', rule: 'native-read-current-default', origin: e.origin, history };
  }
  const output: CombatActorDefinition[] = [];
  for (const type of types) {
    charge(); const techno = ['infantry', 'unit', 'aircraft', 'structure'].includes(type.kind);
    const f = Object.create(null) as Record<FieldName, EntityField<number | boolean>>;
    for (const spec of specs) f[spec.name] = spec.techno && !techno ? initial<number | boolean>(null, 'type-family', 'not-applicable') :
      spec.yr && profile === 'ra2' ? initial(false, 'not-in-ra2', 'not-applicable') :
      spec.value === null ? initial<number | boolean>(null, 'weapon-count-default-unverified', 'unsupported') : initial(spec.value);
    if (type.kind === 'smudge') f.immune = initial(true, 'native-smudge-constructor');
    const origins: IniOrigin[] = [];
    for (const stage of type.definitionStages) {
      const s = section(stage.layerId, type.name); if (!s) return fail('definition-stage'); retain(s, origins);
      for (const spec of specs) if ((!spec.techno || techno) && (!spec.yr || profile === 'yr'))
        f[spec.name] = apply(f[spec.name], read(s, spec.key), spec.value === null || typeof spec.value === 'number', type.id, spec.key);
    }
    let startingAmmo: EntityField<number> = initial<number>(null, 'type-family', 'not-applicable');
    if (techno) {
      const candidate = f.initialAmmo.value === -1 ? f.ammo : f.initialAmmo;
      remember(candidate.history.length);
      const supported = typeof candidate.value === 'number' && candidate.value >= -1;
      startingAmmo = { value: supported ? candidate.value as number : null, status: supported ? 'derived' : 'unsupported',
        rule: f.initialAmmo.value === -1 ? 'initial-ammo-minus-one-selects-ammo' : 'initial-ammo-direct-no-clamp', origin: candidate.origin, history: [...candidate.history] };
      if (!supported) diagnostic('unsupported-starting-ammo', type.id, 'startingAmmo', candidate.origin);
    }
    const reasons: string[] = [];
    for (const name of ['turretCount', 'clearAllWeapons', 'gunner', 'isChargeTurret', 'isGattling'] as const) {
      const value = f[name]; if (value.status === 'unsupported') reasons.push(`unknown-${name}`);
      else if (name === 'turretCount' ? (value.value as number) > 0 : value.value === true) reasons.push(name);
    }
    const unsupported = reasons.some(r => r.startsWith('unknown-'));
    // ClearAllWeapons clears only normal/elite slots 0 and 1. Indexed slots 2+
    // and conditional selectors still require consumer capability rejection.
    const conditional = reasons.some(r => r !== 'clearAllWeapons');
    const mode = !techno ? 'not-applicable' : unsupported ? 'unsupported' : conditional ? 'conditional' : f.clearAllWeapons.value === true ? 'cleared' : 'ordinary';
    output.push({ id: type.id, name: type.name, kind: type.kind, fields: f as unknown as CombatActorFields, startingAmmo,
      normalSlots: { mode, reasons }, rawFields: origins });
  }
  const houseByName = new Map(construction.houses.map(h => [h.name, h]));
  const houses: InitialHouseAlliance[] = [], directedAllies: CombatActors['directedAllies'][number][] = [];
  for (const h of construction.houses) {
    charge(); const s = section(map.layer.id, h.name), e = read(s, 'Allies'), origins: IniOrigin[] = [];
    if (s) retain(s, origins);
    let supported = construction.identityComplete && h.allocation === 'map-list' && construction.houses.length <= 32;
    const tokens: InitialHouseAlliance['tokens'][number][] = []; let mask = 0;
    if (e?.value) {
      if (e.value.length > 127 || /[^\x20-\x7e]/.test(e.value)) { supported = false; diagnostic('unsupported-alliance-string', h.id, 'Allies', e.origin); }
      else {
        let start = 0;
        for (let i = 0; i <= e.value.length; i++) if (i === e.value.length || e.value[i] === ',') {
          if (i > start) {
            if (++tokenCount > cap.tokens) fail('token-limit'); charge(); const raw = e.value.slice(start, i), target = houseByName.get(raw);
            const status = !target ? 'unknown' : target.index >= 32 ? 'unsupported' : 'resolved';
            tokens.push({ raw, houseId: target?.id ?? null, houseIndex: target?.index ?? null, status });
            if (status !== 'resolved') { supported = false; diagnostic('unsupported-alliance-target', h.id, 'Allies', e.origin); }
            else mask = (mask | (1 << target!.index)) >>> 0;
          }
          start = i + 1;
        }
      }
    }
    if (!supported) diagnostic('unsupported-initial-alliance', h.id, 'Allies', e?.origin ?? h.declaration?.origin ?? null);
    const targets: string[] = [];
    if (supported) for (const target of construction.houses) {
      if (++pairs > cap.pairs) fail('pair-limit'); charge();
      if (target.id !== h.id && ((mask >>> target.index) & 1)) {
        targets.push(target.id); directedAllies.push({ houseId: h.id, allyHouseId: target.id, houseIndex: h.index, allyHouseIndex: target.index });
      }
    }
    if (e) remember(1);
    houses.push({ houseId: h.id, houseIndex: h.index, name: h.name, declaration: h.declaration, countryId: h.country.id,
      allies: { value: supported ? mask : null, status: !supported ? 'unsupported' : e?.value ? 'explicit' : 'default',
        rule: 'fresh-campaign-comma-exact-house-mask', origin: e?.origin ?? null, history: e ? [e.origin] : [] },
      tokens, targetHouseIds: targets, status: supported ? 'typed' : 'unsupported', rawFields: origins });
  }
  const placements = definitions.placements.map((p, i) => ({ ...p, ownerIndex: construction.placements[i]!.owner.houseIndex, sourcePlacement: placedRows.get(p.rowId)! }));
  const payload = { schemaVersion: 1 as const, policy: COMBAT_ACTORS_POLICY, profile, source: { ...mission.source }, sources: rv.stages.map(s => s.layer), entityFingerprint: definitions.fingerprint,
    definitions: output, placements, houses, directedAllies, diagnostics,
    coverage: { identityComplete: construction.identityComplete, initialAlliancesComplete: construction.identityComplete && houses.every(h => h.status === 'typed'),
      ordinaryTypes: output.filter(d => d.normalSlots.mode === 'ordinary').length, conditionalTypes: output.filter(d => d.normalSlots.mode === 'conditional').length,
      unsupportedStartingAmmo: output.filter(d => d.startingAmmo.status === 'unsupported').length, allianceScope: 'fresh-campaign-map-house-initialization' as const },
    requiredRuntimeWork: ['ammo-consumption-rearm-and-reload', 'conditional-numbered-elite-and-gunner-selection', 'type-immunity-damage-filter',
      'dynamic-diplomacy-and-noncampaign-initialization', 'remaining-actor-modifiers-and-placement-state'], nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result = freeze({ ...payload, fingerprint: fingerprint(payload, cap.serializedBytes) }); brand.add(result); return result;
}
