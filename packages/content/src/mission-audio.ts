// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_AUDIO_PROVENANCE.md.
import { isMissionCueCatalog } from './mission-cues.ts';
import { readDependencyAudioIndex } from './dependency-audio-index.ts';
import { MISSION_AUDIO_POLICY, audioFail, type MissionAudioBinding, type MissionAudioCandidate,
  type MissionAudioLimits, type MissionAudioPlan, type MissionAudioPlanInput, type MissionAudioSample,
  type MissionAudioSelection } from './mission-audio-types.ts';
import { LOCATOR_KEYS, audioBytes, audioCandidateId, audioCaps, audioDurable, audioFingerprint,
  audioFold, audioFreeze, audioHash, audioIni, audioInteger, audioList, audioLocator, audioRecord,
  audioSelect, audioSha, audioTrim, type AudioIniSection } from './mission-audio-utils.ts';

interface PlanState { readonly caps: MissionAudioLimits }
const plans = new WeakMap<MissionAudioPlan, PlanState>();
export function isMissionAudioPlan(value: unknown): value is MissionAudioPlan { return !!value && typeof value === 'object' && plans.has(value as MissionAudioPlan); }
export function missionAudioPlanLimits(plan: MissionAudioPlan): MissionAudioLimits {
  const state=plans.get(plan); if(!state) audioFail('plan-brand'); return state.caps;
}
const closures = {99:'sound-definition-sample-closure-unresolved',19:'sound-definition-sample-closure-unresolved',20:'theme-definition-resource-closure-unresolved',21:'speech-definition-side-resource-closure-unresolved'} as const;
const pending = {99:['native-control-random-loop-selection','native-positional-and-object-controller-lifetime','native-spatial-volume-pan-and-visibility'],19:['native-control-random-loop-selection','native-sound-mixing-volume-timing'],
  20:['native-theme-availability-queue-repeat-timing'],21:['native-eva-queue-priority-type-volume-timing']} as const;

