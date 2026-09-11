// SPDX-License-Identifier: GPL-3.0-or-later
// Original, browser-importable GPU/CPU comparison fixtures. No retail bytes or Node APIs.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import type { TerrainSceneInput, TerrainViewport } from '../../packages/render/src/terrain-scene.ts';
import { createSpriteAtlas, type SpriteAtlasInput, type SpriteBatch, type SpriteObject, type SpritePalette } from '../../packages/render/src/sprite-layer.ts';

export interface OriginalTileSpec {
  readonly baseIndex?: number; readonly baseZ?: number;
  readonly basePatches?: readonly Readonly<{ x: number; y: number; index?: number; z?: number }>[];
  /** Coordinates are relative to this slot's base rectangle, not absolute TMP header coordinates. */
  readonly extra?: Readonly<{ x: number; y: number; width: number; height: number; indices: readonly number[]; z: readonly number[] }>;
  readonly headerOrigin?: Readonly<{ x: number; y: number }>;
}
export interface OriginalTerrainOptions {
  readonly profile?: 'ra2' | 'yr'; readonly width?: number; readonly height?: number; readonly tileWidth?: 48 | 60;
  readonly elevations?: readonly number[]; readonly slots?: readonly number[]; readonly tiles?: readonly OriginalTileSpec[];
  readonly palette?: Uint8Array; readonly elevationStep?: number;
}
export interface OriginalShpFrameSpec {
  readonly id: string; readonly x?: number; readonly y?: number; readonly width: number; readonly height: number;
  /** An empty frame has width/height zero and no payload. Otherwise omitted pixels mean index2. */
  readonly pixels?: readonly number[];
}
export interface OriginalSpriteOptions {
  readonly frames?: readonly OriginalShpFrameSpec[]; readonly palettes?: readonly SpritePalette[];
  readonly objects?: readonly SpriteObject[]; readonly canvasWidth?: number; readonly canvasHeight?: number;
}
export interface GpuHandProbe {
  readonly view: number; readonly x: number; readonly y: number;
  readonly expected: Readonly<{ kind: 'none' | 'terrain' | 'object'; sourceRecord?: number; id?: string;
    depth?: number; worldX?: number; worldY?: number; canvasX?: number; canvasY?: number; rgba?: readonly number[] }>;
}
export interface GpuOracleCase {
  readonly id: string; readonly terrainInput: TerrainSceneInput; readonly batch: SpriteBatch | null;
  readonly viewports: readonly TerrainViewport[]; readonly probes: readonly GpuHandProbe[];
}
export const originalHash = (bytes: Uint8Array): string => bytesToHex(sha256(bytes));
function check(value: number, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw Error('original-fixture-number'); return value;
}
function byte(value: number): number { return check(value, 0, 255); }

/** Colors make index identity visible without requiring a native palette. */
export function originalPalette(id = 'palette'): SpritePalette {
  const rgba = new Uint8Array(1024);
  for (let i = 0; i < 256; i++) rgba.set([i, 255 - i, i * 73 % 256, 255], i * 4);
  return { id, rgba, remap: null, transparentIndex: 0 };
}
export function originalObject(changes: Partial<SpriteObject> = {}): SpriteObject {
  return { id: 'object', frameId: 'frame', paletteId: 'palette', x: 28, y: 10, anchorX: 0, anchorY: 0,
    depth: { base: 100, rowStep: 0, terrainTie: 'front' }, ...changes };
}
export function originalViewport(changes: Partial<TerrainViewport> = {}): TerrainViewport {
  return { cameraX: 0, cameraY: 0, zoom: 1, width: 60, height: 30, backgroundRgba: [19, 23, 29, 37], ...changes };
}

