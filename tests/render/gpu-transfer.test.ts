// SPDX-License-Identifier: GPL-3.0-or-later
// Original structured-clone/CPU equivalence and hostile packet tests. No GPU or retail source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrainScene } from '../../packages/render/src/terrain-scene.ts';
import { createSpriteAtlas, type SpriteObject } from '../../packages/render/src/sprite-layer.ts';
import { compileGpuScene, copyGpuSceneData, copyGpuFrameData, prepareGpuFrame, exportGpuScene, importGpuScene,
  validateGpuSceneTransfer, captureGpuSpriteObjects } from '../../packages/render/src/gpu-scene.ts';
import { createGpuPicker } from '../../packages/render/src/gpu-picking.ts';
import { GPU_TRANSFER_LIMITS, type GpuFrame, type GpuSceneTransfer, type GpuTransferLimits } from '../../packages/render/src/gpu-contracts.ts';
import { gpuOracleCases, makeOriginalTerrain, makeOriginalSprites, originalObject, originalViewport } from './gpu-fixtures.ts';
function framePacket(frame: GpuFrame) {
  const { viewport, sampleX, sampleY, draws, terrainDraws } = copyGpuFrameData(frame); return { viewport, sampleX, sampleY, draws, terrainDraws, allocations: frame.allocations };
}
function simple() {
  const source = createTerrainScene(makeOriginalTerrain()), sprites = makeOriginalSprites();
  const scene = compileGpuScene(source, sprites.batch); return { source, sprites, scene, packet: exportGpuScene(scene) };
}
type Mutable = any; // Original hostile mutations intentionally bypass the public readonly types.
for (const fixture of gpuOracleCases()) test(`resident structured-clone roundtrip preserves every CPU pick and GPU draw: ${fixture.id}`, () => {
  const cpu = createTerrainScene(fixture.terrainInput), scene = compileGpuScene(cpu, fixture.batch ?? undefined), packet = exportGpuScene(scene);
  const cloned = structuredClone(packet, { transfer: packet.rasters.flatMap(r => [r.rgba.buffer as ArrayBuffer, r.depth.buffer as ArrayBuffer]) });
  const imported = importGpuScene(cloned), picker = createGpuPicker(imported);
  assert.notEqual(imported, scene); assert.deepEqual(imported.allocations, scene.allocations);
  assert.deepEqual(copyGpuSceneData(imported).rasters, copyGpuSceneData(scene).rasters);
  for (const view of fixture.viewports) {
    const local = prepareGpuFrame(scene, view), remote = prepareGpuFrame(imported, view);
    assert.deepEqual(framePacket(remote), framePacket(local));
    const expected = fixture.batch ? cpu.renderSprites(view, fixture.batch) : cpu.render(view);
    for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) {
      const p = expected.pick(x, y), normalized = p && !('kind' in p) ? { kind: 'terrain', ...p } : p;
      assert.deepEqual(picker.pick(remote, x, y), normalized, `${fixture.id} ${x},${y}`);
    }
  }
  assert.deepEqual(exportGpuScene(imported), cloned); picker.dispose();
});

test('dynamic move/drop/add/zoom updates use the same canonical resource policy and retain old frames', () => {
  const { source, scene, sprites, packet } = simple(), imported = importGpuScene(structuredClone(packet)), picker = createGpuPicker(imported);
  const view = originalViewport(), old = prepareGpuFrame(imported, view), oldPick = picker.pick(old, 28, 10);
  const states: readonly SpriteObject[][] = [[], [originalObject({ id: 'moved', x: 21, y: 4 })],
    [originalObject({ id: 'z', depth: { base: 31, rowStep: 0, terrainTie: 'behind' } }), originalObject({ id: 'A', depth: { base: 31, rowStep: 0, terrainTie: 'front' } })]];
  for (const objects of states) for (const zoom of [0.5, 1, 2, 4] as const) {
    const v = originalViewport({ zoom, cameraX: -2.25, cameraY: -1.125 }), remote = prepareGpuFrame(imported, v, objects);
    assert.deepEqual(framePacket(remote), framePacket(prepareGpuFrame(scene, v, objects)));
    const cpu = source.renderSprites(v, { ...sprites.batch, objects, palettes: sprites.batch.palettes.filter(p => objects.some(o => o.paletteId === p.id)) });
    for (let y = 0; y < v.height; y++) for (let x = 0; x < v.width; x++) assert.deepEqual(picker.pick(remote, x, y), cpu.pick(x, y));
  }
  assert.deepEqual(picker.pick(old, 28, 10), oldPick);
  assert.throws(() => picker.pick(prepareGpuFrame(scene, view), 0, 0), /gpu-picker-frame-scene/);
  assert.throws(() => prepareGpuFrame(imported, view, [originalObject({ frameId: 'unprepared' })]), /gpu-unprepared-sprite-resource/);
});

