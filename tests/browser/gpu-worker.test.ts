// SPDX-License-Identifier: GPL-3.0-or-later
// Original worker-protocol and save equivalence tests, not native Chrome performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TerrainBridge } from '../../apps/web/src/terrain-bridge.ts';
import { validAction, validResult, type GpuFrameResult, type FrameResult } from '../../apps/web/src/terrain-protocol.ts';
import { captureGpuFrame } from '../../apps/web/src/gpu-protocol.ts';
import { importGpuScene, prepareGpuFrame, compileGpuScene, exportGpuScene } from '../../packages/render/src/gpu-scene.ts';
import { createTerrainScene } from '../../packages/render/src/terrain-scene.ts';
import { makeOriginalTerrain, makeOriginalSprites, originalObject } from '../render/gpu-fixtures.ts';
import { createGpuPicker } from '../../packages/render/src/gpu-picking.ts';
import { GpuOriginalWorker, gpuOriginalLoad } from './gpu-worker.fixture.ts';
const signal=()=>new AbortController().signal;
async function start(withSprite=false){const worker=new GpuOriginalWorker(undefined,withSprite),bridge=new TerrainBridge(worker),s=signal();const first=await bridge.request(gpuOriginalLoad,s) as FrameResult;return {worker,bridge,s,first};}

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

test('bridge binds every current sprite to the initial resident object and resource catalog',async()=>{
  const changes=[(f:GpuFrameResult)=>{f.objects=[{...f.objects[0]!,id:'object-999'}];},(f:GpuFrameResult)=>{f.objects=[{...f.objects[0]!,frameId:'unknown'}];},(f:GpuFrameResult)=>{f.objects=[{...f.objects[0]!,paletteId:'unknown'}];},(f:GpuFrameResult)=>{f.objects=[{...f.objects[0]!,depth:{...f.objects[0]!.depth,rowStep:1}}];}];
  for(const initialization of [true,false])for(const change of changes){
    const {worker,bridge,s}=await start(true);
    if(!initialization)await bridge.request({type:'renderer-mode',mode:'gpu'},s);
    worker.transform=r=>{if(r.type==='result'&&r.result.type==='gpu-frame')change(r.result);return r;};
    await assert.rejects(bridge.request(initialization?{type:'renderer-mode',mode:'gpu'}:{type:'world-step',ticks:1},s),/invalid/);assert.equal(worker.terminated,1);
  }
  const {worker,bridge,s}=await start(true);await bridge.request({type:'renderer-mode',mode:'gpu'},s);
  const moved=await bridge.request({type:'world-order',order:'move',entityId:1,playerId:0,x:6,y:3},s) as GpuFrameResult;
  assert.equal(moved.objects[0]!.id,'object-0');await bridge.request({type:'world-step',ticks:3},s);
  await bridge.request({type:'renderer-mode',mode:'cpu'},s);
  worker.transform=r=>{
    if(r.type==='result'&&r.result.type==='gpu-frame'&&r.result.resources){
      const f=r.result;f.objects=[{...f.objects[0]!,id:'object-999'}];f.objectInfo=[{...f.objectInfo![0]!,id:'object-999'}];
      f.resources={...f.resources!,objects:[{...f.resources!.objects[0]!,id:'object-999'}]};
    }return r;
  };
  await assert.rejects(bridge.request({type:'renderer-mode',mode:'gpu'},s),/invalid/);assert.equal(worker.terminated,1);
});

