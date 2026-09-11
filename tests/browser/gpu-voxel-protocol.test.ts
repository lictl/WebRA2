// SPDX-License-Identifier: GPL-3.0-or-later
// Original metadata, storage and complete worker-session cases; no browser/retail claims.
import test from 'node:test';import assert from 'node:assert/strict';
import {captureGpuVoxelResources,captureGpuVoxelUpdate,retainGpuVoxelMetadata,validateGpuVoxelWorld,gpuVoxelResourceIdentity} from '../../apps/web/src/gpu-voxel-protocol.ts';
import {TerrainBridge} from '../../apps/web/src/terrain-bridge.ts';
import type {GpuFrameResult,FrameResult} from '../../apps/web/src/terrain-protocol.ts';
import {GpuOriginalWorker,gpuOriginalLoad} from './gpu-worker.fixture.ts';
import {originalVoxelResources} from './gpu-voxel.fixture.ts';
const signal=()=>new AbortController().signal;
async function start(){const worker=new GpuOriginalWorker(undefined,true,true),bridge=new TerrainBridge(worker),s=signal(),first=await bridge.request(gpuOriginalLoad,s) as FrameResult;return {worker,bridge,s,first};}
test('versioned voxel resources capture complete bounded groups and fixed genuine byte storage',()=>{
  const raw=originalVoxelResources('a'.repeat(64)),captured=captureGpuVoxelResources(raw),identity=gpuVoxelResourceIdentity(captured);
  assert.equal(captured.groups[0]!.parts.length,3);assert.equal(captured.grounds.length,35);
  assert.notEqual(captured.groups,raw.groups);assert.notEqual(captured.groups[0]!.parts[0]!.info,raw.groups[0]!.parts[0]!.info);
  assert.equal(gpuVoxelResourceIdentity(captureGpuVoxelResources(structuredClone(captured))),identity);
  for(const patch of [{version:2},{groups:[]},{grounds:[]},{parts:[]}]){
    // An empty grouping is structurally valid; outer scene cardinality must refuse it.
    if('groups'in patch)assert.equal(captureGpuVoxelResources({...raw,...patch}).groups.length,0);
    else assert.throws(()=>captureGpuVoxelResources({...raw,...patch}),/gpu-voxel-message/);
  }
  for(const data of [new Uint8Array(new SharedArrayBuffer(5)),new Uint8Array(Reflect.construct(ArrayBuffer,[5,{maxByteLength:10}]) as ArrayBuffer),Object.setPrototypeOf(new Int8Array(5),Uint8Array.prototype),new Proxy(new Uint8Array(5),{})])
    assert.throws(()=>captureGpuVoxelResources({...raw,parts:[{...raw.parts[0]!,voxels:data}]}),/gpu-voxel-message/);
  const detached=new Uint8Array(5);structuredClone(detached,{transfer:[detached.buffer]});assert.throws(()=>captureGpuVoxelResources({...raw,parts:[{...raw.parts[0]!,voxels:detached}]}),/gpu-voxel-message/);
  let gets=0;assert.throws(()=>captureGpuVoxelResources({...raw,get groups(){gets++;return [];}}),/gpu-voxel-message/);assert.equal(gets,0);
  const spoof=new Proxy(raw,{get(){gets++;throw Error('must not call');}});assert.deepEqual(captureGpuVoxelResources(spoof),captured);assert.equal(gets,0);
  for(const mutate of [(v:typeof raw)=>({...v,parts:[...v.parts,v.parts[0]!]}),(v:typeof raw)=>({...v,grounds:[...v.grounds,v.grounds[0]!]}),
    (v:typeof raw)=>({...v,groups:[{...v.groups[0]!,parts:[v.groups[0]!.parts[0]!,v.groups[0]!.parts[0]!]}]}),
    (v:typeof raw)=>({...v,groups:[{...v.groups[0]!,actorId:null}]}),
    (v:typeof raw)=>({...v,groups:[{...v.groups[0]!,initial:{...v.groups[0]!.initial,column:999}}]})])assert.throws(()=>captureGpuVoxelResources(mutate(raw)),/gpu-voxel-message/);
});
test('worker transfers resident voxel planes once and keeps source-ground joins through movement and CPU fallback',async()=>{
  const {worker,bridge,s,first}=await start(),init=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;
  assert(init.voxel?.resources);assert.equal(init.objectInfo!.length,1);assert.equal(init.voxel.resources.groups.length,1);assert.equal(init.voxel.resources.groups[0]!.parts.length,3);
  assert.equal(init.summary.artwork.rendered,2);assert.equal(init.world!.stateHash,first.world!.stateHash);assert(worker.transferred.at(-1)!>=4);
  const resident=retainGpuVoxelMetadata(init.voxel.resources);for(const p of init.voxel.resources.parts)structuredClone(p.voxels,{transfer:[p.voxels.buffer]});
  const before=await bridge.request({type:'world-save'},s);
  await bridge.request({type:'world-order',order:'move',entityId:2,playerId:1,x:5,y:5},s);
  const moved=await bridge.request({type:'world-step',ticks:4},s) as GpuFrameResult;
  assert(moved.voxel);assert.equal(moved.voxel.resources,null);assert.equal(moved.resources,null);assert.equal(worker.transferred.at(-1),0);assert.equal(worker.cpuRenders,1);
  assert.equal(moved.voxel.placements[0]!.x,moved.world!.actors[1]!.x);assert.equal(moved.voxel.placements[0]!.column,moved.voxel.placements[0]!.x-1);
  validateGpuVoxelWorld(resident,moved.voxel.placements,moved.summary.world,moved.world);
  const cpu=await bridge.request({type:'renderer-mode',mode:'cpu'},s) as FrameResult;assert.equal(cpu.world!.stateHash,moved.world!.stateHash);
  const again=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;assert(again.voxel?.resources);assert.equal(again.voxel.resources.parts[0]!.voxels.byteLength,5);
  if(before.type!=='world-document'||!before.text)assert.fail();const restored=await bridge.request({type:'world-restore',text:before.text},s) as GpuFrameResult;
  assert.equal(restored.voxel!.placements[0]!.x,7);assert.equal(restored.world!.stateHash,first.world!.stateHash);bridge.dispose();
});
test('bridge rejects missing voxel updates, altered source groups, duplicate ownership and dishonest current grounds',async()=>{
  const changes:((f:GpuFrameResult)=>void)[]=[f=>{delete f.voxel;},f=>{f.voxel={...f.voxel!,version:2 as never};},
    f=>{f.voxel={...f.voxel!,placements:[]};},f=>{f.voxel={...f.voxel!,placements:f.voxel!.placements.map(p=>({...p,column:p.column+1}))};},
    f=>{f.voxel={...f.voxel!,placements:f.voxel!.placements.map(p=>({...p,objectId:'object-0'}))};}];
  for(const initializing of [true,false])for(const change of changes){
    const {worker,bridge,s}=await start();if(!initializing)await bridge.request({type:'renderer-mode',mode:'gpu'},s);
    worker.transform=r=>{if(r.type==='result'&&r.result.type==='gpu-frame')change(r.result);return r;};
    await assert.rejects(bridge.request(initializing?{type:'renderer-mode',mode:'gpu'}:{type:'world-step',ticks:1},s),/invalid/);assert.equal(worker.terminated,1);
  }
  const {worker,bridge,s}=await start();await bridge.request({type:'renderer-mode',mode:'gpu'},s);await bridge.request({type:'renderer-mode',mode:'cpu'},s);
  worker.transform=r=>{if(r.type==='result'&&r.result.type==='gpu-frame'&&r.result.voxel?.resources)r.result.voxel.resources.parts[0]!.voxels[3]=9;return r;};
  await assert.rejects(bridge.request({type:'renderer-mode',mode:'gpu'},s),/invalid/);assert.equal(worker.terminated,1);
});
test('all-retired groups preserve the negotiated layer; wrong model, missing members and resurrection reject',async()=>{
  const {bridge,s}=await start(),init=await bridge.request({type:'renderer-mode',mode:'gpu'},s) as GpuFrameResult;assert(init.voxel?.resources);
  const resources=init.voxel.resources,dead=structuredClone(init.world!);dead.actors[1]!.health=0;
  validateGpuVoxelWorld(resources,[],init.summary.world,dead);
  assert.throws(()=>validateGpuVoxelWorld(resources,init.voxel!.placements,init.summary.world,dead),/gpu-voxel-message/);
  assert.throws(()=>validateGpuVoxelWorld(resources,[],init.summary.world,init.world),/gpu-voxel-message/);
  assert.throws(()=>validateGpuVoxelWorld(resources,init.voxel!.placements,init.summary.world,{...init.world!,modelHash:'f'.repeat(64)}),/gpu-voxel-message/);
  assert.throws(()=>validateGpuVoxelWorld({...resources},init.voxel!.placements,init.summary.world,init.world),/gpu-voxel-message/);
  assert.deepEqual(captureGpuVoxelUpdate({version:1,resources:null,placements:[]}).placements,[]);bridge.dispose();
});
