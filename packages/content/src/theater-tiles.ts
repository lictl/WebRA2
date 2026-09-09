// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../../../docs/theater-tiles.md.
// Format references: EA Mission Editor contributors; pinned native observations.
import type { ProfileId } from '../../contracts/src/index.ts';
import { compileRuntimeIni, lookupRuntimeIni, type RuntimeIni, type RuntimeIniEntry, type RuntimeIniLayer } from './runtime-ini.ts';

export const THEATER_TILE_POLICY = 'webra2-theater-tiles-1' as const;
export const THEATER_TILE_LIMITS = Object.freeze({ inputBytes: 8 * 1024 * 1024, sets: 10000, tiles: 65535,
  tilesPerSet: 4096, replacementVariants: 26, candidateNames: 65535 * 27, diagnostics: 4096 });
type Limits = { -readonly [K in keyof typeof THEATER_TILE_LIMITS]: number };
export type TileTheater = 'TEMPERATE' | 'SNOW' | 'URBAN' | 'NEWURBAN' | 'DESERT' | 'LUNAR';
export interface TheaterTilesInput { readonly profile: ProfileId; readonly theater: TileTheater; readonly layers: readonly RuntimeIniLayer[] }
export interface TheaterTileSet {
  readonly id: number; readonly section: string; readonly firstTile: number; readonly tiles: number;
  /** Null is allowed only for a zero-file set. */
  readonly filePrefix: string | null;
  readonly fields: readonly RuntimeIniEntry[];
}
export interface TheaterTileDiagnostic { readonly code: string; readonly section: string; readonly line: number }
export interface TheaterTiles {
  readonly schemaVersion: 1; readonly policy: typeof THEATER_TILE_POLICY;
  readonly profile: ProfileId; readonly theater: TileTheater; readonly extension: string;
  /** INI precedence is explicit WebRA2 policy, not a verified universal native INI implementation. */
  readonly ini: RuntimeIni;
  readonly mappingEvidence: 'yr-pinned-native-and-ea-editor' | 'ea-editor-ra2-native-unverified';
  readonly sets: readonly TheaterTileSet[]; readonly totalTiles: number;
  readonly clearSet: number | null; readonly clearTile: number | null;
  readonly replacementVariants: number; readonly potentialCandidateNames: number;
  readonly diagnostics: readonly TheaterTileDiagnostic[];
}
export interface TheaterTileReference { readonly tileIndex: number; readonly extraTileWord: number; readonly subtile: number }
export interface TheaterTileCandidate { readonly filename: string; readonly variant: number }
export type TheaterTileResolution = Readonly<TheaterTileReference & (
  { readonly status: 'unsupported-extra-word' | 'tile-out-of-range' | 'clear-unavailable' } |
  { readonly status: 'candidate' | 'clear-sentinel'; readonly globalTile: number; readonly setId: number;
    /** One-based filename number; subtile is the independent zero-based TMP index-table slot. */
    readonly fileNumber: number; readonly candidates: readonly TheaterTileCandidate[];
    readonly physicalAssetsVerified: false; readonly variantSelection: 'unresolved';
    readonly replacementProbe: 'successive-suffixes-until-first-missing'; readonly replacementCompleteness: 'bounded';
  }
)>;
export class TheaterTilesError extends Error {
  constructor(readonly code: string, readonly section = '', readonly line = 0) { super(code); this.name = 'TheaterTilesError'; }
}
const compiled = new WeakSet<TheaterTiles>();
const extensions: Readonly<Record<TileTheater, string>> = Object.freeze({ TEMPERATE: '.tem', SNOW: '.sno', URBAN: '.urb', NEWURBAN: '.ubn', DESERT: '.des', LUNAR: '.lun' });
function fail(code: string, section = '', line = 0): never { throw new TheaterTilesError(code, section, line); }
function exact(input: unknown, keys: readonly string[]): asserts input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('theater-input');
  if (Reflect.ownKeys(input).length !== keys.length) fail('theater-input');
  for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(input, key); if (!descriptor || !('value' in descriptor)) fail('theater-input'); }
}
function limits(input: Partial<Limits>): Limits {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('theater-limits');
  const output: Limits = { ...THEATER_TILE_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(output, key)) fail('theater-limits');
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in descriptor) || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > output[key as keyof Limits]) fail('theater-limits');
    output[key as keyof Limits] = descriptor.value;
  }
  return output;
}
/** Caller verifies layer hashes first. This synchronous compiler does not authenticate bytes. */
export function compileTheaterTiles(input: TheaterTilesInput, options: Partial<Limits> = {}): TheaterTiles {
  const cap = limits(options); exact(input, ['profile', 'theater', 'layers']);
  if ((input.profile !== 'ra2' && input.profile !== 'yr') || typeof input.theater !== 'string' || !Object.hasOwn(extensions, input.theater)) fail('theater-profile');
  if (input.profile === 'ra2' && ['NEWURBAN', 'DESERT', 'LUNAR'].includes(input.theater)) fail('theater-profile');
  const ini = compileRuntimeIni(input.profile, input.layers, { bytes: cap.inputBytes });
  const diagnostics: TheaterTileDiagnostic[] = [];
  function diagnostic(code: string, section: string, line = 0) {
    if (diagnostics.length >= cap.diagnostics) fail('theater-diagnostic-limit'); diagnostics.push(Object.freeze({ code, section, line }));
  }
  function field(section: string, key: string, required = true): RuntimeIniEntry | undefined {
    const entry = lookupRuntimeIni(ini, section, key);
    if (!entry) { if (required) fail('theater-missing-field', section); return; }
    // Explicit different-layer ordering is allowed. Duplicate values within any one layer are not inferred.
    const layerIds = new Set<string>();
    for (const origin of [...entry.shadowed, entry.selected]) {
      if (layerIds.has(origin.layerId)) fail('theater-duplicate-field', section, origin.line); layerIds.add(origin.layerId);
    }
    return entry;
  }
  function count(entry: RuntimeIniEntry): number {
    const text = entry.value;
    // Native decimal branch consumes a signed digit prefix and returns zero with no digits.
    // Hexadecimal branches and overflow are deliberately outside this bounded compiler.
    if (!text || !/^[\x20-\x7e]*$/.test(text) || text.startsWith('$') || /h$/i.test(text)) fail('theater-count-syntax', entry.section, entry.selected.line);
    const match = /^[+-]?[0-9]+/.exec(text), value = match ? Number(match[0]) : 0;
    if (!Number.isSafeInteger(value) || value < 0 || value > cap.tilesPerSet) fail('theater-count-range', entry.section, entry.selected.line);
    if (!/^(0|[1-9][0-9]*)$/.test(text)) diagnostic(match ? 'decimal-prefix-count' : 'no-digit-count-zero', entry.section, entry.selected.line);
    return value;
  }
  const sections = ini.sections.filter(section => /^tileset[0-9]+$/.test(section.name));
  if (!sections.length || sections.length > cap.sets) fail('theater-set-limit');
  for (let id = 0; id < sections.length; id++) {
    if (sections[id]!.name !== `tileset${String(id).padStart(4, '0')}`) fail('theater-set-gap-or-spelling', sections[id]!.name);
  }
  const fieldsBySection = new Map<string, RuntimeIniEntry[]>();
  for (const entry of ini.entries) {
    let fields = fieldsBySection.get(entry.section); if (!fields) { fields = []; fieldsBySection.set(entry.section, fields); } fields.push(entry);
  }
  const sets: TheaterTileSet[] = []; const prefixes = new Set<string>(); let totalTiles = 0;
  for (const [id, section] of sections.entries()) {
    const tiles = count(field(section.name, 'tilesinset')!);
    const previous = field(section.name, 'lasttilesinset', false);
    if (previous && previous.value !== '-1') { const old = count(previous); if (old !== tiles) fail('theater-unsupported-last-count-remap', section.name, previous.selected.line); }
    const filename = field(section.name, 'filename', tiles > 0);
    const prefix = filename?.value || null;
    if ((tiles && !prefix) || (prefix && !/^[A-Za-z0-9_-]{1,48}$/.test(prefix))) fail('theater-file-prefix', section.name, filename?.selected.line);
    if (tiles > cap.tiles - totalTiles) fail('theater-tile-limit', section.name);
    if ((totalTiles + tiles) * (cap.replacementVariants + 1) > cap.candidateNames) fail('theater-candidate-limit', section.name);
    if (tiles && prefix) {
      const folded = prefix.toLowerCase();
      if (prefixes.has(folded)) diagnostic('shared-file-prefix', section.name, filename!.selected.line);
      prefixes.add(folded);
    }
    sets.push(Object.freeze({ id, section: section.name, firstTile: totalTiles, tiles, filePrefix: prefix,
      fields: Object.freeze(fieldsBySection.get(section.name) ?? []) }));
    totalTiles += tiles;
  }
  const clear = field('general', 'cleartile', false); let clearSet: number | null = null, clearTile: number | null = null;
  if (clear) {
    if (!/^(0|[1-9][0-9]{0,3})$/.test(clear.value)) fail('theater-clear-set', 'general', clear.selected.line);
    clearSet = Number(clear.value);
    if (clearSet >= sets.length || !sets[clearSet]!.tiles) fail('theater-clear-set', 'general', clear.selected.line);
    clearTile = sets[clearSet]!.firstTile;
  } else diagnostic('missing-clear-set', 'general');
  const result: TheaterTiles = Object.freeze({ schemaVersion: 1, policy: THEATER_TILE_POLICY, profile: input.profile,
    theater: input.theater, extension: extensions[input.theater], ini,
    mappingEvidence: input.profile === 'yr' ? 'yr-pinned-native-and-ea-editor' : 'ea-editor-ra2-native-unverified',
    sets: Object.freeze(sets), totalTiles, clearSet, clearTile, replacementVariants: cap.replacementVariants,
    potentialCandidateNames: totalTiles * (cap.replacementVariants + 1), diagnostics: Object.freeze(diagnostics) });
  compiled.add(result); return result;
}
/** Resolve only a compiler-produced table. Candidate availability, slot presence and asset selection are separate gates. */
export function resolveTheaterTile(table: TheaterTiles, reference: TheaterTileReference): TheaterTileResolution {
  if (!compiled.has(table)) fail('theater-untrusted-table'); exact(reference, ['tileIndex', 'extraTileWord', 'subtile']);
  for (const key of ['tileIndex', 'extraTileWord', 'subtile'] as const) {
    const value = reference[key]; if (!Number.isInteger(value) || value < 0 || Object.is(value, -0) || value > (key === 'subtile' ? 255 : 65535)) fail('theater-tile-reference');
  }
  const raw = { tileIndex: reference.tileIndex, extraTileWord: reference.extraTileWord, subtile: reference.subtile };
  if (raw.extraTileWord) return Object.freeze({ ...raw, status: 'unsupported-extra-word' });
  const sentinel = raw.tileIndex === 65535, globalTile = sentinel ? table.clearTile : raw.tileIndex;
  if (globalTile === null) return Object.freeze({ ...raw, status: 'clear-unavailable' });
  if (globalTile >= table.totalTiles) return Object.freeze({ ...raw, status: 'tile-out-of-range' });
  // Zero-length sets may share starts; select a containing range, never a nearest/fallback set.
  let lo = 0, hi = table.sets.length;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2), set = table.sets[mid]!; if (set.firstTile + set.tiles <= globalTile) lo = mid + 1; else hi = mid; }
  const set = table.sets[lo]!, fileNumber = globalTile - set.firstTile + 1;
  const stem = `${set.filePrefix!}${String(fileNumber).padStart(2, '0')}`;
  const candidates = Array.from({ length: table.replacementVariants + 1 }, (_, variant) => Object.freeze({
    filename: `${stem}${variant ? String.fromCharCode(96 + variant) : ''}${table.extension}`, variant }));
  return Object.freeze({ ...raw, status: sentinel ? 'clear-sentinel' : 'candidate', globalTile, setId: set.id, fileNumber,
    candidates: Object.freeze(candidates), physicalAssetsVerified: false, variantSelection: 'unresolved',
    replacementProbe: 'successive-suffixes-until-first-missing', replacementCompleteness: 'bounded' });
}
