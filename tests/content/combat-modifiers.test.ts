// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic source fixtures; no retail rules or rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
import { compileCombatModifiers, isCombatModifiers, CombatModifiersError, COMBAT_MODIFIERS_LIMITS } from '../../packages/content/src/combat-modifiers.ts';
const baseText='[Countries]\n0=Blue\n[Blue]\nFirepower=3\nArmor=4\nROF=5\nArmorInfantryMult=1.5\nArmorUnitsMult=2\n[Easy]\nFirePower=1.5\nArmor=2\nROF=0.5\n[Normal]\nFirePower=1\nArmor=1\nROF=1\n[Difficult]\nFirePower=0.5\nArmor=0.75\nROF=1.5\n[InfantryTypes]\n0=INF\n[INF]\nStrength=40\n';
const mapText='[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,4,4\n[Houses]\n0=Player\n1=Other\n[Player]\nCountry=Blue\n[Other]\nCountry=Blue\n[Infantry]\n0=Player,INF,255,2,2,0,Guard,0,None,0,-1,0,1,1\n';
const bytes=(s:string)=>new TextEncoder().encode(s),sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture({profile='ra2' as 'ra2'|'yr',base=baseText,map=mapText,middle=[] as string[]}={}){
 const source={id:'synthetic-mission',profile,sha256:sha(map)};
 const layers:RuntimeIniLayer[]=[{id:'base',profile,kind:'base',order:0,sourceSha256:sha(base),bytes:bytes(base)},
  ...middle.map((s,i)=>({id:`mod-${i}`,profile,kind:'mod' as const,order:i+1,sourceSha256:sha(s),bytes:bytes(s)})),
  {id:'map',profile,kind:'map',order:100,sourceSha256:sha(map),bytes:bytes(map)}];
 const rules=compileRuntimeIni(profile,layers),objects=compileScenarioObjects({profile,source,bytes:bytes(map)});
 const art=compileRuntimeIni(profile,[{id:'art',profile,kind:'base',order:0,sourceSha256:sha('; original'),bytes:bytes('; original')}]);
 const definitions=compileEntityDefinitions({rules,art,objects}),mission={source,bytes:bytes(map)};
 const actors=compileCombatActors({rules,definitions,mission});
 return {actors,rules,mission,houseDifficultyIndices:actors.houses.map((house,i)=>({houseId:house.houseId,index:(i===0?0:2) as 0|1|2}))};
}
const rejected=(f:()=>unknown)=>assert.throws(f);

test('both profiles apply explicit campaign difficulty without multiplying general country modifiers',()=>{
 for(const profile of ['ra2','yr'] as const){
  const input=fixture({profile}),result=compileCombatModifiers(input);
  assert(isCombatModifiers(result));assert(!isCombatModifiers({...result}));assert(!isCombatModifiers(new Proxy(result,{})));
  assert.equal(result.profile,profile);assert.equal(result.actorFingerprint,input.actors.fingerprint);
  const a=result.houses[0]!,b=result.houses[1]!,country=result.countries[0]!;
  assert.equal(a.fields.firepower.value,1.5);assert.equal(a.fields.storedArmor.value,2);assert.equal(a.fields.rof.value,.5);
  assert.equal(b.fields.firepower.value,.5);assert.equal(b.fields.rof.value,1.5);
  assert.equal(a.fields.countryArmorInfantry.value,1.5);assert.equal(a.fields.countryArmorUnits.value,2);
  assert.equal(country.fields.firepower.value,3);assert.equal(country.fields.armor.value,4);assert.equal(country.fields.rof.value,5);
  assert.equal(result.canExecuteCombat,false);assert.equal(result.nativeExecutionVerified,false);
  assert.equal(a.unavailableFields.length,0);assert(Object.isFrozen(country.fields.firepower.history));
 }
});

test('difficulty section visits reset omitted and empty keys to one; country visits keep current defaults',()=>{
 for(const profile of ['ra2','yr'] as const){
  const input=fixture({profile,middle:['[Easy]\nROF=0.75\n[Blue]\nArmorInfantryMult=3\n'],map:mapText+'[Easy]\nFirePower=\n[Blue]\nROF=\n'});
  const r=compileCombatModifiers(input),d=r.difficulties[0]!,c=r.countries[0]!;
  assert.equal(d.fields.firepower.value,1);assert.equal(d.fields.armor.value,1);assert.equal(d.fields.rof.value,1);
  assert.equal(d.fields.firepower.status,'default');assert.equal(d.fields.firepower.origin,null);
  assert.equal(d.fields.firepower.history.length,2);assert.equal(d.fields.rof.history.length,2);
  assert.deepEqual(d.loadStages.map(s=>s.layerId),['base','mod-0','map']);
  assert.equal(c.fields.rof.value,5);assert.equal(c.fields.rof.history.length,2);assert.equal(c.fields.rof.origin?.layerId,'base');
  assert.equal(c.fields.armorInfantry.value,3);assert.equal(c.fields.firepower.value,3);
 }
});

test('unvisited difficulty state stays unknown, while an empty existing section initializes its fields',()=>{
 const base=baseText.replace(/\[Difficult\][\s\S]*?\[InfantryTypes\]/,'[InfantryTypes]');
 const absent=compileCombatModifiers(fixture({base}));assert.equal(absent.difficulties[2]!.fields.rof.value,null);
 assert.deepEqual(absent.houses[1]!.unavailableFields,['firepower','storedArmor','rof']);
 const loaded=compileCombatModifiers(fixture({base,map:mapText+'[Difficult]\n'}));
 assert.equal(loaded.difficulties[2]!.fields.rof.value,1);assert.equal(loaded.houses[1]!.unavailableFields.length,0);
});

