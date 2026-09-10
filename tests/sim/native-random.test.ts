// SPDX-License-Identifier: MIT
// Original synthetic states and independently generated arithmetic-oracle digests; no retail state.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createNativeRandom, restoreNativeRandom, isNativeRandomState, nextNativeRandomWord,
  nextNativeReloadJitter, NativeRandomError, NATIVE_RANDOM_POLICY,
  NATIVE_RANDOM_WORDS, NATIVE_RELOAD_MAX_DRAWS, type NativeRandomState,
} from '../../packages/sim/src/native-random.ts';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function packed(values: readonly number[]): Buffer {
  const out = Buffer.alloc(values.length * 4); values.forEach((v, i) => out.writeUInt32LE(v, i * 4)); return out;
}
const stateHash = (s: NativeRandomState): string => sha(packed([s.index1, s.index2, ...s.words]));
const raw = (s = createNativeRandom(0)): { policy: string; disabled: boolean; index1: number; index2: number; words: number[] } => ({ ...s, words: [...s.words] });
function rejects(fn: () => unknown, code?: string): void {
  assert.throws(fn, error => error instanceof NativeRandomError && (code === undefined || error.code === code));
}

// Populated from separate Python signed32 and pinned licensed C++ oracles, not this implementation.
const VECTORS = [
  {
    "seed": 0,
    "initial": "6b1a14546cb921d6bbfc4c9f6009ad1868927eca883bb8c0c5ef6e07f7479d18",
    "draws": 13341,
    "final": "549ee50073dbc2949c963071b394ba12e91754fd70660e4e9ba2dec4740eaaa4"
  },
  {
    "seed": 1,
    "initial": "ef6a2d907a38d9bb2f2e1af6baf88812d9d6d497b8aa941a9fbf42a5a268c701",
    "draws": 13397,
    "final": "8418d62c2bb902ebdf582fa08a5ad7ae688cd9493f76b51d502c1e999926dbb9"
  },
  {
    "seed": 2,
    "initial": "0d5ee855757db6778738a70a45d2bdeeff140e285389fb2c1fba08b701376d25",
    "draws": 13339,
    "final": "d7377623843da624dc9706c33d56877a3f21e373843b6a02833260c47b6c4d11"
  },
  {
    "seed": 3,
    "initial": "e1fd06b5f7006f99b2aaaa6c11e62961003fe3316fd111985bae2f646d6e821f",
    "draws": 13343,
    "final": "6da78d600fbf9952c154195abdeed7bc838a4e20182962e35dda323896efd02f"
  },
  {
    "seed": 305419896,
    "initial": "f63f9c310be3a31b536ef92f39257cca110f67ad8927b38dca628446d451f4c9",
    "draws": 13328,
    "final": "fb8ff61b5062f0ad0f43cd564b3d5476dd59f6ce04b24eefe7df9ead3f80ccc0"
  },
  {
    "seed": 2147483647,
    "initial": "e1591bafec85b59375c534443657d90a59b4d0a7cf022d0d893dee8c9dd84935",
    "draws": 13229,
    "final": "2cab39a23e1d627e7b1e55b8331e44236e1a27bb1baea3e59b7a3b548b9be9a0"
  },
  {
    "seed": 2147483648,
    "initial": "0b4337d448f4fed0b1c1b5a29426bc40218d2f0c60df2bb987e45cb8e3fe9951",
    "draws": 13299,
    "final": "55892186565295095b62880531b1aefce084ef51a1e2f26141a6f74fd8b8335e"
  },
  {
    "seed": 4294967295,
    "initial": "d55a4c8539ee5c8e12265ccb0aaf1e18744c37e7722b74188604313c86a6abe6",
    "draws": 13343,
    "final": "df0fead0d613d2fd6757403f3c0ac7c85d7aa2251d9a42929712785fa23790bf"
  }
];

test('eight explicit boundary seeds match 160,000 independent word/jitter values and state digests', () => {
  const aggregate = createHash('sha256');
  for (const vector of VECTORS) {
    let state = createNativeRandom(vector.seed);
    assert.equal(stateHash(state), vector.initial);
    const words: number[] = [];
    for (let i = 0; i < 10_000; i++) { const draw = nextNativeRandomWord(state); assert.equal(draw.drawCount, 1); words.push(draw.value); state = draw.state; }
    aggregate.update(packed(words));
    state = createNativeRandom(vector.seed); let count = 0; const jitters: number[] = [];
    for (let i = 0; i < 10_000; i++) { const draw = nextNativeReloadJitter(state); count += draw.drawCount; jitters.push(draw.value); state = draw.state; }
    aggregate.update(packed(jitters)); assert.equal(count, vector.draws); assert.equal(stateHash(state), vector.final);
  }
  assert.equal(aggregate.digest('hex'), 'd071ccb20de54378db3bc0d00222e16da74a5e45eea22ba0ab5bdffbccb6ba8c');
});