test('exports detach independently, imports own all pixels, and validation returns captured metadata with explicitly borrowed planes', () => {
  const { scene, packet } = simple(), view = originalViewport(), original = framePacket(prepareGpuFrame(scene, view));
  const validated = validateGpuSceneTransfer(packet), imported = importGpuScene(validated), importedBefore = copyGpuSceneData(imported).rasters;
  assert.ok(Object.isFrozen(validated)); assert.ok(Object.isFrozen(validated.terrain[0]));
  packet.rasters[0]!.rgba.fill(0); packet.rasters[0]!.depth.fill(0);
  assert.equal(validated.rasters[0]!.rgba.every(x => x === 0), true, 'validation intentionally borrows the buffer');
  assert.deepEqual(copyGpuSceneData(imported).rasters, importedBefore);
  assert.deepEqual(framePacket(prepareGpuFrame(scene, view)), original);
  const again = exportGpuScene(scene); assert.notEqual(again.rasters[0]!.rgba.buffer, exportGpuScene(scene).rasters[0]!.rgba.buffer);
  const snapshot = copyGpuSceneData(imported); snapshot.rasters[0]!.rgba.fill(5); assert.deepEqual(copyGpuSceneData(imported).rasters, importedBefore);
});

test('descriptor capture does not reread changing top-level, row, object, limit or typed-array properties', () => {
  const { packet } = simple(); let gets = 0;
  const shadow = new Proxy(packet, { get() { gets++; throw Error('unexpected top-level get'); } });
  const validated = validateGpuSceneTransfer(shadow); assert.equal(gets, 0); assert.deepEqual(validated, packet);
  const modified = structuredClone(packet) as Mutable;
  modified.terrain[0] = new Proxy(modified.terrain[0], { get() { gets++; return -1; } });
  modified.objects[0] = new Proxy(modified.objects[0], { get() { gets++; return null; } });
  for (const r of modified.rasters) for (const value of [r.rgba, r.depth]) {
    Object.defineProperty(value, 'length', { value: 0 }); Object.defineProperty(value, 'byteLength', { value: 0 });
    Object.defineProperty(value, 'buffer', { value: new SharedArrayBuffer(0) });
    Object.defineProperty(value, Symbol.iterator, { value() { throw Error('unexpected iterator'); } });
  }
  const result = validateGpuSceneTransfer(modified, new Proxy({}, { get() { gets++; return -1; } }));
  assert.deepEqual(result, packet); assert.equal(gets, 0);
  assert.deepEqual(exportGpuScene(importGpuScene(result)), packet);
  const bad = structuredClone(packet) as Mutable; Object.defineProperty(bad.objects[0], 'x', { get() { gets++; return 1; }, enumerable: true });
  assert.throws(() => validateGpuSceneTransfer(bad), /gpu-transfer-fields/); assert.equal(gets, 0);
});

