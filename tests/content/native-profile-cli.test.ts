// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Temporary files contain original synthetic data only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { nativeProfileReport } from '../../tools/analysis/native-profile-census.ts';
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'webra2-native-'));
  async function file(rootFile: string, content: string) {
    const bytes = new TextEncoder().encode(content); await writeFile(join(directory, rootFile), bytes);
    return { rootFile, rootSha256: digest(bytes), absoluteOffset: 0, size: bytes.length, sha256: digest(bytes) };
  }
  const images = [];
  for (const rootFile of ['game.exe', 'gamemd.exe']) {
    const source = await file(rootFile, `original synthetic image ${rootFile}`);
    images.push({ ...source, ranges: [{ id: 'synthetic', virtualAddress: 0x401000, absoluteOffset: 0, size: source.size, sha256: source.sha256 }] });
  }
  const mapSelectionSources = [];
  for (const name of ['mapsel.ini', 'mapselmd.ini']) {
    const source = await file(name + '.mix', '[stage]\nScenario=all02umd.map\n');
    mapSelectionSources.push({ ...source, name, archivePath: source.rootFile + '/#0:00000001' });
  }
  const missions = [], definitions = [];
  for (const rootFile of ['expandmd01.mix', 'base.mix']) {
    const rule = new TextEncoder().encode('[Rules]\nKey=' + rootFile + '\n');
    const map = new TextEncoder().encode('[Basic]\nEndOfGame=no\n; ' + rootFile + '\n');
    const bytes = new Uint8Array([...rule, ...map]); await writeFile(join(directory, rootFile), bytes);
    const rootSha256 = digest(bytes);
    definitions.push({ candidateNames: ['rulesmd.ini'], source: { rootFile, rootSha256, absoluteOffset: 0, size: rule.length, sha256: digest(rule) } });
    missions.push({ candidateNames: ['all02umd.map'], profileCandidates: ['yr'], sha256: digest(map), sources: [{ rootFile, rootSha256, absoluteOffset: rule.length, size: map.length, sha256: digest(map) }] });
  }
  return { directory, locators: { schemaVersion: 1, images, mapSelectionSources }, census: { missions, definitions }, async close() { await rm(directory, { recursive: true, force: true }); } };
}
test('CLI report projects only allowed metadata from every nested source boundary', async () => {
  const f = await fixture();
  try {
    const expected = await nativeProfileReport(f.directory, f.locators, f.census);
    const poison = { payload: 'DO-NOT-PUBLISH-original-synthetic-marker' };
    Object.assign(f.locators, poison); Object.assign(f.census, poison);
    for (const image of f.locators.images) { Object.assign(image, poison); Object.assign(image.ranges[0]!, poison); }
    for (const source of f.locators.mapSelectionSources) Object.assign(source, poison);
    for (const row of f.census.missions) { Object.assign(row, poison); Object.assign(row.sources[0]!, poison); }
    for (const row of f.census.definitions) { Object.assign(row, poison); Object.assign(row.source, poison); }
    const actual = await nativeProfileReport(f.directory, f.locators, f.census);
    assert.deepEqual(actual, expected);
    assert.ok(!JSON.stringify(actual).includes(poison.payload));
  } finally { await f.close(); }
});
test('malformed/sparse arrays, duplicate identities and unbounded profiles fail before source I/O', async () => {
  const f = await fixture();
  try {
    const copies = () => ({ locators: structuredClone(f.locators), census: structuredClone(f.census) });
    const broken = copies(); delete broken.locators.images[0];
    await assert.rejects(nativeProfileReport('/missing', broken.locators, broken.census), /sparse-array/);
    const duplicate = copies(); duplicate.locators.images[1] = duplicate.locators.images[0]!;
    await assert.rejects(nativeProfileReport('/missing', duplicate.locators, duplicate.census), /duplicate-image/);
    const table = copies(); table.locators.mapSelectionSources[1] = { ...table.locators.mapSelectionSources[0]!, name: 'mapselmd.ini' };
    await assert.rejects(nativeProfileReport('/missing', table.locators, table.census), /duplicate-source/);
    for (const profiles of [['other'], ['yr', 'yr'], Array.from({ length: 3 }, () => 'yr')]) {
      const profile = copies(); profile.census.missions[0]!.profileCandidates = profiles;
      await assert.rejects(nativeProfileReport('/missing', profile.locators, profile.census), /native-(text-shape|duplicate-profile|array-limit)/);
    }
    const malformed = copies(); Object.assign(malformed.census.missions[0]!, { sources: null });
    await assert.rejects(nativeProfileReport('/missing', malformed.locators, malformed.census), /array-limit/);
  } finally { await f.close(); }
});
test('stale source bytes cannot produce a selection report', async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.directory, 'expandmd01.mix'), 'changed original synthetic content');
    await assert.rejects(nativeProfileReport(f.directory, f.locators, f.census), /root file|root hash/i);
  } finally { await f.close(); }
});
test('command-line interface rejects unexpected arguments before reading files', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'tools/analysis/native-profile-census.ts', '/missing', '/missing', '/missing', 'unexpected'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
