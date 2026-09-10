// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2025 Electronic Arts Inc. Copyright 2026 WebRA2 contributors.
// Adapted from EA Random2/Random3; see ../NATIVE_RANDOM_PROVENANCE.md.

export const NATIVE_RANDOM_POLICY = 'webra2-native-random-1' as const;
export const NATIVE_RANDOM_WORDS = 250;
export const NATIVE_RELOAD_MAX_DRAWS = 251;

/** Logical save state; native padding is excluded. Both pinned profiles use this algorithm. */
export interface NativeRandomState {
  readonly policy: typeof NATIVE_RANDOM_POLICY;
  readonly disabled: boolean;
  readonly index1: number;
  readonly index2: number;
  readonly words: readonly number[];
}
export interface NativeRandomDraw<T extends number = number> {
  readonly value: T;
  /** Number of word-state advances, including rejected words; disabled draws advance zero. */
  readonly drawCount: number;
  readonly state: NativeRandomState;
}
export class NativeRandomError extends Error {
  constructor(readonly code: string) { super(`native-random-${code}`); this.name = 'NativeRandomError'; }
}
const states = new WeakSet<object>();
const KEYS = ['policy', 'disabled', 'index1', 'index2', 'words'] as const;
// The first four elements of each EA Random3 table are used by the four seed rounds.
const MIX1 = [0xbaa96887, 0x1e17d32c, 0x03bcdc3c, 0x0f33d1b2] as const;
const MIX2 = [0x4b0f3b58, 0xe874f0c3, 0x6955c5a6, 0x55a7ca46] as const;
function fail(code: string): never { throw new NativeRandomError(code); }
function uint32(v: unknown, code: string): asserts v is number {
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 0xffffffff || Object.is(v, -0)) fail(code);
}
/** Inspect data descriptors instead of evaluating getters on imported state. */
function ownValue(v: object, key: string): unknown {
  const d = Object.getOwnPropertyDescriptor(v, key);
  if (!d || !('value' in d) || !d.enumerable) fail('fields');
  return d.value;
}
function make(disabled: boolean, index1: number, index2: number, ownedWords: number[]): NativeRandomState {
  const state = Object.freeze({ policy: NATIVE_RANDOM_POLICY, disabled, index1, index2, words: Object.freeze(ownedWords) });
  states.add(state); return state;
}
export function isNativeRandomState(value: unknown): value is NativeRandomState {
  return value !== null && typeof value === 'object' && states.has(value);
}
function requireState(state: NativeRandomState): void {
  if (!isNativeRandomState(state)) fail('untrusted-state');
}

/** Explicit seed only: no clock, entropy, native campaign seed selection or implicit reseeding. */
export function createNativeRandom(seed: number): NativeRandomState {
  uint32(seed, 'seed');
  const words: number[] = [];
  for (let index = 0; index < NATIVE_RANDOM_WORDS; index++) {
    let left = seed | 0, right = index;
    for (let round = 0; round < 4; round++) {
      const previous = right, mixed = previous ^ MIX1[round]!;
      const low = mixed & 0xffff, high = mixed >> 16;
      let value = (Math.imul(low, low) + ~Math.imul(high, high)) | 0;
      // Arithmetic shift, not an unsigned rotate: matches the native signed high word.
      value = (value >> 16) | (value << 16);
      right = left ^ (((value ^ MIX2[round]!) + Math.imul(low, high)) | 0);
      left = previous;
    }
    words.push(right >>> 0);
  }
  return make(false, 0, 103, words);
}

/** Restore a complete logical state. JSON/structured clones become independent owned states. */
export function restoreNativeRandom(value: unknown): NativeRandomState {
  try {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('record');
    if (Reflect.ownKeys(value).length !== KEYS.length) fail('fields');
    const [policy, disabled, index1, index2, input] = KEYS.map(key => ownValue(value, key));
    if (policy !== NATIVE_RANDOM_POLICY) fail('policy');
    if (typeof disabled !== 'boolean') fail('disabled');
    uint32(index1, 'indices'); uint32(index2, 'indices');
    if (index1 >= NATIVE_RANDOM_WORDS || index2 >= NATIVE_RANDOM_WORDS || index2 !== (index1 + 103) % NATIVE_RANDOM_WORDS) fail('indices');
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) fail('words');
    const length = Object.getOwnPropertyDescriptor(input, 'length');
    if (!length || !('value' in length) || length.value !== NATIVE_RANDOM_WORDS || Reflect.ownKeys(input).length !== NATIVE_RANDOM_WORDS + 1) fail('words');
    const words: number[] = [];
    for (let i = 0; i < NATIVE_RANDOM_WORDS; i++) { const word = ownValue(input, String(i)); uint32(word, 'word'); words.push(word); }
    return make(disabled, index1, index2, words);
  } catch (error) {
    if (error instanceof NativeRandomError) throw error;
    // Revoked proxies and descriptor traps cannot leak a partially created state.
    return fail('record');
  }
}

function advance(words: number[], index1: number, index2: number): number {
  const value = (words[index1]! ^ words[index2]!) >>> 0;
  words[index1] = value; return value;
}
export function nextNativeRandomWord(state: NativeRandomState): NativeRandomDraw {
  requireState(state);
  if (state.disabled) return Object.freeze({ value: 0, drawCount: 0, state });
  const words = [...state.words], value = advance(words, state.index1, state.index2);
  return Object.freeze({ value, drawCount: 1, state: make(false, (state.index1 + 1) % NATIVE_RANDOM_WORDS, (state.index2 + 1) % NATIVE_RANDOM_WORDS, words) });
}

/** Inclusive native 0..2 reload sample. Does not schedule a shot or choose global draw order. */
export function nextNativeReloadJitter(state: NativeRandomState): NativeRandomDraw<0 | 1 | 2> {
  requireState(state);
  if (state.disabled) return Object.freeze({ value: 0, drawCount: 0, state });
  const words = [...state.words]; let index1 = state.index1, index2 = state.index2;
  for (let drawCount = 1; drawCount <= NATIVE_RELOAD_MAX_DRAWS; drawCount++) {
    const value = advance(words, index1, index2) & 3;
    index1 = (index1 + 1) % NATIVE_RANDOM_WORDS; index2 = (index2 + 1) % NATIVE_RANDOM_WORDS;
    if (value !== 3) return Object.freeze({ value: value as 0 | 1 | 2, drawCount, state: make(false, index1, index2, words) });
  }
  // Unreachable for validated 103-separated rings: x[n] = x[n-250] XOR x[n-147].
  return fail('rejection-limit');
}
