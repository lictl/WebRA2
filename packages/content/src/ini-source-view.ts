// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original retained-origin view; see ../INI_SOURCE_PROVENANCE.md.
import type { IniDiagnostic, IniOrigin, RuntimeIni } from './runtime-ini.ts';
import type { ProfileId } from '../../contracts/src/index.ts';

export const INI_SOURCE_VIEW_POLICY = 'webra2-ini-source-view-1' as const;
export const INI_SOURCE_VIEW_LIMITS = Object.freeze({ stages: 64, occurrences: 262144, nodes: 2_000_000,
  characters: 64 * 1024 * 1024, work: 4_194_304 });
type Limits = { -readonly [K in keyof typeof INI_SOURCE_VIEW_LIMITS]: number };
export interface IniSourceEntry {
  readonly key: string;
  /** webra2-ini-1 comment/whitespace semantics; exact decoded RHS is origin.rawValue. */
  readonly value: string;
  readonly origin: IniOrigin;
}
export interface IniSourceSection {
  readonly name: string; readonly line: number; readonly occurrence: number;
  readonly entries: readonly IniSourceEntry[];
}
export interface IniSourceStage { readonly layer: RuntimeIni['layers'][number]; readonly sections: readonly IniSourceSection[] }
export interface IniSourceView {
  readonly schemaVersion: 1; readonly policy: typeof INI_SOURCE_VIEW_POLICY; readonly profile: ProfileId;
  readonly inputPolicy: 'webra2-ini-1'; readonly valuePolicy: 'webra2-ini-1';
  readonly sourceScope: 'retained-runtime-ini-origins'; readonly nativeParserVerified: false;
  readonly stages: readonly IniSourceStage[]; readonly diagnostics: readonly IniDiagnostic[];
}
export type IniSourceUnique<T> = Readonly<{ status: 'missing' }> | Readonly<{ status: 'unique'; value: T }> |
  Readonly<{ status: 'ambiguous'; values: readonly T[] }>;
export class IniSourceViewError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'IniSourceViewError'; }
}
function fail(code: string): never { throw new IniSourceViewError(`ini-source-${code}`); }
const fold = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
const semantic = (s: string): string => s.split(';', 1)[0]!.replace(/^[ \t]+|[ \t]+$/g, '');
const natural = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && !Object.is(n, -0);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !v.includes('\0');
const sha = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const EMPTY: readonly never[] = Object.freeze([]);
const MISSING = Object.freeze({ status: 'missing' as const });
// Same-realm factory brands also own private indices. No mutable Map is exposed in a result.
const views = new WeakMap<IniSourceView, Map<string, Map<string, readonly IniSourceSection[]>>>();
const sections = new WeakMap<IniSourceSection, Map<string, readonly IniSourceEntry[]>>();
function plain(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('record');
}
function record(value: unknown, names: readonly string[]): asserts value is Record<string, unknown> {
  plain(value); const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || names.some(k => !Object.hasOwn(value, k))) fail('fields');
}
function limits(input: Partial<Limits>): Limits {
  plain(input); const cap: Limits = { ...INI_SOURCE_VIEW_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limit');
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !natural(d.value) || d.value > cap[key as keyof Limits]) fail('limit'); cap[key as keyof Limits] = d.value;
  }
  return cap;
}
/** Check whole input ownership before reading imported properties or allocating source indices. */
function immutable(input: unknown, cap: Limits): void {
  const seen = new Set<object>(), active = new Set<object>(); let nodes = 0, characters = 0;
  function visit(value: unknown, depth: number): void {
    if (++nodes > cap.nodes || depth > 32) fail('structure-limit');
    if (typeof value === 'string') { characters += value.length; if (characters > cap.characters) fail('character-limit'); return; }
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0))) return;
    if (!value || typeof value !== 'object') fail('immutable-input');
    if (active.has(value)) fail('input-cycle'); if (seen.has(value)) return;
    if (!Object.isFrozen(value)) fail('immutable-input');
    const array = Array.isArray(value);
    if (array) { if (Object.getPrototypeOf(value) !== Array.prototype || value.length > cap.nodes - nodes) fail('array'); } else plain(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length > cap.nodes - nodes || (array && keys.length !== value.length + 1)) fail('structure-limit');
    seen.add(value); active.add(value);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) fail('input-key');
      characters += key.length; if (characters > cap.characters) fail('character-limit');
      const d = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in d) || !d.enumerable) fail('input-property'); visit(d.value, depth + 1);
    }
    active.delete(value);
  }
  visit(input, 0);
}
type MutableSection = { name: string; line: number; occurrence: number; entries: IniSourceEntry[] };
type MutableStage = { layer: RuntimeIni['layers'][number]; sections: MutableSection[]; occupiedLines: Set<number>; headerOccurrences: Set<string> };

