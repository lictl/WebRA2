// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded unit births; no retail mission rows or native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-transaction-fixture.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionTeamCellSource } from '../../packages/sim/src/mission-team-cell-source.ts';
import { compileMissionTeamConstructorSource, missionTeamConstructorSourceData } from '../../packages/sim/src/mission-team-constructor-source.ts';
import { restoreMissionTeamConstructorHistory, missionTeamConstructorHistoryData } from '../../packages/sim/src/mission-team-constructor-history.ts';
import { createMissionTeamCheckpoint, admitMissionTeamInput, stepMissionTeamWorld, restoreMissionTeamCheckpoint, replayMissionTeamWorld } from '../../packages/sim/src/mission-team-runtime.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
import type { MissionTeamConstructorBirth } from '../../packages/sim/src/mission-team-constructor-types.ts';
const profiles = ['ra2', 'yr'] as const;
const unit = '[VehicleTypes]\n0=Carrier\n[Carrier]\nStrength=110\nSpeed=128\nSpeedType=Foot\nLocomotor={4A582741-9839-11D1-B709-00A024DDAFD1}';
function fixture(profile: 'ra2' | 'yr', extra = '', script = '0=3,1\n1=50,5', infantry = false) {
  const keys = new Set(extra.split('\n').filter(r => r.includes('=')).map(r => r.split('=')[0]));
  const rules = unit.split('\n').filter(r => !keys.has(r.split('=')[0])).join('\n') + '\n' + extra;
  const f = missionTeamFixture({ profile, forceType: infantry ? 'Walker' : 'Carrier', script, waypoint: '0=3003\n1=3004', extraRules: rules });
  const houses = compileMissionHouseSource({ bindings: f.bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const constructors = compileMissionTeamCellSource({ cells: compileMissionCellEntrySource({ bindings: f.bindings }), actions: f.source,
    definitions: f.definitions, rules: f.rules, mission: f.mission });
  const input = { actions: f.source, houses, constructors }, catalog = compileMissionTeamConstructorSource(input);
  return { ...f, input, catalog };
}
function births(history: ReturnType<typeof createMissionTeamCheckpoint>['history']): MissionTeamConstructorBirth[] {
  return history.filter(r => r.kind === 'spawned').map(({ kind: _kind, ...r }) => ({ ...r, ownershipRevision: 0 }));
}
test('both profiles retain every action and authenticate complete ordinary unit constructor prerequisites', () => {
  for (const profile of profiles) {
    const f = fixture(profile), catalog = f.catalog;
    assert.deepEqual(catalog.actions.map(a => a.status), ['not-construction', 'supported', 'supported']);
    assert.equal(catalog.allRequiredConstructorsReady, true); assert.equal(catalog.cellWorldInvariantReady, true);
    assert.deepEqual(catalog.archetypes.map(a => [a.kind, a.registeredClass, a.presentClass, a.maximumHealth]), [['unit', 'unit', profile === 'ra2' ? 'none' : 'unit', 110]]);
    assert.equal(missionTeamConstructorSourceData(catalog).actions, f.source); assert.equal(missionTeamConstructorSourceData(catalog).houses, f.input.houses);
    assert.equal(catalog.canStartCampaign, false); assert.equal(catalog.nativeExecutionVerified, false);
    for (const v of [catalog, catalog.actions, catalog.archetypes, catalog.limits]) assert(Object.isFrozen(v));
  }
});
test('real source action7 and80 move and release with exact restored birth provenance', () => {
  for (const profile of profiles) for (const action of [1, 2]) {
    const f = fixture(profile), initialCheckpoint = createMissionTeamCheckpoint(f.runtime), admission = { requests: [f.receipt(action, 0)], commands: [] };
    let checkpoint = admitMissionTeamInput(f.runtime, initialCheckpoint, admission); const historyHashes: string[] = [];
    for (let n = 0; n < 8; n++) {
      const result = stepMissionTeamWorld(f.runtime, checkpoint);
      assert.deepEqual(stepMissionTeamWorld(f.runtime, restoreMissionTeamCheckpoint(f.runtime, JSON.stringify(checkpoint))), result);
      checkpoint = result.checkpoint;
      const history = restoreMissionTeamConstructorHistory(f.catalog, births(checkpoint.history)), data = missionTeamConstructorHistoryData(history);
      assert.equal(data.base, f.world.model); assert.equal(data.entities.length, n ? 1 : 0);
      if (n) {
        assert.equal(history.births[0]!.ownershipRevision, 0); assert.equal(history.births[0]!.bornAtTick, 1);
        assert.equal(data.entities[0]!.rowId, 'mission-spawn:0:0'); assert.equal(data.entities[0]!.owner, 0);
        assert.equal(data.entities[0]!.kind, 'unit'); assert.equal(data.entities[0]!.initialHealth, 110);
        assert.equal(history.births[0]!.actors[0]!.entityId, f.world.model.entities.at(-1)!.id + 1);
      }
      historyHashes.push(history.sha256); assert.deepEqual(restoreMissionTeamConstructorHistory(f.catalog, structuredClone(history.births)), history);
    }
    assert.equal(new Set(historyHashes.slice(1)).size, 1);
    const actor = checkpoint.team.world.state.entities.at(-1)!; assert.deepEqual([actor.x, actor.y], [4, 3]);
    assert(checkpoint.history.some(r => r.kind === 'released' && r.reason === 'finished'));
    assert.deepEqual(replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256, initialCheckpoint,
      admissions: [{ nextTick: 0, ...admission }], finalNextTick: 8, finalStateSha256: worldHash(checkpoint) }).checkpoint, checkpoint);
  }
});
test('ordinary Sleep retains its genuine born actor and does not manufacture a release', () => {
  for (const profile of profiles) {
    const f = fixture(profile, '', '0=11,0'), initial = createMissionTeamCheckpoint(f.runtime);
    let checkpoint = admitMissionTeamInput(f.runtime, initial, { requests: [f.receipt(1, 0)], commands: [] });
    for (let n = 0; n < 5; n++) checkpoint = stepMissionTeamWorld(f.runtime, checkpoint).checkpoint;
    assert.equal(checkpoint.history.length, 1); assert.equal(restoreMissionTeamConstructorHistory(f.catalog, births(checkpoint.history)).births.length, 1);
    assert.equal(checkpoint.team.team.instances[0]!.phase, 'sleep');
  }
});
test('unsupported locomotors, transport/count branches and infantry retain explicit action gates', () => {
  for (const profile of profiles) for (const [extra, infantry] of [
    ['Locomotor={4A582742-9839-11D1-B709-00A024DDAFD1}', false], ['Passengers=2', false], ['Cloakable=yes', false], ['Insignificant=invalid', false], ['', true],
  ] as const) {
    const f = fixture(profile, extra, undefined, infantry);
    assert.equal(f.catalog.actions.length, 3); assert.equal(f.catalog.actions[0]!.status, 'not-construction');
    assert(f.catalog.actions.slice(1).every(a => a.status === 'unsupported')); assert.equal(f.catalog.allRequiredConstructorsReady, false);
  }
});
test('wrong source brands, definitions and copied histories cannot authorize an appended model', () => {
  for (const profile of profiles) {
    const f = fixture(profile), other = fixture(profile, 'Strength=111'); let gets = 0;
    for (const input of [{ ...f.input, actions: { ...f.source } }, { ...f.input, houses: { ...f.input.houses } },
      { ...f.input, constructors: { ...f.input.constructors } }, { ...f.input, houses: other.input.houses }, { ...f.input, constructors: other.input.constructors }])
      assert.throws(() => compileMissionTeamConstructorSource(input));
    assert.throws(() => restoreMissionTeamConstructorHistory(new Proxy(f.catalog, { get() { gets++; throw Error('get'); } }), [])); assert.equal(gets, 0);
    const history = restoreMissionTeamConstructorHistory(f.catalog, []);
    for (const copied of [{ ...history }, structuredClone(history), new Proxy(history, {})]) assert.throws(() => missionTeamConstructorHistoryData(copied));
    assert.equal(missionTeamConstructorHistoryData(history).entities.length, 0);
  }
});
test('history order, exact member fields and work budgets reject before publication', () => {
  for (const profile of profiles) {
    const f = fixture(profile), initial = createMissionTeamCheckpoint(f.runtime), admitted = admitMissionTeamInput(f.runtime, initial, { requests: [f.receipt(1, 0)], commands: [] });
    const result = stepMissionTeamWorld(f.runtime, stepMissionTeamWorld(f.runtime, admitted).checkpoint), raw = births(result.checkpoint.history), history = restoreMissionTeamConstructorHistory(f.catalog, raw);
    const { work } = missionTeamConstructorHistoryData(history);
    assert.deepEqual(restoreMissionTeamConstructorHistory(f.catalog, raw, work), history);
    assert.throws(() => restoreMissionTeamConstructorHistory(f.catalog, raw, work - 1), /history-work/);
    const sourceWork = missionTeamConstructorSourceData(f.catalog).work;
    assert.doesNotThrow(() => compileMissionTeamConstructorSource(f.input, { work: sourceWork }));
    assert.throws(() => compileMissionTeamConstructorSource(f.input, { work: sourceWork - 1 }), /work-limit/);
    for (const patch of [{ entityId: 99 }, { typeId: 'unrepresented' }, { playerId: 1 }, { houseId: 'Rival' }, { initialHealth: 109 }, { x: 500 }])
      assert.throws(() => restoreMissionTeamConstructorHistory(f.catalog, [{ ...raw[0]!, actors: [{ ...raw[0]!.actors[0]!, ...patch }] }]));
    for (const patch of [{ instanceId: 'mission-team:99' }, { ordinal: 1024 }, { actionId: f.source.actions[0]!.instructionId }, { ownershipRevision: -1 }])
      assert.throws(() => restoreMissionTeamConstructorHistory(f.catalog, [{ ...raw[0]!, ...patch }]));
    assert.throws(() => restoreMissionTeamConstructorHistory(f.catalog, [...raw, ...raw]));
    let gets = 0; const trapped = new Proxy(raw, { get() { gets++; throw Error('get'); } });
    assert.deepEqual(restoreMissionTeamConstructorHistory(f.catalog, trapped), history); assert.equal(gets, 0);
    assert.throws(() => restoreMissionTeamConstructorHistory(f.catalog, [{ ...raw[0]!, get actors() { gets++; return []; } }])); assert.equal(gets, 0);
  }
});
