// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound native action operand compiler. See ../TEAM_ACTIVATION_PROVENANCE.md.
import { INITIAL_WAYPOINT_LIMITS, compileInitialWaypointSource, resolveInitialWaypoint } from './initial-waypoints.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { isTeamDefinitions, type TeamDefinitions } from './team-definitions.ts';
import { isEntityDefinitions, type EntityDefinitions } from './entity-definitions.ts';
import { compileScenarioLogic } from './scenario-logic.ts';
import { compileScenarioObjects, type ScenarioObjects } from './scenario-objects.ts';
import { createIniSourceView, findIniSourceSections } from './ini-source-view.ts';
import { compileRuntimeIni, type RuntimeIni, type IniOrigin } from './runtime-ini.ts';
import { teamFingerprint, teamFold, teamWaypoint } from './team-values.ts';

export const TEAM_ACTIVATION_POLICY = 'webra2-team-activation-source-1' as const;
export const TEAM_ACTIVATION_LIMITS = Object.freeze({ missionBytes: 16 * 1024 ** 2, actions: 8192,
  tokens: 262144, characters: 16 * 1024 ** 2, work: 524288, serializedBytes: 32 * 1024 ** 2 });
type Limits = { -readonly [K in keyof typeof TEAM_ACTIVATION_LIMITS]: number };
export interface TeamActivationPlan {
  readonly id: string; readonly rowId: string; readonly ordinal: number; readonly opcode: 4 | 7 | 80;
  readonly origin: IniOrigin; readonly rawTokens: readonly string[];
  readonly branch: 'create-team' | 'reinforce'; readonly teamId: string | null;
  readonly teamOperand: Readonly<{ raw: string; mode: number | null; lookup: 'literal' | 'physical-index' | 'none' | 'unsupported'; candidateIndex: number | null }>;
  readonly waypoint: Readonly<{ kind: 'team' | 'action' | 'none'; number: number | null; rowId: string | null; x: number | null; y: number | null }>;
  readonly status: 'supported-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface TeamActivationSource {
  readonly policy: typeof TEAM_ACTIVATION_POLICY; readonly profile: 'ra2' | 'yr'; readonly source: ScenarioObjects['source'];
  readonly initialWaypointsSha256: string; readonly teamsSha256: string; readonly entitiesSha256: string; readonly rulesSources: RuntimeIni['layers'];
  readonly plans: readonly TeamActivationPlan[]; readonly sha256: string;
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export class TeamActivationError extends Error { constructor(readonly code: string) { super(`team-activation-${code}`); this.name = 'TeamActivationError'; } }
export function teamActivationFail(code: string): never { throw new TeamActivationError(code); }
export function teamActivationFreeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) {
  for (const child of Object.values(v)) teamActivationFreeze(child); Object.freeze(v); } return v; }
export function teamActivationRecord(v: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Reflect.ownKeys(v).length !== keys.length) teamActivationFail('input');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(v, key); if (!d || !('value' in d) || !d.enumerable) teamActivationFail('input'); }
  return v as Record<string, unknown>;
}
function settings(v: Partial<Limits>): Limits {
  if (!v || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) teamActivationFail('limits');
  const cap: Limits = { ...TEAM_ACTIVATION_LIMITS };
  for (const key of Reflect.ownKeys(v)) { if (typeof key !== 'string' || !Object.hasOwn(cap, key)) teamActivationFail('limits');
    const d = Object.getOwnPropertyDescriptor(v, key)!;
    if (!('value' in d) || !d.enumerable || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[key as keyof Limits]) teamActivationFail('limits');
    cap[key as keyof Limits] = d.value;
  } return cap;
}
const brand = new WeakMap<object, TeamDefinitions>();
export const isTeamActivationSource = (v: unknown): v is TeamActivationSource => !!v && typeof v === 'object' && brand.has(v);
export function teamActivationDefinitions(source: TeamActivationSource): TeamDefinitions { const t = brand.get(source); if (!t) teamActivationFail('source-brand'); return t; }
/** CRT atoi suffix/overflow cases are deliberately excluded. No INI hex syntax applies to these CSV operands. */
const decimal = (s: string): number | null => {
  if (!/^[+-]?\d{1,10}$/.test(s)) return null; const n = Number(s);
  return Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647 ? n || 0 : null;
};

