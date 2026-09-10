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
function missionBindingsFixture({profile='ra2' as 'ra2'|'yr', mapEncoding='utf8' as 'utf8'|'latin1', extraRules='', extraInfantryTypes='', extraArt='', waypoint='0=3003', extraMap='[Actions]\nSpawn=1,80,1,Squad,0,0,0,0,A', rivalCountry='Red', speed=128, infantryRows='0=Commander,Walker,256,2,2,0,Guard,0,None\n1=Commander,Walker,256,2,3,0,Guard,0,None\n2=Rival,Walker,256,4,2,0,Guard,0,None'}={}) {
  const xy = [[1,3],[2,2],[3,1],[2,3],[3,2],[2,4],[3,3],[4,2],[3,4],[4,3]];
  const raw = new Uint8Array(114), view = new DataView(raw.buffer);
  xy.forEach(([x,y], i) => { view.setUint16(i*11,x!,true);view.setUint16(i*11+2,y!,true);view.setUint16(i*11+4,1,true); });
  const bytes = new Uint8Array(Buffer.from(`[Basic]\nNewINIFormat=4\nPlayer=Commander\n[Map]\nSize=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN\n[Houses]\n0=Commander\n1=Rival\n[Commander]\nCountry=Blue\n[Rival]\nCountry=${rivalCountry}\n[Infantry]\n${infantryRows}\n[Waypoints]\n${waypoint}\n[IsoMapPack5]\n1=${packed(raw,true)}\n[OverlayPack]\n1=${packed(new Uint8Array(262144).fill(255),false)}\n[OverlayDataPack]\n1=${packed(new Uint8Array(262144),false)}\n${extraMap}`, mapEncoding));
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
import {compileMissionCellEntrySource,isMissionCellEntrySource,missionCellEntrySourceBindings} from '../../packages/sim/src/mission-cell-entry-source.ts';
function fixture({profile='ra2' as 'ra2'|'yr',events='Start=1,1,0,0',cells='3003=Shared\n2004=Shared',extraMap='',extraRules='',rivalCountry='Red',speed=128}={}){
  return compileMissionBindings(missionBindingsFixture({profile,speed,extraRules,rivalCountry,extraMap:`[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=2,Sharing,Start\n[Events]\n${events}\n[Actions]\nStart=1,28,0,1,0,0,0,0,A\n[CellTags]\n${cells}\n${extraMap}`}));
}

test('both profiles preserve exact event operands, shared cell tag and source scenario membership',()=>{
  for(const profile of ['ra2','yr'] as const){const bindings=fixture({profile}),source=compileMissionCellEntrySource({bindings});
    assert.deepEqual(source.diagnostics,[]);assert.equal(source.events.length,1);assert.deepEqual(source.events[0]!.parameters,['0','0']);
    assert.deepEqual(source.events[0]!.selector,{kind:'first-country-house',countryIndex:0,houseId:'houses:0',playerId:0});
    assert.deepEqual(source.cells.map(c=>c.bindingId),['binding:tag:shared','binding:tag:shared']);
    assert.deepEqual(source.scenarioPollBindingIds,[]);assert.equal(source.actors.length,3);assert.ok(source.actors.every(a=>a.status==='supported'));
    assert.equal(source.cellReferences,bindings.cells);assert.equal(missionCellEntrySourceBindings(source),bindings);
    assert.equal(source.canStartCampaign,false);assert.equal(source.nativeBehaviorVerified,false);
    assert.equal(compileMissionCellEntrySource({bindings}).sha256,source.sha256);assert.ok(Object.isFrozen(source.events[0]!.parameters));
    const mixed=compileMissionCellEntrySource({bindings:fixture({profile,events:'Start=2,1,0,-1,13,0,1'})});
    assert.equal(mixed.events[0]!.selector.kind,'any');assert.deepEqual(mixed.scenarioPollBindingIds,['binding:tag:shared']);
  }
});

test('event country resolves first native house, not every same-country actor or trigger owner',()=>{
  for(const profile of ['ra2','yr'] as const){
    const bindings=fixture({profile,events:'Start=1,1,0,1',rivalCountry:'Blue'}),source=compileMissionCellEntrySource({bindings});
    assert.equal(source.events[0]!.status,'unsupported');assert.ok(source.events[0]!.reasons.includes('missing-first-country-house'));
    const same=compileMissionCellEntrySource({bindings:fixture({profile,rivalCountry:'Blue'})});
    assert.equal(same.events[0]!.selector.playerId,0);assert.deepEqual(same.actors.map(a=>a.playerId),[0,0,1]);
    // Both literal houses now have country0. Actor3 still must not match the first-house selector.
    assert.notEqual(same.events[0]!.selector.playerId,same.actors[2]!.playerId);
  }
});

test('unsupported operands remain visible and cannot become source execution proof',()=>{
  for(const profile of ['ra2','yr'] as const)for(const raw of ['-2','2147483648','00',' 0','+0','99']){
    const s=compileMissionCellEntrySource({bindings:fixture({profile,events:`Start=1,1,0,${raw}`})});
    assert.equal(s.events.length,1);assert.equal(s.events[0]!.parameters[1],raw);assert.equal(s.events[0]!.status,'unsupported');assert.ok(s.diagnostics.length);
  }
  const mode=compileMissionCellEntrySource({bindings:fixture({events:'Start=1,1,1,0'})});assert.equal(mode.events[0]!.status,'unsupported');
});

test('unresolved cells and source diagnostics retain all references without coordinate grants',()=>{
  const bindings=fixture({cells:'3003=Shared\n2004=Absent'}),s=compileMissionCellEntrySource({bindings});
  assert.equal(s.cellReferences.length,2);assert.equal(s.cells.length,1);assert.ok(s.diagnostics.some(d=>d.code==='unsupported-cell-reference'));
  const wrongCase=compileMissionCellEntrySource({bindings:fixture({extraMap:'[celltags]\n3002=Shared'})});assert.ok(wrongCase.diagnostics.length);
  const unknown=compileMissionCellEntrySource({bindings:fixture({events:'Start=2,1,0,-1,999,0,0'})});
  assert.equal(unknown.events.length,1); // This component cannot certify the other opcode or a whole VM program.
  assert.equal(unknown.canStartCampaign,false);
});

test('stationary source actors remain ineligible audit rows without poisoning cell/event identity',()=>{
  const source=compileMissionCellEntrySource({bindings:fixture({speed:0})});
  assert.equal(source.actors.length,3);assert.ok(source.actors.every(a=>a.status==='unsupported'&&a.reasons.includes('not-source-mobile')));
  assert.deepEqual(source.diagnostics,[]);assert.equal(source.coverage.supportedActors,0);
});

test('genuine ownership rejects copied/proxied catalogs and captures outer descriptor values once',()=>{
  const bindings=fixture(),s=compileMissionCellEntrySource({bindings});assert.ok(isMissionCellEntrySource(s));assert.equal(isMissionCellEntrySource({...s}),false);
  assert.throws(()=>missionCellEntrySourceBindings({...s}),/factory/);assert.throws(()=>compileMissionCellEntrySource({bindings:{...bindings}}),/factory/);
  assert.throws(()=>compileMissionCellEntrySource({bindings:new Proxy(bindings,{})}),/factory/);
  let called=0;const proxy=new Proxy({bindings},{get(){called++;throw Error('get must not run');}});
  assert.equal(compileMissionCellEntrySource(proxy).sha256,s.sha256);assert.equal(called,0);
  const accessor=Object.defineProperty({},'bindings',{enumerable:true,get(){called++;return bindings;}});
  assert.throws(()=>compileMissionCellEntrySource(accessor as never),/record/);assert.equal(called,0);
  const cap=new Proxy({work:262144},{get(){called++;throw Error('get must not run');}});assert.equal(compileMissionCellEntrySource({bindings},cap).sha256,s.sha256);assert.equal(called,0);
});

test('every limit fails atomically, counts reference expansion, and source identity excludes lower caps',()=>{
  const bindings=fixture(),source=compileMissionCellEntrySource({bindings});
  for(const cap of [{events:0},{cells:1},{actors:2},{references:1},{work:0},{serializedBytes:1}])assert.throws(()=>compileMissionCellEntrySource({bindings},cap));
  assert.throws(()=>compileMissionCellEntrySource({bindings:fixture({events:'Start=1,1,0,99'})},{diagnostics:0}));
  for(const cap of [{work:Infinity},{events:-0},{constructor:1},{work:262145}])assert.throws(()=>compileMissionCellEntrySource({bindings},cap));
  assert.equal(compileMissionCellEntrySource({bindings},{events:1,cells:2,actors:3}).sha256,source.sha256);
});
