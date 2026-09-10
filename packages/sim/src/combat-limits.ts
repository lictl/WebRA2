// SPDX-License-Identifier: MIT
// A leaf module keeps model/content authentication free of initialization cycles.
import { WORLD_LIMITS as W } from './world-values.ts';
export const COMBAT_LIMITS = Object.freeze({ weapons: 1024, actors: W.entities, slots: 2, impacts: 4096,
  shotsPerTick: 4096, operationsPerTick: 16384, sourceContextPerTick: 262144, burst: 64, delay: 10000, ammo: 1_000_000, range: 262144 });