/** Reconstruct retained source occurrences, not unnormalized bytes or an effective native property table. */
export function createIniSourceView(table: RuntimeIni, options: Partial<Limits> = {}): IniSourceView {
  const cap = limits(options); immutable(table, cap);
  record(table, ['schemaVersion', 'policy', 'profile', 'nativeSemanticsVerified', 'layers', 'sections', 'entries', 'diagnostics']);
  if (table.schemaVersion !== 1 || table.policy !== 'webra2-ini-1' || table.nativeSemanticsVerified !== false || !['ra2', 'yr'].includes(table.profile)) fail('profile');
  for (const list of [table.layers, table.sections, table.entries, table.diagnostics]) if (!Array.isArray(list)) fail('array');
  if (table.layers.length > cap.stages) fail('stage-limit');
  let count = 0, work = 0;
  const charge = (n = 1): void => { if (n > cap.work - work) fail('work-limit'); work += n; };
  const occurrence = (n = 1): void => { if (n > cap.occurrences - count) fail('occurrence-limit'); count += n; };
  const stages: MutableStage[] = [], byLayer = new Map<string, MutableStage>(); let order = -1;
  for (const layer of table.layers) {
    charge(); record(layer, ['id', 'profile', 'order', 'kind', 'sourceSha256', 'bytes', 'encoding']);
    if (!text(layer.id, 256) || byLayer.has(layer.id) || layer.profile !== table.profile || !natural(layer.order) || layer.order <= order ||
        !['base', 'expansion', 'mod', 'map'].includes(layer.kind) || !sha(layer.sourceSha256) || !natural(layer.bytes) ||
        !['utf-16le-bom', 'utf-8-bom', 'byte-preserving-ascii-compatible'].includes(layer.encoding)) fail('stage');
    const stage = { layer, sections: [], occupiedLines: new Set<number>(), headerOccurrences: new Set<string>() }; order = layer.order;
    stages.push(stage); byLayer.set(layer.id, stage);
  }
  const names = new Set<string>();
  for (const section of table.sections) {
    charge(); record(section, ['name', 'occurrences']);
    if (!text(section.name, 255) || fold(section.name) !== section.name || names.has(section.name) || !Array.isArray(section.occurrences) || !section.occurrences.length) fail('section'); names.add(section.name);
    occurrence(section.occurrences.length);
    for (const source of section.occurrences) {
      charge(); record(source, ['layerId', 'line', 'spelling', 'occurrence']);
      if (!text(source.layerId, 256)) fail('section-origin');
      const stage = byLayer.get(source.layerId);
      if (!stage || !natural(source.line) || !source.line || !natural(source.occurrence) || !text(source.spelling, 255) ||
          fold(source.spelling) !== section.name || stage.occupiedLines.has(source.line) || stage.headerOccurrences.has(`${source.spelling}\0${source.occurrence}`)) fail('section-origin');
      stage.headerOccurrences.add(`${source.spelling}\0${source.occurrence}`);
      stage.occupiedLines.add(source.line); stage.sections.push({ name: source.spelling, line: source.line, occurrence: source.occurrence, entries: [] });
    }
  }
  // A line belongs to the last preceding header across all names, not any earlier same-name header.
  for (const stage of stages) {
    stage.sections.sort((a, b) => a.line - b.line);
    const counters = new Map<string, number>();
    for (const section of stage.sections) {
      charge(); const key = section.name.toLowerCase(), next = counters.get(key) ?? 0;
      if (section.occurrence !== next) fail('section-origin'); counters.set(key, next + 1);
    }
  }
  const entryNames = new Set<string>();
  for (const entry of table.entries) {
    charge(); record(entry, ['section', 'key', 'value', 'selected', 'shadowed']);
    if (!text(entry.section, 255) || !text(entry.key, 512) || fold(entry.section) !== entry.section || fold(entry.key) !== entry.key ||
        !Array.isArray(entry.shadowed) || typeof entry.value !== 'string') fail('entry');
    const name = `${entry.section}\0${entry.key}`; if (entryNames.has(name)) fail('duplicate-entry'); entryNames.add(name);
    occurrence(entry.shadowed.length + 1); const keyOccurrences = new Set<string>(); let previousOrder = -1, previousLine = -1;
    for (let i = 0; i <= entry.shadowed.length; i++) {
      charge(); const origin = i === entry.shadowed.length ? entry.selected : entry.shadowed[i]!;
      record(origin, ['layerId', 'sourceSha256', 'line', 'sectionSpelling', 'sectionOccurrence', 'keySpelling', 'keyOccurrence', 'rawValue']);
      if (!text(origin.layerId, 256)) fail('entry-origin');
      const stage = byLayer.get(origin.layerId);
      if (!stage || origin.sourceSha256 !== stage.layer.sourceSha256 || !natural(origin.line) || !origin.line ||
          !natural(origin.sectionOccurrence) || !natural(origin.keyOccurrence) || !text(origin.sectionSpelling, 255) || !text(origin.keySpelling, 512) ||
          fold(origin.sectionSpelling) !== entry.section || fold(origin.keySpelling) !== entry.key || typeof origin.rawValue !== 'string' || origin.rawValue.includes('\0') ||
          stage.occupiedLines.has(origin.line) || keyOccurrences.has(`${origin.layerId}\0${origin.keyOccurrence}`) || stage.layer.order < previousOrder || (stage.layer.order === previousOrder && origin.line <= previousLine)) fail('entry-origin');
      let lo = 0, hi = stage.sections.length;
      while (lo < hi) { charge(); const mid = (lo + hi) >>> 1; if (stage.sections[mid]!.line < origin.line) lo = mid + 1; else hi = mid; }
      const section = stage.sections[lo - 1];
      if (!section || section.name !== origin.sectionSpelling || section.occurrence !== origin.sectionOccurrence) fail('entry-origin');
      const value = semantic(origin.rawValue); if (i === entry.shadowed.length && value !== entry.value) fail('entry-value');
      keyOccurrences.add(`${origin.layerId}\0${origin.keyOccurrence}`);
      previousOrder = stage.layer.order; previousLine = origin.line; stage.occupiedLines.add(origin.line);
      section.entries.push(Object.freeze({ key: origin.keySpelling, value, origin: origin as unknown as IniOrigin }));
    }
  }
  for (const diagnostic of table.diagnostics) {
    charge(); record(diagnostic, ['code', 'layerId', 'line']);
    if (!text(diagnostic.code, 256) || !byLayer.has(diagnostic.layerId) || !natural(diagnostic.line) || !diagnostic.line) fail('diagnostic');
  }
  const index = new Map<string, Map<string, readonly IniSourceSection[]>>(), outputStages: IniSourceStage[] = [];
  for (const stage of stages) {
    const groups = new Map<string, IniSourceSection[]>(), output: IniSourceSection[] = [];
    const keyCounters = new Map<string, number>();
    for (const source of stage.sections) {
      charge(); source.entries.sort((a, b) => a.origin.line - b.origin.line);
      const section: IniSourceSection = Object.freeze({ ...source, entries: Object.freeze(source.entries) }); output.push(section);
      const keyGroups = new Map<string, IniSourceEntry[]>();
      for (const entry of section.entries) {
        charge(); const counter = `${section.name.toLowerCase()}\0${entry.key.toLowerCase()}`, next = keyCounters.get(counter) ?? 0;
        if (entry.origin.keyOccurrence !== next) fail('entry-origin'); keyCounters.set(counter, next + 1);
        let rows = keyGroups.get(entry.key); if (!rows) { rows = []; keyGroups.set(entry.key, rows); } rows.push(entry);
      }
      const keyIndex = new Map<string, readonly IniSourceEntry[]>();
      for (const [key, rows] of keyGroups) keyIndex.set(key, Object.freeze(rows)); sections.set(section, keyIndex);
      let matches = groups.get(section.name); if (!matches) { matches = []; groups.set(section.name, matches); } matches.push(section);
    }
    const names = new Map<string, readonly IniSourceSection[]>();
    for (const [key, matches] of groups) names.set(key, Object.freeze(matches)); index.set(stage.layer.id, names);
    outputStages.push(Object.freeze({ layer: stage.layer, sections: Object.freeze(output) }));
  }
  const view: IniSourceView = Object.freeze({ schemaVersion: 1, policy: INI_SOURCE_VIEW_POLICY, profile: table.profile,
    inputPolicy: 'webra2-ini-1', valuePolicy: 'webra2-ini-1', sourceScope: 'retained-runtime-ini-origins', nativeParserVerified: false,
    stages: Object.freeze(outputStages), diagnostics: table.diagnostics });
  views.set(view, index); return view;
}

