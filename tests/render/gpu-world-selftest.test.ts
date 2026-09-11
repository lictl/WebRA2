// SPDX-License-Identifier: GPL-3.0-or-later
// Original controlled-async lifecycle tests. Fake GL is not shader/browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runGpuWorldSelftest, type GpuWorldSelftestOptions, type GpuWorldSelftestPlatform, type GpuWorldSelftestRenderer } from '../../packages/render/src/gpu-world-selftest.ts';
import { gpuWorldSelftestCases } from '../../packages/render/src/gpu-world-selftest-fixtures.ts';
import { createGpuPicker, type GpuPicker } from '../../packages/render/src/gpu-picking.ts';
import { pickGpuVoxelFrame, type GpuVoxelFrame } from '../../packages/render/src/gpu-voxel-policy.ts';
import type { GpuFrame } from '../../packages/render/src/gpu-contracts.ts';

function fixture() {
  let clock = 0, nextTimer = 0, sequence = 0, current: GpuFrame | null = null, voxel: GpuVoxelFrame | null = null, picker: GpuPicker | null = null;
  const timers = new Map<number, { due: number; callback(): void }>(), fences = new Set<WebGLSync>();
  const stats = { loads: 0, draws: 0, reads: 0, defaultReads: 0, picks: 0, deletes: 0, waits: 0 };
  const canvas = { width: 960, height: 640 }, abort = new AbortController(), expected = gpuWorldSelftestCases();
  let fault = '', ready = true, lost = false;
  const env: GpuWorldSelftestPlatform = {
    now: () => clock,
    setTimer(callback, ms) { const id = ++nextTimer; timers.set(id, { due: clock + ms, callback }); return id as unknown as ReturnType<typeof setTimeout>; },
    clearTimer(id) { timers.delete(id as unknown as number); },
  };
  function hit(x: number, y: number) {
    const b = picker!.pick(current!, x, y), v = pickGpuVoxelFrame(voxel!, x, y);
    return v && (!b || v.depth > b.depth) ? { kind: 'voxel' as const, ...v } : b;
  }
  function read() {
    const { width, height } = current!.viewport, count = width * height, c = expected[width === 16 ? 0 : 1]!;
    const rgba = new Uint8Array(count * 4), kind = new Uint8Array(count), owner = new Int32Array(count).fill(-1), depthWord = new Uint32Array(count), depth = new Float64Array(count).fill(-Infinity);
    const asFloat = new Float32Array(depthWord.buffer);
    for (let i = 0; i < count; i++) {
      rgba.set(c.expected[i]!.rgba, i * 4); const h = hit(i % width, Math.floor(i / width)); if (!h) continue;
      kind[i] = h.kind === 'voxel' ? 3 : h.kind === 'terrain' ? 1 : 2; owner[i] = h.kind === 'voxel' ? h.owner : 0; depth[i] = h.depth;
      if (h.kind === 'voxel') asFloat[i] = h.depth; else depthWord[i] = h.depth >>> 0;
    }
    return { sequence, width, height, rgba, kind, owner, depthWord, depth };
  }
  const renderer: GpuWorldSelftestRenderer = {
    load(base) { stats.loads++; picker?.dispose(); picker = createGpuPicker(base); sequence = 0; if (fault === 'load') throw Error('driver-load'); },
    draw(base, v) { stats.draws++; current = base; voxel = v; sequence++; if (fault === 'slow') clock += 6000;
      if (fault === 'draw') throw Error('driver-draw');
      return { sequence, base, voxel, width: canvas.width, height: canvas.height, submitted: fault === 'receipt' ? false as true : true }; },
    readback() {
      stats.reads++; const out = read();
      if (fault === 'pixel') out.rgba[0] = out.rgba[0]! ^ 1;
      if (fault === 'plane') out.kind = new Uint8Array(999999);
      if (fault === 'owner') out.owner[40] = 123;
      if (fault === 'depth-word') out.depthWord[40] = 100;
      if (fault === 'sequence') out.sequence++;
      return out;
    },
    pick(_seq, x, y) { stats.picks++; return fault === 'pick' ? {} : hit(x, y); },
  };
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, RGBA: 5, UNSIGNED_BYTE: 6, NO_ERROR: 0,
    fenceSync() { if (fault === 'fence-null') return null; const fence = {} as WebGLSync; fences.add(fence); return fence; },
    clientWaitSync(_fence: WebGLSync, flags: number, timeout: number) { assert.equal(flags, 0); assert.equal(timeout, 0); stats.waits++; return fault === 'fence-failed' ? 999 : ready ? 2 : 4; },
    deleteSync(fence: WebGLSync) { assert.ok(fences.delete(fence)); stats.deletes++; },
    flush() { if (fault === 'flush') throw Error('driver-flush'); }, isContextLost: () => lost, getError: () => fault === 'gl-error' ? 999 : 0,
    readPixels(_x: number, _y: number, width: number, height: number, _format: number, _type: number, output: Uint8Array) {
      stats.defaultReads++; const data = read().rgba;
      for (let y = 0; y < height; y++) output.set(data.subarray(y * width * 4, (y + 1) * width * 4), (height - 1 - y) * width * 4);
      if (fault === 'default') output[0] = output[0]! ^ 1;
    },
  } as unknown as GpuWorldSelftestOptions['gl'];
  return {
    stats, timers, fences, abort, canvas, setFault(value: string) { fault = value; }, ready(value: boolean) { ready = value; }, lose() { lost = true; },
    run(ms?: number) { return runGpuWorldSelftest({ canvas, gl, renderer, signal: abort.signal, ...(ms === undefined ? {} : { deadlineMs: ms }) }, env); },
    async advance(ms: number) {
      const end = clock + ms;
      for (;;) {
        const next = [...timers].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0]; if (!next) break;
        clock = next[1].due; timers.delete(next[0]); next[1].callback(); await Promise.resolve();
      }
      clock = end; await Promise.resolve();
    },
    clean() { assert.equal(timers.size, 0); assert.equal(fences.size, 0); picker?.dispose(); },
  };
}

