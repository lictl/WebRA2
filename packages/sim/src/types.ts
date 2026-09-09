// SPDX-License-Identifier: MIT
import type { CommandEnvelope, ContentIdentity, JsonValue, ReplayEnvelope, SaveEnvelope } from '../../contracts/src/index.ts';

export const ENGINE_VERSION = 'webra2-synthetic-1';
export const RULES_VERSION = 'grid-xfirst-delayed-combat-1';
export const RNG_VERSION = 'webra2-lcg32-1';
export const LIMITS = Object.freeze({ jsonBytes: 2_097_152, jsonNodes: 50_000, jsonDepth: 48, grid: 128, players: 16, entities: 256, commands: 4096, work: 1024, futureTicks: 10_000, stepTicks: 1024, replayTicks: 100_000, trace: 32_768, tick: 1_000_000_000, hp: 10_000 });
export class SimulationError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'SimulationError'; }
}
export type Position = { x: number; y: number };
export type Entity = { id: number; owner: number; x: number; y: number; hp: number; destination: Position | null };
export type SimState = { width: number; height: number; blocked: Position[]; entities: Entity[]; nextEntityId: number; nextWorkOrder: number; admissionCursors: { playerId: number; sequence: number }[]; resolvedEvents: number };
export type RngState = { algorithm: typeof RNG_VERSION; value: number; draws: number };
export type ScheduledWork = { dueTick: number; order: number; kind: 'impact'; payload: { attackerId: number; targetId: number } } | { dueTick: number; order: number; kind: 'reinforcement'; payload: { owner: number; x: number; y: number; hp: number } };
export type SimSave = SaveEnvelope<SimState>;
export type TraceEvent = { tick: number; phase: 'command' | 'work' | 'movement'; kind: string; entityId: number; otherId: number | null; value: number | null };
export type StepResult = { nextTick: number; events: TraceEvent[] };
export type Scenario = { width: number; height: number; blocked: Position[]; entities: { owner: number; x: number; y: number; hp: number }[]; reinforcements: { dueTick: number; owner: number; x: number; y: number; hp: number }[]; seed: number };
/** Admission time is authoritative queue/cursor state and is absent from ReplayEnvelope v1. */
export type ReplayDocument = { schemaVersion: 1; replay: ReplayEnvelope; admissions: { nextTick: number; commandIndexes: number[] }[]; finalNextTick: number };
export type Digest = (canonicalBytes: Uint8Array) => Promise<string>;
export type { CommandEnvelope, ContentIdentity, JsonValue, ReplayEnvelope };
