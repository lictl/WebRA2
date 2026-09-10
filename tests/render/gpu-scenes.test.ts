// SPDX-License-Identifier: GPL-3.0-or-later
// Original packet interpretation and CPU oracles; this is not a WebGL or timing test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrainScene, type TerrainFrame, type TerrainPick, type TerrainScene } from '../../packages/render/src/terrain-scene.ts';
import type { SpriteBatch, SpritePick, SpriteTerrainFrame } from '../../packages/render/src/sprite-layer.ts';
import { GPU_DRAW as D, GPU_DRAW_STRIDE, type GpuFrame, type GpuFrameData, type GpuReadback, type GpuScene, type GpuSceneData } from '../../packages/render/src/gpu-contracts.ts';
import { compileGpuScene, copyGpuFrameData, copyGpuSceneData, pickGpuFrame, prepareGpuFrame } from '../../packages/render/src/gpu-scene.ts';
import { gpuOracleCases, makeOriginalSprites, makeOriginalTerrain, originalHash, originalObject, originalPalette, originalViewport, type GpuOracleCase } from './gpu-fixtures.ts';

const EMPTY_DEPTH = -2147483648;
type Pick = (TerrainPick & { kind: 'terrain' }) | SpritePick | null;
function cpuPick(frame: TerrainFrame | SpriteTerrainFrame, x: number, y: number): Pick {
  const value = frame.pick(x, y); return value === null ? null : 'kind' in value ? value : { kind: 'terrain', ...value };
}
/** Deliberately slow, per-output-pixel candidate selection for tiny originals only.
 * It reads the packed representation, not TMP/SHP; existing CPU rendering remains the source oracle.
 * This does not share any GPU shader, texture packing, depth encoding, draw loop or readback code. */
function interpret(scene: GpuSceneData, frame: GpuFrameData): GpuReadback {
  const { width, height, backgroundRgba } = frame.viewport, count = width * height;
  const rgba = new Uint8Array(count * 4), depth = new Int32Array(count).fill(EMPTY_DEPTH);
  const kind = new Uint8Array(count), owner = new Int32Array(count).fill(-1), draws = frame.draws;
  interface Fragment { depth: number; owner: number; kind: number; front: number; rgba: Uint8Array }
  const nearer = (a: Fragment, b: Fragment): number => b.depth - a.depth || a.owner - b.owner;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const candidates: Fragment[] = [], at = y * width + x;
    for (let d = 0; d < draws.length; d += GPU_DRAW_STRIDE) {
      if (x < draws[d + D.x0]! || x >= draws[d + D.x1]! || y < draws[d + D.y0]! || y >= draws[d + D.y1]!) continue;
      const raster = scene.rasters[draws[d + D.raster]!]!, sx = frame.sampleX[x]! - draws[d + D.left]!, sy = frame.sampleY[y]! - draws[d + D.top]!;
      if (sx < 0 || sy < 0 || sx >= raster.width || sy >= raster.height) continue;
      const sample = sy * raster.width + sx;
      if (!raster.rgba[sample * 4 + 3]) continue;
      candidates.push({ depth: draws[d + D.depthBase]! + raster.depth[sample]!, owner: draws[d + D.owner]!,
        kind: draws[d + D.kind]!, front: draws[d + D.front]!, rgba: raster.rgba.subarray(sample * 4, sample * 4 + 4) });
    }
    const terrain = candidates.filter(c => c.kind === 1).sort(nearer)[0];
    // A sprite's front bit affects only equality with the terrain winner. It is not a sprite priority bit.
    const object = candidates.filter(c => c.kind === 2 && (!terrain || c.depth > terrain.depth || c.depth === terrain.depth && c.front === 1)).sort(nearer)[0];
    const selected = object ?? terrain;
    rgba.set(selected?.rgba ?? backgroundRgba, at * 4);
    if (selected) { depth[at] = selected.depth; kind[at] = selected.kind; owner[at] = selected.owner; }
  }
  return { width, height, rgba, depth, kind, owner };
}
function sample(readback: GpuReadback, x: number, y: number) {
  const at = y * readback.width + x; return { kind: readback.kind[at]!, owner: readback.owner[at]!, depth: readback.depth[at]! };
}
function assertFrame(cpu: TerrainScene, gpu: GpuScene, view: ReturnType<typeof originalViewport>, batch: SpriteBatch | null): { frame: GpuFrame; output: GpuReadback } {
  const cpuFrame = batch ? cpu.renderSprites(view, batch) : cpu.render(view);
  const frame = prepareGpuFrame(gpu, view, batch?.objects), packet = copyGpuFrameData(frame), data = copyGpuSceneData(gpu), output = interpret(data, packet);
  assert.deepEqual(output.rgba, cpuFrame.rgba, 'entire RGBA plane');
  for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) {
    assert.deepEqual(pickGpuFrame(frame, sample(output, x, y), x, y), cpuPick(cpuFrame, x, y), `complete pick/depth at ${x},${y}`);
  }
  assert.deepEqual(Array.from(packet.sampleX), Array.from({ length: view.width }, (_, x) => Math.floor(view.cameraX + (x + 0.5) / view.zoom)));
  assert.deepEqual(Array.from(packet.sampleY), Array.from({ length: view.height }, (_, y) => Math.floor(view.cameraY + (y + 0.5) / view.zoom)));
  assert.equal(frame.allocations.drawBytes, packet.draws.byteLength);
  assert.equal(frame.allocations.axisBytes, packet.sampleX.byteLength + packet.sampleY.byteLength);
  let samples = 0;
  for (let at = 0; at < packet.draws.length; at += GPU_DRAW_STRIDE) {
    const d = packet.draws.subarray(at, at + GPU_DRAW_STRIDE);
    assert.equal(d[D.reserved], 0); assert.equal(d[D.kind], at / GPU_DRAW_STRIDE < packet.terrainDraws ? 1 : 2);
    assert.ok(d[D.x0]! >= 0 && d[D.x1]! <= view.width && d[D.y0]! >= 0 && d[D.y1]! <= view.height);
    assert.ok(d[D.x1]! > d[D.x0]! && d[D.y1]! > d[D.y0]!);
    samples += (d[D.x1]! - d[D.x0]!) * (d[D.y1]! - d[D.y0]!);
  }
  assert.equal(frame.allocations.samples, samples);
  return { frame, output };
}

