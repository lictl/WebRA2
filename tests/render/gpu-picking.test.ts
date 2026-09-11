// SPDX-License-Identifier: GPL-3.0-or-later
// Original readback-free picking tests. No browser, GL context or retail source is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrainScene } from '../../packages/render/src/terrain-scene.ts';
import { compileGpuScene, copyGpuFrameData, copyGpuSceneData, prepareGpuFrame, visitGpuFramePixel } from '../../packages/render/src/gpu-scene.ts';
import { createGpuPicker, GPU_PICKER_LIMITS, type GpuPickerLimits } from '../../packages/render/src/gpu-picking.ts';
import type { GpuFrame, GpuScene } from '../../packages/render/src/gpu-contracts.ts';
import { gpuOracleCases, makeOriginalSprites, makeOriginalTerrain, originalObject, originalPalette, originalViewport } from './gpu-fixtures.ts';

for (const fixture of gpuOracleCases()) test(`readback-free every-pixel CPU picking: ${fixture.id}`, () => {
  const cpu = createTerrainScene(fixture.terrainInput), scene = compileGpuScene(cpu, fixture.batch ?? undefined), picker = createGpuPicker(scene);
  for (const view of fixture.viewports) {
    const frame = prepareGpuFrame(scene, view), expected = fixture.batch ? cpu.renderSprites(view, fixture.batch) : cpu.render(view);
    for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) {
      const picked = expected.pick(x, y), result = picked && !('kind' in picked) ? { kind: 'terrain', ...picked } : picked;
      assert.deepEqual(picker.pick(frame, x, y), result, `${fixture.id}: ${x},${y}`);
    }
  }
  assert.equal(picker.stats().ownedRasterBytes, scene.allocations.rasterBytes);
  picker.dispose(); assert.deepEqual(picker.stats(), { state: 'disposed', ownedRasterBytes: 0, rasterCount: 0 });
});

test('both profiles: generated fractional cameras, depth ties, sparse extras and transparent remaps agree with CPU', () => {
  for (const profile of ['ra2', 'yr'] as const) for (let n = 0; n < 16; n++) {
    const palette = originalPalette(); palette.rgba[5 * 4 + 3] = 0;
    const terrain = createTerrainScene(makeOriginalTerrain({ profile, width: 2, tileWidth: n % 2 ? 48 : 60,
      elevations: [n % 4, 0, 1], slots: [0, 1, 0], palette: palette.rgba, tiles: [
        { baseIndex: n, baseZ: n * 15, extra: { x: 20 - n, y: n - 8, width: 4, height: 2,
          indices: [0, 5, 2, 3, 0, 4, 1, 0], z: [0, 31, 32, 255, 1, 30, 33, 254] } }, { baseIndex: n + 1, baseZ: 4 }] }));
    const remap = Uint8Array.from({ length: 256 }, (_, i) => i); remap[2] = 5;
    const batch = makeOriginalSprites({ frames: [{ id: 'frame', x: 2, y: 3, width: 4, height: 2, pixels: [0, 1, 2, 3, 4, 5, 6, 7] }],
      palettes: [{ ...palette, remap }], objects: ['z', 'A', 'a'].map((id, i) => originalObject({ id, x: 14 + n, y: n - 3,
        anchorX: n % 4, anchorY: 2, depth: { base: n, rowStep: i % 2 as 0 | 1, terrainTie: i === 1 ? 'behind' : 'front' } })) }).batch;
    const scene = compileGpuScene(terrain, batch), picker = createGpuPicker(scene);
    const view = originalViewport({ cameraX: n / 4 - 2.5, cameraY: -20 + n / 8, zoom: ([0.5, 1, 2, 4] as const)[n % 4]!, width: 29, height: 23 });
    const frame = prepareGpuFrame(scene, view), expected = terrain.renderSprites(view, batch);
    for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) assert.deepEqual(picker.pick(frame, x + 0.125, y + 0.75), expected.pick(x, y));
    picker.dispose();
  }
});

