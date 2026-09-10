// SPDX-License-Identifier: GPL-3.0-or-later
// Original admission over authenticated scenario rows; see ../COMBAT_CONTENT_PROVENANCE.md.
import type { ScenarioPlacement } from '../../content/src/scenario-objects.ts';

export interface CombatPlacementState {
  readonly status: 'ordinary-ground' | 'unsupported' | 'not-applicable';
  readonly reasons: readonly string[];
  readonly rankPercent: number | null; readonly group: number | null; readonly onBridge: boolean | null;
  readonly followerIndex: number | null; readonly recruitableA: boolean | null; readonly recruitableB: boolean | null;
}
// These row loaders call decimal atoi, not the INI reader's dollar/hex conversion.
const integer = (s: string): number | null => {
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = Number(s); return Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647 ? n || 0 : null;
};

/** Internal composition helper. The caller must supply a freshly source-authenticated placement; this is not a source factory. */
export function inspectCombatPlacement(p: ScenarioPlacement): CombatPlacementState {
  const reasons: string[] = [];
  const blank = { rankPercent: null, group: null, onBridge: null, followerIndex: null, recruitableA: null, recruitableB: null };
  const done = (status: CombatPlacementState['status'], values: Omit<CombatPlacementState, 'status' | 'reasons'> = blank): CombatPlacementState =>
    Object.freeze({ status, ...values, reasons: Object.freeze(reasons) });
  if (p.kind !== 'infantry' && p.kind !== 'unit') return done('not-applicable');
  // Native loaders use a 128-byte ReadString buffer followed by comma strtok.
  // Empty internal tokens would shift fields; larger/non-ASCII source rows need a separate parser policy.
  const text = p.row.origin.rawValue.split(';', 1)[0]!.replace(/^[ \t]+|[ \t]+$/g, '');
  if (text.length > 127 || /[^\x20-\x7e]/.test(text)) reasons.push('unsupported-native-row-buffer');
  if (p.row.values.length !== 14 || p.row.values.some(v => v === '')) reasons.push('unsupported-native-row-shape');
  if (reasons.length) return done('unsupported');
  const rankAt = p.kind === 'infantry' ? 9 : 8;
  const rankPercent = integer(p.row.values[rankAt]!), group = integer(p.row.values[rankAt + 1]!);
  const bridge = integer(p.row.values[rankAt + 2]!), a = integer(p.row.values[12]!), b = integer(p.row.values[13]!);
  const followerIndex = p.kind === 'unit' ? integer(p.row.values[11]!) : null;
  if (rankPercent === null || group === null || bridge === null || a === null || b === null || p.kind === 'unit' && followerIndex === null)
    reasons.push('unsupported-native-row-integer');
  if (rankPercent !== 0) reasons.push('initial-veterancy');
  if (bridge !== 0) reasons.push('initial-bridge-layer');
  if (p.kind === 'unit' && followerIndex !== -1) reasons.push('initial-follower-link');
  // Group and recruitment flags are retained for future team/UI consumers; manual combat does not execute them.
  return done(reasons.length ? 'unsupported' : 'ordinary-ground', { rankPercent, group, onBridge: bridge === null ? null : bridge !== 0,
    followerIndex, recruitableA: a === null ? null : a !== 0, recruitableB: b === null ? null : b !== 0 });
}
