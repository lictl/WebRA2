// SPDX-License-Identifier: MIT
export { Simulation } from './kernel.ts';
export { ReplayRecorder, replay } from './replay.ts';
export { canonicalBytes, canonicalText, canonicalHash, parseJson } from './canonical.ts';
export { seededRandom, nextRandom, sampleRandom } from './rng.ts';
export { ENGINE_VERSION, RULES_VERSION, RNG_VERSION, LIMITS, SimulationError } from './types.ts';
export type { Scenario, Entity, Position, SimSave, SimState, ScheduledWork, RngState, TraceEvent, StepResult, ReplayDocument, Digest } from './types.ts';
export { createNavigationGrid, findNavigationPath, navigationCell, NavigationError, NAVIGATION_POLICY, NAVIGATION_LIMITS } from './navigation.ts';
export type { NavigationPosition, NavigationCell, NavigationGrid, NavigationInput, NavigationQuery, NavigationResult } from './navigation.ts';
