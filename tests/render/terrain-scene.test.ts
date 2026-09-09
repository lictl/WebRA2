// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic maps, TMP records and colors; no retail imagery or placements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileScenarioTerrain, type ScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { createTerrainScene, TERRAIN_SCENE_LIMITS, type TerrainSceneAsset, type TerrainSceneInput, type TerrainViewport } from '../../packages/render/src/terrain-scene.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function pack(raw: Uint8Array, codec: 'lzo' | 'lcw'): string {
  const chunks: Buffer[] = [];
  for (let at = 0; at < raw.length; at += 8192) {
    const block = raw.subarray(at, at + 8192), data: number[] = [];
    if (codec === 'lzo') {
      if (block.length <= 238) data.push(block.length + 17);
      else { data.push(0); let n = block.length - 18; while (n > 255) { data.push(0); n -= 255; } data.push(n); }
      data.push(...block, 17, 0, 0);
    } else {
      for (let i = 0; i < block.length;) { let end = i + 1; while (end < block.length && block[end] === block[i]) end++;
        const n = end - i; data.push(254, n & 255, n >> 8, block[i]!); i = end; }
      data.push(128);
    }
    const header = Buffer.alloc(4); header.writeUInt16LE(data.length); header.writeUInt16LE(block.length, 2); chunks.push(header, Buffer.from(data));
  }
  const text = Buffer.concat(chunks).toString('base64'), rows: string[] = [];
  for (let at = 0; at < text.length; at += 64) rows.push(`${at / 64 + 1}=${text.slice(at, at + 64)}`);
  return rows.join('\n') + '\n';
}
interface MapOptions { width?: number; height?: number; elevations?: readonly number[]; subtiles?: readonly number[]; overlay?: boolean }
function terrain(options: MapOptions = {}): ScenarioTerrain {
  const width = options.width ?? 2, height = options.height ?? 1, count = (2 * width - 1) * height;
  const iso = new Uint8Array(count * 11 + 4), view = new DataView(iso.buffer); let record = 0;
  for (let row = 0; row < height * 2; row++) for (let column = row % 2; column < width * 2 - 1; column += 2) {
    const x = (column + row + 2) / 2, y = (row - column + width * 2) / 2;
    view.setUint16(record * 11, x, true); view.setUint16(record * 11 + 2, y, true);
    view.setUint16(record * 11 + 4, record, true); iso[record * 11 + 8] = options.subtiles?.[record] ?? 0;
    iso[record * 11 + 9] = options.elevations?.[record] ?? 0; record++;
  }
  const overlay = new Uint8Array(262144).fill(255); if (options.overlay) overlay[511 + 512 * 511] = 3;
  const bytes = new TextEncoder().encode(`[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,${width},${height}\nLocalSize=0,0,${width},${height}\nTheater=URBAN\n` +
    '[IsoMapPack5]\n' + pack(iso, 'lzo') + '[OverlayPack]\n' + pack(overlay, 'lcw') + '[OverlayDataPack]\n' + pack(new Uint8Array(262144), 'lcw'));
  return compileScenarioTerrain({ profile: 'ra2', source: { id: 'synthetic-map', profile: 'ra2', sha256: hash(bytes) }, bytes });
}
interface Tile { color?: number; z?: number; extra?: { x: number; y: number; width: number; height: number; colors: number[]; z: number[] }; noZ?: boolean }
function asset(id: string, tiles: (Tile | null)[] = [{}], width = 60, gridWidth = tiles.length): TerrainSceneAsset {
  const height = width / 2, packed = width * height / 2, start = 16 + tiles.length * 4;
  const records = tiles.map((tile, ordinal) => {
    if (!tile) return null;
    const extra = tile.extra, extraSize = extra ? extra.width * extra.height : 0, extraOffset = 52 + packed * 2;
    const bytes = new Uint8Array(extraOffset + extraSize * 2), view = new DataView(bytes.buffer);
    view.setInt32(0, (ordinal % gridWidth - Math.floor(ordinal / gridWidth)) * width / 2, true);
    view.setInt32(4, (ordinal % gridWidth + Math.floor(ordinal / gridWidth)) * height / 2, true);
    view.setInt32(12, 52 + packed, true); view.setUint32(36, (tile.noZ ? 0 : 2) + (extra ? 1 : 0), true);
    bytes.fill(tile.color ?? 1, 52, 52 + packed); bytes.fill(tile.z ?? 0, 52 + packed, extraOffset);
    if (extra) { view.setInt32(8, extraOffset, true); view.setInt32(16, extraOffset + extraSize, true);
      view.setInt32(20, extra.x, true); view.setInt32(24, extra.y, true); view.setInt32(28, extra.width, true); view.setInt32(32, extra.height, true);
      assert.equal(extra.colors.length, extraSize); assert.equal(extra.z.length, extraSize); bytes.set(extra.colors, extraOffset); bytes.set(extra.z, extraOffset + extraSize); }
    return bytes;
  });
  const bytes = new Uint8Array(start + records.reduce((n, r) => n + (r?.length ?? 0), 0)), view = new DataView(bytes.buffer);
  view.setUint32(0, gridWidth, true); view.setUint32(4, tiles.length / gridWidth, true); view.setUint32(8, width, true); view.setUint32(12, height, true);
  let offset = start; records.forEach((r, i) => { if (r) { view.setUint32(16 + i * 4, offset, true); bytes.set(r, offset); offset += r.length; } });
  return { id, bytes, sha256: hash(bytes) };
}
function palette(): Uint8Array {
  const bytes = new Uint8Array(1024); for (let i = 0; i < 256; i++) bytes.set([i, 255 - i, (i * 73) % 256, 255], i * 4);
  bytes.set([220, 70, 60, 255], 4); bytes.set([65, 170, 90, 255], 8); bytes.set([70, 100, 220, 255], 12); return bytes;
}
function input(map = terrain(), assets = [asset('red', [{ color: 1 }]), asset('green', [{ color: 2 }]), asset('blue', [{ color: 3 }])]): TerrainSceneInput {
  return { terrain: map, assets, choices: map.cells.map((c, i) => ({ sourceRecord: c.sourceRecord, assetId: assets[i % assets.length]!.id, subtile: c.subtile })),
    palette: palette(), projection: { tileWidth: 60, tileHeight: 30, elevationStep: 15 } };
}
const view: TerrainViewport = { cameraX: 0, cameraY: 0, zoom: 1, width: 120, height: 45, backgroundRgba: [19, 23, 29, 255] };
function color(frame: ReturnType<ReturnType<typeof createTerrainScene>['render']>, x: number, y: number): number[] { return Array.from(frame.rgba.subarray((y * frame.viewport.width + x) * 4, (y * frame.viewport.width + x) * 4 + 4)); }

