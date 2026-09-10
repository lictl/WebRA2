// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamSpawnCatalog, restoreTeamSpawnContext, teamSpawnContextData, type TeamSpawnLimits } from '../../packages/sim/src/team-spawn-context.ts';
import { prepareTeamSpawnInsertion, commitTeamSpawnInsertion } from '../../packages/sim/src/team-spawn-insertion.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
const actionId='action:actions:spawn:0';
function fixture(options:Parameters<typeof teamSpawnFixture>[0]={},limits:Partial<TeamSpawnLimits>={}){
 const f=teamSpawnFixture(options),activation=compileTeamActivationSource({teams:f.teams,definitions:f.definitions,rules:f.rules,mission:f.mission});
 const catalog=compileTeamSpawnCatalog({program:f.compilation.program!,definitions:f.definitions,traversal:f.traversal,activation,actionIds:[actionId]},limits);
 const context=restoreTeamSpawnContext(catalog,[]),world=WorldSimulation.create(f.world.model).save();return{...f,catalog,context,world};
}
for(const profile of ['ra2','yr'] as const)test(`${profile} authentic source-defined unplaced actors spawn atomically with detached monotonic metadata`,()=>{
 const f=fixture({profile,count:2,forceType:'Newcomer',extraInfantryTypes:'1=Newcomer',extraRules:'[Newcomer]\nStrength=150\nSpeed=128\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}'});
 assert.ok(f.world.state.entities.every(e=>e.id<=3));const before=worldHash(f.world);
 const plan=prepareTeamSpawnInsertion(f.catalog,f.context,f.world,actionId);assert.equal(plan.status,'ready');
 assert.deepEqual(plan.record!.actors.map(a=>[a.entityId,a.x,a.y,a.initialHealth]),[[4,3,3,150],[5,3,2,150]]);
 const next=commitTeamSpawnInsertion(f.catalog,f.context,f.world,JSON.parse(JSON.stringify(plan)));
 assert.equal(worldHash(f.world),before);assert.equal(next.world.nextTick,0);assert.deepEqual(next.world.state.entities.slice(0,3),f.world.state.entities);
 assert.equal(next.world.state.entities.length,5);assert.equal(teamSpawnContextData(next.context).actors[1]!.rowId,'spawn:0:1');
 assert.throws(()=>commitTeamSpawnInsertion(f.catalog,next.context,next.world,plan),/pending-insertion-mismatch/);
 const altered=JSON.parse(JSON.stringify(plan));altered.record.actors[0].x=4;assert.throws(()=>commitTeamSpawnInsertion(f.catalog,f.context,f.world,altered),/pending-insertion-mismatch/);
});
test('mid-edge reservation excludes destination, queued unrelated commands and all source state survive insertion',()=>{
 const f=fixture(),sim=WorldSimulation.restore(teamSpawnContextData(f.context).model,f.world);
 sim.admitCommands([{schemaVersion:1,tick:0,playerId:0,sequence:0,kind:'move',payload:{entityId:2,x:3,y:3}}]);sim.step();
 const current=sim.save();assert.ok(current.state.entities[1]!.progress>0);
 sim.admitCommands([{schemaVersion:1,tick:5,playerId:1,sequence:0,kind:'stop',payload:{entityId:3}}]);
 const world=sim.save(),plan=prepareTeamSpawnInsertion(f.catalog,f.context,world,actionId);
 assert.equal(plan.status,'ready');assert.notDeepEqual([plan.record!.actors[0]!.x,plan.record!.actors[0]!.y],[3,3]);
 const next=commitTeamSpawnInsertion(f.catalog,f.context,world,plan);
 assert.deepEqual(next.world.queuedCommands,world.queuedCommands);assert.deepEqual(next.world.state.admissionCursors,world.state.admissionCursors);
 assert.deepEqual(next.world.state.entities.slice(0,3),world.state.entities);assert.equal(next.world.state.planningCursor,world.state.planningCursor);
});
test('blocked, exhausted and pre-existing commands for future IDs publish no actors or consumed IDs',()=>{
 const f=fixture({infantryRows:'0=Commander,Walker,256,3,3,0,Guard,0,None'},{radius:0,candidates:1});
 const before=worldHash(f.world),plan=prepareTeamSpawnInsertion(f.catalog,f.context,f.world,actionId);
 assert.equal(plan.status,'blocked');assert.equal(plan.record,null);assert.throws(()=>commitTeamSpawnInsertion(f.catalog,f.context,f.world,plan),/insertion-blocked/);
 assert.equal(worldHash(f.world),before);assert.equal(teamSpawnContextData(f.context).records.length,0);
 const small=fixture({}, {candidates:1});const limited=prepareTeamSpawnInsertion(small.catalog,small.context,small.world,actionId);
 assert.equal(limited.status,'budget-exhausted');assert.equal(limited.record,null);
 const stale=fixture(),sim=WorldSimulation.restore(teamSpawnContextData(stale.context).model,stale.world);
 sim.admitCommands([{schemaVersion:1,tick:1,playerId:0,sequence:0,kind:'move',payload:{entityId:4,x:3,y:3}}]);
 assert.throws(()=>prepareTeamSpawnInsertion(stale.catalog,stale.context,sim.save(),actionId),/preexisting-command-new-actor/);
});
test('historical actor IDs remain allocated after death and no future record can be inserted into an earlier world',()=>{
 const f=fixture(),p=prepareTeamSpawnInsertion(f.catalog,f.context,f.world,actionId),one=commitTeamSpawnInsertion(f.catalog,f.context,f.world,p);
 const edited=JSON.parse(JSON.stringify(one.world));edited.state.entities[3].health=0;
 const p2=prepareTeamSpawnInsertion(f.catalog,one.context,edited,actionId),two=commitTeamSpawnInsertion(f.catalog,one.context,edited,p2);
 assert.equal(two.record.actors[0]!.entityId,5);assert.equal(two.world.state.entities[3]!.health,0);
 const future=JSON.parse(JSON.stringify(teamSpawnContextData(one.context).records));future[0].bornAtTick=10;
 const context=restoreTeamSpawnContext(f.catalog,future);
 assert.throws(()=>prepareTeamSpawnInsertion(f.catalog,context,one.world,actionId),/future-record/);
});
