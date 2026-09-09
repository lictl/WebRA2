// SPDX-License-Identifier: MIT
// Original WebRA2 routing policy; no original engine path or locomotion equivalence is asserted.
import { sha256 } from '@noble/hashes/sha2.js';
import type { ContentIdentity } from '../../contracts/src/index.ts';
import { canonicalText } from './canonical.ts';

export const NAVIGATION_POLICY = 'webra2-octile-directed-1' as const;
export const NAVIGATION_LIMITS = Object.freeze({ cells: 130816, occupied: 130816, expanded: 130816, pathCells: 130816 });
type Limits = { -readonly [K in keyof typeof NAVIGATION_LIMITS]: number };
export interface NavigationPosition { readonly x: number; readonly y: number }
export interface NavigationCell extends NavigationPosition {
  /** Positive destination-cell multiplier. Cardinal step=256, diagonal=362. */
  readonly cost: number;
  /** Bits 0..7: (0,-1), (1,-1), (1,0), (1,1), (0,1), (-1,1), (-1,0), (-1,-1). */
  readonly exits: number;
}
export interface NavigationGrid {
  readonly policy: typeof NAVIGATION_POLICY; readonly sha256: string;
  readonly contentIdentity: ContentIdentity; readonly movementClass: string; readonly cellCount: number;
}
export interface NavigationInput {
  readonly contentIdentity: ContentIdentity; readonly movementClass: string; readonly cells: readonly NavigationCell[];
}
export interface NavigationQuery {
  readonly start: NavigationPosition; readonly goal: NavigationPosition; readonly occupied: readonly NavigationPosition[];
}
export interface NavigationResult {
  readonly policy: typeof NAVIGATION_POLICY; readonly gridSha256: string; readonly querySha256: string;
  readonly status: 'found' | 'unreachable' | 'budget-exhausted' | 'path-limit' | 'missing-start' | 'missing-goal' | 'blocked-start' | 'blocked-goal';
  readonly path: readonly NavigationPosition[]; readonly cost: number | null; readonly expanded: number;
}
export class NavigationError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'NavigationError'; }
}
const SIDE = 512, AREA = SIDE * SIDE;
const DX = [0, 1, 1, 1, 0, -1, -1, -1] as const, DY = [-1, -1, 0, 1, 1, 1, 0, -1] as const;
const grids = new WeakMap<NavigationGrid, { costs: Uint16Array; exits: Uint8Array; minimumCost: number }>();
function fail(code: string): never { throw new NavigationError(code); }
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('navigation-record');
  if (Reflect.ownKeys(value).length !== keys.length) fail('navigation-fields');
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d) || !d.enumerable) fail('navigation-fields'); result[key] = d.value;
  }
  return result;
}
function integer(value: unknown, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < min || (value as number) > max) fail('navigation-integer');
  return value as number;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) fail('navigation-array-limit');
  if (Reflect.ownKeys(value).length !== value.length + 1) fail('navigation-array');
  const result: unknown[] = [];
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !('value' in d) || !d.enumerable) fail('navigation-array'); result.push(d.value);
  }
  return result;
}
function limits(options: Partial<Limits>): Limits {
  if (!options || typeof options !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('navigation-limits');
  const cap: Limits = { ...NAVIGATION_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('navigation-limits');
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in d) || !d.enumerable) fail('navigation-limits'); cap[key as keyof Limits] = integer(d.value, 0, cap[key as keyof Limits]);
  }
  return cap;
}
function hashString(v: unknown): string {
  if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) fail('navigation-content-hash'); return v;
}
function identity(v: unknown): ContentIdentity {
  const r = exact(v, ['profile', 'manifestSha256', 'rulesSha256', 'orderedModHashes']);
  if (r.profile !== 'ra2' && r.profile !== 'yr') fail('navigation-profile');
  return Object.freeze({ profile: r.profile, manifestSha256: hashString(r.manifestSha256), rulesSha256: hashString(r.rulesSha256),
    orderedModHashes: Object.freeze(list(r.orderedModHashes, 256).map(hashString)) });
}
function position(v: unknown): number {
  const r = exact(v, ['x', 'y']); return integer(r.x, 0, SIDE - 1) + SIDE * integer(r.y, 0, SIDE - 1);
}
const coordinates = (n: number): NavigationPosition => Object.freeze({ x: n % SIDE, y: Math.floor(n / SIDE) });
const hex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
function hashHeader(value: unknown) { return sha256.create().update(new TextEncoder().encode(canonicalText(value) + '\n')); }
function data(grid: NavigationGrid) { const value = grids.get(grid); if (!value) fail('navigation-grid'); return value; }

