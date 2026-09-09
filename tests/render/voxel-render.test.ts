// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic models, transforms, palettes and camera cases. No retail assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVoxelAtlas,renderVoxelFrame,VOXEL_RENDER_LIMITS,VOXEL_TRANSFORM_POLICY,type VoxelAtlasInput,type VoxelFrameInput,type VoxelInstance,type VoxelPalette} from '../../packages/render/src/voxel-render.ts';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
type Cell=readonly [number,number,number,number,number];
function vxl(cells:readonly Cell[]=[[0,0,0,1,7]],size:readonly number[]=[1,1,1],scale=1,bounds:readonly number[]=[0,0,0,...size]){
  const [sx,sy,sz]=size as [number,number,number],columns=sx*sy,rows:number[][]=[];
  for(let y=0;y<sy;y++)for(let x=0;x<sx;x++){
    const values=cells.filter(c=>c[0]===x&&c[1]===y).sort((a,b)=>a[2]-b[2]),row:number[]=[];let z=0;
    for(const c of values){row.push(c[2]-z,1,c[3],c[4],1);z=c[2]+1;}
    if(values.length&&z<sz)row.push(sz-z,0,0);rows.push(row);
  }
  const body=830,bodySize=columns*8+rows.reduce((n,r)=>n+r.length,0),footer=body+bodySize,b=new Uint8Array(footer+92),v=new DataView(b.buffer);
  b.set(new TextEncoder().encode('Voxel Animation\0'));v.setUint32(16,1,true);v.setUint32(20,1,true);v.setUint32(24,1,true);v.setUint32(28,bodySize,true);v.setUint16(32,0x1f10,true);
  b.set(new TextEncoder().encode('original'),802);v.setUint32(822,1,true);let at=columns*8;
  rows.forEach((r,i)=>{v.setInt32(body+i*4,r.length?at-columns*8:-1,true);b.set(r,body+at);at+=r.length;v.setInt32(body+columns*4+i*4,r.length?at-columns*8-1:-1,true);});
  v.setUint32(footer,0,true);v.setUint32(footer+4,columns*4,true);v.setUint32(footer+8,columns*8,true);v.setFloat32(footer+12,scale,true);
  for(const i of [0,5,10])v.setFloat32(footer+16+i*4,1,true);bounds.forEach((n,i)=>v.setFloat32(footer+64+i*4,n,true));b.set([...size,4],footer+88);
  return {bytes:b,view:v,footer,body};
}
const affine=(x=0):number[]=>[1,0,0,x,0,1,0,0,0,0,1,0];
function hva(matrices:readonly (readonly number[])[],frames=matrices.length,sections=1){
  const data=24+16*sections,b=new Uint8Array(data+48*matrices.length),v=new DataView(b.buffer);v.setUint32(16,frames,true);v.setUint32(20,sections,true);
  for(let i=0;i<sections;i++)b.set(new TextEncoder().encode('original'+i),24+i*16);
  matrices.forEach((m,i)=>m.forEach((n,k)=>v.setFloat32(data+48*i+4*k,n,true)));return b;
}
function source(bytes=vxl().bytes,hvaBytes?:Uint8Array):VoxelAtlasInput{
  return {assets:[{id:'v',kind:'vxl',sha256:sha(bytes),bytes},...(hvaBytes?[{id:'h',kind:'hva' as const,sha256:sha(hvaBytes),bytes:hvaBytes}]:[])],
    parts:[{id:'part',vxlAssetId:'v',vxlSection:0,hva:hvaBytes?{assetId:'h',layout:'frame-major',frame:0,section:0}:null,transformPolicy:VOXEL_TRANSFORM_POLICY}]};
}
function palette():VoxelPalette{
  const rgba=new Uint8Array(1024);for(let i=0;i<256;i++)rgba.set([i*3%256,i*5%256,i*7%256,255],i*4);
  return {id:'colors',rgba,remap:null,transparentIndex:0};
}
const view=(zoom=1,z=0):number[]=>[zoom,0,0,0,0,-zoom,0,0,0,0,1,z];
function request(input=source(),modelToView=view(2),width=2,height=2):VoxelFrameInput{
  return {atlas:createVoxelAtlas(input),instances:[{id:'actor',partId:'part',paletteId:'colors',modelToView}],palettes:[palette()],viewport:{width,height,backgroundRgba:[0,0,0,0]},lighting:'unlit'};
}
test('a transformed unit cube covers exact pixel centers and emits private near-surface depth/pick ownership',()=>{
  const frame=renderVoxelFrame(request());assert.deepEqual([...frame.rgba],Array(4).fill([3,5,7,255]).flat());assert.deepEqual([...frame.copyDepth()],[1,1,1,1]);
  const pick=frame.pick(1,1)!;assert.deepEqual([pick.instanceId,pick.x,pick.y,pick.z,pick.colorIndex,pick.normalIndex,pick.depth],['actor',0,0,0,1,7,1]);
  assert.equal(frame.allocations.samples,4);assert.equal(frame.allocations.instanceVoxels,1);assert.equal(frame.nativeBehaviorVerified,false);
});
test('slab intersection computes an oblique cube surface, not a projected voxel center',()=>{
  const r=request(source(),[1,1,0,0,.5,-.5,-1,1,1,-1,1,0],1,1),f=renderVoxelFrame(r);
  assert.ok(Math.abs(f.pick(0,0)!.depth-2)<1e-12);assert.deepEqual([...f.rgba],[3,5,7,255]);
});
test('nearest voxels occlude farther voxels, while source transparency and remapped alpha zero preserve far depth',()=>{
  const r=request(source(vxl([[0,0,0,1,7],[0,0,1,2,8]],[1,1,2]).bytes));
  assert.equal(renderVoxelFrame(r).pick(0,0)!.colorIndex,2);assert.equal(renderVoxelFrame(r).pick(0,0)!.depth,2);
  const p={...palette(),transparentIndex:2};assert.equal(renderVoxelFrame({...r,palettes:[p]}).pick(0,0)!.depth,1);
  const remap=Uint8Array.from({length:256},(_,i)=>i);remap[2]=3;const remapped={...palette(),remap};remapped.rgba[15]=0;
  const f=renderVoxelFrame({...r,palettes:[remapped]});assert.equal(f.pick(0,0)!.colorIndex,1);assert.equal(f.pick(0,0)!.depth,1);
  remapped.rgba[7]=0;assert.equal(renderVoxelFrame({...r,palettes:[remapped]}).pick(0,0),null);
});
test('instance depth and equal-depth ID ordering are independent of input order',()=>{
  const r=request(),a={id:'a',partId:'part',paletteId:'colors',modelToView:view(2)},b={...a,id:'b',modelToView:view(2,1)};
  for(const instances of [[a,b],[b,a]])assert.equal(renderVoxelFrame({...r,instances}).pick(0,0)!.instanceId,'b');
  b.modelToView=view(2);for(const instances of [[a,b],[b,a]])assert.equal(renderVoxelFrame({...r,instances}).pick(0,0)!.instanceId,'a');
});
test('selected HVA pose, footer scale/bounds and Y flip follow the explicit pinned transform policy',()=>{
  const f=vxl([[0,0,0,1,7]],[1,1,1],.5,[-1,-1,0,1,1,1]);f.view.setFloat32(f.footer+28,123,true);
  const input=source(f.bytes,hva([affine(2)])),r=request(input,[4,0,0,0,0,-4,0,4,0,0,1,0],5,5),m=r.atlas.parts[0]!;
  assert.deepEqual(m.modelMatrix,[.5,0,0,.5,0,-.5,0,.5,0,0,.5,0]);assert.equal(m.sourceSection.transform.values[3],123);
  assert.equal(m.selectedHva!.values[3],2);assert.equal(m.hva!.layout,'frame-major');assert.ok(r.atlas.diagnostics.some(d=>d.code==='vxl-footer-transform-not-applied'));
  const frame=renderVoxelFrame(r);assert.equal(frame.pick(2,2)!.depth,.5);assert.equal(frame.pick(1,2),null);assert.equal(frame.pick(4,2),null);
});
test('ambiguous HVA layout stays explicit and chooses distinct physical pose records',()=>{
  const bytes=hva([affine(0),affine(1),affine(2),affine(3)],2,2);
  for(const [layout,record]of [['frame-major',2],['section-major',1]]as const){
    const input=source(vxl().bytes,bytes),p=input.parts[0]!;
    const atlas=createVoxelAtlas({...input,parts:[{...p,hva:{assetId:'h',layout,frame:1,section:0}}]});
    assert.equal(atlas.parts[0]!.selectedHva!.record,record);assert.equal(atlas.parts[0]!.modelMatrix[3],record);
  }
  const input=source(vxl().bytes,bytes),p=input.parts[0]!;
  assert.throws(()=>createVoxelAtlas({...input,parts:[p,{...p,id:'other',hva:{assetId:'h',layout:'section-major',frame:0,section:0}}]}),/layout-conflict/);
});
test('source snapshots and copied RGBA/depth cannot change atlas metadata or pick ownership',()=>{
  const input=source(vxl().bytes,hva([affine()])),r=request(input),first=renderVoxelFrame(r),rgba=first.rgba.slice(),depth=first.copyDepth();
  for(const s of input.assets)s.bytes.fill(0);first.rgba.fill(0);first.copyDepth().fill(99);r.palettes[0]!.rgba.fill(0);
  assert.equal(first.pick(0,0)!.depth,1);assert.equal(first.pick(0,0)!.colorIndex,1);
  const again=renderVoxelFrame({...r,palettes:[palette()]});assert.deepEqual(again.rgba,rgba);assert.deepEqual(again.copyDepth(),depth);
  for(const value of [r.atlas,r.atlas.parts,r.atlas.parts[0]!.modelMatrix,r.atlas.parts[0]!.selectedHva!.values])assert.ok(Object.isFrozen(value));
  assert.throws(()=>renderVoxelFrame({...r,atlas:structuredClone(r.atlas)}),/voxel-atlas/);
});
test('all source sizes precede hashing; span/geometry/matrix and projected work caps reject without partial frames',()=>{
  const input=source(),second=source().assets[0]!;
  assert.throws(()=>createVoxelAtlas({...input,assets:[{...input.assets[0]!,sha256:'0'.repeat(64)},{...second,id:'second'}],parts:[...input.parts,{...input.parts[0]!,id:'second',vxlAssetId:'second'}]}, {sourceBytes:second.bytes.length}),/source-budget/);
  for(const cap of [{sourceBytes:0},{columns:0},{runs:0},{sourceVoxels:0},{selectedVoxels:0},{sections:0}])assert.throws(()=>createVoxelAtlas(input,cap),/limit|budget/);
  assert.throws(()=>createVoxelAtlas(source(vxl().bytes,hva([affine()])),{matrices:0}),/matrix-limit/);
  const r=request();for(const cap of [{samples:3},{pixels:3},{instanceVoxels:0},{instances:0},{palettes:0},{dimension:1}])assert.throws(()=>renderVoxelFrame(r,cap),/budget|integer|array/);
  assert.throws(()=>renderVoxelFrame({...r,palettes:[{...palette(),transparentIndex:1}]},{samples:3}),/sample-budget/);
  assert.throws(()=>createVoxelAtlas(input,{sourceBytes:VOXEL_RENDER_LIMITS.sourceBytes+1}),/voxel-limits/);
});
test('source identity, unknown normal types, invalid bounds and aliased spans remain explicit failures',()=>{
  const input=source();assert.throws(()=>createVoxelAtlas({...input,assets:[{...input.assets[0]!,sha256:'f'.repeat(64)}]}),/source-identity/);
  for(const change of [(f:ReturnType<typeof vxl>)=>{f.bytes[f.footer+91]=7;},(f:ReturnType<typeof vxl>)=>f.view.setFloat32(f.footer+12,0,true),
    (f:ReturnType<typeof vxl>)=>f.view.setFloat32(f.footer+76,-1,true),(f:ReturnType<typeof vxl>)=>f.view.setUint32(f.footer+4,0,true)]){
    const f=vxl();change(f);assert.throws(()=>createVoxelAtlas(source(f.bytes)),/normal-table|scale|bounds|overlapping/);
  }
  assert.throws(()=>createVoxelAtlas(source(vxl().bytes,hva([Array(12).fill(0)]))),/singular/);
});
test('malformed structures, getters, aliases, palettes and matrices reject before rasterization',()=>{
  const input=source();let accessed=false;
  const getter=Object.defineProperty({...input.assets[0]!},'bytes',{enumerable:true,get(){accessed=true;return new Uint8Array(0);}});
  assert.throws(()=>createVoxelAtlas({...input,assets:[getter]}),/fields/);assert.equal(accessed,false);
  assert.throws(()=>createVoxelAtlas({...input,parts:[input.parts[0]!,{...input.parts[0]!,id:'alias'}]}),/duplicate-selection/);
  const sparse=Array(1) as VoxelInstance[];const r=request();assert.throws(()=>renderVoxelFrame({...r,instances:sparse}),/array/);
  assert.throws(()=>renderVoxelFrame({...r,instances:[r.instances[0]!,r.instances[0]!]}),/duplicate-instance/);
  for(const m of [Array(12).fill(0),[Infinity,...view().slice(1)],view().map((n,i)=>i===0?1e-10:n)])assert.throws(()=>renderVoxelFrame({...r,instances:[{...r.instances[0]!,modelToView:m}]}),/singular|coordinate|ill-conditioned/);
  const p=palette();p.rgba[3]=128;assert.throws(()=>renderVoxelFrame({...r,palettes:[p]}),/alpha/);
  assert.throws(()=>renderVoxelFrame({...r,lighting:'native' as never}),/lighting/);
  assert.throws(()=>createVoxelAtlas({...input,assets:[{...input.assets[0]!,bytes:Buffer.from(input.assets[0]!.bytes)}]}),/bytes/);
  assert.throws(()=>renderVoxelFrame({...r,instances:[{...r.instances[0]!,modelToView:new Float32Array(view()) as never}]}),/array/);
});
test('empty geometry and off-screen projections preserve background and empty private depth/owners',()=>{
  const r=request(source(vxl([]).bytes)),f=renderVoxelFrame(r);assert.equal(f.allocations.instanceVoxels,0);assert.equal(f.allocations.samples,0);assert.equal(f.pick(0,0),null);assert.ok(f.copyDepth().every(d=>d===-Infinity));
  const off=request();const transform=view();transform[3]=100;const out=renderVoxelFrame({...off,instances:[{...off.instances[0]!,modelToView:transform}]});
  assert.equal(out.allocations.samples,0);assert.deepEqual(out.rgba,new Uint8Array(16));assert.equal(out.pick(0,0),null);
  assert.throws(()=>out.pick(2,0),/integer/);
});
