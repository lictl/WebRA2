// SPDX-License-Identifier: MIT
import { orderCommands } from '../../contracts/src/index.ts';
import { canonicalText, parseJson } from './canonical.ts';
import { ENGINE_VERSION, RULES_VERSION, RNG_VERSION, LIMITS, SimulationError, type CommandEnvelope, type ContentIdentity, type Entity, type Position, type RngState, type ScheduledWork, type SimSave } from './types.ts';

export function fail(code: string): never { throw new SimulationError(code); }
export function record(value: unknown, keys: readonly string[], code = 'invalid-fields'): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) return fail(code);
  return value as Record<string, unknown>;
}
export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER, code = 'invalid-integer'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) return fail(code); return value;
}
export function array(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) return fail('array-limit'); return value; }
export function detached(value: unknown): unknown { return JSON.parse(canonicalText(value)) as unknown; }
export function identity(input: unknown): ContentIdentity {
  const r = record(input, ['profile', 'manifestSha256', 'rulesSha256', 'orderedModHashes']);
  if (r.profile !== 'ra2' && r.profile !== 'yr') fail('content-profile');
  const digest = (v: unknown) => { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) return fail('content-hash'); return v; };
  return { profile: r.profile as 'ra2' | 'yr', manifestSha256: digest(r.manifestSha256), rulesSha256: digest(r.rulesSha256), orderedModHashes: array(r.orderedModHashes, 64).map(digest) };
}
export function position(input: unknown, width: number, height: number): Position {
  const r = record(input, ['x', 'y']); return { x: integer(r.x, 0, width - 1, 'coordinate-bounds'), y: integer(r.y, 0, height - 1, 'coordinate-bounds') };
}
export function command(input: unknown, width: number, height: number): CommandEnvelope {
  let c: CommandEnvelope; try { c = orderCommands([input])[0]!; } catch { return fail('invalid-command-envelope'); }
  integer(c.playerId, 0, LIMITS.players - 1, 'player-bounds'); integer(c.tick, 0, LIMITS.tick, 'tick-bounds');
  if (c.kind === 'move') { const p = record(c.payload, ['entityId', 'x', 'y']); integer(p.entityId, 1); position({ x: p.x, y: p.y }, width, height); }
  else if (c.kind === 'attack') { const p = record(c.payload, ['entityId', 'targetId']); integer(p.entityId, 1); integer(p.targetId, 1); }
  else fail('unsupported-command-kind');
  return c;
}
export function work(input: unknown, width: number, height: number, nextTick: number): ScheduledWork {
  const r = record(input, ['dueTick', 'order', 'kind', 'payload']); integer(r.dueTick, nextTick, Math.min(LIMITS.tick, nextTick + LIMITS.futureTicks), 'work-tick'); integer(r.order, 1);
  if (r.kind === 'impact') { const p = record(r.payload, ['attackerId', 'targetId']); integer(p.attackerId, 1); integer(p.targetId, 1); }
  else if (r.kind === 'reinforcement') { const p = record(r.payload, ['owner', 'x', 'y', 'hp']); integer(p.owner, 0, LIMITS.players - 1); integer(p.hp, 1, LIMITS.hp); position({ x: p.x, y: p.y }, width, height); }
  else fail('unsupported-work-kind');
  return r as ScheduledWork;
}
export function validateSave(input: unknown, expectedContent: ContentIdentity): SimSave {
  const raw = typeof input === 'string' || input instanceof Uint8Array ? parseJson(input) : input;
  const r = record(detached(raw), ['schemaVersion', 'engineVersion', 'simulationRulesVersion', 'contentIdentity', 'nextTick', 'state', 'queuedCommands', 'scheduledWork', 'rngStates']);
  if (r.schemaVersion !== 1 || r.engineVersion !== ENGINE_VERSION || r.simulationRulesVersion !== RULES_VERSION) fail('unsupported-save-version');
  const content = identity(r.contentIdentity), expected = identity(detached(expectedContent));
  if (canonicalText(content) !== canonicalText(expected)) fail('content-mismatch');
  const nextTick = integer(r.nextTick, 0, LIMITS.tick, 'tick-bounds');
  const state = record(r.state, ['width', 'height', 'blocked', 'entities', 'nextEntityId', 'nextWorkOrder', 'admissionCursors', 'resolvedEvents']);
  const width = integer(state.width, 1, LIMITS.grid), height = integer(state.height, 1, LIMITS.grid);
  const nextEntityId = integer(state.nextEntityId, 1), nextWorkOrder = integer(state.nextWorkOrder, 1); integer(state.resolvedEvents);
  const occupied = new Set<string>();
  let priorCell = -1;
  for (const b of array(state.blocked, LIMITS.grid ** 2)) {
    const p = position(b, width, height), cell = p.y * width + p.x;
    if (cell <= priorCell) fail('blocked-order-or-duplicate'); priorCell = cell; occupied.add(`${p.x},${p.y}`);
  }
  let priorId = 0;
  for (const item of array(state.entities, LIMITS.entities)) {
    const e = record(item, ['id', 'owner', 'x', 'y', 'hp', 'destination']); const id = integer(e.id, 1, nextEntityId - 1);
    if (id <= priorId) fail('entity-order-or-duplicate'); priorId = id;
    integer(e.owner, 0, LIMITS.players - 1); integer(e.hp, 1, LIMITS.hp); const p = position({ x: e.x, y: e.y }, width, height);
    if (occupied.has(`${p.x},${p.y}`)) fail('occupied-cell'); occupied.add(`${p.x},${p.y}`);
    if (e.destination !== null) position(e.destination, width, height);
  }
  const cursors = new Map<number, number>(); let priorPlayer = -1;
  for (const item of array(state.admissionCursors, LIMITS.players)) {
    const c = record(item, ['playerId', 'sequence']); const player = integer(c.playerId, 0, LIMITS.players - 1), sequence = integer(c.sequence);
    if (player <= priorPlayer) fail('cursor-order-or-duplicate'); priorPlayer = player; cursors.set(player, sequence);
  }
  const queue = array(r.queuedCommands, LIMITS.commands).map(c => command(c, width, height));
  let ordered: CommandEnvelope[]; try { ordered = orderCommands(queue); } catch { return fail('duplicate-command'); }
  if (canonicalText(queue) !== canonicalText(ordered)) fail('command-order');
  for (const c of queue) { integer(c.tick, nextTick, Math.min(LIMITS.tick, nextTick + LIMITS.futureTicks), 'command-horizon'); if ((cursors.get(c.playerId) ?? -1) < c.sequence) fail('missing-admission-cursor'); }
  let previousDue = -1, previousOrder = 0; const orders = new Set<number>();
  for (const item of array(r.scheduledWork, LIMITS.work)) {
    const w = work(item, width, height, nextTick); integer(w.order, 1, nextWorkOrder - 1);
    if (orders.has(w.order) || w.dueTick < previousDue || (w.dueTick === previousDue && w.order <= previousOrder)) fail('work-order-or-duplicate');
    orders.add(w.order); previousDue = w.dueTick; previousOrder = w.order;
    if (w.kind === 'impact') { integer(w.payload.attackerId, 1, nextEntityId - 1); integer(w.payload.targetId, 1, nextEntityId - 1); }
  }
  const rng = record(r.rngStates, ['simulation']); const stream = record(rng.simulation, ['algorithm', 'value', 'draws']);
  if (stream.algorithm !== RNG_VERSION) fail('unsupported-rng-version'); integer(stream.value, 0, 0xffffffff); integer(stream.draws);
  return { schemaVersion: 1, engineVersion: ENGINE_VERSION, simulationRulesVersion: RULES_VERSION, contentIdentity: content, nextTick, state: state as SimSave['state'], queuedCommands: queue, scheduledWork: r.scheduledWork as ScheduledWork[], rngStates: { simulation: stream as RngState } };
}
export function sortedWork(items: ScheduledWork[]): ScheduledWork[] { return items.sort((a, b) => a.dueTick - b.dueTick || a.order - b.order); }
export function occupied(state: SimSave['state'], p: Position): boolean { return state.blocked.some(b => b.x === p.x && b.y === p.y) || state.entities.some(e => e.x === p.x && e.y === p.y); }
export function findEntity(entities: Entity[], id: number): Entity | undefined { return entities.find(e => e.id === id); }
