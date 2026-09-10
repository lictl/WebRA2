// SPDX-License-Identifier: MIT
import { combatInfantryPrograms, combatDeathBinding, combatOrdinaryBinding, combatDamage, COMBAT_LIMITS as C, type CombatActor, type CombatWeapon } from './combat-model.ts';
import { worldAddress, worldFail, worldInteger, worldList, worldPosition, worldRecord, WORLD_LIMITS as W } from './world-values.ts';
import { canonicalText } from './canonical.ts';
import { createNativeRandom, restoreNativeRandom, nextNativeReloadJitter, nextNativeRandomWord, NATIVE_RELOAD_MAX_DRAWS, type NativeRandomState } from './native-random.ts';
import { ordinaryCombatDamage, ordinaryCombatReload, ordinaryCombatMaximumReload } from './ordinary-combat-rules.ts';
import { createInfantryFiringState, restoreInfantryFiring, saveInfantryFiring, transitionInfantryFiring, inspectDueInfantryShot, type InfantryFiringSave, type InfantryFiringState } from './infantry-firing.ts';
import { ordinaryDeathActor, ordinaryDeathWeapon, ordinaryDeathDuration } from './ordinary-death-rules.ts';
import type { WorldModel } from './world-model.ts';
import type { WorldEntity } from './world.ts';

export type CombatOrderState = { entityId: number; targetId: number | null; weaponId: string | null;
  readyTick: number; burstRemaining: number; burstTick: number; ammo: number };
export type CombatImpact = { id: number; sourceId: number; targetId: number; weaponId: string;
  launchTick: number; dueTick: number; from: number; aim: number };
export type OrdinaryDeathRecord = { entityId:number; sourceId:number; weaponId:string; victimOwner:number; sourceOwner:number;
  sequence:11|12; startedTick:number; completionTick:number; corpseIndex:number|null };
type SavedValue<T> = T extends readonly (infer E)[] ? SavedValue<E>[] : T extends object ? { [K in keyof T]: SavedValue<T[K]> } : T;
export type CombatState = { infantryFiring?:SavedValue<InfantryFiringSave>[]; deaths?:OrdinaryDeathRecord[]; actors: CombatOrderState[]; impacts: CombatImpact[]; nextImpactId: number; ordinaryRandom?: {state:{[K in keyof NativeRandomState]:NativeRandomState[K]};draws:number} };
type Emit = (kind: string, entityId: number, cell?: number | null, value?: number | null) => void;
const alive = (e: WorldEntity | undefined): e is WorldEntity => !!e && e.health !== null && e.health > 0;
function clearBurst(a: CombatOrderState): void { a.weaponId = null; a.burstRemaining = 0; a.burstTick = 0; }
function clearOrder(a: CombatOrderState): void { a.targetId = null; clearBurst(a); }
function cancelFiring(model:WorldModel,state:CombatState,entityId:number):void {
  const programs=combatInfantryPrograms(model.combat!);if(!programs)return;
  const i=programs.findIndex(p=>p.actorId===entityId);if(i<0)return;
  const program=programs[i]!,prior=restoreInfantryFiring(program,state.infantryFiring![i]);
  state.infantryFiring![i]=saveInfantryFiring(program,transitionInfantryFiring(program,prior,{kind:'cancel'}).state);
}
export function stopCombat(model:WorldModel,state: CombatState, entityId: number): void {
  cancelFiring(model,state,entityId);
  const a = state.actors.find(a => a.entityId === entityId); if (a) clearOrder(a);
}
export function createCombatState(model: WorldModel): CombatState {
  const ordinary=combatOrdinaryBinding(model.combat!);
  const firing=combatInfantryPrograms(model.combat!);
  return { ...(firing?{infantryFiring:firing.map(p=>saveInfantryFiring(p,createInfantryFiringState(p)))}:{}), ...(combatDeathBinding(model.combat!)?{deaths:[]}:{}), ...(ordinary?{ordinaryRandom:{state:createNativeRandom(ordinary.seed),draws:0}}:{}), actors: model.combat!.actors.map(a => ({ entityId: a.entityId, targetId: null, weaponId: null,
    readyTick: 0, burstRemaining: 0, burstTick: 0, ammo: a.initialAmmo })), impacts: [], nextImpactId: 1 };
}
function distanceSquared(from: number, to: number): number {
  const a = worldPosition(from), b = worldPosition(to); return ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) * 65536;
}
function inRange(w: CombatWeapon, from: number, to: number): boolean {
  const distance = distanceSquared(from, to); return distance >= w.minimumRange ** 2 && distance <= w.range ** 2;
}
function flightTicks(w: CombatWeapon, from: number, to: number): number {
  const square = distanceSquared(from, to); let lo = 0, hi = 185364;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (mid * mid >= square) hi = mid; else lo = mid + 1; }
  const ticks = Math.max(1, Math.ceil(lo / w.speed)); if (ticks > C.delay) worldFail('combat-flight-limit'); return ticks;
}
function targetLegal(model: WorldModel, source: number, target: number): boolean {
  if (source === target) return false;
  const from = model.entities.find(e => e.id === source), to = model.entities.find(e => e.id === target);
  if (!from || !to || from.owner === null || from.owner === to.owner) return false;
  return !model.combat!.allies.some(a => a.playerId === from.owner && a.allyId === to.owner);
}
function damageFor(model:WorldModel,source:number,w:CombatWeapon,target:CombatActor):number {
  const ordinary=combatOrdinaryBinding(model.combat!);
  return ordinary?ordinaryCombatDamage(ordinary,source,w.id,target.entityId):combatDamage(w,target.armor);
}
function weaponLegal(w: CombatWeapon, target: CombatActor, model:WorldModel,source:number): boolean {
  const death=combatDeathBinding(model.combat!);
  return (!death||!!ordinaryDeathActor(death,target.entityId)) && (target.layer === 'air' ? w.air : w.ground) && damageFor(model,source,w,target) > 0;
}