/** Fresh named registries from explicit import candidates; does not authenticate invocation or start playback. */
export function compileMissionAudioPlan(input: MissionAudioPlanInput, options: Partial<MissionAudioLimits> = {}): MissionAudioPlan {
  const cap=audioCaps(options),r=audioRecord(input,['cues','side','audioMountCandidates','sources','bags','waveCandidates']);
  if(!isMissionCueCatalog(r.cues)) audioFail('cue-brand');
  const cues=r.cues,profile=cues.profile,side=audioInteger(r.side,2) as 0|1|2;
  const mountInputs=audioList(r.audioMountCandidates,cap.candidates);
  const sourceInputs=audioList(r.sources,cap.candidates),bagInputs=audioList(r.bags,cap.candidates),waveInputs=audioList(r.waveCandidates,cap.candidates);
  if(mountInputs.length+sourceInputs.length+bagInputs.length+waveInputs.length>cap.candidates) audioFail('candidate-limit');
  const candidates:MissionAudioCandidate[]=[],sources=new Map<string,Uint8Array>(),ids=new Set<string>(),roots=new Map<string,string>();
  let inputBytes=0;
  const paths=profile==='ra2'?['sound.ini','eva.ini','theme.ini']:['soundmd.ini','evamd.ini','thememd.ini'];
  const add=(raw:unknown,kind:'source'|'bag'|'wave'|'mount')=>{
    const v=audioRecord(raw,[...LOCATOR_KEYS,...(kind==='source'?['sha256','bytes']:kind==='wave'?['sha256']:[])]);
    const loc=audioLocator(v);
    if(kind==='source' && ![...paths,'audio.idx'].includes(loc.path) || kind==='bag' && loc.path!=='audio.bag' || kind==='wave' && !loc.path.endsWith('.wav') || kind==='mount' && !['audio.mix','audiomd.mix'].includes(loc.path)) audioFail('source-role-path');
    const rootKey=JSON.stringify([loc.root.size,loc.root.sha256,loc.rootPath]);
    if(roots.has(loc.root.sourceId)&&roots.get(loc.root.sourceId)!==rootKey) audioFail('source-id-conflict'); roots.set(loc.root.sourceId,rootKey);
    const id=audioCandidateId(loc); if(ids.has(id)) audioFail('duplicate-candidate'); ids.add(id);
    const sha256=kind==='bag'||kind==='mount'?null:audioSha(v.sha256);
    if(kind==='source') {
      if(loc.size>cap.sourceBytes || loc.size>cap.inputBytes-inputBytes) audioFail('input-byte-limit'); inputBytes+=loc.size;
      const bytes=audioBytes(v.bytes,cap.sourceBytes); if(bytes.length!==loc.size||audioHash(bytes)!==sha256) audioFail('source-hash'); sources.set(id,bytes);
    }
    candidates.push({...loc,id,sha256});
  };
  mountInputs.forEach(v=>add(v,'mount'));sourceInputs.forEach(v=>add(v,'source'));bagInputs.forEach(v=>add(v,'bag'));waveInputs.forEach(v=>add(v,'wave'));
  candidates.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const byId=new Map(candidates.map(c=>[c.id,c])),selections=new Map<string,MissionAudioSelection>();
  const mountSelection=audioSelect(profile==='ra2'?'audio.mix':'audiomd.mix',candidates,profile,[]);
  selections.set(mountSelection.path,mountSelection);
  const selectedAudioMounts=mountSelection.selected.map(id=>byId.get(id)!);
  const select=(path:string)=>{let s=selections.get(path);if(!s){s=audioSelect(path,candidates,profile,selectedAudioMounts);selections.set(path,s);}return s;};
  const ini=new Map<string,ReturnType<typeof audioIni>>();
  for(const path of paths) {
    const selection=select(path); if(selection.status==='selected') {const id=selection.selected[0]!;ini.set(path,audioIni(sources.get(id)!,cap));}
  }
  const indexSelection=select('audio.idx'),bagSelection=select('audio.bag');
  let index:ReturnType<typeof readDependencyAudioIndex>|null=null,indexReasons:string[]=[];
  if(indexSelection.status==='selected') {
    try { index=readDependencyAudioIndex(sources.get(indexSelection.selected[0]!)!); }
    catch { indexReasons=['unsupported-audio-index']; }
  }
  const sortedIndex=new Map((index??[]).slice().sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).map((e,i)=>[e.ordinal,i]));
  const indexed=new Map<string,NonNullable<typeof index>>();
  for(const e of index??[]) {const a=indexed.get(e.name)??[];a.push(e);indexed.set(e.name,a);}
  // Native sorts/bsearches the full index. Duplicate names have no guaranteed tie winner.
  const samples:MissionAudioSample[]=[],sampleById=new Map<string,MissionAudioSample>();
  let sampleBytes=0;
  const storeSample=(s:Omit<MissionAudioSample,'id'>):string=>{
    const id=audioFingerprint(s,8192);if(sampleById.has(id))return id;
    if(samples.length>=cap.samples || s.size>cap.sampleBytes || s.size>cap.sampleTotalBytes-sampleBytes) audioFail('sample-limit');
    sampleBytes+=s.size;const full={id,...s};sampleById.set(id,full);samples.push(full);return id;
  };
  type Allocation = { name:string; ordinal:number; duplicate:boolean };
  const registryCache=new Map<string,{allocations:Map<string,Allocation>;reasons:string[]}>();
  for(const [position,path]of paths.entries()) {
    const listName=position===0?'SoundList':position===1?'DialogList':'Themes',list=ini.get(path)?.get(listName);
    const reasons:string[]=[],allocations=new Map<string,Allocation>();
    if(!list||list.duplicate)reasons.push('missing-or-ambiguous-registry-list');
    else {
      if(list.fields.length>cap.registryEntries)audioFail('registry-limit');
      for(const f of list.fields) {
        const name=f.value;if(!name)continue;
        if(name.length>(position===1?39:31)||!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) {
          if(!reasons.includes('registry-allocation-boundary'))reasons.push('registry-allocation-boundary');
        }
        const key=audioFold(name),previous=allocations.get(key);
        if(previous)previous.duplicate=true;else allocations.set(key,{name,ordinal:allocations.size,duplicate:false});
      }
    }
    registryCache.set(path,{allocations,reasons});
  }
  const bindings:MissionAudioBinding[]=[]; let retainedCharacters=0;
  for(const instruction of cues.instructions) {
    if(instruction.opcode!==19&&instruction.opcode!==20&&instruction.opcode!==21&&instruction.opcode!==99)continue;
    const opcode=instruction.opcode;
    const reasons=instruction.reasons.filter(x=>x!==closures[opcode]),addReason=(s:string)=>{if(!reasons.includes(s))reasons.push(s);};
    // paths are sound/eva/theme, whereas opcodes are sound/theme/eva.
    const registryPath=opcode===20?paths[2]!:opcode===21?paths[1]!:paths[0]!;
    const registrySelection=select(registryPath),registryTable=ini.get(registryPath);
    let registryName:string|null=null,registryOrdinal:number|null=null,section:AudioIniSection|undefined;
    const registrySha256=registrySelection.status==='selected'?byId.get(registrySelection.selected[0]!)!.sha256:null;
    if(registrySelection.status!=='selected') registrySelection.reasons.forEach(addReason);
    else {
      const registry=registryCache.get(registryPath)!;registry.reasons.forEach(addReason);
      {
        const operand=audioTrim(instruction.operand.value);
        if(!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(operand)||operand.length>199)addReason('unsupported-registry-operand');
        const found=registry.allocations.get(audioFold(operand));
        if(!found)addReason('registry-name-missing');
        else {
          registryName=found.name;registryOrdinal=found.ordinal;
          if(found.duplicate)addReason('duplicate-registry-allocation');
          if(found.name.length>(opcode===21?39:31)||!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(found.name))addReason('registry-name-boundary');
          section=registryTable!.get(found.name);
          if(!section||section.duplicate)addReason('missing-or-ambiguous-definition');
        }
      }
    }
    const refs:string[]=[],fields=section?.fields??[],defaults=registryTable?.get('Defaults');
    for(const f of [...fields,...(defaults?.fields??[])]) {
      retainedCharacters+=f.key.length+f.value.length+64;
      if(retainedCharacters>cap.serializedBytes)audioFail('retained-field-limit');
    }
    if(defaults?.duplicate)addReason('ambiguous-defaults');
    const field=(key:string)=>fields.find(f=>f.key===key)?.value??'';
    if(!reasons.length&&(opcode===19||opcode===99)) {
      const value=field('Sounds');
      if(value.length>2047||!/^[\t\x20-\x7e]*$/.test(value))addReason('sound-token-boundary');
      const tokens=value.split(/[ \t\n]+/).filter(Boolean);
      if(!tokens.length)addReason('empty-sample-list');
      if(tokens.length>32)addReason('sound-sample-count');
      if(indexSelection.status!=='selected')indexSelection.reasons.forEach(addReason);
      if(bagSelection.status!=='selected')bagSelection.reasons.forEach(addReason);
      indexReasons.forEach(addReason);
      if(!reasons.length)for(const token of tokens) {
        const name=audioFold(token.replace(/^[#$]+/,''));
        if(!/^[a-z0-9_][a-z0-9_.-]{0,14}$/.test(name)){addReason('sound-sample-name');continue;}
        const matches=indexed.get(name)??[];
        if(matches.length!==1){addReason(matches.length?'ambiguous-index-sample':'missing-index-sample');continue;}
        const e=matches[0]!;
        if(e.size<1||e.sampleRate<1||e.sampleRate>192000||![6,7,12,13].includes(e.flags)||((e.flags&8)!==0&&e.chunkSize<4*(1+(e.flags&1)))) {addReason('unsupported-index-sample-format');continue;}
        if(bagSelection.selected.some(id=>e.offset>byId.get(id)!.size||e.size>byId.get(id)!.size-e.offset)){addReason('sample-outside-bank');continue;}
        refs.push(storeSample({path:name,kind:'bag',candidates:bagSelection.candidates,selected:bagSelection.selected,bankOffset:e.offset,size:e.size,expectedSha256:null,
          index:{sourceOrdinal:e.ordinal,nativeSortedIndex:sortedIndex.get(e.ordinal)!,sampleRate:e.sampleRate,flags:e.flags,chunkSize:e.chunkSize}}));
      }
    } else if(!reasons.length) {
      const rawStem=opcode===20?field('Sound'):field(side===0?'Allied':side===1?'Russian':'Yuri');
      if(opcode===20&&rawStem.length>255)addReason('theme-stem-buffer-boundary');
      let stem=opcode===20?rawStem.replace(/^[#$]+/,''):rawStem;
      if(profile==='ra2'&&opcode===21&&side===2)addReason('side-not-native-profile');
      if(opcode===21)stem=stem.slice(0,8);
      if(!stem||stem.length>(opcode===21?8:255)||!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(stem)||stem.includes('..'))addReason('unsupported-wave-stem');
      if(!reasons.length) {
        const wave=select(audioFold(stem)+'.wav');wave.reasons.forEach(addReason);
        if(wave.status==='selected') {const c=byId.get(wave.selected[0]!)!;refs.push(storeSample({path:wave.path,kind:'wav',candidates:wave.candidates,selected:wave.selected,bankOffset:null,size:c.size,expectedSha256:c.sha256,index:null}));}
      }
    }
    bindings.push({instructionId:instruction.id,opcode,status:reasons.length?'unsupported':'planned-reference',reasons,registryPath,registrySha256,
      registryName,registryOrdinal,fields,defaults:defaults?.fields??[],samples:refs,pendingPlayback:[...pending[opcode]]});
  }
  const data={policy:MISSION_AUDIO_POLICY,profile,side,missionSha256:cues.source.sha256,cuesSha256:cues.sha256,
    selectedAudioMounts,candidates,selections:[...selections.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),bindings,samples,
    scope:'provided-import-candidates' as const,rootIdentitiesVerified:false as const,nativeExecutionVerified:false as const,playbackReady:false as const,canStartCampaign:false as const};
  const plan=audioFreeze({...data,sha256:audioFingerprint(audioDurable(data),cap.serializedBytes)});
  plans.set(plan,{caps:Object.freeze(cap)});return plan;
}
