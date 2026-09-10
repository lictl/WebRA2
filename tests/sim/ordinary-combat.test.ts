// SPDX-License-Identifier: MIT
// Original numerical-policy fixtures; source campaign admission is tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrdinaryCombatRules,ORDINARY_COMBAT_LIMITS,type OrdinaryCombatActor} from '../../packages/sim/src/ordinary-combat-rules.ts';
import {createCombatModel,combatFactor,combatOrdinaryBinding,type CombatActor,type CombatWeapon} from '../../packages/sim/src/combat-model.ts';
import {createWorldModel,worldHash,type WorldEntityDefinition} from '../../packages/sim/src/world-model.ts';
import {createNavigationGrid} from '../../packages/sim/src/navigation.ts';
import {WorldSimulation} from '../../packages/sim/src/world.ts';
import {WorldReplayRecorder,replayWorld} from '../../packages/sim/src/world-replay.ts';
import {createNativeRandom} from '../../packages/sim/src/native-random.ts';
const factors=(entityId:number,overrides:Partial<OrdinaryCombatActor>={}):OrdinaryCombatActor=>({entityId,houseFirepower:1,actorFirepower:1,veteranCombat:1,countryArmor:1,actorArmor:1,veteranArmor:1,houseRof:1,veteranRof:1,...overrides});
const weapon=(overrides:Partial<CombatWeapon>={}):CombatWeapon=>({id:'original:gun',damage:1,range:2048,minimumRange:0,reloadTicks:2,burst:1,burstDelayTicks:1,delivery:'instant',speed:0,ground:true,air:false,verses:Array.from({length:11},()=>combatFactor(1)),...overrides});
const actor=(entityId:number,overrides:Partial<CombatActor>={}):CombatActor=>({entityId,armor:0,layer:'ground',weapons:['original:gun'],initialAmmo:-1,...overrides});
function setup({profile='ra2' as 'ra2'|'yr',seed=0,w=weapon(),numeric=[factors(1),factors(2)],actors=[actor(1),actor(2)],maxDamage=10000,options={}}={}){
 const identity={profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
 const rules=createOrdinaryCombatRules({seed,actors:numeric,weapons:[{weaponId:w.id,maxDamage}]},options);
 const config=createCombatModel({weapons:[w],actors,allies:[],ordinary:rules});
 const entities:WorldEntityDefinition[]=actors.map((a,i)=>({id:a.entityId,rowId:`original:${a.entityId}`,typeId:'original:walker',owner:i,kind:'infantry',x:i*4,y:1,initialHealth:1000,maximumHealth:1000,movementPerTick:128,navigationClass:'foot',blocksCell:true}));
 const model=createWorldModel({contentIdentity:identity,sourceSha256:'c'.repeat(64),definitionsSha256:'d'.repeat(64),entities,blocked:[],navigation:[{costScale:1,grid:createNavigationGrid({contentIdentity:identity,movementClass:'foot',cells:Array.from({length:24},(_,i)=>({x:i%8,y:Math.floor(i/8),cost:1,exits:255}))})}],combat:config});
 return{rules,config,model,simulation:WorldSimulation.create(model)};
}
const attack=(sequence=0,tick=0,entityId=1,targetId=2,playerId=0)=>({schemaVersion:1,tick,playerId,sequence,kind:'attack',payload:{entityId,targetId}});
const stop=(sequence:number,tick:number)=>({schemaVersion:1,tick,playerId:0,sequence,kind:'stop',payload:{entityId:1}});
for(const profile of ['ra2','yr'] as const)test(`${profile} ordinary numerical model composes firepower, armor, verses and maximum with a distinct save policy`,()=>{
 const s=setup({profile,w:weapon({damage:100,verses:Array(11).fill(combatFactor(.75))}),numeric:[factors(1,{houseFirepower:.58}),factors(2,{countryArmor:2,actorArmor:1.5,veteranArmor:1.5})]});
 assert.equal(s.simulation.save().engineVersion,'webra2-world-3');assert.equal(s.config.policy,'webra2-ordinary-numbers-combat-1');
 assert.ok(combatOrdinaryBinding(s.config));s.simulation.admitCommands([attack()]);
 // Fire100*.58→57, armor57/3→19, veteran19/1.5→12, verse12*.75→9.
 const result=s.simulation.step();assert.equal(result.events.find(e=>e.kind==='damaged')!.value,9);
 assert.equal(s.simulation.save().state.entities[1]!.health,991);
 const clamped=setup({profile,w:weapon({damage:100}),maxDamage:7});clamped.simulation.admitCommands([attack()]);
 assert.equal(clamped.simulation.step().events.find(e=>e.kind==='damaged')!.value,7);
 const capped=setup({profile,w:weapon({damage:1000000}),numeric:[factors(1,{houseFirepower:2}),factors(2)],maxDamage:2000000});
 capped.simulation.admitCommands([attack()]);assert.equal(capped.simulation.step().events.find(e=>e.kind==='damaged')!.value,1000);
 assert.equal(capped.simulation.save().state.entities[1]!.health,0);
});
test('reload samples rejected words, follows fixed original vector and persists whole ring at every tick',()=>{
 const {simulation,model}=setup();simulation.admitCommands([attack()]);const fired:number[]=[],jitter:number[]=[];
 for(let i=0;i<18;i++){
  const restored=WorldSimulation.restore(model,simulation.save()),a=simulation.step(),b=restored.step();
  assert.deepEqual(a,b);assert.equal(simulation.saveText(),restored.saveText());
  fired.push(...a.events.filter(e=>e.kind==='fired').map(e=>e.tick));jitter.push(...a.events.filter(e=>e.kind==='reload-sampled').map(e=>e.value!));
 }
 assert.deepEqual(fired,[0,4,7,10,14,16]);assert.deepEqual(jitter,[2,1,1,2,0,1]);
 const random=simulation.save().state.combat!.ordinaryRandom!;assert.equal(random.draws,9);assert.equal(random.state.index1,9);assert.equal(random.state.index2,112);
 assert.notDeepEqual(random.state.words,createNativeRandom(0).words);assert.equal(simulation.save().state.entities[1]!.health,994);
});
test('zero native reload remains zero and produces at most one shot per eligible actor per tick',()=>{
 const {simulation}=setup({w:weapon({reloadTicks:0}),numeric:[factors(1,{houseRof:0,veteranRof:0}),factors(2)]});
 simulation.admitCommands([attack()]);const result=simulation.step(10);
 assert.deepEqual(result.events.filter(e=>e.kind==='fired').map(e=>e.tick),Array.from({length:10},(_,i)=>i));
 assert.equal(simulation.save().state.combat!.actors[0]!.readyTick,9);assert.equal(simulation.save().state.combat!.ordinaryRandom!.draws,13);
 assert.throws(()=>createCombatModel({weapons:[weapon({reloadTicks:0})],actors:[actor(1)],allies:[]}));
});
test('native reload stages include house and veteran rounding while no-shot conditions consume no words',()=>{
 const s=setup({w:weapon({reloadTicks:5}),numeric:[factors(1,{houseRof:.7,veteranRof:1.5}),factors(2)]});
 s.simulation.admitCommands([attack()]);s.simulation.step();
 // 5*.7 rounds toward zero; + first jitter2 truncates to5, then*1.5 truncates to7.
 assert.equal(s.simulation.save().state.combat!.actors[0]!.readyTick,7);
 for(const change of [{actors:[actor(1,{initialAmmo:0}),actor(2)]},{w:weapon({range:1})},{w:weapon({verses:Array(11).fill(combatFactor(0))})}]){
  const v=setup(change);v.simulation.admitCommands([attack()]);v.simulation.step(12);
  assert.deepEqual(v.simulation.save().state.combat!.ordinaryRandom,{state:createNativeRandom(0),draws:0});
 }
});
test('stop and reattack retain RNG and cooldown, with deterministic save/replay and atomic failed steps',()=>{
 const {model}=setup(),r=new WorldReplayRecorder(model);r.admitCommands([attack(),stop(1,1),attack(2,8)]);r.step(3);
 const saved=r.save(),resumed=new WorldReplayRecorder(model,saved);
 assert.equal(saved.state.combat!.ordinaryRandom!.draws,2);assert.equal(saved.state.combat!.actors[0]!.readyTick,4);
 assert.deepEqual(r.step(20),resumed.step(20));assert.deepEqual(r.save(),resumed.save());
 for(const recorder of [r,resumed])assert.equal(replayWorld(model,recorder.document()).stateSha256,worldHash(recorder.save()));
 const sim=WorldSimulation.restore(model,saved),before=sim.saveText();assert.throws(()=>sim.step(12,1),/world-work-limit/);assert.equal(sim.saveText(),before);
 const result=sim.step(12),again=WorldSimulation.restore(model,saved);assert.deepEqual(again.step(12,result.work.entityVisits+result.work.navigationExpansions+result.work.transitions),result);
});
test('multiple shooters consume one shared stream in stable actor order and restored state cannot switch seed or schema',()=>{
 const {simulation,model}=setup();simulation.admitCommands([attack(),attack(0,0,2,1,1)]);
 const result=simulation.step();assert.deepEqual(result.events.filter(e=>e.kind==='reload-sampled').map(e=>[e.entityId,e.value]),[[1,2],[2,1]]);
 const save=simulation.save();assert.equal(save.state.combat!.ordinaryRandom!.draws,3);
 const bad=(f:(s:typeof save)=>void)=>{const value=structuredClone(save);f(value);assert.throws(()=>WorldSimulation.restore(model,value));};
 bad(v=>{delete v.state.combat!.ordinaryRandom;});
 bad(v=>{v.state.combat!.ordinaryRandom!.draws++;});
 bad(v=>{v.state.combat!.ordinaryRandom!.draws=-1;});
 bad(v=>{Object.assign(v.state.combat!.ordinaryRandom!.state,{disabled:true});});
 bad(v=>{v.state.combat!.actors[0]!.readyTick=5;});
 bad(v=>{Object.assign(v,{engineVersion:'webra2-world-2'});});
 assert.throws(()=>WorldSimulation.restore(setup({seed:1}).model,save),/world-save-model/);
 const initial=WorldSimulation.create(model).save();Object.assign(initial.state.combat!.ordinaryRandom!,{state:createNativeRandom(1)});
 assert.throws(()=>WorldSimulation.restore(model,initial),/ordinary-save-random-seed/);
});
test('complete immutable numerical bindings reject unsupported delivery, branches, overflow and exhausted model resources',()=>{
 const base=setup();assert.ok(Object.isFrozen(base.rules.actors[0]));assert.ok(Object.isFrozen(base.rules.limits));
 assert.throws(()=>createCombatModel({weapons:[weapon()],actors:[actor(1),actor(2)],allies:[],ordinary:{...base.rules}}),/rules-brand/);
 for(const bad of [NaN,Infinity,-1,-0,1e-30,65537])assert.throws(()=>setup({numeric:[factors(1,{actorFirepower:bad}),factors(2)]}));
 for(const zero of ['countryArmor','actorArmor','veteranArmor'] as const)assert.throws(()=>setup({numeric:[factors(1),factors(2,{[zero]:0})]}),/ordinary-factor/);
 assert.throws(()=>setup({numeric:[factors(1,{houseFirepower:0}),factors(2)]}),/zero-firepower/);
 assert.throws(()=>setup({w:weapon({damage:1000000}),numeric:[factors(1,{houseFirepower:65536}),factors(2)]}),/conversion-overflow/);
 assert.throws(()=>setup({w:weapon({burst:2})}),/weapon-policy/);
 assert.throws(()=>setup({w:weapon({delivery:'tracked',speed:256})}),/weapon-policy/);
 assert.throws(()=>setup({actors:[actor(1),actor(2,{layer:'air'})]}),/actor-policy/);
 assert.throws(()=>setup({numeric:[factors(1)]}),/binding-coverage/);
 for(const key of Object.keys(ORDINARY_COMBAT_LIMITS))assert.throws(()=>setup({options:{[key]:0}}));
 assert.throws(()=>setup({options:{pairs:ORDINARY_COMBAT_LIMITS.pairs+1}}));
 const accessor=Object.defineProperty({...factors(1)},'actorArmor',{enumerable:true,get(){throw new Error('getter ran');}});
 assert.throws(()=>createOrdinaryCombatRules({seed:0,actors:[accessor],weapons:[]}),/world-fields/);
});
