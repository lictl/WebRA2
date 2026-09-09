// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature SHP/TMP/map fixtures and policies; no retail assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { createTerrainScene, type TerrainSceneInput, type TerrainViewport } from '../../packages/render/src/terrain-scene.ts';
import { createSpriteAtlas, SPRITE_LAYER_LIMITS, type SpriteAtlasInput, type SpriteBatch, type SpriteObject, type SpritePalette } from '../../packages/render/src/sprite-layer.ts';

const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
interface Row { width: number; height: number; x?: number; y?: number; pixels?: number[]; share?: number }
function source(rows: Row[] = [{ width: 4, height: 4, pixels: new Array<number>(16).fill(2) }], canvas = 8) {
  const table = 8 + rows.length * 24, bytes = new Uint8Array(table + rows.reduce((n, r) => n + (r.pixels?.length ?? 0), 0));
  const v = new DataView(bytes.buffer); v.setUint16(2, canvas, true); v.setUint16(4, canvas, true); v.setUint16(6, rows.length, true);
  let at = table; const offsets: number[] = [];
  rows.forEach((row, ordinal) => {
    const h = 8 + ordinal * 24; v.setUint16(h, row.x ?? 0, true); v.setUint16(h + 2, row.y ?? 0, true);
    v.setUint16(h + 4, row.width, true); v.setUint16(h + 6, row.height, true);
    const offset = row.share === undefined ? row.pixels ? at : 0 : offsets[row.share]!; offsets.push(offset); v.setUint32(h + 20, offset, true);
    if (row.pixels) { bytes.set(row.pixels, at); at += row.pixels.length; }
  });
  return { id: 'source', sha256: hash(bytes), bytes };
}
function atlasInput(asset: SpriteAtlasInput['assets'][number] = source()): SpriteAtlasInput { return { assets: [asset], frames: [{ id: 'frame', assetId: asset.id, frame: 0 }] }; }
function palette(): SpritePalette {
  const rgba = new Uint8Array(1024); for (let i = 0; i < 256; i++) rgba.set([i, 255 - i, (i * 73) % 256, 255], i * 4);
  return { id: 'palette', rgba, remap: null, transparentIndex: 0 };
}
function object(changes: Partial<SpriteObject> = {}): SpriteObject {
  return { id: 'object', frameId: 'frame', paletteId: 'palette', x: 28, y: 10, anchorX: 0, anchorY: 0,
    depth: { base: 100, rowStep: 0, terrainTie: 'front' }, ...changes };
}
function batch(objects = [object()], input = atlasInput()): SpriteBatch { return { atlas: createSpriteAtlas(input), palettes: objects.length ? [palette()] : [], objects }; }
function packed(raw: Uint8Array, lzo: boolean): string {
  const data: number[] = [];
  if (lzo) data.push(raw.length + 17, ...raw, 17, 0, 0);
  else {
    for (let at = 0; at < raw.length;) { const length = Math.min(65535, raw.length - at); data.push(254, length & 255, length >> 8, raw[at]!); at += length; }
    data.push(128);
  }
  const bytes = Buffer.alloc(4 + data.length); bytes.writeUInt16LE(data.length); bytes.writeUInt16LE(lzo ? raw.length : 8192, 2);
  // Each LCW chunk is separately framed to keep map-pack's 8192 output bound.
  if (!lzo && raw.length > 8192) {
    const chunks: Buffer[] = [];
    for (let at = 0; at < raw.length; at += 8192) chunks.push(Buffer.from(packed(raw.subarray(at, at + 8192), false), 'base64'));
    return Buffer.concat(chunks).toString('base64');
  }
  bytes.writeUInt16LE(raw.length, 2); bytes.set(data, 4); return bytes.toString('base64');
}
function terrainInput(elevation = 0): TerrainSceneInput {
  const iso = new Uint8Array(15), iv = new DataView(iso.buffer); iv.setUint16(0, 1, true); iv.setUint16(2, 1, true); iso[9] = elevation;
  const bytes = new TextEncoder().encode('[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,1,1\nLocalSize=0,0,1,1\nTheater=URBAN\n[IsoMapPack5]\n1=' + packed(iso, true) +
    '\n[OverlayPack]\n1=' + packed(new Uint8Array(262144).fill(255), false) + '\n[OverlayDataPack]\n1=' + packed(new Uint8Array(262144), false));
  const terrain = compileScenarioTerrain({ profile: 'ra2', source: { id: 'original-map', profile: 'ra2', sha256: hash(bytes) }, bytes });
  const tmp = new Uint8Array(20 + 52 + 1800), tv = new DataView(tmp.buffer);
  tv.setUint32(0, 1, true); tv.setUint32(4, 1, true); tv.setUint32(8, 60, true); tv.setUint32(12, 30, true); tv.setUint32(16, 20, true);
  tv.setUint32(20 + 12, 952, true); tv.setUint32(20 + 36, 2, true); tmp.fill(1, 72, 972);
  return { terrain, assets: [{ id: 'tile', sha256: hash(tmp), bytes: tmp }], choices: [{ sourceRecord: 0, assetId: 'tile', subtile: 0 }],
    palette: palette().rgba, projection: { tileWidth: 60, tileHeight: 30, elevationStep: 15 } };
}
const view: TerrainViewport = { cameraX: 0, cameraY: 0, zoom: 1, width: 60, height: 30, backgroundRgba: [0, 0, 0, 255] };
function color(frame: { rgba: Uint8Array; viewport: TerrainViewport }, x: number, y: number): number[] { return [...frame.rgba.subarray((y * frame.viewport.width + x) * 4, (y * frame.viewport.width + x) * 4 + 4)]; }

