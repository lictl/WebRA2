// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createNavigationGrid, findNavigationPath, navigationCell, NavigationError, NAVIGATION_LIMITS,
  type NavigationCell, type NavigationInput, type NavigationPosition } from '../../packages/sim/src/navigation.ts';

const contentIdentity = { profile: 'ra2' as const, manifestSha256: 'a'.repeat(64), rulesSha256: 'b'.repeat(64), orderedModHashes: [] as string[] };
const cell = (x: number, y: number, cost = 1, exits = 255): NavigationCell => ({ x, y, cost, exits });
const rectangle = (width: number, height: number): NavigationCell[] => Array.from({ length: width * height }, (_, i) => cell(i % width, Math.floor(i / width)));
const input = (cells: NavigationCell[]): NavigationInput => ({ contentIdentity, movementClass: 'foot', cells });
const query = (start: NavigationPosition, goal: NavigationPosition, occupied: NavigationPosition[] = []) => ({ start, goal, occupied });
const error = (code: string) => (e: unknown) => e instanceof NavigationError && e.code === code;

test('sparse diagonal routes include endpoints, use integer cost and return frozen snapshots', () => {
  const grid = createNavigationGrid(input(rectangle(4, 4)));
  const route = findNavigationPath(grid, query({ x: 0, y: 0 }, { x: 3, y: 3 }));
  assert.equal(route.status, 'found'); assert.equal(route.cost, 3 * 362); assert.equal(route.expanded, 4);
  assert.deepEqual(route.path, [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]);
  assert(Object.isFrozen(route) && Object.isFrozen(route.path) && route.path.every(Object.isFrozen));
  assert.deepEqual(navigationCell(grid, { x: 2, y: 2 }), cell(2, 2));
  assert.equal(navigationCell(grid, { x: 4, y: 2 }), null);
});

test('detours respect occupancy and deterministic equal-cost ordering', () => {
  const grid = createNavigationGrid(input(rectangle(5, 3))), occupied = [{ x: 2, y: 1 }];
  const route = findNavigationPath(grid, query({ x: 0, y: 1 }, { x: 4, y: 1 }, occupied));
  assert.equal(route.status, 'found'); assert.equal(route.cost, 2 * 362 + 2 * 256);
  assert.deepEqual(route.path, [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 1 }]);
  assert.deepEqual(route, findNavigationPath(grid, query({ x: 0, y: 1 }, { x: 4, y: 1 }, occupied)));
});

test('destination costs can prefer a longer route and directed edges are not reciprocal', () => {
  const cells = rectangle(3, 3).map(c => c.x === 1 && c.y === 1 ? cell(1, 1, 50) : c);
  const route = findNavigationPath(createNavigationGrid(input(cells)), query({ x: 0, y: 1 }, { x: 2, y: 1 }));
  assert.equal(route.cost, 724); assert(!route.path.some(p => p.x === 1 && p.y === 1));
  const directed = createNavigationGrid(input([cell(0, 0, 1, 4), cell(1, 0, 2, 4), cell(2, 0, 3, 0)]));
  assert.equal(findNavigationPath(directed, query({ x: 0, y: 0 }, { x: 2, y: 0 })).cost, 1280);
  assert.equal(findNavigationPath(directed, query({ x: 2, y: 0 }, { x: 0, y: 0 })).status, 'unreachable');
});

test('diagonals require both clear cardinal routes including their directed exits', () => {
  const start = { x: 0, y: 0 }, goal = { x: 1, y: 1 };
  const gap = createNavigationGrid(input([cell(0, 0), cell(1, 1)]));
  assert.equal(findNavigationPath(gap, query(start, goal)).status, 'unreachable');
  const full = createNavigationGrid(input(rectangle(2, 2)));
  const around = findNavigationPath(full, query(start, goal, [{ x: 1, y: 0 }]));
  assert.equal(around.cost, 512); assert.equal(around.path.length, 3);
  const corner = createNavigationGrid(input([cell(0, 0, 1, 8), cell(1, 0), cell(0, 1), cell(1, 1)]));
  assert.equal(findNavigationPath(corner, query(start, goal)).status, 'unreachable');
  const wall = createNavigationGrid(input([cell(0, 0), cell(1, 0, 1, 0), cell(0, 1), cell(1, 1)]));
  assert.equal(findNavigationPath(wall, query(start, goal)).cost, 512);
});