/** Native branch/operand evidence only. Reinforcement execution and placement policy belong to the spawn catalog/runtime. */
export function compileTeamActivationSource(input: { readonly teams: TeamDefinitions; readonly definitions: EntityDefinitions;
  readonly rules: RuntimeIni; readonly mission: { readonly source: ScenarioObjects['source']; readonly bytes: Uint8Array } }, lowerLimits: Partial<Limits> = {}): TeamActivationSource {
  const r = teamActivationRecord(input, ['teams', 'definitions', 'rules', 'mission']), cap = settings(lowerLimits);
  if (!isTeamDefinitions(r.teams) || !isEntityDefinitions(r.definitions)) teamActivationFail('source-brand');
  const teams = r.teams, definitions = r.definitions;
  const mission = teamActivationRecord(r.mission, ['source', 'bytes']), source = teamActivationRecord(mission.source, ['id', 'profile', 'sha256']);
  if (teams.entityFingerprint !== definitions.fingerprint || teams.profile !== definitions.profile ||
    source.id !== teams.source.id || source.profile !== teams.profile || source.sha256 !== teams.source.sha256 ||
    source.id !== definitions.source.id || source.sha256 !== definitions.source.sha256) teamActivationFail('source-identity');
  const rules = r.rules as RuntimeIni;
  const view = createIniSourceView(rules, { work: cap.work, occurrences: cap.tokens, characters: cap.characters });
  if (rules.profile !== teams.profile || teamFingerprint(rules.layers, cap.serializedBytes) !== teamFingerprint(teams.sources.rules, cap.serializedBytes) ||
    teamFingerprint(rules.layers, cap.serializedBytes) !== teamFingerprint(definitions.sources.rules, cap.serializedBytes)) teamActivationFail('rules-identity');
  const raw = mission.bytes;
  if (!raw || Object.getPrototypeOf(raw) !== Uint8Array.prototype) teamActivationFail('mission-bytes');
  const proto = Object.getPrototypeOf(Uint8Array.prototype) as object;
  const size = Object.getOwnPropertyDescriptor(proto, 'byteLength')!.get!.call(raw) as number;
  const buffer: unknown = Object.getOwnPropertyDescriptor(proto, 'buffer')!.get!.call(raw);
  if (!(buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(buffer) || size < 1 || size > cap.missionBytes) teamActivationFail('mission-bytes');
  const bytes = new Uint8Array(size); Uint8Array.prototype.set.call(bytes, raw as Uint8Array);
  const digest = Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== source.sha256) teamActivationFail('mission-hash');
  const logic = compileScenarioLogic({ profile: teams.profile, source: teams.source, bytes },
    { inputBytes: cap.missionBytes, records: cap.actions, tokens: cap.tokens, retainedCharacters: cap.characters });
  const objects = compileScenarioObjects({ profile: teams.profile, source: teams.source, bytes });
  const map = view.stages.at(-1);
  if (!map || map.layer.kind !== 'map' || map.layer.sourceSha256 !== digest) teamActivationFail('mission-table');
  const { encoding: _encoding, bytes: _size, ...layer } = map.layer;
  const mapView = createIniSourceView(compileRuntimeIni(teams.profile, [{ ...layer, bytes }]));
  if (teamFingerprint(map.sections, cap.serializedBytes) !== teamFingerprint(mapView.stages[0]!.sections, cap.serializedBytes)) teamActivationFail('mission-table');
  const origins = new Map(mapView.stages[0]!.sections.flatMap(s => s.entries.map(e => [e.origin.line, e.origin] as const))); 
  const sections = findIniSourceSections(mapView, mapView.stages[0]!.layer.id, 'Actions');
  if (sections.length > 1) teamActivationFail('duplicate-actions-section');
  const waypointSections = findIniSourceSections(mapView, mapView.stages[0]!.layer.id, 'Waypoints');
  if (waypointSections.length > 1) teamActivationFail('duplicate-waypoints-section');
  const byName = new Map(teams.teams.map(t => [teamFold(t.name), t])), byNumber = new Map(objects.waypoints.map(w => [w.number, w]));
  const initialWaypoints = compileInitialWaypointSource({ profile: teams.profile, source: teams.source, bytes }, { bytes: cap.missionBytes, work: Math.min(cap.work, INITIAL_WAYPOINT_LIMITS.work) });
  const plans: TeamActivationPlan[] = []; let work = 0;
  const charge = (n = 1) => { if (n > cap.work - work) teamActivationFail('work-limit'); work += n; };
  charge(teams.teams.length + objects.waypoints.length);
  for (const row of logic.actions) for (const a of row.instructions) {
    charge(); if (a.opcode !== 4 && a.opcode !== 7 && a.opcode !== 80) continue;
    if (plans.length >= cap.actions) teamActivationFail('action-limit');
    const reasons = new Set<string>(), add = (s: string) => reasons.add(s), selectedOrigin = row.row.entry.selected;
    const origin = origins.get(selectedOrigin.line);
    if (!origin || origin.rawValue !== selectedOrigin.rawValue || origin.sectionSpelling !== selectedOrigin.sectionSpelling || origin.keySpelling !== selectedOrigin.keySpelling) teamActivationFail('action-origin');
    if (origin.sectionSpelling !== 'Actions' || !sections.length) add('exact-actions-section');
    const mode = decimal(a.parameters[0]!), name = row.row.tokens[a.tokenStart + 2]!;
    let lookup: TeamActivationPlan['teamOperand']['lookup'] = 'unsupported', candidateIndex: number | null = null;
    let team: TeamDefinitions['teams'][number] | undefined;
    if (mode !== 1 && mode !== 5) add('team-operand-mode');
    else if (decimal(name) === -1) { lookup = 'none'; add('null-team'); }
    else if (name.length < 3) {
      candidateIndex = decimal(name); lookup = candidateIndex !== null && candidateIndex >= 0 ? 'physical-index' : 'unsupported';
      // Native uses the physical array index. TeamDefinitions explicitly does not prove all external allocations.
      add('physical-team-allocation-order');
    } else if (/^[A-Za-z0-9_.$@#-]{3,24}$/.test(name)) {
      lookup = 'literal'; team = byName.get(teamFold(name)); if (!team) add('implicit-team-allocation');
    } else add('team-reference-syntax');
    if (mode === 5) add('team-mode-five-final-field'); // It stores an integer in Value, not the ordinary waypoint field.
    for (const token of a.parameters.slice(2, 6)) if (decimal(token) === null) add('unused-bounds-syntax');
    const target = a.opcode === 80 ? teamWaypoint(row.row.tokens[a.tokenStart + 7]!) : a.opcode === 7 ? team?.fields.waypoint?.value : null;
    const number = typeof target === 'number' && Number.isInteger(target) && target >= 0 && target <= 701 ? target : null;
    const wp = number === null ? undefined : byNumber.get(number);
    if (a.opcode === 4) add('native-recruitment-unimplemented');
    else { const resolved = resolveInitialWaypoint(initialWaypoints, number ?? -1);
      if (resolved.status !== 'supported-source') { add('reinforcement-waypoint'); for (const reason of resolved.reasons) add(`waypoint:${reason}`); }
      else if (resolved.waypoint.row.id !== wp?.row.id) add('reinforcement-waypoint');
    }
    if (team && !team.typed) add('team-definition');
    plans.push({ id: a.id, rowId: row.row.id, ordinal: a.ordinal, opcode: a.opcode, origin,
      rawTokens: row.row.tokens.slice(a.tokenStart, a.tokenStart + a.tokenCount), branch: a.opcode === 4 ? 'create-team' : 'reinforce',
      teamId: team?.id ?? null, teamOperand: { raw: name, mode, lookup, candidateIndex },
      waypoint: { kind: a.opcode === 4 ? 'none' : a.opcode === 7 ? 'team' : 'action', number,
        rowId: wp?.row.id ?? null, x: wp?.x ?? null, y: wp?.y ?? null },
      status: reasons.size ? 'unsupported' : 'supported-source', reasons: [...reasons].sort() });
  }
  const data = { policy: TEAM_ACTIVATION_POLICY, profile: teams.profile, source: teams.source, teamsSha256: teams.fingerprint,
    entitiesSha256: definitions.fingerprint, initialWaypointsSha256: initialWaypoints.sha256, rulesSources: rules.layers, plans, nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result = teamActivationFreeze({ ...data, sha256: teamFingerprint(data, cap.serializedBytes) }); brand.set(result, teams); return result;
}
