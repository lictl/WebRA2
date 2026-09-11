// SPDX-License-Identifier: GPL-3.0-or-later
// Original resource/call/lifecycle fixtures. Mock readbacks do not execute GLSL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GpuCombinedRenderer, GpuCombinedRendererError } from '../../packages/render/src/gpu-combined-renderer.ts';
import { GpuRenderer, createGpuResourceBudget, registerGpuResourceOwner, checkGpuResourceBudget, commitGpuResourceBudget, releaseGpuResourceOwner, gpuResourceBudgetStats } from '../../packages/render/src/gpu-renderer.ts';
import { GpuVoxelRenderer } from '../../packages/render/src/gpu-voxel-renderer.ts';
import { assertGpuScene, assertGpuFrame, compileGpuScene, prepareGpuFrame } from '../../packages/render/src/gpu-scene.ts';
import { createGpuVoxelScene, prepareGpuVoxelFrame } from '../../packages/render/src/gpu-voxel-policy.ts';
// @ts-expect-error Original browser-loadable JS fixtures.
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
        if (name === 'getContextAttributes') return { alpha: true, antialias: false, premultipliedAlpha: false };
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
          if (readBuffer === gl.COLOR_ATTACHMENT1) for (let i = 0; i < output.length; i += 4) { output[i] = 0; output[i + 1] = 0xffffffff; output[i + 3] = 1; }
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
const view = { cameraX: 0, cameraY: 0, zoom: 1 as const, width: 24, height: 24, backgroundRgba: [9, 19, 29, 37] as const };
function fixture() {
  const original = renderFixture(2), base = compileGpuScene(original.scene, original.batch), baseFrame = prepareGpuFrame(base, view);
  const rgba = new Uint8Array(1024); rgba.set([31, 73, 109, 255], 4);
  const voxel = createGpuVoxelScene({ parts: [{ id: 'cube', voxels: new Uint8Array([0, 0, 0, 1, 7]), modelMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0] }], palettes: [{ id: 'colors', rgba, remap: null, transparentIndex: 0 }] });
  const instances = [{ id: 'voxel-actor', partId: 'cube', paletteId: 'colors', modelToView: [4, 0, 0, 10, 0, 4, 0, 10, 0, 0, 1, 10] }];
  const voxelFrame = prepareGpuVoxelFrame(voxel, { instances, width: view.width, height: view.height });
  return { base, baseFrame, voxel, voxelFrame, instances };
}
const bits = (value: number) => new Uint32Array(new Float32Array([value]).buffer)[0]!;
const failCode = (code: string) => (error: unknown) => error instanceof GpuCombinedRendererError && error.code === code && error.fallbackRequired;
const mutationCount = (calls: Call[]) => calls.filter(c => /^(create|texSub|draw|delete)/.test(c.name)).length;

test('combined frame submits offscreen layers, one winner and one default delivery, without normal readback', () => {
  const f = fixture(), mock = recordingGl(24, 24), renderer = new GpuCombinedRenderer(mock.gl);
  renderer.load(f.base, f.voxel); const at = mock.calls.length, receipt = renderer.draw(f.baseFrame, f.voxelFrame);
  assert.equal(receipt.base, f.baseFrame); assert.equal(receipt.voxel, f.voxelFrame); assert.equal(receipt.sequence, 1); assert.equal(receipt.generation, 1);
  const calls = mock.calls.slice(at); assert.equal(calls.filter(c => c.name === 'drawArrays').length, 3); // voxel + winner + delivery; terrain/SHP are instanced.
  assert.equal(calls.filter(c => c.name === 'drawBuffers' && (c.args[0] as unknown[])[0] === mock.gl.BACK).length, 1);
  assert.equal(calls.filter(c => c.name === 'readPixels' || c.name === 'finish').length, 0);
  const before = mock.calls.length; const next = renderer.draw(f.baseFrame, f.voxelFrame); assert.equal(next.sequence, 2);
  assert.equal(mock.calls.slice(before).filter(c => /^(getError|getParameter|readPixels|create|finish)/.test(c.name)).length, 0);
  renderer.dispose(); assert.equal(mock.live.size, 0); assert.equal(renderer.stats().requestedGpuBytes, 0); assert.equal(renderer.stats().ownedCpuBytes, 0);
});

