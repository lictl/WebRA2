// SPDX-License-Identifier: GPL-3.0-or-later
// Original worker/presenter composition. Actual WebGL and native input remain separate gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TerrainController, canPick } from '../../apps/web/src/terrain-controller.ts';
import { TerrainBridge } from '../../apps/web/src/terrain-bridge.ts';
import { createGpuViewport, type GpuViewport } from '../../apps/web/src/gpu-viewport.ts';
import { importGpuScene } from '../../packages/render/src/gpu-scene.ts';
import type { TerrainAction } from '../../apps/web/src/terrain-protocol.ts';
import { GpuOriginalWorker } from './gpu-worker.fixture.ts';
import { terrainText } from '../../apps/web/src/terrain-i18n.ts';
class Worker extends GpuOriginalWorker {
  actions:TerrainAction[]=[];hold:string|null=null;held:unknown=null;
  override postMessage(value:unknown){const message=value as {action:TerrainAction};this.actions.push(message.action);if(message.action.type===this.hold){this.held=value;return;}super.postMessage(value);}
  release(){const value=this.held;this.held=null;this.hold=null;if(value)super.postMessage(value);}
}
async function setup(refusal?:'voxel-layer'|'scene-unavailable'|'scene-budget',withSprite=false){
  const worker=new Worker(refusal,withSprite),slots=new Map<number,string>();
  const c=new TerrainController('en',()=>new TerrainBridge(worker),{async read(s){return slots.get(s)??null;},async write(s,text){slots.set(s,text);},async remove(s){slots.delete(s);}});
  c.resize(120,80);c.select([new File(['original'],'original.mix')]);await c.load();return {worker,c};
}
function present(c:TerrainController){
  const initial=c.state.frame;if(initial?.type!=='gpu-frame'||!initial.resources||!initial.objectInfo)assert.fail();
  const canvas=Object.assign(new EventTarget(),{width:0,height:0}) as unknown as HTMLCanvasElement;
  const callbacks=new Map<number,FrameRequestCallback>();let next=0,lastFrame=initial.frameId,disposed=0;
  const p:GpuViewport=createGpuViewport({canvas,scene:importGpuScene(initial.resources),objectInfo:initial.objectInfo,worldSummary:initial.summary.world,
    onDisplayed:d=>c.gpuDisplayed(p,d),onFallback:r=>c.gpuFailed(p,r)},
    {createRenderer:()=>({load(){},dispose(){disposed++;},draw(frame){return {frame,sequence:1,submitted:true,drawCalls:3,uploadedBytes:0};}}),requestFrame:cb=>{callbacks.set(++next,cb);return next;},cancelFrame:id=>{callbacks.delete(id);}});
  assert(c.attachGpu(p));
  p.update({frameId:initial.frameId,objects:initial.objects,retiredObjectIds:initial.retiredObjectIds,world:initial.world,camera:c.camera()!});
  const off=c.subscribe(state=>{const f=state.frame;if(f?.type==='gpu-frame'&&f.frameId!==lastFrame){lastFrame=f.frameId;if(disposed===0)p.update({frameId:f.frameId,objects:f.objects,retiredObjectIds:f.retiredObjectIds,world:f.world,camera:c.camera()!});}});
  function flush(){const list=[...callbacks.values()];callbacks.clear();for(const cb of list)cb(0);}
  return {p,canvas,flush,callbacks,off,disposed:()=>disposed};
}
async function settle(predicate:()=>boolean){for(let i=0;i<50&&!predicate();i++)await new Promise(r=>setImmediate(r));assert(predicate());}

test('GPU controller imports once, reprojects local pan/focus, and gates picks until the exact draw',async()=>{
  const {c,worker}=await setup();await c.setRenderer('gpu');const t=present(c);
  assert.equal(c.state.frame?.type,'gpu-frame');if(c.state.frame?.type!=='gpu-frame')assert.fail();
  assert.equal(c.state.frame.resources,null);assert.equal(c.state.frame.objectInfo,null);assert(!canPick(c.state,40,0));
  t.flush();assert(canPick(c.state,40,0));const requestCount=worker.actions.length;
  assert.equal((await c.pick(40,0,'inspect'))?.kind,'terrain');assert.equal(worker.actions.length,requestCount);
  c.selectEntities([1]);const p=c.state.frame.controlPoints.find(p=>p.entityId===1)!;
  assert(c.selectBox(c.presentationToken(),{left:p.x,top:p.y,right:p.x,bottom:p.y}));
  const token=c.presentationToken();c.pan(900,0);assert(!canPick(c.state,40,0));t.flush();assert.equal(c.state.frame.controlPoints.length,0);
  assert.equal(c.selectBox(token,{left:0,top:0,right:10,bottom:10}),false);
  await c.focusEntity();t.flush();assert.equal(worker.actions.length,requestCount);
  assert.deepEqual(c.state.frame.controlPoints.find(p=>p.entityId===1),{entityId:1,x:60,y:40});
  await c.order(6,3);t.flush();await c.step(3);t.flush();assert.equal(worker.cpuRenders,1);assert.equal(c.state.frame.world!.revision,2);
  t.off();c.dispose();assert.equal(t.disposed(),1);
});

