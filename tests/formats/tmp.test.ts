// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic TMP records and pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeTmpTile, parseTmpIndex, TMP_LIMITS, TmpError } from '../../packages/formats/src/tmp.ts';
interface TileSpec { extra?: boolean; noZ?: boolean; gap?: number; damaged?: boolean }
function fixture(width = 60, specs: (TileSpec | null)[] = [{}], gridWidth = specs.length) {
  const height = width / 2, packed = width * height / 2, tableEnd = 16 + specs.length * 4;
  const records = specs.map(spec => {
    if (!spec) return null;
    const extraSize = spec.extra ? 4 : 0, gap = spec.gap ?? 0;
    const extraOffset = 52 + packed * (spec.noZ ? 1 : 2) + gap;
    const bytes = new Uint8Array(extraOffset + extraSize * (spec.noZ ? 1 : 2)), view = new DataView(bytes.buffer);
    view.setInt32(0, -30, true); view.setInt32(4, 15, true);
    view.setInt32(8, extraOffset, true); view.setInt32(12, 52 + packed, true); view.setInt32(16, spec.extra ? extraOffset + extraSize : -842150451, true);
    view.setInt32(20, spec.extra ? -33 : -842150451, true); view.setInt32(24, spec.extra ? -17 : -842150451, true);
    view.setInt32(28, spec.extra ? 2 : -842150451, true); view.setInt32(32, spec.extra ? 2 : -842150451, true);
    view.setUint32(36, (0xcdcdcdc8 | (spec.extra ? 1 : 0) | (spec.noZ ? 0 : 2) | (spec.damaged ? 4 : 0)) >>> 0, true);
    bytes.set([5, 15, 3, 1, 2, 3, 4, 5, 6, 201, 202, 203], 40);
    for (let i = 0; i < packed; i++) { bytes[52 + i] = i % 256; if (!spec.noZ) bytes[52 + packed + i] = (i * 7) % 64; }
    if (spec.extra) { bytes.set([0, 5, 6, 7], extraOffset); if (!spec.noZ) bytes.set([0, 31, 32, 255], extraOffset + extraSize); }
    return bytes;
  });
  const bytes = new Uint8Array(tableEnd + records.reduce((sum, r) => sum + (r?.length ?? 0), 0)), view = new DataView(bytes.buffer);
  view.setUint32(0, gridWidth, true); view.setUint32(4, specs.length / gridWidth, true); view.setUint32(8, width, true); view.setUint32(12, height, true);
  let at = tableEnd;
  records.forEach((record, i) => { if (record) { view.setUint32(16 + i * 4, at, true); bytes.set(record, at); at += record.length; } });
  return { bytes, view, tableEnd, packed, width, height };
}
test('48/60 pixel diamonds unpack exact row locations with separate color/depth/mask and an empty final row', () => {
  for (const width of [48, 60]) {
    const f = fixture(width), decoded = decodeTmpTile(f.bytes, 0);
    assert.equal(decoded.width, width); assert.equal(decoded.height, width / 2);
    let packed = 0;
    for (let y = 0; y < f.height; y++) {
      const run = y < f.height / 2 ? (y + 1) * 4 : (f.height - y - 1) * 4;
      const left = (width - run) / 2;
      for (let x = 0; x < width; x++) {
        const at = y * width + x, inside = x >= left && x < left + run;
        assert.equal(decoded.mask[at], inside ? 1 : 0);
        assert.equal(decoded.pixels[at], inside ? packed % 256 : 0);
        assert.equal(decoded.zPixels[at], inside ? (packed * 7) % 64 : 0);
        if (inside) packed++;
      }
    }
    assert.equal(packed, f.packed); assert.equal(decoded.mask.reduce((sum, n) => sum + n, 0), f.packed);
    assert.equal(decoded.mask[(width - 4) / 2], 1); assert.equal(decoded.pixels[(width - 4) / 2], 0);
    assert.equal(decoded.extra, null);
  }
});
test('optional graphics keep signed placement, zero colors and all raw depth values without composition', () => {
  const f = fixture(60, [{ extra: true, damaged: true, gap: 3 }]), d = decodeTmpTile(f.bytes, 0), tile = d.tile;
  assert.deepEqual({ x: d.extra!.x, y: d.extra!.y, width: d.extra!.width, height: d.extra!.height }, { x: -33, y: -17, width: 2, height: 2 });
  assert.deepEqual([...d.extra!.pixels], [0, 5, 6, 7]); assert.deepEqual([...d.extra!.zPixels], [0, 31, 32, 255]);
  assert.equal(tile.hasDamaged, true); assert.equal(tile.reservedFlags, 0xcdcdcdc8);
  assert.deepEqual(tile.unclaimedRanges, [{ offset: f.tableEnd + 52 + f.packed * 2, size: 3 }]);
  assert.deepEqual(tile.reservedBytes, [201, 202, 203]); assert.deepEqual(tile.radarLeft, [1, 2, 3]); assert.deepEqual(tile.radarRight, [4, 5, 6]);
  assert.deepEqual([tile.heightByte, tile.terrainTypeByte, tile.rampTypeByte], [5, 15, 3]);
});
test('non-square index ordering, absent subtiles and physical order are explicit', () => {
  const f = fixture(60, [{}, null, {}, {}, null, {}], 2);
  // Index order may differ from physical record order.
  const first = f.view.getUint32(16, true), third = f.view.getUint32(24, true);
  f.view.setUint32(16, third, true); f.view.setUint32(24, first, true);
  const index = parseTmpIndex(f.bytes);
  assert.deepEqual([index.gridWidth, index.gridHeight, index.tiles.length], [2, 3, 6]);
  assert.equal(index.tiles[1], null); assert.equal(index.tiles[4], null);
  assert.deepEqual([index.tiles[5]!.column, index.tiles[5]!.row], [1, 2]);
  assert.equal(index.tiles[0]!.headerOffset, third); assert.equal(index.tiles[2]!.headerOffset, first);
  assert.throws(() => decodeTmpTile(f.bytes, 1), /tmp-empty-tile/);
  const empty = fixture(60, [null, null]); assert.deepEqual(parseTmpIndex(empty.bytes).tiles, [null, null]);
  for (const i of [-1, 0.5, NaN, 6]) assert.throws(() => decodeTmpTile(f.bytes, i), /tmp-tile-index/);
});
test('input views are copied, metadata is frozen and all decoded planes have independent ownership', () => {
  const f = fixture(60, [{ extra: true }]), backing = new Uint8Array(f.bytes.length + 7); backing.set(f.bytes, 3);
  const input = backing.subarray(3, 3 + f.bytes.length), index = parseTmpIndex(input), first = decodeTmpTile(input, 0);
  assert.ok(Object.isFrozen(index)); assert.ok(Object.isFrozen(index.tiles)); assert.ok(Object.isFrozen(index.tiles[0]!.radarLeft));
  assert.throws(() => { (index.tiles[0] as { x: number }).x = 100; }, TypeError);
  first.pixels.fill(99); first.mask.fill(99); first.zPixels.fill(99); first.extra!.pixels.fill(99); first.extra!.zPixels.fill(99);
  const second = decodeTmpTile(input, 0); assert.equal(second.pixels[28], 0); assert.equal(second.mask[28], 1); assert.equal(second.zPixels[28], 0);
  assert.deepEqual([...second.extra!.pixels], [0, 5, 6, 7]); assert.deepEqual([...second.extra!.zPixels], [0, 31, 32, 255]);
  new DataView(input.buffer, input.byteOffset).setUint32(16, 1, true);
  assert.equal(index.tiles[0]!.headerOffset, f.tableEnd);
  assert.throws(() => decodeTmpTile(input, 0), /tmp-header-range/); // A stale index never authorizes changed input.
});
test('header/index truncation, unsupported dimensions and excessive grids fail before pixel allocation', () => {
  const f = fixture();
  for (const end of [0, 15, 19, f.tableEnd + 51, f.tableEnd + 52 + f.packed - 1, f.bytes.length - 1]) assert.throws(() => decodeTmpTile(f.bytes.subarray(0, end), 0), TmpError);
  for (const [at, value, code] of [[0, 0, 'grid-limit'], [0, 0xffffffff, 'grid-limit'], [4, 0xffffffff, 'grid-limit'], [8, 64, 'unsupported-dimensions'], [12, 31, 'unsupported-dimensions'], [16, 1, 'header-range'], [16, 0xffffffff, 'header-range']] as const) {
    const changed = new Uint8Array(f.bytes); new DataView(changed.buffer).setUint32(at, value, true);
    assert.throws(() => parseTmpIndex(changed), new RegExp(code));
  }
});
test('shared headers, crossing records and overlapping/overflowing optional planes fail closed', () => {
  const f = fixture(60, [{ extra: true }, {}]);
  for (const mutate of [
    (v: DataView) => v.setUint32(20, f.tableEnd, true),
    (v: DataView) => v.setUint32(20, f.tableEnd + 30, true),
    (v: DataView) => v.setUint32(20, f.tableEnd + 60, true),
    (v: DataView) => v.setInt32(f.tableEnd + 12, 52, true),
    (v: DataView) => v.setInt32(f.tableEnd + 8, 100, true),
    (v: DataView) => v.setInt32(f.tableEnd + 16, 0x7fffffff, true),
    (v: DataView) => v.setInt32(f.tableEnd + 16, -1, true),
  ]) { const changed = new Uint8Array(f.bytes); mutate(new DataView(changed.buffer)); assert.throws(() => parseTmpIndex(changed), TmpError); }
});
test('limits cannot be raised or bypassed with metadata shadows; output area includes the optional plane', () => {
  const f = fixture(60, [{ extra: true }]);
  for (const options of [{ fileBytes: f.bytes.length - 1 }, { pixels: 1803 }, { extraDimension: 1 }, { tiles: 0 }, { tiles: TMP_LIMITS.tiles + 1 }, { pixels: NaN }, { unknown: 1 }]) {
    assert.throws(() => decodeTmpTile(f.bytes, 0, options), TmpError);
  }
  assert.equal(decodeTmpTile(f.bytes, 0, { pixels: 1804 }).extra!.pixels.length, 4);
  const shadowed = new Uint8Array(TMP_LIMITS.fileBytes + 1);
  Object.defineProperties(shadowed, { byteLength: { value: 16 }, buffer: { value: new ArrayBuffer(16) } });
  assert.throws(() => parseTmpIndex(shadowed), /tmp-input-size/);
  assert.throws(() => parseTmpIndex(new Uint8Array(new SharedArrayBuffer(20))), /tmp-input-size/);
  for (const dimension of [0, -1, 2049, 0x7fffffff]) { const changed = new Uint8Array(f.bytes); new DataView(changed.buffer).setInt32(f.tableEnd + 28, dimension, true); assert.throws(() => parseTmpIndex(changed), /tmp-extra-dimensions/); }
});
test('absent depth remains inspectable metadata but is an explicit unsupported decode, not fabricated zeros', () => {
  const f = fixture(60, [{ noZ: true }]), index = parseTmpIndex(f.bytes);
  assert.equal(index.tiles[0]!.hasZ, false); assert.equal(index.tiles[0]!.zRange, null);
  assert.equal(index.tiles[0]!.extraWidth, -842150451); // Inactive unknown fields are preserved, not trusted as dimensions.
  assert.throws(() => decodeTmpTile(f.bytes, 0), /tmp-unsupported-no-z/);
});
