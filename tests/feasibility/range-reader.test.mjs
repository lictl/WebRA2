import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRangeReader, MAX_RANGE_BYTES, validateRange } from '../../tools/feasibility/range-reader.mjs';

test('unaligned File slices preserve bytes, permit EOF and zero length', async () => {
  const source = new File([Uint8Array.from({ length: 101 }, (_, i) => i)], 'synthetic.bin');
  const read = makeRangeReader(source);
  assert.deepEqual([...new Uint8Array(await read(13, 23))], Array.from({ length: 23 }, (_, i) => i + 13));
  assert.deepEqual([...new Uint8Array(await read(100, 1))], [100]);
  assert.equal((await read(101, 0)).byteLength, 0);
});

test('reject malformed, overflowing and oversized ranges before reading', async () => {
  for (const args of [[1, -1, 1], [1, 0, 2], [1, 2, 0], [1, 0, .5], [1, NaN, 1],
    [1, 0, Infinity], [Number.MAX_SAFE_INTEGER + 1, 0, 1], [MAX_RANGE_BYTES + 1, 0, MAX_RANGE_BYTES + 1],
    [1, 0, 1, 0]]) {
    assert.throws(() => validateRange(...args), RangeError);
  }
  let reads = 0;
  const read = makeRangeReader({ size: 5, slice() { reads++; } });
  await assert.rejects(read(4, 2), RangeError);
  assert.equal(reads, 0);
});

test('cancellation before or during an in-flight read leaves reader reusable', async () => {
  const before = new AbortController();
  before.abort();
  const read = makeRangeReader(new Blob(['abcd']));
  await assert.rejects(read(0, 4, before.signal), { name: 'AbortError' });
  let complete;
  const delayed = makeRangeReader({ size: 4, slice() { return { arrayBuffer: () => new Promise(r => { complete = r; }) }; } });
  const during = new AbortController();
  const pending = delayed(0, 4, during.signal);
  during.abort();
  complete(new ArrayBuffer(4));
  await assert.rejects(pending, { name: 'AbortError' });
  const retried = delayed(0, 4);
  complete(new ArrayBuffer(4));
  assert.equal((await retried).byteLength, 4);
  assert.equal((await read(0, 4)).byteLength, 4);
});

test('concurrent requests reject instead of exceeding one application buffer', async () => {
  let complete;
  const read = makeRangeReader({ size: 4, slice() { return { arrayBuffer: () => new Promise(r => { complete = r; }) }; } });
  const first = read(0, 4);
  await assert.rejects(read(0, 4), /one range/);
  complete(new ArrayBuffer(4));
  await first;
});

test('short reads fail and release the in-flight guard', async () => {
  let bytes = 0;
  const read = makeRangeReader({ size: 4, slice() { return { arrayBuffer: async () => new ArrayBuffer(bytes++) }; } });
  await assert.rejects(read(0, 1), /Short range/);
  assert.equal((await read(0, 1)).byteLength, 1);
});
