// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature source fixtures; no installation data.
import test from 'node:test';
import { createHash } from 'node:crypto';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { compileTeamDefinitions } from '../../packages/content/src/team-definitions.ts';
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionTeamActionSource } from '../../packages/sim/src/mission-team-action-source.ts';
import { compileMissionTeamAllocationSource, isMissionTeamAllocationSource, missionTeamAllocationSourceActions,
  MISSION_TEAM_ALLOCATION_LIMITS } from '../../packages/sim/src/mission-team-allocation-source.ts';

const aiRow = (team1: string, team2 = '<none>', skirmish = '1', difficulties = '1,1,1') =>
  `Original AI label,${team1},<all>,0,-1,<none>,${'0'.repeat(64)},1,0,1,${skirmish},0,0,0,${team2},${difficulties}`;
function fixture(options: Parameters<typeof teamSpawnFixture>[0] = {}) {
  const f = teamSpawnFixture({ script: '0=11,0', extraMap: '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Events]\nStart=1,13,0,0\n[Actions]\nStart=1,4,1,Squad,0,0,0,0,A', ...options });
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const activation = compileTeamActivationSource({ teams: f.teams, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const source = compileMissionTeamActionSource({ bindings, activation, programs: f.compilation.program ? [f.compilation.program] : [], spawnCatalogs: [], recruitmentCatalogs: [] });
  return { ...f, source, input: { source, rules: f.rules, ai: f.ai, mission: f.mission, initialization: 'fresh-campaign' as const } };
}

test('all three native Name histories retain defaults and exact source overrides without changing the legacy catalog', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, extraTeam: 'Name=Initial name\nWaypoint=A', script: 'Name=Route display\n0=11,0',
      extraMap: '[TeamTypes]\n7=Squad\n[Squad]\nName=Mission name\n[ScriptTypes]\n4=Route\n[Route]\n0=11,0' });
    const before = JSON.stringify(f.source), r = compileMissionTeamAllocationSource(f.input);
    assert(isMissionTeamAllocationSource(r)); assert(!isMissionTeamAllocationSource({ ...r }));
    assert.equal(missionTeamAllocationSourceActions(r), f.source); assert.throws(() => missionTeamAllocationSourceActions({ ...r }));
    assert.equal(JSON.stringify(f.source), before); assert.equal(r.sourceSha256, f.source.sha256);
    const names = new Map(r.declarations.map(d => [d.id, d.nativeName]));
    assert.deepEqual(names.get('team:squad')!.loads.map(l => [l.before, l.after, l.status]), [['Squad', 'Initial name', 'explicit'], ['Initial name', 'Mission name', 'explicit']]);
    assert.equal(names.get('script:route')!.value, 'Route display'); assert.equal(names.get('script:route')!.loads[1]!.status, 'retained');
    assert.equal(names.get('taskforce:troop')!.value, 'Troop'); assert.equal(r.retainedDeclarations, f.source.declarations);
    assert(r.diagnosticResolutions.some(d => d.rule === 'native-name-load-history'));
    for (const d of r.diagnosticResolutions) { assert.deepEqual([d.namespace, d.subjectId, d.code], [f.source.diagnostics[d.sourceDiagnosticIndex]!.namespace, f.source.diagnostics[d.sourceDiagnosticIndex]!.subjectId, f.source.diagnostics[d.sourceDiagnosticIndex]!.code]);
      if (d.status === 'resolved-source-field') { assert.equal(d.code, 'unhandled-field:Name'); assert(d.origins.every(o => o.keySpelling === 'Name')); } }
    assert.equal(r.runtimeAuthority, false); assert.equal(r.nativeAllocationComplete, false); assert.equal(r.canStartCampaign, false);
    assert.equal(r.authentication.upstreamRulesAIBytesRequired, true); assert(Object.isFrozen(r.tables.ai));
    assert.equal(compileMissionTeamAllocationSource(f.input).sha256, r.sha256);
  }
});

