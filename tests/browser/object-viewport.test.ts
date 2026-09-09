// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature mission/SHP/TMP fixtures. No retail bytes or expected retail pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { input, assets, file, mission, rules, art, encode, sha } from '../content/object-art.fixture.ts';
import { compileObjectArt } from '../../packages/content/src/object-art.ts';
import { prepareObjectPreview } from '../../packages/content/src/object-preview.ts';
import { inspectBrowserCatalog } from '../../packages/vfs/src/browser-catalog.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { createTerrainScene } from '../../packages/render/src/terrain-scene.ts';
import { createPlacedStill, createPlacedViewport } from '../../apps/web/src/placed-still.ts';
import { validArtworkSummary, validObjectPick } from '../../apps/web/src/object-protocol.ts';
import { TerrainBridge } from '../../apps/web/src/terrain-bridge.ts';
import { validResult, type FrameResult, type TerrainAction } from '../../apps/web/src/terrain-protocol.ts';
import { terrainText, artworkStatusText } from '../../apps/web/src/terrain-i18n.ts';
function packed(bytes:Uint8Array, lzo:boolean):string {
  if(lzo){const data=Buffer.from([bytes.length+17,...bytes,17,0,0]),b=Buffer.alloc(data.length+4);b.writeUInt16LE(data.length);b.writeUInt16LE(bytes.length,2);b.set(data,4);return b.toString('base64');}
  const chunks:Buffer[]=[];for(let at=0;at<bytes.length;at+=8192){const n=Math.min(8192,bytes.length-at),b=Buffer.from([5,0,n&255,n>>8,254,n&255,n>>8,bytes[at]!,128]);chunks.push(b);}return Buffer.concat(chunks).toString('base64');
}
function mapText(text=mission):string {
  const bytes=new Uint8Array(10*11+4),v=new DataView(bytes.buffer);let i=0;
  for(let row=0;row<4;row++)for(let col=row%2;col<5;col+=2){const at=i++*11;v.setUint16(at,(col+row+2)/2,true);v.setUint16(at+2,(row+6-col)/2,true);bytes[at+9]=1;}
  return text.replace('Size=0,0,3,2','Size=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN')+'\n[IsoMapPack5]\n1='+packed(bytes,true)+'\n[OverlayPack]\n1='+packed(new Uint8Array(262144).fill(255),false)+'\n[OverlayDataPack]\n1='+packed(new Uint8Array(262144),false);
}
async function fixture(options:{mission?:string;rules?:string;art?:string}={}) {
  const m=mapText(options.mission),value=input({...options,mission:m}),plan=compileObjectArt(value),terrain=compileScenarioTerrain({profile:'ra2',source:value.objects.source,bytes:encode(m)});
  const catalog=await inspectBrowserCatalog(Object.entries(assets()).map(([n,b])=>file(n,b)),{profile:'ra2',policy:'tolerant'});
  try{return {terrain,objects:value.objects,preview:await prepareObjectPreview(catalog,plan)};}finally{await catalog.dispose();}
}
function terrainScene(terrain:Awaited<ReturnType<typeof fixture>>['terrain']) {
  const bytes=new Uint8Array(1872),v=new DataView(bytes.buffer);v.setUint32(0,1,true);v.setUint32(4,1,true);v.setUint32(8,60,true);v.setUint32(12,30,true);v.setUint32(16,20,true);v.setUint32(32,952,true);v.setUint32(56,2,true);bytes.fill(1,72,972);
  const rgba=new Uint8Array(1024);for(let i=0;i<256;i++)rgba.set([1,2,3,255],i*4);
  return createTerrainScene({terrain,assets:[{id:'tile',sha256:sha(bytes),bytes}],choices:terrain.cells.map(c=>({sourceRecord:c.sourceRecord,assetId:'tile',subtile:0})),palette:rgba,projection:{tileWidth:60,tileHeight:30,elevationStep:15}});
}
const camera={cameraX:0,cameraY:-30,zoom:1 as const,width:180,height:120};
test('verified still resources join six families, retain voxel omissions and apply explicit elevated rectangular foundation anchors',async()=>{
  const f=await fixture(),result=createPlacedStill(f.terrain,f.objects,f.preview);
  assert.equal(result.artwork.rendered,4);assert.equal(result.artwork.unavailable,2);assert.equal(result.artwork.rows.filter(r=>r.status==='voxel').length,2);assert.ok(validArtworkSummary(result.artwork,6));
  const building=[...result.objects.values()].find(o=>o.family==='structure')!,position=result.batch.objects.find(o=>o.id===building.id)!;
  assert.deepEqual({x:position.x,y:position.y,anchorX:position.anchorX,anchorY:position.anchorY,depth:position.depth},{x:75,y:22,anchorX:2,anchorY:2,depth:{base:75,rowStep:0,terrainTie:'front'}});
  const infantry=[...result.objects.values()].find(o=>o.family==='infantry')!,person=result.batch.objects.find(o=>o.id===infantry.id)!;
  assert.deepEqual([person.x,person.y,person.depth.base],[90,0,30]);assert.equal(infantry.owner,'OriginalHouse');
  assert.throws(()=>createPlacedStill({...f.terrain,source:{...f.terrain.source,sha256:'f'.repeat(64)}},f.objects,f.preview),/source/);
});
test('owned atlas and palettes survive released source buffers; transparent pixels pick underlying terrain',async()=>{
  const f=await fixture(),result=createPlacedStill(f.terrain,f.objects,f.preview),scene=terrainScene(f.terrain),view={...camera,backgroundRgba:[0,0,0,255] as const};
  const before=scene.renderSprites(view,result.batch),building=[...result.objects.values()].find(o=>o.family==='structure')!;
  assert.equal((before.pick(75,51) as {id:string}).id,building.id);assert.equal(before.pick(74,51)?.kind,'terrain');
  const picked=before.pick(75,51);assert.ok(picked?.kind==='object');assert.deepEqual([picked.canvasX,picked.canvasY],[2,1]);
  for(const a of f.preview.assets)a.bytes.fill(0);for(const p of f.preview.palettes)p.rgba.fill(0);
  const after=scene.renderSprites(view,result.batch);assert.deepEqual(after.rgba,before.rgba);assert.deepEqual(after.pick(75,51),picked);assert.ok(Object.isFrozen(building));
  const selected=createPlacedViewport(scene,result).render(view).pick(75,51);assert.ok(selected?.kind==='object');assert.deepEqual(selected.object,building);assert.ok(validObjectPick(selected));
  assert.equal(after.allocations.totalPixelBytes,180*120*16);assert.equal(after.allocations.objects,4);
});
test('a placement without ground and unknown structure foundation remain omitted explicitly',async()=>{
  const f=await fixture({mission:mission.replace('PERSON,256,2,2','PERSON,256,1,1'),art:art.replace('Foundation=2x3','')});
  const result=createPlacedStill(f.terrain,f.objects,f.preview);assert.equal(result.artwork.unplaced,2);assert.equal(result.artwork.rendered,2);assert.equal(result.artwork.unavailable,4);assert.ok(validArtworkSummary(result.artwork,6));
});
test('bounded type diagnostics retain exact totals while explicitly counting omitted types and placements',async()=>{
  const names=Array.from({length:267},(_,i)=>'PERSON'+i),m=mission.slice(0,mission.indexOf('[Infantry]'))+'[Infantry]\n'+names.map((n,i)=>`${i}=OriginalHouse,${n},256,2,2,2,Guard,0,None`).join('\n');
  const r=rules.slice(0,rules.indexOf('[InfantryTypes]'))+'[InfantryTypes]\n'+names.map((n,i)=>`${i}=${n}`).join('\n')+'\n'+names.map(n=>`[${n}]\nImage=ACTOR`).join('\n');
  const f=await fixture({mission:m,rules:r,art:'[ACTOR]\n'}),result=createPlacedStill(f.terrain,f.objects,f.preview);
  assert.equal(result.artwork.rows.length,256);assert.equal(result.artwork.omittedTypes,11);assert.equal(result.artwork.omittedPlacements,11);assert.equal(result.artwork.omittedRendered,11);assert.equal(result.artwork.rendered,267);assert.ok(validArtworkSummary(result.artwork,267));
});
class Worker extends EventTarget { sent:unknown[]=[];terminated=0;postMessage(v:unknown){this.sent.push(v);}terminate(){this.terminated++;}emit(v:unknown){this.dispatchEvent(new MessageEvent('message',{data:structuredClone(v)}));} }
test('object replies require bounded exact records, joined totals, fixed buffers and v2 envelopes',async()=>{
  const f=await fixture(),result=createPlacedStill(f.terrain,f.objects,f.preview),object=[...result.objects.values()][0]!;
  const pick={kind:'object' as const,object,canvasX:1,canvasY:1,worldX:10,worldY:20,depth:30};assert.ok(validObjectPick(pick));
  assert.equal(validObjectPick({...pick,object:{...object,owner:new String('owner')}}),false);assert.equal(validObjectPick({...pick,object:{...object,payload:new Blob(['unexpected'])}}),false);
  const sparse=structuredClone(result.artwork);sparse.rows[0]!.reasons=Array(1);assert.equal(validArtworkSummary(sparse,6),false);
  assert.equal(validArtworkSummary({...result.artwork,omittedRendered:1},6),false);assert.equal(validArtworkSummary({...result.artwork,rendered:5,unavailable:1},6),false);
  const bytes=camera.width*camera.height*4,frame:FrameResult={type:'frame',frameId:1,camera,summary:{profile:'ra2',mission:'all01t.map',contentHash:'c'.repeat(64),mapHash:f.terrain.source.sha256,paletteHash:'b'.repeat(64),cells:10,objects:6,assets:1,verifiedBytes:100,sourceBytes:100,decodedBytes:100,decodedSlots:1,bounds:{x:0,y:-15,width:180,height:90},diagnostics:[],artwork:result.artwork},rgba:new ArrayBuffer(bytes),allocations:{rgbaBytes:bytes,depthBytes:bytes,ownerBytes:bytes,objectOwnerBytes:bytes,totalPixelBytes:bytes*4,samples:20,spriteSamples:10,paletteBytes:2048,objects:4}};
  assert.ok(validResult(frame));assert.equal(validResult({...frame,allocations:{...frame.allocations,objects:3}}),false);
  const worker=new Worker(),bridge=new TerrainBridge(worker),action:TerrainAction={type:'load',profile:'ra2',files:[{file:file('test.mix',new Uint8Array(1)),relativePath:''}],width:180,height:120},pending=bridge.request(action,new AbortController().signal);
  worker.emit({version:1,id:1,type:'result',result:frame});await assert.rejects(pending,/invalid/);assert.equal(worker.terminated,1);
});
test('object status and family labels have original EN and Traditional Chinese text with own-key fallback',()=>{
  for(const locale of ['en','zh-Hant'] as const){for(const key of ['artwork','sprites','shown','unavailable','infantry','unit','aircraft','structure','terrain','smudge','omittedTypes','truncatedFields'])assert.ok(terrainText(locale,key));for(const s of ['ready','missing','blocked','conflict','unsupported-mount','name-collision','voxel','unsupported-plan','constructor','__proto__'])assert.equal(typeof artworkStatusText(locale,s),'string');}
  assert.match(artworkStatusText('zh-Hant','voxel'),/立體/);assert.match(terrainText('en','scope'),/Static preview/);
});
