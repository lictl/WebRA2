// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original compiler; see ../../../docs/runtime-ini.md.
import { asciiBytes, INI_LIMITS, scanIni } from './ini.ts';
import type { ProfileId } from '../../contracts/src/index.ts';

export const RUNTIME_INI_POLICY = 'webra2-ini-1' as const;
export const RUNTIME_INI_LIMITS = Object.freeze({ layers: 64, bytes: 32 * 1024 * 1024,
  decodedUnits: 32 * 1024 * 1024, scannerBytes: 32 * 1024 * 1024,
  entries: 100_000, sections: 50_000, valueLength: 262_144, diagnostics: 100_000, listItems: 4096 });
export interface RuntimeIniLayer {
  readonly id: string;
  readonly profile: ProfileId;
  readonly order: number;
  readonly kind: 'base' | 'expansion' | 'map' | 'mod';
  readonly sourceSha256: string;
  readonly bytes: Uint8Array;
}
export interface IniOrigin {
  readonly layerId: string;
  readonly sourceSha256: string;
  readonly line: number;
  readonly sectionSpelling: string;
  readonly sectionOccurrence: number;
  readonly keySpelling: string;
  readonly keyOccurrence: number;
  /** Exact decoded right-hand side, including spaces and inline comment; line terminator excluded. */
  readonly rawValue: string;
}
export interface RuntimeIniEntry {
  readonly section: string;
  readonly key: string;
  readonly value: string;
  readonly selected: IniOrigin;
  /** Oldest to newest, excluding selected. */
  readonly shadowed: readonly IniOrigin[];
}
export interface IniDiagnostic {
  readonly code: string;
  readonly layerId: string;
  readonly line: number;
}
export interface RuntimeIni {
  readonly schemaVersion: 1;
  readonly policy: typeof RUNTIME_INI_POLICY;
  readonly profile: ProfileId;
  readonly nativeSemanticsVerified: false;
  readonly layers: readonly (Omit<RuntimeIniLayer, 'bytes'> & { readonly bytes: number; readonly encoding: string })[];
  readonly sections: readonly { readonly name: string; readonly occurrences: readonly { readonly layerId: string; readonly line: number; readonly spelling: string; readonly occurrence: number }[] }[];
  readonly entries: readonly RuntimeIniEntry[];
  readonly diagnostics: readonly IniDiagnostic[];
}
export class RuntimeIniError extends Error {
  readonly diagnostics: readonly IniDiagnostic[];
  constructor(readonly code: string, diagnostics: readonly IniDiagnostic[] = []) {
    super(code); this.name = 'RuntimeIniError'; this.diagnostics = Object.freeze(diagnostics.map(d => Object.freeze({ ...d })));
  }
}
type Limits = { -readonly [K in keyof typeof RUNTIME_INI_LIMITS]: number };
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
function fail(code: string): never { throw new RuntimeIniError(code); }
function trim(value: string): string { return value.replace(/^[ \t]+|[ \t]+$/g, ''); }
function fold(value: string): string { return value.replace(/[A-Z]/g, c => c.toLowerCase()); }
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function plain(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('ini-input-object');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== keys.length || keys.some(k => !descriptors[k] || !('value' in descriptors[k]!))) fail('ini-input-fields');
}
function dense(value: unknown, maximum: number): asserts value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) fail('ini-layer-limit');
  if (Reflect.ownKeys(value).length !== value.length + 1) fail('ini-input-array');
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !('value' in descriptor)) fail('ini-input-array');
  }
}
function limits(options: Partial<Limits>): Limits {
  if (!options || typeof options !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('ini-limit-options');
  const result: Limits = { ...RUNTIME_INI_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || key === 'listItems' || !Object.hasOwn(result, key)) fail('ini-limit-options');
    const descriptor = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in descriptor) || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > result[key as keyof Limits]) fail('ini-limit-options');
    result[key as keyof Limits] = descriptor.value;
  }
  return result;
}
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:/#-]{1,256}$/.test(value)) fail('ini-layer-id');
}
function sourceText(bytes: Uint8Array, encoding: string): string {
  return encoding === 'utf-16le-bom' ? new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2)) :
    encoding === 'utf-8-bom' ? new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3)) : asciiBytes(bytes);
}
function utf8Length(text: string): number {
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) length++; else if (c < 2048) length += 2;
    else if (c >= 0xd800 && c <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { length += 4; i++; }
    else length += 3;
  }
  return length;
}