// Literal LZO and constant-run LCW streams are original fixture encodings, not sampled game data.
function mapPack(raw: Uint8Array, lzo: boolean): string {
  const chunks: Uint8Array[] = [];
  for (let at = 0; at < raw.length; at += 8192) {
    const block = raw.subarray(at, at + 8192), encoded: number[] = [];
    if (lzo) {
      if (block.length <= 238) encoded.push(block.length + 17);
      else { encoded.push(0); let n = block.length - 18; while (n > 255) { encoded.push(0); n -= 255; } encoded.push(n); }
      encoded.push(...block, 17, 0, 0);
    } else {
      for (let i = 0; i < block.length;) {
        let end = i + 1; while (end < block.length && block[end] === block[i]) end++;
        const n = end - i; encoded.push(254, n & 255, n >> 8, block[i]!); i = end;
      }
      encoded.push(128);
    }
    const chunk = new Uint8Array(encoded.length + 4), view = new DataView(chunk.buffer);
    view.setUint16(0, encoded.length, true); view.setUint16(2, block.length, true); chunk.set(encoded, 4); chunks.push(chunk);
  }
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0)); let cursor = 0;
  for (const c of chunks) { bytes.set(c, cursor); cursor += c.length; }
  let binary = ''; for (let i = 0; i < bytes.length; i += 4096) binary += String.fromCharCode(...bytes.subarray(i, i + 4096));
  const text = btoa(binary), rows: string[] = [];
  for (let i = 0; i < text.length; i += 64) rows.push(`${i / 64 + 1}=${text.slice(i, i + 64)}`);
  return rows.join('\n') + '\n';
}
function originalTmp(tiles: readonly OriginalTileSpec[], width: number): Uint8Array {
  check(tiles.length, 1, 256); const height = width / 2, packed = width * height / 2;
  const records = tiles.map((tile, ordinal) => {
    const extra = tile.extra, area = extra ? check(extra.width, 1, 2048) * check(extra.height, 1, 2048) : 0;
    check(area, 0, 65536); // These intentionally small fixture sources are not a generic content encoder.
    const bytes = new Uint8Array(52 + packed * 2 + area * 2), view = new DataView(bytes.buffer);
    const slotX = ordinal * width / 2, slotY = ordinal * height / 2;
    view.setInt32(0, tile.headerOrigin?.x ?? slotX, true); view.setInt32(4, tile.headerOrigin?.y ?? slotY, true);
    view.setInt32(12, 52 + packed, true); view.setUint32(36, 2 + (extra ? 1 : 0), true);
    bytes.fill(byte(tile.baseIndex ?? 1), 52, 52 + packed); bytes.fill(byte(tile.baseZ ?? 0), 52 + packed);
    for (const p of tile.basePatches ?? []) {
      check(p.x, 0, width - 1); check(p.y, 0, height - 1);
      const spans = Array.from({ length: height }, (_, y) => y < height / 2 ? 4 * (y + 1) : 4 * (height - y - 1));
      const left = (width - spans[p.y]!) / 2;
      if (p.x < left || p.x >= left + spans[p.y]!) throw Error('original-fixture-uncovered-patch');
      const at = spans.slice(0, p.y).reduce((n, length) => n + length, 0) + p.x - left;
      if (p.index !== undefined) bytes[52 + at] = byte(p.index);
      if (p.z !== undefined) bytes[52 + packed + at] = byte(p.z);
    }
    if (extra) {
      if (extra.indices.length !== area || extra.z.length !== area) throw Error('original-fixture-extra-size');
      const at = 52 + packed * 2;
      view.setInt32(8, at, true); view.setInt32(16, at + area, true);
      view.setInt32(20, check(extra.x, -1048576, 1048576) + slotX, true);
      view.setInt32(24, check(extra.y, -1048576, 1048576) + slotY, true);
      view.setInt32(28, extra.width, true); view.setInt32(32, extra.height, true);
      bytes.set(extra.indices.map(byte), at); bytes.set(extra.z.map(byte), at + area);
    }
    return bytes;
  });
  const start = 16 + tiles.length * 4, bytes = new Uint8Array(start + records.reduce((n, r) => n + r.length, 0)), view = new DataView(bytes.buffer);
  view.setUint32(0, tiles.length, true); view.setUint32(4, 1, true); view.setUint32(8, width, true); view.setUint32(12, height, true);
  let offset = start;
  records.forEach((record, ordinal) => { view.setUint32(16 + ordinal * 4, offset, true); bytes.set(record, offset); offset += record.length; });
  return bytes;
}

