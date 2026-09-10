// SPDX-License-Identifier: MIT
// Shared strict values for the original world model and deterministic runtime.
import { sha256 } from '@noble/hashes/sha2.js';
import type { ContentIdentity } from '../../contracts/src/index.ts';
import { canonicalText } from './canonical.ts';

export const WORLD_LIMITS = Object.freeze({ entities: 2048, players: 256, grids: 8, blocked: 16384,
  paths: 16384, commands: 256, futureTicks: 10000, stepTicks: 128, tick: 1_000_000_000,
  routeExpansionsPerTick: 8192, routeQueriesPerTick: 8, transitionsPerTick: 8192, trace: 32768,
  retryTicks: 15, health: 1_000_000, replayTicks: 10000, replayAdmissions: 1024, replayWork: 16_777_216 });
export class WorldError extends Error { constructor(readonly code: string) { super(code); this.name = 'WorldError'; } }
export function worldFail(code: string): never { throw new WorldError(code); }
export function worldRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) worldFail('world-record');
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d) || !d.enumerable) worldFail('world-fields'); out[key] = d.value;
  }
  return out;
}
export function worldList(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) worldFail('world-array-limit');
  // Own the length once, just like each element. Proxy reads cannot change a bound after validation.
  const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
  const length: unknown = descriptor && 'value' in descriptor ? descriptor.value : undefined;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > max ||
    Reflect.ownKeys(value).length !== length + 1) worldFail('world-array-limit');
  const out: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d) || !d.enumerable) worldFail('world-array'); out.push(d.value);
  }
  return out;
}
export function worldInteger(value: unknown, min: number = 0, max: number = WORLD_LIMITS.tick): number {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < min || (value as number) > max) worldFail('world-integer'); return value as number;
}
export function worldSymbol(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 255 || /[\x00-\x1f\x7f]/.test(value)) worldFail('world-symbol'); return value;
}
export function worldSourceHash(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) worldFail('world-source-hash'); return value; }
export function worldClone<T>(value: T): T {
  try { return JSON.parse(canonicalText(value)) as T; } catch { return worldFail('world-json-limit'); }
}
export function worldContent(value: unknown): ContentIdentity {
  const r = worldRecord(value, ['profile', 'manifestSha256', 'rulesSha256', 'orderedModHashes']);
  if (r.profile !== 'ra2' && r.profile !== 'yr') worldFail('world-profile');
  return Object.freeze({ profile: r.profile, manifestSha256: worldSourceHash(r.manifestSha256), rulesSha256: worldSourceHash(r.rulesSha256),
    orderedModHashes: Object.freeze(worldList(r.orderedModHashes, 256).map(worldSourceHash)) });
}
export function worldAddress(x: unknown, y: unknown): number { return worldInteger(x, 0, 511) + 512 * worldInteger(y, 0, 511); }
export const worldPosition = (address: number) => ({ x: address % 512, y: Math.floor(address / 512) });
export function worldHash(value: unknown): string {
  const bytes = new TextEncoder().encode(canonicalText(value)); return Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
