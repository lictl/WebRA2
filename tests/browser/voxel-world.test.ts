// SPDX-License-Identifier: GPL-3.0-or-later
// Original cubes, miniature mission and CPU composition assertions. No retail artwork.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBrowserCatalog } from '../../packages/vfs/src/browser-catalog.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { compileObjectArt } from '../../packages/content/src/object-art.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileVoxelPlan, VOXEL_PLAN_POLICY } from '../../packages/content/src/voxel-plan.ts';
import { prepareVoxelPreview } from '../../packages/content/src/voxel-preview.ts';
import { prepareObjectPreview } from '../../packages/content/src/object-preview.ts';
import { createVoxelAtlas, renderVoxelFrame, type VoxelFrame } from '../../packages/render/src/voxel-render.ts';
import { input, encode } from '../content/object-art.fixture.ts';
import { vxl, hva, affine, palette, file, sha } from '../content/voxel.fixture.ts';
import { createPlacedStill } from '../../apps/web/src/placed-still.ts';
import { createVoxelWorldViewport } from '../../apps/web/src/world-voxel-viewport.ts';
import { composeVoxelWorld, voxelWorldProjection } from '../../apps/web/src/world-voxel-compositor.ts';
import { validObjectPick, type ObjectInfo } from '../../apps/web/src/object-protocol.ts';
import { validVoxelFrame, validVoxelSummary } from '../../apps/web/src/voxel-protocol.ts';
import type { ViewportFrame, ViewportScene } from '../../apps/web/src/terrain-worker-runtime.ts';
import type { WorldSnapshot } from '../../apps/web/src/world-protocol.ts';
import { terrainText } from '../../apps/web/src/terrain-i18n.ts';
import {createTerrainScene} from '../../packages/render/src/terrain-scene.ts';
import {compileGpuScene} from '../../packages/render/src/gpu-scene.ts';
import {makeOriginalTerrain} from '../render/gpu-fixtures.ts';
import {captureGpuVoxelResources,captureGpuVoxelUpdate,retainGpuVoxelMetadata,validateGpuVoxelWorld} from '../../apps/web/src/gpu-voxel-protocol.ts';
const view={width:120,height:80,cameraX:0,cameraY:-20,zoom:1 as const,backgroundRgba:[2,3,4,255] as const};
function base(width:number,height:number,depth:number|null=null):ViewportFrame{
  const rgba=new Uint8Array(width*height*4);for(let i=0;i<width*height;i++)rgba.set([2,3,4,255],i*4);
  const bytes=rgba.byteLength;return {viewport:{...view,width,height},rgba,allocations:{rgbaBytes:bytes,depthBytes:bytes,ownerBytes:bytes,objectOwnerBytes:bytes,totalPixelBytes:bytes*4,samples:0,spriteSamples:0,paletteBytes:0,objects:0},
    pick(x,y){return depth===null?null:{kind:'terrain',cell:{sourceRecord:0,x:2,y:2,assetId:'tile',subtile:0,worldX:x,worldY:y,depth}};}};
}
const info:ObjectInfo={id:'object-0',typeId:'type-0',name:'Original cube',family:'unit',owner:'Home',format:'voxel',x:2,y:2,frame:0,sourcePath:'original.vxl',sourceHash:'a'.repeat(64),palettePath:'original.pal',paletteHash:'b'.repeat(64),
  voxel:{partId:'part',role:'body',section:0,hvaPath:'original.hva',hvaHash:'c'.repeat(64),hvaSection:0,hvaFrame:0,voxelOrdinal:0}};
