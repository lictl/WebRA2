// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../WEAPON_DEFINITIONS_PROVENANCE.md.
/** Supported subset of the pinned INI integer conversion; malformed/overflow inputs are unknown. */
export function weaponInteger(s: string): number | null {
  if (s.length > 127) return null;
  let n: number;
  if (/^\$[0-9a-f]+$/i.test(s)) n = Number.parseInt(s.slice(1), 16);
  else if (/^[0-9a-f]+h$/i.test(s)) n = Number.parseInt(s.slice(0, -1), 16);
  else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) {
    n = Number(/^[+-]?\d+/.exec(s)?.[0] ?? 0);
    return Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647 ? n || 0 : null;
  } else return null;
  return Number.isSafeInteger(n) && n <= 0xffffffff ? n > 0x7fffffff ? n - 0x100000000 : n : null;
}
/** Same conservative float32 input policy as entity definitions; exact halfway cases stay unknown. */
export function weaponDecimal(s: string): number | null {
  if (s.length > 127) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(s)) return null;
  const percent = s.endsWith('%'), parsed = Number(percent ? s.slice(0, -1) : s), f = Math.fround(parsed);
  if (!Number.isFinite(f)) return null;
  const a = Math.abs(parsed), rounded = Math.abs(f);
  if (a !== rounded) {
    const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, rounded);
    b.setUint32(0, b.getUint32(0) + (a > rounded ? 1 : -1));
    if (a === (rounded + b.getFloat32(0)) / 2) return null;
  }
  const result = percent ? truncateProduct(f, 0.01) : f;
  return Number.isFinite(result) ? result || 0 : null;
}
export const weaponBoolean = (s: string): boolean | null => /^(yes|true|1)$/i.test(s) ? true : /^(no|false|0)$/i.test(s) ? false : null;
/** Verses uses atoi for percent tokens, atof otherwise, not the INI float32 reader. */
export function weaponVerse(s: string): number | null {
  if (s.length > 127) return null;
  if (s.endsWith('%')) {
    const n = weaponInteger(s.slice(0, -1)); return n === null ? null : truncateProduct(n, 0.01) || 0;
  }
  // Exact dyadic values only until the native decimal-to-double boundary is independently modeled.
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s); if (!Number.isFinite(n) || Math.abs(n) > 0x7fffffff) return null;
  const fraction = s.split('.')[1] ?? '';
  if (fraction.length > 20) return null;
  const digits = BigInt(s.replace(/[+.]/g, '')), scale = 10n ** BigInt(fraction.length);
  const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, n);
  const bits = b.getBigUint64(0), exp = Number((bits >> 52n) & 2047n) - 1023 - 52;
  const mantissa = (bits & ((1n << 52n) - 1n)) | (1n << 52n), sign = n < 0 ? -1n : 1n;
  const exact = n === 0 ? digits === 0n : exp >= 0 ? digits === sign * (mantissa << BigInt(exp)) * scale :
    (digits << BigInt(-exp)) === sign * mantissa * scale;
  return exact ? n || 0 : null;
}
function integerSqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) { const y = (x + n / x) >> 1n; if (y >= x) return x; x = y; }
}
/** Both pinned startup paths select x87 53-bit precision with truncation toward zero. */
function truncateProduct(a: number, b: number): number {
  if (!a || !b) return 0;
  const view = new DataView(new ArrayBuffer(8));
  function parts(value: number): { m: bigint; e: number } {
    view.setFloat64(0, Math.abs(value)); const bits = view.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n);
    return { m: (bits & ((1n << 52n) - 1n)) | (exponent ? 1n << 52n : 0n), e: exponent ? exponent - 1023 - 52 : -1074 };
  }
  const x = parts(a), y = parts(b), product = x.m * y.m;
  const remove = Math.max(0, product.toString(2).length - 53);
  const value = Number(product >> BigInt(remove)) * 2 ** (x.e + y.e + remove);
  return ((a < 0) !== (b < 0) ? -value : value) || 0;
}
/** Native dword store under the same truncation mode (not JavaScript's nearest float32). */
export function weaponFloatStore(n: number): number | null {
  const rounded = Math.fround(n); if (!Number.isFinite(rounded)) return null;
  if (Math.abs(rounded) <= Math.abs(n)) return rounded || 0;
  const view = new DataView(new ArrayBuffer(4)); view.setFloat32(0, rounded); view.setUint32(0, view.getUint32(0) - 1);
  return view.getFloat32(0) || 0;
}
/**
 * Positive bounded native CalculateSpeed path. Generates the mantissa mathematically,
 * rather than shipping the native 16,384-word square-root table. No Math.sqrt or floats
 * decide the result. Both pinned tables independently match this integer construction.
 */
export function weaponCalculatedSpeed(range: number, gravity: number, floater: boolean): number | null {
  if (typeof floater !== 'boolean' || Object.is(range, -0) || Object.is(gravity, -0) || !Number.isSafeInteger(range) || !Number.isSafeInteger(gravity) || range < 0 || gravity < 0 ||
      range > 0x7fffffff || gravity > 0x7fffffff || !Number.isSafeInteger(range * gravity)) return null;
  if (!range || !gravity) return 0;
  // Native double constant 1.2, optional exact halving, then positive float32 truncation.
  const n = BigInt(range) * BigInt(gravity) * 5404319552844595n, d = 4503599627370496n * (floater ? 2n : 1n);
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < (d << BigInt(exponent)) : (n << BigInt(-exponent)) < d) exponent--;
  if (exponent < -126 || exponent > 127) return null;
  const shift = 23 - exponent;
  const significand = shift >= 0 ? (n << BigInt(shift)) / d : n / (d << BigInt(-shift));
  const index = Number(((significand - 8388608n) | ((exponent & 1) ? 8388608n : 0n)) >> 10n);
  const mantissa = integerSqrt(index < 8192 ? BigInt(8192 + index) << 33n : BigInt(index) << 34n);
  const resultShift = Math.floor(exponent / 2) - 23;
  const result = resultShift >= 0 ? mantissa << BigInt(resultShift) : mantissa >> BigInt(-resultShift);
  return result <= 2147483647n ? Number(result) : null;
}
