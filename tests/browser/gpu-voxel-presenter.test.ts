// SPDX-License-Identifier: GPL-3.0-or-later
// Original controlled-async presentation tests; shader and game transitions are separate gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGpuViewport, type GpuViewportPlatform, type GpuViewportUpdate, type GpuViewportDisplay, type GpuViewportFailure } from '../../apps/web/src/gpu-viewport.ts';
import { createGpuVoxelLayer } from '../../apps/web/src/gpu-voxel-layer.ts';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { originalWorld } from './world-ui.fixture.ts';
import { originalVoxelResources } from './gpu-voxel.fixture.ts';
import { makeOriginalTerrain, makeOriginalSprites, originalObject } from '../render/gpu-fixtures.ts';
import { compileGpuScene } from '../../packages/render/src/gpu-scene.ts';
import { createTerrainScene } from '../../packages/render/src/terrain-scene.ts';
import { createGpuPicker, type GpuPicker } from '../../packages/render/src/gpu-picking.ts';
import { copyGpuVoxelFrameData, pickGpuVoxelFrame, prepareGpuVoxelFrame, type GpuVoxelFrame } from '../../packages/render/src/gpu-voxel-policy.ts';
import { voxelWorldProjection } from '../../apps/web/src/world-voxel-compositor.ts';
import type { ObjectInfo } from '../../apps/web/src/object-protocol.ts';
import type { GpuFrame } from '../../packages/render/src/gpu-contracts.ts';

