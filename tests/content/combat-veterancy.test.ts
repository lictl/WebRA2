// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature INI sources; no retail rows or ability lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
import { compileCombatVeterancy, selectCombatVeterancy, isCombatVeterancy, COMBAT_ABILITY_NAMES, COMBAT_VETERANCY_LIMITS } from '../../packages/content/src/combat-veterancy.ts';
const base='[Countries]\n0=Blue\n[General]\nVeteranCombat=2\nVeteranArmor=3\nVeteranROF=0.5\n[InfantryTypes]\n0=Walker\n[Walker]\nStrength=20\nVeteranAbilities=FIREPOWER,EXPLODES\nEliteAbilities=STRONGER,ROF\n';
const map='[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,3\n[Houses]\n0=Commander\n[Commander]\nCountry=Blue\n[Infantry]\n0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1\n';
const bytes=(s:string)=>new TextEncoder().encode(s),sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture({profile='ra2' as 'ra2'|'yr',rulesText=base,mapText=map,mods=[] as string[]}={}){
 const layers:RuntimeIniLayer[]=[{id:'base',profile,order:0,kind:'base',sourceSha256:sha(rulesText),bytes:bytes(rulesText)},
 ...mods.map((s,i)=>({id:`mod-${i}`,profile,order:i+1,kind:'mod' as const,sourceSha256:sha(s),bytes:bytes(s)})),
 {id:'map',profile,order:100,kind:'map',sourceSha256:sha(mapText),bytes:bytes(mapText)}];
 const source={id:'original-map',profile,sha256:sha(mapText)},rules=compileRuntimeIni(profile,layers);
 const objects=compileScenarioObjects({profile,source,bytes:bytes(mapText)}),art=compileRuntimeIni(profile,[{id:'art',profile,order:0,kind:'base',sourceSha256:sha(';original'),bytes:bytes(';original')}]);
 const definitions=compileEntityDefinitions({objects,rules,art}),actors=compileCombatActors({definitions,rules,mission:{source,bytes:bytes(mapText)}});
 return {actors,rules};
}
const selected=(r:ReturnType<typeof compileCombatVeterancy>,veterancy:number)=>selectCombatVeterancy(r,{typeId:'type:infantry:walker',veterancy});
test('both profiles select native combat ability conditions at rank boundaries and retain profile-specific storage precision',()=>{
 for(const profile of ['ra2','yr'] as const){const r=compileCombatVeterancy(fixture({profile}));
  for(const [v,rank,mods] of [[-.25,'negative',[1,1,1]],[0,'rookie',[1,1,1]],[Math.fround(1-2**-24),'rookie',[1,1,1]],[1,'veteran',[2,1,1]],[Math.fround(2-2**-23),'veteran',[2,1,1]],[2,'elite',[2,3,.5]],[65536,'elite',[2,3,.5]]] as const){
   const s=selected(r,v);assert.equal(s.rank,rank);assert.deepEqual(Object.values(s.modifiers),mods);assert.equal(s.enabled.explodes,v>=1);assert.equal(s.canExecuteCombat,false);
  }
  assert(isCombatVeterancy(r));assert(!isCombatVeterancy({...r}));assert(Object.isFrozen(r.types[0]!.veteran.value));
 }
});
test('nonempty lists replace previous sets, empty visits retain, commas alone clear, and tokens do not trim',()=>{
 const r=compileCombatVeterancy(fixture({mods:['[Walker]\nVeteranAbilities=ROF\nEliteAbilities=\n'],mapText:map+'[Walker]\nVeteranAbilities=firepower,, STRONGER,unknown,FIREPOWER,\n'}));
 const t=r.types.find(t=>t.typeId==='type:infantry:walker')!;
 assert.deepEqual(t.veteran.value,['FIREPOWER']);assert.deepEqual(t.elite.value,['STRONGER','ROF']);assert.equal(t.veteran.history.length,3);assert.equal(t.elite.history.length,2);
 assert.deepEqual(compileCombatVeterancy(fixture({mapText:map+'[Walker]\nVeteranAbilities=,,,\n'})).types.find(t=>t.typeId==='type:infantry:walker')!.veteran.value,[]);
});
test('all 18 native list identities are retained but only four inspected consumers are selected',()=>{
 const r=compileCombatVeterancy(fixture({rulesText:base.replace('FIREPOWER,EXPLODES',COMBAT_ABILITY_NAMES.slice(0,9).join(',')).replace('STRONGER,ROF',COMBAT_ABILITY_NAMES.slice(9).join(','))}));
 const type=r.types.find(t=>t.typeId==='type:infantry:walker')!;assert.deepEqual([...type.veteran.value!,...type.elite.value!],COMBAT_ABILITY_NAMES);
 assert.deepEqual(Object.keys(selected(r,2).enabled),['firepower','stronger','rof','explodes']);
});
test('fresh defaults and missing sections preserve one and empty ability sets without inventing active effects',()=>{
 const r=compileCombatVeterancy(fixture({rulesText:base.replace(/Veteran(?:Combat|Armor|ROF|Abilities)=[^\n]*\n/g,'').replace(/EliteAbilities=[^\n]*\n/g,''),mapText:map+'[General]\nVeteranCombat=\n[Walker]\nEliteAbilities=\n'}));
 assert.deepEqual(Object.values(r.general).map(f=>f.value),[1,1,1]);assert.deepEqual(selected(r,2).enabled,{firepower:false,stronger:false,rof:false,explodes:false});
 assert.equal(r.general.combat.history.length,1);
});
test('unknown buffers and scalar values propagate only to active consumers and later valid visits recover',()=>{
 const r=compileCombatVeterancy(fixture({mapText:map+'[Walker]\nVeteranAbilities='+('X'.repeat(128))+'\n[General]\nVeteranArmor=NaN\n'}));
 assert.deepEqual(selected(r,0).modifiers,{combat:1,armor:1,rof:1});
 assert.deepEqual(selected(r,1).enabled,{firepower:null,stronger:null,rof:null,explodes:null});
 assert.deepEqual(selected(r,2).enabled,{firepower:null,stronger:true,rof:true,explodes:null});
 assert.deepEqual(selected(r,2).modifiers,{combat:null,armor:null,rof:.5});
 const fixed=compileCombatVeterancy(fixture({mods:['[Walker]\nVeteranAbilities='+('X'.repeat(128))+'\n'],mapText:map+'[Walker]\nVeteranAbilities=ROF\n[General]\nVeteranROF=25%\n'}));
 assert.deepEqual(selected(fixed,1).modifiers,{combat:1,armor:1,rof:.25});
});
test('exact source field case, read order and duplicate keys are not silently normalized',()=>{
 const r=compileCombatVeterancy(fixture({rulesText:base.replace('VeteranAbilities','veteranabilities').replace('VeteranCombat','Veterancombat')}));
 assert.deepEqual(selected(r,1).modifiers,{combat:1,armor:1,rof:1});
 assert.throws(()=>compileCombatVeterancy(fixture({mapText:map+'[Walker]\nVeteranAbilities=ROF\nVeteranAbilities=STRONGER\n'})),/duplicate-key|repeated-key/);
 const changed=compileCombatVeterancy(fixture({mods:['[General]\nVeteranROF=2\n'],mapText:map+'[General]\nVeteranROF=0.5\n'}));
 assert.equal(changed.general.rof.history.length,3);assert.equal(changed.general.rof.origin?.layerId,'map');
});
test('source brands, profile pins, unsupported types and hostile reflection are rejected',()=>{
 const input=fixture(),r=compileCombatVeterancy(input);
 assert.throws(()=>compileCombatVeterancy({...input,actors:{...input.actors}}));
 assert.throws(()=>compileCombatVeterancy({...input,rules:fixture({profile:'yr'}).rules}));
 assert.throws(()=>compileCombatVeterancy({...input,rules:fixture({mods:['[Unused]\nX=1']}).rules}));
 assert.throws(()=>selectCombatVeterancy({...r},{typeId:'type:infantry:walker',veterancy:0}));
 assert.throws(()=>selectCombatVeterancy(r,{typeId:'missing',veterancy:0}));
 let count=0;const hostile=Object.defineProperty({...input},'actors',{enumerable:true,get(){count++;throw Error('getter');}});
 assert.throws(()=>compileCombatVeterancy(hostile));assert.equal(count,0);
 assert.equal(selected(r,.1).rank,'rookie');
 const yr=compileCombatVeterancy(fixture({profile:'yr'}));assert.throws(()=>selected(yr,.1),/veterancy/);
 for(const v of [-0,NaN,Infinity,-Infinity,65537,-65537])assert.throws(()=>selected(r,v),/veterancy/);
});
test('lower resource limits fail atomically and mutable source tables reject',()=>{
 const input=fixture(),r=compileCombatVeterancy(input),before=r.fingerprint;
 for(const key of Object.keys(COMBAT_VETERANCY_LIMITS) as (keyof typeof COMBAT_VETERANCY_LIMITS)[]){
  assert.throws(()=>compileCombatVeterancy(input,{[key]:0}));assert.throws(()=>compileCombatVeterancy(input,{[key]:COMBAT_VETERANCY_LIMITS[key]+1}));
 }
 assert.throws(()=>compileCombatVeterancy(input,{extra:1} as never));
 assert.throws(()=>compileCombatVeterancy({...input,rules:structuredClone(input.rules)}),/immutable-input/);assert.equal(r.fingerprint,before);assert.deepEqual(selected(r,2).modifiers,{combat:2,armor:3,rof:.5});
});