/** Explicit layer orders, never array positions or inferred archive/file names, select precedence. */
export function compileRuntimeIni(profile: ProfileId, input: readonly RuntimeIniLayer[], options: Partial<Omit<Limits, 'listItems'>> = {}): RuntimeIni {
  if (profile !== 'ra2' && profile !== 'yr') fail('ini-profile');
  const cap = limits(options); dense(input, cap.layers);
  const ids = new Set<string>(), orders = new Set<number>(); let totalBytes = 0;
  const ordered: RuntimeIniLayer[] = [];
  // Validate every profile and aggregate byte budget before decoding any layer.
  for (const value of input) {
    plain(value, ['id', 'profile', 'order', 'kind', 'sourceSha256', 'bytes']);
    if (value.profile !== profile) fail('ini-profile-mismatch');
    id(value.id);
    if (ids.has(value.id)) fail('ini-duplicate-layer-id'); ids.add(value.id);
    if (!Number.isSafeInteger(value.order) || (value.order as number) < 0 || Object.is(value.order, -0)) fail('ini-layer-order');
    if (orders.has(value.order as number)) fail('ini-duplicate-layer-order'); orders.add(value.order as number);
    if (!['base', 'expansion', 'map', 'mod'].includes(value.kind as string)) fail('ini-layer-kind');
    if (typeof value.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceSha256)) fail('ini-source-hash');
    if (!(value.bytes instanceof Uint8Array) || Object.getPrototypeOf(value.bytes) !== Uint8Array.prototype || !(value.bytes.buffer instanceof ArrayBuffer)) fail('ini-byte-source');
    if ((value.bytes.buffer as ArrayBuffer & { resizable?: boolean }).resizable) fail('ini-byte-source');
    totalBytes += value.bytes.byteLength;
    if (value.bytes.byteLength > INI_LIMITS.bytes || totalBytes > cap.bytes) fail('ini-byte-limit');
    ordered.push({ id: value.id, profile, order: value.order as number, kind: value.kind as RuntimeIniLayer['kind'], sourceSha256: value.sourceSha256, bytes: value.bytes });
  }
  ordered.sort((a, b) => a.order - b.order);
  const layers: Mutable<RuntimeIni['layers']> = [], diagnostics: IniDiagnostic[] = [];
  const sections = new Map<string, { name: string; occurrences: { layerId: string; line: number; spelling: string; occurrence: number }[] }>();
  const entries = new Map<string, Map<string, { section: string; key: string; value: string; selected: IniOrigin; shadowed: IniOrigin[] }>>();
  let entryCount = 0, sectionCount = 0, decodedUnits = 0, scannerBytes = 0;
  function diagnostic(code: string, layerId: string, line: number) {
    if (diagnostics.length >= cap.diagnostics) fail('ini-diagnostic-limit'); diagnostics.push(Object.freeze({ code, layerId, line }));
  }
  for (const layer of ordered) {
    const encoding = layer.bytes[0] === 255 && layer.bytes[1] === 254 ? 'utf-16le-bom' :
      layer.bytes[0] === 239 && layer.bytes[1] === 187 && layer.bytes[2] === 191 ? 'utf-8-bom' : 'byte-preserving-ascii-compatible';
    if (encoding === 'utf-16le-bom' && layer.bytes.length % 2) fail('ini-encoding');
    // This conservative UTF-16-unit upper bound is checked before creating decoded text.
    decodedUnits += encoding === 'utf-16le-bom' ? (layer.bytes.length - 2) / 2 : layer.bytes.length - (encoding === 'utf-8-bom' ? 3 : 0);
    if (decodedUnits > cap.decodedUnits) fail('ini-decoded-limit');
    const originalText = sourceText(layer.bytes, encoding);
    if (originalText.includes('\0')) fail('ini-nul');
    const lines = originalText.split(/\r\n|\n|\r/);
    if (lines.length > INI_LIMITS.lines) fail('ini-line-limit');
    let changed = false;
    const normalized = lines.map((raw, index) => {
      if (raw.length > INI_LIMITS.lineLength) fail('ini-line-length');
      const text = trim(raw); if (!text || text.startsWith(';')) return raw;
      if (text.startsWith('[')) {
        const header = /^(\[[^\]\r\n]{1,255}\])(.*)$/.exec(text);
        if (header && trim(header[2]!) && !trim(header[2]!).startsWith(';')) {
          diagnostic('ignored-section-suffix', layer.id, index + 1); changed = true; return header[1]!;
        }
      } else if (!text.includes('=')) {
        diagnostic('ignored-non-entry-line', layer.id, index + 1); changed = true; return '';
      }
      return raw;
    });
    // Only this runtime adapter broadens the research scanner's line subset. Raw source remains intact.
    let normalizedLength = layer.bytes.length;
    if (changed) {
      normalizedLength = 3 + normalized.length - 1;
      for (const line of normalized) {
        normalizedLength += utf8Length(line);
        if (normalizedLength > INI_LIMITS.bytes || normalizedLength > cap.scannerBytes - scannerBytes) fail('ini-scanner-byte-limit');
      }
    }
    scannerBytes += normalizedLength;
    if (scannerBytes > cap.scannerBytes) fail('ini-scanner-byte-limit');
    const scanBytes = changed ? new TextEncoder().encode(`\ufeff${normalized.join('\n')}`) : layer.bytes;
    const document = scanIni(scanBytes);
    if (document.diagnostics.length > cap.diagnostics - diagnostics.length) fail('ini-diagnostic-limit');
    if (document.diagnostics.length) throw new RuntimeIniError('ini-syntax', document.diagnostics.map(d => ({ ...d, layerId: layer.id })));
    if (document.entries.length > cap.entries - entryCount || document.sections.length > cap.sections - sectionCount) fail('ini-occurrence-limit');
    entryCount += document.entries.length; sectionCount += document.sections.length;
    layers.push(Object.freeze({ id: layer.id, profile, order: layer.order, kind: layer.kind, sourceSha256: layer.sourceSha256, bytes: layer.bytes.byteLength, encoding }));
    const layerSections = new Set<string>();
    for (const section of document.sections) {
      if (section.name.includes(';')) throw new RuntimeIniError('ini-identifier-comment', [{ code: 'unsupported-section-comment', layerId: layer.id, line: section.line }]);
      const name = fold(section.name); let existing = sections.get(name);
      if (!existing) { existing = { name, occurrences: [] }; sections.set(name, existing); }
      if (layerSections.has(name)) diagnostic('repeated-section', layer.id, section.line);
      layerSections.add(name);
      existing.occurrences.push(Object.freeze({ layerId: layer.id, line: section.line, spelling: section.name, occurrence: section.occurrence }));
    }
    for (const entry of document.entries) {
      if (entry.key.includes(';')) throw new RuntimeIniError('ini-identifier-comment', [{ code: 'unsupported-key-comment', layerId: layer.id, line: entry.line }]);
      const section = fold(entry.section), key = fold(entry.key), line = lines[entry.line - 1]!;
      const rawValue = line.slice(line.indexOf('=') + 1);
      if (rawValue.length > cap.valueLength) fail('ini-value-limit');
      const commentAt = rawValue.indexOf(';'), value = trim(commentAt < 0 ? rawValue : rawValue.slice(0, commentAt));
      const origin = Object.freeze({ layerId: layer.id, sourceSha256: layer.sourceSha256, line: entry.line, sectionSpelling: entry.section,
        sectionOccurrence: entry.sectionOccurrence, keySpelling: entry.key, keyOccurrence: entry.keyOccurrence, rawValue });
      let keys = entries.get(section); if (!keys) { keys = new Map(); entries.set(section, keys); }
      const previous = keys.get(key);
      if (previous) {
        diagnostic(previous.selected.layerId === layer.id ? 'duplicate-key' : 'layer-override', layer.id, entry.line);
        previous.shadowed.push(previous.selected); previous.selected = origin; previous.value = value;
      } else keys.set(key, { section, key, value, selected: origin, shadowed: [] });
      if (!value.length) diagnostic('explicit-empty-value', layer.id, entry.line);
      if (commentAt >= 0 && /["']/.test(rawValue.slice(0, commentAt))) diagnostic('quote-does-not-escape-comment', layer.id, entry.line);
    }
  }
  const outputEntries = [...entries.entries()].sort(([a], [b]) => compare(a, b)).flatMap(([, keys]) => [...keys.values()].sort((a, b) => compare(a.key, b.key)).map(e => Object.freeze({ ...e, shadowed: Object.freeze(e.shadowed) })));
  const outputSections = [...sections.values()].sort((a, b) => compare(a.name, b.name)).map(s => Object.freeze({ ...s, occurrences: Object.freeze(s.occurrences) }));
  const layerOrder = new Map(ordered.map(l => [l.id, l.order]));
  diagnostics.sort((a, b) => layerOrder.get(a.layerId)! - layerOrder.get(b.layerId)! || a.line - b.line || compare(a.code, b.code));
  return Object.freeze({ schemaVersion: 1, policy: RUNTIME_INI_POLICY, profile, nativeSemanticsVerified: false, layers: Object.freeze(layers), sections: Object.freeze(outputSections), entries: Object.freeze(outputEntries), diagnostics: Object.freeze(diagnostics) });
}

