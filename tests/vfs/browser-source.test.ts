// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic browser-source tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER_RANGE_BYTES, createBrowserByteSource } from '../../packages/vfs/src/browser-source.ts';

test('Blob ranges return independent exact bytes, including empty EOF, within the 1 MiB cap', async () => {
  const requests: number[] = [], complete: number[] = [];
  const source = createBrowserByteSource(new Blob([Uint8Array.of(1, 2, 3, 4)]), { beforeRead: n => requests.push(n), onRead: n => complete.push(n) });
  const first = await source.read(1, 2); assert.deepEqual([...first], [2, 3]); first[0] = 90;
  assert.deepEqual([...await source.read(1, 2)], [2, 3]);
  assert.equal((await source.read(4, 0)).length, 0); assert.deepEqual(requests, [2, 2, 0]); assert.deepEqual(complete, [2, 2]);
  for (const [offset, length] of [[-1, 1], [0, -1], [3, 2], [0.5, 1], [NaN, 0]]) await assert.rejects(source.read(offset!, length!));
  await assert.rejects(createBrowserByteSource(new Blob([new Uint8Array(BROWSER_RANGE_BYTES + 1)])).read(0, BROWSER_RANGE_BYTES + 1), /range-limit/);
});
function delayedBlob() {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  class Delayed extends Blob {
    override slice(start?: number, end?: number): Blob {
      const sliced = super.slice(start, end), read = sliced.arrayBuffer.bind(sliced);
      sliced.arrayBuffer = async () => { await pending; return read(); };
      return sliced;
    }
  }
  return { blob: new Delayed([Uint8Array.of(1, 2)]), release };
}
test('one adapter cannot overlap a read; a completed read releases the guard', async () => {
  const { blob, release } = delayedBlob(), source = createBrowserByteSource(blob);
  const reading = source.read(0, 1);
  await assert.rejects(source.read(1, 1), /source-busy/);
  release(); await reading; assert.deepEqual([...await source.read(1, 1)], [2]);
});
test('abort rejects promptly but retains the slot until the bounded underlying read finishes', async () => {
  const controller = new AbortController(), waiting = delayedBlob(), source = createBrowserByteSource(waiting.blob, { signal: controller.signal });
  const reading = source.read(0, 2); controller.abort();
  await assert.rejects(reading, { name: 'AbortError' });
  await assert.rejects(source.read(0, 1), { name: 'AbortError' });
  waiting.release(); await new Promise<void>(resolve => setTimeout(resolve, 0));
  const already = new AbortController(); already.abort();
  await assert.rejects(createBrowserByteSource(new Blob([Uint8Array.of(1)]), { signal: already.signal }).read(0, 1), { name: 'AbortError' });
});
test('at most four outstanding range operations exist across independent adapters', async () => {
  const waiting = Array.from({ length: 5 }, delayedBlob);
  const pending = waiting.slice(0, 4).map(item => createBrowserByteSource(item.blob).read(0, 2));
  try { await assert.rejects(createBrowserByteSource(waiting[4]!.blob).read(0, 2), /buffer-limit/); }
  finally { waiting.forEach(item => item.release()); await Promise.all(pending); }
});
test('abort while a Blob range starts still observes the pending read rejection and releases its slot', async () => {
  const controller = new AbortController();
  class AbortOnSlice extends Blob {
    override slice(start?: number, end?: number): Blob { controller.abort(); return super.slice(start, end); }
  }
  await assert.rejects(createBrowserByteSource(new AbortOnSlice([Uint8Array.of(1)]), { signal: controller.signal }).read(0, 1), { name: 'AbortError' });
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  assert.equal((await createBrowserByteSource(new Blob([Uint8Array.of(2)])).read(0, 1))[0], 2);
});
test('short reads and budget callbacks fail without leaving an adapter busy', async () => {
  class Short extends Blob { override slice(): Blob { return new Blob(); } }
  const short = createBrowserByteSource(new Short([Uint8Array.of(1)]));
  await assert.rejects(short.read(0, 1), /short-read/); await assert.rejects(short.read(0, 1), /short-read/);
  let blocked = true;
  const source = createBrowserByteSource(new Blob([Uint8Array.of(1)]), { beforeRead() { if (blocked) throw new Error('test-budget'); } });
  await assert.rejects(source.read(0, 1), /test-budget/); blocked = false; assert.equal((await source.read(0, 1))[0], 1);
});
test('beforeRead reentrancy cannot create a second underlying operation on the same adapter', async () => {
  let callbackCalls = 0, nested!: Promise<void>;
  const source = createBrowserByteSource(new Blob([Uint8Array.of(1, 2)]), { beforeRead() {
    if (++callbackCalls === 1) nested = assert.rejects(source.read(1, 1), /source-busy/);
  } });
  assert.equal((await source.read(0, 1))[0], 1); await nested;
  assert.equal(callbackCalls, 1); assert.equal((await source.read(1, 1))[0], 2);
});
test('callback throws and callback cancellation release reservations before any underlying read', async () => {
  let slices = 0, calls = 0;
  class Counted extends Blob { override slice(start?: number, end?: number): Blob { slices++; return super.slice(start, end); } }
  const source = createBrowserByteSource(new Counted([Uint8Array.of(1)]), { beforeRead() { if (++calls === 1) throw new Error('callback-failure'); } });
  await assert.rejects(source.read(0, 1), /callback-failure/); assert.equal(slices, 0);
  assert.equal((await source.read(0, 1))[0], 1); assert.equal(slices, 1);
  const controller = new AbortController();
  const aborted = createBrowserByteSource(new Counted([Uint8Array.of(1)]), { signal: controller.signal, beforeRead() { controller.abort(); } });
  await assert.rejects(aborted.read(0, 1), { name: 'AbortError' }); assert.equal(slices, 1);
  const waiting = Array.from({ length: 4 }, delayedBlob), pending = waiting.map(item => createBrowserByteSource(item.blob).read(0, 1));
  waiting.forEach(item => item.release()); assert.equal((await Promise.all(pending)).length, 4);
});
