// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original interpreter; see ../MISSION_LOGIC_PROVENANCE.md.
import type { ContentIdentity } from '../../contracts/src/index.ts';
import type { ScenarioLogic } from '../../content/src/scenario-logic.ts';
import { isMissionCueCatalog, missionCueInstruction, missionCueSourceParameters, type MissionCueCatalog } from '../../content/src/mission-cues.ts';
import { isMissionCellEntrySource, missionCellEntrySourceBindings, type MissionCellEntrySource } from './mission-cell-entry-source.ts';
import { isMissionObjectEventSource, missionObjectEventSourceBindings, type MissionObjectEventSource, type MissionObjectEventOpcode } from './mission-object-event-source.ts';
import { isMissionTeamActionSource, missionTeamActionSourceContext, type MissionTeamActionSource } from './mission-team-action-source.ts';
import { canonicalHash, canonicalText, parseJson } from './canonical.ts';
import { identity as contentIdentity } from './validation.ts';
import type { Digest } from './types.ts';

export const MISSION_LOGIC_POLICY = 'webra2-mission-poll-2' as const;
export const MISSION_CUE_DISPATCH_POLICY = 'webra2-source-cue-dispatch-1' as const;
export const MISSION_CELL_ENTRY_DISPATCH_POLICY = 'webra2-source-cell-entry-dispatch-1' as const;
export const MISSION_OBJECT_EVENT_DISPATCH_POLICY = 'webra2-source-object-event-dispatch-1' as const;
export const MISSION_TEAM_ACTION_DISPATCH_POLICY = 'webra2-source-team-action-dispatch-1' as const;
export const MISSION_TIMING_POLICY = 'yr-static-15-frame-1' as const;
export const MISSION_LOGIC_LIMITS = Object.freeze({ triggers: 1024, tags: 1024, instructions: 8192,
  eventsPerTrigger: 32, actionsPerTrigger: 128, bindings: 256, instances: 2048, attachments: 1024,
  inputs: 1024, cellEntries: 8192, objectEvents: 8192, futureTicks: 10000, stepTicks: 1024, work: 131072, effects: 32768, actionFrames: 256,
  replayTicks: 10000, replayWork: 1048576, admissions: 1024, checkpoints: 1024, tick: 1000000000 });
const C = MISSION_LOGIC_LIMITS;
type Predicate = { id: string; opcode: number; argument: number };
type Action = { id: string; opcode: number; argument: number; target: string | null };
type Trigger = { id: string; attached: string | null; enabled: boolean; difficulty: boolean[];
  elapsedFrames: number | null; events: Predicate[]; actions: Action[] };
type Tag = { id: string; mode: number; chain: string[] };
export interface MissionDiagnostic { readonly code: string; readonly id: string }
export interface MissionCoverage {
  readonly namespace: 'event' | 'action'; readonly opcode: number;
  readonly occurrences: number; readonly supported: number; readonly effectOnly: boolean;
}
export interface MissionProgramOptions {
  readonly contentIdentity: ContentIdentity; readonly difficulty: 0 | 1 | 2;
  readonly timingPolicy: typeof MISSION_TIMING_POLICY;
}
export interface MissionProgram {
  readonly schemaVersion: 1; readonly policy: typeof MISSION_LOGIC_POLICY;
  readonly timingPolicy: typeof MISSION_TIMING_POLICY; readonly difficulty: number;
  readonly contentIdentity: ContentIdentity; readonly source: { readonly id: string; readonly profile: string; readonly sha256: string };
  readonly cueCatalogSha256?: string; readonly cellEntrySourceSha256?: string; readonly objectEventSourceSha256?: string;
  readonly teamActionSourceSha256?: string;
  readonly sha256: string; readonly triggers: readonly Trigger[]; readonly tags: readonly Tag[];
  readonly canStartCampaign: false; readonly nativeBehaviorVerified: false;
}
export interface MissionCompilation {
  readonly policy: typeof MISSION_LOGIC_POLICY; readonly timingPolicy: typeof MISSION_TIMING_POLICY;
  readonly source: MissionProgram['source']; readonly contentIdentity: ContentIdentity; readonly difficulty: number;
  readonly program: MissionProgram | null; readonly canExecuteTriggerSubset: boolean;
  readonly canStartCampaign: false; readonly nativeBehaviorVerified: false;
  readonly coverage: readonly MissionCoverage[]; readonly diagnostics: readonly MissionDiagnostic[];
}
export class MissionLogicError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'MissionLogicError'; }
}
function fail(code: string): never { throw new MissionLogicError(code); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('mission-object');
  return value as Record<string, unknown>;
}
function field(value: unknown, key: string): unknown {
  const d = Object.getOwnPropertyDescriptor(record(value), key);
  if (!d || !('value' in d)) fail('mission-field'); return d.value;
}
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  const r = record(value); if (Reflect.ownKeys(r).length !== keys.length) fail('mission-fields');
  for (const k of keys) field(r, k); return r;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) fail('mission-array-limit');
  if (Reflect.ownKeys(value).length !== value.length + 1) fail('mission-array');
  for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d)) fail('mission-array'); }
  return value;
}
function integer(value: unknown, min: number = 0, max: number = C.tick): number {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < min || (value as number) > max) fail('mission-integer');
  return value as number;
}
function text(value: unknown, max = 255): string {
  if (typeof value !== 'string' || !value.length || value.length > max || /[\x00-\x1f\x7f]/.test(value)) fail('mission-string'); return value;
}
function bool(value: unknown): boolean { if (typeof value !== 'boolean') fail('mission-boolean'); return value; }
const fold = (s: string) => s.replace(/[A-Z]/g, c => c.toLowerCase());
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const clone = <T>(value: T): T => JSON.parse(canonicalText(value)) as T;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value;
}
function digestString(v: unknown): string { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) fail('mission-hash'); return v; }
const programs = new WeakSet<object>();
const programCues = new WeakMap<MissionProgram, MissionCueCatalog>();
const programCells = new WeakMap<MissionProgram, MissionCellEntrySource>();
const programObjects = new WeakMap<MissionProgram, MissionObjectEventSource>();
const programTeams = new WeakMap<MissionProgram, MissionTeamActionSource>();
export function missionProgramTeamActions(value: MissionProgram): MissionTeamActionSource | null { program(value); return programTeams.get(value) ?? null; }
export function missionProgramObjectEvents(value: MissionProgram): MissionObjectEventSource | null { program(value); return programObjects.get(value) ?? null; }
export function missionProgramCellEntry(value: MissionProgram): MissionCellEntrySource | null { program(value); return programCells.get(value) ?? null; }
export function missionProgramCues(value: MissionProgram): MissionCueCatalog | null { program(value); return programCues.get(value) ?? null; }
const cueCodes = new Set([11, 48, 55]);
function program(value: MissionProgram): void { if (!programs.has(value)) fail('mission-program'); }
const eventCodes = new Set([0, 8, 13, 14, 27, 28, 36, 37, 47]);
const objectEventCodes = new Set([6, 7, 44, 48]);
const teamActionCodes = new Set([4, 7, 80]);
const actionCodes = new Set([0, 1, 2, 12, 22, 23, 24, 25, 26, 27, 28, 29, 53, 54, 56, 57]);
function numberToken(value: string, min: number, max: number): number | null {
  if (!/^-?(?:0|[1-9][0-9]{0,9})$/.test(value)) return null;
  const n = Number(value); return Number.isSafeInteger(n) && !Object.is(n, -0) && n >= min && n <= max ? n : null;
}