test('picking remains tied to each supplied old or new frame and copied data cannot mutate its result', () => {
  const terrain = createTerrainScene(makeOriginalTerrain()), original = originalObject({ x: 28, y: 10 });
  const batch = makeOriginalSprites({ objects: [original] }).batch, scene = compileGpuScene(terrain, batch), picker = createGpuPicker(scene);
  const view = originalViewport(), first = prepareGpuFrame(scene, view);
  const oldPick = picker.pick(first, 28, 10); assert.equal(oldPick?.kind, 'object');
  const objects = [originalObject({ id: 'replacement', x: 32, y: 10 })], second = prepareGpuFrame(scene, view, objects);
  assert.equal(picker.pick(second, 32, 10)?.kind, 'object');
  const newPick = picker.pick(second, 32, 10); assert.ok(newPick?.kind === 'object'); assert.equal(newPick.id, 'replacement');
  assert.deepEqual(picker.pick(first, 28, 10), oldPick);
  const data = copyGpuSceneData(scene), packet = copyGpuFrameData(first);
  for (const raster of data.rasters) { raster.rgba.fill(0); raster.depth.fill(-2147483648); }
  packet.sampleX.fill(-1000); packet.sampleY.fill(-1000); packet.draws.fill(0);
  (original as { x: number }).x = 1000; (objects[0] as { id: string }).id = 'changed-after-prepare';
  assert.deepEqual(picker.pick(first, 28, 10), oldPick); assert.deepEqual(picker.pick(second, 32, 10), newPick);
  for (let i = 0; i < 32; i++) picker.pick(i % 2 ? first : second, 28 + i % 5, 10);
  assert.deepEqual(picker.stats(), { state: 'ready', ownedRasterBytes: scene.allocations.rasterBytes, rasterCount: scene.allocations.rasterCount });
});

test('genuine frame/scene identity, scalar snapshotting, outside pixels and disposal stay explicit', () => {
  const terrain = createTerrainScene(makeOriginalTerrain()), scene = compileGpuScene(terrain), frame = prepareGpuFrame(scene, originalViewport()), picker = createGpuPicker(scene);
  const other = compileGpuScene(terrain), otherFrame = prepareGpuFrame(other, originalViewport());
  assert.throws(() => picker.pick(otherFrame, 0, 0), /gpu-picker-frame-scene/);
  assert.throws(() => picker.pick({ ...frame }, 0, 0), /gpu-frame-identity/);
  assert.throws(() => picker.pick(new Proxy(frame, {}), -1, -1), /gpu-frame-identity/);
  assert.throws(() => createGpuPicker({ ...scene }), /gpu-scene-identity/);
  assert.throws(() => createGpuPicker(new Proxy(scene, {})), /gpu-scene-identity/);
  let gets = 0;
  const wrapper = new Proxy(frame, { get() { gets++; throw Error('unexpected getter'); } });
  assert.throws(() => picker.pick(wrapper, 0, 0), /gpu-frame-identity/); assert.equal(gets, 0);
  for (const [x, y] of [[-0.001, 0], [0, -1], [60, 0], [0, 30], [NaN, 0], [0, Infinity]]) assert.equal(picker.pick(frame, x!, y!), null);
  const expected = picker.pick(frame, 28, 10); assert.deepEqual(picker.pick(frame, 28.9999, 10.9999), expected);
  picker.dispose(); picker.dispose(); assert.throws(() => picker.pick(frame, -1, -1), /gpu-picker-disposed/);
  assert.deepEqual(picker.stats(), { state: 'disposed', ownedRasterBytes: 0, rasterCount: 0 });
});

