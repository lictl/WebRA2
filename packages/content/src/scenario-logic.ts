// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. EA editor format evidence: ../../../docs/scenario-logic.md.
import type { ProfileId } from '../../contracts/src/index.ts';
import { compileRuntimeIni, type RuntimeIni, type RuntimeIniEntry } from './runtime-ini.ts';

export const SCENARIO_LOGIC_POLICY = 'webra2-logic-1' as const;
export const SCENARIO_LOGIC_LIMITS = Object.freeze({ inputBytes: 16 * 1024 * 1024, rows: 100_000,
  declarations: 8192, records: 65536, recordsPerRow: 4096, tokens: 524288, tokensPerRow: 32769,
  tokenCharacters: 4096, retainedCharacters: 16 * 1024 * 1024, references: 131072,
  diagnostics: 16384, capabilities: 16384, quantity: 65535 });
type Limits = { -readonly [K in keyof typeof SCENARIO_LOGIC_LIMITS]: number };
export interface ScenarioLogicSource { readonly id: string; readonly profile: ProfileId; readonly sha256: string }
export interface ScenarioLogicInput { readonly profile: ProfileId; readonly source: ScenarioLogicSource; readonly bytes: Uint8Array }
export interface LogicRow {
  readonly id: string; readonly entry: RuntimeIniEntry;
  /** Exact comma tokens before the first INI semicolon; full RHS/comments remain in entry.selected.rawValue. */
  readonly tokens: readonly string[]; readonly values: readonly string[];
}
export interface LogicInstruction {
  readonly id: string; readonly ordinal: number; readonly opcode: number;
  readonly tokenStart: number; readonly tokenCount: number; readonly discriminator: number | null;
  readonly parameters: readonly string[]; readonly semantics: 'unimplemented';
}
export interface LogicCountedRow { readonly id: string; readonly row: LogicRow; readonly instructions: readonly LogicInstruction[] }
export interface LogicTrigger {
  readonly id: string; readonly row: LogicRow; readonly ownerSelector: string; readonly attachedTrigger: string;
  readonly name: string; readonly disabledRaw: string; readonly easyRaw: string; readonly mediumRaw: string;
  readonly hardRaw: string; readonly tailRaw: string;
}
export interface LogicTag { readonly id: string; readonly row: LogicRow; readonly typeRaw: string; readonly name: string; readonly trigger: string }
export interface LogicDefinition {
  readonly id: string; readonly name: string; readonly declaration: LogicRow;
  readonly definitionPresent: boolean; readonly fields: readonly LogicRow[];
}
export interface LogicTaskForce extends LogicDefinition {
  readonly members: readonly Readonly<{ row: LogicRow; index: number; quantity: number; type: string }>[];
}
export interface LogicScript extends LogicDefinition {
  readonly steps: readonly Readonly<{ row: LogicRow; index: number; instruction: LogicInstruction }>[];
}
export type LogicTargetKind = 'trigger' | 'tag' | 'event-row' | 'action-row' | 'team' | 'taskforce' | 'script' | 'house' | 'country' | 'object-type' | 'owner-selector';
export interface LogicReference {
  readonly from: string; readonly rowId: string; readonly token: number; readonly field: string;
  readonly targetKind: LogicTargetKind; readonly raw: string;
  readonly status: 'resolved' | 'missing' | 'missing-definition' | 'undeclared' | 'none' | 'unsupported' | 'candidates' | 'external';
  readonly targets: readonly Readonly<{ kind: LogicTargetKind; id: string }>[];
  readonly binding: 'literal' | 'house-country-unresolved';
}
export interface LogicDiagnostic { readonly code: string; readonly rowId: string; readonly line: number; readonly field: string }
export interface LogicCapability {
  readonly namespace: 'event' | 'action' | 'script'; readonly opcode: number;
  readonly instructionIds: readonly string[]; readonly semantics: 'unimplemented'; readonly operandSchema: 'unknown';
}
export interface ScenarioLogic {
  readonly schemaVersion: 1; readonly policy: typeof SCENARIO_LOGIC_POLICY;
  readonly profile: ProfileId; readonly source: ScenarioLogicSource; readonly ini: RuntimeIni;
  readonly newINIFormat: 4;
  readonly framingComplete: true; readonly executionReady: false; readonly nativeBehaviorVerified: false;
  readonly capabilityClosure: 'incomplete-operand-schemas';
  readonly triggers: readonly LogicTrigger[]; readonly tags: readonly LogicTag[];
  readonly events: readonly LogicCountedRow[]; readonly actions: readonly LogicCountedRow[];
  readonly teams: readonly LogicDefinition[]; readonly taskForces: readonly LogicTaskForce[]; readonly scripts: readonly LogicScript[];
  readonly referenceDeclarations: readonly LogicRow[]; readonly references: readonly LogicReference[];
  /** Referenced named sections without the required declaration. Fields remain uncompiled and raw-aware. */
  readonly orphanSections: readonly Readonly<{ section: string; fields: readonly RuntimeIniEntry[] }>[];
  readonly triggerAttachmentCycles: readonly (readonly string[])[];
  readonly capabilities: readonly LogicCapability[]; readonly diagnostics: readonly LogicDiagnostic[];
}
export class ScenarioLogicError extends Error {
  constructor(readonly code: string, readonly section = '', readonly line = 0, readonly field = '') { super(code); this.name = 'ScenarioLogicError'; }
}
function fail(code: string, entry?: RuntimeIniEntry, field = ''): never { throw new ScenarioLogicError(code, entry?.section, entry?.selected.line, field); }
function fold(value: string): string { return value.replace(/[A-Z]/g, c => c.toLowerCase()); }
function trim(value: string): string { return value.replace(/^[ \t]+|[ \t]+$/g, ''); }
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function exact(input: unknown, keys: readonly string[]): asserts input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Reflect.ownKeys(input).length !== keys.length) fail('logic-input');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(input, key); if (!d || !('value' in d)) fail('logic-input'); }
}
function limits(input: Partial<Limits>): Limits {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('logic-limits');
  const result: Limits = { ...SCENARIO_LOGIC_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(result, key)) fail('logic-limits');
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > result[key as keyof Limits]) fail('logic-limits');
    result[key as keyof Limits] = d.value;
  }
  return result;
}
function number(value: string, max: number, entry: RuntimeIniEntry, field: string): number {
  if (!/^[0-9]{1,10}$/.test(value)) fail('logic-number-syntax', entry, field);
  const n = Number(value); if (!Number.isSafeInteger(n) || n > max) fail('logic-number-range', entry, field); return n;
}
function symbol(value: string, entry: RuntimeIniEntry): string {
  if (!value || value.length > 255 || /[\x00-\x1f\x7f,;\[\]=]/.test(value)) fail('logic-symbol', entry); return fold(value);
}