export function validateCombatState(model: WorldModel, input: unknown, entities: WorldEntity[], nextTick: number): CombatState {
  const config = model.combat!,ordinary=combatOrdinaryBinding(config),death=combatDeathBinding(config),firing=combatInfantryPrograms(config);
  const r = worldRecord(input, ['actors', 'impacts', 'nextImpactId',...(ordinary?['ordinaryRandom']:[]),...(death?['deaths']:[]),...(firing?['infantryFiring']:[])]);
  const byId = new Map(entities.map(e => [e.id, e])), actorsById = new Map(config.actors.map(a => [a.entityId, a]));
  const weapons = new Map(config.weapons.map(w => [w.id, w]));
  const rows = worldList(r.actors, C.actors); if (rows.length !== config.actors.length) worldFail('combat-save-actors');
  const actors = rows.map((value, i) => {
    const a = worldRecord(value, ['entityId', 'targetId', 'weaponId', 'readyTick', 'burstRemaining', 'burstTick', 'ammo']), d = config.actors[i]!;
    if (a.entityId !== d.entityId) worldFail('combat-save-actor-id');
    const targetId = a.targetId === null ? null : worldInteger(a.targetId, 1, 2147483647);
    const latestReadyTick = nextTick === 0 || !d.weapons.length ? 0 : nextTick - 1 + (ordinary?ordinaryCombatMaximumReload(ordinary,d.entityId):Math.max(...d.weapons.map(id => weapons.get(id)!.reloadTicks)));
    const readyTick = worldInteger(a.readyTick, 0, latestReadyTick), burstRemaining = worldInteger(a.burstRemaining, 0, C.burst - 1);
    const burstTick = worldInteger(a.burstTick, 0, W.tick + C.delay), ammo = worldInteger(a.ammo, -1, C.ammo);
    if (d.initialAmmo === -1 ? ammo !== -1 : ammo < 0 || ammo > d.initialAmmo) worldFail('combat-save-ammo');
    if (targetId !== null && (!actorsById.has(targetId) || !alive(byId.get(targetId)) || !alive(byId.get(d.entityId)) || !d.weapons.length || !targetLegal(model, d.entityId, targetId))) worldFail('combat-save-target');
    if (targetId !== null && byId.get(d.entityId)!.goal !== null) worldFail('combat-save-moving-target');
    if (!d.weapons.length && readyTick !== 0) worldFail('combat-save-unarmed-cooldown');
    if (burstRemaining) {
      const w = typeof a.weaponId === 'string' ? weapons.get(a.weaponId) : undefined;
      if (targetId === null || !w || !d.weapons.includes(w.id) || burstRemaining >= w.burst ||
        !weaponLegal(w, actorsById.get(targetId)!,model,d.entityId) || burstTick < nextTick || burstTick > nextTick + C.delay || !ammo) worldFail('combat-save-burst');
      const lastShotTick = burstTick - w.burstDelayTicks;
      if (lastShotTick < 0 || lastShotTick >= nextTick || readyTick !== lastShotTick + w.reloadTicks) worldFail('combat-save-burst-clock');
    } else if (a.weaponId !== null || burstTick !== 0) worldFail('combat-save-idle-burst');
    return { entityId: d.entityId, targetId, weaponId: a.weaponId as string | null, readyTick, burstRemaining, burstTick, ammo };
  });
  const nextImpactId = worldInteger(r.nextImpactId, 1, Number.MAX_SAFE_INTEGER), impacts: CombatImpact[] = []; let priorTick = -1, priorId = -1;
  const ids = new Set<number>();
  for (const value of worldList(r.impacts, C.impacts)) {
    const p = worldRecord(value, ['id', 'sourceId', 'targetId', 'weaponId', 'launchTick', 'dueTick', 'from', 'aim']);
    const id = worldInteger(p.id, 1, nextImpactId - 1), sourceId = worldInteger(p.sourceId, 1, 2147483647), targetId = worldInteger(p.targetId, 1, 2147483647);
    const launchTick = worldInteger(p.launchTick, 0, nextTick - 1), dueTick = worldInteger(p.dueTick, nextTick, W.tick - 1);
    const from = worldInteger(p.from, 0, 512 * 512 - 1), aim = worldInteger(p.aim, 0, 512 * 512 - 1);
    const w = typeof p.weaponId === 'string' ? weapons.get(p.weaponId) : undefined, source = actorsById.get(sourceId), target = actorsById.get(targetId);
    if (!w || w.delivery === 'instant' || !source?.weapons.includes(w.id) || !target || !targetLegal(model, sourceId, targetId) || !weaponLegal(w, target,model,sourceId) || !inRange(w, from, aim) || dueTick !== launchTick + flightTicks(w, from, aim)) worldFail('combat-save-impact');
    if (ids.has(id) || dueTick < priorTick || dueTick === priorTick && id <= priorId) worldFail('combat-save-impact-order');
    ids.add(id); priorTick = dueTick; priorId = id; impacts.push({ id, sourceId, targetId, weaponId: w.id, launchTick, dueTick, from, aim });
  }
  let infantryFiring:CombatState['infantryFiring'];
  if(firing){
    const rows=worldList(r.infantryFiring,firing.length);if(rows.length!==firing.length)worldFail('infantry-save-coverage');
    infantryFiring=rows.map((value,i)=>{
      const p=firing[i]!,s=restoreInfantryFiring(p,value),a=actors.find(a=>a.entityId===p.actorId)!,entity=byId.get(p.actorId)!;
      if(s.tick!==nextTick||s.rearm!==null&&s.rearm.shotTick>=nextTick||s.rearm!==null&&a.readyTick!==s.rearm.shotTick+s.rearm.nativeRof||s.rearm===null&&a.readyTick!==0)worldFail('infantry-save-clock');
      if(s.pending&&(s.pending.dueTick<nextTick||s.pending.startedTick>=nextTick||s.pending.targetId!==a.targetId||s.pending.weaponId!==actorsById.get(p.actorId)!.weapons[0]||!alive(entity)||entity.goal!==null||a.ammo===0||!weaponLegal(weapons.get(s.pending.weaponId)!,actorsById.get(s.pending.targetId)!,model,p.actorId)||!inRange(weapons.get(s.pending.weaponId)!,worldAddress(entity.x,entity.y),worldAddress(byId.get(s.pending.targetId)!.x,byId.get(s.pending.targetId)!.y))))worldFail('infantry-save-pending');
      if(a.burstRemaining||a.weaponId!==null||a.burstTick!==0)worldFail('infantry-save-burst');
      const d=actorsById.get(p.actorId)!;
      if(d.initialAmmo>=0&&a.ammo!==d.initialAmmo-s.shots)worldFail('infantry-save-ammo');
      if(s.rearm!==null&&![0,1,2].some(j=>ordinaryCombatReload(ordinary!,p.actorId,d.weapons[0]!,j as 0|1|2)===s.rearm!.nativeRof))worldFail('infantry-save-reload');
      return saveInfantryFiring(p,s);
    });
  }
  let deaths:OrdinaryDeathRecord[]|undefined;
  if(death){
    let prior=0;const definitions=new Map(model.entities.map(d=>[d.id,d]));
    deaths=worldList(r.deaths,death.rules.actors.length).map(value=>{
      const d=worldRecord(value,['entityId','sourceId','weaponId','victimOwner','sourceOwner','sequence','startedTick','completionTick','corpseIndex']);
      const entityId=worldInteger(d.entityId,1,2147483647),sourceId=worldInteger(d.sourceId,1,2147483647);
      const victim=ordinaryDeathActor(death,entityId),weapon=typeof d.weaponId==='string'?ordinaryDeathWeapon(death,d.weaponId):undefined;
      if(entityId<=prior||!victim||!weapon||!actorsById.get(sourceId)?.weapons.includes(weapon.weaponId)||!targetLegal(model,sourceId,entityId)||byId.get(entityId)!.health!==0||!weaponLegal(weapons.get(weapon.weaponId)!,actorsById.get(entityId)!,model,sourceId))worldFail('death-save-identity');prior=entityId;
      const sourceOwner=worldInteger(d.sourceOwner,0,W.players-1),victimOwner=worldInteger(d.victimOwner,0,W.players-1);
      if(sourceOwner!==definitions.get(sourceId)!.owner||victimOwner!==definitions.get(entityId)!.owner)worldFail('death-save-owner');
      const sequence=worldInteger(d.sequence,11,12) as 11|12,startedTick=worldInteger(d.startedTick,0,nextTick-1);
      const completionTick=worldInteger(d.completionTick,1,W.tick-1);
      if(sequence!==weapon.infDeath+10||completionTick!==startedTick+ordinaryDeathDuration(death,entityId,sequence))worldFail('death-save-sequence');
      const corpseIndex=d.corpseIndex===null?null:worldInteger(d.corpseIndex,0,victim.corpseAnimationIds.length-1);
      if((corpseIndex===null)!==(completionTick>=nextTick))worldFail('death-save-completion');
      return {entityId,sourceId,weaponId:weapon.weaponId,sourceOwner,victimOwner,sequence,startedTick,completionTick,corpseIndex};
    });
    const recorded=new Set(deaths.map(d=>d.entityId));
    if(death.rules.actors.some(d=>byId.get(d.entityId)!.health===0&&!recorded.has(d.entityId)))worldFail('death-save-missing');
  }
  let ordinaryRandom:CombatState['ordinaryRandom'];
  if(ordinary){
    const random=worldRecord(r.ordinaryRandom,['state','draws']),state=restoreNativeRandom(random.state);
    const draws=worldInteger(random.draws,0,nextTick*C.shotsPerTick*NATIVE_RELOAD_MAX_DRAWS+(deaths?.filter(d=>d.corpseIndex!==null).length??0));
    if(draws<(deaths?.filter(d=>d.corpseIndex!==null).length??0)+(infantryFiring?.reduce((n,s)=>n+s.state.shots,0)??0))worldFail('death-save-random-count');
    if(state.disabled||state.index1!==draws%250)worldFail('ordinary-save-random-cursor');
    if(draws===0&&canonicalText(state)!==canonicalText(createNativeRandom(ordinary.seed)))worldFail('ordinary-save-random-seed');
    ordinaryRandom={state,draws};
  }
  return { actors, impacts, nextImpactId,...(infantryFiring?{infantryFiring}:{}),...(deaths?{deaths}:{}),...(ordinaryRandom?{ordinaryRandom}:{}) };
}