const cases = gpuOracleCases();
for (const fixture of cases) test(`original GPU packet / CPU oracle: ${fixture.id}`, () => {
  const cpu = createTerrainScene(fixture.terrainInput), gpu = compileGpuScene(cpu, fixture.batch ?? undefined);
  for (const [i, view] of fixture.viewports.entries()) {
    const { frame, output } = assertFrame(cpu, gpu, view, fixture.batch);
    for (const probe of fixture.probes.filter(p => p.view === i)) {
      const picked = pickGpuFrame(frame, sample(output, probe.x, probe.y), probe.x, probe.y);
      const actual = { ...picked, kind: picked?.kind ?? 'none', rgba: Array.from(output.rgba.subarray((probe.y * view.width + probe.x) * 4, (probe.y * view.width + probe.x) * 4 + 4)) };
      for (const key of Object.keys(probe.expected) as (keyof typeof probe.expected)[]) {
        assert.deepEqual((actual as Record<string, unknown>)[key], probe.expected[key], `hand probe ${probe.x},${probe.y} ${key}`);
      }
    }
  }
});

test('both profiles: generated independent colors, Z, offsets, object ties and all supported zooms', () => {
  for (const profile of ['ra2', 'yr'] as const) for (let n = 0; n < 12; n++) {
    const colors = originalPalette().rgba; colors[5 * 4 + 3] = 0;
    const terrain = makeOriginalTerrain({ profile, width: 2, elevations: [n % 3, 0, 1], slots: [0, 1, 0], palette: colors, tiles: [
      { baseIndex: n, baseZ: n * 21, extra: { x: 22 - n, y: n - 4, width: 4, height: 2,
        indices: [0, 5, 2, 3, 0, 4, 1, 0], z: [0, 31, 32, 255, 1, 30, 33, 254] } }, { baseIndex: n + 1, baseZ: 4 }] });
    const palette = originalPalette(), remap = Uint8Array.from({ length: 256 }, (_, i) => i); remap[2] = 9; palette.rgba[9 * 4 + 3] = 0;
    const batch = makeOriginalSprites({ frames: [{ id: 'frame', x: 2, y: 3, width: 4, height: 2, pixels: [0, 1, 2, 3, 4, 5, 6, 7] }], palettes: [{ ...palette, remap }],
      objects: ['z', 'A', 'a'].map((id, i) => originalObject({ id, x: 14 + n, y: n - 3, anchorX: n % 4, anchorY: 2,
        depth: { base: n, rowStep: i % 2 as 0 | 1, terrainTie: i === 1 ? 'behind' : 'front' } })) }).batch;
    const cpu = createTerrainScene(terrain), gpu = compileGpuScene(cpu, batch);
    const view = originalViewport({ cameraX: n / 4 - 2.5, cameraY: -20 + n / 8, zoom: ([0.5, 1, 2, 4] as const)[n % 4]!, width: 29, height: 23 });
    assertFrame(cpu, gpu, view, batch);
  }
});

