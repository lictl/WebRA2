// SPDX-License-Identifier: GPL-3.0-or-later
// Original worker-protocol and save equivalence tests, not native Chrome performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TerrainBridge } from '../../apps/web/src/terrain-bridge.ts';
import { validAction, validResult, type GpuFrameResult, type FrameResult } from '../../apps/web/src/terrain-protocol.ts';
import { captureGpuFrame } from '../../apps/web/src/gpu-protocol.ts';
import { importGpuScene, prepareGpuFrame } from '../../packages/render/src/gpu-scene.ts';
import { createGpuPicker } from '../../packages/render/src/gpu-picking.ts';
import { GpuOriginalWorker, gpuOriginalLoad } from './gpu-worker.fixture.ts';
const signal=()=>new AbortController().signal;
async function start(){const worker=new GpuOriginalWorker(),bridge=new TerrainBridge(worker),s=signal();const first=await bridge.request(gpuOriginalLoad,s) as FrameResult;return {worker,bridge,s,first};}

test('GPU negotiation transfers resident planes once and worker world steps do not rasterize',async()=>{
  const {worker,bridge,s,first}=await start();
  const init=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;
  assert.equal(init.type,'gpu-frame');assert(init.resources);assert.deepEqual(init.objectInfo,[]);assert.equal(init.sceneId,first.frameId);assert.equal(init.world!.stateHash,first.world!.stateHash);
  assert.equal(worker.cpuRenders,1);assert.equal(worker.gpuPreparations,1);assert(worker.transferred.at(-1)!>0);
  const scene=importGpuScene(init.resources),picker=createGpuPicker(scene),before=prepareGpuFrame(scene,{...init.camera,backgroundRgba:[12,18,20,255]},init.objects);
  assert.equal(picker.pick(before,40,0)?.kind,'terrain');
  const admitted=await bridge.request({type:'world-order',order:'move',playerId:0,entityId:1,x:6,y:3},s) as GpuFrameResult;
  const moved=await bridge.request({type:'world-step',ticks:3},s) as GpuFrameResult;
  assert.equal(admitted.resources,null);assert.equal(moved.resources,null);assert.equal(moved.objectInfo,null);assert.equal(moved.sceneId,init.sceneId);assert.equal(moved.world!.revision,2);assert.equal(worker.cpuRenders,1);assert.deepEqual(worker.transferred.slice(-2),[0,0]);
  const camera={...moved.camera,cameraX:500};const shifted=await bridge.request({type:'render',camera},s) as GpuFrameResult;
  assert.deepEqual(shifted.controlPoints,[]);assert.equal(shifted.worldPoints.length,2);assert.deepEqual(shifted.worldPoints,moved.worldPoints);assert.equal(shifted.world!.stateHash,moved.world!.stateHash);
  const cpu=await bridge.request({type:'renderer-mode',mode:'cpu'},s) as FrameResult;
  assert.equal(cpu.type,'frame');assert.equal(cpu.world!.stateHash,moved.world!.stateHash);assert.equal(cpu.world!.revision,moved.world!.revision);assert.deepEqual(cpu.camera,camera);assert.equal(worker.cpuRenders,2);
  picker.dispose();bridge.dispose();
});

test('GPU and CPU execution save/replay identically including fallback and restore',async()=>{
  const a=await start(),b=await start();await a.bridge.request({type:'renderer-mode',mode:'gpu'},a.s);
  for(const state of [a,b]){await state.bridge.request({type:'world-order',order:'move',playerId:0,entityId:1,x:6,y:3},state.s);await state.bridge.request({type:'world-step',ticks:3},state.s);}
  const saveA=await a.bridge.request({type:'world-save'},a.s),saveB=await b.bridge.request({type:'world-save'},b.s);
  assert.deepEqual(saveA,saveB);assert.equal(saveA.type,'world-document');if(saveA.type!=='world-document'||!saveA.text)assert.fail();
  await a.bridge.request({type:'world-step',ticks:4},a.s);await a.bridge.request({type:'renderer-mode',mode:'cpu'},a.s);
  const restored=await a.bridge.request({type:'world-restore',text:saveA.text},a.s) as FrameResult;
  assert.equal(restored.world!.stateHash,saveA.stateHash);
  const exported=await a.bridge.request({type:'world-replay-export'},a.s);if(exported.type!=='world-document'||!exported.text)assert.fail();
  const replay=await a.bridge.request({type:'world-replay-validate',text:exported.text},a.s);assert.equal(replay.type,'world-document');if(replay.type!=='world-document')assert.fail();assert.equal(replay.stateHash,restored.world!.stateHash);
  a.bridge.dispose();b.bridge.dispose();
});

test('explicit GPU refusals preserve CPU session and allow continued play',async()=>{
  for(const reason of ['voxel-layer','scene-unavailable','scene-budget'] as const){
    const worker=new GpuOriginalWorker(reason),bridge=new TerrainBridge(worker),s=signal();const first=await bridge.request(gpuOriginalLoad,s) as FrameResult;
    assert.deepEqual(await bridge.request({type:'renderer-mode',mode:'gpu'},s),{type:'renderer-refusal',reason});assert.equal(worker.cpuRenders,1);assert.equal(worker.terminated,0);
    const next=await bridge.request({type:'world-step',ticks:1},s) as FrameResult;assert.equal(next.type,'frame');assert.equal(next.world!.revision,1);assert.equal(next.summary.mapHash,first.summary.mapHash);bridge.dispose();
  }
});

test('bridge rejects stale scene, repeated resources, wrong renderer and malformed GPU anchors',async()=>{
  for(const change of [(f:GpuFrameResult)=>{f.sceneId++;},(f:GpuFrameResult)=>{f.world!.revision++;},(f:GpuFrameResult)=>{f.worldPoints[0]!.entityId=3;},(f:GpuFrameResult)=>{f.resources=null;}]){
    const {worker,bridge,s}=await start();worker.transform=reply=>{if(reply.type==='result'&&reply.result.type==='gpu-frame')change(reply.result);return reply;};
    await assert.rejects(bridge.request({type:'renderer-mode',mode:'gpu'},s),/invalid/);assert.equal(worker.terminated,1);
  }
  const {worker,bridge,s}=await start(),init=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;
  worker.transform=r=>r.type==='result'&&r.result.type==='gpu-frame'?{...r,result:{...r.result,resources:init.resources,objectInfo:init.objectInfo}}:r;
  await assert.rejects(bridge.request({type:'world-step',ticks:1},s),/invalid/);assert.equal(worker.terminated,1);
});

test('GPU message capture owns metadata and rejects extra data, bad planes, dishonest retirement and accessor fields',async()=>{
  const {bridge,s}=await start(),init=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;
  assert(validResult(init));const captured=captureGpuFrame(init);init.worldPoints[0]!.x=999;init.camera.cameraX=999;assert.notEqual(captured.worldPoints[0]!.x,999);assert.notEqual(captured.camera.cameraX,999);
  assert(!validResult({...captured,extra:1}));assert(!validResult({...captured,retiredObjectIds:['object-0']}));assert(!validResult({...captured,objectInfo:null}));
  const bad=structuredClone(captured);bad.resources!.rasters[0]!.rgba[3]=1;assert(!validResult(bad));
  const accessor={...captured};Object.defineProperty(accessor,'objects',{get(){throw new Error('must not call');}});assert(!validResult(accessor));
  assert(validAction({type:'renderer-mode',mode:'gpu'}));assert(!validAction({type:'renderer-mode',mode:'automatic'}));assert(!validAction({type:'renderer-mode',mode:'gpu',extra:true}));bridge.dispose();
});
