// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic files and archives, independent Node SHA-256 oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectBrowserCatalog } from '../../packages/vfs/src/browser-catalog.ts';
import { hashMixName } from '../../packages/formats/src/mix-names.ts';
const encode = (text: string) => new TextEncoder().encode(text);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const options = { profile: 'ra2', policy: 'tolerant' } as const;
function file(name: string, data: Uint8Array = encode('[Original]\nValue=yes')) { return new File([new Uint8Array(data)], name); }
function mix(rows: readonly { name: string; data: Uint8Array }[], flagged = false): Uint8Array {
  const header = flagged ? 10 : 6, length = rows.reduce((n, row) => n + row.data.length, 0), start = header + 12 * rows.length;
  const bytes = new Uint8Array(start + length + (flagged ? 20 : 0)), view = new DataView(bytes.buffer);
  if (flagged) view.setUint32(0, 0x10000, true);
  view.setUint16(header - 6, rows.length, true); view.setUint32(header - 4, length, true);
  let offset = 0;
  for (const [i, row] of rows.entries()) {
    view.setUint32(header + i * 12, hashMixName(row.name), true); view.setUint32(header + i * 12 + 4, offset, true); view.setUint32(header + i * 12 + 8, row.data.length, true);
    bytes.set(row.data, start + offset); offset += row.data.length;
  }
  return bytes;
}
test('literal files remain candidates until explicit verified reads return independently checked byte identities', async () => {
  const bytes = encode('[Original]\nValue=私有測試'), catalog = await inspectBrowserCatalog([file('RULES.INI', bytes)], options);
  try {
    const lookup = catalog.lookup('rules.ini'), candidate = lookup.candidates[0]!;
    assert.equal(lookup.status, 'candidate'); assert.equal(candidate.kind, 'literal'); assert.equal(catalog.report.files[0]!.identity.sha256, null);
    const found = await catalog.discover(candidate.id);
    assert.deepEqual(found.bytes, bytes); assert.equal(found.identity.sha256, sha(bytes)); assert.equal(found.identity.root.sha256, sha(bytes));
    found.bytes.fill(0); assert.deepEqual((await catalog.read(candidate.id, sha(bytes).toUpperCase())).bytes, bytes);
    assert.ok(Object.isFrozen(lookup)); assert.ok(Object.isFrozen(candidate.knownNames)); assert.ok(Object.isFrozen(found.identity.root));
    assert.equal(catalog.report.canStartCampaign, false);
  } finally { await catalog.dispose(); }
});
test('numeric nested lookup finds unseeded names, retains ranges and equivalent conflicting copies', async () => {
  const payload = encode('original candidate bytes'), child = mix([{ name: 'example.tmp', data: payload }]), root = mix([{ name: 'cache.mix', data: child }]);
  const catalog = await inspectBrowserCatalog([file('ra2.mix', root), file('example.tmp', payload)], options);
  try {
    const lookup = catalog.lookup('example.tmp'); assert.equal(lookup.status, 'ambiguous'); assert.equal(lookup.candidates.length, 2);
    const nested = lookup.candidates.find(c => c.archiveId !== null)!;
    assert.deepEqual(nested.knownNames, ['example.tmp']); assert.equal(nested.absoluteOffset, 36); assert.equal(nested.size, payload.length);
    const found = await catalog.discover(nested.id); assert.equal(found.identity.root.sha256, sha(root)); assert.equal(found.identity.sha256, sha(payload));
    assert.equal(found.identity.absoluteOffset, 36);
    assert.equal((await catalog.discover(lookup.candidates.find(c => c.kind === 'literal')!.id)).identity.sha256, found.identity.sha256);
    assert.equal(catalog.lookup('example.tmp').status, 'ambiguous');
  } finally { await catalog.dispose(); }
  const unknown = await inspectBrowserCatalog([file('ra2.mix', root)], options);
  try { const candidate = unknown.lookup('example.tmp').candidates[0]!; assert.deepEqual(candidate.knownNames, []); assert.equal((await unknown.discover(candidate.id)).identity.sha256, sha(payload)); }
  finally { await unknown.dispose(); }
});
test('profile exclusion, duplicate paths and strict ancestry never authorize blocked candidates', async () => {
  const payload = encode('original'), yr = mix([{ name: 'rulesmd.ini', data: payload }]);
  const excluded = await inspectBrowserCatalog([file('ra2md.mix', yr), file('ra2.mix', yr), file('rulesmd.ini', payload), file('engine.exe', payload)], options);
  try {
    assert.equal(excluded.lookup('rulesmd.ini').status, 'missing'); assert.equal(excluded.lookup('engine.exe').status, 'missing');
    await assert.rejects(excluded.discover(`${excluded.report.archives[0]!.id}/member:0`), /candidate-id/);
  }
  finally { await excluded.dispose(); }
  const duplicate = await inspectBrowserCatalog([file('rules.ini'), file('RULES.INI')], options);
  try { const result = duplicate.lookup('rules.ini'); assert.equal(result.status, 'ambiguous'); for (const candidate of result.candidates) await assert.rejects(duplicate.discover(candidate.id), /candidate-blocked/); }
  finally { await duplicate.dispose(); }
  const nested = mix([{ name: 'cache.mix', data: mix([{ name: 'rules.ini', data: payload }]) }], true);
  const strict = await inspectBrowserCatalog([file('ra2.mix', nested)], { ...options, policy: 'strict' });
  try { const result = strict.lookup('rules.ini'); assert.equal(result.status, 'blocked'); await assert.rejects(strict.discover(result.candidates[0]!.id), /candidate-blocked/); }
  finally { await strict.dispose(); }
});
test('selection and native Blob snapshots resist caller mutation and overridden read methods', async () => {
  const bytes = encode('original snapshot bytes'), selected = [file('rules.ini', bytes)];
  selected[0]!.slice = () => { throw new Error('overridden slice must not run'); };
  const pending = inspectBrowserCatalog(selected, options); selected[0] = file('rulesmd.ini');
  const catalog = await pending;
  try { assert.equal((await catalog.discover(catalog.lookup('rules.ini').candidates[0]!.id)).identity.sha256, sha(bytes)); assert.equal(catalog.lookup('rulesmd.ini').status, 'missing'); }
  finally { await catalog.dispose(); }
});
test('expected hash errors, unknown IDs and unsafe lookup paths remain explicit without discovery downgrade', async () => {
  const catalog = await inspectBrowserCatalog([file('rules.ini')], options);
  try {
    const id = catalog.lookup('rules.ini').candidates[0]!.id;
    for (const bad of ['', undefined, null, 'g'.repeat(64)]) await assert.rejects(catalog.read(id, bad as string), /expected-hash/);
    await assert.rejects(catalog.read(id, '0'.repeat(64)), /member-hash-mismatch/);
    await assert.rejects(catalog.discover('invented'), /candidate-id/);
    assert.throws(() => catalog.lookup('../rules.ini'));
    assert.equal((await catalog.discover(id)).identity.sha256.length, 64);
  } finally { await catalog.dispose(); }
  assert.throws(() => catalog.lookup('rules.ini'), /catalog-disposed/); await assert.rejects(catalog.discover('file:0'), /catalog-disposed/);
});
test('one catalog operation owns verification across root and member reads; abort and dispose are terminal', async () => {
  let catalog: Awaited<ReturnType<typeof inspectBrowserCatalog>>, once = false, reentrant: Promise<void> | undefined;
  catalog = await inspectBrowserCatalog([file('rules.ini')], { ...options, onVerifiedProgress() {
    if (!once) { once = true; reentrant = assert.rejects(catalog.discover('file:0'), /catalog-busy/); }
  } });
  try { await catalog.discover('file:0'); await reentrant; } finally { await catalog.dispose(); }
  const controller = new AbortController(); let callbacks = 0;
  const cancelled = await inspectBrowserCatalog([file('rules.ini')], { ...options, signal: controller.signal, onVerifiedProgress() { callbacks++; controller.abort(); } });
  await assert.rejects(cancelled.discover('file:0'), { name: 'AbortError' }); assert.equal(callbacks, 1);
  await assert.rejects(cancelled.discover('file:0'), /catalog-disposed/); await cancelled.dispose();
});
test('folder hierarchy is normalized once; CJK literal lookup works without a legacy ASCII name hash', async () => {
  const data = encode('original text'), input = file('原創.ini', data);
  Object.defineProperty(input, 'webkitRelativePath', { value: 'Game/原創.ini' });
  const catalog = await inspectBrowserCatalog([input], options);
  try { const result = catalog.lookup('原創.ini'); assert.equal(result.candidates[0]!.rootPath, '原創.ini'); assert.equal((await catalog.discover(result.candidates[0]!.id)).identity.sha256, sha(data)); }
  finally { await catalog.dispose(); }
});
test('input and selected-root caps reject before verified asset reads', async () => {
  await assert.rejects(inspectBrowserCatalog(new Array<File>(1), options), /catalog-file-type/);
  await assert.rejects(inspectBrowserCatalog(new Array<File>(4097), options), /catalog-file-limit/);
  await assert.rejects(inspectBrowserCatalog(Array.from({ length: 513 }, (_, i) => file(`original${i}.ini`)), options), /catalog-root-limit/);
  let progress = 0;
  const oversized = await inspectBrowserCatalog([file('original.bik', new Uint8Array(16 * 1024 * 1024 + 1))], { ...options, onVerifiedProgress() { progress++; } });
  try { await assert.rejects(oversized.discover(oversized.lookup('original.bik').candidates[0]!.id), /catalog-member-limit/); assert.equal(progress, 0); }
  finally { await oversized.dispose(); }
  const excessive = mix(Array.from({ length: 4097 }, () => ({ name: 'original.tmp', data: Uint8Array.of(0) })));
  const crowded = await inspectBrowserCatalog([file('ra2.mix', excessive)], options);
  try { assert.throws(() => crowded.lookup('original.tmp'), /catalog-match-limit/); }
  finally { await crowded.dispose(); }
});