test('sparse distant extras allocate only base plus extra and preserve the separate CPU reference sample cap', () => {
  const fixture = cases.find(c => c.id === 'sparse-far-extra')!, cpu = createTerrainScene(fixture.terrainInput);
  const scene = compileGpuScene(cpu, undefined, { rasters: 2, rasterPixels: 1801, rasterBytes: 14408, draws: 2 });
  assert.deepEqual(scene.allocations, { rasterCount: 2, rasterPixels: 1801, rasterBytes: 14408, terrainPieces: 2, objects: 0 });
  for (const cap of [{ rasters: 1 }, { rasterPixels: 1800 }, { rasterBytes: 14407 }, { draws: 1 }]) assert.throws(() => compileGpuScene(cpu, undefined, cap));
  const bounded = compileGpuScene(cpu, undefined, { samples: 1800 });
  assert.equal(prepareGpuFrame(bounded, fixture.viewports[0]!).allocations.samples, 1800);
  assert.throws(() => prepareGpuFrame(compileGpuScene(cpu, undefined, { samples: 1799 }), fixture.viewports[0]!), /gpu-cpu-reference-sample-budget/);
  // Sparse GPU draws cannot bypass the CPU oracle's viewport-clipped union rectangle budget.
  const emptyGap = originalViewport({ cameraX: 100, cameraY: 100, width: 10, height: 10 });
  assert.equal(prepareGpuFrame(compileGpuScene(cpu, undefined, { samples: 100 }), emptyGap).allocations.draws, 0);
  assert.throws(() => prepareGpuFrame(compileGpuScene(cpu, undefined, { samples: 99 }), emptyGap), /gpu-cpu-reference-sample-budget/);
});

test('overlapping TMP patches and sprite rectangles share the exact aggregate GPU sample allowance', () => {
  const fixture = cases.find(c => c.id === 'extra-color-depth-independent')!, cpu = createTerrainScene(fixture.terrainInput);
  const batch = makeOriginalSprites({ frames: [{ id: 'frame', width: 1, height: 1 }] }).batch;
  const view = originalViewport(), cap = 1800 + 4 + 1;
  assert.equal(prepareGpuFrame(compileGpuScene(cpu, batch, { samples: cap }), view).allocations.samples, cap);
  assert.throws(() => prepareGpuFrame(compileGpuScene(cpu, batch, { samples: cap - 1 }), view), /gpu-sample-budget/);
  assert.throws(() => prepareGpuFrame(compileGpuScene(cpu, batch, { viewportPixels: 1799 }), view), /gpu-viewport/);
  assert.throws(() => prepareGpuFrame(compileGpuScene(cpu, batch, { viewportDimension: 59 }), view), /gpu-viewport/);
});

test('reduced coordinate limits cover retained terrain bounds and source slot extras before frame preparation', () => {
  const cpu = createTerrainScene(makeOriginalTerrain());
  assert.equal(compileGpuScene(cpu, undefined, { coordinate: 60 }).allocations.terrainPieces, 1);
  assert.throws(() => compileGpuScene(cpu, undefined, { coordinate: 59 }), /gpu-coordinate/);
  const sparse = createTerrainScene(cases.find(c => c.id === 'sparse-far-extra')!.terrainInput);
  assert.equal(compileGpuScene(sparse, undefined, { coordinate: 1048575 }).allocations.rasterPixels, 1801);
  assert.throws(() => compileGpuScene(sparse, undefined, { coordinate: 1048574 }), /gpu-coordinate/);
});

