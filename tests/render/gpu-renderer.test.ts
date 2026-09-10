// SPDX-License-Identifier: GPL-3.0-or-later
// Original fixtures and a GL call/resource recorder. This is not a GPU pixel oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileGpuScene, copyGpuFrameData, copyGpuSceneData, prepareGpuFrame } from '../../packages/render/src/gpu-scene.ts';
import { GpuRenderer, GpuRendererError } from '../../packages/render/src/gpu-renderer.ts';
import { GPU_DRAW_STRIDE } from '../../packages/render/src/gpu-contracts.ts';
import type { GpuFrame, GpuRendererLimits } from '../../packages/render/src/gpu-contracts.ts';
import type { TerrainScene, TerrainViewport } from '../../packages/render/src/terrain-scene.ts';
import { createSpriteAtlas, type SpriteBatch } from '../../packages/render/src/sprite-layer.ts';
// @ts-expect-error The existing original benchmark fixtures are authored as browser-loadable JS.
import { renderFixture } from '../../tools/performance/workloads.mjs';

interface Call { name: string; args: unknown[] }
interface Handle { id: number; kind: string }
function recordingGl(width = 60, height = 40) {
  const calls: Call[] = [], live = new Set<Handle>(), constants = new Map<string, number>();
  const canvas = new EventTarget();
  let next = 1, lost = false, compile = true, complete = true, readBuffer = 0;
  let readFramebuffer: Handle | null = null;
  const framebuffers: Handle[] = [];
  let read: ((attachment: number, framebuffer: Handle | null, output: Uint32Array | Int32Array) => void) | null = null;
  const api: Record<string, unknown> = { canvas, drawingBufferWidth: width, drawingBufferHeight: height };
  const gl = new Proxy(api, {
    get(target, name: string) {
      if (name in target) return target[name];
      if (/^[A-Z0-9_]+$/.test(name)) { if (!constants.has(name)) constants.set(name, next++); return constants.get(name); }
      const fn = (...args: unknown[]): unknown => {
        // Retain upload snapshots so later source/result mutation cannot hide an ownership bug.
        calls.push({ name, args: args.map(x => ArrayBuffer.isView(x) && !(x instanceof DataView) ? (x as Uint8Array).slice() : x) });
        if (name === 'isContextLost') return lost;
        if (name === 'getParameter') {
          if (args[0] === gl.MAX_TEXTURE_SIZE || args[0] === gl.MAX_RENDERBUFFER_SIZE) return 4096;
          if (args[0] === gl.MAX_ARRAY_TEXTURE_LAYERS) return 256;
          if (args[0] === gl.MAX_DRAW_BUFFERS || args[0] === gl.MAX_COLOR_ATTACHMENTS) return 4;
          if (args[0] === gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS || args[0] === gl.MAX_TEXTURE_IMAGE_UNITS) return 16;
          throw new Error('Unexpected capability query');
        }
        if (name.startsWith('create')) {
          const handle = { id: next++, kind: name.slice(6) }; live.add(handle);
          if (name === 'createFramebuffer') framebuffers.push(handle);
          return handle;
        }
        if (name.startsWith('delete')) { live.delete(args[0] as Handle); return; }
        if (name === 'getShaderParameter') return compile;
        if (name === 'getProgramParameter') return true;
        if (name === 'getUniformLocation') return { name: args[1], program: args[0] };
        if (name === 'checkFramebufferStatus') return complete ? gl.FRAMEBUFFER_COMPLETE : gl.FRAMEBUFFER_UNSUPPORTED;
        if (name === 'getError') return gl.NO_ERROR;
        if (name === 'bindFramebuffer' && (args[0] === gl.READ_FRAMEBUFFER || args[0] === gl.FRAMEBUFFER)) readFramebuffer = args[1] as Handle | null;
        if (name === 'readBuffer') readBuffer = args[0] as number;
        if (name === 'readPixels') {
          const output = args[6] as Uint32Array | Int32Array;
          output.fill(0);
          if (readBuffer === gl.COLOR_ATTACHMENT1) for (let i = 0; i < output.length; i += 4) { output[i] = -2147483648; output[i + 1] = -1; }
          read?.(readBuffer, readFramebuffer, output);
        }
        if (name === 'finish' || name === 'getBufferSubData') throw new Error(`Forbidden render synchronization: ${name}`);
      };
      target[name] = fn; return fn;
    },
  }) as unknown as WebGL2RenderingContext;
  return { gl, calls, live, framebuffers,
    size(w: number, h: number) { api.drawingBufferWidth = w; api.drawingBufferHeight = h; },
    lose() { lost = true; live.clear(); const event = new Event('webglcontextlost', { cancelable: true }); canvas.dispatchEvent(event); return event; },
    recover() { lost = false; canvas.dispatchEvent(new Event('webglcontextrestored')); },
    setCompile(value: boolean) { compile = value; }, setComplete(value: boolean) { complete = value; },
    setRead(value: typeof read) { read = value; },
  };
}
const view: TerrainViewport = { cameraX: -0.125, cameraY: 0.375, zoom: 1, width: 60, height: 40, backgroundRgba: [17, 21, 23, 127] };
function fixture() {
  const original = renderFixture(2) as { scene: TerrainScene; batch: SpriteBatch };
  const base = original.batch.objects[0]!;
  const objects = ['z', 'A'].map(id => ({ ...base, id, x: 24, y: 20, depth: { base: 20, rowStep: 1 as const, terrainTie: 'front' as const } }));
  const batch = { ...original.batch, objects }, scene = compileGpuScene(original.scene, batch);
  return { ...original, batch, scene, frame: prepareGpuFrame(scene, view) };
}
function code(expected: string): (error: unknown) => boolean { return error => error instanceof GpuRendererError && error.code === expected; }

