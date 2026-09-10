// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic declarations only; no installation assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamProgram } from '../../packages/sim/src/team-runtime-program.ts';
import { compileTeamSpawnCatalog } from '../../packages/sim/src/team-spawn-context.ts';
import { compileTeamRecruitmentCatalog } from '../../packages/sim/src/team-recruitment-catalog.ts';
import { compileMissionBindings, missionBindingSourceContext } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionTeamActionSource, isMissionTeamActionSource, missionTeamActionSourceContext, MISSION_TEAM_ACTION_LIMITS } from '../../packages/sim/src/mission-team-action-source.ts';

function fixture(options: Parameters<typeof teamSpawnFixture>[0] = {}, catalogs = true) {
  const f = teamSpawnFixture({ script: '0=3,0\n1=11,0', infantryRows:
    '0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1',
    extraMap: '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Events]\nStart=1,13,0,0\n[Actions]\nStart=3,4,1,Squad,0,0,0,0,A,7,1,Squad,0,0,0,0,A,80,1,Squad,0,0,0,0,A', ...options });
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const activation = compileTeamActivationSource({ teams: f.teams, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const program = f.compilation.program;
  const spawnInput = { program: program!, activation, definitions: f.definitions, traversal: f.traversal, actionIds: activation.plans.filter(a => a.opcode !== 4).map(a => a.id) };
  const recruitInput = { program: program!, activation, rules: f.rules, mission: f.mission, actionIds: activation.plans.filter(a => a.opcode === 4).map(a => a.id) };
  const spawnCatalogs = catalogs && program && spawnInput.actionIds.length ? [compileTeamSpawnCatalog(spawnInput)] : [];
  const recruitmentCatalogs = catalogs && program && recruitInput.actionIds.length ? [compileTeamRecruitmentCatalog(recruitInput)] : [];
  const input = { bindings, activation, programs: program ? [program] : [], spawnCatalogs, recruitmentCatalogs };
  return { ...f, bindings, activation, program, spawnInput, recruitInput, input };
}

test('both profiles authenticate every 4/7/80 occurrence and exact source context', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile }), s = compileMissionTeamActionSource(f.input);
    assert.deepEqual(s.diagnostics, []); assert.equal(s.wholeSourceReady, true); assert.equal(s.allActionsSupported, true);
    assert.deepEqual(s.actions.map(a => [a.instructionId, a.triggerId, a.rowId, a.ordinal, a.opcode]),
      [4, 7, 80].map((opcode, i) => [`action:actions:start:${i}`, 'trigger:start', 'actions:start', i, opcode]));
    for (const a of s.actions) { assert.deepEqual(a.parameters, ['1', 'Squad', '0', '0', '0', '0', 'A']); assert.equal(a.rawTokens.length, 8);
      assert.equal(a.teamId, 'team:squad'); assert.equal(a.candidates.length, 1); assert.equal(a.status, 'supported-source'); }
    assert.deepEqual(s.actions[0]!.plan.reasons, ['native-recruitment-unimplemented']); // preserved source evidence, narrowly closed by the catalog
    assert.deepEqual(s.diagnosticResolutions.map(d => [d.code, d.rule]), [['unsupported-script-operand', 'complete-program-script'], ['external-allocation-paths-unmodeled', 'literal-complete-declarations']]);
    assert.equal(s.sourceDiagnostics.definitions.length, 2); assert.equal(s.nativeAllocationComplete, false);
    assert.deepEqual(s.declarations.teams.map(d => d.id), ['team:squad']); assert.equal(s.declarations.teams[0]!.definition, f.teams.teams[0]);
    assert.equal(s.runtimeAuthority, false); assert.equal(s.nativeExecutionVerified, false); assert.equal(s.canStartCampaign, false);
    assert(isMissionTeamActionSource(s)); assert(!isMissionTeamActionSource({ ...s }));
    assert.throws(() => missionTeamActionSourceContext({ ...s }));
    const c = missionTeamActionSourceContext(s); assert.equal(c.world, f.world); assert.equal(c.bindings, f.bindings); assert.equal(c.activation, f.activation);
    assert.equal(c.programs[0], f.program); assert(Object.isFrozen(c.programs)); assert(Object.isFrozen(s.actions[0]!.rawTokens));
    assert.equal(compileMissionTeamActionSource(f.input).sha256, s.sha256);
  }
});

test('missing catalogs and unsupported operands remain explicit even with a genuine complete program', () => {
  const f = fixture(), s = compileMissionTeamActionSource({ ...f.input, spawnCatalogs: [], recruitmentCatalogs: [] });
  assert.equal(s.actions.length, 3); assert.equal(s.allActionsSupported, false); assert.equal(s.wholeSourceReady, false);
  assert(s.actions.every(a => a.reasons.includes('missing-family-catalog')));
  for (const name of ['1', '-1', 'Missing']) {
    const f = fixture({ extraMap: `[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Events]\nStart=1,13,0,0\n[Actions]\nStart=1,80,1,${name},0,0,0,0,A` }, false);
    const s = compileMissionTeamActionSource(f.input); assert.equal(s.actions.length, 1); assert.equal(s.actions[0]!.status, 'unsupported');
    assert.equal(s.actions[0]!.parameters[1], name); assert(s.actions[0]!.reasons.length > 1);
    assert.equal(s.diagnosticResolutions.find(d => d.code === 'external-allocation-paths-unmodeled')!.status, 'required');
  }
});

