// SPDX-License-Identifier: GPL-3.0-or-later
// Original complete miniature missions; no retail rows, maps or assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-fixture.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionTeamCellSource } from '../../packages/sim/src/mission-team-cell-source.ts';
import { compileMissionTeamCellContext } from '../../packages/sim/src/mission-team-cell-context.ts';
import { restoreMissionTeamContext } from '../../packages/sim/src/mission-team-context.ts';
import { prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { MissionLogic } from '../../packages/sim/src/mission-logic.ts';
import { compileMissionWorld, createMissionWorld, stepMissionWorld, restoreMissionWorld, admitMissionWorld, replayMissionWorld, isMissionWorldPresentation } from '../../packages/sim/src/mission-world.ts';
import { compileMissionCues } from '../../packages/content/src/mission-cues.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';

async function setup({profile='ra2' as 'ra2'|'yr', script='0=3,1\n1=50,3', selector=-1, enterAction='28,0,0,0,0,0,0,A', rules='', extra='', cues=false}={}) {
  const extraMap='[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\nEnter=Blue,<none>,Enter,0,1,1,1,0\n'+
    '[Tags]\nStarter=0,Starter,Start\nCrossing=2,Crossing,Enter\n'+
    `[Events]\nStart=1,8,0,0\nEnter=1,1,0,${selector}\n`+
    `[Actions]\nStart=1,7,1,Squad,0,0,0,0,A\nEnter=1,${enterAction}\n`+
    '[CellTags]\n1003=Crossing\n2003=Crossing\n3003=Crossing\n3004=Crossing\n'+extra;
  const f=missionTeamFixture({profile,script,speed:128,waypoint:'0=1003\n1=3003',extraRules:rules,extraMap});
  const cells=compileMissionCellEntrySource({bindings:f.bindings});
  const teamCells=compileMissionTeamCellSource({cells,actions:f.source,definitions:f.definitions,rules:f.rules,mission:f.mission});
  const cueCatalog=cues?compileMissionCues({profile,mission:{path:'original.map',...f.mission},strings:null}):undefined;
  const prepared=await prepareMissionBindings(f.bindings,cueCatalog,cells,undefined,f.source);
  assert.ok(prepared.authority,JSON.stringify(prepared.compilation?.diagnostics));
  const flags=compileMissionInitialFlags({bindings:f.bindings,bytes:f.mission.bytes,initialization:'new-campaign'});
  const input={world:f.world.model,bindings:prepared.authority,flags,teamCells};
  return {...f,cells,teamCells,flags,prepared,input};
}
const moved=(events:readonly {phase:string;kind:string;cell:number|null}[],cells:readonly {x:number;y:number}[])=>events.filter(e=>e.phase==='movement'&&e.kind==='moved'&&cells.some(c=>c.y*512+c.x===e.cell)).length;

test('constructed actors deliver only actual cell crossings after the single team world advance',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const f=await setup({profile}),model=compileMissionWorld(f.input),initial=createMissionWorld(model);
  assert.equal(model.teamCellSourceSha256,f.teamCells.sha256);assert.equal(model.canStartCampaign,false);
  const emitted=stepMissionWorld(model,initial);assert.equal(emitted.checkpoint.teams!.history.length,0);
  const born=stepMissionWorld(model,emitted.checkpoint);assert.equal(born.checkpoint.teams!.history[0]!.kind,'spawned');
  // Spawning on a tagged cell itself is not a crossing.
  assert.equal(born.effects.length,moved(born.worldEvents,f.cells.cells));
  let checkpoint=born.checkpoint,total=moved(born.worldEvents,f.cells.cells),progress=false;
  for(let tick=2;tick<16;tick++){
   const result=stepMissionWorld(model,checkpoint);assert.equal(result.effects.filter(e=>e.opcode===28).length,moved(result.worldEvents,f.cells.cells));
   total+=moved(result.worldEvents,f.cells.cells);progress ||= result.worldEvents.some(e=>e.kind==='progress');
   assert.equal(result.checkpoint.world.nextTick,tick+1);assert.equal(result.checkpoint.mission.nextTick,tick+1);
   assert.deepEqual(result.checkpoint.world,result.checkpoint.teams!.team.world);checkpoint=result.checkpoint;
  }
  assert(total>0);assert(progress);assert.equal(checkpoint.mission.globals[0],true);
  assert.deepEqual(initial,createMissionWorld(model));
 }
});

test('every boundary and replay rederive spawned context, ordered cues and movement without a saved observation authority',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const f=await setup({profile,cues:true,enterAction:'48,0,0,0,0,0,0,A'}),model=compileMissionWorld(f.input),initial=createMissionWorld(model);
  const states=[initial];let checkpoint=initial;const effects:unknown[]=[],events:unknown[]=[],requests:unknown[]=[];
  for(let tick=0;tick<12;tick++){
   const a=stepMissionWorld(model,checkpoint),b=stepMissionWorld(model,restoreMissionWorld(model,JSON.stringify(checkpoint)));
   assert.deepEqual(a,b);effects.push(...a.effects);events.push(...a.worldEvents);requests.push(...a.presentation!.requests);
   checkpoint=a.checkpoint;states.push(checkpoint);
  }
  assert(requests.length>0);const batch=stepMissionWorld(model,initial,12);
  assert.deepEqual(batch.checkpoint,checkpoint);assert.deepEqual(batch.effects,effects);assert.deepEqual(batch.worldEvents,events);assert.deepEqual(batch.presentation!.requests,requests);
  for(const state of states){
   const replay=replayMissionWorld(model,{schemaVersion:1,modelSha256:model.sha256,initialCheckpoint:state,admissions:[],finalNextTick:12,finalStateSha256:worldHash(checkpoint)});
   assert.deepEqual(replay.checkpoint,checkpoint);assert.equal(isMissionWorldPresentation(model,replay.presentation),true);
  }
  assert.throws(()=>restoreMissionWorld(model,{...checkpoint,teamCellContext:{actors:[]}}));
 }
});