test('malformed versions, rows, references, alpha, depth, overlaps and geometry never create imported authority', () => {
  const fixture = gpuOracleCases().find(c => c.id === 'extra-color-depth-independent')!;
  const rich = exportGpuScene(compileGpuScene(createTerrainScene(fixture.terrainInput), makeOriginalSprites().batch));
  const changes: ((p: Mutable) => void)[] = [
    p => { p.schemaVersion = 2; }, p => { p.policy = 'unknown'; }, p => { p.scenePolicy = 'unknown'; }, p => { p.extra = 1; },
    p => { p.rasters[0].id = 1; }, p => { p.rasters[0].width = 2049; }, p => { p.rasters[0].rgba = new Uint8Array(1); },
    p => { p.rasters[0].minDepth = 1; }, p => { p.rasters[0].rgba[3] = 2; }, p => { p.rasters[0].depth[0] = 2147483647; },
    p => { p.rasters[0].rgba[0] = 17; p.rasters[0].rgba[3] = 0; },
    p => { p.terrain[0].sourceRecord = 1; }, p => { p.terrain[0].group = 99; }, p => { p.terrain[0].assetId = 'bad id'; },
    p => { p.terrainGroups[0].right++; }, p => { p.terrainGroups[0].pieces[0].rasterId = 1; },
    p => { p.spriteResources[0].rasterId = 0; }, p => { p.spriteResources[0].rectangle.width++; },
    p => { p.spriteResources[0].canvasWidth = 0; }, p => { p.spriteResources[0].rowStep = 2; },
    p => { p.objects[0].frameId = 'unknown'; }, p => { p.objects[0].depth.rowStep = 1; },
    p => { p.objects.push({ ...p.objects[0] }); }, p => { p.spriteObjectLimit = null; },
    p => { p.objects = []; }, p => { p.rasters.push({ ...p.rasters[0], id: p.rasters.length }); },
  ];
  for (const [i, change] of changes.entries()) { const p = structuredClone(rich); change(p); assert.throws(() => importGpuScene(p), `hostile mutation ${i}`); }
  const p = structuredClone(rich) as Mutable, g = p.terrainGroups[0], a = p.rasters[g.pieces[0].rasterId], b = p.rasters[g.pieces[1].rasterId];
  const x = Math.max(0, g.pieces[1].x), y = Math.max(0, g.pieces[1].y), i = (y - g.pieces[1].y) * b.width + x - g.pieces[1].x;
  b.rgba[i * 4] = (a.rgba[(y * a.width + x) * 4] + 1) % 256; b.rgba[i * 4 + 3] = 255;
  assert.throws(() => importGpuScene(p), /gpu-transfer-patch-overlap/);
});

test('fixed ordinary typed-array ownership rejects shared, resizable, detached, wrapped and sparse inputs', () => {
  const { packet } = simple();
  for (const mutation of [
    (p: Mutable) => { p.rasters[0].rgba = new Uint8Array(new SharedArrayBuffer(p.rasters[0].rgba.byteLength)); },
    (p: Mutable) => { p.rasters[0].rgba = new Uint8Array(Reflect.construct(ArrayBuffer, [p.rasters[0].rgba.byteLength, { maxByteLength: p.rasters[0].rgba.byteLength }])); },
    (p: Mutable) => { p.rasters[0].rgba = new Proxy(p.rasters[0].rgba, {}); },
    (p: Mutable) => { structuredClone(p.rasters[0].rgba.buffer, { transfer: [p.rasters[0].rgba.buffer] }); },
    (p: Mutable) => { delete p.terrain[0]; },
    (p: Mutable) => { p.objects.length = 4294967295; },
  ]) { const p = structuredClone(packet); mutation(p); assert.throws(() => importGpuScene(p)); }
});

test('original custom object/sample limits and explicit transfer budgets retain exact/lower rejection boundaries', () => {
  const { source, sprites } = simple(), atlas = createSpriteAtlas(sprites.atlasInput, { objects: 1 });
  const scene = compileGpuScene(source, { ...sprites.batch, atlas }, { samples: 0 });
  const packet = exportGpuScene(scene), imported = importGpuScene(structuredClone(packet));
  assert.equal(packet.spriteObjectLimit, 1); assert.equal(packet.limits.samples, 0);
  assert.throws(() => prepareGpuFrame(imported, originalViewport(), [originalObject(), originalObject({ id: 'two' })]), /sprite-array/);
  const frame = prepareGpuFrame(imported, originalViewport({ cameraX: 1000, cameraY: 1000 })); assert.equal(frame.allocations.samples, 0);
  const normal = simple().packet, pixels = normal.rasters.reduce((n, r) => n + r.width * r.height, 0);
  for (const [key, exact] of [['rasters', normal.rasters.length], ['rasterPixels', pixels], ['rasterBytes', pixels * 8], ['objects', 1]] as const) {
    assert.doesNotThrow(() => importGpuScene(normal, { [key]: exact })); assert.throws(() => importGpuScene(normal, { [key]: exact - 1 }));
  }
  for (const key of ['work', 'stringBytes'] as const) {
    let low = 0, high = GPU_TRANSFER_LIMITS[key];
    while (low < high) { const middle = Math.floor((low + high) / 2); try { validateGpuSceneTransfer(normal, { [key]: middle }); high = middle; } catch { low = middle + 1; } }
    assert.ok(low > 0); assert.doesNotThrow(() => importGpuScene(normal, { [key]: low })); assert.throws(() => importGpuScene(normal, { [key]: low - 1 }), new RegExp(`gpu-transfer-${key === 'work' ? 'work' : 'string'}-budget`));
  }
  for (const limits of [{ draws: -1 }, { work: GPU_TRANSFER_LIMITS.work + 1 }, { objects: NaN }, { unknown: 1 }, { get work(): number { throw Error('not called'); } }]) assert.throws(() => importGpuScene(normal, limits));
});

