// SPDX-License-Identifier: MIT
// Original synthetic arithmetic fixtures. No retail values or save state.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { nativeFirepowerDamage as fire, nativeArmorAdjustedDamage as armor, nativeZeroSpreadDamage as impact,
  nativeNormalReload as reload, NativeCombatNumberError, NATIVE_COMBAT_NUMBER_LIMITS as L } from '../../packages/sim/src/native-combat-numbers.ts';
const shot={damage:101,houseFirepower:1.5,actorFirepower:1.25,veteranCombat:1.5};
const received={damage:101,countryArmor:1.5,actorArmor:1.25,veteranArmor:1.5};
const splash={damage:101,verse:1.5,maxDamage:1000};
const cadence={rof:101,houseRof:1.5,jitter:2 as const,veteranRof:0.5};
function rejected(f:()=>unknown,code?:string):void { assert.throws(f,error=>error instanceof NativeCombatNumberError&&(code===undefined||error.code===code)); }

test('6000 independent rational-oracle cases retain all four native arithmetic stage results',()=>{
 let state=0x93631a72;const draw=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
 const choices=[0,.1,.2,.3,.58,.7,1,1.1,1.5,2,3,7.9];
 function factor():number { let value=choices[(draw()>>>16)%choices.length]!;if(value&&(draw()>>>15)%2){const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,value);v.setBigUint64(0,v.getBigUint64(0)+1n);value=v.getFloat64(0);}return value; }
 const values:number[]=[];
 for(let k=0;k<6000;k++){
  const damage=draw()%100000+1,rof=draw()%100001,jitter=(draw()%3) as 0|1|2,maxDamage=draw()%100000+1;
  const [houseFirepower,actorFirepower,veteranCombat,country,actor,veteran,verse,houseRof,veteranRof]=Array.from({length:9},factor) as [number,number,number,number,number,number,number,number,number];
  values.push(fire({damage,houseFirepower,actorFirepower,veteranCombat}),armor({damage,countryArmor:country||1,actorArmor:actor||1,veteranArmor:veteran||1}),impact({damage,verse,maxDamage}),reload({rof,houseRof,jitter,veteranRof}));
 }
 const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>bytes.writeUInt32LE(v,i*4));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'d2107ca719917930d6fa98684287dc002b117a5793ec520b07506e8a2f234402');
});

test('each integer conversion precedes the next veteran stage',()=>{
 assert.equal(fire(shot),283); // floor(101*1.875)=189, then floor(189*1.5)=283.
 assert.equal(armor(received),35); // floor(101/1.875)=53, then floor(53/1.5)=35.
 assert.equal(impact(splash),151);
 assert.equal(reload(cadence),76); // floor(151.5+2)=153, then floor(153*0.5)=76.
});

test('rounding is toward zero at each operation, not default JavaScript nearest rounding',()=>{
 assert.equal(reload({rof:63460,houseRof:.7,jitter:1,veteranRof:7.9}),350933);
 assert.equal(fire({damage:23100,houseFirepower:1.1,actorFirepower:.7,veteranCombat:1.1}),19564);
 assert.equal(armor({damage:9368,countryArmor:.1,actorArmor:7.9,veteranArmor:.1}),118579);
 assert.equal(impact({damage:100,verse:.58,maxDamage:100}),57);
});

test('armor minimum precedes verses and the maximum cap, with zero distinctions preserved',()=>{
 assert.equal(armor({...received,damage:0}),1);assert.equal(armor({...received,damage:1}),1);
 assert.equal(impact({...splash,damage:1,verse:.5}),0);
 assert.equal(impact({...splash,damage:0}),0);assert.equal(impact({...splash,verse:0}),0);
 assert.equal(impact({...splash,maxDamage:5}),5);
 assert.equal(fire({...shot,houseFirepower:0}),0);assert.equal(fire({...shot,veteranCombat:0}),0);
 assert.equal(reload({...cadence,rof:0,houseRof:0,jitter:2,veteranRof:1}),2);
 assert.equal(reload({...cadence,jitter:0,houseRof:0}),0);
});

test('factor and integer boundaries stay exact; overflowing intermediate casts reject before later relief',()=>{
 assert.equal(fire({damage:L.integer,houseFirepower:1,actorFirepower:1,veteranCombat:1}),L.integer);
 assert.equal(armor({damage:L.integer,countryArmor:1,actorArmor:1,veteranArmor:1}),L.integer);
 assert.equal(impact({damage:L.integer,verse:1,maxDamage:L.integer}),L.integer);
 assert.equal(reload({rof:L.integer,houseRof:1,jitter:0,veteranRof:1}),L.integer);
 assert.equal(fire({damage:65536,houseFirepower:L.factorMin,actorFirepower:L.factorMax,veteranCombat:1}),65536);
 rejected(()=>fire({...shot,damage:L.integer,houseFirepower:2,veteranCombat:0}),'conversion-overflow');
 rejected(()=>armor({...received,damage:L.integer,countryArmor:.5,veteranArmor:65536}),'conversion-overflow');
 rejected(()=>impact({...splash,damage:L.integer,verse:2,maxDamage:1}),'conversion-overflow');
 rejected(()=>reload({...cadence,rof:L.integer,houseRof:1,jitter:1,veteranRof:0}),'conversion-overflow');
});

test('invalid numeric inputs do not coerce, clamp or admit unsupported factors',()=>{
 const bad=[-0,-1,NaN,Infinity,-Infinity,'1',1n,null,undefined,{},2**32];
 for(const value of bad){
  rejected(()=>fire({...shot,damage:value as number}));rejected(()=>armor({...received,damage:value as number}));
  rejected(()=>impact({...splash,maxDamage:value as number}));rejected(()=>reload({...cadence,rof:value as number}));
 }
 for(const value of [...bad,1e-300,L.factorMin/2,L.factorMax+1]){
  rejected(()=>fire({...shot,actorFirepower:value as number}));rejected(()=>armor({...received,countryArmor:value as number}));
  rejected(()=>impact({...splash,verse:value as number}));rejected(()=>reload({...cadence,houseRof:value as number}));
 }
 rejected(()=>fire({...shot,damage:0}));rejected(()=>armor({...received,countryArmor:0}));rejected(()=>armor({...received,actorArmor:0}));rejected(()=>armor({...received,veteranArmor:0}));
 for(const value of [0.5,3,-1])rejected(()=>reload({...cadence,jitter:value as 0}));
 rejected(()=>impact({...splash,maxDamage:0}));
});

test('record boundary rejects accessors, unknown fields and hostile reflection; valid inputs remain unchanged',()=>{
 const entries=[[fire,shot],[armor,received],[impact,splash],[reload,cadence]] as const;let called=0;
 for(const [fn,input] of entries){
  const run=fn as (input:unknown)=>number,original=JSON.stringify(input),expected=run(input);
  assert.equal(run(Object.freeze({...input})),expected);assert.equal(run(JSON.parse(original)),expected);
  assert.equal(run(Object.assign(Object.create(null),input)),expected);
  for(const wrong of [null,[],Object.create(input),{...input,extra:0},{...input,[Symbol('x')]:0}])rejected(()=>run(wrong));
  for(const key of Object.keys(input)){
   const value={...input};Object.defineProperty(value,key,{enumerable:true,get(){called++;return 1;}});rejected(()=>run(value),'fields');
  }
  rejected(()=>run(new Proxy(input,{ownKeys(){throw new Error('trap');}})),'record');
  assert.equal(JSON.stringify(input),original);
 }
 assert.equal(called,0);
});
