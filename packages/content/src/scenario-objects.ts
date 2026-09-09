// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original compiler; pinned field evidence in docs/scenario-objects.md.
import type { ProfileId } from '../../contracts/src/index.ts';
import { compileRuntimeIni, lookupRuntimeIni, type IniOrigin, type RuntimeIni, type RuntimeIniEntry } from './runtime-ini.ts';

export const SCENARIO_OBJECT_POLICY = 'webra2-objects-1' as const;
export const SCENARIO_OBJECT_LIMITS = Object.freeze({ inputBytes: 16 * 1024 * 1024, rows: 100_000,
  objects: 32768, houses: 256, waypoints: 4096, tags: 8192, teams: 8192,
  fields: 262144, fieldsPerRow: 64, fieldCharacters: 4096, retainedCharacters: 8 * 1024 * 1024,
  references: 65536, diagnostics: 8192 });
type Limits = { -readonly [K in keyof typeof SCENARIO_OBJECT_LIMITS]: number };
export interface ScenarioObjectSource { readonly id: string; readonly profile: ProfileId; readonly sha256: string }
export interface ScenarioObjectsInput { readonly profile: ProfileId; readonly source: ScenarioObjectSource; readonly bytes: Uint8Array }
export interface ScenarioRow {
  readonly id: string; readonly section: string; readonly key: string; readonly origin: IniOrigin;
  /** Exact comma-separated tokens before the INI policy's first semicolon, including token whitespace. */
  readonly tokens: readonly string[];
  /** Trimmed semantic tokens. origin.rawValue also retains the entire inline comment. */
  readonly values: readonly string[];
}
export type PlacementKind = 'infantry' | 'unit' | 'aircraft' | 'structure' | 'terrain' | 'smudge';
export interface ScenarioPlacement {
  readonly row: ScenarioRow; readonly kind: PlacementKind; readonly type: string;
  /** Stored map grid axes, also used by scenario-terrain; not the EA editor's transposed internal names. */
  readonly x: number; readonly y: number; readonly projectedColumn: number; readonly projectedRow: number; readonly insideDiamond: boolean;
  readonly owner: string | null; readonly strengthRaw: number | null; readonly facingRaw: number | null;
  readonly subcellRaw: number | null; readonly mission: string | null; readonly tag: string | null;
  /** Semantic token indices with no implemented meaning. No default or clamping is applied. */
  readonly unsupportedFields: readonly number[];
}
export interface ScenarioHouse { readonly row: ScenarioRow; readonly name: string; readonly definitionPresent: boolean; readonly fields: readonly ScenarioRow[] }
export interface ScenarioWaypoint { readonly row: ScenarioRow; readonly number: number; readonly packedCoordinate: number; readonly x: number; readonly y: number; readonly insideDiamond: boolean }
export interface ScenarioReference {
  readonly rowId: string; readonly line: number; readonly field: string; readonly token: number;
  readonly targetKind: 'house' | 'country' | 'tag' | 'waypoint'; readonly raw: string;
  readonly status: 'resolved' | 'missing' | 'external' | 'none' | 'unsupported'; readonly targetId: string | null;
  /** A transport-origin reference remains conditional on an uninterpreted team flag. */
  readonly condition: 'use-transport-origin' | null;
}
export interface ScenarioObjectDiagnostic { readonly code: string; readonly section: string; readonly line: number; readonly rowId: string; readonly field: string }
export interface ScenarioObjects {
  readonly schemaVersion: 1; readonly policy: typeof SCENARIO_OBJECT_POLICY; readonly iniPolicy: RuntimeIni['policy'];
  readonly profile: ProfileId; readonly source: ScenarioObjectSource; readonly newINIFormat: 4;
  readonly size: Readonly<{ x: 0; y: 0; width: number; height: number }>; readonly sizeOrigin: IniOrigin; readonly formatOrigin: IniOrigin;
  readonly placementsComplete: true; readonly nativeBehaviorVerified: false; readonly runtimeTypeResolution: 'unresolved';
  readonly placements: readonly ScenarioPlacement[]; readonly houses: readonly ScenarioHouse[];
  readonly waypoints: readonly ScenarioWaypoint[]; readonly tags: readonly ScenarioRow[];
  readonly referenceRows: readonly ScenarioRow[]; readonly references: readonly ScenarioReference[];
  readonly diagnostics: readonly ScenarioObjectDiagnostic[];
  /** Counts of input sections with rows not retained by this bounded compiler, including mission logic. */
  readonly uncompiledSections: readonly Readonly<{ section: string; rows: number }>[];
}
export class ScenarioObjectError extends Error {
  constructor(readonly code: string, readonly section = '', readonly line = 0, readonly field = '') { super(code); this.name = 'ScenarioObjectError'; }
}
function fail(code: string, entry?: RuntimeIniEntry, field = ''): never { throw new ScenarioObjectError(code, entry?.section, entry?.selected.line, field); }
function trim(value: string): string { return value.replace(/^[ \t]+|[ \t]+$/g, ''); }
function fold(value: string): string { return value.replace(/[A-Z]/g, c => c.toLowerCase()); }
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function exact(input: unknown, keys: readonly string[]): asserts input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Reflect.ownKeys(input).length !== keys.length) fail('objects-input');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(input, key); if (!d || !('value' in d)) fail('objects-input'); }
}
function limits(options: Partial<Limits>): Limits {
  if (!options || typeof options !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('objects-limits');
  const cap: Limits = { ...SCENARIO_OBJECT_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('objects-limits');
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || d.value < 0 || Object.is(d.value, -0) || d.value > cap[key as keyof Limits]) fail('objects-limits');
    cap[key as keyof Limits] = d.value;
  }
  return cap;
}
function number(raw: string, max: number, entry: RuntimeIniEntry, field: string): number {
  // Bounded unsigned decimal only; leading zeroes retained in provenance. Numeric aliases are checked separately.
  if (!/^[0-9]{1,10}$/.test(raw)) fail('objects-number-syntax', entry, field);
  const value = Number(raw); if (!Number.isSafeInteger(value) || value > max) fail('objects-number-range', entry, field); return value;
}
function symbol(raw: string, entry: RuntimeIniEntry, field: string): string {
  if (!raw || raw.length > 255 || /[\x00-\x1f\x7f,;\[\]=]/.test(raw)) fail('objects-symbol', entry, field); return raw;
}

