// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded numeric and operand interpretation. See ../TEAM_DEFINITIONS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
export const teamFold = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
/** Narrow decimal/Westwood hex integer inputs; ambiguous CRT suffix/overflow behavior is withheld. */
export function teamInteger(s: string): number | null {
  let n: number;
  if (/^\$[0-9a-f]+$/i.test(s)) n = Number.parseInt(s.slice(1), 16);
  else if (/^[0-9a-f]+h$/i.test(s)) n = Number.parseInt(s.slice(0, -1), 16);
  else if (/^[+-]?\d+$/.test(s)) { n = Number(s); return Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647 ? n || 0 : null; }
  else return null;
  return Number.isSafeInteger(n) && n <= 0xffffffff ? (n > 0x7fffffff ? n - 0x100000000 : n) : null;
}
export const teamBoolean = (s: string): boolean | null => /^(?:yes|true|1)$/i.test(s) ? true : /^(?:no|false|0)$/i.test(s) ? false : null;
/** Both image decoders consume at most two alphabetic characters. Longer inputs stay unsupported here. */
export function teamWaypoint(s: string): number | null {
  if (!/^[A-Za-z]{1,2}$/.test(s)) return null;
  const n = s.toUpperCase(); return n.length === 1 ? n.charCodeAt(0) - 65 : (n.charCodeAt(0) - 64) * 26 + n.charCodeAt(1) - 65;
}
export interface TeamScriptOperand {
  readonly kind: 'opaque-integer' | 'waypoint' | 'packed-cell-128' | 'guard-duration' | 'script-cursor';
  readonly status: 'typed' | 'unsupported'; readonly value: number | null;
  readonly x: number | null; readonly y: number | null; readonly ticks: number | null;
  readonly cursorBeforeAdvance: number | null; readonly targetRuntimeIndex: number | null;
  readonly runtimeEffect: 'unimplemented';
}
/** Operand arithmetic only; no dispatcher or native timing/arrival/latch behavior is executed. */
export function describeTeamScriptOperand(opcode: number | null, value: number | null, stepCount: number): TeamScriptOperand {
  const base: TeamScriptOperand = { kind: 'opaque-integer', status: 'unsupported', value, x: null, y: null, ticks: null, cursorBeforeAdvance: null, targetRuntimeIndex: null, runtimeEffect: 'unimplemented' };
  if (value === null) return base;
  if (opcode === 3) return { ...base, kind: 'waypoint', status: value >= 0 && value <= 701 ? 'typed' : 'unsupported' };
  if (opcode === 4) return { ...base, kind: 'packed-cell-128', status: value >= 0 && value <= 65535 ? 'typed' : 'unsupported', x: value >= 0 ? value % 128 : null, y: value >= 0 ? Math.floor(value / 128) : null };
  if (opcode === 5) return { ...base, kind: 'guard-duration', status: value >= 0 && value <= Math.floor(2147483647 / 15) ? 'typed' : 'unsupported', ticks: value >= 0 && value <= Math.floor(2147483647 / 15) ? value * 15 : null };
  if (opcode === 6) return { ...base, kind: 'script-cursor', status: value >= 1 && value <= stepCount ? 'typed' : 'unsupported', cursorBeforeAdvance: value >= -2147483646 ? value - 2 : null, targetRuntimeIndex: value >= 1 && value <= stepCount ? value - 1 : null };
  return base;
}
/** Incremental sorted-key JSON, ordered arrays. Only compiler-owned acyclic output reaches this helper. */
export function teamFingerprint(value: unknown, cap: number): string {
  const digest = sha256.create(), encoder = new TextEncoder(); let remaining = cap;
  const emit = (s: string) => { if (s.length > remaining) throw new Error('team-serialization-limit'); const b = encoder.encode(s); if (b.length > remaining) throw new Error('team-serialization-limit'); remaining -= b.length; digest.update(b); };
  const string = (s: string) => { if (s.length > Math.floor((remaining - 2) / 6)) throw new Error('team-serialization-limit'); emit(JSON.stringify(s)); };
  function visit(v: unknown): void {
    if (typeof v === 'string') string(v);
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') emit(JSON.stringify(v));
    else if (Array.isArray(v)) { emit('['); v.forEach((x, i) => { if (i) emit(','); visit(x); }); emit(']'); }
    else { const r = v as Record<string, unknown>; emit('{'); Object.keys(r).sort().forEach((k, i) => { if (i) emit(','); string(k); emit(':'); visit(r[k]); }); emit('}'); }
  }
  visit(value); return Array.from(digest.digest(), b => b.toString(16).padStart(2, '0')).join('');
}
