// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic fixtures.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuntimeShp, ShpRuntimeError, SHP_RUNTIME_LIMITS } from '../../packages/formats/src/shp-runtime.ts';

type Frame = { width: number; height: number; format: number; data?: number[]; x?: number; y?: number;
  unknown?: number; reserved?: number; share?: number };
function shp(rows: Frame[], width = 8, height = 8): Uint8Array {
  const table = 8 + rows.length * 24, size = table + rows.reduce((n, r) => n + (r.data?.length ?? 0), 0);
  const bytes = new Uint8Array(size), v = new DataView(bytes.buffer), offsets: number[] = [];
  v.setUint16(2, width, true); v.setUint16(4, height, true); v.setUint16(6, rows.length, true);
  let offset = table;
  rows.forEach((r, i) => {
    const at = 8 + i * 24;
    v.setUint16(at, r.x ?? 0, true); v.setUint16(at + 2, r.y ?? 0, true);
    v.setUint16(at + 4, r.width, true); v.setUint16(at + 6, r.height, true);
    v.setUint32(at + 8, r.format, true); v.setUint32(at + 12, r.unknown ?? 0, true); v.setUint32(at + 16, r.reserved ?? 0, true);
    const actual = r.share !== undefined ? offsets[r.share]! : r.data ? offset : 0;
    offsets.push(actual); v.setUint32(at + 20, actual, true);
    if (r.data) { bytes.set(r.data, offset); offset += r.data.length; }
  }); return bytes;
}
function row(...data: number[]): number[] { return [data.length + 2, 0, ...data]; }
function code(fn: () => unknown, expected: string): void {
  assert.throws(fn, (e: unknown) => e instanceof ShpRuntimeError && e.code === expected);
}
function selected(format: number, data: number[], width = 3, height = 1) {
  return createRuntimeShp(shp([{ width, height, format, data }])).decodeFrame(0);
}

test('raw formats preserve exact indexed rectangles, offsets and uninterpreted words', () => {
  for (const format of [0, 1]) {
    const decoder = createRuntimeShp(shp([{ width: 3, height: 2, x: 2, y: 1, format,
      data: [0, 2, 255, 4, 0, 6], unknown: 0xfedcba98, reserved: 0x87654321 }]));
    const frame = decoder.decodeFrame(0);
    assert.deepEqual([...frame.copyPixels()], [0, 2, 255, 4, 0, 6]);
    assert.equal(frame.zeroIndexCount, 2); assert.equal(frame.pixelCount, 6);
    assert.equal(frame.frame.x, 2); assert.equal(frame.frame.y, 1);
    assert.equal(frame.frame.unknownWord, 0xfedcba98); assert.equal(frame.frame.reservedWord, 0x87654321);
    assert.equal(decoder.nativeRenderingVerified, false); assert.equal(frame.consumedBytes, 6);
  }
});

test('format3 decodes consecutive rows with exact nonzero literals and zero runs', () => {
  const output = selected(3, [...row(1, 0, 2, 7, 8), ...row(0, 1, 2, 3, 0, 2)], 5, 2);
  assert.deepEqual([...output.copyPixels()], [1, 0, 0, 7, 8, 0, 2, 3, 0, 0]);
  assert.equal(output.clippedTerminalZeroRuns, 0); assert.equal(output.zeroIndexCount, 5);
});

test('terminal zero-run clipping is explicit and cannot erase a later literal', () => {
  const output = selected(3, [...row(4, 0, 3), ...row(0, 255)], 3, 2);
  assert.deepEqual([...output.copyPixels()], [4, 0, 0, 0, 0, 0]);
  assert.equal(output.clippedTerminalZeroRuns, 2); assert.equal(output.clippedZeroIndices, 253);
  code(() => selected(3, row(4, 0, 3, 5)), 'shp-nonterminal-zero-overrun');
  code(() => selected(3, row(1, 2, 3, 4)), 'shp-row-overrun');
});

