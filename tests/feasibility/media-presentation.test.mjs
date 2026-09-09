// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, presentationHeader, presentationPlan, chunkPlan, PresentationQueue } from '../../tools/feasibility/media-presentation-queue.mjs';

function header(changes = {}) {
  const bytes = new Uint8Array(44); bytes.set(new TextEncoder().encode('BIKi'));
  const values = { 4: 1000 - 8, 8: 41, 20: 140, 24: 110, 28: 15, 32: 1, 40: 1, ...changes };
  const view = new DataView(bytes.buffer);
  for (const [offset, value] of Object.entries(values)) view.setUint32(Number(offset), value, true);
  return bytes;
}
function chunk(plan, index) {
  const expected = chunkPlan(plan, index);
  return { index, video: new ArrayBuffer(expected.videoBytes), pcm: new ArrayBuffer(Math.round(expected.duration * 44100) * 8) };
}
test('Bink header reads a view at a nonzero byte offset and rejects malformed bounds', () => {
  const backing = new Uint8Array(50); backing.set(header(), 3);
  assert.equal(presentationHeader(backing.subarray(3, 47), 1000).duration, 41 / 15);
  for (const size of [43, NaN, Infinity, 1000.5, LIMITS.inputBytes + 1]) assert.throws(() => presentationHeader(header(), size), RangeError);
  assert.throws(() => presentationHeader(header().subarray(0, 43), 1000), RangeError);
  assert.throws(() => presentationHeader(header({ 4: 1000 }), 1000), RangeError);
  for (const update of [{8:0}, {20:1025}, {24:769}, {28:61}, {32:0}, {40:0}, {40:2}]) assert.throws(() => presentationHeader(header(update), 1000), RangeError);
  const invalid = header(); invalid[3] = 32;
  assert.throws(() => presentationHeader(invalid, 1000), RangeError);
});
test('frame aligned duration and large-resolution chunk cap preserve exact final chunk', () => {
  const plan = presentationPlan(presentationHeader(header(), 1000), 8);
  assert.deepEqual([plan.frames, plan.chunks, chunkPlan(plan, 2).frames], [41, 3, 11]);
  assert.equal(chunkPlan(plan, 2).videoBytes, 11 * 140 * 110 * 4);
  const large = presentationPlan(presentationHeader(header({20:1024,24:768,28:60,8:500}), 1000), 8);
  assert.ok(large.chunkFrames * large.frameBytes + 1024 * 1024 <= LIMITS.chunkBytes);
  for (const value of [0, -1, 181, NaN, Infinity, 0.001]) assert.throws(() => presentationPlan(presentationHeader(header(), 1000), value), RangeError);
  for (const value of [-1, 0.5, 3, NaN]) assert.throws(() => chunkPlan(plan, value), RangeError);
});
test('queue backpressure includes pending work and releases one chunk at its audio-clock boundary', () => {
  const plan = presentationPlan(presentationHeader(header(), 1000), 8);
  const queue = new PresentationQueue(plan);
  assert.equal(queue.request(), 0); assert.equal(queue.request(), null);
  queue.receive(chunk(plan, 0)); assert.equal(queue.request(), 1);
  queue.receive(chunk(plan, 1)); assert.equal(queue.request(), null);
  assert.equal(queue.frame(-0.01), null);
  assert.equal(queue.frame(0).absoluteFrame, 0);
  assert.equal(queue.frame(0.999).absoluteFrame, 14);
  assert.equal(queue.frame(1).absoluteFrame, 15);
  queue.expire(1); assert.equal(queue.items.length, 1);
  assert.equal(queue.request(), 2); queue.receive(chunk(plan, 2));
  assert.equal(queue.request(), null);
  assert.equal(queue.frame(2.7).absoluteFrame, 40);
  queue.expire(plan.duration); assert.equal(queue.items.length, 0); assert.equal(queue.frame(plan.duration), null);
  assert.equal(queue.maxBytes, 2 * (15 * 140 * 110 * 4 + 44100 * 8));
});
test('queue rejects unsolicited, out-of-sequence and oversized decoded buffers', () => {
  const plan = presentationPlan(presentationHeader(header(), 1000), 8);
  const queue = new PresentationQueue(plan);
  assert.throws(() => queue.receive(chunk(plan, 0)), /Unexpected/);
  queue.request(); assert.throws(() => queue.receive(chunk(plan, 1)), /Unexpected/);
  assert.throws(() => queue.receive({...chunk(plan, 0), video: new ArrayBuffer(1)}), /Malformed/);
  assert.throws(() => queue.receive({...chunk(plan, 0), pcm: new ArrayBuffer(0)}), /Malformed/);
  assert.throws(() => queue.receive({...chunk(plan, 0), pcm: new ArrayBuffer(7)}), /Malformed/);
  assert.throws(() => queue.receive({...chunk(plan, 0), pcm: new ArrayBuffer(1024*1024+8)}), /Malformed/);
  queue.receive(chunk(plan, 0)); queue.request(); queue.clear();
  assert.equal(queue.items.length, 0); assert.equal(queue.pending, false);
  assert.throws(() => queue.receive(chunk(plan, 1)), /Unexpected/);
});
