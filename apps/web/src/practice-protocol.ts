// SPDX-License-Identifier: GPL-3.0-or-later
export const PRACTICE_VERSION = 1;
export const SAVE_BYTES = 2_097_152;
export const MAX_PRACTICE_TICKS = 1_000;
export type PracticeId = 'relay' | 'crossfire';
export type PracticeOutcome = 'active' | 'victory' | 'defeat' | 'draw' | 'limit';
export type PracticeUnit = { id: number; owner: number; x: number; y: number; hp: number; destination: { x: number; y: number } | null };
export type PracticeSnapshot = { scenario: PracticeId; width: number; height: number; nextTick: number; outcome: PracticeOutcome; units: PracticeUnit[]; blocked: { x: number; y: number }[]; pending: number; checkpoint: string; hash: string; events: string[] };
export type PracticeAction = { type: 'init'; scenario: PracticeId } | { type: 'restore'; text: string } | { type: 'step'; ticks: number } | { type: 'move'; entityId: number; x: number; y: number } | { type: 'attack'; entityId: number; targetId: number } | { type: 'verify' };
export type PracticeRequest = { version: 1; id: number; action: PracticeAction };
export type PracticeReply = { version: 1; id: number; ok: true; snapshot: PracticeSnapshot; verified: boolean } | { version: 1; id: number; ok: false; error: 'invalid' | 'limit' | 'unavailable' };
export function plain(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype; }
export function fields(value: unknown, keys: string[]): value is Record<string, unknown> { return plain(value) && Reflect.ownKeys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)); }
export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max; }
export function scenarioId(value: unknown): value is PracticeId { return value === 'relay' || value === 'crossfire'; }
export function saveText(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= SAVE_BYTES && new TextEncoder().encode(value).length <= SAVE_BYTES; }
export function validAction(value: unknown): value is PracticeAction {
  if (!plain(value)) return false;
  switch (value.type) {
    case 'init': return fields(value, ['type', 'scenario']) && scenarioId(value.scenario);
    case 'restore': return fields(value, ['type', 'text']) && saveText(value.text);
    case 'step': return fields(value, ['type', 'ticks']) && integer(value.ticks, 1, 4);
    case 'move': return fields(value, ['type', 'entityId', 'x', 'y']) && integer(value.entityId, 1, 256) && integer(value.x, 0, 11) && integer(value.y, 0, 7);
    case 'attack': return fields(value, ['type', 'entityId', 'targetId']) && integer(value.entityId, 1, 256) && integer(value.targetId, 1, 256);
    case 'verify': return fields(value, ['type']);
    default: return false;
  }
}
function rows(value: unknown, max: number): value is unknown[] { return Array.isArray(value) && value.length <= max && Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean); }
function position(value: unknown): boolean { return fields(value, ['x', 'y']) && integer(value.x, 0, 11) && integer(value.y, 0, 7); }
export function validSnapshot(value: unknown): value is PracticeSnapshot {
  if (!fields(value, ['scenario', 'width', 'height', 'nextTick', 'outcome', 'units', 'blocked', 'pending', 'checkpoint', 'hash', 'events'])) return false;
  if (!scenarioId(value.scenario) || value.width !== 12 || value.height !== 8 || !integer(value.nextTick, 0, MAX_PRACTICE_TICKS) || !['active', 'victory', 'defeat', 'draw', 'limit'].some(v => v === value.outcome) || !integer(value.pending, 0, 128) || !saveText(value.checkpoint) || typeof value.hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.hash)) return false;
  if (!rows(value.units, 12) || !value.units.every(u => fields(u, ['id', 'owner', 'x', 'y', 'hp', 'destination']) && integer(u.id, 1, 256) && integer(u.owner, 0, 1) && integer(u.x, 0, 11) && integer(u.y, 0, 7) && integer(u.hp, 1, 100) && (u.destination === null || position(u.destination)))) return false;
  if (new Set(value.units.map(u => (u as PracticeUnit).id)).size !== value.units.length) return false;
  return rows(value.blocked, 96) && value.blocked.every(position) && rows(value.events, 12) && value.events.every(e => typeof e === 'string' && /^[a-z-]{1,40}$/.test(e));
}
