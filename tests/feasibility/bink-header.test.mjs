import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBinkHeader } from '../../tools/feasibility/bink-header.mjs';
function fixture() {
  const bytes = new Uint8Array(100);
  bytes.set([66, 73, 75, 105]);
  const view = new DataView(bytes.buffer);
  for (const [offset, value] of [[4, 92], [8, 1], [12, 56], [20, 16], [24, 16], [28, 15], [32, 1]]) view.setUint32(offset, value, true);
  return bytes;
}
test('reads a synthetic bounded Bink header including a subarray byte offset', () => {
  const parent = new Uint8Array(120);
  parent.set(fixture(), 10);
  assert.equal(inspectBinkHeader(parent.subarray(10, 110)).width, 16);
});
test('rejects oversized declarations before loading the codec', () => {
  for (const [offset, value] of [[4, 1000], [8, 100001], [12, 101], [20, 4096], [24, 0], [28, 121], [32, 0], [40, 9]]) {
    const bytes = fixture();
    new DataView(bytes.buffer).setUint32(offset, value, true);
    assert.throws(() => inspectBinkHeader(bytes), RangeError);
  }
  const bytes = fixture(); bytes[3] = 0;
  assert.throws(() => inspectBinkHeader(bytes), /supported Bink/);
  assert.throws(() => inspectBinkHeader(bytes.subarray(0, 12)), RangeError);
});
