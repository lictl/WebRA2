// SPDX-License-Identifier: GPL-3.0-or-later
// Original ownership/slot transitions. Coordinates and source rows are invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import { infantryPassageFixture,infantryRow } from './infantry-passage-fixture.ts';
import { houseTrigger } from './mission-house-fixture.ts';
import { compileMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { createWorldModel,worldPosition,worldHash,type WorldModel } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation,type WorldSave } from '../../packages/sim/src/world.ts';
import { WorldReplayRecorder,replayWorld } from '../../packages/sim/src/world-replay.ts';
import { bindInfantryPassageWorld } from '../../packages/sim/src/world-infantry-passage.ts';
import { createInfantryOccupancy } from '../../packages/sim/src/infantry-passage-occupancy.ts';
import { restoreWorldOwnership } from '../../packages/sim/src/world-ownership.ts';
import { planTeamDestinations } from '../../packages/sim/src/team-runtime-destinations.ts';
import {createCombatModel,combatFactor} from '../../packages/sim/src/combat-model.ts';
import {createOrdinaryCombatRules} from '../../packages/sim/src/ordinary-combat-rules.ts';
import {createOrdinaryDeathRules} from '../../packages/sim/src/ordinary-death-rules.ts';

const tagged=(id:number,x:number,y:number,slot:number,owner='Commander')=>infantryRow(id,x,y,slot,owner,'Guard,0,Shared,0,-1,0,1,1');
const move=(id:number,x:number,y:number,tick=0,sequence=0,playerId=0)=>({schemaVersion:1,tick,sequence,playerId,kind:'move',payload:{entityId:id,x,y}});
const input=(m:WorldModel)=>({contentIdentity:m.contentIdentity,sourceSha256:m.sourceSha256,definitionsSha256:m.definitionsSha256,
  entities:m.entities,navigation:m.navigation,blocked:m.blocked.map(worldPosition),footprints:m.footprints.map(p=>({entityId:p.entityId,cells:p.cells.map(worldPosition)}))});
function fixture(profile:'ra2'|'yr',rows=[tagged(0,2,2,2),infantryRow(1,2,3,4),infantryRow(2,4,3,3)],allies='',reverse='',third=false){
  const f=infantryPassageFixture({profile,rows,allies,reverse,extraMap:houseTrigger,
    mapTransform:s=>third?s.replace('1=Rival\n[Commander]','1=Rival\n2=Observer\n[Observer]\nCountry=Green\nAllies=Commander,Rival\n[Commander]'):s,
    rulesTransform:s=>third?s.replace('1=Red\n[Clear]','1=Red\n2=Green\n[Green]\n[Clear]'):s});
  const bindings=compileMissionBindings({world:f.world,definitions:f.definitions,rules:f.rules,mission:f.mission,difficulty:1});
  const source=compileMissionHouseSource({bindings,definitions:f.definitions,rules:f.rules,mission:f.mission});
  const owned=createWorldModel({...input(f.world.model),ownership:source}),model=bindInfantryPassageWorld(f.catalog,owned);
  const invocation=(opcode=14)=>({instructionId:source.instructions.find(i=>i.opcode===opcode)!.instructionId,sourceHouse:0,triggerHouse:null});
  return {...f,source,owned,model,invocation};
}
function occupancy(model:WorldModel,save:WorldSave){
  const ownership=restoreWorldOwnership(model,save.state.ownership,save.state.entities,save.nextTick);
  const pending=new Set(save.state.combat?.deaths?.filter(d=>d.corpseIndex===null).map(d=>d.entityId));
  return createInfantryOccupancy(model.infantryPassage!,{entities:save.state.entities,infantrySlots:save.state.infantrySlots!,
    retiredEntityIds:save.state.entities.filter(e=>e.health===0&&!pending.has(e.id)).map(e=>e.id)},ownership);
}

