// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_OBJECT_EVENT_PROVENANCE.md.
import type { ProfileId } from '../../contracts/src/index.ts';
import type { IniOrigin } from '../../content/src/runtime-ini.ts';
import { combatActorFingerprint } from '../../content/src/combat-actor-values.ts';
import { isMissionBindingCatalog, missionBindingSourceContext, type MissionBindingCatalog } from './mission-bindings.ts';

export const MISSION_OBJECT_EVENT_SOURCE_POLICY = 'webra2-initial-object-event-source-1' as const;
export const MISSION_OBJECT_EVENT_SOURCE_LIMITS = Object.freeze({events:4096,actors:2048,references:32768,work:262144,diagnostics:32768,serializedBytes:16*1024**2});
type Limits = {-readonly [K in keyof typeof MISSION_OBJECT_EVENT_SOURCE_LIMITS]:number};
export type MissionObjectEventOpcode = 6|7|44|48;
export interface MissionObjectEventInstruction {
  readonly instructionId:string;readonly triggerId:string;readonly opcode:MissionObjectEventOpcode;
  readonly parameters:readonly string[];readonly origin:IniOrigin;
  readonly selector:Readonly<{kind:'any'|'literal-house'|'unsupported';playerId:number|null;houseId:string|null}>;
  readonly latch:'transient'|'repeat-mode-only';readonly status:'supported'|'unsupported';readonly reasons:readonly string[];
}
export interface MissionObjectCallback {readonly opcode:MissionObjectEventOpcode;readonly requiresSource:boolean}
export interface MissionObjectEventActor {
  readonly entityId:number;readonly rowId:string;readonly typeId:string;readonly ownerId:string|null;readonly playerId:number|null;
  readonly kind:string;readonly sourceMission:string|null;readonly origin:IniOrigin;
  readonly tagId:string|null;readonly bindingId:string|null;readonly tagResolution:MissionBindingCatalog['objects'][number]['resolution'];
  readonly initialHealth:number|null;readonly status:'supported'|'unsupported';readonly reasons:readonly string[];
  readonly nonfatalSequence:readonly MissionObjectCallback[];readonly fatalSequence:readonly MissionObjectCallback[];
}
export interface MissionObjectEventSource {
  readonly policy:typeof MISSION_OBJECT_EVENT_SOURCE_POLICY;readonly sha256:string;readonly profile:ProfileId;
  readonly source:MissionBindingCatalog['source'];readonly catalogSha256:string;readonly worldSha256:string;readonly worldContentSha256:string;
  readonly events:readonly MissionObjectEventInstruction[];readonly actors:readonly MissionObjectEventActor[];
  /** Retains all physical references and shared tag groups, not independent per-actor VM instances. */
  readonly objectReferences:MissionBindingCatalog['objects'];readonly bindingGroups:MissionBindingCatalog['tags'];
  readonly scenarioPollBindingIds:readonly string[];readonly diagnostics:readonly Readonly<{code:string;subjectId:string}>[];
  readonly coverage:Readonly<{events:number;supportedEvents:number;actors:number;supportedActors:number;objectAttachments:number;sharedObjectBindings:number;scenarioPollBindings:number}>;
  readonly context:'initial-ordinary-positive-health-loss-fixed-owner-and-tag-no-hijacking';
  readonly destructionBoundary:'health-zero-before-death-animation-completion';
  readonly omittedCallbackKinds:readonly number[];readonly canStartCampaign:false;readonly nativeBehaviorVerified:false;
}
export class MissionObjectEventSourceError extends Error {constructor(readonly code:string){super(`mission-object-event-source-${code}`);this.name='MissionObjectEventSourceError';}}
function fail(code:string):never{throw new MissionObjectEventSourceError(code);}
function data(input:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Reflect.ownKeys(input).length!==keys.length)fail('record');
  const result:Record<string,unknown>=Object.create(null);
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!('value'in d)||!d.enumerable)fail('record');result[key]=d.value;}
  return result;
}
function limits(input:Partial<Limits>):Limits{
  if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail('limits');
  const result:Limits={...MISSION_OBJECT_EVENT_SOURCE_LIMITS};
  for(const key of Reflect.ownKeys(input)){if(typeof key!=='string'||!Object.hasOwn(result,key))fail('limits');const d=Object.getOwnPropertyDescriptor(input,key)!;
    if(!('value'in d)||!d.enumerable||!Number.isSafeInteger(d.value)||Object.is(d.value,-0)||d.value<0||d.value>result[key as keyof Limits])fail('limits');result[key as keyof Limits]=d.value;}
  return result;
}
function freeze<T>(input:T):T{if(input&&typeof input==='object'&&!Object.isFrozen(input)){for(const value of Object.values(input))freeze(value);Object.freeze(input);}return input;}
const sources=new WeakMap<MissionObjectEventSource,MissionBindingCatalog>();
export const isMissionObjectEventSource=(value:unknown):value is MissionObjectEventSource=>!!value&&typeof value==='object'&&sources.has(value as MissionObjectEventSource);
export function missionObjectEventSourceBindings(source:MissionObjectEventSource):MissionBindingCatalog{const result=sources.get(source);if(!result)fail('factory');return result;}
const recognized=(opcode:number|null):opcode is MissionObjectEventOpcode=>opcode===6||opcode===7||opcode===44||opcode===48;
const integer=(raw:string|undefined):number|null=>{
  if(raw===undefined||! /^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(raw))return null;
  const n=Number(raw);return Number.isSafeInteger(n)&&n>=-0x80000000&&n<=0x7fffffff?n:null;
};

