// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original benchmark instrumentation.
// Original scalable performance fixtures. No retail content or simulation changes.
import { createNavigationGrid, findNavigationPath } from '../../packages/sim/src/navigation.ts';
import { createWorldModel, worldHash } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { canonicalText } from '../../packages/sim/src/canonical.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { createTerrainScene } from '../../packages/render/src/terrain-scene.ts';
import { createSpriteAtlas } from '../../packages/render/src/sprite-layer.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
export const digest = bytes => bytesToHex(sha256(bytes));
export const textHash = value => digest(new TextEncoder().encode(canonicalText(value)));
const warm = 7, samples = 41;
export function measure(name, prepare, run, project, count = samples, warmup = warm) {
  let last, timings = [], expected = null, checked = 0;
  for (let n = 0; n < count + warmup; n++) {
    const input = prepare(); const start = performance.now(); const result = run(input); const elapsed = performance.now() - start;
    if (n >= warmup) {
      timings.push(elapsed);
      // Correctness is outside the timer; its allocations may still affect later GC.
      last = project(result); const identity = canonicalText(last);
      if (expected !== null && identity !== expected) throw new Error(`Non-repeatable measured result: ${name}`);
      expected = identity; checked++;
    }
  }
  const sorted = [...timings].sort((a,b)=>a-b);
  return { name, warmup, samples: count, medianMs: sorted[Math.floor(count / 2)], p95Ms: sorted[Math.ceil(count * .95) - 1],
    minMs: sorted[0], maxMs: sorted.at(-1), timingsMs: timings, identicalCheckedResults: checked, result: last };
}
function preparedWorld(profile, count) {
  const identity = { profile, manifestSha256: 'a'.repeat(64), rulesSha256: 'b'.repeat(64), orderedModHashes: [] };
  const grid = createNavigationGrid({ contentIdentity: identity, movementClass: 'foot',
    cells: Array.from({length:128 * 256}, (_,i)=>({x:i%128,y:Math.floor(i/128),cost:1,exits:255})) });
  const entities = Array.from({length:count},(_,i)=>({id:i+1,rowId:`units:${i}`,typeId:'unit:original',owner:0,kind:'unit',
    x:2+(i%8)*2,y:2+Math.floor(i/8)*2,initialHealth:100,maximumHealth:100,movementPerTick:128,navigationClass:'foot',blocksCell:true}));
  const model = createWorldModel({contentIdentity:identity,sourceSha256:'c'.repeat(64),definitionsSha256:'d'.repeat(64),
    entities,navigation:[{grid,costScale:1}],blocked:[]});
  const prepared = {model,players:[{playerId:0,houseId:'house:original',name:'Original player'}],defaultPlayerId:0,
    placements:entities.map(e=>({rowId:e.rowId,entityId:e.id,status:'ready',reasons:[]})),limitations:['original-scalable-no-campaign-authority']};
  const commands = entities.filter((e,i)=>i%8===0).slice(0,64).map((e,i)=>({schemaVersion:1,tick:0,playerId:0,sequence:i,kind:'move',payload:{entityId:e.id,x:126,y:e.y}}));
  const idle = WorldSimulation.create(model).save(), moving = WorldSimulation.create(model);
  moving.admitCommands(commands); moving.step(8);
  return {model,grid,prepared,commands,idle,moving:moving.save()};
}
export function runWorld(profile,count,progress) {
  const f=preparedWorld(profile,count), facts=[];
  const add = result => { facts.push(result); progress(result.name); };
  for(const [label,save] of [['idle',f.idle],['moving',f.moving]]) {
    add(measure(`${profile}/${count}/step-${label}`,()=>WorldSimulation.restore(f.model,save),sim=>({step:sim.step(),sim}),r=>({work:r.step.work,events:r.step.events.length,eventsHash:textHash(r.step.events),hash:worldHash(r.sim.save())})));
  }
  add(measure(`${profile}/${count}/first-route-tick`,()=>{const sim=WorldSimulation.restore(f.model,f.idle);sim.admitCommands(f.commands);return sim;},sim=>({step:sim.step(),sim}),r=>({work:r.step.work,events:r.step.events.length,eventsHash:textHash(r.step.events),hash:worldHash(r.sim.save())})));
  add(measure(`${profile}/${count}/admit`,()=>WorldSimulation.restore(f.model,f.idle),sim=>{sim.admitCommands(f.commands);return sim;},sim=>({hash:worldHash(sim.save()),commands:f.commands.length})));
  const current=WorldSimulation.restore(f.model,f.moving), save=current.save();
  add(measure(`${profile}/${count}/save-clone`,()=>current,sim=>sim.save(),r=>({hash:worldHash(r)})));
  add(measure(`${profile}/${count}/canonical-text`,()=>save,s=>canonicalText(s),r=>({bytes:new TextEncoder().encode(r).length,hash:digest(new TextEncoder().encode(r))})));
  add(measure(`${profile}/${count}/canonical-hash`,()=>save,s=>worldHash(s),r=>({hash:r})));
  add(measure(`${profile}/${count}/restore`,()=>save,s=>WorldSimulation.restore(f.model,s),r=>({hash:worldHash(r.save())})));
  const session=new WorldSession(f.prepared);session.act({type:'world-restore',text:canonicalText(save)});
  add(measure(`${profile}/${count}/ui-snapshot`,()=>session,s=>s.snapshot(),r=>({hash:textHash(r),stateHash:r.stateHash,actors:r.actors.length})));
  add(measure(`${profile}/${count}/ui-step-snapshot`,()=>{const s=new WorldSession(f.prepared);s.act({type:'world-restore',text:canonicalText(save)});return s;},s=>{s.act({type:'world-step',ticks:1});return s.snapshot();},r=>({hash:textHash(r),stateHash:r.stateHash})));
  const occupied=f.model.entities.map(e=>({x:e.x,y:e.y}));
  add(measure(`${profile}/${count}/path-query`,()=>({start:{x:0,y:0},goal:{x:127,y:255},occupied}),q=>findNavigationPath(f.grid,q),r=>({status:r.status,expanded:r.expanded,pathLength:r.path.length,hash:textHash(r)})));
  return {profile,actors:count,orderedActors:f.commands.length,gridCells:32768,modelHash:f.model.sha256,
    movingActors:save.state.entities.filter(e=>e.goal!==null).length,routeCells:save.state.entities.reduce((n,e)=>n+e.route.length,0),
    pending:worldHash(save),facts};
}
function packed(raw,lzo) {
  const chunks=[];
  for(let at=0;at<raw.length;at+=8192){const block=raw.subarray(at,at+8192),data=[];
    if(lzo){if(block.length<=238)data.push(block.length+17);else{data.push(0);let n=block.length-18;while(n>255){data.push(0);n-=255;}data.push(n);}data.push(...block,17,0,0);}
    else {for(let i=0;i<block.length;){let end=i+1;while(end<block.length&&block[end]===block[i])end++;const n=end-i;data.push(254,n&255,n>>8,block[i]);i=end;}data.push(128);}
    const bytes=new Uint8Array(data.length+4),v=new DataView(bytes.buffer);v.setUint16(0,data.length,true);v.setUint16(2,block.length,true);bytes.set(data,4);chunks.push(bytes);
  }
  const bytes=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  let binary='';for(let at=0;at<bytes.length;at+=4096)binary+=String.fromCharCode(...bytes.subarray(at,at+4096));
  const base64=btoa(binary);return Array.from({length:Math.ceil(base64.length/64)},(_,i)=>`${i+1}=${base64.slice(i*64,i*64+64)}`).join('\n')+'\n';
}
export function renderFixture(size) {
  const iso=new Uint8Array((2*size-1)*size*11+4),v=new DataView(iso.buffer);let n=0;
  for(let row=0;row<size*2;row++)for(let col=row%2;col<size*2-1;col+=2){const at=n*11;v.setUint16(at,(col+row+2)/2,true);v.setUint16(at+2,(row-col+size*2)/2,true);v.setUint16(at+4,0,true);n++;}
  const raw=new TextEncoder().encode(`[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,${size},${size}\nLocalSize=0,0,${size},${size}\nTheater=URBAN\n[IsoMapPack5]\n${packed(iso,true)}[OverlayPack]\n${packed(new Uint8Array(262144).fill(255),false)}[OverlayDataPack]\n${packed(new Uint8Array(262144),false)}`);
  const terrain=compileScenarioTerrain({profile:'ra2',source:{id:'original-perf',profile:'ra2',sha256:digest(raw)},bytes:raw});
  const tmp=new Uint8Array(1872),tv=new DataView(tmp.buffer);
  tv.setUint32(0,1,true);tv.setUint32(4,1,true);tv.setUint32(8,60,true);tv.setUint32(12,30,true);tv.setUint32(16,20,true);tv.setUint32(32,952,true);tv.setUint32(56,2,true);tmp.fill(1,72,972);
  const palette=new Uint8Array(1024);for(let i=0;i<256;i++)palette.set([i,255-i,i*73%256,255],i*4);
  const scene=createTerrainScene({terrain,assets:[{id:'tile',bytes:tmp,sha256:digest(tmp)}],choices:terrain.cells.map(c=>({sourceRecord:c.sourceRecord,assetId:'tile',subtile:0})),palette,projection:{tileWidth:60,tileHeight:30,elevationStep:15}});
  const shp=new Uint8Array(32+12*18),sv=new DataView(shp.buffer);sv.setUint16(2,12,true);sv.setUint16(4,18,true);sv.setUint16(6,1,true);sv.setUint16(12,12,true);sv.setUint16(14,18,true);sv.setUint32(28,32,true);shp.fill(3,32);
  const atlas=createSpriteAtlas({assets:[{id:'original-sprite',sha256:digest(shp),bytes:shp}],frames:[{id:'frame',assetId:'original-sprite',frame:0}]});
  const batch={atlas,palettes:[{id:'palette',rgba:palette,remap:null,transparentIndex:0}],objects:Array.from({length:256},(_,i)=>({id:`original-${i}`,frameId:'frame',paletteId:'palette',x:size*30-320+(i%16)*40,y:size*15-200+Math.floor(i/16)*25,anchorX:6,anchorY:18,depth:{base:size*15-200+Math.floor(i/16)*25,rowStep:1,terrainTie:'front'}}))};
  return {scene,batch,mapHash:digest(raw),cells:terrain.cells.length};
}
export function runRender(size,progress) {
  const f=renderFixture(size),facts=[];
  for(const [width,height] of [[640,480],[960,640],[1280,720]])for(const sprites of [false,true]) {
    const view={cameraX:size*30-width/2,cameraY:size*15-height/2,zoom:1,width,height,backgroundRgba:[17,21,23,255]};
    const result=measure(`render/${size}/${width}x${height}/${sprites?'sprites':'terrain'}`,()=>view,v=>sprites?f.scene.renderSprites(v,f.batch):f.scene.render(v),frame=>({rgbaHash:digest(frame.rgba),allocations:frame.allocations,pick:frame.pick(width/2,height/2)}),31,5);
    facts.push(result);progress(result.name);
  }
  return {size,cells:f.cells,objects:256,mapHash:f.mapHash,facts};
}
