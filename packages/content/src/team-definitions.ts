// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded native data compiler; see ../TEAM_DEFINITIONS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from './entity-definitions.ts';
import { compileScenarioObjects, type ScenarioObjects } from './scenario-objects.ts';
import { assembleScenarioDefinitions } from './scenario-construction.ts';
import { compileRuntimeIni, type RuntimeIni, type IniOrigin } from './runtime-ini.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections, type IniSourceView, type IniSourceSection, type IniSourceEntry } from './ini-source-view.ts';
import { teamInteger, teamBoolean, teamWaypoint, teamFold, teamFingerprint, describeTeamScriptOperand, type TeamScriptOperand } from './team-values.ts';

export const TEAM_DEFINITIONS_POLICY = 'webra2-team-definitions-1' as const;
export const TEAM_DEFINITIONS_LIMITS = Object.freeze({ missionBytes: 16 * 1024 * 1024, stages: 64, occurrences: 262144,
  definitions: 8192, lateCountries: 256, declarations: 32768, fields: 524288, references: 131072, history: 262144, tokens: 262144,
  characters: 64 * 1024 * 1024, nodes: 2_000_000, work: 4_194_304, diagnostics: 32768, serializedBytes: 64 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof TEAM_DEFINITIONS_LIMITS]: number };
