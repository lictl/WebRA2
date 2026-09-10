// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { infantryPassageFixture, infantryRow } from './infantry-passage-fixture.ts';
import { createInfantryOccupancy, type InfantryOccupancyInput } from '../../packages/sim/src/infantry-passage-occupancy.ts';
const at = (x: number, y: number) => x + y * 512;
const edit = (s: InfantryOccupancyInput, id: number, values: object, slots?: object): InfantryOccupancyInput => ({ ...s,
  entities: s.entities.map(e => e.id === id ? { ...e, ...values } : e),
  infantrySlots: s.infantrySlots.map(e => e.entityId === id ? { ...e, ...slots } : e) });
test('same and directed allied actors can choose an unoccupied slot; hostile and unknown relationships cannot', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = infantryPassageFixture({ profile, rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 4, 'Rival')] });
    const index = createInfantryOccupancy(f.catalog, f.state);
    assert.equal(index.choose(1, at(2, 3)).subcell, 2); assert.equal(index.choose(2, at(2, 2)).reason, 'non-allied-occupant');
    assert.equal(index.choose(1, at(2, 2)).subcell, 2);
    const arrived = edit(f.state, 1, { x: 2, y: 3 }); assert.doesNotThrow(() => createInfantryOccupancy(f.catalog, arrived));
    const reverseArrived = edit(f.state, 2, { x: 2, y: 2 });
    // A structural save proves a possible directed order, not which actor historically moved first.
    assert.doesNotThrow(() => createInfantryOccupancy(f.catalog, reverseArrived));
    const unauthorizedHead = edit(f.state, 2, { goal: at(2, 2), route: [at(2, 3), at(2, 2)], progress: 1 }, { reservedSubcell: 4 });
    assert.throws(() => createInfantryOccupancy(f.catalog, unauthorizedHead), /reservation-alliance/);
  }
  const u = infantryPassageFixture({ allies: 'Unknown', rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 4, 'Rival')] });
  assert.equal(createInfantryOccupancy(u.catalog, u.state).choose(1, at(2, 3)).reason, 'unknown-alliance');
});
test('full three slots and unsupported actors stay blocked; an original shared anchor cannot expand its exception', () => {
  const f = infantryPassageFixture({ rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 2), infantryRow(2, 2, 3, 3), infantryRow(3, 2, 3, 4)] });
  assert.equal(createInfantryOccupancy(f.catalog, f.state).choose(1, at(2, 3)).reason, 'full-subcells');
  const malformed = edit(f.state, 1, { x: 2, y: 3 }); assert.throws(() => createInfantryOccupancy(f.catalog, malformed), /slot-overlap/);
  const g = infantryPassageFixture({ rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 0), infantryRow(2, 2, 3, 4)] });
  assert.doesNotThrow(() => createInfantryOccupancy(g.catalog, g.state));
  assert.equal(createInfantryOccupancy(g.catalog, g.state).choose(1, at(2, 3)).reason, 'whole-cell-blocker');
  assert.throws(() => createInfantryOccupancy(g.catalog, edit(g.state, 1, { x: 2, y: 3 })), /slot-overlap/);
});
test('in-flight destination slots persist, conflicting reservations reject and detached indexes cannot change with their input', () => {
  const f = infantryPassageFixture({ rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 2), infantryRow(2, 3, 2, 2)] });
  const active = edit(f.state, 1, { goal: at(3, 3), route: [at(2, 2), at(3, 3)], progress: 1 }, { reservedSubcell: 2 });
  const i = createInfantryOccupancy(f.catalog, active); assert.equal(i.choose(2, at(3, 3)).subcell, 3);
  assert.equal(i.choose(2, at(2, 2)).subcell, 3); // Conservative source anchor remains reserved too.
  const both = edit(active, 2, { goal: at(3, 3), route: [at(2, 3), at(3, 3)], progress: 1 }, { reservedSubcell: 3 });
  assert.equal(createInfantryOccupancy(f.catalog, both).choose(3, at(3, 3)).subcell, 4);
  assert.throws(() => createInfantryOccupancy(f.catalog, edit(both, 2, {}, { reservedSubcell: 2 })), /slot-overlap/);
  assert.throws(() => createInfantryOccupancy(f.catalog, edit(active, 1, {}, { reservedSubcell: null })), /slot-reservation/);
  assert.throws(() => createInfantryOccupancy(f.catalog, edit(active, 1, { progress: 0 })), /slot-reservation/);
  const copied = structuredClone(active); const detached = createInfantryOccupancy(f.catalog, copied); copied.entities[0]!.x = 4;
  assert.deepEqual(detached.choose(2, at(3, 3)), i.choose(2, at(3, 3)));
});
test('zero health remains a hard blocker until the core supplies validated retirement, preserving last slots', () => {
  const f = infantryPassageFixture(), dead = edit(f.state, 2, { health: 0 });
  const pending = createInfantryOccupancy(f.catalog, dead); assert.equal(pending.choose(1, at(2, 3)).reason, 'whole-cell-blocker');
  assert.equal(pending.choose(2, at(3, 3)).reason, 'dying-actor');
  const retired = createInfantryOccupancy(f.catalog, { ...dead, retiredEntityIds: [2] });
  assert.equal(retired.choose(1, at(2, 3)).subcell, 2); assert.equal(retired.choose(2, at(3, 3)).reason, 'retired-actor');
  assert.throws(() => createInfantryOccupancy(f.catalog, { ...f.state, retiredEntityIds: [2] }), /retired-projection/);
  assert.throws(() => createInfantryOccupancy(f.catalog, { ...dead, infantrySlots: dead.infantrySlots.slice(0, 1), retiredEntityIds: [2] }), /slot-coverage/);
});
test('strict sorted coverage rejects slot edits, hostile fields, malformed IDs and broken motion projections', () => {
  const f = infantryPassageFixture();
  for (const slots of [[], [...f.state.infantrySlots].reverse(), [{ ...f.state.infantrySlots[0]!, subcell: 0 }, f.state.infantrySlots[1]!]])
    assert.throws(() => createInfantryOccupancy(f.catalog, { ...f.state, infantrySlots: slots as never }));
  assert.throws(() => createInfantryOccupancy({ ...f.catalog }, f.state), /catalog-brand/);
  assert.throws(() => createInfantryOccupancy(f.catalog, edit(f.state, 1, { progress: 1 }, { reservedSubcell: 3 })), /state-edge/);
  let invoked = false; const bad = { ...f.state, get entities() { invoked = true; return f.state.entities; } };
  assert.throws(() => createInfantryOccupancy(f.catalog, bad), /fields/); assert.equal(invoked, false);
  const index = createInfantryOccupancy(f.catalog, f.state); assert.throws(() => index.choose(99, 0), /query-entity/); assert.throws(() => index.choose(1, -0), /integer/);
});
test('non-infantry anchors and independent foundation cells cannot be freed by retiring a nearby infantry actor', () => {
  const f = infantryPassageFixture({ extraRules: '[VehicleTypes]\n0=Cart\n[BuildingTypes]\n0=Depot\n[Cart]\nStrength=100\n[Depot]\nStrength=100',
    extraArt: '[Depot]\nFoundation=2x2', extraMap: '[Units]\n0=Commander,Cart,256,3,1,0,Guard,None,0,-1,0,-1,1,1\n[Structures]\n0=Commander,Depot,256,3,3,0,None' });
  const index = createInfantryOccupancy(f.catalog, f.state);
  assert.equal(index.choose(1, at(3, 1)).reason, 'whole-cell-blocker');
  assert.equal(index.choose(1, at(4, 3)).reason, 'whole-cell-blocker');
  const dead = edit(f.state, 2, { health: 0 });
  const after = createInfantryOccupancy(f.catalog, { ...dead, retiredEntityIds: [2] });
  assert.equal(after.choose(1, at(4, 3)).reason, 'whole-cell-blocker');
  assert.equal(after.choose(1, at(2, 3)).status, 'available');
  assert(f.catalog.actors.filter(a => a.reasons.includes('non-infantry')).length === 2);
});
