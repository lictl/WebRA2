// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded native source interpretation; see ../MISSION_TEAM_ALLOCATION_PROVENANCE.md.
import type { RuntimeIni, IniOrigin } from '../../content/src/runtime-ini.ts';
import type { TeamDefinition, TeamDefinitions } from '../../content/src/team-definitions.ts';
import type { MissionTeamActionSource } from './mission-team-action-source.ts';

export const MISSION_TEAM_ALLOCATION_POLICY = 'webra2-fresh-campaign-team-allocation-source-1' as const;
export const MISSION_TEAM_ALLOCATION_LIMITS = Object.freeze({ missionBytes: 16 * 1024 ** 2, stages: 64,
  occurrences: 262144, declarations: 32768, roots: 131072, references: 131072, history: 262144,
  tokens: 524288, diagnostics: 131072, work: 4_194_304, nodes: 2_000_000,
  characters: 64 * 1024 ** 2, serializedBytes: 64 * 1024 ** 2 });
export type MissionTeamAllocationLimits = { -readonly [K in keyof typeof MISSION_TEAM_ALLOCATION_LIMITS]: number };
export interface MissionTeamAllocationInput {
  readonly source: MissionTeamActionSource; readonly rules: RuntimeIni; readonly ai: RuntimeIni;
  readonly mission: Readonly<{ source: TeamDefinitions['source']; bytes: Uint8Array }>;
  readonly initialization: 'fresh-campaign';
}
export interface MissionTeamNativeNameLoad {
  readonly phase: string; readonly layerId: string; readonly sectionLine: number | null;
  readonly origin: IniOrigin | null; readonly before: string | null; readonly after: string | null;
  readonly status: 'explicit' | 'retained' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionTeamNativeName {
  readonly id: string; readonly kind: 'team' | 'script' | 'taskforce'; readonly allocationIndex: number;
  readonly storedId: string; readonly initial: string; readonly value: string | null;
  readonly status: 'supported' | 'unsupported'; readonly loads: readonly MissionTeamNativeNameLoad[];
}
export interface MissionTeamAliasReference {
  readonly id: string; readonly origin: IniOrigin; readonly token: number;
  readonly raw: string; readonly lookup: 'per-entry-id-then-name-ascii-case-insensitive';
  readonly lookupStage: 'after-team-definition-loads';
  readonly status: 'resolved' | 'none' | 'missing' | 'unsupported';
  /** First allocated matching entry wins, even when its Name precedes a later exact ID. */
  readonly targetId: string | null; readonly matchedBy: 'id' | 'name' | null;
  readonly matches: readonly Readonly<{ teamId: string; allocationIndex: number; matchedBy: 'id' | 'name' }>[];
  readonly reasons: readonly string[];
}
export interface MissionTeamAITriggerLoad {
  readonly phase: 'global-ai' | 'mission-ai'; readonly origin: IniOrigin; readonly tokens: readonly string[];
  readonly team1ReferenceId: string; readonly team2ReferenceId: string;
  readonly isGlobal: boolean; readonly isForSkirmish: boolean | null;
  readonly difficulties: readonly (boolean | null)[];
  readonly reasons: readonly string[];
}
export interface MissionTeamAITrigger {
  readonly id: string; readonly storedId: string; readonly allocationIndex: number;
  readonly loads: readonly MissionTeamAITriggerLoad[];
  readonly enables: readonly Readonly<{ origin: IniOrigin; value: boolean | null }>[];
  readonly initialEnabled: boolean | null;
  /** These are initial ConditionMet gates, never lifetime inactivity or allocation permission. */
  readonly initialCondition: 'proven-excluded' | 'conditional' | 'unsupported';
  readonly reasons: readonly string[];
}
export interface MissionTeamAllocationRoot {
  readonly id: string;
  readonly kind: 'explicit-action' | 'ai-trigger' | 'script-18' | 'automatic-template' | 'native-unmodeled';
  readonly origin: IniOrigin | null; readonly instructionId: string | null;
  readonly teamIds: readonly string[]; readonly scriptId: string | null;
  readonly status: 'required' | 'conditional' | 'proven-excluded-initial';
  readonly owner: 'template-default' | 'caller-house-overrides-template' | 'current-team-house' | 'unknown';
  readonly reasons: readonly string[];
}
export interface MissionTeamAllocationDeclaration {
  readonly id: string; readonly kind: MissionTeamNativeName['kind'];
  readonly nativeName: MissionTeamNativeName; readonly sourceDeclarationIndex: number;
  readonly incomingRootIds: readonly string[];
  /** No source row is discarded merely because there is no explicit action edge. */
  readonly reachability: 'required' | 'conditional' | 'unproven';
  readonly owner: TeamDefinition['owner'] | null;
  readonly defaultHouseAvailable: boolean | null;
}
export interface MissionTeamAllocationResolution {
  readonly sourceDiagnosticIndex: number; readonly namespace: string; readonly subjectId: string; readonly code: string;
  readonly status: 'resolved-source-field' | 'required'; readonly rule: 'native-name-load-history' | null;
  readonly origins: readonly IniOrigin[];
}
export interface MissionTeamAllocationSource {
  readonly policy: typeof MISSION_TEAM_ALLOCATION_POLICY; readonly profile: TeamDefinitions['profile'];
  readonly sourceSha256: string; readonly teamsSha256: string; readonly worldContentSha256: string;
  readonly initialization: 'fresh-campaign';
  readonly authentication: Readonly<{ scope: 'owned-mission-and-pinned-upstream-tables';
    upstreamRulesAIBytesRequired: true; rulesSha256: string; aiSha256: string; missionSha256: string }>;
  readonly declarations: readonly MissionTeamAllocationDeclaration[];
  readonly references: readonly MissionTeamAliasReference[]; readonly aiTriggers: readonly MissionTeamAITrigger[];
  readonly roots: readonly MissionTeamAllocationRoot[];
  readonly ignoreGlobalAITriggers: Readonly<{ value: boolean | null; origin: IniOrigin | null; reasons: readonly string[] }>;
  readonly diagnosticResolutions: readonly MissionTeamAllocationResolution[];
  readonly diagnostics: readonly Readonly<{ subjectId: string; code: string; origin: IniOrigin | null }>[];
  readonly sourceDiagnostics: MissionTeamActionSource['diagnostics'];
  readonly retainedDeclarations: MissionTeamActionSource['declarations'];
  readonly tables: Readonly<{ rules: RuntimeIni; ai: RuntimeIni }>;
  readonly nativeAllocationComplete: false; readonly runtimeAuthority: false;
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
  readonly sha256: string;
}

import { sha256 } from '@noble/hashes/sha2.js';
import { compileRuntimeIni } from '../../content/src/runtime-ini.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections, type IniSourceView, type IniSourceSection, type IniSourceEntry } from '../../content/src/ini-source-view.ts';
import { teamBoolean, teamFingerprint, teamFold, teamInteger } from '../../content/src/team-values.ts';
import { isMissionTeamActionSource, missionTeamActionSourceContext } from './mission-team-action-source.ts';
import { missionBindingSourceContext } from './mission-bindings.ts';
import { worldRecord } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';

export class MissionTeamAllocationError extends Error {
  constructor(readonly code: string) { super(`mission-team-allocation-${code}`); this.name = 'MissionTeamAllocationError'; }
}
function fail(code: string): never { throw new MissionTeamAllocationError(code); }
const contexts = new WeakMap<object, MissionTeamActionSource>();
export const isMissionTeamAllocationSource = (v: unknown): v is MissionTeamAllocationSource => !!v && typeof v === 'object' && contexts.has(v);
export function missionTeamAllocationSourceActions(v: MissionTeamAllocationSource): MissionTeamActionSource {
  return contexts.get(v) ?? fail('factory');
}
function limits(input: Partial<MissionTeamAllocationLimits>): MissionTeamAllocationLimits {
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('limits');
  const cap: MissionTeamAllocationLimits = { ...MISSION_TEAM_ALLOCATION_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !d.enumerable || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[key as keyof MissionTeamAllocationLimits]) fail('limits');
    cap[key as keyof MissionTeamAllocationLimits] = d.value;
  }
  return cap;
}
const bytesHex = (b: Uint8Array) => Array.from(sha256(b), n => n.toString(16).padStart(2, '0')).join('');
function ownedBytes(input: unknown, cap: number): Uint8Array {
  if (!input || Object.getPrototypeOf(input) !== Uint8Array.prototype) fail('mission-bytes');
  const proto = Object.getPrototypeOf(Uint8Array.prototype) as object;
  let size: number, buffer: unknown;
  try { size = Object.getOwnPropertyDescriptor(proto, 'byteLength')!.get!.call(input) as number;
    buffer = Object.getOwnPropertyDescriptor(proto, 'buffer')!.get!.call(input); } catch { return fail('mission-bytes'); }
  if (!(buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(buffer) || size < 1 || size > cap) fail('mission-bytes');
  const bytes = new Uint8Array(size); Uint8Array.prototype.set.call(bytes, input as Uint8Array); return bytes;
}
const printable = (s: string, max: number) => s.length > 0 && s.length <= max && /^[\x20-\x7e]+$/.test(s);
const decimal = (s: string): number | null => /^[+-]?\d{1,10}$/.test(s) ? teamInteger(s) : null;
const none = (s: string) => /^(?:none|<none>)$/i.test(s);

/** Source evidence only. Rules/AI byte authentication remains the verified importer's responsibility. */
export function compileMissionTeamAllocationSource(input: MissionTeamAllocationInput,
  lowerLimits: Partial<MissionTeamAllocationLimits> = {}): MissionTeamAllocationSource {
  const cap = limits(lowerLimits), r = worldRecord(input, ['source', 'rules', 'ai', 'mission', 'initialization']);
  if (!isMissionTeamActionSource(r.source)) fail('factory');
  if (r.initialization !== 'fresh-campaign') fail('initialization');
  const source = r.source, c = missionTeamActionSourceContext(source), definitions = c.definitions;
  const mission = worldRecord(r.mission, ['source', 'bytes']), m = worldRecord(mission.source, ['id', 'profile', 'sha256']);
  if (m.id !== source.source.id || m.profile !== source.profile || m.sha256 !== source.source.sha256) fail('mission-identity');
  const bytes = ownedBytes(mission.bytes, cap.missionBytes);
  if (bytesHex(bytes) !== m.sha256) fail('mission-hash');
  let work = 0, nodes = 0, characters = 0, occurrences = 0, histories = 0, tokens = 0;
  const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const remember = (n = 1) => { if (n > cap.history - histories) fail('history-limit'); histories += n; };
  const hash = (v: unknown) => teamFingerprint(v, cap.serializedBytes);
  // Snapshot descriptor values, never later imported property reads. Share aggregate caps across both tables.
  const active = new Set<object>();
  function snapshot(v: unknown, depth = 0): unknown {
    charge(); if (++nodes > cap.nodes || depth > 32) fail('node-limit');
    if (v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v) && !Object.is(v, -0))) return v;
    if (typeof v === 'string') { characters += v.length; if (characters > cap.characters) fail('character-limit'); return v; }
    if (!v || typeof v !== 'object' || active.has(v)) fail('source-shape');
    const array = Array.isArray(v);
    if (Object.getPrototypeOf(v) !== (array ? Array.prototype : Object.prototype) && !(Object.getPrototypeOf(v) === null && !array)) fail('source-shape');
    const keys = Reflect.ownKeys(v); if (keys.length > cap.nodes - nodes) fail('node-limit');
    const length = array ? Object.getOwnPropertyDescriptor(v, 'length')?.value as unknown : 0;
    if (array && (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1)) fail('source-array');
    const out: Record<string, unknown> = array ? [] as unknown as Record<string, unknown> : Object.create(null) as Record<string, unknown>;
    active.add(v);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= (length as number)))) fail('source-key');
      characters += key.length; if (characters > cap.characters) fail('character-limit');
      const d = Object.getOwnPropertyDescriptor(v, key)!;
      if (!d || !('value' in d) || !d.enumerable) fail('source-descriptor'); out[key] = snapshot(d.value, depth + 1);
    }
    active.delete(v); return Object.freeze(out);
  }
  // Profile is checked through descriptors before any imported table traversal.
  for (const table of [r.rules, r.ai]) if (!table || typeof table !== 'object' || Object.getOwnPropertyDescriptor(table, 'profile')?.value !== source.profile) fail('profile');
  const rules = snapshot(r.rules) as RuntimeIni, ai = snapshot(r.ai) as RuntimeIni;
  const sourceLimits = { stages: cap.stages, occurrences: cap.occurrences, nodes: cap.nodes, characters: cap.characters, work: cap.work };
  const rv = createIniSourceView(rules, sourceLimits), av = createIniSourceView(ai, sourceLimits);
  if (rv.stages.length + av.stages.length > cap.stages || av.stages.length !== 1 || av.stages[0]!.layer.kind === 'map') fail('source-stages');
  if (hash(rules.layers) !== hash(definitions.sources.rules) || hash(ai.layers) !== hash(definitions.sources.ai)) fail('source-pins');
  const map = rv.stages.at(-1);
  if (!map || map.layer.kind !== 'map' || map.layer.sourceSha256 !== m.sha256) fail('map-stage');
  const { encoding: _encoding, bytes: _length, ...layer } = map.layer;
  const mv = createIniSourceView(compileRuntimeIni(source.profile, [{ ...layer, bytes }]), sourceLimits);
  if (hash(map) !== hash(mv.stages[0])) fail('owned-map-table');
  const diagnostics: { subjectId: string; code: string; origin: IniOrigin | null }[] = [];
  function diagnostic(subjectId: string, code: string, origin: IniOrigin | null = null): void {
    charge(); if (diagnostics.length >= cap.diagnostics) fail('diagnostic-limit'); diagnostics.push({ subjectId, code, origin });
  }
  for (const view of [rv, av]) for (const stage of view.stages) {
    charge();
    for (const section of stage.sections) {
      charge(1 + section.entries.length); const size = 1 + section.entries.length;
      if (size > cap.occurrences - occurrences) fail('occurrence-limit'); occurrences += size;
    }
    if (stage.layer.encoding !== 'byte-preserving-ascii-compatible') diagnostic(stage.layer.id, 'unsupported-source-encoding');
  }
  function section(view: IniSourceView, layerId: string, name: string): IniSourceSection | undefined {
    charge(); const matches = findIniSourceSections(view, layerId, name);
    if (matches.length > 1) fail('duplicate-consumed-section'); return matches[0];
  }
  function entry(s: IniSourceSection, key: string): IniSourceEntry | undefined {
    charge(); const rows = findIniSourceEntries(s, key); if (rows.length > 1) fail('duplicate-consumed-key'); return rows[0];
  }
  if (definitions.teams.length + definitions.scripts.length + definitions.taskForces.length > cap.declarations) fail('declaration-limit');
  const allDefinitions = [...definitions.teams, ...definitions.scripts, ...definitions.taskForces];
  if (allDefinitions.length > cap.declarations) fail('declaration-limit');
  const names = new Map<string, MissionTeamNativeName>();
  for (const d of allDefinitions) {
    charge(); let value: string | null = d.name;
    const loads: MissionTeamNativeNameLoad[] = [];
    const originHashes = new Set<string>();
    for (const o of d.unhandledFields) { charge(); originHashes.add(hash(o)); }
    for (const l of d.loads) {
      charge(); remember(); const view = l.phase.startsWith('global-') ? av : mv, stage = view.stages[0]!;
      if (stage.layer.id !== l.layerId || stage.layer.sourceSha256 !== l.sourceSha256) fail('name-source-stage');
      const s = section(view, l.layerId, d.name);
      if ((s?.line ?? null) !== l.sectionLine) fail('name-load-identity');
      const e = s ? entry(s, 'Name') : undefined, reasons: string[] = [], before = value;
      if (e) {
        if (!originHashes.has(hash(e.origin))) fail('name-origin-identity');
        if (stage.layer.encoding !== 'byte-preserving-ascii-compatible') reasons.push('unsupported-name-encoding');
        if (!printable(e.value, 48)) reasons.push('empty-nonascii-or-truncated-name');
        if (e.origin.rawValue.includes(';')) reasons.push('name-native-comment-semantics');
        value = reasons.length ? null : e.value;
      }
      loads.push({ phase: l.phase, layerId: l.layerId, sectionLine: l.sectionLine, origin: e?.origin ?? null, before, after: value,
        status: reasons.length ? 'unsupported' : e ? 'explicit' : 'retained', reasons });
      for (const code of reasons) diagnostic(d.id, code, e?.origin ?? null);
    }
    // Histories with an uncertain earlier value remain unsupported even if later overridden.
    names.set(d.id, { id: d.id, kind: d.kind, allocationIndex: d.index, storedId: d.name, initial: d.name, value,
      status: loads.some(l => l.status === 'unsupported') ? 'unsupported' : 'supported', loads });
  }
  const references: MissionTeamAliasReference[] = [], teamNames = definitions.teams.map(t => names.get(t.id)!);
  function alias(id: string, origin: IniOrigin, token: number, raw: string, max: number, nullable: boolean): MissionTeamAliasReference {
    charge(); if (references.length >= cap.references) fail('reference-limit');
    const matches: { teamId: string; allocationIndex: number; matchedBy: 'id' | 'name' }[] = [], reasons: string[] = [];
    if (!printable(raw, max)) reasons.push('unsupported-team-token');
    const absent = nullable && none(raw);
    if (!absent && !reasons.length) for (const n of teamNames) {
      charge(); const idMatch = teamFold(n.storedId) === teamFold(raw), nameMatch = n.value !== null && teamFold(n.value) === teamFold(raw);
      if (n.status !== 'supported') reasons.push('uncertain-name-allocation-order');
      if (idMatch || nameMatch) { remember(); matches.push({ teamId: n.id, allocationIndex: n.allocationIndex, matchedBy: idMatch ? 'id' : 'name' }); }
    }
    const winner = matches[0];
    const ref: MissionTeamAliasReference = { id, origin, token, raw, lookup: 'per-entry-id-then-name-ascii-case-insensitive',
      lookupStage: 'after-team-definition-loads', status: reasons.length ? 'unsupported' : absent ? 'none' : winner ? 'resolved' : 'missing',
      targetId: reasons.length || absent ? null : winner?.teamId ?? null, matchedBy: reasons.length || absent ? null : winner?.matchedBy ?? null,
      matches, reasons: [...new Set(reasons)] };
    references.push(ref); if (ref.status === 'missing') diagnostic(id, 'missing-team-reference', origin);
    for (const code of ref.reasons) diagnostic(id, code, origin); return ref;
  }
  const basic = section(mv, map.layer.id, 'Basic'), ignore = basic ? entry(basic, 'IgnoreGlobalAITriggers') : undefined;
  const ignoreValue = ignore ? teamBoolean(ignore.value) : null;
  const ignoreReasons = ignoreValue === null ? ['missing-or-unsupported-global-ai-suppression'] : [];
  const ignoreGlobalAITriggers = { value: ignoreValue, origin: ignore?.origin ?? null, reasons: ignoreReasons };
  const aiRecords = new Map<string, { id: string; storedId: string; allocationIndex: number; loads: MissionTeamAITriggerLoad[];
    enables: { origin: IniOrigin; value: boolean | null }[]; initialEnabled: boolean | null }>();
  for (const [phase, view, sourceLayer] of [['global-ai', av, av.stages[0]!], ['mission-ai', mv, mv.stages[0]!]] as const) {
    const s = section(view, sourceLayer.layer.id, 'AITriggerTypes'); if (!s) continue;
    const seen = new Set<string>();
    for (const e of s.entries) {
      charge(); entry(s, e.key); const canonical = teamFold(e.key);
      if (seen.has(canonical)) fail('ai-key-alias'); seen.add(canonical);
      if (!printable(e.key, 24) || none(e.key)) fail('ai-identifier');
      let row = aiRecords.get(canonical);
      if (!row) { if (allDefinitions.length + aiRecords.size >= cap.declarations) fail('ai-declaration-limit');
        row = { id: `ai-trigger:${canonical}`, storedId: e.key, allocationIndex: aiRecords.size, loads: [], enables: [], initialEnabled: false }; aiRecords.set(canonical, row); }
      let count = 1; for (const ch of e.value) { charge(); if (ch === ',') count++; }
      if (count > cap.tokens - tokens) fail('token-limit'); tokens += count;
      const parts = e.value.split(',').map(s => s.trim()), reasons: string[] = [];
      if (parts.length !== 18 || parts.some(p => !p.length)) reasons.push('unsupported-ai-row-framing');
      if (!printable(e.value, 511)) reasons.push('unsupported-ai-row-encoding-or-truncation');
      if (e.origin.rawValue.includes(';')) reasons.push('ai-native-comment-semantics');
      if (e.key !== row.storedId) reasons.push('ai-reload-key-spelling');
      const t1 = alias(`${row.id}:${row.loads.length}:team1`, e.origin, 1, parts[1] ?? '', 23, true);
      const t2 = alias(`${row.id}:${row.loads.length}:team2`, e.origin, 14, parts[14] ?? '', 23, true);
      if (t1.status !== 'resolved') reasons.push('unresolved-ai-primary-team');
      if (!['resolved', 'none'].includes(t2.status)) reasons.push('unresolved-ai-secondary-team');
      const integerFlag = (i: number): boolean | null => { const raw = parts[i]; const n = raw === undefined ? null : decimal(raw); return n === null ? null : n !== 0; };
      const isForSkirmish = integerFlag(10), difficulties = [15, 16, 17].map(integerFlag);
      if (isForSkirmish === null || difficulties.some(b => b === null)) reasons.push('unsupported-ai-condition-flags');
      remember(); row.loads.push({ phase, origin: e.origin, tokens: parts, team1ReferenceId: t1.id, team2ReferenceId: t2.id,
        isGlobal: phase === 'global-ai', isForSkirmish, difficulties, reasons });
      if (phase === 'global-ai') row.initialEnabled = true;
    }
  }
  const enables = section(mv, map.layer.id, 'AITriggerTypesEnable');
  if (enables) {
    const seen = new Set<string>();
    for (const e of enables.entries) {
      charge(); entry(enables, e.key); const key = teamFold(e.key); if (seen.has(key)) fail('ai-enable-alias'); seen.add(key);
      const row = aiRecords.get(key), value = teamBoolean(e.value);
      if (!row) { diagnostic(`ai-trigger:${key}`, 'missing-enabled-ai-trigger', e.origin); continue; }
      remember(); row.enables.push({ origin: e.origin, value }); row.initialEnabled = value;
      if (value === null) diagnostic(row.id, 'unsupported-ai-enable-value', e.origin);
    }
  }
  const difficulty = c.bindings.difficulty;
  const aiTriggers: MissionTeamAITrigger[] = [...aiRecords.values()].map(r => {
    const l = r.loads.at(-1)!, reasons = [...l.reasons];
    const excludes = r.initialEnabled === false || (l.isGlobal && ignoreValue === true) || l.difficulties[difficulty] === false;
    if (r.initialEnabled === false) reasons.push('initial-disabled-ai-trigger');
    if (l.isGlobal && ignoreValue === true) reasons.push('initial-global-ai-suppression');
    if (l.difficulties[difficulty] === false) reasons.push('initial-campaign-difficulty-disabled');
    // IsForSkirmish is not a campaign exclusion; no scheduling or later enablement is proved here.
    if (r.initialEnabled === null) reasons.push('initial-ai-enable-unknown');
    if (l.isGlobal && ignoreValue === null) reasons.push(...ignoreReasons);
    return { ...r, initialCondition: l.reasons.length ? 'unsupported' : excludes ? 'proven-excluded' : 'conditional', reasons };
  });
  const roots: MissionTeamAllocationRoot[] = [];
  function root(row: MissionTeamAllocationRoot): void { charge(); if (roots.length >= cap.roots) fail('root-limit'); roots.push(row); }
  for (const a of source.actions) root({ id: `allocation:${a.instructionId}`, kind: 'explicit-action', origin: a.plan.origin,
    instructionId: a.instructionId, teamIds: a.teamId ? [a.teamId] : [], scriptId: null, status: 'required', owner: 'template-default',
    reasons: a.status === 'supported-source' ? ['source-action-occurrence-not-execution'] : a.reasons });
  const referenceById = new Map(references.map(ref => [ref.id, ref]));
  for (const row of aiTriggers) {
    const l = row.loads.at(-1)!, teamIds = [l.team1ReferenceId, l.team2ReferenceId].flatMap(id => { const target = referenceById.get(id)!.targetId; return target ? [target] : []; });
    root({ id: `allocation:${row.id}`, kind: 'ai-trigger', origin: l.origin, instructionId: null, teamIds: [...new Set(teamIds)], scriptId: null,
      status: row.initialCondition === 'proven-excluded' ? 'proven-excluded-initial' : row.initialCondition === 'unsupported' ? 'required' : 'conditional',
      owner: 'caller-house-overrides-template', reasons: [...row.reasons, 'house-ai-scheduling-and-future-transitions-required'] });
  }
  for (const s of definitions.scripts) for (const step of s.steps) if (step.opcode === 18) {
    const target = step.argument !== null && step.argument >= 0 ? definitions.teams[step.argument] : undefined;
    root({ id: `allocation:${s.id}:step:${step.runtimeIndex}`, kind: 'script-18', origin: step.origin, instructionId: null,
      teamIds: target ? [target.id] : [], scriptId: s.id, status: 'required', owner: 'current-team-house',
      reasons: target ? ['script-18-team-replacement-unimplemented'] : ['script-18-team-index-unsupported'] });
  }
  for (const t of definitions.teams) {
    const reasons: string[] = [];
    for (const key of ['autocreate', 'prebuild', 'recruiter']) { const f = t.fields[key];
      if (!f || f.status === 'unsupported' || f.value !== false) reasons.push(`automatic-team-behavior:${key}`); }
    if (reasons.length) root({ id: `allocation:automatic:${t.id}`, kind: 'automatic-template', origin: t.allocation.origin, instructionId: null,
      teamIds: [t.id], scriptId: null, status: 'required', owner: 'unknown', reasons });
  }
  for (const code of ['house-ai-activation-and-runtime-state', 'secondary-team-replacement-callers', 'unmodeled-external-allocation-paths']) {
    root({ id: `allocation:native:${code}`, kind: 'native-unmodeled', origin: null, instructionId: null, teamIds: [], scriptId: null, status: 'required', owner: 'unknown', reasons: [code] });
    diagnostic('program', code);
  }
  if (source.declarations.teams.length + source.declarations.scripts.length + source.declarations.taskForces.length > cap.declarations) fail('declaration-limit');
  const sourceDeclarations = [...source.declarations.teams, ...source.declarations.scripts, ...source.declarations.taskForces];
  if (sourceDeclarations.length > cap.declarations) fail('declaration-limit');
  const sourceIndices = new Map(sourceDeclarations.map((d, i) => [d.id, i]));
  const incoming = new Map<string, string[]>(), teamById = new Map(definitions.teams.map(t => [t.id, t]));
  function edge(target: string, id: string): void { charge(); remember(); const rows = incoming.get(target) ?? []; rows.push(id); incoming.set(target, rows); }
  for (const r of roots) for (const id of r.teamIds) {
    edge(id, r.id); const t = teamById.get(id);
    if (t?.script.targetId) edge(t.script.targetId, r.id); if (t?.taskForce.targetId) edge(t.taskForce.targetId, r.id);
  }
  const { houses } = missionBindingSourceContext(c.bindings), houseIds = new Set(houses.map(h => h.id));
  const rootById = new Map(roots.map(r => [r.id, r]));
  const declarations: MissionTeamAllocationDeclaration[] = allDefinitions.map(d => {
    const sourceDeclarationIndex = sourceIndices.get(d.id); if (sourceDeclarationIndex === undefined) fail('declaration-identity');
    const incomingRootIds = [...new Set(incoming.get(d.id) ?? [])], owner = d.kind === 'team' ? d.owner : null;
    return { id: d.id, kind: d.kind, sourceDeclarationIndex, nativeName: names.get(d.id)!, incomingRootIds,
      reachability: incomingRootIds.some(id => rootById.get(id)!.status === 'required') ? 'required' : incomingRootIds.length ? 'conditional' : 'unproven',
      owner, defaultHouseAvailable: owner?.value?.houseId ? houseIds.has(owner.value.houseId) : owner ? false : null };
  });
  const declarationById = new Map(declarations.map(d => [d.id, d]));
  const diagnosticResolutions: MissionTeamAllocationResolution[] = source.diagnostics.map((d, sourceDiagnosticIndex) => {
    charge(); const n = declarationById.get(d.subjectId)?.nativeName;
    const resolved = ['team', 'script', 'taskforce'].includes(d.namespace) && d.code === 'unhandled-field:Name' && n?.status === 'supported';
    const origins = resolved ? n.loads.flatMap(l => l.origin ? [l.origin] : []) : [];
    return { sourceDiagnosticIndex, namespace: d.namespace, subjectId: d.subjectId, code: d.code, status: resolved && origins.length ? 'resolved-source-field' : 'required',
      rule: resolved && origins.length ? 'native-name-load-history' : null, origins };
  });
  // Keep source event team references too; no event execution or allocation is inferred from them.
  for (const row of c.logic.events) for (const e of row.instructions) if (e.discriminator === 1) alias(`event-reference:${e.id}`, row.row.entry.selected,
    e.tokenStart + 2, e.parameters.at(-1) ?? '', 255, false);
  const data = { policy: MISSION_TEAM_ALLOCATION_POLICY, profile: source.profile, sourceSha256: source.sha256,
    teamsSha256: definitions.fingerprint, worldContentSha256: c.world.sha256, initialization: 'fresh-campaign' as const,
    authentication: { scope: 'owned-mission-and-pinned-upstream-tables' as const, upstreamRulesAIBytesRequired: true as const,
      rulesSha256: hash(rules), aiSha256: hash(ai), missionSha256: source.source.sha256 },
    declarations, references, aiTriggers, roots, ignoreGlobalAITriggers, diagnosticResolutions, diagnostics,
    sourceDiagnostics: source.diagnostics, retainedDeclarations: source.declarations, tables: { rules, ai },
    nativeAllocationComplete: false as const, runtimeAuthority: false as const, nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result = freeze({ ...data, sha256: hash(data) }); contexts.set(result, source); return result;
}
