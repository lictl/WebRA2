// SPDX-License-Identifier: GPL-3.0-or-later
// Original pure team state and source/actor binding. The transaction bridge owns cloned-world execution.
import { canonicalText, parseJson } from './canonical.ts';
import { WorldSimulation, type WorldSave } from './world.ts';
import { worldAddress, worldClone, worldHash, worldInteger, worldList, worldRecord, worldSymbol } from './world-values.ts';
import { navigationCell } from './navigation.ts';
import { planTeamDestinations, TEAM_DESTINATION_LIMITS, TEAM_DESTINATION_POLICY, type TeamDestinationAssignment } from './team-runtime-destinations.ts';
import { teamProgramWorld, teamRuntimeFail as fail, teamRuntimeFreeze as freeze, type TeamProgram, type TeamTemplate } from './team-runtime-program.ts';

export interface TeamActorBinding { readonly id: string; readonly teamId: string; readonly actorIds: readonly number[] }
export interface TeamRoster { readonly policy: 'webra2-team-roster-1'; readonly programSha256: string; readonly worldModelSha256: string;
  readonly bindings: readonly TeamActorBinding[]; readonly sha256: string }
export type TeamPhase = 'advance' | 'moving' | 'retry' | 'finished' | 'lost';
export interface TeamInstanceState {
  id: string; activeMembers: number[]; cursor: number; lastStep: number | null; phase: TeamPhase;
  assignments: TeamDestinationAssignment[]; issuedAt: number | null; retryAt: number | null;
}
export interface TeamState { nextTick: number; startedTick: number; nextOrderId: number; instances: TeamInstanceState[] }
export interface TeamOrder { orderId: number; instanceId: string; entityId: number; kind: 'move' | 'stop'; x: number | null; y: number | null }
export interface TeamEvent { instanceId: string; step: number | null; kind: 'move' | 'arrived' | 'jump' | 'blocked' | 'lost' | 'finished' }
export interface TeamPendingTick {
  policy: 'webra2-team-transaction-1'; rosterSha256: string; baseWorldSha256: string; baseTeamSha256: string; tick: number;
  orders: TeamOrder[]; events: TeamEvent[]; nextTeam: TeamState; work: number; sha256: string;
}
export interface TeamCheckpoint {
  schemaVersion: 1; policy: 'webra2-team-transaction-1'; rosterSha256: string;
  world: WorldSave; team: TeamState; pending: TeamPendingTick | null;
}
const rosters = new WeakMap<object, TeamProgram>();
export const isTeamRoster = (v: unknown): v is TeamRoster => !!v && typeof v === 'object' && rosters.has(v);
export function teamRosterProgram(roster: TeamRoster): TeamProgram { const p=rosters.get(roster);if(!p)fail('roster-brand');return p; }

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
function initial(roster:TeamRoster,tick:number):TeamState{return{nextTick:tick,startedTick:tick,nextOrderId:0,instances:roster.bindings.map(b=>({
  id:b.id,activeMembers:[...b.actorIds],cursor:-1,lastStep:null,phase:'advance',assignments:[],issuedAt:null,retryAt:null}))};}
