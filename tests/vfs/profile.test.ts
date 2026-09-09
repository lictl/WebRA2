// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileResolver, normalizeAssetPath, type ContentLayer, type ProfileAsset } from '../../packages/vfs/src/profile.ts';

const digest = (number: number) => number.toString(16).padStart(64, '0');
function asset(id: number, path = 'rules.ini', profile: 'ra2' | 'yr' = 'ra2', hash = id): ProfileAsset {
  return { profiles: [profile], names: [{ path, kind: 'literal', evidence: 'synthetic filename' }],
    source: { id: `source-${id}`, rootPath: `${id}.mix`, rootSha256: digest(id + 1000), rootSize: 200,
      archiveSha256: digest(id + 1000), ordinal: 0, memberId: '12345678', absoluteOffset: 20, size: 10, sha256: digest(hash) } };
}
function layer(id: string, rank: number, assets: readonly ProfileAsset[], kind: ContentLayer['kind'] = 'archive'): ContentLayer {
  if (kind === 'loose') assets = assets.map(asset => ({ ...asset, source: { ...asset.source,
    rootSha256: asset.source.sha256, rootSize: asset.source.size, archiveSha256: null,
    ordinal: null, memberId: null, absoluteOffset: 0 } }));
  return { id, rank, kind, assets, profiles: ['ra2', 'yr'], rankEvidence: 'Synthetic explicit ordering, not original behavior' };
}

test('explicit mod/loose/patch ranks override base without depending on input order or kind', () => {
  const layers = [layer('base', 0, [asset(1)]), layer('patch', 10, [asset(2)]),
    layer('loose', 20, [asset(3)], 'loose'), layer('mod-first', 100, [asset(4)], 'mod'),
    layer('mod-last', 101, [asset(5)], 'mod')];
  const result = createProfileResolver('ra2', layers).resolve('RULES.INI');
  assert.equal(result.content?.sha256, digest(5));
  assert.deepEqual(result.alternatives.map(item => item.source.id), ['source-4', 'source-3', 'source-2', 'source-1']);
  assert.deepEqual(createProfileResolver('ra2', layers.toReversed()).resolve('rules.ini'), result);
  assert.equal(createProfileResolver('ra2', [layers[0]!, layer('loose', -1, [asset(3)], 'loose')]).resolve('rules.ini').content?.sha256, digest(1));
});

test('both layer and asset profiles are explicit; unrelated expansion content never participates', () => {
  const shared = { ...asset(3, 'palette.pal'), profiles: ['ra2', 'yr'] as const };
  const layers = [layer('base', 0, [asset(1), shared]), { ...layer('yr', 999, [asset(2, 'rules.ini', 'yr')]), profiles: ['yr'] as const }];
  const base = createProfileResolver('ra2', layers);
  assert.equal(base.resolve('rules.ini').content?.sha256, digest(1));
  assert.deepEqual(base.excludedSourceIds, ['source-2']);
  assert.equal(createProfileResolver('yr', layers).resolve('rules.ini').content?.sha256, digest(2));
  assert.equal(createProfileResolver('yr', layers).resolve('palette.pal').status, 'resolved');
  assert.throws(() => createProfileResolver('ra2', [{ ...layers[0]!, profiles: ['ra2'], assets: [asset(4, 'a', 'yr')] }]), /exceeds layer/);
  assert.throws(() => createProfileResolver('auto' as 'ra2', []), /profiles/);
});

test('different bytes at equal priority are ambiguous, including duplicate loose filenames', () => {
  const a = layer('a', 0, [asset(1)], 'loose');
  const b = layer('b', 0, [asset(2, 'RULES.INI')], 'loose');
  const result = createProfileResolver('ra2', [b, a]).resolve('rules.ini');
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.content, null);
  assert.deepEqual(result.selected, []);
  assert.deepEqual(result.alternatives.map(item => item.layerId), ['a', 'b']);
  assert.deepEqual(result.diagnostics, ['content-conflict']);
  assert.deepEqual(createProfileResolver('ra2', [a, b]).resolve('rules.ini'), result);
});

