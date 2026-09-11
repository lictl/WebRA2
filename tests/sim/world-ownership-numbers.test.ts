// SPDX-License-Identifier: GPL-3.0-or-later
// Original cross-house equivalence cases against the reviewed eager numerical composition.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrdinaryCombatRules, bindOrdinaryCombatRules, bindOrdinaryCombatCurrentHouses,
  ordinaryCombatDamage, ordinaryCombatReload, ordinaryCombatHouseDamage, ordinaryCombatHouseReload, ordinaryCombatHouseMaximumReload,
  type OrdinaryCombatHouse } from '../../packages/sim/src/ordinary-combat-rules.ts';
import { combatFactor } from '../../packages/sim/src/combat-model.ts';

const weapons = [{ id: 'original:gun', damage: 27, range: 1024, minimumRange: 0, reloadTicks: 13, burst: 1, burstDelayTicks: 1,
  delivery: 'instant' as const, speed: 0, ground: true, air: false, verses: Array.from({ length: 11 }, (_, i) => combatFactor(i === 1 ? 0 : .75)) }];
const actors = [1, 2, 3].map(entityId => ({ entityId, armor: entityId - 1, layer: 'ground' as const, weapons: ['original:gun'], initialAmmo: -1 }));
const factors = actors.map(a => ({ entityId: a.entityId, houseFirepower: 1, houseRof: 1, countryArmor: 1,
  actorFirepower: a.entityId * .25 + .5, actorArmor: a.entityId * .125 + .5, veteranCombat: 1.25, veteranArmor: 1.5, veteranRof: .75 }));
const houses: OrdinaryCombatHouse[] = [{ playerId: 0, houseFirepower: 1.5, houseRof: 2, countryArmor: .75 },
  { playerId: 1, houseFirepower: .75, houseRof: 0, countryArmor: 3 }, { playerId: 2, houseFirepower: 2.25, houseRof: .5, countryArmor: 1.25 }];
function bind(values = factors, options = {}) {
  return bindOrdinaryCombatRules(createOrdinaryCombatRules({ seed: 5, actors: values, weapons: [{ weaponId: 'original:gun', maxDamage: 1000 }] }, options), actors, weapons);
}
test('current-house projection equals eager source/target factor composition for every mixed-house pair', () => {
  const current = bindOrdinaryCombatCurrentHouses(bind(), houses);
  for (const source of actors) for (const target of actors) if (source !== target) for (const from of houses) for (const to of houses) {
    const expected = bind(factors.map(a => {
      const h = a.entityId === source.entityId ? from : a.entityId === target.entityId ? to : houses[0]!;
      return { ...a, houseFirepower: h.houseFirepower, houseRof: h.houseRof, countryArmor: h.countryArmor };
    }));
    assert.equal(ordinaryCombatHouseDamage(current, source.entityId, from.playerId, 'original:gun', target.entityId, to.playerId), ordinaryCombatDamage(expected, source.entityId, 'original:gun', target.entityId));
    for (const jitter of [0, 1, 2] as const) assert.equal(ordinaryCombatHouseReload(current, source.entityId, from.playerId, 'original:gun', jitter), ordinaryCombatReload(expected, source.entityId, 'original:gun', jitter));
  }
  for (const a of actors) assert.equal(ordinaryCombatHouseMaximumReload(current, a.entityId), Math.max(...houses.flatMap(h => [0, 1, 2].map(j => ordinaryCombatHouseReload(current, a.entityId, h.playerId, 'original:gun', j as 0 | 1 | 2)))));
});
test('house bindings own descriptor values and reject duplicate, unbounded and unprepared house contexts', () => {
  const rows = houses.map(h => new Proxy({ ...h }, { get() { throw new Error('get trap'); } }));
  const current = bindOrdinaryCombatCurrentHouses(bind(), new Proxy(rows, { get() { throw new Error('array get'); } }));
  const ordinary = bindOrdinaryCombatCurrentHouses(bind(), houses);
  assert.deepEqual(current, ordinary); assert(Object.isFrozen(current));
  assert.throws(() => bindOrdinaryCombatCurrentHouses(bind(), [houses[0]!, houses[0]!]), /ordinary-house-duplicate/);
  assert.throws(() => bindOrdinaryCombatCurrentHouses(bind(), [{ ...houses[0]!, houseFirepower: NaN }]), /ordinary-house-factor/);
  assert.throws(() => bindOrdinaryCombatCurrentHouses(bind(), [{ ...houses[0]!, countryArmor: 0 }]), /ordinary-house-factor/);
  assert.throws(() => bindOrdinaryCombatCurrentHouses(bind(), [{ ...houses[0]!, get houseRof() { return 1; } }]), /world-fields/);
  assert.throws(() => bindOrdinaryCombatCurrentHouses(bind(), Array.from({ length: 257 }, (_, playerId) => ({ ...houses[0]!, playerId }))), /world-array-limit/);
  assert.throws(() => ordinaryCombatHouseReload({ ...current }, 1, 0, 'original:gun', 0), /ordinary-house-binding/);
  assert.throws(() => ordinaryCombatHouseDamage(current, 1, 0, 'original:gun', 2, 255), /ordinary-house-damage/);
  assert.throws(() => bindOrdinaryCombatCurrentHouses(bind(), [{ ...houses[0]!, houseFirepower: 65536, countryArmor: 1 / 65536 }]), /conversion-overflow/);
});