/** Lookup only a compiler-produced table. Unknown sections/keys are retained as ordinary entries. */
export function lookupRuntimeIni(table: RuntimeIni, section: string, key: string): RuntimeIniEntry | undefined {
  section = fold(section); key = fold(key); let lo = 0, hi = table.entries.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2), entry = table.entries[mid]!;
    const order = compare(entry.section, section) || compare(entry.key, key);
    if (!order) return entry;
    if (order < 0) lo = mid + 1; else hi = mid;
  }
  return undefined;
}
export type IniValueSpec = { readonly type: 'string' } | { readonly type: 'boolean' } |
  { readonly type: 'integer'; readonly min: number; readonly max: number; readonly syntax: 'decimal' | 'decimal-or-hex' } |
  { readonly type: 'rational'; readonly allowPercent: boolean } | { readonly type: 'list'; readonly allowEmpty: boolean };
export interface IniRational { readonly numerator: number; readonly denominator: number }
export type IniTypedValue = string | boolean | number | IniRational | readonly string[];
export type IniValueResult = { readonly status: 'missing'; readonly section: string; readonly key: string } |
  { readonly status: 'invalid'; readonly entry: RuntimeIniEntry; readonly code: string } |
  { readonly status: 'present'; readonly entry: RuntimeIniEntry; readonly value: IniTypedValue };
