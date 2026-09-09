// SPDX-License-Identifier: MIT
// Public metadata mutations only. No installation or extracted content is opened.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
const referencePath = 'docs/analysis/m0-reference-profile.json';
const original = JSON.parse(readFileSync(join(root, referencePath), 'utf8'));
function check(mutate = () => {}) {
  const directory = mkdtempSync(join(tmpdir(), 'webra2-evidence-'));
  try {
    mkdirSync(join(directory, 'docs/analysis'), { recursive: true });
    for (const name of [...Object.keys(original.inputHashes), 'm0-campaign-ledger.md']) copyFileSync(join(root, 'docs/analysis', name), join(directory, 'docs/analysis', name));
    const reference = structuredClone(original);
    mutate(reference, directory);
    // Recompute derived fingerprints: rejection must validate semantics, not stale hashes alone.
    for (const profile of reference.profiles) {
      const text = [...profile.requiredDefinitionGroups].sort((a, b) => a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0).map(g => `${g.filename}\0${g.selectedContentSha256}`).join('\n');
      profile.definitionSelectionFingerprintSha256 = createHash('sha256').update(text).digest('hex');
    }
    writeFileSync(join(directory, referencePath), JSON.stringify(reference));
    const result = spawnSync(process.execPath, [join(root, 'tools/check-m0-evidence.mjs')], { cwd: directory, encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 });
    assert.ifError(result.error); return result;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
function rejects(mutate, expected) { const result = check(mutate); assert.equal(result.status, 1); assert.match(result.stderr, expected); }

test('M0 evidence validates from public metadata without an installation', () => {
  const result = check(); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /2 profiles, 69 data roots, 38 campaign rows/);
});
test('M0 evidence rejects cross-profile definitions even with a matching fingerprint', () => {
  rejects(r => {
    const groups = r.profiles[0].requiredDefinitionGroups;
    groups[groups.findIndex(g => g.filename === 'sound.ini')] = structuredClone(r.profiles[1].requiredDefinitionGroups.find(g => g.filename === 'soundmd.ini'));
  }, /Wrong profile definitions/);
});
test('M0 evidence rejects a changed opening independently of definition fingerprints', () => {
  rejects(r => { r.profiles[0].opening = 'all01umd.map'; }, /Wrong opening/);
});
test('M0 evidence rejects base rules and sound selections with cleared alternatives', () => {
  for (const filename of ['rulesmd.ini', 'soundmd.ini']) rejects(r => {
    const g = r.profiles[1].requiredDefinitionGroups.find(g => g.filename === filename);
    g.equivalentSourceChoices = g.retainedAlternatives; g.selectedContentSha256 = g.retainedAlternatives[0].sha256; g.retainedAlternatives = [];
  }, /Wrong selected content/);
});
test('M0 evidence requires all observed equivalents and conflicting alternatives', () => {
  rejects(r => { r.profiles[0].requiredDefinitionGroups.find(g => g.filename === 'all01t.map').equivalentSourceChoices.pop(); }, /Incomplete equivalent sources/);
  rejects(r => { r.profiles[1].requiredDefinitionGroups.find(g => g.filename === 'rulesmd.ini').retainedAlternatives = []; }, /Incomplete alternatives/);
});
test('M0 evidence rejects stale or omitted source reports', () => {
  rejects((r, directory) => { writeFileSync(join(directory, 'docs/analysis/campaign-census.json'), '{}'); }, /Stale evidence/);
  rejects(r => { delete r.inputHashes['locale-font-sources.json']; }, /deep-equal/);
});
test('M0 evidence rejects campaign progression changes', () => {
  rejects((r, directory) => {
    const path = join(directory, 'docs/analysis/m0-campaign-ledger.md');
    const text = readFileSync(path, 'utf8'); assert.ok(text.includes('| all02s.map |'));
    writeFileSync(path, text.replace('| all02s.map |', '| all01t.map |'));
  }, /all02s\.map/);
});
