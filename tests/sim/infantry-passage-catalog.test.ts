// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { infantryPassageFixture, infantryRow } from './infantry-passage-fixture.ts';
import { compileInfantryPassageCatalog, infantryPassageBase } from '../../packages/sim/src/infantry-passage-catalog.ts';

test('source policy retains exact slots, source identities and directed house relationships in both profiles', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = infantryPassageFixture({ profile, rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 4, 'Rival')] });
    assert.equal(f.catalog.profile, profile); assert.deepEqual(f.catalog.actors.map(a => a.status), ['ordinary-slots', 'ordinary-slots']);
    assert.deepEqual(f.catalog.actors.map(a => a.sourceSubcell), [2, 4]); assert.deepEqual(f.catalog.alliances, [{ from: 0, to: 1 }]);
    assert.equal(infantryPassageBase(f.catalog), f.world.model); assert(Object.isFrozen(f.catalog.actors[0]!.origin));
    assert.equal(f.catalog.sha256, compileInfantryPassageCatalog(f.input).sha256);
    const damaged = f.mission.bytes.slice(); damaged[0] = damaged[0]! ^ 1;
    assert.throws(() => compileInfantryPassageCatalog({ ...f.input, mission: { ...f.mission, bytes: damaged } }), /mission-hash/);
    for (const key of ['world', 'actors', 'definitions'] as const) assert.throws(() => compileInfantryPassageCatalog({ ...f.input, [key]: { ...f.input[key] } }), /factory/);
    assert.throws(() => infantryPassageBase({ ...f.catalog }), /catalog-brand/);
    assert.throws(() => compileInfantryPassageCatalog({ ...f.input, mission: { ...f.mission, source: { ...f.mission.source, profile: profile === 'ra2' ? 'yr' : 'ra2' } } }), /source-join/);
  }
});
test('unsupported initial slots, duplicate slot placements, bridge flags and special missions stay whole-cell blockers', () => {
  for (const row of [infantryRow(0, 2, 2, 0), infantryRow(0, 2, 2, 1), infantryRow(0, 2, 2, 2, 'Commander', 'Guard,0,None,0,-1,1,1,1'),
    infantryRow(0, 2, 2, 2, 'Commander', 'Enter,0,None,0,-1,0,1,1')]) {
    const f = infantryPassageFixture({ rows: [row] }); assert.equal(f.catalog.actors[0]!.status, 'whole-cell'); assert.equal(f.state.infantrySlots.length, 0);
  }
  const f = infantryPassageFixture({ rows: [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 2, 2)] });
  assert(f.catalog.actors.every(a => a.reasons.includes('source-slot-collision'))); assert.equal(f.world.model.entities.length, 2);
  const tagged = infantryPassageFixture({ rows: [infantryRow(0, 2, 2, 2, 'Commander', 'Guard,0,OriginalTag,0,-1,0,1,1')] });
  assert.equal(tagged.catalog.actors[0]!.status, 'ordinary-slots'); assert.equal(tagged.catalog.actors[0]!.sourceTag, 'OriginalTag');
});
test('source bounds and input descriptors reject before invoking getters or granting unknown relationships', () => {
  const f = infantryPassageFixture(); let invoked = false;
  assert.throws(() => compileInfantryPassageCatalog({ ...f.input, get world() { invoked = true; return f.world; } }), /fields/); assert.equal(invoked, false);
  assert.throws(() => compileInfantryPassageCatalog(f.input, { actors: 1 }), /source-limit/);
  assert.throws(() => compileInfantryPassageCatalog(f.input, { missionBytes: f.mission.bytes.length - 1 }), /mission-bytes/);
  assert.throws(() => compileInfantryPassageCatalog(f.input, { work: 0 }), /limit/);
  const unknown = infantryPassageFixture({ allies: 'MissingHouse' }); assert.equal(unknown.catalog.alliancesComplete, false); assert.equal(unknown.catalog.alliances.length, 0);
});
