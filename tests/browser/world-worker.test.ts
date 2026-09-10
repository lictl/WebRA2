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
import { worldText, worldEventText } from '../../apps/web/src/world-i18n.ts';
import { originalWorld } from './world-ui.fixture.ts';
const artwork = { policy: 'webra2-object-still-2' as const, presentation: 'webra2-placed-still-1' as const, voxel: null, types: 0, rendered: 0, unavailable: 3, assets: 0, palettes: 0, sourceBytes: 0, decodedBytes: 0, indexedFrames: 0, rows: [], omittedTypes: 0, omittedPlacements: 3, omittedRendered: 0, truncatedFields: 0, unplaced: 0 };
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
test('v7 bridge and worker bind frame revisions, bounded commands, documents and recoverable rejection', async () => {
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
test('v5 rejects forged frame control points and returns a recoverable stale group revision',async()=>{
  for(const mutate of [(f:FrameResult)=>{f.controlPoints.push({...f.controlPoints[0]!});},(f:FrameResult)=>{f.controlPoints[0]!.entityId=99;},(f:FrameResult)=>{f.world!.actors[0]!.health=0;}]){
    const worker=new LocalWorker(),bridge=new TerrainBridge(worker);worker.transform=r=>{if(r.type==='result'&&r.result.type==='frame')mutate(r.result);return r;};
    await assert.rejects(bridge.request(load,new AbortController().signal),/invalid/);assert.equal(worker.terminated,1);
  }
  const worker=new LocalWorker(),bridge=new TerrainBridge(worker),signal=new AbortController().signal;
  const first=await bridge.request(load,signal) as FrameResult;
  const rejection=await bridge.request({type:'world-orders',order:'stop',entityIds:[1],playerId:0,expectedRevision:1},signal);
  assert.equal(rejection.type,'world-rejection');assert.equal(worker.terminated,0);
  const frame=await bridge.request({type:'render',camera:first.camera},signal) as FrameResult;assert.equal(frame.world!.stateHash,first.world!.stateHash);assert.equal(frame.world!.revision,0);bridge.dispose();
});
test('controller preserves moving state through local save, invalid import, restore and replay validation', async () => {
  const saved = new Map<number, string>(); const storage: WorldStorage = { async read(slot) { return saved.get(slot) ?? null; }, async write(slot, text) { saved.set(slot, text); }, async remove(slot) { saved.delete(slot); } };
  const controller = new TerrainController('en', () => new TerrainBridge(new LocalWorker()), storage); controller.resize(120, 80); controller.select(files()); await controller.load();
  assert.equal(controller.state.selectedEntity, 1); await controller.order(6, 3); await controller.step(); const moving = controller.state.frame!.world!.stateHash;
  controller.setRunning(true); await controller.saveWorld(); assert.equal(controller.state.running, false); assert.equal(controller.state.worldNotice, 'worldSaved');
  await controller.step(4); assert.notEqual(controller.state.frame!.world!.stateHash, moving); await controller.loadWorld(); assert.equal(controller.state.frame!.world!.stateHash, moving);
  await controller.importWorld(new File(['{}'], 'invalid.json'), 'save'); assert.equal(controller.state.worldNotice, 'worldRejected'); assert.equal(controller.state.frame!.world!.stateHash, moving);
  assert.deepEqual(controller.state.selectedEntities, []); controller.selectEntity(1); await controller.order(); await controller.step(); assert.equal(controller.state.frame!.world!.actors[0]!.goalX, null);
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
  assert.match(worldText('zh-Hant', 'scope'), /有限的步兵戰鬥/);
  for(const code of ['stopped','move-accepted','arrived','path-found','blocked','progress','moved','unreachable','budget-exhausted','missing-goal','blocked-goal','constructor','__proto__'])assert.match(worldEventText('zh-Hant',code),/[\u3400-\u9fff]/);
});

test('cancelled replay validation terminates the worker, retains Files/local saves and ignores stale completion',async()=>{
 class DelayedReplayWorker extends LocalWorker {
  held:{version:number;id:number;action:{type:string}}|null=null;
  override postMessage(value:unknown){const v=value as NonNullable<DelayedReplayWorker['held']>;if(v.action?.type==='world-replay-validate'){this.held=structuredClone(v);return;}super.postMessage(value);}
 }
 const saved=new Map<number,string>(),workers:DelayedReplayWorker[]=[];
 const storage:WorldStorage={async read(slot){return saved.get(slot)??null;},async write(slot,text){saved.set(slot,text);},async remove(slot){saved.delete(slot);}};
 const c=new TerrainController('en',()=>{const w=new DelayedReplayWorker();workers.push(w);return new TerrainBridge(w);},storage);c.resize(120,80);c.select(files());await c.load();await c.order(6,3);await c.step();await c.saveWorld();
 const hash=c.state.frame!.world!.stateHash,checkpoint=saved.get(1);const pending=c.verifyWorld();
 for(let i=0;i<10&&!workers[0]!.held;i++)await new Promise<void>(r=>setImmediate(r));
 assert(workers[0]!.held);assert.equal(c.state.worldNotice,'worldVerifying');assert(c.state.busy);c.hidden();assert.equal(c.state.worldNotice,'worldVerifying');
 c.cancel();assert.equal(workers[0]!.terminated,1);assert.equal(c.state.phase,'cancelled');assert.equal(c.state.files,1);assert.equal(saved.get(1),checkpoint);await pending;
 await c.load();await c.loadWorld();assert.equal(c.state.frame!.world!.stateHash,hash);
 workers[0]!.dispatchEvent(new MessageEvent('message',{data:{version:7,id:workers[0]!.held!.id,type:'result',result:{type:'world-document',kind:'validated',modelHash:c.state.frame!.world!.modelHash,revision:0,stateHash:'f'.repeat(64),text:null}}}));
 await Promise.resolve();assert.equal(c.state.frame!.world!.stateHash,hash);assert.equal(c.state.worldNotice,'worldLoaded');assert.equal(c.state.replayHash,null);c.dispose();
});
