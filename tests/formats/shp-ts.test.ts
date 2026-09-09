// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShpIndex, decodeShpFrame, decodeShpPalette, shpRgba, SHP_LIMITS } from '../../packages/formats/src/shp-ts.ts';
function fixture(rows = [[1, 2, 3], [4, 5, 6]]) {
  const width = rows[0]!.length, height = rows.length;
  const bytes = new Uint8Array(32 + (width + 2) * height), d = new DataView(bytes.buffer);
  d.setUint16(2, width + 2, true); d.setUint16(4, height + 2, true); d.setUint16(6, 1, true);
  d.setUint16(8, 1, true); d.setUint16(10, 1, true); d.setUint16(12, width, true); d.setUint16(14, height, true);
  d.setUint8(16, 2); d.setUint32(28, 32, true);
  for (const [i, row] of rows.entries()) {const at = 32 + i * (width + 2); d.setUint16(at, width + 2, true); bytes.set(row, at + 2);}
  return bytes;
}
function modified(offset: number, value: number, bits = 16) {
  const b = fixture(), d = new DataView(b.buffer);
  if (bits === 8) d.setUint8(offset, value); else if (bits === 16) d.setUint16(offset, value, true); else d.setUint32(offset, value, true);
  return b;
}
test('format2 consumes each row prefix and keeps odd geometry/source offsets exact', () => {
  const backing = new Uint8Array(60); backing.set(fixture(), 3);
  const result = decodeShpFrame(backing.subarray(3, 45), 0);
  assert.deepEqual([...result.pixels], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([result.frame.x, result.frame.y, result.frame.width, result.frame.height], [1, 1, 3, 2]);
  assert.equal(result.frame.headerOffset, 8); assert.equal(result.frame.dataOffset, 32);
  assert.equal(result.consumedBytes, 10); assert.equal(result.trailingBytes, 0);
  assert.ok(Object.isFrozen(result.index.frames));
});
test('every truncated prefix or pixel boundary rejects without an apparent decoded frame', () => {
  const b = fixture();
  for (let i = 0; i < b.length; i++) assert.throws(() => decodeShpFrame(b.subarray(0, i), 0));
});
test('table, dimension, rectangle, codec and unsupported empty records fail explicitly', () => {
  for (const b of [modified(0, 1), modified(2, 0), modified(2, SHP_LIMITS.dimension + 1), modified(6, 0), modified(6, 1025), modified(8, 5), modified(12, 0), modified(28, 0, 32), modified(28, 16, 32), modified(28, 99, 32)]) assert.throws(() => parseShpIndex(b));
  for (const format of [0, 1, 3, 255]) assert.throws(() => parseShpIndex(modified(16, format, 8)), /unsupported-format/);
  for (const index of [-1, 1, 0.1, NaN]) assert.throws(() => decodeShpFrame(fixture(), index), /frame-index/);
});
test('row lengths, zero ambiguity and excessive input reject before interpreting other rows', () => {
  for (const length of [0, 1, 2, 4, 6, 65535]) assert.throws(() => decodeShpFrame(modified(32, length), 0), /row-length/);
  assert.throws(() => decodeShpFrame(fixture([[1, 0, 2], [3, 4, 5]]), 0), /format2-zero/);
  assert.throws(() => parseShpIndex(new Uint8Array(SHP_LIMITS.fileBytes + 1)), /input-size/);
});
test('one frame cannot consume its following frame data and shared offsets stay unsupported', () => {
  const b = new Uint8Array(70), d = new DataView(b.buffer);
  b.set(fixture().subarray(0, 32)); d.setUint16(6, 2, true); b.set(b.subarray(8, 32), 32);
  d.setUint32(28, 56, true); d.setUint32(52, 61, true);
  b.set([5, 0, 1, 2, 3, 5, 0, 4, 5, 6], 56);
  assert.throws(() => decodeShpFrame(b, 0), /row-truncated/);
  d.setUint32(52, 56, true); assert.throws(() => parseShpIndex(b), /shared-frame-offset/);
});
test('native-observed palette shift, RGB ordering and output alpha match explicit synthetic values', () => {
  const pal = new Uint8Array(768); pal.set([0, 16, 63, 1, 2, 3]);
  const rgba = decodeShpPalette(pal);
  assert.deepEqual([...rgba.subarray(0, 8)], [0, 64, 252, 255, 4, 8, 12, 255]);
  assert.deepEqual([...shpRgba(Uint8Array.of(1, 0), rgba)], [4, 8, 12, 255, 0, 64, 252, 255]);
  assert.throws(() => decodeShpPalette(pal.subarray(0, 767)), /palette-size/);
  pal[0] = 64; assert.throws(() => decodeShpPalette(pal), /six-bit/);
  assert.throws(() => shpRgba(new Uint8Array(0), rgba), /rgba-size/);
  assert.throws(() => shpRgba(Uint8Array.of(1), new Uint8Array(768)), /rgba-size/);
});
