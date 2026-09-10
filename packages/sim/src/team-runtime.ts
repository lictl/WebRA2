// SPDX-License-Identifier: GPL-3.0-or-later
// Original pure team state and source/actor binding. The transaction bridge owns cloned-world execution.
import { TEAM_SLEEP_POLICY, planTeamSleep, teamSleepFlow } from './team-sleep-policy.ts';
import { snapshotTeamFlashes, assignTeamFlashes, advanceTeamFlashes, type TeamFlashState } from './team-recruitment-flash.ts';
import { canonicalText, parseJson } from './canonical.ts';
import { WorldSimulation, type WorldSave, type WorldEntity } from './world.ts';
import type { WorldModel } from './world-model.ts';
import { teamSpawnContextData, type TeamSpawnContext } from './team-spawn-context.ts';
import { teamRecruitmentContextData, type TeamRecruitmentContext } from './team-recruitment-context.ts';
import { worldAddress, worldClone, worldHash, worldInteger, worldList, worldRecord, worldSymbol } from './world-values.ts';
import { navigationCell } from './navigation.ts';
import { planTeamDestinations, TEAM_DESTINATION_LIMITS, TEAM_DESTINATION_POLICY, type TeamDestinationAssignment } from './team-runtime-destinations.ts';
import { teamProgramWorld, teamRuntimeFail as fail, teamRuntimeFreeze as freeze, type TeamProgram, type TeamTemplate } from './team-runtime-program.ts';

export interface TeamActorBinding { readonly id: string; readonly teamId: string; readonly actorIds: readonly number[]; readonly bornAtTick?: number }
export interface TeamRoster { readonly policy: 'webra2-team-roster-1' | 'webra2-spawn-team-roster-1' | 'webra2-recruited-team-roster-1'; readonly contextSha256?: string; readonly programSha256: string; readonly worldModelSha256: string;
  readonly bindings: readonly TeamActorBinding[]; readonly sha256: string }
export type TeamPhase = 'advance' | 'moving' | 'retry' | 'sleep' | 'finished' | 'lost';
export interface TeamInstanceState {
  id: string; activeMembers: number[]; cursor: number; lastStep: number | null; phase: TeamPhase;
  assignments: TeamDestinationAssignment[]; issuedAt: number | null; retryAt: number | null;
}
export interface TeamState { nextTick: number; startedTick: number; nextOrderId: number; instances: TeamInstanceState[]; flashes: TeamFlashState[] }
export interface TeamOrder { orderId: number; instanceId: string; entityId: number; kind: 'move' | 'stop'; x: number | null; y: number | null }
export interface TeamEvent { instanceId: string; step: number | null; kind: 'move' | 'arrived' | 'jump' | 'blocked' | 'sleep' | 'flash' | 'lost' | 'finished' }
export interface TeamPendingTick {
  policy: 'webra2-team-transaction-1'; rosterSha256: string; baseWorldSha256: string; baseTeamSha256: string; tick: number;
  orders: TeamOrder[]; events: TeamEvent[]; nextTeam: TeamState; work: number; sha256: string;
}
export interface TeamCheckpoint {
  schemaVersion: 1; policy: 'webra2-team-transaction-1'; rosterSha256: string;
  world: WorldSave; team: TeamState; pending: TeamPendingTick | null;
}
const rosters = new WeakMap<object, TeamProgram>();
const spawnContexts = new WeakMap<object, TeamSpawnContext>();
const recruitmentContexts = new WeakMap<object, TeamRecruitmentContext>();
export const isTeamRoster = (v: unknown): v is TeamRoster => !!v && typeof v === 'object' && rosters.has(v);
export function teamRosterProgram(roster: TeamRoster): TeamProgram { const p=rosters.get(roster);if(!p)fail('roster-brand');return p; }