test('all 250 ring rotations attain the exact 251-word rejection bound and oracle final states', () => {
  const aggregate = createHash('sha256');
  for (let rotation = 0; rotation < 250; rotation++) {
    const input = raw(); input.words.fill(0); input.index1 = rotation; input.index2 = (rotation + 103) % 250;
    for (let i = 44; i <= 146; i++) input.words[(rotation + i) % 250] = 3;
    const before = restoreNativeRandom(input), saved = JSON.stringify(before), draw = nextNativeReloadJitter(before);
    assert.equal(draw.value, 0); assert.equal(draw.drawCount, NATIVE_RELOAD_MAX_DRAWS);
    assert.equal(JSON.stringify(before), saved);
    aggregate.update(packed([draw.value, draw.drawCount, draw.state.index1, draw.state.index2, ...draw.state.words]));
  }
  assert.equal(aggregate.digest('hex'), '2c9bff0df9b149b5a7ec542217cc076001444599bec6954b72b265a90a56875d');
});

test('reload uses low-bit rejection, retaining each rejected advance rather than modulo or one draw', () => {
  const input = raw(); input.words.fill(0); input.words[0] = 3; input.words[1] = 7; input.words[2] = 5;
  const before = restoreNativeRandom(input), draw = nextNativeReloadJitter(before);
  assert.equal(draw.value, 1); assert.equal(draw.drawCount, 3);
  let stepped = before;
  for (const expected of [3, 7, 5]) { const next = nextNativeRandomWord(stepped); assert.equal(next.value, expected); stepped = next.state; }
  assert.deepEqual(draw.state, stepped);
});

test('disabled native guard is preserved and advances neither word nor jitter state', () => {
  const input = raw(createNativeRandom(0xffffffff)); input.disabled = true;
  const state = restoreNativeRandom(input), encoded = JSON.stringify(state);
  for (const next of [nextNativeRandomWord, nextNativeReloadJitter]) {
    const draw = next(state); assert.equal(draw.value, 0); assert.equal(draw.drawCount, 0); assert.equal(draw.state, state);
    assert.ok(Object.isFrozen(draw)); assert.equal(JSON.stringify(state), encoded);
  }
  assert.equal(restoreNativeRandom(JSON.parse(encoded)).disabled, true);
});

test('saved/restored mixed word and jitter continuations keep values, consumed counts and full state', () => {
  let uninterrupted = createNativeRandom(0x80000000);
  for (let i = 0; i < 73; i++) uninterrupted = nextNativeReloadJitter(uninterrupted).state;
  const checkpoint = JSON.stringify(uninterrupted);
  let restored = restoreNativeRandom(JSON.parse(checkpoint)), cloned = restoreNativeRandom(structuredClone(uninterrupted));
  for (let i = 0; i < 1200; i++) {
    const next = i % 4 === 0 ? nextNativeRandomWord : nextNativeReloadJitter;
    const a = next(uninterrupted), b = next(restored), c = next(cloned);
    assert.equal(b.value, a.value); assert.equal(b.drawCount, a.drawCount); assert.deepEqual(b.state, a.state); assert.deepEqual(c, b);
    uninterrupted = a.state; restored = b.state; cloned = c.state;
  }
  assert.equal(JSON.stringify(restoreNativeRandom(JSON.parse(checkpoint))), checkpoint);
});

test('results own frozen words; caller input edits and attempted output mutation cannot alter continuation', () => {
  const input = raw(), state = restoreNativeRandom(input), expected = nextNativeReloadJitter(state);
  input.words.fill(0); input.index1 = 12; input.disabled = true;
  assert.ok(Object.isFrozen(state)); assert.ok(Object.isFrozen(state.words));
  assert.throws(() => { (state.words as number[])[0] = 0; }, TypeError);
  assert.throws(() => { (state as { index1: number }).index1 = 99; }, TypeError);
  assert.deepEqual(nextNativeReloadJitter(state), expected);
  assert.notEqual(restoreNativeRandom(state), state); assert.notEqual(restoreNativeRandom(state).words, state.words);
  const shuffled = { words: state.words, index2: state.index2, index1: state.index1, disabled: state.disabled, policy: state.policy };
  assert.equal(JSON.stringify(restoreNativeRandom(shuffled)), JSON.stringify(state));
});

