// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic on-disk content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, truncate } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { campaignGraphReport, readCampaignGraphManifest, GRAPH_MANIFEST_BYTES, type GraphCensusInput } from '../../tools/analysis/campaign-graph.ts';
import type { GraphSource } from '../../packages/content/src/campaign-graph.ts';
async function fixture(root: string, name: string, text: string): Promise<GraphSource> {
  const bytes = new TextEncoder().encode(text), hash = createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(root, name), bytes);
  return { rootFile: name, rootSha256: hash, absoluteOffset: 0, size: bytes.length, sha256: hash };
}
test('verified CLI projection separates profiles, preserves identical copies and emits only metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-graph-'));
  try {
    const census: GraphCensusInput = { missions: [], definitions: [] };
    for (const [profile, filename, suffix] of [['ra2', 'all01t.map', ''], ['yr', 'all01umd.map', 'md']] as const) {
      const text = '[Basic]\nName=SECRET_RETAIL_NAME\nNextScenario=legacy.map\n[Map]\n';
      const first = await fixture(root, filename, text), second = await fixture(root, `copy-${filename}`, text);
      census.missions.push({ candidateNames: [filename], profileCandidates: [profile], sources: [first, second], sha256: first.sha256 });
      for (const name of [`rules${suffix}.ini`, `ai${suffix}.ini`, `art${suffix}.ini`, `battle${suffix}.ini`, `mission${suffix}.ini`]) {
        const text = name.startsWith('battle') ? `[Battles]\n0=SECRET_SECTION\n[SECRET_SECTION]\nScenario=${filename}\n` : name.startsWith('mission') ? `[${filename}]\nUIName=SECRET_TRANSLATION_LABEL\n` : '[Empty]\nName=SECRET_DEFINITION_NAME\n';
        census.definitions.push({ candidateNames: [name], source: await fixture(root, name, text) });
      }
    }
    const report = await campaignGraphReport(root, census);
    assert.deepEqual(report.openingGraphs.map(g => g.graph.profile), ['ra2', 'yr']);
    assert.equal(report.membersRead, 14); assert.equal(report.openingGraphs[0]!.equivalentPhysicalSources.length, 2);
    assert.equal(report.campaignTables.tables.length, 4); assert.equal(report.campaignTables.tableReferencesComplete, true);
    assert.equal(report.dependencyClosureComplete, false); assert.equal(report.nativeProgressionVerified, false);
    assert.doesNotMatch(JSON.stringify(report), /SECRET_|legacy\.map/);
    assert.deepEqual(await campaignGraphReport(root, census), report);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('missing opening and definition inputs remain incomplete', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-graph-empty-'));
  try {
    const report = await campaignGraphReport(root, { missions: [], definitions: [] });
    assert.equal(report.openingGraphs.length, 0); assert.equal(report.diagnostics.length, 12);
    assert.equal(report.campaignTables.tableReferencesComplete, false); assert.equal(report.dependencyClosureComplete, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('source bytes must match both opening identity and the pinned reader hashes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-graph-stale-'));
  try {
    const source = await fixture(root, 'all01t.map', '[Basic]\n[Map]\n');
    const census: GraphCensusInput = { missions: [{ candidateNames: ['all01t.map'], profileCandidates: ['ra2'], sources: [source], sha256: 'a'.repeat(64) }], definitions: [] };
    await assert.rejects(campaignGraphReport(root, census), /opening-source-identity-mismatch/);
    census.missions[0]!.sha256 = source.sha256;
    await writeFile(join(root, 'all01t.map'), '[Basic]\n[Map]\n;changed\n');
    await assert.rejects(campaignGraphReport(root, census), { code: 'root-hash-mismatch' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('manifest reader rejects oversized files before full read and preserves exact bounded bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-graph-manifest-'));
  try {
    const path = join(root, 'manifest.json'), text = '{"missions":[],"definitions":[]}\n';
    await writeFile(path, text);
    assert.equal(new TextDecoder().decode(await readCampaignGraphManifest(path)), text);
    await truncate(path, GRAPH_MANIFEST_BYTES + 1);
    await assert.rejects(readCampaignGraphManifest(path), /graph-manifest-byte-limit/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
