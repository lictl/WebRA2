// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamFixture } from './team-runtime-fixture.ts';
import { compileTeamProgram } from '../../packages/sim/src/team-runtime-program.ts';
import { bindTeamActors,createTeamCheckpoint,restoreTeamCheckpoint,prepareTeamTick,isTeamRoster } from '../../packages/sim/src/team-runtime.ts';
import { admitTeamWorldCommands,commitTeamTick,stepTeamWorld,replayTeamWorld } from '../../packages/sim/src/team-runtime-world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
const fixture=(options:Parameters<typeof teamFixture>[0]={})=>{
 const f=teamFixture({script:'0=3,0',waypoint:'0=3004',...options});assert.ok(f.compilation.program);
 const roster=bindTeamActors(f.compilation.program,[{id:'original-team',teamId:'team:squad',actorIds:options.count===2?[2,1]:[1]}]);
 return{...f,roster,checkpoint:createTeamCheckpoint(roster)};
};
test('both profiles complete a genuine source-bound two-member move with every-tick compound restore equivalence',()=>{
 for(const profile of ['ra2','yr'] as const){const f=fixture({profile,count:2});let checkpoint=f.checkpoint;const issued:number[]=[];
 for(let tick=0;tick<24;tick++){
  const direct=stepTeamWorld(f.roster,checkpoint),restored=stepTeamWorld(f.roster,restoreTeamCheckpoint(f.roster,JSON.stringify(checkpoint)));
  assert.deepEqual(direct,restored);assert.equal(direct.checkpoint.world.nextTick,tick+1);assert.equal(direct.checkpoint.team.nextTick,tick+1);
  issued.push(...direct.orders.map(o=>o.orderId));checkpoint=direct.checkpoint;
 }
 assert.equal(checkpoint.team.instances[0]!.phase,'finished');assert.deepEqual(issued,[0,1]);
 assert.deepEqual(checkpoint.world.state.entities.slice(0,2).map(e=>[e.x,e.y,e.goal]),[[4,3,null],[3,4,null]]);
 assert.equal(isTeamRoster(f.roster),true);assert.equal(isTeamRoster({...f.roster}),false);
 }
});
test('prepared plans round trip and retry identically; failures cannot advance either state or accept arbitrary acknowledgements',()=>{
 const f=fixture(),pending=prepareTeamTick(f.roster,f.checkpoint);assert.equal(pending.world.nextTick,0);assert.equal(pending.team.nextTick,0);assert.equal(pending.pending!.orders.length,1);
 assert.deepEqual(commitTeamTick(f.roster,pending),commitTeamTick(f.roster,JSON.stringify(pending)));
 assert.throws(()=>commitTeamTick(f.roster,pending,0),/step-work-limit/);assert.equal(pending.world.nextTick,0);assert.equal(pending.team.nextTick,0);
 const bad=structuredClone(pending);bad.pending!.orders[0]!.x=1;assert.throws(()=>commitTeamTick(f.roster,bad),/pending-plan-mismatch/);
 assert.throws(()=>restoreTeamCheckpoint(f.roster,{...pending,ack:true}));
 assert.throws(()=>commitTeamTick(f.roster,f.checkpoint),/missing-pending-plan/);
 assert.deepEqual(prepareTeamTick(f.roster,pending),pending);
});
test('jump cursor uses one update per instruction and retains pending state through replay',()=>{
 const f=fixture({script:'0=6,1'}),initial=prepareTeamTick(f.roster,f.checkpoint),run=stepTeamWorld(f.roster,initial,10);
 assert.equal(run.events.filter(e=>e.kind==='jump').length,10);assert.equal(run.checkpoint.team.instances[0]!.cursor,-1);assert.equal(run.orders.length,0);
 const replay=replayTeamWorld(f.roster,{schemaVersion:1,rosterSha256:f.roster.sha256,initialCheckpoint:initial,admissions:[],finalNextTick:10,finalStateSha256:worldHash(run.checkpoint)});
 assert.deepEqual(replay.checkpoint,run.checkpoint);assert.deepEqual(replay.events,run.events);
});
test('explicit bindings reject incorrect owner/type quantities, duplicate actors and changed sources',()=>{
 const f=fixture(),p=f.compilation.program!;
 assert.throws(()=>bindTeamActors(p,[{id:'bad',teamId:'team:squad',actorIds:[3]}]),/binding-actor/);
 assert.throws(()=>bindTeamActors(p,[{id:'bad',teamId:'team:squad',actorIds:[1,2]}]),/binding-taskforce/);
 assert.throws(()=>bindTeamActors(p,[{id:'bad',teamId:'team:squad',actorIds:[1,1]}]),/binding-actor/);
 const other=fixture({extraRules:'[Unused]\nX=1'});assert.throws(()=>restoreTeamCheckpoint(other.roster,f.checkpoint),/checkpoint-identity/);
 const changed=structuredClone(f.checkpoint);changed.team.instances[0]!.activeMembers=[2];assert.throws(()=>restoreTeamCheckpoint(f.roster,changed),/checkpoint-members/);
});
test('authoritative health loss retires members without manufacturing arrival or victory',()=>{
 const f=fixture({count:2}),first=stepTeamWorld(f.roster,f.checkpoint).checkpoint;
 // Original authoritative-observation fixture: this is not a claim that the current plain movement model executes damage.
 const loss=structuredClone(first);const e=loss.world.state.entities[0]!;e.health=0;e.goal=null;e.route=[];e.progress=0;e.waitTicks=0;
 const after=stepTeamWorld(f.roster,loss).checkpoint;assert.deepEqual(after.team.instances[0]!.activeMembers,[2]);assert.notEqual(after.team.instances[0]!.phase,'finished');
 const allLost=structuredClone(after);const other=allLost.world.state.entities[1]!;other.health=0;other.goal=null;other.route=[];other.progress=0;other.waitTicks=0;
 const result=stepTeamWorld(f.roster,allLost);assert.equal(result.checkpoint.team.instances[0]!.phase,'lost');assert.equal(result.events.filter(e=>e.kind==='finished').length,0);
 assert.deepEqual(restoreTeamCheckpoint(f.roster,JSON.stringify(result.checkpoint)),result.checkpoint);
});
test('external command admission/replay is atomic and cannot compete with controlled actors',()=>{
 const f=fixture({script:'0=6,1'}),command={schemaVersion:1 as const,tick:2,playerId:1,sequence:0,kind:'move',payload:{entityId:3,x:3,y:1}};
 let checkpoint=stepTeamWorld(f.roster,f.checkpoint,2).checkpoint;checkpoint=admitTeamWorldCommands(f.roster,checkpoint,[command]);const final=stepTeamWorld(f.roster,checkpoint,10);
 const replay=replayTeamWorld(f.roster,{schemaVersion:1,rosterSha256:f.roster.sha256,initialCheckpoint:f.checkpoint,admissions:[{nextTick:2,commands:[command]}],finalNextTick:12,finalStateSha256:worldHash(final.checkpoint)});
 assert.deepEqual(replay.checkpoint,final.checkpoint);
 assert.throws(()=>admitTeamWorldCommands(f.roster,f.checkpoint,[{...command,tick:0,playerId:0,payload:{entityId:1,x:3,y:3}}]),/competing-actor-command/);
 assert.throws(()=>admitTeamWorldCommands(f.roster,prepareTeamTick(f.roster,f.checkpoint),[command]),/pending-admission/);
 assert.equal(f.checkpoint.world.queuedCommands.length,0);
});
test('bulk work/order limits roll back the complete call including earlier successful candidate ticks',()=>{
 const f=fixture({script:'0=6,1'});assert.throws(()=>stepTeamWorld(f.roster,f.checkpoint,5,5));assert.equal(f.checkpoint.world.nextTick,0);
 const source=fixture(),program=compileTeamProgram({teams:source.teams,world:source.world,mission:source.mission,teamIds:source.teamIds},{orders:0}).program!;
 const roster=bindTeamActors(program,[{id:'bounded',teamId:'team:squad',actorIds:[1]}]),before=createTeamCheckpoint(roster);
 assert.throws(()=>prepareTeamTick(roster,before),/step-order-limit/);assert.equal(before.team.nextOrderId,0);assert.equal(before.world.nextTick,0);
});
test('another actor can delay an issued arrival indefinitely; moving the blocker resumes the same saved assignment',()=>{
 const f=fixture(),block={schemaVersion:1 as const,tick:0,playerId:1,sequence:0,kind:'move',payload:{entityId:3,x:4,y:3}};
 const start=admitTeamWorldCommands(f.roster,f.checkpoint,[block]);let checkpoint=stepTeamWorld(f.roster,start,30).checkpoint;
 assert.equal(checkpoint.world.state.entities[2]!.x,4);assert.equal(checkpoint.world.state.entities[2]!.y,3);
 assert.equal(checkpoint.team.instances[0]!.phase,'moving');assert.equal(checkpoint.team.nextOrderId,1);
 const assigned=checkpoint.team.instances[0]!.assignments;assert.deepEqual(assigned,[{entityId:1,x:4,y:3}]);
 const leave={...block,tick:30,sequence:1,payload:{entityId:3,x:4,y:2}};
 checkpoint=admitTeamWorldCommands(f.roster,restoreTeamCheckpoint(f.roster,JSON.stringify(checkpoint)),[leave]);
 const run=stepTeamWorld(f.roster,checkpoint,30);assert.equal(run.checkpoint.team.instances[0]!.phase,'finished');
 assert.equal(run.checkpoint.team.nextOrderId,1);assert.equal(run.orders.length,0);
 const replay={schemaVersion:1,rosterSha256:f.roster.sha256,initialCheckpoint:start,admissions:[{nextTick:30,commands:[leave]}],finalNextTick:60,finalStateSha256:worldHash(run.checkpoint)};
 assert.deepEqual(replayTeamWorld(f.roster,JSON.stringify(replay)).checkpoint,run.checkpoint);
});
test('strict destination/counter/timer and replay wire checks reject malformed retained state before execution',()=>{
 const f=fixture(),first=stepTeamWorld(f.roster,f.checkpoint).checkpoint;
 const bad=structuredClone(first);bad.team.instances[0]!.assignments[0]={entityId:1,x:511,y:3};
 assert.throws(()=>restoreTeamCheckpoint(f.roster,bad),/checkpoint-destination/);
 bad.team.instances[0]!.assignments[0]={entityId:1,x:0,y:3};assert.throws(()=>restoreTeamCheckpoint(f.roster,bad),/checkpoint-destination/);
 const mismatch=structuredClone(first);mismatch.team.instances[0]!.assignments[0]={entityId:1,x:3,y:3};
 assert.throws(()=>restoreTeamCheckpoint(f.roster,mismatch),/checkpoint-world-goal/);
 const counter=structuredClone(first);counter.team.nextOrderId=0;assert.throws(()=>restoreTeamCheckpoint(f.roster,counter),/checkpoint-order-counter/);
 const timer=structuredClone(first);timer.team.instances[0]!.retryAt=30;assert.throws(()=>restoreTeamCheckpoint(f.roster,timer),/checkpoint-moving/);
 assert.throws(()=>restoreTeamCheckpoint(f.roster,'{"schemaVersion":1,"schemaVersion":1}'),/duplicate-json-key/);
 const replay={schemaVersion:1,rosterSha256:f.roster.sha256,initialCheckpoint:first,admissions:[],finalNextTick:1,finalStateSha256:worldHash(first)};
 assert.deepEqual(replayTeamWorld(f.roster,new TextEncoder().encode(JSON.stringify(replay))).checkpoint,first);
 assert.throws(()=>replayTeamWorld(f.roster,{...replay,finalStateSha256:'x'}));
 assert.throws(()=>replayTeamWorld(f.roster,{...replay,finalNextTick:0}));
 const p=compileTeamProgram({teams:f.teams,world:f.world,mission:f.mission,teamIds:f.teamIds},{candidateCells:0}).program!;
 const roster=bindTeamActors(p,[{id:'bounded',teamId:'team:squad',actorIds:[1]}]),zero=createTeamCheckpoint(roster);
 assert.throws(()=>prepareTeamTick(roster,zero),/destination-budget/);assert.equal(zero.team.nextOrderId,0);
});

