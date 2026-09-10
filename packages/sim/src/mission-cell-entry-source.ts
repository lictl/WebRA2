// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_CELL_ENTRY_PROVENANCE.md.
import type { ProfileId } from '../../contracts/src/index.ts';
import type { IniOrigin } from '../../content/src/runtime-ini.ts';
import { combatActorFingerprint } from '../../content/src/combat-actor-values.ts';
import { isMissionBindingCatalog, missionBindingSourceContext, type MissionBindingCatalog } from './mission-bindings.ts';

export const MISSION_CELL_ENTRY_SOURCE_POLICY = 'webra2-initial-cell-entry-source-1' as const;
export const MISSION_CELL_ENTRY_SOURCE_LIMITS = Object.freeze({ events:4096, cells:8192, actors:2048, references:32768,
  work:262144, diagnostics:32768, serializedBytes:16*1024**2 });
type Limits = { -readonly [K in keyof typeof MISSION_CELL_ENTRY_SOURCE_LIMITS]:number };
export interface MissionCellEntryEvent {
  readonly instructionId:string; readonly triggerId:string; readonly parameters:readonly string[]; readonly origin:IniOrigin;
  readonly selector:Readonly<{kind:'any'|'first-country-house'|'unsupported';countryIndex:number|null;houseId:string|null;playerId:number|null}>;
  readonly status:'supported'|'unsupported'; readonly reasons:readonly string[];
}
export interface MissionCellEntryCell { readonly cellId:string;readonly bindingId:string;readonly x:number;readonly y:number }
export interface MissionCellEntryActor {
  readonly entityId:number;readonly rowId:string;readonly typeId:string;readonly ownerId:string|null;readonly playerId:number|null;
  readonly sourceMission:string|null;readonly onBridge:boolean|null;readonly followerIndex:number|null;readonly origin:IniOrigin;
  readonly kind:string;readonly status:'supported'|'unsupported';readonly reasons:readonly string[];
}
export interface MissionCellEntrySource {
  readonly policy:typeof MISSION_CELL_ENTRY_SOURCE_POLICY;readonly sha256:string;readonly profile:ProfileId;
  readonly source:MissionBindingCatalog['source'];readonly catalogSha256:string;readonly worldSha256:string;readonly worldContentSha256:string;
  readonly events:readonly MissionCellEntryEvent[];readonly cells:readonly MissionCellEntryCell[];
  /** All initial references, including unresolved ones which cannot enter the coordinate dispatch index. */
  readonly cellReferences:MissionBindingCatalog['cells'];readonly actors:readonly MissionCellEntryActor[];
  readonly scenarioPollBindingIds:readonly string[];readonly diagnostics:readonly Readonly<{code:string;subjectId:string}>[];
  readonly coverage:Readonly<{events:number;supportedEvents:number;cellReferences:number;resolvedCells:number;actors:number;supportedActors:number;scenarioPollBindings:number}>;
  readonly context:'initial-ordinary-ground-uncloaked-no-transport-no-dynamic-ownership';
  readonly yrEntrantHouseEffect:'retained-entrant-owner-context-not-native-object-mutation';
  readonly canStartCampaign:false;readonly nativeBehaviorVerified:false;
}
export class MissionCellEntrySourceError extends Error { constructor(readonly code:string){super(`mission-cell-entry-source-${code}`);this.name='MissionCellEntrySourceError';} }
function fail(code:string):never{throw new MissionCellEntrySourceError(code);}
function data(input:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Reflect.ownKeys(input).length!==keys.length)fail('record');
  const result:Record<string,unknown>=Object.create(null);
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!('value'in d)||!d.enumerable)fail('record');result[key]=d.value;}
  return result;
}
function limits(input:Partial<Limits>):Limits{
  if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail('limits');
  const result:Limits={...MISSION_CELL_ENTRY_SOURCE_LIMITS};
  for(const key of Reflect.ownKeys(input)){if(typeof key!=='string'||!Object.hasOwn(result,key))fail('limits');const d=Object.getOwnPropertyDescriptor(input,key)!;
    if(!('value'in d)||!d.enumerable||!Number.isSafeInteger(d.value)||Object.is(d.value,-0)||d.value<0||d.value>result[key as keyof Limits])fail('limits');result[key as keyof Limits]=d.value;}
  return result;
}
function freeze<T>(input:T):T{if(input&&typeof input==='object'&&!Object.isFrozen(input)){for(const value of Object.values(input))freeze(value);Object.freeze(input);}return input;}
const sources=new WeakMap<MissionCellEntrySource,MissionBindingCatalog>();
export const isMissionCellEntrySource=(value:unknown):value is MissionCellEntrySource=>!!value&&typeof value==='object'&&sources.has(value as MissionCellEntrySource);
export function missionCellEntrySourceBindings(source:MissionCellEntrySource):MissionBindingCatalog {const result=sources.get(source);if(!result)fail('factory');return result;}

