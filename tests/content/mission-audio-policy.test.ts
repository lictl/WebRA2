// SPDX-License-Identifier: GPL-3.0-or-later
// Original source fixtures; no installation data or playback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { audioFixture, planRoots } from './mission-audio.fixture.ts';
import { compileMissionAudioPlan } from '../../packages/content/src/mission-audio.ts';
import { prepareMissionAudioSamples } from '../../packages/content/src/mission-audio-samples.ts';
import { compileMissionAudioPolicy, isMissionAudioPolicyCatalog, missionAudioPolicyContext,
  MISSION_AUDIO_SOURCE_LIMITS, type MissionAudioPolicyCatalog } from '../../packages/content/src/mission-audio-policy.ts';
async function fixture(profile:'ra2'|'yr'='ra2', sound?:string, eva?:string){
  const f=audioFixture(profile),soundPath=profile==='ra2'?'sound.ini':'soundmd.ini',evaPath=profile==='ra2'?'eva.ini':'evamd.ini';
  const sources=f.input.sources.map(s=>s.path===soundPath&&sound!==undefined?f.source(soundPath,sound):s.path===evaPath&&eva!==undefined?f.source(evaPath,eva):s);
  const plan=compileMissionAudioPlan({...f.input,sources});
  const audio=await prepareMissionAudioSamples(plan,planRoots(plan,f.roots));
  const input={cues:f.input.cues,audio,initialization:'fresh-process-audio-load' as const};
  return {f,input,result:compileMissionAudioPolicy(input)};
}
const binding=(r:MissionAudioPolicyCatalog,n:19|20|21)=>r.bindings.find(b=>b.opcode===n)!;
const value=(r:MissionAudioPolicyCatalog,n:19|21,key:string)=>binding(r,n).values.find(v=>v.key===key)!;

test('both profiles preserve fresh Defaults history, exact caller overrides and ordered sample partitions',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const {result:r,input}=await fixture(profile,'[Defaults]\nVolume=90\nPriority=CRITICAL\nType=global\n[SoundList]\n0=Alert\n[Alert]\nSounds=click click click\nControl=all random attack decay loop\nLoop=3\nVolume=50');
  assert.equal(binding(r,19).status,'supported-source');assert.deepEqual(binding(r,19).caller,{type:'global-sound',panning:8192,volume:1,controller:null});
  assert.equal(value(r,19,'Volume').value,50);assert.deepEqual(value(r,19,'Volume').history.map(h=>h.value),[80,90,50]);
  assert.deepEqual(value(r,19,'Priority').history.map(h=>h.value),[2,4,2]);assert.equal(value(r,19,'Type').value,48);
  const p=binding(r,19).selection;assert(p?.kind==='sound-sample-partitions');assert.equal(p.bodyRule,'all-body-random-order');
  assert.deepEqual([p.attack.length,p.body.length,p.decay.length],[1,1,1]);assert.equal(p.attack[0],p.body[0]);assert.equal(p.loopRule,'finite');assert.equal(p.loopCount,3);
  assert(binding(r,19).requiredState.includes('global-audio-rng-sample-selection'));assert(binding(r,19).requiredState.includes('active-instance-limits-and-interrupts'));
  assert.equal(r.runtimeAuthority,false);assert.equal(r.playbackReady,false);assert.equal(r.canStartCampaign,false);assert(Object.isFrozen(p.body));
  assert.equal(missionAudioPolicyContext(r).audio,input.audio);assert.equal(missionAudioPolicyContext(r).cues,input.cues);
 }
});

test('fresh image and fixed property defaults remain distinct from native field consumption',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const {result:r}=await fixture(profile,'[SoundList]\n0=Alert\n[Alert]\nSounds=click\nVShift=200\nVolume=50%\nDelay=10\nFShift=-4 7');
  assert.equal(value(r,19,'Volume').value,0.5);assert.equal(value(r,19,'MinVolume').value,20);
  assert.equal(value(r,19,'Limit').value,5);assert.equal(value(r,19,'Range').value,10);assert.equal(value(r,19,'VShift').value,200);
  assert.deepEqual(value(r,19,'Delay').value,[10,10]);assert.deepEqual(value(r,19,'FShift').value,[-4,7]);
  const p=binding(r,19).selection;assert(p?.kind==='sound-sample-partitions');assert.equal(p.bodyRule,'first-body');assert.equal(p.loopRule,'none');
  assert(binding(r,19).requiredState.includes('global-audio-rng-frequency-volume-and-delay'));
 }
});

test('mission EVA type2 overrides stored Type while exact priority, side and ignored Text remain retained',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const {result:r}=await fixture(profile,undefined,'[Defaults]\nVolume=99\n[DialogList]\n0=Notice\n[Notice]\nAllied=allied\nRussian=russian\nYuri=yuri\nText=Original explanation\nType=QUEUE\nPriority=CRITICAL\nVolume=0.125');
  const b=binding(r,21);assert.equal(b.status,'supported-source');assert.deepEqual(b.caller,{type:'eva',typeOverride:2,priorityOverride:-1});
  assert.equal(value(r,21,'Type').value,1);assert.equal(value(r,21,'Priority').value,3);assert.equal(value(r,21,'Volume').value,0.125);
  assert.deepEqual(value(r,21,'Volume').history.map(h=>h.value),[1,0.125]);assert.equal(b.retainedDefaults[0]!.value,'99');
  assert(b.retainedFields.some(f=>f.key==='Text'));assert(b.selection?.kind==='eva-request');assert.equal(b.selection.callerType,2);assert.equal(b.selection.side,0);
  assert(b.requiredState.includes('active-eva-identity'));assert(b.requiredState.includes('eva-queues-and-priority-arbitration'));
  assert(b.requiredState.includes('stored-eva-volume-consumption-unproven'));
 }
});

