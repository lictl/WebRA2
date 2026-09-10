// SPDX-License-Identifier: GPL-3.0-or-later
// Original cross-adapter source gates; metadata and complete-program policy remain independent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { recruitmentFixture } from './team-recruitment-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileInitialWaypointSource, resolveInitialWaypoint } from '../../packages/content/src/initial-waypoints.ts';
import { compileTeamSpawnCatalog } from '../../packages/sim/src/team-spawn-context.ts';
import { restoreTeamRecruitmentContext } from '../../packages/sim/src/team-recruitment-context.ts';
import { prepareTeamRecruitmentSelection } from '../../packages/sim/src/team-recruitment-selection.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
const alpha=(n:number)=>n<26?String.fromCharCode(65+n):String.fromCharCode(64+Math.floor(n/26))+String.fromCharCode(65+n%26);
const activation=(f:ReturnType<typeof teamSpawnFixture>)=>compileTeamActivationSource({teams:f.teams,definitions:f.definitions,rules:f.rules,mission:f.mission});
test('script3 complete-program admission keeps broad operand typing but excludes unloaded RA2 indices',()=>{
 for(const profile of ['ra2','yr'] as const)for(const n of [0,100,101,701]) {
  const f=teamSpawnFixture({profile,script:`0=3,${n}`,waypoint:`${n}=3003`,extraTeam:`Waypoint=${alpha(n)}`});
  assert.equal(f.teams.scripts[0]!.steps[0]!.status,'typed');assert.equal(f.teams.scripts[0]!.steps[0]!.argument,n);
  assert.equal(!!f.compilation.program,profile==='yr'||n<=100);
  if(f.compilation.program){const c=compileInitialWaypointSource({profile,...f.mission});assert.equal(f.compilation.program.initialWaypointsSha256,c.sha256);}
 }
 const hidden=teamSpawnFixture({script:'0=11,0\n1=3,101',waypoint:'101=3003'});assert.equal(hidden.compilation.program,null);
 assert(hidden.compilation.diagnostics.some(d=>d.code==='waypoint:index-not-initially-loaded:1'));
 for(const waypoint of ['00=3003','0=0'])assert.equal(teamSpawnFixture({waypoint}).compilation.program,null);
 assert.throws(()=>teamSpawnFixture({waypoint:'0=3003\n00=3003'}),/aliased-row-id/);
 assert.throws(()=>teamSpawnFixture({waypoint:'0=3003\n[Waypoints]\n1=3003'}),/duplicate-section/);
});
test('action7 team and action80 explicit indices gate before any spawn catalog can consume coordinates',()=>{
 for(const profile of ['ra2','yr'] as const)for(const n of [0,100,101,701]) {
  const a=alpha(n),f=teamSpawnFixture({profile,script:'0=50,1',extraTeam:`Waypoint=${a}`,waypoint:`${n}=3003`,extraMap:`[Actions]\nSpawn=2,7,1,Squad,0,0,0,0,A,80,1,Squad,0,0,0,0,${a}`});
  const source=activation(f),supported=profile==='yr'||n<=100;assert(f.compilation.program);
  assert(source.plans.every(p=>(p.status==='supported-source')===supported));assert.equal(source.initialWaypointsSha256,f.compilation.program.initialWaypointsSha256);
  const input={program:f.compilation.program,definitions:f.definitions,traversal:f.traversal,activation:source,actionIds:source.plans.map(p=>p.id)};
  if(supported)assert(compileTeamSpawnCatalog(input));else assert.throws(()=>compileTeamSpawnCatalog(input),/unsupported-action/);
 }
 for(const waypoint of ['0=0','00=3003']){
  const f=teamSpawnFixture({script:'0=50,1',waypoint}),source=activation(f);assert.equal(source.plans[0]!.status,'unsupported');assert(f.compilation.program);
 }
});
test('Flash-only CreateTeam still authenticates its recruitment anchor and never substitutes a runtime waypoint',()=>{
 for(const profile of ['ra2','yr'] as const)for(const n of [0,100,101,701]) {
  const f=recruitmentFixture({profile,script:'0=50,1',extraTeam:`Waypoint=${alpha(n)}`,waypoint:`${n}=3003`}),supported=profile==='yr'||n<=100;
  assert(f.program);assert.equal(f.catalog.initialWaypointsSha256,f.program.initialWaypointsSha256);
  const context=restoreTeamRecruitmentContext(f.catalog,[]),save=WorldSimulation.create(f.world.model).save(),before=worldHash(save);
  const selection=prepareTeamRecruitmentSelection(f.catalog,context,save,f.input.actionIds[0]!);
  assert.equal(selection.status,supported?'selected':'unsupported-source');assert.equal(worldHash(save),before);
  if(!supported){assert.equal(f.catalog.templates[0]!.anchor,null);assert.equal(selection.actorIds.length,0);}
 }
 for(const waypoint of ['0=0','00=3003','1=3003']){
  const f=recruitmentFixture({script:'0=50,1',waypoint});assert.equal(f.catalog.templates[0]!.status,'unsupported');assert.equal(f.catalog.templates[0]!.anchor,null);
 }
});
test('new source policy is included in each derived identity rather than accepting legacy serialized authority',()=>{
 const f=recruitmentFixture({script:'0=50,1'}),c=compileInitialWaypointSource({profile:'ra2',...f.mission});assert.equal(resolveInitialWaypoint(c,0).status,'supported-source');
 for(const output of [f.program,f.activation,f.catalog]){const {sha256,initialWaypointsSha256,...legacy}=output;assert.equal(initialWaypointsSha256,c.sha256);assert.notEqual(worldHash(legacy),sha256);}
});