test('capture preserves moved shared anchors and slots while denying hostile arrivals and re-entry',()=>{
  for(const profile of ['ra2','yr']as const){
    const f=fixture(profile),r=new WorldReplayRecorder(f.model);
    assert.equal(f.model.ownership,f.source);assert.equal(f.model.infantryPassage,f.catalog);
    assert.equal(f.model.sha256,createWorldModel({...input(f.world.model),ownership:f.source,infantryPassage:f.catalog}).sha256);
    r.admitCommands([move(1,2,3)]);r.step(2);const before=r.save();
    assert.deepEqual(before.state.entities.slice(0,2).map(e=>[e.x,e.y]),[[2,3],[2,3]]);
    r.transferOwnership(f.invocation());const captured=r.save();
    assert.deepEqual(captured.state.entities.map(e=>e.owner),[1,0,0]);
    assert.deepEqual(captured.state.entities.map(e=>[e.x,e.y]),before.state.entities.map(e=>[e.x,e.y]));
    assert.deepEqual(captured.state.infantrySlots,before.state.infantrySlots);
    assert.deepEqual(captured.state.ownership!.sharing,[{transferIndex:0,cell:1538,members:[{entityId:1,subcell:2},{entityId:2,subcell:4}],remainingIds:[1,2]}]);
    assert.equal(occupancy(f.model,captured).choose(3,1538).reason,'captured-settled-group');
    const restored=WorldSimulation.restore(f.model,captured);assert.deepEqual(restored.step(),r.step());assert.deepEqual(restored.save(),r.save());
    r.admitCommands([move(1,3,3,3,0,1)]);r.step(2);assert.deepEqual(r.save().state.ownership!.sharing,[]);
    r.admitCommands([move(1,2,3,5,1,1)]);r.step(8);assert.deepEqual([r.save().state.entities[0]!.x,r.save().state.entities[0]!.y],[3,3]);
    assert.equal(replayWorld(f.model,r.document()).stateSha256,worldHash(r.save()));
  }
});

test('capture cancels newly hostile incoming reservations but preserves anchors and future current-house planning',()=>{
  for(const profile of ['ra2','yr']as const){
    const f=fixture(profile,[tagged(0,2,3,2),infantryRow(1,2,2,4)]),r=new WorldReplayRecorder(f.model);
    r.admitCommands([move(2,2,3)]);r.step();const before=r.save();assert(before.state.entities[1]!.progress>0);
    r.transferOwnership(f.invocation());const after=r.save();
    assert.deepEqual(after.state.entities.map(e=>[e.x,e.y]),before.state.entities.map(e=>[e.x,e.y]));
    assert.equal(after.state.entities[1]!.progress,0);assert.equal(after.state.entities[1]!.goal,1538);
    assert.equal(after.state.infantrySlots![1]!.reservedSubcell,null);assert.deepEqual(after.state.ownership!.sharing,[]);
    const blocked=planTeamDestinations({model:f.model,checkpoint:after,actorIds:[2],target:{x:2,y:3}},{radius:0});assert.equal(blocked.status,'blocked');
    r.transferOwnership(f.invocation(36));
    const ready=planTeamDestinations({model:f.model,checkpoint:r.save(),actorIds:[2],target:{x:2,y:3}},{radius:0});assert.equal(ready.status,'ready');
    const limited=planTeamDestinations({model:f.model,checkpoint:r.save(),actorIds:[2],target:{x:2,y:3}},{radius:0},ready.work.visits+ready.work.queries+ready.work.expanded-1);
    assert.equal(limited.status,'budget-exhausted');
    r.admitCommands([move(2,2,3,1,0,1)]);r.step(2);assert.deepEqual([r.save().state.entities[1]!.x,r.save().state.entities[1]!.y],[2,3]);
    assert.equal(replayWorld(f.model,r.document()).stateSha256,worldHash(r.save()));
  }
});

test('retained capture claims reject forged history, missing members, collision slots and permission lookalikes',()=>{
  const f=fixture('yr'),sim=WorldSimulation.create(f.model);sim.admitCommands([move(1,2,3)]);sim.step(2);sim.transferOwnership(f.invocation());
  const initial=sim.save(),text=sim.saveText();
  for(const mutate of [
    (s:WorldSave)=>{s.state.ownership!.sharing=[];},
    (s:WorldSave)=>{s.state.ownership!.sharing![0]!.transferIndex=1;},
    (s:WorldSave)=>{s.state.ownership!.sharing![0]!.remainingIds.pop();},
    (s:WorldSave)=>{s.state.ownership!.sharing![0]!.members[0]!.entityId=3;},
    (s:WorldSave)=>{s.state.ownership!.sharing![0]!.members[1]!.subcell=2;},
    (s:WorldSave)=>{s.state.ownership!.sharing![0]!.cell=1539;},
    (s:WorldSave)=>{s.state.entities[2]!.x=2;s.state.entities[2]!.y=3;},
    (s:WorldSave)=>{s.state.infantrySlots![0]!.subcell=3;},
  ]){const save=structuredClone(initial);mutate(save);assert.throws(()=>WorldSimulation.restore(f.model,save));assert.equal(sim.saveText(),text);}
  assert.throws(()=>createInfantryOccupancy(f.catalog,{entities:initial.state.entities,infantrySlots:initial.state.infantrySlots!,retiredEntityIds:[]},initial.state.ownership),/context/);
  assert.throws(()=>createInfantryOccupancy(f.catalog,{entities:initial.state.entities,infantrySlots:initial.state.infantrySlots!,retiredEntityIds:[]}),/world-record/);
  const restored=restoreWorldOwnership(f.model,initial.state.ownership,initial.state.entities,initial.nextTick);
  assert.throws(()=>createInfantryOccupancy(f.catalog,{entities:initial.state.entities,infantrySlots:initial.state.infantrySlots!,retiredEntityIds:[]},new Proxy(restored,{})),/context/);
});