test('missing and blocked endpoints, disconnected areas, and start-equals-goal have explicit outcomes', () => {
  const grid = createNavigationGrid(input([cell(0, 0), cell(2, 0)])), start = { x: 0, y: 0 }, goal = { x: 2, y: 0 };
  assert.equal(findNavigationPath(grid, query({ x: 1, y: 0 }, goal)).status, 'missing-start');
  assert.equal(findNavigationPath(grid, query(start, { x: 1, y: 0 })).status, 'missing-goal');
  assert.equal(findNavigationPath(grid, query(start, goal, [start])).status, 'blocked-start');
  assert.equal(findNavigationPath(grid, query(start, goal, [goal])).status, 'blocked-goal');
  const absent = findNavigationPath(grid, query(start, goal));
  assert.equal(absent.status, 'unreachable'); assert.equal(absent.cost, null); assert.deepEqual(absent.path, []);
  const same = findNavigationPath(grid, query(start, start));
  assert.equal(same.cost, 0); assert.deepEqual(same.path, [start]); assert.equal(same.expanded, 1);
  assert.equal(findNavigationPath(createNavigationGrid(input([])), query(start, goal)).status, 'missing-start');
});

test('budget and output limits are atomic, repeatable and leave the grid reusable', () => {
  const grid = createNavigationGrid(input(rectangle(5, 1))), request = query({ x: 0, y: 0 }, { x: 4, y: 0 });
  const limited = findNavigationPath(grid, request, { expanded: 4 });
  assert.equal(limited.status, 'budget-exhausted'); assert.equal(limited.expanded, 4); assert.deepEqual(limited.path, []); assert.equal(limited.cost, null);
  assert.deepEqual(limited, findNavigationPath(grid, request, { expanded: 4 }));
  assert.equal(findNavigationPath(grid, request, { expanded: 5, pathCells: 4 }).status, 'path-limit');
  assert.equal(findNavigationPath(grid, request, { expanded: 5, pathCells: 5 }).status, 'found');
  const empty = findNavigationPath(grid, query(request.start, request.start), { expanded: 0 });
  assert.equal(empty.status, 'budget-exhausted'); assert.equal(empty.expanded, 0);
  assert.notEqual(empty.querySha256, findNavigationPath(grid, query(request.start, request.start)).querySha256);
});

test('512-axis boundaries cannot wrap, and maximum weighted distances exceed uint32 without truncation', () => {
  const wrapped = createNavigationGrid(input([cell(511, 0), cell(0, 1)]));
  assert.equal(findNavigationPath(wrapped, query({ x: 511, y: 0 }, { x: 0, y: 1 })).status, 'unreachable');
  const long = createNavigationGrid(input(Array.from({ length: 512 }, (_, x) => cell(x, 511, 65535))));
  const result = findNavigationPath(long, query({ x: 0, y: 511 }, { x: 511, y: 511 }));
  assert.equal(result.cost, 511 * 256 * 65535); assert(result.cost! > 0xffffffff); assert.equal(result.path.length, 512);
});

test('near-maximum sparse corridor completes with bounded heap storage and exact multi-trillion cost', () => {
  const cells: NavigationCell[] = [];
  for (let row = 0; row < 256; row++) {
    for (let x = 0; x < 510; x++) cells.push(cell(x, row * 2, 65535, 85));
    if (row < 255) cells.push(cell(row % 2 ? 0 : 509, row * 2 + 1, 65535, 85));
  }
  assert.equal(cells.length, 130815);
  const grid = createNavigationGrid(input(cells)), request = query({ x: 0, y: 0 }, { x: 0, y: 510 });
  const route = findNavigationPath(grid, request);
  assert.equal(route.status, 'found'); assert.equal(route.expanded, cells.length); assert.equal(route.path.length, cells.length);
  assert.equal(route.cost, (cells.length - 1) * 256 * 65535);
  const exhausted = findNavigationPath(grid, request, { expanded: cells.length - 1 });
  assert.equal(exhausted.status, 'budget-exhausted'); assert.deepEqual(exhausted.path, []);
});

