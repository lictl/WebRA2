// SPDX-License-Identifier: GPL-3.0-or-later
// Original CPU picking + controlled presentation/lifecycle tests; no GPU/browser claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGpuViewport, type GpuViewportPlatform, type GpuViewportDisplay, type GpuViewportUpdate, type GpuViewportFailure } from '../../apps/web/src/gpu-viewport.ts';
import { compileGpuScene } from '../../packages/render/src/gpu-scene.ts';
import { createTerrainScene } from '../../packages/render/src/terrain-scene.ts';
import type { GpuFrame } from '../../packages/render/src/gpu-contracts.ts';
import type { Camera } from '../../apps/web/src/terrain-protocol.ts';
import type { ObjectInfo } from '../../apps/web/src/object-protocol.ts';
import { makeOriginalTerrain, makeOriginalSprites, originalObject } from '../render/gpu-fixtures.ts';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { originalWorld } from './world-ui.fixture.ts';
import { ordinaryFixture } from '../sim/ordinary-infantry-fixture.ts';
import { compileOrdinaryInfantryBridge } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { bindOrdinaryInfantryWorld } from '../../packages/sim/src/source-infantry-world.ts';

const camera: Camera = { cameraX: 0, cameraY: 0, zoom: 1, width: 60, height: 30 };
class Canvas extends EventTarget { width = 0; height = 0; }
function setup(mode: 'world' | 'empty' = 'world', loadFails = false, session = new WorldSession(originalWorld())) {
  const objects = mode === 'empty' ? [] : session.summary.actors.map((a, i) => originalObject({ id: a.objectId, x: i === 0 ? 28 : 100 + i * 10 }));
  const info: ObjectInfo[] = objects.map(o => ({ id: o.id, typeId: 'unit:original', name: 'Original unit', family: 'unit', owner: 'Original player', format: 'shp', voxel: null,
    x: 1, y: 1, frame: 0, sourcePath: 'original.shp', sourceHash: 'a'.repeat(64), palettePath: 'original.pal', paletteHash: 'b'.repeat(64) }));
  const scene = compileGpuScene(createTerrainScene(makeOriginalTerrain()), mode === 'empty' ? undefined : makeOriginalSprites({ objects }).batch);
  const canvas = new Canvas(), callbacks = new Map<number, FrameRequestCallback>(), oldCallbacks: FrameRequestCallback[] = [];
  const frames: GpuFrame[] = [], displays: GpuViewportDisplay[] = [], failures: GpuViewportFailure[] = [];
  let nextId = 0, disposals = 0, drawFails = false, lossDuringDraw = false;
  const env: GpuViewportPlatform = {
    createRenderer: () => ({ load: () => { if (loadFails) throw Error('load'); }, dispose: () => { disposals++; },
      draw: frame => {
        if (lossDuringDraw) canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
        if (drawFails) throw Error('draw');
        assert.equal(canvas.width, frame.viewport.width); assert.equal(canvas.height, frame.viewport.height);
        frames.push(frame); return { frame, sequence: frames.length, submitted: true, drawCalls: 3, uploadedBytes: 0 };
      } }),
    requestFrame: fn => { const id = ++nextId; callbacks.set(id, fn); oldCallbacks.push(fn); return id; },
    cancelFrame: id => { callbacks.delete(id); },
  };
  const view = createGpuViewport({ canvas: canvas as unknown as HTMLCanvasElement, scene, objectInfo: info,
    worldSummary: mode === 'empty' ? null : session.summary, onDisplayed: d => displays.push(d), onFallback: f => failures.push(f) }, env);
  const update = (frameId = 1): GpuViewportUpdate => ({ frameId, camera: { ...camera }, objects: structuredClone(objects), retiredObjectIds: [], world: mode === 'empty' ? null : session.snapshot() });
  function flush(): void { const entries = [...callbacks]; callbacks.clear(); for (const [, fn] of entries) fn(0); }
  return { view, canvas, session, info, update, flush, callbacks, oldCallbacks, frames, displays, failures,
    disposals: () => disposals, drawFailure: () => { drawFails = true; }, lossInDraw: () => { lossDuringDraw = true; } };
}

