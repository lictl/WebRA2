// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic map/INI/TMP fixtures, no retail bytes or derived geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileTerrainTraversal, isTerrainTraversal, TERRAIN_TRAVERSAL_LIMITS, type TerrainTraversalInput } from '../../packages/content/src/terrain-traversal.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { createIniSourceView } from '../../packages/content/src/ini-source-view.ts';
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
test('both profiles map native TMP codes to land factors and explicit integer costs', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileTerrainTraversal(fixture({ profile }));
    assert.deepEqual(r.cells.slice(0, 3).map(c => c.landType), [0, 1, 2]); assert.equal(r.land[1]!.factors[0]!.value, 0.5);
    const foot = r.movementClasses.find(c => c.id === 'foot')!; assert.equal(foot.cells.length, 7); assert.equal(foot.unavailable.factorNonpositive, 3);
    assert.deepEqual([...new Set(foot.cells.map(c => c.cost))].sort(), [256, 512]); assert.equal(foot.costScale, 256);
    assert.equal(r.cells[0]!.tmp.flags, 0xcdcdcdca); assert.deepEqual(r.cells[0]!.blockers, []); assert.equal(r.traversalComplete, false);
  }
});
test('exact case, section reset versus absent retain, forced Winged and unsupported duplicate reads retain origin history', () => {
  const r = compileTerrainTraversal(fixture({ rules: '[Clear]\nFoot=.25\nTrack=.75\n[Road]\nFoot=.5\n', later: '[Clear]\nfoot=0\nTrack=.2\nWinged=0\n[Road]\nFoot=0\nFoot=1\n' }));
  const clear = r.land[0]!.factors;
  assert.equal(clear[0]!.value, 1); assert.deepEqual(clear[0]!.history.map(h => h.state), ['explicit', 'default', 'retained']);
  assert.equal(clear[1]!.value, Math.fround(.2)); assert.equal(clear[1]!.history[1]!.origin!.keySpelling, 'Track'); assert.equal(clear[4]!.value, 1);
  assert.equal(r.land[1]!.factors[0]!.value, null); assert.equal(r.land[2]!.factors[0]!.value, null);
  const absent = compileTerrainTraversal(fixture({ rules: '[Clear]\nFoot=.25\n', later: '[clear]\nFoot=0\n' })); assert.equal(absent.land[0]!.factors[0]!.value, .25);
  const duplicate = compileTerrainTraversal(fixture({ rules: '[Clear]\nFoot=1\n[Clear]\nTrack=1\n' })); assert.equal(duplicate.land[0]!.factors[0]!.value, null);
});
test('numeric subset caps above one, preserves nonpositive blocking and exposes invalid/tiny factors', () => {
  for (const [value, expected, unavailable] of [['2', 1, null], ['-1', -1, 'factorNonpositive'], ['0', 0, 'factorNonpositive'],
    ['.001', Math.fround(.001), 'costRange'], ['1e500', null, 'factorUnknown'], ['.5junk', null, 'factorUnknown'], ['NaN', null, 'factorUnknown'], ['0.5000000298023223876953125', null, 'factorUnknown']] as const) {
    const r = compileTerrainTraversal(fixture({ types: [0], rules: `[Clear]\nFoot=${value}\n` })); assert.equal(r.land[0]!.factors[0]!.value, expected);
    if (unavailable) assert.equal(r.movementClasses.find(c => c.id === 'foot')!.unavailable[unavailable], 10);
  }
});
test('directed masks use map axes, block elevation jumps and feed navigation with destination weights', () => {
  const f = fixture({ types: [0], elevation: { 9: 1 } }), r = compileTerrainTraversal(f), c = r.movementClasses.find(c => c.id === 'foot')!;
  const row = c.cells.find(c => c.x === 3 && c.y === 3)!;
  assert.equal(row.exits & (1 << 2), 0); assert.equal(row.exits & (1 << 0), 1); // raised east blocked, flat north retained
  const grid = createNavigationGrid({ contentIdentity: r.contentIdentity, movementClass: c.id, cells: c.cells });
  const path = findNavigationPath(grid, { start: { x: 2, y: 2 }, goal: { x: 3, y: 3 }, occupied: [] }); assert.equal(path.status, 'found'); assert.equal(path.cost, 362 * 256);
  assert.equal(findNavigationPath(grid, { start: { x: 3, y: 3 }, goal: { x: 4, y: 3 }, occupied: [] }).status, 'unreachable');
});
test('ramp/height/extra/unknown land and map ice/word/overlay blockers never produce silent walkable cells', () => {
  const r = compileTerrainTraversal(fixture({ types: [0, 0, 0, 0, 255, 1, 5, 0, 0, 0], variants: [{ ramp: 1 }, { height: 1 }, { extra: true }],
    words: { 3: 1 }, ice: { 7: 1 }, overlays: { 8: [1, 0], 9: [255, 5] } }));
  assert.deepEqual(r.cells.map(c => c.blockers), [['ramp'], ['tmp-height'], ['extra-plane'], ['extra-tile-word'], ['unknown-land'], ['land-ice'], ['land-tunnel'], ['ice-byte'], ['overlay'], ['overlay']]);
  assert.ok(r.movementClasses.every(c => c.cells.length === 0));
});
test('owned map hash/recompile defeats altered cells and absent/sparse terrain; stale asset/physical aliases fail before parsing', () => {
  const f = fixture();
  assert.throws(() => compileTerrainTraversal({ ...f, mapBytes: f.mapBytes.slice(1) }), /map-hash/);
  const cells = [...f.terrain.cells]; cells[0] = Object.freeze({ ...cells[0]!, elevation: 1 });
  assert.throws(() => compileTerrainTraversal({ ...f, terrain: Object.freeze({ ...f.terrain, cells: Object.freeze(cells) }) }), /terrain-identity/);
  assert.throws(() => compileTerrainTraversal({ ...f, terrain: Object.freeze({ ...f.terrain, cells: Object.freeze(new Array(10)) }) }), /array/);
  assert.throws(() => compileTerrainTraversal({ ...f, terrain: Object.freeze({ ...f.terrain, cells: Object.freeze([]) }) }), /choice-count/);
  assert.throws(() => compileTerrainTraversal({ ...f, assets: [{ ...f.assets[0]!, sha256: 'c'.repeat(64) }] }), /member-identity/);
  const bad = f.assets[0]!.bytes.slice(); bad[0] = 0;
  assert.throws(() => compileTerrainTraversal({ ...f, assets: [{ ...f.assets[0]!, bytes: bad }] }), /asset-hash/);
  const other = { ...f.assets[0]!, id: 'alias', path: 'alias.urb', source: { ...f.assets[0]!.source, root: { ...f.assets[0]!.source.root, sourceId: 'alias-root' } } };
  assert.throws(() => compileTerrainTraversal({ ...f, assets: [...f.assets, other] }), /aliased-member/);
  assert.throws(() => compileTerrainTraversal(fixture({ types: [0], variants: [{ absent: true }] })), /missing-subtile/);
});
test('profile/map stage/choice/class joins and malicious property shapes reject', () => {
  const f = fixture(), other = fixture({ profile: 'yr' });
  assert.throws(() => compileTerrainTraversal({ ...f, rules: other.rules }), /rules/);
  assert.throws(() => compileTerrainTraversal({ ...f, choices: f.choices.map((c, i) => i === 0 ? { ...c, subtile: 1 } : c) }), /choice/);
  assert.throws(() => compileTerrainTraversal({ ...f, movementClasses: [{ id: 'a', speedType: 0 }, { id: 'b', speedType: 0 }] }), /duplicate-class/);
  let calls = 0; const a = { ...f.assets[0] }; Object.defineProperty(a, 'sha256', { get() { calls++; return 'a'.repeat(64); }, enumerable: true });
  assert.throws(() => compileTerrainTraversal({ ...f, assets: [a as typeof f.assets[number]] }), /fields/); assert.equal(calls, 0);
  const r = compileTerrainTraversal({ ...f, movementClasses: [{ id: 'winged', speedType: 4 }] }); assert.equal(r.movementClasses[0]!.status, 'unsupported-winged'); assert.equal(r.movementClasses[0]!.cells.length, 0);
});
test('result ownership, sorted choices/classes and resource boundaries are deterministic', () => {
  const f = fixture(), r = compileTerrainTraversal(f), again = compileTerrainTraversal({ ...f, choices: [...f.choices].reverse(), movementClasses: [...f.movementClasses].reverse() });
  assert.ok(isTerrainTraversal(r)); assert.equal(isTerrainTraversal({ ...r }), false); assert.equal(isTerrainTraversal(null), false);
  assert.equal(r.sha256, again.sha256); assert.equal(r.sha256, compileTerrainTraversal(f, { fields: r.allocations.fields }).sha256);
  for (const key of ['sourceBytes', 'mapBytes', 'assets', 'cells', 'indexSlots', 'classes', 'fields', 'graphWork', 'outputCells', 'outputBytes'] as const)
    assert.throws(() => compileTerrainTraversal(f, { [key]: 0 }), /traversal-|terrain-/);
  assert.throws(() => compileTerrainTraversal(f, { cells: TERRAIN_TRAVERSAL_LIMITS.cells + 1 }), /integer/);
  f.mapBytes.fill(0); f.assets[0]!.bytes.fill(0); assert.equal(r.cells[0]!.landType, 0);
  assert.ok(Object.isFrozen(r.cells[0]!.tmp)); assert.ok(Object.isFrozen(r.land[0]!.factors[0]!.history)); assert.ok(Object.isFrozen(r.assets[0]!.source.root));
});
test('the full 16-code native TMP lookup domain is distinct from LandType ordinals', () => {
  const expected = [0, 8, 8, 8, 8, 10, 9, 3, 3, 2, 6, 1, 1, 0, 7, 3];
  for (let code = 0; code < 16; code++) assert.equal(compileTerrainTraversal(fixture({ types: [code] })).cells[0]!.landType, expected[code]);
  for (const code of [16, 127, 128, 255]) assert.deepEqual(compileTerrainTraversal(fixture({ types: [code] })).cells[0]!.blockers, ['unknown-land']);
});
test('same root identities cannot conflict and exact serialized-output budget remains reproducible', () => {
  const f = fixture(), a = f.assets[0]!, other = { ...a, id: 'other', path: 'other.urb', source: { ...a.source, root: { ...a.source.root, sha256: 'c'.repeat(64) } } };
  assert.throws(() => compileTerrainTraversal({ ...f, assets: [a, other] }), /root-identity/);
  const r = compileTerrainTraversal(f); assert.equal(compileTerrainTraversal(f, { outputBytes: r.allocations.outputBytes }).sha256, r.sha256);
  assert.throws(() => compileTerrainTraversal(f, { outputBytes: r.allocations.outputBytes - 1 }), /output-limit/);
});

