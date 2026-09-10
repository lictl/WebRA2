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
function owned(v: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Reflect.ownKeys(v).length !== keys.length) fail('record');
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(v, key); if (!d || !('value' in d) || !d.enumerable) fail('fields'); result[key] = d.value; }
  return result;
}
function ownCommand(v: unknown): InfantryFiringCommand {
  if (!v || typeof v !== 'object') fail('command');
  const descriptor = Object.getOwnPropertyDescriptor(v, 'kind'); if (!descriptor || !('value' in descriptor)) fail('command');
  const kind: unknown = descriptor.value;
  const keys = kind === 'advance' ? ['kind', 'tick'] : kind === 'begin' ? ['kind', 'targetId', 'weaponId'] : kind === 'cancel' ? ['kind'] :
    kind === 'resolve' ? ['kind', 'stateHash', 'attemptId', 'targetId', 'weaponId', 'decision', 'nativeRof'] : null;
  if (!keys) fail('command-kind');
  const result = owned(v, keys); if (result.kind !== kind) fail('command-kind');
  return result as unknown as InfantryFiringCommand;
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
  command = ownCommand(command);
  let next: InfantryFiringState = s, event: InfantryFiringEvent | null = null;
  const emit = (kind: InfantryFiringEvent['kind'], pending: PendingShot, nativeRof: number | null = null): InfantryFiringEvent =>
    ({ kind, actorId: p.actorId, tick: s.tick, attemptId: pending.attemptId, targetId: pending.targetId, weaponId: pending.weaponId, nativeRof });
  switch (command.kind) {
    case 'advance': {
      integer(command.tick);
      if (command.tick !== s.tick + 1) fail('tick-order');
      next = { ...s, tick: command.tick }; break;
    }
    case 'begin': {
      integer(command.targetId, 1); weapon(command.weaponId);
      if (command.targetId === p.actorId || s.pending || s.tick < earliest(s)) fail('not-ready');
      if (s.nextAttemptId > INFANTRY_FIRING_LIMITS.attempts) fail('attempt-limit');
      const dueTick = s.tick + p.fireUp; integer(dueTick);
      const pending = { attemptId: s.nextAttemptId, startedTick: s.tick, dueTick, targetId: command.targetId, weaponId: command.weaponId };
      next = { ...s, nextAttemptId: s.nextAttemptId + 1, pending }; event = emit('started', pending); break;
    }
    case 'cancel': {
      if (s.pending) { next = { ...s, pending: null }; event = emit('cancelled', s.pending); } break;
    }
    case 'resolve': {
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
  program(p); const envelope = owned(value, ['schemaVersion', 'policy', 'state', 'stateHash']);
  if (envelope.schemaVersion !== 1 || envelope.policy !== INFANTRY_FIRING_POLICY) fail('save-version'); hash(envelope.stateHash);
  const s = owned(envelope.state, ['schemaVersion', 'policy', 'programFingerprint', 'actorId', 'tick', 'nextAttemptId', 'shots', 'pending', 'rearm']);
  if (s.schemaVersion !== 1 || s.policy !== INFANTRY_FIRING_POLICY || s.programFingerprint !== p.fingerprint || s.actorId !== p.actorId) fail('save-source');
  integer(s.tick); integer(s.nextAttemptId, 1, INFANTRY_FIRING_LIMITS.attempts + 1); integer(s.shots, 0, INFANTRY_FIRING_LIMITS.attempts);
  if (s.shots >= s.nextAttemptId || s.shots > s.tick + 1) fail('save-shots');
  let rearm: InfantryFiringState['rearm'] = null, pending: PendingShot | null = null;
  if (s.rearm !== null) {
    const saved = owned(s.rearm, ['shotTick', 'nativeRof']); integer(saved.shotTick, Math.max(0, s.shots * (p.fireUp + 1) - 1), s.tick); integer(saved.nativeRof);
    integer(saved.shotTick + Math.max(1, saved.nativeRof)); rearm = { shotTick: saved.shotTick, nativeRof: saved.nativeRof };
  }
  if ((s.shots > 0) !== (rearm !== null)) fail('save-rearm');
  if (s.pending !== null) {
    const saved = owned(s.pending, ['attemptId', 'startedTick', 'dueTick', 'targetId', 'weaponId']);
    integer(saved.attemptId, 1, INFANTRY_FIRING_LIMITS.attempts); integer(saved.startedTick, 0, s.tick); integer(saved.dueTick);
    integer(saved.targetId, 1); weapon(saved.weaponId);
    if (saved.attemptId !== s.nextAttemptId - 1 || saved.dueTick !== saved.startedTick + p.fireUp || saved.targetId === p.actorId ||
      saved.startedTick < (rearm ? rearm.shotTick + Math.max(1, rearm.nativeRof) : 0) || s.shots >= s.nextAttemptId - 1) fail('save-pending');
    pending = { attemptId: saved.attemptId, startedTick: saved.startedTick, dueTick: saved.dueTick, targetId: saved.targetId, weaponId: saved.weaponId };
  }
  const result: InfantryFiringState = { schemaVersion: 1, policy: INFANTRY_FIRING_POLICY, programFingerprint: p.fingerprint,
    actorId: p.actorId, tick: s.tick, nextAttemptId: s.nextAttemptId, shots: s.shots, pending, rearm };
  if (stateHash(result) !== envelope.stateHash) fail('save-hash'); return own(result);
}
/** Original command transcript replay. The transcript must contain explicit due-state admission decisions. */
export function replayInfantryFiring(p: InfantryFiringProgram, commands: readonly InfantryFiringCommand[], maxCommands: number = INFANTRY_FIRING_LIMITS.commands): Readonly<{
  state: InfantryFiringState; events: readonly InfantryFiringEvent[] }> {
  program(p); integer(maxCommands, 0, INFANTRY_FIRING_LIMITS.commands);
  if (!Array.isArray(commands) || Object.getPrototypeOf(commands) !== Array.prototype) fail('replay-limit');
  const length = Object.getOwnPropertyDescriptor(commands, 'length');
  if (!length || !('value' in length)) fail('replay-array');
  const count: unknown = length.value; integer(count, 0, maxCommands);
  if (Reflect.ownKeys(commands).length !== count + 1) fail('replay-limit');
  // Snapshot array length, slots and command descriptors; never read an untrusted object's properties twice.
  const copied: InfantryFiringCommand[] = [];
  for (let i = 0; i < count; i++) {
    const d = Object.getOwnPropertyDescriptor(commands, String(i)); if (!d || !('value' in d) || !d.enumerable) fail('replay-array');
    copied.push(ownCommand(d.value));
  }
  let state = createInfantryFiringState(p); const events: InfantryFiringEvent[] = [];
  for (const c of copied) { const result = transitionInfantryFiring(p, state, c); state = result.state; if (result.event) events.push(result.event); }
  return freeze({ state, events });
}
