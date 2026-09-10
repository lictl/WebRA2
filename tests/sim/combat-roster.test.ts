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
import { compileWorldContent } from '../../packages/sim/src/world-content.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
import { compileWeaponDefinitions } from '../../packages/content/src/weapon-definitions.ts';
import { compileCombatWeapons } from '../../packages/sim/src/combat-weapons.ts';
import { compileCombatRoster, isCombatRoster, COMBAT_ROSTER_LIMITS } from '../../packages/sim/src/combat-roster.ts';
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

function fixture({profile='ra2' as 'ra2'|'yr',extraRules='',player='Commander',foundation='1x1',rank='0',allies='',walkerFields='',shotFields=''}={}) {
  const xy=[[1,3],[2,2],[3,1],[2,3],[3,2],[2,4],[3,3],[4,2],[3,4],[4,3]];
  const raw=new Uint8Array(114),v=new DataView(raw.buffer);
  xy.forEach(([x,y],i)=>{v.setUint16(i*11,x!,true);v.setUint16(i*11+2,y!,true);v.setUint16(i*11+4,1,true);});
  const mapBytes=encode(`[Basic]\nNewINIFormat=4\nPlayer=${player}\n[Map]\nSize=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN\n[Houses]\n0=Commander\n1=Rival\n[Commander]\nCountry=Blue\n${allies}\n[Rival]\nCountry=Blue\n[Infantry]\n0=Commander,Walker,256,2,2,0,Guard,0,None,${rank},-1,0,1,1\n[Units]\n0=Rival,Driver,128,4,3,0,Guard,None,0,-1,0,-1,1,1\n[Aircraft]\n0=Commander,Plane,256,1,3,0,Guard,None\n[Structures]\n0=Commander,Depot,256,4,2,0,None\n[Terrain]\n4002=Tree\n[Smudge]\n0=Mark,3,1,0\n[IsoMapPack5]\n1=${packed(raw,true)}\n[OverlayPack]\n1=${packed(new Uint8Array(262144).fill(255),false)}\n[OverlayDataPack]\n1=${packed(new Uint8Array(262144),false)}\n`);
  const base=encode(`[Countries]\n0=Blue\n[Clear]\nFoot=1\nTrack=1\nWheel=1\n[Warheads]\n0=DenseHit\n[Rifle]\nDamage=17\nROF=9\nRange=4\nSpeed=100\nProjectile=Ray\nWarhead=DenseHit\n${shotFields}\n[Ray]\nInviso=yes\n[DenseHit]\nVerses=100%,100%,100%,100%,100%,100%,100%,100%,100%,100%,100%\n[InfantryTypes]\n0=Walker\n[VehicleTypes]\n0=Driver\n[AircraftTypes]\n0=Plane\n[BuildingTypes]\n0=Depot\n[TerrainTypes]\n0=Tree\n[SmudgeTypes]\n0=Mark\n[Walker]\nPrimary=Rifle\n${walkerFields}\nStrength=100\nSpeed=50\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}\n[Driver]\nStrength=200\nSpeed=30\nLocomotor={4A582741-9839-11D1-B709-00A024DDAFD1}\n[Plane]\nStrength=100\nSpeed=30\n[Depot]\nStrength=1000\n[Tree]\nName=Original tree\n`+extraRules), artBytes=encode(`[Depot]\nFoundation=${foundation}\n`);
  const source={id:'map',profile,sha256:hash(mapBytes)};
  const rules=compileRuntimeIni(profile,[{id:'base',profile,order:0,kind:'base',sourceSha256:hash(base),bytes:base},{id:'map',profile,order:1,kind:'map',sourceSha256:source.sha256,bytes:mapBytes}]);
  const art=compileRuntimeIni(profile,[{id:'art',profile,order:0,kind:'base',sourceSha256:hash(artBytes),bytes:artBytes}]);
  const objects=compileScenarioObjects({profile,source,bytes:mapBytes});
  const definitions=compileEntityDefinitions({objects,rules,art}), terrain=compileScenarioTerrain({profile,source,bytes:mapBytes});
  const data=new Uint8Array(1872),dv=new DataView(data.buffer);for(const [at,n] of [[0,1],[4,1],[8,60],[12,30],[16,20],[32,952],[56,2]])dv.setUint32(at!,n!,true);
  const digest=hash(data), contentIdentity={profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
  const traversal=compileTerrainTraversal({contentIdentity,terrain,mapBytes,rules:createIniSourceView(rules),assets:[{id:'tiles',path:'original.urb',sha256:digest,bytes:data,source:{root:{sourceId:'root',size:data.length,sha256:digest},absoluteOffset:0,size:data.length,sha256:digest}}],choices:terrain.cells.map(c=>({sourceRecord:c.sourceRecord,assetId:'tiles',subtile:0})),movementClasses:[{id:'foot',speedType:0},{id:'wheel',speedType:2},{id:'winged',speedType:4}]});
  const world=compileWorldContent({mapBytes,rules,definitions,traversal,footprints:compileFoundationOccupancy({definitions})});
  const actors=compileCombatActors({definitions,rules,mission:{source,bytes:mapBytes}}),weapons=compileWeaponDefinitions({definitions,rules});
  return {world,definitions,actors,weapons,capabilities:compileCombatWeapons({weapons})};
}
test('both profiles bind world IDs, source initialization and ordered weapon slots without claiming executable combat',()=>{
 for(const profile of ['ra2','yr'] as const){
  const input=fixture({profile}),result=compileCombatRoster(input);
  assert.equal(isCombatRoster(result),true);assert.equal(isCombatRoster({...result}),false);
  assert.equal(result.worldModelSha256,input.world.model.sha256);assert.equal(result.coverage.placements,6);
  assert.equal(result.coverage.initialStateReady,2);assert.equal(result.canExecuteCombat,false);
  const walker=result.actors[0]!,driver=result.actors[1]!;
  assert.equal(walker.entityId,input.world.placements[0]!.entityId);assert.equal(walker.status,'initial-state-ready');
  assert.equal(walker.armor,0);assert.equal(walker.initialAmmo,-1);assert.equal(walker.immune,false);
  assert.deepEqual(walker.slots.map(s=>s.status),['candidate','empty']);
  assert.deepEqual(driver.slots.map(s=>s.status),['empty','empty']);
  assert.equal(result.alliances.status,'ready');assert.deepEqual(result.alliances.pairs,[]);
  assert(Object.isFrozen(result.actors));assert(Object.isFrozen(walker.slots));assert(Object.isFrozen(walker.placement));
 }
});
test('source rank, immunity, ammo and conditional selectors preserve distinct exclusion reasons',()=>{
 for(const profile of ['ra2','yr'] as const){
  assert(compileCombatRoster(fixture({profile,rank:'100'})).actors[0]!.reasons.includes('initial-veterancy'));
  for(const [fields,reason] of [['Immune=yes','immune-or-unknown'],['TypeImmune=yes','type-immune-or-unknown'],['InitialAmmo=-2','unsupported-initial-ammo'],['Gunner=yes','conditional-or-unknown-slots']] as const)
   assert(compileCombatRoster(fixture({profile,walkerFields:fields})).actors[0]!.reasons.includes(reason));
  const r=compileCombatRoster(fixture({profile,walkerFields:'InitialAmmo=8\nAmmo=3\nClearAllWeapons=yes'}));
  assert.equal(r.actors[0]!.initialAmmo,8);assert.deepEqual(r.actors[0]!.slots.map(s=>s.status),['empty','empty']);
 }
});
test('unsupported first weapon stays in its slot and cannot be discarded into a ready secondary',()=>{
 const r=compileCombatRoster(fixture({shotFields:'Suicide=yes'}));
 assert.equal(r.actors[0]!.slots[0]!.status,'unsupported');assert.notEqual(r.actors[0]!.slots[0]!.weaponId,null);
 assert.equal(r.actors[0]!.slots[1]!.status,'empty');assert.equal(r.coverage.weaponCandidates,0);
});
test('alliance completeness and directed owner joins are source bound and affect roster identity',()=>{
 const a=compileCombatRoster(fixture({allies:'Allies=Rival'}));
 assert.deepEqual(a.alliances,{status:'ready',pairs:[{owner:0,ally:1}]});
 const b=compileCombatRoster(fixture({allies:'Allies=Missing'}));
 assert.deepEqual(b.alliances,{status:'unsupported',pairs:[]});assert.notEqual(a.fingerprint,b.fingerprint);
});
test('genuine factories from mismatched sources cannot be combined or forged',()=>{
 const a=fixture(),b=fixture({extraRules:'[Unrelated]\nValue=1\n'}),c=fixture({profile:'yr'});
 for(const key of ['world','definitions','actors','weapons','capabilities'] as const){
  assert.throws(()=>compileCombatRoster({...a,[key]:{...a[key]}}),/factory/);
  assert.throws(()=>compileCombatRoster({...a,[key]:b[key]}),/identity/);
  assert.throws(()=>compileCombatRoster({...a,[key]:c[key]}),/identity/);
 }
 let called=false;const hostile=Object.defineProperty({...a},'actors',{enumerable:true,get(){called=true;return a.actors;}});
 assert.throws(()=>compileCombatRoster(hostile));assert.equal(called,false);
});
test('lowered resource bounds reject whole publication and cannot be raised',()=>{
 const a=fixture({allies:'Allies=Rival'});
 for(const key of Object.keys(COMBAT_ROSTER_LIMITS) as (keyof typeof COMBAT_ROSTER_LIMITS)[]){
  assert.throws(()=>compileCombatRoster(a,{[key]:0}));
  assert.throws(()=>compileCombatRoster(a,{[key]:COMBAT_ROSTER_LIMITS[key]+1}));
 }
 assert.equal(compileCombatRoster(a).coverage.placements,6);
});