test('released births retain source ownership for player movement and cell-triggered next-tick team receipts',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const f=await setup({profile,script:'0=50,3',selector:0,enterAction:'80,1,Squad,0,0,0,0,B'}),model=compileMissionWorld(f.input);
  let checkpoint=stepMissionWorld(model,createMissionWorld(model),3).checkpoint;
  assert.equal(checkpoint.teams!.history.at(-1)!.kind,'released');assert.equal(checkpoint.teams!.team.team.instances.length,0);
  const birth=checkpoint.teams!.history.find(h=>h.kind==='spawned')!;assert.equal(birth.kind,'spawned');const actorId=birth.actors[0]!.entityId;
  const input={commands:[{schemaVersion:1 as const,tick:3,sequence:0,playerId:0,kind:'move',payload:{entityId:actorId,x:3,y:3}}],flags:[]};
  const initial=admitMissionWorld(model,checkpoint,input);checkpoint=initial;let crossings=0;
  for(let i=0;i<10;i++){
   const result=stepMissionWorld(model,checkpoint),newRequests=result.effects.filter(e=>e.kind==='team-request');
   crossings+=newRequests.length;
   for(const effect of newRequests){const q=result.checkpoint.teams!.requests.find(r=>r.effectOrder===effect.order)!;assert.equal(q.dueTick,effect.tick+1);assert.equal(q.status,'queued');}
   checkpoint=result.checkpoint;
  }
  assert(crossings>0);assert(checkpoint.teams!.history.filter(h=>h.kind==='spawned').length>1);
  assert.deepEqual(replayMissionWorld(model,{schemaVersion:1,modelSha256:model.sha256,initialCheckpoint:initial,admissions:[],finalNextTick:13,finalStateSha256:worldHash(checkpoint)}).checkpoint,checkpoint);
 }
});

test('VM dynamic actor context must be genuine and joined to its exact source catalogs',async()=>{
 const f=await setup({script:'0=50,3'}),model=compileMissionWorld(f.input),state=stepMissionWorld(model,createMissionWorld(model),3).checkpoint;
 const context=compileMissionTeamCellContext({source:f.teamCells,teams:restoreMissionTeamContext(f.runtime,state.teams!.history)});
 const vm=MissionLogic.restore(f.prepared.authority!.program,state.mission),entry={cellId:f.cells.cells[0]!.cellId,entityId:4},before=vm.save();
 assert.throws(()=>vm.stepCellEntries([entry]),/observation/);assert.deepEqual(vm.save(),before);
 for(const copy of [{...context},new Proxy(context,{})]){assert.throws(()=>vm.stepTeamCellEntries([entry],copy));assert.deepEqual(vm.save(),before);}
 const other=await setup({script:'0=50,3',extra:'[VariableNames]\n1=Original,0'});
 const otherContext=compileMissionTeamCellContext({source:other.teamCells,teams:restoreMissionTeamContext(other.runtime,[])});
 assert.throws(()=>vm.stepTeamCellEntries([],otherContext),/team-cell-source/);
 let reads=0;const hostile=Object.defineProperty({...entry},'entityId',{get(){reads++;return 4;}});
 assert.throws(()=>vm.stepTeamCellEntries([hostile],context));assert.equal(reads,0);assert.deepEqual(vm.save(),before);
 assert.equal(vm.stepTeamCellEntries([entry],context).effects.filter(e=>e.opcode===28).length,1);
});

test('future constructor preflight, exact capability joins and descriptor boundaries precede an empty history',async()=>{
 const f=await setup();assert.throws(()=>compileMissionWorld({world:f.input.world,bindings:f.input.bindings,flags:f.flags}),/team-dynamic-event-context/);
 for(const teamCells of [{...f.teamCells},new Proxy(f.teamCells,{})])assert.throws(()=>compileMissionWorld({...f.input,teamCells}),/team-cell-source/);
 const other=await setup({extra:'[VariableNames]\n1=Original,0'});assert.throws(()=>compileMissionWorld({...f.input,teamCells:other.teamCells}),/team-cell-context/);
 let reads=0;const hostile=Object.defineProperty({...f.input},'teamCells',{get(){reads++;return f.teamCells;}});assert.throws(()=>compileMissionWorld(hostile));assert.equal(reads,0);
 const cloak=await setup({rules:'Cloakable=yes'});assert.equal(cloak.teamCells.coverage.allRequiredConstructorsReady,false);
 assert.throws(()=>compileMissionWorld(cloak.input),/team-cell-context/);
});

test('dynamic context and delivery work failures publish neither a partial world nor VM or presentation state',async()=>{
 const f=await setup({cues:true,enterAction:'48,0,0,0,0,0,0,A'}),model=compileMissionWorld(f.input),initial=createMissionWorld(model);
 let checkpoint=initial;
 for(let tick=0;tick<8;tick++){
  const before=JSON.stringify(checkpoint),result=stepMissionWorld(model,checkpoint);
  assert.deepEqual(stepMissionWorld(model,checkpoint,1,result.work),result);
  assert.throws(()=>stepMissionWorld(model,checkpoint,1,result.work-1),/work|budget/);
  assert.equal(JSON.stringify(checkpoint),before);checkpoint=result.checkpoint;
 }
 assert.throws(()=>stepMissionWorld(model,initial,8,1),/work|budget/);assert.deepEqual(initial,createMissionWorld(model));
});