test('context-loss fallback waits for an outstanding tick and restores the latest local camera and world',async()=>{
  const {c,worker}=await setup();await c.setRenderer('gpu');const t=present(c);t.flush();c.setRunning(true);
  worker.hold='world-step';const step=c.step(2);c.pan(300,70);t.flush();
  const desired=c.camera()!,before=worker.actions.length;
  t.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));await Promise.resolve();
  assert.equal(worker.actions.length,before);assert.equal(c.state.busy,true);assert.equal(c.state.rendererNotice,'rendererLost');assert.equal(c.state.gpuDisplayedFrameId,0);
  worker.release();await step;await settle(()=>!c.state.busy&&c.state.frame?.type==='frame');
  assert.deepEqual(c.state.frame!.camera,desired);assert.equal(c.state.frame!.world!.nextTick,2);assert.equal(c.state.frame!.world!.revision,1);
  assert.deepEqual(worker.actions.slice(-2).map(a=>a.type),['render','renderer-mode']);assert.equal(worker.terminated,0);assert.equal(c.state.files,1);
  assert.equal(t.disposed(),1);assert.equal(c.state.rendererNotice,'rendererRestored');t.off();c.dispose();
});

test('resident SHP picks follow the displayed actor position without sending a worker pick or losing selection',async()=>{
  const {c,worker}=await setup(undefined,true);await c.setRenderer('gpu');const t=present(c);t.flush();
  let f=c.state.frame!,point=f.controlPoints.find(p=>p.entityId===1)!;
  const before=worker.actions.length;const first=await c.pick(point.x,point.y);assert.equal(first?.kind,'object');
  if(first?.kind==='object')assert.deepEqual([first.object.id,first.object.x,first.object.y],['object-0',1,3]);
  assert.equal(worker.actions.length,before);assert.deepEqual(c.state.selectedEntities,[1]);
  await c.order(6,3);await c.step(4);assert(!canPick(c.state,point.x,point.y));t.flush();
  f=c.state.frame!;point=f.controlPoints.find(p=>p.entityId===1)!;
  const moved=await c.pick(point.x,point.y);assert.equal(moved?.kind,'object');
  if(moved?.kind==='object')assert.deepEqual([moved.object.x,moved.object.y],[f.world!.actors[0]!.x,f.world!.actors[0]!.y]);
  assert.equal(worker.actions.filter(a=>a.type==='pick').length,0);assert.equal(worker.cpuRenders,1);t.off();c.dispose();
});

test('GPU saves/replay/Stop preserve CPU command semantics, with explicit refusal and replacement cleanup',async()=>{
  const a=await setup(),b=await setup();await a.c.setRenderer('gpu');const t=present(a.c);t.flush();
  for(const {c} of [a,b]){await c.order(6,3);await c.step(3);await c.saveWorld();await c.order();await c.step();await c.loadWorld();await c.verifyWorld();}
  assert.equal(a.c.state.frame!.world!.stateHash,b.c.state.frame!.world!.stateHash);assert.equal(a.c.state.replayHash,b.c.state.replayHash);
  a.c.select([]);assert.equal(t.disposed(),1);assert.equal(a.c.state.frame,null);assert.equal(a.c.state.files,0);t.off();a.c.dispose();b.c.dispose();
  for(const reason of ['voxel-layer','scene-unavailable','scene-budget'] as const){
    const {c,worker}=await setup(reason),first=c.state.frame;await c.setRenderer('gpu');assert.equal(c.state.frame,first);assert.equal(c.state.rendererNotice,reason==='voxel-layer'?'rendererVoxel':'rendererUnavailable');
    assert.equal(worker.terminated,0);await c.step();assert.equal(c.state.frame!.world!.nextTick,1);c.dispose();
  }
  for(const locale of ['en','zh-Hant'] as const)for(const key of ['rendererEnable','rendererDisable','rendererGpu','rendererCpu','rendererVoxel','rendererLost','rendererUnavailable'])assert.notEqual(terrainText(locale,key),terrainText(locale,'unknown'));
});

test('old context callbacks cannot switch a replacement mission renderer or issue a stale command',async()=>{
  const {c,worker}=await setup();await c.setRenderer('gpu');const t=present(c);t.flush();
  c.select([new File(['new'],'new.mix')]);const n=worker.actions.length;c.gpuFailed(t.p,'context-lost');t.canvas.dispatchEvent(new Event('webglcontextlost'));await Promise.resolve();
  assert.equal(worker.actions.length,n);assert.equal(c.state.phase,'selected');assert.equal(c.state.files,1);assert.equal(c.state.rendererNotice,'rendererCpu');t.off();c.dispose();
});
