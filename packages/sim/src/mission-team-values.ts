// SPDX-License-Identifier: GPL-3.0-or-later
// Original descriptor-owned bounded checkpoint/input reader.
import { parseJson } from './canonical.ts';
import { worldInteger, worldList, worldRecord } from './world-values.ts';
export class MissionTeamError extends Error {
  constructor(readonly code: string) { super(`mission-team-${code}`); this.name = 'MissionTeamError'; }
}
export function missionTeamFail(code: string): never { throw new MissionTeamError(code); }
/** Each supplied property is read from its descriptor exactly once; no toJSON/get trap execution. */
export function missionTeamSnapshot(input: unknown): unknown {
  const value = typeof input === 'string' || input instanceof Uint8Array ? parseJson(input) : input;
  let nodes = 0, characters = 0;
  const visit = (v: unknown, depth: number): unknown => {
    if (++nodes > 400000 || depth > 48) missionTeamFail('input-size');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return worldInteger(v, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    if (typeof v === 'string') { characters += v.length; if (characters > 2 * 1024 ** 2) missionTeamFail('input-size'); return v; }
    if (Array.isArray(v)) return worldList(v, 32768).map(x => visit(x, depth + 1));
    if (!v || typeof v !== 'object') return missionTeamFail('input-value');
    const keys = Reflect.ownKeys(v); if (keys.some(k => typeof k !== 'string')) missionTeamFail('input-key');
    const record = worldRecord(v, keys as string[]), out: Record<string, unknown> = Object.create(null);
    for (const key of keys as string[]) { characters += key.length; if (characters > 2 * 1024 ** 2) missionTeamFail('input-size'); out[key] = visit(record[key], depth + 1); }
    return out;
  };
  return visit(value, 0);
}
