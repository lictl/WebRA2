// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamSpawnCatalog, type TeamSpawnLimits } from '../../packages/sim/src/team-spawn-context.ts';
import { createTeamSpawnCheckpoint, restoreTeamSpawnCheckpoint, admitTeamSpawnInput, prepareTeamSpawnTick, commitTeamSpawnTick,
 stepTeamSpawnWorld, replayTeamSpawnWorld } from '../../packages/sim/src/team-spawn-runtime.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
const actionId='action:actions:spawn:0';
function fixture(options:Parameters<typeof teamSpawnFixture>[0]={},limits:Partial<TeamSpawnLimits>={}){
 const f=teamSpawnFixture({waypoint:'0=1003\n1=3003',script:'0=3,1\n1=6,1',...options});
 const activation=compileTeamActivationSource({teams:f.teams,definitions:f.definitions,rules:f.rules,mission:f.mission});
 return {f,catalog:compileTeamSpawnCatalog({program:f.compilation.program!,definitions:f.definitions,traversal:f.traversal,activation,actionIds:[actionId]},limits)};
}
for(const profile of ['ra2','yr'] as const)for(const count of [1,2])test(`${profile} ${count} source members spawn, move, restore every tick and replay pending exactly once`,()=>{
 const {catalog}=fixture({profile,count,speed:10});let checkpoint=stepTeamSpawnWorld(catalog,createTeamSpawnCheckpoint(catalog),5).checkpoint;
 const initial=admitTeamSpawnInput(catalog,checkpoint,{actions:[actionId],commands:[]}),before=worldHash(initial);
 const pending=prepareTeamSpawnTick(catalog,initial);assert.equal(pending.records.length,0);assert.equal(pending.pending!.checkpoint.records.length,1);
 assert.equal(worldHash(initial),before);assert.throws(()=>admitTeamSpawnInput(catalog,pending,{actions:[actionId],commands:[]}),/pending-admission/);
 checkpoint=commitTeamSpawnTick(catalog,restoreTeamSpawnCheckpoint(catalog,JSON.stringify(pending))).checkpoint;
 assert.equal(checkpoint.records[0]!.bornAtTick,5);assert.equal(checkpoint.team.world.state.entities.length,3+count);
 const starts=checkpoint.records[0]!.actors.map(a=>[a.x,a.y]);let moved=false;
 for(let i=0;i<40;i++){
  const a=stepTeamSpawnWorld(catalog,checkpoint),b=stepTeamSpawnWorld(catalog,JSON.stringify(checkpoint));assert.deepEqual(a,b);
  checkpoint=a.checkpoint;assert.deepEqual(restoreTeamSpawnCheckpoint(catalog,checkpoint),checkpoint);
  moved ||= checkpoint.team.world.state.entities.slice(3).some((e,j)=>e.x!==starts[j]![0]||e.y!==starts[j]![1]);
 }
 assert.ok(moved);assert.equal(checkpoint.records.length,1);assert.equal(checkpoint.requests[0]!.status,'spawned');
 const replay={schemaVersion:1,catalogSha256:catalog.sha256,initialCheckpoint:pending,admissions:[],finalNextTick:checkpoint.team.world.nextTick,finalStateSha256:worldHash(checkpoint)};
 assert.deepEqual(replayTeamSpawnWorld(catalog,JSON.stringify(replay)).checkpoint,checkpoint);
});
test('a second source activation preserves running instances and initial-record replay does not duplicate them',()=>{
 const {catalog}=fixture({speed:128});let checkpoint=admitTeamSpawnInput(catalog,createTeamSpawnCheckpoint(catalog),{actions:[actionId],commands:[]});
 checkpoint=stepTeamSpawnWorld(catalog,checkpoint,6).checkpoint;const initial=checkpoint,old=checkpoint.team.team.instances[0];
 const admitted=admitTeamSpawnInput(catalog,checkpoint,{actions:[actionId],commands:[]});assert.deepEqual(admitted.team.team.instances[0],old);
 checkpoint=stepTeamSpawnWorld(catalog,admitted,10).checkpoint;
 assert.equal(checkpoint.records.length,2);assert.equal(checkpoint.records[1]!.actors[0]!.entityId,5);
 const replay={schemaVersion:1,catalogSha256:catalog.sha256,initialCheckpoint:initial,admissions:[{nextTick:initial.team.world.nextTick,actions:[actionId],commands:[]}],finalNextTick:checkpoint.team.world.nextTick,finalStateSha256:worldHash(checkpoint)};
 assert.deepEqual(replayTeamSpawnWorld(catalog,replay).checkpoint,checkpoint);
});
test('blocked activation retries at its saved tick and commits only after the blocker departs',()=>{
 const {catalog}=fixture({waypoint:'0=3003\n1=3004',infantryRows:'0=Commander,Walker,256,3,3,0,Guard,0,None',speed:128},{radius:0,candidates:1});
 const initial=admitTeamSpawnInput(catalog,createTeamSpawnCheckpoint(catalog),{actions:[actionId],commands:[{schemaVersion:1,tick:0,playerId:0,sequence:0,kind:'move',payload:{entityId:1,x:3,y:4}}]});
 const first=stepTeamSpawnWorld(catalog,initial);assert.equal(first.checkpoint.records.length,0);assert.equal(first.spawnEvents[0]!.kind,'blocked');assert.equal(first.checkpoint.requests[0]!.nextAttemptTick,15);
 const before=stepTeamSpawnWorld(catalog,first.checkpoint,14).checkpoint;assert.equal(before.records.length,0);
 const next=stepTeamSpawnWorld(catalog,JSON.stringify(before));assert.equal(next.checkpoint.records[0]!.bornAtTick,15);assert.equal(next.checkpoint.records[0]!.actors[0]!.entityId,2);
 assert.equal(next.checkpoint.requests[0]!.attempts,2);assert.equal(next.checkpoint.requests[0]!.status,'spawned');
 const replay={schemaVersion:1,catalogSha256:catalog.sha256,initialCheckpoint:initial,admissions:[],finalNextTick:16,finalStateSha256:worldHash(next.checkpoint)};
 assert.deepEqual(replayTeamSpawnWorld(catalog,replay).checkpoint,next.checkpoint);
});
test('bounded exhaustion remains explicit and does not consume actor IDs or mark any script complete',()=>{
 const {catalog}=fixture({waypoint:'0=3003\n1=3004',infantryRows:'0=Commander,Walker,256,3,3,0,Guard,0,None'},{radius:0,candidates:1,retries:1});
 const initial=admitTeamSpawnInput(catalog,createTeamSpawnCheckpoint(catalog),{actions:[actionId],commands:[]}),next=stepTeamSpawnWorld(catalog,initial);
 assert.equal(next.spawnEvents[0]!.kind,'exhausted');assert.equal(next.checkpoint.requests[0]!.status,'exhausted');assert.equal(next.checkpoint.records.length,0);
 assert.equal(next.checkpoint.team.team.instances.length,0);assert.equal(next.checkpoint.team.world.state.entities.length,1);
 assert.deepEqual(restoreTeamSpawnCheckpoint(catalog,next.checkpoint),next.checkpoint);
});
test('complete transaction rollback on output/resource failure, request tampering and changed pending candidates',()=>{
 const {catalog}=fixture({}, {trace:0});const initial=admitTeamSpawnInput(catalog,createTeamSpawnCheckpoint(catalog),{actions:[actionId],commands:[]}),digest=worldHash(initial);
 assert.throws(()=>stepTeamSpawnWorld(catalog,initial),/tick-trace-limit/);assert.equal(worldHash(initial),digest);
 const normal=fixture(),start=admitTeamSpawnInput(normal.catalog,createTeamSpawnCheckpoint(normal.catalog),{actions:[actionId],commands:[]});
 const pending=JSON.parse(JSON.stringify(prepareTeamSpawnTick(normal.catalog,start)));pending.pending.checkpoint.records[0].actors[0].x=2;
 assert.throws(()=>restoreTeamSpawnCheckpoint(normal.catalog,pending),/pending-tick-mismatch/);
 const next=stepTeamSpawnWorld(normal.catalog,start).checkpoint,edited=JSON.parse(JSON.stringify(next));edited.requests=[];edited.nextRequestId=0;
 assert.throws(()=>restoreTeamSpawnCheckpoint(normal.catalog,edited),/orphan-record/);
 const wrong=JSON.parse(JSON.stringify(start));wrong.requests[0].nextAttemptTick=15;assert.throws(()=>restoreTeamSpawnCheckpoint(normal.catalog,wrong),/queued-request/);
 assert.throws(()=>admitTeamSpawnInput(normal.catalog,start,{actions:['action:missing'],commands:[]}),/admission-action/);
});

test('a later insertion failure rolls back earlier candidates from the same compound tick',()=>{
 const {catalog}=fixture({}, {historicalActors:1});const initial=admitTeamSpawnInput(catalog,createTeamSpawnCheckpoint(catalog),{actions:[actionId,actionId],commands:[]});
 const digest=worldHash(initial);assert.throws(()=>stepTeamSpawnWorld(catalog,initial),/history-limit/);assert.equal(worldHash(initial),digest);
 assert.equal(initial.records.length,0);assert.ok(initial.requests.every(q=>q.attempts===0&&q.status==='queued'));
});
