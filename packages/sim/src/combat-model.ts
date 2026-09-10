// SPDX-License-Identifier: MIT
// Original bounded cell-combat policy. A native adapter must admit supported capabilities explicitly.
import { isInfantryFiringProgram, type InfantryFiringProgram } from '../../content/src/combat-initial-runtime.ts';
import { isOrdinaryInfantryBridge, type OrdinaryInfantryBridge } from './ordinary-infantry-bridge.ts';
import { bindOrdinaryDeathRules, ORDINARY_DEATH_POLICY, type OrdinaryDeathRules, type OrdinaryDeathBinding } from './ordinary-death-rules.ts';
import { bindOrdinaryCombatRules, ORDINARY_COMBAT_POLICY, type OrdinaryCombatRules, type OrdinaryCombatBinding } from './ordinary-combat-rules.ts';
import { worldClone, worldFail, worldHash, worldInteger, worldList, worldRecord, worldSymbol, WORLD_LIMITS as W } from './world-values.ts';
import { COMBAT_LIMITS } from './combat-limits.ts';
export { COMBAT_LIMITS } from './combat-limits.ts';

export const INFANTRY_COMBAT_POLICY = 'webra2-standing-infantry-combat-1' as const;
export const INFANTRY_COMBAT_ENGINE_VERSION = 'webra2-world-5' as const;
export const SOURCE_INFANTRY_COMBAT_POLICY = 'webra2-source-standing-infantry-combat-1' as const;
export const SOURCE_INFANTRY_COMBAT_ENGINE_VERSION = 'webra2-world-6' as const;
export const COMBAT_POLICY = 'webra2-cell-combat-1' as const;
export const COMBAT_ENGINE_VERSION = 'webra2-world-2' as const;
/** Nonnegative exact binary rational: significand * 2^exponent. No floating point damage arithmetic. */
export interface CombatFactor { readonly significand: number; readonly exponent: number }
export interface CombatWeapon {
  readonly id: string; readonly damage: number; readonly range: number; readonly minimumRange: number;
  readonly reloadTicks: number; readonly burst: number; readonly burstDelayTicks: number;
  readonly delivery: 'instant' | 'tracked' | 'fixed-cell'; readonly speed: number;
  readonly ground: boolean; readonly air: boolean; readonly verses: readonly CombatFactor[];
}
export interface CombatActor {
  readonly entityId: number; readonly armor: number; readonly layer: 'ground' | 'air';
  readonly weapons: readonly string[]; readonly initialAmmo: number;
}
export interface CombatModelInput {
  readonly weapons: readonly CombatWeapon[]; readonly actors: readonly CombatActor[];
  readonly ordinary?: OrdinaryCombatRules;
  readonly ordinaryDeath?: OrdinaryDeathRules;
  readonly infantryFiring?: readonly InfantryFiringProgram[];
  readonly sourceBridge?: OrdinaryInfantryBridge;
  /** Directed source-owner → target-owner alliances. Same-owner targeting is always forbidden. */
  readonly allies: readonly Readonly<{ playerId: number; allyId: number }>[];
}
export interface CombatModel extends Omit<CombatModelInput, 'sourceBridge'> { readonly sourceBridgeFingerprint?: string; readonly policy: typeof COMBAT_POLICY | typeof ORDINARY_COMBAT_POLICY | typeof ORDINARY_DEATH_POLICY | typeof INFANTRY_COMBAT_POLICY | typeof SOURCE_INFANTRY_COMBAT_POLICY; readonly sha256: string }
const models = new WeakSet<object>();
const sourceBindings = new WeakMap<object, OrdinaryInfantryBridge>();
export function combatSourceBridge(model: CombatModel): OrdinaryInfantryBridge | undefined { assertCombatModel(model); return sourceBindings.get(model); }
const firingBindings = new WeakMap<object, readonly InfantryFiringProgram[]>();
export function combatInfantryPrograms(model:CombatModel):readonly InfantryFiringProgram[]|undefined { assertCombatModel(model);return firingBindings.get(model); }
const deathBindings = new WeakMap<object, OrdinaryDeathBinding>();
export function combatDeathBinding(model: CombatModel): OrdinaryDeathBinding | undefined { assertCombatModel(model); return deathBindings.get(model); }
const ordinaryBindings = new WeakMap<object, OrdinaryCombatBinding>();
export function combatOrdinaryBinding(model: CombatModel): OrdinaryCombatBinding | undefined { assertCombatModel(model); return ordinaryBindings.get(model); }
export function assertCombatModel(model: CombatModel): void { if (!models.has(model)) worldFail('combat-model'); }

