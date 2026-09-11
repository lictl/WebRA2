// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_AUDIO_POLICY_PROVENANCE.md.
import type { MissionCueCatalog, MissionCueInstruction } from './mission-cue-types.ts';
import type { MissionAudioBinding, MissionAudioCatalog, MissionAudioField } from './mission-audio-types.ts';

export const MISSION_AUDIO_SOURCE_POLICY = 'webra2-mission-audio-source-policy-1' as const;
export const MISSION_AUDIO_SOURCE_LIMITS = Object.freeze({ bindings: 8192, fields: 262144, tokens: 262144,
  histories: 524288, samples: 131072, diagnostics: 262144, work: 2097152,
  characters: 16 * 1024 ** 2, serializedBytes: 32 * 1024 ** 2 });
export type MissionAudioSourceLimits = { -readonly [K in keyof typeof MISSION_AUDIO_SOURCE_LIMITS]: number };
export interface MissionAudioPolicyInput {
  readonly cues: MissionCueCatalog;
  readonly audio: MissionAudioCatalog;
  /** Default globals are a process-start assumption, never restored/native live state. */
  readonly initialization: 'fresh-process-audio-load';
}
export interface MissionAudioPolicyOrigin {
  readonly stage: 'image-default' | 'defaults-section' | 'definition-section' | 'action-override';
  readonly registrySha256: string | null;
  readonly section: string | null;
  readonly field: MissionAudioField | null;
}
export interface MissionAudioPolicyValue {
  readonly key: string;
  readonly status: 'supported-source' | 'unsupported';
  readonly value: number | readonly number[] | null;
  readonly unit: string;
  readonly history: readonly Readonly<{ origin: MissionAudioPolicyOrigin;
    value: number | readonly number[] | null; status: 'explicit' | 'default' | 'retained' | 'unsupported' }>[];
  readonly reasons: readonly string[];
}
export interface MissionSoundSelectionPolicy {
  readonly kind: 'sound-sample-partitions';
  readonly status: 'supported-source' | 'unsupported';
  /** Source order and duplicates remain meaningful. These are candidates, not chosen samples. */
  readonly attack: readonly string[];
  readonly body: readonly string[];
  readonly decay: readonly string[];
  readonly bodyRule: 'first-body' | 'random-body' | 'all-body-ordered' | 'all-body-random-order' | null;
  readonly attackRule: 'none' | 'random-partition-member' | null;
  readonly decayRule: 'none' | 'random-partition-member' | null;
  readonly loopCount: number | null;
  readonly loopRule: 'none' | 'finite' | 'unbounded' | null;
  readonly reasons: readonly string[];
}
export interface MissionEvaRequestPolicy {
  readonly kind: 'eva-request';
  readonly status: 'supported-source' | 'unsupported';
  readonly side: 0 | 1 | 2;
  readonly selectedSamples: readonly string[];
  /** The mission caller supplies2 regardless of the stored definition Type. */
  readonly callerType: 2;
  readonly priority: number | null;
  readonly reasons: readonly string[];
}
export interface MissionAudioPolicyBinding {
  readonly instructionId: string;
  readonly opcode: 19 | 20 | 21 | 99;
  readonly instruction: MissionCueInstruction;
  readonly reference: MissionAudioCatalog['bindings'][number];
  readonly status: 'supported-source' | 'unsupported';
  readonly values: readonly MissionAudioPolicyValue[];
  readonly selection: MissionSoundSelectionPolicy | MissionEvaRequestPolicy | null;
  readonly caller: Readonly<{ type: 'global-sound'; panning: 8192; volume: 1; controller: null }>
    | Readonly<{ type: 'eva'; typeOverride: 2; priorityOverride: -1 }>
    | Readonly<{ type: 'spatial-sound'; waypoint: number; x: number; y: number;
      selection: 'current-building-first-terrain-otherwise-position'; positionalFlags: 1 }> | null;
  readonly requiredState: readonly string[];
  readonly reasons: readonly string[];
  readonly retainedFields: readonly MissionAudioField[];
  readonly retainedDefaults: readonly MissionAudioField[];
  readonly pendingPlayback: MissionAudioBinding['pendingPlayback'];
}
export interface MissionAudioPolicyCatalog {
  readonly policy: typeof MISSION_AUDIO_SOURCE_POLICY;
  readonly profile: 'ra2' | 'yr';
  readonly initialization: 'fresh-process-audio-load';
  readonly missionSha256: string;
  readonly cuesSha256: string;
  readonly audioSha256: string;
  readonly side: 0 | 1 | 2;
  readonly sha256: string;
  readonly sourceScope: 'verified-audio-reference-normalized-fields';
  readonly bindings: readonly MissionAudioPolicyBinding[];
  readonly diagnostics: readonly Readonly<{ instructionId: string; code: string }>[];
  readonly runtimeAuthority: false;
  readonly nativeExecutionVerified: false;
  readonly playbackReady: false;
  readonly canStartCampaign: false;
}

