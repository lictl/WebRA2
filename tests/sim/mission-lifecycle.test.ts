// SPDX-License-Identifier: GPL-3.0-or-later
// Original trigger programs: no retail rows, labels, or payloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileScenarioLogic } from '../../packages/content/src/scenario-logic.ts';
import { canonicalHash } from '../../packages/sim/src/canonical.ts';
import { compileMissionProgram, MissionLogic, replayMission, MISSION_TIMING_POLICY, type MissionProgram } from '../../packages/sim/src/mission-logic.ts';
const digest = async (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
type Spec = { id: string; mode?: 0 | 2; disabled?: boolean; levels?: string; attached?: string; events?: [number,number][]; actions: [number,number|string][] };
async function compiled(profile: 'ra2'|'yr', specs: Spec[]) {
  const text = '[Basic]\nNewINIFormat=4\n[Triggers]\n'+specs.map(s=>`${s.id}=Owner,${s.attached??'<none>'},Original,${s.disabled?1:0},${s.levels??'1,1,1'},0`).join('\n')+
    '\n[Tags]\n'+specs.map(s=>`tag_${s.id}=${s.mode??0},Original,${s.id}`).join('\n')+
    '\n[Events]\n'+specs.map(s=>{const ev=s.events??[[8,0]];return `${s.id}=${[ev.length,...ev.flatMap(([op,n])=>[op,0,n])].join(',')}`;}).join('\n')+
    '\n[Actions]\n'+specs.map(s=>`${s.id}=${[s.actions.length,...s.actions.flatMap(([op,n])=>[op,[12,22,53,54].includes(op)?2:0,n,0,0,0,0,'A'])].join(',')}`).join('\n')+'\n';
  const bytes=new TextEncoder().encode(text), source={id:'original.map',profile,sha256:await digest(bytes)};
  return compileMissionProgram(compileScenarioLogic({profile,source,bytes}),{contentIdentity:{profile,manifestSha256:'1'.repeat(64),rulesSha256:'2'.repeat(64),orderedModHashes:[]},difficulty:1,timingPolicy:MISSION_TIMING_POLICY},digest);
}
async function program(profile:'ra2'|'yr',specs:Spec[]){const r=await compiled(profile,specs);assert.deepEqual(r.diagnostics,[]);assert.ok(r.program);return r.program;}
function create(p:MissionProgram,duplicate?:string){const bindings=p.tags.map(t=>({id:t.id,tagId:t.id,attachmentIds:['attachment:'+t.id]}));
 if(duplicate)bindings.push({id:'zz-extra',tagId:'tag:tag_'+duplicate.toLowerCase(),attachmentIds:['extra-attachment']});
 return MissionLogic.create(p,{bindings,globals:Array(50).fill(false),locals:Array(100).fill(false)});}
const find=(s:ReturnType<MissionLogic['save']>,id:string)=>s.bindings.find(b=>b.tagId==='tag:tag_'+id.toLowerCase())!.triggers.find(t=>t.id==='trigger:'+id.toLowerCase())!;

test('forced nested actions preserve depth-first effects without polling, timer resets or once removal',async()=>{
 for(const profile of ['ra2','yr'] as const){const p=await program(profile,[
  {id:'AAA',actions:[[56,0],[22,'BBB'],[57,0]]},
  {id:'BBB',events:[[13,20]],actions:[[56,1],[22,'CCC'],[57,1]]},
  {id:'CCC',mode:2,events:[[0,0]],actions:[[56,2]]}]);const sim=create(p);const events=sim.step().effects;
  assert.deepEqual(events.map(e=>e.opcode),[56,22,56,22,56,57,57]);
  assert.deepEqual(events.map(e=>e.order),[1,2,3,4,5,6,7]);
  const state=sim.save();assert.deepEqual(state.locals.slice(0,3),[false,false,true]);
  assert.equal(find(state,'BBB').forced,1);assert.equal(find(state,'BBB').fired,0);assert.equal(find(state,'BBB').destroyed,false);assert.equal(find(state,'BBB').elapsedDue,300);
  assert.equal(find(state,'CCC').forced,1);assert.deepEqual(find(state,'CCC').observations,[false]);
  assert.deepEqual(MissionLogic.restore(p,state).save(),state);
 }
});

test('forcing visits all current instances and respects disabled, deleted and difficulty-gated entry',async()=>{
 for(const profile of ['ra2','yr'] as const){const p=await program(profile,[
  {id:'AAA',actions:[[22,'BBB'],[22,'CCC'],[22,'DDD'],[12,'EEE'],[53,'EEE'],[22,'EEE']]},
  {id:'BBB',events:[[0,0]],actions:[[56,0]]},{id:'CCC',disabled:true,actions:[[56,1]]},
  {id:'DDD',levels:'1,0,1',actions:[[56,2]]},{id:'EEE',mode:2,events:[[0,0]],actions:[[56,3]]}]);
  const sim=create(p,'BBB'),step=sim.step();assert.equal(step.effects.filter(e=>e.opcode===56).length,2);
  assert.deepEqual(sim.save().locals.slice(0,4),[true,false,false,false]);assert.equal(find(sim.save(),'EEE').deleted,true);
  assert.equal(find(sim.save(),'EEE').forced,0);assert.equal(find(sim.save(),'CCC').forced,0);assert.equal(find(sim.save(),'DDD').forced,0);
  assert.deepEqual(MissionLogic.restore(p,sim.save()).save(),sim.save());
 }
});

test('a forced self-disable stops nested reentry but completes its current action list',async()=>{
 for(const profile of ['ra2','yr'] as const){const p=await program(profile,[{id:'AAA',actions:[[22,'BBB']]},
  {id:'BBB',events:[[0,0]],actions:[[54,'BBB'],[22,'BBB'],[56,7]]}]);const sim=create(p);assert.deepEqual(sim.step().effects.map(e=>e.opcode),[22,54,22,56]);
  assert.equal(find(sim.save(),'BBB').forced,1);assert.equal(sim.save().locals[7],true);assert.equal(find(sim.save(),'BBB').enabled,false);
 }
});

test('deletion tombstones self and other targets without fabricated predicate fires or truncating retained actions',async()=>{
 for(const profile of ['ra2','yr'] as const){const p=await program(profile,[{id:'AAA',mode:2,actions:[[12,'AAA'],[56,0],[12,'BBB'],[22,'BBB']]},
  {id:'BBB',mode:2,actions:[[56,1]]}]);const sim=create(p);assert.deepEqual(sim.step().effects.map(e=>e.opcode),[12,56,12,22]);
  const state=sim.save();assert.equal(find(state,'AAA').fired,1);assert.equal(find(state,'BBB').fired,0);
  assert.ok(state.bindings.every(b=>!b.active&&b.triggers.every(t=>t.deleted&&t.destroyed)));
  assert.equal(sim.step().effects.length,0);assert.deepEqual(MissionLogic.restore(p,sim.save()).save(),sim.save());
  const bad=structuredClone(state);find(bad,'BBB').deleted=false;assert.throws(()=>MissionLogic.restore(p,bad));
 }
});

test('unbounded force cycles roll back the whole multi-tick transaction',async()=>{
 for(const profile of ['ra2','yr'] as const){const p=await program(profile,[{id:'AAA',events:[[13,1]],actions:[[22,'BBB']]},
  {id:'BBB',events:[[0,0]],actions:[[56,0],[22,'CCC']]},{id:'CCC',events:[[0,0]],actions:[[22,'BBB']]}]);
  const sim=create(p);sim.enqueue([{tick:3,sequence:0,kind:'local',index:5,value:true}]);const initial=sim.save();
  assert.throws(()=>sim.step(16),/mission-action-stack-limit/);assert.deepEqual(sim.save(),initial);
 }
});

test('wide acyclic forced effects exhaust the output budget atomically without a deep stack',async()=>{
 for(const profile of ['ra2','yr'] as const){const p=await program(profile,[
  {id:'AAA',actions:Array.from({length:20},()=>[22,'BBB'] as [number,string])},
  {id:'BBB',events:[[0,0]],actions:Array.from({length:20},()=>[22,'CCC'] as [number,string])},
  {id:'CCC',events:[[0,0]],actions:Array.from({length:100},()=>[0,0] as [number,number])}]);
  const sim=create(p),before=sim.save();assert.throws(()=>sim.step(),/mission-effect-limit/);assert.deepEqual(sim.save(),before);
 }
});

test('pending inputs, forced counters and deleted instances survive every boundary restore and replay',async()=>{
 for(const profile of ['ra2','yr'] as const){const p=await program(profile,[{id:'AAA',mode:2,events:[[36,0]],actions:[[22,'BBB']]},
  {id:'BBB',events:[[0,0]],actions:[[56,1]]},{id:'CCC',events:[[47,1]],actions:[[12,'BBB']]}]);const sim=create(p);
  sim.enqueue([{tick:2,sequence:0,kind:'local',index:0,value:true}]);const initial=sim.save(),checks=[];
  for(let i=0;i<19;i++){const restored=MissionLogic.restore(p,sim.save());assert.deepEqual(restored.step(),sim.step());assert.deepEqual(restored.save(),sim.save());checks.push({nextTick:sim.save().nextTick,sha256:await canonicalHash(sim.save(),digest)});}
  assert.equal(find(sim.save(),'BBB').forced,14);assert.equal(find(sim.save(),'BBB').deleted,true);
  const result=await replayMission(p,{schemaVersion:1,initialCheckpoint:initial,admissions:[],finalNextTick:19,checkpoints:checks},digest);
  assert.deepEqual(result.simulation.save(),sim.save());
  const old=structuredClone(sim.save()) as unknown as Record<string,unknown>;old.policy='webra2-mission-poll-1';assert.throws(()=>MissionLogic.restore(p,old),/mission-save-identity/);
 }
});

test('lifecycle targets retain named-source closure and radar action55 is not mistaken for forcing',async()=>{
 for(const profile of ['ra2','yr'] as const){const bad=await compiled(profile,[{id:'AAA',actions:[[22,'MISSING']]}]);assert.equal(bad.program,null);
  const short=await compiled(profile,[{id:'AA',actions:[[12,'AA']]}]);assert.equal(short.program,null);
  const radar=await compiled(profile,[{id:'AAA',actions:[[55,0]]}]);assert.equal(radar.program,null);
  const p=await program(profile,[{id:'AAA',actions:[]}]),sim=create(p);sim.step();const edited=sim.save();find(edited,'AAA').forced=1;assert.throws(()=>MissionLogic.restore(p,edited));
 }
});
