// SPDX-License-Identifier: GPL-3.0-or-later
// Entirely original synthetic reference fixtures; no retail values or mission rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanIni } from '../../packages/content/src/ini.ts';
import { compileCampaignGraph, summarizeCampaignGraph, GRAPH_LIMITS, type GraphDocument, type GraphSource } from '../../packages/content/src/campaign-graph.ts';
import { censusCampaignTables } from '../../packages/content/src/campaign-tables.ts';
const parse = (s: string) => scanIni(new TextEncoder().encode(s));
function source(n: number): GraphSource { return { rootFile: `synthetic-${n}.mix`, rootSha256: String(n).padStart(64, '0'), absoluteOffset: 32, size: 500, sha256: String(n + 1).padStart(64, '0') }; }
function doc(text: string, role: GraphDocument['role'] = 'mission', n = 1): GraphDocument { return { profile: 'ra2', role, source: source(n), document: parse(text) }; }
const mission = `[Basic]\nPlayer=TEST_HOUSE\nIntro=SECRET_MOVIE\nNextScenario=legacy.map\n[Map]\n[Houses]\n0=TEST_HOUSE\n[TEST_HOUSE]\nCountry=TEST_COUNTRY\nAllies=TEST_HOUSE\n[TeamTypes]\n0=TEST_TEAM\n[TEST_TEAM]\nHouse=TEST_HOUSE\nTaskForce=TEST_FORCE\nScript=TEST_SCRIPT\nTag=TEST_TAG\n[TaskForces]\n0=TEST_FORCE\n[TEST_FORCE]\nName=SECRET_FORCE_NAME\n0=2,TEST_TYPE\n[ScriptTypes]\n0=TEST_SCRIPT\n[TEST_SCRIPT]\nName=SECRET_SCRIPT_NAME\n0=4,0\n[Tags]\nTEST_TAG=0,SECRET_TAG_NAME,TEST_TRIGGER\n[Triggers]\nTEST_TRIGGER=TEST_HOUSE,<none>,SECRET_TRIGGER_NAME,0,1,1,1\n[Events]\nTEST_TRIGGER=1,1,0,0\n[Actions]\nTEST_TRIGGER=1,2,0,0,0,0,0,0,0\n[Units]\n0=TEST_HOUSE,TEST_TYPE,256,0,0,0,Guard,TEST_TAG\n`;
const rules = `[Countries]\n0=TEST_COUNTRY\n[TEST_COUNTRY]\n[VehicleTypes]\n0=TEST_TYPE\n[TEST_TYPE]\nImage=TEST_ART\nPrimary=SECRET_WEAPON\n`;

test('structural references preserve source/line provenance, reach dependencies and omit original symbols', () => {
  const graph = compileCampaignGraph('ra2', [doc(mission), doc(rules, 'rules', 2), doc('[TEST_ART]\nImage=SECRET_SPRITE\n', 'art', 3)]);
  const kinds = new Set(graph.edges.map(e => e.relation));
  for (const relation of ['team-house', 'team-taskforce', 'team-script', 'team-tag', 'taskforce-type', 'type-image', 'placement-type', 'placement-tag', 'tag-trigger', 'trigger-events', 'trigger-actions']) assert.ok(kinds.has(relation), relation);
  assert.ok(graph.edges.every(e => e.at.line > 0 && graph.sources[e.at.source]));
  assert.equal(graph.diagnostics.filter(d => d.code === 'missing-reference').length, 0);
  assert.ok(graph.capabilities.includes('event:1')); assert.ok(graph.capabilities.includes('action:2')); assert.ok(graph.capabilities.includes('script:4'));
  assert.equal(graph.behaviorClosureComplete, false); assert.equal(graph.structuralClosureComplete, false);
  assert.ok(graph.diagnostics.some(d => d.code === 'legacy-progression-field-not-followed'));
  assert.ok(graph.diagnostics.some(d => d.relation === 'type-primary' && d.code === 'rule-reference-field-untraced'));
  assert.doesNotMatch(JSON.stringify(graph), /SECRET_|TEST_|legacy\.map/);
  assert.doesNotMatch(JSON.stringify(summarizeCampaignGraph(graph)), /SECRET_|TEST_|legacy\.map/);
});

test('input document permutation is deterministic and caller arrays are unchanged', () => {
  const inputs = [doc(mission), doc(rules, 'rules', 2)], before = JSON.stringify(inputs);
  assert.deepEqual(compileCampaignGraph('ra2', inputs), compileCampaignGraph('ra2', [...inputs].reverse()));
  assert.equal(JSON.stringify(inputs), before);
});

test('same-symbol rule variants and duplicate sections remain separate candidate nodes', () => {
  const graph = compileCampaignGraph('ra2', [doc(mission), doc(rules + '[TEST_TYPE]\nImage=OTHER\n', 'rules', 2), doc(rules, 'rules', 3)]);
  const typeEdges = graph.edges.filter(e => e.relation === 'taskforce-type');
  assert.equal(typeEdges.length, 3); assert.equal(new Set(typeEdges.map(e => e.to)).size, 3);
  assert.ok(graph.diagnostics.some(d => d.code === 'duplicate-section'));
  assert.ok(graph.diagnostics.some(d => d.code === 'multiple-candidate-definitions' && d.relation === 'taskforce-type'));
  assert.equal(graph.effectivePrecedence, 'unresolved');
});

