// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic source corpus. No retail rows or coordinates.
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
const encode = (s: string) => new TextEncoder().encode(s);
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function packed(raw: Uint8Array, literal: boolean): string {
  const blocks: Buffer[] = [];
  for (let at = 0; at < raw.length; at += 8192) {
    const piece = raw.subarray(at, at + 8192), stream: number[] = [];
    if (literal) stream.push(17 + piece.length, ...piece, 17, 0, 0);
    else { for (let i = 0; i < piece.length;) { let end = i + 1; while (end < piece.length && piece[end] === piece[i]) end++;
      stream.push(254, (end - i) & 255, (end - i) >>> 8, piece[i]!); i = end; } stream.push(128); }
    const head = Buffer.alloc(4); head.writeUInt16LE(stream.length); head.writeUInt16LE(piece.length, 2); blocks.push(head, Buffer.from(stream));
  }
  return Buffer.concat(blocks).toString('base64');
}
function missionBindingsFixture({profile='ra2' as 'ra2'|'yr', mapEncoding='utf8' as 'utf8'|'latin1'|'utf16le', mapBom=false, extraRules='', extraInfantryTypes='', extraArt='', waypoint='0=3003', extraMap='[Actions]\nSpawn=1,80,1,Squad,0,0,0,0,A', rivalCountry='Red', speed=128, infantryRows='0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1\n1=Commander,Walker,256,2,3,0,Guard,0,None,0,-1,0,1,1\n2=Rival,Walker,256,4,2,0,Guard,0,None,0,-1,0,1,1'}={}) {
  const xy = [[1,3],[2,2],[3,1],[2,3],[3,2],[2,4],[3,3],[4,2],[3,4],[4,3]];
  const raw = new Uint8Array(114), view = new DataView(raw.buffer);
  xy.forEach(([x,y], i) => { view.setUint16(i*11,x!,true);view.setUint16(i*11+2,y!,true);view.setUint16(i*11+4,1,true); });
  let bytes = new Uint8Array(Buffer.from(`[Basic]\nNewINIFormat=4\nPlayer=Commander\n[Map]\nSize=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN\n[Houses]\n0=Commander\n1=Rival\n[Commander]\nCountry=Blue\n[Rival]\nCountry=${rivalCountry}\n[Infantry]\n${infantryRows}\n[Waypoints]\n${waypoint}\n[IsoMapPack5]\n1=${packed(raw,true)}\n[OverlayPack]\n1=${packed(new Uint8Array(262144).fill(255),false)}\n[OverlayDataPack]\n1=${packed(new Uint8Array(262144),false)}\n${extraMap}`, mapEncoding));
  if(mapBom) bytes=new Uint8Array(Buffer.concat([mapEncoding==='utf16le'?Buffer.from([255,254]):Buffer.from([239,187,191]),bytes]));
  const base = encode(`[Countries]\n0=Blue\n1=Red\n[Clear]\nFoot=1\n[InfantryTypes]\n0=Walker\n${extraInfantryTypes}\n[Walker]\nStrength=100\nSpeed=${speed}\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}\n${extraRules}`);
  const artBytes = encode('[Original]\nValue=1\n'+extraArt), source = {id:'map',profile,sha256:hash(bytes)};
  const rules = compileRuntimeIni(profile,[{id:'base',profile,order:0,kind:'base',sourceSha256:hash(base),bytes:base},
    {id:'map',profile,order:1,kind:'map',sourceSha256:source.sha256,bytes}]);
  const art = compileRuntimeIni(profile,[{id:'art',profile,order:0,kind:'base',sourceSha256:hash(artBytes),bytes:artBytes}]);
  const objects = compileScenarioObjects({profile,source,bytes}), terrain = compileScenarioTerrain({profile,source,bytes});
  const definitions = compileEntityDefinitions({objects,rules,art});
  const tile = new Uint8Array(1872), tileView = new DataView(tile.buffer);
  for (const [at,n] of [[0,1],[4,1],[8,60],[12,30],[16,20],[32,952],[56,2]]) tileView.setUint32(at!,n!,true);
  const digest = hash(tile), contentIdentity = {profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
  const traversal = compileTerrainTraversal({contentIdentity,terrain,mapBytes:bytes,rules:createIniSourceView(rules),
    assets:[{id:'tiles',path:'original.urb',sha256:digest,bytes:tile,source:{root:{sourceId:'root',size:tile.length,sha256:digest},absoluteOffset:0,size:tile.length,sha256:digest}}],
    choices:terrain.cells.map(c=>({sourceRecord:c.sourceRecord,assetId:'tiles',subtile:0})),movementClasses:[{id:'foot',speedType:0}]});
  const world = compileWorldContent({mapBytes:bytes,rules,definitions,traversal,footprints:compileFoundationOccupancy({definitions})});
  return {world,definitions,rules,mission:{source,bytes},difficulty:1 as const};
}

import {compileMissionBindings} from '../../packages/sim/src/mission-bindings.ts';
import {compileMissionObjectEventSource,isMissionObjectEventSource,missionObjectEventSourceBindings} from '../../packages/sim/src/mission-object-event-source.ts';
function fixture({profile='ra2' as 'ra2'|'yr',events='Start=4,6,0,0,7,0,0,44,0,1,48,0,0',extraMap='',extraRules='',rivalCountry='Red',speed=128,
  infantryRows='0=Commander,Walker,256,2,2,0,Guard,0,Shared,0,-1,0,1,1\n1=Commander,Walker,256,2,3,0,Guard,0,Shared,0,-1,0,1,1\n2=Rival,Walker,256,4,2,0,Guard,0,None,0,-1,0,1,1',persistence=2}={}){
  return compileMissionBindings(missionBindingsFixture({profile,speed,extraRules,rivalCountry,infantryRows,extraMap:`[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=${persistence},Sharing,Start\n[Events]\n${events}\n[Actions]\nStart=1,28,0,1,0,0,0,0,A\n${extraMap}`}));
}

test('both profiles retain shared object tag, exact opcodes, ignored Numbers and literal attacker house selector',()=>{
  for(const profile of ['ra2','yr'] as const){const bindings=fixture({profile,rivalCountry:'Blue'}),s=compileMissionObjectEventSource({bindings});
    assert.deepEqual(s.diagnostics,[]);assert.deepEqual(s.events.map(e=>e.opcode),[6,7,44,48]);
    assert.deepEqual(s.events.map(e=>e.latch),['transient','repeat-mode-only','transient','repeat-mode-only']);
    assert.deepEqual(s.events[2]!.selector,{kind:'literal-house',houseId:'houses:1',playerId:1});
    assert.deepEqual(s.actors.map(a=>a.bindingId),['binding:tag:shared','binding:tag:shared',null]);
    assert.ok(s.actors.every(a=>a.status==='supported'));assert.equal(s.coverage.sharedObjectBindings,1);
    assert.deepEqual(s.actors[0]!.nonfatalSequence,[{opcode:6,requiresSource:true},{opcode:44,requiresSource:true}]);
    assert.deepEqual(s.actors[0]!.fatalSequence,[{opcode:6,requiresSource:true},{opcode:7,requiresSource:true},{opcode:48,requiresSource:false}]);
    assert.equal(s.objectReferences,bindings.objects);assert.equal(s.bindingGroups,bindings.tags);assert.equal(missionObjectEventSourceBindings(s),bindings);
    assert.equal(compileMissionObjectEventSource({bindings}).sha256,s.sha256);assert.ok(Object.isFrozen(s.actors[0]!.fatalSequence[0]));
    const ignored=compileMissionObjectEventSource({bindings:fixture({profile,events:'Start=3,6,0,-2147483648,7,0,2147483647,48,0,-99'})});
    assert.ok(ignored.events.every(e=>e.status==='supported'&&e.selector.kind==='any'));
    assert.deepEqual(ignored.events.map(e=>e.parameters),[['0','-2147483648'],['0','2147483647'],['0','-99']]);
  }
});

test('unit fatal sequence precedes base attacked callback while stationary structures retain base sequence',()=>{
  for(const profile of ['ra2','yr'] as const){
    const bindings=compileMissionBindings(missionBindingsFixture({profile,extraRules:'[VehicleTypes]\n0=Carrier\n[Carrier]\nStrength=100\nSpeed=0\n[BuildingTypes]\n0=Shelter\n[Shelter]\nStrength=100',extraArt:'[Shelter]\nFoundation=1x1',extraMap:
      '[Units]\n0=Commander,Carrier,256,3,3,0,Guard,Shared,0,-1,0,-1,1,1\n[Structures]\n0=Commander,Shelter,256,3,2,0,Shared,0,0,1,0,0,None,None,None,0,0\n[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=2,Sharing,Start\n[Events]\nStart=1,48,0,0\n[Actions]\nStart=1,28,0,1,0,0,0,0,A'}));
    const s=compileMissionObjectEventSource({bindings});assert.deepEqual(s.diagnostics,[]);
    const unit=s.actors.find(a=>a.kind==='unit')!,structure=s.actors.find(a=>a.kind==='structure')!;
    assert.equal(unit.status,'supported');assert.equal(structure.status,'supported');
    assert.deepEqual(unit.fatalSequence.map(c=>c.opcode),[7,48,6]);assert.deepEqual(structure.fatalSequence.map(c=>c.opcode),[6,7,48]);
    assert.equal(unit.sourceMission,'Guard');assert.equal(structure.sourceMission,null);
  }
});

test('unknown event closure, object references and source case remain visible rather than fabricated authority',()=>{
  const s=compileMissionObjectEventSource({bindings:fixture({events:'Start=2,6,0,0,999,0,0'})});
  assert.equal(s.events.length,1);assert.equal(s.canStartCampaign,false);assert.equal(s.nativeBehaviorVerified,false);
  const broken=compileMissionObjectEventSource({bindings:fixture({infantryRows:'0=Commander,Walker,256,2,2,0,Guard,0,Absent,0,-1,0,1,1'})});
  assert.equal(broken.actors.length,1);assert.equal(broken.actors[0]!.status,'unsupported');assert.equal(broken.actors[0]!.bindingId,null);
  assert.ok(broken.diagnostics.some(d=>d.code==='unsupported-object-reference'));
  const wrong=compileMissionObjectEventSource({bindings:fixture({extraMap:'[tags]\nOther=2,Other,Start'})});assert.ok(wrong.diagnostics.length);
});

test('event operand framing and nonexistent literal houses cannot confer execution proof',()=>{
  for(const profile of ['ra2','yr'] as const)for(const raw of ['-2147483649','2147483648','00','-0',' 0','+0','1x']){
    const s=compileMissionObjectEventSource({bindings:fixture({profile,events:`Start=1,6,0,${raw}`})});
    assert.equal(s.events[0]!.status,'unsupported');assert.equal(s.events[0]!.parameters[1],raw);assert.ok(s.diagnostics.length);
  }
  for(const raw of ['-1','99']){const s=compileMissionObjectEventSource({bindings:fixture({events:`Start=1,44,0,${raw}`})});
    assert.equal(s.events[0]!.status,'unsupported');assert.ok(s.events[0]!.reasons.includes('missing-literal-house'));
  }
  const mode=compileMissionObjectEventSource({bindings:fixture({events:'Start=1,48,1,0'})});assert.equal(mode.events[0]!.status,'unsupported');
});

test('nonmoving actors, bridge and source mission metadata do not become movement-specific damage exclusions',()=>{
  const s=compileMissionObjectEventSource({bindings:fixture({speed:0,infantryRows:'0=Commander,Walker,256,2,2,0,Sleep,0,Shared,100,7,1,0,0'})});
  assert.equal(s.actors[0]!.status,'supported');assert.equal(s.actors[0]!.sourceMission,'Sleep');
  assert.equal(s.actors[0]!.origin.rawValue,'Commander,Walker,256,2,2,0,Sleep,0,Shared,100,7,1,0,0');
  const short=compileMissionObjectEventSource({bindings:fixture({infantryRows:'0=Commander,Walker,256,2,2,0,Guard,0,Shared'})});
  assert.ok(short.actors[0]!.reasons.includes('unsupported-source-row-framing'));assert.deepEqual(short.actors[0]!.fatalSequence,[]);
  const zero=compileMissionObjectEventSource({bindings:fixture({infantryRows:'0=Commander,Walker,0,2,2,0,Guard,0,Shared,0,-1,0,1,1'})});
  assert.equal(zero.actors[0]!.initialHealth,1);assert.equal(zero.actors[0]!.status,'supported'); // Preserve the genuine native initialization clamp, not the raw strength token.
});

test('source compilation never introduces scenario poll membership or changes tag reference lifetime',()=>{
  for(const persistence of [0,1,2]){const bindings=fixture({persistence}),s=compileMissionObjectEventSource({bindings});
    assert.deepEqual(s.scenarioPollBindingIds,[]);assert.equal(s.bindingGroups[0]!.persistence,persistence);
    assert.equal(s.bindingGroups[0]!.initialReferenceCount,2);assert.equal(s.bindingGroups[0]!.objectEntityIds.length,2);
    assert.equal(s.events[1]!.latch,'repeat-mode-only');
  }
  const s=compileMissionObjectEventSource({bindings:fixture({events:'Start=2,48,0,0,13,0,1'})});
  assert.deepEqual(s.scenarioPollBindingIds,['binding:tag:shared']);assert.equal(s.coverage.events,1);
});

test('factory identity, detached descriptor inputs and lower budgets reject hostile imports without mutation',()=>{
  const bindings=fixture(),s=compileMissionObjectEventSource({bindings});
  assert.equal(isMissionObjectEventSource(s),true);assert.equal(isMissionObjectEventSource({...s}),false);
  assert.throws(()=>missionObjectEventSourceBindings({...s}),/factory/);
  assert.throws(()=>compileMissionObjectEventSource({bindings:{...bindings}}),/factory/);
  assert.throws(()=>compileMissionObjectEventSource({bindings:new Proxy(bindings,{})}),/factory/);
  let gets=0;const input=new Proxy({bindings},{get(){gets++;throw Error('get must not run');}});
  assert.equal(compileMissionObjectEventSource(input).sha256,s.sha256);assert.equal(gets,0);
  const opts=new Proxy({actors:3},{get(){gets++;throw Error('get must not run');}});
  assert.equal(compileMissionObjectEventSource({bindings},opts).sha256,s.sha256);assert.equal(gets,0);
  for(const options of [{actors:2},{events:3},{references:0},{work:1},{serializedBytes:1}])assert.throws(()=>compileMissionObjectEventSource({bindings},options),/limit|budget/);
  assert.throws(()=>compileMissionObjectEventSource({bindings},{actors:-0}),/limits/);
  assert.throws(()=>compileMissionObjectEventSource({bindings},{get actors():number{throw Error('unexpected');}}),/limits/);
  assert.equal(compileMissionObjectEventSource({bindings}).sha256,s.sha256);
});

test('decoded UTF16 and BOM metadata remain retained but cannot authenticate a byte-native callback source',()=>{
  for(const profile of ['ra2','yr'] as const)for(const [mapEncoding,mapBom] of [['utf16le',true],['utf8',true]] as const){
    const bindings=compileMissionBindings(missionBindingsFixture({profile,mapEncoding,mapBom,extraMap:'[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Events]\nStart=1,6,0,0\n[Actions]\nStart=1,28,0,1,0,0,0,0,A'}));
    const s=compileMissionObjectEventSource({bindings});assert.equal(s.events.length,1);assert.ok(s.diagnostics.some(d=>d.code==='native-byte-encoding'));
  }
});
