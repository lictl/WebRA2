// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { planTeamDestinations, TEAM_DESTINATION_POLICY, TEAM_DESTINATION_LIMITS } from '../../packages/sim/src/team-runtime-destinations.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { createWorldModel } from '../../packages/sim/src/world-model.ts';
import { createNavigationGrid } from '../../packages/sim/src/navigation.ts';
function fixture(profile:'ra2'|'yr'='ra2') {
 const contentIdentity={profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
 const xy=[[1,3],[2,2],[3,1],[2,3],[3,2],[2,4],[3,3],[4,2],[3,4],[4,3]];
 const grid=createNavigationGrid({contentIdentity,movementClass:'walk',cells:xy.map(([x,y])=>({x:x!,y:y!,cost:1,exits:255}))});
 const model=createWorldModel({contentIdentity,sourceSha256:'c'.repeat(64),definitionsSha256:'d'.repeat(64),navigation:[{grid,costScale:1}],blocked:[],
 entities:[[1,0,2,2],[2,0,2,3],[3,1,4,2]].map(([id,owner,x,y])=>({id:id!,rowId:`original:${id}`,typeId:'walker',owner:owner!,kind:'infantry',x:x!,y:y!,initialHealth:100,maximumHealth:100,movementPerTick:128,navigationClass:'walk',blocksCell:true}))});
 const simulation=WorldSimulation.create(model);return {model,simulation,checkpoint:simulation.save()};
}
test('both profiles assign distinct reachable cells in stable actor/candidate order, preserving input',()=>{
 for(const profile of ['ra2','yr'] as const){const {model,simulation,checkpoint}=fixture(profile);
 const a=planTeamDestinations({model,checkpoint,actorIds:[2,1],target:{x:4,y:3}}),b=planTeamDestinations({model,checkpoint,actorIds:[1,2],target:{x:4,y:3}});
 assert.deepEqual(a,b);assert.equal(a.status,'ready');assert.equal(a.policy,TEAM_DESTINATION_POLICY);
 assert.deepEqual(a.assignments,[{entityId:1,x:4,y:3},{entityId:2,x:3,y:4}]);assert.deepEqual(checkpoint,simulation.save());
 simulation.admitCommands(a.assignments.map((v,i)=>({schemaVersion:1,tick:0,playerId:0,sequence:i,kind:'move',payload:{entityId:v.entityId,x:v.x,y:v.y}})));
 simulation.step(20);for(const a of b.assignments){const e=simulation.save().state.entities.find(e=>e.id===a.entityId)!;assert.equal(e.goal,null);assert.deepEqual([e.x,e.y],[a.x,a.y]);}
 assert.ok(Object.isFrozen(a.assignments[0]));
 }
});
test('own stationary unshared cell is an explicit hold candidate; current edge plans from reserved destination',()=>{
 const {model,checkpoint,simulation}=fixture(),hold=planTeamDestinations({model,checkpoint,actorIds:[1],target:{x:2,y:2}});
 assert.equal(hold.status,'ready');assert.deepEqual(hold.assignments,[{entityId:1,x:2,y:2}]);
 simulation.admitCommands([{schemaVersion:1,tick:0,playerId:0,sequence:0,kind:'move',payload:{entityId:1,x:3,y:2}}]);simulation.step();
 const moving=simulation.save();assert.ok(moving.state.entities[0]!.progress>0);
 const next=planTeamDestinations({model,checkpoint:moving,actorIds:[1],target:{x:3,y:2}});assert.equal(next.status,'ready');assert.deepEqual(next.assignments,[{entityId:1,x:3,y:2}]);
 simulation.admitCommands([{schemaVersion:1,tick:simulation.nextTick,playerId:0,sequence:1,kind:'move',payload:{entityId:1,x:3,y:2}}]);simulation.step(3);
 assert.equal(simulation.save().state.entities[0]!.goal,null);
});
test('blocked and resource-exhausted group plans return no partial assignments',()=>{
 const {model,checkpoint}=fixture();const input={model,checkpoint,actorIds:[1,2],target:{x:3,y:3}};
 assert.equal(planTeamDestinations(input,{queries:0}).status,'budget-exhausted');
 const limited=planTeamDestinations(input,{queries:1});assert.equal(limited.status,'budget-exhausted');assert.deepEqual(limited.assignments,[]);
 for(const cap of [{work:0},{expanded:0},{candidates:0}]){const r=planTeamDestinations(input,cap);assert.equal(r.status,'budget-exhausted');assert.deepEqual(r.assignments,[]);}
 const blocked=planTeamDestinations({...input,target:{x:4,y:2}},{radius:0});assert.equal(blocked.status,'blocked');assert.deepEqual(blocked.assignments,[]);
});
test('factory/save/actor validation rejects hostile or impossible inputs without invoking getters',()=>{
 const {model,checkpoint}=fixture(),input={model,checkpoint,actorIds:[1],target:{x:3,y:3}};
 assert.throws(()=>planTeamDestinations({...input,model:{...model}}));
 assert.throws(()=>planTeamDestinations({...input,actorIds:[1,1]}));assert.throws(()=>planTeamDestinations({...input,actorIds:[999]}));
 assert.throws(()=>planTeamDestinations({...input,checkpoint:{...checkpoint,nextTick:-1}}));
 let read=false;const list=Object.defineProperty([1],'0',{get(){read=true;throw Error('getter');}});assert.throws(()=>planTeamDestinations({...input,actorIds:list}));assert.equal(read,false);
 assert.throws(()=>planTeamDestinations(input,{actors:TEAM_DESTINATION_LIMITS.actors+1}));
});
test('stationary occupied footprints, unreachable directed islands and greedy reservation stay explicit',()=>{
 const c={profile:'ra2' as const,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
 const grid=createNavigationGrid({contentIdentity:c,movementClass:'walk',cells:[{x:0,y:0,cost:1,exits:0},{x:1,y:0,cost:1,exits:0},{x:2,y:0,cost:1,exits:0}]});
 const model=createWorldModel({contentIdentity:c,sourceSha256:'c'.repeat(64),definitionsSha256:'d'.repeat(64),navigation:[{grid,costScale:1}],blocked:[],entities:[
 {id:1,rowId:'a',typeId:'walker',owner:0,kind:'infantry',x:0,y:0,initialHealth:100,maximumHealth:100,movementPerTick:1,navigationClass:'walk',blocksCell:true},
 {id:2,rowId:'b',typeId:'building',owner:0,kind:'structure',x:2,y:0,initialHealth:100,maximumHealth:100,movementPerTick:0,navigationClass:null,blocksCell:true}],
 footprints:[{entityId:2,cells:[{x:1,y:0}]}]});
 const checkpoint=WorldSimulation.create(model).save();const r=planTeamDestinations({model,checkpoint,actorIds:[1],target:{x:1,y:0}},{radius:0});assert.equal(r.status,'blocked');
 const dead=structuredClone(checkpoint);dead.state.entities[1]!.health=0;
 const island=planTeamDestinations({model,checkpoint:dead,actorIds:[1],target:{x:1,y:0}},{radius:0});assert.equal(island.status,'blocked');
});
test('queued orders are preserved; reservation guarantee covers observed occupancy and this call only',()=>{
 const {model,simulation}=fixture();simulation.admitCommands([{schemaVersion:1,tick:0,playerId:0,sequence:0,kind:'move',payload:{entityId:2,x:3,y:3}}]);
 const checkpoint=simulation.save(),result=planTeamDestinations({model,checkpoint,actorIds:[1],target:{x:3,y:3}});
 assert.equal(result.status,'ready');assert.deepEqual(result.assignments,[{entityId:1,x:3,y:3}]);assert.deepEqual(checkpoint,simulation.save());
 assert.equal(checkpoint.queuedCommands.length,1);
});