/** Fresh caller-owned originals; generated map bytes are authenticated by the existing terrain compiler. */
export function makeOriginalTerrain(options: OriginalTerrainOptions = {}): TerrainSceneInput {
  const profile = options.profile ?? 'ra2', width = check(options.width ?? 1, 1, 64), height = check(options.height ?? 1, 1, 64);
  const tileWidth = options.tileWidth ?? 60, count = (2 * width - 1) * height, tiles = options.tiles ?? [{}];
  if (tileWidth !== 48 && tileWidth !== 60) throw Error('original-fixture-tile-width');
  if (options.elevations && options.elevations.length !== count || options.slots && options.slots.length !== count) throw Error('original-fixture-cell-count');
  const iso = new Uint8Array(count * 11 + 4), iv = new DataView(iso.buffer); let ordinal = 0;
  for (let row = 0; row < height * 2; row++) for (let column = row % 2; column < width * 2 - 1; column += 2) {
    const at = ordinal * 11;
    iv.setUint16(at, (column + row + 2) / 2, true); iv.setUint16(at + 2, (row - column + width * 2) / 2, true);
    iso[at + 8] = check(options.slots?.[ordinal] ?? 0, 0, tiles.length - 1); iso[at + 9] = byte(options.elevations?.[ordinal] ?? 0); ordinal++;
  }
  const bytes = new TextEncoder().encode(`[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,${width},${height}\nLocalSize=0,0,${width},${height}\nTheater=URBAN\n` +
    '[IsoMapPack5]\n' + mapPack(iso, true) + '[OverlayPack]\n' + mapPack(new Uint8Array(262144).fill(255), false) + '[OverlayDataPack]\n' + mapPack(new Uint8Array(262144), false));
  const terrain = compileScenarioTerrain({ profile, source: { id: 'original-gpu-map', profile, sha256: originalHash(bytes) }, bytes });
  const tmp = originalTmp(tiles, tileWidth);
  return { terrain, assets: [{ id: 'original-tmp', sha256: originalHash(tmp), bytes: tmp }],
    choices: terrain.cells.map(c => ({ sourceRecord: c.sourceRecord, assetId: 'original-tmp', subtile: c.subtile })),
    palette: options.palette ?? originalPalette().rgba,
    projection: { tileWidth, tileHeight: tileWidth / 2, elevationStep: options.elevationStep ?? 15 } };
}
/** Raw SHP rectangles are deliberately tiny; offsets and empty frames remain explicit. */
export function makeOriginalSprites(options: OriginalSpriteOptions = {}): { atlasInput: SpriteAtlasInput; batch: SpriteBatch } {
  const frames = options.frames ?? [{ id: 'frame', width: 4, height: 4 }]; check(frames.length, 1, 256);
  const payloads = frames.map(f => {
    check(f.width, 0, 256); check(f.height, 0, 256);
    if ((f.width === 0) !== (f.height === 0)) throw Error('original-fixture-empty-frame');
    const pixels = f.pixels ?? new Array<number>(f.width * f.height).fill(2);
    if (pixels.length !== f.width * f.height) throw Error('original-fixture-frame-size');
    return Uint8Array.from(pixels.map(byte));
  });
  const table = 8 + frames.length * 24, bytes = new Uint8Array(table + payloads.reduce((n, p) => n + p.length, 0)), view = new DataView(bytes.buffer);
  view.setUint16(2, check(options.canvasWidth ?? Math.max(16, ...frames.map(f => (f.x ?? 0) + f.width)), 1, 65535), true);
  view.setUint16(4, check(options.canvasHeight ?? Math.max(16, ...frames.map(f => (f.y ?? 0) + f.height)), 1, 65535), true); view.setUint16(6, frames.length, true);
  let offset = table;
  frames.forEach((f, i) => {
    const at = 8 + i * 24; view.setUint16(at, check(f.x ?? 0, 0, 65535), true); view.setUint16(at + 2, check(f.y ?? 0, 0, 65535), true);
    view.setUint16(at + 4, f.width, true); view.setUint16(at + 6, f.height, true);
    if (payloads[i]!.length) { view.setUint32(at + 20, offset, true); bytes.set(payloads[i]!, offset); offset += payloads[i]!.length; }
  });
  const atlasInput: SpriteAtlasInput = { assets: [{ id: 'original-shp', sha256: originalHash(bytes), bytes }],
    frames: frames.map((f, frame) => ({ id: f.id, assetId: 'original-shp', frame })) };
  const objects = options.objects ?? [originalObject({ frameId: frames[0]!.id })];
  return { atlasInput, batch: { atlas: createSpriteAtlas(atlasInput), objects, palettes: options.palettes ?? (objects.length ? [originalPalette()] : []) } };
}