test('standalone object snapshot owns descriptors but leaves genuine resident reference joins to frame preparation', () => {
  const input = [originalObject({ id: 'z' }), originalObject({ id: 'A' })], output = captureGpuSpriteObjects(input);
  assert.deepEqual(output.map(o => o.id), ['A', 'z']); assert.ok(Object.isFrozen(output[0]!.depth));
  (input[0] as Mutable).x = 900; assert.equal(output[1]!.x, 28);
  assert.throws(() => captureGpuSpriteObjects(input, { objects: 1 }), /sprite-array/);
  assert.throws(() => captureGpuSpriteObjects([originalObject({ x: -0 })]), /sprite-coordinate-limit/);
  assert.throws(() => captureGpuSpriteObjects([originalObject({ depth: { base: 0, rowStep: -0 as 0, terrainTie: 'front' } })]), /sprite-depth-policy/);
  assert.equal(captureGpuSpriteObjects([originalObject({ frameId: 'unprepared-but-syntactically-valid' })]).length, 1);
});

test('both profiles preserve generated transfer geometry, both row steps and fractional camera axes', () => {
  for (const profile of ['ra2', 'yr'] as const) for (let n = 0; n < 4; n++) {
    const source = createTerrainScene(makeOriginalTerrain({ profile, width: 2, tileWidth: n % 2 ? 48 : 60,
      elevations: [n, 0, 1], slots: [0, 1, 0], tiles: [{ baseIndex: n, baseZ: 21 * n }, { baseIndex: 7, baseZ: 4 }] }));
    const batch = makeOriginalSprites({ frames: [{ id: 'frame', x: 2, y: 3, width: 3, height: 2, pixels: [0, 1, 2, 3, 0, 4] }],
      objects: [originalObject({ id: 'z', x: 18 + n, y: 5, depth: { base: 0, rowStep: 0, terrainTie: 'front' } }),
        originalObject({ id: 'A', x: 17 + n, y: 5, depth: { base: 0, rowStep: 1, terrainTie: 'behind' } })] }).batch;
    const original = compileGpuScene(source, batch), imported = importGpuScene(structuredClone(exportGpuScene(original))), picker = createGpuPicker(imported);
    const view = originalViewport({ cameraX: -1.75 + n / 4, cameraY: -2.125, zoom: ([0.5, 1, 2, 4] as const)[n]!, width: 17, height: 11 });
    const frame = prepareGpuFrame(imported, view), cpu = source.renderSprites(view, batch);
    assert.deepEqual(framePacket(frame), framePacket(prepareGpuFrame(original, view)));
    for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) assert.deepEqual(picker.pick(frame, x, y), cpu.pick(x, y));
  }
});

test('captures pin input buffers after all metadata traps and accept ordinary nonzero-offset native views', () => {
  const { packet } = simple(), p = structuredClone(packet) as Mutable;
  const colors = p.rasters[0].rgba as Uint8Array, padded = new Uint8Array(colors.length + 4); padded.set(colors, 4);
  p.rasters[0].rgba = padded.subarray(4);
  const depths = p.rasters[0].depth as Int32Array, wide = new Int32Array(depths.length + 2); wide.set(depths, 2); p.rasters[0].depth = wide.subarray(2);
  assert.deepEqual(exportGpuScene(importGpuScene(p)), packet);
  const changing = structuredClone(packet) as Mutable;
  changing.objects[0] = new Proxy(changing.objects[0], { getOwnPropertyDescriptor(target, key) {
    if (key === 'depth') changing.rasters[0].rgba[3] = 123;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  assert.throws(() => importGpuScene(changing), /gpu-transfer-raster-value/);
  const empty = gpuOracleCases().find(c => c.id === 'empty-and-opaque-zero')!;
  const emptyPacket = structuredClone(exportGpuScene(compileGpuScene(createTerrainScene(empty.terrainInput), empty.batch!))) as Mutable;
  const zero = emptyPacket.rasters.find((r: Mutable) => r.width === 0);
  assert.ok(zero); structuredClone(zero.rgba.buffer, { transfer: [zero.rgba.buffer] });
  assert.throws(() => importGpuScene(emptyPacket), /gpu-transfer-plane/);
});