test('grid and query hashes bind policies, content, costs, edges, bounds and canonical cell/occupancy order', () => {
  const cells = [cell(2, 1, 3, 4), cell(1, 1, 5, 0)], grid = createNavigationGrid(input(cells));
  const reversed = createNavigationGrid(input([...cells].reverse())); assert.equal(grid.sha256, reversed.sha256);
  const header = `{"cellCount":2,"contentIdentity":{"manifestSha256":"${'a'.repeat(64)}","orderedModHashes":[],"profile":"ra2","rulesSha256":"${'b'.repeat(64)}"},"movementClass":"foot","policy":"webra2-octile-directed-1"}\n`;
  const expected = createHash('sha256').update(header).update(Uint8Array.from([1, 2, 0, 0, 5, 0, 0, 2, 2, 0, 0, 3, 0, 4])).digest('hex');
  assert.equal(grid.sha256, expected);
  for (const change of [
    { ...input(cells), movementClass: 'track' },
    { ...input(cells), contentIdentity: { ...contentIdentity, profile: 'yr' as const } },
    { ...input(cells), contentIdentity: { ...contentIdentity, rulesSha256: 'c'.repeat(64) } },
    { ...input(cells), contentIdentity: { ...contentIdentity, orderedModHashes: ['d'.repeat(64)] } },
    input([cell(2, 1, 4, 4), cells[1]!]), input([cell(2, 1, 3, 5), cells[1]!]),
  ]) assert.notEqual(createNavigationGrid(change).sha256, grid.sha256);
  const q = query({ x: 1, y: 1 }, { x: 2, y: 1 }, [{ x: 3, y: 3 }, { x: 4, y: 4 }]);
  assert.deepEqual(findNavigationPath(grid, q), findNavigationPath(reversed, { ...q, occupied: [...q.occupied].reverse() }));
  assert.notEqual(findNavigationPath(grid, q).querySha256, findNavigationPath(grid, { ...q, occupied: [] }).querySha256);
});

test('owned grid state and content identity survive caller mutation and reject forged handles', () => {
  const c = { x: 0, y: 0, cost: 1, exits: 255 }, source = { ...contentIdentity, orderedModHashes: ['c'.repeat(64)] };
  const grid = createNavigationGrid({ contentIdentity: source, movementClass: 'foot', cells: [c] });
  c.cost = 9; source.rulesSha256 = 'd'.repeat(64); source.orderedModHashes[0] = 'e'.repeat(64);
  assert.equal(navigationCell(grid, { x: 0, y: 0 })?.cost, 1);
  assert.equal(grid.contentIdentity.rulesSha256, 'b'.repeat(64)); assert.equal(grid.contentIdentity.orderedModHashes[0], 'c'.repeat(64));
  assert.throws(() => navigationCell({ ...grid }, { x: 0, y: 0 }), error('navigation-grid'));
});

test('untrusted boundaries reject malformed numbers, duplicates, structure and lower-limit violations without getters', () => {
  for (const changed of [cell(-0, 0), cell(512, 0), cell(0, -1), cell(0, 0, 0), cell(0, 0, 65536), cell(0, 0, 1, 256), cell(NaN, 0)]) {
    assert.throws(() => createNavigationGrid(input([changed])), error('navigation-integer'));
  }
  assert.throws(() => createNavigationGrid(input([cell(0, 0), cell(0, 0)])), error('navigation-duplicate-cell'));
  assert.throws(() => createNavigationGrid(input([cell(0, 0)]), { cells: 0 }), error('navigation-array-limit'));
  let called = false; const getter = Object.defineProperty({}, 'x', { enumerable: true, get() { called = true; return 0; } });
  Object.assign(getter, { y: 0, cost: 1, exits: 0 });
  assert.throws(() => createNavigationGrid(input([getter as NavigationCell])), error('navigation-fields')); assert.equal(called, false);
  const sparse = new Array<NavigationCell>(1); assert.throws(() => createNavigationGrid(input(sparse)), error('navigation-array'));
  const expanded = [cell(0, 0)]; Object.defineProperty(expanded, 'extra', { value: true });
  assert.throws(() => createNavigationGrid(input(expanded)), error('navigation-array'));
  assert.throws(() => createNavigationGrid({ ...input([]), contentIdentity: { ...contentIdentity, manifestSha256: Object('a'.repeat(64)) as string } }), error('navigation-content-hash'));
  assert.throws(() => createNavigationGrid({ ...input([]), movementClass: Object('foot') as string }), error('navigation-class'));
  const grid = createNavigationGrid(input([cell(0, 0)])), request = query({ x: 0, y: 0 }, { x: 0, y: 0 });
  assert.throws(() => findNavigationPath(grid, { ...request, occupied: [request.start, request.start] }), error('navigation-duplicate-occupancy'));
  assert.throws(() => findNavigationPath(grid, request, { cells: 0 }), error('navigation-cell-limit'));
  for (const limit of [-1, -0, 0.5, Infinity, NAVIGATION_LIMITS.expanded + 1]) assert.throws(() => findNavigationPath(grid, request, { expanded: limit }), error('navigation-integer'));
});

