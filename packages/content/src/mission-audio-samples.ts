// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_AUDIO_PROVENANCE.md.
import { createBrowserVerifiedSession, type BrowserSelectedRoot, type BrowserVerifiedProgress } from '../../vfs/src/browser-verified.ts';
import { isMissionAudioPlan, missionAudioPlanLimits } from './mission-audio.ts';
import { MISSION_AUDIO_POLICY, audioFail, type MissionAudioCatalog, type MissionAudioLocator,
  type MissionAudioPlan, type MissionAudioPreparedSample } from './mission-audio-types.ts';
import { audioDurable, audioFingerprint, audioFreeze, audioHash, audioList, audioRecord } from './mission-audio-utils.ts';

const catalogs=new WeakMap<MissionAudioCatalog,ReadonlyMap<string,Uint8Array>>();
const activePlans=new WeakSet<MissionAudioPlan>();
export function isMissionAudioCatalog(value:unknown):value is MissionAudioCatalog {return !!value&&typeof value==='object'&&catalogs.has(value as MissionAudioCatalog);}
export function copyMissionAudioSample(catalog:MissionAudioCatalog,id:string):Uint8Array {
  const samples=catalogs.get(catalog);if(!samples)audioFail('catalog-brand');const bytes=samples.get(id);if(!bytes)audioFail('sample-id');return bytes.slice();
}
export interface MissionAudioPrepareOptions {
  readonly signal?:AbortSignal; readonly onProgress?:(progress:BrowserVerifiedProgress)=>void;
}
function waveFormat(bytes:Uint8Array):MissionAudioPreparedSample['format'] {
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<12||d.getUint32(0,true)!==0x46464952||d.getUint32(8,true)!==0x45564157||d.getUint32(4,true)!==bytes.length-8)audioFail('wave-framing');
  let at=12,count=0,format:MissionAudioPreparedSample['format']|null=null,data=false;
  while(at<bytes.length) {
    if(++count>65536||bytes.length-at<8)audioFail('wave-chunks');
    const type=d.getUint32(at,true),size=d.getUint32(at+4,true);at+=8;
    if(size>bytes.length-at)audioFail('wave-range');
    if(type===0x20746d66) {
      if(format||size<16)audioFail('wave-format');
      const formatTag=d.getUint16(at,true),channels=d.getUint16(at+2,true),sampleRate=d.getUint32(at+4,true),blockAlign=d.getUint16(at+12,true),bitsPerSample=d.getUint16(at+14,true);
      if(![1,2].includes(channels)||sampleRate<1||sampleRate>192000||blockAlign<1||
        !(formatTag===1&&[8,16].includes(bitsPerSample)&&blockAlign===channels*bitsPerSample/8 || formatTag===17&&bitsPerSample===4&&blockAlign>=4*channels&&size>=20))audioFail('wave-format');
      format={kind:'riff-wave',formatTag,channels,sampleRate,blockAlign,bitsPerSample};
    } else if(type===0x61746164) {if(data||size<1)audioFail('wave-data');data=true;}
    at+=size+(size&1);if(at>bytes.length)audioFail('wave-padding');
  }
  if(!format||!data)audioFail('wave-required-chunk');return format;
}

