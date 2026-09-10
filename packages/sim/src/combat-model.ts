// SPDX-License-Identifier: MIT
// Original bounded cell-combat policy. A native adapter must admit supported capabilities explicitly.
import { worldClone, worldFail, worldHash, worldInteger, worldList, worldRecord, worldSymbol, WORLD_LIMITS as W } from './world-values.ts';

export const COMBAT_POLICY = 'webra2-cell-combat-1' as const;
export const COMBAT_ENGINE_VERSION = 'webra2-world-2' as const;
export const COMBAT_LIMITS = Object.freeze({ weapons: 1024, actors: W.entities, slots: 2, impacts: 4096,
  shotsPerTick: 4096, operationsPerTick: 16384, burst: 64, delay: 10000, ammo: 1_000_000, range: 262144 });
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
  /** Directed source-owner → target-owner alliances. Same-owner targeting is always forbidden. */
  readonly allies: readonly Readonly<{ playerId: number; allyId: number }>[];
}
export interface CombatModel extends CombatModelInput { readonly policy: typeof COMBAT_POLICY; readonly sha256: string }
const models = new WeakSet<object>();
export function assertCombatModel(model: CombatModel): void { if (!models.has(model)) worldFail('combat-model'); }

export function createCombatModel(input: CombatModelInput): CombatModel {
  const r = worldRecord(input, ['weapons', 'actors', 'allies']), ids = new Set<string>();
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
      reloadTicks: worldInteger(w.reloadTicks, 1, COMBAT_LIMITS.delay), burst: worldInteger(w.burst, 1, COMBAT_LIMITS.burst),
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
  const common = { policy: COMBAT_POLICY, weapons: Object.freeze(weapons), actors: Object.freeze(actors), allies: Object.freeze(allies) };
  worldClone(common);
  const model = Object.freeze({ ...common, sha256: worldHash(common) }); models.add(model); return model;
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
