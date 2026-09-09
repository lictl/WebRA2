// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBrowserCatalog, type BrowserAssetCandidate, type BrowserCatalog } from '../../packages/vfs/src/browser-catalog.ts';
import { prepareObjectPreview } from '../../packages/content/src/object-preview.ts';
import { plan, assets, file, mix, shp, sha } from './object-art.fixture.ts';

test('genuine selected Files yield hashed SHP/palette resources in both profiles without requiring game binaries', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const values = assets(profile), catalog = await inspectBrowserCatalog(Object.entries(values).map(([n, b]) => file(n, b)), { profile, policy: 'tolerant' });
    try {
      const phases = new Set<string>(), result = await prepareObjectPreview(catalog, plan({ profile }), { onProgress(p) { phases.add(p.phase); } });
      assert.equal(result.assets.length, 4); assert.equal(result.palettes.length, 2); assert.equal(result.types.filter(t => t.status === 'ready').length, 4);
      assert.equal(result.types.filter(t => t.status === 'voxel').length, 2); assert.equal(result.canStartCampaign, false);
      for (const a of result.assets) assert.equal(a.sha256, sha(values[a.path]!));
      assert.deepEqual(result.types.find(t => t.assetId === 'shp:actor.shp')!.canvas, { width: 4, height: 4 });
      assert.deepEqual([...phases], ['verify', 'decode']); assert.equal(result.allocations.selectedFramePixels, 16);
      result.assets[0]!.bytes.fill(0); result.palettes[0]!.rgba.fill(0);
      const again = await prepareObjectPreview(catalog, plan({ profile })); assert.equal(again.palettes[0]!.rgba[3], 255);
      assert.equal(sha(again.assets[0]!.bytes), again.assets[0]!.sha256);
    } finally { await catalog.dispose(); }
  }
});
test('equivalent base archive copies are retained; expansion and loose precedence require verified bytes', async () => {
  const rows = assets(), changed = shp(9);
  for (const loose of [false, true]) {
    const files = [file('ra2.mix', mix(rows)), file('cache.mix', mix(rows)), file('expand02.mix', mix({ 'actor.shp': changed }))];
    if (loose) files.push(file('actor.shp', shp(7)));
    const catalog = await inspectBrowserCatalog(files, { profile: 'ra2', policy: 'tolerant' });
    try {
      const r = await prepareObjectPreview(catalog, plan());
      assert.equal(r.types.filter(t => t.status === 'ready').length, 4);
      const actor = r.resources.find(r => r.path === 'actor.shp')!;
      assert.equal(actor.candidates.length, loose ? 4 : 3); assert.equal(actor.selected.length, 1);
      assert.equal(r.assets.find(a => a.path === 'actor.shp')!.sha256, sha(loose ? shp(7) : changed));
      assert.equal(r.resources.find(r => r.path === 'trace.shp')!.selected.length, 2);
    } finally { await catalog.dispose(); }
  }
});
test('missing, conflicting and unknown-mount art stays unresolved without falling through to an unrelated still', async () => {
  const rows = assets(); delete rows['guall.shp']; rows['ggall.shp'] = shp(3);
  const catalog = await inspectBrowserCatalog([file('ra2.mix', mix(rows)), file('cache.mix', mix({ 'actor.shp': shp(9) })), file('ecache01.mix', mix({ 'trace.shp': shp() }))], { profile: 'ra2', policy: 'tolerant' });
  try {
    const r = await prepareObjectPreview(catalog, plan());
    assert.equal(r.types.find(t => t.id === 'type:infantry:person')!.status, 'conflict');
    assert.equal(r.types.find(t => t.id === 'type:smudge:trace')!.status, 'unsupported-mount');
    assert.equal(r.types.find(t => t.id === 'type:structure:ghall')!.assetId, 'shp:ggall.shp');
    assert.ok(r.resources.some(r => r.path === 'guall.shp' && r.status === 'missing'));
  } finally { await catalog.dispose(); }
});
test('cancellation, callback failures, stale root anchors and mutated read identities fail with recoverable ownership', async () => {
  const catalog = await inspectBrowserCatalog(Object.entries(assets()).map(([n, b]) => file(n, b)), { profile: 'ra2', policy: 'tolerant' });
  try {
    const p = plan(), abort = new AbortController(); let nested: Promise<void> | undefined;
    await assert.rejects(prepareObjectPreview(catalog, p, { signal: abort.signal, onProgress() { nested ??= assert.rejects(prepareObjectPreview(catalog, p), /busy/); abort.abort(); } }), { name: 'AbortError' }); await nested;
    await assert.rejects(prepareObjectPreview(catalog, p, { onProgress() { throw Error('callback failure'); } }), /callback failure/);
    const valid = await prepareObjectPreview(catalog, p), anchor = valid.assets[0]!.source;
    await assert.rejects(prepareObjectPreview(catalog, p, { anchors: [{ ...anchor, root: { ...anchor.root, sha256: 'f'.repeat(64) } }] }), /root-identity/);
    const corrupted: BrowserCatalog = { ...catalog, async discover(id) { const r = await catalog.discover(id); return { ...r, identity: { ...r.identity, absoluteOffset: r.identity.absoluteOffset + 1 } }; } };
    await assert.rejects(prepareObjectPreview(corrupted, p), /source-identity/);
    assert.equal((await prepareObjectPreview(catalog, p)).assets.length, 4);
  } finally { await catalog.dispose(); }
});
test('source budgets precede I/O and aggregate SHP work gates precede selected-plane decoding', async () => {
  const catalog = await inspectBrowserCatalog(Object.entries(assets()).map(([n, b]) => file(n, b)), { profile: 'ra2', policy: 'tolerant' });
  let reads = 0; const counted: BrowserCatalog = { ...catalog, async discover(id) { reads++; return catalog.discover(id); } };
  try {
    for (const limits of [{ sourceBytes: 1 }, { rootBytes: 1 }, { candidates: 0 }, { references: 0 }]) {
      reads = 0; await assert.rejects(prepareObjectPreview(counted, plan(), { limits }), /limit/); assert.equal(reads, 0);
    }
    for (const limits of [{ assets: 1 }, { indexedFrames: 1 }, { decodedPixels: 1 }]) await assert.rejects(prepareObjectPreview(counted, plan(), { limits }), /limit/);
    await assert.rejects(prepareObjectPreview(counted, plan(), { limits: { assets: 1025 } }), /limit/);
  } finally { await catalog.dispose(); }
});