test('three-member captured groups shrink on each departure and minimum transfer budgets are atomic',()=>{
  const f=fixture('ra2'),r=new WorldReplayRecorder(f.model);r.admitCommands([move(1,3,3),move(2,3,3,0,1),move(3,3,3,0,2)]);r.step(8);
  assert(r.save().state.entities.every(e=>e.x===3&&e.y===3));const before=r.save();
  const result=r.transferOwnership(f.invocation());assert.equal(r.save().state.ownership!.sharing![0]!.remainingIds.length,3);
  const lower=WorldSimulation.restore(f.model,before),minimum=WorldSimulation.restore(f.model,before);
  assert.throws(()=>lower.transferOwnership(f.invocation(),result.work-1),/work/);assert.deepEqual(lower.save(),before);
  assert.deepEqual(minimum.transferOwnership(f.invocation(),result.work),result);
  r.admitCommands([move(3,4,3,8,3)]);r.step(2);assert.deepEqual(r.save().state.ownership!.sharing![0]!.remainingIds,[1,2]);
  r.admitCommands([move(2,2,3,10,4)]);r.step(2);assert.deepEqual(r.save().state.ownership!.sharing,[]);
  assert.equal(replayWorld(f.model,r.document()).stateSha256,worldHash(r.save()));
});

test('current-house directed alliances retain only their actual direction after capture',()=>{
  for(const profile of ['ra2','yr']as const){
    const f=fixture(profile,[tagged(0,2,2,2),infantryRow(1,2,3,4)],'Rival',''),sim=WorldSimulation.create(f.model);
    sim.transferOwnership(f.invocation());const index=occupancy(f.model,sim.save());
    assert.equal(index.choose(1,1538).reason,'non-allied-occupant');assert.equal(index.choose(2,1026).status,'available');
    assert.deepEqual(sim.save().state.ownership!.sharing,[]);
  }
});

test('captured co-occupant pending death keeps its slot and removes the retained group only on completion',()=>{
  for(const profile of ['ra2','yr']as const){
    const f=fixture(profile),actors=f.model.entities.map(e=>({entityId:e.id,armor:0,layer:'ground'as const,weapons:['gun'],initialAmmo:-1}));
    const combat=createCombatModel({weapons:[{id:'gun',damage:100,range:2048,minimumRange:0,reloadTicks:4,burst:1,burstDelayTicks:1,delivery:'instant',speed:0,ground:true,air:false,verses:Array.from({length:11},()=>combatFactor(1))}],actors,allies:[],
      ordinary:createOrdinaryCombatRules({seed:0,actors:actors.map(a=>({entityId:a.entityId,houseFirepower:1,actorFirepower:1,veteranCombat:1,countryArmor:1,actorArmor:1,veteranArmor:1,houseRof:1,veteranRof:1})),weapons:[{weaponId:'gun',maxDamage:1000}]}),
      ordinaryDeath:createOrdinaryDeathRules({actors:actors.map(a=>({entityId:a.entityId,corpseAnimationIds:['corpse'],sequence11Ticks:2,sequence12Ticks:3})),weapons:[{weaponId:'gun',infDeath:1}]})});
    const model=createWorldModel({...input(f.world.model),ownership:f.source,infantryPassage:f.catalog,combat}),r=new WorldReplayRecorder(model);
    r.admitCommands([move(1,2,3)]);r.step(2);r.transferOwnership(f.invocation());
    r.admitCommands([{schemaVersion:1,tick:2,sequence:1,playerId:0,kind:'attack',payload:{entityId:2,targetId:1}}]);r.step();
    assert.equal(r.save().state.entities[0]!.health,0);assert.equal(r.save().state.ownership!.sharing!.length,1);
    assert.equal(occupancy(model,r.save()).choose(3,1538).reason,'captured-settled-group');
    for(let i=0;i<2;i++){const restored=WorldSimulation.restore(model,r.save());assert.deepEqual(restored.step(),r.step());assert.deepEqual(restored.save(),r.save());}
    assert.deepEqual(r.save().state.ownership!.sharing,[]);assert.equal(occupancy(model,r.save()).choose(3,1538).status,'available');
    assert.equal(replayWorld(model,r.document()).stateSha256,worldHash(r.save()));
  }
});

