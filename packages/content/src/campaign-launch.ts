// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../CAMPAIGN_LAUNCH_PROVENANCE.md.
import type { ProfileId } from '../../contracts/src/index.ts';
import type { BrowserCatalog } from '../../vfs/src/browser-catalog.ts';
import { throwIfImportAborted } from '../../vfs/src/browser-source.ts';
import { normalizeAssetPath } from '../../vfs/src/profile.ts';
import { scanIni, type IniDocument } from './ini.ts';
import { decodeCsf, type CsfCatalog } from './csf-decode.ts';
import { combatActorFingerprint as fingerprint } from './combat-actor-values.ts';
import { CampaignLaunchError, createCampaignSourceReader, type CampaignSourceFile } from './campaign-launch-source.ts';
export { CampaignLaunchError } from './campaign-launch-source.ts';

export const CAMPAIGN_LAUNCH_POLICY='webra2-native-campaign-starts-1' as const;
export const CAMPAIGN_LAUNCH_LIMITS=Object.freeze({entries:2,text:8192,characters:32768,pins:16,media:8});
export type CampaignFaction='allied'|'soviet';
export interface CampaignLaunchEntry {
  readonly id:CampaignFaction;readonly status:'ready'|'unavailable';readonly reasons:readonly string[];
  readonly title:string|null;readonly descriptionLabel:string|null;readonly briefing:string|null;readonly briefingLabel:string|null;
  readonly missionPath:string|null;readonly missionSha256:string|null;readonly theater:string|null;
  readonly theaterIniPath:string|null;readonly palettePath:string|null;readonly cinematics:readonly {readonly field:string;readonly reference:string}[];
}
export interface CampaignLaunchPlan {
  readonly policy:typeof CAMPAIGN_LAUNCH_POLICY;readonly profile:ProfileId;readonly fingerprint:string;
  readonly entries:readonly CampaignLaunchEntry[];readonly omittedBattleEntries:number;
  readonly languageId:number|null;readonly pins:readonly {readonly path:string;readonly sha256:string;readonly size:number}[];
  readonly canCompleteCampaign:false;readonly cinematicPlayback:false;
}
export interface CampaignMissionRequest {readonly profile:ProfileId;readonly missionPath:string;readonly theaterIniPath:string;readonly palettePath:string;readonly missionSha256:string}
const plans=new WeakMap<CampaignLaunchPlan,ReadonlyMap<CampaignFaction,CampaignMissionRequest>>();
export const isCampaignLaunchPlan=(value:unknown):value is CampaignLaunchPlan=>!!value&&typeof value==='object'&&plans.has(value as CampaignLaunchPlan);
function fail(code:string):never {throw new CampaignLaunchError(code);}
const fold=(v:string)=>v.replace(/[A-Z]/g,c=>c.toLowerCase());
const value=(v:string)=>v.split(';',1)[0]!.replace(/^[ \t]+|[ \t]+$/g,'');
// Factual native table fields, not copied artwork or per-mission filename overrides.
const theaters=Object.freeze({ra2:Object.freeze({temperate:['temperat','tem'],snow:['snow','sno'],urban:['urban','urb']}),
  yr:Object.freeze({temperate:['temperat','tem'],snow:['snow','sno'],urban:['urban','urb'],desert:['desert','des'],newurban:['urbann','ubn'],lunar:['lunar','lun']})});
