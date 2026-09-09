// SPDX-License-Identifier: MIT
// Original synthetic files only. No retail content is required.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createVerifiedSourceReader, VerifiedSourceError, type VerifiedSourceIdentity } from '../../tools/analysis/verified-source.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const matches = (code: string) => (error: unknown) => error instanceof VerifiedSourceError && error.code === code;
async function fixture(run: (root: string, bytes: Uint8Array, identity: VerifiedSourceIdentity) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'webra2-source-'));
  const bytes = Uint8Array.from({ length: 8197 }, (_, i) => (i * 37 + 11) % 251);
  const identity = { rootFile: 'fixture.bin', rootSha256: hash(bytes), absoluteOffset: 193, size: 3079, sha256: hash(bytes.subarray(193, 3272)) };
  try { await writeFile(join(root, identity.rootFile), bytes); await run(root, bytes, identity); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('verified ranges preserve unaligned bytes, independent buffers and empty EOF members', async () => {
  await fixture(async (root, bytes, identity) => {
    const reader = await createVerifiedSourceReader(root, { chunkBytes: 113 });
    try {
      const first = await reader.read({ ...identity, sha256: identity.sha256.toUpperCase() });
      assert.deepEqual(first, bytes.subarray(193, 3272));
      first.fill(0);
      assert.deepEqual(await reader.read(identity), bytes.subarray(193, 3272));
      assert.equal((await reader.read({ ...identity, absoluteOffset: bytes.length, size: 0, sha256: hash(new Uint8Array()) })).length, 0);
    } finally { await reader.close(); }
    await reader.close();
    await assert.rejects(reader.read(identity), matches('reader-closed'));
  });
});

test('wrong root/member identities fail without poisoning subsequent valid reads', async () => {
  await fixture(async (root, bytes, identity) => {
    const reader = await createVerifiedSourceReader(root);
    try {
      await assert.rejects(reader.read({ ...identity, rootSha256: '0'.repeat(64) }), matches('root-hash-mismatch'));
      await assert.rejects(reader.read({ ...identity, sha256: '0'.repeat(64) }), matches('member-hash-mismatch'));
      assert.deepEqual(await reader.read(identity), bytes.subarray(193, 3272));
      await assert.rejects(reader.read({ ...identity, rootSha256: '1'.repeat(64) }), matches('root-hash-mismatch'));
    } finally { await reader.close(); }
  });
});

test('unsafe paths, symlinks, directories and malformed hashes never become content sources', async () => {
  await fixture(async (root, _bytes, identity) => {
    await symlink(join(root, identity.rootFile), join(root, 'alias.bin'));
    await mkdir(join(root, 'directory'));
    const reader = await createVerifiedSourceReader(root);
    try {
      for (const rootFile of ['', '.', '..', '../fixture.bin', 'sub/fixture.bin', 'sub\\fixture.bin', '/fixture.bin', 'C:fixture.bin', 'x\0.bin']) {
        await assert.rejects(reader.read({ ...identity, rootFile }), matches('unsafe-root-name'));
      }
      await assert.rejects(reader.read({ ...identity, rootFile: 'alias.bin' }), matches('unsafe-source-file'));
      await assert.rejects(reader.read({ ...identity, rootFile: 'directory' }), matches('unsafe-source-file'));
      await assert.rejects(reader.read({ ...identity, sha256: 'abc' }), matches('invalid-hash'));
      await assert.rejects(reader.read({ ...identity, rootFile: 'absent.bin' }), error => {
        assert.ok(matches('source-io')(error));
        assert.ok(error instanceof Error); assert.ok(!error.message.includes(root)); return true;
      });
    } finally { await reader.close(); }
    await assert.rejects(createVerifiedSourceReader(join(root, identity.rootFile)), matches('invalid-directory'));
  });
});

test('integer ranges, byte limits and verified-root count reject excessive reads', async () => {
  await fixture(async (root, bytes, identity) => {
    await writeFile(join(root, 'second.bin'), bytes);
    const reader = await createVerifiedSourceReader(root, { maxRoots: 1 });
    try {
      for (const absoluteOffset of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        await assert.rejects(reader.read({ ...identity, absoluteOffset }), matches('invalid-range'));
      }
      await assert.rejects(reader.read({ ...identity, size: -1 }), matches('invalid-range'));
      await assert.rejects(reader.read({ ...identity, absoluteOffset: Number.MAX_SAFE_INTEGER }), matches('range-outside-root'));
      await assert.rejects(reader.read({ ...identity, absoluteOffset: bytes.length - 1, size: 2 }), matches('range-outside-root'));
      await reader.read(identity);
      await assert.rejects(reader.read({ ...identity, rootFile: 'second.bin' }), matches('root-count-limit'));
    } finally { await reader.close(); }
    const smallMember = await createVerifiedSourceReader(root, { maxMemberBytes: identity.size - 1 });
    try { await assert.rejects(smallMember.read(identity), matches('member-limit')); } finally { await smallMember.close(); }
    const smallRoot = await createVerifiedSourceReader(root, { maxRootBytes: bytes.length - 1 });
    try { await assert.rejects(smallRoot.read(identity), matches('root-byte-limit')); } finally { await smallRoot.close(); }
    for (const options of [{ chunkBytes: 0 }, { maxRoots: 0 }, { maxRoots: 513 }, { maxMemberBytes: 65 * 1024 * 1024 }, { maxRootBytes: Infinity }, { chunkBytes: 1.5 }]) {
      await assert.rejects(createVerifiedSourceReader(root, options), matches('invalid-limit'));
    }
  });
});

test('cached content changes are rejected even when the original modification time is restored', async () => {
  await fixture(async (root, bytes, identity) => {
    const path = join(root, identity.rootFile), originalStat = await stat(path);
    const reader = await createVerifiedSourceReader(root);
    const changed = bytes.slice(); changed[0] = changed[0]! ^ 0xff;
    try {
      await reader.read(identity);
      await writeFile(path, changed);
      await utimes(path, originalStat.atime, originalStat.mtime);
      await assert.rejects(reader.read(identity), matches('source-changed'));
    } finally { await reader.close(); }
    const fresh = await createVerifiedSourceReader(root);
    try {
      await assert.rejects(fresh.read(identity), matches('root-hash-mismatch'));
      assert.deepEqual(await fresh.read({ ...identity, rootSha256: hash(changed) }), bytes.subarray(193, 3272));
    } finally { await fresh.close(); }
  });
});

test('replacement roots and pre-read truncation cannot reuse a prior manifest', async () => {
  await fixture(async (root, bytes, identity) => {
    const path = join(root, identity.rootFile);
    const reader = await createVerifiedSourceReader(root);
    try {
      await reader.read(identity);
      await rename(path, join(root, 'old.bin'));
      await writeFile(path, bytes);
      await assert.rejects(reader.read(identity), matches('source-changed'));
    } finally { await reader.close(); }
    await writeFile(path, bytes.subarray(0, 200));
    const truncated = await createVerifiedSourceReader(root);
    try { await assert.rejects(truncated.read(identity), matches('range-outside-root')); } finally { await truncated.close(); }
  });
});

test('concurrent reads are bounded and close drains the active read before releasing resources', async () => {
  await fixture(async (root, bytes, identity) => {
    const reader = await createVerifiedSourceReader(root, { chunkBytes: 97 });
    const mutable = { ...identity };
    const first = reader.read(mutable);
    mutable.rootFile = '../escape';
    await assert.rejects(reader.read(identity), matches('reader-busy'));
    const closing = reader.close();
    await assert.rejects(reader.read(identity), matches('reader-closed'));
    assert.deepEqual(await first, bytes.subarray(193, 3272));
    await closing;
    await rm(join(root, identity.rootFile));
  });
});

test('a completely empty source has a valid empty range', async () => {
  await fixture(async (root) => {
    const bytes = new Uint8Array(); await writeFile(join(root, 'empty.bin'), bytes);
    const reader = await createVerifiedSourceReader(root, { maxMemberBytes: 0, maxRootBytes: 0 });
    try {
      assert.equal((await reader.read({ rootFile: 'empty.bin', rootSha256: hash(bytes), absoluteOffset: 0, size: 0, sha256: hash(bytes) })).length, 0);
    } finally { await reader.close(); }
  });
});


test('discovery derives a canonical member identity after root verification and returns caller-owned bytes', async () => {
  await fixture(async (root, bytes, identity) => {
    const { sha256: _expected, ...range } = identity;
    const reader = await createVerifiedSourceReader(root, { chunkBytes: 113 });
    try {
      const found = await reader.discover({ ...range, rootSha256: range.rootSha256.toUpperCase() });
      assert.deepEqual(found.identity, identity);
      assert.deepEqual(found.bytes, bytes.subarray(193, 3272));
      assert.deepEqual(await reader.read(found.identity), found.bytes);
      found.bytes.fill(0); found.identity.size = 0;
      assert.deepEqual((await reader.discover(range)).bytes, bytes.subarray(193, 3272));
      const empty = await reader.discover({ ...range, absoluteOffset: bytes.length, size: 0 });
      assert.equal(empty.identity.sha256, hash(new Uint8Array())); assert.equal(empty.bytes.length, 0);
      await assert.rejects(reader.discover(identity), matches('discovery-has-member-hash'));
    } finally { await reader.close(); }
  });
});

test('discovery cannot bypass root identity, path/range/resource gates or staleness', async () => {
  await fixture(async (root, bytes, identity) => {
    const { sha256: _expected, ...range } = identity;
    const reader = await createVerifiedSourceReader(root, { maxMemberBytes: range.size });
    try {
      await assert.rejects(reader.discover({ ...range, rootSha256: '0'.repeat(64) }), matches('root-hash-mismatch'));
      await assert.rejects(reader.discover({ ...range, rootFile: '../fixture.bin' }), matches('unsafe-root-name'));
      await assert.rejects(reader.discover({ ...range, absoluteOffset: bytes.length }), matches('range-outside-root'));
      await assert.rejects(reader.discover({ ...range, size: range.size + 1 }), matches('member-limit'));
      await reader.discover(range);
      await writeFile(join(root, range.rootFile), bytes);
      await assert.rejects(reader.discover(range), matches('source-changed'));
    } finally { await reader.close(); }
  });
});

test('read and discovery share concurrency/close guards and snapshot caller ranges', async () => {
  await fixture(async (root, _bytes, identity) => {
    const { sha256: _expected, ...range } = identity;
    const reader = await createVerifiedSourceReader(root, { chunkBytes: 31 });
    const pending = reader.discover(range);
    range.absoluteOffset = 0; range.rootSha256 = '0'.repeat(64);
    await assert.rejects(reader.read(identity), matches('reader-busy'));
    await assert.rejects(reader.discover(range), matches('reader-busy'));
    const closing = reader.close();
    assert.deepEqual((await pending).identity, identity);
    await closing;
    await assert.rejects(reader.discover(range), matches('reader-closed'));
    const second = await createVerifiedSourceReader(root, { chunkBytes: 31 });
    const read = second.read(identity);
    await assert.rejects(second.discover(range), matches('reader-busy'));
    await read; await second.close();
  });
});
