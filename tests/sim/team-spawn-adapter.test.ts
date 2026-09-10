// SPDX-License-Identifier: GPL-3.0-or-later
// Original source corpus and save/replay transition tests; no retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamSpawnCatalog, restoreTeamSpawnContext, teamSpawnContextData, type TeamSpawnContext } from '../../packages/sim/src/team-spawn-context.ts';
import { prepareTeamSpawnInsertion, commitTeamSpawnInsertion } from '../../packages/sim/src/team-spawn-insertion.ts';
import { bindSpawnTeamActors, bindTeamActors, createTeamCheckpoint, restoreTeamCheckpoint, prepareTeamTick, migrateSpawnTeamCheckpoint, teamRosterModel, type TeamCheckpoint } from '../../packages/sim/src/team-runtime.ts';
import { admitTeamWorldCommands, stepTeamWorld, replayTeamWorld } from '../../packages/sim/src/team-runtime-world.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
import { canonicalText } from '../../packages/sim/src/canonical.ts';
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
function setup(profile:'ra2'|'yr'='ra2') {
 const f=teamSpawnFixture({profile,speed:2,script:'0=3,1\n1=6,1',waypoint:'0=3003\n1=4003',forceType:'Newcomer',extraInfantryTypes:'1=Newcomer',
  extraRules:'[Newcomer]\nStrength=77\nSpeed=2\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}'});
 const catalog=compileTeamSpawnCatalog({program:f.compilation.program!,definitions:f.definitions,traversal:f.traversal,
  activation:compileTeamActivationSource({teams:f.teams,definitions:f.definitions,rules:f.rules,mission:f.mission}),actionIds:['action:actions:spawn:0']});
 const context=restoreTeamSpawnContext(catalog,[]),checkpoint=createTeamCheckpoint(bindSpawnTeamActors(context));
 const insert=(c:TeamSpawnContext,s:TeamCheckpoint)=>{
  const plan=prepareTeamSpawnInsertion(catalog,c,s.world,'action:actions:spawn:0');assert.equal(plan.status,'ready');
  const result=commitTeamSpawnInsertion(catalog,c,s.world,plan);
  return{...result,checkpoint:migrateSpawnTeamCheckpoint(c,s,result.context,result.world)};
 };
 return{f,catalog,context,checkpoint,insert};
}
for(const profile of ['ra2','yr'] as const)test(`${profile} empty controller admits a source-only type after time advances and restores pending move exactly once`,()=>{
 const s=setup(profile),empty=bindSpawnTeamActors(s.context);
 assert.equal(empty.bindings.length,0);assert.equal(teamRosterModel(empty),s.f.world.model);
 const before=stepTeamWorld(empty,s.checkpoint,5).checkpoint,spawn=s.insert(s.context,before),roster=bindSpawnTeamActors(spawn.context);
 assert.equal(spawn.record.actors[0]!.typeId,'type:infantry:newcomer');assert.equal(spawn.checkpoint.team.startedTick,0);
 assert.equal(spawn.checkpoint.team.instances[0]!.cursor,-1);assert.equal(roster.bindings[0]!.bornAtTick,5);
 assert.deepEqual(spawn.world.state.entities.slice(0,3),before.world.state.entities);
 const pending=prepareTeamTick(roster,spawn.checkpoint),restored=restoreTeamCheckpoint(roster,canonicalText(pending));
 assert.equal(pending.pending!.orders.length,1);assert.equal(pending.pending!.tick,5);
 const final=stepTeamWorld(roster,restored,12),direct=stepTeamWorld(roster,spawn.checkpoint,12);
 assert.deepEqual(final,direct);
 assert.equal(final.checkpoint.team.instances[0]!.issuedAt,5);
 const replay=replayTeamWorld(roster,{schemaVersion:1,rosterSha256:roster.sha256,initialCheckpoint:pending,admissions:[],
  finalNextTick:final.checkpoint.world.nextTick,finalStateSha256:worldHash(final.checkpoint)});
 assert.deepEqual(replay,final);
 assert.equal(canonicalText(s.checkpoint),canonicalText(createTeamCheckpoint(empty)));
});
test('second insertion preserves active cursor, movement reservation, global counters and unrelated queued orders',()=>{
 const s=setup(),first=s.insert(s.context,s.checkpoint),r1=bindSpawnTeamActors(first.context);
 let before=stepTeamWorld(r1,first.checkpoint,2).checkpoint;
 before=admitTeamWorldCommands(r1,before,[{schemaVersion:1,tick:40,playerId:0,sequence:1,kind:'stop',payload:{entityId:1}}]);
 const oldText=canonicalText(before),second=s.insert(first.context,before),r2=bindSpawnTeamActors(second.context);
 assert.deepEqual(second.checkpoint.team.instances[0],before.team.instances[0]);
 assert.equal(second.checkpoint.team.nextOrderId,before.team.nextOrderId);
 assert.equal(second.checkpoint.team.startedTick,before.team.startedTick);
 assert.deepEqual(second.world.queuedCommands,before.world.queuedCommands);
 assert.deepEqual(second.world.state.admissionCursors,before.world.state.admissionCursors);
 assert.deepEqual(second.world.state.entities.slice(0,4),before.world.state.entities);
 const a=stepTeamWorld(r2,second.checkpoint,3),b=stepTeamWorld(r2,restoreTeamCheckpoint(r2,canonicalText(second.checkpoint)),3);
 assert.deepEqual(a,b);assert.equal(canonicalText(before),oldText);
 assert.throws(()=>admitTeamWorldCommands(r2,second.checkpoint,[{schemaVersion:1,tick:42,playerId:0,sequence:2,kind:'stop',payload:{entityId:5}}]),/competing-actor-command/);
});
test('migration rejects pending plans, different source contexts, rewritten history and any changed prior world state',()=>{
 const s=setup(),first=s.insert(s.context,s.checkpoint),r=bindSpawnTeamActors(first.context),before=stepTeamWorld(r,first.checkpoint,1).checkpoint;
 const second=s.insert(first.context,before),stable=canonicalText(before);
 assert.throws(()=>migrateSpawnTeamCheckpoint(first.context,prepareTeamTick(r,before),second.context,second.world),/migration-pending/);
 assert.throws(()=>migrateSpawnTeamCheckpoint(setup('yr').context,s.checkpoint,second.context,second.world),/migration-source/);
 assert.throws(()=>migrateSpawnTeamCheckpoint(first.context,before,first.context,before.world),/migration-prefix/);
 const changed=copy(second.world);changed.state.entities[0]!.health=50;
 assert.throws(()=>migrateSpawnTeamCheckpoint(first.context,before,second.context,changed),/migration-world/);
 const records=copy(teamSpawnContextData(second.context).records);Object.assign(records[0]!.actors[0]!,{x:4});
 const rewritten=restoreTeamSpawnContext(s.catalog,records);
 assert.throws(()=>migrateSpawnTeamCheckpoint(first.context,before,rewritten,second.world),/migration-prefix/);
 const future=copy(teamSpawnContextData(second.context).records);Object.assign(future[1]!,{bornAtTick:future[1]!.bornAtTick+1});
 assert.throws(()=>migrateSpawnTeamCheckpoint(first.context,before,restoreTeamSpawnContext(s.catalog,future),second.world),/migration-birth/);
 assert.equal(canonicalText(before),stable);
});
test('source-valid records cannot capture a queued missing actor or overlap an existing occupant',()=>{
 const s=setup(),spawn=s.insert(s.context,s.checkpoint);
 const queued=admitTeamWorldCommands(bindSpawnTeamActors(s.context),s.checkpoint,[{schemaVersion:1,tick:40,playerId:0,sequence:0,kind:'stop',payload:{entityId:4}}]);
 const next={...spawn.world,queuedCommands:queued.world.queuedCommands,state:{...spawn.world.state,admissionCursors:queued.world.state.admissionCursors}};
 assert.throws(()=>migrateSpawnTeamCheckpoint(s.context,queued,spawn.context,next),/migration-queued-actor/);
 const records=copy(teamSpawnContextData(spawn.context).records);Object.assign(records[0]!.actors[0]!,{x:2,y:2});
 const overlap=restoreTeamSpawnContext(s.catalog,records),model=teamSpawnContextData(overlap).model;
 const badWorld=WorldSimulation.create(model).save();
 assert.throws(()=>migrateSpawnTeamCheckpoint(s.context,s.checkpoint,overlap,badWorld),/migration-occupied/);
});
test('newborn instance cannot start before its birth or pretend it already issued a script step',()=>{
 const s=setup(),before=stepTeamWorld(bindSpawnTeamActors(s.context),s.checkpoint,3).checkpoint,spawn=s.insert(s.context,before),r=bindSpawnTeamActors(spawn.context);
 const early=copy(spawn.checkpoint);Object.assign(early.world,{nextTick:2});early.team.nextTick=2;
 assert.throws(()=>restoreTeamCheckpoint(r,early));
 const progressed=copy(spawn.checkpoint);Object.assign(progressed.team.instances[0]!,{cursor:0,lastStep:0,phase:'retry',retryAt:4});
 assert.throws(()=>restoreTeamCheckpoint(r,progressed),/spawn-checkpoint-initial-state/);
 assert.throws(()=>bindSpawnTeamActors({...spawn.context}),/context-brand/);
 assert.throws(()=>teamRosterModel({...r}),/roster-brand/);
 assert.throws(()=>bindTeamActors(s.f.compilation.program!,[]),/unbound-selected-team/);
});
test('append after losses preserves old instances across lexical ID ordering and never reuses actor IDs',()=>{
 const s=setup();let context=s.context,checkpoint=s.checkpoint;
 for(let i=0;i<12;i++){
  const before=new Map(checkpoint.team.instances.map(v=>[v.id,v])),spawn=s.insert(context,checkpoint);
  context=spawn.context;checkpoint=spawn.checkpoint;
  assert.equal(spawn.record.actors[0]!.entityId,4+i);
  for(const [id,old]of before)assert.deepEqual(checkpoint.team.instances.find(v=>v.id===id),old);
  let r=bindSpawnTeamActors(context);checkpoint=stepTeamWorld(r,checkpoint,1).checkpoint;
  const dead=copy(checkpoint);const actor=dead.world.state.entities.at(-1)!;
  Object.assign(actor,{health:0,goal:null,route:[],progress:0,waitTicks:0});
  checkpoint=stepTeamWorld(r,restoreTeamCheckpoint(r,dead),1).checkpoint;
  assert.ok(checkpoint.team.instances.every(v=>v.phase==='lost'));
 }
 assert.deepEqual(checkpoint.team.instances.map(v=>v.id),['spawn-team:0','spawn-team:1','spawn-team:10','spawn-team:11','spawn-team:2','spawn-team:3','spawn-team:4','spawn-team:5','spawn-team:6','spawn-team:7','spawn-team:8','spawn-team:9']);
});