test('candidate and root metadata are captured before asynchronous discovery can mutate budget facts', async () => {
  const catalog = await inspectBrowserCatalog(Object.entries(assets()).map(([n, b]) => file(n, b)), { profile: 'ra2', policy: 'tolerant' });
  try {
    const candidates: { size: number }[] = [], roots = catalog.report.files.map(row => ({ ...row }));
    const mutable: BrowserCatalog = { ...catalog, report: { ...catalog.report, files: roots },
      lookup(path) { const found = catalog.lookup(path); return { ...found, candidates: found.candidates.map(candidate => {
        const copy = { ...candidate, knownNames: [...candidate.knownNames] }; candidates.push(copy); return copy;
      }) }; },
      async discover(id) {
        for (const candidate of candidates) candidate.size = 0;
        for (const root of roots) { root.size = 0; root.path = 'changed.mix'; }
        return catalog.discover(id);
      } };
    const prepared = await prepareObjectPreview(mutable, plan());
    assert.equal(prepared.allocations.verifiedSourceBytes, Object.values(assets()).reduce((sum, bytes) => sum + bytes.length, 0));
    for (const resource of prepared.resources) for (const row of resource.candidates) {
      assert.equal(row.candidate.size, row.source!.size); assert.ok(Object.isFrozen(row.candidate)); assert.ok(Object.isFrozen(row.candidate.knownNames));
    }
    const claimed = new Map<string, { candidate: { size: number }; actualSize: number }>();
    const undersized: BrowserCatalog = { ...catalog,
      lookup(path) { const found = catalog.lookup(path); return { ...found, candidates: found.candidates.map(candidate => {
        const copy = { ...candidate, size: 1 }; claimed.set(candidate.id, { candidate: copy, actualSize: candidate.size }); return copy;
      }) }; },
      async discover(id) { for (const row of claimed.values()) row.candidate.size = row.actualSize; return catalog.discover(id); } };
    await assert.rejects(prepareObjectPreview(undersized, plan(), { limits: { sourceBytes: 10 } }), /source-identity/);
  } finally { await catalog.dispose(); }
});

