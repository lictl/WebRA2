// SPDX-License-Identifier: MIT
import { combatDamage, COMBAT_LIMITS as C, type CombatActor, type CombatWeapon } from './combat-model.ts';
import { worldAddress, worldFail, worldInteger, worldList, worldPosition, worldRecord, WORLD_LIMITS as W } from './world-values.ts';
import type { WorldModel } from './world-model.ts';
import type { WorldEntity } from './world.ts';

export type CombatOrderState = { entityId: number; targetId: number | null; weaponId: string | null;
  readyTick: number; burstRemaining: number; burstTick: number; ammo: number };
export type CombatImpact = { id: number; sourceId: number; targetId: number; weaponId: string;
  launchTick: number; dueTick: number; from: number; aim: number };
export type CombatState = { actors: CombatOrderState[]; impacts: CombatImpact[]; nextImpactId: number };
type Emit = (kind: string, entityId: number, cell?: number | null, value?: number | null) => void;
const alive = (e: WorldEntity | undefined): e is WorldEntity => !!e && e.health !== null && e.health > 0;
function clearBurst(a: CombatOrderState): void { a.weaponId = null; a.burstRemaining = 0; a.burstTick = 0; }
function clearOrder(a: CombatOrderState): void { a.targetId = null; clearBurst(a); }
export function stopCombat(state: CombatState, entityId: number): void {
  const a = state.actors.find(a => a.entityId === entityId); if (a) clearOrder(a);
}
export function createCombatState(model: WorldModel): CombatState {
  return { actors: model.combat!.actors.map(a => ({ entityId: a.entityId, targetId: null, weaponId: null,
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
function weaponLegal(w: CombatWeapon, target: CombatActor): boolean {
  return (target.layer === 'air' ? w.air : w.ground) && combatDamage(w, target.armor) > 0;
}

export function validateCombatState(model: WorldModel, input: unknown, entities: WorldEntity[], nextTick: number): CombatState {
  const r = worldRecord(input, ['actors', 'impacts', 'nextImpactId']), config = model.combat!;
  const byId = new Map(entities.map(e => [e.id, e])), actorsById = new Map(config.actors.map(a => [a.entityId, a]));
  const weapons = new Map(config.weapons.map(w => [w.id, w]));
  const rows = worldList(r.actors, C.actors); if (rows.length !== config.actors.length) worldFail('combat-save-actors');
  const actors = rows.map((value, i) => {
    const a = worldRecord(value, ['entityId', 'targetId', 'weaponId', 'readyTick', 'burstRemaining', 'burstTick', 'ammo']), d = config.actors[i]!;
    if (a.entityId !== d.entityId) worldFail('combat-save-actor-id');
    const targetId = a.targetId === null ? null : worldInteger(a.targetId, 1, 2147483647);
    const latestReadyTick = nextTick === 0 || !d.weapons.length ? 0 : nextTick - 1 + Math.max(...d.weapons.map(id => weapons.get(id)!.reloadTicks));
    const readyTick = worldInteger(a.readyTick, 0, latestReadyTick), burstRemaining = worldInteger(a.burstRemaining, 0, C.burst - 1);
    const burstTick = worldInteger(a.burstTick, 0, W.tick + C.delay), ammo = worldInteger(a.ammo, -1, C.ammo);
    if (d.initialAmmo === -1 ? ammo !== -1 : ammo < 0 || ammo > d.initialAmmo) worldFail('combat-save-ammo');
    if (targetId !== null && (!actorsById.has(targetId) || !alive(byId.get(targetId)) || !alive(byId.get(d.entityId)) || !d.weapons.length || !targetLegal(model, d.entityId, targetId))) worldFail('combat-save-target');
    if (targetId !== null && byId.get(d.entityId)!.goal !== null) worldFail('combat-save-moving-target');
    if (!d.weapons.length && readyTick !== 0) worldFail('combat-save-unarmed-cooldown');
    if (burstRemaining) {
      const w = typeof a.weaponId === 'string' ? weapons.get(a.weaponId) : undefined;
      if (targetId === null || !w || !d.weapons.includes(w.id) || burstRemaining >= w.burst ||
        !weaponLegal(w, actorsById.get(targetId)!) || burstTick < nextTick || burstTick > nextTick + C.delay || !ammo) worldFail('combat-save-burst');
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
    if (!w || w.delivery === 'instant' || !source?.weapons.includes(w.id) || !target || !targetLegal(model, sourceId, targetId) || !weaponLegal(w, target) || !inRange(w, from, aim) || dueTick !== launchTick + flightTicks(w, from, aim)) worldFail('combat-save-impact');
    if (ids.has(id) || dueTick < priorTick || dueTick === priorTick && id <= priorId) worldFail('combat-save-impact-order');
    ids.add(id); priorTick = dueTick; priorId = id; impacts.push({ id, sourceId, targetId, weaponId: w.id, launchTick, dueTick, from, aim });
  }
  return { actors, impacts, nextImpactId };
}

/** An accepted attack holds its target; moving into range is an explicit move order in this first policy. */
export function attackCombat(model: WorldModel, state: CombatState, entities: WorldEntity[], sourceId: number, targetId: number, emit: Emit): boolean {
  const a = state.actors.find(a => a.entityId === sourceId), d = model.combat!.actors.find(a => a.entityId === sourceId);
  const target = model.combat!.actors.find(a => a.entityId === targetId);
  if (!a || !d?.weapons.length) { emit('unsupported-weapon', sourceId); return false; }
  if (!target || !alive(entities.find(e => e.id === targetId)) || !targetLegal(model, sourceId, targetId)) { emit('illegal-target', sourceId, null, targetId); return false; }
  if (!d.weapons.some(id => weaponLegal(model.combat!.weapons.find(w => w.id === id)!, target))) { emit('ineffective-weapon', sourceId, null, targetId); return false; }
  clearBurst(a); a.targetId = targetId; emit('attack-accepted', sourceId, null, targetId); return true;
}

/** After movement: scheduled impacts by due tick/ID, then firing by entity ID. Work is charged before each operation. */
export function stepCombat(model: WorldModel, state: CombatState, entities: WorldEntity[], tick: number, emit: Emit): number {
  const config = model.combat!, byId = new Map(entities.map(e => [e.id, e]));
  const actors = new Map(config.actors.map(a => [a.entityId, a])), orders = new Map(state.actors.map(a => [a.entityId, a]));
  const weapons = new Map(config.weapons.map(w => [w.id, w])); let work = 0, shots = 0;
  const charge = () => { if (++work > C.operationsPerTick) worldFail('combat-work-limit'); };
  function hit(sourceId: number, targetId: number, w: CombatWeapon, aim: number): void {
    charge(); const target = byId.get(targetId);
    if (!alive(target) || w.delivery === 'fixed-cell' && worldAddress(target.x, target.y) !== aim) { emit('impact-missed', sourceId, aim, targetId); return; }
    const damage = Math.min(target.health!, combatDamage(w, actors.get(targetId)!.armor)); target.health! -= damage;
    emit('damaged', targetId, worldAddress(target.x, target.y), damage);
    if (target.health === 0) {
      target.goal = null; target.route = []; target.progress = 0; target.waitTicks = 0;
      const order = orders.get(target.id); if (order) clearOrder(order);
      emit('destroyed', target.id, worldAddress(target.x, target.y), sourceId);
    }
  }
  for (const p of state.impacts) if (p.dueTick === tick) hit(p.sourceId, p.targetId, weapons.get(p.weaponId)!, p.aim);
  state.impacts = state.impacts.filter(p => p.dueTick !== tick);
  for (const a of state.actors) {
    charge(); if (a.targetId === null) continue;
    const source = byId.get(a.entityId)!, target = byId.get(a.targetId), d = actors.get(a.entityId)!;
    if (!alive(source) || !alive(target)) { clearOrder(a); continue; }
    if (!a.ammo) { clearBurst(a); continue; }
    const from = worldAddress(source.x, source.y), aim = worldAddress(target.x, target.y), targetDefinition = actors.get(target.id)!;
    let weapon: CombatWeapon | undefined;
    if (a.burstRemaining) {
      weapon = weapons.get(a.weaponId!)!;
      if (!inRange(weapon, from, aim)) { clearBurst(a); continue; }
      if (tick < a.burstTick) continue;
    } else {
      if (tick < a.readyTick) continue;
      weapon = d.weapons.map(id => weapons.get(id)!).find(w => weaponLegal(w, targetDefinition) && inRange(w, from, aim));
      if (!weapon) continue;
      a.weaponId = weapon.id; a.burstRemaining = weapon.burst;
    }
    charge(); if (++shots > C.shotsPerTick) worldFail('combat-shot-limit');
    emit('fired', source.id, aim, target.id);
    if (a.ammo > 0) a.ammo--;
    // Reload is measured from the most recent shot, even if a burst is interrupted.
    a.readyTick = tick + weapon.reloadTicks;
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
  for (const a of state.actors) { charge(); if (a.targetId !== null && !alive(byId.get(a.targetId))) clearOrder(a); }
  state.impacts.sort((a, b) => a.dueTick - b.dueTick || a.id - b.id); return work;
}
