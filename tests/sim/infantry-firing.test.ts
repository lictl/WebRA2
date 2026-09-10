// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCombatInitialRuntime, createInfantryFiringProgram } from '../../packages/content/src/combat-initial-runtime.ts';
import { createInfantryFiringState as create, transitionInfantryFiring as transition, inspectDueInfantryShot as due,
  saveInfantryFiring as save, restoreInfantryFiring as restore, replayInfantryFiring as replay, INFANTRY_FIRING_LIMITS,
  type InfantryFiringCommand as Command, type InfantryFiringState as State, type DueInfantryShot } from '../../packages/sim/src/infantry-firing.ts';
import { combatActorFingerprint } from '../../packages/content/src/combat-actor-values.ts';
import { initialFixture } from '../content/combat-initial-fixture.ts';
function fixture(fireUp=2,profile:'ra2'|'yr'='ra2') {
  const source=compileCombatInitialRuntime(initialFixture({profile,artText:`[Walker]\nFireUp=${fireUp}\n`}));
  return createInfantryFiringProgram(source,source.placements.find(p=>p.typeId==='type:infantry:walker')!.rowId);
}
function resolve(d:DueInfantryShot,decision:'admitted'|'blocked'='admitted',nativeRof:number|null=3):Command {
  return {kind:'resolve',stateHash:d.stateHash,attemptId:d.attemptId,targetId:d.targetId,weaponId:d.weaponId,decision,nativeRof};
}
const begin:Command={kind:'begin',targetId:7,weaponId:'weapon:original-test'};
test('logical FireUp requires an explicit current due-state admission and rearm is separate',()=>{
  for(const profile of ['ra2','yr'] as const){const p=fixture(2,profile);let s=create(p);
    const started=transition(p,s,begin);s=started.state;assert.equal(started.event?.kind,'started');assert.equal(due(p,s),null);
    s=transition(p,s,{kind:'advance',tick:1}).state;assert.equal(due(p,s),null);
    s=transition(p,s,{kind:'advance',tick:2}).state;const d=due(p,s)!;assert(d);assert.equal(s.shots,0);
    s=transition(p,s,{kind:'advance',tick:3}).state;assert.throws(()=>transition(p,s,resolve(d)),/stale-resolution/);
    const shot=transition(p,s,resolve(due(p,s)!));s=shot.state;assert.equal(shot.event?.kind,'shot');assert.equal(s.shots,1);assert.deepEqual(s.rearm,{shotTick:3,nativeRof:3});
    assert.throws(()=>transition(p,s,begin),/not-ready/);
    for(let tick=4;tick<=6;tick++)s=transition(p,s,{kind:'advance',tick}).state;
    assert(transition(p,s,begin).state.pending);assert.equal(s.shots,1);
  }
});
test('ROF zero remains zero while a separate next-update guard prevents two same-tick shots',()=>{
  const p=fixture(0);let s=transition(p,create(p),begin).state;
  s=transition(p,s,resolve(due(p,s)!,'admitted',0)).state;assert.equal(s.rearm?.nativeRof,0);
  assert.throws(()=>transition(p,s,begin),/not-ready/);s=transition(p,s,{kind:'advance',tick:1}).state;
  s=transition(p,s,begin).state;s=transition(p,s,resolve(due(p,s)!,'admitted',0)).state;assert.equal(s.shots,2);
});
test('blocked and cancelled attempts never produce a shot or change rearm and obsolete resolutions fail',()=>{
  const p=fixture(0),initial=create(p);let s=transition(p,initial,begin).state;const old=due(p,s)!;
  const blocked=transition(p,s,resolve(old,'blocked',null));s=blocked.state;assert.equal(blocked.event?.kind,'blocked');assert.equal(s.shots,0);assert.equal(s.rearm,null);
  s=transition(p,s,begin).state;const second=due(p,s)!;assert.equal(second.attemptId,old.attemptId+1);assert.throws(()=>transition(p,s,resolve(old)),/stale-resolution/);
  s=transition(p,s,{kind:'cancel'}).state;assert.equal(s.pending,null);assert.throws(()=>transition(p,s,resolve(second)),/stale-resolution/);
  assert.equal(transition(p,s,{kind:'cancel'}).state,s);assert.equal(initial.nextAttemptId,1);
});
test('target, weapon and current-state identity joins reject forged decisions without mutation',()=>{
  const p=fixture(0),s=transition(p,create(p),begin).state,c=resolve(due(p,s)!);assert.equal(c.kind,'resolve');const before=save(p,s);
  for(const delta of [{targetId:8},{weaponId:'other'},{attemptId:2},{stateHash:'f'.repeat(64)},{decision:'yes'},{nativeRof:-1},{nativeRof:NaN},{decision:'blocked',nativeRof:0}])
    assert.throws(()=>transition(p,s,{...c,...delta} as Command));
  assert.deepEqual(save(p,s),before);assert.equal(due(p,s)?.targetId,7);
});
test('pending and rearming saves restore independently, own their data and replay agrees',()=>{
  const p=fixture(2),commands:Command[]=[],events:unknown[]=[];let s=create(p);
  function run(c:Command){commands.push(c);const r=transition(p,s,c);s=r.state;if(r.event)events.push(r.event);const raw=structuredClone(save(p,s));const restored=restore(p,raw);assert.deepEqual(restored,s);if(raw.state.pending)(raw.state.pending as {weaponId:string}).weaponId='changed';assert.deepEqual(restored,s);}
  run(begin);run({kind:'advance',tick:1});run({kind:'advance',tick:2});run(resolve(due(p,s)!));
  for(let tick=3;tick<=5;tick++)run({kind:'advance',tick});run(begin);run({kind:'cancel'});
  const result=replay(p,commands);assert.deepEqual(result.state,s);assert.deepEqual(result.events,events);
  assert(Object.isFrozen(result.events));assert(Object.isFrozen(save(p,s).state.rearm));
});
test('forty generated original transcripts preserve every checkpoint and explicit shot decisions',()=>{
  for(let seed=0;seed<40;seed++){
    const p=fixture(seed%4,seed%2?'yr':'ra2');let s=create(p),random=seed+1;const commands:Command[]=[];
    const run=(c:Command)=>{commands.push(c);s=transition(p,s,c).state;assert.deepEqual(restore(p,JSON.parse(JSON.stringify(save(p,s)))),s);};
    for(let tick=0;tick<60;tick++){
      if(tick)run({kind:'advance',tick});random=(Math.imul(random,1664525)+1013904223)>>>0;
      if(s.pending){const d=due(p,s);if(random%7===0)run({kind:'cancel'});else if(d)run(resolve(d,random%5===0?'blocked':'admitted',random%5===0?null:random%4));}
      else if(!s.rearm||tick>=s.rearm.shotTick+Math.max(1,s.rearm.nativeRof))run({...begin,targetId:2+random%20===p.actorId?30:2+random%20});
    }
    assert.deepEqual(replay(p,commands).state,s);
  }
});
test('save schema, source identity, impossible timing and descriptor attacks fail closed',()=>{
  const p=fixture(2),s=transition(p,create(p),begin).state;
  const mutate=(change:(v:any)=>void)=>{const v=structuredClone(save(p,s));change(v);(v as {stateHash:string}).stateHash=combatActorFingerprint(v.state,65536);return v;};
  for(const change of [(v:any)=>v.state.tick=-0,(v:any)=>v.state.pending.dueTick++,(v:any)=>v.state.pending.attemptId++,
    (v:any)=>v.state.nextAttemptId=0,(v:any)=>v.state.pending.targetId=p.actorId,(v:any)=>v.state.shots=50,
    (v:any)=>v.state.rearm={shotTick:0,nativeRof:0},(v:any)=>v.state.programFingerprint='0'.repeat(64),
    (v:any)=>v.state.pending.weaponId='',(v:any)=>v.state.extra=true,
    (v:any)=>{v.state.pending=null;v.state.shots=1;v.state.rearm={shotTick:0,nativeRof:0};}])assert.throws(()=>restore(p,mutate(change)));
  assert.throws(()=>restore(fixture(3),save(p,s)));assert.throws(()=>restore(p,{...save(p,s),stateHash:'0'.repeat(64)}));
  let reads=0;const v=structuredClone(save(p,s));Object.defineProperty(v.state,'tick',{enumerable:true,get(){reads++;return 0;}});assert.throws(()=>restore(p,v));assert.equal(reads,0);
  assert.throws(()=>transition(p,{...s},begin));assert.throws(()=>create({...p}));
});
test('tick, attempt, aggregate replay and integer bounds are explicit and failures are atomic',()=>{
  const p=fixture(0);let s=create(p);assert.throws(()=>transition(p,s,{kind:'advance',tick:2}));
  assert.throws(()=>transition(p,s,{...begin,targetId:p.actorId}));assert.throws(()=>transition(p,s,{...begin,targetId:Infinity}));
  const raw=structuredClone(save(p,s));(raw.state as {nextAttemptId:number}).nextAttemptId=INFANTRY_FIRING_LIMITS.attempts+1;
  (raw as {stateHash:string}).stateHash=combatActorFingerprint(raw.state,65536);s=restore(p,raw);assert.throws(()=>transition(p,s,begin),/attempt-limit/);
  const max=structuredClone(save(p,create(p)));(max.state as {tick:number}).tick=INFANTRY_FIRING_LIMITS.tick;(max as {stateHash:string}).stateHash=combatActorFingerprint(max.state,65536);
  const end=transition(p,restore(p,max),begin).state;assert.throws(()=>transition(p,end,resolve(due(p,end)!,'admitted',0)),/integer/);assert.equal(end.shots,0);
  assert.throws(()=>replay(p,[begin],0));assert.throws(()=>replay(p,[],INFANTRY_FIRING_LIMITS.commands+1));
  const sparse=new Array(1);assert.throws(()=>replay(p,sparse));const extra:any[]=[];Object.assign(extra,{payload:new Uint8Array(4)});assert.throws(()=>replay(p,extra));
});
test('unknown command fields and accessors are rejected without invoking caller code',()=>{
  const p=fixture(),s=create(p);let reads=0;
  for(const key of ['kind','targetId','weaponId']){const c=Object.defineProperty({...begin},key,{enumerable:true,get(){reads++;return 'bad';}});assert.throws(()=>transition(p,s,c));assert.throws(()=>replay(p,[c]));}
  assert.equal(reads,0);assert.throws(()=>transition(p,s,{...begin,extra:true} as Command));
  assert.throws(()=>transition(p,s,{...begin,weaponId:new String('x')} as never));assert.equal(s.nextAttemptId,1);
});