test('zero-length runs consume input, while missing pixels and malformed runs reject', () => {
  const output = selected(3, row(0, 0, 1, 2, 3));
  assert.deepEqual([...output.copyPixels()], [1, 2, 3]); assert.equal(output.zeroLengthRuns, 1);
  code(() => selected(3, row(1, 2)), 'shp-row-underfill');
  code(() => selected(3, row()), 'shp-row-underfill');
  code(() => selected(3, row(1, 2, 0)), 'shp-truncated-zero-run');
  code(() => selected(3, [1, 0]), 'shp-row-length');
  code(() => selected(3, [7, 0, 1]), 'shp-truncated-row');
});

test('format2 accepts only the evidenced per-row nonzero literal subset', () => {
  assert.deepEqual([...selected(2, [...row(1, 2, 3), ...row(4, 5, 6)], 3, 2).copyPixels()], [1, 2, 3, 4, 5, 6]);
  code(() => selected(2, row(0, 2, 3)), 'shp-format2-ambiguous');
  code(() => selected(2, row(1, 2)), 'shp-format2-ambiguous');
});

test('empty records differ from nonempty frames filled with index zero', () => {
  const decoder = createRuntimeShp(shp([
    { width: 0, height: 0, x: 65535, y: 65535, format: 3 },
    { width: 3, height: 1, format: 3, data: row(0, 3) },
  ]));
  const empty = decoder.decodeFrame(0), zero = decoder.decodeFrame(1);
  assert.equal(empty.frame.empty, true); assert.equal(empty.frame.payloadOwner, null);
  assert.equal(empty.pixelCount, 0); assert.equal(empty.trailingBytes, 0);
  assert.deepEqual([...empty.copyPixels()], []);
  assert.equal(zero.frame.empty, false); assert.equal(zero.zeroIndexCount, 3);
  code(() => createRuntimeShp(shp([{ width: 1, height: 1, format: 3 }])), 'shp-frame-offset');
  code(() => createRuntimeShp(shp([{ width: 0, height: 1, format: 3 }])), 'shp-frame-rectangle');
});

test('compatible shared offsets decode independently and retain placement metadata', () => {
  const decoder = createRuntimeShp(shp([
    { width: 3, height: 1, format: 3, data: row(6, 0, 2) },
    { width: 3, height: 1, format: 3, share: 0, x: 2, y: 3 },
  ]));
  assert.deepEqual([...decoder.decodeFrame(0).copyPixels()], [...decoder.decodeFrame(1).copyPixels()]);
  assert.equal(decoder.frames[1]!.payloadOwner, 0); assert.equal(decoder.frames[0]!.sharedFrameCount, 2);
  assert.equal(decoder.frames[1]!.x, 2);
  for (const second of [{ width: 2, height: 1, format: 3 }, { width: 3, height: 1, format: 1 }]) {
    code(() => createRuntimeShp(shp([{ width: 3, height: 1, format: 3, data: row(1, 2, 3) }, { ...second, share: 0 }])), 'shp-shared-layout');
  }
});

test('next distinct offset bounds rows even when frame-table offsets are unordered', () => {
  const bytes = shp([{ width: 3, height: 1, format: 3, data: [10, 0, 1] },
    { width: 3, height: 1, format: 3, data: row(4, 5, 6) }]);
  const v = new DataView(bytes.buffer), first = v.getUint32(28, true), second = v.getUint32(52, true);
  v.setUint32(28, second, true); v.setUint32(52, first, true);
  const decoder = createRuntimeShp(bytes);
  assert.deepEqual([...decoder.decodeFrame(0).copyPixels()], [4, 5, 6]);
  code(() => decoder.decodeFrame(1), 'shp-truncated-row');
});

