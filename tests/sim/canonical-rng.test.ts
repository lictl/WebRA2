// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalText, canonicalBytes, canonicalHash, parseJson, seededRandom, nextRandom, sampleRandom, LIMITS } from '../../packages/sim/src/index.ts';
import { digest } from './fixtures.ts';

test('canonical integer JSON has fixed bytes, UTF-16 key ordering and no insertion-order dependence', async () => {
  const a = { z: '傳統中文', '2': [null, true, -7], '10': 10, a: { y: 2, x: 1 } };
  const expected = '{"10":10,"2":[null,true,-7],"a":{"x":1,"y":2},"z":"傳統中文"}';
  assert.equal(canonicalText(a), expected); assert.equal(new TextDecoder().decode(canonicalBytes(a)), expected);
  assert.equal(canonicalText(parseJson(expected)), expected);
  assert.equal(await canonicalHash(a, digest), await digest(new TextEncoder().encode(expected)));
  assert.equal(canonicalText({ '\ue000': 1, '𐀀': 2 }), '{"𐀀":2,"":1}');
  await assert.rejects(canonicalHash(a, async () => 'broken'), /invalid-digest-result/);
});
test('wire parser rejects duplicate decoded keys, malformed Unicode, lossy numbers and trailing syntax', () => {
  for (const input of ['{"a":1,"\\u0061":2}', '{"x":{"a":1,"a":2}}']) assert.throws(() => parseJson(input), /duplicate-json-key/);
  for (const input of ['-0', '1.5', '1.0', '1e0', '1e100', '1e-999', '9007199254740991.4', '9007199254740992']) assert.throws(() => parseJson(input), /json-integer-required/);
  for (const input of ['[1,]', '{"x":}', '{}{}', '[', 'truex', '01', '"\\x00"', '"\n"']) assert.throws(() => parseJson(input));
  for (const input of ['"\\ud800"', '"\\udc00"', '{"\\ud800":1}']) assert.throws(() => parseJson(input), /invalid-unicode/);
  assert.throws(() => parseJson(new Uint8Array([0xc0, 0xaf])), /invalid-utf8/);
  assert.equal(canonicalText(parseJson('{"__proto__":{"constructor":1}}')), '{"__proto__":{"constructor":1}}');
  assert.equal(Object.prototype.hasOwnProperty.call({}, 'constructor'), false);
});
test('canonical/wire resource limits reject oversized strings, nesting, sparse arrays and getters', () => {
  assert.throws(() => parseJson(' '.repeat(LIMITS.jsonBytes + 1)), /json-byte-limit/);
  assert.throws(() => parseJson('['.repeat(50) + '0' + ']'.repeat(50)), /json-structure-limit/);
  assert.throws(() => canonicalText({ x: 'a'.repeat(LIMITS.jsonBytes) }), /json-byte-limit/);
  assert.throws(() => canonicalText(Array(3)), /invalid-json-value/);
  let calls = 0; const obj = Object.defineProperty({}, 'value', { enumerable: true, get() { calls++; return 1; } });
  assert.throws(() => canonicalText(obj), /invalid-json-value/); assert.equal(calls, 0);
  for (const value of [NaN, Infinity, -0, 0.25, '\ud800']) assert.throws(() => canonicalText(value));
});
test('synthetic LCG vectors match independent integer arithmetic and rejection sampling advances exact state', () => {
  // Independently calculated with Python integer multiply/add modulo 2**32, seed 7.
  const rng = seededRandom(7);
  assert.deepEqual(Array.from({ length: 6 }, () => nextRandom(rng)), [1025555898, 3923423697, 2630631676, 3981355051, 211918734, 3675562389]);
  assert.equal(rng.draws, 6);
  // This seed is the modular inverse solution for the next draw being 0xffffffff, rejected for bound 3.
  const rejected = seededRandom(653637408); const clone = seededRandom(653637408); assert.equal(nextRandom(clone), 0xffffffff); const second = nextRandom(clone);
  assert.equal(sampleRandom(rejected, 3), second % 3); assert.deepEqual(rejected, clone);
  for (const seed of [-1, 0.5, 4294967296, NaN, -0]) assert.throws(() => seededRandom(seed));
  for (const bound of [0, 65537, 1.5, Infinity]) assert.throws(() => sampleRandom(rng, bound));
  rejected.draws = Number.MAX_SAFE_INTEGER; const before = { ...rejected }; assert.throws(() => sampleRandom(rejected, 3), /rng-draw-overflow/); assert.deepEqual(rejected, before);
});
