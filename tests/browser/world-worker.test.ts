// SPDX-License-Identifier: GPL-3.0-or-later
// Original worker/controller fixtures. These are not native browser or retail pixel tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTerrainWorker, type TerrainScope, type SceneLoader } from '../../apps/web/src/terrain-worker-runtime.ts';
import { TerrainBridge } from '../../apps/web/src/terrain-bridge.ts';
import { TerrainController } from '../../apps/web/src/terrain-controller.ts';
import { type TerrainReply, type TerrainAction, type FrameResult } from '../../apps/web/src/terrain-protocol.ts';
import { WorldTickSchedule } from '../../apps/web/src/world-scheduler.ts';
import { LocalWorldStorage, type WorldStorage } from '../../apps/web/src/world-storage.ts';
import { worldText } from '../../apps/web/src/world-i18n.ts';
import { originalWorld } from './world-ui.fixture.ts';
const artwork = { policy: 'webra2-object-still-2' as const, presentation: 'webra2-placed-still-1' as const, types: 0, rendered: 0, unavailable: 3, assets: 0, palettes: 0, sourceBytes: 0, decodedBytes: 0, indexedFrames: 0, rows: [], omittedTypes: 0, omittedPlacements: 3, omittedRendered: 0, truncatedFields: 0, unplaced: 0 };
const loader: SceneLoader = async () => ({ world: originalWorld(), summary: { profile: 'ra2', mission: 'all01t.map', contentHash: 'a'.repeat(64), mapHash: 'c'.repeat(64), paletteHash: 'e'.repeat(64), artwork, cells: 35, objects: 3, assets: 1, verifiedBytes: 100, sourceBytes: 100, decodedBytes: 100, decodedSlots: 1, bounds: { x: 0, y: 0, width: 100, height: 100 }, diagnostics: [] }, scene: {
  locate(x, y) { return { x: x * 20, y: y * 10 }; },
  render(viewport) { const bytes = viewport.width * viewport.height * 4; return { viewport, rgba: new Uint8Array(bytes), allocations: { rgbaBytes: bytes, depthBytes: bytes, ownerBytes: bytes, objectOwnerBytes: bytes, totalPixelBytes: bytes * 4, samples: 0, spriteSamples: 0, paletteBytes: 0, objects: 0 }, pick() { return null; } }; }
} });
class LocalWorker extends EventTarget {
  terminated = 0; transform: ((reply: TerrainReply) => TerrainReply) | null = null; readonly scope: TerrainScope;
  constructor() { super(); this.scope = { onmessage: null, postMessage: (message, transfer) => { const data = structuredClone(message, { transfer: transfer ?? [] }); queueMicrotask(() => { if (!this.terminated) this.dispatchEvent(new MessageEvent('message', { data: this.transform?.(data) ?? data })); }); } }; attachTerrainWorker(this.scope, loader); }
  postMessage(value: unknown) { const data = structuredClone(value); queueMicrotask(() => { if (!this.terminated) this.scope.onmessage?.({ data }); }); }
  terminate() { this.terminated++; }
}
const files = () => [new File(['original-fixture'], 'original.mix')];
const load: TerrainAction = { type: 'load', files: files().map(file => ({ file, relativePath: '' })), profile: 'ra2', width: 120, height: 80 };
test('v3 bridge and worker bind frame revisions, bounded commands, documents and recoverable rejection', async () => {
  const worker = new LocalWorker(), bridge = new TerrainBridge(worker), signal = new AbortController().signal;
  const first = await bridge.request(load, signal) as FrameResult; assert.equal(first.world!.revision, 0);
  const admitted = await bridge.request({ type: 'world-order', order: 'move', playerId: 0, entityId: 1, x: 6, y: 3 }, signal) as FrameResult;
  assert.equal(admitted.world!.revision, 1); assert.equal(admitted.world!.nextTick, 0);
  const moved = await bridge.request({ type: 'world-step', ticks: 1 }, signal) as FrameResult; assert.equal(moved.world!.revision, 2); assert.equal(moved.world!.actors[0]!.progress, 128);
  const rejected = await bridge.request({ type: 'world-restore', text: '{}' }, signal); assert.equal(rejected.type, 'world-rejection'); assert.equal(worker.terminated, 0);
  const checkpoint = await bridge.request({ type: 'world-save' }, signal); assert.equal(checkpoint.type, 'world-document');
  const focused = await bridge.request({ type: 'focus', entityId: 1 }, signal) as FrameResult; assert.equal(focused.world!.revision, 2); assert.equal(focused.camera.cameraX, -40);
  worker.transform = reply => reply.type === 'result' && reply.result.type === 'frame' ? { ...reply, result: { ...reply.result, world: { ...reply.result.world!, revision: 1 } } } : reply;
  await assert.rejects(bridge.request({ type: 'world-step', ticks: 1 }, signal), /invalid/); assert.equal(worker.terminated, 1);
});
test('controller preserves moving state through local save, invalid import, restore and replay validation', async () => {
  const saved = new Map<number, string>(); const storage: WorldStorage = { async read(slot) { return saved.get(slot) ?? null; }, async write(slot, text) { saved.set(slot, text); }, async remove(slot) { saved.delete(slot); } };
  const controller = new TerrainController('en', () => new TerrainBridge(new LocalWorker()), storage); controller.resize(120, 80); controller.select(files()); await controller.load();
  assert.equal(controller.state.selectedEntity, 1); await controller.order(6, 3); await controller.step(); const moving = controller.state.frame!.world!.stateHash;
  controller.setRunning(true); await controller.saveWorld(); assert.equal(controller.state.running, false); assert.equal(controller.state.worldNotice, 'worldSaved');
  await controller.step(4); assert.notEqual(controller.state.frame!.world!.stateHash, moving); await controller.loadWorld(); assert.equal(controller.state.frame!.world!.stateHash, moving);
  await controller.importWorld(new File(['{}'], 'invalid.json'), 'save'); assert.equal(controller.state.worldNotice, 'worldRejected'); assert.equal(controller.state.frame!.world!.stateHash, moving);
  await controller.order(); await controller.step(); assert.equal(controller.state.frame!.world!.actors[0]!.goalX, null);
  await controller.verifyWorld(); assert.equal(controller.state.worldNotice, 'worldVerified'); assert.equal(controller.state.replayHash, controller.state.frame!.world!.stateHash);
  controller.setRunning(true); controller.hidden(); assert.equal(controller.state.running, false); controller.leave(); assert.equal(controller.state.frame, null); assert.equal(controller.state.files, 1); controller.dispose();
});
test('cancelled asynchronous slot read and file read cannot restore or label a replacement session', async () => {
  let release!: (text: string) => void; const delayed = new Promise<string>(resolve => { release = resolve; });
  const storage: WorldStorage = { async read() { return delayed; }, async write() {}, async remove() {} };
  const controller = new TerrainController('en', () => new TerrainBridge(new LocalWorker()), storage); controller.resize(120, 80); controller.select(files()); await controller.load();
  const old = controller.loadWorld(); controller.cancel(); await controller.load(); const fresh = controller.state.frame!.world!.stateHash;
  release('{}'); await old; assert.equal(controller.state.frame!.world!.stateHash, fresh); assert.equal(controller.state.worldNotice, 'worldPaused');
  let releaseFile!: (text: string) => void; const file = { size: 2, text: () => new Promise<string>(resolve => { releaseFile = resolve; }) };
  const pending = controller.importWorld(file, 'save'); controller.setProfile('yr'); releaseFile('{}'); await pending; assert.equal(controller.state.profile, 'yr'); assert.equal(controller.state.frame, null); assert.equal(controller.state.busy, false); controller.dispose();
});
test('UI timer scheduling caps catch-up, retains no hidden debt and never requests fractional ticks', () => {
  const timer = new WorldTickSchedule(); assert.equal(timer.advance(0, true, false), 0); assert.equal(timer.advance(100, true, false), 1);
  assert.equal(timer.advance(10_000, true, true), 0); assert.equal(timer.advance(10_001, true, false), 4);
  assert.equal(timer.advance(20_000, false, false), 0); assert.equal(timer.advance(20_010, true, false), 0); assert.equal(timer.advance(20_100, true, false), 1);
  assert.equal(timer.advance(NaN, true, false), 0); assert.equal(timer.advance(30_000, true, false), 0);
});
test('world storage uses its own database, bounds text before opening and exposes original bilingual recovery text', async () => {
  let opens = 0; const factory = { open(name: string) { opens++; assert.equal(name, 'webra2-world-v1'); const request: { onerror?: () => void; error: DOMException } = { error: new DOMException('Original fixture', 'QuotaExceededError') }; queueMicrotask(() => request.onerror?.()); return request; } } as unknown as IDBFactory;
  const store = new LocalWorldStorage(factory), signal = new AbortController().signal;
  await assert.rejects(store.write(1, 'x'.repeat(2 * 1024 ** 2 + 1), signal), /invalid/); assert.equal(opens, 0);
  await assert.rejects(store.write(1, '{}', signal), /quota/); assert.equal(opens, 1);
  for (const key of ['worldPaused', 'worldSaved', 'worldLoaded', 'worldRejected', 'worldVerified', 'worldQuota', 'worldStorage', 'worldHidden', 'constructor', '__proto__']) for (const locale of ['en', 'zh-Hant'] as const) assert.equal(typeof worldText(locale, key), 'string');
  assert.match(worldText('zh-Hant', 'scope'), /尚未執行戰鬥/);
});