test('padding remains unconsumed metadata and indexing does not certify payloads', () => {
  const output = selected(3, [...row(1, 2, 3), 9, 8, 7]);
  assert.equal(output.trailingBytes, 3); assert.equal(output.consumedBytes, 5);
  const decoder = createRuntimeShp(shp([{ width: 3, height: 1, format: 3, data: [9] }]));
  assert.equal(decoder.frames.length, 1); code(() => decoder.decodeFrame(0), 'shp-truncated-row-header');
});

test('all truncations of complete raw and zero-run samples fail at index or decode', () => {
  for (const [format, payload] of [[1, [1, 2, 3]], [3, [...row(1, 0, 2), ...row(4, 5, 6)]]] as const) {
    const bytes = shp([{ width: 3, height: format === 1 ? 1 : 2, format, data: [...payload] }]);
    for (let n = 0; n < bytes.length; n++) assert.throws(() => createRuntimeShp(bytes.slice(0, n)).decodeFrame(0), ShpRuntimeError);
  }
});

test('geometry, signature, frame/byte/pixel limits and ordinal checks reject', () => {
  const bytes = shp([{ width: 3, height: 1, format: 1, data: [1, 2, 3] }]);
  for (const options of [{ fileBytes: bytes.length - 1 }, { frames: 0 }, { dimension: 7 }, { framePixels: 2 }]) assert.throws(() => createRuntimeShp(bytes, options), ShpRuntimeError);
  for (const ordinal of [-1, -0, 0.1, NaN, Infinity, 1]) code(() => createRuntimeShp(bytes).decodeFrame(ordinal), 'shp-frame-ordinal');
  code(() => createRuntimeShp(shp([{ width: 3, height: 1, x: 7, format: 1, data: [1, 2, 3] }])), 'shp-frame-rectangle');
  const signature = bytes.slice(); signature[0] = 1; code(() => createRuntimeShp(signature), 'shp-signature');
  for (const offset of [8, bytes.length, 0xffffffff]) {
    const broken = bytes.slice(); new DataView(broken.buffer).setUint32(28, offset, true);
    code(() => createRuntimeShp(broken), 'shp-frame-offset');
  }
});

test('unknown mode bytes are preserved then rejected without masking their low-byte bits', () => {
  for (const format of [4, 7, 0x80, 0xabcd1204, 0xffffffff]) {
    const decoder = createRuntimeShp(shp([{ width: 3, height: 1, format, data: row(1, 2, 3) }]));
    assert.equal(decoder.frames[0]!.compressionWord, format);
    assert.equal(decoder.frames[0]!.compressionByte, format & 255);
    code(() => decoder.decodeFrame(0), 'shp-unsupported-compression');
  }
});

test('compression dispatch reads the mode byte and preserves all higher flag bytes independently', () => {
  for (const mode of [0, 1, 2, 3]) {
    const format = 0xabcd1200 + mode, data = mode < 2 ? [1, 2, 3] : row(1, 2, 3);
    const decoder = createRuntimeShp(shp([{ width: 3, height: 1, format, data }]));
    assert.equal(decoder.frames[0]!.compressionWord, format); assert.equal(decoder.frames[0]!.compressionByte, mode);
    assert.deepEqual(decoder.frames[0]!.auxiliaryBytes, [0x12, 0xcd, 0xab]); assert.ok(Object.isFrozen(decoder.frames[0]!.auxiliaryBytes));
    assert.deepEqual([...decoder.decodeFrame(0).copyPixels()], [1, 2, 3]);
    assert.throws(() => { (decoder.frames[0]!.auxiliaryBytes as unknown as number[])[0] = 0; }, TypeError);
  }
});

