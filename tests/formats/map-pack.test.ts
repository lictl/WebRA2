// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic streams, Copyright 2026 WebRA2 contributors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLcwBlock, decodeLzoBlock, decodeMapPack, MAP_PACK_LIMITS } from '../../packages/formats/src/map-pack.ts';
const bytes = (...values: number[]) => Uint8Array.from(values);
const end = [17, 0, 0];
function lzoLiteral(data: Uint8Array, suffix = end): Uint8Array {
  if (data.length <= 238) return bytes(17 + data.length, ...data, ...suffix);
  let remaining = data.length - 18; const prefix = [0];
  while (remaining > 255) { prefix.push(0); remaining -= 255; }
  return bytes(...prefix, remaining, ...data, ...suffix);
}
function framed(data: Uint8Array, length: number): Uint8Array { return bytes(data.length & 255, data.length >> 8, length & 255, length >> 8, ...data); }
test('LCW literal, short relative and long/short absolute copies, fill and reverse modes', () => {
  assert.deepEqual(decodeLcwBlock(bytes(0x83, 65, 66, 67, 0xc0, 0, 0, 0x80), 6), bytes(65, 66, 67, 65, 66, 67));
  assert.deepEqual(decodeLcwBlock(bytes(0x81, 65, 0, 1, 0x80), 4), bytes(65, 65, 65, 65));
  assert.deepEqual(decodeLcwBlock(bytes(0xfe, 4, 0, 42, 0xff, 4, 0, 0, 0, 0x80), 8), new Uint8Array(8).fill(42));
  assert.deepEqual(decodeLcwBlock(bytes(0x83, 65, 66, 67, 0xc0, 3, 0, 0x80), 6, true), bytes(65, 66, 67, 65, 66, 67));
  assert.deepEqual(decodeLcwBlock(bytes(0x80), 0), bytes());
});
test('LZO initial and extended literals, every match class, overlap and trailing literals', () => {
  assert.deepEqual(decodeLzoBlock(bytes(...end), 0), bytes());
  const abc = bytes(65, 66, 67, 68);
  assert.deepEqual(decodeLzoBlock(lzoLiteral(abc), 4), abc);
  assert.deepEqual(decodeLzoBlock(lzoLiteral(abc, [66, 0, 120, 121, ...end]), 9), bytes(...abc, 68, 68, 68, 120, 121));
  assert.deepEqual(decodeLzoBlock(bytes(18, 65, 0, 0, ...end), 3), bytes(65, 65, 65));
  assert.deepEqual(decodeLzoBlock(lzoLiteral(abc, [35, 12, 0, ...end]), 9), bytes(...abc, 65, 66, 67, 68, 65));
  const extended = decodeLzoBlock(lzoLiteral(abc, [32, 1, 12, 0, ...end]), 38);
  assert.deepEqual(extended, Uint8Array.from({ length: 38 }, (_, i) => abc[i % 4]!));
  for (const length of [239, 2049, 16385, 32769]) {
    const data = Uint8Array.from({ length }, (_, i) => (i * 17) & 255);
    const suffix = length === 2049 ? [0, 0, ...end] : length === 16385 ? [17, 4, 0, ...end] : length === 32769 ? [25, 4, 0, ...end] : end;
    const expected = length === 239 ? data : bytes(...data, ...data.subarray(0, 3));
    assert.deepEqual(decodeLzoBlock(lzoLiteral(data, suffix), expected.length), expected);
  }
});
test('LZO agrees with a liblzo2 2.10 compression vector from original patterned text', () => {
  const input = Uint8Array.from(Buffer.from('ABBvcmlnaW5hbCBzeW50aGV0aWMgcGF0dGVybmVkIGRhdGEhIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADKhAAPZXRpYyBwYXR0ZXJuZWQgZGF0EQAA', 'base64'));
  const expected = new TextEncoder().encode('original synthetic patterned data!'.repeat(249).slice(0, 8192));
  assert.deepEqual(decodeLzoBlock(input, 8192), expected);
});
test('codecs reject truncations, invalid distances, missing terminators, trailing bytes and wrong lengths', () => {
  const lcw = bytes(0x83, 1, 2, 3, 0xc0, 0, 0, 0x80), lzo = lzoLiteral(bytes(1, 2, 3, 4), [64, 0, ...end]);
  for (const [source, size, decode] of [[lcw, 6, decodeLcwBlock], [lzo, 7, decodeLzoBlock]] as const) {
    for (let cut = 0; cut < source.length; cut++) assert.throws(() => decode(source.subarray(0, cut), size));
    assert.throws(() => decode(bytes(...source, 0), size), /trailing/);
    assert.throws(() => decode(source, size - 1), /overrun/);
    assert.throws(() => decode(source, size + 1), /length-mismatch/);
    assert.throws(() => decode(source, MAP_PACK_LIMITS.codecBytes + 1), /output-limit/);
  }
  assert.throws(() => decodeLcwBlock(bytes(0, 0, 0x80), 3), /back-reference/);
  assert.throws(() => decodeLcwBlock(bytes(0xc0, 0, 0, 0x80), 3), /back-reference/);
  assert.throws(() => decodeLzoBlock(bytes(18, 65, 64, 1, ...end), 4), /back-reference/);
  assert.throws(() => decodeLzoBlock(bytes(18, 1, 0, 1, ...end), 3), /back-reference/);
  assert.throws(() => decodeLzoBlock(bytes(18, 1, 18, 0, 0), 1), /terminator/);
  assert.throws(() => decodeLzoBlock(bytes(0, ...new Array<number>(258).fill(0), 1), 0), /run-limit/);
});
test('map framing preflights aggregate lengths and independently decodes multiple 8 KiB chunks', () => {
  const raw = Uint8Array.from({ length: 8192 }, (_, i) => i & 255), small = bytes(1, 2, 3, 4);
  const input = bytes(...framed(lzoLiteral(raw), raw.length), ...framed(lzoLiteral(small), small.length));
  assert.deepEqual(decodeMapPack(input, 'lzo', { expectedLength: 8196 }), bytes(...raw, ...small));
  assert.deepEqual(decodeMapPack(framed(bytes(0xfe, 0, 32, 42, 0x80), 8192), 'lcw'), new Uint8Array(8192).fill(42));
  assert.deepEqual(decodeMapPack(bytes(), 'lcw', { expectedLength: 0 }), bytes());
  assert.throws(() => decodeMapPack(input, 'lzo', { outputLimit: 8192 }), /output-limit/);
  assert.throws(() => decodeMapPack(input, 'lzo', { chunkLimit: 1 }), /chunk-limit/);
  assert.throws(() => decodeMapPack(input, 'lzo', { expectedLength: 8195 }), /length-mismatch/);
  assert.throws(() => decodeMapPack(bytes(1), 'lzo'), /header/);
  assert.throws(() => decodeMapPack(bytes(0, 0, 0, 0), 'lzo'), /invalid-pack-block/);
  assert.throws(() => decodeMapPack(framed(bytes(...end), 8193), 'lzo'), /invalid-pack-block/);
  assert.throws(() => decodeMapPack(framed(bytes(...end), 1).subarray(0, 6), 'lzo'), /truncated-pack-block/);
  assert.throws(() => decodeMapPack(framed(bytes(18, 65, 64, 1, ...end), 4), 'lzo'), error => error instanceof Error && 'inputOffset' in error && error.inputOffset === 8);
});