const camera = { cameraX: 170, cameraY: 50, zoom: 1 as const, width: 60, height: 40 };
class Canvas extends EventTarget { width = 0; height = 0; ownerDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' }); }
function setup() {
  const session = new WorldSession(originalWorld()), resources = originalVoxelResources(session.summary.modelHash), objects = [originalObject({ id: 'object-0' })];
  const info: ObjectInfo[] = [{ id: 'object-0', typeId: 'type-0', name: 'Original sprite', family: 'unit', owner: 'Original player', x: 1, y: 3, frame: 0, format: 'shp', voxel: null,
    sourcePath: 'original.shp', sourceHash: 'a'.repeat(64), palettePath: 'original.pal', paletteHash: 'b'.repeat(64) }];
  const scene = compileGpuScene(createTerrainScene(makeOriginalTerrain()), makeOriginalSprites({ objects }).batch), canvas = new Canvas();
  const frames: { base: GpuFrame; voxel: GpuVoxelFrame | null }[] = [], displays: GpuViewportDisplay[] = [], failures: GpuViewportFailure[] = [], rafs = new Map<number, FrameRequestCallback>();
  let next = 0, loads = 0, disposals = 0, picks = 0, picker: GpuPicker | null = null, startupSignal: AbortSignal | null = null, loseOnLoad = false, loseOnPick = false;
  let accept!: () => void, reject!: (reason: Error) => void;
  const startup = new Promise<void>((resolve, failure) => { accept = resolve; reject = failure; });
  const env: GpuViewportPlatform = {
    createRenderer() { throw Error('combined layer must not use standalone renderer'); },
    createCombinedRenderer: () => ({ gl: {} as WebGL2RenderingContext, renderer: {
      load(base) { loads++; picker?.dispose(); picker = createGpuPicker(base); if (loseOnLoad) canvas.dispatchEvent(new Event('webglcontextlost')); },
      draw(base, voxel = null) { frames.push({ base, voxel }); return { generation: 1, sequence: frames.length, base, voxel, width: base.viewport.width, height: base.viewport.height, submitted: true, drawCalls: 5, uploadedBytes: 0 }; },
      pick(sequence, x, y) { picks++; assert.equal(sequence, frames.length); const f = frames.at(-1)!, b = picker!.pick(f.base, x, y), v = f.voxel && pickGpuVoxelFrame(f.voxel, x, y);
        if (loseOnPick) canvas.dispatchEvent(new Event('webglcontextlost'));
        return v && (!b || v.depth > b.depth) ? { kind: 'voxel', ...v } : b; },
      readback() { throw Error('no normal frame readback'); }, dispose() { disposals++; picker?.dispose(); picker = null; },
    } }),
    runSelftest(options) { startupSignal = options.signal; return startup; },
    requestFrame(fn) { const id = ++next; rafs.set(id, fn); return id; }, cancelFrame(id) { rafs.delete(id); },
  };
  const view = createGpuViewport({ canvas: canvas as unknown as HTMLCanvasElement, scene, objectInfo: info, worldSummary: session.summary, voxel: resources,
    onDisplayed: d => displays.push(d), onFallback: reason => failures.push(reason) }, env);
  function update(frameId = 1): GpuViewportUpdate {
    const world = session.snapshot(), actor = world.actors[1]!, ground = resources.grounds.find(p => p.x === actor.x && p.y === actor.y)!;
    return { frameId, camera: { ...camera }, world, objects: structuredClone(objects), retiredObjectIds: [], voxelPlacements: [{ objectId: 'object-1', ...ground }] };
  }
  return { view, frames, displays, failures, canvas, resources, update, session, rafs,
    async start() { accept(); await Promise.resolve(); }, async reject() { reject(Error('startup')); await Promise.resolve(); },
    flush() { const entries = [...rafs]; rafs.clear(); for (const [, fn] of entries) fn(0); },
    stats: () => ({ loads, disposals, picks, aborted: startupSignal!.aborted }),
    loseOnLoad() { loseOnLoad = true; }, loseOnPick() { loseOnPick = true; },
  };
}

test('async startup coalesces updates and latest camera; only checked complete scene can publish', async () => {
  const t = setup(); t.view.update(t.update()); t.view.setCamera({ ...camera, cameraX: 168 });
  t.session.act({ type: 'world-order', order: 'move', entityId: 2, playerId: 1, x: 5, y: 5 });
  t.session.act({ type: 'world-step', ticks: 4 }); const latest = t.update(2); t.view.update(latest); t.view.setCamera({ ...camera, cameraX: 160 });
  assert.equal(t.rafs.size, 0); assert.equal(t.view.displayed(), null); assert.equal(t.stats().loads, 0);
  await t.start(); assert.equal(t.rafs.size, 1); t.flush(); assert.equal(t.frames.length, 1);
  assert.equal(t.displays[0]!.frameId, 2); assert.equal(t.displays[0]!.camera.cameraX, 160);
  assert.equal(t.displays[0]!.world!.stateHash, latest.world!.stateHash); assert.equal(t.frames[0]!.voxel!.allocations.instances, 3);
  t.view.dispose(); assert.equal(t.stats().disposals, 1);
});

test('pending startup cannot resurrect after dispose, source replacement, hidden tab or context loss', async () => {
  for (const mode of ['dispose', 'hidden', 'loss', 'failure', 'load-loss']) {
    const t = setup(); t.view.update(t.update());
    if (mode === 'dispose') t.view.dispose();
    else if (mode === 'hidden') { t.canvas.ownerDocument.visibilityState = 'hidden'; t.canvas.ownerDocument.dispatchEvent(new Event('visibilitychange')); }
    else if (mode === 'loss') t.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    else if (mode === 'failure') await t.reject();
    else t.loseOnLoad();
    await t.start(); t.flush(); assert.equal(t.displays.length, 0); assert.equal(t.frames.length, 0); assert.equal(t.stats().disposals, 1);
    assert.equal(t.failures.length, mode === 'dispose' ? 0 : 1); assert.equal(t.stats().aborted, true); assert.throws(() => t.view.update(t.update(2)), /inactive/);
    t.view.dispose(); assert.equal(t.stats().disposals, 1);
  }
});

test('voxel displayed picking uses exact complete parts and current displayed world, never a pending camera', async () => {
  const t = setup(); t.view.update(t.update()); await t.start(); t.flush();
  const f = t.frames[0]!.voxel!; let point: [number, number] | null = null;
  for (let y = 0; y < camera.height && !point; y++) for (let x = 0; x < camera.width; x++) if (pickGpuVoxelFrame(f, x, y)) { point = [x, y]; break; }
  assert(point); const before = t.view.pick(...point, 1); assert.equal(before?.kind, 'object');
  if (before?.kind === 'object') { assert.equal(before.object.id, 'object-1'); assert.equal(before.object.format, 'voxel'); assert.equal(before.object.x, 7); assert(before.object.voxel); }
  t.view.setCamera({ ...camera, cameraX: 150 }); assert.deepEqual(t.view.pick(...point, 1), before);
  t.flush(); const picks = t.stats().picks; assert.equal(t.view.pick(...point, 1), null); assert.equal(t.stats().picks, picks);
  t.loseOnPick(); assert.equal(t.view.pick(20, 20, 2), null); assert.equal(t.failures.length, 1); t.view.dispose();
});

test('retirement and restore replace entire multipart layout; invalid current grounds never replace displayed state', async () => {
  const t = setup(); t.view.update(t.update()); await t.start(); t.flush(); const first = t.view.displayed();
  const bad = t.update(2); (bad.voxelPlacements![0] as { column: number }).column++;
  assert.throws(() => t.view.update(bad), /gpu-voxel-message/); assert.equal(t.view.displayed(), first);
  const missing = t.update(2); delete (missing as { voxelPlacements?: unknown }).voxelPlacements;
  assert.throws(() => t.view.update(missing), /update/);
  // Presentation-only valid snapshot fixture; actual combat/death remains a separate engine gate.
  const dead = t.update(2); dead.world!.actors[1]!.health = 0; const retired = { ...dead, voxelPlacements: [], retiredObjectIds: ['object-1'] };
  t.view.update(retired); t.flush(); assert.equal(t.frames.at(-1)!.voxel!.allocations.instances, 0);
  t.view.update(t.update(3)); t.flush(); assert.equal(t.frames.at(-1)!.voxel!.allocations.instances, 3); t.view.dispose();
});

test('owned voxel geometry/metadata and exact shared camera projection survive caller mutation', () => {
  const session = new WorldSession(originalWorld()), resources = originalVoxelResources(session.summary.modelHash), original = structuredClone(resources);
  const layer = createGpuVoxelLayer(resources), placements = [{ objectId: 'object-1', ...original.groups[0]!.initial }];
  resources.parts[0]!.voxels.fill(0); (resources.groups[0]!.parts[0]!.info as { name: string }).name = 'changed';
  for (const zoom of [.5, 1, 2, 4] as const) {
    const v = { ...camera, zoom, cameraX: 167.25 }, frame = layer.prepare(placements, v);
    const instances = original.groups[0]!.parts.map(p => ({ id: p.instanceId, partId: p.partId, paletteId: p.paletteId,
      modelToView: voxelWorldProjection(placements[0]!, { ...v, backgroundRgba: [0, 0, 0, 0] }) }));
    const expected = prepareGpuVoxelFrame(layer.scene, { instances, width: v.width, height: v.height });
    assert.deepEqual(copyGpuVoxelFrameData(frame), copyGpuVoxelFrameData(expected));
    assert.equal(layer.info(original.groups[0]!.parts[0]!.instanceId)!.name, 'Original multipart');
  }
  layer.dispose(); assert.throws(() => layer.prepare(placements, camera), /disposed/);
});
