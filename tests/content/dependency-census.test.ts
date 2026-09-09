// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic installation fixture; no game assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashMixName } from '../../packages/formats/src/mix-names.ts';
import { censusInstallation } from '../../tools/analysis/mix-census.ts';
import { campaignCensus } from '../../tools/analysis/campaign-census.ts';
import { dependencyCensus } from '../../tools/analysis/dependency-census.ts';
function archive(records: Record<string, string | Uint8Array>) {
  const entries = Object.entries(records).map(([name, bytes]) => ({ name, bytes: Buffer.from(bytes) }));
  const header = Buffer.alloc(6 + entries.length * 12); header.writeUInt16LE(entries.length); header.writeUInt32LE(entries.reduce((n, e) => n + e.bytes.length, 0), 2);
  let offset = 0;
  for (const [i, e] of entries.entries()) { header.writeUInt32LE(hashMixName(e.name), 6 + i * 12); header.writeUInt32LE(offset, 10 + i * 12); header.writeUInt32LE(e.bytes.length, 14 + i * 12); offset += e.bytes.length; }
  return Buffer.concat([header, ...entries.map(e => e.bytes)]);
}
function corpus(outOfRange = false) {
  const idx = Buffer.alloc(48); idx.write('GABA'); idx.writeUInt32LE(2, 4); idx.writeUInt32LE(1, 8); idx.write('testsample', 12);
  idx.writeUInt32LE(outOfRange ? 100 : 4, 28); idx.writeUInt32LE(8, 32); idx.writeUInt32LE(22050, 36); idx.writeUInt32LE(12, 40);
  return archive({
    'all01t.map': '[Basic]\nName=SECRET_MISSION_TEXT\n[Map]\nTheater=URBAN\n[VehicleTypes]\n0=TEST_UNIT\n[TEST_UNIT]\nPrimary=TEST_WEAPON\nVoiceSelect=TEST_SOUND\n',
    'rules.ini': '[TEST_WEAPON]\nProjectile=TEST_PROJECTILE\nWarhead=TEST_WARHEAD\n[TEST_PROJECTILE]\nImage=TEST_PIXEL\n[TEST_WARHEAD]\n',
    'ai.ini': '[Empty]\n', 'art.ini': '[TEST_UNIT]\n[TEST_PIXEL]\n',
    'sound.ini': '[TEST_SOUND]\nName=SECRET_SOUND_DISPLAY_NAME\nSounds=$testsample\n',
    'audio.idx': idx, 'audio.bag': new Uint8Array(32), 'test_unit.shp': new Uint8Array(8),
  });
}
test('private-input adapter verifies newly discovered sound/index ranges and emits actionable metadata only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-dependencies-'));
  try {
    await writeFile(join(root, 'fixture.mix'), corpus());
    const physical = await censusInstallation(root), campaign = await campaignCensus(root, physical);
    const result = await dependencyCensus(root, campaign, physical);
    assert.equal(result.openings.length, 1); assert.equal(result.openings[0]!.audio.withIndexCandidates, 1);
    assert.equal(result.audioIndexes[0]!.outOfRangePairs, 0);
    assert.deepEqual(result.discovered.map(d => d.filename), ['audio.idx', 'sound.ini']);
    assert.ok(result.openings[0]!.importManifest.requiredSourceGroups.some(g => g.filename === 'rules.ini'));
    assert.ok(result.openings[0]!.fileRequests.some(f => f.filename === 'test_unit.shp' && f.status === 'matched-unranked'));
    assert.ok(result.openings[0]!.fileRequests.some(f => f.importClass === 'optional-probe'));
    assert.doesNotMatch(JSON.stringify(result), /SECRET_MISSION_TEXT|SECRET_SOUND_DISPLAY_NAME|TEST_WEAPON/);
    assert.deepEqual(await dependencyCensus(root, campaign, physical), result);
    await writeFile(join(root, 'fixture.mix'), corpus(true));
    await assert.rejects(dependencyCensus(root, campaign, physical), { code: 'root-hash-mismatch' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('out-of-range BAG samples stay unresolved; absent openings cannot look complete', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-dependencies-bounds-'));
  try {
    await writeFile(join(root, 'fixture.mix'), corpus(true));
    const physical = await censusInstallation(root), campaign = await campaignCensus(root, physical);
    const result = await dependencyCensus(root, campaign, physical);
    assert.equal(result.audioIndexes[0]!.outOfRangePairs, 1); assert.equal(result.openings[0]!.audio.withIndexCandidates, 0);
    assert.equal(result.nativeDependencyClosureComplete, false);
    assert.ok(result.diagnostics.some(d => d.profile === 'yr' && d.code === 'missing-opening-candidate'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
