// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic strings and fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCsf } from '../../packages/content/src/csf-decode.ts';
import { censusCsf, CSF_LIMITS } from '../../packages/content/src/csf.ts';
function u32(value: number) { const out = Buffer.alloc(4); out.writeUInt32LE(value); return out; }
function fixture(rows: readonly { label: string; text?: string; extra?: string }[]) {
  return Buffer.concat([Buffer.from(' FSC'), u32(3), u32(rows.length), u32(rows.filter(row => row.text !== undefined).length), u32(0), u32(9), ...rows.flatMap(row => {
    const label = Buffer.from(row.label, 'ascii');
    const header = [Buffer.from(' LBL'), u32(row.text === undefined ? 0 : 1), u32(label.length), label];
    if (row.text === undefined) return header;
    const encoded = Buffer.from(row.text, 'utf16le'); for (let i = 0; i < encoded.length; i++) encoded[i] = encoded[i]! ^ 255;
    return [...header, Buffer.from(row.extra === undefined ? ' RTS' : 'WRTS'), u32(row.text.length), encoded,
      ...(row.extra === undefined ? [] : [u32(row.extra.length), Buffer.from(row.extra, 'latin1')])];
  })]);
}
test('runtime CSF preserves Unicode, extra bytes, empty records and case-insensitive lookup', () => {
  const bytes = fixture([{ label: 'UI:Hello', text: '測試 Hello 🚀\nSecond line' }, { label: 'UI:Extra', text: 'Original fixture', extra: '\x80A' }, { label: 'UI:Empty' }, { label: 'UI:Blank', text: '' }]);
  const before = censusCsf(bytes), catalog = decodeCsf(bytes);
  assert.equal(catalog.languageId, 9); assert.equal(catalog.records.length, 4);
  assert.equal(catalog.resolve('ui:HELLO').text, '測試 Hello 🚀\nSecond line');
  assert.equal(catalog.resolve('UI:Extra').extra, '\x80A');
  assert.equal(catalog.resolve('UI:Empty').status, 'empty'); assert.equal(catalog.resolve('UI:Blank').status, 'resolved');
  assert.equal(catalog.resolve('missing').status, 'missing'); assert.deepEqual(censusCsf(bytes), before);
  assert.throws(() => catalog.resolve('標籤'), /ASCII/);
});
test('identical duplicates remain equivalent while differing text or extras stay ambiguous', () => {
  const catalog = decodeCsf(fixture([{ label: 'same', text: 'One' }, { label: 'SAME', text: 'One' },
    { label: 'different', text: 'One' }, { label: 'DIFFERENT', text: 'Two' },
    { label: 'extra', text: 'One', extra: 'A' }, { label: 'EXTRA', text: 'One', extra: 'B' }]));
  assert.equal(catalog.resolve('same').status, 'resolved'); assert.deepEqual(catalog.resolve('same').records.map(row => row.ordinal), [0, 1]);
  for (const label of ['different', 'extra']) { assert.equal(catalog.resolve(label).status, 'ambiguous'); assert.equal(catalog.resolve(label).text, null); }
});
test('runtime values and resolutions remain detached and frozen after caller mutation', () => {
  const bytes = fixture([{ label: 'entry', text: 'Synthetic text' }]);
  const catalog = decodeCsf(bytes); bytes.fill(0);
  assert.equal(catalog.resolve('entry').text, 'Synthetic text');
  assert.ok(Object.isFrozen(catalog)); assert.ok(Object.isFrozen(catalog.records)); assert.ok(Object.isFrozen(catalog.records[0]));
  assert.ok(Object.isFrozen(catalog.resolve('entry'))); assert.ok(Object.isFrozen(catalog.resolve('entry').records));
});
test('malformed, oversized, truncated and invalid Unicode input never creates a catalog', () => {
  const bytes = fixture([{ label: 'entry', text: 'Valid' }]);
  for (let length = 0; length < bytes.length; length++) assert.throws(() => decodeCsf(bytes.subarray(0, length)));
  assert.throws(() => decodeCsf(fixture([{ label: 'bad', text: '\ud800' }])), /surrogates/);
  assert.throws(() => decodeCsf(Buffer.alloc(CSF_LIMITS.bytes + 1)), /byte cap/);
  const count = Buffer.from(bytes); count.writeUInt32LE(CSF_LIMITS.labels + 1, 8); assert.throws(() => decodeCsf(count), /count cap/);
  assert.throws(() => decodeCsf(Buffer.concat([bytes, Buffer.of(0)])), /trailing/);
});