test('shared payloads compare decode mode and dimensions while retaining different per-frame flag bytes', () => {
  const decoder = createRuntimeShp(shp([{ width: 3, height: 1, format: 0xabcd1203, data: row(1, 2, 3) },
    { width: 3, height: 1, format: 0x54321003, share: 0, x: 2, y: 3 }]));
  assert.deepEqual(decoder.frames.map(f => f.auxiliaryBytes), [[0x12, 0xcd, 0xab], [0x10, 0x32, 0x54]]);
  assert.equal(decoder.frames[1]!.payloadOwner, 0); assert.equal(decoder.frames[0]!.sharedFrameCount, 2);
  assert.deepEqual([...decoder.decodeFrame(0).copyPixels()], [...decoder.decodeFrame(1).copyPixels()]);
  code(() => createRuntimeShp(shp([{ width: 3, height: 1, format: 0xabcd1203, data: row(1, 2, 3) },
    { width: 3, height: 1, format: 0xabcd1201, share: 0 }])), 'shp-shared-layout');
});

test('auxiliary bytes do not bypass truncation, empty mode validation or the format2 zero restriction', () => {
  const empty = createRuntimeShp(shp([{ width: 0, height: 0, format: 0xabcd1203 }]));
  assert.equal(empty.decodeFrame(0).pixelCount, 0); assert.deepEqual(empty.frames[0]!.auxiliaryBytes, [0x12, 0xcd, 0xab]);
  const invalidEmpty = createRuntimeShp(shp([{ width: 0, height: 0, format: 0xabcd1204 }]));
  code(() => invalidEmpty.decodeFrame(0), 'shp-unsupported-compression');
  code(() => selected(0xabcd1201, [1], 3), 'shp-truncated-raw');
  code(() => selected(0xabcd1203, [5, 0, 1], 3), 'shp-truncated-row');
  code(() => selected(0xabcd1202, row(1, 0, 3), 3), 'shp-format2-ambiguous');
});

test('fixed input snapshot and output copies cannot mutate future frames', () => {
  const bytes = shp([{ width: 3, height: 1, format: 1, data: [1, 2, 3] }]);
  const decoder = createRuntimeShp(bytes), frame = decoder.decodeFrame(0);
  bytes.fill(9); frame.copyPixels().fill(7);
  assert.deepEqual([...frame.copyPixels()], [1, 2, 3]);
  assert.deepEqual([...decoder.decodeFrame(0).copyPixels()], [1, 2, 3]);
  assert.ok(Object.isFrozen(decoder) && Object.isFrozen(decoder.frames) && Object.isFrozen(frame.frame) && Object.isFrozen(frame));
  const container = new Uint8Array(60); container.set(shp([{ width: 3, height: 1, format: 1, data: [4, 5, 6] }]), 7);
  assert.deepEqual([...createRuntimeShp(container.subarray(7, 42)).decodeFrame(0).copyPixels()], [4, 5, 6]);
});

test('native buffer and descriptor checks avoid imported accessors and cap escalation', () => {
  const bytes = shp([{ width: 3, height: 1, format: 1, data: [1, 2, 3] }]);
  let invoked = false;
  Object.defineProperty(bytes, 'buffer', { get() { invoked = true; throw new Error(); } });
  Object.defineProperty(bytes, Symbol.iterator, { get() { invoked = true; throw new Error(); } });
  assert.deepEqual([...createRuntimeShp(bytes).decodeFrame(0).copyPixels()], [1, 2, 3]); assert.equal(invoked, false);
  code(() => createRuntimeShp(bytes, { get fileBytes() { invoked = true; return 100; } }), 'shp-limit-options'); assert.equal(invoked, false);
  for (const options of [{ frames: SHP_RUNTIME_LIMITS.frames + 1 }, { dimension: -0 }, { framePixels: NaN }, { constructor: 1 }]) {
    code(() => createRuntimeShp(bytes, options as never), 'shp-limit-options');
  }
  class Subclass extends Uint8Array {}
  code(() => createRuntimeShp(new Subclass(40)), 'shp-input-type');
  code(() => createRuntimeShp(new Uint8Array(new SharedArrayBuffer(40))), 'shp-input-buffer');
  const resizable = Reflect.construct(ArrayBuffer, [40, { maxByteLength: 80 }]) as ArrayBuffer;
  code(() => createRuntimeShp(new Uint8Array(resizable)), 'shp-input-buffer');
});
