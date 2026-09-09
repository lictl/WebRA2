// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic fixtures; independent Node digest oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { memorySource, type ByteSource } from '../../packages/formats/src/mix.ts';
import { hashByteSource, SOURCE_HASH_LIMITS } from '../../packages/vfs/src/hash-source.ts';
const bytes = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 71 + 3) & 255);

test('incremental SHA-256/SHA-1 match independent digests across block/chunk boundaries', async () => {
  for (const algorithm of ['sha256', 'sha1'] as const) for (const size of [0, 1, 55, 56, 63, 64, 65, 257, 8193]) {
    const input = bytes(size);
    for (const chunkBytes of [1, 63, 64, 127, 4096]) {
      const result = await hashByteSource(memorySource(input), { algorithm, chunkBytes });
      assert.equal(result.hex, createHash(algorithm).update(input).digest('hex'));
      assert.equal(result.bytesRead, size); assert.equal(result.chunks, Math.ceil(size / chunkBytes)); assert.ok(Object.isFrozen(result));
    }
  }
});
test('range hashing consumes exactly its range, bounded sequential chunks and cooperative progress', async () => {
  const input = bytes(1024 * 1024 + 19); let active = 0, maximum = 0, largest = 0, total = 0;
  const source: ByteSource = { size: input.length, async read(offset, length) {
    active++; maximum = Math.max(active, maximum); largest = Math.max(largest, length); total += length;
    await Promise.resolve(); active--; return input.slice(offset, offset + length);
  } };
  let previous = -1, notifications = 0;
  const result = await hashByteSource(source, { offset: 7, length: input.length - 12, chunkBytes: 8192, onProgress(progress) {
    assert.ok(Object.isFrozen(progress)); assert.ok(progress.bytesRead >= previous); previous = progress.bytesRead; notifications++;
  } });
  assert.equal(result.hex, createHash('sha256').update(input.subarray(7, input.length - 5)).digest('hex'));
  assert.equal(maximum, 1); assert.equal(largest, 8192); assert.equal(total, input.length - 12); assert.equal(notifications, result.chunks + 1);
});
test('invalid ranges, ordinary member limits and raised hard limits fail before reading', async () => {
  let reads = 0; const source = { size: SOURCE_HASH_LIMITS.defaultBytes + 1, async read() { reads++; return new Uint8Array(); } };
  await assert.rejects(hashByteSource(source), /hash-byte-limit/);
  await assert.rejects(hashByteSource(source, { offset: -1 }), /Invalid byte range/);
  for (const options of [{ byteLimit: SOURCE_HASH_LIMITS.maxBytes + 1 }, { chunkBytes: 0 }, { chunkBytes: SOURCE_HASH_LIMITS.maxChunkBytes + 1 }, { byteLimit: NaN }]) await assert.rejects(hashByteSource(source, options), /hash-options/);
  assert.equal(reads, 0);
  await assert.rejects(hashByteSource(source, { length: 1 }), /received 0/);
});
test('cancellation before/during reads and progress failures never produce a digest', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(hashByteSource(memorySource(bytes(10)), { signal: controller.signal }), { name: 'AbortError' });
  const pending = new AbortController(); let calls = 0;
  const source = { size: 100, async read(offset: number, length: number) { calls++; pending.abort(); return bytes(length); } };
  await assert.rejects(hashByteSource(source, { chunkBytes: 10, signal: pending.signal }), { name: 'AbortError' }); assert.equal(calls, 1);
  await assert.rejects(hashByteSource(memorySource(bytes(100)), { onProgress() { throw new Error('callback failure'); } }), /callback failure/);
  const progressAbort = new AbortController();
  await assert.rejects(hashByteSource(memorySource(bytes(100)), { signal: progressAbort.signal, onProgress(p) { if (p.bytesRead) progressAbort.abort(); } }), { name: 'AbortError' });
});
test('changing source size fails and later caller mutation cannot change a completed digest', async () => {
  const source = { size: 100, async read(offset: number, length: number) { source.size++; return bytes(length); } };
  await assert.rejects(hashByteSource(source), /source-size-changed/);
  const input = bytes(100), result = await hashByteSource(memorySource(input)); input.fill(0);
  assert.equal(result.hex, createHash('sha256').update(bytes(100)).digest('hex'));
});

test('final progress, empty-range progress and final yield cannot change size before success', async () => {
  for (const initialSize of [0, 100]) {
    const source = { size: initialSize, async read(offset: number, length: number) { return bytes(length); } };
    await assert.rejects(hashByteSource(source, { onProgress(p) { if (p.bytesRead === p.totalBytes) source.size++; } }), /source-size-changed/);
  }
  const source = { size: 32, async read(offset: number, length: number) { return bytes(length); } };
  await assert.rejects(hashByteSource(source, { chunkBytes: 1, onProgress(p) {
    if (p.bytesRead === p.totalBytes) setTimeout(() => { source.size++; }, 0);
  } }), /source-size-changed/);
});