test('genuine frame uploads retain integer axes/order, bounded instancing, and no render readback', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuRenderer(mock.gl);
  renderer.load(f.scene); const afterLoad = mock.calls.length;
  const packet = copyGpuFrameData(f.frame), receipt = renderer.draw(f.frame);
  assert.equal(receipt.frame, f.frame); assert.equal(receipt.sequence, 1); assert.equal(receipt.submitted, true);
  assert.equal(receipt.drawCalls, 3); assert.equal(receipt.uploadedBytes, packet.draws.byteLength + 400);
  const calls = mock.calls.slice(afterLoad), instances = calls.filter(c => c.name === 'drawArraysInstanced');
  assert.deepEqual(instances.map(c => c.args[3]), [packet.terrainDraws, packet.draws.length / GPU_DRAW_STRIDE - packet.terrainDraws]);
  const axes = calls.filter(c => c.name === 'texSubImage2D').map(c => c.args[8]);
  assert.deepEqual(axes, [packet.sampleX, packet.sampleY]);
  assert.deepEqual(calls.find(c => c.name === 'bufferSubData')!.args[2], packet.draws);
  assert.equal(calls.filter(c => c.name === 'readPixels').length, 0);
  assert.equal(calls.filter(c => c.name === 'getBufferSubData' || c.name === 'finish').length, 0);
  const pointers = calls.filter(c => c.name === 'vertexAttribIPointer');
  assert.deepEqual(pointers.map(c => c.args[4]), [0, 16, 32, packet.terrainDraws * 48, packet.terrainDraws * 48 + 16, packet.terrainDraws * 48 + 32]);
  assert.equal(renderer.draw(f.frame).sequence, 2);
  renderer.dispose(); assert.equal(mock.live.size, 0);
});

