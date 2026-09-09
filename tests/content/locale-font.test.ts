// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic font/CSF records; no retail data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLocaleStrings, inspectUnicodeBitmapFont } from '../../packages/content/src/locale-font.ts';

function font() {
  const bytes = new Uint8Array(28 + 131072 + 9), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('fonT'));
  for (const [offset, value] of [[4, 4], [8, 1], [12, 2], [16, 3], [20, 3], [24, 3]]) view.setUint32(offset!, value!, true);
  view.setUint16(28 + 65 * 2, 1, true); view.setUint16(28 + 0x4e2d * 2, 3, true); view.setUint16(28 + 32 * 2, 2, true);
  bytes.set([2, 0x80, 0x40, 1, 0, 0, 0, 0, 0], 28 + 131072);
  return bytes;
}
function csf(rows: { key: string; value: string; extra?: string }[]) {
  const chunks: number[] = []; const u32 = (value: number) => chunks.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, value >>> 24);
  const ascii = (s: string) => chunks.push(...new TextEncoder().encode(s));
  ascii(' FSC'); for (const n of [3, rows.length, rows.length, 0, 9]) u32(n);
  for (const row of rows) {
    ascii(' LBL'); u32(1); u32(row.key.length); ascii(row.key);
    ascii(row.extra === undefined ? ' RTS' : 'WRTS'); u32(row.value.length);
    for (let i = 0; i < row.value.length; i++) { const n = row.value.charCodeAt(i) ^ 0xffff; chunks.push(n & 255, n >>> 8); }
    if (row.extra !== undefined) { u32(row.extra.length); ascii(row.extra); }
  }
  return Uint8Array.from(chunks);
}

test('Unicode coverage uses one-based mapping, retains zero-width/blank glyphs and separates layout controls', () => {
  const wrapped = new Uint8Array(font().length + 3); wrapped.set(font(), 3);
  const report = inspectUnicodeBitmapFont(wrapped.subarray(3), [65, 0x4e2d, 32, 10, 65, 0x1f642]);
  assert.equal(report.symbols, 3); assert.equal(report.mappedCodepoints, 3);
  assert.deepEqual(report.coverage, { requested: 5, mapped: 3, layoutControls: [10], missing: [0x1f642], zeroWidth: [0x4e2d], blank: [32, 0x4e2d], allNonControlMapped: false });
  assert.equal(inspectUnicodeBitmapFont(font(), [65, 10]).coverage.allNonControlMapped, true);
});

test('font declarations, unicode mappings, glyph widths and all symbol truncations fail bounded validation', () => {
  for (let length = font().length - 9; length < font().length; length++) assert.throws(() => inspectUnicodeBitmapFont(font().slice(0, length)), /font-size-mismatch/);
  for (const [offset, value, code] of [[8, 0, 'font-dimension-limit'], [12, 257, 'font-dimension-limit'], [20, 65536, 'font-dimension-limit'], [24, 0xffffffff, 'font-record-size']] as const) {
    const bytes = font(); new DataView(bytes.buffer).setUint32(offset, value, true); assert.throws(() => inspectUnicodeBitmapFont(bytes), new RegExp(code));
  }
  const mapping = font(); new DataView(mapping.buffer).setUint16(28, 4, true); assert.throws(() => inspectUnicodeBitmapFont(mapping), /font-unicode-mapping/);
  const width = font(); width[28 + 131072] = 9; assert.throws(() => inspectUnicodeBitmapFont(width), /font-glyph-width/);
  const magic = font(); magic[0] = 70; assert.throws(() => inspectUnicodeBitmapFont(magic), /font-magic/);
  assert.throws(() => inspectUnicodeBitmapFont(new Uint8Array(10)), /font-byte-limit/);
  assert.throws(() => inspectUnicodeBitmapFont(new Uint8Array(16 * 1024 * 1024 + 1)), /font-byte-limit/);
  for (const cp of [-1, 1.5, 0xd800, 0x110000, NaN]) assert.throws(() => inspectUnicodeBitmapFont(font(), [cp]), /font-codepoint-limit/);
  assert.throws(() => inspectUnicodeBitmapFont(font(), new Array<number>(65537).fill(65)), /font-codepoint-limit/);
  assert.throws(() => inspectUnicodeBitmapFont(font(), new Array<number>(1)), /font-codepoint-limit/);
});

test('string usage keeps codepoints and duplicate evidence without exposing text, labels or extras', () => {
  const report = inspectLocaleStrings(csf([{ key: 'SECRET_LABEL', value: 'A中\n🙂', extra: 'PRIVATE' }, { key: 'secret_label', value: 'A中\n🙂', extra: '' }, { key: 'SECRET_LABEL', value: 'Different' }]));
  assert.ok(report.codepoints.includes(0x1f642)); assert.ok(!report.codepoints.includes(0xd83d));
  assert.deepEqual(report.duplicates, [
    { firstOrdinal: 0, duplicateOrdinal: 1, sameText: true, sameExtra: false, sameKind: true },
    { firstOrdinal: 0, duplicateOrdinal: 2, sameText: false, sameExtra: false, sameKind: false },
  ]);
  assert.doesNotMatch(JSON.stringify(report), /SECRET|PRIVATE|Different|A中/);
});

test('CSF usage shares validated framing and refuses malformed UTF-16 rather than asserting font completeness', () => {
  assert.throws(() => inspectLocaleStrings(csf([{ key: 'X', value: '\ud800' }])), /Invalid UTF-16/);
  const bytes = csf([{ key: 'X', value: '中' }]);
  for (let length = 0; length < bytes.length; length++) assert.throws(() => inspectLocaleStrings(bytes.subarray(0, length)));
  const usage = inspectLocaleStrings(csf([{ key: 'X', value: 'A\n中' }]));
  assert.equal(inspectUnicodeBitmapFont(font(), usage.codepoints).coverage.missing.length, 0);
});