/** Source proof only. Live damage, current ownership, callback order and tag lifetime belong to the compound runtime. */
export function compileMissionObjectEventSource(input:Readonly<{bindings:MissionBindingCatalog}>,options:Partial<Limits>={}):MissionObjectEventSource{
  const bindings=data(input,['bindings']).bindings;if(!isMissionBindingCatalog(bindings))fail('factory');const cap=limits(options);
  const {logic,world,houses}=missionBindingSourceContext(bindings);
  if(world.model.entities.length>cap.actors)fail('actor-limit');
  let work=0,references=0,eventCount=0;
  const charge=(n=1)=>{if(n>cap.work-work)fail('work-limit');work+=n;};
  const reference=(n=1)=>{if(n>cap.references-references)fail('reference-limit');references+=n;charge(n);};
  charge(bindings.triggers.length+bindings.tags.length+bindings.objects.length+world.placements.length+world.players.length+houses.length);
  for(const row of logic.events)for(const instruction of row.instructions){charge();if(recognized(instruction.opcode)&&++eventCount>cap.events)fail('event-limit');}
  const diagnostics:{code:string;subjectId:string}[]=[];
  const diagnostic=(code:string,subjectId:string)=>{if(diagnostics.length>=cap.diagnostics)fail('diagnostic-limit');diagnostics.push({code,subjectId});};
  for(const layer of [...logic.ini.layers,...bindings.rules]){charge();if(layer.encoding!=='byte-preserving-ascii-compatible')diagnostic('native-byte-encoding',layer.id);}
  for(const d of bindings.diagnostics){charge();diagnostic('bindings:'+d.code,d.subjectId);}
  const triggers=new Set(bindings.triggers.map(t=>t.id)),tags=new Map(bindings.tags.map(t=>[t.tagId,t]));
  const players=new Map(world.players.map(p=>[p.playerId,p])),playersByHouse=new Map(world.players.map(p=>[p.houseId,p]));
  const events:MissionObjectEventInstruction[]=[];
  for(const row of logic.events)for(const instruction of row.instructions){charge();if(!recognized(instruction.opcode))continue;
    const parameters=row.row.tokens.slice(instruction.tokenStart+1,instruction.tokenStart+instruction.tokenCount),triggerId=`trigger:${row.id.slice('event-row:'.length)}`;
    const reasons:string[]=[];reference(parameters.length);charge(parameters.reduce((n,s)=>n+s.length,0));
    if(!triggers.has(triggerId))reasons.push('missing-trigger');
    const number=parameters.length===2&&parameters[0]==='0'?integer(parameters[1]):null;
    let selector:MissionObjectEventInstruction['selector']={kind:'unsupported',playerId:null,houseId:null};
    if(number===null)reasons.push('unsupported-operands');
    else if(instruction.opcode!==44)selector={kind:'any',playerId:null,houseId:null};
    else {reference();const player=players.get(number),house=houses[number];
      if(!player||!house||house.index!==number||house.id!==player.houseId)reasons.push('missing-literal-house');
      else selector={kind:'literal-house',playerId:number,houseId:player.houseId};
    }
    events.push({instructionId:instruction.id,triggerId,opcode:instruction.opcode,parameters,origin:row.row.entry.selected,selector,
      latch:instruction.opcode===7||instruction.opcode===48?'repeat-mode-only':'transient',status:reasons.length?'unsupported':'supported',reasons});
    for(const reason of reasons)diagnostic(reason,instruction.id);
  }
  const placements=new Map(world.placements.map(p=>[p.entityId,p])),objects=new Map(bindings.objects.map(o=>[o.entityId,o]));
  const actors:MissionObjectEventActor[]=[];
  for(const entity of world.model.entities){reference();const p=placements.get(entity.id),object=objects.get(entity.id),reasons:string[]=[];
    if(!p||!object||p.rowId!==entity.rowId||object.rowId!==entity.rowId||p.typeId!==object.typeId||(p.typeId??`unresolved-${entity.id}`)!==entity.typeId||p.ownerId!==object.ownerId||p.playerId!==entity.owner)fail('actor-join');
    let sourceMission:string|null=null;
    if(!['infantry','unit','structure'].includes(entity.kind))reasons.push('unsupported-actor-family');
    else {
      const raw=object.origin.rawValue;charge(raw.length);const text=raw.split(';',1)[0]!.trim();
      let count=1;for(const character of text)if(character===',')count++;reference(count);
      // Keep full original placement text: no movement, bridge, rank or recruitment flag is reinterpreted here.
      if(text.length>127||/[^\x20-\x7e]/.test(text))reasons.push('unsupported-source-row-framing');
      const tokens=text.split(',');if(entity.kind!=='structure')sourceMission=tokens[6]??null;
      if(tokens.length!==(entity.kind==='structure'?17:14)||tokens.some(t=>!t.length||t!==t.trim()))reasons.push('unsupported-source-row-framing');
    }
    if(p.typeId===null)reasons.push('missing-initial-type');
    if(p.playerId===null||p.ownerId===null||playersByHouse.get(p.ownerId)?.playerId!==p.playerId)reasons.push('missing-initial-house');
    if(entity.initialHealth===null||entity.maximumHealth===null)reasons.push('unsupported-initial-health');
    const tag=object.tagId?tags.get(object.tagId):undefined;let bindingId:string|null=null;
    if(object.resolution==='none'){if(object.tagId!==null)fail('tag-join');}
    else {reference();if(tag)charge(tag.objectEntityIds.length);
      if(!tag||!tag.allocated||!tag.objectEntityIds.includes(entity.id)||!['id','name'].includes(object.resolution)){
        reasons.push('unsupported-object-reference');diagnostic('unsupported-object-reference',object.rowId);
      }else bindingId=tag.id;
    }
    const callback=(opcode:MissionObjectEventOpcode):MissionObjectCallback=>({opcode,requiresSource:opcode!==48});
    actors.push({entityId:entity.id,rowId:entity.rowId,typeId:entity.typeId,ownerId:p.ownerId,playerId:p.playerId,kind:entity.kind,
      sourceMission,origin:object.origin,tagId:object.tagId,bindingId,tagResolution:object.resolution,initialHealth:entity.initialHealth,
      status:reasons.length?'unsupported':'supported',reasons,
      nonfatalSequence:reasons.length?[]:[callback(6),callback(44)],
      fatalSequence:reasons.length?[]:(entity.kind==='unit'?[7,48,6] as const:[6,7,48] as const).map(callback)});
  }
  const scenarioPollBindingIds:string[]=[];let sharedObjectBindings=0;
  for(const tag of bindings.tags){charge();reference(tag.objectEntityIds.length+tag.cellIds.length+tag.runtimeChain.length+tag.dispatchAttachmentIds.length);
    if(tag.allocated&&tag.memberships.scenario)scenarioPollBindingIds.push(tag.id);if(tag.allocated&&tag.objectEntityIds.length>1)sharedObjectBindings++;
  }
  const payload={policy:MISSION_OBJECT_EVENT_SOURCE_POLICY,profile:bindings.profile,source:bindings.source,catalogSha256:bindings.fingerprint,
    worldSha256:bindings.worldSha256,worldContentSha256:bindings.worldContentSha256,events,actors,objectReferences:bindings.objects,bindingGroups:bindings.tags,
    scenarioPollBindingIds,diagnostics,coverage:{events:events.length,supportedEvents:events.filter(e=>e.status==='supported').length,actors:actors.length,
      supportedActors:actors.filter(a=>a.status==='supported').length,objectAttachments:actors.filter(a=>a.bindingId!==null).length,sharedObjectBindings,scenarioPollBindings:scenarioPollBindingIds.length},
    context:'initial-ordinary-positive-health-loss-fixed-owner-and-tag-no-hijacking' as const,destructionBoundary:'health-zero-before-death-animation-completion' as const,
    omittedCallbackKinds:[4,29,38,39,40,41,42,43],canStartCampaign:false as const,nativeBehaviorVerified:false as const};
  const result=freeze({...payload,sha256:combatActorFingerprint(payload,cap.serializedBytes)});sources.set(result,bindings);return result;
}
