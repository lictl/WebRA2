// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic map/INI/TMP fixtures, no retail bytes or derived geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileTerrainTraversal, type TerrainTraversalInput } from '../../packages/content/src/terrain-traversal.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { createIniSourceView } from '../../packages/content/src/ini-source-view.ts';
import { compileTerrainTraversalGround, isTerrainTraversalGround, TERRAIN_TRAVERSAL_GROUND_LIMITS } from '../../packages/content/src/terrain-traversal-ground.ts';
import { createNavigationGrid, findNavigationPath } from '../../packages/sim/src/navigation.ts';
const encode = (s: string) => new TextEncoder().encode(s), hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const xy = [[1, 3], [2, 2], [3, 1], [2, 3], [3, 2], [2, 4], [3, 3], [4, 2], [3, 4], [4, 3]] as const;
function packed(raw: Uint8Array, lzo: boolean): string {
  const blocks: Buffer[] = [];
  for (let at = 0; at < raw.length; at += 8192) {
    const piece = raw.subarray(at, at + 8192), stream: number[] = [];
    if (lzo) { stream.push(17 + piece.length, ...piece, 17, 0, 0); }
    else { for (let i = 0; i < piece.length;) { let end = i + 1; while (end < piece.length && piece[end] === piece[i]) end++;
      stream.push(254, (end - i) & 255, (end - i) >>> 8, piece[i]!); i = end; } stream.push(128); }
    const head = Buffer.alloc(4); head.writeUInt16LE(stream.length); head.writeUInt16LE(piece.length, 2); blocks.push(head, Buffer.from(stream));
  }
  return Buffer.concat(blocks).toString('base64');
}
function tmp(land: number[], variants: { height?: number; ramp?: number; extra?: boolean; absent?: boolean }[] = []): Uint8Array {
  const lengths = land.map((_, i) => variants[i]?.absent ? 0 : 52 + 1800 + (variants[i]?.extra ? 2 : 0));
  const bytes = new Uint8Array(16 + 4 * land.length + lengths.reduce((a, b) => a + b, 0)), view = new DataView(bytes.buffer);
  view.setUint32(0, land.length, true); view.setUint32(4, 1, true); view.setUint32(8, 60, true); view.setUint32(12, 30, true);
  let at = 16 + 4 * land.length;
  land.forEach((type, i) => { const spec = variants[i] ?? {}; if (spec.absent) return;
    view.setUint32(16 + 4 * i, at, true); view.setUint32(at + 12, 952, true);
    if (spec.extra) { view.setUint32(at + 8, 1852, true); view.setUint32(at + 16, 1853, true); view.setUint32(at + 28, 1, true); view.setUint32(at + 32, 1, true); }
    view.setUint32(at + 36, (0xcdcdcdc8 | 2 | (spec.extra ? 1 : 0)) >>> 0, true);
    bytes[at + 40] = spec.height ?? 0; bytes[at + 41] = type; bytes[at + 42] = spec.ramp ?? 0; at += lengths[i]!;
  }); return bytes;
}
function fixture(options: { profile?: 'ra2' | 'yr'; rules?: string; later?: string; types?: number[]; variants?: Parameters<typeof tmp>[1];
  elevation?: Record<number, number>; overlays?: Record<number, [number, number]>; words?: Record<number, number>; ice?: Record<number, number> } = {}): TerrainTraversalInput {
  const profile = options.profile ?? 'ra2', types = options.types ?? [0, 11, 9], data = tmp(types, options.variants), raw = new Uint8Array(114), v = new DataView(raw.buffer);
  const overlay = new Uint8Array(262144).fill(255), od = new Uint8Array(262144);
  xy.forEach(([x, y], i) => { v.setUint16(i * 11, x, true); v.setUint16(i * 11 + 2, y, true); v.setUint16(i * 11 + 4, 100, true);
    v.setUint16(i * 11 + 6, options.words?.[i] ?? 0, true); raw[i * 11 + 8] = i % types.length; raw[i * 11 + 9] = options.elevation?.[i] ?? 0;
    raw[i * 11 + 10] = options.ice?.[i] ?? 0; const o = options.overlays?.[i]; if (o) { overlay[x + 512 * y] = o[0]; od[x + 512 * y] = o[1]; } });
  const mapBytes = encode('[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN\n' +
    '[IsoMapPack5]\n1=' + packed(raw, true) + '\n[OverlayPack]\n1=' + packed(overlay, false) + '\n[OverlayDataPack]\n1=' + packed(od, false) + '\n');
  const source = { id: 'map', profile, sha256: hash(mapBytes) }, base = encode(options.rules ?? '[Clear]\nFoot=1\n[Road]\nFoot=50%\n[Water]\nFoot=0\nFloat=1\n');
  const layers = [{ id: 'base', profile, order: 0, kind: 'base' as const, sourceSha256: hash(base), bytes: base }];
  const later = options.later === undefined ? [] : [{ id: 'later', profile, order: 1, kind: 'mod' as const, sourceSha256: hash(encode(options.later)), bytes: encode(options.later) }];
  const rules = createIniSourceView(compileRuntimeIni(profile, [...layers, ...later, { id: 'map', profile, order: 2, kind: 'map', sourceSha256: source.sha256, bytes: mapBytes }]));
  const terrain = compileScenarioTerrain({ profile, source, bytes: mapBytes });
  return { contentIdentity: { profile, manifestSha256: 'a'.repeat(64), rulesSha256: 'b'.repeat(64), orderedModHashes: [] }, terrain, mapBytes, rules,
    assets: [{ id: 'tiles', path: 'original.urb', sha256: hash(data), source: { root: { sourceId: 'root', size: data.length, sha256: hash(data) }, absoluteOffset: 0, size: data.length, sha256: hash(data) }, bytes: data }],
    choices: terrain.cells.map(c => ({ sourceRecord: c.sourceRecord, assetId: 'tiles', subtile: c.subtile })), movementClasses: [{ id: 'foot', speedType: 0 }, { id: 'float', speedType: 5 }] };
}
test('genuine flat bases preserve exact rows, factors and source authority in both profiles', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const base = compileTerrainTraversal(fixture({ profile })), before = JSON.stringify(base);
    const result = compileTerrainTraversalGround({ base });
    assert.equal(result.base, base); assert.equal(result.baseSha256, base.sha256);
    assert.equal(result.source, base.source); assert.equal(result.contentIdentity, base.contentIdentity);
    assert.deepEqual(result.movementClasses, base.movementClasses); assert.equal(JSON.stringify(base), before);
    assert.ok(isTerrainTraversalGround(result)); assert.equal(result.traversalComplete, false);
    assert.equal(result.nativeBehaviorVerified, false); assert.notEqual(result.sha256, base.sha256);
    assert.equal(compileTerrainTraversalGround({ base }).sha256, result.sha256);
    assert.throws(() => { (result.cells[0]!.blockers as string[]).push('overlay'); }, TypeError);
    assert.throws(() => { (result.movementClasses[0]!.cells[0] as { exits: number }).exits = 0; }, TypeError);
  }
});
test('one-level crossings require the lower endpoint ramp; full supported byte domain and reverse direction', () => {
  for (const profile of ['ra2', 'yr'] as const) for (const ramp of Array.from({ length: 21 }, (_, i) => i)) {
    for (const low of [6, 9]) {
      const high = low === 6 ? 9 : 6, variants = Array.from({ length: 10 }, () => ({} as { ramp?: number }));
      variants[low] = { ramp };
      const base = compileTerrainTraversal(fixture({ profile, types: Array(10).fill(0), variants, elevation: { [high]: 1 } }));
      const rows = compileTerrainTraversalGround({ base }).movementClasses[0]!.cells;
      const a = rows.find(c => c.x === 3 && c.y === 3)!, b = rows.find(c => c.x === 4 && c.y === 3)!;
      assert.equal(!!(a.exits & 4), ramp !== 0); assert.equal(!!(b.exits & 64), ramp !== 0);
    }
  }
  // A slope on only the higher endpoint cannot substitute for the lower slope.
  for (const gap of [1, 2, 4]) {
    const variants = Array.from({ length: 10 }, () => ({ ramp: 0 })); variants[9] = { ramp: 1 };
    const rows = compileTerrainTraversalGround({ base: compileTerrainTraversal(fixture({ types: Array(10).fill(0), variants, elevation: { 9: gap } })) }).movementClasses[0]!.cells;
    assert.equal(rows.find(c => c.x === 3 && c.y === 3)!.exits & 4, 0);
    assert.equal(rows.find(c => c.x === 4 && c.y === 3)!.exits & 64, 0);
    if (gap > 1) {
      variants[6] = { ramp: 1 };
      const blocked = compileTerrainTraversalGround({ base: compileTerrainTraversal(fixture({ types: Array(10).fill(0), variants, elevation: { 9: gap } })) });
      assert.equal(blocked.movementClasses[0]!.cells.find(c => c.x === 3 && c.y === 3)!.exits & 4, 0);
    }
  }
});
test('image height and extra image are audited separately from packed cell elevation', () => {
  const base = compileTerrainTraversal(fixture({ types: [0], variants: [{ height: 255, extra: true }] }));
  assert.equal(base.movementClasses[0]!.cells.length, 0);
  const ground = compileTerrainTraversalGround({ base });
  assert.equal(ground.movementClasses[0]!.cells.length, 10);
  for (const cell of ground.cells) {
    assert.equal(cell.elevation, 0); assert.equal(cell.tmp.heightByte, 255);
    assert.deepEqual(cell.baseBlockers, ['tmp-height', 'extra-plane']); assert.deepEqual(cell.blockers, []);
    assert.equal(cell.tmp.flags, 0xcdcdcdcb);
  }
});
test('unknown slope and signed levels fail closed, while original nonpresentation blockers remain', () => {
  const base = compileTerrainTraversal(fixture({ types: [0, 0, 0, 0, 255, 1, 5, 0, 0, 0],
    variants: [{ ramp: 21 }, { ramp: 255 }], elevation: { 2: 128, 3: 255 },
    ice: { 7: 1 }, overlays: { 8: [1, 0], 9: [255, 5] } }));
  const r = compileTerrainTraversalGround({ base });
  assert.deepEqual(r.cells.map(c => c.blockers), [['unsupported-ramp-code'], ['unsupported-ramp-code'],
    ['unsupported-signed-level'], ['unsupported-signed-level'], ['unknown-land'], ['land-ice'], ['land-tunnel'], ['ice-byte'], ['overlay'], ['overlay']]);
  assert.equal(r.movementClasses[0]!.cells.length, 0);
  const boundary = compileTerrainTraversalGround({ base: compileTerrainTraversal(fixture({ types: [0], variants: [{ ramp: 20 }], elevation: { 6: 127 } })) });
  assert.deepEqual(boundary.cells[6]!.blockers, []);
  const extraWord = compileTerrainTraversalGround({ base: compileTerrainTraversal(fixture({ types: [0], words: { 6: 1 } })) });
  assert.deepEqual(extraWord.cells[6]!.blockers, ['extra-tile-word']);
  assert.ok(!extraWord.movementClasses[0]!.cells.some(c => c.x === 3 && c.y === 3));
});
test('land-factor exclusions, destination costs and unsupported Winged status remain explicit', () => {
  const f = fixture({ types: [0], variants: [{ ramp: 1 }], rules: '[Clear]\nFoot=.5\nTrack=0\nWheel=-1\nHover=.001\nFloat=nonsense\nAmphibious=.25\nFloatBeach=1\n' });
  const base = compileTerrainTraversal({ ...f, movementClasses: Array.from({ length: 8 }, (_, speedType) => ({ id: 's' + speedType, speedType })) });
  const r = compileTerrainTraversalGround({ base });
  assert.ok(r.movementClasses[0]!.cells.every(c => c.cost === 512));
  assert.equal(r.movementClasses[1]!.unavailable.factorNonpositive, 10);
  assert.equal(r.movementClasses[2]!.unavailable.factorNonpositive, 10);
  assert.equal(r.movementClasses[3]!.unavailable.costRange, 10);
  assert.equal(r.movementClasses[4]!.status, 'unsupported-winged'); assert.equal(r.movementClasses[4]!.cells.length, 0);
  assert.equal(r.movementClasses[5]!.unavailable.factorUnknown, 10);
  assert.ok(r.movementClasses[6]!.cells.every(c => c.cost === 1024));
});
test('navigation retains whole-cell occupancy and strict diagonal corners on the new graph', () => {
  const r = compileTerrainTraversalGround({ base: compileTerrainTraversal(fixture({ types: [0], variants: [{ ramp: 1 }], elevation: { 6: 1 } })) });
  const grid = createNavigationGrid({ contentIdentity: r.contentIdentity, movementClass: 'foot', cells: r.movementClasses[0]!.cells });
  const query = { start: { x: 2, y: 2 }, goal: { x: 3, y: 3 }, occupied: [] };
  const direct = findNavigationPath(grid, query); assert.equal(direct.status, 'found'); assert.equal(direct.cost, 362 * 256);
  const corner = findNavigationPath(grid, { ...query, occupied: [{ x: 3, y: 2 }] });
  assert.equal(corner.status, 'found'); assert.ok(corner.cost! > direct.cost!);
  assert.equal(findNavigationPath(grid, { ...query, occupied: [query.goal] }).status, 'blocked-goal');
});
test('outer values are descriptor snapshots; forged, wrapped or serialized bases never acquire authority', () => {
  const base = compileTerrainTraversal(fixture()), expected = compileTerrainTraversalGround({ base }).sha256;
  for (const forged of [{ ...base }, JSON.parse(JSON.stringify(base)), new Proxy(base, {}), null]) {
    assert.throws(() => compileTerrainTraversalGround({ base: forged as typeof base }), /base-authority/);
  }
  assert.equal(isTerrainTraversalGround({ ...compileTerrainTraversalGround({ base }) }), false);
  assert.equal(isTerrainTraversalGround(new Proxy(compileTerrainTraversalGround({ base }), {})), false);
  const noGet = new Proxy({ base }, { get() { throw new Error('get trap must not run'); } });
  assert.equal(compileTerrainTraversalGround(noGet).sha256, expected);
  assert.throws(() => compileTerrainTraversalGround({ get base(): never { throw new Error('must not run'); } }), /fields/);
  const outer = { base }, options = new Proxy({}, { ownKeys() { outer.base = {} as typeof base; return []; }, get() { throw new Error('must not run'); } });
  assert.equal(compileTerrainTraversalGround(outer, options).sha256, expected);
  assert.throws(() => compileTerrainTraversalGround({ base, extra: 1 } as { base: typeof base }), /fields/);
});
test('caps reserve worst-case graph work before copies and reject malformed limit inputs', () => {
  const base = compileTerrainTraversal(fixture()), r = compileTerrainTraversalGround({ base });
  for (const options of [{ cells: 9 }, { classes: 1 }, { graphWork: 159 }, { outputCells: 19 }, { outputBytes: r.allocations.reservedBytes - 1 }]) {
    assert.throws(() => compileTerrainTraversalGround({ base }, options), /limit/);
  }
  const exact = compileTerrainTraversalGround({ base }, { cells: 10, classes: 2, graphWork: 160, outputCells: 20, outputBytes: r.allocations.reservedBytes });
  assert.equal(exact.sha256, r.sha256); assert.equal(exact.allocations.graphWork, exact.allocations.outputCells * 8);
  for (const options of [{ cells: NaN }, { cells: -0 }, { cells: Infinity }, { cells: -1 }, { cells: 0.5 },
    { cells: TERRAIN_TRAVERSAL_GROUND_LIMITS.cells + 1 }, { mystery: 1 }, { [Symbol('x')]: 1 }]) {
    assert.throws(() => compileTerrainTraversalGround({ base }, options), /limits/);
  }
  assert.throws(() => compileTerrainTraversalGround({ base }, { get cells(): never { throw new Error('must not run'); } }), /fields/);
});
test('logical identity ignores import-session handles but binds source changes and selected class semantics', () => {
  const f = fixture({ types: [0], variants: [{ ramp: 1 }] }), a = compileTerrainTraversalGround({ base: compileTerrainTraversal(f) });
  const asset = f.assets[0]!, b = compileTerrainTraversalGround({ base: compileTerrainTraversal({ ...f,
    assets: [{ ...asset, source: { ...asset.source, root: { ...asset.source.root, sourceId: 'another-import' } } }] }) });
  assert.equal(a.sha256, b.sha256); assert.notEqual(a.base.assets[0]!.source.root.sourceId, b.base.assets[0]!.source.root.sourceId);
  const c = compileTerrainTraversalGround({ base: compileTerrainTraversal(fixture({ types: [0], variants: [{ ramp: 2 }] })) });
  assert.deepEqual(a.movementClasses, c.movementClasses); assert.notEqual(a.sha256, c.sha256);
});