test('AI aliases use final Name and per-allocation ID then Name order, not a global ID-first pass', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, extraTeam: 'Name=Old name\nWaypoint=A', extraTeamTypes: '8=Later',
      extraAI: `[Later]\nHouse=Blue\nTaskForce=Troop\nScript=Route\n[AITriggerTypes]\nOriginal=${aiRow('later', 'Old name')}`,
      extraMap: '[TeamTypes]\n2=Squad\n[Squad]\nName=Later' });
    const r = compileMissionTeamAllocationSource(f.input), refs = r.references;
    assert.deepEqual(refs[0]!.matches.map(x => [x.teamId, x.matchedBy]), [['team:squad', 'name'], ['team:later', 'id']]);
    assert.equal(refs[0]!.targetId, 'team:squad'); assert.equal(refs[1]!.status, 'missing');
    assert.equal(r.aiTriggers[0]!.loads[0]!.phase, 'global-ai'); assert.equal(r.aiTriggers[0]!.loads[0]!.isForSkirmish, true);
    assert(r.diagnostics.some(d => d.code === 'missing-team-reference'));
  }
});

test('campaign guards retain global/mission AI loads and separate initial exclusion from future allocation', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, extraAI: `[AITriggerTypes]\nDisabled=${aiRow('Squad')}\nOverride=${aiRow('Squad', '<none>', '0')}`,
      extraMap: `[AITriggerTypes]\nOverride=${aiRow('Squad')}\n[AITriggerTypesEnable]\nDisabled=no\nOverride=yes` });
    const r = compileMissionTeamAllocationSource(f.input);
    assert.equal(r.aiTriggers[0]!.initialEnabled, false); assert.equal(r.aiTriggers[0]!.initialCondition, 'proven-excluded');
    assert.equal(r.aiTriggers[1]!.initialEnabled, true); assert.equal(r.aiTriggers[1]!.initialCondition, 'conditional');
    assert.deepEqual(r.aiTriggers[1]!.loads.map(l => [l.phase,l.isGlobal,l.isForSkirmish]), [['global-ai',true,false],['mission-ai',false,true]]);
    assert(r.roots.find(x => x.kind === 'ai-trigger')!.reasons.includes('house-ai-scheduling-and-future-transitions-required'));
    assert(r.roots.some(x => x.kind === 'native-unmodeled' && x.status === 'required'));
    assert.equal(r.aiTriggers[1]!.allocationIndex, 1);
  }
});

test('missing default houses and unreferenced automatic templates remain dependencies; script18 retains physical-index replacement', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, extraMap: '[Countries]\n2=Absent', extraTeamTypes: '1=Automatic',
      extraAI: `[Automatic]\nHouse=Absent\nTaskForce=Troop\nScript=Route\nAutocreate=yes\nRecruiter=yes\n[AITriggerTypes]\nAuto=${aiRow('Automatic')}`,
      script: '0=18,1\n1=11,0' });
    const r = compileMissionTeamAllocationSource(f.input), d = r.declarations.find(d => d.id === 'team:automatic')!;
    assert.equal(d.defaultHouseAvailable, false); assert.equal(d.owner!.value!.status, 'missing-house'); assert.equal(d.reachability, 'required');
    assert.deepEqual(r.roots.find(r => r.kind === 'script-18')!.teamIds, ['team:automatic']);
    assert.equal(r.roots.find(r => r.kind === 'ai-trigger')!.owner, 'caller-house-overrides-template');
    assert(r.roots.find(r => r.kind === 'automatic-template')!.reasons.includes('automatic-team-behavior:recruiter'));
    assert(r.diagnosticResolutions.some(d => d.status === 'required' && d.code.includes('automatic-team')));
  }
});