/** One caller-verified mission. No execution, native defaults or opcode-dependent inferred references. */
export function compileScenarioLogic(input: ScenarioLogicInput, options: Partial<Limits> = {}): ScenarioLogic {
  const cap = limits(options); exact(input, ['profile', 'source', 'bytes']); exact(input.source, ['id', 'profile', 'sha256']);
  if ((input.profile !== 'ra2' && input.profile !== 'yr') || input.source.profile !== input.profile) fail('logic-profile');
  const ini = compileRuntimeIni(input.profile, [{ id: input.source.id, profile: input.profile, sourceSha256: input.source.sha256,
    bytes: input.bytes, order: 0, kind: 'map' }], { bytes: cap.inputBytes, entries: cap.rows, decodedUnits: cap.retainedCharacters, diagnostics: cap.diagnostics });
  const sections = new Map<string, RuntimeIniEntry[]>(), sectionNames = new Set(ini.sections.map(s => s.name));
  for (const entry of ini.entries) { let rows = sections.get(entry.section); if (!rows) { rows = []; sections.set(entry.section, rows); } rows.push(entry); }
  const diagnostics: LogicDiagnostic[] = [], cache = new Map<RuntimeIniEntry, LogicRow>();
  function diagnostic(code: string, row?: LogicRow, field = '') {
    if (diagnostics.length >= cap.diagnostics) fail('logic-diagnostic-limit', row?.entry);
    diagnostics.push(Object.freeze({ code, rowId: row?.id ?? '', line: row?.entry.selected.line ?? 0, field }));
  }
  for (const d of ini.diagnostics) {
    if (diagnostics.length >= cap.diagnostics) fail('logic-diagnostic-limit');
    diagnostics.push(Object.freeze({ code: `ini:${d.code}`, rowId: '', line: d.line, field: '' }));
  }
  function unique(entry: RuntimeIniEntry): void { if (entry.shadowed.length) fail('logic-duplicate-row', entry); }
  let tokens = 0, characters = 0, declarations = 0, records = 0;
  function row(entry: RuntimeIniEntry): LogicRow {
    const previous = cache.get(entry); if (previous) return previous;
    unique(entry); const raw = entry.selected.rawValue, comment = raw.indexOf(';'), end = comment < 0 ? raw.length : comment;
    if (raw.length > cap.retainedCharacters - characters) fail('logic-character-limit', entry); characters += raw.length;
    let count = 0, start = 0;
    for (let at = 0; at <= end; at++) if (at === end || raw[at] === ',') {
      if (at - start > cap.tokenCharacters) fail('logic-token-length', entry);
      count++; start = at + 1;
      if (count > cap.tokensPerRow || count > cap.tokens - tokens) fail('logic-token-limit', entry);
    }
    tokens += count;
    const parts = Object.freeze(raw.slice(0, end).split(','));
    const value = Object.freeze({ id: `${entry.section}:${entry.key}`, entry, tokens: parts, values: Object.freeze(parts.map(trim)) });
    cache.set(entry, value); return value;
  }
  function list(section: string, numeric = false): RuntimeIniEntry[] {
    const rows = sections.get(section) ?? [];
    if (rows.length > cap.declarations - declarations) fail('logic-declaration-limit', rows[0]);
    const ids = new Set<number>();
    for (const entry of rows) {
      unique(entry);
      if (numeric) { const id = number(entry.key, 0x7fffffff, entry, 'row-id'); if (ids.has(id)) fail('logic-aliased-id', entry); ids.add(id); }
      else symbol(entry.key, entry);
    }
    return numeric ? [...rows].sort((a, b) => Number(a.key) - Number(b.key)) : rows;
  }
  function declaration(entry: RuntimeIniEntry): LogicRow {
    if (declarations >= cap.declarations) fail('logic-declaration-limit', entry); declarations++; return row(entry);
  }
  function shape(r: LogicRow, count: number): void { if (r.values.length !== count) fail('logic-row-shape', r.entry); }
  const formatEntry = (sections.get('basic') ?? []).find(e => e.key === 'newiniformat');
  if (!formatEntry) fail('logic-unsupported-format');
  const formatRow = row(formatEntry); shape(formatRow, 1);
  if (formatRow.values[0] !== '4') fail('logic-unsupported-format', formatEntry);
  type Target = { kind: LogicTargetKind; id: string; present: boolean };
  const targets = new Map<string, Target>();
  function register(kind: LogicTargetKind, key: string, present = true): string {
    const id = `${kind}:${fold(key)}`;
    if (targets.has(id)) fail('logic-duplicate-declaration'); targets.set(id, { kind, id, present }); return id;
  }
  const triggers = list('triggers').map(entry => {
    const r = declaration(entry); shape(r, 8); const v = r.values;
    return Object.freeze({ id: register('trigger', entry.key), row: r, ownerSelector: v[0]!, attachedTrigger: v[1]!,
      name: v[2]!, disabledRaw: v[3]!, easyRaw: v[4]!, mediumRaw: v[5]!, hardRaw: v[6]!, tailRaw: v[7]! });
  });
  const tags = list('tags').map(entry => {
    const r = declaration(entry); shape(r, 3);
    return Object.freeze({ id: register('tag', entry.key), row: r, typeRaw: r.values[0]!, name: r.values[1]!, trigger: r.values[2]! });
  });
  const capabilityMap = new Map<string, { namespace: LogicCapability['namespace']; opcode: number; instructionIds: string[] }>();
  function instruction(r: LogicRow, namespace: LogicCapability['namespace'], ordinal: number, start: number, width: number, discriminator: number | null): LogicInstruction {
    if (records >= cap.records) fail('logic-record-limit', r.entry); records++;
    const opcode = number(r.values[start]!, 0xffffffff, r.entry, 'opcode'), id = `${namespace}:${r.id}:${ordinal}`, key = `${namespace}:${opcode}`;
    let capability = capabilityMap.get(key);
    if (!capability) {
      if (capabilityMap.size >= cap.capabilities) fail('logic-capability-limit', r.entry);
      capability = { namespace, opcode, instructionIds: [] }; capabilityMap.set(key, capability);
    }
    capability.instructionIds.push(id);
    return Object.freeze({ id, ordinal, opcode, tokenStart: start, tokenCount: width, discriminator,
      parameters: Object.freeze(r.values.slice(start + 1, start + width)), semantics: 'unimplemented' });
  }
  function counted(section: 'events' | 'actions'): LogicCountedRow[] {
    return list(section).map(entry => {
      const r = declaration(entry), count = number(r.values[0]!, cap.recordsPerRow, entry, 'count');
      if (count > cap.records - records) fail('logic-record-limit', entry);
      let start = 1; const instructions: LogicInstruction[] = [];
      for (let ordinal = 0; ordinal < count; ordinal++) {
        if (start + 2 > r.values.length) fail('logic-counted-truncated', entry);
        const discriminator = section === 'events' ? number(r.values[start + 1]!, 0xffffffff, entry, 'discriminator') : null;
        const width = section === 'events' ? discriminator === 2 ? 4 : 3 : 8;
        if (width > r.values.length - start) fail('logic-counted-truncated', entry);
        for (let i = start; i < start + width; i++) if (!r.values[i]) fail('logic-counted-empty', entry);
        instructions.push(instruction(r, section === 'events' ? 'event' : 'action', ordinal, start, width, discriminator)); start += width;
      }
      if (start !== r.values.length) fail('logic-counted-trailing', entry);
      return Object.freeze({ id: register(section === 'events' ? 'event-row' : 'action-row', entry.key), row: r, instructions: Object.freeze(instructions) });
    });
  }
  const events = counted('events'), actions = counted('actions');
  const claimedSections = new Set<string>();
  const reserved = new Set(['basic', 'map', 'triggers', 'events', 'actions', 'tags', 'teamtypes', 'taskforces', 'scripttypes', 'houses', 'countries', 'waypoints']);
  function definitions(section: string, kind: 'team' | 'taskforce' | 'script'): LogicDefinition[] {
    return list(section, true).map(entry => {
      const r = declaration(entry); shape(r, 1); const key = symbol(r.values[0]!, entry);
      if (claimedSections.has(key) || reserved.has(key)) fail('logic-aliased-definition-section', entry);
      claimedSections.add(key); const present = sectionNames.has(key);
      if (!present) diagnostic('missing-definition', r, kind);
      const fields = sections.get(key) ?? [];
      if (fields.length > cap.tokens - tokens) fail('logic-token-limit', entry);
      return Object.freeze({ id: register(kind, key, present), name: r.values[0]!, declaration: r, definitionPresent: present,
        fields: Object.freeze(fields.map(entry => row(entry))) });
    });
  }
  const teams = definitions('teamtypes', 'team'), forceDefinitions = definitions('taskforces', 'taskforce'), scriptDefinitions = definitions('scripttypes', 'script');
  function numberedFields(definition: LogicDefinition): { row: LogicRow; index: number }[] {
    const ids = new Set<number>(), fields: { row: LogicRow; index: number }[] = [];
    for (const r of definition.fields) if (/^[0-9]+$/.test(r.entry.key)) {
      const index = number(r.entry.key, 0x7fffffff, r.entry, 'step-id');
      if (ids.has(index)) fail('logic-aliased-id', r.entry); ids.add(index);
      if (fields.length >= cap.recordsPerRow) fail('logic-step-limit', r.entry);
      if (fields.length >= cap.records - records) fail('logic-record-limit', r.entry);
      fields.push({ row: r, index });
    }
    fields.sort((a, b) => a.index - b.index);
    if (fields.some((f, i) => f.index !== i)) diagnostic('numeric-row-gaps', definition.declaration);
    return fields;
  }
  const taskForces: LogicTaskForce[] = forceDefinitions.map(def => Object.freeze({ ...def,
    members: Object.freeze(numberedFields(def).map(({ row: r, index }) => {
      if (records >= cap.records) fail('logic-record-limit', r.entry); records++; shape(r, 2);
      const quantity = number(r.values[0]!, cap.quantity, r.entry, 'quantity'); symbol(r.values[1]!, r.entry);
      return Object.freeze({ row: r, index, quantity, type: r.values[1]! });
    })) }));
  const scripts: LogicScript[] = scriptDefinitions.map(def => Object.freeze({ ...def,
    steps: Object.freeze(numberedFields(def).map(({ row: r, index }) => {
      shape(r, 2); if (!r.values[1]) fail('logic-script-empty-parameter', r.entry);
      return Object.freeze({ row: r, index, instruction: instruction(r, 'script', index, 0, 2, null) });
    })) }));
  for (const script of scripts) for (const r of script.fields) if (!/^[0-9]+$/.test(r.entry.key) && r.entry.key !== 'name') diagnostic('opaque-script-property', r);
  for (const force of taskForces) for (const r of force.fields) if (!/^[0-9]+$/.test(r.entry.key) && !['name', 'group'].includes(r.entry.key)) diagnostic('opaque-taskforce-property', r);
  const referenceDeclarations: LogicRow[] = [];
  for (const [section, kind] of [['houses', 'house'], ['countries', 'country']] as const) for (const entry of list(section, true)) {
    const r = declaration(entry); shape(r, 1); const name = symbol(r.values[0]!, entry);
    register(kind, name); referenceDeclarations.push(r);
  }
  const references: LogicReference[] = [], orphans = new Set<string>();
  function reference(from: string, r: LogicRow, field: string, token: number, kind: LogicTargetKind, raw: string, optional = false): void {
    if (references.length >= cap.references) fail('logic-reference-limit', r.entry);
    const key = fold(raw), target = targets.get(`${kind}:${key}`), named = ['team', 'taskforce', 'script'].includes(kind);
    let status: LogicReference['status'], found: Target[] = [], binding: LogicReference['binding'] = 'literal';
    if (optional && (raw === '' || (kind === 'trigger' && key === '<none>') || (kind === 'tag' && key === 'none'))) status = target ? 'unsupported' : 'none';
    else if (kind === 'owner-selector') {
      binding = 'house-country-unresolved'; found = [targets.get(`house:${key}`), targets.get(`country:${key}`)].filter((v): v is Target => !!v);
      status = raw === '' ? 'unsupported' : found.length ? 'candidates' : 'external';
    } else if (kind === 'object-type') status = 'external';
    else if (target) { found = [target]; status = target.present ? 'resolved' : 'missing-definition'; }
    else if (named && sectionNames.has(key)) { status = 'undeclared'; orphans.add(key); }
    else status = 'missing';
    references.push(Object.freeze({ from, rowId: r.id, field, token, targetKind: kind, raw, status, binding,
      targets: Object.freeze(found.map(t => Object.freeze({ kind: t.kind, id: t.id }))) }));
    if (['missing', 'missing-definition', 'undeclared', 'unsupported'].includes(status)) diagnostic(status === 'undeclared' ? 'missing-declaration' : `${status}-reference`, r, field);
  }
  for (const trigger of triggers) {
    reference(trigger.id, trigger.row, 'owner', 0, 'owner-selector', trigger.ownerSelector);
    reference(trigger.id, trigger.row, 'attached-trigger', 1, 'trigger', trigger.attachedTrigger, true);
    reference(trigger.id, trigger.row, 'events', -1, 'event-row', trigger.row.entry.key);
    reference(trigger.id, trigger.row, 'actions', -1, 'action-row', trigger.row.entry.key);
  }
  for (const table of [events, actions]) for (const value of table) reference(value.id, value.row, 'trigger-owner', -1, 'trigger', value.row.entry.key);
  for (const tag of tags) reference(tag.id, tag.row, 'trigger', 2, 'trigger', tag.trigger);
  for (const team of teams) for (const r of team.fields) {
    const key = r.entry.key;
    const kind = key === 'house' ? 'owner-selector' : key === 'script' ? 'script' : key === 'taskforce' ? 'taskforce' : key === 'tag' ? 'tag' : null;
    if (kind) { shape(r, 1); reference(team.id, r, key, 0, kind, r.values[0]!, kind === 'tag'); }
  }
  for (const force of taskForces) for (const member of force.members) reference(force.id, member.row, 'member-type', 1, 'object-type', member.type);
  // Functional attachment graph only: opcode parameters are opaque and create no guessed edges.
  const links = new Map<string, string>();
  for (const r of references) if (r.field === 'attached-trigger' && r.status === 'resolved') links.set(r.from, r.targets[0]!.id);
  const visited = new Set<string>(), cycles: (readonly string[])[] = [];
  for (const trigger of triggers) {
    const path: string[] = [], local = new Map<string, number>(); let current: string | undefined = trigger.id;
    while (current !== undefined && !visited.has(current) && !local.has(current)) { local.set(current, path.length); path.push(current); current = links.get(current); }
    if (current !== undefined && local.has(current)) {
      const cycle = path.slice(local.get(current)!); let first = 0;
      for (let i = 1; i < cycle.length; i++) if (compare(cycle[i]!, cycle[first]!) < 0) first = i;
      cycles.push(Object.freeze([...cycle.slice(first), ...cycle.slice(0, first)])); diagnostic('trigger-attachment-cycle', trigger.row);
    }
    for (const id of path) visited.add(id);
  }
  cycles.sort((a, b) => compare(a[0]!, b[0]!));
  const capabilities = [...capabilityMap.values()].sort((a, b) => compare(a.namespace, b.namespace) || a.opcode - b.opcode)
    .map(c => Object.freeze({ ...c, instructionIds: Object.freeze(c.instructionIds), semantics: 'unimplemented' as const, operandSchema: 'unknown' as const }));
  const source = Object.freeze({ id: input.source.id, profile: input.profile, sha256: ini.layers[0]!.sourceSha256 });
  return Object.freeze({ schemaVersion: 1, policy: SCENARIO_LOGIC_POLICY, profile: input.profile, source, ini, newINIFormat: 4,
    framingComplete: true, executionReady: false, nativeBehaviorVerified: false, capabilityClosure: 'incomplete-operand-schemas',
    triggers: Object.freeze(triggers), tags: Object.freeze(tags), events: Object.freeze(events), actions: Object.freeze(actions),
    teams: Object.freeze(teams), taskForces: Object.freeze(taskForces), scripts: Object.freeze(scripts),
    referenceDeclarations: Object.freeze(referenceDeclarations), references: Object.freeze(references),
    orphanSections: Object.freeze([...orphans].sort(compare).map(section => Object.freeze({ section, fields: Object.freeze(sections.get(section) ?? []) }))),
    triggerAttachmentCycles: Object.freeze(cycles), capabilities: Object.freeze(capabilities), diagnostics: Object.freeze(diagnostics) });
}
