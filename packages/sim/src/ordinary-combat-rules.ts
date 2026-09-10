// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded composition of the reviewed numerical stages. See ../NATIVE_COMBAT_NUMBERS_PROVENANCE.md.
import type { CombatActor, CombatWeapon } from './combat-model.ts';
import { nativeFirepowerDamage, nativeArmorAdjustedDamage, nativeZeroSpreadDamage, nativeNormalReload, NATIVE_COMBAT_NUMBER_LIMITS as N } from './native-combat-numbers.ts';
import { worldFail, worldHash, worldInteger, worldList, worldRecord, worldSymbol } from './world-values.ts';
export const ORDINARY_COMBAT_POLICY='webra2-ordinary-numbers-combat-1' as const;
export const ORDINARY_COMBAT_ENGINE_VERSION='webra2-world-3' as const;
export const ORDINARY_COMBAT_LIMITS=Object.freeze({actors:2048,weapons:1024,pairs:131072,work:1048576,reload:10000});
type Limits={-readonly[K in keyof typeof ORDINARY_COMBAT_LIMITS]:number};
export interface OrdinaryCombatActor {
 readonly entityId:number;readonly houseFirepower:number;readonly actorFirepower:number;readonly veteranCombat:number;
 readonly countryArmor:number;readonly actorArmor:number;readonly veteranArmor:number;readonly houseRof:number;readonly veteranRof:number;
}
export interface OrdinaryCombatRules {
 readonly policy:typeof ORDINARY_COMBAT_POLICY;readonly seed:number;readonly actors:readonly Readonly<{entityId:number;factors:Readonly<Record<typeof factorKeys[number],string>>}>[];
 readonly weapons:readonly Readonly<{weaponId:string;maxDamage:number}>[];readonly limits:Readonly<Limits>;readonly sha256:string;
}
const rulesSet=new WeakSet<object>();
const numericActors=new WeakMap<object,readonly OrdinaryCombatActor[]>();
const factorKeys=['houseFirepower','actorFirepower','veteranCombat','countryArmor','actorArmor','veteranArmor','houseRof','veteranRof'] as const;
const positive=new Set<string>(['countryArmor','actorArmor','veteranArmor']);
/** Explicit immutable numerical bindings, not source authentication or original attack permission. */
export function createOrdinaryCombatRules(input:{readonly seed:number;readonly actors:readonly OrdinaryCombatActor[];
 readonly weapons:readonly Readonly<{weaponId:string;maxDamage:number}>[]},options:Partial<Limits>={}):OrdinaryCombatRules {
 const r=worldRecord(input,['seed','actors','weapons']),keys=Object.keys(ORDINARY_COMBAT_LIMITS).filter(k=>!!options&&Object.hasOwn(options,k));worldRecord(options,keys);
 const cap:Limits={...ORDINARY_COMBAT_LIMITS};for(const k of keys as (keyof Limits)[])cap[k]=worldInteger(options[k],0,cap[k]);
 const actorIds=new Set<number>(),actors=worldList(r.actors,cap.actors).map(v=>{
  const a=worldRecord(v,['entityId',...factorKeys]),entityId=worldInteger(a.entityId,1,2147483647);
  if(actorIds.has(entityId))worldFail('ordinary-duplicate-actor');actorIds.add(entityId);
  const values={} as Record<typeof factorKeys[number],number>;
  for(const key of factorKeys){const n=a[key];if(typeof n!=='number'||!Number.isFinite(n)||Object.is(n,-0)||
    !(n>=N.factorMin&&n<=N.factorMax||n===0&&!positive.has(key)))worldFail('ordinary-factor');values[key]=n;}
  return Object.freeze({entityId,...values});
 }).sort((a,b)=>a.entityId-b.entityId);
 const weaponIds=new Set<string>(),weapons=worldList(r.weapons,cap.weapons).map(v=>{
  const w=worldRecord(v,['weaponId','maxDamage']),weaponId=worldSymbol(w.weaponId);
  if(weaponIds.has(weaponId))worldFail('ordinary-duplicate-weapon');weaponIds.add(weaponId);
  return Object.freeze({weaponId,maxDamage:worldInteger(w.maxDamage,1,N.integer)});
 }).sort((a,b)=>a.weaponId<b.weaponId?-1:a.weaponId>b.weaponId?1:0);
 // Canonical engine JSON admits integers only. Preserve coefficients as exact binary64 hex, with numeric values privately owned.
 const encoded=actors.map(a=>{const factors={} as Record<typeof factorKeys[number],string>;
  for(const k of factorKeys){const bytes=new DataView(new ArrayBuffer(8));bytes.setFloat64(0,a[k]);factors[k]=bytes.getBigUint64(0).toString(16).padStart(16,'0');}
  return Object.freeze({entityId:a.entityId,factors:Object.freeze(factors)});});
 const data={policy:ORDINARY_COMBAT_POLICY,seed:worldInteger(r.seed,0,0xffffffff),actors:Object.freeze(encoded),weapons:Object.freeze(weapons),limits:Object.freeze(cap)};
 const rules=Object.freeze({...data,sha256:worldHash(data)});rulesSet.add(rules);numericActors.set(rules,Object.freeze(actors));return rules;
}
export interface OrdinaryCombatBinding {readonly policy:typeof ORDINARY_COMBAT_POLICY;readonly rulesSha256:string;readonly seed:number;readonly work:number}
type Data={damage:Map<string,number>;reload:Map<string,readonly number[]>;maximum:Map<number,number>};
const bindings=new WeakMap<object,Data>();
const key=(source:number,weapon:string,target?:number)=>JSON.stringify([source,weapon,...(target===undefined?[]:[target])]);
function data(binding:OrdinaryCombatBinding):Data{const value=bindings.get(binding);if(!value)worldFail('ordinary-binding');return value;}
/** Internal composition over canonical records owned by createCombatModel.
 * Pair results and reload outcomes are bounded and checked before that model is published. */