/** One caller-verified mission. No native defaults, runtime entity allocation, or silent placement omission. */
export function compileScenarioObjects(input: ScenarioObjectsInput, options: Partial<Limits> = {}): ScenarioObjects {
  const cap = limits(options); exact(input, ['profile', 'source', 'bytes']); exact(input.source, ['id', 'profile', 'sha256']);
  if ((input.profile !== 'ra2' && input.profile !== 'yr') || input.source.profile !== input.profile) fail('objects-profile');
  const table = compileRuntimeIni(input.profile, [{ id: input.source.id, profile: input.profile, order: 0, kind: 'map', sourceSha256: input.source.sha256, bytes: input.bytes }],
    { bytes: cap.inputBytes, entries: cap.rows, diagnostics: cap.diagnostics });
  const sectionRows = new Map<string, RuntimeIniEntry[]>(), sectionNames = new Set(table.sections.map(section => section.name));
  for (const entry of table.entries) { let rows = sectionRows.get(entry.section); if (!rows) { rows = []; sectionRows.set(entry.section, rows); } rows.push(entry); }
  const diagnostics: ScenarioObjectDiagnostic[] = [], used = new Set<RuntimeIniEntry>(), rowCache = new Map<RuntimeIniEntry, ScenarioRow>();
  function diagnostic(code: string, entry?: RuntimeIniEntry, field = '') {
    if (diagnostics.length >= cap.diagnostics) fail('objects-diagnostic-limit', entry);
    diagnostics.push(Object.freeze({ code, section: entry?.section ?? '', line: entry?.selected.line ?? 0, rowId: entry ? `${entry.section}:${entry.key}` : '', field }));
  }
  for (const d of table.diagnostics) {
    if (diagnostics.length >= cap.diagnostics) fail('objects-diagnostic-limit');
    diagnostics.push(Object.freeze({ code: `ini:${d.code}`, section: '', line: d.line, rowId: '', field: '' }));
  }
  function unique(entry: RuntimeIniEntry): RuntimeIniEntry { if (entry.shadowed.length) fail('objects-duplicate-row', entry); return entry; }
  function required(section: string, key: string): RuntimeIniEntry {
    const entry = lookupRuntimeIni(table, section, key); if (!entry) throw new ScenarioObjectError('objects-missing-metadata', section, 0, key); return unique(entry);
  }
  let fields = 0, characters = 0;
  function row(entry: RuntimeIniEntry): ScenarioRow {
    const existing = rowCache.get(entry); if (existing) return existing;
    unique(entry); const raw = entry.selected.rawValue;
    characters += raw.length; if (characters > cap.retainedCharacters) fail('objects-character-limit', entry);
    const comment = raw.indexOf(';'), end = comment < 0 ? raw.length : comment;
    let count = 1, start = 0;
    // Count fields and lengths before allocating token lists, including empty fields.
    for (let at = 0; at <= end; at++) if (at === end || raw[at] === ',') {
      if (at - start > cap.fieldCharacters) fail('objects-field-length', entry);
      if (at < end) count++; start = at + 1;
    }
    if (count > cap.fieldsPerRow || count > cap.fields - fields) fail('objects-field-limit', entry); fields += count;
    const tokens = Object.freeze(raw.slice(0, end).split(',')), values = Object.freeze(tokens.map(trim));
    const result = Object.freeze({ id: `${entry.section}:${entry.key}`, section: entry.section, key: entry.selected.keySpelling, origin: entry.selected, tokens, values });
    rowCache.set(entry, result); used.add(entry); return result;
  }
  function list(section: string, maximum: number, numeric = true): RuntimeIniEntry[] {
    const entries = sectionRows.get(section) ?? [];
    if (entries.length > maximum) throw new ScenarioObjectError('objects-row-limit', section);
    const ids = new Set<number>();
    for (const entry of entries) {
      unique(entry);
      if (numeric) { const id = number(entry.key, 2147483647, entry, 'row-id'); if (ids.has(id)) fail('objects-aliased-row-id', entry); ids.add(id); }
    }
    return [...entries].sort((a, b) => numeric ? Number(a.key) - Number(b.key) : compare(a.key, b.key));
  }
  const sizeEntry = required('map', 'size'), sizeValues = row(sizeEntry).values;
  if (sizeValues.length !== 4) fail('objects-size', sizeEntry);
  const sizeNumbers = sizeValues.map(v => number(v, 256, sizeEntry, 'size'));
  if (sizeNumbers[0] || sizeNumbers[1] || !sizeNumbers[2] || !sizeNumbers[3] || sizeNumbers[2]! + sizeNumbers[3]! > 512) fail('objects-size', sizeEntry);
  const size = Object.freeze({ x: 0 as const, y: 0 as const, width: sizeNumbers[2]!, height: sizeNumbers[3]! });
  const formatEntry = required('basic', 'newiniformat');
  if (row(formatEntry).values.length !== 1 || number(formatEntry.value, 4, formatEntry, 'newiniformat') !== 4) fail('objects-unsupported-format', formatEntry);
  function coordinate(x: number, y: number) {
    const projectedColumn = x - y + size.width - 1, projectedRow = x + y - size.width - 1;
    const insideDiamond = x > 0 && y > 0 && projectedColumn >= 0 && projectedColumn < 2 * size.width - 1 && projectedRow >= 0 && projectedRow < 2 * size.height && (projectedColumn & 1) === (projectedRow & 1);
    return { x, y, projectedColumn, projectedRow, insideDiamond };
  }
  const houses: ScenarioHouse[] = [], houseNames = new Map<string, string>();
  for (const entry of list('houses', cap.houses)) {
    const declaration = row(entry); if (declaration.values.length !== 1) fail('objects-house-shape', entry);
    const name = symbol(declaration.values[0]!, entry, 'house'), key = fold(name);
    if (houseNames.has(key)) fail('objects-duplicate-house', entry); houseNames.set(key, declaration.id);
    const fields = sectionRows.get(key) ?? [];
    if (!sectionNames.has(key)) diagnostic('missing-house-definition', entry);
    houses.push(Object.freeze({ row: declaration, name, definitionPresent: sectionNames.has(key), fields: Object.freeze(fields.map(e => row(e))) }));
  }
  const waypointRows = list('waypoints', cap.waypoints), waypoints: ScenarioWaypoint[] = [], waypointIds = new Map<number, string>();
  for (const entry of waypointRows) {
    const declaration = row(entry); if (declaration.values.length !== 1) fail('objects-waypoint-shape', entry);
    const packedCoordinate = number(declaration.values[0]!, 511511, entry, 'packed-coordinate');
    const x = packedCoordinate % 1000, y = Math.floor(packedCoordinate / 1000); if (x > 511 || y > 511) fail('objects-number-range', entry, 'packed-coordinate');
    const position = coordinate(x, y), id = number(entry.key, 2147483647, entry, 'waypoint-id'); waypointIds.set(id, declaration.id);
    if (!position.insideDiamond) diagnostic('outside-diamond-waypoint', entry);
    waypoints.push(Object.freeze({ row: declaration, number: id, packedCoordinate, x, y, insideDiamond: position.insideDiamond }));
  }
  const tags = list('tags', cap.tags, false).map(entry => row(entry)), tagIds = new Map(tags.map(tag => [fold(tag.key), tag.id]));
  const references: ScenarioReference[] = [], referenceRows: ScenarioRow[] = [];
  function reference(entry: RuntimeIniEntry, field: string, token: number, targetKind: ScenarioReference['targetKind'], raw: string,
    status: ScenarioReference['status'], targetId: string | null, condition: ScenarioReference['condition'] = null) {
    if (references.length >= cap.references) fail('objects-reference-limit', entry);
    references.push(Object.freeze({ rowId: row(entry).id, line: entry.selected.line, field, token, targetKind, raw, status, targetId, condition }));
    if (status === 'missing' || status === 'unsupported') diagnostic(`${status}-${targetKind}-reference`, entry, field);
  }
  function namedReference(entry: RuntimeIniEntry, field: string, token: number, kind: 'house' | 'tag', raw: string) {
    // EA's placement defaults and ListTags use "None". Other spellings are not invented aliases.
    const none = raw === '' || (kind === 'tag' && fold(raw) === 'none');
    const targetId = (kind === 'house' ? houseNames : tagIds).get(fold(raw)) ?? null;
    reference(entry, field, token, kind, raw, none ? targetId ? 'unsupported' : 'none' : targetId ? 'resolved' : 'missing', none ? null : targetId);
  }
  for (const house of houses) for (const field of house.fields) {
    const entry = lookupRuntimeIni(table, field.section, fold(field.key))!;
    if (fold(field.key) === 'country') {
      if (field.values.length !== 1) fail('objects-country-shape', entry);
      reference(entry, 'country', 0, 'country', field.values[0]!, field.values[0] === '' ? 'none' : 'external', null);
    } else if (fold(field.key) === 'allies') {
      field.values.forEach((value, i) => namedReference(entry, 'allies', i, 'house', value));
    }
  }
  const player = lookupRuntimeIni(table, 'basic', 'player');
  if (player) { const r = row(player); referenceRows.push(r); if (r.values.length !== 1) fail('objects-player-shape', player); namedReference(player, 'player', 0, 'house', r.values[0]!); }
  const placements: ScenarioPlacement[] = [];
  const layouts = [ ['infantry', 'infantry', 9, 14], ['units', 'unit', 8, 14], ['aircraft', 'aircraft', 8, 12],
    ['structures', 'structure', 7, 17], ['terrain', 'terrain', 1, 1], ['smudge', 'smudge', 3, 4] ] as const;
  for (const [section, kind, minimum, expected] of layouts) {
    const entries = list(section, cap.objects - placements.length);
    for (const entry of entries) {
      const data = row(entry), values = data.values; if (values.length < minimum) fail('objects-placement-shape', entry);
      if (values.length !== expected) diagnostic('nonstandard-placement-field-count', entry);
      const n = (index: number, max: number, field: string) => number(values[index]!, max, entry, field);
      let x: number, y: number, type: string, owner: string | null = null, strengthRaw: number | null = null,
        facingRaw: number | null = null, subcellRaw: number | null = null, mission: string | null = null, tag: string | null = null;
      if (kind === 'terrain') { const packed = number(entry.key, 511511, entry, 'packed-coordinate'); x = packed % 1000; y = Math.floor(packed / 1000); type = symbol(values[0]!, entry, 'type'); }
      else if (kind === 'smudge') { type = symbol(values[0]!, entry, 'type'); x = n(1, 511, 'x'); y = n(2, 511, 'y'); }
      else {
        owner = symbol(values[0]!, entry, 'owner'); type = symbol(values[1]!, entry, 'type'); strengthRaw = n(2, 256, 'strength'); x = n(3, 511, 'x'); y = n(4, 511, 'y');
        facingRaw = n(kind === 'infantry' ? 7 : 5, 255, 'facing');
        if (kind === 'infantry') { subcellRaw = n(5, 255, 'subcell'); if (subcellRaw > 4) diagnostic('unsupported-infantry-subcell', entry, 'subcell'); }
        if (kind !== 'structure') mission = symbol(values[6]!, entry, 'mission');
        const tagIndex = kind === 'infantry' ? 8 : kind === 'structure' ? 6 : 7; tag = values[tagIndex]!;
        namedReference(entry, 'owner', 0, 'house', owner); namedReference(entry, 'tag', tagIndex, 'tag', tag);
      }
      if (x > 511 || y > 511) fail('objects-number-range', entry, 'packed-coordinate');
      const position = coordinate(x, y); if (!position.insideDiamond) diagnostic('outside-diamond-placement', entry);
      const unsupportedFields = Object.freeze(values.slice(minimum).map((_v, i) => minimum + i));
      if (unsupportedFields.length) diagnostic('unsupported-placement-fields', entry);
      placements.push(Object.freeze({ row: data, kind, type, ...position, owner, strengthRaw, facingRaw, subcellRaw, mission, tag, unsupportedFields }));
    }
  }
  const teamNames = new Set<string>();
  for (const declaration of list('teamtypes', cap.teams)) {
    const r = row(declaration); referenceRows.push(r); if (r.values.length !== 1) fail('objects-team-shape', declaration);
    const key = fold(symbol(r.values[0]!, declaration, 'team')); if (teamNames.has(key)) fail('objects-duplicate-team', declaration); teamNames.add(key);
    if (!sectionNames.has(key)) diagnostic('missing-team-definition', declaration);
    const transportFlag = lookupRuntimeIni(table, key, 'usetransportorigin'); if (transportFlag) referenceRows.push(row(transportFlag));
    for (const field of ['waypoint', 'transportwaypoint']) {
      const entry = lookupRuntimeIni(table, key, field); if (!entry) continue;
      const data = row(entry); referenceRows.push(data);
      if (data.values.length !== 1) fail('objects-waypoint-reference-shape', entry);
      const raw = data.values[0]!; let id = -1;
      // EA editor's emitted domain is A..Z, AA..ZZ. Do not extrapolate its decoder to longer/native tokens.
      if (/^[A-Z]{1,2}$/.test(raw)) { id = 0; for (const c of raw) id = id * 26 + c.charCodeAt(0) - 64; id--; }
      const target = waypointIds.get(id) ?? null;
      reference(entry, field, 0, 'waypoint', raw, raw === '' ? 'none' : id < 0 ? 'unsupported' : target ? 'resolved' : 'missing', target, field === 'transportwaypoint' ? 'use-transport-origin' : null);
    }
  }
  diagnostics.sort((a, b) => a.line - b.line || compare(a.code, b.code) || compare(a.field, b.field));
  const uncompiledSections = [...sectionRows].map(([section, entries]) => ({ section, rows: entries.reduce((n, e) => n + (used.has(e) ? 0 : 1 + e.shadowed.length), 0) }))
    .filter(section => section.rows).map(section => Object.freeze(section));
  return Object.freeze({ schemaVersion: 1, policy: SCENARIO_OBJECT_POLICY, iniPolicy: table.policy, profile: input.profile,
    source: Object.freeze({ ...input.source }), newINIFormat: 4, size, sizeOrigin: sizeEntry.selected, formatOrigin: formatEntry.selected, placementsComplete: true,
    nativeBehaviorVerified: false, runtimeTypeResolution: 'unresolved', placements: Object.freeze(placements), houses: Object.freeze(houses),
    waypoints: Object.freeze(waypoints), tags: Object.freeze(tags), referenceRows: Object.freeze(referenceRows), references: Object.freeze(references),
    diagnostics: Object.freeze(diagnostics), uncompiledSections: Object.freeze(uncompiledSections) });
}