test('scene/frame lookalikes cannot grant renderer authority or allocate GPU resources', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuRenderer(mock.gl);
  assert.throws(() => renderer.load({ ...f.scene }), /gpu-scene-identity/);
  assert.equal(mock.live.size, 0);
  renderer.load(f.scene); renderer.draw(f.frame);
  const before = renderer.stats(), mutations = mock.calls.filter(c => c.name.startsWith('create') || c.name.startsWith('texSub') || c.name.startsWith('draw')).length;
  assert.throws(() => renderer.draw({ ...f.frame }), /gpu-frame-identity/);
  assert.throws(() => renderer.draw(fixture().frame), code('gpu-scene-mismatch'));
  assert.deepEqual(renderer.stats(), before);
  assert.equal(mock.calls.filter(c => c.name.startsWith('create') || c.name.startsWith('texSub') || c.name.startsWith('draw')).length, mutations);
  renderer.dispose();
});

test('lower limits reject descriptors/getters and insufficient texture/staging capacity before GL allocation', () => {
  const f = fixture(); let invoked = 0;
  for (const input of [{ gpuBytes: 0 }, { instances: -1 }, { textureLayers: NaN }, { textureSide: 2049 },
    { gpuBytes: -0 }, { unexpected: 1 }, { get gpuBytes() { invoked++; return 100; } }]) {
    const mock = recordingGl(); assert.throws(() => new GpuRenderer(mock.gl, input as Partial<GpuRendererLimits>), code('gpu-limits'));
    assert.equal(mock.live.size, 0);
  }
  assert.equal(invoked, 0);
  const mock = recordingGl(), renderer = new GpuRenderer(mock.gl, { textureSide: 32, textureLayers: 1 });
  assert.throws(() => renderer.load(f.scene), code('gpu-texture-limit')); assert.equal(mock.live.size, 0); renderer.dispose();
  const small = recordingGl(), bounded = new GpuRenderer(small.gl, { gpuBytes: 40000 });
  assert.throws(() => bounded.load(f.scene), code('gpu-cpu-memory-limit')); assert.equal(small.live.size, 0); bounded.dispose();
});

test('resident atlas is uploaded once, linear pages include all bytes, and repeat frames allocate no new GL objects', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuRenderer(mock.gl, { textureSide: 60, textureLayers: 4 });
  renderer.load(f.scene);
  const source = copyGpuSceneData(f.scene), uploads = mock.calls.filter(c => c.name === 'texSubImage3D');
  assert.equal(uploads.length, 2);
  const packedRgba = uploads[0]!.args[10] as Uint8Array, packedDepth = uploads[1]!.args[10] as Int32Array;
  let pixels = 0;
  for (const r of source.rasters) {
    assert.deepEqual(packedRgba.subarray(pixels * 4, (pixels + r.depth.length) * 4), r.rgba);
    assert.deepEqual(packedDepth.subarray(pixels, pixels + r.depth.length), r.depth); pixels += r.depth.length;
  }
  assert.ok(packedDepth.length >= pixels); assert.ok(packedDepth.subarray(pixels).every(x => x === 0));
  assert.equal(renderer.stats().ownedCpuBytes, f.scene.allocations.rasterBytes);
  renderer.draw(f.frame);
  const created = mock.calls.filter(c => c.name.startsWith('create')).length;
  const beforeRepeat = mock.calls.length;
  renderer.draw(f.frame);
  assert.equal(mock.calls.filter(c => c.name.startsWith('create')).length, created);
  assert.equal(mock.calls.filter(c => c.name === 'texSubImage3D').length, 2);
  assert.equal(mock.calls.slice(beforeRepeat).filter(c => c.name === 'getError' || c.name === 'getParameter' || c.name === 'readPixels' || c.name === 'finish').length, 0);
  renderer.dispose(); assert.equal(mock.live.size, 0);
});