test('unreachable unknown script rows and every unrepresented global/mission declaration remain required', () => {
  const f = fixture({ script: '0=11,0\n1=999,1', extraMap:
    '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Events]\nStart=1,13,0,0\n[Actions]\nStart=1,7,1,Squad,0,0,0,0,A\n'+
    '[ScriptTypes]\n0=Unused\n[Unused]\n0=11,0\n1=888,0\nSurprise=1' }, false);
  assert.equal(f.program, null); const s = compileMissionTeamActionSource(f.input);
  assert.equal(s.wholeSourceReady, false); assert.equal(s.declarationsComplete, false);
  assert.deepEqual(s.declarations.scripts.map(d => d.id), ['script:route', 'script:unused']);
  assert(s.declarations.scripts.every(d => d.reasons.includes('unrepresented-script-row:1')));
  assert.equal(s.declarations.scripts[0]!.definition!.steps[1]!.opcode, 999);
  const local = missionBindingSourceContext(f.bindings).logic.scripts[0]!;
  assert.equal(s.declarations.scripts[1]!.mission, local); assert.equal(s.declarations.scripts[1]!.definition!.steps[1]!.opcode, 888);
  assert(s.sourceDiagnostics.logic.some(d => d.code === 'opaque-script-property'));
  assert(s.diagnostics.some(d => d.namespace === 'logic' && d.code === 'opaque-script-property'));
  assert(s.declarations.teams[0]!.reasons.includes('unrepresented-declaration'));
  assert(s.declarations.taskForces[0]!.reasons.includes('unrepresented-declaration'));
});

test('automatic and unknown fields cannot gain whole-source admission through a selected program', () => {
  for (const key of ['Autocreate', 'Prebuild', 'Recruiter']) {
    const f = fixture({ extraTeam: `Waypoint=A\n${key}=yes` }), s = compileMissionTeamActionSource(f.input);
    assert(f.program); assert.equal(s.allActionsSupported, true); assert.equal(s.wholeSourceReady, false);
    assert(s.declarations.teams[0]!.reasons.includes(`automatic-team-behavior:${key.toLowerCase()}`));
    assert.equal(s.diagnosticResolutions.find(d => d.code === 'external-allocation-paths-unmodeled')!.status, 'required');
  }
  const f = fixture({ extraTeam: 'Waypoint=A\nMysteryField=1' }), s = compileMissionTeamActionSource(f.input);
  assert.equal(s.wholeSourceReady, false); assert(s.declarations.teams[0]!.reasons.includes('unhandled-field:MysteryField'));
  assert(s.declarations.teams[0]!.definition!.unhandledFields.some(o => o.rawValue === '1'));
});

test('ambiguous catalogs retain all candidates; matching template unions are deterministic and never select a winner', () => {
  const f = fixture(), alternate = compileTeamSpawnCatalog(f.spawnInput, { retries: 1 });
  const programs = [f.program!, compileTeamProgram({ teams: f.teams, world: f.world, mission: f.mission, teamIds: ['team:squad'] }, { ticks: 1 }).program!];
  const input = { ...f.input, programs, spawnCatalogs: [...f.input.spawnCatalogs, alternate] }, s = compileMissionTeamActionSource(input);
  assert.equal(s.actions[0]!.status, 'supported-source'); assert.equal(s.actions[1]!.status, 'unsupported');
  assert.equal(s.actions[1]!.catalogSha256, null); assert.equal(s.actions[1]!.programSha256, null); assert.equal(s.actions[1]!.candidates.length, 2);
  assert(s.actions[1]!.reasons.includes('ambiguous-family-catalog'));
  assert.equal(compileMissionTeamActionSource({ ...input, programs: programs.reverse(), spawnCatalogs: input.spawnCatalogs.reverse() }).sha256, s.sha256);
  assert.equal(s.declarations.teams[0]!.programSha256s.length, 2);
});

test('catalog source failure is not confused with temporary recruitment shortage', () => {
  const f = fixture({ extraTeam: 'Waypoint=B', extraMap: '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Events]\nStart=1,13,0,0\n[Actions]\nStart=1,4,1,Squad,0,0,0,0,A' });
  const s = compileMissionTeamActionSource(f.input); assert.equal(s.actions[0]!.status, 'unsupported');
  assert(s.actions[0]!.reasons.includes('catalog:recruitment-anchor')); assert.equal(s.actions[0]!.candidates.length, 1);
  const shortage = fixture({ count: 2 }); assert.equal(compileMissionTeamActionSource(shortage.input).wholeSourceReady, true);
});