/** Accepts compiler data, not retail execution closure. Caller authenticates its source/content identities. */
export async function compileMissionProgram(logic: ScenarioLogic, options: MissionProgramOptions, digest: Digest, cues?: MissionCueCatalog, cells?: MissionCellEntrySource, objects?: MissionObjectEventSource, teams?: MissionTeamActionSource): Promise<MissionCompilation> {
  // Select data through descriptors before any await. Do not clone the compiler's full retained INI/raw payload.
  const config = exact(clone(options), ['contentIdentity', 'difficulty', 'timingPolicy']);
  const content = contentIdentity(config.contentIdentity), difficulty = integer(config.difficulty, 0, 2);
  if (config.timingPolicy !== MISSION_TIMING_POLICY || field(logic, 'policy') !== 'webra2-logic-1' || field(logic, 'schemaVersion') !== 1 || field(logic, 'newINIFormat') !== 4) fail('mission-version');
  if (field(logic, 'profile') !== content.profile) fail('mission-profile');
  const inputSource = field(logic, 'source');
  const source = { id: text(field(inputSource, 'id')), profile: text(field(inputSource, 'profile')), sha256: digestString(field(inputSource, 'sha256')) };
  if (source.profile !== content.profile) fail('mission-profile');
  if (cues !== undefined && (!isMissionCueCatalog(cues) || cues.profile !== source.profile || cues.source.sha256 !== source.sha256)) fail('mission-cue-source');
  if (cells !== undefined && (!isMissionCellEntrySource(cells) || cells.profile !== source.profile ||
    missionCellEntrySourceBindings(cells).source.sha256 !== source.sha256)) fail('mission-cell-source');
  if (objects !== undefined && (!isMissionObjectEventSource(objects) || objects.profile !== source.profile ||
    missionObjectEventSourceBindings(objects).source.sha256 !== source.sha256)) fail('mission-object-source');
  if (teams !== undefined && (!isMissionTeamActionSource(teams) || teams.profile !== source.profile ||
    teams.source.id !== source.id || teams.source.sha256 !== source.sha256)) fail('mission-team-source');
  const teamContext = teams ? missionTeamActionSourceContext(teams) : null;
  const teamActions = new Map(teams?.actions.map(a => [a.instructionId, a])), selectedTeams = new Set<string>();
  const cellEvents = new Map(cells?.events.map(e => [e.instructionId, e]));
  const objectEvents = new Map(objects?.events.map(e => [e.instructionId, e]));
  const selectedObjects = new Set<string>();
  const selectedCells = new Set<string>();
  const selectedCues = new Set<string>();
  const diagnostics: MissionDiagnostic[] = [], coverage = new Map<string, { namespace: 'event' | 'action'; opcode: number; occurrences: number; supported: number; effectOnly: boolean }>();
  function diagnostic(code: string, id: string) { if (diagnostics.length >= C.instructions + C.triggers * 8) fail('mission-diagnostic-limit'); diagnostics.push({ code, id }); }
  const triggerRows = list(field(logic, 'triggers'), C.triggers), tagRows = list(field(logic, 'tags'), C.tags);
  let count = 0; const instructionIds = new Set<string>();
  type Row = { id: string; values: { id: string; opcode: number; parameters: string[] }[] };
  function counted(key: 'events' | 'actions'): Row[] {
    const namespace = key === 'events' ? 'event' : 'action';
    return list(field(logic, key), C.triggers).map(r => {
      const id = text(field(r, 'id')), values = list(field(r, 'instructions'), key === 'events' ? C.eventsPerTrigger : C.actionsPerTrigger);
      if (values.length > C.instructions - count) fail('mission-instruction-limit'); count += values.length;
      return { id, values: values.map((v, ordinal) => {
        const iid = text(field(v, 'id'), 512), opcode = integer(field(v, 'opcode'), 0, 0xffffffff);
        if (instructionIds.has(iid)) fail('mission-instruction-id'); instructionIds.add(iid);
        if (field(v, 'ordinal') !== ordinal) fail('mission-instruction-order');
        const parameters = list(field(v, 'parameters'), 7).map(p => text(p, 4096));
        if (field(v, 'tokenCount') !== parameters.length + 1 || (key === 'events' && field(v, 'discriminator') !== Number(parameters[0]))) fail('mission-framing');
        const ckey = `${namespace}:${opcode}`;
        let c = coverage.get(ckey); if (!c) { c = { namespace, opcode, occurrences: 0, supported: 0, effectOnly: namespace === 'action' && (opcode === 1 || opcode === 2 || (cues !== undefined && cueCodes.has(opcode)) || (teams !== undefined && teamActionCodes.has(opcode))) }; coverage.set(ckey, c); }
        c.occurrences++; return { id: iid, opcode, parameters };
      }) };
    });
  }
  const eventRows = counted('events'), actionRows = counted('actions');
  const makeMap = <T extends { id: string }>(rows: T[]) => { const m = new Map<string, T>(); for (const r of rows) { if (m.has(r.id) || r.id !== fold(r.id)) fail('mission-duplicate-id'); m.set(r.id, r); } return m; };
  const events = makeMap(eventRows), actions = makeMap(actionRows);
  function flag(raw: unknown, id: string): boolean { if (raw !== '0' && raw !== '1') diagnostic('unsupported-trigger-flag', id); return raw === '1'; }
  const triggers: Trigger[] = triggerRows.map(row => {
    const id = text(field(row, 'id')); if (!id.startsWith('trigger:')) fail('mission-trigger-id');
    const rawAttachment = field(row, 'attachedTrigger');
    const attachedRaw = rawAttachment === '' ? '' : text(rawAttachment), attached = !attachedRaw || fold(attachedRaw) === '<none>' ? null : `trigger:${fold(attachedRaw)}`;
    const enabled = !flag(field(row, 'disabledRaw'), id), levels = ['easyRaw', 'mediumRaw', 'hardRaw'].map(k => flag(field(row, k), id));
    if (field(row, 'tailRaw') !== '0') diagnostic('unsupported-transfer-tail', id);
    const eventRow = events.get(`event-row:${id.slice(8)}`), actionRow = actions.get(`action-row:${id.slice(8)}`);
    if (!eventRow || !actionRow) diagnostic('missing-instruction-row', id);
    function accepted(namespace: 'event' | 'action', opcode: number) { coverage.get(`${namespace}:${opcode}`)!.supported++; }
    const predicates: Predicate[] = [];
    for (const e of eventRow?.values ?? []) {
      const p = e.parameters;
      if (objects && objectEventCodes.has(e.opcode)) {
        selectedObjects.add(e.id); const reference = objectEvents.get(e.id);
        if (!reference || reference.triggerId !== id || reference.opcode !== e.opcode || reference.status !== 'supported' || canonicalText(reference.parameters) !== canonicalText(p)) {
          diagnostic('unsupported-object-event-source', e.id); continue;
        }
        const n = p.length === 2 && p[0] === '0' ? numberToken(p[1]!, -0x80000000, 0x7fffffff) : null;
        if (n === null) { diagnostic('unsupported-event-operands', e.id); continue; }
        predicates.push({ id: e.id, opcode: e.opcode, argument: n }); accepted('event', e.opcode); continue;
      }
      if (cells && e.opcode === 1) {
        selectedCells.add(e.id); const reference = cellEvents.get(e.id);
        if (!reference || reference.triggerId !== id || reference.status !== 'supported' || canonicalText(reference.parameters) !== canonicalText(p)) {
          diagnostic('unsupported-cell-entry-source', e.id); continue;
        }
        const n = p.length === 2 && p[0] === '0' ? numberToken(p[1]!, -1, 0x7fffffff) : null;
        if (n === null) { diagnostic('unsupported-event-operands', e.id); continue; }
        predicates.push({ id: e.id, opcode: e.opcode, argument: n }); accepted('event', e.opcode); continue;
      }
      if (!eventCodes.has(e.opcode)) { diagnostic('unsupported-event-opcode', e.id); continue; }
      let max = 0x7fffffff, min = -0x80000000;
      if ([13, 47].includes(e.opcode)) { min = 0; max = Math.floor(C.tick / 15); }
      if ([27, 28, 36, 37].includes(e.opcode)) { min = 0; max = e.opcode < 36 ? 49 : 99; }
      const n = p.length === 2 && p[0] === '0' ? numberToken(p[1]!, min, max) : null;
      if (n === null) { diagnostic('unsupported-event-operands', e.id); continue; }
      predicates.push({ id: e.id, opcode: e.opcode, argument: n }); accepted('event', e.opcode);
    }
    const effects: Action[] = [];
    for (const a of actionRow?.values ?? []) {
      const p = a.parameters;
      if (teams && teamActionCodes.has(a.opcode)) {
        const selected = teamActions.get(a.id); selectedTeams.add(a.id);
        if (!selected || selected.triggerId !== id || selected.opcode !== a.opcode || selected.status !== 'supported-source' ||
          canonicalText(selected.parameters) !== canonicalText(p)) { diagnostic('unsupported-action-team-source', a.id); continue; }
        effects.push({ id: a.id, opcode: a.opcode, argument: 0, target: null }); accepted('action', a.opcode); continue;
      }
      if (cues) {
        const reference = missionCueInstruction(cues, a.id), operands = missionCueSourceParameters(cues, a.id);
        if (reference) {
          selectedCues.add(a.id);
          if (reference.triggerId !== id || reference.opcode !== a.opcode || !operands || canonicalText(operands) !== canonicalText(p)) {
            diagnostic('unsupported-action-cue', a.id); continue;
          }
        }
      }
      if (cues !== undefined && cueCodes.has(a.opcode)) {
        const cue = missionCueInstruction(cues, a.id), operands = missionCueSourceParameters(cues, a.id);
        if (!cue || cue.triggerId !== id || cue.opcode !== a.opcode || cue.status !== 'resolved-reference' ||
          !operands || canonicalText(operands) !== canonicalText(p)) { diagnostic('unsupported-action-cue', a.id); continue; }
        effects.push({ id: a.id, opcode: a.opcode, argument: 0, target: null }); accepted('action', a.opcode); continue;
      }
      if (!actionCodes.has(a.opcode)) { diagnostic('unsupported-action-opcode', a.id); continue; }
      const targetAction = [12, 22, 53, 54].includes(a.opcode);
      if (p.length !== 7 || p[0] !== (targetAction ? '2' : '0') || p.slice(2, 6).some(v => numberToken(v, -0x80000000, 0x7fffffff) === null)) { diagnostic('unsupported-action-operands', a.id); continue; }
      let min = -0x80000000, max = 0x7fffffff;
      if ([25, 26, 27].includes(a.opcode)) { min = 0; max = Math.floor(C.tick / 15); }
      if ([28, 29, 56, 57].includes(a.opcode)) { min = 0; max = a.opcode < 56 ? 49 : 99; }
      if ([1, 2].includes(a.opcode)) { min = 0; max = 255; }
      const n = targetAction ? 0 : numberToken(p[1]!, min, max);
      // Native mode 2 parses selectors shorter than three bytes as numeric indexes. This slice supports named IDs only.
      if (n === null || (targetAction && (p[1]!.length < 3 || p[1]!.length > 255))) { diagnostic('unsupported-action-operands', a.id); continue; }
      effects.push({ id: a.id, opcode: a.opcode, argument: n, target: targetAction ? `trigger:${fold(p[1]!)}` : null }); accepted('action', a.opcode);
    }
    // Native events are prepended. ResetTimers visits them in reverse source order and overwrites one shared timer.
    const firstElapsed = predicates.find(e => e.opcode === 13);
    return { id, attached, enabled, difficulty: levels, elapsedFrames: firstElapsed ? firstElapsed.argument * 15 : null, events: predicates, actions: effects };
  });
  const triggerMap = makeMap(triggers);
  for (const t of triggers) {
    if (t.attached && !triggerMap.has(t.attached)) diagnostic('missing-attached-trigger', t.id);
    for (const a of t.actions) if (a.target && !triggerMap.has(a.target)) diagnostic('missing-action-trigger', a.id);
  }
  for (const r of [...eventRows, ...actionRows]) if (!triggerMap.has(`trigger:${r.id.slice(r.id.indexOf(':') + 1)}`)) diagnostic('orphan-instruction-row', r.id);
  const visited = new Set<string>();
  for (const t of triggers) {
    let id: string | null = t.id; const path = new Set<string>();
    while (id !== null && !visited.has(id)) {
      if (path.has(id)) { diagnostic('attachment-cycle', id); break; }
      path.add(id); id = triggerMap.get(id)?.attached ?? null;
    }
    for (const key of path) visited.add(key);
  }
  let links = 0;
  const tags: Tag[] = tagRows.map(row => {
    const id = text(field(row, 'id')), modeRaw = field(row, 'typeRaw'), first = `trigger:${fold(text(field(row, 'trigger')))}`;
    if (!id.startsWith('tag:')) fail('mission-tag-id');
    if (modeRaw !== '0' && modeRaw !== '2') diagnostic('unsupported-tag-persistence', id);
    const chain: string[] = [], seen = new Set<string>(); let current: string | null = first;
    while (current !== null) {
      if (++links > C.instances) fail('mission-chain-limit');
      if (seen.has(current)) { diagnostic('attachment-cycle', id); break; } seen.add(current);
      const t = triggerMap.get(current); if (!t) { diagnostic('missing-tag-trigger', id); break; }
      chain.push(current); current = t.attached;
    }
    return { id, mode: Number(modeRaw), chain: chain.reverse() };
  });
  makeMap(tags);
  // Never certify an unattached cycle or silently omit a required script/team interpreter.
  if (list(field(logic, 'triggerAttachmentCycles'), C.triggers).length) diagnostic('attachment-cycle', '');
  for (const name of ['teams', 'taskForces', 'scripts'] as const) {
    const rows = list(field(logic, name), C.instructions);
    if (teamContext) {
      if (canonicalText(rows) !== canonicalText(teamContext.logic[name])) diagnostic('unsupported-team-declaration-identity', name);
    } else if (rows.length) diagnostic(`unsupported-${name}`, '');
  }
  if (list(field(logic, 'orphanSections'), C.instructions).length) diagnostic('unsupported-orphanSections', '');
  if (list(field(logic, 'diagnostics'), C.instructions * 2).length) diagnostic('compiler-diagnostics', '');
  if (teams) {
    for (const action of teams.actions) if (!selectedTeams.has(action.instructionId)) diagnostic('unhandled-source-team-action', action.instructionId);
    if (!teams.wholeSourceReady || teams.diagnostics.length) diagnostic('unsupported-team-source-catalog', '');
  }
  if (cells) {
    for (const event of cells.events) if (!selectedCells.has(event.instructionId)) diagnostic('unhandled-source-cell-entry', event.instructionId);
    if (cells.diagnostics.length) diagnostic('unsupported-cell-entry-catalog', '');
  }
  if (objects) {
    for (const event of objects.events) if (!selectedObjects.has(event.instructionId)) diagnostic('unhandled-source-object-event', event.instructionId);
    if (objects.diagnostics.length) diagnostic('unsupported-object-event-catalog', '');
  }
  if (cues) for (const cue of cues.instructions) if (!selectedCues.has(cue.id)) diagnostic('unhandled-source-cue', cue.id);
  const report = { policy: MISSION_LOGIC_POLICY, timingPolicy: MISSION_TIMING_POLICY, source, contentIdentity: content, difficulty,
    canStartCampaign: false as const, nativeBehaviorVerified: false as const,
    coverage: [...coverage.values()].sort((a, b) => compare(a.namespace, b.namespace) || a.opcode - b.opcode), diagnostics };
  canonicalText(report);
  if (diagnostics.length) return freeze({ ...report, program: null, canExecuteTriggerSubset: false });
  // Pins the normalized execution model AND original operand encodings, including ignored fields, under the source/INI policy identity.
  const payload = freeze({ schemaVersion: 1 as const, policy: MISSION_LOGIC_POLICY, timingPolicy: MISSION_TIMING_POLICY,
    difficulty, contentIdentity: content, source, triggers, tags, compilerPolicy: 'webra2-logic-1', iniPolicy: 'webra2-ini-1',
    operandRows: { events: eventRows, actions: actionRows },
    ...(cues ? { cueCatalogSha256: cues.sha256, cueDispatchPolicy: MISSION_CUE_DISPATCH_POLICY } : {}),
    ...(cells ? { cellEntrySourceSha256: cells.sha256, cellEntryDispatchPolicy: MISSION_CELL_ENTRY_DISPATCH_POLICY } : {}),
    ...(objects ? { objectEventSourceSha256: objects.sha256, objectEventDispatchPolicy: MISSION_OBJECT_EVENT_DISPATCH_POLICY } : {}),
    ...(teams ? { teamActionSourceSha256: teams.sha256, teamActionDispatchPolicy: MISSION_TEAM_ACTION_DISPATCH_POLICY } : {}) });
  const sha256 = await canonicalHash(payload, digest);
  const result: MissionProgram = freeze({ schemaVersion: 1, policy: MISSION_LOGIC_POLICY, timingPolicy: MISSION_TIMING_POLICY,
    difficulty, contentIdentity: content, source, sha256, triggers, tags, canStartCampaign: false, nativeBehaviorVerified: false,
    ...(cues ? { cueCatalogSha256: cues.sha256 } : {}), ...(cells ? { cellEntrySourceSha256: cells.sha256 } : {}),
    ...(objects ? { objectEventSourceSha256: objects.sha256 } : {}), ...(teams ? { teamActionSourceSha256: teams.sha256 } : {}) });
  if (teams) programTeams.set(result, teams);
  programs.add(result); if (cells) programCells.set(result, cells); if (objects) programObjects.set(result, objects); if (cues) programCues.set(result, cues); return freeze({ ...report, program: result, canExecuteTriggerSubset: true });
}

