// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCombatInitialRuntime as compile, createInfantryFiringProgram as program, isCombatInitialRuntime, isInfantryFiringProgram,
  COMBAT_INITIAL_RUNTIME_LIMITS } from '../../packages/content/src/combat-initial-runtime.ts';
import { initialFixture as fixture, initialMap, initialRules } from './combat-initial-fixture.ts';
const inf = (r: ReturnType<typeof compile>) => r.types.find(t=>t.kind==='infantry')!;
const placed = (r: ReturnType<typeof compile>) => r.placements.find(t=>t.typeId===inf(r).typeId)!;
test('fresh placed infantry/unit factors and explicit rookie ranks in both profiles are source facts',()=>{
  for(const profile of ['ra2','yr'] as const){const r=compile(fixture({profile}));
    assert.deepEqual(r.placements.map(p=>[p.actorArmor,p.actorFirepower,p.rankPercent,p.veterancy,p.status]),[[1,1,0,0,'ready'],[1,1,0,0,'ready']]);
    assert.deepEqual(Object.values(inf(r).frames).map(f=>f.value),profile==='ra2'?[2,3,null,null]:[2,3,4,5]);
    const p=program(r,placed(r).rowId);assert.equal(p.actorId,placed(r).actorId);assert.equal(p.fireUp,2);assert.equal(p.slot,'primary');
    assert.equal(r.canExecuteCombat,false);assert(isCombatInitialRuntime(r));assert(isInfantryFiringProgram(p));assert(Object.isFrozen(inf(r).visits[0]!.reads));
    assert.throws(()=>program(r,r.placements.find(p=>p.typeId?.includes(':unit:'))!.rowId));
  }
});
test('map rank replaces constructor promotion and retains the RA2 double / YR truncating float32 difference',()=>{
  const mapText=initialMap.replace(',None,0,-1,0,1,1',',None,10,-1,0,1,1');
  const ra=compile(fixture({mapText,rulesText:initialRules+'[Blue]\nVeteranInfantry=Walker\n'})),yr=compile(fixture({profile:'yr',mapText}));
  assert.equal(placed(ra).rankPercent,10);assert.equal(placed(ra).veterancy,.09999999999999999);
  assert.equal(placed(yr).veterancy,.09999999403953552);assert.notEqual(placed(yr).veterancy,Math.fround(.1));
  for(const n of [-200,0,100,200])assert.equal(placed(compile(fixture({mapText:initialMap.replace(',None,0,-1,0,1,1',`,None,${n},-1,0,1,1`)}))).veterancy,n/100);
});
test('missing, shifted, long or nondecimal rank rows remain unsupported instead of zero',()=>{
  for(const token of ['', '$64', '100h', '1.5','2e2','2147483648','6553601']){
    const r=compile(fixture({mapText:initialMap.replace(',None,0,-1,0,1,1',`,None,${token},-1,0,1,1`)}));
    assert.equal(placed(r).veterancy,null,token);assert.equal(placed(r).status,'unsupported');assert.throws(()=>program(r,placed(r).rowId));
  }
  const r=compile(fixture({mapText:initialMap.replace(',None,0,-1,0,1,1',`,${'X'.repeat(128)},0,-1,0,1,1`)}));assert.equal(placed(r).veterancy,null);
});
test('exact staged Image visits consult frozen global art and preserve prior field values',()=>{
  const r=compile(fixture({rulesText:initialRules.replace('[Walker]\n','[Walker]\nImage=First\n'),mods:['[Walker]\nImage=Second\n'],mapText:initialMap+'[Walker]\nStrength=21\n',
    artText:'[First]\nFireUp=6\nFireProne=7\n[Second]\nFireUp=\n',artMods:['[First]\nFireUp=9\n']}));
  assert.equal(inf(r).image.value,'Second');assert.equal(inf(r).frames.FireUp.value,9);assert.equal(inf(r).frames.FireProne.value,7);
  assert.deepEqual(inf(r).visits.map(v=>[v.layerId,v.image]),[['base','First'],['mod-0','Second'],['map','Second']]);
  assert.equal(inf(r).frames.FireUp.origin?.layerId,'art-0');assert.equal(inf(r).frames.FireUp.history.length,3);
});
test('rules FireUp and case variants cannot override global ART exact TypeImage',()=>{
  const r=compile(fixture({rulesText:initialRules.replace('[Walker]\n','[Walker]\nFireUp=90\nImage=Exact\n'),artText:'[Exact]\nFireUp=5\nfireup=91\n[exact]\nFireUp=92\n'}));
  assert.equal(inf(r).frames.FireUp.value,5);
  const defaults=compile(fixture({artText:'[walker]\nFireUp=99\n'}));assert.equal(inf(defaults).frames.FireUp.value,0);
  assert.throws(()=>compile(fixture({artText:'[Walker]\nFireUp=1\nFireUp=2\n'})),/duplicate|repeated/);
});
test('inactive alternate frames remain data, while unsupported active FireUp and locomotors prevent a program',()=>{
  const r=compile(fixture({profile:'yr',artText:'[Walker]\nFireUp=0\nFireProne=bogus\nSecondaryFire=-1\nSecondaryProne=999999\n'}));
  assert.equal(inf(r).standingPrimary.status,'ready');assert.equal(program(r,placed(r).rowId).fireUp,0);assert.equal(inf(r).frames.FireProne.value,null);
  for(const value of ['-1','65536','bogus']) { const v=compile(fixture({artText:`[Walker]\nFireUp=${value}\n`}));assert.throws(()=>program(v,placed(v).rowId)); }
  const bad=compile(fixture({rulesText:initialRules.replace('4A582744','4A582742')}));assert.throws(()=>program(bad,placed(bad).rowId));
});
test('unknown image contaminates current defaults until a supported field is actually read again',()=>{
  const r=compile(fixture({mods:['[Walker]\nImage=bad path\n'],mapText:initialMap+'[Walker]\nImage=Walker\n',artText:'[Walker]\nFireUp=\n'}));
  assert.equal(inf(r).frames.FireUp.value,null);assert.equal(inf(r).standingPrimary.status,'unsupported');
  const recovered=compile(fixture({mods:['[Walker]\nImage=bad path\n'],mapText:initialMap+'[Walker]\nImage=Walker\n'}));assert.equal(inf(recovered).frames.FireUp.value,2);
});
test('identity, genuine factories, mission hash, immutable source and accessor boundaries reject',()=>{
  const input=fixture(),r=compile(input);
  assert.throws(()=>compile({...input,actors:{...input.actors}}));assert.throws(()=>program({...r},placed(r).rowId));
  assert.throws(()=>compile({...input,art:fixture({profile:'yr'}).art}));
  assert.throws(()=>compile({...input,mission:{...input.mission,bytes:new Uint8Array(input.mission.bytes.length)}}));
  assert.throws(()=>compile({...input,art:structuredClone(input.art)}));
  let reads=0;const hostile=Object.defineProperty({...input},'actors',{enumerable:true,get(){reads++;return input.actors;}});assert.throws(()=>compile(hostile));assert.equal(reads,0);
  assert(!isInfantryFiringProgram({...program(r,placed(r).rowId)}));
});
test('every lower source resource limit is enforced without mutating prior source results',()=>{
  const input=fixture(),before=compile(input);
  for(const key of Object.keys(COMBAT_INITIAL_RUNTIME_LIMITS) as (keyof typeof COMBAT_INITIAL_RUNTIME_LIMITS)[]){
    assert.throws(()=>compile(input,{[key]:0}),key);assert.throws(()=>compile(input,{[key]:COMBAT_INITIAL_RUNTIME_LIMITS[key]+1}),key);
  }
  assert.throws(()=>compile(input,{unknown:1} as never));assert.equal(compile(input).fingerprint,before.fingerprint);
});
test('outer and mission descriptor snapshots do not consume Proxy get traps or typed-array proxies',()=>{
  const input=fixture(),expected=compile(input);let reads=0;
  const wrapped=<T extends object>(v:T):T=>new Proxy(v,{get(){reads++;throw Error('ordinary property read');}});
  const supplied=wrapped({...input,mission:wrapped({...input.mission,source:wrapped(input.mission.source)})});
  assert.equal(compile(supplied,wrapped({types:100})).fingerprint,expected.fingerprint);assert.equal(reads,0);
  assert.throws(()=>compile({...input,mission:{...input.mission,bytes:wrapped(input.mission.bytes)}}),/mission-bytes/);assert.equal(reads,0);
});
