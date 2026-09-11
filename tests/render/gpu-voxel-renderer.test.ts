// SPDX-License-Identifier: GPL-3.0-or-later
// Original GL call/ownership tests; these do not execute GLSL or claim GPU pixel parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GpuVoxelRenderer } from '../../packages/render/src/gpu-voxel-renderer.ts';
import { createGpuVoxelScene, prepareGpuVoxelFrame, copyGpuVoxelSceneData, copyGpuVoxelFrameData } from '../../packages/render/src/gpu-voxel-policy.ts';

interface Handle { id: number; kind: string }
interface Call { name: string; args: unknown[] }
function recordingGl(width = 24, height = 24) {
  const calls: Call[] = [], live = new Set<Handle>(), constants = new Map<string, number>(), canvas = new EventTarget();
  let next = 1, lost = false, compile = true, complete = true, attachment = 0;
  let read: ((attachment: number, output: Uint32Array | Float32Array) => void) | null = null;
  const api: Record<string, unknown> = { canvas, drawingBufferWidth: width, drawingBufferHeight: height };
  const gl = new Proxy(api, { get(target, name: string) {
    if (name in target) return target[name];
    if (/^[A-Z0-9_]+$/.test(name)) { if (!constants.has(name)) constants.set(name, next++); return constants.get(name); }
    return target[name] = (...args: unknown[]) => {
      calls.push({ name, args: args.map(v => ArrayBuffer.isView(v) && !(v instanceof DataView) ? (v as Uint8Array).slice() : v) });
      if (name === 'getContextAttributes') return { alpha: true, antialias: false, premultipliedAlpha: false };
      if (name === 'isContextLost') return lost;
      if (name === 'getParameter') { assert.equal(args[0], gl.MAX_TEXTURE_SIZE); return 4096; }
      if (name.startsWith('create')) { const value = { id: next++, kind: name }; live.add(value); return value; }
      if (name.startsWith('delete')) { live.delete(args[0] as Handle); return; }
      if (name === 'getShaderParameter') return compile;
      if (name === 'getProgramParameter') return true;
      if (name === 'getUniformLocation') return { program: args[0], name: args[1] };
      if (name === 'checkFramebufferStatus') return complete ? gl.FRAMEBUFFER_COMPLETE : gl.FRAMEBUFFER_UNSUPPORTED;
      if (name === 'getError') return gl.NO_ERROR;
      if (name === 'readBuffer') attachment = args[0] as number;
      if (name === 'readPixels') { const out = args[6] as Uint32Array | Float32Array; out.fill(0); if (attachment === gl.COLOR_ATTACHMENT1) for (let i = 0; i < out.length; i += 4) out[i] = 0xffffffff; read?.(attachment, out); }
      if (name === 'finish' || name === 'getBufferSubData') throw Error('unbounded synchronization');
    };
  } }) as unknown as WebGL2RenderingContext;
  return { gl, live, calls,
    size(w: number, h: number) { api.drawingBufferWidth = w; api.drawingBufferHeight = h; },
    lose() { lost = true; live.clear(); const event = new Event('webglcontextlost', { cancelable: true }); canvas.dispatchEvent(event); return event; },
    recover() { lost = false; canvas.dispatchEvent(new Event('webglcontextrestored')); },
    compile(value: boolean) { compile = value; }, complete(value: boolean) { complete = value; },
    read(value: typeof read) { read = value; },
  };
}
function fixture(width = 24, height = 24) {
  const rgba = new Uint8Array(1024); rgba.set([23, 47, 61, 255], 4);
  const scene = createGpuVoxelScene({ parts: [{ id: 'part', voxels: new Uint8Array([0, 0, 0, 1, 7]), modelMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0] }], palettes: [{ id: 'palette', rgba, remap: null, transparentIndex: 0 }] });
  const instances = [{ id: 'actor', partId: 'part', paletteId: 'palette', modelToView: [4, 0, 0, 10, 0, 4, 0, 10, 0, 0, 1, 10] }];
  return { scene, frame: prepareGpuVoxelFrame(scene, { instances, width, height }), instances };
}
const mutations = (calls: Call[]) => calls.filter(c => /^(create|texSub|draw|delete)/.test(c.name)).length;