test('unsupported Name histories and source values never resolve metadata or silently choose aliases', () => {
  for (const profile of ['ra2', 'yr'] as const) for (const name of ['', 'x'.repeat(49), 'Native;unknown suffix', '超']) {
    const f = fixture({ profile, extraTeam: `Name=${name}\nWaypoint=A`, extraAI: `[AITriggerTypes]\nA=${aiRow('Squad')}` });
    const r = compileMissionTeamAllocationSource(f.input);
    assert.equal(r.declarations[0]!.nativeName.status, 'unsupported'); assert.equal(r.references[0]!.status, 'unsupported');
    assert(r.diagnosticResolutions.filter(d => d.subjectId === 'team:squad' && d.code === 'unhandled-field:Name').every(d => d.status === 'required'));
  }
  const f = fixture({ extraAI: `[AITriggerTypes]\nA=${aiRow('Squad').replace(',1,1,1', ',bad,1,1')}\n[AITriggerTypesEnable]\nIgnored=yes`, extraMap: '[AITriggerTypesEnable]\nUnknown=yes' });
  const r = compileMissionTeamAllocationSource(f.input); assert(r.diagnostics.some(d => d.code === 'missing-enabled-ai-trigger'));
});

test('factory, profile, bytes, table pins, descriptor ownership and lowered limits fail deterministically', () => {
  const f = fixture(), compile = (v: unknown, options = {}) => compileMissionTeamAllocationSource(v as typeof f.input, options);
  assert.throws(() => compile({ ...f.input, source: { ...f.source } }), /factory/);
  assert.throws(() => compile({ ...f.input, initialization: 'restored-campaign' }), /initialization/);
  assert.throws(() => compile({ ...f.input, mission: { ...f.mission, bytes: f.mission.bytes.slice(1) } }), /mission-hash/);
  assert.throws(() => compile({ ...f.input, ai: { ...f.ai, profile: 'yr' } }), /profile/);
  const wrong = JSON.parse(JSON.stringify(f.ai).replaceAll(f.ai.layers[0]!.sourceSha256, 'f'.repeat(64))) as typeof f.ai;
  assert.throws(() => compile({ ...f.input, ai: wrong }), /source-pins/);
  let reads=0;
  const wrapped = new Proxy(f.input, {get(){reads++;throw Error('get');}}), table = new Proxy(f.ai, {get(){reads++;throw Error('get');}});
  assert.equal(compile(wrapped).sha256, compile(f.input).sha256);
  assert.equal(compile({ ...f.input, ai:table }).sha256, compile(f.input).sha256); assert.equal(reads,0);
  const getter={...f.ai};Object.defineProperty(getter,'entries',{enumerable:true,get(){reads++;return[];}});
  assert.throws(() => compile({...f.input,ai:getter}),/descriptor/);assert.equal(reads,0);
  const old=compile(f.input), copied=structuredClone(f.ai), owned=compile({...f.input,ai:copied});
  (copied.entries as unknown[]).length=0; assert.equal(owned.sha256,old.sha256);
  for(const key of ['missionBytes','stages','occurrences','declarations','roots','history','work','nodes','characters','serializedBytes'] as const)
    assert.throws(()=>compile(f.input,{[key]:0}),key);
  assert.throws(()=>compile(f.input,{work:MISSION_TEAM_ALLOCATION_LIMITS.work+1}),/limits/);
});

test('fresh mission-only AI defaults disabled; campaign difficulty is distinct from the skirmish flag', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, extraMap: `[AITriggerTypes]\nLocal=${aiRow('Squad')}\nDifficulty=${aiRow('Squad','<none>','1','1,0,1')}\n[AITriggerTypesEnable]\nDifficulty=yes` });
    const r = compileMissionTeamAllocationSource(f.input);
    assert.equal(r.aiTriggers[0]!.initialEnabled,false); assert(r.aiTriggers[0]!.reasons.includes('initial-disabled-ai-trigger'));
    assert.equal(r.aiTriggers[1]!.initialEnabled,true); assert(r.aiTriggers[1]!.reasons.includes('initial-campaign-difficulty-disabled'));
    assert(r.roots.filter(x=>x.kind==='ai-trigger').every(x=>x.status==='proven-excluded-initial'));
    assert(r.roots.some(x=>x.kind==='native-unmodeled' && x.status==='required'));
  }
});

