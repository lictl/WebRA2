// SPDX-License-Identifier: GPL-3.0-or-later
// Original real-worker/session plus controlled renderer flow. No actual GPU/art claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TerrainController, canPick } from '../../apps/web/src/terrain-controller.ts';
import { TerrainBridge } from '../../apps/web/src/terrain-bridge.ts';
import { createGpuViewport, type GpuViewport } from '../../apps/web/src/gpu-viewport.ts';
import { importGpuScene } from '../../packages/render/src/gpu-scene.ts';
import { GpuOriginalWorker } from './gpu-worker.fixture.ts';

async function setup() {
  const worker = new GpuOriginalWorker(undefined, true, true), slots = new Map<number, string>();
  const controller = new TerrainController('en', () => new TerrainBridge(worker), {
    async read(slot) { return slots.get(slot) ?? null; }, async write(slot, value) { slots.set(slot, value); }, async remove(slot) { slots.delete(slot); },
  });
  controller.resize(120, 80); controller.select([new File(['original'], 'original.mix')]); await controller.load();
  return { worker, controller };
}
function present(c: TerrainController) {
  const initial = c.state.frame; if (initial?.type !== 'gpu-frame' || !initial.resources || !initial.objectInfo || !initial.voxel?.resources) assert.fail();
  const canvas = Object.assign(new EventTarget(), { width: 0, height: 0 }) as unknown as HTMLCanvasElement;
  let accept!: () => void, disposed = 0, sequence = 0, next = 0, lastFrame = initial.frameId;
  const startup = new Promise<void>(resolve => { accept = resolve; }), callbacks = new Map<number, FrameRequestCallback>();
  const p: GpuViewport = createGpuViewport({ canvas, scene: importGpuScene(initial.resources), objectInfo: initial.objectInfo, worldSummary: initial.summary.world, voxel: initial.voxel.resources,
    onDisplayed: d => c.gpuDisplayed(p, d), onFallback: reason => c.gpuFailed(p, reason) }, {
    createRenderer() { throw Error('wrong renderer'); },
    createCombinedRenderer: () => ({ gl: {} as WebGL2RenderingContext, renderer: {
      load() {}, draw(base, voxel = null) { return { generation: 1, sequence: ++sequence, base, voxel, width: base.viewport.width, height: base.viewport.height, submitted: true, drawCalls: 5, uploadedBytes: 0 }; },
      pick() { return null; }, readback() { throw Error('no cadence readback'); }, dispose() { disposed++; },
    } }), runSelftest: () => startup,
    requestFrame(fn) { const id = ++next; callbacks.set(id, fn); return id; }, cancelFrame(id) { callbacks.delete(id); },
  });
  assert(c.attachGpu(p));
  p.update({ frameId: initial.frameId, camera: c.camera()!, objects: initial.objects, world: initial.world, retiredObjectIds: initial.retiredObjectIds, voxelPlacements: initial.voxel.placements });
  const off = c.subscribe(state => {
    const f = state.frame; if (f?.type === 'gpu-frame' && f.frameId !== lastFrame && !disposed) {
      lastFrame = f.frameId; p.update({ frameId: f.frameId, camera: c.camera()!, objects: f.objects, world: f.world, retiredObjectIds: f.retiredObjectIds, voxelPlacements: f.voxel!.placements });
    }
  });
  return { p, canvas, off, disposed: () => disposed, async start() { accept(); await Promise.resolve(); },
    flush() { const ready = [...callbacks.values()]; callbacks.clear(); for (const cb of ready) cb(0); } };
}
async function settle(predicate: () => boolean) { for (let i = 0; i < 50 && !predicate(); i++) await new Promise(resolve => setImmediate(resolve)); assert(predicate()); }

test('controller drops both resident transfer packets and carries real movement/save/replay across startup and CPU fallback', async () => {
  const { controller: c, worker } = await setup(); await c.setRenderer('gpu'); const t = present(c);
  const f = c.state.frame; if (f?.type !== 'gpu-frame') assert.fail();
  assert.equal(f.resources, null); assert.equal(f.objectInfo, null); assert.equal(f.voxel!.resources, null); assert(!canPick(c.state, 40, 20));
  c.setPlayer(1); c.selectEntities([2]); await c.order(5, 5); await c.step(4); c.pan(20, 10);
  assert.equal(c.state.gpuDisplayedFrameId, 0); await t.start(); t.flush(); assert.equal(c.state.gpuDisplayedFrameId, c.state.frame!.frameId);
  const before = c.state.frame!.world!.stateHash, desired = c.camera(); await c.saveWorld(); await c.order(); await c.step();
  await c.loadWorld(); t.flush(); assert.equal(c.state.frame!.world!.stateHash, before); await c.verifyWorld(); assert.equal(c.state.replayHash, before);
  t.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); await settle(() => c.state.frame?.type === 'frame' && !c.state.busy);
  assert.equal(c.state.frame!.world!.stateHash, before); assert.deepEqual(c.state.frame!.camera, desired); assert.equal(c.state.files, 1); assert.equal(worker.terminated, 0); assert.equal(t.disposed(), 1);
  await c.setRenderer('gpu'); if (c.state.frame?.type !== 'gpu-frame') assert.fail(); assert(c.state.frame.voxel?.resources);
  const restarted = present(c); await restarted.start(); restarted.flush(); assert.equal(c.state.frame.voxel!.resources, null); assert.equal(c.state.frame.world!.stateHash, before);
  restarted.off(); t.off(); c.dispose(); assert.equal(restarted.disposed(), 1);
});

test('replacing on-device files aborts a pending presenter and old completion cannot switch the new scene', async () => {
  const { controller: c } = await setup(); await c.setRenderer('gpu'); const t = present(c);
  c.select([new File(['replacement'], 'replacement.mix')]); await t.start(); t.flush();
  assert.equal(c.state.phase, 'selected'); assert.equal(c.state.frame, null); assert.equal(c.state.files, 1); assert.equal(t.disposed(), 1);
  assert.equal(c.state.rendererNotice, 'rendererCpu'); t.off(); c.dispose();
});
