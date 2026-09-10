// SPDX-License-Identifier: GPL-3.0-or-later
// Original caller-driven cue ordering fixtures only.
import test from 'node:test';import assert from 'node:assert/strict';
import {compileMissionCues} from '../../packages/content/src/mission-cues.ts';
import {appendMissionCues,createMissionCueState,restoreMissionCueState} from '../../packages/sim/src/mission-cues.ts';
import {cueInput,cueCsf} from '../content/mission-cue.fixture.ts';
test('ordered invocations retain duplicates and round-trip without asserting trigger dispatch or playback',()=>{
 for(const profile of ['ra2','yr'] as const){const catalog=compileMissionCues(cueInput(profile)),state=createMissionCueState(catalog);
 const ids=catalog.instructions.map(i=>i.id),input={tick:3,invocations:[2,0,0,1].map(i=>({instructionId:ids[i]!,instanceId:'caller-instance'}))};
 const next=appendMissionCues(catalog,state,input);assert.deepEqual(next.events.map(e=>e.instructionId),input.invocations.map(v=>v.instructionId));assert.deepEqual(next.events.map(e=>e.sequence),[0,1,2,3]);
 assert.ok(next.events.every(e=>!e.playbackAuthorized));assert.equal(next.sourceDispatchVerified,false);assert.equal(state.nextSequence,0);
 const restored=restoreMissionCueState(catalog,JSON.parse(JSON.stringify(next.state)));const command={...input,tick:4};
 assert.deepEqual(appendMissionCues(catalog,restored,command),appendMissionCues(catalog,next.state,command));
 }
});
test('a late unsupported invocation, decreasing tick or oversized/forged save leaves the old state intact',()=>{
 const catalog=compileMissionCues(cueInput()),state=createMissionCueState(catalog),good={instructionId:catalog.instructions[0]!.id,instanceId:'caller'};
 assert.throws(()=>appendMissionCues(catalog,state,{tick:2,invocations:[good,{...good,instructionId:'unknown'}]}),/unsupported-invocation/);assert.equal(state.nextSequence,0);
 const next=appendMissionCues(catalog,state,{tick:2,invocations:[good]}).state;
 assert.throws(()=>appendMissionCues(catalog,next,{tick:1,invocations:[]}),/integer/);assert.throws(()=>appendMissionCues(catalog,{...next},{tick:2,invocations:[]}),/cursor-brand/);
 for(const changed of [{nextSequence:1_000_001},{tick:NaN},{catalogSha256:'0'.repeat(64)},{policy:'old'},{extra:true}])assert.throws(()=>restoreMissionCueState(catalog,{...next,...changed}));
 const end=restoreMissionCueState(catalog,{...next,nextSequence:1_000_000});assert.throws(()=>appendMissionCues(catalog,end,{tick:2,invocations:[good]}),/cursor-total/);
});
test('descriptor snapshots reject sparse/oversized arrays and avoid Proxy property getters',()=>{
 const catalog=compileMissionCues(cueInput()),state=createMissionCueState(catalog),good={instructionId:catalog.instructions[0]!.id,instanceId:'caller'};
 const proxy=<T extends object>(v:T)=>new Proxy(v,{get(){throw Error('unexpected get');}});
 const result=appendMissionCues(catalog,state,proxy({tick:1,invocations:proxy([proxy(good)])}));assert.equal(result.events.length,1);
 assert.deepEqual(restoreMissionCueState(catalog,proxy({...result.state})),result.state);
 const sparse=new Array(1);assert.throws(()=>appendMissionCues(catalog,state,{tick:1,invocations:sparse}),/array/);
 assert.throws(()=>appendMissionCues(catalog,state,{tick:1,invocations:new Proxy(Array(1025).fill(good),{get(t,k){return k==='length'?0:Reflect.get(t,k);}})}),/integer/);
 const withExtra=Object.assign([good],{payload:'arbitrary'});assert.throws(()=>appendMissionCues(catalog,state,{tick:1,invocations:withExtra}),/array/);
});
test('repeated localized payload budgets reject the whole batch before publication',()=>{
 const catalog=compileMissionCues(cueInput('ra2',['11,4,MSG,0,0,0,0,A'],undefined,cueCsf([{label:'MSG',text:'x'.repeat(4096)}]))),state=createMissionCueState(catalog);
 const invocation={instructionId:catalog.instructions[0]!.id,instanceId:'original'};
 assert.equal(appendMissionCues(catalog,state,{tick:1,invocations:Array(256).fill(invocation)}).events.length,256);
 assert.throws(()=>appendMissionCues(catalog,state,{tick:1,invocations:Array(257).fill(invocation)}),/cursor-payload-limit/);assert.equal(state.nextSequence,0);
});
