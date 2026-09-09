// SPDX-License-Identifier: MIT
// Public metadata consistency checks only; never opens game/ or private payloads.
import assert from 'node:assert/strict';
import { openSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';

function bytes(path) {
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(4 * 1024 * 1024 + 1); let length = 0;
    while (length < buffer.length) { const count = readSync(fd, buffer, length, buffer.length - length, length); if (!count) break; length += count; }
    assert.ok(length < buffer.length, `Metadata exceeds 4 MiB: ${path}`);
    return buffer.subarray(0, length);
  } finally { closeSync(fd); }
}
const hash = data => createHash('sha256').update(data).digest('hex');
const reference = JSON.parse(bytes('docs/analysis/m0-reference-profile.json'));
assert.equal(reference.schemaVersion, 1);
const inputs = new Map();
for (const [filename, expected] of Object.entries(reference.inputHashes)) {
  assert.match(filename, /^[a-z0-9-]+\.json$/);
  const input = bytes(`docs/analysis/${filename}`); assert.equal(hash(input), expected, `Stale evidence: ${filename}`);
  inputs.set(filename, JSON.parse(input));
}
const campaign = inputs.get('campaign-census.json'), native = inputs.get('native-profile-census.json');
const physical = inputs.get('mix-census.json'), dependencies = inputs.get('dependency-candidates.json'), locales = inputs.get('locale-dependencies.json');
const sourceKey = s => JSON.stringify([s.rootFile, s.rootSha256, s.absoluteOffset, s.size, s.sha256]);
const candidates = new Map();
function add(name, source) { const set = candidates.get(name) ?? new Set(); set.add(sourceKey(source)); candidates.set(name, set); }
for (const row of [...campaign.definitions, ...campaign.locales]) for (const name of row.candidateNames) add(name, row.source);
for (const row of campaign.missions) for (const name of row.candidateNames) for (const source of row.sources) add(name, source);
for (const row of native.tables) add(row.source.name, row.source);
for (const row of dependencies.discovered) add(row.filename, row.identity);
for (const row of locales.fonts) for (const name of row.candidateNames) add(name, row.source);
assert.deepEqual(reference.profiles.map(p => p.profile), ['ra2', 'yr']);
for (const profile of reference.profiles) {
  assert.equal(profile.fullRuntimeDependencyClosureVerified, false);
  assert.equal(profile.minimalAssetsOnlyManifestCertified, false);
  const groups = profile.requiredDefinitionGroups;
  assert.equal(groups.length, 10); assert.equal(new Set(groups.map(g => g.filename)).size, 10);
  for (const group of groups) {
    assert.ok(group.equivalentSourceChoices.length > 0);
    for (const source of [...group.equivalentSourceChoices, ...group.retainedAlternatives]) assert.ok(candidates.get(group.filename)?.has(sourceKey(source)), `Untraced source: ${group.filename}`);
    assert.ok(group.equivalentSourceChoices.every(s => s.sha256 === group.selectedContentSha256));
    if (group.retainedAlternatives.length) {
      assert.equal(profile.profile, 'yr'); assert.ok(['rulesmd.ini', 'soundmd.ini'].includes(group.filename));
      assert.ok(group.equivalentSourceChoices.every(s => s.rootFile === 'expandmd01.mix'));
      assert.ok(group.retainedAlternatives.every(s => s.sha256 !== group.selectedContentSha256));
    }
  }
  const fingerprint = [...groups].sort((a, b) => a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0).map(g => `${g.filename}\0${g.selectedContentSha256}`).join('\n');
  assert.equal(hash(fingerprint), profile.definitionSelectionFingerprintSha256);
}
assert.equal(reference.nativeExecutablesRequiredAtRuntime, false);
const roots = physical.archives.filter(a => a.path === a.rootFile && a.absoluteOffset === 0).map(a => ({ rootFile: a.rootFile, size: a.size, sha256: a.sha256 }));
assert.deepEqual(reference.conservativeDataArchiveSet.roots, roots);

const ledger = new TextDecoder('utf8', { fatal: true }).decode(bytes('docs/analysis/m0-campaign-ledger.md'));
const rows = [...ledger.matchAll(/^\| (ra2|yr) \| ([a-z0-9.]+\.map) \| ([a-f0-9]{64}) \| ([^|]+) \| (\d+) \/ (\d+) \/ (\d+) \|$/gm)];
const expectedCount = campaign.campaignOpcodeUnion.reduce((sum, row) => sum + row.filenames.length, 0);
assert.equal(rows.length, expectedCount); assert.equal(new Set(rows.map(row => `${row[1]}:${row[2]}`)).size, expectedCount);
for (const [, profile, filename, sha256, next, events, actions, scripts] of rows) {
  assert.ok(campaign.campaignOpcodeUnion.find(row => row.profile === profile).filenames.includes(filename));
  const mission = campaign.missions.find(row => row.sha256 === sha256 && row.candidateNames.includes(filename)); assert.ok(mission);
  const alternative = native.alternatives.find(row => row.filename === filename);
  if (alternative) assert.equal(sha256, alternative.proposedSelectedSource.sha256);
  assert.deepEqual([events, actions, scripts].map(Number), ['eventOpcodes', 'actionOpcodes', 'scriptOpcodes'].map(key => mission.census[key].length));
  const controls = native.missions.find(row => row.sha256 === sha256).controls;
  const table = native.tables.find(row => row.profile === profile), stages = table.stages.filter(stage => stage.scenario === filename);
  const targets = [...new Set(stages.flatMap(stage => table.edges.filter(edge => edge.from === stage.ordinal).flatMap(edge => edge.to.map(target => table.stages.find(stage => stage.ordinal === target).scenario))).filter(Boolean))].sort();
  assert.equal(next.trim(), controls.find(row => row.key === 'endofgame').value === true ? 'EndOfGame=yes' : targets.join(', '));
}
console.log(`M0 public evidence consistent: ${reference.profiles.length} profiles, ${roots.length} data roots, ${rows.length} campaign rows. No retail bytes read.`);