test('startup checks two scenes, four cold draws, exact planes/default alpha and28 independent picks', async () => {
  const f = fixture(); assert.deepEqual(await f.run(), { policy: 'webra2-gpu-world-startup-1', cases: 2, pixels: 1024, picks: 28 });
  assert.deepEqual(f.stats, { loads: 2, draws: 4, reads: 2, defaultReads: 2, picks: 28, deletes: 2, waits: 2 }); f.clean();
});

test('pending fences use one bounded timer chain and abort deletes all work with no later load/readback', async () => {
  const f = fixture(); f.ready(false); const pending = f.run(); assert.equal(f.fences.size, 1); assert.equal(f.timers.size, 2);
  await f.advance(16); assert.equal(f.stats.waits, 3); f.abort.abort(); await assert.rejects(pending, /aborted/);
  assert.equal(f.stats.loads, 1); assert.equal(f.stats.reads, 0); f.clean(); await f.advance(6000); assert.equal(f.stats.loads, 1);
});

test('total deadline rejects pending or synchronous-over-budget work; failed startup cannot publish success', async () => {
  const f = fixture(); f.ready(false); const pending = f.run(17); const rejected = assert.rejects(pending, /timeout/);
  await f.advance(17); await rejected; assert.equal(f.stats.draws, 1); f.clean();
  const slow = fixture(); slow.setFault('slow'); await assert.rejects(slow.run(), /timeout/); assert.equal(slow.stats.reads, 0); slow.clean();
});

test('context loss, malformed receipts and every diagnostic mismatch fail with no leaked fence/timer', async () => {
  for (const fault of ['load', 'draw', 'receipt', 'fence-null', 'fence-failed', 'flush', 'pixel', 'plane', 'owner', 'depth-word', 'sequence', 'pick', 'default', 'gl-error']) {
    const f = fixture(); f.setFault(fault); await assert.rejects(f.run(), Error, fault); f.clean();
  }
  const f = fixture(); f.ready(false); const pending = f.run(); f.lose(); await f.advance(8); await assert.rejects(pending, /context-lost/); f.clean();
});

test('pre-aborted and invalid deadline requests perform no scene or driver work', async () => {
  for (const ms of [0, -1, Infinity, NaN, 5001]) { const f = fixture(); await assert.rejects(f.run(ms), /deadline/); assert.equal(f.stats.loads, 0); f.clean(); }
  const f = fixture(); f.abort.abort(); await assert.rejects(f.run(), /aborted/); assert.equal(f.stats.draws, 0); f.clean();
});

test('successful delayed fence completion clears both timers before continuing the next scene', async () => {
  const f = fixture(); f.ready(false); const pending = f.run(); await f.advance(8); f.ready(true); await f.advance(8);
  assert.equal((await pending).picks, 28); assert.equal(f.stats.loads, 2); f.clean();
});
