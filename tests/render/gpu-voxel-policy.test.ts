// SPDX-License-Identifier: GPL-3.0-or-later
// Original sparse cubes and matrices; no retail geometry or native rendering claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGpuVoxelScene, prepareGpuVoxelFrame, pickGpuVoxelFrame, copyGpuVoxelSceneData, copyGpuVoxelFrameData } from '../../packages/render/src/gpu-voxel-policy.ts';
import { createVoxelAtlas, renderVoxelFrame } from '../../packages/render/src/voxel-render.ts';
import { createRuntimeVxl } from '../../packages/formats/src/runtime-vxl.ts';
import { vxl, hva, sha } from '../content/voxel.fixture.ts';
import { gpuVoxelOracleCases } from './gpu-voxel-fixtures.ts';
function fixture(cells: readonly (readonly [number,number,number,number,number])[] = [[0,0,0,1,7]], size = [1,1,1], pose?:number[]) {
 const bytes=vxl(cells,size).bytes,animation=pose?hva([pose]):null,atlas=createVoxelAtlas({assets:[{id:'source',kind:'vxl',sha256:sha(bytes),bytes},...(animation?[{id:'pose',kind:'hva' as const,sha256:sha(animation),bytes:animation}]:[])],parts:[{id:'part',vxlAssetId:'source',vxlSection:0,hva:animation?{assetId:'pose',layout:'frame-major',frame:0,section:0}:null,transformPolicy:'openra-hva-bounds-scale'}]});
 const rgba=new Uint8Array(1024);for(let i=0;i<256;i++)rgba.set([i,255-i,i*17%256,255],i*4);rgba[11*4+3]=0;
 const voxels=createRuntimeVxl(bytes).decodeSection(0).voxels,part={id:'part',voxels,modelMatrix:atlas.parts[0]!.modelMatrix},palette={id:'palette',rgba,remap:null,transparentIndex:0};
 const input={parts:[part],palettes:[palette]},scene=createGpuVoxelScene(input);
 return {input,scene,atlas,palette};
}
const model=(z=10)=>[4,0,0,10,0,4,0,10,0,0,1,z];
const instance=(id='actor',m=model())=>({id,partId:'part',paletteId:'palette',modelToView:m});
test('Float64 diagnostic reproduces unchanged sparse cube renderer at every pixel',()=>{
 const cells: [number,number,number,number,number][]=[];for(let z=0;z<3;z++)for(let y=0;y<3;y++)for(let x=0;x<4;x++)if((x+y+z)%3)cells.push([x,y,z,1+x+y*4+z*12,7]);
 let compared=0;
 for(const pose of [undefined,[1,.15,0,.125,0,1,-.2,.3,.1,0,1,-.1]]){
  const f=fixture(cells,[4,3,3],pose);
  for(const zoom of [.5,1,2,4])for(const shift of [0,.25,-.375]){
   const m=[8*zoom,-8*zoom,0,30+shift,4*zoom,4*zoom,-8*zoom,30-shift,4,4,8,30],instances=[instance('actor',m)];
   const frame=prepareGpuVoxelFrame(f.scene,{instances,width:64,height:64}),old=renderVoxelFrame({atlas:f.atlas,instances,palettes:[f.palette],viewport:{width:64,height:64,backgroundRgba:[0,0,0,0]},lighting:'unlit'});
   assert.equal(frame.allocations.samples,old.allocations.samples);
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const a=pickGpuVoxelFrame(frame,x,y,'float64'),b=old.pick(x,y);assert.equal(a===null,b===null);if(a&&b)assert.deepEqual([a.instanceId,a.partId,a.voxelOrdinal,a.x,a.y,a.z,a.colorIndex,a.normalIndex,a.depth],[b.instanceId,b.partId,b.voxelOrdinal,b.x,b.y,b.z,b.colorIndex,b.normalIndex,b.depth]);compared++;
   }
  }
 }
 assert.equal(compared,98304);
});
test('Float32 policy explicitly changes close-depth ownership while exact ties keep earlier instance',()=>{
 const f=fixture();
 const exact=prepareGpuVoxelFrame(f.scene,{instances:[instance('z'),instance('a')],width:24,height:24});
 assert.equal(pickGpuVoxelFrame(exact,11,9)!.instanceId,'a');assert.equal(pickGpuVoxelFrame(exact,11,9,'float64')!.instanceId,'a');
 const close=prepareGpuVoxelFrame(f.scene,{instances:[instance('z',model(10+1e-7)),instance('a')],width:24,height:24});
 assert.equal(pickGpuVoxelFrame(close,11,9)!.instanceId,'a');assert.equal(pickGpuVoxelFrame(close,11,9,'float64')!.instanceId,'z');
 assert.notEqual(pickGpuVoxelFrame(close,11,9)!.depth,pickGpuVoxelFrame(close,11,9,'float64')!.depth);
});
test('owned geometry and palette survive mutation and detached frame staging cannot change picks',()=>{
 const f=fixture(),frame=prepareGpuVoxelFrame(f.scene,{instances:[instance()],width:24,height:24}),before=pickGpuVoxelFrame(frame,11,9);
 assert(before);f.input.parts[0]!.voxels.fill(0);f.palette.rgba.fill(0);
 const resident=copyGpuVoxelSceneData(f.scene);resident.geometry.fill(0);resident.rgba.fill(0);
 const staged=copyGpuVoxelFrameData(frame);staged.boxes.fill(0);staged.inverses.fill(0);staged.candidates.fill(0);staged.offsets.fill(0);staged.placements[0]!.id='wrong';
 assert.deepEqual(pickGpuVoxelFrame(frame,11,9),before);assert.deepEqual(pickGpuVoxelFrame(frame,11.5,9.5),before);
 assert.throws(()=>pickGpuVoxelFrame({...frame},11,9),/frame/);assert.throws(()=>prepareGpuVoxelFrame({...f.scene},{instances:[],width:1,height:1}),/scene/);assert.equal(pickGpuVoxelFrame(frame,-1,0),null);assert.equal(pickGpuVoxelFrame(frame,NaN,0),null);
});
test('descriptor capture does not invoke property getters or trust typed-array shadows',()=>{
 const f=fixture();let gets=0;const trapped=new Proxy(f.input,{get(){gets++;throw Error('raw get');}});
 assert(createGpuVoxelScene(trapped));assert.equal(gets,0);
 const inst=new Proxy(instance(),{get(){gets++;throw Error('raw instance get');}});assert(prepareGpuVoxelFrame(f.scene,{instances:[inst],width:24,height:24}));assert.equal(gets,0);
 const bad={...f.input};Object.defineProperty(bad,'parts',{get(){gets++;return [];}});assert.throws(()=>createGpuVoxelScene(bad),/record/);assert.equal(gets,0);
 const bytes=f.input.parts[0]!.voxels;Object.defineProperty(bytes,'byteLength',{get(){gets++;throw Error('shadow');}});assert(createGpuVoxelScene(f.input));assert.equal(gets,0);
 assert.throws(()=>createGpuVoxelScene({...f.input,parts:[{...f.input.parts[0]!,voxels:new Proxy(bytes,{})}]}),/bytes/);
});
test('candidate, sample and array budgets reject deterministically at their exact boundary',()=>{
 const f=fixture(),input={instances:[instance()],width:24,height:24},frame=prepareGpuVoxelFrame(f.scene,input),a=frame.allocations;
 assert(prepareGpuVoxelFrame(f.scene,input,{samples:a.samples,candidateTests:a.candidateTests,binEntries:a.binEntries,binCandidates:a.maxBinCandidates,frameBytes:a.frameBytes}));
 for(const [key,value] of [['samples',a.samples],['candidateTests',a.candidateTests],['binEntries',a.binEntries],['binCandidates',a.maxBinCandidates],['frameBytes',a.frameBytes]] as const)assert.throws(()=>prepareGpuVoxelFrame(f.scene,input,{[key]:value-1}),/budget/);
 assert(createGpuVoxelScene(f.input,{residentBytes:f.scene.allocations.residentBytes}));assert.throws(()=>createGpuVoxelScene(f.input,{residentBytes:f.scene.allocations.residentBytes-1}),/resident-budget/);
 assert.throws(()=>prepareGpuVoxelFrame(f.scene,{instances:Array.from({length:3},(_,i)=>instance('i'+i)),width:24,height:24},{binCandidates:2}),/candidate-budget/);
});
test('transparent palette entries and complete multipart ordering retain source ordinals',()=>{
 const f=fixture([[0,0,0,11,7],[1,0,0,1,8]],[2,1,1]);
 const frame=prepareGpuVoxelFrame(f.scene,{instances:[instance('body'),instance('turret')],width:24,height:24});let hits=0;
 for(let y=0;y<24;y++)for(let x=0;x<24;x++){const hit=pickGpuVoxelFrame(frame,x,y);if(hit){hits++;assert.equal(hit.instanceId,'body');assert.equal(hit.voxelOrdinal,1);assert.equal(hit.normalIndex,8);assert.equal(hit.colorIndex,1);}}
 assert(hits>0);assert.equal(frame.allocations.instanceVoxels,4);
});
test('invalid references, sparse geometry duplicates and nonbinary alpha fail explicitly',()=>{
 const f=fixture();assert.throws(()=>prepareGpuVoxelFrame(f.scene,{instances:[{...instance(),partId:'missing'}],width:24,height:24}),/reference/);
 assert.throws(()=>prepareGpuVoxelFrame(f.scene,{instances:[instance(),instance()],width:24,height:24}),/instance/);
 assert.throws(()=>createGpuVoxelScene({...f.input,parts:[{...f.input.parts[0]!,voxels:new Uint8Array([0,0,0,1,7,0,0,0,2,8])}]}),/duplicate-voxel/);
 const rgba=f.palette.rgba.slice();rgba[3]=12;assert.throws(()=>createGpuVoxelScene({...f.input,palettes:[{...f.palette,rgba}]}),/alpha/);
 assert.throws(()=>prepareGpuVoxelFrame(f.scene,{instances:[instance('bad',Array(12).fill(0))],width:24,height:24}),/singular/);
 assert.throws(()=>prepareGpuVoxelFrame(f.scene,{instances:[instance('far',model(1048576))],width:24,height:24}),/projection/);
});
test('browser fixture matrix keeps the old Float64 reference and exposes the distinct Float32 policy',()=>{
 let pixels=0,changedOwners=0,changedDepths=0;const cases=gpuVoxelOracleCases();assert.equal(cases.length,43);
 for(const c of cases){const old=renderVoxelFrame(c.reference);assert.equal(c.frame.allocations.samples,old.allocations.samples);
  for(let y=0;y<c.frame.height;y++)for(let x=0;x<c.frame.width;x++){
   const prior=old.pick(x,y),exact=pickGpuVoxelFrame(c.frame,x,y,'float64'),candidate=pickGpuVoxelFrame(c.frame,x,y);
   assert.equal(exact?.instanceId,prior?.instanceId,c.id);assert.equal(exact?.voxelOrdinal,prior?.voxelOrdinal,c.id);assert.equal(exact?.depth,prior?.depth,c.id);
   if(candidate?.instanceId!==prior?.instanceId||candidate?.voxelOrdinal!==prior?.voxelOrdinal)changedOwners++;
   if(candidate&&prior&&candidate.depth!==prior.depth)changedDepths++;pixels++;
  }
 }
 assert.equal(pixels,151488);assert.ok(changedOwners>0);assert.ok(changedDepths>0);
});