function section(doc:IniDocument,name:string){
  const found=doc.sections.filter(s=>fold(s.name)===fold(name));if(found.length>1)fail('ambiguous-section');
  return found.length?doc.entries.filter(e=>e.sectionOccurrence===found[0]!.occurrence&&e.section===found[0]!.name):[];
}
function field(doc:IniDocument,name:string,key:string,maximum=512):string|null{
  const found=section(doc,name).filter(e=>fold(e.key)===fold(key));
  // Wrong-case spellings remain explicit unsupported input; do not infer the
  // general native key-comparison semantics from the campaign ID comparison.
  if(found.length>1)fail('ambiguous-field');if(found.length&&found[0]!.key!==key)fail('unsupported-key-case');
  const raw=found[0]?value(found[0].value):null;
  if(raw!==null&&(raw.length>maximum||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(raw)))fail('field-limit');return raw;
}
function parse(file:CampaignSourceFile):IniDocument{const doc=scanIni(file.bytes);if(doc.diagnostics.length)fail('malformed-ini');return doc;}
function text(csf:CsfCatalog|null,label:string|null):string|null{
  if(!csf||!label)return null;const r=csf.resolve(label);if(r.status!=='resolved'||r.text===null)return null;
  if(r.text.length>CAMPAIGN_LAUNCH_LIMITS.text)fail('localized-text-limit');return r.text;
}
function path(v:string|null):string {if(!v||! /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.(?:map|mpr)$/i.test(v))fail('scenario-path');return normalizeAssetPath(v);}
type Mutable<T>={-readonly [K in keyof T]:T[K]};
function empty(id:CampaignFaction):Mutable<Omit<CampaignLaunchEntry,'status'|'reasons'>>{return{id,title:null,descriptionLabel:null,briefing:null,briefingLabel:null,missionPath:null,missionSha256:null,theater:null,theaterIniPath:null,palettePath:null,cinematics:Object.freeze([])};}
const active=new WeakSet<BrowserCatalog>();
/** Genuine plan owns launch authority. UI may send only its fingerprint and entry ID. */
export async function prepareCampaignLaunches(catalog:BrowserCatalog,input:{readonly profile:ProfileId},options:{readonly signal?:AbortSignal;readonly onProgress?:(path:string,completed:number)=>void}={}):Promise<CampaignLaunchPlan>{
  if(active.has(catalog))fail('campaign-busy');active.add(catalog);
  let reader:ReturnType<typeof createCampaignSourceReader>|null=null;
  try{
    const descriptor=Object.getOwnPropertyDescriptor(input,'profile');
    if(!descriptor||!('value' in descriptor)||Reflect.ownKeys(input).length!==1||(descriptor.value!=='ra2'&&descriptor.value!=='yr'))fail('campaign-request');
    const profile:ProfileId=descriptor.value,signal=options.signal,progress=options.onProgress;reader=createCampaignSourceReader(catalog,profile,signal);
    const pins=new Map<string,{path:string;sha256:string;size:number}>();let completed=0;
    const read=async(name:string)=>{throwIfImportAborted(signal);const r=await reader!.read(name);throwIfImportAborted(signal);
      if(r.file){pins.set(r.path,Object.freeze({path:r.path,sha256:r.file.identity.sha256,size:r.file.identity.size}));if(pins.size>CAMPAIGN_LAUNCH_LIMITS.pins)fail('campaign-pin-limit');}
      progress?.(name,++completed);throwIfImportAborted(signal);return r;
    };
    const suffix=profile==='yr'?'md':'',battle=await read(`battle${suffix}.ini`),mapsel=await read(`mapsel${suffix}.ini`),missionTable=await read(`mission${suffix}.ini`),strings=await read(profile==='yr'?'ra2md.csf':'ra2.csf');
    let battleDoc:IniDocument|null=null,csf:CsfCatalog|null=null,tableError:string|null=null;
    try{if(battle.file)battleDoc=parse(battle.file);if(mapsel.file)parse(mapsel.file);if(missionTable.file)parse(missionTable.file);if(strings.file)csf=decodeCsf(strings.file.bytes);}catch(e){tableError=e instanceof CampaignLaunchError?e.code:'malformed-tables';}
    const shared=[battle,mapsel,missionTable,strings].filter(r=>r.status!=='resolved').map(r=>`source-${r.status}:${r.path}`);
    if(tableError)shared.push(tableError);
    const entries:CampaignLaunchEntry[]=[],requests=new Map<CampaignFaction,CampaignMissionRequest>();let membership:ReturnType<typeof section>=[];
    try{membership=battleDoc?section(battleDoc,'Battles'):[];}catch{shared.push('ambiguous-battles');}
    for(const id of ['allied','soviet'] as const){
      const data=empty(id),reasons=[...shared],nativeId=id==='allied'?'all1':'sov1';
      try{
        if(!battleDoc)fail('missing-battle');const listed=membership.filter(e=>fold(value(e.value))===nativeId);
        if(listed.length!==1)fail(listed.length?'ambiguous-membership':'missing-campaign');
        const nativeSection=value(listed[0]!.value);data.descriptionLabel=field(battleDoc,nativeSection,'Description');data.title=text(csf,data.descriptionLabel);
        const debug=field(battleDoc,nativeSection,'DebugOnly');if(debug!==null&&!/^(?:no|false|0)$/i.test(debug))fail('debug-start');
        data.missionPath=path(field(battleDoc,nativeSection,'Scenario'));
        const map=await read(data.missionPath);if(!map.file)fail(`source-${map.status}:${data.missionPath}`);data.missionSha256=map.file.identity.sha256;
        const doc=parse(map.file),theater=field(doc,'Map','Theater',16);if(!theater)fail('missing-theater');data.theater=theater;
        const definition=Object.entries(theaters[profile]).find(([key])=>key===fold(theater))?.[1];if(!definition)fail('unsupported-theater');
        data.theaterIniPath=`${definition[0]}${suffix}.ini`;data.palettePath=`iso${definition[1]}.pal`;
        for(const needed of [data.theaterIniPath,data.palettePath]){const r=await read(needed);if(!r.file)fail(`source-${r.status}:${needed}`);}
        data.briefingLabel=field(doc,'Basic','Briefing');data.briefing=text(csf,data.briefingLabel);
        const media:{field:string;reference:string}[]=[];
        for(const key of ['Intro','Brief','Win','Lose','Action','PostScore','PreMapSelect']){const ref=field(doc,'Basic',key,128);if(ref&&fold(ref)!=='<none>')media.push(Object.freeze({field:key,reference:ref}));}
        const final=field(battleDoc,nativeSection,'FinalMovie',128);if(final&&fold(final)!=='<none>')media.push(Object.freeze({field:'FinalMovie',reference:final}));data.cinematics=Object.freeze(media);
        if(!reasons.length)requests.set(id,Object.freeze({profile,missionPath:data.missionPath,theaterIniPath:data.theaterIniPath,palettePath:data.palettePath,missionSha256:data.missionSha256}));
      }catch(e){if(signal?.aborted)throw e;reasons.push(e instanceof CampaignLaunchError?e.code:'unsupported-content');}
      entries.push(Object.freeze({...data,status:reasons.length?'unavailable':'ready',reasons:Object.freeze([...new Set(reasons)])}));
    }
    const body={policy:CAMPAIGN_LAUNCH_POLICY,profile,entries:Object.freeze(entries),omittedBattleEntries:Math.max(0,membership.length-membership.filter(e=>['all1','sov1'].includes(fold(value(e.value)))).length),languageId:csf?.languageId??null,
      pins:Object.freeze([...pins.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)),canCompleteCampaign:false as const,cinematicPlayback:false as const};
    if(JSON.stringify(body).length>CAMPAIGN_LAUNCH_LIMITS.characters)fail('campaign-character-limit');
    const plan=Object.freeze({...body,fingerprint:fingerprint(body,CAMPAIGN_LAUNCH_LIMITS.characters)});plans.set(plan,requests);return plan;
  }finally{reader?.clear();active.delete(catalog);}
}
export function campaignMissionRequest(plan:CampaignLaunchPlan,planFingerprint:string,id:CampaignFaction):CampaignMissionRequest{
  const entries=plans.get(plan);if(!entries||plan.fingerprint!==planFingerprint)fail('campaign-plan-identity');const result=entries.get(id);if(!result)fail('campaign-entry-unavailable');return result;
}
