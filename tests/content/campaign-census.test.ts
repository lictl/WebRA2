// SPDX-License-Identifier: GPL-3.0-or-later
// Original temporary archives and mission-like text only; no retail content.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashMixName } from '../../packages/formats/src/mix-names.ts';
import { censusInstallation } from '../../tools/analysis/mix-census.ts';
import { campaignCensus } from '../../tools/analysis/campaign-census.ts';
import { syntheticCsf } from './fixtures.ts';

function archive(entries: Record<string, string | Uint8Array>): Buffer {
  const items = Object.entries(entries).map(([name, value]) => ({ name, bytes: typeof value === 'string' ? Buffer.from(value) : Buffer.from(value) }));
  const header = Buffer.alloc(6 + items.length * 12);
  header.writeUInt16LE(items.length); header.writeUInt32LE(items.reduce((n, item) => n + item.bytes.length, 0), 2);
  let offset = 0;
  items.forEach((item, index) => {
    const at = 6 + index * 12; header.writeUInt32LE(hashMixName(item.name), at); header.writeUInt32LE(offset, at + 4); header.writeUInt32LE(item.bytes.length, at + 8); offset += item.bytes.length;
  });
  return Buffer.concat([header, ...items.map(item => item.bytes)]);
}
const map = '[Basic]\nName=SECRET_FIXTURE_PAYLOAD\n[Map]\nTheater=fixture\n[Vehicle]\nStrength=250\n[Events]\nA=1,900,0,2\n';

test('campaign census verifies nested source ranges, resolves table names, deduplicates copies and retains variants', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-campaign-'));
  try {
    await writeFile(join(root, 'base.mix'), archive({ 'local.mix': archive({
      'battle.ini': '[Battles]\n0=A\n[A]\nScenario=all01t.map\nDescription=SECRET_FIXTURE_PAYLOAD\n',
      'mission.ini': '[all04dmd.map]\nUIName=SECRET_FIXTURE_PAYLOAD\n',
      'rules.ini': '[Vehicle]\nStrength=100\n', 'all01t.map': map, 'all04dmd.map': map + ';different variant identity\n',
    }), 'ra2.csf': syntheticCsf([{ label: 'fixture', value: 'SECRET_TRANSLATED_PAYLOAD' }]) }));
    await writeFile(join(root, 'copies.mix'), archive({ 'all01t.map': map }));
    await writeFile(join(root, 'patch.mix'), archive({ 'all01t.map': map.replace('Strength=250', 'Strength=300') }));
    const manifest = await censusInstallation(root);
    assert.equal(manifest.failures.length, 0);
    const result = await campaignCensus(root, manifest);
    assert.deepEqual(result.failures, []); assert.deepEqual(result.limitations, []);
    assert.equal(result.summary.physicalMapRecords, 4); assert.equal(result.summary.uniqueMapHashes, 3);
    assert.equal(result.missions.find(m => m.sources.length === 2)?.candidateNames[0], 'all01t.map');
    assert.equal(result.variants[0]!.effectiveWinner, null); assert.equal(result.variants[0]!.hashes.length, 2);
    assert.ok(result.missions.some(m => m.candidateNames.includes('all04dmd.map') && m.nameEvidence.some(e => e.source.includes('(section-name)'))));
    assert.ok(result.missions.some(m => m.ruleComparisons.some(c => c.sections.some(s => s.differentValueKeys === 1))));
    assert.equal(result.battleScenarios[0]!.matchingHashes.length, 2);
    assert.ok(result.missions.some(m => m.sources.some(s => s.path.includes('/#') && s.archiveSha256 && s.absoluteOffset > 0)));
    assert.equal(result.locales[0]!.verifiedPlayableLocale, null);
    assert.doesNotMatch(JSON.stringify(result), /SECRET_FIXTURE_PAYLOAD|SECRET_TRANSLATED_PAYLOAD|ownerLocale/);
    assert.deepEqual(await campaignCensus(root, manifest), result);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('named CSF/map candidates cannot silently fall back to unrelated text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-campaign-bad-'));
  try {
    await writeFile(join(root, 'bad.mix'), archive({ 'ra2.csf': '[Unexpected]\nValue=not-csf\n', 'all01t.map': '[Basic]\nValue=no-map-section\n' }));
    const result = await campaignCensus(root, await censusInstallation(root));
    assert.deepEqual(result.failures.map(f => f.code).sort(), ['named-csf-candidate-magic-mismatch', 'named-map-candidate-missing-structure']);
    assert.equal(result.missions.length, 0); assert.equal(result.locales.length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a filename discovered later still diagnoses a parsed non-map or an uninspected candidate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-campaign-late-'));
  try {
    await writeFile(join(root, 'late.mix'), archive({
      'unknown-map.map': '[Unexpected]\nValue=fixture\n',
      'uninspected.map': 'not an INI prefix',
      'mission.ini': '[unknown-map.map]\nUIName=fixture\n[uninspected.map]\nUIName=fixture\n',
    }));
    const result = await campaignCensus(root, await censusInstallation(root));
    assert.ok(result.failures.some(f => f.code === 'named-map-candidate-missing-structure'));
    assert.ok(result.limitations.some(l => l.code === 'late-named-format-candidate-not-inspected'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('changed source bytes and manifest traversal are rejected before trusting member ranges', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-campaign-stale-'));
  try {
    await writeFile(join(root, 'base.mix'), archive({ 'all01t.map': map }));
    const manifest = await censusInstallation(root);
    const original = manifest.archives[0]!.rootFile;
    manifest.archives[0]!.rootFile = '../escape.mix';
    await assert.rejects(campaignCensus(root, manifest), /filename/);
    manifest.archives[0]!.rootFile = original;
    await writeFile(join(root, 'base.mix'), archive({ 'all01t.map': map + ';changed\n' }));
    await assert.rejects(campaignCensus(root, manifest), /manifest mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing faction scenarios and an empty profile never produce a complete opcode union', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-campaign-missing-'));
  try {
    await writeFile(join(root, 'base.mix'), archive({ 'battle.ini': '[Battles]\n0=A\n[A]\nScenario=all02s.map\n' }));
    const result = await campaignCensus(root, await censusInstallation(root));
    const ra2 = result.campaignOpcodeUnion.find(row => row.profile === 'ra2')!;
    assert.deepEqual(ra2.missingFilenames, ['all02s.map']); assert.equal(ra2.framingComplete, false);
    const yr = result.campaignOpcodeUnion.find(row => row.profile === 'yr')!;
    assert.deepEqual(yr.filenames, []); assert.equal(yr.framingComplete, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
