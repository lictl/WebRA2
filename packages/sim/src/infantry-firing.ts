// SPDX-License-Identifier: GPL-3.0-or-later
// Original D03 logical firing cadence; see ../INFANTRY_FIRING_PROVENANCE.md.
import { isInfantryFiringProgram, type InfantryFiringProgram } from '../../content/src/combat-initial-runtime.ts';
import { combatActorFingerprint as fingerprint } from '../../content/src/combat-actor-values.ts';

export const INFANTRY_FIRING_POLICY = 'webra2-standing-fire-logical-1' as const;
export const INFANTRY_FIRING_LIMITS = Object.freeze({ tick: 2147483647, attempts: 1048576, commands: 65536, serializedBytes: 65536 });
interface PendingShot {
  readonly attemptId: number; readonly startedTick: number; readonly dueTick: number; readonly targetId: number; readonly weaponId: string;
}
export interface InfantryFiringState {
  readonly schemaVersion: 1; readonly policy: typeof INFANTRY_FIRING_POLICY;
  readonly programFingerprint: string; readonly actorId: number; readonly tick: number; readonly nextAttemptId: number;
  readonly shots: number; readonly pending: PendingShot | null; readonly rearm: Readonly<{ shotTick: number; nativeRof: number }> | null;
}
export interface DueInfantryShot extends PendingShot {
  readonly programFingerprint: string; readonly actorId: number; readonly tick: number; readonly stateHash: string;
}
export type InfantryFiringCommand =
  | Readonly<{ kind: 'advance'; tick: number }>
  | Readonly<{ kind: 'begin'; targetId: number; weaponId: string }>
  | Readonly<{ kind: 'cancel' }>
  | Readonly<{ kind: 'resolve'; stateHash: string; attemptId: number; targetId: number; weaponId: string;
      decision: 'admitted' | 'blocked'; nativeRof: number | null }>;
export type InfantryFiringEvent = Readonly<{ kind: 'started' | 'cancelled' | 'blocked' | 'shot'; actorId: number;
  tick: number; attemptId: number; targetId: number; weaponId: string; nativeRof: number | null }>;
export interface InfantryFiringSave {
  readonly schemaVersion: 1; readonly policy: typeof INFANTRY_FIRING_POLICY; readonly state: InfantryFiringState; readonly stateHash: string;
}
export class InfantryFiringError extends Error {
  constructor(readonly code: string) { super(`infantry-firing-${code}`); this.name = 'InfantryFiringError'; }
}
function fail(code: string): never { throw new InfantryFiringError(code); }
const states = new WeakSet<object>();
function exact(v: unknown, keys: readonly string[]): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Reflect.ownKeys(v).length !== keys.length) fail('record');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(v, key); if (!d || !('value' in d) || !d.enumerable) fail('fields'); }
}
function integer(v: unknown, min = 0, max: number = INFANTRY_FIRING_LIMITS.tick): asserts v is number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || Object.is(v, -0) || v < min || v > max) fail('integer');
}
function weapon(v: unknown): asserts v is string { if (typeof v !== 'string' || !/^[\x21-\x7e]{1,256}$/.test(v)) fail('weapon-id'); }
function hash(v: unknown): asserts v is string { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) fail('hash'); }
function program(p: InfantryFiringProgram): void { if (!isInfantryFiringProgram(p)) fail('program'); }
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function own(v: InfantryFiringState): InfantryFiringState { const r = freeze(v); states.add(r); return r; }
function checked(p: InfantryFiringProgram, s: InfantryFiringState): void {
  program(p); if (!s || !states.has(s) || s.programFingerprint !== p.fingerprint || s.actorId !== p.actorId) fail('state');
}
const stateHash = (s: InfantryFiringState): string => fingerprint(s, INFANTRY_FIRING_LIMITS.serializedBytes);
const earliest = (s: InfantryFiringState): number => s.rearm === null ? 0 : s.rearm.shotTick + Math.max(1, s.rearm.nativeRof);
export function createInfantryFiringState(p: InfantryFiringProgram): InfantryFiringState {
  program(p); return own({ schemaVersion: 1, policy: INFANTRY_FIRING_POLICY, programFingerprint: p.fingerprint,
    actorId: p.actorId, tick: 0, nextAttemptId: 1, shots: 0, pending: null, rearm: null });
}
/** The caller must still revalidate current world eligibility. No RNG, ammo or damage is consumed here. */
export function inspectDueInfantryShot(p: InfantryFiringProgram, s: InfantryFiringState): DueInfantryShot | null {
  checked(p, s); return s.pending && s.tick >= s.pending.dueTick ? freeze({ ...s.pending, programFingerprint: p.fingerprint,
    actorId: p.actorId, tick: s.tick, stateHash: stateHash(s) }) : null;
}