test('replacement peak is charged while the previous scene and diagnostic frame remain usable', () => {
  const f = fixture(), first = recordingGl(), baseline = new GpuRenderer(first.gl);
  baseline.load(f.scene); const atlas = baseline.stats().requestedGpuBytes; baseline.draw(f.frame);
  const ready = baseline.stats().requestedGpuBytes; baseline.dispose();
  const mock = recordingGl(), renderer = new GpuRenderer(mock.gl, { gpuBytes: ready + atlas - 1 });
  renderer.load(f.scene); renderer.draw(f.frame);
  const before = renderer.stats(), objects = mock.live.size;
  assert.throws(() => renderer.load(f.scene), code('gpu-memory-limit'));
  assert.deepEqual(renderer.stats(), before); assert.equal(mock.live.size, objects);
  assert.equal(renderer.readback().width, 60); assert.equal(renderer.draw(f.frame).sequence, 2);
  renderer.dispose();
});

test('shader/link/allocation failure cleans candidate handles without replacing the old scene', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuRenderer(mock.gl);
  renderer.load(f.scene); renderer.draw(f.frame);
  const before = renderer.stats(), objects = mock.live.size;
  mock.setCompile(false); assert.throws(() => renderer.load(f.scene), code('gpu-shader-compile'));
  assert.equal(mock.live.size, objects);
  assert.deepEqual({ ...renderer.stats(), peakRequestedGpuBytes: before.peakRequestedGpuBytes }, before);
  assert.ok(renderer.stats().peakRequestedGpuBytes > before.requestedGpuBytes);
  mock.setCompile(true); assert.equal(renderer.draw(f.frame).sequence, 2);
  mock.size(61, 40); mock.setComplete(false);
  assert.throws(() => renderer.draw(prepareGpuFrame(f.scene, { ...view, width: 61 })), code('gpu-framebuffer'));
  assert.equal(mock.live.size, objects); assert.deepEqual({ ...renderer.stats(), peakRequestedGpuBytes: before.peakRequestedGpuBytes }, before);
  mock.setComplete(true); mock.size(60, 40); assert.equal(renderer.readback().width, 60);
  renderer.dispose(); assert.equal(mock.live.size, 0);
});

test('viewport/instance limits and empty visible frames preserve defined submission behavior', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuRenderer(mock.gl, { instances: 1 });
  renderer.load(f.scene); assert.throws(() => renderer.draw(f.frame), code('gpu-instance-limit'));
  const empty = prepareGpuFrame(f.scene, { ...view, cameraX: 1048576, cameraY: -1048576 });
  assert.equal(empty.allocations.draws, 0); assert.equal(renderer.draw(empty).drawCalls, 1);
  assert.ok(renderer.readback().kind.every(x => x === 0)); renderer.dispose();
  const mismatch = recordingGl(59, 40), other = new GpuRenderer(mismatch.gl); other.load(f.scene);
  const before = other.stats(); assert.throws(() => other.draw(f.frame), code('gpu-drawing-buffer-size'));
  assert.deepEqual(other.stats(), before); assert.throws(() => other.readback(), code('gpu-no-frame')); other.dispose();
});