/** No observations, callbacks, dynamic ownership, tag allocation or VM authority are accepted here. */
export function compileMissionCellEntrySource(input:Readonly<{bindings:MissionBindingCatalog}>,options:Partial<Limits>={}):MissionCellEntrySource{
  const bindings=data(input,['bindings']).bindings;if(!isMissionBindingCatalog(bindings))fail('factory');const cap=limits(options);
  const {logic,world,countries,houses}=missionBindingSourceContext(bindings);
  if(bindings.cells.length>cap.cells||world.model.entities.length>cap.actors)fail('count-limit');
  let work=0,references=0,eventCount=0;
  const charge=(n=1)=>{if(n>cap.work-work)fail('work-limit');work+=n;};
  const reference=(n=1)=>{if(n>cap.references-references)fail('reference-limit');references+=n;charge(n);};
  charge(bindings.triggers.length+bindings.tags.length+bindings.objects.length+world.placements.length+world.players.length+countries.length+houses.length);
  for(const row of logic.events)for(const instruction of row.instructions){charge();if(instruction.opcode===1&&++eventCount>cap.events)fail('event-limit');}
  const diagnostics:{code:string;subjectId:string}[]=[];
  const diagnostic=(code:string,subjectId:string)=>{if(diagnostics.length>=cap.diagnostics)fail('diagnostic-limit');diagnostics.push({code,subjectId});};
  for(const layer of [...logic.ini.layers,...bindings.rules]){charge();if(layer.encoding!=='byte-preserving-ascii-compatible')diagnostic('native-byte-encoding',layer.id);}
  for(const d of bindings.diagnostics){charge();diagnostic('bindings:'+d.code,d.subjectId);}
  const triggers=new Set(bindings.triggers.map(t=>t.id)),tags=new Map(bindings.tags.map(t=>[t.tagId,t]));
  const firstHouses=new Map<number,typeof houses[number]>();
  // The genuine construction array is native allocation order. No Name/ID alias lookup is used by event1.
  for(const house of houses){reference();if(house.country.index!==null&&!firstHouses.has(house.country.index))firstHouses.set(house.country.index,house);}
  const players=new Map(world.players.map(p=>[p.houseId,p]));
  const events:MissionCellEntryEvent[]=[];
  for(const row of logic.events)for(const instruction of row.instructions){charge();if(instruction.opcode!==1)continue;
    const parameters=row.row.tokens.slice(instruction.tokenStart+1,instruction.tokenStart+instruction.tokenCount),triggerId=`trigger:${row.id.slice('event-row:'.length)}`;
    const reasons:string[]=[];reference(parameters.length);charge(parameters.reduce((n,s)=>n+s.length,0));
    if(!triggers.has(triggerId))reasons.push('missing-trigger');
    const raw=parameters[1],number=parameters.length===2&&parameters[0]==='0'&&raw!==undefined&&/^(?:-1|0|[1-9][0-9]*)$/.test(raw)?Number(raw):null;
    let selector:MissionCellEntryEvent['selector']={kind:'unsupported',countryIndex:null,houseId:null,playerId:null};
    if(number===null||!Number.isSafeInteger(number)||number>0x7fffffff)reasons.push('unsupported-operands');
    else if(number===-1)selector={kind:'any',countryIndex:-1,houseId:null,playerId:null};
    else {reference();const house=firstHouses.get(number),player=house?players.get(house.id):undefined;
      if(!house||!player)reasons.push('missing-first-country-house');
      else if(house.country.status==='unsupported')reasons.push('unsupported-house-country');
      else selector={kind:'first-country-house',countryIndex:number,houseId:house.id,playerId:player.playerId};
    }
    const event:MissionCellEntryEvent={instructionId:instruction.id,triggerId,parameters,origin:row.row.entry.selected,selector,status:reasons.length?'unsupported':'supported',reasons};events.push(event);
    for(const reason of reasons)diagnostic(reason,instruction.id);
  }
  const cells:MissionCellEntryCell[]=[],addresses=new Set<number>();
  for(const cell of bindings.cells){reference();const tag=cell.tagId?tags.get(cell.tagId):undefined;if(tag)charge(tag.cellIds.length);
    if(cell.resolution!=='id'||!tag||!tag.allocated||cell.x===null||cell.y===null||!tag.cellIds.includes(cell.id)){
      diagnostic('unsupported-cell-reference',cell.id);continue;
    }
    const address=cell.y*512+cell.x;
    if(addresses.has(address)){diagnostic('duplicate-cell-coordinate',cell.id);continue;}
    addresses.add(address);cells.push({cellId:cell.id,bindingId:tag.id,x:cell.x,y:cell.y});
  }
  const placements=new Map(world.placements.map(p=>[p.entityId,p])),objects=new Map(bindings.objects.map(o=>[o.entityId,o]));
  const actors:MissionCellEntryActor[]=[];
  for(const entity of world.model.entities){reference();const p=placements.get(entity.id),object=objects.get(entity.id),reasons:string[]=[];
    if(!p||!object||p.rowId!==entity.rowId||object.rowId!==entity.rowId||p.typeId!==object.typeId||(p.typeId??`unresolved-${entity.id}`)!==entity.typeId||p.ownerId!==object.ownerId||p.playerId!==entity.owner)fail('actor-join');
    let sourceMission:string|null=null,onBridge:boolean|null=null,followerIndex:number|null=null;
    if(entity.kind!=='infantry'&&entity.kind!=='unit')reasons.push('unsupported-actor-family');
    else {
      const raw=object.origin.rawValue;charge(raw.length);
      const text=raw.split(';',1)[0]!.trim();
      // Paired native placement loaders use a 128-byte buffer and comma strtok, then integer bridge/follower fields.
      if(text.length>127||/[^\x20-\x7e]/.test(text))reasons.push('unsupported-source-row-framing');
      let count=1;for(const character of text)if(character===',')count++;reference(count);
      const tokens=text.split(',');sourceMission=tokens[6]??null;
      if(tokens.length!==14||tokens.some(t=>!t.length||t!==t.trim()))reasons.push('unsupported-source-row-framing');
      const bridge=tokens[entity.kind==='infantry'?11:10],follower=tokens[11];
      if(bridge===undefined||! /^[+-]?[0-9]+$/.test(bridge)||!Number.isSafeInteger(Number(bridge))||Number(bridge)<-0x80000000||Number(bridge)>0x7fffffff)reasons.push('unsupported-source-bridge');
      else {onBridge=Number(bridge)!==0;if(onBridge)reasons.push('initial-bridge-layer');}
      if(entity.kind==='unit'){
        if(follower===undefined||! /^[+-]?[0-9]+$/.test(follower)||!Number.isSafeInteger(Number(follower))||Number(follower)<-0x80000000||Number(follower)>0x7fffffff)reasons.push('unsupported-source-follower');
        else {followerIndex=Number(follower)||0;if(followerIndex!==-1)reasons.push('initial-follower-link');}
      }
    }
    if(p.status!=='mobile'||entity.movementPerTick===0)reasons.push('not-source-mobile');
    if(p.playerId===null||p.ownerId===null||players.get(p.ownerId)?.playerId!==p.playerId)reasons.push('missing-initial-house');
    actors.push({entityId:entity.id,rowId:entity.rowId,typeId:entity.typeId,ownerId:p.ownerId,playerId:p.playerId,sourceMission,onBridge,followerIndex,origin:object.origin,kind:entity.kind,status:reasons.length?'unsupported':'supported',reasons});
  }
  const scenarioPollBindingIds:string[]=[];
  for(const tag of bindings.tags){charge();if(tag.allocated&&tag.memberships.scenario)scenarioPollBindingIds.push(tag.id);}
  const payload={policy:MISSION_CELL_ENTRY_SOURCE_POLICY,profile:bindings.profile,source:bindings.source,catalogSha256:bindings.fingerprint,
    worldSha256:bindings.worldSha256,worldContentSha256:bindings.worldContentSha256,events,cells,cellReferences:bindings.cells,actors,scenarioPollBindingIds,diagnostics,
    coverage:{events:events.length,supportedEvents:events.filter(e=>e.status==='supported').length,cellReferences:bindings.cells.length,resolvedCells:cells.length,
      actors:actors.length,supportedActors:actors.filter(a=>a.status==='supported').length,scenarioPollBindings:scenarioPollBindingIds.length},
    context:'initial-ordinary-ground-uncloaked-no-transport-no-dynamic-ownership' as const,
    yrEntrantHouseEffect:'retained-entrant-owner-context-not-native-object-mutation' as const,canStartCampaign:false as const,nativeBehaviorVerified:false as const};
  const result=freeze({...payload,sha256:combatActorFingerprint(payload,cap.serializedBytes)});sources.set(result,bindings);return result;
}
