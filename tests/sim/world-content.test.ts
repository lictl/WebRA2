// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature INI/map/TMP fixtures; packed helper reused from the original traversal tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { createIniSourceView } from '../../packages/content/src/ini-source-view.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { compileFoundationOccupancy } from '../../packages/content/src/foundation-occupancy.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileTerrainTraversal } from '../../packages/content/src/terrain-traversal.ts';
import { compileWorldContent, isWorldContent, WORLD_CONTENT_LIMITS } from '../../packages/sim/src/world-content.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { WorldReplayRecorder, replayWorld } from '../../packages/sim/src/world-replay.ts';
const encode = (s: string) => new TextEncoder().encode(s), hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function packed(raw: Uint8Array, lzo: boolean): string {
  const blocks: Buffer[] = [];
  for (let at = 0; at < raw.length; at += 8192) {
    const piece = raw.subarray(at, at + 8192), stream: number[] = [];
    if (lzo) { stream.push(17 + piece.length, ...piece, 17, 0, 0); }
    else { for (let i = 0; i < piece.length;) { let end = i + 1; while (end < piece.length && piece[end] === piece[i]) end++;
      stream.push(254, (end - i) & 255, (end - i) >>> 8, piece[i]!); i = end; } stream.push(128); }
    const head = Buffer.alloc(4); head.writeUInt16LE(stream.length); head.writeUInt16LE(piece.length, 2); blocks.push(head, Buffer.from(stream));
  }
  return Buffer.concat(blocks).toString('base64');
}