/** Dynamic models come only from genuine source-bound spawn contexts. */
export function teamRosterModel(roster: TeamRoster): WorldModel {
  const program=teamRosterProgram(roster),context=spawnContexts.get(roster);
  return context ? teamSpawnContextData(context).model : teamProgramWorld(program).model;
}
/** Only the genuine source catalog can provide empty, partial-template or recruited actor bindings. */
export function bindRecruitedTeamActors(context: TeamRecruitmentContext): TeamRoster {
  const data=teamRecruitmentContextData(context),program=data.program,world=teamProgramWorld(program);
  if(data.model!==world.model)fail('recruitment-binding-model');
  const templates=new Map(program.templates.map(t=>[t.id,t])),actors=new Map(data.actors.map(a=>[a.entityId,a]));
  const definitions=new Map(data.model.entities.map(e=>[e.id,e])),seen=new Set<number>();
  const bindings:TeamActorBinding[]=data.instances.map(b=>{
    const t=templates.get(b.teamId),quantities=new Map<string,number>();if(!t||!b.actorIds.length||b.actorIds.length>64)fail('recruitment-binding-team');
    for(const id of b.actorIds){const a=actors.get(id),d=definitions.get(id);
      if(!a||!d||seen.has(id)||a.rowId!==d.rowId||a.typeId!==d.typeId||a.houseId!==t.houseId||a.playerId!==t.playerId||d.owner!==t.playerId||
        a.bornAtTick!==b.bornAtTick||!['infantry','unit'].includes(d.kind))fail('recruitment-binding-actor');
      seen.add(id);quantities.set(d.typeId,(quantities.get(d.typeId)??0)+1);
    }
    if(quantities.size!==t.members.length||t.members.some(m=>quantities.get(m.typeId)!==m.quantity))fail('recruitment-binding-taskforce');
    return {id:b.id,teamId:b.teamId,actorIds:[...b.actorIds],bornAtTick:b.bornAtTick};
  });
  if(bindings.length>program.limits.teams||seen.size!==actors.size||seen.size>program.limits.members)fail('recruitment-binding-coverage');
  const value={policy:'webra2-recruited-team-roster-1' as const,contextSha256:context.sha256,programSha256:program.sha256,
    worldModelSha256:data.model.sha256,bindings};
  const roster:TeamRoster=freeze({...value,sha256:worldHash(value)});rosters.set(roster,program);recruitmentContexts.set(roster,context);return roster;
}
/** Apply exactly one current-tick claim/release, preserving the entire committed world and surviving controller state. */
export function migrateRecruitedTeamCheckpoint(priorContext:TeamRecruitmentContext,priorInput:unknown,nextContext:TeamRecruitmentContext):TeamCheckpoint {
  const before=teamRecruitmentContextData(priorContext),after=teamRecruitmentContextData(nextContext),same=(a:unknown,b:unknown)=>canonicalText(a)===canonicalText(b);
  if(before.catalog!==after.catalog||before.program!==after.program||before.model!==after.model||after.records.length!==before.records.length+1||
    !same(before.records,after.records.slice(0,before.records.length)))fail('recruitment-migration-prefix');
  const prior=restoreTeamCheckpoint(bindRecruitedTeamActors(priorContext),priorInput);if(prior.pending)fail('recruitment-migration-pending');
  const event=after.records.at(-1)!,tick=prior.world.nextTick,current=new Map(prior.world.state.entities.map(e=>[e.id,e]));
  const old=new Map(prior.team.instances.map(s=>[s.id,s]));
  if(event.kind==='recruited'){
    if(event.bornAtTick!==tick)fail('recruitment-migration-birth');
    const claimed=new Set(event.actorIds),queued=new Set(prior.world.queuedCommands.map(c=>(c.payload as {entityId:number}).entityId));
    for(const id of claimed){const e=current.get(id);if(!e||e.health===null||e.health===0||e.goal!==null||e.progress||e.route.length||queued.has(id))fail('recruitment-migration-busy');}
  }else{
    const terminal=old.get(event.instanceId);
    if(event.atTick!==tick||!terminal||terminal.phase!==event.reason||!['finished','lost'].includes(terminal.phase))fail('recruitment-migration-release');
    if(event.reason==='finished'&&terminal.activeMembers.some(id=>{const e=current.get(id)!;return e.health!==0&&(e.goal!==null||e.progress!==0||e.route.length!==0);}))fail('recruitment-release-moving');
    old.delete(event.instanceId);
  }
  const roster=bindRecruitedTeamActors(nextContext),fresh=new Map(initial(roster,tick).instances.map(s=>[s.id,s]));
  const next=roster.bindings.map(b=>old.get(b.id)??fresh.get(b.id)!);
  if(old.size!==before.instances.length-(event.kind==='released'?1:0)||[...old.keys()].some(id=>!next.some(s=>s.id===id)))fail('recruitment-migration-state');
  return restoreTeamCheckpoint(roster,{...prior,rosterSha256:roster.sha256,team:{...prior.team,instances:next}});
}
/** Each active instance is a complete task force; inactive selected templates need no binding. */
export function bindSpawnTeamActors(context: TeamSpawnContext): TeamRoster {
  const data=teamSpawnContextData(context),program=data.program,cap=program.limits;
  const templates=new Map(program.templates.map(t=>[t.id,t])),actors=new Map(data.actors.map(a=>[a.entityId,a]));
  const definitions=new Map(data.model.entities.map(d=>[d.id,d])),seen=new Set<number>();
  const bindings:TeamActorBinding[]=worldList(data.instances,cap.teams).map(value=>{
    const b=value as typeof data.instances[number],t=templates.get(b.teamId),quantities=new Map<string,number>();
    if(!t||!b.actorIds.length||b.actorIds.length>64||b.actorIds.length>cap.members-seen.size)fail('spawn-binding-team');
    for(const id of b.actorIds){
      const a=actors.get(id),d=definitions.get(id);
      if(seen.has(id)||!a||!d||a.rowId!==d.rowId||a.typeId!==d.typeId||a.houseId!==t.houseId||
        a.playerId!==t.playerId||d.owner!==t.playerId||a.bornAtTick!==b.bornAtTick||!['infantry','unit'].includes(d.kind))fail('spawn-binding-actor');
      seen.add(id);quantities.set(d.typeId,(quantities.get(d.typeId)??0)+1);
    }
    if(quantities.size!==t.members.length||t.members.some(m=>quantities.get(m.typeId)!==m.quantity))fail('spawn-binding-taskforce');
    return {id:b.id,teamId:b.teamId,actorIds:[...b.actorIds].sort((a,b)=>a-b),bornAtTick:b.bornAtTick};
  }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(seen.size!==actors.size||new Set(bindings.map(b=>b.id)).size!==bindings.length)fail('spawn-binding-coverage');
  const value={policy:'webra2-spawn-team-roster-1' as const,contextSha256:context.sha256,
    programSha256:program.sha256,worldModelSha256:data.model.sha256,bindings};
  const roster:TeamRoster=freeze({...value,sha256:worldHash(value)});rosters.set(roster,program);spawnContexts.set(roster,context);return roster;
}
/** Preserve committed progress while appending source instances at this tick.
 * Validates structural/source/current-placement facts, not historical trigger authorization. */
export function migrateSpawnTeamCheckpoint(priorContext:TeamSpawnContext,priorInput:unknown,nextContext:TeamSpawnContext,nextWorldInput:unknown):TeamCheckpoint {
  const priorData=teamSpawnContextData(priorContext),nextData=teamSpawnContextData(nextContext);
  if(priorData.program!==nextData.program||priorData.catalogSha256!==nextData.catalogSha256)fail('spawn-migration-source');
  const same=(a:unknown,b:unknown)=>canonicalText(a)===canonicalText(b);
  const prefix=(a:readonly unknown[],b:readonly unknown[])=>b.length>=a.length&&same(a,b.slice(0,a.length));
  if(nextData.records.length<=priorData.records.length||!prefix(priorData.records,nextData.records)||
    !prefix(priorData.instances,nextData.instances)||!prefix(priorData.actors,nextData.actors)||
    !prefix(priorData.model.entities,nextData.model.entities))fail('spawn-migration-prefix');
  const {entities:_pe,sha256:_ps,initialSharedCells:_pi,...priorModel}=priorData.model;
  const {entities:_ne,sha256:_ns,initialSharedCells:_ni,...nextModel}=nextData.model;
  if(!same(priorModel,nextModel))fail('spawn-migration-model');
  const prior=restoreTeamCheckpoint(bindSpawnTeamActors(priorContext),priorInput);
  if(prior.pending)fail('spawn-migration-pending');
  const tick=prior.world.nextTick,added=nextData.records.slice(priorData.records.length);
  if(added.some(r=>r.bornAtTick!==tick))fail('spawn-migration-birth');
  const world=WorldSimulation.restore(nextData.model,nextWorldInput).save();
  const expected={...prior.world,state:{...prior.world.state,modelSha256:nextData.model.sha256,
    entities:[...prior.world.state.entities,...added.flatMap(r=>r.actors.map(a=>({id:a.entityId,x:a.x,y:a.y,health:a.initialHealth,
      goal:null,route:[],progress:0,waitTicks:0}))) ]}};
  if(!same(world,expected))fail('spawn-migration-world');
  const newIds=new Set(added.flatMap(r=>r.actors.map(a=>a.entityId)));
  for(const c of world.queuedCommands)if(newIds.has((c.payload as {entityId:number}).entityId))fail('spawn-migration-queued-actor');
  const occupied=new Set(priorData.model.blocked),live=new Map<number,boolean>();
  for(let i=0;i<prior.world.state.entities.length;i++){
    const e=prior.world.state.entities[i]!,d=priorData.model.entities[i]!;live.set(e.id,e.health!==0);
    if(e.health!==0&&d.blocksCell){occupied.add(worldAddress(e.x,e.y));if(e.progress>0)occupied.add(e.route[1]!);}
  }
  for(const p of priorData.model.footprints)if(live.get(p.entityId))for(const cell of p.cells)occupied.add(cell);
  for(const r of added)for(const a of r.actors){const at=worldAddress(a.x,a.y);if(occupied.has(at))fail('spawn-migration-occupied');occupied.add(at);}
  const roster=bindSpawnTeamActors(nextContext),oldInstances=new Map(prior.team.instances.map(s=>[s.id,s]));
  const newborn=new Map(initial(roster,tick).instances.map(s=>[s.id,s]));
  return restoreTeamCheckpoint(roster,{...prior,rosterSha256:roster.sha256,world,
    team:{...prior.team,instances:roster.bindings.map(b=>oldInstances.get(b.id)??newborn.get(b.id)!)}});
}

export function bindTeamActors(program: TeamProgram, input: readonly TeamActorBinding[]): TeamRoster {
  const world=teamProgramWorld(program),cap=program.limits,templates=new Map(program.templates.map(t=>[t.id,t]));
  const ids=new Set<string>(),actors=new Set<number>(),used=new Set<string>(),placements=new Map(world.placements.map(p=>[p.entityId,p]));
  let members=0;const bindings:TeamActorBinding[]=[];
  for(const value of worldList(input,cap.teams)){
    const r=worldRecord(value,['id','teamId','actorIds']),id=worldSymbol(r.id),teamId=worldSymbol(r.teamId),template=templates.get(teamId);
    if(ids.has(id)||!template)fail('binding-team');ids.add(id);used.add(teamId);
    const actorIds=worldList(r.actorIds,Math.min(64,cap.members-members)).map(n=>worldInteger(n,1,2147483647)).sort((a,b)=>a-b);
    if(!actorIds.length)fail('binding-members');members+=actorIds.length;const quantities=new Map<string,number>();
    for(const actorId of actorIds){
      const p=placements.get(actorId),d=world.model.entities.find(e=>e.id===actorId);
      if(actors.has(actorId)||!p||!d||p.status!=='mobile'||!['infantry','unit'].includes(d.kind)||p.ownerId!==template.houseId||
        p.playerId!==template.playerId||d.owner!==template.playerId||p.typeId!==d.typeId)fail('binding-actor');
      actors.add(actorId);quantities.set(d.typeId,(quantities.get(d.typeId)??0)+1);
    }
    if(quantities.size!==template.members.length||template.members.some(m=>quantities.get(m.typeId)!==m.quantity))fail('binding-taskforce');
    bindings.push({id,teamId,actorIds});
  }
  if(used.size!==templates.size)fail('unbound-selected-team');bindings.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const data={policy:'webra2-team-roster-1' as const,programSha256:program.sha256,worldModelSha256:world.model.sha256,bindings};
  const roster:TeamRoster=freeze({...data,sha256:worldHash(data)});rosters.set(roster,program);return roster;
}
function initial(roster:TeamRoster,tick:number):TeamState{return{nextTick:tick,startedTick:tick,nextOrderId:0,flashes:[],instances:roster.bindings.map(b=>({
  id:b.id,activeMembers:[...b.actorIds],cursor:-1,lastStep:null,phase:'advance',assignments:[],issuedAt:null,retryAt:null}))};}
export function createTeamCheckpoint(roster:TeamRoster,worldInput?:WorldSave):TeamCheckpoint{
  const model=teamRosterModel(roster),world=worldInput===undefined?WorldSimulation.create(model).save():WorldSimulation.restore(model,worldInput).save();
  return restoreTeamCheckpoint(roster,{schemaVersion:1,policy:'webra2-team-transaction-1',rosterSha256:roster.sha256,world,team:initial(roster,world.nextTick),pending:null});
}
const sleepMembers=(ids:readonly number[],actors:ReadonlyMap<number,WorldEntity>)=>ids.map(entityId=>{const e=actors.get(entityId)!;return{entityId,health:e.health,goal:e.goal,progress:e.progress,routeLength:e.route.length};});
const nullable=(n:unknown,min:number,max:number)=>n===null?null:worldInteger(n,min,max);
function teamState(roster:TeamRoster,input:unknown,world:WorldSave):TeamState{
  const p=teamRosterProgram(roster),r=worldRecord(input,['nextTick','startedTick','nextOrderId','instances','flashes']);
  const nextTick=worldInteger(r.nextTick,0,p.limits.tick),startedTick=worldInteger(r.startedTick,0,nextTick),nextOrderId=worldInteger(r.nextOrderId,0,Number.MAX_SAFE_INTEGER);
  if(nextTick!==world.nextTick)fail('checkpoint-tick');const rows=worldList(r.instances,p.limits.teams);if(rows.length!==roster.bindings.length)fail('checkpoint-bindings');
  const model=teamRosterModel(roster),grids=new Map(model.navigation.map(b=>[b.grid.movementClass,b.grid]));
  const entityTypes=new Map(model.entities.map(e=>[e.id,e]));
  const current=new Map(world.state.entities.map(e=>[e.id,e])),templates=new Map(p.templates.map(t=>[t.id,t]));let count=0;
  const instances:TeamInstanceState[]=rows.map((value,i)=>{
    const b=roster.bindings[i]!,t=templates.get(b.teamId)!,s=worldRecord(value,['id','activeMembers','cursor','lastStep','phase','assignments','issuedAt','retryAt']);
    const bornAtTick=b.bornAtTick===undefined?startedTick:worldInteger(b.bornAtTick,startedTick,nextTick);
    if(s.id!==b.id||!['advance','moving','retry','sleep','finished','lost'].includes(s.phase as string))fail('checkpoint-instance');
    const activeMembers=worldList(s.activeMembers,b.actorIds.length).map(n=>worldInteger(n,1,2147483647));
    if(activeMembers.some((n,j)=>!b.actorIds.includes(n)||(j>0&&n<=activeMembers[j-1]!))||b.actorIds.some(n=>!activeMembers.includes(n)&&current.get(n)!.health!==0))fail('checkpoint-members');
    const flow=teamSleepFlow(t.steps);
    const cursor=worldInteger(s.cursor,-1,t.steps.length),lastStep=nullable(s.lastStep,0,t.steps.length-1),phase=s.phase as TeamPhase;
    const issuedAt=nullable(s.issuedAt,bornAtTick,Math.max(bornAtTick,nextTick-1)),retryAt=nullable(s.retryAt,bornAtTick,p.limits.tick);
    if(lastStep!==null&&!flow.reachableSteps.includes(lastStep))fail('checkpoint-unreachable-step');
    const assigned=worldList(s.assignments,Math.min(b.actorIds.length,p.limits.members-count));count+=assigned.length;
    const seen=new Set<number>(),cells=new Set<number>(),assignments=assigned.map(a=>{const row=worldRecord(a,['entityId','x','y']),entityId=worldInteger(row.entityId,1,2147483647),at=worldAddress(row.x,row.y);
      if(!activeMembers.includes(entityId)||seen.has(entityId)||cells.has(at))fail('checkpoint-assignment');seen.add(entityId);cells.add(at);return{entityId,x:at%512,y:Math.floor(at/512)};});
    if(assignments.some((a,j)=>j>0&&a.entityId<=assignments[j-1]!.entityId))fail('checkpoint-assignment-order');
    if(phase==='moving'){
      if(lastStep!==cursor||t.steps[cursor]?.opcode!==3||issuedAt===null||retryAt!==null||assignments.length!==activeMembers.length)fail('checkpoint-moving');
      const step=t.steps[cursor]!;if(step.opcode!==3)fail('checkpoint-moving');
      for(const a of assignments){const d=entityTypes.get(a.entityId)!;
        if(Math.abs(a.x-step.x)>TEAM_DESTINATION_LIMITS.radius||Math.abs(a.y-step.y)>TEAM_DESTINATION_LIMITS.radius||
          !navigationCell(grids.get(d.navigationClass!)!,{x:a.x,y:a.y}))fail('checkpoint-destination');
        const e=current.get(a.entityId)!,at=worldAddress(a.x,a.y);
        if(e.health!==0&&e.goal!==at&&!(e.goal===null&&e.x===a.x&&e.y===a.y&&e.progress===0&&e.route.length===0))fail('checkpoint-world-goal');}
      if(nextOrderId<assignments.length)fail('checkpoint-order-counter');
    }else if(phase==='sleep'){
      if(lastStep!==cursor||t.steps[cursor]?.opcode!==11||issuedAt===null||retryAt!==null||assignments.length)fail('checkpoint-sleep');
      planTeamSleep({tick:nextTick,enteredAt:issuedAt,members:sleepMembers(activeMembers,current)});
      if(nextOrderId<activeMembers.length)fail('checkpoint-order-counter');
    }else if(assignments.length||issuedAt!==null)fail('checkpoint-idle-assignment');
    if(phase==='retry'){
      if(lastStep!==cursor||t.steps[cursor]?.opcode!==3||retryAt===null||retryAt<nextTick||retryAt>nextTick+15)fail('checkpoint-retry');
    }else if(retryAt!==null)fail('checkpoint-idle-timer');
    if(phase==='advance'){
      if(lastStep===null){if(cursor!==-1||nextTick!==bornAtTick)fail('checkpoint-initial-cursor');}
      else{const step=t.steps[lastStep]!;if(step.opcode===11)fail('checkpoint-sleep-completion');if(step.opcode===6?cursor!==step.target-1:cursor!==lastStep)fail('checkpoint-completed-cursor');}
    }
    if(phase==='finished'&&(!flow.canFinish||cursor!==t.steps.length||lastStep!==t.steps.length-1))fail('checkpoint-finished');
    if(phase==='lost'&&(activeMembers.length||b.actorIds.some(n=>current.get(n)!.health!==0)))fail('checkpoint-lost');
    if(phase!=='lost'&&!activeMembers.length)fail('checkpoint-empty');
    const result={id:b.id,activeMembers,cursor,lastStep,phase,assignments,issuedAt,retryAt};
    if(b.bornAtTick!==undefined&&nextTick===bornAtTick&&canonicalText(result)!==canonicalText({id:b.id,activeMembers:[...b.actorIds],cursor:-1,lastStep:null,phase:'advance',assignments:[],issuedAt:null,retryAt:null}))fail('spawn-checkpoint-initial-state');
    return result;
  });
  const durations=new Map<string,number>(),maxFlash=new Map<number,number>();
  for(const t of p.templates){let duration=-1;for(const s of t.steps)if(s.opcode===50)duration=Math.max(duration,s.duration);durations.set(t.id,duration);}
  const recruitment=recruitmentContexts.get(roster),flashBindings=recruitment?
    teamRecruitmentContextData(recruitment).records.filter(r=>r.kind==='recruited'):roster.bindings;
  for(const binding of flashBindings){const duration=durations.get(binding.teamId)!;
    if(duration>=0)for(const id of binding.actorIds)maxFlash.set(id,Math.max(duration,maxFlash.get(id)??-1));}
  const flashes=snapshotTeamFlashes(r.flashes).map(f=>{const maximum=maxFlash.get(f.entityId);
    if(maximum===undefined||f.remaining>maximum||(f.flashingNow&&maximum<2))fail('checkpoint-flash-source');return{...f};});
  const result={nextTick,startedTick,nextOrderId,instances,flashes};
  if(nextTick===startedTick&&canonicalText(result)!==canonicalText(initial(roster,startedTick)))fail('checkpoint-initial-state');
  if(nextOrderId>(nextTick-startedTick)*p.limits.orders)fail('checkpoint-order-counter');
  return result;
}
/** Full structural restore, not an authentication scheme or proof of every historical world transition. */
export function restoreTeamCheckpoint(roster:TeamRoster,input:unknown):TeamCheckpoint{
  const p=teamRosterProgram(roster),value=typeof input==='string'||input instanceof Uint8Array?parseJson(input):worldClone(input);
  const r=worldRecord(value,['schemaVersion','policy','rosterSha256','world','team','pending']);
  if(r.schemaVersion!==1||r.policy!=='webra2-team-transaction-1'||r.rosterSha256!==roster.sha256)fail('checkpoint-identity');
  const world=WorldSimulation.restore(teamRosterModel(roster),r.world).save(),team=teamState(roster,r.team,world);
  const checkpoint:TeamCheckpoint={schemaVersion:1,policy:'webra2-team-transaction-1',rosterSha256:roster.sha256,world,team,pending:null};
  if(r.pending!==null){const expected=computePlan(roster,checkpoint);if(canonicalText(r.pending)!==canonicalText(expected))fail('pending-plan-mismatch');checkpoint.pending=expected;}
  return freeze(checkpoint);
}
function computePlan(roster:TeamRoster,checkpoint:TeamCheckpoint):TeamPendingTick{
  const p=teamRosterProgram(roster),cap=p.limits,tick=checkpoint.team.nextTick;if(tick>=cap.tick)fail('tick-limit');
  const nextTeam=worldClone(checkpoint.team),world=checkpoint.world,current=new Map(world.state.entities.map(e=>[e.id,e]));
  const templates=new Map(p.templates.map(t=>[t.id,t])),orders:TeamOrder[]=[],events:TeamEvent[]=[];let work=0;
  const charge=(n=1)=>{if(n>cap.work-work)fail('step-work-limit');work+=n;};
  charge(nextTeam.flashes.length);nextTeam.flashes=advanceTeamFlashes(nextTeam.flashes).map(f=>({...f}));
  const event=(s:TeamInstanceState,kind:TeamEvent['kind'])=>{if(events.length>=cap.trace)fail('step-trace-limit');events.push({instanceId:s.id,step:s.lastStep,kind});};
  for(let i=0;i<nextTeam.instances.length;i++){
    charge();const s=nextTeam.instances[i]!,b=roster.bindings[i]!,t:TeamTemplate=templates.get(b.teamId)!;
    if(s.phase==='finished'||s.phase==='lost')continue;
    charge(s.activeMembers.length);s.activeMembers=s.activeMembers.filter(id=>current.get(id)!.health!==0);
    s.assignments=s.assignments.filter(a=>s.activeMembers.includes(a.entityId));
    if(!s.activeMembers.length){s.phase='lost';s.assignments=[];s.issuedAt=null;s.retryAt=null;event(s,'lost');continue;}
    if(s.phase==='sleep'){
      charge(planTeamSleep({tick,enteredAt:s.issuedAt,members:sleepMembers(s.activeMembers,current)}).work);continue;
    }
    if(s.phase==='moving'){
      charge(s.assignments.length);if(s.assignments.every(a=>{const e=current.get(a.entityId)!;return e.x===a.x&&e.y===a.y&&e.progress===0&&e.goal===null&&e.route.length===0;})){
        s.phase='advance';s.assignments=[];s.issuedAt=null;event(s,'arrived');
      }continue;
    }
    if(s.phase==='retry'&&s.retryAt!>tick)continue;
    if(s.phase==='advance'){
      s.cursor++;if(s.cursor>=t.steps.length){s.phase='finished';event(s,'finished');continue;}
      s.lastStep=s.cursor;
    }
    const instruction=t.steps[s.cursor]!;
    if(instruction.opcode===50){
      charge(s.activeMembers.length);nextTeam.flashes=assignTeamFlashes(nextTeam.flashes,s.activeMembers,instruction.duration).map(f=>({...f}));
      s.phase='advance';s.retryAt=null;event(s,'flash');continue;
    }
    if(instruction.opcode===11){
      const sleep=planTeamSleep({tick,enteredAt:null,members:sleepMembers(s.activeMembers,current)},
        {members:Math.min(64,cap.members),orders:Math.min(64,cap.orders-orders.length)});charge(sleep.work);
      if(sleep.stopActorIds.length>Number.MAX_SAFE_INTEGER-nextTeam.nextOrderId)fail('step-order-limit');
      s.phase='sleep';s.issuedAt=tick;s.retryAt=null;s.assignments=[];
      for(const entityId of sleep.stopActorIds)orders.push({orderId:nextTeam.nextOrderId++,instanceId:s.id,entityId,kind:'stop',x:null,y:null});
      event(s,'sleep');continue;
    }
    if(instruction.opcode===6){s.cursor=instruction.target-1;s.phase='advance';s.retryAt=null;event(s,'jump');continue;}
    const plan=planTeamDestinations({model:teamRosterModel(roster),checkpoint:world,actorIds:s.activeMembers,target:{x:instruction.x,y:instruction.y}},
      {candidates:cap.candidateCells,work:Math.min(1_048_576,cap.work-work),expanded:Math.min(262144,cap.work-work)});
    charge(plan.work.visits+plan.work.expanded+plan.work.queries);
    if(plan.status==='budget-exhausted')fail('destination-budget');
    if(plan.status==='blocked'){s.phase='retry';s.retryAt=Math.min(cap.tick,tick+15);event(s,'blocked');continue;}
    if(plan.assignments.length>cap.orders-orders.length||plan.assignments.length>Number.MAX_SAFE_INTEGER-nextTeam.nextOrderId)fail('step-order-limit');
    s.assignments=plan.assignments.map(a=>({...a}));s.phase='moving';s.issuedAt=tick;s.retryAt=null;
    for(const a of s.assignments)orders.push({orderId:nextTeam.nextOrderId++,instanceId:s.id,entityId:a.entityId,kind:'move',x:a.x,y:a.y});
    event(s,'move');
  }
  nextTeam.nextTick++;const data={policy:'webra2-team-transaction-1' as const,rosterSha256:roster.sha256,baseWorldSha256:worldHash(world),
    baseTeamSha256:worldHash(checkpoint.team),tick,orders,events,nextTeam,work};
  return freeze({...data,sha256:worldHash({...data,destinationPolicy:TEAM_DESTINATION_POLICY,sleepPolicy:TEAM_SLEEP_POLICY})});
}
/** A prepared outbox changes neither current world nor committed team state. */
export function prepareTeamTick(roster:TeamRoster,input:unknown):TeamCheckpoint{
  const checkpoint=restoreTeamCheckpoint(roster,input);if(checkpoint.pending)return checkpoint;
  return freeze({...checkpoint,pending:computePlan(roster,checkpoint)});
}