/** Small complete-output cases shared by Node packet tests and the real browser GPU runner. */
export function gpuOracleCases(): GpuOracleCase[] {
  const cases: GpuOracleCase[] = [], background = [19, 23, 29, 37];
  const rgba = (index: number): number[] => [index, 255 - index, index * 73 % 256, 255];
  for (const tileWidth of [48, 60] as const) cases.push({ id: `diamond-${tileWidth}`, terrainInput: makeOriginalTerrain({ tileWidth, tiles: [{ baseIndex: 0, baseZ: 7 }] }), batch: null,
    viewports: [originalViewport({ width: tileWidth, height: tileWidth / 2 })], probes: [
      { view: 0, x: tileWidth / 2, y: 0, expected: { kind: 'terrain', sourceRecord: 0, depth: -7, rgba: rgba(0) } },
      { view: 0, x: 0, y: 0, expected: { kind: 'none', rgba: background } },
      { view: 0, x: tileWidth / 2, y: tileWidth / 2 - 1, expected: { kind: 'none', rgba: background } }] });
  const transparent = originalPalette().rgba; transparent[5 * 4 + 3] = 0;
  cases.push({ id: 'extra-color-depth-independent', terrainInput: makeOriginalTerrain({ palette: transparent,
    tiles: [{ baseIndex: 0, baseZ: 7, extra: { x: 28, y: 9, width: 4, height: 1, indices: [4, 0, 5, 0], z: [0, 31, 32, 255] } }] }), batch: null,
    viewports: [originalViewport()], probes: [
      { view: 0, x: 28, y: 9, expected: { kind: 'terrain', depth: 9, rgba: rgba(4) } },
      { view: 0, x: 29, y: 9, expected: { kind: 'terrain', depth: -22, rgba: rgba(0) } },
      { view: 0, x: 30, y: 9, expected: { kind: 'none', rgba: background } },
      { view: 0, x: 31, y: 9, expected: { kind: 'terrain', depth: 2, rgba: rgba(0) } }] });
  cases.push({ id: 'extra-slot-relative-outside', terrainInput: makeOriginalTerrain({ profile: 'yr', slots: [1], palette: transparent,
    tiles: [{}, { baseIndex: 2, headerOrigin: { x: 99, y: -77 }, extra: { x: -10, y: -15, width: 4, height: 1, indices: [4, 0, 5, 4], z: [0, 31, 32, 255] } }] }), batch: null,
    viewports: [originalViewport({ cameraX: -10, cameraY: -15, width: 4, height: 1 })], probes: [
      { view: 0, x: 0, y: 0, expected: { kind: 'terrain', sourceRecord: 0, depth: -15, rgba: rgba(4) } },
      { view: 0, x: 1, y: 0, expected: { kind: 'none', rgba: background } },
      { view: 0, x: 2, y: 0, expected: { kind: 'none', rgba: background } },
      { view: 0, x: 3, y: 0, expected: { kind: 'terrain', depth: -15, rgba: rgba(4) } }] });
  cases.push({ id: 'sparse-far-extra', terrainInput: makeOriginalTerrain({ tiles: [{ extra: { x: 1048574, y: 1048574, width: 1, height: 1, indices: [4], z: [32] } }] }), batch: null,
    viewports: [originalViewport(), originalViewport({ cameraX: 1048573.5, cameraY: 1048573.5, width: 3, height: 3 })],
    probes: [{ view: 1, x: 0, y: 0, expected: { kind: 'terrain', depth: 1048574, rgba: rgba(4) } }] });
  cases.push({ id: 'terrain-record-tie', terrainInput: makeOriginalTerrain({ width: 2, elevations: [0, 0, 1], slots: [0, 1, 2],
    tiles: [{ baseIndex: 1 }, { baseIndex: 2 }, { baseIndex: 3, baseZ: 15, basePatches: [{ x: 16, y: 10, z: 14 }] }] }), batch: null,
    viewports: [originalViewport({ width: 120, height: 45 })], probes: [
      { view: 0, x: 45, y: 10, expected: { kind: 'terrain', sourceRecord: 0, depth: 10, rgba: rgba(1) } },
      { view: 0, x: 46, y: 10, expected: { kind: 'terrain', sourceRecord: 2, depth: 11, rgba: rgba(3) } }] });
  cases.push({ id: 'maximum-elevation', terrainInput: makeOriginalTerrain({ profile: 'yr', elevations: [255], elevationStep: 256 }), batch: null,
    viewports: [originalViewport({ cameraY: -65280 })], probes: [{ view: 0, x: 30, y: 10, expected: { kind: 'terrain', depth: 10, worldY: -65270 } }] });
  const p = originalPalette(), remap = Uint8Array.from({ length: 256 }, (_, i) => i);
  remap[0] = 2; remap[2] = 8; remap[3] = 9; remap[4] = 0; p.rgba[9 * 4 + 3] = 0;
  cases.push({ id: 'sprite-remap-canvas-offset', terrainInput: makeOriginalTerrain(), batch: makeOriginalSprites({
    frames: [{ id: 'frame', x: 3, y: 4, width: 4, height: 1, pixels: [0, 2, 3, 4] }], palettes: [{ ...p, remap }],
    objects: [originalObject({ x: 30, y: 10, anchorX: 5, anchorY: 5 })] }).batch,
    viewports: [originalViewport()], probes: [
      { view: 0, x: 28, y: 9, expected: { kind: 'terrain', depth: 9 } },
      { view: 0, x: 29, y: 9, expected: { kind: 'object', id: 'object', depth: 100, canvasX: 4, canvasY: 4, rgba: rgba(8) } },
      { view: 0, x: 30, y: 9, expected: { kind: 'terrain', depth: 9 } },
      { view: 0, x: 31, y: 9, expected: { kind: 'object', rgba: rgba(0) } }] });
  cases.push({ id: 'empty-and-opaque-zero', terrainInput: makeOriginalTerrain(), batch: makeOriginalSprites({ frames: [
    { id: 'empty', width: 0, height: 0 }, { id: 'zero', width: 1, height: 1, pixels: [0] }],
    palettes: [{ ...originalPalette(), transparentIndex: null }], objects: [originalObject({ id: 'empty', frameId: 'empty' }), originalObject({ id: 'zero', frameId: 'zero', x: 29 })] }).batch,
    viewports: [originalViewport()], probes: [{ view: 0, x: 28, y: 10, expected: { kind: 'terrain' } }, { view: 0, x: 29, y: 10, expected: { kind: 'object', id: 'zero', rgba: rgba(0) } }] });
  for (const terrain of ['equal', 'lower', 'transparent'] as const) {
    const palette = originalPalette().rgba; if (terrain === 'transparent') palette[7] = 0;
    cases.push({ id: `mixed-sprite-tie-${terrain}`, terrainInput: makeOriginalTerrain({ palette, tiles: [{ baseZ: terrain === 'lower' ? 1 : 0 }] }),
      batch: makeOriginalSprites({ frames: [{ id: 'a', width: 1, height: 1, pixels: [2] }, { id: 'b', width: 1, height: 1, pixels: [3] }], objects: [
        originalObject({ id: 'B', frameId: 'b', depth: { base: 10, rowStep: 0, terrainTie: 'front' } }),
        originalObject({ id: 'A', frameId: 'a', depth: { base: 10, rowStep: 0, terrainTie: 'behind' } })] }).batch,
      viewports: [originalViewport()], probes: [{ view: 0, x: 28, y: 10, expected: { kind: 'object', id: terrain === 'equal' ? 'B' : 'A', depth: 10, rgba: rgba(terrain === 'equal' ? 3 : 2) } }] });
  }
  cases.push({ id: 'sprite-row-depth-offset', terrainInput: makeOriginalTerrain(), batch: makeOriginalSprites({
    frames: [{ id: 'frame', x: 3, y: 4, width: 2, height: 3 }],
    objects: [originalObject({ x: 30, y: 10, anchorX: 5, anchorY: 5, depth: { base: 9, rowStep: 1, terrainTie: 'front' } })] }).batch,
    viewports: [originalViewport()], probes: [0, 1, 2].map(row => ({ view: 0, x: 28, y: 9 + row,
      expected: { kind: 'object' as const, depth: 9 + row, canvasX: 3, canvasY: 4 + row } })) });
  cases.push({ id: 'transparent-sprite-keeps-farther-object', terrainInput: makeOriginalTerrain(), batch: makeOriginalSprites({ frames: [
    { id: 'near', width: 3, height: 1, pixels: [0, 3, 4] }, { id: 'far', width: 3, height: 1, pixels: [2, 2, 2] }],
    palettes: [{ ...p, remap }], objects: [originalObject({ id: 'A', frameId: 'near' }),
      originalObject({ id: 'z', frameId: 'far', depth: { base: 50, rowStep: 0, terrainTie: 'behind' } })] }).batch,
    viewports: [originalViewport()], probes: [
      { view: 0, x: 28, y: 10, expected: { kind: 'object', id: 'z', depth: 50, rgba: rgba(8) } },
      { view: 0, x: 29, y: 10, expected: { kind: 'object', id: 'z', depth: 50, rgba: rgba(8) } },
      { view: 0, x: 30, y: 10, expected: { kind: 'object', id: 'A', depth: 100, rgba: rgba(0) } }] });
  cases.push({ id: 'signed-sprite-depth-extremes', terrainInput: makeOriginalTerrain(), batch: makeOriginalSprites({
    frames: [{ id: 'frame', width: 1, height: 1, pixels: [2] }], objects: [
      originalObject({ id: 'minimum', x: 100, y: 0, depth: { base: -1048576, rowStep: 0, terrainTie: 'front' } }),
      originalObject({ id: 'maximum', x: 101, y: 0, depth: { base: 1048576, rowStep: 0, terrainTie: 'behind' } })] }).batch,
    viewports: [originalViewport({ cameraX: 100, width: 2, height: 1 })], probes: [
      { view: 0, x: 0, y: 0, expected: { kind: 'object', id: 'minimum', depth: -1048576, rgba: rgba(2) } },
      { view: 0, x: 1, y: 0, expected: { kind: 'object', id: 'maximum', depth: 1048576, rgba: rgba(2) } }] });
  cases.push({ id: 'zoom-negative-fractional', terrainInput: makeOriginalTerrain(), batch: makeOriginalSprites({
    frames: [{ id: 'frame', width: 4, height: 3, pixels: [2, 0, 3, 4, 0, 4, 5, 6, 7, 8, 0, 9] }], objects: [originalObject({ x: -2, y: -1 })] }).batch,
    viewports: ([0.5, 1, 2, 4] as const).flatMap(zoom => [[-4.25, -3.5], [12.25, -9.5]].map(([cameraX, cameraY]) =>
      originalViewport({ zoom, cameraX: cameraX!, cameraY: cameraY!, width: 17, height: 11 }))), probes: [] });
  cases.push({ id: 'camera-binary64-boundary', terrainInput: makeOriginalTerrain(), batch: makeOriginalSprites({
    frames: [{ id: 'frame', width: 1, height: 1, pixels: [4] }], objects: [
      originalObject({ id: 'positive', x: 1048575, y: 0 }), originalObject({ id: 'negative', x: -1048576, y: 0 })] }).batch,
    viewports: [1048575.4999999999, -1048575.5000000001, 1048575.5, -1048575.5].map(cameraX => originalViewport({ cameraX, width: 2, height: 1 })),
    probes: [{ view: 0, x: 0, y: 0, expected: { kind: 'object', id: 'positive', worldX: 1048575, rgba: rgba(4) } },
      { view: 1, x: 0, y: 0, expected: { kind: 'object', id: 'negative', worldX: -1048576, rgba: rgba(4) } },
      { view: 2, x: 0, y: 0, expected: { kind: 'none', rgba: background } }, { view: 3, x: 0, y: 0, expected: { kind: 'none', rgba: background } }] });
  return cases;
}