function cube():VoxelFrame{
  const b=vxl().bytes,atlas=createVoxelAtlas({assets:[{id:'source',kind:'vxl',sha256:sha(b),bytes:b}],parts:[{id:'part',vxlAssetId:'source',vxlSection:0,hva:null,transformPolicy:'openra-hva-bounds-scale'}]});
  const rgba=new Uint8Array(1024);rgba.set([200,80,20,255],4);
  return renderVoxelFrame({atlas,instances:[{id:'actor',partId:'part',paletteId:'pal',modelToView:[4,0,0,0,0,-4,0,0,0,0,1,10]}],palettes:[{id:'pal',rgba,remap:null,transparentIndex:0}],viewport:{width:4,height:4,backgroundRgba:[0,0,0,0]},lighting:'unlit'});
}
test('declared cell projection has explicit independent corners, elevation and zoom-independent depth',()=>{
  const cell={column:2,row:3,elevation:2},m=voxelWorldProjection(cell,{...view,cameraX:10,cameraY:5});
  const apply=(p:number[])=>[0,4,8].map(i=>m[i]!*p[0]!+m[i+1]!*p[1]!+m[i+2]!*p[2]!+m[i+3]!);
  assert.deepEqual(apply([0,0,0]),[80,25,75]);assert.deepEqual(apply([1,2,3]),[72,13,111]);assert.deepEqual(apply([-1,1,-2]),[64,41,59]);
  const scaled=voxelWorldProjection(cell,{...view,cameraX:10,cameraY:5,zoom:4});assert.deepEqual(scaled.slice(8),m.slice(8));assert.deepEqual(scaled.slice(0,8),m.slice(0,8).map(n=>n*4));
  assert.throws(()=>voxelWorldProjection({...cell,row:NaN},view),/cell/);
});
test('actual cube rays compose in front, behind and at base ties with immutable frame-local ownership',()=>{
  const voxel=cube(),depth=voxel.pick(1,1)!.depth;assert.equal(depth,11);
  for(const baseDepth of [depth-.5,depth,depth+.5]){
    const lower=base(4,4,baseDepth),sources=new Map([['actor',structuredClone(info)]]),frame=composeVoxelWorld(lower,voxel,sources);
    assert.equal(frame.pick(1,1)?.kind,baseDepth<depth?'object':'terrain');assert.deepEqual([...frame.rgba.slice(20,24)],baseDepth<depth?[200,80,20,255]:[2,3,4,255]);
    if(baseDepth<depth){sources.get('actor')!.x=99;sources.clear();voxel.rgba.fill(0);frame.rgba.fill(0);const picked=frame.pick(1,1)!;
      assert.equal(picked.kind,'object');if(picked.kind==='object'){assert.equal(picked.object.x,2);assert.equal(picked.object.voxel!.voxelOrdinal,0);assert.ok(validObjectPick(picked));}}
    assert.ok(validVoxelFrame(frame.allocations.voxel,16));assert.equal(frame.allocations.totalPixelBytes,16*33);
    if(baseDepth<depth)voxel.rgba.set(cube().rgba);
  }
  const first=composeVoxelWorld(base(4,4),cube(),new Map([['actor',info]]));composeVoxelWorld(base(4,4),cube(),new Map([['actor',{...info,x:3}]]));assert.equal(first.pick(1,1)?.kind==='object'&&first.pick(1,1)!.kind==='object'?(first.pick(1,1) as {object:ObjectInfo}).object.x:null,2);
});
test('SHP exact ties retain its source; voxel internal instance ties remain lexicographic',()=>{
  const voxel=cube(),original=base(4,4),shp={...info,id:'object-9',format:'shp' as const,voxel:null};
  const basePick={kind:'object' as const,object:shp,canvasX:1,canvasY:1,worldX:1,worldY:1,depth:11};
  const lower={...original,allocations:{...original.allocations,objects:1},pick(){return basePick;}};
  const tied=composeVoxelWorld(lower,voxel,new Map([['actor',info]]));assert.equal(tied.pick(1,1)?.kind==='object'?(tied.pick(1,1) as {object:ObjectInfo}).object.id:null,'object-9');
  const nearer=composeVoxelWorld({...base(4,4),pick(){return {...basePick,depth:10};}},cube(),new Map([['actor',info]]));assert.equal(nearer.pick(1,1)?.kind==='object'?(nearer.pick(1,1) as {object:ObjectInfo}).object.id:null,'object-0');
  const b=vxl().bytes,atlas=createVoxelAtlas({assets:[{id:'s',kind:'vxl',sha256:sha(b),bytes:b}],parts:[{id:'part',vxlAssetId:'s',vxlSection:0,hva:null,transformPolicy:'openra-hva-bounds-scale'}]}),rgba=new Uint8Array(1024);rgba.set([200,80,20,255],4);
  const render=(ids:string[])=>renderVoxelFrame({atlas,instances:ids.map(id=>({id,partId:'part',paletteId:'p',modelToView:[4,0,0,0,0,-4,0,0,0,0,1,10]})),palettes:[{id:'p',rgba,remap:null,transparentIndex:0}],viewport:{width:4,height:4,backgroundRgba:[0,0,0,0]},lighting:'unlit'});
  for(const order of [['z','a'],['a','z']]){const frame=composeVoxelWorld(base(4,4),render(order),new Map([['z',{...info,id:'object-7'}],['a',info]]));assert.equal((frame.pick(1,1) as {object:ObjectInfo}).object.id,'object-0');}
});
test('composition and discriminated metadata reject bad frame/part joins, payloads and allocation claims',()=>{
  const f=cube();assert.throws(()=>composeVoxelWorld(base(5,4),f,new Map([['actor',info]])),/frame/);
  assert.throws(()=>composeVoxelWorld(base(4,4),f,new Map([['actor',{...info,voxel:{...info.voxel!,partId:'wrong'}}]])),/owner/);
  assert.throws(()=>composeVoxelWorld(base(4,4),f,new Map([['actor',{...info,sourceHash:'invalid'}]])),/source/);
  const picked=composeVoxelWorld(base(4,4),f,new Map([['actor',info]])).pick(1,1)!;assert.ok(validObjectPick(picked));
  assert.equal(validObjectPick({...picked,object:{...info,format:'shp'}}),false);assert.equal(validObjectPick({...picked,object:{...info,voxel:{...info.voxel,bytes:new Blob(['x'])}}}),false);
  assert.equal(validObjectPick({...picked,depth:NaN}),false);assert.equal(validVoxelFrame({...(composeVoxelWorld(base(4,4),cube(),new Map([['actor',info]])).allocations.voxel!),maskBytes:0},16),false);
});
function mapText(){
  const cells=new Uint8Array(10*11+4),v=new DataView(cells.buffer);let i=0;
  for(let row=0;row<4;row++)for(let col=row%2;col<5;col+=2){const at=i++*11;v.setUint16(at,(col+row+2)/2,true);v.setUint16(at+2,(row+6-col)/2,true);}
  const data=Buffer.from([cells.length+17,...cells,17,0,0]),pack=Buffer.alloc(data.length+4);pack.writeUInt16LE(data.length);pack.writeUInt16LE(cells.length,2);pack.set(data,4);
  const overlay=(value:number)=>Buffer.concat(Array.from({length:32},()=>Buffer.from([5,0,0,32,254,0,32,value,128]))).toString('base64');
  return '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN\n[Houses]\n0=Home\n[Home]\nCountry=Home\n[Units]\n0=Home,ROVER,256,2,2,0,Guard,None\n[IsoMapPack5]\n1='+pack.toString('base64')+'\n[OverlayPack]\n1='+overlay(255)+'\n[OverlayDataPack]\n1='+overlay(0);
}
async function fixture(conditional=false,missing=false,multipart=false){
  const mission=mapText(),i=input({mission,rules:'[Countries]\n0=Home\n[VehicleTypes]\n0=ROVER\n[ROVER]\nStrength=20\n'+(conditional?'NoSpawnAlt=yes\n':'')+(multipart?'Turret=yes\n':''),art:'[ROVER]\nVoxel=yes\n'}),plan=compileObjectArt(i);
  const terrain=compileScenarioTerrain({profile:'ra2',source:i.objects.source,bytes:encode(mission)});
  const rows:Record<string,Uint8Array>={'rover.vxl':vxl().bytes,'uniturb.pal':palette()};if(!missing)rows['rover.hva']=hva([affine()]);if(conditional){rows['roverwo.vxl']=vxl().bytes;rows['roverwo.hva']=hva([affine()]);}
  if(multipart)for(const part of ['rovertur','roverbarl']){rows[part+'.vxl']=vxl().bytes;rows[part+'.hva']=hva([affine()]);}
  const c=await inspectBrowserCatalog(Object.entries(rows).map(([n,b])=>file(n,b)),{profile:'ra2',policy:'tolerant'});
  try{const still=createPlacedStill(terrain,i.objects,await prepareObjectPreview(c,plan)),preview=await prepareVoxelPreview(c,compileVoxelPlan({objects:i.objects,rules:i.rules,art:i.art,artPlan:plan,definitions:compileEntityDefinitions({objects:i.objects,rules:i.rules,art:i.art}),policy:VOXEL_PLAN_POLICY}));return{i,plan,terrain,still,preview};}finally{await c.dispose();}
}
test('verified ready groups draw owned pixels; missing and conditional groups never draw partial bodies',async()=>{
  for(const conditional of [false,true])for(const missing of [false,true]){
    const f=await fixture(conditional,missing),baseScene:ViewportScene={render(v){return base(v.width,v.height);}};
    const result=createVoxelWorldViewport(baseScene,f.terrain,f.i.objects,f.still.artwork,f.plan,f.preview,null);assert.ok(validVoxelSummary(result.artwork.voxel));
    assert.equal(result.artwork.rendered,conditional||missing?0:1);assert.equal(result.artwork.unavailable,conditional||missing?1:0);
    assert.equal(result.scene.gpu,undefined);assert.equal(result.scene.gpuRefusal,'scene-unavailable');
    const frame=result.scene.render(view),picks=Array.from({length:view.width*view.height},(_,n)=>frame.pick(n%view.width,Math.floor(n/view.width))).filter(p=>p?.kind==='object');
    assert.equal(picks.length>0,!conditional&&!missing);
    if(!conditional&&!missing){assert.equal(result.artwork.rows[0]!.format,'voxel');assert.equal(result.artwork.rows[0]!.status,'ready');const before=sha(frame.rgba);f.preview.assets.forEach(a=>a.bytes.fill(0));f.preview.palettes.forEach(p=>p.rgba.fill(0));assert.equal(sha(result.scene.render(view).rgba),before);}
  }
});
test('source, model and actor joins fail explicitly; rendering leaves world model, save and replay hashes unchanged',async()=>{
  const f=await fixture(),baseScene:ViewportScene={render(v){return base(v.width,v.height);}},modelHash='a'.repeat(64),joins={modelHash,actors:[{objectId:'object-0',id:1,rowId:f.i.objects.placements[0]!.row.id}]};
  const result=createVoxelWorldViewport(baseScene,f.terrain,f.i.objects,f.still.artwork,f.plan,f.preview,joins);
  assert.throws(()=>createVoxelWorldViewport(baseScene,f.terrain,f.i.objects,f.still.artwork,f.plan,{...f.preview},joins),/source/);
  assert.throws(()=>createVoxelWorldViewport(baseScene,f.terrain,f.i.objects,f.still.artwork,f.plan,f.preview,{...joins,actors:[{...joins.actors[0]!,rowId:'wrong'}]}),/join/);
  assert.throws(()=>result.scene.render(view),/snapshot/);
  const snapshot={modelHash,actors:[{id:1,x:2,y:2}]} as WorldSnapshot;
  const first=result.scene.render(view,snapshot);snapshot.actors[0]!.x=3;const second=result.scene.render(view,snapshot);assert.notEqual(sha(first.rgba),sha(second.rgba));
  const p=Array.from({length:9600},(_,n)=>first.pick(n%120,Math.floor(n/120))).find(p=>p?.kind==='object');assert.equal(p?.kind==='object'?p.object.x:null,2);
  assert.throws(()=>result.scene.render(view,{...snapshot,modelHash:'b'.repeat(64)}),/snapshot/);
  assert.throws(()=>result.scene.render(view,{...snapshot,actors:[]}),/actor/);
  // No simulation object enters the renderer: a genuine state is snapshotted only.
  const {originalWorld}=await import('./world-ui.fixture.ts');const {WorldSession}=await import('../../apps/web/src/world-session.ts');
  const sim=new WorldSession(originalWorld()),before=sim.act({type:'world-save'}),identity=sim.model.sha256,replay=sim.act({type:'world-replay-export'});
  result.scene.render(view,{...snapshot,actors:[{id:1,x:2,y:2}]} as WorldSnapshot);
  assert.deepEqual(sim.act({type:'world-save'}),before);assert.deepEqual(sim.act({type:'world-replay-export'}),replay);assert.equal(sim.model.sha256,identity);
});
test('3D policy and selected-source labels have English and Traditional Chinese copy',()=>{
  for(const locale of ['en','zh-Hant'] as const)for(const key of ['format','voxel','voxel-sources','voxels','voxelPolicy','voxelPolicyValue','voxelGeometry','hvaPath','hvaHash','partRole'])assert.notEqual(terrainText(locale,key),terrainText(locale,'failure'));
});
test('multipart voxel retirement counts one prepared object and preserves sprite retirements and old frames',async()=>{
  const f=await fixture(false,false,true),modelHash='a'.repeat(64),joins={modelHash,actors:[{objectId:'object-0',id:1,rowId:f.i.objects.placements[0]!.row.id}]};
  const baseScene:ViewportScene={render(v){const frame=base(v.width,v.height);return {...frame,allocations:{...frame.allocations,retiredObjectIds:['object-9']}};}};
  const result=createVoxelWorldViewport(baseScene,f.terrain,f.i.objects,f.still.artwork,f.plan,f.preview,joins);
  assert.equal(f.preview.types[0]!.stillPartIds.length,3);assert.equal(result.artwork.rendered,1);
  const alive={modelHash,actors:[{id:1,x:2,y:2,health:20}]} as WorldSnapshot,dead=structuredClone(alive);dead.actors[0]!.health=0;
  const first=result.scene.render(view,alive),last=result.scene.render(view,dead),restored=result.scene.render(view,alive);
  assert.equal(first.allocations.objects,1);assert.equal(first.allocations.voxel!.instances,3);assert.deepEqual(first.allocations.retiredObjectIds,['object-9']);
  assert.equal(last.allocations.objects,0);assert.deepEqual(last.allocations.retiredObjectIds,['object-0','object-9']);assert.equal(last.allocations.voxel,undefined);
  assert.equal(restored.allocations.objects,1);assert.deepEqual(restored.allocations.retiredObjectIds,['object-9']);assert.deepEqual(first.rgba,restored.rgba);
  const n=Array.from({length:view.width*view.height},(_,n)=>n).find(n=>first.pick(n%view.width,Math.floor(n/view.width))?.kind==='object')!;
  assert(Number.isInteger(n));assert.equal(first.pick(n%view.width,Math.floor(n/view.width))?.kind,'object');assert.equal(last.pick(n%view.width,Math.floor(n/view.width)),null);
  const missing=await fixture(false,true),unavailable=createVoxelWorldViewport(baseScene,missing.terrain,missing.i.objects,missing.still.artwork,missing.plan,missing.preview,joins);
  assert.equal(unavailable.artwork.rendered,0);assert.deepEqual(unavailable.scene.render(view,dead).allocations.retiredObjectIds,['object-9']);
});
test('CPU and GPU share complete genuine multipart groups, current source grounds and retirement',async()=>{
  const f=await fixture(false,false,true),modelHash='a'.repeat(64),joins={modelHash,actors:[{objectId:'object-0',id:1,rowId:f.i.objects.placements[0]!.row.id}]};
  const baseScene:ViewportScene={render(v){return base(v.width,v.height);},gpu(){return {scene:compileGpuScene(createTerrainScene(makeOriginalTerrain())),objectInfo:[],project(){return {objects:[],retiredObjectIds:[]};}};}};
  const result=createVoxelWorldViewport(baseScene,f.terrain,f.i.objects,f.still.artwork,f.plan,f.preview,joins),gpu=result.scene.gpu!();
  assert(gpu.voxel);assert.equal(gpu.voxel.groups.length,1);assert.equal(gpu.voxel.groups[0]!.parts.length,3);assert.equal(gpu.voxel.parts.length,3);
  const alive={modelHash,actors:[{id:1,x:2,y:2,health:20}]} as WorldSnapshot,summary={modelHash,actors:[{id:1,objectId:'object-0'}]} as never;
  const exported=captureGpuVoxelResources(structuredClone(gpu.voxel)),resident=retainGpuVoxelMetadata(exported);
  for(const [x,health] of [[2,20],[3,20],[3,0],[2,20]]){
    const snapshot=structuredClone(alive);snapshot.actors[0]!.x=x!;snapshot.actors[0]!.health=health!;
    const state=gpu.project(snapshot),cpu=result.scene.render(view,snapshot),captured=captureGpuVoxelUpdate({version:1,resources:null,placements:state.voxelPlacements});
    validateGpuVoxelWorld(resident,captured.placements,summary,snapshot);
    assert.equal(captured.placements.length,health?1:0);assert.equal(cpu.allocations.voxel?.instances??0,health?3:0);
    assert.deepEqual(state.retiredObjectIds,health?[]:['object-0']);
    if(health){const p=captured.placements[0]!,cell=f.terrain.cells.find(c=>c.x===p.x&&c.y===p.y)!;assert.deepEqual([p.column,p.row,p.elevation],[cell.projectedColumn,cell.projectedRow,cell.elevation]);}
  }
  const state=gpu.project(alive),bad=state.voxelPlacements!.map(p=>({...p,column:p.column+1}));assert.throws(()=>validateGpuVoxelWorld(resident,bad,summary,alive),/gpu-voxel-message/);
  const prior=result.scene.render(view,alive).rgba.slice();for(const part of exported.parts)part.voxels.fill(0);for(const p of exported.palettes)p.rgba.fill(0);
  assert.deepEqual(result.scene.render(view,alive).rgba,prior);assert.notDeepEqual(result.scene.gpu!().voxel!.parts[0]!.voxels,exported.parts[0]!.voxels);
});
