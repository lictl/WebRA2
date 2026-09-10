// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from '../sim/team-spawn-fixture.ts';
import { compileTeamActivationSource, isTeamActivationSource } from '../../packages/content/src/team-activation.ts';
const source = (f: ReturnType<typeof teamSpawnFixture>) => compileTeamActivationSource({teams:f.teams,definitions:f.definitions,rules:f.rules,mission:f.mission});
for (const profile of ['ra2','yr'] as const) test(`${profile} action branches and source provenance`,()=>{
  const f=teamSpawnFixture({profile,extraMap:'[Actions]\nSet=3,4,1,Squad,0,0,0,0,A,7,1,Squad,0,0,0,0,A,80,1,Squad,0,0,0,0,A'}), a=source(f);
  assert.ok(isTeamActivationSource(a));assert.equal(isTeamActivationSource({...a}),false);
  assert.deepEqual(a.plans.map(p=>[p.opcode,p.branch,p.status,p.waypoint.kind]),[
    [4,'create-team','unsupported','none'],[7,'reinforce','supported-source','team'],[80,'reinforce','supported-source','action']]);
  assert.ok(a.plans[0]!.reasons.includes('native-recruitment-unimplemented'));
  assert.ok(a.plans.every(p=>p.origin.sourceSha256===f.mission.source.sha256&&p.rawTokens.length===8));
});
test('short physical indices, missing implicit definitions, wrong mode and malformed waypoint stay gated',()=>{
 const f=teamSpawnFixture({extraMap:'[Actions]\nSet=5,80,1,0,0,0,0,0,A,80,1,Missing,0,0,0,0,A,80,2,Squad,0,0,0,0,A,80,5,Squad,0,0,0,0,A,80,1,Squad,0,0,0,0,AAA'});
 const a=source(f);assert.ok(a.plans.every(p=>p.status==='unsupported'));
 assert.equal(a.plans[0]!.teamOperand.candidateIndex,0);assert.equal(a.plans[0]!.teamId,null);
 assert.ok(a.plans[1]!.reasons.includes('implicit-team-allocation'));
});
test('owns and verifies bytes, source identities and consumed exact section spellings',()=>{
 const f=teamSpawnFixture();const a=source(f);f.mission.bytes[0]=f.mission.bytes[0]!^1;assert.ok(Object.isFrozen(a.plans[0]!.rawTokens));
 assert.throws(()=>source(f),/mission-hash/);
 const lower=source(teamSpawnFixture({extraMap:'[actions]\nSpawn=1,80,1,Squad,0,0,0,0,A'}));
 assert.ok(lower.plans[0]!.reasons.includes('exact-actions-section'));
 assert.throws(()=>source(teamSpawnFixture({extraMap:'[Actions]\nOne=1,80,1,Squad,0,0,0,0,A\n[Actions]\nTwo=1,80,1,Squad,0,0,0,0,A'})),/duplicate-actions-section/);
});
test('bounded source compilation and accessor inputs fail without invoking getters',()=>{
 const f=teamSpawnFixture(),input={teams:f.teams,definitions:f.definitions,rules:f.rules,mission:f.mission};
 assert.throws(()=>compileTeamActivationSource(input,{missionBytes:1}),/mission-bytes/);
 assert.throws(()=>compileTeamActivationSource(input,{work:0}),/work-limit/);
 let called=0;const hostile={...input};Object.defineProperty(hostile,'teams',{get(){called++;return f.teams},enumerable:true});
 assert.throws(()=>compileTeamActivationSource(hostile),/input/);assert.equal(called,0);
});

test('literal team and waypoint whitespace is preserved rather than silently normalized into a native match',()=>{
 const a=source(teamSpawnFixture({extraMap:'[Actions]\nOne=1,80,1, Squad,0,0,0,0,A\nTwo=1,80,1,Squad,0,0,0,0, A'}));
 assert.equal(a.plans[0]!.teamOperand.raw,' Squad');assert.equal(a.plans[0]!.teamId,null);
 assert.ok(a.plans.every(p=>p.status==='unsupported'));
});
