// SPDX-License-Identifier: GPL-3.0-or-later
// Original source fixtures; no retail rows or bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-transaction-fixture.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionTeamCellSource, isMissionTeamCellSource, missionTeamCellSourceContext } from '../../packages/sim/src/mission-team-cell-source.ts';
import type { MissionTeamCellSourceInput } from '../../packages/sim/src/mission-team-cell-types.ts';
const profiles = ['ra2', 'yr'] as const;
const trigger = '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=2,Shared,Start\n[Events]\nStart=1,13,0,0\n[Actions]\nStart=1,80,1,Squad,0,0,0,0,A';
function fixture(options: Parameters<typeof missionTeamFixture>[0] = {}) {
  const f = missionTeamFixture(options), cells = compileMissionCellEntrySource({ bindings: f.bindings });
  const input: MissionTeamCellSourceInput = { cells, actions: f.source, definitions: f.definitions, rules: f.rules, mission: f.mission };
  return { ...f, cells, input };
}
test('both profiles authenticate future constructor types independently of empty history', () => {
  for (const profile of profiles) {
    const f = fixture({ profile }), result = compileMissionTeamCellSource(f.input);
    assert(isMissionTeamCellSource(result)); assert(Object.isFrozen(result)); assert(Object.isFrozen(result.archetypes[0]!.fields));
    assert.equal(result.coverage.allRequiredConstructorsReady, true); assert.equal(result.coverage.supportedWorldInvariantReady, true);
    assert.equal(result.archetypes.length, 1); assert.equal(result.actions.length, 3); assert.equal(result.coverage.representedSpawnActions, 2);
    assert.equal(result.archetypes[0]!.fields.cloakable.value, false); assert.equal(result.archetypes[0]!.fields.passengers.value, 0);
    const context = missionTeamCellSourceContext(result); assert.equal(context.cells, f.cells); assert.equal(context.actions, f.source);
    assert.equal(context.world, f.world); assert.equal(context.traversal, f.traversal); assert.equal(context.rules, f.rules);
    assert.equal(result.canStartCampaign, false); assert.equal(result.nativeExecutionVerified, false);
    assert(!isMissionTeamCellSource({ ...result })); assert.throws(() => missionTeamCellSourceContext({ ...result }));
  }
});
test('cloak, transport and either rank ability exclude unborn constructors without dropping actions', () => {
  for (const profile of profiles) for (const [field, expected] of [['Cloakable=yes', 'cloakable-construction'], ['Passengers=2', 'transport-construction'],
    ['VeteranAbilities=CLOAK', 'veteran-cloak-ability'], ['EliteAbilities=CLOAK', 'elite-cloak-ability'], ['Cloakable=unknown', 'cloakable-construction']] as const) {
    const f = fixture({ profile, extraRules: field }), result = compileMissionTeamCellSource(f.input);
    assert.equal(result.coverage.allRequiredConstructorsReady, false); assert.equal(result.coverage.supportedWorldInvariantReady, false);
    assert(result.invariant.initialActors.every(a => a.status === 'unsupported'));
    assert(result.archetypes[0]!.reasons.includes(expected)); assert.equal(result.actions.length, 3);
    assert.deepEqual(result.actions.map(a => a.status), ['supported', 'unsupported', 'unsupported']);
    assert.equal(result.coverage.unsupportedSpawnArchetypes, 1);
  }
});
test('effective stage overrides retain unknown history and native comma-only ability semantics', () => {
  for (const profile of profiles) {
    const f = fixture({ profile, extraRules: 'Cloakable=unknown\nPassengers=unknown\nVeteranAbilities=CLOAK', extraMap:
      trigger + '\n[Walker]\nCloakable=no\nPassengers=0\nVeteranAbilities=FASTER, CLOAK' });
    const result = compileMissionTeamCellSource(f.input), fields = result.archetypes[0]!.fields;
    assert.equal(result.coverage.allRequiredConstructorsReady, true);
    assert.equal(fields.cloakable.history.length, 2); assert.equal(fields.cloakable.history[0]!.rawValue, 'unknown');
    assert.equal(fields.cloakable.origin!.layerId, 'map'); assert.deepEqual(fields.veteranAbilities.value, ['FASTER']);
    const retained = fixture({ profile, extraRules: 'Cloakable=yes', extraMap: trigger + '\n[Walker]\nCloakable=' });
    const empty = compileMissionTeamCellSource(retained.input); assert.equal(empty.archetypes[0]!.fields.cloakable.value, true);
    assert.equal(empty.archetypes[0]!.fields.cloakable.history.length, 2); assert.equal(empty.coverage.allRequiredConstructorsReady, false);
  }
});
test('Drive constructor is admitted; a genuine Hover catalog retains an explicit locomotor gate', () => {
  for (const profile of profiles) for (const [suffix, ready] of [['1', true], ['2', false]] as const) {
    const f = fixture({ profile, forceType: 'Carrier', extraRules:
      `[VehicleTypes]\n0=Carrier\n[Carrier]\nStrength=100\nSpeed=128\nSpeedType=Foot\nLocomotor={4A58274${suffix}-9839-11D1-B709-00A024DDAFD1}` });
    const result = compileMissionTeamCellSource(f.input); assert.equal(result.archetypes[0]!.kind, 'unit');
    assert.equal(result.coverage.allRequiredConstructorsReady, ready); assert.equal(result.archetypes[0]!.constructorEligibility, ready ? 'supported' : 'unsupported');
  }
});
test('initial type and placed cloak providers are separate from future constructor readiness', () => {
  for (const profile of profiles) {
    const initialOnly = fixture({ profile, forceType: 'Carrier', extraRules: 'Cloakable=yes\n[VehicleTypes]\n0=Carrier\n[Carrier]\nStrength=100\nSpeed=128\nSpeedType=Foot\nLocomotor={4A582741-9839-11D1-B709-00A024DDAFD1}' });
    const source = compileMissionTeamCellSource(initialOnly.input);
    assert.equal(source.coverage.allRequiredConstructorsReady, true); assert.equal(source.coverage.supportedWorldInvariantReady, false);
    assert(source.invariant.initialActors.every(a => a.reasons.includes('cloakable-construction')));
    // The older source is retained verbatim: the new context never rewrites its historical scope.
    assert(initialOnly.cells.actors.every(a => a.status === 'supported'));
    for (const value of ['yes', 'unknown', 'no']) {
      const f = fixture({ profile, extraRules: `[BuildingTypes]\n0=Beacon\n[Beacon]\nStrength=100\nCloakGenerator=${value}`,
        extraMap: trigger + '\n[Structures]\n0=Commander,Beacon,256,1,3,0,None,0,0,1,0,0,0' });
      const result = compileMissionTeamCellSource(f.input);
      assert.equal(result.coverage.allRequiredConstructorsReady, true); assert.equal(result.coverage.supportedWorldInvariantReady, value === 'no');
      assert.equal(result.invariant.initialCloakProviders.length, 1);
      assert.equal(result.invariant.initialCloakProviders[0]!.status, value === 'no' ? 'inactive' : 'unsupported');
    }
  }
});
test('missing source trigger and unrelated automatic team diagnostics are preserved', () => {
  const missing = fixture({ extraMap: '[Actions]\nSpawn=1,80,1,Squad,0,0,0,0,A' }), source = compileMissionTeamCellSource(missing.input);
  assert.equal(source.actions.length, 1); assert.equal(source.archetypes.length, 1); assert.equal(source.actions[0]!.status, 'unsupported');
  assert(source.actions[0]!.reasons.includes('missing-trigger')); assert.equal(source.coverage.allRequiredConstructorsReady, false);
  const automatic = fixture({ extraTeam: 'Waypoint=A\nAutocreate=yes' }), a = compileMissionTeamCellSource(automatic.input);
  assert.equal(automatic.source.wholeSourceReady, false); assert(automatic.source.diagnostics.some(d => d.code === 'automatic-team-behavior:autocreate'));
  assert.equal(missionTeamCellSourceContext(a).actions, automatic.source); assert.equal(a.canStartCampaign, false);
});
test('source joins, owned mission bytes and descriptor-only outer inputs fail closed', () => {
  const f = fixture(), other = fixture({ extraRules: 'Cloakable=no' }), result = compileMissionTeamCellSource(f.input);
  for (const patch of [{ cells: other.cells }, { actions: other.source }, { definitions: other.definitions }, { rules: other.rules },
    { mission: { ...f.mission, source: { ...f.mission.source, id: 'wrong' } } }, { cells: { ...f.cells } }, { actions: new Proxy(f.source, {}) }, { definitions: { ...f.definitions } }])
    assert.throws(() => compileMissionTeamCellSource({ ...f.input, ...patch }));
  const bytes = f.mission.bytes.slice(), outer = new Proxy({ ...f.input, mission: new Proxy({ ...f.mission, bytes }, { get() { throw new Error('get'); } }) }, { get() { throw new Error('get'); } });
  assert.deepEqual(compileMissionTeamCellSource(outer), result);
  const owned = compileMissionTeamCellSource({ ...f.input, mission: { ...f.mission, bytes } }); bytes.fill(0); assert.deepEqual(owned, result);
  assert.throws(() => compileMissionTeamCellSource({ ...f.input, mission: { ...f.mission, bytes } }), /mission-hash/);
  assert.throws(() => compileMissionTeamCellSource({ ...f.input, mission: { ...f.mission, bytes: new Proxy(f.mission.bytes, {}) } }), /mission-bytes/);
  assert.throws(() => compileMissionTeamCellSource(Object.defineProperty({ ...f.input }, 'mission', { enumerable: true, get() { throw new Error('get'); } })));
});
test('source limits reject work, metadata counts and serialization before publishing a brand', () => {
  const f = fixture();
  for (const limits of [{ actors: 1 }, { types: 0 }, { actions: 2 }, { catalogs: 1 }, { references: 0 }, { sourceWork: 0 },
    { missionBytes: 0 }, { stages: 0 }, { fields: 0 }, { serializedBytes: 0 }, { nodes: 0 }]) assert.throws(() => compileMissionTeamCellSource(f.input, limits));
  for (const invalid of [{ contextWork: -0 }, { actors: Infinity }, { invented: 1 }, Object.defineProperty({}, 'types', { enumerable: true, get() { return 1; } })])
    assert.throws(() => compileMissionTeamCellSource(f.input, invalid));
});