test('genuine no-copy assertions and opaque layer receipts reject clones, other contexts, replacement and size changes', () => {
  const f = fixture(), mock = recordingGl(24, 24), base = new GpuRenderer(mock.gl), voxel = new GpuVoxelRenderer(mock.gl);
  assert.doesNotThrow(() => { assertGpuScene(f.base); assertGpuFrame(f.baseFrame); });
  assert.throws(() => assertGpuScene({ ...f.base }), /identity/); assert.throws(() => assertGpuFrame({ ...f.baseFrame }), /identity/);
  base.load(f.base); voxel.load(f.voxel); const b = base.drawLayer(f.baseFrame), v = voxel.drawLayer(f.voxelFrame);
  assert.equal(b.drawCalls, base.draw(f.baseFrame).drawCalls - 1);
  assert.throws(() => base.bindLayer(b, mock.gl), /layer-receipt/);
  const b2 = base.drawLayer(f.baseFrame); assert.doesNotThrow(() => base.bindLayer(b2, mock.gl)); assert.doesNotThrow(() => voxel.bindLayer(v, mock.gl));
  const before = mutationCount(mock.calls);
  assert.throws(() => base.bindLayer({ ...b2 }, mock.gl), /layer-receipt/); assert.throws(() => voxel.bindLayer({ ...v }, mock.gl), /layer-receipt/);
  assert.throws(() => base.bindLayer(b2, recordingGl().gl), /layer-receipt/); assert.throws(() => voxel.bindLayer(v, recordingGl().gl), /layer-receipt/);
  assert.equal(mutationCount(mock.calls), before);
  voxel.draw(f.voxelFrame); assert.throws(() => voxel.bindLayer(v, mock.gl), /layer-receipt/);
  base.dispose(); voxel.dispose(); assert.equal(mock.live.size, 0);
});

test('compound preflight refuses foreign scenes, mismatched layers and forged frames before any mutation', () => {
  const f = fixture(), mock = recordingGl(24, 24), renderer = new GpuCombinedRenderer(mock.gl); renderer.load(f.base, f.voxel); const receipt = renderer.draw(f.baseFrame, f.voxelFrame), at = mutationCount(mock.calls);
  const other = fixture(); assert.throws(() => renderer.draw(other.baseFrame, f.voxelFrame), failCode('scene')); assert.equal(mutationCount(mock.calls), at);
  assert.equal(renderer.pick(receipt.sequence, 0, 0), null); assert.equal(renderer.stats().state, 'failed');
  renderer.restore(); renderer.draw(f.baseFrame, f.voxelFrame); const before = mutationCount(mock.calls);
  assert.throws(() => renderer.draw({ ...f.baseFrame }, f.voxelFrame), failCode('operation')); assert.equal(mutationCount(mock.calls), before);
  renderer.restore(); const wrongSize = prepareGpuVoxelFrame(f.voxel, { instances: f.instances, width: 25, height: 24 });
  const start = mutationCount(mock.calls); assert.throws(() => renderer.draw(f.baseFrame, wrongSize), failCode('size')); assert.equal(mutationCount(mock.calls), start);
  renderer.dispose(); assert.equal(mock.live.size, 0);
});

test('displayed one-pixel picks resolve exact frames, signed base depths and voxel float bits; stale picks never read', () => {
  const f = fixture(), mock = recordingGl(24, 24), renderer = new GpuCombinedRenderer(mock.gl); renderer.load(f.base, f.voxel); const receipt = renderer.draw(f.baseFrame, f.voxelFrame);
  mock.setRead((_a, _f, out) => out.set([3, 0, bits(11.25), 1])); const start = mock.calls.length;
  assert.deepEqual(renderer.pick(receipt.sequence, 10.75, 11.25), { kind: 'voxel', instanceId: 'voxel-actor', partId: 'cube', voxelOrdinal: 0, x: 0, y: 0, z: 0, colorIndex: 1, normalIndex: 7, depth: 11.25, owner: 0 });
  const reads = mock.calls.slice(start).filter(c => c.name === 'readPixels'); assert.equal(reads.length, 1); assert.deepEqual(reads[0]!.args.slice(0, 4), [10, 12, 1, 1]);
  mock.setRead((_a, _f, out) => out.set([1, 0, -2097151 >>> 0, 1])); const terrain = renderer.pick(receipt.sequence, 0, 0); assert.equal(terrain?.kind, 'terrain'); assert.equal(terrain?.depth, -2097151);
  const calls = mock.calls.length; assert.equal(renderer.pick(0, 0, 0), null); assert.equal(renderer.pick(receipt.sequence, -1, 0), null); assert.equal(renderer.pick(receipt.sequence, 0, Infinity), null); assert.equal(mock.calls.length, calls + 3); // only isContextLost
  renderer.draw(f.baseFrame, f.voxelFrame); const after = mock.calls.filter(c => c.name === 'readPixels').length; assert.equal(renderer.pick(receipt.sequence, 0, 0), null); assert.equal(mock.calls.filter(c => c.name === 'readPixels').length, after);
  renderer.dispose();
});

