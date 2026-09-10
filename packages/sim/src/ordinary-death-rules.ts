// SPDX-License-Identifier: GPL-3.0-or-later
// Original explicit lifecycle policy; a source adapter must supply admitted complete corpse vectors.
import { worldHash, worldInteger, worldList, worldRecord, worldSymbol, worldFail } from './world-values.ts';

export const ORDINARY_DEATH_POLICY = 'webra2-ordinary-death-combat-1' as const;
export const ORDINARY_DEATH_ENGINE_VERSION = 'webra2-world-4' as const;
export const ORDINARY_DEATH_LIMITS = Object.freeze({ actors: 2048, weapons: 1024, candidates: 64, totalCandidates: 4096, duration: 10000 });
export interface OrdinaryDeathActor {
  readonly entityId: number; readonly corpseAnimationIds: readonly string[];
  /** Explicit 15 Hz WebRA2 ticks, not native SHP frame cadence. */
  readonly sequence11Ticks: number; readonly sequence12Ticks: number;
}
export interface OrdinaryDeathWeapon { readonly weaponId: string; readonly infDeath: 1 | 2 }
export interface OrdinaryDeathRules {
  readonly policy: typeof ORDINARY_DEATH_POLICY; readonly actors: readonly OrdinaryDeathActor[];
  readonly weapons: readonly OrdinaryDeathWeapon[]; readonly sha256: string;
}
export interface OrdinaryDeathBinding {
  readonly rules: OrdinaryDeathRules;
}
const rules = new WeakSet<object>();
const bindings=new WeakMap<object,{actors:Map<number,OrdinaryDeathActor>;weapons:Map<string,OrdinaryDeathWeapon>}>();
/** Explicit engine inputs only. This factory does not authenticate native death eligibility or assets. */
export function createOrdinaryDeathRules(input: {readonly actors: readonly OrdinaryDeathActor[]; readonly weapons: readonly OrdinaryDeathWeapon[]}): OrdinaryDeathRules {
  const r=worldRecord(input,['actors','weapons']),ids=new Set<number>();let total=0;
  const actors=worldList(r.actors,ORDINARY_DEATH_LIMITS.actors).map(value=>{
    const a=worldRecord(value,['entityId','corpseAnimationIds','sequence11Ticks','sequence12Ticks']);
    const entityId=worldInteger(a.entityId,1,2147483647);if(ids.has(entityId))worldFail('death-duplicate-actor');ids.add(entityId);
    const corpseAnimationIds=worldList(a.corpseAnimationIds,ORDINARY_DEATH_LIMITS.candidates).map(worldSymbol);
    total+=corpseAnimationIds.length;if(!corpseAnimationIds.length||total>ORDINARY_DEATH_LIMITS.totalCandidates)worldFail('death-candidate-limit');
    return Object.freeze({entityId,corpseAnimationIds:Object.freeze(corpseAnimationIds),
      sequence11Ticks:worldInteger(a.sequence11Ticks,1,ORDINARY_DEATH_LIMITS.duration),sequence12Ticks:worldInteger(a.sequence12Ticks,1,ORDINARY_DEATH_LIMITS.duration)});
  }).sort((a,b)=>a.entityId-b.entityId);
  const names=new Set<string>(),weapons=worldList(r.weapons,ORDINARY_DEATH_LIMITS.weapons).map(value=>{
    const w=worldRecord(value,['weaponId','infDeath']),weaponId=worldSymbol(w.weaponId),infDeath=worldInteger(w.infDeath,1,2) as 1|2;
    if(names.has(weaponId))worldFail('death-duplicate-weapon');names.add(weaponId);return Object.freeze({weaponId,infDeath});
  }).sort((a,b)=>a.weaponId<b.weaponId?-1:a.weaponId>b.weaponId?1:0);
  if(!actors.length||!weapons.length)worldFail('death-empty-rules');
  const data={policy:ORDINARY_DEATH_POLICY,actors:Object.freeze(actors),weapons:Object.freeze(weapons)};
  const result=Object.freeze({...data,sha256:worldHash(data)});rules.add(result);return result;
}
/** Core-owned canonical actor/weapon projections; no public brand can be reconstructed from a save. */
export function bindOrdinaryDeathRules(value: OrdinaryDeathRules, actors: readonly {entityId:number;layer:string}[], weapons:readonly {id:string}[]): OrdinaryDeathBinding {
  if(!rules.has(value))worldFail('death-rules-brand');
  if(value.actors.some(a=>!actors.some(d=>d.entityId===a.entityId&&d.layer==='ground'))||
    value.weapons.length!==weapons.length||value.weapons.some(w=>!weapons.some(d=>d.id===w.weaponId)))worldFail('death-binding-coverage');
  const binding=Object.freeze({rules:value});
  bindings.set(binding,{actors:new Map(value.actors.map(a=>[a.entityId,a])),weapons:new Map(value.weapons.map(w=>[w.weaponId,w]))});return binding;
}
export function ordinaryDeathDuration(binding: OrdinaryDeathBinding, entityId:number,sequence:11|12):number {
  const actor=ordinaryDeathActor(binding,entityId);if(!actor)worldFail('death-unsupported-victim');
  return sequence===11?actor.sequence11Ticks:actor.sequence12Ticks;
}

export function ordinaryDeathActor(binding:OrdinaryDeathBinding,entityId:number):OrdinaryDeathActor|undefined {
  const data=bindings.get(binding);if(!data)worldFail('death-binding-brand');return data.actors.get(entityId);
}
export function ordinaryDeathWeapon(binding:OrdinaryDeathBinding,weaponId:string):OrdinaryDeathWeapon|undefined {
  const data=bindings.get(binding);if(!data)worldFail('death-binding-brand');return data.weapons.get(weaponId);
}