test('identical copies retain every physical provenance; no arbitrary physical winner is claimed', () => {
  const result = createProfileResolver('ra2', [layer('maps', 0, [asset(2, 'map.map', 'ra2', 1), asset(1, 'MAP.MAP')])]).resolve('map.map');
  assert.equal(result.status, 'resolved');
  assert.equal(result.content?.sha256, digest(1));
  assert.equal(result.selected.length, 2);
  assert.equal(result.selected[0]?.source.rootSha256, digest(1001));
  assert.equal(result.selected[1]?.source.rootSha256, digest(1002));
});

test('hash-name candidates stay provisional; a distinct-name collision blocks selection', () => {
  const candidate = { ...asset(1), names: [{ path: 'rules.ini', kind: 'hash-candidate' as const, evidence: 'synthetic CRC candidate' }] };
  const vfs = createProfileResolver('ra2', [layer('base', 0, [candidate])]);
  assert.equal(vfs.resolve('rules.ini').status, 'candidate');
  assert.equal(vfs.require(['rules.ini']).complete, false);
  const collision = { ...candidate, names: [...candidate.names, { ...candidate.names[0]!, path: 'other.ini' }] };
  const blocked = createProfileResolver('ra2', [layer('base', 0, [collision])]);
  for (const path of ['rules.ini', 'other.ini']) {
    assert.equal(blocked.resolve(path).status, 'ambiguous');
    assert.equal(blocked.resolve(path).content, null);
    assert.deepEqual(blocked.resolve(path).diagnostics, ['name-collision']);
  }
  const overridden = createProfileResolver('ra2', [layer('base', 0, [collision]), layer('mod', 1, [asset(2)], 'mod')]);
  assert.equal(overridden.resolve('rules.ini').status, 'resolved');
  assert.deepEqual(overridden.resolve('rules.ini').diagnostics, ['shadowed-name-collision']);
  assert.equal(overridden.resolve('other.ini').status, 'ambiguous');
});

test('splitting one physical member into separate IDs cannot turn name collisions into verified aliases', () => {
  const first = asset(1);
  const second = { ...first, source: { ...first.source, id: 'different-id' },
    names: [{ path: 'other.ini', kind: 'literal' as const, evidence: 'second synthetic identity claim' }] };
  assert.throws(() => createProfileResolver('ra2', [layer('base', 0, [first, second])]), /Duplicate physical source/);
  assert.throws(() => createProfileResolver('ra2', [layer('base', 0, [first]), layer('other', 1, [second])]), /Duplicate physical source/);
  // A separate root filename is a separate physical copy, even if its complete bytes match.
  const copy = { ...second, source: { ...second.source, rootPath: 'copied.mix' }, names: first.names };
  assert.equal(createProfileResolver('ra2', [layer('base', 0, [first, copy])]).resolve('rules.ini').selected.length, 2);
  const nestedCopy = { ...second, source: { ...second.source, absoluteOffset: 40 }, names: first.names };
  assert.equal(createProfileResolver('ra2', [layer('base', 0, [first, nestedCopy])]).resolve('rules.ini').selected.length, 2);
});

test('missing and unverified requirements are separate from a successful file lookup', () => {
  const vfs = createProfileResolver('ra2', [layer('base', 0, [asset(1)])]);
  const gate = vfs.require(['missing.ini', 'RULES.INI', 'rules.ini']);
  assert.equal(gate.complete, false);
  assert.deepEqual(gate.entries.map(entry => [entry.path, entry.status]), [['missing.ini', 'missing'], ['rules.ini', 'resolved']]);
  assert.deepEqual(vfs.resolve('absent'), { path: 'absent', status: 'missing', content: null, selected: [], alternatives: [], diagnostics: [] });
  assert.equal(vfs.require(['rules.ini']).complete, true);
  assert.equal(vfs.require([]).complete, false);
});

test('safe logical path policy supports CJK, NFC and Windows separators without traversal or URL decoding', () => {
  assert.equal(normalizeAssetPath('語言\\RA2.CSF'), '語言/ra2.csf');
  assert.equal(normalizeAssetPath('cafe\u0301/a.ini'), 'café/a.ini');
  assert.equal(normalizeAssetPath('𠀀/RA2.CSF'), '𠀀/ra2.csf');
  for (const path of ['', '/x', '\\x', 'C:\\x', '//host/a', '../x', 'a/../x', 'a/./x', 'a//x',
    'a/', ' a', 'a ', 'a.', 'con.ini', 'dir/LPT1', 'x%2fy', 'x?y', 'x#y', 'x*y', 'x\0y', '\ud800', 'a/'.repeat(33) + 'b']) {
    assert.throws(() => normalizeAssetPath(path), { name: 'TypeError' }, path);
  }
  const a = asset(1, '語言/RA2.CSF');
  assert.equal(createProfileResolver('ra2', [layer('base', 0, [a])]).resolve('語言\\ra2.csf').status, 'resolved');
});