test('diagnostics expose exact integer words and top-left colors; invalid driver flags force complete fallback', () => {
  const f = fixture(), mock = recordingGl(24, 24), renderer = new GpuCombinedRenderer(mock.gl); renderer.load(f.base, f.voxel); const receipt = renderer.draw(f.baseFrame, f.voxelFrame);
  mock.setRead((attachment, _f, out) => { if (attachment === mock.gl.COLOR_ATTACHMENT0) { for (let i = 0; i < out.length; i += 4) out.set([i / 4 % 256, 19, 29, 37], i); }
    else for (let i = 0; i < out.length; i += 4) out.set([3, 0, bits(-0), 1], i);
  });
  const read = renderer.readback(); assert.equal(read.sequence, receipt.sequence); assert.equal(read.rgba[0], 24 * 23 % 256); assert.equal(read.rgba[3], 37); assert.equal(read.depthWord[0], 0x80000000); assert.equal(Object.is(read.depth[0], -0), true);
  for (const words of [[0, 0xffffffff, 0, 0], [3, 0, bits(Infinity), 1], [3, 0, bits(2097152.25), 1], [1, 0, 2097152, 1]]) {
    mock.setRead((_a, _f, out) => out.set(words)); assert.throws(() => renderer.pick(renderer.stats().sequence, 0, 0), failCode('invalid-depth')); assert.equal(renderer.stats().state, 'failed');
    const count = mock.calls.filter(c => c.name === 'readPixels').length; assert.equal(renderer.pick(receipt.sequence, 0, 0), null); assert.equal(mock.calls.filter(c => c.name === 'readPixels').length, count); renderer.restore(); renderer.draw(f.baseFrame, f.voxelFrame);
  }
  renderer.dispose(); assert.equal(mock.live.size, 0);
});

test('aggregate ledger authenticates context/owners and rejects combined replacement peaks before allocation', () => {
  const mock = recordingGl(24, 24), other = recordingGl(24, 24), budget = createGpuResourceBudget(mock.gl, 100, 100), a = registerGpuResourceOwner(budget, mock.gl), b = registerGpuResourceOwner(budget, mock.gl);
  commitGpuResourceBudget(budget, a, 40, 20); commitGpuResourceBudget(budget, b, 30, 35);
  assert.throws(() => checkGpuResourceBudget(budget, a, 71, 20), /aggregate-memory/); assert.throws(() => checkGpuResourceBudget(budget, a, 40, 66), /aggregate-staging/);
  assert.throws(() => registerGpuResourceOwner(budget, other.gl), /budget-context/); assert.throws(() => checkGpuResourceBudget({ ...budget }, a, 0, 0), /budget-identity/); assert.throws(() => checkGpuResourceBudget(budget, {}, 0, 0), /budget-owner/);
  checkGpuResourceBudget(budget, a, 70, 65); assert.deepEqual(gpuResourceBudgetStats(budget), { requestedGpuBytes: 70, ownedCpuBytes: 55, peakRequestedGpuBytes: 100, peakStagingBytes: 100 }); releaseGpuResourceOwner(budget, a); releaseGpuResourceOwner(budget, b);
  const f = fixture(), first = new GpuCombinedRenderer(mock.gl); first.load(f.base, f.voxel); first.draw(f.baseFrame, f.voxelFrame); const cost = first.stats(); first.dispose();
  const bounded = new GpuCombinedRenderer(other.gl, { gpuBytes: cost.peakRequestedGpuBytes - 1 }); bounded.load(f.base, f.voxel);
  assert.throws(() => bounded.draw(f.baseFrame, f.voxelFrame), failCode('operation')); assert.equal(bounded.stats().state, 'failed'); assert.ok(bounded.stats().requestedGpuBytes < cost.peakRequestedGpuBytes); bounded.dispose(); assert.equal(other.live.size, 0);
});

