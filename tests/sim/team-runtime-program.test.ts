// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTeamProgram, isTeamProgram, TEAM_RUNTIME_LIMITS } from '../../packages/sim/src/team-runtime-program.ts';
import { teamFixture } from './team-runtime-fixture.ts';

test('genuine source/world joins compile exact waypoint and compacted jump indices for both profiles',()=>{
  for(const profile of ['ra2','yr'] as const){const f=teamFixture({profile,script:'2=3,0\n9=6,1'}),p=f.compilation.program;
    assert.ok(p);assert.equal(isTeamProgram(p),true);assert.equal(isTeamProgram({...p}),false);
    assert.deepEqual(p.templates[0]!.steps,[{opcode:3,sourceSlot:2,waypoint:0,rowId:'waypoints:0',x:3,y:3},{opcode:6,sourceSlot:9,target:0}]);
    assert.equal(p.modelSha256,f.world.model.sha256);assert.equal(p.entitiesSha256,f.teams.entityFingerprint);
    assert.ok(Object.isFrozen(p.templates[0]!.steps));assert.equal(p.canStartCampaign,false);
  }
});
test('a selected unsupported instruction or team behavior prevents partial script execution',()=>{
  for(const [options,code] of [[{script:'0=3,0\n1=5,0'},'guard-acquisition'],[{script:'0=0,1'},'unsupported-operand:0'],
    [{extraTeam:'Aggressive=yes'},'team-behavior:aggressive'],[{script:'0=3,1'},'waypoint-source:0']] as const){
    const f=teamFixture(options);assert.equal(f.compilation.program,null);assert.ok(f.compilation.diagnostics.some(d=>d.code===code));
  }
});
test('byte, factory and source mismatches fail before program publication',()=>{
  const a=teamFixture(),b=teamFixture({extraRules:'[Other]\nValue=2'}),input={teams:a.teams,world:a.world,mission:a.mission,teamIds:a.teamIds};
  assert.throws(()=>compileTeamProgram({...input,teams:{...a.teams}}),/source-brand/);
  assert.throws(()=>compileTeamProgram({...input,world:{...a.world}}),/source-brand/);
  assert.throws(()=>compileTeamProgram({...input,world:b.world}),/source-identity/);
  const bytes=a.mission.bytes.slice();bytes[0]=bytes[0]!^1;assert.throws(()=>compileTeamProgram({...input,mission:{source:a.mission.source,bytes}}),/mission-hash/);
  assert.throws(()=>compileTeamProgram({...input,teamIds:['team:squad','team:squad']}),/team-selection/);
  let called=false;const hostile=Object.defineProperty({...input},'teams',{enumerable:true,get(){called=true;throw Error('getter');}});
  assert.throws(()=>compileTeamProgram(hostile));assert.equal(called,false);
});
test('lower limits and hostile list properties fail before expansions; source fingerprints include unused changes',()=>{
  const a=teamFixture(),input={teams:a.teams,world:a.world,mission:a.mission,teamIds:a.teamIds};
  for(const key of ['teams','members','steps','work','missionBytes'] as const){assert.throws(()=>compileTeamProgram(input,{[key]:0}));assert.throws(()=>compileTeamProgram(input,{[key]:TEAM_RUNTIME_LIMITS[key]+1}));}
  assert.throws(()=>compileTeamProgram({...input,teamIds:Object.assign(['team:squad'],{constructor:'hostile'})}));
  assert.notEqual(a.compilation.program!.sha256,teamFixture({extraAI:'[Unused]\nKey=Value'}).compilation.program!.sha256);
});

test('repeated exact waypoint headers are not silently merged into native lookup proof',()=>{
 for(const extraMap of ['[Waypoints]\n1=3004','[Waypoints]']){
  assert.throws(()=>teamFixture({extraMap}),/team-duplicate-section/);
 }
});
