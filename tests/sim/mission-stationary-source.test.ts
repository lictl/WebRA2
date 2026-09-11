// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { stationaryFixture } from './mission-stationary-fixture.ts';
import { compileMissionStationarySource, missionStationarySourceData, isMissionStationarySource } from '../../packages/sim/src/mission-stationary-source.ts';

test('per-actor Guard candidate does not require Sleep to become recruitable or grant runtime authority', () => {
  for (const p of ['ra2', 'yr'] as const) {
    const f = stationaryFixture(p), c = f.stationary.catalogs[0]!;
    assert.equal(f.binding.allRequiredTransfersSupported, false);
    assert.equal(c.controls.find(m => m.mission === 'Sleep')!.recruitable, false);
    assert.equal(c.actors[0]!.status, 'guard-invariant-candidate');
    assert.equal(c.actors[1]!.initialMission, 'Sleep');
    assert(c.actors[1]!.reasons.includes('actor-mission-not-recruitable'));
    assert.deepEqual(f.stationary.actions[0]!.guardEntityIds, [c.actors[0]!.entityId]);
    assert.equal(f.stationary.runtimeAuthority, false);
    assert.equal(f.stationary.upstreamWholeSourceReady, f.source.wholeSourceReady);
    assert.equal(missionStationarySourceData(f.stationary).binding, f.binding);
  }
});

test('false, ambiguous and overridden Guard controls retain exact upstream refusals', () => {
  for (const p of ['ra2', 'yr'] as const) {
    for (const rules of ['[Guard]\nRecruitable=no', '[Guard]\nRecruitable=unknown', '[Guard]\nRecruitable=yes\nRecruitable=no']) {
      const f = stationaryFixture(p, { rules });
      assert.equal(f.stationary.actions[0]!.guardEntityIds.length, 0);
      assert(f.stationary.catalogs[0]!.actors[0]!.reasons.includes('guard-not-recruitable'));
    }
    const f = stationaryFixture(p, { rules: '[Guard]\nRecruitable=no', map: '[Guard]\nRecruitable=yes' });
    assert.equal(f.stationary.catalogs[0]!.actors[0]!.status, 'guard-invariant-candidate');
  }
});

test('Sleep, non-Guard missions, tagged placements and constructors are retained and gated', () => {
  for (const p of ['ra2', 'yr'] as const) {
    const f = stationaryFixture(p, { constructors: true, rules: '[Sleep]\nRecruitable=yes', rows:
      '0=Rival,Walker,256,2,2,0,Sleep,0,None,0,-1,0,1,1\n1=Rival,Walker,256,2,3,0,Area Guard,0,None,0,-1,0,1,1\n' +
      '2=Rival,Walker,256,4,2,0,Guard,0,Shared,0,-1,0,1,1' });
    assert.equal(f.stationary.catalogs[0]!.actors.length, 3);
    assert.equal(f.stationary.actions.length, f.source.actions.length);
    assert(f.stationary.catalogs[0]!.actors.every(a => a.status === 'unsupported'));
    assert(f.stationary.catalogs[0]!.actors[2]!.reasons.includes('actor-tag-lifecycle'));
    assert(f.stationary.actions.filter(a => a.opcode !== 4).every(a => a.reasons.includes('dynamic-constructor-required')));
    assert.equal(f.binding.allRequiredActionsSupported, false);
  }
});

test('source identity is same-realm, owned and descriptor-captured once', () => {
  for (const p of ['ra2', 'yr'] as const) {
    const f = stationaryFixture(p);
    for (const b of [{ ...f.binding }, structuredClone(f.binding), new Proxy(f.binding, {})])
      assert.throws(() => compileMissionStationarySource({ binding: b }), /owned-binding/);
    assert.equal(isMissionStationarySource({ ...f.stationary }), false);
    assert.throws(() => missionStationarySourceData({ ...f.stationary }), /source-brand/);
    let gets = 0;
    const input = new Proxy({ binding: f.binding }, { get() { gets++; throw new Error('must not read'); } });
    assert.deepEqual(compileMissionStationarySource(input), f.stationary); assert.equal(gets, 0);
    assert.throws(() => compileMissionStationarySource({ get binding(): never { throw new Error('must not read'); } }), /fields/);
    assert.throws(() => { (f.stationary.actions[0]!.guardEntityIds as number[]).push(99); });
  }
});

test('aggregate source work and output caps reject exactly below required work', () => {
  for (const p of ['ra2', 'yr'] as const) {
    const f = stationaryFixture(p), work = missionStationarySourceData(f.stationary).work;
    assert.deepEqual(compileMissionStationarySource({ binding: f.binding }, { work }), f.stationary);
    assert.throws(() => compileMissionStationarySource({ binding: f.binding }, { work: work - 1 }), /source-work/);
    for (const cap of [{ actions: 0 }, { catalogs: 0 }, { actorRows: 1 }, { characters: 1 }, { serializedBytes: 1 }])
      assert.throws(() => compileMissionStationarySource({ binding: f.binding }, cap));
    assert.throws(() => compileMissionStationarySource({ binding: f.binding }, { work: -0 }));
    assert.deepEqual(compileMissionStationarySource({ binding: f.binding }), f.stationary);
  }
});
