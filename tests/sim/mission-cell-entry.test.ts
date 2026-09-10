// SPDX-License-Identifier: GPL-3.0-or-later
// Original small mission fixtures; no retail rows or geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { missionBindingsFixture } from './mission-bindings-fixture.ts';
import { compileMissionBindings, prepareMissionBindings, missionBindingSourceContext } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileMissionProgram, MissionLogic, replayMission, MISSION_TIMING_POLICY } from '../../packages/sim/src/mission-logic.ts';
import { compileMissionWorld, createMissionWorld, restoreMissionWorld, admitMissionWorld, stepMissionWorld, replayMissionWorld, isMissionWorldPresentation } from '../../packages/sim/src/mission-world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
import { compileMissionCues } from '../../packages/content/src/mission-cues.ts';
const digest = async (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function input({ profile='ra2' as 'ra2'|'yr', mode=2, events='Start=1,1,0,0', actions='Start=1,28,0,1,0,0,0,0,A', extraTriggers='', extraTags='', extraEvents='', extraActions='', extra='', infantryRows='0=Commander,Walker,256,2,2,0,Guard,0,None,0,0,0,0,0', speed=128 }={}) {
  return missionBindingsFixture({profile, speed, infantryRows, extraMap:`[Triggers]\nStart=Blue,<none>,Original,0,1,1,1,0\n${extraTriggers}\n[Tags]\nShared=${mode},Original,Start\n${extraTags}\n[Events]\n${events}\n${extraEvents}\n[Actions]\n${actions}\n${extraActions}\n[CellTags]\n2003=Shared\n3003=Shared\n${extra}`});
}
async function setup(options:Parameters<typeof input>[0]={}, cue=false) {
  const f=input(options), catalog=compileMissionBindings(f), cells=compileMissionCellEntrySource({bindings:catalog});
  assert.deepEqual(cells.diagnostics,[]);assert.equal(cells.events.every(e=>e.status==='supported'),true);
  const cues=cue?compileMissionCues({profile:f.mission.source.profile,mission:{path:'original.map',...f.mission},strings:null}):undefined;
  const prepared=await prepareMissionBindings(catalog,cues,cells);assert.ok(prepared.authority,JSON.stringify(prepared.compilation?.diagnostics));
  const flags=compileMissionInitialFlags({bindings:catalog,bytes:f.mission.bytes,initialization:'new-campaign'});
  const model=compileMissionWorld({world:f.world.model,bindings:prepared.authority,flags});
  const vm=()=>MissionLogic.create(prepared.authority!.program,{bindings:prepared.authority!.bindings,globals:flags.globals,locals:flags.locals});
  return {f,catalog,cells,cues,prepared,flags,model,vm};
}
const actions=(effects:readonly {opcode:number}[])=>effects.filter(e=>e.opcode===28).length;
const fired=(vm:MissionLogic)=>vm.save().bindings[0]!.triggers[0]!.fired;
test('genuine source context and complete cell operands are required before event1 admission',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const s=await setup({profile}),context=missionBindingSourceContext(s.catalog);
  assert.equal(context,missionBindingSourceContext(s.catalog));assert.equal(context.world,s.f.world);assert.ok(Object.isFrozen(context));assert.ok(Object.isFrozen(context.houses));
  assert.throws(()=>missionBindingSourceContext({...s.catalog}),/catalog/);
  let reads=0;assert.throws(()=>missionBindingSourceContext(new Proxy(s.catalog,{get(){reads++;throw Error('read');}})),/catalog/);assert.equal(reads,0);
  assert.equal((await prepareMissionBindings(s.catalog)).authority,null);
  const other=compileMissionBindings(input({profile,extra:'[VariableNames]\n1=Different,1'}));
  await assert.rejects(prepareMissionBindings(other,undefined,s.cells),/cell-source/);
  const logic=structuredClone(context.logic);Object.defineProperty(logic.events[0]!.instructions[0]!, 'parameters', {value:['0','1']});
  const result=await compileMissionProgram(logic,{contentIdentity:s.f.world.model.contentIdentity,difficulty:1,timingPolicy:MISSION_TIMING_POLICY},digest,undefined,s.cells);
  assert.equal(result.program,null);assert.ok(result.diagnostics.some(d=>d.code==='unsupported-cell-entry-source'));
  await assert.rejects(replayMission(s.prepared.authority!.program,{} as never,digest),/requires-world/);
 }
});
test('only completed authoritative crossings dispatch; reservations and later idle ticks do not fire',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const s=await setup({profile}),initial=createMissionWorld(s.model);
  let state=admitMissionWorld(s.model,initial,{commands:[{schemaVersion:1,tick:0,sequence:0,playerId:0,kind:'move',payload:{entityId:1,x:3,y:2}}],flags:[]});
  let crossed=0,emitted=0,progress=false;
  for(let i=0;i<8;i++){
   const next=stepMissionWorld(s.model,state);const entries=next.worldEvents.filter(e=>e.phase==='movement'&&e.kind==='moved'&&e.cell===1027);
   crossed+=entries.length;emitted+=actions(next.effects);progress ||= next.worldEvents.some(e=>e.kind==='progress');
   assert.equal(actions(next.effects),entries.length);state=restoreMissionWorld(s.model,next.checkpoint);
  }
  assert.equal(crossed,1);assert.equal(emitted,1);assert.equal(state.mission.globals[1],true);assert.ok(progress);
  assert.equal(state.mission.bindings[0]!.triggers[0]!.fired,1);
 }
});
test('generic entry matching distinguishes owner selectors and counts multiple repeat invocations in one tick',async()=>{
 for(const profile of ['ra2','yr'] as const){
  for(const selector of [0,1,-1]){
   const s=await setup({profile,events:`Start=1,1,0,${selector}`,infantryRows:'0=Commander,Walker,256,2,2,0,Guard,0,None,0,0,0,0,0\n1=Rival,Walker,256,4,2,0,Guard,0,None,0,0,0,0,0'});
   const vm=s.vm(),cellId=s.cells.cells[0]!.cellId;
   const result=vm.stepCellEntries([{cellId,entityId:2},{cellId,entityId:2},{cellId,entityId:2}]);
   assert.equal(actions(result.effects),selector===0?0:3);assert.equal(fired(vm),selector===0?0:3);
   const restored=MissionLogic.restore(s.prepared.authority!.program,vm.save());assert.deepEqual(restored.save(),vm.save());restored.step();assert.equal(fired(restored),fired(vm));
  }
  const once=await setup({profile,mode:0}),vm=once.vm(),entry={cellId:once.cells.cells[0]!.cellId,entityId:1};
  assert.equal(actions(vm.stepCellEntries([entry,entry]).effects),1);assert.equal(vm.save().bindings[0]!.active,false);
 }
});
test('crossing observations are transient across elapsed and flag predicates, including repeating timers',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const s=await setup({profile,events:'Start=3,1,0,0,13,0,1,27,0,2'}),vm=s.vm(),entry={cellId:s.cells.cells[0]!.cellId,entityId:1};
  vm.enqueue([{tick:0,sequence:0,kind:'global',index:2,value:true}]);assert.equal(actions(vm.stepCellEntries([entry]).effects),0);
  vm.step(15);assert.equal(fired(vm),0);assert.equal(actions(vm.stepCellEntries([entry]).effects),1);
  assert.equal(actions(vm.stepCellEntries([entry]).effects),0);vm.step(15);assert.equal(fired(vm),1);
  assert.equal(actions(vm.stepCellEntries([entry]).effects),1);
 }
});
test('source force/deletion effects preserve order and suppress later same-tick cell delivery',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const s=await setup({profile,actions:'Start=3,22,2,Other,0,0,0,0,A,12,2,Start,0,0,0,0,A,28,0,1,0,0,0,0,A',
   extraTriggers:'Other=Blue,<none>,Other,0,1,1,1,0',extraTags:'OtherTag=2,Other,Other',extraEvents:'Other=1,0,0,0',extraActions:'Other=1,28,0,2,0,0,0,0,A',
   infantryRows:'0=Commander,Walker,256,2,2,0,Guard,0,OtherTag,0,0,0,0,0'});
  const vm=s.vm(),entry={cellId:s.cells.cells[0]!.cellId,entityId:1},effects=vm.stepCellEntries([entry,entry]).effects;
  assert.deepEqual(effects.map(e=>e.opcode),[22,28,12,28]);assert.equal(vm.save().globals[1],true);assert.equal(vm.save().globals[2],true);
  assert.equal(vm.save().bindings.find(b=>b.id==='binding:tag:shared')!.active,false);
  assert.deepEqual(MissionLogic.restore(s.prepared.authority!.program,vm.save()).save(),vm.save());
 }
});
test('cell/world work and input failures are atomic, and generic effects cannot impersonate compound presentation',async()=>{
 const s=await setup({actions:'Start=1,48,0,0,0,0,0,0,A'},true),vm=s.vm(),entry={cellId:s.cells.cells[0]!.cellId,entityId:1},before=vm.save();
 assert.throws(()=>vm.stepCellEntries([entry,{...entry,entityId:999}]),/observation/);assert.deepEqual(vm.save(),before);
 let reads=0;const hostile=Object.defineProperty({...entry},'entityId',{get(){reads++;return 1;}});
 assert.throws(()=>vm.stepCellEntries([hostile]));assert.equal(reads,0);assert.deepEqual(vm.save(),before);
 const claim=vm.stepCellEntries([entry]);assert.equal(isMissionWorldPresentation(s.model,claim),false);
 const initial=createMissionWorld(s.model),admitted=admitMissionWorld(s.model,initial,{commands:[{schemaVersion:1,tick:0,sequence:0,playerId:0,kind:'move',payload:{entityId:1,x:3,y:2}}],flags:[]});
 const saved=structuredClone(admitted);assert.throws(()=>stepMissionWorld(s.model,admitted,8,0));assert.deepEqual(admitted,saved);
 const result=stepMissionWorld(s.model,admitted,8);assert.ok(result.presentation);assert.equal(isMissionWorldPresentation(s.model,result.presentation),true);
 assert.equal(result.presentation.requests.length,1);assert.equal(isMissionWorldPresentation(s.model,structuredClone(result.presentation)),false);
 assert.equal(restoreMissionWorld(s.model,result.checkpoint).presentation!.nextSequence,1);
});