type Kind = 'team' | 'taskforce' | 'script';
type Phase = 'global-team' | 'mission-team' | 'global-script' | 'mission-script' | 'global-taskforce' | 'mission-taskforce';
type FieldValue = number | boolean | string;
export interface TeamDefinitionReference {
  readonly targetId: string | null; readonly status: 'none' | 'resolved' | 'implicit' | 'first-allocated' | 'missing' | 'unsupported';
  readonly raw: string | null; readonly origin: IniOrigin | null; readonly history: readonly IniOrigin[];
}
export interface TeamOwner {
  readonly countryId: string | null; readonly houseId: string | null; readonly specialSelector: number | null;
  readonly status: 'none' | 'country-house' | 'missing-house' | 'special' | 'unsupported';
}
export interface TeamLoad {
  readonly phase: Phase; readonly layerId: string; readonly sourceSha256: string; readonly declaration: IniOrigin;
  readonly sectionLine: number | null; readonly nativeReturn: boolean | null;
}
interface Base {
  readonly id: string; readonly name: string; readonly kind: Kind; readonly index: number;
  readonly allocation: Readonly<{ phase: Phase; reason: 'registry' | 'team-reference'; origin: IniOrigin }>;
  readonly registrations: readonly IniOrigin[]; readonly loads: readonly TeamLoad[];
  readonly isGlobal: boolean; readonly fields: Readonly<Record<string, EntityField<FieldValue>>>;
  readonly unhandledFields: readonly IniOrigin[];
}
export interface TeamDefinition extends Base {
  readonly kind: 'team'; readonly script: TeamDefinitionReference; readonly taskForce: TeamDefinitionReference;
  readonly tag: TeamDefinitionReference; readonly owner: EntityField<TeamOwner>;
  readonly waypoints: readonly Readonly<{ field: 'waypoint' | 'transportWaypoint'; number: number | null; rowId: string | null; status: 'none' | 'resolved' | 'missing' | 'unsupported' }>[];
  readonly typed: boolean; readonly requiredRuntimeWork: readonly string[];
}
export interface TaskForceMember {
  readonly sourceSlot: number; readonly runtimeIndex: number | null; readonly origin: IniOrigin;
  readonly quantity: number | null; readonly typeName: string | null; readonly typeId: string | null;
  readonly status: 'typed' | 'missing-type' | 'unsupported';
}
export interface TaskForceDefinition extends Base {
  readonly kind: 'taskforce'; readonly members: readonly TaskForceMember[];
  readonly memberLoads: readonly Readonly<{ phase: Phase; layerId: string; sectionLine: number; members: readonly TaskForceMember[] }>[];
  readonly typed: boolean;
}
export interface TeamScriptStep {
  readonly sourceSlot: number; readonly runtimeIndex: number; readonly origin: IniOrigin;
  readonly opcode: number | null; readonly argument: number | null; readonly operand: TeamScriptOperand;
  readonly waypointRowId: string | null; readonly status: 'typed' | 'unsupported';
}
export interface TeamScriptDefinition extends Base {
  readonly kind: 'script'; readonly steps: readonly TeamScriptStep[];
  readonly stepLoads: readonly Readonly<{ phase: Phase; layerId: string; sectionLine: number; steps: readonly TeamScriptStep[] }>[];
  readonly numericFramingComplete: boolean; readonly operandsComplete: boolean; readonly executionReady: false;
}
export interface TeamDiagnostic { readonly code: string; readonly subjectId: string; readonly origin: IniOrigin | null }
export interface TeamDefinitions {
  readonly schemaVersion: 1; readonly policy: typeof TEAM_DEFINITIONS_POLICY; readonly profile: RuntimeIni['profile'];
  readonly source: ScenarioObjects['source']; readonly entityFingerprint: string;
  readonly sources: Readonly<{ rules: RuntimeIni['layers']; ai: RuntimeIni['layers'] }>;
  readonly phases: readonly Readonly<{ phase: Phase; layerId: string; sourceSha256: string; registry: string }>[];
  readonly lateCountryAllocations: readonly Readonly<{ id: string; name: string; index: number; phase: Phase; origin: IniOrigin }>[];
  readonly teams: readonly TeamDefinition[]; readonly taskForces: readonly TaskForceDefinition[]; readonly scripts: readonly TeamScriptDefinition[];
  readonly diagnostics: readonly TeamDiagnostic[];
  readonly coverage: Readonly<{ typedTeams: number; typedTaskForces: number; numericScripts: number; typedOperandScripts: number;
    allocationScope: 'global-and-mission-lists-and-team-references'; nativeAllocationComplete: false }>;
  readonly fingerprint: string; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export class TeamDefinitionsError extends Error { constructor(readonly code: string) { super(`team-${code}`); this.name = 'TeamDefinitionsError'; } }
const fail = (s: string): never => { throw new TeamDefinitionsError(s); };
const brand = new WeakSet<object>();
export const isTeamDefinitions = (v: unknown): v is TeamDefinitions => !!v && typeof v === 'object' && brand.has(v);
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function exact(v: unknown, keys: readonly string[]): asserts v is Record<string, unknown> {
  if (!plain(v) || Reflect.ownKeys(v).length !== keys.length || !keys.every(k => { const d = Object.getOwnPropertyDescriptor(v, k); return d && 'value' in d; })) fail('input');
}
function settings(v: Partial<Limits>): Limits {
  if (!plain(v)) fail('limits'); const cap: Limits = { ...TEAM_DEFINITIONS_LIMITS };
  for (const k of Reflect.ownKeys(v)) { if (typeof k !== 'string' || !Object.hasOwn(cap, k)) fail('limits'); const d = Object.getOwnPropertyDescriptor(v, k)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[k as keyof Limits]) fail('limits'); cap[k as keyof Limits] = d.value; }
  return cap;
}
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
const initial = <T>(value: T | null, rule: string): EntityField<T> => ({ value, status: 'default', rule, origin: null, history: [] });
const identifier = (s: string): boolean => s.length > 0 && s.length <= 24 && /^[A-Za-z0-9_.$@#-]+$/.test(s);
const absent = (s: string): boolean => /^(?:none|<none>)$/i.test(s);
const noReference = (): TeamDefinitionReference => ({ targetId: null, status: 'none', raw: null, origin: null, history: [] });
const registry = { team: 'TeamTypes', script: 'ScriptTypes', taskforce: 'TaskForces' } as const;
const numericDefaults = { group: -1, veteranLevel: 1, priority: 7, max: -1, techLevel: 0, waypoint: -1, transportWaypoint: -1 } as const;
const numericKeys = { group: 'Group', veteranLevel: 'VeteranLevel', priority: 'Priority', max: 'Max', techLevel: 'TechLevel', waypoint: 'Waypoint', transportWaypoint: 'TransportWaypoint', mindControlDecision: 'MindControlDecision' } as const;
const booleanKeys = ['Loadable', 'Full', 'Annoyance', 'GuardSlower', 'Recruiter', 'Autocreate', 'Prebuild', 'Reinforce', 'Whiner', 'Aggressive', 'LooseRecruit', 'Suicide', 'Droppod', 'UseTransportOrigin', 'OnTransOnly', 'AvoidThreats', 'IonImmune', 'TransportsReturnOnUnload', 'AreTeamMembersRecruitable', 'IsBaseDefense', 'OnlyTargetHouseEnemy'] as const;
type MutableBase = { id: string; name: string; kind: Kind; index: number; allocation: Base['allocation']; registrations: IniOrigin[]; loads: TeamLoad[]; isGlobal: boolean;
  fields: Record<string, EntityField<FieldValue>>; unhandledFields: IniOrigin[]; script: TeamDefinitionReference; taskForce: TeamDefinitionReference; tag: TeamDefinitionReference;
  owner: EntityField<TeamOwner>; members: TaskForceMember[]; memberLoads: { phase: Phase; layerId: string; sectionLine: number; members: TaskForceMember[] }[];
  steps: TeamScriptStep[]; stepLoads: { phase: Phase; layerId: string; sectionLine: number; steps: TeamScriptStep[] }[] };

/** Owns and hashes mission bytes; rules/AI pins still require caller-verified source sessions. */
export function compileTeamDefinitions(input: { readonly definitions: EntityDefinitions; readonly rules: RuntimeIni; readonly ai: RuntimeIni;
  readonly mission: { readonly source: ScenarioObjects['source']; readonly bytes: Uint8Array } }, options: Partial<Limits> = {}): TeamDefinitions {
  const cap = settings(options); exact(input, ['definitions', 'rules', 'ai', 'mission']); exact(input.mission, ['source', 'bytes']);
  if (!isEntityDefinitions(input.definitions)) fail('entity-brand');
  const { definitions, rules, ai, mission } = input, profile = definitions.profile;
  exact(mission.source, ['id', 'profile', 'sha256']);
  for (const table of [rules, ai]) { if (!plain(table) || Object.getOwnPropertyDescriptor(table, 'profile')?.value !== profile) fail('profile'); }
  if (mission.source.profile !== profile || mission.source.id !== definitions.source.id || mission.source.sha256 !== definitions.source.sha256) fail('mission-identity');
  const raw = mission.bytes;
  if (!(raw instanceof Uint8Array) || Object.getPrototypeOf(raw) !== Uint8Array.prototype ||
      ['byteLength', 'buffer', 'byteOffset', 'slice'].some(k => Object.hasOwn(raw, k)) ||
      raw.byteLength > cap.missionBytes || !(raw.buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(raw.buffer)) fail('mission-bytes');
  const bytes = new Uint8Array(raw.byteLength); bytes.set(raw);
  const hash = Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== mission.source.sha256) fail('mission-hash');
  const limits = { stages: cap.stages, occurrences: cap.occurrences, characters: cap.characters, nodes: cap.nodes, work: cap.work };
  const rv = createIniSourceView(rules, limits), av = createIniSourceView(ai, limits);
  if (av.stages.length !== 1 || av.stages[0]!.layer.kind === 'map') fail('global-ai-source-count');
  if (teamFingerprint(rules.layers, cap.serializedBytes) !== teamFingerprint(definitions.sources.rules, cap.serializedBytes)) fail('rules-identity');
  const map = rv.stages.at(-1)!;
  if (!map || map.layer.kind !== 'map' || map.layer.sourceSha256 !== hash || rv.stages.length + av.stages.length > cap.stages) fail('mission-stage');
  let occurrences = 0, characters = 0;
  for (const view of [rv, av]) for (const stage of view.stages) for (const section of stage.sections) {
    occurrences += 1 + section.entries.length; characters += section.name.length;
    for (const e of section.entries) characters += e.key.length + e.origin.rawValue.length;
    if (occurrences > cap.occurrences || characters > cap.characters) fail('source-limit');
  }
  const { encoding: _encoding, bytes: _byteCount, ...missionLayer } = map.layer;
  const missionIni = compileRuntimeIni(profile, [{ ...missionLayer, bytes }]);
  const mv = createIniSourceView(missionIni, limits);
  if (teamFingerprint(map, cap.serializedBytes) !== teamFingerprint(mv.stages[0], cap.serializedBytes)) fail('mission-table-mismatch');
  const objects = compileScenarioObjects({ profile, source: { ...mission.source }, bytes });
  const construction = assembleScenarioDefinitions({ objects, rules });
  if (construction.placements.length !== definitions.placements.length || construction.placements.some((p, i) => p.rowId !== definitions.placements[i]!.rowId || p.typeId !== definitions.placements[i]!.typeId || p.owner.houseId !== definitions.placements[i]!.ownerId)) fail('construction-identity');
  const placedRows = new Map(objects.placements.map(p => [p.row.id, p]));
  if (definitions.placements.some(p => placedRows.get(p.rowId)?.strengthRaw !== p.rawStrength)) fail('placement-identity');
  const records = new Map<Kind, Map<string, MutableBase>>([['team', new Map()], ['script', new Map()], ['taskforce', new Map()]]), diagnostics: TeamDiagnostic[] = [];
  const lateCountryAllocations: { id: string; name: string; index: number; phase: Phase; origin: IniOrigin }[] = [];
  let work = 0, declarationCount = 0, history = 0, fieldReads = 0, references = 0, tokens = 0;
  const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const remember = (n = 1) => { if (n > cap.history - history) fail('history-limit'); history += n; };
  const diagnostic = (code: string, subjectId: string, origin: IniOrigin | null = null) => { if (diagnostics.length >= cap.diagnostics) fail('diagnostic-limit'); diagnostics.push({ code, subjectId, origin }); };
  function section(view: IniSourceView, layer: string, name: string): IniSourceSection | undefined {
    charge(); const matches = findIniSourceSections(view, layer, name); if (matches.length > 1) fail('duplicate-section'); return matches[0];
  }
  function entry(s: IniSourceSection, key: string): IniSourceEntry | undefined {
    if (++fieldReads > cap.fields) fail('field-limit'); charge(); const rows = findIniSourceEntries(s, key); if (rows.length > 1) fail('duplicate-key'); return rows[0];
  }
  function allocate(kind: Kind, name: string, phase: Phase, origin: IniOrigin, reason: 'registry' | 'team-reference'): MutableBase {
    charge(); if (!identifier(name) || absent(name)) fail('identifier');
    if (reason === 'registry' && kind !== 'team' && name.length > 23) fail('registry-truncation'); const list = records.get(kind)!, key = teamFold(name), prior = list.get(key); if (prior) return prior;
    if ([...records.values()].reduce((n, m) => n + m.size, 0) + lateCountryAllocations.length >= cap.definitions) fail('definition-limit');
    const fields: Record<string, EntityField<FieldValue>> = Object.create(null);
    if (kind === 'team') { for (const [key, value] of Object.entries(numericDefaults)) fields[key] = initial(value, 'native-constructor');
      if (profile === 'yr') fields.mindControlDecision = initial(0, 'native-constructor');
      for (const key of booleanKeys) fields[key[0]!.toLowerCase() + key.slice(1)] = initial(key === 'AreTeamMembersRecruitable', 'native-constructor');
    } else if (kind === 'taskforce') fields.group = initial(-1, 'native-constructor');
    const r: MutableBase = { id: `${kind}:${key}`, name, kind, index: list.size, allocation: { phase, reason, origin }, registrations: [], loads: [], isGlobal: false,
      fields, unhandledFields: [], script: noReference(), taskForce: noReference(), tag: noReference(), owner: initial({ countryId: null, houseId: null, specialSelector: null, status: 'none' }, 'native-constructor'), members: [], memberLoads: [], steps: [], stepLoads: [] };
    list.set(key, r); return r;
  }
  const typeLookup = new Map<string, string>();
  for (const kind of ['infantry', 'unit', 'aircraft'] as const) for (const d of definitions.definitions) { charge(); if (d.kind === kind && !typeLookup.has(teamFold(d.name))) typeLookup.set(teamFold(d.name), d.id); }
  const waypoints = new Map<number, string>();
  const waypointSection = section(mv, map.layer.id, 'Waypoints');
  if (waypointSection) for (const e of waypointSection.entries) { charge(); if (entry(waypointSection, e.key) !== e) fail('waypoint-entry');
    const n = /^\d+$/.test(e.key) ? Number(e.key) : -1;
    if (!Number.isSafeInteger(n) || n < 0 || waypoints.has(n)) fail('waypoint-alias'); waypoints.set(n, `waypoints:${teamFold(e.key)}`); }
  const tagSection = section(mv, map.layer.id, 'Tags'), tags = new Map<string, string>();
  if (tagSection) for (const e of tagSection.entries) { charge(); entry(tagSection, e.key); const key = teamFold(e.key); if (tags.has(key)) fail('tag-alias'); tags.set(key, `tag:${key}`); }
  const phases: TeamDefinitions['phases'][number][] = [];
  function field<T>(prior: EntityField<T>, e: IniSourceEntry, value: T | null, rule: string): EntityField<T> {
    remember(prior.history.length + 1);
    return { value, status: value === null ? 'unsupported' : 'explicit', rule, origin: e.origin, history: [...prior.history, e.origin] };
  }
  function scalar(r: MutableBase, s: IniSourceSection, key: string, target: string, parse: (s: string) => FieldValue | null): void {
    const e = entry(s, key); if (!e) return;
    const prior = r.fields[target]!;
    if (!e.value) { r.fields[target] = { ...field(prior, e, prior.value, 'empty-retains-current'), status: prior.status }; return; }
    const value = e.value.length <= 127 ? parse(e.value) : null;
    r.fields[target] = field(prior, e, value, value === null ? 'unsupported-narrow-value' : 'native-read-current-default');
    if (value === null) diagnostic('unsupported-value', r.id, e.origin);
  }
  const countries = new Map<string, { id: string; name: string }>(), houseByCountry = new Map<string, typeof construction.houses[number]>();
  for (const c of construction.countries) for (const alias of [c.alias.value, c.name]) { charge(); if (!countries.has(teamFold(alias))) countries.set(teamFold(alias), c); }
  for (const h of construction.houses) { charge(); if (h.country.id && !houseByCountry.has(h.country.id)) houseByCountry.set(h.country.id, h); }
  function loadOwner(r: MutableBase, s: IniSourceSection, phase: Phase): void {
    const e = entry(s, 'House'); if (!e) return;
    if (!e.value) { r.owner = { ...field(r.owner, e, r.owner.value, 'empty-retains-current'), status: r.owner.status }; return; }
    let country = countries.get(teamFold(e.value)); const special = /^<Player @ ([A-H])>$/.exec(e.value), random = teamFold(e.value) === '<random>';
    if (!country && !random && !(profile === 'yr' && special) && e.value.length <= 24 && /^[\x20-\x7e]+$/.test(e.value) && !/[,;\[\]=]/.test(e.value)) {
      if (lateCountryAllocations.length >= cap.lateCountries || [...records.values()].reduce((n, m) => n + m.size, 0) + lateCountryAllocations.length >= cap.definitions) fail('late-country-limit');
      charge(); country = { id: `country:${teamFold(e.value)}`, name: e.value };
      remember(); lateCountryAllocations.push({ ...country, index: construction.countries.length + lateCountryAllocations.length, phase, origin: e.origin }); countries.set(teamFold(e.value), country);
    }
    let value: TeamOwner;
    if (random) value = { countryId: null, houseId: null, specialSelector: -2, status: 'special' };
    else if (profile === 'yr' && special) value = { countryId: null, houseId: null, specialSelector: 4475 + special[1]!.charCodeAt(0) - 65, status: 'special' };
    else if (country) value = { countryId: country.id, houseId: houseByCountry.get(country.id)?.id ?? null, specialSelector: null, status: houseByCountry.has(country.id) ? 'country-house' : 'missing-house' };
    else value = { countryId: null, houseId: null, specialSelector: null, status: 'unsupported' };
    r.owner = field(r.owner, e, value, 'country-then-first-house');
    if (value.status === 'unsupported') { r.owner = { ...r.owner, status: 'unsupported' }; diagnostic('unmodeled-team-country-allocation', r.id, e.origin); }
    if (value.status === 'missing-house') diagnostic('country-has-no-house', r.id, e.origin);
  }
  function reference(r: MutableBase, s: IniSourceSection, key: 'Script' | 'TaskForce' | 'Tag', phase: Phase): void {
    const e = entry(s, key); if (!e) return;
    if (++references > cap.references) fail('reference-limit');
    const target = key === 'Script' ? 'script' : key === 'TaskForce' ? 'taskForce' : 'tag', prior = r[target];
    remember(prior.history.length + 1);
    let targetId = prior.targetId, status = prior.status;
    if (e.value) {
      if (absent(e.value)) { targetId = null; status = 'none'; }
      else if (!identifier(e.value)) { targetId = null; status = 'unsupported'; diagnostic('unsupported-reference', r.id, e.origin); }
      else if (key === 'Tag') { targetId = tags.get(teamFold(e.value)) ?? `tag:${teamFold(e.value)}`; status = tags.has(teamFold(e.value)) ? 'resolved' : 'implicit'; }
      else { const other = allocate(key === 'Script' ? 'script' : 'taskforce', e.value, phase, e.origin, 'team-reference'); targetId = other.id; status = other.loads.length ? 'resolved' : 'implicit'; }
    }
    r[target] = { targetId, status, raw: e.value, origin: e.origin, history: [...prior.history, e.origin] };
  }
  function fallback(r: MutableBase, key: 'script' | 'taskForce'): boolean {
    const ref = r[key]; if (ref.status === 'unsupported') return false; if (ref.targetId) return true;
    const other = records.get(key === 'script' ? 'script' : 'taskforce')!.values().next().value as MutableBase | undefined;
    if (!other) return false;
    r[key] = { ...ref, targetId: other.id, status: 'first-allocated' }; return true;
  }
  function extras(r: MutableBase, s: IniSourceSection, consumed: Set<string>): void {
    for (const e of s.entries) { charge(); entry(s, e.key); if (consumed.has(e.key)) continue;
      remember(); r.unhandledFields.push(e.origin);
      // Name/UIName are retained display/localization inputs, not scheduling properties.
      if (!['Name', 'UIName'].includes(e.key)) diagnostic('unhandled-field', r.id, e.origin);
    }
  }
  function team(r: MutableBase, s: IniSourceSection, phase: Phase): boolean | null {
    loadOwner(r, s, phase);
    for (const [target, key] of Object.entries(numericKeys)) {
      if (target === 'mindControlDecision' && profile === 'ra2') continue;
      scalar(r, s, key, target, target === 'waypoint' || target === 'transportWaypoint' ? teamWaypoint : teamInteger);
    }
    for (const key of booleanKeys) scalar(r, s, key, key[0]!.toLowerCase() + key.slice(1), teamBoolean);
    reference(r, s, 'Tag', phase); reference(r, s, 'Script', phase); reference(r, s, 'TaskForce', phase);
    extras(r, s, new Set([...Object.entries(numericKeys).filter(([k]) => k !== 'mindControlDecision' || profile === 'yr').map(([, v]) => v), ...booleanKeys, 'House', 'Script', 'TaskForce', 'Tag']));
    // The native TaskForce fallback occurs first; an empty array returns before Script fallback.
    if (!fallback(r, 'taskForce')) return r.taskForce.status === 'unsupported' ? null : false;
    if (!fallback(r, 'script')) return r.script.status === 'unsupported' ? null : false;
    return true;
  }
  function tokenBudget(n: number): void { if (n > cap.tokens - tokens) fail('token-limit'); tokens += n; }
  function taskForce(r: MutableBase, s: IniSourceSection, phase: Phase, layerId: string): void {
    const members: TaskForceMember[] = []; let runtimeIndex = 0;
    for (let slot = 0; slot < 6; slot++) {
      const e = entry(s, String(slot)); if (!e || !e.value) continue; tokenBudget(2); charge();
      const match = e.value.length <= 127 ? /^\s*([+-]?\d+)\s*,\s*([^\s,]+)\s*$/.exec(e.value) : null;
      const quantity = match ? teamInteger(match[1]!) : null, typeName = match?.[2] ?? null;
      const typeId = typeName && identifier(typeName) ? typeLookup.get(teamFold(typeName)) ?? null : null;
      const status = quantity === null || quantity < 0 || quantity > 65535 || !typeName || !identifier(typeName) ? 'unsupported' : typeId ? 'typed' : 'missing-type';
      members.push({ sourceSlot: slot, runtimeIndex: typeId ? runtimeIndex++ : null, origin: e.origin, quantity, typeName, typeId, status });
      if (status !== 'typed') diagnostic(status === 'missing-type' ? 'taskforce-missing-type' : 'taskforce-unsupported-member', r.id, e.origin);
    }
    remember(members.length + 1); r.members = members; r.memberLoads.push({ phase, layerId, sectionLine: s.line, members });
    scalar(r, s, 'Group', 'group', teamInteger); extras(r, s, new Set(['Group', '0', '1', '2', '3', '4', '5']));
  }
  function script(r: MutableBase, s: IniSourceSection, phase: Phase, layerId: string): void {
    const rows: { slot: number; e: IniSourceEntry; opcode: number | null; argument: number | null }[] = [];
    for (let slot = 0; slot < 50; slot++) {
      const e = entry(s, String(slot)); if (!e || !e.value) continue; tokenBudget(2); charge();
      const match = e.value.length <= 127 ? /^\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*$/.exec(e.value) : null;
      rows.push({ slot, e, opcode: match ? teamInteger(match[1]!) : null, argument: match ? teamInteger(match[2]!) : null });
    }
    remember(rows.length + 1);
    const steps = rows.map(({ slot, e, opcode, argument }, runtimeIndex): TeamScriptStep => {
      const operand = describeTeamScriptOperand(opcode, argument, rows.length);
      const waypointRowId = operand.kind === 'waypoint' && argument !== null ? waypoints.get(argument) ?? null : null;
      if (operand.kind === 'waypoint' && operand.status === 'typed' && !waypointRowId) diagnostic('script-missing-waypoint', r.id, e.origin);
      if (operand.status !== 'typed') diagnostic('unsupported-script-operand', r.id, e.origin);
      return { sourceSlot: slot, runtimeIndex, origin: e.origin, opcode, argument, operand, waypointRowId, status: operand.status };
    });
    r.steps = steps; r.stepLoads.push({ phase, layerId, sectionLine: s.line, steps });
    extras(r, s, new Set(Array.from({ length: 50 }, (_, i) => String(i))));
  }
  for (const kind of ['team', 'script', 'taskforce'] as const) for (const [scope, view, stage] of [['global', av, av.stages[0]!], ['mission', mv, mv.stages[0]!]] as const) {
    const phase = `${scope}-${kind}` as Phase, layerId = stage.layer.id;
    phases.push({ phase, layerId, sourceSha256: stage.layer.sourceSha256, registry: registry[kind] });
    const list = section(view, layerId, registry[kind]); if (!list) continue;
    if (list.entries.length > cap.declarations - declarationCount) fail('declaration-limit'); declarationCount += list.entries.length;
    for (const e of list.entries) {
      entry(list, e.key); const r = allocate(kind, e.value, phase, e.origin, 'registry'); remember(); r.registrations.push(e.origin);
      const s = section(view, layerId, r.name); let nativeReturn: boolean | null = false;
      if (s) { if (kind === 'team') nativeReturn = team(r, s, phase);
        else { if (kind === 'taskforce') taskForce(r, s, phase, layerId); else script(r, s, phase, layerId); nativeReturn = true; } }
      remember(); r.loads.push({ phase, layerId, sourceSha256: stage.layer.sourceSha256, declaration: e.origin, sectionLine: s?.line ?? null, nativeReturn });
      r.isGlobal = scope === 'global'; if (!s) diagnostic('missing-definition-section', r.id, e.origin);
      if (nativeReturn !== true) diagnostic('native-load-incomplete', r.id, e.origin);
    }
  }
  const successful = (r: MutableBase) => r.loads.some(l => l.nativeReturn === true);
  const handled = (r: MutableBase) => r.unhandledFields.every(o => ['Name', 'UIName'].includes(o.keySpelling));
  const completeReference = (ref: TeamDefinitionReference, kind: 'script' | 'taskforce'): TeamDefinitionReference => {
    if (!ref.targetId || ref.status === 'unsupported' || ref.status === 'first-allocated') return ref;
    const r = records.get(kind)!.get(ref.targetId.slice(ref.targetId.indexOf(':') + 1));
    return { ...ref, status: r && successful(r) ? 'resolved' : 'implicit' };
  };
  const base = (r: MutableBase): Base => ({ id: r.id, name: r.name, kind: r.kind, index: r.index, allocation: r.allocation, registrations: r.registrations, loads: r.loads,
    isGlobal: r.isGlobal, fields: r.fields, unhandledFields: r.unhandledFields });
  const taskForces: TaskForceDefinition[] = [...records.get('taskforce')!.values()].map(r => ({ ...base(r), kind: 'taskforce', members: r.members, memberLoads: r.memberLoads,
    typed: successful(r) && r.members.every(m => m.status === 'typed') && Object.values(r.fields).every(f => f.status !== 'unsupported') }));
  const scripts: TeamScriptDefinition[] = [...records.get('script')!.values()].map(r => ({ ...base(r), kind: 'script', steps: r.steps, stepLoads: r.stepLoads,
    numericFramingComplete: successful(r) && r.steps.every(s => s.opcode !== null && s.argument !== null),
    operandsComplete: successful(r) && r.steps.every(s => s.status === 'typed'), executionReady: false }));
  const teams: TeamDefinition[] = [...records.get('team')!.values()].map(r => {
    const script = completeReference(r.script, 'script'), taskForce = completeReference(r.taskForce, 'taskforce');
    const targets = ([['script', script], ['taskforce', taskForce]] as const).every(([kind, ref]) => {
      const target = ref.targetId ? records.get(kind)!.get(ref.targetId.slice(ref.targetId.indexOf(':') + 1)) : undefined;
      return target !== undefined && successful(target) && !['unsupported', 'implicit', 'missing'].includes(ref.status);
    });
    const waypointRows: TeamDefinition['waypoints'] = (['waypoint', 'transportWaypoint'] as const).map(field => {
      const f = r.fields[field]!, n = typeof f.value === 'number' ? f.value : null, rowId = n === null ? null : waypoints.get(n) ?? null;
      const status = f.status === 'unsupported' ? 'unsupported' : n === -1 ? 'none' : rowId ? 'resolved' : 'missing';
      if (status === 'missing') diagnostic('team-missing-waypoint', r.id, f.origin);
      return { field, number: n, rowId, status };
    });
    return { ...base(r), kind: 'team', script, taskForce, tag: r.tag, owner: r.owner, waypoints: waypointRows,
      typed: successful(r) && handled(r) && targets && r.owner.status !== 'unsupported' && Object.values(r.fields).every(f => f.status !== 'unsupported'),
      requiredRuntimeWork: ['team-instantiation-and-recruitment', 'member-quantity-and-availability', 'script-dispatch-and-completion', 'waypoint-arrival-and-guard-timing', 'team-house-and-tag-lifetime'] };
  });
  diagnostic('external-allocation-paths-unmodeled', 'program');
  const payload = { schemaVersion: 1 as const, policy: TEAM_DEFINITIONS_POLICY, profile, source: { ...mission.source }, entityFingerprint: definitions.fingerprint,
    sources: { rules: rules.layers, ai: ai.layers }, phases, lateCountryAllocations, teams, taskForces, scripts, diagnostics,
    coverage: { typedTeams: teams.filter(r => r.typed).length, typedTaskForces: taskForces.filter(r => r.typed).length, numericScripts: scripts.filter(r => r.numericFramingComplete).length,
      typedOperandScripts: scripts.filter(r => r.operandsComplete).length, allocationScope: 'global-and-mission-lists-and-team-references' as const, nativeAllocationComplete: false as const },
    nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result: TeamDefinitions = freeze({ ...payload, fingerprint: teamFingerprint(payload, cap.serializedBytes) }); brand.add(result); return result;
}