/** Independent O(V²) Dijkstra over explicit pair edges; no A* heap, heuristic, addresses or frontier helpers. */
function dijkstra(cells: NavigationCell[], start: NavigationPosition, goal: NavigationPosition, occupied: NavigationPosition[]): number | null {
  const usable = cells.filter(c => !occupied.some(p => p.x === c.x && p.y === c.y));
  const s = usable.findIndex(c => c.x === start.x && c.y === start.y), t = usable.findIndex(c => c.x === goal.x && c.y === goal.y);
  if (s < 0 || t < 0) return null;
  const adjacency = usable.map(a => usable.map(b => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const directions = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    const d = directions.findIndex(([x, y]) => x === dx && y === dy);
    if (d < 0 || !(a.exits & 2 ** d)) return Infinity;
    if (dx && dy) {
      const h = usable.find(c => c.x === b.x && c.y === a.y), v = usable.find(c => c.x === a.x && c.y === b.y);
      const hBit = dx > 0 ? 4 : 64, vBit = dy > 0 ? 16 : 1;
      if (!h || !v || !(a.exits & hBit) || !(a.exits & vBit) || !(h.exits & vBit) || !(v.exits & hBit)) return Infinity;
    }
    return (dx && dy ? 362 : 256) * b.cost;
  }));
  const distance = usable.map(() => Infinity), done = new Set<number>(); distance[s] = 0;
  while (done.size < usable.length) {
    let nearest = -1;
    for (let i = 0; i < usable.length; i++) if (!done.has(i) && (nearest < 0 || distance[i]! < distance[nearest]!)) nearest = i;
    if (nearest < 0 || !Number.isFinite(distance[nearest])) break;
    if (nearest === t) return distance[t]!;
    done.add(nearest);
    for (let j = 0; j < usable.length; j++) distance[j] = Math.min(distance[j]!, distance[nearest]! + adjacency[nearest]![j]!);
  }
  return null;
}

test('A* agrees with independent Dijkstra costs over 240 original weighted/directed/occupied sparse grids', () => {
  let seed = 0x134235;
  let found = 0, unavailable = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let iteration = 0; iteration < 240; iteration++) {
    const cells = rectangle(6, 6).filter(() => random() % 7 !== 0).map(c => cell(c.x, c.y, 1 + random() % 13, iteration % 3 ? 255 : random() & 255));
    const occupied = cells.filter(() => random() % 19 === 0).map(({ x, y }) => ({ x, y }));
    const start = { x: random() % 6, y: random() % 6 }, goal = { x: random() % 6, y: random() % 6 };
    const route = findNavigationPath(createNavigationGrid(input(cells)), query(start, goal, occupied));
    assert.equal(route.cost, dijkstra(cells, start, goal, occupied), `oracle case ${iteration}`);
    const permuted = findNavigationPath(createNavigationGrid(input([...cells].reverse())), query(start, goal, [...occupied].reverse()));
    assert.deepEqual(permuted, route, `permutation case ${iteration}`);
    if (route.status === 'found') {
      found++;
      assert.deepEqual(route.path[0], start); assert.deepEqual(route.path.at(-1), goal);
      assert.equal(new Set(route.path.map(p => `${p.x},${p.y}`)).size, route.path.length);
    } else unavailable++;
  }
  assert(found > 40 && unavailable > 40, `corpus balance ${found}/${unavailable}`);
});
