// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
// Diamond unpacking/header layout: OpenRA Developers and Contributors and
// Olaf van der Spek (XCC). See ../TMP_PROVENANCE.md.
export interface TmpLimits { readonly fileBytes: number; readonly tiles: number; readonly extraDimension: number; readonly pixels: number }
export const TMP_LIMITS: TmpLimits = Object.freeze({ fileBytes: 16 * 1024 * 1024, tiles: 4096, extraDimension: 2048, pixels: 4 * 1024 * 1024 });
export class TmpError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'TmpError'; }
}
export interface TmpRange { readonly offset: number; readonly size: number }
export interface TmpTile {
  readonly ordinal: number; readonly column: number; readonly row: number;
  readonly headerOffset: number; readonly recordEnd: number;
  readonly x: number; readonly y: number;
  readonly extraOffset: number; readonly zOffset: number; readonly extraZOffset: number;
  readonly extraX: number; readonly extraY: number; readonly extraWidth: number; readonly extraHeight: number;
  readonly flags: number; readonly reservedFlags: number;
  readonly hasExtra: boolean; readonly hasZ: boolean; readonly hasDamaged: boolean;
  /** Uninterpreted header bytes: no terrain movement, ramp or damage-state policy. */
  readonly heightByte: number; readonly terrainTypeByte: number; readonly rampTypeByte: number;
  readonly radarLeft: readonly number[]; readonly radarRight: readonly number[]; readonly reservedBytes: readonly number[];
  readonly colorRange: TmpRange; readonly zRange: TmpRange | null;
  readonly extraRange: TmpRange | null; readonly extraZRange: TmpRange | null;
  readonly unclaimedRanges: readonly TmpRange[];
}
export interface TmpIndex {
  readonly gridWidth: number; readonly gridHeight: number;
  readonly tileWidth: number; readonly tileHeight: number; readonly tableEnd: number;
  /** An explicitly absent index slot is null; it is not a decoded blank tile. */
  readonly tiles: readonly (TmpTile | null)[];
  readonly unclaimedRanges: readonly TmpRange[];
}
export interface DecodedTmpTile {
  readonly index: TmpIndex; readonly tile: TmpTile;
  readonly width: number; readonly height: number;
  /** Owned rectangular planes; mask identifies the diamond independently of color index zero. */
  readonly pixels: Uint8Array; readonly zPixels: Uint8Array; readonly mask: Uint8Array;
  readonly extra: null | {
    readonly x: number; readonly y: number; readonly width: number; readonly height: number;
    readonly pixels: Uint8Array; readonly zPixels: Uint8Array;
  };
}
function fail(code: string): never { throw new TmpError(code); }
function limits(input: Partial<TmpLimits> = {}): TmpLimits {
  const result = { ...TMP_LIMITS };
  for (const key of Object.keys(input)) if (!Object.hasOwn(TMP_LIMITS, key)) fail('tmp-limit-key');
  for (const key of Object.keys(TMP_LIMITS) as (keyof TmpLimits)[]) {
    const value = input[key] ?? TMP_LIMITS[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > TMP_LIMITS[key]) fail('tmp-limit');
    result[key] = value;
  }
  return result;
}
// Copy once before reading headers/pixels. No caller-provided index can authorize
// a later buffer; shared memory is unsupported because it cannot be snapshotted atomically.
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const byteLengthOf = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
function snapshot(input: Uint8Array, cap: number): Uint8Array {
  if (!(input instanceof Uint8Array)) fail('tmp-input-size');
  const size = byteLengthOf.call(input) as number;
  if (!(bufferOf.call(input) instanceof ArrayBuffer) || size < 16 || size > cap) fail('tmp-input-size');
  const copy = new Uint8Array(size); Uint8Array.prototype.set.call(copy, input); return copy;
}
function range(offset: number, size: number): TmpRange { return Object.freeze({ offset, size }); }
function parse(bytes: Uint8Array, cap: TmpLimits): TmpIndex {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (at: number) => view.getUint32(at, true), i32 = (at: number) => view.getInt32(at, true);
  const gridWidth = u32(0), gridHeight = u32(4), tileWidth = u32(8), tileHeight = u32(12);
  if (!gridWidth || !gridHeight || gridWidth > cap.tiles || gridHeight > Math.floor(cap.tiles / gridWidth)) fail('tmp-grid-limit');
  if ((tileWidth !== 48 && tileWidth !== 60) || tileHeight * 2 !== tileWidth) fail('tmp-unsupported-dimensions');
  const count = gridWidth * gridHeight, tableEnd = 16 + count * 4, packedSize = tileWidth * tileHeight / 2;
  if (tableEnd > bytes.length) fail('tmp-index-truncated');
  const offsets: number[] = [], occupied = new Set<number>();
  for (let i = 0; i < count; i++) {
    const offset = u32(16 + i * 4); offsets.push(offset);
    if (!offset) continue;
    if (offset < tableEnd || offset > bytes.length - 52) fail('tmp-header-range');
    if (occupied.has(offset)) fail('tmp-shared-tile-offset');
    occupied.add(offset);
  }
  const sorted = [...occupied].sort((a, b) => a - b);
  const endByOffset = new Map(sorted.map((offset, i) => [offset, sorted[i + 1] ?? bytes.length]));
  const tiles = offsets.map((offset, ordinal): TmpTile | null => {
    if (!offset) return null;
    const recordEnd = endByOffset.get(offset)!;
    if (recordEnd - offset < 52) fail('tmp-overlapping-header');
    const extraOffset = i32(offset + 8), zOffset = i32(offset + 12), extraZOffset = i32(offset + 16);
    const extraX = i32(offset + 20), extraY = i32(offset + 24), extraWidth = i32(offset + 28), extraHeight = i32(offset + 32);
    const flags = u32(offset + 36), hasExtra = Boolean(flags & 1), hasZ = Boolean(flags & 2), hasDamaged = Boolean(flags & 4);
    const used: TmpRange[] = [range(offset, 52)];
    function plane(relative: number, size: number): TmpRange {
      if (relative < 52 || relative > recordEnd - offset || size > recordEnd - offset - relative) fail('tmp-plane-range');
      const result = range(offset + relative, size); used.push(result); return result;
    }
    const colorRange = plane(52, packedSize), zRange = hasZ ? plane(zOffset, packedSize) : null;
    let extraRange: TmpRange | null = null, extraZRange: TmpRange | null = null;
    if (hasExtra) {
      if (extraWidth < 1 || extraHeight < 1 || extraWidth > cap.extraDimension || extraHeight > cap.extraDimension) fail('tmp-extra-dimensions');
      const extraPixels = extraWidth * extraHeight;
      if (extraPixels > cap.pixels - tileWidth * tileHeight) fail('tmp-pixel-limit');
      extraRange = plane(extraOffset, extraPixels);
      if (hasZ) extraZRange = plane(extraZOffset, extraPixels);
    } else if (tileWidth * tileHeight > cap.pixels) fail('tmp-pixel-limit');
    used.sort((a, b) => a.offset - b.offset);
    const unclaimed: TmpRange[] = [];
    let at = offset;
    for (const part of used) {
      if (part.offset < at) fail('tmp-overlapping-planes');
      if (part.offset > at) unclaimed.push(range(at, part.offset - at));
      at = part.offset + part.size;
    }
    if (at < recordEnd) unclaimed.push(range(at, recordEnd - at));
    const bytesAt = (at: number, size: number) => Object.freeze(Array.from(bytes.subarray(at, at + size)));
    return Object.freeze({ ordinal, column: ordinal % gridWidth, row: Math.floor(ordinal / gridWidth), headerOffset: offset, recordEnd,
      x: i32(offset), y: i32(offset + 4), extraOffset, zOffset, extraZOffset, extraX, extraY, extraWidth, extraHeight,
      flags, reservedFlags: (flags & 0xfffffff8) >>> 0, hasExtra, hasZ, hasDamaged,
      heightByte: bytes[offset + 40]!, terrainTypeByte: bytes[offset + 41]!, rampTypeByte: bytes[offset + 42]!,
      radarLeft: bytesAt(offset + 43, 3), radarRight: bytesAt(offset + 46, 3), reservedBytes: bytesAt(offset + 49, 3),
      colorRange, zRange, extraRange, extraZRange, unclaimedRanges: Object.freeze(unclaimed) });
  });
  const first = sorted[0] ?? bytes.length;
  return Object.freeze({ gridWidth, gridHeight, tileWidth, tileHeight, tableEnd, tiles: Object.freeze(tiles),
    unclaimedRanges: Object.freeze(first > tableEnd ? [range(tableEnd, first - tableEnd)] : []) });
}
/** Bounded immutable metadata only. Does not retain input bytes or claim a source hash. */
export function parseTmpIndex(input: Uint8Array, options?: Partial<TmpLimits>): TmpIndex {
  const cap = limits(options); return parse(snapshot(input, cap.fileBytes), cap);
}
/** Decode one selected subtile, reparsing a detached source snapshot before allocation. */
export function decodeTmpTile(input: Uint8Array, ordinal: number, options?: Partial<TmpLimits>): DecodedTmpTile {
  const cap = limits(options), bytes = snapshot(input, cap.fileBytes), index = parse(bytes, cap);
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= index.tiles.length) fail('tmp-tile-index');
  const tile = index.tiles[ordinal];
  if (!tile) fail('tmp-empty-tile');
  if (!tile.hasZ || !tile.zRange || (tile.hasExtra && !tile.extraZRange)) fail('tmp-unsupported-no-z');
  const width = index.tileWidth, height = index.tileHeight;
  const pixels = new Uint8Array(width * height), zPixels = new Uint8Array(width * height), mask = new Uint8Array(width * height);
  let packed = 0;
  for (let y = 0; y < height; y++) {
    const run = y < height / 2 ? 4 * (y + 1) : 4 * (height - y - 1);
    const start = y * width + (width - run) / 2;
    pixels.set(bytes.subarray(tile.colorRange.offset + packed, tile.colorRange.offset + packed + run), start);
    zPixels.set(bytes.subarray(tile.zRange.offset + packed, tile.zRange.offset + packed + run), start);
    mask.fill(1, start, start + run); packed += run;
  }
  const extra = tile.hasExtra ? Object.freeze({ x: tile.extraX, y: tile.extraY, width: tile.extraWidth, height: tile.extraHeight,
    pixels: bytes.slice(tile.extraRange!.offset, tile.extraRange!.offset + tile.extraRange!.size),
    zPixels: bytes.slice(tile.extraZRange!.offset, tile.extraZRange!.offset + tile.extraZRange!.size) }) : null;
  return Object.freeze({ index, tile, width, height, pixels, zPixels, mask, extra });
}
