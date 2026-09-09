// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../../../docs/scenario-terrain.md.
// Coordinate/record references: OpenRA contributors and EA editor; no native behavior claim.
import type { ProfileId } from '../../contracts/src/index.ts';
import { decodeMapPack, MapPackError } from '../../formats/src/map-pack.ts';
import { compileRuntimeIni, lookupRuntimeIni, readRuntimeIni, type RuntimeIni, type RuntimeIniEntry } from './runtime-ini.ts';

export const SCENARIO_TERRAIN_POLICY = 'webra2-terrain-1' as const;
export const SCENARIO_TERRAIN_LIMITS = Object.freeze({ inputBytes: 16 * 1024 * 1024, packCharacters: 8 * 1024 * 1024,
  packedBytes: 6 * 1024 * 1024, packRows: 65536, cells: 130816, overlayRecords: 262144, diagnostics: 1024 });
type Limits = { -readonly [K in keyof typeof SCENARIO_TERRAIN_LIMITS]: number };
export interface TerrainSource { readonly id: string; readonly profile: ProfileId; readonly sha256: string }
export interface ScenarioTerrainInput { readonly profile: ProfileId; readonly source: TerrainSource; readonly bytes: Uint8Array }
export interface TerrainRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface TerrainCell {
  readonly x: number; readonly y: number;
  /** Integer staggered screen lattice before elevation/projection into pixels. */
  readonly projectedColumn: number; readonly projectedRow: number;
  readonly tileIndex: number; readonly extraTileWord: number; readonly rawTileIndex: number;
  readonly subtile: number; readonly elevation: number; readonly iceRaw: number;
  readonly overlayType: number; readonly overlayData: number;
  readonly sourceRecord: number;
}
export interface TerrainOverlay { readonly x: number; readonly y: number; readonly type: number; readonly data: number }
export interface TerrainDiagnostic { readonly code: string; readonly section: string; readonly line: number; readonly count: number }
export interface TerrainPack {
  readonly section: string; readonly codec: 'lzo' | 'lcw';
  readonly rows: readonly { readonly number: number; readonly line: number }[];
  readonly encodedCharacters: number; readonly packedBytes: number; readonly decodedBytes: number;
}
export interface ScenarioTerrain {
  readonly schemaVersion: 1; readonly policy: typeof SCENARIO_TERRAIN_POLICY; readonly iniPolicy: RuntimeIni['policy'];
  readonly profile: ProfileId; readonly source: TerrainSource;
  readonly geometryComplete: true; readonly assetResolution: 'unresolved'; readonly nativeBehaviorVerified: false;
  readonly newINIFormat: 4; readonly theater: string;
  readonly size: TerrainRect; readonly localSize: TerrainRect;
  readonly metadataLines: Readonly<{ size: number; localSize: number; theater: number; newINIFormat: number }>;
  readonly cells: readonly TerrainCell[];
  /** Sparse lossless representation: omit only type=255 AND data=0, including outside the diamond. */
  readonly overlays: readonly TerrainOverlay[];
  readonly overlayGridSize: 512; readonly terrainTrailer: 0;
  readonly packs: readonly TerrainPack[]; readonly diagnostics: readonly TerrainDiagnostic[];
}
export class ScenarioTerrainError extends Error {
  constructor(readonly code: string, readonly section = '', readonly line = 0, readonly record = -1) {
    super(code); this.name = 'ScenarioTerrainError';
  }
}
function fail(code: string, section = '', line = 0, record = -1): never { throw new ScenarioTerrainError(code, section, line, record); }
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('terrain-input');
  if (Reflect.ownKeys(value).length !== keys.length) fail('terrain-input');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d)) fail('terrain-input'); }
}
function bounds(options: Partial<Limits>): Limits {
  if (!options || typeof options !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('terrain-limits');
  const result: Limits = { ...SCENARIO_TERRAIN_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(result, key)) fail('terrain-limits');
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || d.value < 0 || d.value > result[key as keyof Limits]) fail('terrain-limits');
    result[key as keyof Limits] = d.value;
  }
  return result;
}
function required(table: RuntimeIni, section: string, key: string): RuntimeIniEntry {
  const entry = lookupRuntimeIni(table, section, key);
  if (!entry) fail('terrain-missing-metadata', section);
  if (entry.shadowed.length) fail('terrain-duplicate-metadata', section, entry.selected.line);
  return entry;
}
function rectangle(table: RuntimeIni, key: string): TerrainRect {
  const entry = required(table, 'map', key), values = entry.value.split(',');
  if (values.length !== 4) fail('terrain-rectangle', 'map', entry.selected.line);
  const numbers = values.map(v => {
    v = v.replace(/^[ \t]+|[ \t]+$/g, '');
    if (!/^(0|[1-9][0-9]{0,2})$/.test(v)) fail('terrain-rectangle', 'map', entry.selected.line); return Number(v);
  });
  return Object.freeze({ x: numbers[0]!, y: numbers[1]!, width: numbers[2]!, height: numbers[3]! });
}
function sextet(c: number): number {
  if (c >= 65 && c <= 90) return c - 65; if (c >= 97 && c <= 122) return c - 71;
  if (c >= 48 && c <= 57) return c + 4; return c === 43 ? 62 : c === 47 ? 63 : -1;
}
function base64(text: string, limit: number, section: string): Uint8Array {
  if (!text.length || text.length % 4) fail('terrain-base64-length', section);
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0, length = text.length / 4 * 3 - padding;
  if (length > limit) fail('terrain-packed-byte-limit', section);
  for (let i = 0; i < text.length - padding; i++) if (sextet(text.charCodeAt(i)) < 0) fail('terrain-base64-character', section);
  if (padding && (sextet(text.charCodeAt(text.length - padding - 1)) & (padding === 2 ? 15 : 3))) fail('terrain-base64-pad-bits', section);
  const output = new Uint8Array(length); let position = 0;
  for (let i = 0; i < text.length; i += 4) {
    const bits = (sextet(text.charCodeAt(i)) << 18) | (sextet(text.charCodeAt(i + 1)) << 12) |
      ((text[i + 2] === '=' ? 0 : sextet(text.charCodeAt(i + 2))) << 6) | (text[i + 3] === '=' ? 0 : sextet(text.charCodeAt(i + 3)));
    if (position < length) output[position++] = bits >>> 16;
    if (position < length) output[position++] = bits >>> 8;
    if (position < length) output[position++] = bits;
  }
  return output;
}