/** Generic VM observation data. Only the compound adapter derives it from authoritative movement. */
export interface MissionCellEntryObservation { readonly cellId: string; readonly entityId: number }
/** Generic data only. The compound runtime must derive the exact callback kind from a genuine hit. */
export interface MissionObjectEventObservation { readonly opcode: MissionObjectEventOpcode; readonly entityId: number; readonly sourceId: number | null }
export interface MissionBinding { readonly id: string; readonly tagId: string; readonly attachmentIds: readonly string[] }
export interface MissionInitialState {
  readonly bindings: readonly MissionBinding[];
  readonly globals: readonly boolean[]; readonly locals: readonly boolean[];
}
export interface MissionInput { readonly tick: number; readonly sequence: number; readonly kind: 'global' | 'local'; readonly index: number; readonly value: boolean }
type Timer = { startedAt: number | null; frames: number };
type TriggerState = { id: string; enabled: boolean; destroyed: boolean; deleted: boolean; fired: number; forced: number; elapsedDue: number | null; observations: boolean[] };
type BindingState = { id: string; tagId: string; attachmentIds: string[]; active: boolean; triggers: TriggerState[] };
export interface MissionEffect {
  readonly order: number; readonly tick: number; readonly bindingId: string; readonly triggerId: string;
  readonly instructionId: string; readonly opcode: number; readonly kind: 'action' | 'input' | 'outcome-request' | 'presentation-request' | 'team-request';
  readonly value: number | boolean | null; readonly target: string | null;
}
type Outcome = { order: number; tick: number; opcode: 1 | 2; countryIndex: number };
export interface MissionSave {
  schemaVersion: 1; policy: typeof MISSION_LOGIC_POLICY; programSha256: string; contentIdentity: ContentIdentity;
  nextTick: number; globals: boolean[]; locals: boolean[]; timer: Timer; bindings: BindingState[];
  pending: MissionInput[]; lastInputSequence: number; nextEffectOrder: number; lastOutcomeRequest: Outcome | null;
}
function booleanArray(value: unknown, size: number): boolean[] {
  const result = list(value, size); if (result.length !== size) fail('mission-flag-array'); return result.map(bool);
}
function due(tick: number, frames: number | null): number | null {
  return frames === null ? null : integer(tick + frames);
}
function initialBindings(p: MissionProgram, value: unknown): BindingState[] {
  const tagMap = new Map(p.tags.map(t => [t.id, t])), triggerMap = new Map(p.triggers.map(t => [t.id, t]));
  let instances = 0, attachments = 0; const ids = new Set<string>(), owners = new Set<string>();
  return list(value, C.bindings).map(item => {
    const r = exact(item, ['id', 'tagId', 'attachmentIds']), id = text(r.id), tagId = text(r.tagId), tag = tagMap.get(tagId);
    if (!tag || ids.has(id)) fail('mission-binding'); ids.add(id);
    const rawOwners = list(r.attachmentIds, C.attachments);
    if (!rawOwners.length || rawOwners.length > C.attachments - attachments || tag.chain.length > C.instances - instances) fail('mission-binding-limit');
    attachments += rawOwners.length; instances += tag.chain.length;
    const attachmentIds = rawOwners.map(v => { const s = text(v); if (owners.has(s)) fail('mission-attachment-duplicate'); owners.add(s); return s; }).sort(compare);
    return { id, tagId, attachmentIds, active: true, triggers: tag.chain.map(id => {
      const t = triggerMap.get(id)!;
      return { id, enabled: t.enabled && t.difficulty[p.difficulty]!, destroyed: false, deleted: false, fired: 0, forced: 0,
        elapsedDue: due(0, t.elapsedFrames), observations: t.events.map(() => false) };
    }) };
  }).sort((a, b) => compare(a.id, b.id));
}
function inputRecord(value: unknown, nextTick: number): MissionInput {
  const r = exact(value, ['tick', 'sequence', 'kind', 'index', 'value']);
  const tick = integer(r.tick, nextTick, Math.min(C.tick - 1, nextTick + C.futureTicks));
  const sequence = integer(r.sequence, 0, Number.MAX_SAFE_INTEGER);
  if (r.kind !== 'global' && r.kind !== 'local') fail('mission-input-kind');
  return { tick, sequence, kind: r.kind, index: integer(r.index, 0, r.kind === 'global' ? 49 : 99), value: bool(r.value) };
}
function timerRemaining(timer: Timer, tick: number): number {
  return Math.max(0, timer.frames - (timer.startedAt === null ? 0 : tick - timer.startedAt));
}
function validateSave(p: MissionProgram, value: unknown): MissionSave {
  program(p);
  const raw = typeof value === 'string' || value instanceof Uint8Array ? parseJson(value) : value;
  const r = exact(clone(raw), ['schemaVersion', 'policy', 'programSha256', 'contentIdentity', 'nextTick', 'globals', 'locals', 'timer', 'bindings', 'pending', 'lastInputSequence', 'nextEffectOrder', 'lastOutcomeRequest']);
  if (r.schemaVersion !== 1 || r.policy !== MISSION_LOGIC_POLICY || r.programSha256 !== p.sha256 || canonicalText(contentIdentity(r.contentIdentity)) !== canonicalText(p.contentIdentity)) fail('mission-save-identity');
  const nextTick = integer(r.nextTick), globals = booleanArray(r.globals, 50), locals = booleanArray(r.locals, 100);
  const timerValue = exact(r.timer, ['startedAt', 'frames']), timer = { startedAt: timerValue.startedAt === null ? null : integer(timerValue.startedAt, 0, Math.max(0, nextTick - 1)), frames: integer(timerValue.frames) };
  if (nextTick === 0 && (timer.startedAt !== null || timer.frames !== 0)) fail('mission-initial-timer');
  const bindingsRaw = list(r.bindings, C.bindings);
  const blueprint = initialBindings(p, bindingsRaw.map(item => { const b = record(item); return { id: b.id, tagId: b.tagId, attachmentIds: b.attachmentIds }; }));
  const triggers = new Map(p.triggers.map(t => [t.id, t]));
  const nextEffectOrder = integer(r.nextEffectOrder, 1, Number.MAX_SAFE_INTEGER), lastInputSequence = integer(r.lastInputSequence, -1, Number.MAX_SAFE_INTEGER);
  const targeted = (opcode: number) => new Set(p.triggers.flatMap(d => d.actions.filter(a => a.opcode === opcode).map(a => a.target)));
  const deletionTargets = targeted(12), forcedTargets = targeted(22);
  const bindings = bindingsRaw.map((item, index) => {
    const b = exact(item, ['id', 'tagId', 'attachmentIds', 'active', 'triggers']), model = blueprint[index]!;
    if (b.id !== model.id || b.tagId !== model.tagId || canonicalText(b.attachmentIds) !== canonicalText(model.attachmentIds)) fail('mission-binding-order');
    const active = bool(b.active), states = list(b.triggers, C.instances);
    if (states.length !== model.triggers.length) fail('mission-trigger-state-count');
    const state = states.map((v, i) => {
      const t = exact(v, ['id', 'enabled', 'destroyed', 'deleted', 'fired', 'forced', 'elapsedDue', 'observations']), base = model.triggers[i]!;
      if (t.id !== base.id) fail('mission-trigger-state-order');
      const definition = triggers.get(base.id)!;
      const enabled = bool(t.enabled), destroyed = bool(t.destroyed), deleted = bool(t.deleted), fired = integer(t.fired, 0, programCells.has(p) || programObjects.has(p) ? C.tick : nextTick);
      const forced = integer(t.forced, 0, Math.min(C.tick, nextEffectOrder - 1));
      if ((enabled && !definition.difficulty[p.difficulty]) || (deleted && (!destroyed || !deletionTargets.has(base.id))) ||
        (forced > 0 && !forcedTargets.has(base.id)) || (destroyed && !deleted && fired === 0)) fail('mission-trigger-state');
      const elapsedDue = t.elapsedDue === null ? null : integer(t.elapsedDue);
      if ((definition.elapsedFrames === null) !== (elapsedDue === null) || (elapsedDue !== null && (elapsedDue < definition.elapsedFrames! || elapsedDue > Math.min(C.tick, Math.max(0, nextTick - 1) + definition.elapsedFrames!)))) fail('mission-elapsed-state');
      const observations = booleanArray(t.observations, definition.events.length);
      return { id: base.id, enabled, destroyed, deleted, fired, forced, elapsedDue, observations };
    });
    const tag = p.tags.find(t => t.id === model.tagId)!;
    const allDeleted = state.every(t => t.deleted);
    if (tag.mode === 2 && (active === allDeleted || state.some(t => t.destroyed !== t.deleted))) fail('mission-repeating-state');
    if (tag.mode === 0 && (active === (allDeleted || state.some(t => t.fired > 0)) ||
      state.some(t => t.fired > 1 || t.destroyed !== (t.deleted || t.fired > 0)))) fail('mission-once-state');
    const result = { ...model, active, triggers: state };
    if (nextTick === 0 && canonicalText(result) !== canonicalText(model)) fail('mission-initial-state');
    return result;
  });
  let previousTick = -1, previousSequence = -1; const sequences = new Set<number>();
  const pending = list(r.pending, C.inputs).map(v => {
    const i = inputRecord(v, nextTick);
    if (i.sequence > lastInputSequence || sequences.has(i.sequence) || i.tick < previousTick || (i.tick === previousTick && i.sequence <= previousSequence)) fail('mission-pending-order');
    sequences.add(i.sequence); previousTick = i.tick; previousSequence = i.sequence; return i;
  });
  let lastOutcomeRequest: Outcome | null = null;
  if (r.lastOutcomeRequest !== null) {
    const o = exact(r.lastOutcomeRequest, ['order', 'tick', 'opcode', 'countryIndex']);
    if (!nextTick || (o.opcode !== 1 && o.opcode !== 2)) fail('mission-outcome-state');
    lastOutcomeRequest = { order: integer(o.order, 1, nextEffectOrder - 1), tick: integer(o.tick, 0, nextTick - 1), opcode: o.opcode, countryIndex: integer(o.countryIndex, 0, 255) };
  }
  if (!nextTick && nextEffectOrder !== 1) fail('mission-initial-effect-order');
  return { schemaVersion: 1, policy: MISSION_LOGIC_POLICY, programSha256: p.sha256, contentIdentity: clone(p.contentIdentity), nextTick,
    globals, locals, timer, bindings, pending, lastInputSequence, nextEffectOrder, lastOutcomeRequest };
}

