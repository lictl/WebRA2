// SPDX-License-Identifier: GPL-3.0-or-later
import { MISSION_HOUSE_LIMITS, type MissionHouseLimits } from './mission-house-types.ts';
export class MissionHouseError extends Error {
  constructor(readonly code: string) { super(`mission-house-${code}`); this.name = 'MissionHouseError'; }
}
export function houseFail(code: string): never { throw new MissionHouseError(code); }
export function houseLimits(input: Partial<MissionHouseLimits>): MissionHouseLimits {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) houseFail('limits');
  const cap: MissionHouseLimits = { ...MISSION_HOUSE_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) houseFail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !d.enumerable || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[key as keyof MissionHouseLimits]) houseFail('limits');
    cap[key as keyof MissionHouseLimits] = d.value;
  }
  return cap;
}
export function houseInteger(value: unknown, max = 0x7fffffff): number {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < 0 || (value as number) > max) houseFail('integer');
  return value as number;
}
export function houseBoolean(value: unknown): boolean { if (typeof value !== 'boolean') houseFail('boolean'); return value; }
export function houseBytes(input: unknown, cap: number): Uint8Array {
  try {
    if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Uint8Array.prototype) houseFail('mission-bytes');
    const prototype = Object.getPrototypeOf(Uint8Array.prototype);
    const buffer = Object.getOwnPropertyDescriptor(prototype, 'buffer')!.get!.call(input) as ArrayBuffer;
    const offset = Object.getOwnPropertyDescriptor(prototype, 'byteOffset')!.get!.call(input) as number;
    const length = Object.getOwnPropertyDescriptor(prototype, 'byteLength')!.get!.call(input) as number;
    if (Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')!.get!.call(buffer) || length > cap) houseFail('mission-bytes');
    return new Uint8Array(new Uint8Array(buffer, offset, length));
  } catch { return houseFail('mission-bytes'); }
}