/** Atomic pure transition. 'admitted' means the caller revalidated this exact due-state hash now. */
export function transitionInfantryFiring(p: InfantryFiringProgram, s: InfantryFiringState, command: InfantryFiringCommand): Readonly<{
  state: InfantryFiringState; event: InfantryFiringEvent | null }> {
  checked(p, s);
  if (!command || typeof command !== 'object') fail('command');
  const k = Object.getOwnPropertyDescriptor(command, 'kind'); if (!k || !('value' in k)) fail('command');
  let next: InfantryFiringState = s, event: InfantryFiringEvent | null = null;
  const emit = (kind: InfantryFiringEvent['kind'], pending: PendingShot, nativeRof: number | null = null): InfantryFiringEvent =>
    ({ kind, actorId: p.actorId, tick: s.tick, attemptId: pending.attemptId, targetId: pending.targetId, weaponId: pending.weaponId, nativeRof });
  switch (command.kind) {
    case 'advance': {
      exact(command, ['kind', 'tick']); integer(command.tick);
      if (command.tick !== s.tick + 1) fail('tick-order');
      next = { ...s, tick: command.tick }; break;
    }
    case 'begin': {
      exact(command, ['kind', 'targetId', 'weaponId']); integer(command.targetId, 1); weapon(command.weaponId);
      if (command.targetId === p.actorId || s.pending || s.tick < earliest(s)) fail('not-ready');
      if (s.nextAttemptId > INFANTRY_FIRING_LIMITS.attempts) fail('attempt-limit');
      const dueTick = s.tick + p.fireUp; integer(dueTick);
      const pending = { attemptId: s.nextAttemptId, startedTick: s.tick, dueTick, targetId: command.targetId, weaponId: command.weaponId };
      next = { ...s, nextAttemptId: s.nextAttemptId + 1, pending }; event = emit('started', pending); break;
    }
    case 'cancel': {
      exact(command, ['kind']);
      if (s.pending) { next = { ...s, pending: null }; event = emit('cancelled', s.pending); } break;
    }
    case 'resolve': {
      exact(command, ['kind', 'stateHash', 'attemptId', 'targetId', 'weaponId', 'decision', 'nativeRof']);
      hash(command.stateHash); integer(command.attemptId, 1, INFANTRY_FIRING_LIMITS.attempts); integer(command.targetId, 1); weapon(command.weaponId);
      if (command.decision !== 'admitted' && command.decision !== 'blocked') fail('decision');
      if (command.decision === 'admitted') integer(command.nativeRof); else if (command.nativeRof !== null) fail('blocked-rof');
      const due = inspectDueInfantryShot(p, s);
      if (!due || command.stateHash !== due.stateHash || command.attemptId !== due.attemptId || command.targetId !== due.targetId || command.weaponId !== due.weaponId) fail('stale-resolution');
      if (command.decision === 'blocked') { next = { ...s, pending: null }; event = emit('blocked', due); }
      else {
        // Keep the native numeric result unchanged. A distinct logical-update guard prevents ROF=0 loops.
        const nativeRof = command.nativeRof as number; integer(s.tick + Math.max(1, nativeRof));
        if (s.tick < earliest(s)) fail('rearm');
        next = { ...s, pending: null, shots: s.shots + 1, rearm: { shotTick: s.tick, nativeRof } }; event = emit('shot', due, nativeRof);
      }
      break;
    }
    default: fail('command-kind');
  }
  return freeze({ state: next === s ? s : own(next), event });
}
export function saveInfantryFiring(p: InfantryFiringProgram, s: InfantryFiringState): InfantryFiringSave {
  checked(p, s); return freeze({ schemaVersion: 1, policy: INFANTRY_FIRING_POLICY, state: s, stateHash: stateHash(s) });
}
/** Strict structural/source validation. A save is state, not proof that its history was genuinely played. */
export function restoreInfantryFiring(p: InfantryFiringProgram, value: unknown): InfantryFiringState {
  program(p); exact(value, ['schemaVersion', 'policy', 'state', 'stateHash']);
  if (value.schemaVersion !== 1 || value.policy !== INFANTRY_FIRING_POLICY) fail('save-version'); hash(value.stateHash);
  const s = value.state;
  exact(s, ['schemaVersion', 'policy', 'programFingerprint', 'actorId', 'tick', 'nextAttemptId', 'shots', 'pending', 'rearm']);
  if (s.schemaVersion !== 1 || s.policy !== INFANTRY_FIRING_POLICY || s.programFingerprint !== p.fingerprint || s.actorId !== p.actorId) fail('save-source');
  integer(s.tick); integer(s.nextAttemptId, 1, INFANTRY_FIRING_LIMITS.attempts + 1); integer(s.shots, 0, INFANTRY_FIRING_LIMITS.attempts);
  if (s.shots >= s.nextAttemptId || s.shots > s.tick + 1) fail('save-shots');
  let rearm: InfantryFiringState['rearm'] = null, pending: PendingShot | null = null;
  if (s.rearm !== null) {
    exact(s.rearm, ['shotTick', 'nativeRof']); integer(s.rearm.shotTick, Math.max(0, s.shots - 1), s.tick); integer(s.rearm.nativeRof);
    integer(s.rearm.shotTick + Math.max(1, s.rearm.nativeRof)); rearm = { shotTick: s.rearm.shotTick, nativeRof: s.rearm.nativeRof };
  }
  if ((s.shots > 0) !== (rearm !== null)) fail('save-rearm');
  if (s.pending !== null) {
    exact(s.pending, ['attemptId', 'startedTick', 'dueTick', 'targetId', 'weaponId']);
    integer(s.pending.attemptId, 1, INFANTRY_FIRING_LIMITS.attempts); integer(s.pending.startedTick, 0, s.tick); integer(s.pending.dueTick);
    integer(s.pending.targetId, 1); weapon(s.pending.weaponId);
    if (s.pending.attemptId !== s.nextAttemptId - 1 || s.pending.dueTick !== s.pending.startedTick + p.fireUp || s.pending.targetId === p.actorId ||
      s.pending.startedTick < (rearm ? rearm.shotTick + Math.max(1, rearm.nativeRof) : 0) || s.shots >= s.nextAttemptId - 1) fail('save-pending');
    pending = { attemptId: s.pending.attemptId, startedTick: s.pending.startedTick, dueTick: s.pending.dueTick, targetId: s.pending.targetId, weaponId: s.pending.weaponId };
  }
  const result: InfantryFiringState = { schemaVersion: 1, policy: INFANTRY_FIRING_POLICY, programFingerprint: p.fingerprint,
    actorId: p.actorId, tick: s.tick, nextAttemptId: s.nextAttemptId, shots: s.shots, pending, rearm };
  if (stateHash(result) !== value.stateHash) fail('save-hash'); return own(result);
}
/** Original command transcript replay. The transcript must contain explicit due-state admission decisions. */
export function replayInfantryFiring(p: InfantryFiringProgram, commands: readonly InfantryFiringCommand[], maxCommands: number = INFANTRY_FIRING_LIMITS.commands): Readonly<{
  state: InfantryFiringState; events: readonly InfantryFiringEvent[] }> {
  program(p); integer(maxCommands, 0, INFANTRY_FIRING_LIMITS.commands);
  if (!Array.isArray(commands) || Object.getPrototypeOf(commands) !== Array.prototype || commands.length > maxCommands || Reflect.ownKeys(commands).length !== commands.length + 1) fail('replay-limit');
  // Validate and own commands before executing any transition, rejecting getters, sparse slots and non-index properties.
  const copied: InfantryFiringCommand[] = [];
  for (let i = 0; i < commands.length; i++) {
    const d = Object.getOwnPropertyDescriptor(commands, String(i)); if (!d || !('value' in d) || !d.enumerable) fail('replay-array');
    const c = d.value, kind = c && typeof c === 'object' ? Object.getOwnPropertyDescriptor(c, 'kind') : undefined;
    if (!kind || !('value' in kind)) fail('command');
    const keys = kind.value === 'advance' ? ['kind', 'tick'] : kind.value === 'begin' ? ['kind', 'targetId', 'weaponId'] : kind.value === 'cancel' ? ['kind'] :
      kind.value === 'resolve' ? ['kind', 'stateHash', 'attemptId', 'targetId', 'weaponId', 'decision', 'nativeRof'] : null;
    if (!keys) fail('command-kind'); exact(c, keys);
    // All legal fields are scalars, validated without coercion by the transition.
    copied.push({ ...c } as InfantryFiringCommand);
  }
  let state = createInfantryFiringState(p); const events: InfantryFiringEvent[] = [];
  for (const c of copied) { const result = transitionInfantryFiring(p, state, c); state = result.state; if (result.event) events.push(result.event); }
  return freeze({ state, events });
}
