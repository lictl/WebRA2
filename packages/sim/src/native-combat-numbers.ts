// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../NATIVE_COMBAT_NUMBERS_PROVENANCE.md.

/** Arithmetic stages only: callers must independently authorize their native context. */
export const NATIVE_COMBAT_NUMBERS_POLICY = 'webra2-native-combat-numbers-1' as const;
export const NATIVE_COMBAT_NUMBER_LIMITS = Object.freeze({ integer: 2147483647, factorMin: 1 / 65536, factorMax: 65536 });
export class NativeCombatNumberError extends Error {
  constructor(readonly code: string) { super(`native-combat-number-${code}`); this.name = 'NativeCombatNumberError'; }
}
export interface NativeFirepowerInput {
  readonly damage: number; readonly houseFirepower: number; readonly actorFirepower: number;
  /** One when no applicable veteran/elite FIREPOWER ability is active. */
  readonly veteranCombat: number;
}
export interface NativeArmorInput {
  readonly damage: number; readonly countryArmor: number; readonly actorArmor: number;
  /** One when no applicable veteran/elite ARMOR ability is active. */
  readonly veteranArmor: number;
}
export interface NativeZeroSpreadInput { readonly damage: number; readonly verse: number; readonly maxDamage: number }
export interface NativeReloadInput {
  readonly rof: number; readonly houseRof: number; readonly jitter: 0 | 1 | 2;
  /** One when no applicable veteran/elite ROF ability is active. */
  readonly veteranRof: number;
}
const L = NATIVE_COMBAT_NUMBER_LIMITS;
function fail(code: string): never { throw new NativeCombatNumberError(code); }
function fields(value: unknown, keys: readonly string[]): Record<string, unknown> {
  try {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) fail('record');
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail('fields');
      result[key] = descriptor.value;
    }
    return result;
  } catch (error) { if (error instanceof NativeCombatNumberError) throw error; return fail('record'); }
}
function integer(value: unknown, min = 0, max: number = L.integer): number {
  if (!Number.isInteger(value) || Object.is(value, -0) || (value as number) < min || (value as number) > max) fail('integer');
  return value as number;
}
function factor(value: unknown, allowZero = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) ||
      !(allowZero && value === 0 || value >= L.factorMin && value <= L.factorMax)) fail('factor');
  return value;
}
interface Dyadic { readonly m: bigint; readonly e: number }
function parts(value: number): Dyadic {
  if (value === 0) return { m: 0n, e: 0 };
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, value);
  const bits = bytes.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n);
  // All admitted nonzero values and intermediates are normal binary64 values.
  return { m: (bits & ((1n << 52n) - 1n)) | (1n << 52n), e: exponent - 1075 };
}
/** Round positive n/d * 2^e to 53 significant bits toward zero, before the next operation. */
function rounded(n: bigint, d: bigint, e: number): number {
  if (n === 0n) return 0;
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < (d << BigInt(exponent)) : (n << BigInt(-exponent)) < d) exponent--;
  const shift = 52 - exponent;
  const mantissa = shift >= 0 ? (n << BigInt(shift)) / d : n / (d << BigInt(-shift));
  // The exact integer mantissa and power of two are representable within this API's bounds.
  return Number(mantissa) * 2 ** (e + exponent - 52);
}
function multiply(a: number, b: number): number {
  const x = parts(a), y = parts(b); return rounded(x.m * y.m, 1n, x.e + y.e);
}
function divide(a: number, b: number): number {
  const x = parts(a), y = parts(b); return rounded(x.m, y.m, x.e - y.e);
}
function add(a: number, b: number): number {
  const x = parts(a), y = parts(b), exponent = Math.min(x.e, y.e);
  return rounded((x.m << BigInt(x.e - exponent)) + (y.m << BigInt(y.e - exponent)), 1n, exponent);
}
function converted(value: number): number {
  const result = Math.trunc(value);
  // Native indefinite/overflow integer conversions are outside this positive bounded policy.
  if (result > L.integer) fail('conversion-overflow');
  return result;
}

/** Positive ordinary Fire damage: two rounded products, integer conversion, then veteran stage. */
export function nativeFirepowerDamage(input: NativeFirepowerInput): number {
  const r = fields(input, ['damage', 'houseFirepower', 'actorFirepower', 'veteranCombat']);
  const damage = integer(r.damage, 1), house = factor(r.houseFirepower), actor = factor(r.actorFirepower), veteran = factor(r.veteranCombat);
  const base = converted(multiply(multiply(house, actor), damage));
  return converted(multiply(base, veteran));
}

/** ReceiveDamage armor stage with defenses enabled, before immunity/warhead/derived-class work. */
export function nativeArmorAdjustedDamage(input: NativeArmorInput): number {
  const r = fields(input, ['damage', 'countryArmor', 'actorArmor', 'veteranArmor']);
  const damage = integer(r.damage), country = factor(r.countryArmor, false), actor = factor(r.actorArmor, false), veteran = factor(r.veteranArmor, false);
  const base = converted(divide(damage, multiply(country, actor)));
  return Math.max(1, converted(divide(base, veteran)));
}

/** Nonnegative GetTotalDamage at zero CellSpread: Verses then integer conversion then MaxDamage. */
export function nativeZeroSpreadDamage(input: NativeZeroSpreadInput): number {
  const r = fields(input, ['damage', 'verse', 'maxDamage']);
  const damage = integer(r.damage), verse = factor(r.verse), maximum = integer(r.maxDamage, 1);
  return Math.min(converted(multiply(damage, verse)), maximum);
}

/** Normal GetROF arithmetic only. Supplied jitter is consumed elsewhere, including rejected draws. */
export function nativeNormalReload(input: NativeReloadInput): number {
  const r = fields(input, ['rof', 'houseRof', 'jitter', 'veteranRof']);
  const rof = integer(r.rof), house = factor(r.houseRof), jitter = integer(r.jitter, 0, 2), veteran = factor(r.veteranRof);
  const base = converted(add(multiply(rof, house), jitter));
  return converted(multiply(base, veteran));
}
