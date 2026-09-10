// SPDX-License-Identifier: GPL-3.0-or-later
// Original source fixtures only; these are worker/session tests, not Chrome acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ordinaryFixture } from '../sim/ordinary-infantry-fixture.ts';
import { compileOrdinaryInfantryBridge } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { bindOrdinaryInfantryWorld } from '../../packages/sim/src/source-infantry-world.ts';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { validWorldAction, validWorldSummary, validWorldSnapshot } from '../../apps/web/src/world-protocol.ts';
import { worldText,worldEventText } from '../../apps/web/src/world-i18n.ts';
function setup(options:Parameters<typeof ordinaryFixture>[0]={}){
 const f=ordinaryFixture(options),bridge=compileOrdinaryInfantryBridge(f),prepared={...f.world,model:bindOrdinaryInfantryWorld(bridge,f.world.model)};
 return new WorldSession(prepared);
}
const attack={type:'world-orders' as const,order:'attack' as const,entityIds:[1],playerId:0,targetId:2,expectedRevision:0};
test('worker summary exposes genuine source roles and attack admission preserves revisions and ownership',()=>{
 const s=setup();assert(validWorldSummary(s.summary));assert(validWorldSnapshot(s.snapshot(),s.summary));
 assert.equal(s.summary.combatPolicy,'webra2-source-standing-infantry-combat-1');assert.deepEqual(s.summary.actors.map(a=>a.combatRole),['attacker','target-only']);
 const before=s.snapshot();assert.throws(()=>s.act({...attack,entityIds:[2],playerId:1,targetId:1}),/attack-unsupported/);assert.deepEqual(s.snapshot(),before);
 assert.throws(()=>s.act({...attack,playerId:1}),/not-owner/);assert.deepEqual(s.snapshot(),before);
 assert.throws(()=>s.act({...attack,expectedRevision:1}),/stale-orders/);assert.deepEqual(s.snapshot(),before);
 assert(validWorldAction(attack));s.act(attack);assert.equal(s.snapshot().queuedCommands,1);assert.equal(s.revision,1);
});
test('delayed combat/death snapshots, save restore and replay cross the worker contract in both profiles',()=>{
 for(const profile of ['ra2','yr'] as const){
  const s=setup({profile});s.act(attack);s.act({type:'world-step',ticks:1});
  assert.equal(s.snapshot().actors[0]!.combat!.windupUntil,2);assert.equal(s.snapshot().actors[0]!.combat!.targetId,2);
  const saved=s.act({type:'world-save'})!,other=setup({profile});other.act({type:'world-restore',text:saved.text!});
  let sawDeath=false,sawCorpse=false;
  for(let i=0;i<28;i++){
   s.act({type:'world-step',ticks:4});other.act({type:'world-step',ticks:4});const snapshot=s.snapshot();
   assert(validWorldSnapshot(snapshot,s.summary));assert.equal(snapshot.stateHash,other.snapshot().stateHash);
   sawDeath ||= snapshot.events.some(e=>e.kind==='death-sequence');sawCorpse ||= snapshot.events.some(e=>e.kind==='corpse-selected');
  }
  assert(sawDeath&&sawCorpse);assert.equal(s.snapshot().actors[1]!.health,0);assert.equal(s.snapshot().actors[1]!.combat!.corpseIndex,0);
  const replay=s.act({type:'world-replay-export'})!;assert.equal(s.act({type:'world-replay-validate',text:replay.text!})!.stateHash,s.snapshot().stateHash);
 }
});
test('blocked context and moving targets reject atomically before source orders are recorded',()=>{
 for(const options of [{overlay:true},{elevation:true},{sharedTarget:true}]){
  const s=setup(options),before=s.snapshot();assert.throws(()=>s.act(attack),/attack-context/);assert.deepEqual(s.snapshot(),before);
 }
 const s=setup();s.act({type:'world-order',order:'move',playerId:1,entityId:2,x:7,y:8});s.act({type:'world-step',ticks:1});
 const before=s.snapshot();assert.throws(()=>s.act({...attack,expectedRevision:s.revision}),/attack-moving/);assert.deepEqual(s.snapshot(),before);
});
test('combat wire validators reject extra authority, inconsistent roles and impossible render states',()=>{
 const s=setup(),summary=structuredClone(s.summary);summary.actors[0]!.combatRole='movement-only';assert(validWorldSummary(summary));assert(!validWorldSnapshot(s.snapshot(),summary));
 for(const value of [{...attack,standing:true},{...attack,targetId:0},{...attack,entityIds:[1,1]}])assert(!validWorldAction(value));
 const snapshot=s.snapshot();snapshot.actors[0]!.combat!.windupUntil=2;assert(!validWorldSnapshot(snapshot,s.summary));
 const dead=s.snapshot();dead.actors[1]!.combat!.deathSequence=11;dead.actors[1]!.combat!.deathUntil=4;assert(!validWorldSnapshot(dead,s.summary));
 const extra=s.snapshot();Object.assign(extra.actors[0]!.combat!,{contextAuthorized:true});assert(!validWorldSnapshot(extra,s.summary));
});
test('both UI locales name attacks, cancellation and death rather than reporting unknown movement events',()=>{
 for(const locale of ['en','zh-Hant'] as const){
  for(const key of ['attack','attackTarget','firing','attacking','worldAttackRange','worldAttackMoving','worldAttackContext','worldAttackUnsupported'])assert.notEqual(worldText(locale,key),worldText(locale,'unknown'));
  for(const event of ['attack-accepted','fire-started','fire-cancelled-context','fired','damaged','dying','corpse-selected','destroyed'])assert.notEqual(worldEventText(locale,event),worldEventText(locale,'missing'));
 }
});