function gcd(a: bigint, b: bigint): bigint { while (b) { const next = a % b; a = b; b = next; } return a; }

/** Exact, versioned WebRA2 conversion; no native field defaults, clamping or partial numeric parses. */
export function readRuntimeIni(table: RuntimeIni, section: string, key: string, spec: IniValueSpec): IniValueResult {
  // Validate conversion configuration even for absent keys, preventing data-dependent caller mistakes.
  if (!spec || typeof spec !== 'object') fail('ini-value-spec');
  const typeDescriptor = Object.getOwnPropertyDescriptor(spec, 'type');
  if (!typeDescriptor || !('value' in typeDescriptor)) fail('ini-value-spec');
  switch (spec.type) {
    case 'string': case 'boolean': plain(spec, ['type']); break;
    case 'integer':
      plain(spec, ['type', 'min', 'max', 'syntax']);
      if (![spec.min, spec.max].every(Number.isSafeInteger) || spec.min > spec.max || !['decimal', 'decimal-or-hex'].includes(spec.syntax)) fail('ini-value-spec'); break;
    case 'rational': plain(spec, ['type', 'allowPercent']); if (typeof spec.allowPercent !== 'boolean') fail('ini-value-spec'); break;
    case 'list': plain(spec, ['type', 'allowEmpty']); if (typeof spec.allowEmpty !== 'boolean') fail('ini-value-spec'); break;
    default: fail('ini-value-spec');
  }
  const entry = lookupRuntimeIni(table, section, key);
  if (!entry) return Object.freeze({ status: 'missing', section: fold(section), key: fold(key) });
  const invalid = (code: string): IniValueResult => Object.freeze({ status: 'invalid', entry, code });
  const raw = entry.value; let value: IniTypedValue;
  switch (spec.type) {
    case 'string': value = raw; break;
    case 'boolean': {
      const token = fold(raw);
      if (['yes', 'true', '1'].includes(token)) value = true;
      else if (['no', 'false', '0'].includes(token)) value = false;
      else return invalid('ini-boolean-syntax'); break;
    }
    case 'integer': {
      if (raw.length > 64) return invalid('ini-number-length');
      let parsed: bigint;
      if (/^[+-]?[0-9]+$/.test(raw)) parsed = BigInt(raw);
      else if (spec.syntax === 'decimal-or-hex') {
        const match = /^([+-]?)(?:\$([0-9a-fA-F]+)|0[xX]([0-9a-fA-F]+)|([0-9a-fA-F]+)[hH])$/.exec(raw);
        if (!match) return invalid('ini-integer-syntax');
        parsed = BigInt(`0x${match[2] ?? match[3] ?? match[4]}`) * (match[1] === '-' ? -1n : 1n);
      } else return invalid('ini-integer-syntax');
      if (parsed < BigInt(spec.min) || parsed > BigInt(spec.max)) return invalid('ini-integer-range');
      value = Number(parsed); break;
    }
    case 'rational': {
      if (raw.length > 64) return invalid('ini-number-length');
      const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(%)?$/.exec(raw);
      if (!match || (match[5] && !spec.allowPercent)) return invalid('ini-rational-syntax');
      const fraction = match[3] ?? match[4] ?? '';
      let numerator = BigInt(`${match[2] ?? '0'}${fraction}`), denominator = 10n ** BigInt(fraction.length);
      if (match[5]) denominator *= 100n;
      const factor = gcd(numerator, denominator); numerator /= factor; denominator /= factor;
      if (match[1] === '-') numerator = -numerator;
      if (numerator < BigInt(Number.MIN_SAFE_INTEGER) || numerator > BigInt(Number.MAX_SAFE_INTEGER) || denominator > BigInt(Number.MAX_SAFE_INTEGER)) return invalid('ini-rational-range');
      value = Object.freeze({ numerator: Number(numerator), denominator: Number(denominator) }); break;
    }
    case 'list': {
      if (!raw.length) { if (!spec.allowEmpty) return invalid('ini-list-empty'); value = Object.freeze([]); break; }
      const items: string[] = []; let start = 0;
      for (let at = 0; at <= raw.length; at++) if (at === raw.length || raw[at] === ',') {
        if (items.length >= RUNTIME_INI_LIMITS.listItems) return invalid('ini-list-limit');
        const item = trim(raw.slice(start, at)); if (!item && !spec.allowEmpty) return invalid('ini-list-empty-item');
        items.push(item); start = at + 1;
      }
      value = Object.freeze(items); break;
    }
  }
  return Object.freeze({ status: 'present', entry, value });
}