test('loss/restore, resize, scene replacement, null voxel and double disposal invalidate the old presentation', () => {
  const f = fixture(), mock = recordingGl(24, 24), renderer = new GpuCombinedRenderer(mock.gl); renderer.load(f.base, f.voxel); const first = renderer.draw(f.baseFrame, f.voxelFrame);
  assert.equal(mock.lose().defaultPrevented, true); assert.equal(renderer.stats().state, 'lost'); assert.equal(renderer.stats().requestedGpuBytes, 0);
  assert.throws(() => renderer.pick(first.sequence, 0, 0), failCode('context-lost')); mock.recover(); renderer.restore(); const next = renderer.draw(f.baseFrame, f.voxelFrame); assert.ok(next.generation > first.generation); assert.ok(next.sequence > first.sequence); assert.equal(renderer.pick(first.sequence, 0, 0), null);
  mock.size(25, 24); assert.throws(() => renderer.pick(next.sequence, 0, 0), failCode('resized')); mock.size(24, 24); renderer.restore();
  renderer.load(f.base, null); const start = mock.calls.length, baseOnly = renderer.draw(f.baseFrame); assert.equal(baseOnly.voxel, null); assert.equal(mock.calls.slice(start).filter(c => c.name === 'drawArrays').length, 2);
  const owned = renderer.stats().requestedGpuBytes; renderer.dispose(); renderer.dispose(); assert.ok(owned > 0); assert.equal(mock.live.size, 0); assert.equal(renderer.stats().requestedGpuBytes, 0); assert.throws(() => renderer.restore(), failCode('restore'));
});

test('lower limits snapshot descriptor values without property gets and reject accessors before allocation', () => {
  const mock = recordingGl(24, 24); let gets = 0;
  const renderer = new GpuCombinedRenderer(mock.gl, new Proxy({ gpuBytes: 1000000 }, { get() { gets++; throw Error('get'); } })); renderer.dispose(); assert.equal(gets, 0);
  assert.throws(() => new GpuCombinedRenderer(mock.gl, { get gpuBytes() { gets++; return 20; } }), failCode('limits')); assert.equal(gets, 0); assert.equal(mock.live.size, 0);
});

test('emitted integer depth encoding and strict word ordering cover the full base range and adjacent float32 boundaries', () => {
  const f = fixture(), mock = recordingGl(24, 24), renderer = new GpuCombinedRenderer(mock.gl); renderer.load(f.base, f.voxel); renderer.draw(f.baseFrame, f.voxelFrame);
  const shader = mock.calls.filter(c => c.name === 'shaderSource').map(c => c.args[1] as string).find(s => s.includes('uint integerBits'))!;
  // Evaluate only the emitted integer-expression bodies under JS uint32 operations.
  // This verifies the encoded comparator algebra; actual GLSL execution is a separate Chrome gate.
  const body = (name: string) => { const from = shader.indexOf('{', shader.indexOf(name + '(')); let braces = 1, end = from + 1; for (; braces; end++) { if (shader[end] === '{') braces++; if (shader[end] === '}') braces--; } return shader.slice(from + 1, end - 1)
    .replace(/\b(?:uint|int)\s+/g, 'let ').replace(/\buint\(/g, '(').replace(/(0x[0-9a-f]+|\d+)u\b/g, '$1').replace(/>>=/g, '>>>='); };
  const encode = new Function('v', body('integerBits')) as (v: number) => number;
  const order = new Function('w', body('ordered')) as (v: number) => number;
  const compare = new Function('w', 'base', 'integerBits', 'ordered', body('greater')) as (w: number, base: number, encoder: (v: number) => number, ordering: (v: number) => number) => boolean;
  const asUnsigned = (v: number) => order(v) >>> 0;
  for (let value = -2097151; value <= 2097151; value++) assert.equal(encode(value) >>> 0, bits(value));
  const f32 = new Float32Array(1), word = new Uint32Array(f32.buffer);
  const decode = (v: number) => { word[0] = v; return f32[0]!; };
  for (const base of [-2097151, -1048000, -1000, -1, 0, 1, 1000, 1048000, 2097151]) {
    for (const value of [base, base + .5, base - .5, -0, 0, -2097152, 2097152]) {
      const w = bits(value); assert.equal(compare(w, base, encode, asUnsigned), decode(w) > base);
    }
    const w = bits(base); for (const next of [w - 1, w, w + 1]) if ((next >>> 0 & 0x7fffffff) <= 0x4a000000) assert.equal(compare(next >>> 0, base, encode, asUnsigned), decode(next) > base);
  }
  renderer.dispose();
});

test('diagnostic scratch is included with both resident copies and rejects before any read or output allocation', () => {
  const f = fixture(), mock = recordingGl(100, 100), renderer = new GpuCombinedRenderer(mock.gl, { stagingBytes: 100000 });
  renderer.load(f.base, f.voxel);
  const base = prepareGpuFrame(f.base, { ...view, width: 100, height: 100 }), voxel = prepareGpuVoxelFrame(f.voxel, { instances: f.instances, width: 100, height: 100 });
  renderer.draw(base, voxel); const reads = mock.calls.filter(c => c.name === 'readPixels').length;
  assert.throws(() => renderer.readback(), failCode('operation')); assert.equal(mock.calls.filter(c => c.name === 'readPixels').length, reads); assert.equal(renderer.stats().state, 'failed'); renderer.dispose();
});