/** Deterministic binding-local trigger state. No campaign clock, entity lifecycle or host callbacks in a tick. */
export class MissionLogic {
  #program: MissionProgram; #state: MissionSave;
  private constructor(p: MissionProgram, s: MissionSave) { this.#program = p; this.#state = s; }
  static create(p: MissionProgram, initial: MissionInitialState): MissionLogic {
    program(p); const r = exact(clone(initial), ['bindings', 'globals', 'locals']);
    const state: MissionSave = { schemaVersion: 1, policy: MISSION_LOGIC_POLICY, programSha256: p.sha256, contentIdentity: clone(p.contentIdentity), nextTick: 0,
      globals: booleanArray(r.globals, 50), locals: booleanArray(r.locals, 100), timer: { startedAt: null, frames: 0 },
      bindings: initialBindings(p, r.bindings), pending: [], lastInputSequence: -1, nextEffectOrder: 1, lastOutcomeRequest: null };
    return new MissionLogic(p, validateSave(p, state));
  }
  static restore(p: MissionProgram, save: unknown): MissionLogic { return new MissionLogic(p, validateSave(p, save)); }
  save(): MissionSave { return clone(this.#state); }
  saveText(): string { return canonicalText(this.#state); }
  enqueue(batch: readonly MissionInput[]): void {
    // Admission and eventual execution are separate transactions. Initial-save pending inputs are already admitted.
    list(batch, C.inputs); if (batch.length > C.inputs - this.#state.pending.length) fail('mission-input-limit');
    const values = list(clone(batch), C.inputs).map(v => inputRecord(v, this.#state.nextTick));
    const seen = new Set<number>(); let maximum = this.#state.lastInputSequence;
    for (const i of values) { if (seen.has(i.sequence) || i.sequence <= this.#state.lastInputSequence) fail('mission-input-sequence'); seen.add(i.sequence); maximum = Math.max(maximum, i.sequence); }
    const candidate = { ...this.#state, pending: [...this.#state.pending, ...values].sort((a, b) => a.tick - b.tick || a.sequence - b.sequence), lastInputSequence: maximum };
    canonicalText(candidate); this.#state = candidate;
  }
  step(ticks = 1): { nextTick: number; effects: MissionEffect[]; work: number } { return this.#step(ticks); }
  /** One source-enabled VM tick with explicit data observations, not proof of world movement. */
  stepCellEntries(entries: readonly MissionCellEntryObservation[]): { nextTick: number; effects: MissionEffect[]; work: number } {
    if (!programCells.has(this.#program)) fail('mission-cell-source'); return this.#step(1, entries);
  }
  /** One VM tick: cell observations, object callbacks, then source scenario polling. */
  stepObjectEvents(events: readonly MissionObjectEventObservation[], cells: readonly MissionCellEntryObservation[] = []): { nextTick: number; effects: MissionEffect[]; work: number } {
    if (!programObjects.has(this.#program)) fail('mission-object-source'); return this.#step(1, cells, events);
  }
  #step(ticks = 1, cellObservations?: readonly MissionCellEntryObservation[], objectObservations?: readonly MissionObjectEventObservation[]): { nextTick: number; effects: MissionEffect[]; work: number } {
    integer(ticks, 1, C.stepTicks); if (ticks > C.tick - this.#state.nextTick) fail('mission-tick-limit');
    const state = clone(this.#state), p = this.#program, effects: MissionEffect[] = [];
    const definitions = new Map(p.triggers.map(t => [t.id, t])), tags = new Map(p.tags.map(t => [t.id, t]));
    let work = 0;
    const cellSource = programCells.get(p);
    const objectSource = programObjects.get(p);
    const visit = () => { if (++work > C.work) fail('mission-work-limit'); };
    const cellRows = new Map(cellSource?.cells.map(c => { visit(); return [c.cellId, c] as const; }));
    const actorRows = new Map(cellSource?.actors.map(a => { visit(); return [a.entityId, a] as const; }));
    const cellEvents = new Map(cellSource?.events.map(e => { visit(); return [e.instructionId, e] as const; }));
    const objectRows = new Map(objectSource?.actors.map(a => { visit(); return [a.entityId, a] as const; }));
    const objectEvents = new Map(objectSource?.events.map(e => { visit(); return [e.instructionId, e] as const; }));
    const pollSource = cellSource ?? objectSource;
    const pollBindings = pollSource ? new Set(pollSource.scenarioPollBindingIds) : null;
    const bound = new Map(state.bindings.map(b => [b.id, b]));
    const entries = cellObservations === undefined ? [] : list(clone(cellObservations), C.cellEntries).map(value => {
      visit(); const r = exact(value, ['cellId', 'entityId']), cell = cellRows.get(text(r.cellId)), actor = actorRows.get(integer(r.entityId, 1, 0x7fffffff));
      if (!cell || !actor || actor.status !== 'supported' || !bound.has(cell.bindingId)) fail('mission-cell-observation');
      return { cell, actor };
    });
    const callbacks = objectObservations === undefined ? [] : list(clone(objectObservations), C.objectEvents).map(value => {
      visit(); const r = exact(value, ['opcode', 'entityId', 'sourceId']);
      const opcode = integer(r.opcode, 0, 255), actor = objectRows.get(integer(r.entityId, 1, 0x7fffffff));
      const sourceActor = r.sourceId === null ? null : objectRows.get(integer(r.sourceId, 1, 0x7fffffff));
      if (!objectEventCodes.has(opcode) || !actor || actor.status !== 'supported' ||
        (r.sourceId !== null && (!sourceActor || sourceActor.status !== 'supported' || sourceActor.playerId === null)) ||
        (opcode !== 48 && sourceActor === null) || (actor.bindingId !== null && !bound.has(actor.bindingId))) fail('mission-object-observation');
      return { opcode, actor, sourceActor };
    });
    type Entry = typeof entries[number];
    type Callback = typeof callbacks[number];
    function emit(value: Omit<MissionEffect, 'order' | 'tick'>): number {
      if (effects.length >= C.effects || state.nextEffectOrder >= Number.MAX_SAFE_INTEGER) fail('mission-effect-limit');
      const order = state.nextEffectOrder++; effects.push({ order, tick: state.nextTick, ...value }); return order;
    }
    function reset(t: TriggerState) { visit(); t.elapsedDue = due(state.nextTick, definitions.get(t.id)!.elapsedFrames); }
    function setFlag(kind: 'global' | 'local', index: number, value: boolean) {
      const values = kind === 'global' ? state.globals : state.locals;
      if (values[index] === value) return; values[index] = value;
      const ops = kind === 'global' ? [27, 28] : [36, 37];
      for (const b of state.bindings) if (b.active) for (const t of b.triggers) {
        visit(); if (definitions.get(t.id)!.events.some(e => { visit(); return ops.includes(e.opcode) && e.argument === index; })) reset(t);
      }
    }
    function evaluate(e: Predicate, t: TriggerState, entry: Entry | null, callback: Callback | null): boolean {
      visit();
      switch (e.opcode) {
        case 0: return false;
        case 1: {
          const reference = cellEvents.get(e.id); if (!reference) return fail('mission-cell-source');
          return !!entry && (reference.selector.kind === 'any' || reference.selector.kind === 'first-country-house' && reference.selector.playerId === entry.actor.playerId);
        }
        case 6: case 7: case 44: case 48: {
          const reference = objectEvents.get(e.id); if (!reference) return fail('mission-object-source');
          return !!callback && callback.opcode === e.opcode && (reference.selector.kind === 'any' ||
            reference.selector.kind === 'literal-house' && callback.sourceActor?.playerId === reference.selector.playerId);
        }
        case 8: return true;
        case 13: return state.nextTick >= t.elapsedDue!;
        case 14: return state.timer.startedAt !== null && timerRemaining(state.timer, state.nextTick) === 0;
        case 27: return state.globals[e.argument]!;
        case 28: return !state.globals[e.argument];
        case 36: return state.locals[e.argument]!;
        case 37: return !state.locals[e.argument];
        case 47: return Math.floor(state.nextTick / 15) >= e.argument;
        default: return fail('mission-unimplemented-event');
      }
    }
    type Invocation = { binding: BindingState; instance: TriggerState };
    const targets = new Map<string, Invocation[]>();
    for (const binding of state.bindings) for (const instance of binding.triggers) {
      const values = targets.get(instance.id) ?? []; values.push({ binding, instance }); targets.set(instance.id, values);
    }
    function fireActions(binding: BindingState, instance: TriggerState) {
      type Frame = { kind: 'actions'; invocation: Invocation; at: number } | { kind: 'force'; targets: readonly Invocation[]; at: number };
      const frames: Frame[] = [{ kind: 'actions', invocation: { binding, instance }, at: 0 }];
      const push = (frame: Frame) => { if (frames.length >= C.actionFrames) fail('mission-action-stack-limit'); frames.push(frame); };
      while (frames.length) {
        const frame = frames.at(-1)!; visit();
        if (frame.kind === 'force') {
          if (frame.at === frame.targets.length) { frames.pop(); continue; }
          const target = frame.targets[frame.at++]!, t = target.instance;
          if (!target.binding.active || !t.enabled || t.destroyed) continue;
          integer(++t.forced); push({ kind: 'actions', invocation: target, at: 0 }); continue;
        }
        const b = frame.invocation.binding, t = frame.invocation.instance, definition = definitions.get(t.id)!;
        if (frame.at === definition.actions.length) { frames.pop(); continue; }
        // Eligibility is checked at entry only. Disable/delete inside an action list does not truncate this retained list.
        const a = definition.actions[frame.at++]!;
        visit(); let value: MissionEffect['value'] = a.argument, target = a.target;
        if (a.opcode === 28 || a.opcode === 29 || a.opcode === 56 || a.opcode === 57) {
          const kind = a.opcode < 56 ? 'global' : 'local'; value = a.opcode === 28 || a.opcode === 56;
          setFlag(kind, a.argument, value); target = `${kind}:${a.argument}`;
        } else if (a.opcode === 12) {
          // Saved logical tombstones; native RA2 deletes immediately while YR queues destruction.
          // Host pointer expiration/tag attachment callbacks remain outside this explicit-binding VM.
          for (const binding of state.bindings) if (binding.active) for (const instance of binding.triggers) {
            visit(); if (instance.id === a.target) { instance.deleted = true; instance.destroyed = true; }
          }
        } else if (a.opcode === 53 || a.opcode === 54) {
          value = a.opcode === 53;
          for (const binding of state.bindings) if (binding.active) for (const instance of binding.triggers) {
            visit(); if (instance.id !== a.target || instance.destroyed) continue;
            if (a.opcode === 54) instance.enabled = false;
            else if (definitions.get(instance.id)!.difficulty[p.difficulty]) { instance.enabled = true; reset(instance); }
          }
        } else if (a.opcode >= 23 && a.opcode <= 27) {
          if (a.opcode === 23) { if (state.timer.startedAt === null) state.timer.startedAt = state.nextTick; }
          else if (a.opcode === 24) { state.timer.frames = timerRemaining(state.timer, state.nextTick); state.timer.startedAt = null; }
          else {
            const frames = a.opcode === 27 ? a.argument * 15 : Math.max(0, timerRemaining(state.timer, state.nextTick) + (a.opcode === 25 ? 1 : -1) * a.argument * 15);
            integer(frames); state.timer = { startedAt: state.nextTick, frames };
          }
          value = timerRemaining(state.timer, state.nextTick);
        }
        const kind = a.opcode === 1 || a.opcode === 2 ? 'outcome-request' : cueCodes.has(a.opcode) ? 'presentation-request' : teamActionCodes.has(a.opcode) ? 'team-request' : 'action';
        const order = emit({ bindingId: b.id, triggerId: t.id, instructionId: a.id, opcode: a.opcode, kind, value, target });
        if (a.opcode === 1 || a.opcode === 2) state.lastOutcomeRequest = { order, tick: state.nextTick, opcode: a.opcode, countryIndex: a.argument };
        if (a.opcode === 22) push({ kind: 'force', targets: targets.get(a.target!) ?? [], at: 0 });
      }
    }
    for (let remaining = ticks; remaining; remaining--) {
      const tick = state.nextTick;
      let consumed = 0;
      for (const i of state.pending) { if (i.tick !== tick) break; visit(); setFlag(i.kind, i.index, i.value);
        emit({ bindingId: '', triggerId: '', instructionId: '', opcode: -1, kind: 'input', value: i.value, target: `${i.kind}:${i.index}` }); consumed++;
      }
      state.pending = state.pending.slice(consumed);
      const dispatch = (b: BindingState, entry: Entry | null, callback: Callback | null = null) => {
        visit(); if (!b.active) return; const tag = tags.get(b.tagId)!; let removeTag = false;
        for (const t of b.triggers) {
          visit(); if (!t.enabled || t.destroyed) continue; const definition = definitions.get(t.id)!;
          // Native StateB retains death observations only for repeating mode2.
          // ResetTimers does not clear them; cell, attacked and poll predicates remain transient.
          for (let i = definition.events.length - 1; i >= 0; i--) {
            const event = definition.events[i]!;
            if (tag.mode === 2 && objectEvents.get(event.id)?.latch === 'repeat-mode-only' && t.observations[i]) { visit(); continue; }
            t.observations[i] = evaluate(event, t, entry, callback);
          }
          if (!t.observations.every(Boolean)) continue;
          if (tag.mode === 2) reset(t);
          t.fired++; integer(t.fired);
          fireActions(b, t);
          if (tag.mode === 0) { t.destroyed = true; removeTag = true; }
        }
        if (removeTag) b.active = false;
      };
      for (const entry of entries) dispatch(bound.get(entry.cell.bindingId)!, entry);
      for (const callback of callbacks) if (callback.actor.bindingId !== null) dispatch(bound.get(callback.actor.bindingId)!, null, callback);
      for (const b of state.bindings) if (!pollBindings || pollBindings.has(b.id)) dispatch(b, null);
      for (const binding of state.bindings) if (binding.triggers.every(t => t.deleted)) binding.active = false;
      state.nextTick++;
    }
    // The entire multi-tick transaction, including counters, pending inputs and output, either commits or fails unchanged.
    canonicalText(effects); const checked = validateSave(p, state); this.#state = checked;
    return { nextTick: checked.nextTick, effects, work };
  }
}

export interface MissionReplay {
  readonly schemaVersion: 1; readonly initialCheckpoint: MissionSave;
  readonly admissions: readonly { readonly nextTick: number; readonly inputs: readonly MissionInput[] }[];
  readonly finalNextTick: number; readonly checkpoints: readonly { readonly nextTick: number; readonly sha256: string }[];
}
/** Replays admission boundaries, including the initial checkpoint's already queued inputs exactly once. */
export async function replayMission(p: MissionProgram, input: MissionReplay | string | Uint8Array, digest: Digest): Promise<{ simulation: MissionLogic; effects: MissionEffect[]; verifiedCheckpoints: number }> {
  program(p); if (programCells.has(p)) fail('mission-cell-replay-requires-world');
  if (programObjects.has(p)) fail('mission-object-replay-requires-world');
  if (programTeams.has(p)) fail('mission-team-replay-requires-world');
  const r = exact(clone(typeof input === 'string' || input instanceof Uint8Array ? parseJson(input) : input), ['schemaVersion', 'initialCheckpoint', 'admissions', 'finalNextTick', 'checkpoints']);
  if (r.schemaVersion !== 1) fail('mission-replay-version');
  const simulation = MissionLogic.restore(p, r.initialCheckpoint), start = simulation.save().nextTick;
  const finalNextTick = integer(r.finalNextTick, start, Math.min(C.tick, start + C.replayTicks));
  let previous = start, totalInputs = 0;
  const admissions = list(r.admissions, C.admissions).map(v => {
    const a = exact(v, ['nextTick', 'inputs']), nextTick = integer(a.nextTick, previous, finalNextTick); previous = nextTick;
    const inputs = list(a.inputs, C.inputs).map(i => inputRecord(i, nextTick));
    if (inputs.length > C.inputs - totalInputs) fail('mission-replay-input-limit'); totalInputs += inputs.length;
    return { nextTick, inputs };
  });
  previous = start - 1;
  const checkpoints = list(r.checkpoints, C.checkpoints).map(v => {
    const c = exact(v, ['nextTick', 'sha256']), nextTick = integer(c.nextTick, previous + 1, finalNextTick); previous = nextTick;
    return { nextTick, sha256: digestString(c.sha256) };
  });
  const effects: MissionEffect[] = []; let a = 0, c = 0, tick = start, work = 0;
  while (true) {
    while (admissions[a]?.nextTick === tick) simulation.enqueue(admissions[a++]!.inputs);
    if (checkpoints[c]?.nextTick === tick) {
      if (await canonicalHash(simulation.save(), digest) !== checkpoints[c]!.sha256) fail('mission-replay-checkpoint'); c++;
    }
    if (tick === finalNextTick) break;
    // Single-tick calls make resource-work budgeting independent of checkpoint spacing; total output has its own strict cap.
    const result = simulation.step(); if (result.effects.length > C.effects - effects.length) fail('mission-replay-effect-limit');
    if (result.work > C.replayWork - work) fail('mission-replay-work-limit'); work += result.work;
    effects.push(...result.effects); tick++;
  }
  canonicalText(effects); return { simulation, effects, verifiedCheckpoints: c };
}
