// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic rules/art/audio only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanIni } from '../../packages/content/src/ini.ts';
import { compileDependencyCandidates, DEPENDENCY_LIMITS, type DependencyDocument, type FileCandidate } from '../../packages/content/src/dependency-candidates.ts';
import { createDependencyFileResolver } from '../../packages/content/src/dependency-inventory.ts';
import { readDependencyAudioIndex } from '../../packages/content/src/dependency-audio-index.ts';
import { hashMixName } from '../../packages/formats/src/mix-names.ts';
function doc(text: string, role: DependencyDocument['role'], id: number): DependencyDocument { return { profile: 'ra2', role, source: { rootFile: `original-${id}.mix`, rootSha256: id.toString(16).padStart(64, '0'), absoluteOffset: 0, size: 500, sha256: (id + 1).toString(16).padStart(64, '0') }, document: scanIni(new TextEncoder().encode(text)) }; }
const mission = doc('[Basic]\n[Map]\n[VehicleTypes]\n0=TEST_UNIT\n[TEST_UNIT]\nPrimary=TEST_WEAPON\nPrerequisite=POWER,TEST_FACTORY\nDeploysInto=TEST_FACTORY\nVoiceSelect=TEST_SOUND\n', 'mission', 1);
const rules = doc('[VehicleTypes]\n0=TEST_FACTORY\n[General]\nPrerequisitePower=TEST_FACTORY\n[TEST_FACTORY]\nUndeploysInto=TEST_UNIT\n[TEST_WEAPON]\nProjectile=TEST_SHOT\nWarhead=TEST_WARHEAD\n[TEST_SHOT]\nImage=TEST_PIXEL\nAirburstSpread=2\n[TEST_WARHEAD]\nAnimList=TEST_ANIM\n', 'rules', 2);
const art = doc('[TEST_UNIT]\nVoxel=yes\nCameo=TEST_ICON\nAltCameo=TEST_ALT\n[TEST_FACTORY]\n[TEST_PIXEL]\n[TEST_ANIM]\nNext=TEST_NEXT\n[TEST_NEXT]\nNext=TEST_ANIM\n', 'art', 3);
const sound = doc('[TEST_SOUND]\nSounds=testsample\n', 'sound', 4);
const match: FileCandidate = { rootFile: 'fixture.mix', rootSha256: 'a'.repeat(64), archivePath: 'fixture.mix', archiveSha256: 'a'.repeat(64), absoluteOffset: 24, size: 32, memberId: '00000001', ordinal: 0, hashKinds: ['crc32'] };

test('transitive chains, prerequisites, cycles, typed operands and image files are retained without payloads', () => {
  const graph = compileDependencyCandidates('ra2', [mission, rules, art, sound], () => [match]);
  for (const kind of ['type', 'weapon', 'projectile', 'warhead', 'animation', 'art', 'sound', 'audio-sample', 'file']) assert.ok(graph.nodes.some(n => n.kind === kind), kind);
  for (const field of ['primary', 'projectile', 'warhead', 'animlist', 'next', 'deploysinto', 'group-prerequisitepower', 'voiceselect']) assert.ok(graph.edges.some(e => e.field === field), field);
  assert.ok(graph.cycleBackEdges.length >= 2);
  assert.deepEqual([...new Set(graph.edges.map(e => e.requirement))].sort(), ['conditional', 'optional', 'required', 'unsupported']);
  assert.ok(graph.nodes.some(n => n.filename === 'test_unit.hva'));
  assert.equal(graph.nativeDependencyClosureComplete, false);
  assert.doesNotMatch(JSON.stringify(graph), /TEST_WEAPON|TEST_WARHEAD|TEST_FACTORY/);
});

