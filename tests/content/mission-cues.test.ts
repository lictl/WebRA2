// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic source and adversarial fixtures only.
import test from 'node:test';import assert from 'node:assert/strict';
import {compileMissionCues,isMissionCueCatalog,missionCueInstruction} from '../../packages/content/src/mission-cues.ts';
import {cueInput,cueCsf,hashCueFixture} from './mission-cue.fixture.ts';
test('both profiles bind text and camera/radar cells without playback or whole mission admission',()=>{
 for(const profile of ['ra2','yr'] as const){const input=cueInput(profile),out=compileMissionCues(input);
 assert.ok(isMissionCueCatalog(out));assert.equal(isMissionCueCatalog({...out}),false);
 assert.deepEqual(out.instructions.map(i=>i.status),['resolved-reference','resolved-reference','resolved-reference']);
 assert.equal(out.instructions[0]!.payload!.kind,'text');assert.deepEqual(out.instructions[1]!.payload,{kind:'camera-waypoint',waypoint:0,x:5,y:6,nativeArgument:2});
 assert.deepEqual(out.instructions[2]!.payload,{kind:'radar-waypoint',waypoint:0,x:5,y:6,nativeType:0});
 assert.equal(out.playbackReady,false);assert.equal(out.canStartCampaign,false);assert.equal(out.nativeExecutionVerified,false);
 assert.deepEqual(out.instructions.map(i=>i.ordinal),[0,1,2]);assert.equal(missionCueInstruction(out,out.instructions[0]!.id),out.instructions[0]);
 const old=JSON.stringify(out);input.mission.bytes.fill(0);input.strings!.bytes.fill(0);assert.equal(JSON.stringify(out),old);
 assert.ok(Object.isFrozen(out.instructions[1]!.payload));assert.throws(()=>missionCueInstruction({...out},out.instructions[0]!.id),/catalog-brand/);
 }
});
test('CSF binding applies owned 31-byte native label storage, empty sentinel and duplicate ambiguity',()=>{
 const label='L'.repeat(31),input=cueInput('yr',[`11,4,  ${label}LONG  ,0,0,0,0,A`,'11,4,-1,0,0,0,0,A','11,4,UNKNOWN,0,0,0,0,A','11,4,DUP,0,0,0,0,A','11,4,EMPTY,0,0,0,0,A'],undefined,cueCsf([{label,text:'Bound'},{label:'DUP',text:'One'},{label:'dup',text:'Other'},{label:'EMPTY'}]));
 const out=compileMissionCues(input);assert.equal(out.instructions[0]!.payload!.kind,'text');assert.equal((out.instructions[0]!.payload as {label:string}).label,label);
 assert.deepEqual(out.instructions[1]!.payload,{kind:'empty-text'});assert.deepEqual(out.instructions.slice(2).map(i=>i.reasons),[['strings-missing'],['strings-ambiguous'],['strings-empty']]);
 assert.equal(compileMissionCues({...cueInput(),strings:null}).instructions[0]!.status,'unsupported');
});
test('numeric and named operands remain separate; malformed/reserved/unknown media cannot become executable',()=>{
 const actions=['11,0,MSG,0,0,0,0,A','11,4,-1suffix,0,0,0,0,A','48,0,2,1,0,0,0,A','55,0,17,0,0,0,0,A','48,0,-1,0,0,0,0,A','19,7,SAMPLE,0,0,0,0,A','20,8,THEME,0,0,0,0,A','21,6,VOICE,0,0,0,0,A','10,0,0,0,0,0,0,A'];
 const out=compileMissionCues(cueInput('ra2',actions));assert.equal(out.instructions.length,actions.length);assert.ok(out.instructions.every(i=>i.status==='unsupported'&&i.payload===null&&i.reasons.length));
 assert.deepEqual(out.coverage.filter(r=>r.occurrences).map(r=>r.resolvedReferences),[0,0,0,0,0,0,0]);
});
test('native source waypoint load limits differ and zero/missing/aliased/outside targets fail closed',()=>{
 for(const profile of ['ra2','yr'] as const){
 const out=compileMissionCues(cueInput(profile,['48,0,2,0,0,0,0,CX','55,0,0,0,0,0,0,AA','48,0,2,0,0,0,0,A','48,0,2,0,0,0,0,B','48,0,2,0,0,0,0,AAA'],'101=6005\n26=0\n0=1001\n01=6005'));
 assert.equal(out.instructions[0]!.status,profile==='yr'?'resolved-reference':'unsupported');assert.ok(out.instructions.slice(1).every(i=>i.status==='unsupported'));
 }
});
test('hash/profile/path forgeries, reflection wrappers and source mutation cannot manufacture catalog authority',()=>{
 const good=cueInput();assert.throws(()=>compileMissionCues({...good,profile:'yr'}),/source/);
 assert.throws(()=>compileMissionCues({...good,strings:{...good.strings!,path:'ra2md.csf'}}),/strings-source/);
 assert.throws(()=>compileMissionCues({...good,mission:{...good.mission,path:'https://elsewhere/a.map'}}),/mission-path/);
 assert.throws(()=>compileMissionCues({...good,mission:{...good.mission,source:{...good.mission.source,sha256:'0'.repeat(64)}}}),/source-hash/);
 assert.throws(()=>compileMissionCues({...good,mission:{...good.mission,bytes:new Proxy(good.mission.bytes,{})}}),/bytes/);
 const wrapper=<T extends object>(v:T)=>new Proxy(v,{get(){throw Error('unexpected get');}});
 const safe={...good,mission:wrapper({...good.mission,source:wrapper(good.mission.source)}),strings:wrapper(good.strings!)};
 assert.equal(compileMissionCues(wrapper(safe)).sha256,compileMissionCues(good).sha256);
 assert.throws(()=>compileMissionCues(Object.defineProperty({...good},'profile',{get(){throw Error('executed');}})),/field/);
 assert.equal(compileMissionCues({...good,mission:{...good.mission,source:{...good.mission.source,id:'another-session-handle'}}}).sha256,compileMissionCues(good).sha256);
 assert.equal(isMissionCueCatalog(new Proxy(compileMissionCues(good),{})),false);
});
test('source section ambiguity, aggregate source/text/record budgets and unknown caps reject',()=>{
 const good=cueInput(),bytes=new Uint8Array([...good.mission.bytes,...new TextEncoder().encode('[actions]\n')]);
 assert.throws(()=>compileMissionCues({...good,mission:{...good.mission,bytes,source:{...good.mission.source,sha256:hashCueFixture(bytes)}}}),/source-section/);
 assert.throws(()=>compileMissionCues(good,{instructions:2}),/instruction-limit/);
 assert.throws(()=>compileMissionCues(good,{inputBytes:good.mission.bytes.length+good.strings!.bytes.length-1}),/bytes/);
 assert.throws(()=>compileMissionCues(good,{textPerCue:2}),/text-limit/);assert.throws(()=>compileMissionCues(good,{serializedBytes:1}),/serialized-limit/);
 assert.throws(()=>compileMissionCues(good,{wrong:1} as never),/limits/);
 const accessor=Object.defineProperty({},'instructions',{enumerable:true,get(){throw Error('executed');}});assert.throws(()=>compileMissionCues(good,accessor),/limits/);
});
test('one/two-letter waypoint boundaries use native alphabet arithmetic and profile load membership',()=>{
 const encode=(n:number)=>n<26?String.fromCharCode(65+n):String.fromCharCode(64+Math.floor(n/26))+String.fromCharCode(65+n%26);
 for(const profile of ['ra2','yr'] as const)for(const n of [0,25,26,99,100,101,675,676,701]){
  const value=compileMissionCues(cueInput(profile,[`48,0,0,0,0,0,0,${encode(n).toLowerCase()}`],`${n}=6005`)).instructions[0]!;
  assert.equal(value.status,profile==='ra2'&&n>100?'unsupported':'resolved-reference');if(value.payload&&value.payload.kind==='camera-waypoint')assert.equal(value.payload.waypoint,n);
 }
});
