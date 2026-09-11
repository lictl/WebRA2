// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original bounded cue contracts; see ../MISSION_CUES_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
export const MISSION_CUE_POLICY = 'webra2-mission-cue-reference-1' as const;
export const MISSION_CUE_LIMITS = Object.freeze({ inputBytes: 32 * 1024 ** 2, memberBytes: 16 * 1024 ** 2,
  instructions: 8192, textUnits: 1_048_576, textPerCue: 4096, serializedBytes: 16 * 1024 ** 2 });
export const MISSION_SPATIAL_AUDIO_CUE_POLICY = 'webra2-mission-spatial-audio-cues-1' as const;
export type MissionCueOpcode = 10 | 11 | 19 | 20 | 21 | 48 | 55 | 99 | 116;
export interface MissionSpatialAudioLocation { readonly waypoint: number; readonly x: number; readonly y: number;
  readonly selection: 'current-building-first-terrain-otherwise-position' }
export interface MissionCueSource { readonly id: string; readonly profile: 'ra2' | 'yr'; readonly sha256: string }
export type MissionCuePayload =
  | { readonly kind: 'text'; readonly label: string; readonly text: string; readonly languageId: number; readonly stringOrdinal: number; readonly stringsSha256: string }
  | { readonly kind: 'camera-waypoint'; readonly waypoint: number; readonly x: number; readonly y: number; readonly nativeArgument: number }
  | { readonly kind: 'radar-waypoint'; readonly waypoint: number; readonly x: number; readonly y: number; readonly nativeType: number }
  | { readonly kind: 'empty-text' };
export interface MissionCueInstruction {
  readonly id: string; readonly triggerId: string; readonly ordinal: number; readonly opcode: MissionCueOpcode;
  readonly status: 'resolved-reference' | 'unsupported'; readonly payload: MissionCuePayload | null;
  readonly spatialLocation?: MissionSpatialAudioLocation;
  readonly operand: Readonly<{ mode: string; value: string; waypoint: string }>;
  readonly reasons: readonly string[]; readonly pendingPresentation: readonly string[];
}
export interface MissionCueCatalog {
  readonly policy: typeof MISSION_CUE_POLICY; readonly profile: 'ra2' | 'yr'; readonly source: MissionCueSource;
  readonly spatialAudioPolicy?: typeof MISSION_SPATIAL_AUDIO_CUE_POLICY; readonly initialWaypointsSha256?: string;
  readonly sha256: string; readonly pins: readonly Readonly<{ role: 'mission' | 'strings'; path: string; sha256: string; size: number }>[];
  readonly instructions: readonly MissionCueInstruction[];
  readonly coverage: readonly Readonly<{ opcode: MissionCueOpcode; occurrences: number; resolvedReferences: number }>[];
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false; readonly playbackReady: false;
}
export class MissionCueError extends Error { constructor(readonly code: string) { super(`mission-cue-${code}`); this.name = 'MissionCueError'; } }
export function cueFail(code: string): never { throw new MissionCueError(code); }
/** Own scalars through data descriptors, including Proxy-backed plain objects. */
export function cueRecord(v: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Reflect.ownKeys(v).length !== keys.length) cueFail('record');
  const out: Record<string, unknown> = Object.create(null);
  for (const k of keys) { const d = Object.getOwnPropertyDescriptor(v, k); if (!d || !('value' in d) || !d.enumerable) cueFail('field'); out[k] = d.value; }
  return out;
}
export function cueInteger(v: unknown, maximum: number, minimum = 0): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || Object.is(v, -0) || v < minimum || v > maximum) cueFail('integer'); return v;
}
export function cueText(v: unknown, maximum = 512): string {
  if (typeof v !== 'string' || !v.length || v.length > maximum || /[\x00-\x1f\x7f]/.test(v)) cueFail('string'); return v;
}
export function cueList(v: unknown, maximum: number): unknown[] {
  if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) cueFail('array');
  const d = Object.getOwnPropertyDescriptor(v, 'length'); if (!d || !('value' in d)) cueFail('array');
  const length = cueInteger(d.value, maximum); if (Reflect.ownKeys(v).length !== length + 1) cueFail('array');
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) { const slot = Object.getOwnPropertyDescriptor(v, String(i)); if (!slot || !('value' in slot) || !slot.enumerable) cueFail('array'); result.push(slot.value); }
  return result;
}
export function cueFreeze<T>(v: T): T { if (v && typeof v === 'object') { for (const c of Object.values(v)) cueFreeze(c); Object.freeze(v); } return v; }
export function cueHash(bytes: Uint8Array): string { return Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join(''); }
export function cueFingerprint(v: unknown, maximum: number): string {
  const bytes = new TextEncoder().encode(JSON.stringify(v)); if (bytes.length > maximum) cueFail('serialized-limit'); return cueHash(bytes);
}
export function cueBytes(raw: unknown, maximum: number): Uint8Array {
  if (!raw || Object.getPrototypeOf(raw) !== Uint8Array.prototype) cueFail('bytes');
  const proto = Object.getPrototypeOf(Uint8Array.prototype) as object;
  let size: number, buffer: unknown;
  try { size = Object.getOwnPropertyDescriptor(proto, 'byteLength')!.get!.call(raw) as number; buffer = Object.getOwnPropertyDescriptor(proto, 'buffer')!.get!.call(raw); }
  catch { return cueFail('bytes'); }
  if (!(buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(buffer) || size < 1 || size > maximum) cueFail('bytes');
  const bytes = new Uint8Array(size); Uint8Array.prototype.set.call(bytes, raw as Uint8Array); return bytes;
}