test('explicit source/frame IDs and canvas offsets place owned SHP rectangles and pick their canvas coordinates', () => {
  const asset = source([{ width: 2, height: 2, x: 3, y: 4, pixels: [2, 3, 4, 5] }]), atlas = createSpriteAtlas(atlasInput(asset));
  const scene = createTerrainScene(terrainInput()), rendered = scene.renderSprites(view, { atlas, palettes: [palette()], objects: [object({ x: 30, y: 10, anchorX: 5, anchorY: 5 })] });
  assert.deepEqual(color(rendered, 28, 9), [2, 253, 146, 255]);
  assert.deepEqual(rendered.pick(28, 9), { kind: 'object', id: 'object', frameId: 'frame', assetId: 'source', frame: 0, paletteId: 'palette', canvasX: 3, canvasY: 4, worldX: 28, worldY: 9, depth: 100 });
  assert.equal(rendered.pick(27, 9)?.kind, 'terrain'); assert.equal(atlas.assets[0]!.verification, 'sha256-verified');
  assert.equal(atlas.frames[0]!.canvasWidth, 8); assert.equal(atlas.allocations.decodedPixelBytes, 4); assert.equal(atlas.nativeBehaviorVerified, false);
});
test('constant/ramped sprite depth and explicit terrain ties compose with per-pixel terrain and elevation', () => {
  const scene = createTerrainScene(terrainInput());
  for (const tie of ['front', 'behind'] as const) {
    const f = scene.renderSprites(view, batch([object({ depth: { base: 11, rowStep: 0, terrainTie: tie } })]));
    assert.equal(f.pick(28, 10)?.kind, 'object'); assert.equal(f.pick(28, 12)?.kind, 'terrain'); assert.equal(f.pick(28, 11)?.kind, tie === 'front' ? 'object' : 'terrain');
  }
  const ramp = scene.renderSprites(view, batch([object({ depth: { base: 10, rowStep: 1, terrainTie: 'front' } })]));
  for (let y = 10; y < 14; y++) { assert.equal(ramp.pick(28, y)?.kind, 'object'); assert.equal(ramp.pick(28, y)?.depth, y); }
  const raised = createTerrainScene(terrainInput(1)).renderSprites({ ...view, cameraY: -15 }, batch([object({ y: -5, depth: { base: 9, rowStep: 1, terrainTie: 'front' } })]));
  assert.equal(raised.pick(28, 10)?.kind, 'terrain');
});
test('object equality ties use stable ASCII IDs, independent of placement/palette enumeration', () => {
  const scene = createTerrainScene(terrainInput()), a = object({ id: 'A' }), b = object({ id: 'b', paletteId: 'second' });
  const first = palette(), second = { ...palette(), id: 'second' }; second.rgba[8] = 99;
  const input = { ...batch(), objects: [b, a], palettes: [second, first] }, x = scene.renderSprites(view, input), y = scene.renderSprites(view, { ...input, objects: [a, b], palettes: [first, second] });
  assert.deepEqual(x.rgba, y.rgba); assert.deepEqual(x.pick(28, 10), y.pick(28, 10)); assert.equal((x.pick(28, 10) as { id: string }).id, 'A');
});
test('original-index transparency precedes explicit remap; remapped alpha-zero writes no color, depth or owner', () => {
  const scene = createTerrainScene(terrainInput()), input = batch([object()], atlasInput(source([{ width: 4, height: 1, pixels: [0, 2, 3, 4] }])));
  const p = palette(), remap = Uint8Array.from({ length: 256 }, (_, i) => i); remap[0] = 2; remap[2] = 8; remap[3] = 9; p.rgba[9 * 4 + 3] = 0;
  const f = scene.renderSprites(view, { ...input, palettes: [{ ...p, remap }] });
  assert.equal(f.pick(28, 10)?.kind, 'terrain'); assert.deepEqual(color(f, 29, 10), [8, 247, 72, 255]); assert.equal(f.pick(30, 10)?.kind, 'terrain'); assert.equal(f.pick(30, 10)?.depth, 10);
  const opaqueZero = scene.renderSprites(view, { ...input, palettes: [{ ...p, remap, transparentIndex: null }] }); assert.equal(opaqueZero.pick(28, 10)?.kind, 'object');
  const farther = object({ id: 'farther', paletteId: 'far-palette', x: 30, depth: { base: 50, rowStep: 0, terrainTie: 'front' } });
  const layers = scene.renderSprites(view, { ...input, objects: [object(), farther], palettes: [{ ...p, remap }, { ...palette(), id: 'far-palette', transparentIndex: null }] });
  assert.equal((layers.pick(30, 10) as { id: string }).id, 'farther'); assert.equal(layers.pick(30, 10)?.depth, 50); // Near remapped alpha-zero retains the farther owner and depth.
  assert.equal(layers.pick(31, 10)?.kind, 'object');
});
test('all zooms, negative/fractional cameras, clipping and pick boundaries agree with an independent sample oracle', () => {
  const scene = createTerrainScene(terrainInput()), sprite = object({ x: -2, y: -1 }), input = batch([sprite], atlasInput(source([{ width: 4, height: 3, pixels: [2, 0, 3, 4, 0, 4, 5, 6, 7, 8, 0, 9] }])));
  const raw = [2, 0, 3, 4, 0, 4, 5, 6, 7, 8, 0, 9];
  for (const zoom of [0.5, 1, 2, 4] as const) for (const [cameraX, cameraY] of [[-4.25, -3.5], [0, 0], [100, 100]]) {
    const v = { ...view, width: 17, height: 11, cameraX: cameraX!, cameraY: cameraY!, zoom }, f = scene.renderSprites(v, input), base = scene.render(v);
    for (let y = 0; y < v.height; y++) for (let x = 0; x < v.width; x++) {
      const wx = Math.floor(v.cameraX + (x + .5) / zoom), wy = Math.floor(v.cameraY + (y + .5) / zoom), sx = wx + 2, sy = wy + 1;
      const index = sx >= 0 && sx < 4 && sy >= 0 && sy < 3 ? raw[sy * 4 + sx]! : 0;
      assert.deepEqual(color(f, x, y), index ? [...input.palettes[0]!.rgba.subarray(index * 4, index * 4 + 4)] : color(base, x, y));
      if (index) { const pick = f.pick(x + .9, y + .9)!; assert.equal(pick.kind, 'object'); assert.equal(pick.worldX, wx); assert.equal(pick.worldY, wy); }
    }
    for (const [x, y] of [[-1, 0], [0, -1], [17, 0], [0, 11], [NaN, 0], [0, Infinity]]) assert.equal(f.pick(x!, y!), null);
  }
});
test('mutable source, palette/remap, placements and returned RGBA cannot alter captured atlas or frame picking', () => {
  const asset = source(), raw = atlasInput(asset), atlas = createSpriteAtlas(raw), scene = createTerrainScene(terrainInput()); asset.bytes.fill(0);
  const p = palette(), remap = Uint8Array.from({ length: 256 }, (_, i) => i), o = object(), input = { atlas, palettes: [{ ...p, remap }], objects: [o] };
  const f = scene.renderSprites(view, input), before = f.rgba.slice(), picked = f.pick(28, 10);
  p.rgba.fill(0); remap.fill(0); (o.depth as { base: number }).base = -100; (o as { id: string }).id = 'changed'; (raw.frames[0] as { frame: number }).frame = 1;
  f.rgba.fill(0); assert.deepEqual(f.pick(28, 10), picked);
  assert.deepEqual(scene.renderSprites(view, { atlas, palettes: [palette()], objects: [object()] }).rgba, before);
  assert.ok(Object.isFrozen(atlas.frames[0]!.rectangle)); assert.throws(() => { (atlas.frames[0] as { id: string }).id = 'changed'; }, TypeError);
});
test('empty selected frames are distinct from opaque-zero rectangles and preserve terrain-only output', () => {
  const asset = source([{ width: 0, height: 0 }, { width: 1, height: 1, pixels: [0] }]);
  const atlas = createSpriteAtlas({ assets: [asset], frames: [{ id: 'empty', assetId: asset.id, frame: 0 }, { id: 'zero', assetId: asset.id, frame: 1 }] });
  const scene = createTerrainScene(terrainInput()), baseline = scene.render(view), f = scene.renderSprites(view, { atlas, palettes: [palette()], objects: [object({ frameId: 'empty' })] });
  assert.deepEqual(f.rgba, baseline.rgba); assert.equal(f.allocations.spriteSamples, 0); assert.equal(f.allocations.totalPixelBytes, view.width * view.height * 16);
  const noObjects = scene.renderSprites(view, { atlas: createSpriteAtlas({ assets: [], frames: [] }), palettes: [], objects: [] }); assert.deepEqual(noObjects.rgba, baseline.rgba);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 60; x++) { const p = baseline.pick(x, y); assert.deepEqual(noObjects.pick(x, y), p ? { kind: 'terrain', ...p } : null); }
  const zero = scene.renderSprites(view, { atlas, palettes: [{ ...palette(), transparentIndex: null }], objects: [object({ frameId: 'zero' })] }); assert.equal(zero.pick(28, 10)?.kind, 'object');
  const again = scene.render(view); assert.deepEqual(again.rgba, baseline.rgba); assert.deepEqual(again.allocations, baseline.allocations); assert.deepEqual(again.pick(28, 10), baseline.pick(28, 10));
});
test('duplicate/missing IDs and frame identities fail instead of choosing an asset or owner', () => {
  const a = atlasInput(), f = a.frames[0]!;
  assert.throws(() => createSpriteAtlas({ ...a, assets: [...a.assets, ...a.assets] }), /sprite-duplicate-asset/);
  assert.throws(() => createSpriteAtlas({ ...a, frames: [f, f] }), /sprite-duplicate-frame/);
  assert.throws(() => createSpriteAtlas({ ...a, frames: [f, { ...f, id: 'alias' }] }), /sprite-duplicate-selection/);
  assert.throws(() => createSpriteAtlas({ ...a, frames: [{ ...f, assetId: 'missing' }] }), /sprite-missing-asset/);
  assert.throws(() => createSpriteAtlas({ ...a, frames: [{ ...f, frame: 1 }] }), /sprite-missing-frame/);
  assert.throws(() => createSpriteAtlas({ ...a, frames: [] }), /sprite-unused-asset/);
  const scene = createTerrainScene(terrainInput()), b = batch();
  assert.throws(() => scene.renderSprites(view, { ...b, atlas: { ...b.atlas } }), /sprite-atlas/);
  assert.throws(() => scene.renderSprites(view, { ...b, objects: [object(), object()] }), /sprite-duplicate-object/);
  assert.throws(() => scene.renderSprites(view, { ...b, palettes: [palette(), palette()] }), /sprite-duplicate-palette/);
  assert.throws(() => scene.renderSprites(view, { ...b, objects: [object({ frameId: 'missing' })] }), /sprite-missing-reference/);
  assert.throws(() => scene.renderSprites(view, { ...b, palettes: [palette(), { ...palette(), id: 'unused' }] }), /sprite-unused-palette/);
});
test('source/hash, selected/aliased encoded work and decoded allocation limits are checked before selected payload decoding', () => {
  const a = atlasInput(), total = a.assets[0]!.bytes.length;
  for (const cap of [{ assets: 0 }, { frames: 0 }, { sourceBytes: total - 1 }, { indexFrames: 0 }, { decodedBytes: 15 }, { encodedBytes: 15 }]) assert.throws(() => createSpriteAtlas(a, cap), /sprite-/);
  assert.equal(createSpriteAtlas(a, { sourceBytes: total, decodedBytes: 16, encodedBytes: 16, indexFrames: 1 }).allocations.decodedPixelBytes, 16);
  const changed = { ...a.assets[0]!, sha256: '0'.repeat(64) }; assert.throws(() => createSpriteAtlas(atlasInput(changed)), /sprite-source-identity/);
  const shared = source([{ width: 4, height: 1, pixels: [1, 2, 3, 4] }, { width: 4, height: 1, share: 0, y: 2 }]);
  const selected = { assets: [shared], frames: [{ id: 'a', assetId: 'source', frame: 0 }, { id: 'b', assetId: 'source', frame: 1 }] };
  assert.throws(() => createSpriteAtlas(selected, { encodedBytes: 7 }), /sprite-encoded-budget/); assert.equal(createSpriteAtlas(selected).allocations.encodedFrameBytes, 8);
  // Indexing accepts this truncated raw rectangle; aggregate pixel budget must fail before the decoder does.
  const truncated = source([{ width: 8, height: 8, pixels: [1] }]); assert.throws(() => createSpriteAtlas(atlasInput(truncated), { decodedBytes: 63 }), /sprite-decoded-budget/);
  assert.throws(() => createSpriteAtlas(atlasInput(truncated)), /shp-truncated-raw/);
  for (const cap of [{ frames: SPRITE_LAYER_LIMITS.frames + 1 }, { encodedBytes: -0 }, { objects: NaN }, { unrelated: 1 }]) assert.throws(() => createSpriteAtlas(a, cap), /sprite-limit/);
});
test('batch count, coordinate/depth, alpha and combined terrain/sprite work limits fail before painting', () => {
  const t = terrainInput(), b = batch(), scene = createTerrainScene(t), base = scene.render(view), samples = base.allocations.samples;
  const limited = createTerrainScene(t, { samples: samples + 15 }); assert.throws(() => limited.renderSprites(view, b), /scene-sample-budget/);
  assert.doesNotThrow(() => createTerrainScene(t, { samples: samples + 16 }).renderSprites(view, b));
  assert.doesNotThrow(() => limited.renderSprites(view, { ...b, objects: [object({ x: 100 })] }));
  for (const cap of [{ objects: 0 }, { palettes: 0 }]) assert.throws(() => scene.renderSprites(view, { ...b, atlas: createSpriteAtlas(atlasInput(), cap) }), /sprite-array/);
  for (const o of [object({ x: NaN }), object({ anchorY: Infinity }), object({ x: 1048576 }), object({ depth: { base: 1048576, rowStep: 1, terrainTie: 'front' } })]) assert.throws(() => scene.renderSprites(view, { ...b, objects: [o] }), /sprite-(coordinate|depth)-limit/);
  const p = palette(); p.rgba[3] = 128; assert.throws(() => scene.renderSprites(view, { ...b, palettes: [p] }), /sprite-palette-alpha/);
  assert.equal(scene.renderSprites(view, b).allocations.samples, samples + 16);
});
test('sparse/getter inputs, forged typed-array lengths and shared/resizable bytes cannot bypass ownership or caps', () => {
  const a = atlasInput(), sparse = [...a.frames]; delete sparse[0]; assert.throws(() => createSpriteAtlas({ ...a, frames: sparse }), /sprite-array/);
  const access = { ...a.assets[0] }; Object.defineProperty(access, 'bytes', { get() { throw Error('must not call'); } });
  assert.throws(() => createSpriteAtlas({ ...a, assets: [access as typeof a.assets[number]] }), /sprite-fields/);
  const huge = new Uint8Array(16 * 1024 * 1024 + 1); Object.defineProperty(huge, 'byteLength', { value: 8 }); assert.throws(() => createSpriteAtlas(atlasInput({ ...a.assets[0]!, bytes: huge })), /sprite-byte-limit/);
  const scene = createTerrainScene(terrainInput()), b = batch();
  for (const rgba of [new Uint8Array(new SharedArrayBuffer(1024)), new Uint8Array(Reflect.construct(ArrayBuffer, [1024, { maxByteLength: 2048 }]) as ArrayBuffer)]) assert.throws(() => scene.renderSprites(view, { ...b, palettes: [{ ...palette(), rgba }] }), /sprite-byte-limit/);
  const objects = [...b.objects]; Object.assign(objects, { payload: new Uint8Array(1) }); assert.throws(() => scene.renderSprites(view, { ...b, objects }), /sprite-array/);
});