/** Verifies selected roots and sample ranges on device. Does not decode, play, dispatch, or hash complete BAG members. */
async function prepareOwned(plan:MissionAudioPlan, roots:readonly BrowserSelectedRoot[], options:MissionAudioPrepareOptions):Promise<MissionAudioCatalog> {
  if(!isMissionAudioPlan(plan))audioFail('plan-brand');
  const caps=missionAudioPlanLimits(plan),selected=audioList(roots,128).map(raw=>{
    const r=audioRecord(raw,['sourceId','blob']);if(typeof r.sourceId!=='string')audioFail('source-id');
    return {sourceId:r.sourceId,blob:r.blob as Blob};
  });
  if(!options||![Object.prototype,null].includes(Object.getPrototypeOf(options)))audioFail('options');
  const keys=Reflect.ownKeys(options);if(keys.some(k=>k!=='signal'&&k!=='onProgress'))audioFail('options');
  let signal:AbortSignal|undefined,onProgress:((p:BrowserVerifiedProgress)=>void)|undefined;
  for(const key of keys) {
    const d=Object.getOwnPropertyDescriptor(options,key)!;if(!('value'in d))audioFail('options');
    if(key==='signal'){if(d.value!==undefined&&!(d.value instanceof AbortSignal))audioFail('signal');signal=d.value as AbortSignal|undefined;}
    else{if(d.value!==undefined&&typeof d.value!=='function')audioFail('progress');onProgress=d.value as typeof onProgress;}
  }
  const byId=new Map(plan.candidates.map(c=>[c.id,c]));
  const sourceIds=new Set(plan.selections.filter(s=>s.status==='selected'&&(s.path.endsWith('.ini')||s.path==='audio.idx')).flatMap(s=>s.selected));
  const usedIds=new Set([...sourceIds,...plan.samples.flatMap(s=>s.selected)]);
  const requiredRoots=new Set([...usedIds].map(id=>byId.get(id)!.root.sourceId));
  const suppliedIds=new Set(selected.map(r=>r.sourceId));
  if(suppliedIds.size!==selected.length||suppliedIds.size!==requiredRoots.size||[...requiredRoots].some(id=>!suppliedIds.has(id)))audioFail('selected-roots');
  const attempts=sourceIds.size+plan.samples.reduce((n,s)=>n+s.selected.length,0);
  if(attempts>4096)audioFail('read-attempt-limit');
  const session=createBrowserVerifiedSession(selected,{...(signal?{signal}:{}),...(onProgress?{onProgress}:{}),limits:{maxRoots:128,maxMemberBytes:Math.max(caps.sampleBytes,caps.sourceBytes),
    maxMemberAttempts:4096,maxReadBytes:8*1024**3,chunkBytes:1024**2}});
  const bytesById=new Map<string,Uint8Array>(),samples:MissionAudioPreparedSample[]=[];
  try {
    for(const id of sourceIds) {
      const c=byId.get(id)!;
      await session.read({root:c.root,absoluteOffset:c.absoluteOffset,size:c.size,sha256:c.sha256!});
    }
    for(const sample of plan.samples) {
      let owned:Uint8Array|undefined,sha256:string|undefined;
      const locators:MissionAudioLocator[]=[];
      for(const id of sample.selected) {
        const c=byId.get(id)!,absoluteOffset=c.absoluteOffset+(sample.bankOffset??0);
        const range={root:c.root,absoluteOffset,size:sample.size};
        const bytes=sample.expectedSha256===null?(await session.discover(range)).bytes:await session.read({...range,sha256:sample.expectedSha256});
        const hash=audioHash(bytes);if(sha256!==undefined&&hash!==sha256)audioFail('equivalent-sample-mismatch');
        if(!owned){owned=bytes;sha256=hash;}
        locators.push({path:sample.path,rootPath:c.rootPath,archivePath:c.archivePath,root:c.root,absoluteOffset,size:sample.size});
      }
      if(!owned||!sha256)audioFail('sample-selection');
      const e=sample.index;
      const format=e?{kind:'indexed' as const,formatTag:null,channels:1+(e.flags&1),sampleRate:e.sampleRate,bitsPerSample:(e.flags&8)?null:(e.flags&4)?16:8,blockAlign:e.chunkSize}:waveFormat(owned);
      samples.push({id:sample.id,kind:sample.kind,size:sample.size,sha256,locators,index:sample.index,format});bytesById.set(sample.id,owned);
    }
  } finally {await session.dispose();}
  const data={policy:MISSION_AUDIO_POLICY,planSha256:plan.sha256,profile:plan.profile,side:plan.side,missionSha256:plan.missionSha256,cuesSha256:plan.cuesSha256,
    samples,bindings:plan.bindings.map(b=>({...b,status:b.status==='planned-reference'?'verified-reference' as const:'unsupported' as const})),
    rootIdentitiesVerified:true as const,wholeBagMembersHashed:false as const,nativeExecutionVerified:false as const,playbackReady:false as const,canStartCampaign:false as const};
  const catalog=audioFreeze({...data,sha256:audioFingerprint(audioDurable(data),caps.serializedBytes)});catalogs.set(catalog,bytesById);return catalog;
}
/** One in-flight preparation per genuine plan, reserved before callbacks or input reflection. */
export async function prepareMissionAudioSamples(plan:MissionAudioPlan,roots:readonly BrowserSelectedRoot[],options:MissionAudioPrepareOptions={}):Promise<MissionAudioCatalog> {
  if(!isMissionAudioPlan(plan))audioFail('plan-brand');if(activePlans.has(plan))audioFail('preparation-busy');activePlans.add(plan);
  try{return await prepareOwned(plan,roots,options);}finally{activePlans.delete(plan);}
}