test('unknown controls, partition failures and malformed numeric ranges remain explicit without choosing samples',async()=>{
 for(const profile of ['ra2','yr'] as const)for(const suffix of ['Control=mystery','Priority=urgent','Attack=4\nControl=attack','Delay=10 5','FShift=1 2 3','Loop=-1','Unknown=1','Type=local,global']){
  const {result:r}=await fixture(profile,`[SoundList]\n0=Alert\n[Alert]\nSounds=click click\n${suffix}`);
  assert.equal(binding(r,19).status,'unsupported',suffix);assert(r.diagnostics.some(d=>d.instructionId===binding(r,19).instructionId));
  assert.equal(binding(r,19).reference.samples.length,2);assert.equal(r.playbackReady,false);
 }
 const {result:r}=await fixture('ra2','[Defaults]\nControl=unknown\n[SoundList]\n0=Alert\n[Alert]\nSounds=click\nControl=random');
 assert.equal(value(r,19,'Control').status,'unsupported');assert.equal(value(r,19,'Control').value,2);
});

test('type token order clears only exclusive masks and sample alternatives are never collapsed',async()=>{
 const {result:r}=await fixture('yr','[SoundList]\n0=Alert\n[Alert]\nSounds=click click\nType=global local screen shroud unshroud\nControl=random');
 assert.equal(value(r,19,'Type').value,16|32|1024);const p=binding(r,19).selection;assert(p?.kind==='sound-sample-partitions');
 assert.deepEqual(p.body,binding(r,19).reference.samples);assert.equal(p.body.length,2);assert.equal(p.bodyRule,'random-body');
});

test('genuine cue/audio identity, descriptor ownership and durable output resist forged inputs',async()=>{
 const {input,result}=await fixture();assert(isMissionAudioPolicyCatalog(result));assert(!isMissionAudioPolicyCatalog({...result}));
 assert.throws(()=>missionAudioPolicyContext({...result}),/factory/);
 assert.throws(()=>compileMissionAudioPolicy({...input,audio:{...input.audio}}),/factory/);
 assert.throws(()=>compileMissionAudioPolicy({...input,cues:{...input.cues}}),/factory/);
 const other=audioFixture('yr');assert.throws(()=>compileMissionAudioPolicy({...input,cues:other.input.cues}),/source-identity/);
 assert.throws(()=>compileMissionAudioPolicy({...input,initialization:'restored' as never}),/initialization/);
 let reads=0;const proxy=new Proxy(input,{get(){reads++;throw Error('unexpected access');}});
 assert.equal(compileMissionAudioPolicy(proxy).sha256,result.sha256);assert.equal(reads,0);
 const getter={...input};Object.defineProperty(getter,'audio',{enumerable:true,get(){reads++;return input.audio;}});
 assert.throws(()=>compileMissionAudioPolicy(getter));assert.equal(reads,0);
 const before=JSON.stringify(input.audio);compileMissionAudioPolicy(input);assert.equal(JSON.stringify(input.audio),before);
});

test('aggregate limits reject before bounded expansion and successful retries keep source identity',async()=>{
 const {input,result}=await fixture();
 for(const key of Object.keys(MISSION_AUDIO_SOURCE_LIMITS) as (keyof typeof MISSION_AUDIO_SOURCE_LIMITS)[]){
  assert.throws(()=>compileMissionAudioPolicy(input,{[key]:0}),key);
  assert.throws(()=>compileMissionAudioPolicy(input,{[key]:MISSION_AUDIO_SOURCE_LIMITS[key]+1}),/limits/);
 }
 assert.throws(()=>compileMissionAudioPolicy(input,{fields:input.audio.bindings[0]!.fields.length+input.audio.bindings[0]!.defaults.length}),/field-limit/);
 assert.equal(compileMissionAudioPolicy(input).sha256,result.sha256);
 let reads=0;const limits=new Proxy({work:0},{get(){reads++;throw Error('unexpected access');}});
 assert.throws(()=>compileMissionAudioPolicy(input,limits),/work-limit/);assert.equal(reads,0);
});

test('every unsupported reference and theme occurrence survives; no source result authorizes invocation',async()=>{
 const {result:r}=await fixture('ra2','[SoundList]\n0=Alert\n[Alert]\nSounds=missing');
 const b=binding(r,19);assert.equal(b.status,'unsupported');assert(b.reference.reasons.every(s=>b.reasons.includes(s)));assert(b.reasons.includes('unverified-audio-reference'));
 assert.equal(binding(r,20).status,'unsupported');assert(binding(r,20).reasons.includes('theme-playback-policy-out-of-scope'));
 assert.deepEqual(r.bindings.map(b=>b.opcode),[19,20,21]);assert.equal(r.runtimeAuthority,false);
});
