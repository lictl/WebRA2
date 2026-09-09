// SPDX-License-Identifier: MIT
import { RNG_VERSION, SimulationError, type RngState } from './types.ts';

/** Original synthetic choice: 32-bit LCG; no native or cryptographic compatibility claim. */
export function nextRandom(state: RngState): number {
  if (state.algorithm !== RNG_VERSION || !Number.isSafeInteger(state.value) || state.value < 0 || state.value > 0xffffffff || Object.is(state.value, -0) || !Number.isSafeInteger(state.draws) || state.draws < 0 || Object.is(state.draws, -0)) throw new SimulationError('invalid-rng-state');
  if (state.draws >= Number.MAX_SAFE_INTEGER) throw new SimulationError('rng-draw-overflow');
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0; state.draws++; return state.value;
}
export function sampleRandom(state: RngState, bound: number): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 65536) throw new SimulationError('rng-bound');
  // Rejection avoids modulo bias; bounded retries make an exceptional failure transactional.
  const threshold = Math.floor(4294967296 / bound) * bound;
  const candidate = { ...state };
  for (let i = 0; i < 64; i++) { const value = nextRandom(candidate); if (value < threshold) { state.value = candidate.value; state.draws = candidate.draws; return value % bound; } }
  throw new SimulationError('rng-rejection-limit');
}
export function seededRandom(seed: number): RngState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || Object.is(seed, -0)) throw new SimulationError('rng-seed');
  return { algorithm: RNG_VERSION, value: seed, draws: 0 };
}