test('voxel resident uploads are owned and steady submission performs two draws without getters or readback', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuVoxelRenderer(mock.gl);
  renderer.load(f.scene); const resident = copyGpuVoxelSceneData(f.scene), uploads = mock.calls.filter(c => c.name === 'texSubImage2D');
  assert.equal(uploads.length, 2); assert.deepEqual(uploads[0]!.args[8], resident.geometry); assert.deepEqual(uploads[1]!.args[8], resident.rgba);
  const packet = copyGpuVoxelFrameData(f.frame); renderer.draw(f.frame, [1, 2, 3, 37]);
  assert.equal(mock.calls.filter(c => c.name === 'drawArrays').length, 2);
  const frameUploads = mock.calls.filter(c => c.name === 'texSubImage2D').slice(2);
  assert.deepEqual((frameUploads[0]!.args[8] as Int32Array).subarray(0, packet.boxes.length), packet.boxes);
  assert.deepEqual((frameUploads[1]!.args[8] as Float32Array).subarray(0, packet.inverses.length), packet.inverses);
  resident.geometry.fill(0); packet.boxes.fill(0); const at = mock.calls.length, receipt = renderer.draw(f.frame);
  assert.equal(receipt.frame, f.frame); assert.equal(receipt.sequence, 2); assert.equal(receipt.uploadedBytes, 0);
  assert.equal(mock.calls.slice(at).filter(c => /^(getError|getParameter|readPixels|finish|texSubImage2D|create)/.test(c.name)).length, 0);
  assert.equal(renderer.stats().ownedCpuBytes, 1032); renderer.dispose(); assert.equal(mock.live.size, 0);
});

test('forged scenes/frames, invalid descriptor data and mismatched canvas fail before mutations', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuVoxelRenderer(mock.gl); let gets = 0;
  assert.throws(() => renderer.load({ ...f.scene }), /scene/); assert.equal(mock.live.size, 0);
  renderer.load(f.scene); renderer.draw(f.frame); const at = mutations(mock.calls);
  assert.throws(() => renderer.draw({ ...f.frame }), /frame/); assert.throws(() => renderer.draw(fixture().frame), /scene/);
  const bg = new Proxy([4, 3, 2, 37], { get() { gets++; throw Error('raw get'); } }); renderer.draw(f.frame, bg); assert.equal(gets, 0);
  const before = mutations(mock.calls); const invalid = [0, 0, 0, 255]; Object.defineProperty(invalid, '0', { get() { gets++; return 0; } });
  assert.throws(() => renderer.draw(f.frame, invalid), /background/); assert.equal(gets, 0); assert.equal(mutations(mock.calls), before);
  mock.size(23, 24); assert.throws(() => renderer.draw(f.frame), /drawing-buffer/); assert.equal(mutations(mock.calls), before); assert.ok(before > at); renderer.dispose();
  const cap = { get gpuBytes() { gets++; return 1; } }; assert.throws(() => new GpuVoxelRenderer(recordingGl().gl, cap), /limits/); assert.equal(gets, 0);
});

test('replacement peak and full staging rejection preserve an earlier submitted frame', () => {
  const f = fixture(), a = recordingGl(), baseline = new GpuVoxelRenderer(a.gl); baseline.load(f.scene); const resident = baseline.stats().requestedGpuBytes;
  baseline.draw(f.frame); const ready = baseline.stats().requestedGpuBytes; baseline.dispose();
  const mock = recordingGl(), renderer = new GpuVoxelRenderer(mock.gl, { gpuBytes: ready + resident - 1 }); renderer.load(f.scene); renderer.draw(f.frame);
  const state = renderer.stats(), count = mock.live.size, at = mutations(mock.calls); assert.throws(() => renderer.load(f.scene), /gpu-budget/);
  assert.deepEqual(renderer.stats(), state); assert.equal(mock.live.size, count); assert.equal(mutations(mock.calls), at); assert.equal(renderer.draw(f.frame).sequence, 2); renderer.dispose();
  const small = recordingGl(), bounded = new GpuVoxelRenderer(small.gl, { stagingBytes: 1024 }); assert.throws(() => bounded.load(f.scene), /staging-budget/); assert.equal(small.live.size, 0); bounded.dispose();
});

