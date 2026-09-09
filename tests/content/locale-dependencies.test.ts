// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic data; no retail font or localized values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localeDependencyReport } from '../../tools/analysis/locale-dependencies.ts';

function font(cp = 65) {
  const bytes = new Uint8Array(28 + 131072 + 2), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('fonT'));
  for (const [offset, n] of [[4, 1], [8, 1], [12, 1], [16, 1], [20, 1], [24, 2]]) view.setUint32(offset!, n!, true);
  view.setUint16(28 + cp * 2, 1, true); bytes.set([1, 0x80], 28 + 131072);
  return bytes;
}
function csf() {
  const key = 'PRIVATE_LABEL', bytes = new Uint8Array(24 + 12 + key.length + 8 + 2), view = new DataView(bytes.buffer), ascii = (s: string, at: number) => bytes.set(new TextEncoder().encode(s), at);
  ascii(' FSC', 0); for (const [offset, n] of [[4, 3], [8, 1], [12, 1], [20, 9], [28, 1], [32, key.length]]) view.setUint32(offset!, n!, true);
  ascii(' LBL', 24); ascii(key, 36); ascii(' RTS', 36 + key.length); view.setUint32(40 + key.length, 1, true); view.setUint16(44 + key.length, 65 ^ 0xffff, true);
  return bytes;
}
async function source(root: string, name: string, bytes: Uint8Array) {
  await writeFile(join(root, name), bytes);
  const hash = createHash('sha256').update(bytes).digest('hex');
  return { rootFile: name, rootSha256: hash, sha256: hash, absoluteOffset: 0, size: bytes.length, privateExtra: 'DO_NOT_PUBLISH' };
}
const candidate = (name: string, profiles: string[], identity: Awaited<ReturnType<typeof source>>) => ({ candidateNames: [name], profileCandidates: profiles, source: identity });

test('verified locale projection isolates profiles, retains competing font coverage, and removes extra input fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-locale-'));
  try {
    const ra2 = candidate('ra2.csf', ['ra2'], await source(root, 'a.bin', csf()));
    const yr = candidate('ra2md.csf', ['yr'], await source(root, 'b.bin', csf()));
    const first = candidate('game.fnt', ['ra2'], await source(root, 'c.bin', font()));
    const alternative = candidate('game.fnt', ['ra2'], await source(root, 'd.bin', font(66)));
    const report = await localeDependencyReport(root, { schemaVersion: 1, locales: [ra2, yr] }, { schemaVersion: 1, fonts: [first, alternative] });
    assert.equal(report.membersRead, 4);
    assert.equal(report.strings[0]!.candidateCoverage, 'missing-character-or-font-variant');
    assert.deepEqual(report.strings[0]!.fontCandidates.map(row => row.missing), [[], [65]]);
    assert.equal(report.strings[1]!.candidateCoverage, 'no-font-candidate');
    assert.equal(report.playableLocaleEnumerationComplete, false);
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_LABEL|DO_NOT_PUBLISH|privateExtra/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('font and CSF identities cannot be replaced by current bytes or duplicated under new logical identities', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webra2-locale-hash-'));
  try {
    const strings = candidate('ra2.csf', ['ra2'], await source(root, 'strings.bin', csf()));
    const bitmap = candidate('game.fnt', ['ra2'], await source(root, 'font.bin', font()));
    const campaign = { schemaVersion: 1, locales: [strings] }, fonts = { schemaVersion: 1, fonts: [bitmap] };
    const wrong = structuredClone(fonts); wrong.fonts[0]!.source.sha256 = '0'.repeat(64);
    await assert.rejects(localeDependencyReport(root, campaign, wrong), { code: 'member-hash-mismatch' });
    await assert.rejects(localeDependencyReport(root, campaign, { schemaVersion: 1, fonts: [bitmap, { ...bitmap, candidateNames: ['other.fnt'] }] }), /duplicate-physical-source/);
    await assert.rejects(localeDependencyReport(root, campaign, { schemaVersion: 1, fonts: [bitmap, { ...bitmap, source: { ...bitmap.source, rootFile: bitmap.source.rootFile.toUpperCase() } }] }), /duplicate-physical-source/);
    await writeFile(join(root, 'strings.bin'), new Uint8Array(csf().length));
    await assert.rejects(localeDependencyReport(root, campaign, fonts), { code: 'root-hash-mismatch' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('invalid manifests reject before opening source roots, and empty evidence never proves a playable locale', async () => {
  const missingRoot = '/nonexistent-webra2-locale-test-root';
  const row = candidate('game.fnt', ['ra2'], { rootFile: 'font.bin', rootSha256: 'a'.repeat(64), sha256: 'b'.repeat(64), absoluteOffset: 0, size: 1, privateExtra: '' });
  for (const patch of [{ profileCandidates: ['ra2', 'ra2'] }, { candidateNames: ['../game.fnt'] }, { candidateNames: new Array<string>(1) }, { profileCandidates: new Array<string>(1) }, { source: { ...row.source, size: '1' } }, { source: { ...row.source, absoluteOffset: -1 } }, { source: { ...row.source, size: 64 * 1024 * 1024 + 1 } }]) {
    await assert.rejects(localeDependencyReport(missingRoot, { schemaVersion: 1, locales: [] }, { schemaVersion: 1, fonts: [{ ...row, ...patch }] }), /locale-/);
  }
  for (const [campaign, fonts] of [[{ schemaVersion: 1, locales: new Array(1) }, { schemaVersion: 1, fonts: [] }], [{ schemaVersion: 1, locales: [] }, { schemaVersion: 1, fonts: new Array(1) }]]) {
    await assert.rejects(localeDependencyReport(missingRoot, campaign, fonts), /locale-sparse-list/);
  }
  const root = await mkdtemp(join(tmpdir(), 'webra2-locale-empty-'));
  try {
    const report = await localeDependencyReport(root, { schemaVersion: 1, locales: [] }, { schemaVersion: 1, fonts: [] });
    assert.equal(report.membersRead, 0); assert.equal(report.playableLocaleEnumerationComplete, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