test('GPU background snapshots use validated data descriptors without rereading Proxy components', () => {
  const cpu = createTerrainScene(makeOriginalTerrain()), gpu = compileGpuScene(cpu);
  let reads = 0;
  const background = new Proxy([1, 2, 3, 4], { get(target, key, receiver) {
    if (key === '0') { reads++; return 300; } return Reflect.get(target, key, receiver);
  } });
  const frame = prepareGpuFrame(gpu, { ...originalViewport(), backgroundRgba: background as unknown as readonly [number, number, number, number] });
  assert.deepEqual(frame.viewport.backgroundRgba, [1, 2, 3, 4]); assert.equal(reads, 0);
  background[0] = 9; assert.deepEqual(frame.viewport.backgroundRgba, [1, 2, 3, 4]);
});

test('owned source and detached packets cannot mutate a prepared frame, future upload or CPU pick', () => {
  const input = makeOriginalTerrain(), cpu = createTerrainScene(input), sprite = makeOriginalSprites(), gpu = compileGpuScene(cpu, sprite.batch);
  const viewport = originalViewport(), frame = prepareGpuFrame(gpu, viewport), original = interpret(copyGpuSceneData(gpu), copyGpuFrameData(frame));
  const before = copyGpuFrameData(frame), beforeRasters = copyGpuSceneData(gpu);
  input.palette.fill(0); input.assets[0]!.bytes.fill(0); sprite.atlasInput.assets[0]!.bytes.fill(0); sprite.batch.palettes[0]!.rgba.fill(0);
  Object.assign(sprite.batch.objects[0]!, { x: 100, y: 100 }); Object.assign(viewport, { cameraX: 100 });
  const detachedScene = copyGpuSceneData(gpu), detachedFrame = copyGpuFrameData(frame);
  for (const r of detachedScene.rasters) { r.rgba.fill(0); r.depth.fill(1048576); }
  detachedFrame.sampleX.fill(123); detachedFrame.sampleY.fill(456); detachedFrame.draws.fill(0);
  assert.deepEqual(copyGpuFrameData(frame), before); assert.deepEqual(copyGpuSceneData(gpu), beforeRasters);
  const chosen = sample(original, 28, 10), picked = pickGpuFrame(frame, chosen, 28, 10);
  assert.equal(picked?.kind, 'object'); assert.equal(picked?.worldX, 28);
  original.rgba.fill(0); assert.deepEqual(pickGpuFrame(frame, chosen, 28.9, 10.2), picked);
  const next = prepareGpuFrame(gpu, originalViewport());
  assert.deepEqual(copyGpuFrameData(next).draws, before.draws);
  assert.deepEqual(interpret(copyGpuSceneData(gpu), copyGpuFrameData(next)).rgba, interpret(beforeRasters, before).rgba);
});

test('dynamic IDs, lexical ties, movement and dropping prepared palettes keep original frame pick identity', () => {
  const cpu = createTerrainScene(makeOriginalTerrain()), p = originalPalette(), q = originalPalette('second'); q.rgba[8] = 117;
  const a = originalObject({ id: 'A' }), z = originalObject({ id: 'z', paletteId: 'second' });
  const batch = makeOriginalSprites({ palettes: [q, p], objects: [z, a] }).batch, gpu = compileGpuScene(cpu, batch), view = originalViewport();
  const initial = assertFrame(cpu, gpu, view, batch);
  const moved = [originalObject({ id: 'new', paletteId: 'second', x: 29 })];
  assertFrame(cpu, gpu, view, { ...batch, palettes: [q], objects: moved });
  assert.equal((pickGpuFrame(initial.frame, sample(initial.output, 28, 10), 28, 10) as SpritePick).id, 'A');
  assertFrame(cpu, gpu, view, { ...batch, palettes: [], objects: [] });
  const reversed = compileGpuScene(cpu, { ...batch, palettes: [p, q], objects: [a, z] });
  assert.deepEqual(interpret(copyGpuSceneData(reversed), copyGpuFrameData(prepareGpuFrame(reversed, view))), initial.output);
  assert.throws(() => prepareGpuFrame(gpu, view, [originalObject({ depth: { base: 0, rowStep: 1, terrainTie: 'front' } })]), /gpu-unprepared-sprite-resource/);
  assert.throws(() => prepareGpuFrame(gpu, view, [a, a]), /sprite-duplicate-object/);
  assert.throws(() => prepareGpuFrame(gpu, view, [originalObject({ x: 1048576 })]), /sprite-coordinate-limit/);
  assert.throws(() => prepareGpuFrame(gpu, view, [originalObject({ depth: { base: 1048576, rowStep: 1, terrainTie: 'front' } })]), /sprite-depth-limit/);
});