test('GPU viewport coalesces camera RAFs independently of a worker update and keeps stale gestures out', () => {
  const t = setup(); t.view.update(t.update()); assert.equal(t.view.pick(28, 10), null); assert.equal(t.callbacks.size, 1);
  t.flush(); const first = t.view.displayed()!;
  assert.equal(first.sequence, 1); assert.equal(first.frameId, 1);
  const hit = t.view.pick(28, 10, 1); assert.equal(hit?.kind, 'object');
  if (hit?.kind === 'object') assert.deepEqual([hit.object.id, hit.object.x, hit.object.y], ['object-0', 1, 3]);
  for (let x = 1; x <= 10; x++) t.view.setCamera({ ...camera, cameraX: x });
  assert.equal(t.callbacks.size, 1); assert.equal(t.view.displayed(), first); assert.equal(t.frames.length, 1);
  assert.equal(t.view.pick(28, 10, 1)?.kind, 'object'); // Pending camera is not the displayed camera.
  t.flush(); assert.equal(t.frames.length, 2); assert.equal(t.view.displayed()!.camera.cameraX, 10);
  assert.equal(t.view.displayed()!.frameId, 1); assert.equal(t.view.displayed()!.sequence, 2);
  assert.equal(t.view.pick(18, 10, 1), null); assert.equal(t.view.pick(18, 10, 2)?.kind, 'object');
  t.view.dispose();
});

test('GPU viewport captures pending objects, metadata, camera and world before caller mutation', () => {
  const t = setup(); const update = t.update(); t.view.update(update);
  (update.objects[0] as { x: number }).x = -100; update.camera.cameraX = 9;
  update.world!.actors[0]!.x = 99; t.info[0]!.name = 'Changed after construction';
  t.flush(); const first = t.view.displayed()!;
  assert.equal(first.camera.cameraX, 0); assert.equal(first.world!.actors[0]!.x, 1);
  const hit = t.view.pick(28, 10); assert.equal(hit?.kind, 'object');
  if (hit?.kind === 'object') { assert.equal(hit.object.name, 'Original unit'); hit.object.name = 'Changed result'; }
  const again = t.view.pick(28, 10); if (again?.kind === 'object') assert.equal(again.object.name, 'Original unit');
  assert(Object.isFrozen(first.world!.actors[0])); assert(Object.isFrozen(first.camera));
  const second = t.update(2); (second.objects[0] as { x: number }).x = 20; t.view.update(second);
  assert.equal(t.view.pick(28, 10)?.kind, 'object'); t.flush();
  assert.equal(t.view.pick(20, 10)?.kind, 'object'); assert.notEqual(t.view.pick(28, 10)?.kind, 'object');
  t.view.dispose();
});

test('GPU viewport rejects stale revisions, forged/missing/duplicate sprites and impossible retirement atomically', () => {
  const t = setup(); t.view.update(t.update()); t.flush(); const shown = t.view.displayed();
  assert.throws(() => t.view.update(t.update()));
  const mutations: ((u: GpuViewportUpdate) => void)[] = [
    u => { u.world!.stateHash = 'c'.repeat(64); }, u => { u.world!.modelHash = 'd'.repeat(64); },
    u => { (u.objects[0] as { id: string }).id = 'unlisted'; },
    u => { (u.objects as unknown[]).pop(); }, u => { (u.objects as unknown[])[1] = u.objects[0]; },
    u => { (u.objects[0] as { frameId: string }).frameId = 'unregistered'; },
    u => { (u.objects as unknown[]).shift(); (u.retiredObjectIds as string[]).push('object-0'); },
    u => { Object.defineProperty(u.camera, 'zoom', { get: () => 1 }); },
    u => { (u.objects as unknown as { length: number }).length = 32769; },
  ];
  for (const mutate of mutations) { const u = t.update(2); mutate(u); assert.throws(() => t.view.update(u)); assert.equal(t.view.displayed(), shown); assert.equal(t.callbacks.size, 0); }
  const valid = t.update(2); t.view.update(valid); t.flush(); assert.equal(t.view.displayed()!.frameId, 2);
  t.session.act({ type: 'world-step', ticks: 1 }); t.view.update(t.update(3)); t.flush();
  const stale = t.update(4); stale.world!.revision = 0; assert.throws(() => t.view.update(stale));
  t.view.dispose();
});

test('GPU viewport snapshots descriptor values instead of invoking Proxy getters twice', () => {
  const t = setup(); const u = t.update(); let reads = 0;
  const proxy = new Proxy(u, { get() { reads++; throw Error('must not read input properties'); } });
  t.view.update(proxy); t.flush(); assert.equal(reads, 0); assert.equal(t.view.pick(28, 10)?.kind, 'object');
  t.view.dispose();
});