test('three original distinct-color diamonds render and pick from one mask, including opaque palette index zero', () => {
  const i = input(), scene = createTerrainScene(i), frame = scene.render(view);
  assert.deepEqual(scene.bounds, { x: 0, y: 0, width: 120, height: 45 });
  for (const [x, y, record] of [[30, 10, 0], [90, 10, 1], [60, 25, 2]]) {
    assert.equal(frame.pick(x!, y!)!.sourceRecord, record); assert.deepEqual(color(frame, x!, y!), Array.from(i.palette.subarray((record! + 1) * 4, (record! + 2) * 4)));
  }
  assert.equal(frame.pick(0, 0), null); assert.deepEqual(color(frame, 0, 0), [19, 23, 29, 255]);
  assert.equal(frame.pick(27, 0), null); assert.equal(frame.pick(28, 0)!.sourceRecord, 0); assert.equal(frame.pick(31, 0)!.sourceRecord, 0); assert.equal(frame.pick(32, 0), null);
  const zero = createTerrainScene(input(terrain(), [asset('zero', [{ color: 0 }])])).render(view);
  assert.equal(zero.pick(30, 10)!.sourceRecord, 0); assert.deepEqual(color(zero, 30, 10), [0, 255, 0, 255]); assert.equal(zero.pick(0, 0), null);
  assert.equal(scene.assets[0]!.verification, 'sha256-verified'); assert.equal(scene.source.verification, 'caller-provided');
  assert.equal(scene.nativeBehaviorVerified, false); assert.equal(frame.allocations.totalPixelBytes, 120 * 45 * 12);
  const small = input(terrain(), [asset('48px', [{}], 48)]);
  const smaller = createTerrainScene({ ...small, projection: { tileWidth: 48, tileHeight: 24, elevationStep: 12 } });
  assert.deepEqual(smaller.bounds, { x: 0, y: 0, width: 96, height: 36 }); assert.equal(smaller.render(view).pick(24, 10)!.sourceRecord, 0);
});
test('elevation shifts placement, per-pixel depth resolves overlap and equal depth has a stable source-record tie', () => {
  for (const [z, expected] of [[0, 2], [15, 0], [30, 0]] as const) {
    const i = input(terrain({ elevations: [0, 0, 1] }), [asset('red'), asset('green', [{ color: 2 }]), asset('blue', [{ color: 3, z }])]);
    const normal = createTerrainScene(i).render(view), reverse = createTerrainScene({ ...i,
      terrain: Object.freeze({ ...i.terrain, cells: Object.freeze([...i.terrain.cells].reverse()) }), assets: [...i.assets].reverse(), choices: [...i.choices].reverse() }).render(view);
    assert.equal(normal.pick(45, 10)!.sourceRecord, expected); assert.deepEqual(normal.rgba, reverse.rgba); assert.deepEqual(normal.pick(45, 10), reverse.pick(45, 10));
  }
  const raised = createTerrainScene(input(terrain({ elevations: [2, 0, 0] })));
  assert.equal(raised.bounds.y, -30); assert.equal(raised.render({ ...view, cameraY: -30 }).pick(30, 10)!.sourceRecord, 0);
  const perPixel = asset('blue', [{ color: 3 }]); perPixel.bytes[20 + 52 + 900 + 227] = 31; // Slot local (15,10); adjacent depth stays zero.
  const perPixelInput = input(terrain({ elevations: [0, 0, 1] }), [asset('red'), asset('green', [{ color: 2 }]), { ...perPixel, sha256: hash(perPixel.bytes) }]);
  const detailed = createTerrainScene(perPixelInput).render(view);
  assert.equal(detailed.pick(45, 10)!.sourceRecord, 0); assert.equal(detailed.pick(46, 10)!.sourceRecord, 2);
  perPixelInput.palette[3 * 4 + 3] = 0;
  assert.equal(createTerrainScene(perPixelInput).render(view).pick(46, 10)!.sourceRecord, 0); // A transparent nearer pixel reveals the farther cell.
});
test('extra planes use slot-relative origins, preserve zero holes and independently apply the bounded depth override', () => {
  const map = terrain({ subtiles: [0, 1, 0] });
  const extra = { x: -40, y: 15, width: 4, height: 1, colors: [4, 0, 5, 4], z: [0, 31, 32, 255] };
  const i = input(map, [asset('normal'), asset('extra', [{}, { color: 2, extra }]), asset('last', [{ color: 3 }])]); i.palette[5 * 4 + 3] = 0;
  const scene = createTerrainScene(i), frame = scene.render({ ...view, cameraX: -10 });
  assert.equal(scene.bounds.x, -10); assert.equal(frame.pick(0, 0)!.sourceRecord, 1); assert.equal(frame.pick(1, 0), null);
  assert.equal(frame.pick(2, 0), null); assert.equal(frame.pick(3, 0)!.sourceRecord, 1);
  assert.equal(frame.pick(3, 0)!.depth, 0); assert.ok(scene.diagnostics.some(d => d.code === 'extra-depth-outside-0-31-preserves-underlying-depth' && d.count === 2));
  // A transparent extra color retains the diamond color, but a valid extra depth still overrides its depth.
  const overlay = asset('overlay', [{ color: 0, z: 7, extra: { x: 28, y: 9, width: 4, height: 1, colors: [4, 0, 5, 0], z: [0, 31, 32, 255] } }]);
  const overlayInput = input(terrain(), [overlay]); overlayInput.palette[5 * 4 + 3] = 0;
  const drawn = createTerrainScene(overlayInput).render(view);
  assert.equal(drawn.pick(28, 9)!.depth, 9); assert.equal(drawn.pick(29, 9)!.depth, -22);
  assert.deepEqual(color(drawn, 29, 9), [0, 255, 0, 255]); assert.equal(drawn.pick(30, 9), null); assert.equal(drawn.pick(31, 9)!.depth, 2);
});
test('zoom, fractional pan, clipping and picking use the same pixel-center sampling at every boundary', () => {
  const scene = createTerrainScene(input(terrain({ elevations: [1, 0, 0] })));
  const baseline = scene.render({ ...view, cameraX: -30, cameraY: -30, width: 180, height: 120 });
  for (const zoom of [0.5, 1, 2, 4] as const) for (const camera of [[-7, -12], [12.25, -9.5], [300, 300]]) {
    const frame = scene.render({ ...view, zoom, cameraX: camera[0]!, cameraY: camera[1]!, width: 71, height: 53 });
    for (let y = 0; y < 53; y++) for (let x = 0; x < 71; x++) {
      const worldX = Math.floor(camera[0]! + (x + 0.5) / zoom), worldY = Math.floor(camera[1]! + (y + 0.5) / zoom);
      const expected = baseline.pick(worldX + 30, worldY + 30), actual = frame.pick(x + 0.9, y + 0.9);
      assert.equal(actual?.sourceRecord ?? null, expected?.sourceRecord ?? null);
      if (actual) { assert.equal(actual.worldX, worldX); assert.equal(actual.worldY, worldY); assert.deepEqual(color(frame, x, y), color(baseline, worldX + 30, worldY + 30)); }
    }
    for (const [x, y] of [[-0.01, 0], [0, -0.01], [71, 0], [0, 53], [NaN, 0], [0, Infinity]]) assert.equal(frame.pick(x!, y!), null);
  }
});
test('construction snapshots mutable assets, palette and choices; returned colors cannot mutate private picking', () => {
  const i = input(), scene = createTerrainScene(i), frame = scene.render(view), before = new Uint8Array(frame.rgba), pick = frame.pick(30, 10);
  for (const a of i.assets) a.bytes.fill(0); i.palette.fill(0);
  (i.choices[0] as { assetId: string }).assetId = 'changed'; (i.projection as { elevationStep: number }).elevationStep = 200;
  frame.rgba.fill(0); assert.deepEqual(frame.pick(30, 10), pick); assert.deepEqual(scene.render(view).rgba, before);
  assert.ok(Object.isFrozen(scene)); assert.ok(Object.isFrozen(scene.assets)); assert.ok(Object.isFrozen(scene.assets[0])); assert.ok(Object.isFrozen(frame.viewport.backgroundRgba));
  assert.throws(() => { (scene.bounds as { x: number }).x = 100; }, TypeError);
  const mismatch = input(); mismatch.assets[0]!.bytes[100] = mismatch.assets[0]!.bytes[100]! ^ 1; assert.throws(() => createTerrainScene(mismatch), /scene-source-identity/);
});
test('missing/duplicate choices, mismatched or absent slots, unused assets and structural metadata fail without blank fallback', () => {
  const i = input();
  assert.throws(() => createTerrainScene({ ...i, choices: i.choices.slice(1) }), /scene-choice-count/);
  assert.throws(() => createTerrainScene({ ...i, choices: [i.choices[0]!, i.choices[0]!, i.choices[2]!] }), /scene-duplicate-choice/);
  assert.throws(() => createTerrainScene({ ...i, choices: i.choices.map(c => ({ ...c, assetId: 'missing' })) }), /scene-missing-asset/);
  assert.throws(() => createTerrainScene({ ...i, choices: i.choices.map(c => ({ ...c, subtile: 1 })) }), /scene-choice-subtile/);
  assert.throws(() => createTerrainScene(input(terrain(), [asset('absent', [null])])), /scene-missing-slot/);
  assert.throws(() => createTerrainScene(input(terrain(), [asset('no-z', [{ noZ: true }])])), /scene-unsupported-no-z/);
  assert.throws(() => createTerrainScene({ ...i, assets: [...i.assets, asset('unused')] }), /scene-unused-asset/);
  assert.throws(() => createTerrainScene({ ...i, assets: [i.assets[0]!, i.assets[0]!, i.assets[2]!] }), /scene-duplicate-asset/);
  assert.throws(() => createTerrainScene({ ...i, terrain: { ...i.terrain } }), /scene-terrain/);
  const changed = Object.freeze({ ...i.terrain, cells: Object.freeze(i.terrain.cells.map((c, n) => n ? c : Object.freeze({ ...c, projectedColumn: 99 }))) });
  assert.throws(() => createTerrainScene({ ...i, terrain: changed }), /scene-terrain-cell/);
  assert.throws(() => createTerrainScene(input(terrain(), [asset('wrong-size', [{}], 48)])), /scene-asset-dimensions/);
  const partial = input(); partial.palette[3] = 128; assert.throws(() => createTerrainScene(partial), /scene-palette-alpha/);
});
test('source, index, decoded, viewport and work budgets apply to aggregate attempted allocations and cannot be raised', () => {
  const i = input(), sourceBytes = i.assets.reduce((n, a) => n + a.bytes.length, 0), decodedBytes = 3 * 60 * 30 * 3;
  for (const lower of [{ sourceBytes: sourceBytes - 1 }, { indexSlots: 2 }, { decodeIndexVisits: 2 }, { decodedBytes: decodedBytes - 1 }, { assets: 2 }, { cells: 2 }]) assert.throws(() => createTerrainScene(i, lower));
  const exact = createTerrainScene(i, { sourceBytes, indexSlots: 3, decodedBytes }); assert.equal(exact.allocations.decodedPlaneBytes, decodedBytes);
  const repeated = createTerrainScene(input(terrain(), [asset('same')])); assert.equal(repeated.allocations.decodedSlots, 1); assert.equal(repeated.allocations.decodedPlaneBytes, 5400);
  const full = exact.render(view); const limited = createTerrainScene(i, { samples: full.allocations.samples - 1 });
  assert.throws(() => limited.render(view), /scene-sample-budget/); assert.doesNotThrow(() => limited.render({ ...view, cameraX: 500 }));
  assert.throws(() => createTerrainScene(i, { viewportPixels: 10 }).render(view), /scene-viewport-limit/);
  assert.throws(() => exact.render({ ...view, width: 2049 }), /scene-viewport-limit/);
  for (const lower of [{ sourceBytes: TERRAIN_SCENE_LIMITS.sourceBytes + 1 }, { samples: NaN }, { arbitrary: 1 }]) assert.throws(() => createTerrainScene(i, lower));
  assert.throws(() => createTerrainScene(i, { coordinate: 10 }), /scene-coordinate-limit/);
  const extra = asset('large', [{ extra: { x: 0, y: 0, width: 3, height: 2, colors: [1, 1, 1, 1, 1, 1], z: [0, 0, 0, 0, 0, 0] } }]);
  assert.throws(() => createTerrainScene(input(terrain(), [extra]), { decodedBytes: 5411 }), /scene-decoded-budget/);
  assert.equal(createTerrainScene(input(terrain(), [extra]), { decodedBytes: 5412 }).allocations.decodedPlaneBytes, 5412);
});
test('sparse/accessor input, shadowed byte metadata and shared/resizable memory do not bypass bounded snapshots', () => {
  const i = input(), sparse = [...i.choices]; delete sparse[1];
  assert.throws(() => createTerrainScene({ ...i, choices: sparse }), /scene-array/);
  const accessor = { ...i.assets[0] }; Object.defineProperty(accessor, 'bytes', { get() { throw Error('should not read'); } });
  assert.throws(() => createTerrainScene({ ...i, assets: [accessor as TerrainSceneAsset, ...i.assets.slice(1)] }), /scene-fields/);
  const extraKey = [...i.choices]; Object.assign(extraKey, { payload: new Uint8Array(1) }); assert.throws(() => createTerrainScene({ ...i, choices: extraKey }), /scene-array/);
  const customPrototype = [...i.choices]; Object.setPrototypeOf(customPrototype, Object.create(Array.prototype, { [Symbol.iterator]: { value() { throw Error('must not iterate'); } } }));
  assert.throws(() => createTerrainScene({ ...i, choices: customPrototype }), /scene-array/);
  const tooLarge = new Uint8Array(16 * 1024 * 1024 + 1); Object.defineProperty(tooLarge, 'byteLength', { value: 16 });
  assert.throws(() => createTerrainScene({ ...i, assets: [{ ...i.assets[0]!, bytes: tooLarge }, ...i.assets.slice(1)] }), /scene-byte-limit/);
  assert.throws(() => createTerrainScene({ ...i, palette: new Uint8Array(new SharedArrayBuffer(1024)) }), /scene-byte-limit/);
  const resizable = Reflect.construct(ArrayBuffer, [1024, { maxByteLength: 2048 }]) as ArrayBuffer;
  assert.throws(() => createTerrainScene({ ...i, palette: new Uint8Array(resizable) }), /scene-byte-limit/);
});
test('unsupported terrain layers are counted explicitly and do not become fabricated terrain pixels', () => {
  const scene = createTerrainScene(input(terrain({ overlay: true })));
  assert.ok(scene.diagnostics.some(d => d.code === 'overlays-not-rendered' && d.count === 1));
  assert.ok(scene.diagnostics.some(d => d.code === 'native-composition-unverified')); assert.equal(scene.render(view).pick(0, 0), null);
});
