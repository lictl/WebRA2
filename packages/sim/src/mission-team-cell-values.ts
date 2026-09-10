// SPDX-License-Identifier: GPL-3.0-or-later
// Original owned boundaries for the team cell context. See ../MISSION_TEAM_CELL_PROVENANCE.md.
import { MISSION_TEAM_CELL_LIMITS, type MissionTeamCellLimits } from './mission-team-cell-types.ts';
export class MissionTeamCellError extends Error {
  constructor(readonly code: string) { super(`mission-team-cell-${code}`); this.name = 'MissionTeamCellError'; }
}
export function missionTeamCellFail(code: string): never { throw new MissionTeamCellError(code); }
export const missionTeamCellCompare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export function missionTeamCellLimits(input: Partial<MissionTeamCellLimits>, maximum: Readonly<MissionTeamCellLimits> = MISSION_TEAM_CELL_LIMITS): MissionTeamCellLimits {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) missionTeamCellFail('limits');
  const out: MissionTeamCellLimits = { ...maximum };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(out, key)) missionTeamCellFail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !d.enumerable || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > out[key as keyof MissionTeamCellLimits]) missionTeamCellFail('limits');
    out[key as keyof MissionTeamCellLimits] = d.value;
  }
  return out;
}
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
/** Native accessors reject typed-array proxies without reading caller getters. */
export function missionTeamCellBytes(input: unknown, cap: number): Uint8Array {
  try {
    if (!input || Object.getPrototypeOf(input) !== Uint8Array.prototype) missionTeamCellFail('mission-bytes');
    const size = lengthOf.call(input) as number, buffer: unknown = bufferOf.call(input);
    if (!(buffer instanceof ArrayBuffer) || resizableOf?.call(buffer) || size < 1 || size > cap) missionTeamCellFail('mission-bytes');
    const out = new Uint8Array(size); Uint8Array.prototype.set.call(out, input as Uint8Array); return out;
  } catch { return missionTeamCellFail('mission-bytes'); }
}
