// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic fixtures; no retail rows or translated game strings.
import assert from 'node:assert/strict';
import test from 'node:test';
import { scanIni, entriesIn, INI_LIMITS } from '../../packages/content/src/ini.ts';
import { censusMission } from '../../packages/content/src/mission-census.ts';
import { censusCsf } from '../../packages/content/src/csf.ts';

const text = (value: string) => new TextEncoder().encode(value);
import { syntheticCsf } from './fixtures.ts';

test('INI scanner retains repeated sections/keys and values without selecting overrides', () => {
  const ini = scanIni(text('; comment\r\n[Basic]\r\nValue=a=b;kept\r\n[Basic]\r\nValue=second\r\n'));
  assert.equal(ini.sections.length, 2);
  assert.deepEqual(entriesIn(ini, 'basic').map(r => [r.sectionOccurrence, r.keyOccurrence, r.value, r.line]), [[0, 0, 'a=b;kept', 3], [1, 1, 'second', 5]]);
  assert.deepEqual(ini.diagnostics, []);
});

test('INI encodings are explicit and malformed sections do not reuse previous context', () => {
  const utf8 = scanIni(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), text('[Fixture]\nValue=測試\n')]));
  assert.equal(utf8.encoding, 'utf-8-bom'); assert.equal(utf8.entries[0]!.value, '測試');
  const utf16 = scanIni(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('[Fixture]\nValue=測試\n', 'utf16le')]));
  assert.equal(utf16.encoding, 'utf-16le-bom'); assert.equal(utf16.entries[0]!.value, '測試');
  const raw = scanIni(new Uint8Array([...text('[Fixture]\nValue='), 0xa0, 10]));
  assert.equal(raw.entries[0]!.value.charCodeAt(0), 0xa0);
  const broken = scanIni(text('[Basic]\nX=1\n[broken\nY=2\n'));
  assert.equal(broken.entries.length, 1); assert.equal(broken.diagnostics.length, 2);
  assert.throws(() => scanIni(text('[Basic]\0')), /NUL/);
});

test('INI byte, line and entry structure are bounded before census', () => {
  assert.throws(() => scanIni(new Uint8Array(INI_LIMITS.bytes + 1)), /cap/);
  assert.throws(() => scanIni(text('\n'.repeat(INI_LIMITS.lines))), /cap/);
  assert.throws(() => scanIni(text('[Fixture]\nX=' + 'a'.repeat(INI_LIMITS.lineLength))), /cap/);
});

test('variable event widths, eight-token actions and numbered script steps count exact original synthetic records', () => {
  const ini = scanIni(text('[Basic]\n[Map]\n[Events]\nA=2,900,2,31,41,901,0,51\n[Actions]\nA=1,902,0,1,2,3,4,5,6\n[ScriptTypes]\n0=ScriptA\n[ScriptA]\nName=original fixture\n1=904,8\n0=903,7\n'));
  const result = censusMission(ini);
  assert.equal(result.isMapCandidate, true); assert.equal(result.framingComplete, true);
  assert.deepEqual(result.eventOpcodes, [{ id: 900, count: 1, parameterWidths: [3] }, { id: 901, count: 1, parameterWidths: [2] }]);
  assert.deepEqual(result.actionOpcodes, [{ id: 902, count: 1, parameterWidths: [7] }]);
  assert.deepEqual(result.scriptOpcodes.map(r => r.id), [903, 904]);
});

test('malformed framing discards the entire row and reports the source position', () => {
  for (const row of ['2,900,2,31,41,901,0', '3,900,2,31,41,901,0,51', '1,900,0,4,extra', '1,900,,4', '4294967295']) {
    const result = censusMission(scanIni(text('[Events]\nA=' + row)));
    assert.equal(result.framingComplete, false); assert.deepEqual(result.eventOpcodes, []);
    assert.equal(result.diagnostics[0]!.line, 2);
  }
  const action = censusMission(scanIni(text('[Actions]\nA=1,900,0,1,2,3,4,5')));
  assert.equal(action.framingComplete, false); assert.deepEqual(action.actionOpcodes, []);
});

test('missing, duplicate and gapped script steps cannot look like complete framing', () => {
  const result = censusMission(scanIni(text('[ScriptTypes]\n0=Absent\n1=Steps\n[Steps]\nName=fixture\n0=900,1\n0=901,2\n2=902,3\n')));
  assert.deepEqual(result.diagnostics.map(d => d.code).sort(), ['duplicate-script-step', 'missing-script-section', 'noncontiguous-script-steps']);
});

test('CSF counts original CJK values and duplicate labels without returning payload text', () => {
  const bytes = syntheticCsf([{ label: 'fixture:A', value: '測試ABC', extra: 'fixture.wav' }, { label: 'FIXTURE:a', value: 'Z' }, { label: 'empty' }], 9);
  const result = censusCsf(bytes);
  assert.equal(result.languageId, 9); assert.equal(result.labelCount, 3); assert.equal(result.strings, 2);
  assert.equal(result.hanCodeUnits, 2); assert.equal(result.asciiCodeUnits, 4); assert.equal(result.duplicateLabels, 1);
  assert.equal(result.emptyLabels, 1); assert.equal(result.extraRecords, 1); assert.equal(result.invalidSurrogates, 0);
  assert.doesNotMatch(JSON.stringify(result), /測試|fixture:A|fixture.wav/);
});

test('CSF truncation, version/count/length claims and unsupported multi-value labels fail explicitly', () => {
  const bytes = syntheticCsf([{ label: 'fixture', value: 'value' }]);
  for (let length = 0; length < bytes.length; length++) assert.throws(() => censusCsf(bytes.subarray(0, length)), Error, `cut ${length}`);
  for (const [offset, value] of [[4, 2], [8, 100001], [12, 2], [28, 2], [32, 513]]) {
    const corrupt = Buffer.from(bytes); corrupt.writeUInt32LE(value!, offset!); assert.throws(() => censusCsf(corrupt));
  }
  assert.throws(() => censusCsf(Buffer.concat([bytes, Buffer.from([0])])), /trailing/);
  assert.equal(censusCsf(syntheticCsf([])).strings, 0);
});
