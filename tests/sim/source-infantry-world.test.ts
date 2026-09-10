// SPDX-License-Identifier: GPL-3.0-or-later
// Original content fixtures exercise the engine's source eligibility boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ordinaryFixture } from './ordinary-infantry-fixture.ts';
import { compileOrdinaryInfantryBridge, evaluateOrdinaryInfantryAttack } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { createCombatModel, combatSourceBridge } from '../../packages/sim/src/combat-model.ts';
import { createWorldModel, worldPosition, type WorldModel } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { WorldReplayRecorder, replayWorld } from '../../packages/sim/src/world-replay.ts';
function bind(f: ReturnType<typeof ordinaryFixture>, bridge=compileOrdinaryInfantryBridge(f)) {
 const c=bridge.combat!;
 const combat=createCombatModel({actors:c.actors,weapons:c.weapons,allies:c.allies,ordinary:c.ordinary!,ordinaryDeath:c.ordinaryDeath!,infantryFiring:c.infantryFiring!,sourceBridge:bridge});
 const m=f.world.model;
 const input={contentIdentity:m.contentIdentity,sourceSha256:m.sourceSha256,definitionsSha256:m.definitionsSha256,entities:m.entities,navigation:m.navigation,blocked:m.blocked.map(worldPosition),footprints:m.footprints.map(p=>({entityId:p.entityId,cells:p.cells.map(worldPosition)})),combat};
 return {bridge,combat,input,model:createWorldModel(input)};
}
const attack={schemaVersion:1,tick:0,playerId:0,sequence:0,kind:'attack',payload:{entityId:1,targetId:2}};
test('source models authenticate combat and the entire original world, storing only a durable bridge identity',()=>{
 const f=ordinaryFixture(),{bridge,combat,input,model}=bind(f),c=bridge.combat!;
 assert.equal(combatSourceBridge(combat),bridge);assert.equal(combat.sourceBridgeFingerprint,bridge.fingerprint);
 assert(!Object.hasOwn(combat,'sourceBridge'));assert.notEqual(combat.sha256,c.sha256);
 const base={actors:c.actors,weapons:c.weapons,allies:c.allies,ordinary:c.ordinary!,ordinaryDeath:c.ordinaryDeath!,infantryFiring:c.infantryFiring!};
 assert.throws(()=>createCombatModel({...base,sourceBridge:{...bridge}}),/source-combat-join/);
 assert.throws(()=>createCombatModel({...base,sourceBridge:bridge,weapons:c.weapons.map(w=>({...w,range:w.range+1}))}),/source-combat-join/);
 assert.throws(()=>createWorldModel({...input,entities:input.entities.map(e=>e.id===1?{...e,movementPerTick:e.movementPerTick+1}:e)}),/source-world-join/);
 assert.throws(()=>createWorldModel({...input,sourceSha256:'f'.repeat(64)}),/source-world-join/);
 const save=WorldSimulation.create(model).save();assert.equal(save.engineVersion,'webra2-world-6');
 assert.equal(evaluateOrdinaryInfantryAttack(bridge,model,save,{sourceId:1,targetId:2}).status,'eligible');
});
test('source windups, shots, dying state and completion round-trip and replay in both profiles',()=>{
 for(const profile of ['ra2','yr'] as const){
  const {model}=bind(ordinaryFixture({profile})),recorder=new WorldReplayRecorder(model);recorder.admitCommands([attack]);
  let shots=0;
  for(let tick=0;tick<110;tick++){
   const restored=WorldSimulation.restore(model,recorder.save()),step=recorder.step();assert.deepEqual(restored.step(),step);
   shots+=step.events.filter(e=>e.kind==='fired').length;
   if(tick<2)assert.equal(recorder.save().state.combat!.ordinaryRandom!.draws,0);
  }
  assert.equal(shots,10);assert.equal(recorder.save().state.entities[1]!.health,0);
  assert.equal(recorder.save().state.combat!.deaths![0]!.corpseIndex,0);
  assert.deepEqual(replayWorld(model,recorder.document()).simulation.save(),recorder.save());
 }
});
test('unsupported actual terrain and complete impact occupancy cannot spend RNG or deal damage',()=>{
 for(const options of [{overlay:true},{elevation:true},{sharedTarget:true}]){
  const {model}=bind(ordinaryFixture(options)),sim=WorldSimulation.create(model);sim.admitCommands([attack]);
  assert(!sim.step(8).events.some(e=>e.kind==='fired'||e.kind==='fire-started'));
  assert.equal(sim.save().state.entities[1]!.health,100);assert.equal(sim.save().state.combat!.ordinaryRandom!.draws,0);
  assert.equal(sim.save().state.combat!.infantryFiring![0]!.state.pending,null);
 }
});
test('a target moving on the due tick cancels the attempt and starts a fresh windup after it stops',()=>{
 const {model}=bind(ordinaryFixture()),recorder=new WorldReplayRecorder(model);recorder.admitCommands([attack]);recorder.step(2);
 recorder.admitCommands([{schemaVersion:1,tick:2,playerId:1,sequence:0,kind:'move',payload:{entityId:2,x:7,y:8}}]);
 const step=recorder.step();assert(step.events.some(e=>e.kind==='fire-cancelled-context'));assert(!step.events.some(e=>e.kind==='fired'));
 assert.equal(recorder.save().state.combat!.ordinaryRandom!.draws,0);
 let restarted:number|null=null,shot:number|null=null;
 for(let tick=3;tick<20;tick++){
  const step=recorder.step();if(step.events.some(e=>e.kind==='fire-started')&&restarted===null)restarted=tick;
  if(step.events.some(e=>e.kind==='fired')){shot=tick;break;}
 }
 assert(restarted!==null&&restarted>2);assert.equal(shot,restarted+2);
 assert.deepEqual(replayWorld(model,recorder.document()).simulation.save(),recorder.save());
});
test('source context exhaustion rolls back the entire candidate tick and pending saves reject moving targets',()=>{
 const f=ordinaryFixture(),b=compileOrdinaryInfantryBridge(f,{contextWork:0}),{model}=bind(f,b),s=WorldSimulation.create(model);s.admitCommands([attack]);
 const before=s.saveText();assert.throws(()=>s.step(),/context-work/);assert.equal(s.saveText(),before);
 const good=bind(ordinaryFixture()),sim=WorldSimulation.create(good.model);sim.admitCommands([attack]);sim.step();const pending=sim.save();
 pending.state.entities[1]!.goal=7+512*8;
 assert.throws(()=>WorldSimulation.restore(good.model,pending),/source-save-pending/);
});
