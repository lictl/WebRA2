// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
// Format/palette reference: OpenRA Developers and Contributors; see ../shp-PROVENANCE.md.
export const SHP_LIMITS = Object.freeze({ fileBytes: 16 * 1024 * 1024, frames: 1024, dimension: 2048, pixels: 4 * 1024 * 1024 });
export class ShpError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'ShpError'; }
}
export interface ShpFrame {
  readonly ordinal: number; readonly headerOffset: number; readonly x: number; readonly y: number;
  readonly width: number; readonly height: number; readonly format: number;
  readonly dataOffset: number; readonly dataEnd: number;
}
export interface ShpIndex { readonly width: number; readonly height: number; readonly tableEnd: number; readonly frames: readonly ShpFrame[] }
const fail = (code: string): never => { throw new ShpError(code); };
function data(bytes: Uint8Array): DataView {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > SHP_LIMITS.fileBytes) fail('shp-input-size');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
/** Explicit M0 subset: nonempty format-2 frames with length-prefixed literal rows. */
export function parseShpIndex(bytes: Uint8Array): ShpIndex {
  const view = data(bytes);
  if (view.getUint16(0, true) !== 0) fail('shp-signature');
  const width = view.getUint16(2, true), height = view.getUint16(4, true), count = view.getUint16(6, true);
  if (!width || !height || width > SHP_LIMITS.dimension || height > SHP_LIMITS.dimension || width * height > SHP_LIMITS.pixels) fail('shp-dimensions');
  if (!count || count > SHP_LIMITS.frames || 8 + count * 24 > bytes.length) fail('shp-frame-table');
  const tableEnd = 8 + count * 24;
  const records: Omit<ShpFrame, 'dataEnd'>[] = [];
  const offsets = new Set<number>();
  for (let ordinal = 0; ordinal < count; ordinal++) {
    const at = 8 + ordinal * 24;
    const x = view.getUint16(at, true), y = view.getUint16(at + 2, true);
    const w = view.getUint16(at + 4, true), h = view.getUint16(at + 6, true);
    const format = view.getUint8(at + 8), offset = view.getUint32(at + 20, true);
    if (format !== 2) fail('shp-unsupported-format');
    if (!w || !h || !offset) fail('shp-unsupported-empty-frame');
    if (x + w > width || y + h > height) fail('shp-frame-rectangle');
    if (offset < tableEnd || offset > bytes.length - 2) fail('shp-data-offset');
    if (offsets.has(offset)) fail('shp-unsupported-shared-frame-offset');
    offsets.add(offset); records.push({ ordinal, headerOffset: at, x, y, width: w, height: h, format, dataOffset: offset });
  }
  const sorted = [...offsets].sort((a, b) => a - b);
  const endByOffset = new Map(sorted.map((offset, i) => [offset, sorted[i + 1] ?? bytes.length]));
  const frames = records.map(record => Object.freeze({ ...record, dataEnd: endByOffset.get(record.dataOffset)! }));
  return Object.freeze({ width, height, tableEnd, frames: Object.freeze(frames) });
}
/** Zero-valued format-2 bytes are unresolved across references and fail explicitly. */
export function decodeShpFrame(bytes: Uint8Array, ordinal: number) {
  const index = parseShpIndex(bytes);
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= index.frames.length) fail('shp-frame-index');
  const frame = index.frames[ordinal]!;
  const view = data(bytes);
  const pixels = new Uint8Array(frame.width * frame.height);
  let at = frame.dataOffset;
  for (let row = 0; row < frame.height; row++) {
    if (at + 2 > frame.dataEnd) fail('shp-row-truncated');
    const length = view.getUint16(at, true);
    if (length !== frame.width + 2) fail('shp-unsupported-row-length');
    if (length > frame.dataEnd - at) fail('shp-row-truncated');
    const values = bytes.subarray(at + 2, at + length);
    if (values.includes(0)) fail('shp-unsupported-format2-zero');
    pixels.set(values, row * frame.width); at += length;
  }
  return { index, frame, pixels, consumedBytes: at - frame.dataOffset, trailingBytes: frame.dataEnd - at };
}
/** Six-bit PAL RGB to opaque RGBA using the observed native <<2 expansion. No remap, shadows, lighting or transparency policy. */
export function decodeShpPalette(bytes: Uint8Array): Uint8Array {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 768) fail('palette-size');
  const rgba = new Uint8Array(1024);
  for (let index = 0; index < 256; index++) {
    for (let channel = 0; channel < 3; channel++) {
      const value = bytes[index * 3 + channel]!;
      if (value > 63) fail('palette-not-six-bit');
      rgba[index * 4 + channel] = value << 2;
    }
    rgba[index * 4 + 3] = 255;
  }
  return rgba;
}
export function shpRgba(pixels: Uint8Array, palette: Uint8Array): Uint8Array {
  if (!(pixels instanceof Uint8Array) || !pixels.length || pixels.length > SHP_LIMITS.pixels ||
      !(palette instanceof Uint8Array) || palette.length !== 1024) fail('shp-rgba-size');
  const rgba = new Uint8Array(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) rgba.set(palette.subarray(pixels[i]! * 4, pixels[i]! * 4 + 4), i * 4);
  return rgba;
}