test('a third house allied to both owners cannot enlarge a captured cohort, and its in-flight reservation is canceled',()=>{
  for(const profile of ['ra2','yr']as const){
    const f=fixture(profile,[tagged(0,2,2,2),infantryRow(1,2,3,4),infantryRow(2,3,3,3,'Observer')],'','',true);
    const r=new WorldReplayRecorder(f.model);r.admitCommands([move(1,2,3)]);r.step(2);
    r.admitCommands([move(3,2,3,2,0,2)]);r.step();assert(r.save().state.entities[2]!.progress>0);
    r.transferOwnership(f.invocation());const captured=r.save();
    assert.equal(captured.state.entities[2]!.progress,0);assert.equal(captured.state.infantrySlots![2]!.reservedSubcell,null);
    assert.equal(occupancy(f.model,captured).choose(3,1538).reason,'captured-settled-group');
    assert.equal(planTeamDestinations({model:f.model,checkpoint:captured,actorIds:[1],target:{x:2,y:3}},{radius:0}).status,'ready');
    r.transferOwnership(f.invocation(36));assert.deepEqual(r.save().state.ownership!.sharing,[]);
    r.admitCommands([move(3,2,3,3,1,2)]);r.step(2);assert.deepEqual([r.save().state.entities[2]!.x,r.save().state.entities[2]!.y],[2,3]);
    assert.equal(replayWorld(f.model,r.document()).stateSha256,worldHash(r.save()));
  }
});


test('captured original shared cohorts close before third-house queries and cancel incoming edges',()=>{
  for(const profile of ['ra2','yr']as const)for(const incoming of [false,true]){
    const f=fixture(profile,[tagged(0,2,3,2),infantryRow(1,2,3,4),infantryRow(2,3,3,3,'Observer')],'','',true),r=new WorldReplayRecorder(f.model);
    if(incoming){r.admitCommands([move(3,2,3,0,0,2)]);r.step();assert(r.save().state.entities[2]!.progress>0);}
    const before=r.save();r.transferOwnership(f.invocation());const after=r.save();
    assert.deepEqual(after.state.entities.map(e=>[e.x,e.y]),before.state.entities.map(e=>[e.x,e.y]));
    assert.deepEqual(after.state.ownership!.sharing,[{transferIndex:0,cell:1538,members:[{entityId:1,subcell:2},{entityId:2,subcell:4}],remainingIds:[1,2]}]);
    assert.equal(after.state.entities[2]!.progress,0);assert.equal(after.state.infantrySlots![2]!.reservedSubcell,null);
    assert.equal(occupancy(f.model,after).choose(3,1538).reason,'captured-settled-group');
    const omitted=structuredClone(after);omitted.state.ownership!.sharing=[];assert.throws(()=>WorldSimulation.restore(f.model,omitted),/captured-group-missing/);
    if(!incoming)r.admitCommands([move(3,2,3,0,0,2)]);
    r.step(6);assert.deepEqual([r.save().state.entities[2]!.x,r.save().state.entities[2]!.y],[3,3]);
    assert.deepEqual(WorldSimulation.restore(f.model,r.save()).save(),r.save());
    // Returning the second owner to the captured house removes the closed group.
    r.transferOwnership(f.invocation(36));assert.deepEqual(r.save().state.ownership!.sharing,[]);
    r.admitCommands([move(3,2,3,r.save().nextTick,1,2)]);r.step(4);
    assert.deepEqual([r.save().state.entities[2]!.x,r.save().state.entities[2]!.y],[2,3]);
    assert.equal(replayWorld(f.model,r.document()).stateSha256,worldHash(r.save()));
  }
});