test('zero/all-one restored words and each index wrap are valid uint32 states', () => {
  for (const fill of [0, 0xffffffff]) for (const index1 of [0, 146, 147, 249]) {
    const input = raw(); input.words.fill(fill); input.index1 = index1; input.index2 = (index1 + 103) % NATIVE_RANDOM_WORDS;
    const draw = nextNativeRandomWord(restoreNativeRandom(input));
    assert.equal(draw.value, 0); assert.equal(draw.state.index1, (index1 + 1) % 250); assert.equal(draw.state.index2, (index1 + 104) % 250);
  }
});

test('seed creation rejects coercion, fractional, negative, oversized and non-finite values', () => {
  let calls = 0;
  for (const seed of [-0, -1, 0x100000000, 0.5, NaN, Infinity, -Infinity, '0', null, undefined, 0n, { valueOf() { calls++; return 0; } }]) {
    rejects(() => createNativeRandom(seed as number), 'seed');
  }
  assert.equal(calls, 0);
});

test('restore rejects malformed records, unknown policies/fields/symbols and nonboolean guards', () => {
  for (const value of [null, [], 'state', 2, { seed: 0 }, new Number(0), Object.create(raw())]) rejects(() => restoreNativeRandom(value));
  for (const extra of [{ extra: 0 }, { [Symbol('payload')]: 0 }]) rejects(() => restoreNativeRandom({ ...raw(), ...extra }));
  for (const policy of ['other', new String(NATIVE_RANDOM_POLICY), undefined]) rejects(() => restoreNativeRandom({ ...raw(), policy }));
  for (const disabled of [0, 1, 'false', null, new Boolean(false)]) rejects(() => restoreNativeRandom({ ...raw(), disabled }));
  const missing = raw() as Partial<ReturnType<typeof raw>>; delete missing.index1; rejects(() => restoreNativeRandom(missing));
  assert.ok(isNativeRandomState(restoreNativeRandom(Object.assign(Object.create(null), raw()))));
});

test('restore validates exact dense uint32 words without evaluating accessors', () => {
  for (const words of [[], Array(250), Array(249).fill(0), Array(251).fill(0), new Uint32Array(250), { length: 250 }]) rejects(() => restoreNativeRandom({ ...raw(), words }));
  for (const bad of [-0, -1, 0x100000000, NaN, Infinity, 0.5, '1', null, 1n, {}]) {
    const input = raw(); (input.words as unknown[])[13] = bad; rejects(() => restoreNativeRandom(input));
  }
  const extra = raw(); Object.defineProperty(extra.words, 'payload', { value: 1 }); rejects(() => restoreNativeRandom(extra));
  const symbolic = raw(); Object.defineProperty(symbolic.words, Symbol('extra'), { value: 1 }); rejects(() => restoreNativeRandom(symbolic));
  let calls = 0;
  for (const field of ['policy', 'disabled', 'index1', 'index2', 'words'] as const) {
    const input = raw(); Object.defineProperty(input, field, { enumerable: true, get() { calls++; return 0; } }); rejects(() => restoreNativeRandom(input));
  }
  const input = raw(); Object.defineProperty(input.words, '30', { enumerable: true, get() { calls++; return 0; } }); rejects(() => restoreNativeRandom(input));
  const hidden = raw(); Object.defineProperty(hidden.words, '30', { enumerable: false }); rejects(() => restoreNativeRandom(hidden));
  assert.equal(calls, 0);
});

test('restore rejects broken index separation and boundary indices before producing state', () => {
  for (const [index1, index2] of [[-0, 103], [0, -0], [-1, 102], [250, 103], [0, 250], [0, 102], [1, 103], [0.5, 103.5], [NaN, 103], [0, Infinity]]) {
    rejects(() => restoreNativeRandom({ ...raw(), index1, index2 }), 'indices');
  }
});

test('draws reject forged frozen objects and proxies without mutating authentic state', () => {
  const state = createNativeRandom(2), saved = JSON.stringify(state), revoked = Proxy.revocable(state, {}); revoked.revoke();
  for (const forged of [Object.freeze(raw(state)), new Proxy(state, {}), revoked.proxy, null, 0, 'state', undefined]) {
    assert.equal(isNativeRandomState(forged), false);
    rejects(() => nextNativeRandomWord(forged as NativeRandomState), 'untrusted-state');
    rejects(() => nextNativeReloadJitter(forged as NativeRandomState), 'untrusted-state');
  }
  rejects(() => restoreNativeRandom(revoked.proxy), 'record');
  assert.equal(JSON.stringify(state), saved); assert.ok(isNativeRandomState(state));
});