/** Factory-produced same-realm views only. Unknown layer IDs are a caller identity error. */
export function findIniSourceSections(view: IniSourceView, layerId: string, exactName: string): readonly IniSourceSection[] {
  const index = views.get(view); if (!index) fail('view-brand');
  if (!text(layerId, 256) || !text(exactName, 255)) fail('lookup-name');
  const stage = index.get(layerId); if (!stage) fail('layer-lookup'); return stage.get(exactName) ?? EMPTY;
}
export function findIniSourceEntries(section: IniSourceSection, exactKey: string): readonly IniSourceEntry[] {
  const index = sections.get(section); if (!index) fail('section-brand');
  if (!text(exactKey, 512)) fail('lookup-name'); return index.get(exactKey) ?? EMPTY;
}
function unique<T>(matches: readonly T[]): IniSourceUnique<T> {
  return !matches.length ? MISSING : matches.length === 1 ? Object.freeze({ status: 'unique', value: matches[0]! }) : Object.freeze({ status: 'ambiguous', values: matches });
}
export function uniqueIniSourceSection(view: IniSourceView, layerId: string, exactName: string): IniSourceUnique<IniSourceSection> {
  return unique(findIniSourceSections(view, layerId, exactName));
}
export function uniqueIniSourceEntry(section: IniSourceSection, exactKey: string): IniSourceUnique<IniSourceEntry> {
  return unique(findIniSourceEntries(section, exactKey));
}