test('every boundary, grouped steps and replay preserve repeated source requests and queued orders',async()=>{
 for(const profile of ['ra2','yr'] as const){
  const s=await setup({profile,actions:'Start=1,48,0,0,0,0,0,0,A'},true),initial=createMissionWorld(s.model);
  const first={commands:[{schemaVersion:1 as const,tick:0,sequence:0,playerId:0,kind:'move',payload:{entityId:1,x:3,y:2}}],flags:[{tick:3,sequence:0,kind:'local' as const,index:2,value:true}]};
  const second={commands:[{schemaVersion:1 as const,tick:5,sequence:1,playerId:0,kind:'move',payload:{entityId:1,x:2,y:2}},{schemaVersion:1 as const,tick:9,sequence:2,playerId:0,kind:'move',payload:{entityId:1,x:3,y:2}}],flags:[]};
  let state=admitMissionWorld(s.model,initial,first);const start=state,checkpoints=[state],effects:unknown[]=[],worldEvents:unknown[]=[],requests:unknown[]=[];
  for(let tick=0;tick<16;tick++){
   if(tick===4)state=admitMissionWorld(s.model,state,second);
   const result=stepMissionWorld(s.model,state);effects.push(...result.effects);worldEvents.push(...result.worldEvents);requests.push(...result.presentation!.requests);
   state=restoreMissionWorld(s.model,JSON.stringify(result.checkpoint));checkpoints.push(state);
  }
  assert.equal(requests.length,2);assert.equal(state.presentation!.nextSequence,2);assert.equal(state.mission.locals[2],true);
  const firstGroup=stepMissionWorld(s.model,start,4),secondGroup=stepMissionWorld(s.model,admitMissionWorld(s.model,firstGroup.checkpoint,second),12);
  assert.deepEqual(secondGroup.checkpoint,state);assert.deepEqual([...firstGroup.effects,...secondGroup.effects],effects);assert.deepEqual([...firstGroup.worldEvents,...secondGroup.worldEvents],worldEvents);
  assert.deepEqual([...firstGroup.presentation!.requests,...secondGroup.presentation!.requests],requests);
  for(let at=0;at<16;at++){
   const admittedSecond=at<=4?[{nextTick:4,input:second}]:[];
   const replay=replayMissionWorld(s.model,{schemaVersion:1,modelSha256:s.model.sha256,initialCheckpoint:checkpoints[at]!,admissions:admittedSecond,finalNextTick:16,finalStateSha256:worldHash(state)});
   assert.deepEqual(replay.checkpoint,state);assert.equal(isMissionWorldPresentation(s.model,replay.presentation),true);
   assert.deepEqual(replay.presentation!.requests,requests.filter((r:any)=>r.tick>=at));
  }
  const all=replayMissionWorld(s.model,{schemaVersion:1,modelSha256:s.model.sha256,initialCheckpoint:initial,admissions:[{nextTick:0,input:first},{nextTick:4,input:second}],finalNextTick:16,finalStateSha256:worldHash(state)});
  assert.deepEqual(all.effects,effects);assert.deepEqual(all.worldEvents,worldEvents);assert.deepEqual(all.presentation!.requests,requests);
 }
});