test('country allocation gates property visits and exact section/key spelling is retained',()=>{
 const implicit=compileCombatModifiers(fixture({map:mapText.replaceAll('Country=Blue','Country=Late'),base:baseText+'[Late]\nArmorUnitsMult=8\n'}));
 const late=implicit.countries.find(c=>c.name==='Late')!;assert.equal(late.allocation,'house-country');assert.equal(late.loadStages.length,0);assert.equal(late.fields.armorUnits.value,1);
 const wrongCase=compileCombatModifiers(fixture({base:baseText.replace('[Blue]','[blue]').replace('FirePower=1.5','Firepower=9')}));
 assert.equal(wrongCase.countries[0]!.fields.firepower.value,1);assert.equal(wrongCase.difficulties[0]!.fields.firepower.value,1);
 const declaredParent=compileCombatModifiers(fixture({base:baseText.replace('0=Blue','0=Blue\n1=Parent').replace('[Blue]','[Parent]\nArmorUnitsMult=9\n[Blue]\nParentCountry=Parent')}));
 assert.equal(declaredParent.countries[0]!.parentCountry.status,'reference');assert.equal(declaredParent.countries[0]!.fields.armorUnits.value,2);
});

test('native numeric reading retains unsupported values, float stores, and later valid overwrites',()=>{
 const input=fixture({map:mapText+'[Blue]\nArmorInfantryMult=110%\nArmorUnitsMult=not-a-number\n[Easy]\nFirePower=0.1\nArmor=NaN\nROF=-2\n'});
 const r=compileCombatModifiers(input),c=r.countries[0]!;
 assert.equal(c.fields.armorInfantry.value,1.0999999046325684);assert.equal(c.fields.armorUnits.value,null);
 assert.equal(r.houses[0]!.fields.firepower.value,Math.fround(.1));assert.equal(r.houses[0]!.fields.rof.value,-2);
 assert(r.houses[0]!.unavailableFields.includes('storedArmor'));assert(r.houses[0]!.unavailableFields.includes('countryArmorUnits'));
 const fixed=compileCombatModifiers(fixture({middle:['[Blue]\nArmorUnitsMult=bad\n'],map:mapText+'[Blue]\nArmorUnitsMult=2\n'}));
 assert.equal(fixed.countries[0]!.fields.armorUnits.value,2);assert.equal(fixed.countries[0]!.fields.armorUnits.history.length,3);
 rejected(()=>compileCombatModifiers(fixture({map:mapText+'[Easy]\nROF=1\nROF=2\n'})));
});

test('difficulty choices are complete, unique, owned and order independent',()=>{
 const input=fixture(),r=compileCombatModifiers(input);
 assert.equal(compileCombatModifiers({...input,houseDifficultyIndices:[...input.houseDifficultyIndices].reverse()}).fingerprint,r.fingerprint);
 for(const choices of [[],[input.houseDifficultyIndices[0]!],[input.houseDifficultyIndices[0]!,input.houseDifficultyIndices[0]!],
  [{houseId:'unknown',index:0},input.houseDifficultyIndices[1]!],[{...input.houseDifficultyIndices[0]!,index:-0},input.houseDifficultyIndices[1]!],
  [{...input.houseDifficultyIndices[0]!,index:3},input.houseDifficultyIndices[1]!]])rejected(()=>compileCombatModifiers({...input,houseDifficultyIndices:choices as typeof input.houseDifficultyIndices}));
 let calls=0;const choices=[...input.houseDifficultyIndices];Object.defineProperty(choices,'0',{enumerable:true,get(){calls++;return input.houseDifficultyIndices[0];}});
 rejected(()=>compileCombatModifiers({...input,houseDifficultyIndices:choices}));assert.equal(calls,0);
 input.houseDifficultyIndices[0]!.index=1;input.mission.bytes.fill(0);
 assert.equal(r.houses[0]!.difficultyIndex,0);assert.equal(r.source.sha256,sha(mapText));
});

test('source brands, profiles, mission bytes and retained mission tables must agree',()=>{
 const input=fixture();
 rejected(()=>compileCombatModifiers({...input,actors:{...input.actors}}));
 rejected(()=>compileCombatModifiers({...input,actors:fixture({profile:'yr'}).actors}));
 rejected(()=>compileCombatModifiers({...input,mission:{...input.mission,bytes:bytes(mapText+'; edit')}}));
 rejected(()=>compileCombatModifiers({...input,mission:{...input.mission,source:{...input.mission.source,id:'different'}}}));
 const other=fixture({base:baseText+'[Unrelated]\nValue=1\n'});rejected(()=>compileCombatModifiers({...input,rules:other.rules}));
 const forged=JSON.parse(JSON.stringify(input.rules));forged.entries.find((e:{key:string})=>e.key==='country').value='Other';
 function frozen(v:unknown):unknown{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;}
 rejected(()=>compileCombatModifiers({...input,rules:frozen(forged) as typeof input.rules}));
});

test('lower-only aggregate limits fail without partial results or input mutation',()=>{
 const input=fixture(),before=JSON.stringify(input.actors);
 for(const key of ['missionBytes','stages','occurrences','countries','houses','placements','fields','history','work','characters','nodes','serializedBytes'] as const)
  rejected(()=>compileCombatModifiers(input,{[key]:0}));
 for(const value of [-1,-0,1.5,Infinity,COMBAT_MODIFIERS_LIMITS.houses+1])rejected(()=>compileCombatModifiers(input,{houses:value}));
 rejected(()=>compileCombatModifiers(input,{unknown:1} as {}));
 assert.equal(JSON.stringify(input.actors),before);assert(isCombatModifiers(compileCombatModifiers(input)));
 assert.throws(()=>compileCombatModifiers({...input,extra:0} as typeof input),CombatModifiersError);
});
