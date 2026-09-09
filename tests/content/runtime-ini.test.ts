// SPDX-License-Identifier: GPL-3.0-or-later
// Original invented configuration fixtures. No retail INI content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRuntimeIni, lookupRuntimeIni, readRuntimeIni, RuntimeIniError, RUNTIME_INI_LIMITS,
  type RuntimeIniLayer, type IniValueSpec } from '../../packages/content/src/runtime-ini.ts';
const bytes = (text: string) => new TextEncoder().encode(text);
const layer = (text: string, order = 0, profile: 'ra2' | 'yr' = 'ra2'): RuntimeIniLayer => ({
  id: `source-${order}`, profile, order, kind: order ? 'map' : 'base', sourceSha256: String(order % 10).repeat(64), bytes: bytes(text),
});
const integer: IniValueSpec = { type: 'integer', min: -100, max: 100, syntax: 'decimal-or-hex' };
function converted(text: string, spec: IniValueSpec) { return readRuntimeIni(compileRuntimeIni('ra2', [layer(`[Toy]\nValue=${text}\n`)]), 'toy', 'value', spec); }
function value(text: string, spec: IniValueSpec) {
  const result = converted(text, spec); assert.equal(result.status, 'present'); if (result.status === 'present') return result.value;
  throw new Error('unreachable');
}

