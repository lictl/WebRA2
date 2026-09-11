// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_BINDINGS_PROVENANCE.md.
import type { MissionAudioPolicyCatalog } from '../../content/src/mission-audio-policy.ts';
import { isMissionCellEntrySource, missionCellEntrySourceBindings, type MissionCellEntrySource } from './mission-cell-entry-source.ts';
import { isMissionObjectEventSource, missionObjectEventSourceBindings, type MissionObjectEventSource } from './mission-object-event-source.ts';
import { isMissionTeamActionSource, missionTeamActionSourceContext, type MissionTeamActionSource } from './mission-team-action-source.ts';
import type { MissionCueCatalog } from '../../content/src/mission-cues.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import type { ProfileId } from '../../contracts/src/index.ts';
import { compileScenarioLogic, type ScenarioLogic, type ScenarioLogicSource } from '../../content/src/scenario-logic.ts';
import { compileScenarioObjects } from '../../content/src/scenario-objects.ts';
import { assembleScenarioDefinitions, type ScenarioConstruction } from '../../content/src/scenario-construction.ts';
import { createIniSourceView } from '../../content/src/ini-source-view.ts';
import type { IniOrigin, RuntimeIni } from '../../content/src/runtime-ini.ts';
import { isEntityDefinitions, type EntityDefinitions } from '../../content/src/entity-definitions.ts';
import { combatActorFingerprint as fingerprint } from '../../content/src/combat-actor-values.ts';
import { isWorldContent, type WorldContent } from './world-content.ts';
import { compileMissionProgram, MISSION_TIMING_POLICY, MISSION_LOGIC_LIMITS, MissionLogicError, type MissionBinding, type MissionCompilation, type MissionProgram } from './mission-logic.ts';
import { missionEventAttachmentFlags, missionActionAttachmentFlags } from './mission-binding-flags.ts';

export const MISSION_BINDINGS_POLICY = 'webra2-initial-tag-bindings-1' as const;
export const MISSION_BINDINGS_LIMITS = Object.freeze({ bytes:16*1024**2, sourceRows:100000, triggers:1024, tags:1024,
  actors:2048, cells:8192, references:16384, chainLinks:8192, diagnostics:16384, work:262144, serializedBytes:8*1024**2 });
