// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { profileCensus } from '../../tools/analysis/profile-census.ts';

const digest = (number: number) => number.toString(16).padStart(64, '0');
function fixture() {
  const definitions = [1, 2, 3].map(id => ({
    source: { path: `source${id}.mix/#0:12345678`, rootFile: `source${id}.mix`, rootSha256: digest(id + 100),
      archiveSha256: digest(id + 100), ordinal: 0, idHex: '12345678', absoluteOffset: 30, size: 10, sha256: digest(id) },
    candidateNames: [id === 1 ? 'rules.ini' : 'rulesmd.ini'], profileCandidates: [id === 1 ? 'ra2' : 'yr'],
  }));
  const archives = definitions.map(definition => ({ path: definition.source.rootFile, rootFile: definition.source.rootFile,
    sha256: definition.source.rootSha256, absoluteOffset: 0, dataOffset: 20, size: 100,
    members: [{ ordinal: 0, idHex: '12345678', offset: 10, size: 10 }] }));
  return { campaign: { schemaVersion: 1, definitions, locales: [], missions: [],
    campaignOpcodeUnion: [{ profile: 'ra2', filenames: ['first.map'] }, { profile: 'yr', filenames: ['firstmd.map'] }] },
  physical: { schemaVersion: 1, archives } };
}

test('projection keeps patch variants tied and reports missing requested identities and excluded profiles', () => {
  const { campaign, physical } = fixture();
  const result = profileCensus(campaign, physical);
  const ra2 = result.profiles[0]!;
  const yr = result.profiles[1]!;
  assert.equal(result.mountedCandidateSources, 3);
  assert.equal(ra2.entries[0]?.status, 'candidate');
  assert.equal(ra2.excludedSourceIds.length, 2);
  assert.equal(ra2.selectionCounts.missing, 6);
  assert.equal(yr.entries[0]?.status, 'ambiguous');
  assert.equal(yr.entries[0]?.content, null);
  assert.equal(yr.entries[0]?.alternatives.length, 2);
  assert.equal(yr.effectiveProfileVerified, false);
});

test('projection joins exact root/archive/member identities and rejects stale metadata', () => {
  for (const patch of [{ rootSha256: digest(999) }, { archiveSha256: digest(999) }, { absoluteOffset: 31 },
    { size: 11 }, { idHex: '87654321' }, { ordinal: 1 }, { rootFile: 'missing.mix' }, { path: 'missing.mix/#0:12345678' }]) {
    const { campaign, physical } = fixture();
    Object.assign(campaign.definitions[0]!.source, patch);
    assert.throws(() => profileCensus(campaign, physical), /Physical source metadata disagrees|Source absent/);
  }
  const { campaign, physical } = fixture();
  physical.archives[0]!.members.push({ ...physical.archives[0]!.members[0]! });
  assert.throws(() => profileCensus(campaign, physical), /Duplicate physical member ordinal/);
});

test('unnamed or unassigned sources remain explicit, and only selected metadata fields are emitted', () => {
  const { campaign, physical } = fixture();
  campaign.definitions[0]!.profileCandidates = [];
  campaign.definitions[1]!.candidateNames = [];
  Object.assign(campaign.definitions[2]!, { payload: 'synthetic sensitive text must not be copied' });
  const result = profileCensus(campaign, physical);
  assert.equal(result.unassigned.length, 2);
  assert.equal(result.mountedCandidateSources, 1);
  assert.ok(!JSON.stringify(result).includes('synthetic sensitive'));
  assert.throws(() => profileCensus({ ...campaign, schemaVersion: 2 }, physical), /Unsupported/);
});

test('permutation of input archives and definitions leaves report byte order unchanged', () => {
  const { campaign, physical } = fixture();
  const before = JSON.stringify(profileCensus(campaign, physical));
  campaign.definitions.reverse();
  physical.archives.reverse();
  assert.equal(JSON.stringify(profileCensus(campaign, physical)), before);
});

test('duplicate source IDs and conflicting mission deduplication hashes cannot be projected', () => {
  const { campaign, physical } = fixture();
  campaign.definitions.push(campaign.definitions[0]!);
  assert.throws(() => profileCensus(campaign, physical), /Duplicate campaign source/);
  campaign.definitions.pop();
  const source = campaign.definitions.pop()!.source;
  assert.throws(() => profileCensus({ ...campaign, missions: [{ sources: [source], sha256: digest(55) }] }, physical), /deduplication hash/);
});