test('explicit layer order and last key occurrence select a value while retaining all source provenance', () => {
  const base = layer('[Toy]\nSpeed = 1 ; prior  \nFlag=YES\n[Toy]\nSpeed=2\nUnknown=opaque\n'), map = layer('[toy]\nSPEED =  3 ; map  \n', 7);
  const table = compileRuntimeIni('ra2', [map, base]);
  assert.equal(table.policy, 'webra2-ini-1'); assert.equal(table.nativeSemanticsVerified, false);
  assert.deepEqual(table.layers.map(l => l.id), ['source-0', 'source-7']);
  const selected = lookupRuntimeIni(table, 'TOY', 'Speed')!;
  assert.equal(selected.value, '3'); assert.equal(selected.selected.rawValue, '  3 ; map  ');
  assert.deepEqual(selected.shadowed.map(o => [o.layerId, o.line, o.sectionOccurrence, o.keyOccurrence, o.rawValue]), [
    ['source-0', 2, 0, 0, ' 1 ; prior  '], ['source-0', 5, 1, 1, '2'],
  ]);
  assert.equal(selected.selected.line, 2); assert.equal(selected.selected.keySpelling, 'SPEED');
  assert.equal(lookupRuntimeIni(table, 'toy', 'unknown')!.value, 'opaque');
  assert.deepEqual(table.diagnostics.map(d => d.code), ['repeated-section', 'duplicate-key', 'layer-override']);
  assert.equal(JSON.stringify(table), JSON.stringify(compileRuntimeIni('ra2', [base, map])));
  const reordered = Object.fromEntries(Object.entries(base).reverse()) as unknown as RuntimeIniLayer;
  assert.equal(JSON.stringify(table), JSON.stringify(compileRuntimeIni('ra2', [map, reordered])));
});
test('frozen output and safe lookup isolate caller mutation and prototype-shaped imported identifiers', () => {
  const input = layer('[__proto__]\nconstructor=alpha\n[constructor]\ntoString=beta\n[Toy]\n10=ten\n2=two\n');
  const table = compileRuntimeIni('ra2', [input]); input.bytes.fill(0);
  assert.equal(lookupRuntimeIni(table, '__proto__', 'constructor')!.value, 'alpha');
  assert.equal(lookupRuntimeIni(table, 'constructor', 'toString')!.value, 'beta');
  assert.deepEqual(table.entries.filter(e => e.section === 'toy').map(e => e.key), ['10', '2']);
  assert.equal(lookupRuntimeIni(table, 'absent', '__proto__'), undefined);
  for (const object of [table, table.layers, table.layers[0], table.sections[0], table.sections[0]!.occurrences,
    table.sections[0]!.occurrences[0], table.entries, table.entries[0], table.entries[0]!.selected, table.entries[0]!.shadowed]) assert.ok(Object.isFrozen(object));
  assert.throws(() => { (table.entries[0] as { value: string }).value = 'mutated'; }, TypeError);
});
test('every profile is checked before parsing, orders and identities cannot be ambiguous', () => {
  const corrupt = layer('\0');
  assert.throws(() => compileRuntimeIni('ra2', [corrupt, layer('[T]\na=b', 1, 'yr')]), /ini-profile-mismatch/);
  const yr = compileRuntimeIni('yr', [layer('[T]\na=expansion', 0, 'yr')]); assert.equal(yr.profile, 'yr');
  for (const input of [[layer(''), layer('', 0)], [layer(''), { ...layer('', 1), order: 0 }], [{ ...layer(''), order: -0 }],
    [{ ...layer(''), sourceSha256: 'not-a-hash' }], [{ ...layer(''), id: '../untrusted path' }]]) assert.throws(() => compileRuntimeIni('ra2', input));
  const accessor = { ...layer(''), get order(): number { throw new Error('must not invoke'); } };
  assert.throws(() => compileRuntimeIni('ra2', [accessor]), /ini-input-fields/);
  const sparse = new Array(1); Object.defineProperty(sparse, 'extra', { value: 'unrelated' });
  assert.throws(() => compileRuntimeIni('ra2', sparse as RuntimeIniLayer[]), /ini-input-array/);
  assert.throws(() => compileRuntimeIni('ra2', [{ ...layer(''), bytes: new Uint8Array(new SharedArrayBuffer(1)) }]), /ini-byte-source/);
  const resizable = Reflect.construct(ArrayBuffer, [1, { maxByteLength: 2 }]) as ArrayBuffer;
  assert.throws(() => compileRuntimeIni('ra2', [{ ...layer(''), bytes: new Uint8Array(resizable) }]), /ini-byte-source/);
});
test('empty values and first-semicolon comments have explicit policy while malformed scanner inputs reject', () => {
  const table = compileRuntimeIni('ra2', [layer('[T]\nClear=old\nClear=  ; blank overwrite\nText="left;right"\nHash=#literal\n')]);
  assert.equal(lookupRuntimeIni(table, 'T', 'Clear')!.value, '');
  assert.equal(lookupRuntimeIni(table, 'T', 'Text')!.value, '"left');
  assert.equal(lookupRuntimeIni(table, 'T', 'Text')!.selected.rawValue, '"left;right"');
  assert.equal(lookupRuntimeIni(table, 'T', 'Hash')!.value, '#literal');
  assert.deepEqual(table.diagnostics.map(d => d.code), ['duplicate-key', 'explicit-empty-value', 'quote-does-not-escape-comment']);
  for (const input of ['[broken\nValue=3', 'orphan=3\n[T]\na=b', '[T]\n=missing-key']) {
    assert.throws(() => compileRuntimeIni('ra2', [layer(input)]), (error: unknown) => error instanceof RuntimeIniError && error.code === 'ini-syntax' && error.diagnostics.length > 0);
  }
  for (const input of ['[T;comment]\na=b', '[T]\na;comment=b']) assert.throws(() => compileRuntimeIni('ra2', [layer(input)]), /ini-identifier-comment/);
});
test('runtime line adapter preserves valid entries after header suffixes and diagnoses ignored non-entry lines', () => {
  const table = compileRuntimeIni('ra2', [layer('narrative without assignment\n[Toy] illustrative suffix\nValue = 7 ; kept\n// inert line\nOther=8\n')]);
  assert.equal(lookupRuntimeIni(table, 'toy', 'value')!.selected.line, 3);
  assert.equal(lookupRuntimeIni(table, 'toy', 'value')!.selected.rawValue, ' 7 ; kept');
  assert.equal(lookupRuntimeIni(table, 'toy', 'other')!.value, '8');
  assert.deepEqual(table.diagnostics, [{ code: 'ignored-non-entry-line', layerId: 'source-0', line: 1 },
    { code: 'ignored-section-suffix', layerId: 'source-0', line: 2 }, { code: 'ignored-non-entry-line', layerId: 'source-0', line: 4 }]);
  // It is not a general slash-comment or malformed-assignment recovery rule.
  assert.equal(lookupRuntimeIni(compileRuntimeIni('ra2', [layer('[T]\n//literal=8')]), 't', '//literal')!.value, '8');
});
test('BOM decoded CJK text is retained exactly, with ASCII-only identity folding and no normalization', () => {
  const utf8 = layer(''); const text = '[自訂]\nLabel=  測試值 ;注釋  \n[Ä]\nA=upper\n[ä]\nA=lower\n';
  const encoded = bytes(text); const bom = new Uint8Array(encoded.length + 3); bom.set([239, 187, 191]); bom.set(encoded, 3);
  const table = compileRuntimeIni('ra2', [{ ...utf8, bytes: bom }]);
  assert.equal(lookupRuntimeIni(table, '自訂', 'LABEL')!.value, '測試值');
  assert.equal(lookupRuntimeIni(table, '自訂', 'LABEL')!.selected.rawValue, '  測試值 ;注釋  ');
  assert.equal(lookupRuntimeIni(table, 'Ä', 'a')!.value, 'upper'); assert.equal(lookupRuntimeIni(table, 'ä', 'a')!.value, 'lower');
  const utf16 = new Uint8Array(2 + text.length * 2), view = new DataView(utf16.buffer); view.setUint16(0, 0xfeff, true);
  for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), true);
  assert.equal(lookupRuntimeIni(compileRuntimeIni('ra2', [{ ...utf8, bytes: utf16 }]), '自訂', 'Label')!.selected.rawValue, '  測試值 ;注釋  ');
});
test('strict conversion distinguishes missing and invalid without fallback, clamping or partial numeric parses', () => {
  for (const token of ['YES', 'true', '1']) assert.equal(value(token, { type: 'boolean' }), true);
  for (const token of ['no', 'FALSE', '0']) assert.equal(value(token, { type: 'boolean' }), false);
  for (const token of ['', 'Y', 'truthy', '1junk', '2']) assert.equal(converted(token, { type: 'boolean' }).status, 'invalid');
  for (const [token, expected] of [['-7', -7], ['+003', 3], ['$10', 16], ['10h', 16], ['0X2A', 42], ['-0', 0]] as const) assert.equal(value(token, integer), expected);
  for (const token of ['101', '-101', '1x', '1.0', '1e0', 'Infinity', 'NaN', '0x', '1 2', '1'.repeat(65)]) assert.equal(converted(token, integer).status, 'invalid');
  assert.equal(converted('$10', { ...integer, syntax: 'decimal' }).status, 'invalid');
  assert.equal(value('', { type: 'string' }), '');
  const table = compileRuntimeIni('ra2', [layer('[T]\nother=1')]);
  assert.deepEqual(readRuntimeIni(table, 'T', 'absent', integer), { status: 'missing', section: 't', key: 'absent' });
  assert.throws(() => readRuntimeIni(table, 'T', 'absent', { ...integer, min: 2, max: 1 }), /ini-value-spec/);
  const getter = { get type(): 'string' { throw new Error('must not invoke'); } } as IniValueSpec;
  assert.throws(() => readRuntimeIni(table, 'T', 'absent', getter), /ini-value-spec/);
});
test('exact rational conversion reduces decimal and percentage values without floating point rounding', () => {
  const spec = { type: 'rational', allowPercent: true } as const;
  for (const [token, numerator, denominator] of [['0.1', 1, 10], ['-12.50%', -1, 8], ['.125', 1, 8], ['2.', 2, 1],
    ['-0.0000', 0, 1], ['9007199254740991', 9007199254740991, 1], ['100000000000000000000%', 1000000000000000000, 1]] as const) {
    if (!Number.isSafeInteger(numerator)) { assert.equal(converted(token, spec).status, 'invalid'); continue; }
    assert.deepEqual(value(token, spec), { numerator, denominator });
  }
  for (const token of ['1e-3', '1/3', '1.2.3', '.', '%', '0.0000000000000001', '9007199254740992']) assert.equal(converted(token, spec).status, 'invalid');
  assert.equal(converted('1%', { type: 'rational', allowPercent: false }).status, 'invalid');
});
test('bounded comma lists retain order and duplicates with explicit empty-element policy', () => {
  assert.deepEqual(value('z, a,z', { type: 'list', allowEmpty: false }), ['z', 'a', 'z']);
  assert.equal(converted('z,,a,', { type: 'list', allowEmpty: false }).status, 'invalid');
  assert.deepEqual(value('z,,a,', { type: 'list', allowEmpty: true }), ['z', '', 'a', '']);
  assert.deepEqual(value('', { type: 'list', allowEmpty: true }), []);
  assert.equal(converted('', { type: 'list', allowEmpty: false }).status, 'invalid');
  assert.equal(converted(Array(RUNTIME_INI_LIMITS.listItems + 1).fill('a').join(','), { type: 'list', allowEmpty: true }).status, 'invalid');
});
test('limits count shadowed occurrences and text before selection; hard caps cannot be raised', () => {
  const input = layer('[T]\na=1\na=2\na=3');
  assert.throws(() => compileRuntimeIni('ra2', [input], { entries: 2 }), /ini-occurrence-limit/);
  assert.throws(() => compileRuntimeIni('ra2', [layer('[T]\na=long old value\na=x')], { valueLength: 3 }), /ini-value-limit/);
  assert.throws(() => compileRuntimeIni('ra2', [input], { diagnostics: 1 }), /ini-diagnostic-limit/);
  assert.throws(() => compileRuntimeIni('ra2', [input], { bytes: input.bytes.length - 1 }), /ini-byte-limit/);
  assert.throws(() => compileRuntimeIni('ra2', [input], { decodedUnits: input.bytes.length - 1 }), /ini-decoded-limit/);
  assert.throws(() => compileRuntimeIni('ra2', [input], { scannerBytes: input.bytes.length - 1 }), /ini-scanner-byte-limit/);
  assert.throws(() => compileRuntimeIni('ra2', [input], { bytes: RUNTIME_INI_LIMITS.bytes + 1 }), /ini-limit-options/);
  assert.throws(() => compileRuntimeIni('ra2', [layer('[T]\n[T]\n[T]')], { sections: 2 }), /ini-occurrence-limit/);
  assert.throws(() => compileRuntimeIni('ra2', [input], { layers: 0 }), /ini-layer-limit/);
  const repeated = compileRuntimeIni('ra2', [layer('[Same]\n'.repeat(8000))]);
  assert.equal(repeated.sections[0]!.occurrences.length, 8000); assert.equal(repeated.diagnostics.length, 7999);
  const expanded = new Uint8Array([...bytes('[T] tail\na='), ...new Array(50).fill(0xff)]);
  assert.throws(() => compileRuntimeIni('ra2', [{ ...layer(''), bytes: expanded }], { scannerBytes: expanded.length }), /ini-scanner-byte-limit/);
});