/** Owned immutable sparse grid. Cost/exits come from the authoritative terrain adapter, never pixels. */
export function createNavigationGrid(input: NavigationInput, lowerLimits: Partial<Limits> = {}): NavigationGrid {
  const cap = limits(lowerLimits), r = exact(input, ['contentIdentity', 'movementClass', 'cells']);
  const contentIdentity = identity(r.contentIdentity);
  if (typeof r.movementClass !== 'string' || !/^[a-z][a-z0-9.-]{0,63}$/.test(r.movementClass)) fail('navigation-class');
  const costs = new Uint16Array(AREA), exits = new Uint8Array(AREA), addresses: number[] = [];
  let minimumCost = 65535;
  for (const value of list(r.cells, cap.cells)) {
    const c = exact(value, ['x', 'y', 'cost', 'exits']);
    const address = integer(c.x, 0, SIDE - 1) + SIDE * integer(c.y, 0, SIDE - 1);
    const cost = integer(c.cost, 1, 65535), bits = integer(c.exits, 0, 255);
    if (costs[address]) fail('navigation-duplicate-cell');
    costs[address] = cost; exits[address] = bits; addresses.push(address); minimumCost = Math.min(minimumCost, cost);
  }
  addresses.sort((a, b) => a - b);
  const hash = hashHeader({ policy: NAVIGATION_POLICY, contentIdentity, movementClass: r.movementClass, cellCount: addresses.length });
  const bytes = new Uint8Array(7), record = new DataView(bytes.buffer);
  for (const address of addresses) { record.setUint32(0, address, true); record.setUint16(4, costs[address]!, true); bytes[6] = exits[address]!; hash.update(bytes); }
  const grid = Object.freeze({ policy: NAVIGATION_POLICY, sha256: hex(hash.digest()), contentIdentity, movementClass: r.movementClass, cellCount: addresses.length });
  grids.set(grid, { costs, exits, minimumCost }); return grid;
}

/** Detached metadata for a cell, or null for an absent cell. No live grid storage is exposed. */
export function navigationCell(grid: NavigationGrid, cell: NavigationPosition): NavigationCell | null {
  const value = data(grid), address = position(cell);
  return value.costs[address] ? Object.freeze({ ...coordinates(address), cost: value.costs[address]!, exits: value.exits[address]! }) : null;
}