test('source impersonation, different genuine mission/world/rules pins and omitted program joins reject', () => {
  const f = fixture(), g = fixture({ speed: 129 });
  for (const key of ['bindings', 'activation'] as const) {
    assert.throws(() => compileMissionTeamActionSource({ ...f.input, [key]: { ...f.input[key] } }));
    assert.throws(() => compileMissionTeamActionSource({ ...f.input, [key]: g.input[key] }));
  }
  for (const key of ['programs', 'spawnCatalogs', 'recruitmentCatalogs'] as const) {
    assert.throws(() => compileMissionTeamActionSource({ ...f.input, [key]: [{ ...f.input[key][0] }] }));
    assert.throws(() => compileMissionTeamActionSource({ ...f.input, [key]: g.input[key] }));
    assert.throws(() => compileMissionTeamActionSource({ ...f.input, [key]: [...f.input[key], ...f.input[key]] }));
  }
  assert.throws(() => compileMissionTeamActionSource({ ...f.input, programs: [] }), /catalog-identity/);
});

test('input descriptor snapshots, dense array bounds and aggregate lower limits precede publication', () => {
  const f = fixture(), expected = compileMissionTeamActionSource(f.input).sha256;
  const noGet = { get() { throw new Error('unexpected-property-read'); } };
  assert.equal(compileMissionTeamActionSource(new Proxy({ ...f.input, programs: new Proxy([...f.input.programs], noGet) }, noGet)).sha256, expected);
  let calls = 0; const accessor = { ...f.input }; Object.defineProperty(accessor, 'programs', { enumerable: true, get() { calls++; return f.input.programs; } });
  assert.throws(() => compileMissionTeamActionSource(accessor)); assert.equal(calls, 0);
  for (const list of [new Array(2), Object.assign([...f.input.programs], { extra: 1 }), new Proxy(new Array(257).fill(f.program), { get(t, key) { return key === 'length' ? 1 : Reflect.get(t, key); } })])
    assert.throws(() => compileMissionTeamActionSource({ ...f.input, programs: list }));
  for (const key of Object.keys(MISSION_TEAM_ACTION_LIMITS)) {
    if (key === 'diagnostics') assert.throws(() => compileMissionTeamActionSource({ ...f.input, spawnCatalogs: [] }, { diagnostics: 0 }));
    else assert.throws(() => compileMissionTeamActionSource(f.input, { [key]: 0 }));
    assert.throws(() => compileMissionTeamActionSource(f.input, { [key]: -1 }));
  }
  assert.throws(() => compileMissionTeamActionSource(f.input, { catalogs: 1 }));
  const owned = compileMissionTeamActionSource(f.input); f.input.programs.length = 0;
  assert.equal(missionTeamActionSourceContext(owned).programs.length, 1);
});

test('diagnostic resolutions are narrow, source indexed and never erase unrelated unknowns', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, script: '0=3,0\n1=11,0\nName=Original display name' }), s = compileMissionTeamActionSource(f.input);
    // A complete program proves the operand even though the name's native use is outside this component.
    assert(f.program); assert(s.diagnosticResolutions.some(d => d.code === 'unsupported-script-operand' && d.rule === 'complete-program-script'));
    assert(s.diagnostics.some(d => d.code === 'unhandled-field:Name')); assert.equal(s.wholeSourceReady, false);
    for (const r of s.diagnosticResolutions) {
      assert.equal(r.subjectId, s.sourceDiagnostics.definitions[r.sourceIndex]!.subjectId);
      assert.equal(r.code, s.sourceDiagnostics.definitions[r.sourceIndex]!.code);
      if (r.status === 'required') assert(s.diagnostics.some(d => d.namespace === 'definitions' && d.code === r.code && d.subjectId === r.subjectId));
    }
    const unavailable = fixture({ profile, extraTeam: 'Waypoint=A\nPriority=uncertain' }, false), u = compileMissionTeamActionSource(unavailable.input);
    assert.equal(u.wholeSourceReady, false); assert(u.diagnosticResolutions.every(r => r.status === 'required'));
    assert(u.sourceDiagnostics.definitions.some(d => d.code !== 'external-allocation-paths-unmodeled' && d.code !== 'unsupported-script-operand'));
  }
});

test('a later complete script cannot erase a diagnostic for an earlier different source row', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, script: '0=999,1', extraMap:
      '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Events]\nStart=1,13,0,0\n[Actions]\nStart=1,80,1,Squad,0,0,0,0,A\n'+
      '[ScriptTypes]\n0=Route\n[Route]\n0=11,0' });
    assert(f.program); const s = compileMissionTeamActionSource(f.input), script = s.declarations.scripts.find(d => d.id === 'script:route')!;
    assert.equal(script.definition!.steps[0]!.opcode, 11); assert.equal(script.definition!.stepLoads[0]!.steps[0]!.opcode, 999);
    const rows = s.diagnosticResolutions.filter(d => d.code === 'unsupported-script-operand');
    assert.deepEqual(rows.map(d => d.status), ['required', 'resolved']); assert.equal(s.wholeSourceReady, false);
    assert.equal(s.sourceDiagnostics.definitions[rows[0]!.sourceIndex]!.origin!.layerId, 'ai');
  }
});
