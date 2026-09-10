// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic source records; no retail content or native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileTeamDefinitions, isTeamDefinitions, TEAM_DEFINITIONS_LIMITS } from '../../packages/content/src/team-definitions.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { teamInteger, teamWaypoint, describeTeamScriptOperand } from '../../packages/content/src/team-values.ts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
const baseRules = '[Countries]\n0=Blue\n[Blue]\nName=Azure\n[InfantryTypes]\n0=INF\n[VehicleTypes]\n0=TANK\n[AircraftTypes]\n0=AIR\n[BuildingTypes]\n0=HQ\n[INF]\nStrength=100\n[TANK]\nStrength=100\n[AIR]\nStrength=100\n[HQ]\nStrength=100\n';
const baseMap = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n1=Second\n[Player]\nCountry=Blue\n[Second]\nCountry=Blue\n[Units]\n0=Player,TANK,128,2,2,0,Guard,None\n[Waypoints]\n0=2002\n26=2002\n';
const global = '[TeamTypes]\n9=Alpha\n2=Beta\n[Alpha]\nHouse=Azure\nScript=Walk\nTaskForce=Force\nWaypoint=AA\nPriority=11\n[Beta]\nHouse=Blue\n[ScriptTypes]\n0=Walk\n[Walk]\n0=3,26\n2=4,258\n4=5,2\n9=6,1\n[TaskForces]\n0=Force\n[Force]\n0=2,INF\n2=3,TANK\n5=1,AIR\n';
function fixture({ aiText = global, mapText = baseMap, rulesText = baseRules, profile = 'ra2' as 'ra2' | 'yr' } = {}) {
  const source = { id: 'original-mission', profile, sha256: hash(mapText) }, mapBytes = bytes(mapText);
  const rules = compileRuntimeIni(profile, [{ id: 'rules', profile, order: 0, kind: 'base', sourceSha256: hash(rulesText), bytes: bytes(rulesText) },
    { id: 'map', profile, order: 1, kind: 'map', sourceSha256: source.sha256, bytes: mapBytes }]);
  const art = compileRuntimeIni(profile, [{ id: 'art', profile, order: 0, kind: 'base', sourceSha256: hash(''), bytes: bytes('') }]);
  const ai = compileRuntimeIni(profile, [{ id: 'ai', profile, order: 0, kind: 'base', sourceSha256: hash(aiText), bytes: bytes(aiText) }]);
  const definitions = compileEntityDefinitions({ objects: compileScenarioObjects({ profile, source, bytes: mapBytes }), rules, art });
  return { definitions, rules, ai, mission: { source, bytes: mapBytes } };
}