test('durable traversal identity ignores session root handles and resource enumeration order', () => {
  const f = fixture(), a = f.assets[0]!, bytes = a.bytes.slice(); bytes[bytes.length - 1] = 1;
  const b = { ...a, id: 'second', path: 'second.urb', bytes, sha256: hash(bytes),
    source: { root: { sourceId: 'second-root', size: bytes.length, sha256: hash(bytes) }, absoluteOffset: 0, size: bytes.length, sha256: hash(bytes) } };
  const choices = f.choices.map((c, i) => ({ ...c, assetId: i % 2 ? b.id : a.id }));
  const original = compileTerrainTraversal({ ...f, assets: [a, b], choices });
  const reordered = compileTerrainTraversal({ ...f, assets: [b, a].map((asset, i) => ({ ...asset,
    source: { ...asset.source, root: { ...asset.source.root, sourceId: `file:${400 - i}` } } })), choices: [...choices].reverse() });
  assert.equal(original.sha256, reordered.sha256);
  assert.deepEqual(original.movementClasses, reordered.movementClasses);
  assert.notEqual(original.assets[0]!.source.root.sourceId, reordered.assets[0]!.source.root.sourceId);
  assert.equal(original.allocations.outputBytes, reordered.allocations.outputBytes);
  assert.throws(() => compileTerrainTraversal({ ...f, assets: [a, { ...b, source: { ...b.source,
    root: { ...b.source.root, sourceId: a.source.root.sourceId } } }], choices }), /root-identity/);
});

test('durable traversal identity still binds verified bytes, physical roots and logical asset roles', () => {
  const f = fixture(), a = f.assets[0]!, original = compileTerrainTraversal(f), bytes = a.bytes.slice(); bytes[bytes.length - 1] = 1;
  const changed = { ...a, bytes, sha256: hash(bytes), source: { ...a.source, sha256: hash(bytes), root: { ...a.source.root, sha256: hash(bytes) } } };
  const variants = [changed, { ...a, path: 'renamed.urb' }, { ...a, source: { ...a.source, root: { ...a.source.root, sha256: 'd'.repeat(64) } } },
    { ...a, source: { ...a.source, absoluteOffset: 1, root: { ...a.source.root, size: a.bytes.length + 1 } } }];
  for (const asset of variants) assert.notEqual(compileTerrainTraversal({ ...f, assets: [asset] }).sha256, original.sha256);
  assert.throws(() => compileTerrainTraversal({ ...f, assets: [{ ...a, bytes }] }), /asset-hash/);
});
