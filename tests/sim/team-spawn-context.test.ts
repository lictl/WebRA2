// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamSpawnCatalog, restoreTeamSpawnContext, teamSpawnContextData, isTeamSpawnContext } from '../../packages/sim/src/team-spawn-context.ts';
const catalogOf=(f:ReturnType<typeof teamSpawnFixture>)=>compileTeamSpawnCatalog({program:f.compilation.program!,definitions:f.definitions,traversal:f.traversal,
 activation:compileTeamActivationSource({teams:f.teams,definitions:f.definitions,rules:f.rules,mission:f.mission}),actionIds:['action:actions:spawn:0']});
const record=(ordinal=0,tick=0)=>({ordinal,actionId:'action:actions:spawn:0',teamId:'team:squad',instanceId:`spawn-team:${ordinal}`,bornAtTick:tick,
 actors:[{entityId:4+ordinal,typeId:'type:infantry:walker',houseId:'houses:0',playerId:0,initialHealth:100,x:3,y:3}]});
for(const profile of ['ra2','yr'] as const)test(`${profile} catalog and context bind real typed archetypes and monotonic records`,()=>{
 const f=teamSpawnFixture({profile}),c=catalogOf(f),empty=restoreTeamSpawnContext(c,[]);
 assert.equal(teamSpawnContextData(empty).model,f.world.model);assert.equal(teamSpawnContextData(empty).instances.length,0);
 const records=[record()],a=restoreTeamSpawnContext(c,records),b=restoreTeamSpawnContext(c,JSON.parse(JSON.stringify(records)));
 assert.equal(a.sha256,b.sha256);assert.ok(isTeamSpawnContext(a));assert.equal(isTeamSpawnContext({...a}),false);
 const d=teamSpawnContextData(a);assert.equal(d.model.entities.at(-1)!.rowId,'spawn:0:0');assert.equal(d.model.entities.at(-1)!.maximumHealth,100);
 assert.deepEqual(d.model.entities.slice(0,3),f.world.model.entities);assert.equal(d.instances[0]!.bornAtTick,0);
 records[0]!.actors[0]!.x=4;assert.equal(d.actors[0]!.rowId,'spawn:0:0');assert.equal(d.records[0]!.actors[0]!.x,3);
 assert.equal(teamSpawnContextData(restoreTeamSpawnContext(c,[record(),record(1,10)])).actors[1]!.entityId,5);
});
test('context rejects modified source facts, forged catalogs, nonmonotonic IDs/ticks and placement outside policy',()=>{
 const c=catalogOf(teamSpawnFixture());
 for(const [key,value] of Object.entries({entityId:8,typeId:'type:infantry:other',houseId:'house:rival',playerId:1,initialHealth:90,x:511})){
  const r=record();Object.assign(r.actors[0]!,{[key]:value});assert.throws(()=>restoreTeamSpawnContext(c,[r]));
 }
 assert.throws(()=>restoreTeamSpawnContext(c,[record(0,5),record(1,4)]));
 assert.throws(()=>restoreTeamSpawnContext({...c},[]),/catalog-brand/);
 const r=record();r.instanceId='map:pretend';assert.throws(()=>restoreTeamSpawnContext(c,[r]),/record-source/);
});
test('catalog rejects incomplete programs, stale/generic source metadata and bounded history before expansion',()=>{
 const f=teamSpawnFixture(),activation=compileTeamActivationSource({teams:f.teams,definitions:f.definitions,rules:f.rules,mission:f.mission});
 const input={program:f.compilation.program!,definitions:f.definitions,traversal:f.traversal,activation,actionIds:['action:actions:spawn:0']};
 assert.throws(()=>compileTeamSpawnCatalog({...input,activation:{...activation}}),/source-brand/);
 assert.throws(()=>compileTeamSpawnCatalog({...input,program:{...f.compilation.program!}}),/program-brand/);
 assert.throws(()=>compileTeamSpawnCatalog(input,{actorsPerRecord:0}),/member-limit/);
 const c=compileTeamSpawnCatalog(input,{historicalActors:1});assert.throws(()=>restoreTeamSpawnContext(c,[record(),record(1,1)]),/record-actors/);
 const bad=teamSpawnFixture({extraTeam:'Waypoint=A\nVeteranLevel=2'});assert.throws(()=>catalogOf(bad),/reinforcement-veterancy/);
});