test('factory identities, data-only fields and strict viewport/limit bounds reject malformed inputs', () => {
  const cpu = createTerrainScene(makeOriginalTerrain()), gpu = compileGpuScene(cpu), frame = prepareGpuFrame(gpu, originalViewport());
  assert.throws(() => compileGpuScene({ ...cpu }), /scene-identity/);
  assert.throws(() => compileGpuScene(new Proxy(cpu, {})), /scene-identity/);
  assert.throws(() => prepareGpuFrame({ ...gpu }, originalViewport()), /gpu-scene-identity/);
  assert.throws(() => copyGpuSceneData(new Proxy(gpu, {})), /gpu-scene-identity/);
  assert.throws(() => copyGpuFrameData({ ...frame }), /gpu-frame-identity/);
  for (const changes of [{ cameraX: NaN }, { cameraY: Infinity }, { cameraX: 1048577 }, { zoom: 3 }, { width: 0 }, { height: 2049 }, { width: 1.5 }]) {
    assert.throws(() => prepareGpuFrame(gpu, { ...originalViewport(), ...changes } as ReturnType<typeof originalViewport>));
  }
  const accessor = { ...originalViewport(), get cameraX(): number { throw Error('must not execute'); } };
  assert.throws(() => prepareGpuFrame(gpu, accessor), /gpu-fields/);
  assert.throws(() => prepareGpuFrame(gpu, { ...originalViewport(), backgroundRgba: [0, 0, 0, 256] }), /gpu-background/);
  assert.throws(() => compileGpuScene(cpu, undefined, { get samples(): number { throw Error('must not execute'); } }), /gpu-limit/);
  assert.throws(() => compileGpuScene(cpu, undefined, { samples: -1 }), /gpu-limit/);
  assert.throws(() => prepareGpuFrame(gpu, originalViewport(), []), /gpu-no-sprite-catalog/);
  assert.equal(pickGpuFrame(frame, { kind: 0, owner: -1, depth: EMPTY_DEPTH }, 0, 0), null);
  for (const s of [{ kind: 0, owner: 0, depth: EMPTY_DEPTH }, { kind: 0, owner: -1, depth: 0 }, { kind: 1, owner: 100, depth: 0 }, { kind: 2, owner: 0, depth: 0 }]) assert.throws(() => pickGpuFrame(frame, s, 0, 0));
  for (const [x, y] of [[-1, 0], [0, -1], [60, 0], [0, 30], [Infinity, 0], [0, NaN]]) assert.equal(pickGpuFrame(frame, { kind: 0, owner: -1, depth: EMPTY_DEPTH }, x!, y!), null);
});

test('fixture corpus has deterministic source and complete output fingerprints', () => {
  const projection = (fixtures: GpuOracleCase[]): string => originalHash(new TextEncoder().encode(JSON.stringify(fixtures.map(c => {
    const cpu = createTerrainScene(c.terrainInput);
    return [c.id, c.terrainInput.terrain.source.sha256, c.terrainInput.assets.map(a => a.sha256), c.batch?.atlas.assets.map(a => a.sha256),
      c.viewports.map(v => { const f = c.batch ? cpu.renderSprites(v, c.batch) : cpu.render(v); return [originalHash(f.rgba),
        originalHash(new TextEncoder().encode(JSON.stringify(Array.from({ length: v.width * v.height }, (_, i) => cpuPick(f, i % v.width, Math.floor(i / v.width))))))]; })];
  }))));
  assert.equal(projection(cases), projection(gpuOracleCases()));
  assert.equal(cases.length, 17); assert.equal(cases.reduce((n, c) => n + c.probes.length, 0), 39);
});