function fixture({profile='ra2' as 'ra2'|'yr',extraRules='',player='Commander',foundation='1x1'}={}) {
  const xy=[[1,3],[2,2],[3,1],[2,3],[3,2],[2,4],[3,3],[4,2],[3,4],[4,3]];
  const raw=new Uint8Array(114),v=new DataView(raw.buffer);
  xy.forEach(([x,y],i)=>{v.setUint16(i*11,x!,true);v.setUint16(i*11+2,y!,true);v.setUint16(i*11+4,1,true);});
  const mapBytes=encode(`[Basic]\nNewINIFormat=4\nPlayer=${player}\n[Map]\nSize=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN\n[Houses]\n0=Commander\n1=Rival\n[Commander]\nCountry=Blue\n[Rival]\nCountry=Blue\n[Infantry]\n0=Commander,Walker,256,2,2,0,Guard,0,None\n[Units]\n0=Rival,Driver,128,4,3,0,Guard,None\n[Aircraft]\n0=Commander,Plane,256,1,3,0,Guard,None\n[Structures]\n0=Commander,Depot,256,4,2,0,None\n[Terrain]\n4002=Tree\n[Smudge]\n0=Mark,3,1,0\n[IsoMapPack5]\n1=${packed(raw,true)}\n[OverlayPack]\n1=${packed(new Uint8Array(262144).fill(255),false)}\n[OverlayDataPack]\n1=${packed(new Uint8Array(262144),false)}\n`);
  const base=encode(`[Countries]\n0=Blue\n[Clear]\nFoot=1\nTrack=1\nWheel=1\n[InfantryTypes]\n0=Walker\n[VehicleTypes]\n0=Driver\n[AircraftTypes]\n0=Plane\n[BuildingTypes]\n0=Depot\n[TerrainTypes]\n0=Tree\n[SmudgeTypes]\n0=Mark\n[Walker]\nStrength=100\nSpeed=50\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}\n[Driver]\nStrength=200\nSpeed=30\nLocomotor={4A582741-9839-11D1-B709-00A024DDAFD1}\n[Plane]\nStrength=100\nSpeed=30\n[Depot]\nStrength=1000\n[Tree]\nName=Original tree\n`+extraRules), artBytes=encode(`[Depot]\nFoundation=${foundation}\n`);
  const source={id:'map',profile,sha256:hash(mapBytes)};
  const rules=compileRuntimeIni(profile,[{id:'base',profile,order:0,kind:'base',sourceSha256:hash(base),bytes:base},{id:'map',profile,order:1,kind:'map',sourceSha256:source.sha256,bytes:mapBytes}]);
  const art=compileRuntimeIni(profile,[{id:'art',profile,order:0,kind:'base',sourceSha256:hash(artBytes),bytes:artBytes}]);
  const objects=compileScenarioObjects({profile,source,bytes:mapBytes});
  const definitions=compileEntityDefinitions({objects,rules,art}), terrain=compileScenarioTerrain({profile,source,bytes:mapBytes});
  const data=new Uint8Array(1872),dv=new DataView(data.buffer);for(const [at,n] of [[0,1],[4,1],[8,60],[12,30],[16,20],[32,952],[56,2]])dv.setUint32(at!,n!,true);
  const digest=hash(data), contentIdentity={profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
  const traversal=compileTerrainTraversal({contentIdentity,terrain,mapBytes,rules:createIniSourceView(rules),assets:[{id:'tiles',path:'original.urb',sha256:digest,bytes:data,source:{root:{sourceId:'root',size:data.length,sha256:digest},absoluteOffset:0,size:data.length,sha256:digest}}],choices:terrain.cells.map(c=>({sourceRecord:c.sourceRecord,assetId:'tiles',subtile:0})),movementClasses:[{id:'foot',speedType:0},{id:'wheel',speedType:2},{id:'winged',speedType:4}]});
  return {mapBytes,rules,definitions,traversal,footprints:compileFoundationOccupancy({definitions})};
}
test('both profiles account for every placement with stable rows, typed health, owners and explicit movement coverage',()=>{
 for(const profile of ['ra2','yr'] as const){const r=compileWorldContent(fixture({profile}));
  assert.equal(isWorldContent(r),true);assert.equal(isWorldContent({...r}),false);
  assert.equal(r.model.entities.length,6);assert.deepEqual(r.placements.map(p=>p.entityId),[1,2,3,4,5,6]);
  assert.deepEqual(r.coverage,{placements:6,mobile:2,stationary:1,passive:2,unavailable:1,sharedAnchors:0,footprintCells:2});
  assert.equal(r.defaultPlayerId,0);assert.equal(r.players[1]!.name,'Rival');
  assert.equal(r.model.entities.find(e=>e.rowId==='units:0')!.initialHealth,100);
  assert.equal(r.model.entities.find(e=>e.rowId==='units:0')!.owner,1);
  assert.ok(r.placements.find(p=>p.rowId==='aircraft:0')!.reasons.includes('unsupported-navigation-class'));
  assert.equal(r.canStartCampaign,false);assert.ok(Object.isFrozen(r.placements[0]!.reasons));
 }
});
test('real compiler/model joins execute orders and preserve moving saves and admission replay',()=>{
 const r=compileWorldContent(fixture()), id=r.placements.find(p=>p.rowId==='infantry:0')!.entityId;
 const recorder=new WorldReplayRecorder(r.model);recorder.admitCommands([{schemaVersion:1,tick:0,playerId:0,sequence:0,kind:'move',payload:{entityId:id,x:3,y:3}}]);recorder.step();
 const a=WorldSimulation.restore(r.model,recorder.save()),b=WorldSimulation.restore(r.model,recorder.save());
 assert.deepEqual(a.step(8),b.step(8));assert.equal(a.save().state.entities.find(e=>e.id===id)!.goal,null);
 assert.deepEqual(replayWorld(r.model,recorder.document()).simulation.save(),recorder.save());
 assert.equal(a.save().state.entities.find(e=>e.id===id)!.x,3);
});
test('factory/source/map joins reject forged results or changed selected bytes',()=>{
 const f=fixture();assert.throws(()=>compileWorldContent({...f,definitions:{...f.definitions}}),/factory/);
 assert.throws(()=>compileWorldContent({...f,traversal:{...f.traversal}}),/factory/);
 const changed=f.mapBytes.slice();changed[0]=changed[0]!^1;assert.throws(()=>compileWorldContent({...f,mapBytes:changed}),/map-hash/);
 assert.throws(()=>compileWorldContent({...f,traversal:fixture({profile:'yr'}).traversal}),/profile-source/);
 assert.throws(()=>compileWorldContent({...f,rules:fixture({extraRules:'[Unused]\nValue=1\n'}).rules}),/rule-sources/);
 let called=false;const bad=Object.defineProperty({...f},'mapBytes',{enumerable:true,get(){called=true;throw Error('getter');}});
 assert.throws(()=>compileWorldContent(bad));assert.equal(called,false);
});
test('unknown player selection stays explicit and immutable metadata affects world identity',()=>{
 const a=compileWorldContent(fixture()),b=compileWorldContent(fixture({player:'commander'}));
 assert.equal(b.defaultPlayerId,null);assert.notEqual(a.sha256,b.sha256);assert.notEqual(a.model.sha256,b.model.sha256);
 const c=compileWorldContent(fixture({extraRules:'[Unused]\nValue=1\n'}));assert.notEqual(a.sha256,c.sha256);
 assert.deepEqual(a.model.entities,c.model.entities);
});
test('lower bounds reject before publishing a partial world and cannot be raised',()=>{
 const f=fixture();for(const key of ['mapBytes','entities','players','grids','blocked'] as const){assert.throws(()=>compileWorldContent(f,{[key]:0}));assert.throws(()=>compileWorldContent(f,{[key]:WORLD_CONTENT_LIMITS[key]+1}));}
 assert.equal(compileWorldContent(f).coverage.placements,6);
});

test('required base footprints must be genuine, source-bound and supported, with native shape cells bound to owners',()=>{
 const f=fixture();assert.throws(()=>compileWorldContent({...f,footprints:{...f.footprints}}),/factory/);
 assert.throws(()=>compileWorldContent({...f,footprints:fixture({extraRules:'[Unused]\nX=1\n'}).footprints}),/footprint-source/);
 assert.throws(()=>compileWorldContent(fixture({foundation:'Custom'})),/unsupported-required-footprint/);
 const r=compileWorldContent(fixture({foundation:'3x3Refinery'}));
 const id=r.placements.find(p=>p.rowId==='structures:0')!.entityId;
 const extra=r.model.footprints.find(p=>p.entityId===id)!;assert.equal(extra.cells.length,7);
 assert(!extra.cells.includes((4+2)+512*(2+1)));assert.equal(r.coverage.footprintCells,9);
 const empty=compileWorldContent(fixture({foundation:'0x0'}));
 assert.equal(empty.model.entities.find(e=>e.rowId==='structures:0')!.blocksCell,false);
 assert.equal(empty.model.footprints.length,0);
});