/** An accepted attack holds its target; moving into range is an explicit move order in this first policy. */
export function attackCombat(model: WorldModel, state: CombatState, entities: WorldEntity[], sourceId: number, targetId: number, emit: Emit): boolean {
  const a = state.actors.find(a => a.entityId === sourceId), d = model.combat!.actors.find(a => a.entityId === sourceId);
  const target = model.combat!.actors.find(a => a.entityId === targetId);
  if (!a || !d?.weapons.length) { emit('unsupported-weapon', sourceId); return false; }
  if (!target || !alive(entities.find(e => e.id === targetId)) || !targetLegal(model, sourceId, targetId)) { emit('illegal-target', sourceId, null, targetId); return false; }
  if (!d.weapons.some(id => weaponLegal(model.combat!.weapons.find(w => w.id === id)!, target,model,sourceId))) { emit('ineffective-weapon', sourceId, null, targetId); return false; }
  cancelFiring(model,state,sourceId);clearBurst(a); a.targetId = targetId; emit('attack-accepted', sourceId, null, targetId); return true;
}

/** After movement: scheduled impacts by due tick/ID, then firing by entity ID. Work is charged before each operation. */
export function stepCombat(model: WorldModel, state: CombatState, entities: WorldEntity[], tick: number, emit: Emit): number {
  const config = model.combat!,ordinary=combatOrdinaryBinding(config),death=combatDeathBinding(config),firing=combatInfantryPrograms(config), byId = new Map(entities.map(e => [e.id, e]));
  const actors = new Map(config.actors.map(a => [a.entityId, a])), orders = new Map(state.actors.map(a => [a.entityId, a]));
  const weapons = new Map(config.weapons.map(w => [w.id, w])); let work = 0, shots = 0;
  const programs=new Map(firing?.map(p=>[p.actorId,p])??[]),schedules=new Map<number,InfantryFiringState>(firing?.map((p,i)=>[p.actorId,restoreInfantryFiring(p,state.infantryFiring![i])])??[]);
  const cancel=(id:number)=>{const p=programs.get(id);if(p)schedules.set(id,transitionInfantryFiring(p,schedules.get(id)!,{kind:'cancel'}).state);};
  const charge = (count=1) => { if (count>C.operationsPerTick-work)worldFail('combat-work-limit');work+=count; };
  if(ordinary)state.ordinaryRandom!.state=restoreNativeRandom(state.ordinaryRandom!.state);
  if(death){
    // WebRA2 phase order: complete due sequences after motion, before this tick's shots.
    charge(state.deaths!.length);
    const due=state.deaths!.filter(d=>d.corpseIndex===null&&d.completionTick===tick).sort((a,b)=>a.completionTick-b.completionTick||a.entityId-b.entityId);
    for(const d of due){
      charge();const random=state.ordinaryRandom!,draw=nextNativeRandomWord(random.state);
      random.state=draw.state;random.draws=worldInteger(random.draws+draw.drawCount,0,Number.MAX_SAFE_INTEGER);
      d.corpseIndex=draw.value%ordinaryDeathActor(death,d.entityId)!.corpseAnimationIds.length;
      const at=worldAddress(byId.get(d.entityId)!.x,byId.get(d.entityId)!.y);
      emit('corpse-selected',d.entityId,at,d.corpseIndex);emit('destroyed',d.entityId,at,d.sourceId);
    }
  }
  function hit(sourceId: number, targetId: number, w: CombatWeapon, aim: number): void {
    charge(); const target = byId.get(targetId);
    if (!alive(target) || w.delivery === 'fixed-cell' && worldAddress(target.x, target.y) !== aim) { emit('impact-missed', sourceId, aim, targetId); return; }
    const damage = Math.min(target.health!, damageFor(model,sourceId,w,actors.get(targetId)!)); target.health! -= damage;
    emit('damaged', targetId, worldAddress(target.x, target.y), damage);
    if (target.health === 0) {
      target.goal = null; target.route = []; target.progress = 0; target.waitTicks = 0;
      const order = orders.get(target.id); if (order) clearOrder(order);cancel(target.id);
      if(death){
        const sequence=(ordinaryDeathWeapon(death,w.id)!.infDeath+10) as 11|12;
        const completionTick=tick+ordinaryDeathDuration(death,target.id,sequence);if(completionTick>=W.tick)worldFail('death-completion-horizon');
        const sourceOwner=model.entities.find(d=>d.id===sourceId)!.owner!,victimOwner=model.entities.find(d=>d.id===target.id)!.owner!;
        state.deaths!.push({entityId:target.id,sourceId,weaponId:w.id,victimOwner,sourceOwner,sequence,startedTick:tick,completionTick,corpseIndex:null});
        state.deaths!.sort((a,b)=>a.entityId-b.entityId);
        emit('dying',target.id,worldAddress(target.x,target.y),sourceId);
        emit('death-sequence',target.id,worldAddress(target.x,target.y),sequence);
      }else emit('destroyed', target.id, worldAddress(target.x, target.y), sourceId);
    }
  }
  for (const p of state.impacts) if (p.dueTick === tick) hit(p.sourceId, p.targetId, weapons.get(p.weaponId)!, p.aim);
  state.impacts = state.impacts.filter(p => p.dueTick !== tick);
  for (const a of state.actors) {
    charge(); if (a.targetId === null) {cancel(a.entityId);continue;}
    const source = byId.get(a.entityId)!, target = byId.get(a.targetId), d = actors.get(a.entityId)!;
    if (!alive(source) || !alive(target)) { clearOrder(a);cancel(a.entityId); continue; }
    if (!a.ammo) { clearBurst(a);cancel(a.entityId); continue; }
    const from = worldAddress(source.x, source.y), aim = worldAddress(target.x, target.y), targetDefinition = actors.get(target.id)!;
    let weapon: CombatWeapon | undefined;
    const firingProgram=programs.get(a.entityId);
    if(firingProgram){
      let schedule=schedules.get(a.entityId)!;
      weapon=weapons.get(d.weapons[0]!)!;
      if(!weaponLegal(weapon,targetDefinition,model,source.id)||!inRange(weapon,from,aim)){cancel(a.entityId);continue;}
      if(!schedule.pending){
        if(tick<a.readyTick||schedule.rearm!==null&&tick<=schedule.rearm.shotTick)continue;
        schedule=transitionInfantryFiring(firingProgram,schedule,{kind:'begin',targetId:target.id,weaponId:weapon.id}).state;
        schedules.set(a.entityId,schedule);emit('fire-started',source.id,aim,target.id);
      }
      if(!inspectDueInfantryShot(firingProgram,schedule))continue;
      a.weaponId=weapon.id;a.burstRemaining=1;
    }else if (a.burstRemaining) {
      weapon = weapons.get(a.weaponId!)!;
      if (!inRange(weapon, from, aim)) { clearBurst(a); continue; }
      if (tick < a.burstTick) continue;
    } else {
      if (tick < a.readyTick) continue;
      weapon = d.weapons.map(id => weapons.get(id)!).find(w => weaponLegal(w, targetDefinition,model,source.id) && inRange(w, from, aim));
      if (!weapon) continue;
      a.weaponId = weapon.id; a.burstRemaining = weapon.burst;
    }
    charge(); if (++shots > C.shotsPerTick) worldFail('combat-shot-limit');
    emit('fired', source.id, aim, target.id);
    if (a.ammo > 0) a.ammo--;
    // Reload is measured from the most recent shot, even if a burst is interrupted.
    if(ordinary){
      const random=state.ordinaryRandom!,draw=nextNativeReloadJitter(random.state);charge(draw.drawCount);
      random.draws=worldInteger(random.draws+draw.drawCount,0,Number.MAX_SAFE_INTEGER);random.state=draw.state;
      a.readyTick=tick+ordinaryCombatReload(ordinary,source.id,weapon.id,draw.value);
      emit('reload-sampled',source.id,null,draw.value);
      if(firingProgram){
        const due=inspectDueInfantryShot(firingProgram,schedules.get(source.id)!)!;
        schedules.set(source.id,transitionInfantryFiring(firingProgram,schedules.get(source.id)!,{kind:'resolve',stateHash:due.stateHash,attemptId:due.attemptId,targetId:due.targetId,weaponId:due.weaponId,decision:'admitted',nativeRof:a.readyTick-tick}).state);
      }
    }else a.readyTick = tick + weapon.reloadTicks;
    if (weapon.delivery === 'instant') hit(source.id, target.id, weapon, aim);
    else {
      if (state.impacts.length >= C.impacts || state.nextImpactId >= Number.MAX_SAFE_INTEGER) worldFail('combat-impact-limit');
      const dueTick = tick + flightTicks(weapon, from, aim); if (dueTick >= W.tick) worldFail('combat-impact-horizon');
      state.impacts.push({ id: state.nextImpactId++, sourceId: source.id, targetId: target.id, weaponId: weapon.id, launchTick: tick, dueTick, from, aim });
    }
    a.burstRemaining--; a.burstTick = tick + weapon.burstDelayTicks;
    if (!a.burstRemaining || !a.ammo || !alive(target)) clearBurst(a);
  }
  // A later actor may kill an earlier actor's target; no dangling live orders survive the phase.
  for (const a of state.actors) { charge(); if (a.targetId !== null && !alive(byId.get(a.targetId))) {clearOrder(a);cancel(a.entityId);} }
  if(firing)state.infantryFiring=firing.map(p=>{charge();return saveInfantryFiring(p,transitionInfantryFiring(p,schedules.get(p.actorId)!,{kind:'advance',tick:tick+1}).state);});
  state.impacts.sort((a, b) => a.dueTick - b.dueTick || a.id - b.id); return work;
}

/** Health-zero pending sequences still own their anchor. Completed corpse art owns no cells. */
export function combatDyingActorIds(state:CombatState|undefined):Set<number>{
  return new Set(state?.deaths?.filter(d=>d.corpseIndex===null).map(d=>d.entityId)??[]);
}
