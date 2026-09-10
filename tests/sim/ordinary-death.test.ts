// SPDX-License-Identifier: MIT
// Original world scenarios; no game maps, actor names, images or saved states.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrdinaryDeathRules,ORDINARY_DEATH_LIMITS,type OrdinaryDeathActor} from '../../packages/sim/src/ordinary-death-rules.ts';
import {createOrdinaryCombatRules} from '../../packages/sim/src/ordinary-combat-rules.ts';
import {createCombatModel,combatFactor,type CombatActor} from '../../packages/sim/src/combat-model.ts';
import {createWorldModel,worldHash,type WorldEntityDefinition} from '../../packages/sim/src/world-model.ts';
import {createNavigationGrid} from '../../packages/sim/src/navigation.ts';
import type {OrdinaryDeathRecord} from '../../packages/sim/src/combat.ts';
import {WorldSimulation,type WorldSave} from '../../packages/sim/src/world.ts';
import {WorldReplayRecorder,replayWorld} from '../../packages/sim/src/world-replay.ts';
import {planTeamDestinations} from '../../packages/sim/src/team-runtime-destinations.ts';
import {createNativeRandom,nextNativeReloadJitter,nextNativeRandomWord} from '../../packages/sim/src/native-random.ts';
const deathActor=(entityId:number,changes:Partial<OrdinaryDeathActor>={}):OrdinaryDeathActor=>({entityId,corpseAnimationIds:['original:corpse-a','original:corpse-b','original:corpse-c'],sequence11Ticks:2,sequence12Ticks:4,...changes});
function setup({profile='ra2' as 'ra2'|'yr',infDeath=1 as 1|2,deathActors=[deathActor(2)],damage=10,seed=0,multiple=false,hostileSecondShooter=false,kind='infantry' as WorldEntityDefinition['kind'],duration=undefined as number|undefined}={}){
 const identity={profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
 const entities:WorldEntityDefinition[]=Array.from({length:multiple?5:3},(_,i)=>({id:i+1,rowId:`original:placed:${i}`,typeId:'original:walker',owner:i===1||i===3||i===4||hostileSecondShooter&&i===2?1:0,kind:i===1?kind:'infantry',x:[0,3,4,5,7][i]!,y:1,initialHealth:i===0?100:10,maximumHealth:i===0?100:10,movementPerTick:255,navigationClass:'foot',blocksCell:true}));
 const actors:CombatActor[]=entities.map(d=>({entityId:d.id,armor:0,layer:'ground',weapons:d.id===1||multiple&&d.id===3?['original:gun']:[],initialAmmo:-1}));
 const weapons=[{id:'original:gun',damage,range:2048,minimumRange:0,reloadTicks:0,burst:1,burstDelayTicks:1,delivery:'instant' as const,speed:0,ground:true,air:false,verses:Array.from({length:11},()=>combatFactor(1))}];
 const ordinary=createOrdinaryCombatRules({seed,actors:actors.map(a=>({entityId:a.entityId,houseFirepower:1,actorFirepower:1,veteranCombat:1,countryArmor:1,actorArmor:1,veteranArmor:1,houseRof:0,veteranRof:0})),weapons:[{weaponId:'original:gun',maxDamage:1000}]});
 const rules=createOrdinaryDeathRules({actors:deathActors.map(a=>duration===undefined?a:{...a,sequence11Ticks:duration,sequence12Ticks:duration}),weapons:[{weaponId:'original:gun',infDeath}]});
 const combat=createCombatModel({weapons,actors,allies:[],ordinary,ordinaryDeath:rules});
 const model=createWorldModel({contentIdentity:identity,sourceSha256:'c'.repeat(64),definitionsSha256:'d'.repeat(64),entities,blocked:[],navigation:[{costScale:1,grid:createNavigationGrid({contentIdentity:identity,movementClass:'foot',cells:Array.from({length:24},(_,i)=>({x:i%8,y:Math.floor(i/8),cost:1,exits:255}))})}],combat});
 return {model,combat,rules,simulation:WorldSimulation.create(model)};
}
const attack=(entityId=1,targetId=2,tick=0,sequence=0,playerId=0)=>({schemaVersion:1,tick,sequence,playerId,kind:'attack',payload:{entityId,targetId}});
const move=(tick:number,sequence:number,entityId=3,x=3,y=1,playerId=0)=>({schemaVersion:1,tick,sequence,playerId,kind:'move',payload:{entityId,x,y}});
for(const profile of ['ra2','yr'] as const)test(`${profile}: lethal hit persists sequence, attribution and corpse completion with one shared word`,()=>{
 for(const infDeath of [1,2] as const){
  const {simulation,model}=setup({profile,infDeath});assert.equal(simulation.save().engineVersion,'webra2-world-4');
  simulation.admitCommands([attack()]);const initial=simulation.step(),save=simulation.save(),duration=infDeath===1?2:4;
  assert.deepEqual(save.state.combat!.deaths,[{entityId:2,sourceId:1,weaponId:'original:gun',victimOwner:1,sourceOwner:0,sequence:infDeath+10,startedTick:0,completionTick:duration,corpseIndex:null}]);
  assert.equal(save.state.entities[1]!.health,0);assert.ok(initial.events.some(e=>e.kind==='dying'&&e.entityId===2&&e.value===1));
  assert.ok(!initial.events.some(e=>e.kind==='destroyed'));assert.equal(save.state.combat!.ordinaryRandom!.draws,2);
  for(let tick=1;tick<=duration;tick++){
   const restored=WorldSimulation.restore(model,JSON.parse(simulation.saveText())),a=simulation.step(),b=restored.step();assert.deepEqual(a,b);assert.deepEqual(simulation.save(),restored.save());
   assert.equal(a.events.filter(e=>e.kind==='destroyed').length,tick===duration?1:0);
  }
  const reload=nextNativeReloadJitter(createNativeRandom(0)),corpse=nextNativeRandomWord(reload.state),completed=simulation.save();
  assert.equal(completed.state.combat!.deaths![0]!.corpseIndex,corpse.value%3);
  assert.deepEqual(completed.state.combat!.ordinaryRandom,{state:corpse.state,draws:3});
  simulation.step(5);assert.deepEqual(simulation.save().state.combat,completed.state.combat);
 }
});
test('dying occupancy blocks new destinations through completion and releases on the following tick',()=>{
 const {simulation,model}=setup();simulation.admitCommands([attack(),move(1,1),move(2,2),move(3,3)]);simulation.step();
 const dying=simulation.save();
 const plan=planTeamDestinations({model,checkpoint:dying,actorIds:[3],target:{x:3,y:1}},{radius:0});assert.equal(plan.status,'blocked');
 assert.equal(dying.state.entities[1]!.goal,null);
 const overlap=structuredClone(dying);overlap.state.entities[2]!.x=3;
 assert.throws(()=>WorldSimulation.restore(model,overlap),/world-save-anchor-overlap/);
 const movedVictim=structuredClone(dying);movedVictim.state.entities[1]!.x=4;
 assert.throws(()=>WorldSimulation.restore(model,movedVictim),/world-save-anchor-overlap/);
 for(const tick of [1,2]){const result=simulation.step();assert.ok(result.events.some(e=>e.entityId===3&&e.phase==='navigation'&&e.kind!=='path-found'));assert.equal(simulation.save().state.entities[2]!.x,4);assert.equal(result.events.some(e=>e.kind==='destroyed'),tick===2);}
 const start=simulation.step();assert.ok(start.events.some(e=>e.entityId===3&&e.kind==='path-found'));assert.ok(simulation.save().state.entities[2]!.progress>0);
 simulation.step();assert.equal(simulation.save().state.entities[2]!.x,3);assert.equal(simulation.save().state.combat!.deaths!.length,1);
 assert.deepEqual(WorldSimulation.restore(model,simulation.save()).save(),simulation.save());
});
test('death clears active movement and orders; dead actors and unadmitted targets consume no further random words',()=>{
 const {simulation}=setup();simulation.admitCommands([move(0,0,2,2,1,1),attack()]);simulation.step();
 const victim=simulation.save().state.entities[1]!;assert.equal(victim.progress,0);assert.equal(victim.goal,null);assert.deepEqual(victim.route,[]);
 simulation.admitCommands([attack(1,2,1,1),attack(1,3,1,2),move(1,1,2,2,1,1)]);
 const result=simulation.step();assert.ok(result.events.some(e=>e.kind==='illegal-target'));assert.ok(result.events.some(e=>e.kind==='immovable'));
 assert.equal(result.events.filter(e=>e.kind==='fired').length,0);assert.equal(simulation.save().state.combat!.ordinaryRandom!.draws,2);
});
test('nonlethal damage creates no death and finite completed corpses keep one record per victim',()=>{
 const {simulation}=setup({damage:4});simulation.admitCommands([attack()]);simulation.step(2);assert.deepEqual(simulation.save().state.combat!.deaths,[]);
 assert.equal(simulation.save().state.entities[1]!.health,2);simulation.step();assert.equal(simulation.save().state.combat!.deaths![0]!.startedTick,2);
 simulation.step(5);assert.equal(simulation.save().state.combat!.deaths!.length,1);assert.notEqual(simulation.save().state.combat!.deaths![0]!.corpseIndex,null);
});
test('same-tick corpses consume words by victim ID before new firing; single-candidate corpses still draw',()=>{
 const {simulation}=setup({multiple:true,deathActors:[deathActor(2,{corpseAnimationIds:['original:only']}),deathActor(4),deathActor(5)]});
 simulation.admitCommands([attack(1,4),attack(3,2,0,1),attack(1,5,2,2)]);simulation.step(2);
 // Completing 2 and4 must occur in ID order before the next successful shot at5.
 const result=simulation.step();assert.deepEqual(result.events.filter(e=>e.kind==='corpse-selected').map(e=>e.entityId),[2,4]);
 let random=nextNativeReloadJitter(createNativeRandom(0));random=nextNativeReloadJitter(random.state);
 const a=nextNativeRandomWord(random.state),b=nextNativeRandomWord(a.state),saved=simulation.save();
 assert.equal(saved.state.combat!.deaths![0]!.corpseIndex,0);assert.equal(saved.state.combat!.deaths![1]!.corpseIndex,b.value%3);
 const shot=nextNativeReloadJitter(b.state);
 assert.equal(saved.state.combat!.ordinaryRandom!.draws,5+shot.drawCount);assert.deepEqual(saved.state.combat!.ordinaryRandom!.state,shot.state);
 assert.deepEqual(result.events.filter(e=>['corpse-selected','reload-sampled'].includes(e.kind)).map(e=>[e.kind,e.entityId]),[['corpse-selected',2],['corpse-selected',4],['reload-sampled',1]]);
 assert.equal(saved.state.combat!.deaths![2]!.startedTick,2);assert.equal(saved.state.combat!.deaths![2]!.corpseIndex,null);
});
test('source-independent explicit policy rejects malformed rules, brands, lifetimes and nonhuman world bindings',()=>{
 const {combat,rules}=setup();assert.ok(Object.isFrozen(rules.actors[0]!.corpseAnimationIds));
 assert.throws(()=>createCombatModel({actors:combat.actors,weapons:combat.weapons,allies:[],ordinaryDeath:rules}),/death-requires/);
 assert.throws(()=>createCombatModel({actors:combat.actors,weapons:combat.weapons,allies:[],ordinary:combat.ordinary!,ordinaryDeath:{...rules}}),/death-rules-brand/);
 assert.throws(()=>setup({kind:'unit'}),/world-death-actor/);
 for(const duration of [0,-1,-0,NaN,Infinity,ORDINARY_DEATH_LIMITS.duration+1])assert.throws(()=>setup({duration}));
 assert.throws(()=>setup({deathActors:[deathActor(2,{corpseAnimationIds:[]})]}),/death-candidate-limit/);
 assert.throws(()=>setup({deathActors:[deathActor(2),deathActor(2)]}),/death-duplicate-actor/);
 assert.throws(()=>setup({deathActors:[deathActor(999)]}),/death-binding-coverage/);
 const getter=Object.defineProperty(deathActor(2),'sequence11Ticks',{enumerable:true,get(){throw Error('getter ran');}});
 assert.throws(()=>setup({deathActors:[getter]}),/world-fields/);
});
test('restore rejects missing records, impossible completion, attribution, occupancy, versions and random counters',()=>{
 const {simulation,model}=setup();simulation.admitCommands([attack()]);simulation.step();const initial=simulation.save();
 const bad=(edit:(s:WorldSave)=>void)=>{const s=structuredClone(initial);edit(s);assert.throws(()=>WorldSimulation.restore(model,s));};
 bad(s=>{delete s.state.combat!.deaths;});bad(s=>{s.state.combat!.deaths=[];});bad(s=>{s.state.combat!.deaths!.push({...s.state.combat!.deaths![0]!});});
 for(const edit of [d=>{d.entityId=3;},d=>{d.sourceId=2;},d=>{d.sourceId=3;},d=>{d.victimOwner=0;},d=>{d.sourceOwner=1;},d=>{d.sequence=12;},d=>{d.startedTick=1;},d=>{d.completionTick=3;},d=>{d.corpseIndex=0;},d=>{d.weaponId='unknown';}] as ((d:OrdinaryDeathRecord)=>void)[])bad(s=>edit(s.state.combat!.deaths![0]!));
 bad(s=>{s.state.entities[1]!.health=1;});bad(s=>{Object.assign(s,{engineVersion:'webra2-world-3'});});
 assert.throws(()=>WorldSimulation.restore(setup({seed:1}).model,initial),/world-save-model/);
 simulation.step(2);const complete=simulation.save();
 for(const index of [null,-1,3]){const s=structuredClone(complete);s.state.combat!.deaths![0]!.corpseIndex=index;assert.throws(()=>WorldSimulation.restore(model,s));}
 const noDraw=structuredClone(complete);noDraw.state.combat!.ordinaryRandom={state:createNativeRandom(0),draws:0};assert.throws(()=>WorldSimulation.restore(model,noDraw),/death-save-random-count/);
});
test('pending death survives text restore and replay; failed multistep completion changes no state or random stream',()=>{
 const {model}=setup(),r=new WorldReplayRecorder(model);r.admitCommands([attack(),move(3,1)]);r.step();
 const checkpoint=r.save(),resumed=new WorldReplayRecorder(model,checkpoint),sim=WorldSimulation.restore(model,checkpoint),before=sim.saveText();
 assert.throws(()=>sim.step(6,1),/world-work-limit/);assert.equal(sim.saveText(),before);
 assert.deepEqual(r.step(6),resumed.step(6));assert.deepEqual(r.save(),resumed.save());
 for(const recorder of [r,resumed])assert.equal(replayWorld(model,recorder.document()).stateSha256,worldHash(recorder.save()));
 const exact=sim.step(6),work=exact.work.entityVisits+exact.work.navigationExpansions+exact.work.transitions;
 assert.deepEqual(WorldSimulation.restore(model,checkpoint).step(6,work),exact);
 assert.throws(()=>WorldSimulation.restore(model,checkpoint).step(6,work-1),/world-work-limit/);
});

test('attribution survives the attacker dying before its victim completes',()=>{
 const {simulation,model}=setup({multiple:true,hostileSecondShooter:true,deathActors:[deathActor(1),deathActor(2)],duration:20});
 simulation.admitCommands([attack(),attack(3,1,0,0,1)]);simulation.step(12);
 const pending=simulation.save();assert.equal(pending.state.entities[0]!.health,0);
 assert.deepEqual(pending.state.combat!.deaths!.map(d=>[d.entityId,d.sourceId,d.startedTick,d.completionTick,d.corpseIndex]),[[1,3,9,29,null],[2,1,0,20,null]]);
 const restored=WorldSimulation.restore(model,pending),a=simulation.step(20),b=restored.step(20);assert.deepEqual(a,b);
 assert.deepEqual(a.events.filter(e=>e.kind==='destroyed').map(e=>[e.entityId,e.value,e.tick]),[[2,1,20],[1,3,29]]);
 assert.deepEqual(simulation.save(),restored.save());
});
test('death horizon and aggregate model limits fail atomically',()=>{
 const {model}=setup(),base=WorldSimulation.create(model).save();Object.assign(base,{nextTick:999999998});
 const simulation=WorldSimulation.restore(model,base);simulation.admitCommands([attack(1,2,999999998)]);const before=simulation.saveText();
 assert.throws(()=>simulation.step(),/death-completion-horizon/);assert.equal(simulation.saveText(),before);
 for(const actors of [[deathActor(2,{corpseAnimationIds:Array(65).fill('original:corpse')})],Array.from({length:65},(_,i)=>deathActor(i+1,{corpseAnimationIds:Array(64).fill('original:corpse')}))])
  assert.throws(()=>createOrdinaryDeathRules({actors,weapons:[{weaponId:'original:gun',infDeath:1}]}));
});