export function bindOrdinaryCombatRules(rules:OrdinaryCombatRules,actors:readonly CombatActor[],weapons:readonly CombatWeapon[]):OrdinaryCombatBinding {
 if(!rulesSet.has(rules))worldFail('ordinary-rules-brand');
 const cap=rules.limits,byActor=new Map(numericActors.get(rules)!.map(a=>[a.entityId,a])),byWeapon=new Map(rules.weapons.map(w=>[w.weaponId,w]));
 if(actors.length!==byActor.size||weapons.length!==byWeapon.size)worldFail('ordinary-binding-coverage');
 let work=0,pairs=0;const charge=()=>{if(++work>cap.work)worldFail('ordinary-binding-work');};
 const weaponsById=new Map(weapons.map(w=>[w.id,w])),damage=new Map<string,number>(),reload=new Map<string,readonly number[]>(),maximum=new Map<number,number>();
 for(const w of weapons){charge();if(!byWeapon.has(w.id)||w.delivery!=='instant'||w.burst!==1)worldFail('ordinary-weapon-policy');
  for(const v of w.verses){charge();const n=v.significand*2**v.exponent;if(!Number.isFinite(n)||!(n===0||n>=N.factorMin&&n<=N.factorMax))worldFail('ordinary-verse');}}
 for(const a of actors){charge();if(!byActor.has(a.entityId)||a.layer!=='ground')worldFail('ordinary-actor-policy');}
 for(const a of actors){
  charge();const source=byActor.get(a.entityId)!;let max=0;
  for(const id of a.weapons){charge();const w=weaponsById.get(id);if(!w)worldFail('ordinary-weapon-binding');
   const fire=nativeFirepowerDamage({damage:w.damage,houseFirepower:source.houseFirepower,actorFirepower:source.actorFirepower,veteranCombat:source.veteranCombat});
   // A zero result requires native branch evidence beyond the positive ordinary damage path.
   if(fire===0)worldFail('ordinary-zero-firepower');
   const times=([0,1,2] as const).map(jitter=>{charge();return worldInteger(nativeNormalReload({rof:w.reloadTicks,houseRof:source.houseRof,jitter,veteranRof:source.veteranRof}),0,cap.reload);});
   reload.set(key(a.entityId,id),Object.freeze(times));max=Math.max(max,...times);
   for(const target of actors){charge();if(++pairs>cap.pairs)worldFail('ordinary-pair-limit');const t=byActor.get(target.entityId)!;
    const armored=nativeArmorAdjustedDamage({damage:fire,countryArmor:t.countryArmor,actorArmor:t.actorArmor,veteranArmor:t.veteranArmor});
    const verse=w.verses[target.armor]!;const value=nativeZeroSpreadDamage({damage:armored,verse:verse.significand*2**verse.exponent,maxDamage:byWeapon.get(id)!.maxDamage});
    damage.set(key(a.entityId,id,target.entityId),value);
   }
  }
  maximum.set(a.entityId,max);
 }
 const binding=Object.freeze({policy:ORDINARY_COMBAT_POLICY,rulesSha256:rules.sha256,seed:rules.seed,work});bindings.set(binding,{damage,reload,maximum});return binding;
}
export function ordinaryCombatDamage(binding:OrdinaryCombatBinding,source:number,weapon:string,target:number):number {
 const result=data(binding).damage.get(key(source,weapon,target));if(result===undefined)worldFail('ordinary-damage-binding');return result;
}
export function ordinaryCombatReload(binding:OrdinaryCombatBinding,source:number,weapon:string,jitter:0|1|2):number {
 worldInteger(jitter,0,2);const result=data(binding).reload.get(key(source,weapon))?.[jitter];if(result===undefined)worldFail('ordinary-reload-binding');return result;
}
export function ordinaryCombatMaximumReload(binding:OrdinaryCombatBinding,source:number):number {
 const result=data(binding).maximum.get(source);if(result===undefined)worldFail('ordinary-actor-binding');return result;
}
