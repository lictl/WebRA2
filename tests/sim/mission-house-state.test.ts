// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseFixture, houseTrigger } from './mission-house-fixture.ts';
import { createMissionHouseState, applyMissionHouseChanges, saveMissionHouseState, restoreMissionHouseState,
  planMissionHouseTransfer, applyMissionHouseTransfer, evaluateMissionHousePopulation, isMissionHouseState } from '../../packages/sim/src/mission-house-state.ts';
const profiles = ['ra2', 'yr'] as const;
test('registered counts and present Counters are separate', () => {
  for (const profile of profiles) {
    const f = houseFixture({ profile }), initial = createMissionHouseState(f.source, f.participation);
    const event = (opcode: number) => f.source.instructions.find(i => i.opcode === opcode)!.instructionId;
    assert.deepEqual(evaluateMissionHousePopulation(initial, event(9)), { status: 'supported', value: false });
    assert.equal(evaluateMissionHousePopulation(initial, event(10)).value, true);
    const absent = applyMissionHouseChanges(initial, f.participation.filter(a => a.entityId <= 2).map(p => ({ kind: 'participation', participation: { ...p, present: false, tagEligible: false } })));
    assert.equal(evaluateMissionHousePopulation(absent, event(9)).value, profile === 'yr');
    assert.equal(evaluateMissionHousePopulation(absent, event(11)).value, profile === 'yr');
    assert.equal(absent.counts[0]!.registered.infantry, 2); assert.equal(absent.counts[0]!.present.infantry, 0);
    assert.equal(initial.counts[0]!.registered.infantry, 2);
  }
});
test('current-trigger-house selector uses explicit invocation context and aircraft do not prevent population events', () => {
  const f = houseFixture({ profile: 'yr', extraMap: houseTrigger.replace('14,0,1,', '14,0,8997,'), extraRules: '[AircraftTypes]\n0=Wing\n[Wing]\nStrength=100' });
  const s = createMissionHouseState(f.source, f.participation), action = f.source.instructions.find(i => i.opcode === 14)!;
  const p = planMissionHouseTransfer(s, action.instructionId, { sourceHouse: 0, triggerHouse: 1 });
  assert.equal(p.destinationHouse, 1); assert.deepEqual(p.changedEntityIds, [1]);
  const empty = applyMissionHouseChanges(s, s.actors.map(a => ({ kind: 'remove', entityId: a.entityId })));
  const wing = applyMissionHouseChanges(empty, [{ kind: 'insert', actor: { ...s.actors[0]!, entityId: empty.nextEntityId, typeId: 'type:aircraft:wing', tagId: null } }]);
  assert.equal(wing.counts[0]!.registered.aircraft, 1);
  for (const i of f.source.instructions.filter(i => i.kind === 'event')) assert.equal(evaluateMissionHousePopulation(wing, i.instructionId).value, true);
});
test('attachment transfer crosses initial ownership, house-wide transfer uses current ownership', () => {
  for (const profile of profiles) {
    const f = houseFixture({ profile }), s = createMissionHouseState(f.source, f.participation);
    const byOpcode = (op: number) => f.source.instructions.find(i => i.opcode === op)!.instructionId;
    const attached = planMissionHouseTransfer(s, byOpcode(14), { sourceHouse: 0, triggerHouse: 0 }), all = planMissionHouseTransfer(s, byOpcode(36), { sourceHouse: 0, triggerHouse: 0 });
    assert.deepEqual(attached.entityIds, [1, 3]); assert.deepEqual(attached.changedEntityIds, [1]); assert.deepEqual(all.entityIds, [1, 2]);
    const next = applyMissionHouseTransfer(s, attached); assert.deepEqual(next.actors.map(a => a.owner), [1, 0, 1]);
    assert.deepEqual(planMissionHouseTransfer(next, byOpcode(36), { sourceHouse: 0, triggerHouse: 0 }).entityIds, [2]);
    assert.equal(next.counts[0]!.registered.infantry, 1); assert.equal(next.counts[1]!.registered.infantry, 2);
    assert.throws(() => applyMissionHouseTransfer(next, attached), /plan-brand/);
    assert.throws(() => applyMissionHouseTransfer(s, { ...attached }), /plan-brand/);
    const limbo = applyMissionHouseChanges(s, [{ kind: 'participation', participation: { ...f.participation[0]!, present: false, tagEligible: false } }]);
    assert.deepEqual(planMissionHouseTransfer(limbo, byOpcode(14), { sourceHouse: 0, triggerHouse: 0 }).entityIds, [3]);
    assert.deepEqual(planMissionHouseTransfer(limbo, byOpcode(36), { sourceHouse: 0, triggerHouse: 0 }).entityIds, [1, 2]);
  }
});
test('birth, transfer, absence and removal replay with strict owned snapshots at every boundary', () => {
  for (const profile of profiles) {
    const f = houseFixture({ profile }); let state = createMissionHouseState(f.source, f.participation), replay = state;
    const changes = [
      [{ kind: 'insert' as const, actor: { ...state.actors[0]!, entityId: state.nextEntityId, tagId: null } }],
      [{ kind: 'transfer' as const, entityId: 4, owner: 1 }],
      [{ kind: 'participation' as const, participation: { entityId: 4, exists: true, registered: true, present: false, tagEligible: false } }],
      [{ kind: 'remove' as const, entityId: 4 }],
    ];
    for (const c of changes) {
      state = applyMissionHouseChanges(state, c); replay = applyMissionHouseChanges(replay, c);
      const saved = saveMissionHouseState(state), restored = restoreMissionHouseState(f.source, JSON.parse(JSON.stringify(saved)));
      assert.deepEqual(state, restored); assert.deepEqual(state, replay); assert(isMissionHouseState(restored));
      assert.throws(() => restoreMissionHouseState(f.source, { ...saved, nextEntityId: saved.nextEntityId + 1 }));
      assert.throws(() => restoreMissionHouseState(f.source, { ...saved, sha256: '0'.repeat(64) }), /save-hash/);
    }
    assert.equal(state.nextEntityId, 5); assert.equal(state.actors[3]!.exists, false);
    assert.throws(() => applyMissionHouseChanges(state, [{ kind: 'transfer', entityId: 4, owner: 0 }]), /transfer-actor/);
    assert.throws(() => applyMissionHouseChanges(state, [{ kind: 'insert', actor: { ...state.actors[0]!, entityId: 4 } }]), /insert/);
  }
});
test('explicit empty membership, invalid participation and atomic budget failure never infer health', () => {
  const f = houseFixture(), dead = f.participation.map(p => ({ ...p, exists: false, registered: false, present: false, tagEligible: false }));
  const state = createMissionHouseState(f.source, dead); assert.equal(state.counts[0]!.registered.infantry, 0);
  for (const i of f.source.instructions.filter(i => i.kind === 'event')) assert.equal(evaluateMissionHousePopulation(state, i.instructionId).value, true);
  assert.throws(() => createMissionHouseState(f.source, [{ ...dead[0]!, health: 0 } as never, ...dead.slice(1)]));
  assert.throws(() => createMissionHouseState(f.source, [{ ...dead[0]!, present: true }, ...dead.slice(1)]), /participation/);
  const live = createMissionHouseState(f.source, f.participation), before = saveMissionHouseState(live);
  assert.throws(() => applyMissionHouseChanges(live, [{ kind: 'transfer', entityId: 1, owner: 1 }, { kind: 'transfer', entityId: 2, owner: 99 }]));
  assert.deepEqual(saveMissionHouseState(live), before);
  assert.throws(() => applyMissionHouseChanges(live, [{ kind: 'transfer', entityId: 1, owner: 1 }], 0), /work-limit/);
  assert.deepEqual(saveMissionHouseState(live), before);
});
test('descriptor snapshots ignore Proxy get/iterator traps; forged identities and arrays fail', () => {
  const f = houseFixture(), source = f.source, never = { get() { throw Error('get'); } };
  const input = new Proxy(f.participation.map(p => new Proxy(p, never)), never), state = createMissionHouseState(source, input);
  const saved = saveMissionHouseState(state), owned = new Proxy({ ...saved, actors: new Proxy(saved.actors.map(a => new Proxy({ ...a }, never)), never) }, never);
  assert.deepEqual(restoreMissionHouseState(source, owned), state);
  assert.throws(() => createMissionHouseState({ ...source }, input), /source-brand/);
  assert(!isMissionHouseState({ ...state })); assert.throws(() => saveMissionHouseState({ ...state }), /state-brand/);
  const other = houseFixture({ extraRules: 'Insignificant=no' }); assert.throws(() => restoreMissionHouseState(other.source, saved), /save-identity/);
  assert.throws(() => createMissionHouseState(source, [f.participation[0]!, f.participation[0]!, f.participation[2]!]), /duplicate/);
});
test('YR powered buildings retain their second transfer pass; RA2 retains stable order', () => {
  for (const profile of profiles) {
    const f = houseFixture({ profile, extraRules: '[BuildingTypes]\n0=Depot\n[Depot]\nStrength=100\nPowered=yes',
      extraMap: houseTrigger + '\n[Structures]\n0=Commander,Depot,256,1,3,0,None,0,0,1,0,0,0' });
    const state = createMissionHouseState(f.source, f.participation), action = f.source.instructions.find(i => i.opcode === 36)!;
    const plan = planMissionHouseTransfer(state, action.instructionId, { sourceHouse: 0, triggerHouse: 0 }), building = f.source.initialActors.find(a => a.typeId === 'type:structure:depot')!;
    assert(plan.entityIds.includes(building.entityId)); if (profile === 'yr') assert.equal(plan.entityIds.at(-1), building.entityId);
  }
});
