// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { recruitmentFixture } from './team-recruitment-fixture.ts';
import { compileTeamRecruitmentCatalog, isTeamRecruitmentCatalog, teamRecruitmentCatalogData } from '../../packages/sim/src/team-recruitment-catalog.ts';

test('both profiles authenticate literal CreateTeam and retain current actor rank and source flags', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = recruitmentFixture({ profile, extraTeam: 'Waypoint=A\nVeteranLevel=2\nPriority=9\nAreTeamMembersRecruitable=no' });
    assert(isTeamRecruitmentCatalog(f.catalog)); assert(!isTeamRecruitmentCatalog({ ...f.catalog }));
    assert.equal(teamRecruitmentCatalogData(f.catalog).world, f.world);
    assert.deepEqual(f.catalog.actors.map(a => a.rankRaw), [0, 100, 0]);
    assert.deepEqual(f.catalog.actors.map(a => a.recruitableB), [true, false, true]);
    assert(f.catalog.actors.every(a => a.status === 'source-candidate'));
    const t = f.catalog.templates[0]!; assert.equal(t.fields.veteranLevel!.value, 2);
    assert.equal(t.fields.priority!.value, 9); assert.equal(t.areTeamMembersRecruitable, false);
    assert.equal(t.status, 'supported-source'); assert.equal(t.group, -1);
    assert.deepEqual(t.anchor, { x: 3, y: 3, rowId: 'waypoints:0' });
    assert.deepEqual(f.catalog.missionControl.map(m => [m.mission, m.recruitable]), [['Guard', true], ['Sleep', true]]);
    assert(Object.isFrozen(t.fields)); assert(Object.isFrozen(f.catalog.actors[0]!.origin));
    assert.throws(() => compileTeamRecruitmentCatalog({ ...f.input, program: { ...f.program } }));
    assert.throws(() => compileTeamRecruitmentCatalog({ ...f.input, activation: { ...f.activation } }));
  }
});
test('source mission gates use exact names and ordered origins, with malformed and duplicate settings retained unsupported', () => {
  const blocked = recruitmentFixture({ extraRules: '[Guard]\nRecruitable=no' });
  assert(blocked.catalog.actors.every(a => a.reasons.includes('actor-mission-not-recruitable')));
  const overridden = recruitmentFixture({ extraRules: '[Guard]\nRecruitable=no', extraMap: '[Guard]\nRecruitable=yes\n[Actions]\nRecruit=1,4,1,Squad,0,0,0,0,A' });
  assert.equal(overridden.catalog.missionControl[0]!.recruitable, true);
  assert.deepEqual(overridden.catalog.missionControl[0]!.history.map(o => o.layerId), ['base', 'map']);
  assert(recruitmentFixture({ extraRules: '[guard]\nRecruitable=no' }).catalog.actors.every(a => a.status === 'source-candidate'));
  for (const extraRules of ['[Guard]\nRecruitable=perhaps', '[Guard]\nRecruitable=yes\nRecruitable=no', '[Guard]\nRecruitable=yes\n[Guard]\nRecruitable=no']) {
    const f = recruitmentFixture({ extraRules }); assert.equal(f.catalog.missionControl[0]!.recruitable, null);
    assert(f.catalog.actors.every(a => a.status === 'unsupported'));
  }
});
test('tail policy preserves unsupported rows rather than dropping actors or inventing omitted flags', () => {
  const cases = [
    ['0=Commander,Walker,256,2,2,0,Guard,0,None', 'placement-tail-framing'],
    ['0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,1,1,1', 'bridge-or-follower-state'],
    ['0=Commander,Walker,256,2,2,0,Attack,0,None,0,-1,0,1,1', 'actor-mission-runtime'],
    ['0=Commander,Walker,256,2,2,0,Guard,0,UnknownTag,0,-1,0,1,1', 'actor-tag-lifecycle'],
    ['0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,2,1', 'placement-tail-values'],
  ];
  for (const [infantryRows, code] of cases) {
    const f = recruitmentFixture({ infantryRows }); assert.equal(f.catalog.actors.length, 1);
    assert(f.catalog.actors[0]!.reasons.includes(code!)); assert.equal(f.catalog.actors[0]!.status, 'unsupported');
  }
  const duplicate = recruitmentFixture({ forceType: 'Walker\n1=1,Walker' });
  assert.deepEqual(duplicate.catalog.templates[0]!.reasons, ['duplicate-taskforce-type']);
  assert.equal(duplicate.catalog.templates[0]!.status, 'unsupported');
  const noAnchor = recruitmentFixture({ extraTeam: 'Waypoint=B' });
  assert(noAnchor.catalog.templates[0]!.reasons.includes('recruitment-anchor'));
});
test('limits, byte identity, wrong actions and hostile descriptors fail before admission', () => {
  const f = recruitmentFixture(), changed = f.mission.bytes.slice(); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  assert.throws(() => compileTeamRecruitmentCatalog({ ...f.input, mission: { ...f.mission, bytes: changed } }), /mission-hash/);
  assert.throws(() => compileTeamRecruitmentCatalog({ ...f.input, mission: { ...f.mission, source: { ...f.mission.source, profile: 'yr' } } }));
  for (const lower of [{ work: 0 }, { actions: 0 }, { actors: 1 }, { members: 0 }, { missionBytes: 0 }])
    assert.throws(() => compileTeamRecruitmentCatalog(f.input, lower));
  assert.throws(() => compileTeamRecruitmentCatalog({ ...f.input, actionIds: [...f.input.actionIds, ...f.input.actionIds] }));
  assert.throws(() => compileTeamRecruitmentCatalog({ ...f.input, actionIds: ['not-an-action'] }));
  let calls = 0; const hostile = { ...f.input }; Object.defineProperty(hostile, 'rules', { enumerable: true, get() { calls++; return f.rules; } });
  assert.throws(() => compileTeamRecruitmentCatalog(hostile)); assert.equal(calls, 0);
  assert.throws(() => compileTeamRecruitmentCatalog({ ...f.input, rules: recruitmentFixture({ extraRules: '[Guard]\nRecruitable=no' }).rules }));
});