test('all rule variants and repeated fields survive; input permutation does not change graph output', () => {
  const variant = doc('[TEST_WEAPON]\nProjectile=TEST_SHOT\nWarhead=OTHER\nWarhead=TEST_WARHEAD\n', 'rules', 5);
  const inputs = [mission, rules, art, variant];
  const graph = compileDependencyCandidates('ra2', inputs, () => []);
  assert.equal(graph.nodes.filter(n => n.kind === 'weapon').length, 2);
  assert.ok(graph.diagnostics.some(d => d.code === 'duplicate-field-preserved'));
  assert.deepEqual(compileDependencyCandidates('ra2', [...inputs].reverse(), () => []), graph);
});

test('prototype-shaped keys, malformed scalar/list operands and missing definitions remain explicit', () => {
  const bad = doc('[Basic]\n[Map]\n[VehicleTypes]\n0=U\n[U]\nconstructor=DO_NOT_FOLLOW\n__proto__=DO_NOT_FOLLOW\nPrimary=A,B\nExplosion=UNKNOWN,,OTHER\n', 'mission', 1);
  const graph = compileDependencyCandidates('ra2', [bad], () => []);
  assert.ok(graph.diagnostics.some(d => d.code === 'unsupported-scalar-list'));
  assert.ok(graph.diagnostics.some(d => d.code === 'empty-list-operand'));
  assert.ok(graph.diagnostics.some(d => d.code === 'missing-section-candidate'));
  assert.doesNotMatch(JSON.stringify(graph), /DO_NOT_FOLLOW|constructor|__proto__/);
});

test('node/edge/input/file budgets and profile/source identities fail closed', () => {
  for (const key of ['nodes', 'edges', 'entries', 'text', 'diagnostics', 'fileMatches'] as const) assert.throws(() => compileDependencyCandidates('ra2', [mission, rules, art], () => [match], { ...DEPENDENCY_LIMITS, [key]: 1 }), /limit/);
  assert.throws(() => compileDependencyCandidates('yr', [mission], () => []), /profile/);
  assert.throws(() => compileDependencyCandidates('ra2', [mission, mission], () => []), /duplicate-source/);
});

test('physical filename candidates preserve hashes and source ranges without selecting a winner', () => {
  const id = hashMixName('test.shp');
  const archive = (name: string) => ({ path: name, rootFile: name, absoluteOffset: 0, size: 100, sha256: 'a'.repeat(64), dataOffset: 20, dataSize: 80, members: [{ ordinal: 0, id, idHex: id.toString(16).padStart(8, '0'), offset: 5, size: 10 }] });
  const resolve = createDependencyFileResolver({ archives: [archive('a.mix'), archive('b.mix')] });
  assert.equal(resolve('test.shp').length, 2); assert.equal(resolve('test.shp')[0]!.absoluteOffset, 25);
  assert.equal(resolve('missing.shp').length, 0);
  assert.throws(() => resolve('../test.shp'), /unsafe/);
  const invalid = archive('a.mix'); invalid.members[0]!.size = 100;
  assert.throws(() => createDependencyFileResolver({ archives: [invalid] }), /member-identity/);
});

function audioIndex() {
  const bytes = new Uint8Array(12 + 36), view = new DataView(bytes.buffer);
  view.setUint32(0, 0x41424147, true); view.setUint32(4, 2, true); view.setUint32(8, 1, true);
  bytes.set(new TextEncoder().encode('fixture'), 12);
  [10, 100, 22050, 2, 0].forEach((n, i) => view.setUint32(28 + i * 4, n, true)); return bytes;
}
test('GABA index metadata uses exact framing, subarray offsets and original bounded samples', () => {
  const data = audioIndex(), padded = new Uint8Array(data.length + 7); padded.set(data, 7);
  assert.deepEqual(readDependencyAudioIndex(padded.subarray(7)), [{ ordinal: 0, name: 'fixture', offset: 10, size: 100, sampleRate: 22050, flags: 2, chunkSize: 0 }]);
  for (let i = 0; i < data.length; i++) assert.throws(() => readDependencyAudioIndex(data.subarray(0, i)));
  const version = data.slice(); version[4] = 3; assert.throws(() => readDependencyAudioIndex(version), /header/);
  const badName = data.slice(); badName.fill(65, 12, 28); assert.throws(() => readDependencyAudioIndex(badName), /name/);
});
