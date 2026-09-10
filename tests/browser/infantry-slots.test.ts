// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature infantry layouts; no retail source values or expected frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import { infantryPassageFixture, infantryRow } from '../sim/infantry-passage-fixture.ts';
import { bindInfantryPassageWorld } from '../../packages/sim/src/world-infantry-passage.ts';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { validWorldSummary, validWorldSnapshot, type WorldSummary, type WorldSnapshot } from '../../apps/web/src/world-protocol.ts';
import { infantrySlotOffset, locateWorldActor } from '../../apps/web/src/infantry-slot-projection.ts';
import { projectControlPoints } from '../../apps/web/src/world-selection.ts';
import { originalWorld } from './world-ui.fixture.ts';
function prepared(profile:'ra2'|'yr'='ra2',unsupported=false){
 const f=infantryPassageFixture({profile,...(unsupported?{rows:[infantryRow(0,2,2,2),infantryRow(1,2,3,1)]}:{})});
 return {...f.world,model:bindInfantryPassageWorld(f.catalog,f.world.model)};
}
const move={type:'world-order' as const,order:'move' as const,playerId:0,entityId:1,x:2,y:3};
test('genuine slot world crosses the app boundary, shares a cell, restores moving reservations and verifies replay',()=>{
 for(const profile of ['ra2','yr'] as const){
  const p=prepared(profile),s=new WorldSession(p);assert(validWorldSummary(s.summary));
  assert.equal(s.summary.infantryCatalogHash,p.model.infantryPassage!.sha256);
  assert.deepEqual(s.summary.actors.map(a=>a.initialSubcell),[2,4]);
  s.act(move);s.act({type:'world-step',ticks:1});const moving=s.snapshot();
  assert.deepEqual([moving.actors[0]!.subcell,moving.actors[0]!.reservedSubcell],[2,2]);assert(moving.actors[0]!.progress>0);
  const checkpoint=s.act({type:'world-save'})!,b=new WorldSession(p);b.act({type:'world-restore',text:checkpoint.text!});
  s.act({type:'world-step',ticks:1});b.act({type:'world-step',ticks:1});assert.equal(s.snapshot().stateHash,b.snapshot().stateHash);
  assert.deepEqual(s.snapshot().actors.map(a=>[a.x,a.y,a.subcell,a.reservedSubcell]),[[2,3,2,null],[2,3,4,null]]);
  const replay=s.act({type:'world-replay-export'})!;assert.equal(b.act({type:'world-replay-validate',text:replay.text!})!.stateHash,s.snapshot().stateHash);
  b.act({type:'world-restore',text:checkpoint.text!});b.act({type:'world-order',order:'stop',playerId:0,entityId:1});b.act({type:'world-step',ticks:1});
  assert.deepEqual([b.snapshot().actors[0]!.x,b.snapshot().actors[0]!.y,b.snapshot().actors[0]!.subcell,b.snapshot().actors[0]!.reservedSubcell],[2,2,2,null]);
  const damaged=JSON.parse(checkpoint.text!);damaged.state.infantrySlots[0].reservedSubcell=4;
  const before=b.snapshot();assert.throws(()=>b.act({type:'world-restore',text:JSON.stringify(damaged)}));assert.deepEqual(b.snapshot(),before);
 }
});
test('slot wire rejects missing/covert fields, unsupported slots, legacy mixtures and inconsistent reservations',()=>{
 const s=new WorldSession(prepared()),summary=s.summary,initial=s.snapshot();
 const summaries:((v:WorldSummary)=>void)[]=[v=>{delete v.infantryPolicy;},v=>{v.infantryCatalogHash='x';},v=>{v.motionPolicy='webra2-cell-motion-1';},v=>{v.actors[0]!.initialSubcell=1 as 2;},v=>{v.actors[0]!.kind='unit';},v=>{delete v.actors[0]!.initialSubcell;}];
 for(const change of summaries){const value=structuredClone(summary);change(value);assert(!validWorldSummary(value));}
 const cases:((v:WorldSnapshot)=>void)[]=[v=>{delete v.actors[0]!.subcell;},v=>{v.actors[0]!.subcell=null;},v=>{v.actors[0]!.reservedSubcell=2;},v=>{v.actors[0]!.subcell=5 as 2;},v=>{Object.assign(v.actors[0]!,{permission:true});},v=>{v.actors[0]!.x=2;v.actors[0]!.y=3;v.actors[0]!.subcell=4;}];
 for(const change of cases){const value=structuredClone(initial);change(value);assert(!validWorldSnapshot(value,summary));}
 s.act(move);s.act({type:'world-step',ticks:1});const moving=s.snapshot();moving.actors[0]!.reservedSubcell=null;assert(!validWorldSnapshot(moving,summary));
 const unsupported=new WorldSession(prepared('ra2',true)),v=unsupported.snapshot();assert.equal(v.actors[1]!.subcell,null);v.actors[1]!.subcell=3;assert(!validWorldSnapshot(v,unsupported.summary));
 const legacy=new WorldSession(originalWorld());assert(!Object.hasOwn(legacy.summary,'infantryPolicy'));assert(!Object.hasOwn(legacy.snapshot().actors[0]!,'subcell'));
 const mixed=legacy.snapshot();mixed.actors[0]!.subcell=null;assert(!validWorldSnapshot(mixed,legacy.summary));
 assert(!validWorldSnapshot(initial)); // A slot reply requires the bounded summary coverage, never self-asserted permission.
});
test('original independent rational slot projections match focus and camera anchors, while old models stay centered',()=>{
 const s=new WorldSession(prepared()),summary=s.summary,snapshot=s.snapshot();
 const centers=[[192,64],[64,192],[192,192]];
 for(let i=0;i<centers.length;i++){
  const [x,y]=centers[i]!,slot=(i+2) as 2|3|4;
  const expected={x:Math.floor(((x!-y!)*30+128)/256),y:Math.floor(((x!+y!-256)*15+128)/256)};
  assert.deepEqual(infantrySlotOffset(summary.motionPolicy,{subcell:slot}),expected);
  snapshot.actors[0]!.subcell=slot;const actor=snapshot.actors[0]!;
  assert.deepEqual(locateWorldActor(summary,actor,()=>({x:100,y:100})),{x:100+expected.x,y:100+expected.y});
  assert.deepEqual(projectControlPoints(summary,snapshot,{cameraX:50,cameraY:40,width:400,height:400,zoom:2},()=>({x:100,y:100}))[0],{entityId:actor.id,x:(50+expected.x)*2,y:(60+expected.y)*2});
 }
 for(const slot of [null,2,3,4] as const)assert.deepEqual(infantrySlotOffset('webra2-cell-motion-1',{subcell:slot}),{x:0,y:0});
 assert.equal(locateWorldActor(summary,snapshot.actors[0]!,()=>null),null);
 assert.throws(()=>infantrySlotOffset(summary.motionPolicy,{subcell:5 as 2}),/projection/);
});