test('resident copies and per-query draw work obey exact lowered budgets before successful picking', () => {
  const terrain = createTerrainScene(makeOriginalTerrain()), scene = compileGpuScene(terrain), frame = prepareGpuFrame(scene, originalViewport());
  const bytes = scene.allocations.rasterBytes, draws = frame.allocations.draws;
  const picker = createGpuPicker(scene, { rasterBytes: bytes, draws });
  assert.deepEqual(picker.pick(frame, 28, 10), createGpuPicker(scene).pick(frame, 28, 10));
  assert.throws(() => createGpuPicker(scene, { rasterBytes: bytes - 1 }), /gpu-picker-raster-budget/);
  assert.throws(() => createGpuPicker(scene, { draws: draws - 1 }).pick(frame, 28, 10), /gpu.*draw/);
  const empty = prepareGpuFrame(scene, originalViewport({ cameraX: 1000, cameraY: 1000 }));
  assert.equal(empty.allocations.draws, 0); assert.equal(createGpuPicker(scene, { draws: 0 }).pick(empty, 0, 0), null);
  for (const options of [{ rasterBytes: GPU_PICKER_LIMITS.rasterBytes + 1 }, { draws: -1 }, { draws: 1.5 }, { draws: NaN }, { unknown: 1 }, null]) {
    assert.throws(() => createGpuPicker(scene, options as Partial<GpuPickerLimits>), /gpu-picker-limit/);
  }
  let getters = 0;
  assert.throws(() => createGpuPicker(scene, { get rasterBytes() { getters++; return bytes; } }), /gpu-picker-limit/); assert.equal(getters, 0);
  const descriptorOptions = new Proxy({ rasterBytes: bytes }, { get() { getters++; return 0; } });
  assert.equal(createGpuPicker(scene, descriptorOptions).stats().ownedRasterBytes, bytes); assert.equal(getters, 0);
  assert.throws(() => createGpuPicker({ allocations: { get rasterBytes() { getters++; return bytes; } } } as unknown as GpuScene), /gpu-picker-raster-budget/); assert.equal(getters, 0);
  assert.throws(() => picker.pick(null as unknown as GpuFrame, 0, 0), /gpu-picker-frame-scene/);
});


test('the scalar accessor bounds callbacks and nested queries cannot mutate the retained frame', () => {
  const terrain = createTerrainScene(makeOriginalTerrain()), batch = makeOriginalSprites().batch;
  const scene = compileGpuScene(terrain, batch), frame = prepareGpuFrame(scene, originalViewport()), picker = createGpuPicker(scene);
  const expected = picker.pick(frame, 28, 10), first: number[][] = [], after: number[][] = [];
  const collect = (target: number[][]) => (raster: number, texel: number, base: number, owner: number, kind: 1 | 2, front: boolean) => target.push([raster, texel, base, owner, kind, +front]);
  assert.equal(visitGpuFramePixel(frame, 28, 10, collect(first)), true); assert.ok(first.length >= 2);
  let calls = 0;
  visitGpuFramePixel(frame, 28, 10, (...values) => {
    calls++; assert.equal(values.length, 6); assert.ok(values.slice(0, 5).every(Number.isSafeInteger));
    const nested: number[][] = []; visitGpuFramePixel(frame, 28, 10, collect(nested)); assert.deepEqual(nested, first);
    const copy = copyGpuFrameData(frame); copy.draws.fill(0); copy.sampleX.fill(-999);
    assert.deepEqual(picker.pick(frame, 28, 10), expected);
  });
  assert.equal(calls, first.length); visitGpuFramePixel(frame, 28, 10, collect(after)); assert.deepEqual(after, first);
  let refusedCalls = 0;
  assert.throws(() => visitGpuFramePixel(frame, -1, -1, () => { refusedCalls++; }, 0), /gpu-pick-draw-budget/);
  assert.equal(refusedCalls, 0);
  assert.throws(() => visitGpuFramePixel(frame, 28, 10, () => { throw Error('original callback refusal'); }), /original callback refusal/);
  assert.deepEqual(picker.pick(frame, 28, 10), expected);
});