test('metadata identities require primitive scalar values and candidate getters never execute', async () => {
  const catalog = await inspectBrowserCatalog(Object.entries(assets()).map(([n, b]) => file(n, b)), { profile: 'ra2', policy: 'tolerant' });
  try {
    const source = (await catalog.discover(catalog.lookup('actor.shp').candidates[0]!.id)).identity;
    const boxed = Object.assign(new String(source.root.sha256), { payload: new Uint8Array(1) }) as unknown as string;
    await assert.rejects(prepareObjectPreview(catalog, plan(), { anchors: [{ ...source, root: { ...source.root, sha256: boxed } }] }), /metadata/);
    for (const field of ['root', 'member']) {
      const corrupt: BrowserCatalog = { ...catalog, async discover(id) {
        const found = await catalog.discover(id), identity = field === 'root' ? { ...found.identity, root: { ...found.identity.root, sha256: boxed } } :
          { ...found.identity, sha256: new String(found.identity.sha256) as unknown as string };
        return { ...found, identity };
      } };
      await assert.rejects(prepareObjectPreview(corrupt, plan()), /metadata/);
    }
    let invoked = false, reads = 0;
    const getter: BrowserCatalog = { ...catalog,
      lookup(path) { const found = catalog.lookup(path); return { ...found, candidates: found.candidates.map(candidate =>
        Object.defineProperty({ ...candidate }, 'size', { enumerable: true, get() { invoked = true; return 1; } }) as BrowserAssetCandidate) }; },
      async discover(id) { reads++; return catalog.discover(id); } };
    await assert.rejects(prepareObjectPreview(getter, plan()), /metadata/); assert.equal(invoked, false); assert.equal(reads, 0);
    const duplicate: BrowserCatalog = { ...catalog,
      lookup(path) { const found = catalog.lookup(path), first = found.candidates[0]; return { ...found,
        candidates: first ? [...found.candidates, { ...first, absoluteOffset: first.absoluteOffset + 1, size: first.size - 1 }] : found.candidates }; },
      async discover(id) { reads++; return catalog.discover(id); } };
    await assert.rejects(prepareObjectPreview(duplicate, plan()), /candidate-identity/); assert.equal(reads, 0);
  } finally { await catalog.dispose(); }
});

test('corrupt bytes and unsupported selected frames fail with the resource path instead of returning a ready still', async () => {
  const values = assets(), invalid = shp();
  new DataView(invalid.buffer).setUint32(16, 4, true); values['actor.shp'] = invalid;
  const catalog = await inspectBrowserCatalog(Object.entries(values).map(([n, b]) => file(n, b)), { profile: 'ra2', policy: 'tolerant' });
  try {
    for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(prepareObjectPreview(catalog, plan()), { code: 'shp-unsupported-compression', path: 'actor.shp' });
    const corrupt: BrowserCatalog = { ...catalog, async discover(id) {
      const r = await catalog.discover(id), bytes = r.bytes.slice(); bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
      return { ...r, bytes };
    } };
    await assert.rejects(prepareObjectPreview(corrupt, plan()), { code: 'object-preview-source-hash' });
  } finally { await catalog.dispose(); }
});
