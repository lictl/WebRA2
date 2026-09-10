// SPDX-License-Identifier: GPL-3.0-or-later
// Original atomic composition. Core commands execute only on isolated world candidates.
import { parseJson } from './canonical.ts';
import type { CommandEnvelope } from '../../contracts/src/index.ts';
import { WorldSimulation, type WorldTrace } from './world.ts';
import { worldClone, worldHash, worldInteger, worldList, worldRecord, worldSourceHash } from './world-values.ts';
import { teamProgramWorld, teamRuntimeFail as fail, teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { prepareTeamTick, restoreTeamCheckpoint, teamRosterProgram, type TeamCheckpoint, type TeamRoster, type TeamOrder, type TeamEvent } from './team-runtime.ts';
export interface TeamWorldResult { readonly checkpoint:TeamCheckpoint;readonly orders:readonly TeamOrder[];
  readonly events:readonly (TeamEvent & {tick:number})[];readonly worldEvents:readonly WorldTrace[];readonly work:number }

/** Admit unrelated external orders between compound ticks; team-controlled actors cannot receive competing orders. */
export function admitTeamWorldCommands(roster:TeamRoster,input:unknown,commands:readonly unknown[]):TeamCheckpoint{
  const checkpoint=restoreTeamCheckpoint(roster,input);if(checkpoint.pending)fail('pending-admission');
  const p=teamRosterProgram(roster),simulation=WorldSimulation.restore(teamProgramWorld(p).model,checkpoint.world);
  const admitted=simulation.admitCommands(commands),actors=new Set(roster.bindings.flatMap(b=>[...b.actorIds]));
  for(const c of admitted)if(actors.has((c.payload as {entityId:number}).entityId))fail('competing-actor-command');
  return restoreTeamCheckpoint(roster,{...checkpoint,world:simulation.save()});
}
/** Commit exact prepared orders and world movement together, or return no new state at all. */
export function commitTeamTick(roster:TeamRoster,input:unknown,workLimit?:number):TeamWorldResult{
  const checkpoint=restoreTeamCheckpoint(roster,input),p=teamRosterProgram(roster),plan=checkpoint.pending;
  if(!plan)fail('missing-pending-plan');const budget=workLimit===undefined?p.limits.replayWork:worldInteger(workLimit,0,p.limits.replayWork);
  if(plan.work>budget)fail('step-work-limit');
  const model=teamProgramWorld(p).model,simulation=WorldSimulation.restore(model,checkpoint.world),actors=new Set(roster.bindings.flatMap(b=>[...b.actorIds]));
  for(const c of checkpoint.world.queuedCommands)if(actors.has((c.payload as {entityId:number}).entityId))fail('competing-actor-command');
  const owners=new Map(model.entities.map(e=>[e.id,e.owner])),cursor=new Map(checkpoint.world.state.admissionCursors.map(c=>[c.playerId,c.sequence]));
  const commands:CommandEnvelope[]=[],expected=new Map<number,TeamOrder>();
  if(plan.orders.length>p.limits.orders)fail('step-order-limit');
  for(const order of plan.orders){
    const owner=owners.get(order.entityId);if(owner===undefined||owner===null||expected.has(order.entityId))fail('order-actor');
    const sequence=(cursor.get(owner)??-1)+1;worldInteger(sequence,0,Number.MAX_SAFE_INTEGER);cursor.set(owner,sequence);
    expected.set(order.entityId,order);commands.push({schemaVersion:1,tick:plan.tick,playerId:owner,sequence,kind:order.kind,
      payload:order.kind==='move'?{entityId:order.entityId,x:order.x!,y:order.y!}:{entityId:order.entityId}});
  }
  const admitted=simulation.admitCommands(commands);if(admitted.length!==commands.length)fail('admission-receipt');
  const worldStep=simulation.step(1,budget-plan.work),receipts=new Set<number>();
  for(const e of worldStep.events){
    if(e.phase!=='command'||!expected.has(e.entityId))continue;
    const order=expected.get(e.entityId)!;
    if(receipts.has(e.entityId)||e.tick!==plan.tick||e.kind!==(order.kind==='move'?'move-accepted':'stopped')||
      (order.kind==='move'&&e.cell!==order.x!+512*order.y!))fail('command-receipt');
    receipts.add(e.entityId);
  }
  if(receipts.size!==expected.size||worldStep.nextTick!==plan.tick+1)fail('missing-command-receipt');
  if(worldStep.events.length+plan.events.length+plan.orders.length>p.limits.trace)fail('step-trace-limit');
  const work=plan.work+worldStep.work.entityVisits+worldStep.work.navigationExpansions+worldStep.work.transitions;
  if(work>budget)fail('step-work-limit');
  const next=restoreTeamCheckpoint(roster,{schemaVersion:1,policy:'webra2-team-transaction-1',rosterSha256:roster.sha256,
    world:simulation.save(),team:plan.nextTeam,pending:null});
  return freeze({checkpoint:next,orders:worldClone(plan.orders),events:plan.events.map(e=>({...e,tick:plan.tick})),worldEvents:worldStep.events,work});
}
/** All requested compound ticks commit to a returned candidate; caller-owned inputs are never mutated. */
export function stepTeamWorld(roster:TeamRoster,input:unknown,ticks=1,workLimit?:number):TeamWorldResult{
  const p=teamRosterProgram(roster),cap=p.limits;worldInteger(ticks,1,cap.ticks);
  const budget=workLimit===undefined?cap.replayWork:worldInteger(workLimit,0,cap.replayWork);
  let checkpoint=restoreTeamCheckpoint(roster,input),work=0;const orders:TeamOrder[]=[],events:(TeamEvent&{tick:number})[]=[],worldEvents:WorldTrace[]=[];
  for(let i=0;i<ticks;i++){
    const step=commitTeamTick(roster,prepareTeamTick(roster,checkpoint),budget-work);
    if(step.orders.length+step.events.length+step.worldEvents.length>cap.trace-orders.length-events.length-worldEvents.length)fail('batch-trace-limit');
    checkpoint=step.checkpoint;work+=step.work;orders.push(...step.orders);events.push(...step.events);worldEvents.push(...step.worldEvents);
  }
  return freeze({checkpoint,orders,events,worldEvents,work});
}
export interface TeamReplay { readonly schemaVersion:1;readonly rosterSha256:string;readonly initialCheckpoint:TeamCheckpoint;
  readonly admissions:readonly Readonly<{nextTick:number;commands:readonly CommandEnvelope[]}>[];readonly finalNextTick:number;readonly finalStateSha256:string }
/** Initial pending commands/plans execute exactly once; admissions contain only subsequent external batches. */
export function replayTeamWorld(roster:TeamRoster,input:unknown):TeamWorldResult{
  const p=teamRosterProgram(roster),value=typeof input==='string'||input instanceof Uint8Array?parseJson(input):worldClone(input);
  const r=worldRecord(value,['admissions','finalNextTick','finalStateSha256','initialCheckpoint','rosterSha256','schemaVersion']);
  worldSourceHash(r.finalStateSha256);
  // Reuse the strict checkpoint parser for all nested save/plan data before execution.
  if(!r||Object.keys(r).sort().join(',')!=='admissions,finalNextTick,finalStateSha256,initialCheckpoint,rosterSha256,schemaVersion'||r.schemaVersion!==1||r.rosterSha256!==roster.sha256)fail('replay-identity');
  let checkpoint=restoreTeamCheckpoint(roster,r.initialCheckpoint),work=0;
  const finalTick=worldInteger(r.finalNextTick,checkpoint.world.nextTick,Math.min(p.limits.tick,checkpoint.world.nextTick+p.limits.replayTicks));
  const raw=worldList(r.admissions,p.limits.replayAdmissions),admissions:{nextTick:number;commands:unknown[]}[]=[];let previous=checkpoint.world.nextTick,inputs=0;
  for(const a of raw){
    if(!a||typeof a!=='object'||Object.keys(a).sort().join(',')!=='commands,nextTick')fail('replay-admission');
    const row=a as {nextTick:unknown;commands:unknown},nextTick=worldInteger(row.nextTick,previous,finalTick),commands=worldList(row.commands,256);
    if(!commands.length||commands.length>p.limits.replayAdmissions-inputs)fail('replay-admission-limit');inputs+=commands.length;previous=nextTick;admissions.push({nextTick,commands});
  }
  const orders:TeamOrder[]=[],events:(TeamEvent&{tick:number})[]=[],worldEvents:WorldTrace[]=[];
  function advance(tick:number){while(checkpoint.world.nextTick<tick){
    const step=stepTeamWorld(roster,checkpoint,1,p.limits.replayWork-work);work+=step.work;
    if(step.orders.length+step.events.length+step.worldEvents.length>p.limits.trace-orders.length-events.length-worldEvents.length)fail('replay-trace-limit');
    orders.push(...step.orders);events.push(...step.events);worldEvents.push(...step.worldEvents);checkpoint=step.checkpoint;
  }}
  for(const a of admissions){advance(a.nextTick);checkpoint=admitTeamWorldCommands(roster,checkpoint,a.commands);}
  advance(finalTick);if(worldHash(checkpoint)!==r.finalStateSha256)fail('replay-final-hash');
  return freeze({checkpoint,orders,events,worldEvents,work});
}