/** One synchronous bounded transaction. Exhaustion publishes no partial path or retained frontier. */
export function findNavigationPath(grid: NavigationGrid, input: NavigationQuery, lowerLimits: Partial<Limits> = {}): NavigationResult {
  const value = data(grid), cap = limits(lowerLimits), r = exact(input, ['start', 'goal', 'occupied']);
  if (grid.cellCount > cap.cells) fail('navigation-cell-limit');
  const start = position(r.start), goal = position(r.goal), occupied = new Uint8Array(AREA), addresses: number[] = [];
  for (const p of list(r.occupied, cap.occupied)) {
    const address = position(p); if (occupied[address]) fail('navigation-duplicate-occupancy');
    occupied[address] = 1; addresses.push(address);
  }
  addresses.sort((a, b) => a - b);
  const hash = hashHeader({ policy: NAVIGATION_POLICY, gridSha256: grid.sha256, start, goal, occupied: addresses.length, limits: cap });
  const bytes = new Uint8Array(4), record = new DataView(bytes.buffer);
  for (const address of addresses) { record.setUint32(0, address, true); hash.update(bytes); }
  const querySha256 = hex(hash.digest()); let expanded = 0;
  function result(status: NavigationResult['status'], path: NavigationPosition[] = [], cost: number | null = null): NavigationResult {
    return Object.freeze({ policy: NAVIGATION_POLICY, gridSha256: grid.sha256, querySha256, status, path: Object.freeze(path), cost, expanded });
  }
  if (!value.costs[start]) return result('missing-start'); if (!value.costs[goal]) return result('missing-goal');
  if (occupied[start]) return result('blocked-start'); if (occupied[goal]) return result('blocked-goal');
  const goalX = goal % SIDE, goalY = Math.floor(goal / SIDE);
  function heuristic(address: number): number {
    const dx = Math.abs(address % SIDE - goalX), dy = Math.abs(Math.floor(address / SIDE) - goalY);
    return (256 * Math.max(dx, dy) + 106 * Math.min(dx, dy)) * value.minimumCost;
  }
  // Decrease-key heap: at most one entry per cell. No duplicate frontier growth.
  const distances = new Float64Array(AREA); distances.fill(Infinity);
  const parents = new Int32Array(AREA); parents.fill(-1);
  const heapPositions = new Int32Array(AREA); heapPositions.fill(-1);
  const closed = new Uint8Array(AREA), heap: number[] = [];
  function less(a: number, b: number): boolean {
    const ah = heuristic(a), bh = heuristic(b), af = distances[a]! + ah, bf = distances[b]! + bh;
    return af < bf || (af === bf && (ah < bh || (ah === bh && a < b)));
  }
  function swap(a: number, b: number): void {
    const v = heap[a]!; heap[a] = heap[b]!; heap[b] = v; heapPositions[heap[a]!] = a; heapPositions[v] = b;
  }
  function pushOrDecrease(address: number): void {
    let index = heapPositions[address]!;
    if (index < 0) { index = heap.length; heap.push(address); heapPositions[address] = index; }
    while (index > 0) { const parent = Math.floor((index - 1) / 2); if (!less(heap[index]!, heap[parent]!)) break; swap(index, parent); index = parent; }
  }
  function pop(): number {
    const first = heap[0]!, last = heap.pop()!; heapPositions[first] = -1;
    if (heap.length) {
      heap[0] = last; heapPositions[last] = 0; let index = 0;
      while (index * 2 + 1 < heap.length) {
        let child = index * 2 + 1;
        if (child + 1 < heap.length && less(heap[child + 1]!, heap[child]!)) child++;
        if (!less(heap[child]!, heap[index]!)) break; swap(child, index); index = child;
      }
    }
    return first;
  }
  const open = (address: number): boolean => !!value.costs[address] && !occupied[address];
  const edge = (address: number, direction: number): boolean => !!(value.exits[address]! & (1 << direction));
  distances[start] = 0; pushOrDecrease(start);
  while (heap.length) {
    // Popping the goal also consumes one expansion: even start==goal needs a budget of one.
    if (expanded >= cap.expanded) return result('budget-exhausted');
    const current = pop(); expanded++; closed[current] = 1;
    if (current === goal) {
      const path: NavigationPosition[] = []; let at = goal;
      while (at >= 0) {
        if (path.length >= cap.pathCells) return result('path-limit'); path.push(coordinates(at)); at = parents[at]!;
      }
      path.reverse(); return result('found', path, distances[goal]!);
    }
    const x = current % SIDE, y = Math.floor(current / SIDE);
    for (let direction = 0; direction < 8; direction++) {
      if (!edge(current, direction)) continue;
      const dx = DX[direction]!, dy = DY[direction]!, nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= SIDE || ny < 0 || ny >= SIDE) continue;
      const next = nx + SIDE * ny; if (!open(next) || closed[next]) continue;
      const diagonal = direction % 2 === 1;
      if (diagonal) {
        const horizontal = current + dx, vertical = current + SIDE * dy, h = dx > 0 ? 2 : 6, v = dy > 0 ? 4 : 0;
        // Both two-cardinal routes across this square must be permitted and unoccupied.
        if (!open(horizontal) || !open(vertical) || !edge(current, h) || !edge(current, v) || !edge(horizontal, v) || !edge(vertical, h)) continue;
      }
      const distance = distances[current]! + (diagonal ? 362 : 256) * value.costs[next]!;
      // Equal-cost parents remain the first selected under the fixed heap/neighbor order.
      if (distance < distances[next]!) { distances[next] = distance; parents[next] = current; pushOrDecrease(next); }
    }
  }
  return result('unreachable');
}