test('GPU message capture owns metadata and rejects extra data, bad planes, dishonest retirement and accessor fields',async()=>{
  const {bridge,s}=await start(),init=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;
  assert(validResult(init));const captured=captureGpuFrame(init);init.worldPoints[0]!.x=999;init.camera.cameraX=999;assert.notEqual(captured.worldPoints[0]!.x,999);assert.notEqual(captured.camera.cameraX,999);
  assert(!validResult({...captured,extra:1}));assert(!validResult({...captured,retiredObjectIds:['object-0']}));assert(!validResult({...captured,objectInfo:null}));
  const bad=structuredClone(captured);bad.resources!.rasters[0]!.rgba[3]=1;assert(!validResult(bad));
  const accessor={...captured};Object.defineProperty(accessor,'objects',{get(){throw new Error('must not call');}});assert(!validResult(accessor));
  assert(validAction({type:'renderer-mode',mode:'gpu'}));assert(!validAction({type:'renderer-mode',mode:'automatic'}));assert(!validAction({type:'renderer-mode',mode:'gpu',extra:true}));bridge.dispose();
});

test('GPU capture validates descriptor snapshots without rereading switching Proxy properties',async()=>{
  const {bridge,s}=await start(),init=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;
  let gets=0;
  const switched=new Proxy(init,{get(target,key){gets++;if(key==='camera')return {...target.camera,cameraX:NaN};if(key==='type')return 'frame';return Reflect.get(target,key);}});
  const captured=captureGpuFrame(switched);assert.equal(gets,0);assert(validResult(captured));assert.equal(captured.type,'gpu-frame');assert.deepEqual(captured.camera,init.camera);
  for(const field of ['camera','summary','world','worldPoints'] as const){
    const raw=structuredClone(init),value=raw[field];if(!value)assert.fail();
    const trapped=new Proxy(value,{get(){gets++;throw new Error('must not get');}});
    Object.defineProperty(raw,field,{value:trapped});const copy=captureGpuFrame(raw);assert(validResult(copy));assert.equal(gets,0);
  }
  const wrong=new Proxy(init.camera,{getOwnPropertyDescriptor(target,key){const descriptor=Reflect.getOwnPropertyDescriptor(target,key);return key==='cameraX'?{...descriptor,value:NaN}:descriptor;}});
  assert.throws(()=>captureGpuFrame({...init,camera:wrong}),/gpu-message/);
  const batch=makeOriginalSprites({objects:[originalObject({id:'object-0'})]}).batch,withObject=structuredClone(init);
  withObject.resources=exportGpuScene(compileGpuScene(createTerrainScene(makeOriginalTerrain()),batch));withObject.objects=batch.objects;
  Object.assign(withObject.summary.artwork,{types:1,rendered:1,unavailable:2,omittedTypes:1,omittedRendered:1});
  withObject.objectInfo=[{id:'object-0',typeId:'type-0',name:'Original',family:'unit',owner:'Original',format:'shp',voxel:null,x:1,y:3,frame:0,sourcePath:'original.shp',sourceHash:'a'.repeat(64),palettePath:'original.pal',paletteHash:'b'.repeat(64)}];
  withObject.objectInfo[0]=new Proxy(withObject.objectInfo[0]!,{get(){gets++;throw new Error('must not get metadata');}});
  assert(validResult(captureGpuFrame(withObject)));assert.equal(gets,0);
  bridge.dispose();
});

test('bridge retains one descriptor-captured GPU snapshot for initialization and each world update',async()=>{
  const {worker,bridge,s}=await start(true);let gets=0;const reads:{world:number;summary:number}[]=[];
  worker.transform=reply=>{
    if(reply.type!=='result'||reply.result.type!=='gpu-frame')return reply;
    const counts={world:0,summary:0};reads.push(counts);
    return {...reply,result:new Proxy(reply.result,{
      get(){gets++;throw new Error('GPU boundary must capture descriptors');},
      getOwnPropertyDescriptor(target,key){if(key==='world'||key==='summary')counts[key]++;return Reflect.getOwnPropertyDescriptor(target,key);},
    })};
  };
  const init=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;
  const moved=await bridge.request({type:'world-step',ticks:1},s) as GpuFrameResult;
  assert.equal(init.world!.revision,0);assert.equal(moved.world!.revision,1);
  assert.deepEqual(reads,[{world:1,summary:1},{world:1,summary:1}]);assert.equal(gets,0);
  bridge.dispose();
});