export function createCombatModel(input: CombatModelInput): CombatModel {
  const hasOrdinary=!!input&&Object.hasOwn(input,'ordinary'),hasDeath=!!input&&Object.hasOwn(input,'ordinaryDeath'),hasFiring=!!input&&Object.hasOwn(input,'infantryFiring'),hasSource=!!input&&Object.hasOwn(input,'sourceBridge');
  if(hasSource&&!hasFiring)worldFail('source-requires-infantry-combat');
  if(hasFiring&&!hasDeath)worldFail('infantry-requires-death-combat');
  if(hasDeath&&!hasOrdinary)worldFail('death-requires-numerical-combat');
  const r = worldRecord(input, ['weapons', 'actors', 'allies',...(hasOrdinary?['ordinary']:[]),...(hasDeath?['ordinaryDeath']:[]),...(hasFiring?['infantryFiring']:[]),...(hasSource?['sourceBridge']:[])]), ids = new Set<string>();
  const weapons = worldList(r.weapons, COMBAT_LIMITS.weapons).map(value => {
    const w = worldRecord(value, ['id', 'damage', 'range', 'minimumRange', 'reloadTicks', 'burst', 'burstDelayTicks', 'delivery', 'speed', 'ground', 'air', 'verses']);
    const id = worldSymbol(w.id); if (ids.has(id)) worldFail('combat-duplicate-weapon'); ids.add(id);
    const range = worldInteger(w.range, 0, COMBAT_LIMITS.range), minimumRange = worldInteger(w.minimumRange, 0, range);
    if (!['instant', 'tracked', 'fixed-cell'].includes(w.delivery as string)) worldFail('combat-delivery');
    const speed = worldInteger(w.speed, w.delivery === 'instant' ? 0 : 1, COMBAT_LIMITS.range);
    if (w.delivery === 'instant' && speed !== 0) worldFail('combat-instant-speed');
    if (typeof w.ground !== 'boolean' || typeof w.air !== 'boolean' || !w.ground && !w.air) worldFail('combat-target-layer');
    const verses = worldList(w.verses, 11).map(value => {
      const f = worldRecord(value, ['significand', 'exponent']), significand = worldInteger(f.significand, 0, Number.MAX_SAFE_INTEGER);
      const exponent = worldInteger(f.exponent, -1074, 1023);
      if (significand === 0 && exponent !== 0 || significand > 0 && significand % 2 === 0) worldFail('combat-factor-canonical');
      return Object.freeze({ significand, exponent });
    });
    if (verses.length !== 11) worldFail('combat-verses');
    return Object.freeze({ id, damage: worldInteger(w.damage, 1, W.health), range, minimumRange,
      reloadTicks: worldInteger(w.reloadTicks, hasOrdinary ? 0 : 1, COMBAT_LIMITS.delay), burst: worldInteger(w.burst, 1, COMBAT_LIMITS.burst),
      burstDelayTicks: worldInteger(w.burstDelayTicks, 1, COMBAT_LIMITS.delay), delivery: w.delivery as CombatWeapon['delivery'], speed,
      ground: w.ground, air: w.air, verses: Object.freeze(verses) });
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const actorIds = new Set<number>(), actors = worldList(r.actors, COMBAT_LIMITS.actors).map(value => {
    const a = worldRecord(value, ['entityId', 'armor', 'layer', 'weapons', 'initialAmmo']), entityId = worldInteger(a.entityId, 1, 2147483647);
    if (actorIds.has(entityId)) worldFail('combat-duplicate-actor'); actorIds.add(entityId);
    if (a.layer !== 'ground' && a.layer !== 'air') worldFail('combat-actor-layer');
    const weapons = worldList(a.weapons, COMBAT_LIMITS.slots).map(worldSymbol);
    if (weapons.some(id => !ids.has(id)) || new Set(weapons).size !== weapons.length) worldFail('combat-actor-weapons');
    return Object.freeze({ entityId, armor: worldInteger(a.armor, 0, 10), layer: a.layer,
      weapons: Object.freeze(weapons), initialAmmo: worldInteger(a.initialAmmo, -1, COMBAT_LIMITS.ammo) });
  }).sort((a, b) => a.entityId - b.entityId);
  const alliances = new Set<number>(), allies = worldList(r.allies, W.players * W.players).map(value => {
    const a = worldRecord(value, ['playerId', 'allyId']), playerId = worldInteger(a.playerId, 0, W.players - 1), allyId = worldInteger(a.allyId, 0, W.players - 1);
    const key = playerId * W.players + allyId;
    if (playerId === allyId || alliances.has(key)) worldFail('combat-alliance'); alliances.add(key); return Object.freeze({ playerId, allyId });
  }).sort((a, b) => a.playerId - b.playerId || a.allyId - b.allyId);
  const ordinary=hasOrdinary?bindOrdinaryCombatRules(r.ordinary as OrdinaryCombatRules,actors,weapons):undefined;
  const death=hasDeath?bindOrdinaryDeathRules(r.ordinaryDeath as OrdinaryDeathRules,actors,weapons):undefined;
  let firing:readonly InfantryFiringProgram[]|undefined;
  if(hasFiring){
    const seen=new Set<number>();firing=Object.freeze(worldList(r.infantryFiring,COMBAT_LIMITS.actors).map(value=>{
      if(!isInfantryFiringProgram(value)||seen.has(value.actorId))worldFail('infantry-program');seen.add(value.actorId);
      worldInteger(value.fireUp,0,COMBAT_LIMITS.delay);
      const a=actors.find(a=>a.entityId===value.actorId);if(!a||a.weapons.length!==1||a.layer!=='ground')worldFail('infantry-program-actor');
      return value;
    }).sort((a,b)=>a.actorId-b.actorId));
    if(!firing.length||actors.some(a=>a.weapons.length&&!seen.has(a.entityId)))worldFail('infantry-program-coverage');
  }
  const common = { ...(firing?{infantryFiring:firing}:{}), policy: firing ? INFANTRY_COMBAT_POLICY : death ? ORDINARY_DEATH_POLICY : ordinary ? ORDINARY_COMBAT_POLICY : COMBAT_POLICY, ...(death ? {ordinaryDeath:r.ordinaryDeath as OrdinaryDeathRules} : {}), ...(ordinary ? {ordinary:r.ordinary as OrdinaryCombatRules} : {}), weapons: Object.freeze(weapons), actors: Object.freeze(actors), allies: Object.freeze(allies) };
  worldClone(common);
  const source = hasSource ? r.sourceBridge : undefined;
  if(hasSource && (!isOrdinaryInfantryBridge(source) || !source.combat || source.combat.sha256 !== worldHash(common))) worldFail('source-combat-join');
  const bound = isOrdinaryInfantryBridge(source) ? { ...common, policy: SOURCE_INFANTRY_COMBAT_POLICY, sourceBridgeFingerprint: source.fingerprint } : common;
  const model = Object.freeze({ ...bound, sha256: worldHash(bound) }); models.add(model); if(ordinary)ordinaryBindings.set(model,ordinary); if(death)deathBindings.set(model,death); if(firing)firingBindings.set(model,firing); if(isOrdinaryInfantryBridge(source))sourceBindings.set(model,source); return model;
}

export function combatDamage(weapon: CombatWeapon, armor: number): number {
  const f = weapon.verses[armor]!; let damage = BigInt(weapon.damage) * BigInt(f.significand);
  damage = f.exponent < 0 ? damage >> BigInt(-f.exponent) : damage << BigInt(f.exponent);
  return Number(damage > BigInt(W.health) ? BigInt(W.health) : damage);
}

/** Convert a finite nonnegative binary64 input exactly; normalize to odd significand (zero uses exponent zero). */
export function combatFactor(value: number): CombatFactor {
  if (!Number.isFinite(value) || value < 0 || Object.is(value, -0)) worldFail('combat-factor');
  if (value === 0) return Object.freeze({ significand: 0, exponent: 0 });
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, value, false);
  const bits = bytes.getBigUint64(0, false), encoded = Number((bits >> 52n) & 2047n);
  let significand = Number(bits & ((1n << 52n) - 1n)) + (encoded ? 2 ** 52 : 0), exponent = encoded ? encoded - 1075 : -1074;
  while (significand % 2 === 0) { significand /= 2; exponent++; }
  return Object.freeze({ significand, exponent });
}
