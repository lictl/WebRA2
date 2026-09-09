// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic fixtures, independent Node digest oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openAsBlob, writeFileSync, utimesSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBrowserVerifiedSession, BROWSER_VERIFIED_LIMITS, type BrowserMemberIdentity, type BrowserRootIdentity } from '../../packages/vfs/src/browser-verified.ts';

const bytes = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 59 + 13) & 255);
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const root = (data: Uint8Array, sourceId = 'file:0'): BrowserRootIdentity => ({ sourceId, size: data.length, sha256: hash(data) });
const member = (data: Uint8Array, offset: number, size: number): BrowserMemberIdentity => ({ root: root(data), absoluteOffset: offset, size, sha256: hash(data.subarray(offset, offset + size)) });
const blob = (data: Uint8Array) => new Blob([new Uint8Array(data)]);

test('complete root identities cache per snapshot and every returned member remains independently verified', async () => {
  const data = bytes(131), phases: string[] = [], totals: number[] = [];
  const session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { limits: { chunkBytes: 17 }, onProgress(p) {
    assert.ok(Object.isFrozen(p)); phases.push(p.phase); totals.push(p.sessionBytesRead);
  } });
  const identified = await session.identify('file:0'); assert.deepEqual(identified, root(data)); assert.ok(Object.isFrozen(identified));
  const rootUpdates = phases.filter(p => p === 'root').length;
  assert.equal(await session.identify('file:0'), identified); assert.equal(phases.length, rootUpdates);
  const identity = member(data, 3, 71), first = await session.read(identity); assert.deepEqual(first, data.slice(3, 74)); first.fill(0);
  assert.deepEqual(await session.read(identity), data.slice(3, 74));
  const discovered = await session.discover({ root: identified, absoluteOffset: 130, size: 1 });
  assert.deepEqual(discovered.identity, member(data, 130, 1)); assert.deepEqual(discovered.bytes, data.slice(130));
  assert.ok(Object.isFrozen(discovered.identity)); assert.ok(Object.isFrozen(discovered.identity.root));
  assert.equal(phases.filter(p => p === 'root').length, rootUpdates); assert.equal(totals.at(-1), 131 + 71 + 71 + 1);
  await session.dispose();
});
test('wrong root size/hash and member hashes fail; cached calculated identity never weakens a later pin', async () => {
  const data = bytes(16), session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }]);
  const expected = member(data, 2, 5);
  await assert.rejects(session.read({ ...expected, root: { ...expected.root, size: 15 } }), /root-size-mismatch/);
  await assert.rejects(session.read({ ...expected, root: { ...expected.root, sha256: '0'.repeat(64) } }), /root-hash-mismatch/);
  await assert.rejects(session.read({ ...expected, sha256: '0'.repeat(64) }), /member-hash-mismatch/);
  assert.deepEqual(await session.read(expected), data.slice(2, 7));
  await assert.rejects(session.discover({ root: { ...expected.root, sha256: 'f'.repeat(64) }, absoluteOffset: 2, size: 5 }), /root-hash-mismatch/);
  await session.dispose();
});
test('discovery rejects present or inherited expected member hashes instead of discarding them', async () => {
  const data = bytes(3), session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }]);
  const range = { root: root(data), absoluteOffset: 0, size: 2 };
  for (const sha256 of [undefined, null, '', '0'.repeat(64)]) await assert.rejects(session.discover({ ...range, sha256 } as typeof range), /discovery-has-member-hash/);
  await assert.rejects(session.discover(Object.assign(Object.create({ sha256: hash(data) }), range)), /discovery-has-member-hash/);
  await assert.rejects(session.read(range as BrowserMemberIdentity), /invalid-sha256/);
  await session.dispose();
});
test('native Blob snapshots detach caller replacements and ignore overridden byte methods and size', async () => {
  const data = bytes(129), original = blob(data);
  original.slice = () => { throw new Error('caller slice must not run'); };
  Object.defineProperty(original, 'size', { value: 1 });
  const selected = [{ sourceId: 'file:0', blob: original }], limits = { chunkBytes: 17 };
  const session = createBrowserVerifiedSession(selected, { limits });
  selected[0] = { sourceId: 'replacement', blob: blob(bytes(1)) }; limits.chunkBytes = 0; data.fill(0);
  assert.deepEqual(await session.identify('file:0'), root(bytes(129)));
  await assert.rejects(session.identify('replacement'), /unknown-source-id/); await session.dispose();
});
test('expected identities are copied before awaits and getters cannot re-enter an active session', async () => {
  const data = bytes(37), session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }]);
  const expected = { ...member(data, 2, 11), root: { ...root(data) } };
  const reading = session.read(expected); expected.sha256 = '0'.repeat(64); expected.root.sha256 = 'f'.repeat(64); expected.absoluteOffset = 7;
  assert.deepEqual(await reading, data.slice(2, 13));
  let reentered!: Promise<void>;
  const getter = { ...member(data, 1, 2), get sha256() { reentered = assert.rejects(session.identify('file:0'), /session-busy/); return hash(data.slice(1, 3)); } };
  assert.deepEqual(await session.read(getter), data.slice(1, 3)); await reentered; await session.dispose();
});
test('selection, root, member and range limits reject before unbounded allocation or hash work', async () => {
  const data = bytes(9); let accessed = 0, progress = 0;
  assert.throws(() => createBrowserVerifiedSession([{ sourceId: 'file:0', get blob() { accessed++; return blob(data); } }], { limits: { maxRoots: 0 } }), /root-count-limit/); assert.equal(accessed, 0);
  assert.throws(() => createBrowserVerifiedSession(new Array(1)), /invalid-selected-root/);
  assert.throws(() => createBrowserVerifiedSession([{ sourceId: 'a', blob: blob(data) }, { sourceId: 'a', blob: blob(data) }]), /duplicate-source-id/);
  assert.throws(() => createBrowserVerifiedSession([{ sourceId: 'a', blob: blob(data) }], { limits: { maxRootBytes: 8 } }), /root-byte-limit/);
  assert.throws(() => createBrowserVerifiedSession([], { limits: { maxMemberBytes: BROWSER_VERIFIED_LIMITS.maxMemberBytes + 1 } }), /invalid-session-limit/);
  const session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { limits: { maxMemberBytes: 2 }, onProgress() { progress++; } });
  await assert.rejects(session.read(member(data, 0, 3)), /member-byte-limit/);
  for (const [absoluteOffset, size] of [[-1, 0], [0.5, 1], [9, 1], [Number.MAX_SAFE_INTEGER, 2]]) await assert.rejects(session.discover({ root: root(data), absoluteOffset: absoluteOffset!, size: size! }));
  assert.equal(progress, 0); await session.dispose();
});
test('attempted bytes and failed member attempts keep consuming their respective session budgets', async () => {
  const data = bytes(4), session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { limits: { chunkBytes: 2, maxReadBytes: 6 } });
  await assert.rejects(session.read({ ...member(data, 0, 2), sha256: '0'.repeat(64) }), /member-hash-mismatch/);
  await assert.rejects(session.read(member(data, 0, 1)), /session-read-budget/); await session.dispose();
  const partial = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { limits: { chunkBytes: 2, maxReadBytes: 3 } });
  await assert.rejects(partial.identify('file:0'), /session-read-budget/);
  await assert.rejects(partial.identify('file:0'), /session-read-budget/); await partial.dispose();
  const attempts = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { limits: { maxMemberAttempts: 1 } });
  await assert.rejects(attempts.read({ ...member(data, 0, 2), sha256: '0'.repeat(64) }), /member-hash-mismatch/);
  await assert.rejects(attempts.read(member(data, 0, 2)), /member-attempt-limit/); await attempts.dispose();
});
test('progress reentrancy is rejected and callback failures release the operation guard without a digest', async () => {
  const data = bytes(11); let reentered!: Promise<void>, once = true;
  const session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { onProgress() {
    if (once) { once = false; reentered = assert.rejects(session.identify('file:0'), /session-busy/); throw new Error('synthetic callback failure'); }
  } });
  await assert.rejects(session.identify('file:0'), /synthetic callback failure/); await reentered;
  assert.deepEqual(await session.identify('file:0'), root(data)); await session.dispose();
});
test('abort/dispose during progress reject operations and never return partial roots or members', async () => {
  const data = bytes(10), controller = new AbortController();
  const aborted = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { signal: controller.signal, limits: { chunkBytes: 2 }, onProgress(p) { if (p.bytesRead) controller.abort(); } });
  await assert.rejects(aborted.identify('file:0'), { name: 'AbortError' }); await assert.rejects(aborted.identify('file:0'), { name: 'AbortError' }); await aborted.dispose();
  let disposal!: Promise<void>;
  const session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { onProgress(p) { if (p.phase === 'member') disposal = session.dispose(); } });
  await assert.rejects(session.read(member(data, 0, 3)), { name: 'AbortError' }); await disposal;
  await assert.rejects(session.identify('file:0'), /session-disposed/); await session.dispose();
  const already = new AbortController(); already.abort(); assert.throws(() => createBrowserVerifiedSession([], { signal: already.signal }), { name: 'AbortError' });
});
test('disposed pending native reads retain all four range slots until their actual reads settle', async () => {
  const original = Blob.prototype.arrayBuffer; let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  Blob.prototype.arrayBuffer = async function () { await held; return original.call(this); };
  const sessions = Array.from({ length: 4 }, () => createBrowserVerifiedSession([{ sourceId: 'a', blob: blob(bytes(1)) }]));
  const fifth = createBrowserVerifiedSession([{ sourceId: 'a', blob: blob(bytes(1)) }]);
  try {
    const checks = sessions.map(session => assert.rejects(session.identify('a'), { name: 'AbortError' }));
    await Promise.all(sessions.map(session => session.dispose())); await Promise.all(checks);
    await assert.rejects(fifth.identify('a'), /browser-buffer-limit/);
    release(); await new Promise<void>(resolve => setTimeout(resolve, 0));
    assert.deepEqual(await fifth.identify('a'), root(bytes(1), 'a'));
  } finally { release(); Blob.prototype.arrayBuffer = original; await fifth.dispose(); await Promise.all(sessions.map(session => session.dispose())); }
});
test('an empty snapshot can verify an empty EOF member with zero read budget', async () => {
  const data = bytes(0), session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: blob(data) }], { limits: { maxReadBytes: 0 } });
  assert.equal((await session.read(member(data, 0, 0))).length, 0); await session.dispose();
});
test('Node file-backed Blob mutation rejects cached-root member reads instead of returning changed bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'webra2-browser-verified-')), path = join(directory, 'original.synthetic');
  const data = bytes(128); await writeFile(path, data);
  const session = createBrowserVerifiedSession([{ sourceId: 'file:0', blob: await openAsBlob(path) }]);
  try {
    await session.identify('file:0'); writeFileSync(path, bytes(128).fill(9)); utimesSync(path, new Date(), new Date(Date.now() + 10_000));
    await assert.rejects(session.read(member(data, 0, 16)), { name: 'NotReadableError' });
  } finally { await session.dispose(); await rm(directory, { recursive: true, force: true }); }
});
