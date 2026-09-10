// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic fixtures and descriptor/cancellation regressions only.
import test from 'node:test';import assert from 'node:assert/strict';
import { compileMissionAudioPlan,isMissionAudioPlan } from '../../packages/content/src/mission-audio.ts';
import { prepareMissionAudioSamples,isMissionAudioCatalog,copyMissionAudioSample } from '../../packages/content/src/mission-audio-samples.ts';
import { audioFixture,audioFixtureHash,indexFixture,planRoots } from './mission-audio.fixture.ts';
const hash=audioFixtureHash;
test('both profiles bind ordered sound alternatives and side WAVs, verify owned samples without playback',async()=>{
 for(const profile of ['ra2','yr'] as const){const f=audioFixture(profile),p=compileMissionAudioPlan(f.input);
 assert.ok(isMissionAudioPlan(p));assert.equal(isMissionAudioPlan({...p}),false);assert.deepEqual(p.bindings.map(b=>b.status),['planned-reference','planned-reference','planned-reference']);
 assert.deepEqual(p.bindings.map(b=>b.registryOrdinal),[0,0,0]);assert.equal(p.bindings[0]!.samples.length,2);assert.equal(p.bindings[0]!.samples[0],p.bindings[0]!.samples[1]);assert.equal(p.samples.length,3);
 assert.equal(p.bindings[0]!.fields.find(f=>f.key==='Control')!.value,'random loop');assert.equal(p.playbackReady,false);
 const c=await prepareMissionAudioSamples(p,planRoots(p,f.roots));assert.ok(isMissionAudioCatalog(c));assert.equal(c.samples.length,3);assert.ok(c.bindings.every(b=>b.status==='verified-reference'));
 assert.equal(c.wholeBagMembersHashed,false);assert.equal(c.playbackReady,false);assert.equal(c.canStartCampaign,false);const sample=p.bindings[0]!.samples[0]!;
 assert.deepEqual(copyMissionAudioSample(c,sample),new Uint8Array([1,2,3,4]));copyMissionAudioSample(c,sample).fill(0);assert.equal(copyMissionAudioSample(c,sample)[0],1);
 assert.throws(()=>copyMissionAudioSample({...c},sample),/catalog-brand/);assert.ok(Object.isFrozen(c.bindings[0]!.fields));
 }
});
test('side input is only a reference selector, native eight-byte speech stem and unknown/profile boundaries persist',()=>{
 for(const profile of ['ra2','yr'] as const){const f=audioFixture(profile);for(const side of [0,1,2] as const){const p=compileMissionAudioPlan({...f.input,side});assert.equal(p.bindings[2]!.status,side===2&&profile==='ra2'?'unsupported':'planned-reference');if(p.bindings[2]!.status==='planned-reference')assert.equal(p.samples.find(s=>s.id===p.bindings[2]!.samples[0])!.path,['allied.wav','russian.wav','yuri.wav'][side]);}}
 const f=audioFixture(),src=f.source('eva.ini','[DialogList]\n0=Notice\n[Notice]\nAllied=allied00extra\n');const p=compileMissionAudioPlan({...f.input,sources:f.input.sources.map(s=>s.path==='eva.ini'?src:s)});assert.ok(p.selections.some(s=>s.path==='allied00.wav'));assert.equal(p.bindings[2]!.status,'unsupported');
});
test('bad native cue framing, missing and aliased registry allocations cannot gain reference admission',()=>{
 const f=audioFixture('ra2',['19,0,Alert,0,0,0,0,A','19,7,Alert,1,0,0,0,A','21,6,Absent,0,0,0,0,A']);assert.ok(compileMissionAudioPlan(f.input).bindings.every(b=>b.status==='unsupported'));
 for(const text of ['[SoundList]\n0=Alert\n1=alert\n[Alert]\nSounds=click','[SoundList]\n0=Alert\n[alert]\nSounds=click','[SoundList]\n0=Alert\n[Alert]\nSounds=click\nSounds=click']){
 const f=audioFixture(),s=f.source('sound.ini',text);const p=compileMissionAudioPlan({...f.input,sources:f.input.sources.map(x=>x.path==='sound.ini'?s:x)});assert.equal(p.bindings[0]!.status,'unsupported');}
});
test('missing/index duplicates/out-of-bank/unsupported control tokens remain explicit and do not truncate list closure',()=>{
 for(const entries of [[{name:'click',offset:0,size:5,flags:6,chunkSize:0}],[{name:'other',offset:0,size:4,flags:6,chunkSize:0}],[{name:'click',offset:0,size:4,flags:6,chunkSize:0},{name:'CLICK',offset:0,size:4,flags:6,chunkSize:0}]]){
 const f=audioFixture(),s=f.source('audio.idx',indexFixture(entries));const p=compileMissionAudioPlan({...f.input,sources:f.input.sources.map(x=>x.path==='audio.idx'?s:x)});assert.equal(p.bindings[0]!.status,'unsupported');}
 const f=audioFixture(),s=f.source('sound.ini','[SoundList]\n0=Alert\n[Alert]\nSounds=click,click');assert.ok(compileMissionAudioPlan({...f.input,sources:f.input.sources.map(x=>x.path==='sound.ini'?s:x)}).bindings[0]!.reasons.includes('sound-sample-name'));
});
test('source mutation/forged factories/accessors/sparse structures cannot change frozen reference identity',()=>{
 const f=audioFixture(),p=compileMissionAudioPlan(f.input);f.input.sources[0]!.bytes.fill(0);assert.equal(p.bindings[0]!.fields.find(f=>f.key==='Sounds')!.value,'$#click click');assert.throws(()=>compileMissionAudioPlan(f.input),/source-hash/);
 const g=audioFixture();assert.throws(()=>compileMissionAudioPlan({...g.input,cues:{...g.input.cues}}),/cue-brand/);assert.throws(()=>compileMissionAudioPlan({...g.input,sources:new Array(1)}),/array/);
 const wrapped=<T extends object>(v:T)=>new Proxy(v,{get(){throw Error('unexpected getter');}});
 assert.equal(compileMissionAudioPlan(wrapped({...g.input,sources:wrapped(g.input.sources.map(s=>wrapped({...s,root:wrapped(s.root),archivePath:wrapped([])})))})).sha256,compileMissionAudioPlan(g.input).sha256);
 assert.throws(()=>compileMissionAudioPlan({...g.input,sources:[{...g.input.sources[0]!,bytes:new Proxy(g.input.sources[0]!.bytes,{})}]}),/bytes/);
});
test('caps apply before byte/sample allocation and preparation rejects stale roots and unexpected namespaces',async()=>{
 const f=audioFixture();assert.throws(()=>compileMissionAudioPlan(f.input,{candidates:1}),/integer|array|candidate/);assert.throws(()=>compileMissionAudioPlan(f.input,{inputBytes:1}),/input-byte-limit/);assert.throws(()=>compileMissionAudioPlan(f.input,{samples:1}),/sample-limit/);
 assert.throws(()=>compileMissionAudioPlan({...f.input,sources:[...f.input.sources,f.input.sources[0]!]}),/duplicate-candidate/);
 assert.throws(()=>compileMissionAudioPlan({...f.input,sources:[{...f.input.sources[0]!,path:'../sound.ini'}]}),/path/);
 const p=compileMissionAudioPlan(f.input),roots=planRoots(p,f.roots);await assert.rejects(prepareMissionAudioSamples(p,[...roots,...roots.slice(0,1)]),/selected-roots/);
 await assert.rejects(prepareMissionAudioSamples(p,roots.map((r,i)=>i? r:{...r,blob:new Blob([new Uint8Array(r.blob.size)])})),/root-hash-mismatch/);
});
test('durable hashes survive import-handle changes and candidate enumeration order; expected sample hashes cannot be discarded',async()=>{
 const f=audioFixture(),p=compileMissionAudioPlan(f.input),rename=<T extends {root:{sourceId:string}}>(v:T)=>({...v,root:{...v.root,sourceId:v.root.sourceId+'x'}});
 const q=compileMissionAudioPlan({...f.input,sources:f.input.sources.map(rename).reverse(),bags:f.input.bags.map(rename),waveCandidates:f.input.waveCandidates.map(rename).reverse()});assert.equal(q.sha256,p.sha256);
 const a=await prepareMissionAudioSamples(p,planRoots(p,f.roots)),b=await prepareMissionAudioSamples(q,planRoots(q,f.roots.map(r=>({...r,sourceId:r.sourceId+'x'}))));assert.equal(a.sha256,b.sha256);
 const bad=compileMissionAudioPlan({...f.input,waveCandidates:f.input.waveCandidates.map(w=>({...w,sha256:'0'.repeat(64)}))});await assert.rejects(prepareMissionAudioSamples(bad,planRoots(bad,f.roots)),/member-hash-mismatch/);
});
test('cancellation is prompt and callbacks cannot mutate already-owned Blob selection or start playback',async()=>{
 const f=audioFixture(),p=compileMissionAudioPlan(f.input),controller=new AbortController();let calls=0;
 await assert.rejects(prepareMissionAudioSamples(p,planRoots(p,f.roots),{signal:controller.signal,onProgress(){calls++;controller.abort();}}),/abort/i);assert.ok(calls>0);
 const roots=planRoots(p,f.roots);const c=await prepareMissionAudioSamples(p,roots,{onProgress(){roots.splice(0);}});assert.ok(c.rootIdentitiesVerified);
});
test('unreferenced truncating registry names and oversized pre-normalized theme stems cannot alter native allocation or choose a file',()=>{
 const f=audioFixture(),long='A'.repeat(32),src=f.source('sound.ini',`[SoundList]\n0=${long}\n1=Alert\n[Alert]\nSounds=click`);
 assert.ok(compileMissionAudioPlan({...f.input,sources:f.input.sources.map(s=>s.path==='sound.ini'?src:s)}).bindings[0]!.reasons.includes('registry-allocation-boundary'));
 const t=f.source('theme.ini',`[Themes]\n0=March\n[March]\nSound=${'$'.repeat(256)}march`);
 assert.ok(compileMissionAudioPlan({...f.input,sources:f.input.sources.map(s=>s.path==='theme.ini'?t:s)}).bindings[1]!.reasons.includes('theme-stem-buffer-boundary'));
});
test('parent audio mount is required, inactive base audio cannot fill YR gaps, and equal-tier mount conflicts remain unresolved',()=>{
 const f=audioFixture('yr');
 const archive=(path:string,child:typeof f.input.sources[number],mark:number)=>{
  const bytes=new Uint8Array(child.size+32);bytes[0]=mark;bytes.set(child.bytes,32);
  const root={sourceId:`mount-${mark}`,size:bytes.length,sha256:hash(bytes)};
  const mount={path,rootPath:'langmd.mix',archivePath:[],root,absoluteOffset:0,size:bytes.length};
  return {mount,child:{...child,rootPath:'langmd.mix',archivePath:[path],root,absoluteOffset:32}};
 };
 const idx=f.input.sources.find(s=>s.path==='audio.idx')!,md=archive('audiomd.mix',idx,1),base=archive('audio.mix',idx,2);
 const input={...f.input,audioMountCandidates:[md.mount,base.mount],sources:f.input.sources.map(s=>s.path==='audio.idx'?md.child:s)};
 assert.equal(compileMissionAudioPlan(input).bindings[0]!.status,'planned-reference');
 assert.equal(compileMissionAudioPlan({...input,audioMountCandidates:[]}).bindings[0]!.status,'unsupported');
 const missing=compileMissionAudioPlan({...input,sources:f.input.sources.map(s=>s.path==='audio.idx'?base.child:s)});assert.ok(missing.bindings[0]!.reasons.includes('inactive-or-unproven-audio-mount'));
 const rival=archive('audiomd.mix',idx,3);const conflict=compileMissionAudioPlan({...input,audioMountCandidates:[...input.audioMountCandidates,rival.mount]});assert.equal(conflict.bindings[0]!.status,'unsupported');
});
test('indexed source ordinal stays distinct from native sorted lookup index',()=>{
 const f=audioFixture(),idx=f.source('audio.idx',indexFixture([{name:'zebra',offset:0,size:4,flags:6,chunkSize:0},{name:'click',offset:0,size:4,flags:6,chunkSize:0}]));
 const p=compileMissionAudioPlan({...f.input,sources:f.input.sources.map(s=>s.path==='audio.idx'?idx:s)});assert.equal(p.samples[0]!.index!.sourceOrdinal,1);assert.equal(p.samples[0]!.index!.nativeSortedIndex,0);
});
test('native CRC name collisions fail closed even for distinct case-sensitive source spellings',()=>{
 // Original seeded random strings, independently checked with Python zlib CRC32: both 0xce3499ef.
 const a='pjFGjulc',b='juVZTXvb',f=audioFixture('ra2',[`19,7,${a},0,0,0,0,A`]);
 const src=f.source('sound.ini',`[SoundList]\n0=${a}\n[${a}]\nSounds=click\n[${b}]\nSounds=click`);
 const p=compileMissionAudioPlan({...f.input,sources:f.input.sources.map(s=>s.path==='sound.ini'?src:s)});assert.ok(p.bindings[0]!.reasons.includes('missing-or-ambiguous-definition'));
 const g=audioFixture(),s=g.source('sound.ini',`[SoundList]\n0=Alert\n[Alert]\nSounds=click\n${a}=a\n${b}=b`);
 assert.equal(compileMissionAudioPlan({...g.input,sources:g.input.sources.map(v=>v.path==='sound.ini'?s:v)}).bindings[0]!.status,'unsupported');
});