import { isMissionCueCatalog } from './mission-cues.ts';
import { isMissionAudioCatalog } from './mission-audio-samples.ts';
import { cueRecord, cueFreeze, cueFingerprint } from './mission-cue-types.ts';
import { weaponDecimal, weaponFloatStore } from './weapon-numbers.ts';

export class MissionAudioPolicyError extends Error {
  constructor(readonly code: string) { super(`mission-audio-policy-${code}`); this.name = 'MissionAudioPolicyError'; }
}
function fail(code: string): never { throw new MissionAudioPolicyError(code); }
const catalogs = new WeakMap<MissionAudioPolicyCatalog, Readonly<{ cues: MissionCueCatalog; audio: MissionAudioCatalog }>>();
export function isMissionAudioPolicyCatalog(v: unknown): v is MissionAudioPolicyCatalog {
  return !!v && typeof v === 'object' && catalogs.has(v as MissionAudioPolicyCatalog);
}
export function missionAudioPolicyContext(catalog: MissionAudioPolicyCatalog): Readonly<{ cues: MissionCueCatalog; audio: MissionAudioCatalog }> {
  return catalogs.get(catalog) ?? fail('factory');
}
const SOUND_PRIORITY = new Map([['lowest',0],['low',1],['normal',2],['high',3],['critical',4]]);
const SOUND_CONTROL = new Map([['all',4],['loop',1],['random',2],['predelay',8],['interrupt',16],['attack',32],['decay',64],['ambient',128]]);
const SOUND_TYPE = new Map([['ambient',4096],['violent',1],['movement',2],['quiet',4],['loud',8],['global',16],['screen',32],['local',64],
  ['player',128],['normal',0],['gun_shy',512],['noise_shy',256],['unshroud',1024],['shroud',2048]]);
