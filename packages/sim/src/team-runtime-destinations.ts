// SPDX-License-Identifier: GPL-3.0-or-later
// Original WebRA2 group-cell policy shared by explicit team scripts and player-order adapters.
import { findNavigationPath, navigationCell, NAVIGATION_LIMITS } from './navigation.ts';
import { combatDyingActorIds } from './combat.ts';
import { createInfantryOccupancy, type InfantryOccupancy } from './infantry-passage-occupancy.ts';
import { WorldSimulation, type WorldSave } from './world.ts';
import { restoreWorldOwnership, worldOwnershipWork, type WorldOwnershipState } from './world-ownership.ts';
import { assertWorldModel, type WorldModel } from './world-model.ts';
import { worldAddress, worldHash, worldInteger, worldList, worldPosition, worldRecord } from './world-values.ts';

export const TEAM_DESTINATION_POLICY = 'webra2-nearest-distinct-cells-1' as const;
export const TEAM_DESTINATION_LIMITS = Object.freeze({ actors: 64, radius: 16, candidates: 1089,
  queries: 256, expanded: 262144, work: 1_048_576 });
type Limits = { -readonly [K in keyof typeof TEAM_DESTINATION_LIMITS]: number };
export interface TeamDestinationAssignment { readonly entityId: number; readonly x: number; readonly y: number }
export interface TeamDestinationPlan {
  readonly policy: typeof TEAM_DESTINATION_POLICY; readonly modelSha256: string; readonly checkpointSha256: string;
  readonly status: 'ready' | 'blocked' | 'budget-exhausted'; readonly reason: string | null;
  readonly assignments: readonly TeamDestinationAssignment[];
  readonly work: Readonly<{ visits: number; queries: number; expanded: number }>;
}
function fail(code: string): never { throw new Error(`team-destination-${code}`); }
function limits(input: Partial<Limits>): Limits {
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('limits');
  const cap: Limits = { ...TEAM_DESTINATION_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key)!; if (!('value' in d) || !d.enumerable) fail('limits');
    cap[key as keyof Limits] = worldInteger(d.value, 0, cap[key as keyof Limits]);
  }
  return cap;
}
/** Greedy stable assignment, not a formation optimizer or a native movement/arrival claim. */
export function planTeamDestinations(input: { readonly model: WorldModel; readonly checkpoint: WorldSave;
  readonly actorIds: readonly number[]; readonly target: Readonly<{ x: number; y: number }> }, lowerLimits: Partial<Limits> = {}, aggregateWorkLimit?: number): TeamDestinationPlan {
  const r = worldRecord(input, ['model', 'checkpoint', 'actorIds', 'target']), cap = limits(lowerLimits), model = r.model as WorldModel;
  assertWorldModel(model);
  const aggregate = aggregateWorkLimit === undefined ? Number.MAX_SAFE_INTEGER : worldInteger(aggregateWorkLimit, 0, Number.MAX_SAFE_INTEGER);
  const remaining = () => aggregate - work.visits - work.queries - work.expanded;
  const ids = worldList(r.actorIds, cap.actors).map(id => worldInteger(id, 1, 2147483647)).sort((a,b)=>a-b);
  if (!ids.length || new Set(ids).size !== ids.length) fail('actor-ids');
  const target = worldRecord(r.target, ['x', 'y']), at = worldAddress(target.x, target.y), center = worldPosition(at);
  // Restore checks full state shape, health, in-flight edge reservations, occupancy and model/content identity.
  const checkpoint = WorldSimulation.restore(model, r.checkpoint).save();
  const byId = new Map(checkpoint.state.entities.map((e,i)=>[e.id,{e,d:model.entities[i]!}]));
  const selected = ids.map(id=>{const row=byId.get(id);if(!row || row.e.health===null || row.e.health===0 || row.d.movementPerTick<=0 || row.d.navigationClass===null)fail('inactive-actor');return row;});
  const work = {visits:0,queries:0,expanded:0}, result = (status:TeamDestinationPlan['status'],reason:string|null,assignments:TeamDestinationAssignment[]=[]):TeamDestinationPlan=>Object.freeze({
    policy:TEAM_DESTINATION_POLICY,modelSha256:model.sha256,checkpointSha256:worldHash(checkpoint),status,reason,
    assignments:Object.freeze(assignments.map(a=>Object.freeze(a))),work:Object.freeze({...work})});
  const charge=(n=1)=>{if(n>cap.work-work.visits||n>remaining())return false;work.visits+=n;return true;};
  const dying=combatDyingActorIds(checkpoint.state.combat);
  if(!charge(checkpoint.state.combat?.deaths?.length??0))return result('budget-exhausted','occupancy-work');
  const slots = new Set(checkpoint.state.infantrySlots?.map(s => s.entityId) ?? []);
  let passage: InfantryOccupancy | null = null, passageExhausted = false;
  if (model.infantryPassage && selected.some(row => slots.has(row.e.id))) {
    if (!charge(checkpoint.state.entities.length * 4 + checkpoint.state.entities.reduce((n, e) => n + e.route.length, 0) +
      model.blocked.length + model.footprints.reduce((n, p) => n + p.cells.length, 0) + slots.size * 2)) return result('budget-exhausted', 'occupancy-work');
    let owned:WorldOwnershipState|undefined;
    if(model.ownership)try{owned=restoreWorldOwnership(model,checkpoint.state.ownership,checkpoint.state.entities,checkpoint.nextTick,Math.min(cap.work-work.visits,remaining()));}
    catch(error){if(error instanceof Error&&error.message==='world-ownership-work')return result('budget-exhausted','occupancy-work');throw error;}
    if(owned&&!charge(worldOwnershipWork(owned)))return result('budget-exhausted','occupancy-work');
    passage = createInfantryOccupancy(model.infantryPassage, { entities: checkpoint.state.entities, infantrySlots: checkpoint.state.infantrySlots!,
      retiredEntityIds: checkpoint.state.entities.filter(e => e.health === 0 && !dying.has(e.id)).map(e => e.id) },owned);
  }
  const passageBlocked = (id: number, at: number) => {
    const choice = passage!.choose(id, at);
    if (!charge(1 + choice.work)) { passageExhausted = true; return true; }
    return choice.status === 'blocked';
  };
  const counts = new Map<number,number>(), staticCells = new Set(model.blocked), add=(n:number)=>counts.set(n,(counts.get(n)??0)+1);
  for(const n of model.blocked){if(!charge())return result('budget-exhausted','occupancy-work');add(n);}
  for(const {e,d} of byId.values()){
    if(!charge())return result('budget-exhausted','occupancy-work');
    if((e.health!==0||dying.has(e.id)) && d.blocksCell){add(worldAddress(e.x,e.y));if(e.progress>0)add(e.route[1]!);}
  }
  for(const p of model.footprints){if(!charge())return result('budget-exhausted','occupancy-work');if(byId.get(p.entityId)!.e.health===0)continue;
    for(const n of p.cells){if(!charge())return result('budget-exhausted','occupancy-work');staticCells.add(n);add(n);}}
  const candidates:{x:number;y:number;at:number;distance:number}[]=[];
  for(let y=Math.max(0,center.y-cap.radius);y<=Math.min(511,center.y+cap.radius);y++)for(let x=Math.max(0,center.x-cap.radius);x<=Math.min(511,center.x+cap.radius);x++){
    if(!charge() || candidates.length>=cap.candidates)return result('budget-exhausted','candidate-limit');
    candidates.push({x,y,at:worldAddress(x,y),distance:(x-center.x)**2+(y-center.y)**2});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
  const grids = new Map(model.navigation.map(b=>[b.grid.movementClass,b.grid])), assignments:TeamDestinationAssignment[]=[], reserved=new Set<number>(), corridors=new Set<number>();
  for(const {e,d} of selected){
    const grid=grids.get(d.navigationClass!)!, current=worldAddress(e.x,e.y), start=e.progress>0?e.route[1]!:current;
    let found=false;
    for(const c of candidates){
      if(!charge())return result('budget-exhausted','candidate-work');
      const ownCount=d.blocksCell && (c.at===current || (e.progress>0 && c.at===start))?1:0;
      const occupiedTarget = (counts.get(c.at)??0)>ownCount && (!passage || !slots.has(e.id) || passageBlocked(e.id, c.at));
      if (passageExhausted) return result('budget-exhausted', 'occupancy-work');
      // Destinations remain distinct within this group; eligible existing allies may share slots.
      if(corridors.has(c.at) || reserved.has(c.at) || occupiedTarget || (c.at===current && e.progress>0) || !navigationCell(grid,{x:c.x,y:c.y}))continue;
      if(work.queries>=cap.queries || work.expanded>=cap.expanded)return result('budget-exhausted','reachability-limit');
      if(!charge(counts.size+reserved.size+1))return result('budget-exhausted','occupancy-work');
      // Other selected actors remain obstacles. Only this actor's occupied cells are removed;
      // a shared current start may be exited, as allowed by the world model.
      const occupied=new Set<number>(reserved);
      for(const [n,count] of counts){let own=0;if(d.blocksCell && (n===current || (e.progress>0&&n===start)))own=1;
        if(count>own && (!passage || !slots.has(e.id) || passageBlocked(e.id, n)))occupied.add(n);
        if (passageExhausted) return result('budget-exhausted', 'occupancy-work');}
      if(!staticCells.has(start))occupied.delete(start);
      if(remaining()<1)return result('budget-exhausted','reachability-limit');
      const route=findNavigationPath(grid,{start:worldPosition(start),goal:{x:c.x,y:c.y},occupied:[...occupied].map(worldPosition)},
        {expanded:Math.min(NAVIGATION_LIMITS.expanded,cap.expanded-work.expanded,remaining()-1),pathCells:NAVIGATION_LIMITS.pathCells});
      work.queries++;work.expanded+=route.expanded;
      if(route.status==='budget-exhausted'||route.status==='path-limit')return result('budget-exhausted','reachability-limit');
      if(route.status!=='found')continue;
      // A later actor must not stop in an earlier route or in a required diagonal corner.
      // Paths may still cross transiently; the core owns contention/replanning.
      if(!charge(route.path.length*3))return result('budget-exhausted','route-work');
      for(let i=0;i<route.path.length;i++){
        const p=route.path[i]!;corridors.add(worldAddress(p.x,p.y));
        const prev=route.path[i-1];if(prev&&p.x!==prev.x&&p.y!==prev.y){corridors.add(worldAddress(p.x,prev.y));corridors.add(worldAddress(prev.x,p.y));}
      }
      assignments.push({entityId:e.id,x:c.x,y:c.y});reserved.add(c.at);found=true;break;
    }
    if(!found)return result('blocked','no-distinct-reachable-slot');
  }
  return result('ready',null,assignments);
}
