// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseFixture, houseTrigger } from './mission-house-fixture.ts';
import { compileMissionHouseSource, isMissionHouseSource, missionHouseSourceContext } from '../../packages/sim/src/mission-house-source.ts';
const profiles = ['ra2', 'yr'] as const;
test('house instructions retain exact source operands, first-country houses, tags and genuine contexts', () => {
  for (const profile of profiles) {
    const f = houseFixture({ profile }), s = f.source;
    assert.equal(s.instructions.length, 5); assert(s.allInstructionsSupported); assert(s.initialPopulationTypesSupported);
    assert.deepEqual(s.instructions.map(i => i.opcode), [9, 10, 11, 14, 36]);
    assert.deepEqual(s.instructions.map(i => i.selector.playerId), [0, 0, 0, 1, 1]);
    assert.deepEqual(s.instructions[3]!.parameters, ['0', '1', '0', '0', '0', '0', 'A']);
    assert(s.tagChains[0]!.triggerIds.includes('trigger:start'));
    assert.equal(missionHouseSourceContext(s).bindings, f.bindings); assert.equal(missionHouseSourceContext(s).definitions, f.definitions);
    assert(isMissionHouseSource(s)); assert(Object.isFrozen(s.types[0]!.fields.insignificant.history));
    assert(!isMissionHouseSource({ ...s })); assert(!isMissionHouseSource(new Proxy(s, {})));
    assert.equal(s.runtimeAuthority, false); assert.equal(s.canStartCampaign, false);
  }
});
test('population contributions preserve profile-specific Insignificant and DontScore consumers', () => {
  for (const profile of profiles) for (const [key, registered, present] of [
    ['Insignificant=yes', 'none', profile === 'yr' ? 'infantry' : 'none'],
    ['DontScore=yes', profile === 'yr' ? 'none' : 'infantry', 'none'],
    ['Insignificant=unknown', null, profile === 'yr' ? 'infantry' : 'none'],
    ['DontScore=unknown', profile === 'yr' ? null : 'infantry', profile === 'yr' ? null : 'none'],
  ] as const) {
    const s = houseFixture({ profile, extraRules: key }).source, t = s.types.find(t => t.typeId === 'type:infantry:walker')!;
    assert.equal(t.registeredClass, registered); assert.equal(t.presentClass, present);
  }
  const unit = houseFixture({ profile: 'yr', extraRules: '[VehicleTypes]\n0=Truck\n[Truck]\nStrength=100\nDontScore=yes\nInsignificant=yes' }).source.types.find(t => t.typeId === 'type:unit:truck')!;
  assert.equal(unit.registeredClass, 'none'); assert.equal(unit.presentClass, null);
  assert(unit.reasons.includes('asymmetric-unit-dontscore-counter'));
  const insignificantUnit = houseFixture({ profile: 'yr', extraRules: '[VehicleTypes]\n0=Truck\n[Truck]\nStrength=100\nInsignificant=yes' }).source.types.find(t => t.typeId === 'type:unit:truck')!;
  assert.equal(insignificantUnit.registeredClass, 'none'); assert.equal(insignificantUnit.presentClass, 'unit');
});
test('current-default boolean histories and unresolved deployable-building classification are explicit', () => {
  for (const profile of profiles) {
    const f = houseFixture({ profile, extraRules: 'Insignificant=unknown', extraMap: houseTrigger + '\n[Walker]\nInsignificant=no' });
    const t = f.source.types.find(t => t.kind === 'infantry')!;
    assert.equal(t.fields.insignificant.value, false); assert.equal(t.fields.insignificant.history.length, 2);
    assert.equal(t.fields.insignificant.history[0]!.rawValue, 'unknown');
    const empty = houseFixture({ profile, extraRules: 'Insignificant=yes', extraMap: houseTrigger + '\n[Walker]\nInsignificant=' }).source;
    assert.equal(empty.types.find(t => t.kind === 'infantry')!.registeredClass, 'none');
    const building = houseFixture({ profile, extraRules: '[BuildingTypes]\n0=Depot\n[Depot]\nStrength=100\nUndeploysInto=Carrier' }).source.types.find(t => t.kind === 'structure')!;
    assert.equal(building.registeredClass, null); assert(building.reasons.includes('deployable-building-population'));
  }
});
test('invalid/special selectors remain retained and never imply a missing house has a live population', () => {
  for (const profile of profiles) for (const value of ['-1', '2147483648', '4475', '8997']) {
    const f = houseFixture({ profile, extraMap: houseTrigger.replace('14,0,1,', `14,0,${value},`) }), instruction = f.source.instructions.find(i => i.opcode === 14)!;
    assert.equal(instruction.status, profile === 'yr' && value === '8997' ? 'supported-source' : 'unsupported');
    assert.equal(instruction.parameters[1], value);
    if (profile === 'yr' && value === '8997') { assert.equal(instruction.selector.playerId, null); assert.equal(instruction.selector.kind, 'current-trigger-house'); }
  }
});
test('source identity, descriptor ownership and lowered source budgets are checked before publication', () => {
  const f = houseFixture(), other = houseFixture({ extraRules: 'Insignificant=no' });
  for (const patch of [{ definitions: other.definitions }, { rules: other.rules }, { bindings: other.bindings }, { bindings: { ...f.bindings } },
    { mission: { ...f.mission, bytes: new Proxy(f.mission.bytes, {}) } }]) assert.throws(() => compileMissionHouseSource({ ...f.input, ...patch }));
  const copied = f.mission.bytes.slice(), wrapped = new Proxy({ ...f.input, mission: new Proxy({ ...f.mission, bytes: copied }, { get() { throw Error('get'); } }) }, { get() { throw Error('get'); } });
  const s = compileMissionHouseSource(wrapped); copied.fill(0); assert.deepEqual(s, f.source);
  assert.throws(() => compileMissionHouseSource(wrapped), /mission-hash/);
  for (const options of [{ actors: 2 }, { types: 0 }, { instructions: 4 }, { references: 0 }, { sourceWork: 8_388_608 }, { missionBytes: 0 }, { serializedBytes: 0 }])
    assert.throws(() => compileMissionHouseSource(f.input, options));
});
test('deployable building count classification follows each profile rather than a rectangle heuristic', () => {
  for (const profile of profiles) for (const [yard, gatherer, size, expected] of [
    [true, false, '3x3', 'building'], [false, false, '2x2', profile === 'ra2' ? 'unit' : 'building'],
    [false, true, '2x2', 'unit'], [false, false, '1x1', 'unit'],
  ] as const) {
    const f = houseFixture({ profile, extraRules: `[BuildingTypes]\n0=Depot\n[Depot]\nStrength=100\nConstructionYard=${yard ? 'yes' : 'no'}\nUndeploysInto=Truck\n[VehicleTypes]\n0=Truck\n[Truck]\nStrength=100\nResourceGatherer=${gatherer ? 'yes' : 'no'}`,
      extraArt: `[Depot]\nFoundation=${size}` });
    const depot = f.source.types.find(t => t.kind === 'structure')!;
    assert.equal(depot.registeredClass, expected); assert.equal(depot.undeployTargetTypeId, 'type:unit:truck');
  }
});