test('diagnostic readback flips rows, preserves integer depth/owner, composes sprites, and returns detached buffers', () => {
  const f = fixture(), mock = recordingGl(2, 2), renderer = new GpuRenderer(mock.gl);
  renderer.load(f.scene); const frame = prepareGpuFrame(f.scene, { ...view, width: 2, height: 2 }); renderer.draw(frame);
  mock.setRead((attachment, framebuffer, output) => {
    const terrain = framebuffer === mock.framebuffers[0];
    if (attachment === mock.gl.COLOR_ATTACHMENT0) {
      if (terrain) output.set([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
      else output.set([91, 92, 93, 255], 4);
    } else if (terrain) {
      output.set([-10, 0, 0, 1, -9, 1, 0, 1, 10, 2, 0, 1, -2147483648, -1, 0, 1]);
    } else output.set([12, 4, 0, 1], 4);
  });
  const result = renderer.readback();
  assert.deepEqual([...result.kind], [1, 0, 1, 2]); assert.deepEqual([...result.owner], [2, -1, 0, 4]);
  assert.deepEqual([...result.depth], [10, -2147483648, -10, 12]);
  assert.deepEqual([...result.rgba], [7, 8, 9, 255, ...view.backgroundRgba, 1, 2, 3, 255, 91, 92, 93, 255]);
  result.rgba.fill(0); result.owner.fill(999); result.depth.fill(999); result.kind.fill(99);
  const again = renderer.readback(); assert.equal(again.rgba[0], 7); assert.equal(again.owner[0], 2); assert.equal(again.depth[0], 10); assert.equal(again.kind[0], 1);
  renderer.dispose();
});

test('loss invalidates handles and frames; explicit recovery rebuilds owned uploads and dispose cannot resurrect', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuRenderer(mock.gl);
  renderer.load(f.scene); renderer.draw(f.frame); const generation = renderer.stats().generation;
  const lost = mock.lose(); assert.equal(lost.defaultPrevented, true);
  assert.equal(renderer.stats().state, 'lost'); assert.equal(renderer.stats().requestedGpuBytes, 0);
  assert.equal(renderer.stats().ownedCpuBytes, f.scene.allocations.rasterBytes); assert.ok(renderer.stats().generation > generation);
  assert.throws(() => renderer.draw(f.frame), code('gpu-context-lost')); assert.throws(() => renderer.readback(), code('gpu-context-lost'));
  assert.throws(() => renderer.restore(), code('gpu-context-lost'));
  mock.recover(); renderer.restore(); assert.equal(renderer.stats().state, 'ready');
  assert.throws(() => renderer.readback(), code('gpu-no-frame')); assert.equal(renderer.draw(f.frame).sequence, 2);
  assert.equal(mock.calls.filter(c => c.name === 'texSubImage3D').length, 4);
  renderer.dispose(); const disposed = renderer.stats(); renderer.dispose(); assert.deepEqual(renderer.stats(), disposed);
  assert.equal(disposed.ownedCpuBytes, 0); assert.equal(disposed.requestedGpuBytes, 0); assert.equal(mock.live.size, 0);
  assert.equal(mock.calls.filter(c => c.name === 'useProgram').at(-1)!.args[0], null);
  assert.equal(mock.calls.filter(c => c.name === 'bindVertexArray').at(-1)!.args[0], null);
  assert.throws(() => renderer.restore(), code('gpu-disposed')); assert.throws(() => renderer.load(f.scene), code('gpu-disposed'));
  assert.equal(mock.lose().defaultPrevented, false); assert.deepEqual(renderer.stats(), disposed);
});

test('genuine zero-pixel SHP resources are admitted but never submitted as drawable instances', () => {
  const original = renderFixture(2) as { scene: TerrainScene; batch: SpriteBatch };
  const bytes = new Uint8Array(32), v = new DataView(bytes.buffer);
  v.setUint16(2, 8, true); v.setUint16(4, 8, true); v.setUint16(6, 1, true);
  const atlas = createSpriteAtlas({ assets: [{ id: 'empty', sha256: createHash('sha256').update(bytes).digest('hex'), bytes }],
    frames: [{ id: 'frame', assetId: 'empty', frame: 0 }] });
  const base = original.batch.objects[0]!, batch: SpriteBatch = { atlas, palettes: original.batch.palettes,
    objects: [{ ...base, id: 'empty', x: 5, y: 5 }] };
  const scene = compileGpuScene(original.scene, batch), frame = prepareGpuFrame(scene, view), data = copyGpuSceneData(scene);
  assert.ok(data.rasters.some(r => r.depth.length === 0)); assert.equal(frame.allocations.terrainDraws, frame.allocations.draws);
  const mock = recordingGl(), renderer = new GpuRenderer(mock.gl); renderer.load(scene); renderer.draw(frame); renderer.dispose();
});
