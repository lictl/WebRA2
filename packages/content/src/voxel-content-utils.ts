// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Shared bounded metadata helpers for this component.
import { sha256 } from '@noble/hashes/sha2.js';
export class VoxelContentError extends Error {
  constructor(readonly code: string, readonly path = '') { super(`voxel-content-${code}`); this.name = 'VoxelContentError'; }
}
export function fail(code: string, path = ''): never { throw new VoxelContentError(code, path); }
export function plain(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('record');
}
export function data(value: unknown, key: string): unknown {
  plain(value); const d = Object.getOwnPropertyDescriptor(value, key);
  if (!d || !('value' in d) || !d.enumerable) fail('metadata'); return d.value;
}
export function fields(value: unknown, names: readonly string[]): void {
  plain(value); if (Reflect.ownKeys(value).length !== names.length) fail('fields'); names.forEach(k => data(value, k));
}
export function text(value: unknown, maximum = 4096): string {
  if (typeof value !== 'string' || !value.length || value.length > maximum) fail('metadata'); return value;
}
export function natural(value: unknown): number {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < 0) fail('metadata'); return value as number;
}
export function dense(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) fail('metadata');
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d) || !d.enumerable) fail('metadata');
  }
  return value;
}
export function limits<T extends Record<string, number>>(defaults: T, value: Partial<T>): T {
  plain(value); const cap = { ...defaults };
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limit');
    const n = natural(data(value, key)); if (n > cap[key]!) fail('limit'); cap[key as keyof T] = n as T[keyof T];
  }
  return cap;
}
export const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const fold = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
/** Only already validated, acyclic metadata; sorted object keys and ordered arrays. */
export function fingerprint(value: unknown, maximum = 32 * 1024 ** 2): string {
  const hash = sha256.create(), encoder = new TextEncoder(); let remaining = maximum;
  const emit = (s: string) => { if (s.length > remaining) fail('serialization-limit'); const b = encoder.encode(s); if (b.length > remaining) fail('serialization-limit'); remaining -= b.length; hash.update(b); };
  const string = (s: string) => { if (s.length > Math.floor((remaining - 2) / 6)) fail('serialization-limit'); emit(JSON.stringify(s)); };
  function visit(v: unknown): void {
    if (typeof v === 'string') string(v);
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') emit(JSON.stringify(v));
    else if (Array.isArray(v)) { emit('['); v.forEach((x, i) => { if (i) emit(','); visit(x); }); emit(']'); }
    else { const r = v as Record<string, unknown>; emit('{'); Object.keys(r).sort().forEach((k, i) => { if (i) emit(','); string(k); emit(':'); visit(r[k]); }); emit('}'); }
  }
  visit(value); return Array.from(hash.digest(), b => b.toString(16).padStart(2, '0')).join('');
}