test('exact key repeats, reload spelling, native token truncation, and aggregate fanout remain bounded', () => {
  const f=fixture({extraAI:`[AITriggerTypes]\nA=${aiRow('Squad')}\nA=${aiRow('Squad')}`});
  assert.throws(()=>compileMissionTeamAllocationSource(f.input),/duplicate-consumed-key/);
  const g=fixture({extraAI:`[AITriggerTypes]\nA=${aiRow('Squad')}`,extraMap:`[AITriggerTypes]\na=${aiRow('Squad')}`});
  assert(compileMissionTeamAllocationSource(g.input).aiTriggers[0]!.loads[1]!.reasons.includes('ai-reload-key-spelling'));
  const h=fixture({extraAI:`[AITriggerTypes]\nA=${aiRow('S'.repeat(24))}`});
  assert.equal(compileMissionTeamAllocationSource(h.input).references[0]!.status,'unsupported');
  for(const options of [{references:1},{tokens:17},{roots:0},{history:0},{diagnostics:0}])
    assert.throws(()=>compileMissionTeamAllocationSource(h.input,options));
});


test('independent rules and AI tables may reuse a layer ID without crossing source namespaces', () => {
  for(const profile of ['ra2','yr'] as const){
    const f=fixture({profile});
    const bytes=new TextEncoder().encode('[TeamTypes]\n0=Squad\n[Squad]\nName=Separate source\nHouse=Blue\nScript=Route\nTaskForce=Troop\n[ScriptTypes]\n0=Route\n[Route]\n0=11,0\n[TaskForces]\n0=Troop\n[Troop]\n0=1,Walker');
    const ai=compileRuntimeIni(profile,[{id:'base',profile,kind:'base',order:0,sourceSha256:createHash('sha256').update(bytes).digest('hex'),bytes}]);
    const teams=compileTeamDefinitions({definitions:f.definitions,rules:f.rules,ai,mission:f.mission});
    const activation=compileTeamActivationSource({teams,definitions:f.definitions,rules:f.rules,mission:f.mission});
    const bindings=compileMissionBindings({world:f.world,definitions:f.definitions,rules:f.rules,mission:f.mission,difficulty:1});
    const source=compileMissionTeamActionSource({bindings,activation,programs:[],spawnCatalogs:[],recruitmentCatalogs:[]});
    const out=compileMissionTeamAllocationSource({...f.input,source,ai});
    assert.equal(out.declarations[0]!.nativeName.value,'Separate source');
    assert.equal(out.declarations[0]!.nativeName.loads[0]!.origin!.sourceSha256,ai.layers[0]!.sourceSha256);
    assert.notEqual(ai.layers[0]!.sourceSha256,f.rules.layers[0]!.sourceSha256);
  }
});

test('one aggregate work cap reserves all three nested views before outer joins', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile }), baseline = compileMissionTeamAllocationSource(f.input);
    // This original fixture previously accepted807 outer units despite496 more
    // nested units. Its largest view needs236 units, so eight reserved shares
    // require1888; at1887 each view receives only235. Rejection has no cache effect.
    assert.throws(() => compileMissionTeamAllocationSource(f.input, { work: 807 }), /work-limit/);
    assert.throws(() => compileMissionTeamAllocationSource(f.input, { work: 1887 }), /work-limit/);
    assert.equal(compileMissionTeamAllocationSource(f.input, { work: 1888 }).sha256, baseline.sha256);
    assert.equal(compileMissionTeamAllocationSource(f.input).sha256, baseline.sha256);
  }
});