test('both profiles keep global/mission phases and first allocation source order, with native scalar defaults', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileTeamDefinitions(fixture({ profile }));
    assert.equal(isTeamDefinitions(r), true); assert.equal(isTeamDefinitions(structuredClone(r)), false);
    assert.deepEqual(r.phases.map(p => p.phase), ['global-team', 'mission-team', 'global-script', 'mission-script', 'global-taskforce', 'mission-taskforce']);
    assert.deepEqual(r.teams.map(t => [t.name, t.index]), [['Alpha', 0], ['Beta', 1]]);
    assert.equal(r.teams[0]!.fields.priority!.value, 11); assert.equal(r.teams[1]!.fields.priority!.value, 7);
    assert.equal(r.teams[0]!.fields.areTeamMembersRecruitable!.value, true); assert.equal(r.teams[0]!.fields.aggressive!.value, false);
    assert.equal(r.teams[0]!.fields.max!.value, -1); assert.equal(r.teams[0]!.fields.veteranLevel!.value, 1);
    assert.equal(r.teams[0]!.fields.mindControlDecision?.value, profile === 'yr' ? 0 : undefined);
    assert.equal(r.taskForces[0]!.allocation.reason, 'team-reference'); assert.equal(r.taskForces[0]!.loads[0]!.phase, 'global-taskforce');
    assert.equal(r.teams[0]!.owner.value!.houseId, 'houses:0'); assert.equal(r.teams[1]!.script.status, 'first-allocated');
    assert.equal(r.teams[0]!.waypoints[0]!.rowId, 'waypoints:26'); assert.equal(r.canStartCampaign, false);
  }
});
test('mission redeclaration rereads only its exact first spelling and retains missing/empty fields with histories', () => {
  const mapText = baseMap + '[TeamTypes]\n0=alpha\n[Alpha]\nPriority=\nMax=4\n[ScriptTypes]\n0=walk\n[Walk]\n5=5,3\n[TaskForces]\n0=force\n[Force]\n4=5,TANK\n';
  const r = compileTeamDefinitions(fixture({ mapText })), t = r.teams[0]!;
  assert.equal(t.name, 'Alpha'); assert.equal(t.isGlobal, false); assert.equal(t.fields.priority!.value, 11);
  assert.deepEqual(t.fields.priority!.history.map(o => [o.layerId, o.rawValue]), [['ai', '11'], ['map', '']]);
  assert.equal(t.fields.max!.value, 4); assert.equal(r.scripts[0]!.steps.length, 1); assert.equal(r.scripts[0]!.stepLoads.length, 2);
  assert.deepEqual(r.taskForces[0]!.members.map(m => [m.sourceSlot, m.runtimeIndex, m.quantity]), [[4, 0, 5]]);
  assert.equal(r.taskForces[0]!.memberLoads[0]!.members.length, 3);
  const wrongCase = compileTeamDefinitions(fixture({ mapText: mapText.replace('[Alpha]', '[alpha]') }));
  assert.equal(wrongCase.teams[0]!.fields.max!.value, -1); assert.equal(wrongCase.teams[0]!.loads.at(-1)!.nativeReturn, false);
});
test('implicit references do not load undeclared sections and TaskForce failure precedes Script fallback', () => {
  const aiText = '[TeamTypes]\n0=First\n1=Second\n[First]\nScript=Implicit\n[Second]\nTaskForce=Ghost\n[Implicit]\n0=5,1\n[Ghost]\n0=2,INF\n';
  const r = compileTeamDefinitions(fixture({ aiText }));
  assert.equal(r.teams[0]!.loads[0]!.nativeReturn, false); assert.equal(r.teams[0]!.taskForce.targetId, null);
  assert.equal(r.teams[1]!.script.targetId, 'script:implicit'); assert.equal(r.teams[1]!.script.status, 'first-allocated');
  assert.equal(r.scripts[0]!.loads.length, 0); assert.equal(r.scripts[0]!.steps.length, 0);
  assert.equal(r.taskForces[0]!.members.length, 0); assert.equal(r.taskForces[0]!.typed, false); assert.equal(r.teams[1]!.typed, false);
  assert.equal(r.coverage.nativeAllocationComplete, false);
});
test('TaskForce and Script literal numeric slots compact gaps, retain missing types and ignore non-native slot keys explicitly', () => {
  const aiText = global.replace('2=3,TANK', '2=3,Missing\n3=1,HQ').replace('5=1,AIR', '5=1,AIR\n6=9,TANK\n00=9,TANK');
  const r = compileTeamDefinitions(fixture({ aiText }));
  assert.deepEqual(r.taskForces[0]!.members.map(m => [m.sourceSlot, m.runtimeIndex, m.typeId]), [[0, 0, 'type:infantry:inf'], [2, null, null], [3, null, null], [5, 1, 'type:aircraft:air']]);
  assert.equal(r.taskForces[0]!.typed, false);
  assert.deepEqual(r.scripts[0]!.steps.map(s => [s.sourceSlot, s.runtimeIndex]), [[0, 0], [2, 1], [4, 2], [9, 3]]);
  assert.deepEqual(r.scripts[0]!.steps.map(s => s.operand.kind), ['waypoint', 'packed-cell-128', 'guard-duration', 'script-cursor']);
  assert.deepEqual([r.scripts[0]!.steps[1]!.operand.x, r.scripts[0]!.steps[1]!.operand.y], [2, 2]);
  assert.equal(r.scripts[0]!.steps[2]!.operand.ticks, 30); assert.equal(r.scripts[0]!.steps[3]!.operand.cursorBeforeAdvance, -1);
  assert.equal(r.scripts[0]!.steps[3]!.operand.targetRuntimeIndex, 0); assert.equal(r.scripts[0]!.executionReady, false);
  assert.ok(r.taskForces[0]!.unhandledFields.some(o => o.keySpelling === '00'));
});
test('country aliases choose the first matching house; literal house names are not team country references; YR selectors are explicit', () => {
  const a = compileTeamDefinitions(fixture({ aiText: global.replace('House=Azure', 'House=Player') }));
  assert.equal(a.teams[0]!.owner.value!.status, 'missing-house'); assert.equal(a.lateCountryAllocations[0]!.name, 'Player'); assert.equal(a.teams[0]!.owner.value!.houseId, null);
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileTeamDefinitions(fixture({ profile, aiText: global.replace('House=Azure', 'House=<Player @ H>') }));
    assert.equal(r.teams[0]!.owner.value!.specialSelector, profile === 'yr' ? 4482 : null);
    assert.equal(r.teams[0]!.owner.value!.status, profile === 'yr' ? 'special' : 'missing-house');
  }
});
test('nonempty absent country loads allocate once, while native random selectors do not allocate', () => {
  const r = compileTeamDefinitions(fixture({ aiText: global.replace('House=Azure', 'House=<none>').replace('House=Blue', 'House=<NONE>') }));
  assert.equal(r.lateCountryAllocations.length, 1); assert.equal(r.lateCountryAllocations[0]!.name, '<none>');
  assert.equal(r.teams[0]!.owner.value!.countryId, 'country:<none>'); assert.equal(r.teams[1]!.owner.value!.houseId, null);
  const random = compileTeamDefinitions(fixture({ aiText: global.replace('House=Azure', 'House=<RANDOM>') }));
  assert.equal(random.teams[0]!.owner.value!.specialSelector, -2); assert.equal(random.lateCountryAllocations.length, 0);
  assert.throws(() => compileTeamDefinitions(fixture({ aiText: global.replace('House=Azure', 'House=<none>') }), { lateCountries: 0 }), /late-country-limit/);
});
test('unknown opcode, malformed pairs, overflow, negative quantities and unsupported fields remain visible', () => {
  const r = compileTeamDefinitions(fixture({ aiText: global.replace('0=3,26', '0=999,123').replace('2=4,258', '2=5,').replace('4=5,2', '4=5,2147483647').replace('0=2,INF', '0=-2,INF').replace('Priority=11', 'Priority=11tail\nUnknownFlag=yes') }));
  assert.equal(r.teams[0]!.fields.priority!.status, 'unsupported'); assert.equal(r.teams[0]!.typed, false);
  assert.equal(r.taskForces[0]!.members[0]!.quantity, -2); assert.equal(r.taskForces[0]!.members[0]!.status, 'unsupported');
  assert.equal(r.scripts[0]!.steps[0]!.opcode, 999); assert.equal(r.scripts[0]!.steps[0]!.operand.value, 123);
  assert.equal(r.scripts[0]!.steps[1]!.argument, null); assert.equal(r.scripts[0]!.steps[2]!.operand.ticks, null);
  assert.equal(r.scripts[0]!.numericFramingComplete, false); assert.ok(r.teams[0]!.unhandledFields.some(o => o.keySpelling === 'UnknownFlag'));
});
test('repeated consumed sections/keys reject and prototype-looking unrelated names cannot change lookup', () => {
  for (const suffix of ['[Alpha]\nFoo=1\n', '[TeamTypes]\n8=Third\n']) assert.throws(() => compileTeamDefinitions(fixture({ aiText: global + suffix })), /duplicate-section/);
  assert.throws(() => compileTeamDefinitions(fixture({ aiText: global.replace('Priority=11', 'Priority=11\nPriority=12') })), /duplicate-key/);
  const r = compileTeamDefinitions(fixture({ aiText: global + '[constructor]\n__proto__=yes\n[__proto__]\nconstructor=yes\n' }));
  assert.deepEqual(r.teams.map(t => t.name), ['Alpha', 'Beta']);
  assert.throws(() => compileTeamDefinitions(fixture({ aiText: global.replace('9=Alpha', '9=' + 'A'.repeat(25)) })), /identifier/);
});
test('owned mission rehash, exact source join, entity brand and profile checks reject mismatches before compilation', () => {
  const f = fixture(); assert.throws(() => compileTeamDefinitions({ ...f, definitions: structuredClone(f.definitions) }), /entity-brand/);
  const bad = f.mission.bytes.slice(); bad[0] = bad[0]! ^ 1;
  assert.throws(() => compileTeamDefinitions({ ...f, mission: { ...f.mission, bytes: bad } }), /mission-hash/);
  assert.throws(() => compileTeamDefinitions({ ...f, ai: fixture({ profile: 'yr' }).ai }), /profile/);
  let invoked = false; const hostile = f.mission.bytes.slice(); Object.defineProperty(hostile, 'byteLength', { get() { invoked = true; return 1; } });
  assert.throws(() => compileTeamDefinitions({ ...f, mission: { ...f.mission, bytes: hostile } }), /mission-bytes/); assert.equal(invoked, false);
});
test('lower-only budgets cover declarations, fields, work, history, tokens, serialization and mission bytes', () => {
  const f = fixture();
  for (const key of ['definitions', 'declarations', 'fields', 'work', 'history', 'tokens', 'serializedBytes', 'missionBytes', 'occurrences'] as const) assert.throws(() => compileTeamDefinitions(f, { [key]: 0 }));
  assert.throws(() => compileTeamDefinitions(f, { definitions: TEAM_DEFINITIONS_LIMITS.definitions + 1 }), /limits/);
  assert.throws(() => compileTeamDefinitions(f, { tokens: -0 }), /limits/);
});
test('strength joins follow row identities across six-family construction ordering', () => {
  const r = compileTeamDefinitions(fixture({ mapText: baseMap + '[Infantry]\n2=Player,INF,64,2,2,2,Guard,0,None\n[Structures]\n0=Player,HQ,256,2,2,0,None\n' }));
  assert.equal(r.teams.length, 2);
});
test('owned frozen outputs and canonical source-aware fingerprints survive caller byte changes', () => {
  const f = fixture(), r = compileTeamDefinitions(f), fingerprint = r.fingerprint;
  f.mission.bytes.fill(0); assert.equal(r.fingerprint, fingerprint); assert.equal(Object.isFrozen(r.teams[0]!.fields), true);
  assert.throws(() => (r.teams[0]!.fields as Record<string, unknown>).priority = 2);
  assert.equal(compileTeamDefinitions(fixture()).fingerprint, fingerprint);
  assert.notEqual(compileTeamDefinitions(fixture({ aiText: global + '; original comment\n' })).fingerprint, fingerprint);
});
test('integer/waypoint and script arithmetic helpers preserve narrow signed units without native execution', () => {
  assert.equal(teamInteger('$FFFFFFFF'), -1); assert.equal(teamInteger('80000000h'), -2147483648); assert.equal(teamInteger('2147483648'), null);
  assert.equal(teamWaypoint('a'), 0); assert.equal(teamWaypoint('ZZ'), 701); assert.equal(teamWaypoint('AAA'), null);
  assert.equal(describeTeamScriptOperand(6, 9, 4).status, 'unsupported'); assert.equal(describeTeamScriptOperand(5, 2, 1).runtimeEffect, 'unimplemented');
});