export function createTeamCheckpoint(roster:TeamRoster,worldInput?:WorldSave):TeamCheckpoint{
  const p=teamRosterProgram(roster),model=teamProgramWorld(p).model,world=worldInput===undefined?WorldSimulation.create(model).save():WorldSimulation.restore(model,worldInput).save();
  return restoreTeamCheckpoint(roster,{schemaVersion:1,policy:'webra2-team-transaction-1',rosterSha256:roster.sha256,world,team:initial(roster,world.nextTick),pending:null});
}
const nullable=(n:unknown,min:number,max:number)=>n===null?null:worldInteger(n,min,max);
function teamState(roster:TeamRoster,input:unknown,world:WorldSave):TeamState{
  const p=teamRosterProgram(roster),r=worldRecord(input,['nextTick','startedTick','nextOrderId','instances']);
  const nextTick=worldInteger(r.nextTick,0,p.limits.tick),startedTick=worldInteger(r.startedTick,0,nextTick),nextOrderId=worldInteger(r.nextOrderId,0,Number.MAX_SAFE_INTEGER);
  if(nextTick!==world.nextTick)fail('checkpoint-tick');const rows=worldList(r.instances,p.limits.teams);if(rows.length!==roster.bindings.length)fail('checkpoint-bindings');
  const model=teamProgramWorld(p).model,grids=new Map(model.navigation.map(b=>[b.grid.movementClass,b.grid]));
  const entityTypes=new Map(model.entities.map(e=>[e.id,e]));
  const current=new Map(world.state.entities.map(e=>[e.id,e])),templates=new Map(p.templates.map(t=>[t.id,t]));let count=0;
  const instances:TeamInstanceState[]=rows.map((value,i)=>{
    const b=roster.bindings[i]!,t=templates.get(b.teamId)!,s=worldRecord(value,['id','activeMembers','cursor','lastStep','phase','assignments','issuedAt','retryAt']);
    if(s.id!==b.id||!['advance','moving','retry','finished','lost'].includes(s.phase as string))fail('checkpoint-instance');
    const activeMembers=worldList(s.activeMembers,b.actorIds.length).map(n=>worldInteger(n,1,2147483647));
    if(activeMembers.some((n,j)=>!b.actorIds.includes(n)||(j>0&&n<=activeMembers[j-1]!))||b.actorIds.some(n=>!activeMembers.includes(n)&&current.get(n)!.health!==0))fail('checkpoint-members');
    const cursor=worldInteger(s.cursor,-1,t.steps.length),lastStep=nullable(s.lastStep,0,t.steps.length-1),phase=s.phase as TeamPhase;
    const issuedAt=nullable(s.issuedAt,startedTick,Math.max(startedTick,nextTick-1)),retryAt=nullable(s.retryAt,startedTick,p.limits.tick);
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
    }else if(assignments.length||issuedAt!==null)fail('checkpoint-idle-assignment');
    if(phase==='retry'){
      if(lastStep!==cursor||t.steps[cursor]?.opcode!==3||retryAt===null||retryAt<nextTick||retryAt>nextTick+15)fail('checkpoint-retry');
    }else if(retryAt!==null)fail('checkpoint-idle-timer');
    if(phase==='advance'){
      if(lastStep===null){if(cursor!==-1||nextTick!==startedTick)fail('checkpoint-initial-cursor');}
      else{const step=t.steps[lastStep]!;if(step.opcode===3?cursor!==lastStep:cursor!==step.target-1)fail('checkpoint-completed-cursor');}
    }
    if(phase==='finished'&&(cursor!==t.steps.length||lastStep!==t.steps.length-1))fail('checkpoint-finished');
    if(phase==='lost'&&(activeMembers.length||b.actorIds.some(n=>current.get(n)!.health!==0)))fail('checkpoint-lost');
    if(phase!=='lost'&&!activeMembers.length)fail('checkpoint-empty');
    return{id:b.id,activeMembers,cursor,lastStep,phase,assignments,issuedAt,retryAt};
  });
  const result={nextTick,startedTick,nextOrderId,instances};
  if(nextTick===startedTick&&canonicalText(result)!==canonicalText(initial(roster,startedTick)))fail('checkpoint-initial-state');
  if(nextOrderId>(nextTick-startedTick)*p.limits.orders)fail('checkpoint-order-counter');
  return result;
}
/** Full structural restore, not an authentication scheme or proof of every historical world transition. */
export function restoreTeamCheckpoint(roster:TeamRoster,input:unknown):TeamCheckpoint{
  const p=teamRosterProgram(roster),value=typeof input==='string'||input instanceof Uint8Array?parseJson(input):worldClone(input);
  const r=worldRecord(value,['schemaVersion','policy','rosterSha256','world','team','pending']);
  if(r.schemaVersion!==1||r.policy!=='webra2-team-transaction-1'||r.rosterSha256!==roster.sha256)fail('checkpoint-identity');
  const world=WorldSimulation.restore(teamProgramWorld(p).model,r.world).save(),team=teamState(roster,r.team,world);
  const checkpoint:TeamCheckpoint={schemaVersion:1,policy:'webra2-team-transaction-1',rosterSha256:roster.sha256,world,team,pending:null};
  if(r.pending!==null){const expected=computePlan(roster,checkpoint);if(canonicalText(r.pending)!==canonicalText(expected))fail('pending-plan-mismatch');checkpoint.pending=expected;}
  return freeze(checkpoint);
}
function computePlan(roster:TeamRoster,checkpoint:TeamCheckpoint):TeamPendingTick{
  const p=teamRosterProgram(roster),cap=p.limits,tick=checkpoint.team.nextTick;if(tick>=cap.tick)fail('tick-limit');
  const nextTeam=worldClone(checkpoint.team),world=checkpoint.world,current=new Map(world.state.entities.map(e=>[e.id,e]));
  const templates=new Map(p.templates.map(t=>[t.id,t])),orders:TeamOrder[]=[],events:TeamEvent[]=[];let work=0;
  const charge=(n=1)=>{if(n>cap.work-work)fail('step-work-limit');work+=n;};
  const event=(s:TeamInstanceState,kind:TeamEvent['kind'])=>{if(events.length>=cap.trace)fail('step-trace-limit');events.push({instanceId:s.id,step:s.lastStep,kind});};
  for(let i=0;i<nextTeam.instances.length;i++){
    charge();const s=nextTeam.instances[i]!,b=roster.bindings[i]!,t:TeamTemplate=templates.get(b.teamId)!;
    if(s.phase==='finished'||s.phase==='lost')continue;
    charge(s.activeMembers.length);s.activeMembers=s.activeMembers.filter(id=>current.get(id)!.health!==0);
    s.assignments=s.assignments.filter(a=>s.activeMembers.includes(a.entityId));
    if(!s.activeMembers.length){s.phase='lost';s.assignments=[];s.issuedAt=null;s.retryAt=null;event(s,'lost');continue;}
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
    if(instruction.opcode===6){s.cursor=instruction.target-1;s.phase='advance';s.retryAt=null;event(s,'jump');continue;}
    const plan=planTeamDestinations({model:teamProgramWorld(p).model,checkpoint:world,actorIds:s.activeMembers,target:{x:instruction.x,y:instruction.y}},
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
  return freeze({...data,sha256:worldHash({...data,destinationPolicy:TEAM_DESTINATION_POLICY})});
}
/** A prepared outbox changes neither current world nor committed team state. */
export function prepareTeamTick(roster:TeamRoster,input:unknown):TeamCheckpoint{
  const checkpoint=restoreTeamCheckpoint(roster,input);if(checkpoint.pending)return checkpoint;
  return freeze({...checkpoint,pending:computePlan(roster,checkpoint)});
}