type Limits = { -readonly [K in keyof typeof MISSION_BINDINGS_LIMITS]: number };
export interface MissionBindingsInput {
  readonly world:WorldContent; readonly definitions:EntityDefinitions; readonly rules:RuntimeIni;
  readonly mission:Readonly<{source:ScenarioLogicSource;bytes:Uint8Array}>; readonly difficulty:0|1|2;
}
export interface MissionBindingDiagnostic { readonly code:string; readonly subjectId:string; readonly origin:IniOrigin|null }
export interface MissionBindingTrigger {
  readonly id:string; readonly sourceId:string; readonly sourceOrder:number; readonly origin:IniOrigin;
  readonly ownerRaw:string; readonly countryId:string|null; readonly countryIndex:number|null;
  readonly initialHouseListId:string|null; readonly countryResolution:'named'|'none-first-country'|'unsupported';
  readonly attachedId:string|null; readonly disabledRaw:string; readonly difficultyRaw:readonly string[];
  readonly initiallyEnabled:boolean|null; readonly transferRaw:string; readonly ownFlags:number;
}
export interface MissionBindingObject {
  readonly entityId:number; readonly rowId:string; readonly typeId:string|null; readonly ownerId:string|null;
  readonly tagRaw:string|null; readonly tagId:string|null; readonly resolution:'none'|'id'|'name'|'unsupported'; readonly origin:IniOrigin;
}
export interface MissionBindingCell {
  readonly id:string; readonly sourceKey:string; readonly x:number|null; readonly y:number|null;
  readonly tagRaw:string; readonly tagId:string|null; readonly resolution:'none'|'id'|'unsupported'; readonly origin:IniOrigin;
}
export interface MissionBindingGroup {
  readonly id:string; readonly tagId:string; readonly sourceId:string; readonly sourceOrder:number; readonly name:string;
  readonly origin:IniOrigin; readonly persistenceRaw:string; readonly persistence:0|1|2|null;
  /** Source head-to-tail order; constructed native trigger instances are reversed. */
  readonly declaredChain:readonly string[]; readonly runtimeChain:readonly string[]; readonly flags:number;
  readonly objectEntityIds:readonly number[]; readonly cellIds:readonly string[];
  /** Lists share the runtime tag. They do not increment native InstanceCount. */
  readonly memberships:Readonly<{map:boolean;scenario:boolean;houseId:string|null}>;
  readonly initialReferenceCount:number; readonly defaultCell:Readonly<{x:number;y:number}>|null;
  readonly allocated:boolean; readonly dispatchAttachmentIds:readonly string[];
}
export interface MissionBindingCatalog {
  readonly policy:typeof MISSION_BINDINGS_POLICY; readonly profile:ProfileId; readonly source:ScenarioLogicSource;
  readonly fingerprint:string; readonly worldSha256:string; readonly worldContentSha256:string;
  readonly definitionsSha256:string; readonly rules:RuntimeIni['layers']; readonly difficulty:0|1|2;
  readonly triggers:readonly MissionBindingTrigger[]; readonly tags:readonly MissionBindingGroup[];
  readonly objects:readonly MissionBindingObject[]; readonly cells:readonly MissionBindingCell[];
  readonly diagnostics:readonly MissionBindingDiagnostic[]; readonly identityComplete:boolean;
  readonly coverage:Readonly<{triggers:number;tags:number;allocatedTags:number;objectAttachments:number;cellAttachments:number;scenarioTags:number;mapTags:number;houseTags:number;nativeReferences:number}>;
  readonly canStartCampaign:false; readonly nativeBehaviorVerified:false;
}
export interface MissionBindingAuthority {
  readonly policy:typeof MISSION_BINDINGS_POLICY; readonly catalogSha256:string; readonly worldSha256:string;
  readonly program:MissionProgram; readonly bindings:readonly MissionBinding[];
  readonly initialFlagState:'external-authenticated-state-required'; readonly dynamicAttachments:false;
}
export interface MissionBindingPreparation {
  readonly catalogSha256:string; readonly compilation:MissionCompilation|null; readonly authority:MissionBindingAuthority|null;
  readonly diagnostics:readonly string[]; readonly canStartCampaign:false;
}
export class MissionBindingsError extends Error { constructor(readonly code:string){super(`mission-bindings-${code}`);this.name='MissionBindingsError';} }
function fail(code:string):never {throw new MissionBindingsError(code);}
function exact(v:unknown,keys:readonly string[]):asserts v is Record<string,unknown>{
  if(!v||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)fail('record');
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value'in d)||!d.enumerable)fail('record');}
}
function limits(v:Partial<Limits>):Limits{
  if(!v||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('limits');const cap:Limits={...MISSION_BINDINGS_LIMITS};
  for(const k of Reflect.ownKeys(v)){if(typeof k!=='string'||!Object.hasOwn(cap,k))fail('limits');const d=Object.getOwnPropertyDescriptor(v,k)!;
    if(!('value'in d)||!Number.isSafeInteger(d.value)||Object.is(d.value,-0)||d.value<0||d.value>cap[k as keyof Limits])fail('limits');cap[k as keyof Limits]=d.value;}
  return cap;
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
const fold=(s:string)=>s.replace(/[A-Z]/g,c=>c.toLowerCase());
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const hash=(b:Uint8Array)=>Array.from(sha256(b),n=>n.toString(16).padStart(2,'0')).join('');
const identifier=(s:string)=>s.length>0&&s.length<=24&&/^[\x20-\x7e]+$/.test(s)&&!/[\[\]=,;]/.test(s)&&!['none','<none>'].includes(fold(s));
const none=(s:string)=>fold(s)==='none'||fold(s)==='<none>';
export interface MissionBindingSourceContext {
  readonly logic:ScenarioLogic; readonly world:WorldContent;
  readonly countries:ScenarioConstruction['countries']; readonly houses:ScenarioConstruction['houses'];
}
const catalogs=new WeakMap<MissionBindingCatalog,MissionBindingSourceContext>();
/** Same-realm immutable source context; copied catalog metadata grants no access. */
export function missionBindingSourceContext(catalog:MissionBindingCatalog):MissionBindingSourceContext {
  const context=catalogs.get(catalog);if(!context)fail('catalog');return context;
}
const authorities=new WeakSet<object>();
export const isMissionBindingCatalog=(v:unknown):v is MissionBindingCatalog=>!!v&&typeof v==='object'&&catalogs.has(v as MissionBindingCatalog);
export const isMissionBindingAuthority=(v:unknown):v is MissionBindingAuthority=>!!v&&typeof v==='object'&&authorities.has(v);

/** Fresh base-world attachments only. Physical rule-byte authentication remains the verified importer's responsibility. */
export function compileMissionBindings(input:MissionBindingsInput,options:Partial<Limits>={}):MissionBindingCatalog{
  exact(input,['world','definitions','rules','mission','difficulty']);exact(input.mission,['source','bytes']);exact(input.mission.source,['id','profile','sha256']);
  const cap=limits(options),{world,definitions,rules,mission,difficulty}=input;
  let work=0,references=0,links=0;
  const charge=(n=1)=>{if(n>cap.work-work)fail('work-limit');work+=n;};
  const reference=()=>{if(++references>cap.references)fail('reference-limit');charge();};
  if(!isWorldContent(world)||!isEntityDefinitions(definitions))fail('factory');
  if(![0,1,2].includes(difficulty)||Object.is(difficulty,-0))fail('difficulty');
  if(world.definitionsSha256!==definitions.fingerprint||world.model.sourceSha256!==definitions.source.sha256||
    mission.source.id!==definitions.source.id||mission.source.profile!==definitions.source.profile||mission.source.sha256!==definitions.source.sha256||world.model.contentIdentity.profile!==definitions.profile)fail('source-join');
  const byteProto=Object.getPrototypeOf(Uint8Array.prototype),byteGetter=Object.getOwnPropertyDescriptor(byteProto,'byteLength')!.get!;
  if(!mission.bytes||Object.getPrototypeOf(mission.bytes)!==Uint8Array.prototype)fail('bytes');
  const size=byteGetter.call(mission.bytes) as number,buffer=Object.getOwnPropertyDescriptor(byteProto,'buffer')!.get!.call(mission.bytes);
  if(!(buffer instanceof ArrayBuffer)||Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get?.call(buffer)||size<1||size>cap.bytes)fail('bytes');
  const bytes=new Uint8Array(size);Uint8Array.prototype.set.call(bytes,mission.bytes);if(hash(bytes)!==definitions.source.sha256)fail('map-hash');
  const ruleView=createIniSourceView(rules);if(ruleView.profile!==definitions.profile||fingerprint(rules.layers,cap.serializedBytes)!==fingerprint(definitions.sources.rules,cap.serializedBytes))fail('rule-join');
  if(world.placements.length>cap.actors)fail('actor-limit');
  charge(world.placements.length*3+world.model.entities.length);
  const objects=compileScenarioObjects({profile:definitions.profile,source:definitions.source,bytes},{inputBytes:cap.bytes,rows:cap.sourceRows,objects:cap.actors});
  const construction=assembleScenarioDefinitions({objects,rules},{placements:cap.actors});
  const modelEntities=new Map(world.model.entities.map(e=>[e.id,e]));
  const sourcePlacements=new Map(construction.placements.map(p=>[p.rowId,p])),typed=new Map(definitions.placements.map(p=>[p.rowId,p]));
  if(objects.placements.length!==world.placements.length||construction.placements.length!==world.placements.length||typed.size!==world.placements.length)fail('placement-join');
  for(const p of world.placements){const s=sourcePlacements.get(p.rowId),t=typed.get(p.rowId),m=modelEntities.get(p.entityId);
    if(!s||!t||!m||s.typeId!==p.typeId||s.typeId!==t.typeId||s.owner.houseId!==p.ownerId||s.owner.houseId!==t.ownerId||m.rowId!==p.rowId)fail('placement-join');}
  charge(world.players.length+construction.houses.length+construction.countries.length);
  if(world.players.length!==construction.houses.length||world.players.some((p,i)=>{const h=construction.houses[i]!;return p.playerId!==h.index||p.houseId!==h.id||p.name!==h.name;}))fail('house-join');
  const countries=new Map<string,typeof construction.countries[number]>(),houses=new Map<string,typeof construction.houses[number]>();
  for(const c of construction.countries)for(const key of [fold(c.alias.value),fold(c.name)])if(!countries.has(key))countries.set(key,c);
  for(const h of construction.houses)if(h.country.id&&!houses.has(h.country.id))houses.set(h.country.id,h);
  const logic=compileScenarioLogic({profile:definitions.profile,source:definitions.source,bytes},{inputBytes:cap.bytes,rows:cap.sourceRows});
  if(logic.triggers.length>cap.triggers||logic.tags.length>cap.tags)fail('declaration-limit');
  const view=createIniSourceView(logic.ini),stage=view.stages[0]!;
  const diagnostics:MissionBindingDiagnostic[]=[];
  const diagnostic=(code:string,subjectId:string,origin:IniOrigin|null=null)=>{if(diagnostics.length>=cap.diagnostics)fail('diagnostic-limit');diagnostics.push({code,subjectId,origin});};
  const consumed=new Set(['Basic','Triggers','Events','Actions','Tags','CellTags','Infantry','Units','Aircraft','Structures']);
  for(const name of consumed){charge(stage.sections.length);const matches=stage.sections.filter(s=>fold(s.name)===fold(name));
    if(matches.length>1)diagnostic('repeated-consumed-section',name);if(matches.some(s=>s.name!==name))diagnostic('non-native-section-case',name);}
  for(const d of construction.diagnostics)if(d.severity==='unsupported')diagnostic('construction:'+d.code,d.subjectId,d.origin);
  // Native loaders use comma strtok (empty fields collapse), fixed read buffers, and no per-token trimming.
  // Preserve the retained text, but do not promote a differently normalized row into binding authority.
  for(const table of [logic.triggers,logic.tags,logic.events,logic.actions])for(const record of table){
    charge(record.row.tokens.length);const row=record.row,origin=row.entry.selected,maximum=record.id.startsWith('tag:')?127:511;
    if(origin.rawValue.split(';',1)[0]!.length>maximum||row.tokens.some(t=>!t.length||t!==t.trim()||/[^\x20-\x7e]/.test(t)))
      diagnostic('native-token-framing',record.id,origin);
  }
  const events=new Map(logic.events.map(r=>[r.id.slice(10),r])),actions=new Map(logic.actions.map(r=>[r.id.slice(11),r]));
  // Paired VariableNames source loaders expose 50 RA2 locals and 100 YR locals.
  // The generic VM's 100-slot save shape is not a native source grant for RA2's upper half.
  if(definitions.profile==='ra2')for(const [table,ops] of [[logic.events,[36,37]],[logic.actions,[56,57]]] as const)
    for(const row of table)for(const instruction of row.instructions){charge();
      const raw=instruction.parameters[1];if(ops.some(op=>op===instruction.opcode)&&raw!==undefined&&/^(?:0|[1-9][0-9]*)$/.test(raw)&&Number(raw)>=50)
        diagnostic('ra2-native-local-index',instruction.id,row.row.entry.selected);
    }
  const triggers:MissionBindingTrigger[]=[],triggerMap=new Map<string,MissionBindingTrigger>();
  for(const [order,t] of [...logic.triggers].sort((a,b)=>a.row.entry.selected.line-b.row.entry.selected.line).entries()){
    charge();const origin=t.row.entry.selected,rawId=origin.keySpelling;
    if(!identifier(rawId))diagnostic('unsupported-trigger-id',t.id,origin);
    if(origin.rawValue.split(';',1)[0]!.length>511||/[\x00-\x1f\x7f-\uffff]/.test(t.row.tokens.join(',')))diagnostic('native-trigger-row-framing',t.id,origin);
    const flags=[t.disabledRaw,t.easyRaw,t.mediumRaw,t.hardRaw];if(flags.some(v=>v!=='0'&&v!=='1'))diagnostic('unsupported-trigger-flags',t.id,origin);
    if(t.name.length>48)diagnostic('native-trigger-name-truncation',t.id,origin);
    const country=fold(t.ownerSelector)==='<none>'?construction.countries[0]:countries.get(fold(t.ownerSelector));
    if(!country)diagnostic('unresolved-trigger-country',t.id,origin);
    const house=country?houses.get(country.id):undefined;
    const attached=none(t.attachedTrigger)?null:`trigger:${fold(t.attachedTrigger)}`;
    let ownFlags=0;for(const e of events.get(t.id.slice(8))?.instructions??[]){charge();ownFlags|=missionEventAttachmentFlags(definitions.profile,e.opcode);}
    for(const a of actions.get(t.id.slice(8))?.instructions??[]){charge();ownFlags|=missionActionAttachmentFlags(a.opcode);}
    const row:MissionBindingTrigger={id:t.id,sourceId:rawId,sourceOrder:order,origin,ownerRaw:t.ownerSelector,countryId:country?.id??null,countryIndex:country?.index??null,
      initialHouseListId:house?.id??null,countryResolution:country?(fold(t.ownerSelector)==='<none>'?'none-first-country':'named'):'unsupported',attachedId:attached,
      disabledRaw:t.disabledRaw,difficultyRaw:[t.easyRaw,t.mediumRaw,t.hardRaw],initiallyEnabled:flags.every(v=>v==='0'||v==='1')?t.disabledRaw==='0'&&flags[difficulty+1]==='1':null,transferRaw:t.tailRaw,ownFlags};
    triggers.push(row);triggerMap.set(row.id,row);
  }
  type Group=Omit<{-readonly[K in keyof MissionBindingGroup]:MissionBindingGroup[K]},'objectEntityIds'|'cellIds'>&{objectEntityIds:number[];cellIds:string[]};const tags:Group[]=[],tagMap=new Map<string,Group>();
  for(const [order,t] of [...logic.tags].sort((a,b)=>a.row.entry.selected.line-b.row.entry.selected.line).entries()){
    charge();const origin=t.row.entry.selected,rawId=origin.keySpelling;
    if(!identifier(rawId))diagnostic('unsupported-tag-id',t.id,origin);
    if(origin.rawValue.split(';',1)[0]!.length>127||/[\x00-\x1f\x7f-\uffff]/.test(t.row.tokens.join(',')))diagnostic('native-tag-row-framing',t.id,origin);
    if(t.name.length>48)diagnostic('native-tag-name-truncation',t.id,origin);
    const persistence=/^[012]$/.test(t.typeRaw)?Number(t.typeRaw) as 0|1|2:null;if(persistence===null)diagnostic('unsupported-tag-persistence',t.id,origin);
    const chain:string[]=[],seen=new Set<string>();let next:string|null=`trigger:${fold(t.trigger)}`,flags=0;
    while(next){charge();if(++links>cap.chainLinks)fail('chain-limit');if(seen.has(next)){diagnostic('trigger-chain-cycle',t.id,origin);break;}seen.add(next);
      const tr=triggerMap.get(next);if(!tr){diagnostic('undeclared-trigger-reference',t.id,origin);break;}chain.push(next);flags|=tr.ownFlags;next=tr.attachedId;}
    const first=triggerMap.get(chain[0]??''),houseId=flags&8?first?.initialHouseListId??null:null;
    if(flags&8&&!houseId)diagnostic('unresolved-house-list-owner',t.id,origin);
    const row:Group={id:`binding:${t.id}`,tagId:t.id,sourceId:rawId,sourceOrder:order,name:t.name,origin,persistenceRaw:t.typeRaw,persistence,
      declaredChain:chain,runtimeChain:[...chain].reverse(),flags,objectEntityIds:[],cellIds:[],memberships:{map:!!(flags&4),scenario:!!(flags&16),houseId},
      initialReferenceCount:0,defaultCell:null,allocated:!!(flags&28),dispatchAttachmentIds:[]};tags.push(row);tagMap.set(row.tagId,row);
  }
  for(const t of triggers)if(t.attachedId&&!triggerMap.has(t.attachedId))diagnostic('undeclared-attached-trigger',t.id,t.origin);
  for(const cycle of logic.triggerAttachmentCycles)diagnostic('trigger-chain-cycle',cycle[0]??'');
  // Native lookup scans declaration order, checking each ID and name before advancing.
  const objectTags=new Map<string,Group>();for(const tag of tags)for(const key of [fold(tag.sourceId),fold(tag.name)])if(!objectTags.has(key))objectTags.set(key,tag);
  const worldRows=new Map(world.placements.map(p=>[p.rowId,p]));const objectRows:MissionBindingObject[]=[];
  for(const p of objects.placements){charge();const w=worldRows.get(p.row.id)!;let tag:Group|undefined,resolution:MissionBindingObject['resolution']='none';
    if(p.tag!==null&&!none(p.tag)){reference();tag=objectTags.get(fold(p.tag));
      resolution=tag?(fold(tag.sourceId)===fold(p.tag)?'id':'name'):'unsupported';if(!tag)diagnostic('unknown-object-tag',p.row.id,p.row.origin);
      if(!p.tag||p.row.tokens[p.kind==='infantry'?8:p.kind==='structure'?6:7]!==p.tag||p.row.tokens.slice(0,p.kind==='infantry'?9:p.kind==='structure'?7:8).some(t=>!t.length)||/[\x00-\x1f\x7f-\uffff]/.test(p.tag)||p.row.origin.rawValue.split(';',1)[0]!.length>127){diagnostic('native-object-tag-framing',p.row.id,p.row.origin);resolution='unsupported';}
    }
    const row:MissionBindingObject={entityId:w.entityId,rowId:p.row.id,typeId:w.typeId,ownerId:w.ownerId,tagRaw:p.tag,tagId:tag?.tagId??null,resolution,origin:p.row.origin};objectRows.push(row);
    if(tag){tag.objectEntityIds.push(w.entityId);tag.allocated=true;tag.initialReferenceCount++;}
  }
  const cellSections=stage.sections.filter(s=>fold(s.name)==='celltags');let cellCount=0;for(const s of cellSections){if(s.entries.length>cap.cells-cellCount)fail('cell-limit');cellCount+=s.entries.length;}
  const cellRows:MissionBindingCell[]=[],usedCells=new Set<number>();
  for(const s of cellSections)for(const e of s.entries){reference();const packed=/^(?:0|[1-9][0-9]{0,5})$/.test(e.key)?Number(e.key):null;
    const x=packed===null?null:packed%1000,y=packed===null?null:Math.floor(packed/1000),valid=x!==null&&y!==null&&x<=511&&y<=511;
    const id=`cell:${e.key}`;if(!valid)diagnostic('unsupported-cell-coordinate',id,e.origin);
    if(packed!==null&&usedCells.has(packed))diagnostic('duplicate-cell-coordinate',id,e.origin);if(packed!==null)usedCells.add(packed);
    const tag=none(e.value)?undefined:tagMap.get(`tag:${fold(e.value)}`),resolution=none(e.value)?'none':tag?'id':'unsupported';
    if(!none(e.value)&&(!identifier(e.value)||e.value.length>127))diagnostic('native-cell-tag-framing',id,e.origin);
    if(resolution==='unsupported')diagnostic('undeclared-cell-tag',id,e.origin);
    cellRows.push({id,sourceKey:e.key,x,y,tagRaw:e.value,tagId:tag?.tagId??null,resolution,origin:e.origin});
    if(tag){tag.cellIds.push(id);tag.initialReferenceCount++;tag.allocated=true;if(valid)tag.defaultCell={x:x!,y:y!};}
  }
  let attachments=0;for(const tag of tags){const ids=[...tag.objectEntityIds.map(id=>`entity:${id}`),...tag.cellIds];
    if(tag.memberships.map)ids.push(`map-list:${tag.tagId}`);if(tag.memberships.scenario)ids.push(`scenario-list:${tag.tagId}`);if(tag.memberships.houseId)ids.push(`house-list:${tag.memberships.houseId}:${tag.tagId}`);
    if(ids.length>cap.references-attachments)fail('attachment-limit');attachments+=ids.length;tag.dispatchAttachmentIds=ids.sort(compare);}
  const metadata={policy:MISSION_BINDINGS_POLICY,profile:definitions.profile,source:definitions.source,worldSha256:world.model.sha256,worldContentSha256:world.sha256,
    definitionsSha256:definitions.fingerprint,rules:rules.layers,difficulty,triggers,tags,objects:objectRows,cells:cellRows,diagnostics,identityComplete:diagnostics.length===0,
    coverage:{triggers:triggers.length,tags:tags.length,allocatedTags:tags.filter(t=>t.allocated).length,objectAttachments:tags.reduce((n,t)=>n+t.objectEntityIds.length,0),cellAttachments:tags.reduce((n,t)=>n+t.cellIds.length,0),scenarioTags:tags.filter(t=>t.memberships.scenario).length,mapTags:tags.filter(t=>t.memberships.map).length,houseTags:tags.filter(t=>t.memberships.houseId).length,nativeReferences:tags.reduce((n,t)=>n+t.initialReferenceCount,0)},canStartCampaign:false as const,nativeBehaviorVerified:false as const};
  const result=freeze({...metadata,fingerprint:fingerprint(metadata,cap.serializedBytes)});catalogs.set(result,Object.freeze({logic,world,countries:construction.countries,houses:construction.houses}));return result;
}

/** No caller-supplied bindings or flags are promoted to authority. This does not start or step a VM. */
export async function prepareMissionBindings(catalog:MissionBindingCatalog,cues?:MissionCueCatalog,cells?:MissionCellEntrySource,objects?:MissionObjectEventSource,teams?:MissionTeamActionSource,audio?:MissionAudioPolicyCatalog):Promise<MissionBindingPreparation>{
  const state=catalogs.get(catalog);if(!state)fail('catalog');
  if(cells!==undefined&&(!isMissionCellEntrySource(cells)||missionCellEntrySourceBindings(cells)!==catalog))fail('cell-source');
  if(objects!==undefined&&(!isMissionObjectEventSource(objects)||missionObjectEventSourceBindings(objects)!==catalog))fail('object-source');
  if(teams!==undefined&&(!isMissionTeamActionSource(teams)||missionTeamActionSourceContext(teams).bindings!==catalog))fail('team-source');
  let compilation:MissionCompilation|null=null;const diagnostics=catalog.diagnostics.map(d=>`catalog:${d.code}`);
  try{compilation=await compileMissionProgram(state.logic,{contentIdentity:state.world.model.contentIdentity,difficulty:catalog.difficulty,timingPolicy:MISSION_TIMING_POLICY},async b=>hash(b),cues,cells,objects,teams,audio);}
  catch(e){if(e instanceof MissionLogicError)diagnostics.push(`vm:${e.code}`);else throw e;}
  if(compilation?.diagnostics.length)diagnostics.push('vm:whole-program-unsupported');
  const bindings=catalog.tags.filter(t=>t.allocated).map(t=>({id:t.id,tagId:t.tagId,attachmentIds:t.dispatchAttachmentIds}));
  if(bindings.length>MISSION_LOGIC_LIMITS.bindings||bindings.reduce((n,b)=>n+b.attachmentIds.length,0)>MISSION_LOGIC_LIMITS.attachments||catalog.tags.filter(t=>t.allocated).reduce((n,t)=>n+t.runtimeChain.length,0)>MISSION_LOGIC_LIMITS.instances)diagnostics.push('vm:binding-capacity');
  let authority:MissionBindingAuthority|null=null;
  if(!diagnostics.length&&compilation?.program){authority=freeze({policy:MISSION_BINDINGS_POLICY,catalogSha256:catalog.fingerprint,worldSha256:catalog.worldSha256,program:compilation.program,bindings,initialFlagState:'external-authenticated-state-required',dynamicAttachments:false});authorities.add(authority);}
  return freeze({catalogSha256:catalog.fingerprint,compilation,authority,diagnostics,canStartCampaign:false});
}