test('failed shaders preserve the resident scene; failed target construction cleans only the candidate handles', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuVoxelRenderer(mock.gl); renderer.load(f.scene); renderer.draw(f.frame); const count = mock.live.size;
  mock.compile(false); assert.throws(() => renderer.load(f.scene), /shader/); assert.equal(mock.live.size, count); mock.compile(true); assert.equal(renderer.draw(f.frame).sequence, 2);
  const next = prepareGpuVoxelFrame(f.scene, { instances: f.instances, width: 25, height: 24 }); mock.size(25, 24); mock.complete(false);
  assert.throws(() => renderer.draw(next), /framebuffer/); assert.equal(mock.live.size, count); assert.throws(() => renderer.readback(), /no-frame/);
  mock.complete(true); mock.size(24, 24); renderer.draw(f.frame); renderer.dispose(); assert.equal(mock.live.size, 0);
});

test('diagnostic planes flip rows; interaction reads only owner/depth for the exact latest sequence', () => {
  const f = fixture(2, 2), mock = recordingGl(2, 2), renderer = new GpuVoxelRenderer(mock.gl); renderer.load(f.scene); renderer.draw(f.frame);
  const bits = (value: number) => new Uint32Array(new Float32Array([value]).buffer)[0]!;
  mock.read((attachment, out) => { if (attachment === mock.gl.COLOR_ATTACHMENT0) out.set([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 0, 0, 0, 0]);
    else out.set([0, bits(10), 0, 0, 0, bits(11), 0, 0, 0, bits(12), 0, 0, 0xffffffff, 0, 0, 0]); });
  const result = renderer.readback(); assert.deepEqual([...result.owner], [0, 0xffffffff, 0, 0]); assert.deepEqual([...result.depth], [12, -Infinity, 10, 11]);
  assert.deepEqual([...result.rgba], [7, 8, 9, 255, 0, 0, 0, 0, 1, 2, 3, 255, 4, 5, 6, 255]);
  mock.read((_attachment, out) => { out[0] = 0; out[1] = bits(11); }); const at = mock.calls.length;
  const hit = renderer.pick(.5, 1.5, 1); assert.equal(hit?.instanceId, 'actor'); assert.equal(hit?.depth, 11);
  const reads = mock.calls.slice(at).filter(c => c.name === 'readPixels'); assert.equal(reads.length, 1); assert.ok(reads.every(c => c.args[0] === 0 && c.args[1] === 0 && c.args[2] === 1 && c.args[3] === 1));
  renderer.draw(f.frame); const count = mock.calls.filter(c => c.name === 'readPixels').length; assert.equal(renderer.pick(0, 0, 1), null); assert.equal(renderer.pick(-1, 0, 2), null); assert.equal(renderer.pick(0, 0, undefined as unknown as number), null); assert.equal(mock.calls.filter(c => c.name === 'readPixels').length, count);
  renderer.dispose();
});

test('loss retains only owned source, retryable restore rebuilds it, and disposal cannot resurrect', () => {
  const f = fixture(), mock = recordingGl(), renderer = new GpuVoxelRenderer(mock.gl); renderer.load(f.scene); renderer.draw(f.frame);
  assert.equal(mock.lose().defaultPrevented, true); assert.equal(renderer.stats().state, 'lost'); assert.equal(renderer.stats().requestedGpuBytes, 0); assert.equal(renderer.stats().ownedCpuBytes, 1032);
  assert.throws(() => renderer.draw(f.frame), /context-lost/); assert.throws(() => renderer.restore(), /restore/); mock.recover(); mock.compile(false);
  assert.throws(() => renderer.restore(), /shader/); assert.equal(mock.live.size, 0); assert.equal(renderer.stats().state, 'lost'); mock.compile(true); renderer.restore();
  assert.equal(renderer.stats().generation, 2); assert.throws(() => renderer.readback(), /no-frame/); renderer.draw(f.frame); renderer.dispose(); renderer.dispose(); assert.equal(mock.live.size, 0);
  assert.throws(() => renderer.restore(), /restore/); assert.throws(() => renderer.draw(f.frame), /disposed/);
  assert.equal(mock.calls.filter(c => c.name === 'getExtension').length, 0);
});