test('GPU viewport removes completed actors only in the displayed revision', () => {
  const t = setup(); t.view.update(t.update()); t.flush();
  const dead = t.update(2); dead.world!.revision++; dead.world!.stateHash = 'd'.repeat(64); dead.world!.actors[0]!.health = 0;
  (dead.objects as unknown[]).shift(); (dead.retiredObjectIds as string[]).push('object-0'); t.view.update(dead);
  assert.equal(t.view.pick(28, 10)?.kind, 'object'); t.flush();
  assert.notEqual(t.view.pick(28, 10)?.kind, 'object'); assert.equal(t.view.displayed()!.world!.actors[0]!.health, 0);
  t.view.dispose();
});

test('GPU viewport retains genuine pending-death artwork and retires it at completion in both profiles', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = ordinaryFixture({ profile }), bridge = compileOrdinaryInfantryBridge(f);
    const session = new WorldSession({ ...f.world, model: bindOrdinaryInfantryWorld(bridge, f.world.model) });
    const t = setup('world', false, session); let frameId = 1;
    t.view.update(t.update(frameId++)); t.flush();
    session.act({ type: 'world-orders', order: 'attack', entityIds: [1], playerId: 0, targetId: 2, expectedRevision: 0 });
    let sawPending = false, sawRetired = false;
    for (let i = 0; i < 112; i++) {
      session.act({ type: 'world-step', ticks: 1 }); const update = t.update(frameId++), victim = update.world!.actors[1]!;
      if (victim.health === 0 && victim.combat!.corpseIndex === null) {
        sawPending = true; const impossible = structuredClone(update);
        (impossible.objects as unknown[]).pop(); (impossible.retiredObjectIds as string[]).push('object-1');
        assert.throws(() => t.view.update(impossible));
      }
      if (victim.combat!.corpseIndex !== null) { sawRetired = true; (update.objects as unknown[]).pop(); (update.retiredObjectIds as string[]).push('object-1'); }
      t.view.update(update); t.flush();
      assert.equal(t.view.displayed()!.frame.allocations.objects, sawRetired ? 1 : 2);
      if (sawRetired) break;
    }
    assert(sawPending && sawRetired); t.view.dispose();
  }
});

test('GPU viewport loss and draw failure invalidate picks, cancel callbacks and request fallback exactly once', () => {
  for (const mode of ['event', 'draw', 'during-draw'] as const) {
    const t = setup(); t.view.update(t.update()); t.flush(); t.view.setCamera({ ...camera, cameraX: 1 });
    if (mode === 'event') t.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    else { if (mode === 'draw') t.drawFailure(); else t.lossInDraw(); t.flush(); }
    assert.deepEqual(t.failures, [mode === 'draw' ? 'draw-failed' : 'context-lost']);
    assert.equal(t.view.displayed(), null); assert.equal(t.view.pick(28, 10), null); assert.equal(t.callbacks.size, 0);
    assert.equal(t.disposals(), 1); const count = t.displays.length;
    for (const cb of t.oldCallbacks) cb(0); t.canvas.dispatchEvent(new Event('webglcontextlost')); t.view.dispose(); t.view.dispose();
    assert.equal(t.displays.length, count); assert.equal(t.failures.length, 1); assert.equal(t.disposals(), 1);
    assert.throws(() => t.view.update(t.update(2)));
  }
});

test('GPU viewport release is terminal and an empty scene never fabricates a sprite catalog', () => {
  const t = setup('empty'); t.view.update(t.update()); t.flush(); assert.equal(t.view.displayed()!.world, null);
  assert.equal(t.view.pick(30, 15)?.kind, 'terrain');
  t.view.setCamera({ ...camera, width: 50 }); t.view.dispose(); assert.equal(t.callbacks.size, 0);
  t.oldCallbacks.at(-1)!(0); assert.equal(t.displays.length, 1); assert.equal(t.disposals(), 1); assert.deepEqual(t.failures, []);
  const failed = setup('empty', true); assert.deepEqual(failed.failures, ['unavailable']); assert.equal(failed.disposals(), 1);
  assert.throws(() => failed.view.update(failed.update())); failed.view.dispose();
});