/** Compile one caller-verified map, not a rules/map merge or a complete playable scenario. */
export function compileScenarioTerrain(input: ScenarioTerrainInput, options: Partial<Limits> = {}): ScenarioTerrain {
  const cap = bounds(options); exact(input, ['profile', 'source', 'bytes']); exact(input.source, ['id', 'profile', 'sha256']);
  if ((input.profile !== 'ra2' && input.profile !== 'yr') || input.source.profile !== input.profile) fail('terrain-profile');
  const table = compileRuntimeIni(input.profile, [{ id: input.source.id, profile: input.profile, order: 0, kind: 'map', sourceSha256: input.source.sha256, bytes: input.bytes }], { bytes: cap.inputBytes });
  const size = rectangle(table, 'size'), localSize = rectangle(table, 'localsize');
  if (size.x || size.y) fail('terrain-unsupported-origin', 'map');
  if (size.width < 1 || size.height < 1 || size.width > 256 || size.height > 256 || size.width + size.height > 512) fail('terrain-size', 'map');
  if (localSize.width < 1 || localSize.height < 1 || localSize.x + localSize.width > size.width || localSize.y + localSize.height > size.height) fail('terrain-local-size', 'map');
  const formatEntry = required(table, 'basic', 'newiniformat');
  const format = readRuntimeIni(table, 'basic', 'newiniformat', { type: 'integer', min: 4, max: 4, syntax: 'decimal' });
  if (format.status !== 'present') fail('terrain-unsupported-format', 'basic', formatEntry.selected.line);
  const theaterEntry = required(table, 'map', 'theater');
  if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(theaterEntry.value)) fail('terrain-theater', 'map', theaterEntry.selected.line);
  const theater = theaterEntry.value.toUpperCase();
  const cellCount = (2 * size.width - 1) * size.height;
  if (cellCount > cap.cells) fail('terrain-cell-limit');
  if (table.diagnostics.length > cap.diagnostics) fail('terrain-diagnostic-limit');
  const diagnostics: TerrainDiagnostic[] = table.diagnostics.map(d => Object.freeze({ code: `ini:${d.code}`, section: '', line: d.line, count: 1 }));
  function diagnostic(code: string, section: string, count: number, line = 0) {
    if (count) { if (diagnostics.length >= cap.diagnostics) fail('terrain-diagnostic-limit'); diagnostics.push(Object.freeze({ code, section, line, count })); }
  }
  if (!['TEMPERATE', 'SNOW', 'URBAN', 'DESERT', 'NEWURBAN', 'LUNAR'].includes(theater)) diagnostic('unsupported-theater-assets', 'map', 1, theaterEntry.selected.line);
  const packs: TerrainPack[] = []; let characters = 0, packedBytes = 0, rows = 0;
  function pack(section: string, codec: 'lzo' | 'lcw', expectedLength: number): Uint8Array {
    const sec = table.sections.find(s => s.name === section);
    if (!sec) fail('terrain-missing-pack', section);
    if (sec.occurrences.length !== 1) fail('terrain-duplicate-pack-section', section, sec.occurrences[1]!.line);
    const entries = table.entries.filter(e => e.section === section);
    if (!entries.length) fail('terrain-empty-pack', section, sec.occurrences[0]!.line);
    rows += entries.length; if (rows > cap.packRows) fail('terrain-pack-row-limit', section);
    for (const e of entries) {
      if (!/^[1-9][0-9]{0,5}$/.test(e.key)) fail('terrain-pack-row-key', section, e.selected.line);
      if (e.shadowed.length) fail('terrain-duplicate-pack-row', section, e.selected.line);
      characters += e.value.length;
      if (characters > cap.packCharacters) fail('terrain-pack-character-limit', section, e.selected.line);
    }
    entries.sort((a, b) => Number(a.key) - Number(b.key));
    for (let i = 0; i < entries.length; i++) if (Number(entries[i]!.key) !== i + 1) fail('terrain-pack-row-gap', section, entries[i]!.selected.line);
    const encoded = entries.map(e => e.value).join(''), packed = base64(encoded, cap.packedBytes - packedBytes, section);
    packedBytes += packed.length;
    let decoded: Uint8Array;
    try { decoded = decodeMapPack(packed, codec, { expectedLength, outputLimit: expectedLength }); }
    catch (error) { if (error instanceof MapPackError) fail(`terrain-codec:${error.code}`, section); throw error; }
    packs.push(Object.freeze({ section, codec, rows: Object.freeze(entries.map(e => Object.freeze({ number: Number(e.key), line: e.selected.line }))),
      encodedCharacters: encoded.length, packedBytes: packed.length, decodedBytes: decoded.length }));
    return decoded;
  }
  const iso = pack('isomappack5', 'lzo', cellCount * 11 + 4), view = new DataView(iso.buffer, iso.byteOffset, iso.byteLength);
  if (view.getUint32(cellCount * 11, true) !== 0) fail('terrain-trailer', 'isomappack5', 0, cellCount);
  const overlay = pack('overlaypack', 'lcw', 512 * 512), overlayData = pack('overlaydatapack', 'lcw', 512 * 512);
  const occupied = new Set<number>(), cells: TerrainCell[] = [];
  let extra = 0, ice = 0, clear = 0;
  for (let record = 0; record < cellCount; record++) {
    const at = record * 11, x = view.getUint16(at, true), y = view.getUint16(at + 2, true);
    const projectedColumn = x - y + size.width - 1, projectedRow = x + y - size.width - 1;
    if (x < 1 || x >= 512 || y < 1 || y >= 512 || projectedColumn < 0 || projectedColumn > size.width * 2 - 2 ||
        projectedRow < 0 || projectedRow >= size.height * 2 || projectedColumn % 2 !== projectedRow % 2) fail('terrain-cell-coordinate', 'isomappack5', 0, record);
    const address = x + 512 * y;
    if (occupied.has(address)) fail('terrain-duplicate-cell', 'isomappack5', 0, record); occupied.add(address);
    const tileIndex = view.getUint16(at + 4, true), extraTileWord = view.getUint16(at + 6, true), iceRaw = view.getUint8(at + 10);
    if (extraTileWord) extra++; if (iceRaw) ice++; if (tileIndex === 65535) clear++;
    cells.push(Object.freeze({ x, y, projectedColumn, projectedRow, tileIndex, extraTileWord, rawTileIndex: tileIndex + extraTileWord * 65536, subtile: view.getUint8(at + 8),
      elevation: view.getUint8(at + 9), iceRaw, overlayType: overlay[address]!, overlayData: overlayData[address]!, sourceRecord: record }));
  }
  cells.sort((a, b) => a.projectedRow - b.projectedRow || a.projectedColumn - b.projectedColumn);
  diagnostic('uninterpreted-tile-extra-word', 'isomappack5', extra); diagnostic('uninterpreted-ice-byte', 'isomappack5', ice);
  diagnostic('unresolved-clear-tile-sentinel', 'isomappack5', clear);
  const overlays: TerrainOverlay[] = []; let outside = 0, emptyData = 0;
  for (let address = 0; address < overlay.length; address++) {
    const type = overlay[address]!, data = overlayData[address]!;
    if (type === 255 && data === 0) continue;
    if (overlays.length >= cap.overlayRecords) fail('terrain-overlay-record-limit');
    overlays.push(Object.freeze({ x: address % 512, y: Math.floor(address / 512), type, data }));
    if (!occupied.has(address)) outside++; if (type === 255 && data !== 0) emptyData++;
  }
  diagnostic('overlay-outside-terrain-diamond', 'overlaypack', outside); diagnostic('data-with-empty-overlay', 'overlaydatapack', emptyData);
  return Object.freeze({ schemaVersion: 1, policy: SCENARIO_TERRAIN_POLICY, iniPolicy: table.policy, profile: input.profile,
    source: Object.freeze({ id: input.source.id, profile: input.source.profile, sha256: input.source.sha256 }),
    geometryComplete: true, assetResolution: 'unresolved', nativeBehaviorVerified: false, newINIFormat: 4, theater, size, localSize,
    metadataLines: Object.freeze({ size: required(table, 'map', 'size').selected.line, localSize: required(table, 'map', 'localsize').selected.line,
      theater: theaterEntry.selected.line, newINIFormat: formatEntry.selected.line }),
    cells: Object.freeze(cells), overlays: Object.freeze(overlays), overlayGridSize: 512, terrainTrailer: 0,
    packs: Object.freeze(packs), diagnostics: Object.freeze(diagnostics) });
}