test('missing section, row and object references are explicit, including empty mandatory fields', () => {
  const graph = compileCampaignGraph('ra2', [doc('[Basic]\nPlayer=\n[Map]\n[TeamTypes]\n0=MISSING\n[Triggers]\nT=H,<none>,name,0,1,1,1\n')]);
  assert.ok(graph.diagnostics.some(d => d.code === 'required-reference-empty'));
  for (const relation of ['declares-team', 'trigger-house', 'trigger-events', 'trigger-actions']) assert.ok(graph.diagnostics.some(d => d.code === 'missing-reference' && d.relation === relation));
  assert.ok(graph.nodes.some(n => n.kind === 'missing'));
});

test('self and multi-node cycles are diagnosed without calling them runtime errors', () => {
  const graph = compileCampaignGraph('ra2', [doc('[Basic]\n[Map]\n[Houses]\n0=A\n1=B\n[A]\nAllies=B\n[B]\nAllies=A\n')]);
  assert.equal(graph.cycles.length, 1); assert.equal(graph.cycles[0]!.length, 2);
  assert.ok(graph.diagnostics.some(d => d.code === 'structural-cycle-not-runtime-error'));
});

test('long dependency chains use bounded iterative traversal', () => {
  const count = 2200;
  const text = '[Basic]\n[Map]\n[Countries]\n' + Array.from({ length: count }, (_, i) => `${i}=C${i}\n`).join('') + Array.from({ length: count }, (_, i) => `[C${i}]\nParentCountry=C${(i + 1) % count}\n`).join('');
  assert.equal(compileCampaignGraph('ra2', [doc(text)]).cycles[0]!.length, count);
});

test('source duplicates, conflicting range identities, profile leaks and unsafe counters fail closed', () => {
  const first = doc('[Basic]\n[Map]\n');
  assert.throws(() => compileCampaignGraph('ra2', [first, { ...first, role: 'rules' }]), /graph-duplicate-source/);
  assert.throws(() => compileCampaignGraph('ra2', [first, { ...first, role: 'rules', source: { ...first.source, sha256: 'f'.repeat(64) } }]), /graph-conflicting-source/);
  assert.throws(() => compileCampaignGraph('yr', [first]), /graph-profile-or-role/);
  for (const bad of [{ absoluteOffset: -0 }, { size: Number.MAX_SAFE_INTEGER }, { rootFile: '../x' }, { sha256: 'bad' }]) assert.throws(() => compileCampaignGraph('ra2', [{ ...first, source: { ...first.source, ...bad } }]), /graph-source/);
  assert.throws(() => compileCampaignGraph('ra2', []), /one-mission/);
});

test('resource budgets fail closed and token framing cannot produce a silently complete graph', () => {
  const inputs = [doc(mission)];
  for (const limit of ['entries', 'codeUnits', 'nodes', 'edges', 'diagnostics'] as const) assert.throws(() => compileCampaignGraph('ra2', inputs, { ...GRAPH_LIMITS, [limit]: 1 }), /graph-.*limit/);
  assert.throws(() => compileCampaignGraph('ra2', inputs, { ...GRAPH_LIMITS, nodes: Number.NaN }), /invalid-limit/);
  const graph = compileCampaignGraph('ra2', [doc('[Basic]\n[Map]\n[Tags]\n0=' + 'x,'.repeat(256) + '\n[Units]\n0=too,short\n')]);
  assert.ok(graph.diagnostics.some(d => d.code === 'reference-token-limit')); assert.ok(graph.diagnostics.some(d => d.code === 'unsupported-reference-framing'));
});

test('empty or malformed mission structure and opcode framing do not pass closure', () => {
  const graph = compileCampaignGraph('ra2', [doc('[Events]\nT=1,1,2,0\n[Broken\nx=y\n')]);
  for (const code of ['ini-diagnostic', 'missing-mission-structure', 'opcode-framing-incomplete']) assert.ok(graph.diagnostics.some(d => d.code === code));
  assert.equal(graph.structuralClosureComplete, false);
});

test('campaign tables retain membership evidence, missing and variant hashes without invented progression', () => {
  const battle = { profile: 'ra2' as const, role: 'battle' as const, source: source(10), document: parse('[Battles]\n0=SECOND\n1=FIRST\n2=NO_SCENARIO\n[FIRST]\nScenario=first.map\n[SECOND]\nScenario=second.map\n') };
  const result = censusCampaignTables([battle], [{ profile: 'ra2', filename: 'first.map', sha256: 'a'.repeat(64) }, { profile: 'ra2', filename: 'first.map', sha256: 'b'.repeat(64) }]);
  assert.equal(result.nativeProgression, 'unverified'); assert.deepEqual(result.progressionEdges, []);
  assert.deepEqual(result.tables[0]!.references[0]!.membershipLines, [3]);
  assert.deepEqual(result.tables[0]!.diagnostics.map(d => d.code).sort(), ['listed-entry-has-no-scenario', 'missing-scenario-candidate', 'scenario-candidate-variants']);
  assert.equal(result.tableReferencesComplete, false);
  assert.doesNotMatch(JSON.stringify(result), /SECOND|FIRST|NO_SCENARIO/);
});

test('mission-table filename sections, duplicate table keys and cross-profile candidates stay explicit', () => {
  const table = { profile: 'yr' as const, role: 'mission-table' as const, source: source(11), document: parse('[first.map]\nUIName=SECRET_LABEL\nUIName=SECRET_OTHER\n') };
  const result = censusCampaignTables([table], [{ profile: 'ra2', filename: 'first.map', sha256: 'a'.repeat(64) }]);
  assert.equal(result.tables[0]!.references[0]!.hashes.length, 0);
  assert.ok(result.tables[0]!.diagnostics.some(d => d.code === 'duplicate-table-key'));
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  assert.equal(censusCampaignTables([], []).tableReferencesComplete, false);
  assert.throws(() => censusCampaignTables([table, table], []), { code: 'campaign-table-identity' });
});
