// SPDX-License-Identifier: GPL-3.0-or-later
// Original metadata/byte fixtures for the application verification boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorldMission, isUnavailableWorldFootprint } from '../../apps/web/src/world-content-loader.ts';
import { WorldContentError } from '../../packages/sim/src/world-content.ts';
import type { BrowserCatalog, BrowserAssetCandidate } from '../../packages/vfs/src/browser-catalog.ts';
import type { BrowserMemberIdentity } from '../../packages/vfs/src/browser-verified.ts';
const identity = (): BrowserMemberIdentity => ({ root: { sourceId: 'root', size: 10, sha256: 'a'.repeat(64) }, absoluteOffset: 2, size: 3, sha256: 'b'.repeat(64) });
const candidate = (): BrowserAssetCandidate => ({ id: 'member', sourceId: 'root', rootPath: 'original.mix', archiveId: 'archive', ordinal: 0, absoluteOffset: 2, size: 3, kind: 'hash-candidate', knownNames: [], allowed: true, ambiguousName: false });
const catalog = (rows: BrowserAssetCandidate[], read: BrowserCatalog['read']): Pick<BrowserCatalog, 'lookup' | 'read'> => ({ lookup() { return { path: 'original.map', status: rows.length === 1 ? 'candidate' : 'ambiguous', candidates: rows }; }, read });
test('map retrieval requests the exact verified member even among unrelated candidates', async () => {
  let reads = 0; const bytes = new Uint8Array([1, 2, 3]);
  const source = identity(), result = await readWorldMission(catalog([{ ...candidate(), id: 'other', sourceId: 'other' }, candidate()], async (id, expected) => { reads++; assert.equal(id, 'member'); assert.equal(expected, source.sha256); return { identity: source, bytes }; }), { path: 'original.map', source });
  assert.equal(result, bytes); assert.equal(reads, 1);
});
test('missing, ambiguous, blocked, duplicate locator and over-limit maps fail before read', async () => {
  let reads = 0; const read: BrowserCatalog['read'] = async () => { reads++; throw Error('must-not-read'); };
  for (const rows of [[], [{ ...candidate(), allowed: false }], [{ ...candidate(), ambiguousName: true }], [candidate(), { ...candidate(), id: 'duplicate' }]]) await assert.rejects(readWorldMission(catalog(rows, read), { path: 'original.map', source: identity() }), /world-map-candidate/);
  await assert.rejects(readWorldMission(catalog([candidate()], read), { path: 'original.map', source: { ...identity(), size: 16 * 1024 ** 2 + 1 } }), /world-map-limit/); assert.equal(reads, 0);
});
test('map identity is captured before await and each changed return identity field rejects', async () => {
  const mutations: ((s: BrowserMemberIdentity) => BrowserMemberIdentity)[] = [s => ({ ...s, root: { ...s.root, sourceId: 'other' } }), s => ({ ...s, root: { ...s.root, size: 11 } }), s => ({ ...s, root: { ...s.root, sha256: 'c'.repeat(64) } }), s => ({ ...s, absoluteOffset: 3 }), s => ({ ...s, size: 4 }), s => ({ ...s, sha256: 'd'.repeat(64) })];
  for (const change of mutations) await assert.rejects(readWorldMission(catalog([candidate()], async () => ({ identity: change(identity()), bytes: new Uint8Array(3) })), { path: 'original.map', source: identity() }), /world-map-identity/);
  await assert.rejects(readWorldMission(catalog([candidate()], async () => ({ identity: identity(), bytes: new Uint8Array(2) })), { path: 'original.map', source: identity() }), /world-map-identity/);
  const source = identity(); let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const pending = readWorldMission(catalog([candidate()], async () => { await waiting; return { identity: identity(), bytes: new Uint8Array(3) }; }), { path: 'original.map', source });
  Object.assign(source.root, { sha256: 'e'.repeat(64) }); Object.assign(source, { absoluteOffset: 9 }); release(); assert.equal((await pending).length, 3);
});
test('only genuine unsupported-required-footprint failure permits the static preview fallback', () => {
  assert.equal(isUnavailableWorldFootprint(new WorldContentError('unsupported-required-footprint', 'structures:0')), true);
  for (const error of [new Error('unsupported-required-footprint'), { code: 'unsupported-required-footprint' }, new WorldContentError('map-hash'), new WorldContentError('footprint-source'), new WorldContentError('footprint-limit')]) assert.equal(isUnavailableWorldFootprint(error), false);
});