const EVA_PRIORITY = new Map([['low',0],['normal',1],['important',2],['critical',3]]);
const EVA_TYPE = new Map([['standard',0],['queue',1],['interrupt',2],['queued_interrupt',3]]);
const SOUND_FIELDS = new Set(['Sounds','Volume','VShift','MinVolume','Priority','Attack','Decay','Control','Type','Limit','Loop','Range','Delay','FShift']);
const SOUND_DEFAULTS = new Set(['Volume','MinVolume','Priority','Control','Type','Limit','Range']);
const EVA_FIELDS = new Set(['Volume','Priority','Type','Allied','Russian','Yuri','Text']);
const fold = (s: string) => s.replace(/[A-Z]/g, c => c.toLowerCase());
type Value = MissionAudioPolicyValue['value'];
type Stage = MissionAudioPolicyOrigin['stage'];
interface ReadResult { value: Value; reasons: string[] }
/** Typed source policy only: runtime queues, random state and invocation authority are deliberately absent. */
export function compileMissionAudioPolicy(input: MissionAudioPolicyInput, options: Partial<MissionAudioSourceLimits> = {}): MissionAudioPolicyCatalog {
  const r = cueRecord(input, ['cues','audio','initialization']);
  if (!isMissionCueCatalog(r.cues) || !isMissionAudioCatalog(r.audio)) fail('factory');
  if (r.initialization !== 'fresh-process-audio-load') fail('initialization');
  const cues = r.cues, audio = r.audio;
  if (audio.profile !== cues.profile || audio.missionSha256 !== cues.source.sha256 || audio.cuesSha256 !== cues.sha256) fail('source-identity');
  const cap: MissionAudioSourceLimits = { ...MISSION_AUDIO_SOURCE_LIMITS };
  if (!options || ![Object.prototype,null].includes(Object.getPrototypeOf(options))) fail('limits');
  for (const k of Reflect.ownKeys(options)) {
    if (typeof k !== 'string' || !Object.hasOwn(cap,k)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(options,k)!;
    if (!('value' in d) || !d.enumerable || !Number.isSafeInteger(d.value) || Object.is(d.value,-0) || d.value < 0 || d.value > cap[k as keyof MissionAudioSourceLimits]) fail('limits');
    cap[k as keyof MissionAudioSourceLimits] = d.value;
  }
  let work=0,fieldCount=0,characters=0,tokenCount=0,histories=0,sampleCount=0;
  function charge(n=1): void { if(n>cap.work-work) fail('work-limit'); work+=n; }
  function text(s:string): void { if(s.length>cap.characters-characters) fail('character-limit'); characters+=s.length; }
  function history(): void { if(++histories>cap.histories)fail('history-limit'); charge(); }
  function tokens(s:string): string[] {
    text(s); if(s.length>2047 || !/^[\t\x20-\x7e]*$/.test(s))return [];
    // Count before split/materialization. Source strings are already immutable and bounded.
    let count=0,inside=false;
    for(let i=0;i<s.length;i++){charge();const next=s[i]!==' '&&s[i]!=='\t';if(next&&!inside)count++;inside=next;}
    if(count>cap.tokens-tokenCount)fail('token-limit');tokenCount+=count;
    return s.split(/[ \t]+/).filter(Boolean);
  }
  if(audio.bindings.length>cap.bindings || cues.instructions.length>cap.bindings)fail('binding-limit');
  const expected = new Map<string,MissionCueInstruction>();
  for(const i of cues.instructions){charge();if(i.opcode===19||i.opcode===20||i.opcode===21||i.opcode===99){if(expected.has(i.id))fail('instruction-identity');expected.set(i.id,i);}}
  if(expected.size!==audio.bindings.length)fail('instruction-identity');
  // Pre-count every repeated/default field, sample reference and input string across the whole catalog.
  for(const b of audio.bindings){charge();
    if(b.fields.length+b.defaults.length>cap.fields-fieldCount)fail('field-limit');fieldCount+=b.fields.length+b.defaults.length;
    if(b.samples.length>cap.samples-sampleCount)fail('sample-limit');sampleCount+=b.samples.length;
    for(const list of [b.fields,b.defaults])for(const f of list){charge();text(f.key);text(f.value);}
    text(b.instructionId); for(const s of b.samples)text(s);for(const reason of [...b.reasons,...b.pendingPlayback])text(reason);
  }
  const knownSamples = new Set<string>();
  for(const sample of audio.samples){charge();knownSamples.add(sample.id);}
  const diagnostics: {instructionId:string;code:string}[] = [], bindings: MissionAudioPolicyBinding[] = [];
  function emit(id:string,code:string):void{charge();if(diagnostics.length>=cap.diagnostics)fail('diagnostic-limit');diagnostics.push({instructionId:id,code});}
  for(const b of audio.bindings){charge();const instruction=expected.get(b.instructionId);
    if(!instruction||instruction.opcode!==b.opcode)fail('instruction-identity');expected.delete(b.instructionId);
    if(b.samples.some(id=>!knownSamples.has(id)))fail('sample-identity');
    const reasons=[...b.reasons], requireState:string[]=[], values:MissionAudioPolicyValue[]=[];
    const fields=new Map(b.fields.map(f=>[f.key,f])),defaults=new Map(b.defaults.map(f=>[f.key,f]));
    let selection:MissionAudioPolicyBinding['selection']=null, caller:MissionAudioPolicyBinding['caller']=null;
    if(b.status!=='verified-reference')reasons.push('unverified-audio-reference');
    function origin(stage:Stage,f:MissionAudioField|null):MissionAudioPolicyOrigin{return {stage,registrySha256:stage==='image-default'||stage==='action-override'?null:b.registrySha256,
      section:stage==='defaults-section'?'Defaults':stage==='definition-section'?b.registryName:null,field:f};}
    function number(s:string,integer=false):ReadResult{
      const pattern=integer?/^[+-]?\d{1,10}$/:/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?%?$/;
      if(s.length>64||!pattern.test(s))return {value:null,reasons:['unsupported-numeric-source']};
      const n=Number(s.endsWith('%')?s.slice(0,-1):s);
      if(!Number.isFinite(n)||(integer&&(!Number.isInteger(n)||n < -2147483648 || n>2147483647)))return {value:null,reasons:['unsupported-numeric-range']};
      // Share the reviewed startup-mode ReadDouble subset: reject CRT halfway
      // ambiguity and truncate percent products instead of assuming nearest.
      const value=integer?n:weaponDecimal(s);
      return value!==null&&Number.isFinite(value)?{value:Object.is(value,-0)?0:value,reasons:[]}:{value:null,reasons:['unsupported-numeric-range']};
    }
    function enumeration(s:string,table:ReadonlyMap<string,number>,mode:'one'|'control'|'type'='one'):ReadResult{
      const words=mode==='one'?[s]:tokens(s);if(!words.length)return {value:null,reasons:['unsupported-empty-control']};
      let value=mode==='type'?32:0;
      for(const word of words){charge();const v=table.get(fold(word));if(v===undefined)return {value:null,reasons:['unsupported-control-token']};
        if(mode==='one')value=v;else{if(mode==='type'){if(v&0x60)value&=~0x60;else if(v&0xc00)value&=~0xc00;}value|=v;}}
      return {value,reasons:[]};
    }
    function pair(s:string):ReadResult{const words=tokens(s);if(words.length<1||words.length>2)return {value:null,reasons:['unsupported-range-token-count']};
      const a=number(words[0]!,true),z=words.length===1?a:number(words[1]!,true);
      return a.value===null||z.value===null?{value:null,reasons:[...a.reasons,...z.reasons]}:{value:[a.value as number,z.value as number],reasons:[]};}
    function field(key:string,initial:Value,unit:string,read:(s:string)=>ReadResult,withDefaults=false,definitionFallback?:Value):MissionAudioPolicyValue{
      const loads:MissionAudioPolicyValue['history'][number][]=[];let value=initial;const errors:string[]=[];
      history();loads.push({origin:origin('image-default',null),value,status:'default'});
      for(const stage of (withDefaults?['defaults-section','definition-section']:['definition-section']) as ('defaults-section'|'definition-section')[]){
        charge();const f=(stage==='defaults-section'?defaults:fields).get(key);history();
        if(f){const result=read(f.value);value=result.value;errors.push(...result.reasons);
          // Defaults globals are dword stores before the named reader receives
          // them as defaults; histories retain that actual stored source value.
          if(stage==='defaults-section'&&['Volume','MinVolume'].includes(key)&&typeof value==='number')value=weaponFloatStore(value);
          loads.push({origin:origin(stage,f),value,status:result.reasons.length?'unsupported':'explicit'});}
        else {if(stage==='definition-section'&&definitionFallback!==undefined)value=definitionFallback;
          loads.push({origin:origin(stage,null),value,status:stage==='definition-section'&&definitionFallback!==undefined?'default':'retained'});}
      }
      const result={key,status:errors.length?'unsupported' as const:'supported-source' as const,value,unit,history:loads,reasons:errors};values.push(result);
      if(errors.length)reasons.push(...errors.map(x=>`${key}:${x}`));return result;
    }
    if(b.opcode===19||b.opcode===99){
      if(b.opcode===19)caller={type:'global-sound',panning:8192,volume:1,controller:null};
      else if(instruction.spatialLocation)caller={type:'spatial-sound',...instruction.spatialLocation,positionalFlags:1};
      else reasons.push('spatial-waypoint-source');
      if(b.opcode===99)requireState.push('current-building-first-terrain-cell-order','current-map-elevation-and-bridge-height',
        'custom-object-controller-and-limbo-lifecycle','positional-flags-and-exact-coordinate-stop','listener-viewport-pan-volume-and-shroud');
      for(const f of b.fields)if(!SOUND_FIELDS.has(f.key))reasons.push(`unsupported-definition-field:${f.key}`);
      for(const f of b.defaults)if(!SOUND_DEFAULTS.has(f.key))reasons.push(`unsupported-defaults-field:${f.key}`);
      field('Volume',80,'native-read-number-percent',s=>number(s),true);
      field('MinVolume',20,'native-read-number-percent',s=>number(s),true);
      field('Priority',2,'native-sound-priority',s=>enumeration(s,SOUND_PRIORITY),true,2);
      const control=field('Control',0,'native-control-mask',s=>enumeration(s,SOUND_CONTROL,'control'),true);
      field('Type',32,'native-sound-type-mask',s=>enumeration(s,SOUND_TYPE,'type'),true);
      const limit=field('Limit',5,'native-instance-limit',s=>number(s,true),true);
      const range=field('Range',10,'native-stored-range',s=>number(s,true),true);
      const loop=field('Loop',0,'native-loop-count-zero-unbounded',s=>number(s,true));
      const attack=field('Attack',0,'source-prefix-sample-count',s=>number(s,true));
      const decay=field('Decay',0,'source-suffix-sample-count',s=>number(s,true));
      const vshift=field('VShift',0,'native-configured-volume-shift-percent-before-clamp',s=>number(s,true));
      const delay=field('Delay',[0,0],'native-delay-range',pair);
      const fshift=field('FShift',[0,0],'native-frequency-shift-percent-range',pair);
      const mask=control.value as number|null;let a=attack.value as number|null,d=decay.value as number|null;
      const selectionReasons:string[]=[];
      if(mask===null||a===null||d===null||loop.value===null||delay.value===null||fshift.value===null)selectionReasons.push('unresolved-selection-controls');
      if(mask!==null&&a!==null&&d!==null){a=(mask&32)?a||1:0;d=(mask&64)?d||1:0;
        if(a<0||d<0||a+d>=b.samples.length)selectionReasons.push('invalid-sample-partitions');}
      for(const v of [limit,range])if(typeof v.value==='number'&&v.value<0)reasons.push(`${v.key}:unsupported-negative-native-control`);
      if(typeof loop.value==='number'&&loop.value<0)selectionReasons.push('Loop:unsupported-negative-native-control');
      for(const v of [delay,fshift])if(Array.isArray(v.value)&&(v.value[0]!>v.value[1]!||v.key==='Delay'&&v.value[0]!<0))selectionReasons.push(`${v.key}:unsupported-range-order`);
      const ok=selectionReasons.length===0&&a!==null&&d!==null&&mask!==null;
      selection={kind:'sound-sample-partitions',status:ok?'supported-source':'unsupported',attack:ok?b.samples.slice(0,a!):[],body:ok?b.samples.slice(a!,b.samples.length-d!):[],decay:ok&&d?b.samples.slice(-d):[],
        bodyRule:ok?(mask&4?mask&2?'all-body-random-order':'all-body-ordered':mask&2?'random-body':'first-body'):null,
        attackRule:ok?(a?'random-partition-member':'none'):null,decayRule:ok?(d?'random-partition-member':'none'):null,loopCount:typeof loop.value==='number'?loop.value:null,loopRule:ok?(mask&1?loop.value===0?'unbounded':'finite':'none'):null,reasons:selectionReasons};
      reasons.push(...selectionReasons);
      requireState.push('global-voices-enabled','audio-device-and-controller-pool','active-instance-limits-and-interrupts','mixer-channel-priority','audio-update-and-stream-clock','user-category-volume-and-pan');
      if(ok&&((mask&2)&&b.samples.length-a!-d!>1||a!>1||d!>1))requireState.push('global-audio-rng-sample-selection');
      // Native equal-endpoint RandomRanged returns without drawing. Ambient uses
      // an initial lower delay endpoint33; ordinary delay uses the source endpoints.
      const varyingFrequency=Array.isArray(fshift.value)&&fshift.value[0]!==fshift.value[1];
      const varyingVolume=typeof vshift.value==='number'&&Math.min(100,Math.max(0,vshift.value))>0;
      const varyingDelay=Array.isArray(delay.value)&&mask!==null&&((mask&128)?delay.value[1]!==33:
        delay.value[0]!==delay.value[1]&&((mask&8)!==0||delay.value[1]!>=33));
      if(varyingFrequency||varyingVolume||varyingDelay)requireState.push('global-audio-rng-frequency-volume-and-delay');
      requireState.push('attack-body-decay-loop-cursor');
      if(Array.isArray(delay.value)&&delay.value[0]!>=33)requireState.push('delayed-selector-retained-random-index');
    }else if(b.opcode===21){
      caller={type:'eva',typeOverride:2,priorityOverride:-1};
      for(const f of b.fields)if(!EVA_FIELDS.has(f.key))reasons.push(`unsupported-definition-field:${f.key}`);
      field('Volume',1,'native-stored-binary32',s=>{const v=number(s);return {...v,value:typeof v.value==='number'?weaponFloatStore(v.value):null};});
      field('Type',0,'native-stored-eva-type-overridden-by-action',s=>enumeration(s,EVA_TYPE));
      const priority=field('Priority',1,'native-eva-priority',s=>enumeration(s,EVA_PRIORITY));
      const errors=b.samples.length===1?[]:['eva-requires-one-selected-side-sample'];
      if(priority.value===null)errors.push('unresolved-eva-priority');
      selection={kind:'eva-request',status:errors.length?'unsupported':'supported-source',side:audio.side,selectedSamples:b.samples,callerType:2,priority:priority.value as number|null,reasons:errors};reasons.push(...errors);
      requireState.push('current-eva-side-matches-catalog','eva-stream-availability-and-global-suppression','active-eva-identity','eva-queues-and-priority-arbitration','eva-stream-clock-and-postclip-delay','user-speech-volume','stored-eva-volume-consumption-unproven');
    }else reasons.push('theme-playback-policy-out-of-scope');
    const unique=[...new Set(reasons)];for(const code of unique)emit(b.instructionId,code);
    bindings.push({instructionId:b.instructionId,opcode:b.opcode,instruction,reference:b,status:unique.length?'unsupported':'supported-source',values,selection,caller,
      requiredState:requireState,reasons:unique,retainedFields:b.fields,retainedDefaults:b.defaults,pendingPlayback:b.pendingPlayback});
  }
  const data={policy:MISSION_AUDIO_SOURCE_POLICY,profile:audio.profile,initialization:'fresh-process-audio-load' as const,missionSha256:audio.missionSha256,
    cuesSha256:cues.sha256,audioSha256:audio.sha256,side:audio.side,sourceScope:'verified-audio-reference-normalized-fields' as const,bindings,diagnostics,
    runtimeAuthority:false as const,nativeExecutionVerified:false as const,playbackReady:false as const,canStartCampaign:false as const};
  const output=cueFreeze({...data,sha256:cueFingerprint(data,cap.serializedBytes)});catalogs.set(output,Object.freeze({cues,audio}));return output;
}