test('unsafe evidence in excluded profiles still fails validation', () => {
  assert.throws(() => createProfileResolver('ra2', [layer('yr', 0, [asset(1, '../escape', 'yr')])]), /Unsafe/);
});

test('duplicate IDs and inconsistent range/hash/root metadata are rejected', () => {
  const a = asset(1);
  const make = (source: Partial<ProfileAsset['source']>) => ({ ...a, source: { ...a.source, ...source } });
  for (const source of [{ absoluteOffset: -1 }, { absoluteOffset: 195 }, { rootSize: Number.MAX_SAFE_INTEGER + 1 },
    { sha256: 'BAD' }, { memberId: 'not-a-CRC' }, { ordinal: null }, { archiveSha256: null }]) {
    assert.throws(() => createProfileResolver('ra2', [layer('base', 0, [make(source)])]));
  }
  assert.throws(() => createProfileResolver('ra2', [layer('same', 0, []), layer('same', 1, [])]), /Duplicate layer/);
  assert.throws(() => createProfileResolver('ra2', [layer('a', 0, [a]), layer('b', 1, [a])]), /Duplicate source/);
  assert.throws(() => createProfileResolver('ra2', [layer('a', 0, [a, make({ id: 'other', sha256: digest(2) })])]), /physical range/);
  assert.throws(() => createProfileResolver('ra2', [layer('a', 0, [a, make({ id: 'other', absoluteOffset: 40, size: 11 })])]), /conflicting sizes/);
  assert.throws(() => createProfileResolver('ra2', [layer('a', 0, [a, make({ id: 'other', rootSha256: digest(2000) })])]), /root identity/);
});

test('loose sources require whole-file identity and preserve it', () => {
  const a = asset(1);
  const loose = { ...a, source: { ...a.source, rootPath: 'rules.ini', rootSize: 10, rootSha256: digest(1),
    archiveSha256: null, ordinal: null, memberId: null, absoluteOffset: 0 } };
  assert.equal(createProfileResolver('ra2', [layer('loose', 20, [loose], 'loose')]).resolve('rules.ini').selected[0]?.source.archiveSha256, null);
  assert.throws(() => createProfileResolver('ra2', [{ ...layer('loose', 20, [], 'loose'), assets: [{ ...loose, source: { ...loose.source, rootSize: 11 } }] }]), /loose source/);
});

test('resource caps apply before indexing and cannot be raised beyond hard limits', () => {
  const layers = [layer('base', 0, [asset(1)])];
  for (const limits of [{ layers: 0 }, { assets: 0 }, { names: 0 }, { namesPerAsset: 0 }, { layers: 513 }, { assets: -1 }]) {
    assert.throws(() => createProfileResolver('ra2', layers, limits));
  }
  assert.throws(() => createProfileResolver('ra2', layers, { required: 0 }).require(['rules.ini']), /required/);
  assert.throws(() => createProfileResolver('ra2', [layer('base', Infinity, [])]), /rank/);
});

test('returned manifest is detached and frozen, with deterministic source/evidence ordering', () => {
  const a = asset(1);
  const layers = [layer('base', Number.MIN_SAFE_INTEGER, [a]), layer('patch', Number.MAX_SAFE_INTEGER, [asset(2)])];
  const vfs = createProfileResolver('ra2', layers);
  const snapshot = JSON.stringify(vfs.entries);
  (a.source as { sha256: string }).sha256 = digest(99);
  assert.equal(JSON.stringify(vfs.entries), snapshot);
  assert.throws(() => (vfs.entries as unknown[]).push('changed'), TypeError);
  assert.throws(() => { (vfs.entries[0]!.selected[0]!.source as { size: number }).size = 100; }, TypeError);
  assert.equal(vfs.resolve('rules.ini').content?.sha256, digest(2));
});