test('no free reachable slot retains a bounded retry timer through every-tick restore and replay',()=>{
 const cells=[[1,3],[2,2],[3,1],[2,3],[3,2],[2,4],[3,3],[4,2],[3,4],[4,3]];
 const infantryRows=['0=Commander,Walker,256,2,2,0,Guard,0,None',...cells.map(([x,y],i)=>`${i+1}=Rival,Walker,256,${x},${y},0,Guard,0,None`)].join('\n');
 const f=fixture({infantryRows});let checkpoint=f.checkpoint;const blockedTicks:number[]=[];
 for(let tick=0;tick<30;tick++){
  const run=stepTeamWorld(f.roster,checkpoint);assert.deepEqual(stepTeamWorld(f.roster,JSON.stringify(checkpoint)),run);
  assert.equal(run.orders.length,0);assert.equal(run.checkpoint.team.instances[0]!.phase,'retry');
  blockedTicks.push(...run.events.filter(e=>e.kind==='blocked').map(e=>e.tick));checkpoint=run.checkpoint;
 }
 assert.deepEqual(blockedTicks,[0,15]);assert.equal(checkpoint.team.instances[0]!.retryAt,30);
 const replay=replayTeamWorld(f.roster,{schemaVersion:1,rosterSha256:f.roster.sha256,initialCheckpoint:f.checkpoint,admissions:[],finalNextTick:30,finalStateSha256:worldHash(checkpoint)});
 assert.deepEqual(replay.checkpoint,checkpoint);assert.equal(replay.events.some(e=>e.kind==='finished'),false);
});
test('multiple instances preserve stable outbox and owner sequence order independent of binding input order',()=>{
 const f=fixture(),bindings=[{id:'z-last',teamId:'team:squad',actorIds:[1]},{id:'a-first',teamId:'team:squad',actorIds:[2]}];
 const a=bindTeamActors(f.compilation.program!,bindings),b=bindTeamActors(f.compilation.program!,[...bindings].reverse());
 assert.equal(a.sha256,b.sha256);const before=createTeamCheckpoint(a),pending=prepareTeamTick(a,before),run=commitTeamTick(a,pending);
 assert.deepEqual(run,stepTeamWorld(b,createTeamCheckpoint(b)));assert.deepEqual(run.orders.map(o=>[o.orderId,o.instanceId,o.entityId]),[[0,'a-first',2],[1,'z-last',1]]);
 assert.deepEqual(run.checkpoint.world.state.admissionCursors,[{playerId:0,sequence:1}]);
 assert.deepEqual(run.worldEvents.filter(e=>e.phase==='command').map(e=>[e.entityId,e.kind]),[[2,'move-accepted'],[1,'move-accepted']]);
 assert.equal(before.world.queuedCommands.length,0);assert.equal(before.team.nextOrderId,0);
});
