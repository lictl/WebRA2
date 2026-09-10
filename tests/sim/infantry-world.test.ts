// SPDX-License-Identifier: MIT
// Original source-timing programs with explicit invented engine combat rules; no retail admission claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialFixture} from '../content/combat-initial-fixture.ts';
import {compileCombatInitialRuntime,createInfantryFiringProgram} from '../../packages/content/src/combat-initial-runtime.ts';
import {createCombatModel,combatFactor} from '../../packages/sim/src/combat-model.ts';
import {createOrdinaryCombatRules} from '../../packages/sim/src/ordinary-combat-rules.ts';
import {createOrdinaryDeathRules} from '../../packages/sim/src/ordinary-death-rules.ts';
import {createWorldModel,worldHash} from '../../packages/sim/src/world-model.ts';
import {createNavigationGrid} from '../../packages/sim/src/navigation.ts';
import {WorldSimulation} from '../../packages/sim/src/world.ts';
import {WorldReplayRecorder,replayWorld} from '../../packages/sim/src/world-replay.ts';
function setup(profile:'ra2'|'yr'='ra2',fireUp=2){
 const f=initialFixture({profile,artText:`[Walker]\nFireUp=${fireUp}\n`,mapText:'[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,6,6\n[Houses]\n0=Commander\n1=Rival\n[Commander]\nCountry=Blue\n[Rival]\nCountry=Blue\n[Infantry]\n0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1\n1=Rival,Walker,256,4,2,0,Guard,0,None,0,-1,0,1,1\n'});
 const initial=compileCombatInitialRuntime(f),p=createInfantryFiringProgram(initial,initial.placements[0]!.rowId);
 const weapons=[{id:'original:gun',damage:2,range:1024,minimumRange:0,reloadTicks:0,burst:1,burstDelayTicks:1,delivery:'instant' as const,speed:0,ground:true,air:false,verses:Array.from({length:11},()=>combatFactor(1))}];
 const actors=[1,2].map(id=>({entityId:id,armor:0,layer:'ground' as const,weapons:id===1?['original:gun']:[],initialAmmo:id===1?20:-1}));
 const ordinary=createOrdinaryCombatRules({seed:0,actors:[1,2].map(entityId=>({entityId,houseFirepower:1,actorFirepower:1,veteranCombat:1,countryArmor:1,actorArmor:1,veteranArmor:1,houseRof:0,veteranRof:0})),weapons:[{weaponId:'original:gun',maxDamage:1000}]});
 const ordinaryDeath=createOrdinaryDeathRules({actors:[{entityId:2,corpseAnimationIds:['original:corpse'],sequence11Ticks:2,sequence12Ticks:3}],weapons:[{weaponId:'original:gun',infDeath:1}]});
 const combat=createCombatModel({weapons,actors,allies:[],ordinary,ordinaryDeath,infantryFiring:[p]});
 const contentIdentity={profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
 const entities=initial.placements.map((a,i)=>({id:a.actorId,rowId:a.rowId,typeId:a.typeId!,owner:i,kind:'infantry' as const,x:i?4:2,y:2,initialHealth:20,maximumHealth:20,movementPerTick:128,navigationClass:'foot',blocksCell:true}));
 const grid=createNavigationGrid({contentIdentity,movementClass:'foot',cells:Array.from({length:40},(_,i)=>({x:i%8,y:Math.floor(i/8),cost:1,exits:255}))});
 const model=createWorldModel({contentIdentity,sourceSha256:f.mission.source.sha256,definitionsSha256:f.definitions.fingerprint,entities,navigation:[{grid,costScale:1}],blocked:[],combat});
 return {model,simulation:WorldSimulation.create(model),program:p};
}
const attack=(tick=0,sequence=0)=>({schemaVersion:1,tick,sequence,playerId:0,kind:'attack',payload:{entityId:1,targetId:2}});
for(const profile of ['ra2','yr'] as const)test(`${profile} world fires only after source FireUp and saves/replays the pending schedule`,()=>{
 const {model}=setup(profile),r=new WorldReplayRecorder(model);r.admitCommands([attack()]);
 assert.equal(r.save().engineVersion,'webra2-world-5');const first=r.step();assert.ok(first.events.some(e=>e.kind==='fire-started'));assert.ok(!first.events.some(e=>e.kind==='fired'));
 assert.equal(r.save().state.combat!.ordinaryRandom!.draws,0);assert.equal(r.save().state.combat!.actors[0]!.ammo,20);
 const resumed=new WorldReplayRecorder(model,JSON.parse(JSON.stringify(r.save())));
 assert.deepEqual(r.step(8),resumed.step(8));assert.deepEqual(r.save(),resumed.save());
 assert.equal(r.save().state.combat!.infantryFiring![0]!.state.shots,3);assert.equal(r.save().state.entities[1]!.health,14);
 for(const v of [r,resumed])assert.equal(replayWorld(model,v.document()).stateSha256,worldHash(v.save()));
});
test('Stop cancels pending windup without RNG or ammo and reattack starts a fresh attempt',()=>{
 const {simulation}=setup();simulation.admitCommands([attack(),{schemaVersion:1,tick:1,sequence:1,playerId:0,kind:'stop',payload:{entityId:1}},attack(3,2)]);
 const run=simulation.step(7);assert.deepEqual(run.events.filter(e=>e.kind==='fired').map(e=>e.tick),[5]);
 const saved=simulation.save().state.combat!;assert.equal(saved.infantryFiring![0]!.state.nextAttemptId,4);assert.equal(saved.actors[0]!.ammo,19);assert.equal(saved.ordinaryRandom!.draws,2);
});
test('zero FireUp and ROF still produce one shot per tick and a failed death completion rolls back pending and RNG',()=>{
 const {simulation,model}=setup('yr',0);simulation.admitCommands([attack()]);assert.deepEqual(simulation.step(9).events.filter(e=>e.kind==='fired').map(e=>e.tick),Array.from({length:9},(_,i)=>i));
 const before=simulation.saveText();assert.throws(()=>simulation.step(5,1),/world-work-limit/);assert.equal(simulation.saveText(),before);
 const restored=WorldSimulation.restore(model,simulation.save());assert.deepEqual(simulation.step(5),restored.step(5));assert.deepEqual(simulation.save(),restored.save());
 assert.equal(simulation.save().state.combat!.infantryFiring![0]!.state.pending,null);
});
test('target leaving range cancels windup and must complete a new windup after returning',()=>{
 const {simulation}=setup('ra2',6);simulation.admitCommands([attack(),
  {schemaVersion:1,tick:0,sequence:0,playerId:1,kind:'move',payload:{entityId:2,x:7,y:2}},
  {schemaVersion:1,tick:7,sequence:1,playerId:1,kind:'move',payload:{entityId:2,x:4,y:2}}]);
 const before=simulation.step(8);assert.equal(before.events.filter(e=>e.kind==='fired').length,0);assert.equal(simulation.save().state.combat!.ordinaryRandom!.draws,0);
 const run=simulation.step(10);assert.deepEqual(run.events.filter(e=>e.kind==='fire-started').map(e=>e.tick),[8,15]);
 assert.deepEqual(run.events.filter(e=>e.kind==='fired').map(e=>e.tick),[14]);
});
test('world restore joins scheduler tick, cooldown, ammunition and pending target to the authoritative combat actor',()=>{
 const {simulation,model}=setup();simulation.admitCommands([attack()]);simulation.step();const before=simulation.save();
 for(const change of [(s:typeof before)=>{delete s.state.combat!.infantryFiring;},
  (s:typeof before)=>{s.state.combat!.actors[0]!.ammo--;},
  (s:typeof before)=>{s.state.combat!.actors[0]!.targetId=null;},
  (s:typeof before)=>{s.state.combat!.actors[0]!.readyTick=1;}]){const s=structuredClone(before);change(s);assert.throws(()=>WorldSimulation.restore(model,s));}
 const wrong=setup('ra2',3);assert.throws(()=>WorldSimulation.restore(wrong.model,before),/world-save-model/);
 simulation.step(2);const fired=simulation.save(),s=structuredClone(fired);s.state.combat!.actors[0]!.ammo++;
 assert.throws(()=>WorldSimulation.restore(model,s),/infantry-save-ammo/);
});
