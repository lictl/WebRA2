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
assert.deepEqual(Object.keys(reference.inputHashes).sort(), ['campaign-census.json', 'dependency-candidates.json', 'locale-dependencies.json', 'locale-font-sources.json', 'mix-census.json', 'native-profile-census.json']);
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
function add(name, source) { const sources = candidates.get(name) ?? new Map(); sources.set(sourceKey(source), source); candidates.set(name, sources); }
for (const row of [...campaign.definitions, ...campaign.locales]) for (const name of row.candidateNames) add(name, row.source);
for (const row of campaign.missions) for (const name of row.candidateNames) for (const source of row.sources) add(name, source);
for (const row of native.tables) add(row.source.name, row.source);
for (const row of dependencies.discovered) add(row.filename, row.identity);
for (const row of locales.fonts) for (const name of row.candidateNames) add(name, row.source);
// These are the accepted installation-specific selections, not a generic mount policy.
const expectedProfiles = {
  ra2: { opening: 'all01t.map', names: ['ai.ini', 'all01t.map', 'art.ini', 'battle.ini', 'game.fnt', 'mapsel.ini', 'mission.ini', 'ra2.csf', 'rules.ini', 'sound.ini'] },
  yr: { opening: 'all01umd.map', names: ['aimd.ini', 'all01umd.map', 'artmd.ini', 'battlemd.ini', 'game.fnt', 'mapselmd.ini', 'missionmd.ini', 'ra2md.csf', 'rulesmd.ini', 'soundmd.ini'] }
};
assert.deepEqual(reference.profiles.map(p => p.profile), ['ra2', 'yr']);
for (const profile of reference.profiles) {
  assert.equal(profile.fullRuntimeDependencyClosureVerified, false);
  assert.equal(profile.minimalAssetsOnlyManifestCertified, false);
  assert.equal(profile.opening, expectedProfiles[profile.profile].opening, 'Wrong opening');
  const groups = profile.requiredDefinitionGroups;
  assert.deepEqual(groups.map(g => g.filename).sort(), expectedProfiles[profile.profile].names, 'Wrong profile definitions');
  for (const group of groups) {
    const observed = [...candidates.get(group.filename).values()];
    let selectedHash;
    if (group.filename === 'rulesmd.ini') {
      selectedHash = native.alternatives.find(row => row.filename === group.filename).proposedSelectedSource.sha256;
    } else if (group.filename === 'soundmd.ini') {
      // ADR 0002 applies the inspected expansion-before-base policy to soundmd too.
      const patches = observed.filter(source => source.rootFile === 'expandmd01.mix');
      assert.equal(patches.length, 1, 'Ambiguous SOUNDMD patch'); selectedHash = patches[0].sha256;
    } else {
      const hashes = [...new Set(observed.map(source => source.sha256))];
      assert.equal(hashes.length, 1, `New unresolved alternatives: ${group.filename}`); selectedHash = hashes[0];
    }
    assert.equal(group.selectedContentSha256, selectedHash, `Wrong selected content: ${group.filename}`);
    assert.deepEqual(group.equivalentSourceChoices.map(sourceKey).sort(), observed.filter(s => s.sha256 === selectedHash).map(sourceKey).sort(), `Incomplete equivalent sources: ${group.filename}`);
    assert.deepEqual(group.retainedAlternatives.map(sourceKey).sort(), observed.filter(s => s.sha256 !== selectedHash).map(sourceKey).sort(), `Incomplete alternatives: ${group.filename}`);
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
