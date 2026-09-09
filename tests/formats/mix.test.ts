// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic fixtures; no game bytes or original assets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Blowfish } from 'egoroof-blowfish';
import { deriveMixKey, memorySource, mixMemberSource, readMix, readExact, sliceSource, type ByteSource } from '../../packages/formats/src/mix.ts';
import { hashMixName, MixNameResolver, readXccLocalNames } from '../../packages/formats/src/mix-names.ts';

function fixture(format: 'classic' | 'flagged' | 'encrypted' = 'classic', checksum = false): Uint8Array {
  const header = new Uint8Array(format === 'encrypted' ? 24 : 18), view = new DataView(header.buffer);
  view.setUint16(0, 1, true); view.setUint32(2, 4, true);
  view.setUint32(6, 0xdecafbad, true); view.setUint32(10, 0, true); view.setUint32(14, 4, true);
  const offset = format === 'classic' ? 0 : format === 'flagged' ? 4 : 84;
  const bytes = new Uint8Array(offset + header.length + 4 + (checksum ? 20 : 0));
  if (format !== 'classic') new DataView(bytes.buffer).setUint32(0, (format === 'encrypted' ? 0x20000 : 0) | (checksum ? 0x10000 : 0), true);
  if (format === 'encrypted') {
    // RSA input zero yields a 56-byte zero key; payload remains plaintext.
    const cipher = new Blowfish(new Uint8Array(56), Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
    bytes.set(cipher.encode(header).slice(0, header.length), offset);
  } else bytes.set(header, offset);
  bytes.set([1, 2, 3, 4], offset + header.length);
  return bytes;
}
for (const format of ['classic', 'flagged', 'encrypted'] as const) test(`${format} index and bounded member range`, async () => {
  const source = memorySource(fixture(format)); const mix = await readMix(source);
  assert.equal(mix.format, format); assert.equal(mix.dataSize, 4); assert.equal(mix.trailingBytes, 0);
  assert.deepEqual(mix.entries, [{ ordinal: 0, id: 0xdecafbad, offset: 0, size: 4 }]);
  assert.deepEqual(await readExact(mixMemberSource(source, mix, mix.entries[0]!), 0, 4), Uint8Array.of(1, 2, 3, 4));
});
test('fixed independent Blowfish known-answer block (zero key and zero plaintext)', () => {
  const cipher = new Blowfish(new Uint8Array(8), Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
  assert.equal(Buffer.from(cipher.encode(new Uint8Array(8)).slice(0, 8)).toString('hex'), '4ef997456198dd78');
});
test('key transform independently computed with Python builtin pow', () => {
  assert.equal(Buffer.from(deriveMixKey(Uint8Array.from({ length: 80 }, (_, i) => i))).toString('hex'), 'fd0b077d5780a7d08d96681dcbe1bea9450e77fcba6632451c94208a0711274b905a205f5aff6bc04d920b8f3d2f29868be2030a36d40c8e');
  assert.throws(() => deriveMixKey(new Uint8Array(79)), /80 bytes/);
});
test('checksum flag requires trailer and reports unverified without claiming success', async () => {
  const bytes = fixture('flagged', true), mix = await readMix(memorySource(bytes));
  assert.equal(mix.checksum.status, 'unverified'); assert.equal(mix.checksum.offset, 26);
  assert.equal(mix.checksum.expectedSha1, '0'.repeat(40));
  await assert.rejects(readMix(memorySource(bytes.slice(0, -1))), /Invalid byte range/);
});
test('all truncation boundaries reject for each nonempty format', async () => {
  for (const format of ['classic', 'flagged', 'encrypted'] as const) {
    const bytes = fixture(format);
    for (let length = 0; length < bytes.length; length++) await assert.rejects(readMix(memorySource(bytes.slice(0, length))), `format ${format}, length ${length}`);
  }
});
test('unknown flags, invalid ranges, uint32 overflow and resource caps reject', async () => {
  const flags = fixture('flagged'); flags[2] = 8;
  await assert.rejects(readMix(memorySource(flags)), /Unsupported MIX flags/);
  for (const [offset, size] of [[4, 1], [0xffffffff, 2], [1, 0xffffffff]]) {
    const bytes = fixture(); const v = new DataView(bytes.buffer); v.setUint32(10, offset!, true); v.setUint32(14, size!, true);
    await assert.rejects(readMix(memorySource(bytes)), /Invalid byte range/);
  }
  await assert.rejects(readMix(memorySource(fixture()), { maxEntries: 0 }), /Entry count/);
  await assert.rejects(readMix(memorySource(fixture()), { maxIndexBytes: 17 }), /Index exceeds/);
  await assert.rejects(readMix(memorySource(fixture()), { maxArchiveBytes: 2 }), /Archive exceeds/);
  await assert.rejects(readMix(memorySource(fixture()), { maxEntries: NaN }), /safe integer/);
  assert.throws(() => sliceSource(memorySource(fixture()), 0, Number.MAX_SAFE_INTEGER + 1), /Invalid byte range/);
});
test('index byte cap applies to padded encrypted index', async () => {
  await assert.rejects(readMix(memorySource(fixture('encrypted')), { maxIndexBytes: 18 }), /Index exceeds/);
});
test('zero-count flagged archive is supported; classic zero-count is inherently ambiguous', async () => {
  const mix = await readMix(memorySource(new Uint8Array(10)));
  assert.equal(mix.format, 'flagged'); assert.deepEqual(mix.entries, []);
  await assert.rejects(readMix(memorySource(new Uint8Array(6))));
});
test('index reads do not consume large payloads; short sources are rejected', async () => {
  const bytes = fixture(); new DataView(bytes.buffer).setUint32(2, 1_000_000, true);
  const calls: number[] = [];
  const source: ByteSource = { size: 1_000_018, async read(offset, length) { calls.push(length); assert.ok(offset + length <= 18); return bytes.slice(offset, offset + length); } };
  await readMix(source); assert.ok(Math.max(...calls) <= 18);
  await assert.rejects(readMix({ size: 100, async read() { return new Uint8Array(0); } }), /Requested 6 bytes/);
});
test('duplicate numeric IDs and overlapping member bounds remain visible', async () => {
  const bytes = new Uint8Array(34), v = new DataView(bytes.buffer);
  v.setUint16(0, 2, true); v.setUint32(2, 4, true);
  for (const offset of [6, 18]) { v.setUint32(offset, 123, true); v.setUint32(offset + 8, 4, true); }
  const mix = await readMix(memorySource(bytes)); assert.equal(mix.entries.length, 2);
  assert.deepEqual(mix.diagnostics.map(d => d.code), ['duplicate-id', 'overlapping-members']);
  assert.throws(() => mixMemberSource(memorySource(bytes), mix, { ...mix.entries[0]! }), /does not belong/);
});
test('nested slices cannot read outside their declared member; trailing bytes reported', async () => {
  const bytes = new Uint8Array(23); bytes.set(fixture()); const source = memorySource(bytes);
  const mix = await readMix(source); assert.equal(mix.trailingBytes, 1);
  await assert.rejects(readExact(mixMemberSource(source, mix, mix.entries[0]!), 3, 2), /Invalid byte range/);
});
test('classic and CRC name hashes, ASCII policy, and candidate provenance', () => {
  assert.equal(hashMixName('A', 'classic'), 65); assert.equal(hashMixName('ABCD', 'classic'), 0x44434241);
  // Python zlib.crc32(b"A\\x01AA") and zlib.crc32(b"RULES.INI\\x01III").
  assert.equal(hashMixName('A'), 0xeb978531);
  assert.equal(hashMixName('rules.ini'), hashMixName('RULES.INI'));
  const resolver = new MixNameResolver([{ name: 'rules.ini', source: 'fixture-a' }, { name: 'RULES.INI', source: 'fixture-b' }]);
  assert.equal(resolver.resolve(hashMixName('rules.ini')).length, 2); assert.deepEqual(resolver.resolve(0), []);
  assert.throws(() => hashMixName('規則.ini'), /ASCII/); assert.throws(() => hashMixName(''), /ASCII/);
});
function database(names: string[]): Uint8Array {
  const payload = new TextEncoder().encode(names.join('\0') + '\0');
  const bytes = new Uint8Array(52 + payload.length);
  bytes.set([88,67,67,32,98,121,32,79,108,97,102,32,118,97,110,32,100,101,114,32,83,112,101,107,26,4,23,39,16,25,128,0]);
  const v = new DataView(bytes.buffer); v.setUint32(32, bytes.length, true); v.setUint32(48, names.length, true); bytes.set(payload, 52);
  return bytes;
}
test('XCC database validates signature, size, count, termination and name cap', () => {
  const bytes = database(['fixture.ini', 'fixture.mix']); assert.deepEqual(readXccLocalNames(bytes), ['fixture.ini', 'fixture.mix']);
  const badMagic = bytes.slice(); badMagic[0] = 0; assert.throws(() => readXccLocalNames(badMagic), /header/);
  const truncated = bytes.slice(0, -1); new DataView(truncated.buffer).setUint32(32, truncated.length, true);
  assert.throws(() => readXccLocalNames(truncated), /Unterminated/);
  assert.throws(() => readXccLocalNames(bytes, 1), /count exceeds/);
  const excessive = bytes.slice(); new DataView(excessive.buffer).setUint32(48, 0xffffffff, true);
  assert.throws(() => readXccLocalNames(excessive), /count exceeds/);
});
test('distinct colliding filenames remain ambiguous instead of overwriting', () => {
  const a = 'ABCDE', b = 'BBCDC';
  assert.equal(hashMixName(a, 'classic'), hashMixName(b, 'classic'));
  const resolver = new MixNameResolver([{ name: a, source: 'fixture' }, { name: b, source: 'fixture' }]);
  assert.deepEqual(resolver.resolve(hashMixName(a, 'classic')).map(n => n.name), [a, b]);
});
test('filename resolver has an explicit global candidate cap', () => {
  const resolver = new MixNameResolver([], 1);
  resolver.add({ name: 'first.ini', source: 'fixture' });
  assert.throws(() => resolver.add({ name: 'second.ini', source: 'fixture' }), /candidate cap/);
});
