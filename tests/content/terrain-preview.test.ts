// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic map, palette and TMP source fixtures; no retail data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareTerrainPreview, type TerrainPreviewRequest } from '../../packages/content/src/terrain-preview.ts';
import { inspectBrowserCatalog, type BrowserCatalog } from '../../packages/vfs/src/browser-catalog.ts';
const encode = (s: string) => new TextEncoder().encode(s);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const file = (name: string, b: Uint8Array) => new File([new Uint8Array(b)], name);
const request: TerrainPreviewRequest = { profile: 'ra2', engineVersion: 'preview-test-1', missionPath: 'example.map', theaterIniPath: 'original.ini', palettePath: 'original.pal', variantPolicy: 'base-only' };
function packed(raw: Uint8Array, codec: 'lzo' | 'lcw'): string {
  const chunks: Buffer[] = [];
  for (let at = 0; at < raw.length; at += 8192) {
    const data = raw.subarray(at, at + 8192);
    // Our tiny LZO map is entirely literal. Uniform overlays use one LCW fill.
    const stream = codec === 'lzo' ? Buffer.from([17 + data.length, ...data, 17, 0, 0]) : Buffer.from([254, data.length & 255, data.length >> 8, data[0]!, 128]);
    const header = Buffer.alloc(4); header.writeUInt16LE(stream.length); header.writeUInt16LE(data.length, 2); chunks.push(header, stream);
  }
  return Buffer.concat(chunks).toString('base64');
}
function map(theater = 'URBAN', slot = 0, reverse = false): Uint8Array {
  const data = new Uint8Array(26), view = new DataView(data.buffer);
  for (const i of [0, 1]) { const at = (reverse ? 1 - i : i) * 11; view.setUint16(at, i + 1, true); view.setUint16(at + 2, i + 1, true); view.setUint16(at + 4, i === 0 ? 65535 : 1, true); data[at + 8] = slot; }
  return encode(`[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,1,2\nLocalSize=0,0,1,2\nTheater=${theater}\n[Terrain]\n1001=ORIGINAL_TREE\n` +
    `[IsoMapPack5]\n1=${packed(data, 'lzo')}\n[OverlayPack]\n1=${packed(new Uint8Array(262144).fill(255), 'lcw')}\n[OverlayDataPack]\n1=${packed(new Uint8Array(262144), 'lcw')}\n`);
}
function tmp(color: number, width = 60, present = true): Uint8Array {
  const pixels = width * width / 4, bytes = new Uint8Array(present ? 72 + pixels * 2 : 20), view = new DataView(bytes.buffer);
  view.setUint32(0, 1, true); view.setUint32(4, 1, true); view.setUint32(8, width, true); view.setUint32(12, width / 2, true);
  if (present) { view.setUint32(16, 20, true); view.setInt32(20 + 12, 52 + pixels, true); view.setUint32(20 + 36, 2, true); bytes.fill(color, 72, 72 + pixels); }
  return bytes;
}
function fixture(profile: 'ra2' | 'yr' = 'ra2', changes: Record<string, Uint8Array | null> = {}) {
  const md = profile === 'yr' ? 'md' : '', extension = profile === 'yr' ? 'ubn' : 'urb';
  const rows: Record<string, Uint8Array> = {};
  for (const name of ['rules', 'art', 'ai', 'battle', 'mapsel', 'mission', 'sound']) rows[`${name}${md}.ini`] = encode('[Original]\nValue=1');
  const csf = new Uint8Array(24); csf.set(encode(' FSC')); new DataView(csf.buffer).setUint32(4, 3, true);
  rows[`ra2${md}.csf`] = csf; rows['game.fnt'] = Uint8Array.of(1, 2, 3);
  rows['example.map'] = map(profile === 'yr' ? 'NEWURBAN' : 'URBAN');
  rows['original.ini'] = encode('[General]\nClearTile=0\n[TileSet0000]\nFileName=original\nTilesInSet=2');
  rows['original.pal'] = Uint8Array.from({ length: 768 }, (_, i) => i % 64);
  rows[`original01.${extension}`] = tmp(3); rows[`original02.${extension}`] = tmp(7);
  for (const [name, value] of Object.entries(changes)) { if (value === null) delete rows[name]; else rows[name] = value; }
  return { rows, files: Object.entries(rows).map(([name, bytes]) => file(name, bytes)) };
}
async function catalog(f = fixture(), profile: 'ra2' | 'yr' = 'ra2') { return inspectBrowserCatalog(f.files, { profile, policy: 'tolerant' }); }
test('verified synthetic mission composes geometry, objects, clear sentinel, palette and unique base tile choices', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), c = await catalog(f, profile);
    try {
      const phases = new Set<string>();
      const result = await prepareTerrainPreview(c, { ...request, profile }, { onProgress(p) { assert.ok(Object.isFrozen(p)); phases.add(p.phase); } });
      assert.equal(result.canStartCampaign, false); assert.equal(result.assetSelection, 'unique-candidate-base-only');
      assert.equal(result.terrain.cells.length, 2); assert.equal(result.objects.placements.length, 1); assert.equal(result.choices.length, 2);
      assert.deepEqual(result.choices, [{ sourceRecord: 0, assetId: 'terrain:0', subtile: 0 }, { sourceRecord: 1, assetId: 'terrain:1', subtile: 0 }]);
      assert.deepEqual([...result.paletteRgba.slice(0, 8)], [0, 4, 8, 255, 12, 16, 20, 255]);
      for (const asset of result.assets) assert.equal(asset.sha256, sha(f.rows[asset.path]!));
      assert.equal(result.terrain.source.sha256, result.definitions.content!.files[9]!.source.sha256);
      assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.choices[0])); assert.ok(Object.isFrozen(result.assets[0]!.source.root));
      assert.deepEqual([...phases], ['definitions', 'mission', 'theater', 'tiles']);
      result.assets[0]!.bytes.fill(0); result.paletteRgba.fill(0);
      const again = await prepareTerrainPreview(c, { ...request, profile }); assert.equal(again.paletteRgba[3], 255); assert.equal(sha(again.assets[0]!.bytes), again.assets[0]!.sha256);
    } finally { await c.dispose(); }
  }
});
test('missing, duplicate and unsupported theater or palette inputs never yield a partial preview', async () => {
  for (const [changes, expected] of [
    [{ 'original01.urb': null }, /missing-asset/],
    [{ 'original.pal': new Uint8Array(769) }, /member-budget/],
    [{ 'original.pal': new Uint8Array(767) }, /palette-size/],
    [{ 'original.pal': new Uint8Array(768).fill(64) }, /palette/],
    [{ 'example.map': map('UNSUPPORTED') }, /theater-profile/],
  ] as const) {
    const c = await catalog(fixture('ra2', changes)); try { await assert.rejects(prepareTerrainPreview(c, request), expected); } finally { await c.dispose(); }
  }
  const f = fixture(); f.files.push(file('ORIGINAL01.URB', tmp(9))); const duplicate = await catalog(f);
  try { await assert.rejects(prepareTerrainPreview(duplicate, request), /ambiguous-asset/); } finally { await duplicate.dispose(); }
});
test('TMP slot, depth and profile-specific dimensions are checked before a renderer receives sources', async () => {
  const noDepth = tmp(3); new DataView(noDepth.buffer).setUint32(56, 0, true);
  for (const [changes, expected] of [
    [{ 'example.map': map('URBAN', 1) }, /missing-subtile/],
    [{ 'original01.urb': tmp(3, 60, false) }, /missing-subtile/],
    [{ 'original01.urb': tmp(3, 48) }, /tile-dimensions/],
    [{ 'original01.urb': noDepth }, /missing-depth/],
  ] as const) {
    const c = await catalog(fixture('ra2', changes)); try { await assert.rejects(prepareTerrainPreview(c, request), expected); } finally { await c.dispose(); }
  }
});
test('root work is capped before definitions, and aggregate tile/reference budgets precede tile reads', async () => {
  const c = await catalog(); let reads = 0;
  const counted: BrowserCatalog = { ...c, async discover(id) { reads++; return c.discover(id); } };
  try {
    await assert.rejects(prepareTerrainPreview(counted, request, { limits: { rootBytes: 0 } }), /root-budget/); assert.equal(reads, 0);
    for (const limits of [{ assets: 1 }, { assetBytes: 2000 }, { references: 1 }]) {
      reads = 0; await assert.rejects(prepareTerrainPreview(counted, request, { limits }), /preview-(asset|source|reference)-budget/);
      assert.equal(reads, 12); // Ten definition members plus theater INI/palette; no TMP read.
    }
    for (const limits of [{ assets: 1025 }, { assetBytes: -1 }]) await assert.rejects(prepareTerrainPreview(c, request, { limits }), /preview-limit/);
  } finally { await c.dispose(); }
});
test('cancellation and callback errors stop resource reads; busy admission and request capture are explicit', async () => {
  const c = await catalog(), changed = { ...request }; let reentrant: Promise<void> | undefined;
  try {
    const pending = prepareTerrainPreview(c, changed, { onProgress() { reentrant ??= assert.rejects(prepareTerrainPreview(c, request), /preview-busy/); } });
    changed.palettePath = 'missing.pal'; assert.equal((await pending).assets.length, 2); await reentrant;
    const abort = new AbortController(); let last = '';
    await assert.rejects(prepareTerrainPreview(c, request, { signal: abort.signal, onProgress(p) { last = p.phase; if (p.phase === 'mission') abort.abort(); } }), { name: 'AbortError' });
    assert.equal(last, 'mission');
    await assert.rejects(prepareTerrainPreview(c, request, { onProgress(p) { if (p.phase === 'theater') throw new Error('callback'); } }), /callback/);
    assert.equal((await prepareTerrainPreview(c, request)).assets.length, 2);
  } finally { await c.dispose(); }
});
test('wrong profile, stale mission identity and cross-name physical matches cannot authorize a preview', async () => {
  const c = await catalog();
  try {
    await assert.rejects(prepareTerrainPreview(c, { ...request, profile: 'yr' }), /catalog-profile/);
    const wrong: BrowserCatalog = { ...c, async read(id, hash) {
      const found = await c.read(id, hash); return { ...found, identity: { ...found.identity, root: { ...found.identity.root, sha256: 'f'.repeat(64) } } };
    } };
    await assert.rejects(prepareTerrainPreview(wrong, request), /preview-read-identity/);
    const collision: BrowserCatalog = { ...c, lookup(path) {
      if (path !== 'original02.urb') return c.lookup(path);
      const source = c.lookup('original01.urb'); return { ...source, path, candidates: source.candidates.map(candidate => ({ ...candidate, knownNames: [] })) };
    } };
    await assert.rejects(prepareTerrainPreview(collision, request), /preview-name-collision/);
    let reads = 0;
    const crossRole: BrowserCatalog = { ...c, lookup(path) {
      if (path !== 'original.ini') return c.lookup(path);
      const source = c.lookup('rules.ini'); return { ...source, path, candidates: source.candidates.map(candidate => ({ ...candidate, knownNames: [] })) };
    }, async discover(id) { reads++; return c.discover(id); } };
    await assert.rejects(prepareTerrainPreview(crossRole, request), /preview-name-collision/); assert.equal(reads, 10);
  } finally { await c.dispose(); }
});
test('every reused physical root must retain the identity verified by earlier content reads', async () => {
  const f = fixture();
  // One actual archive gives the definition and theater members the same physical root.
  const { hashMixName } = await import('../../packages/formats/src/mix-names.ts');
  const entries = Object.entries(f.rows), start = 6 + entries.length * 12, size = entries.reduce((n, [, bytes]) => n + bytes.length, 0);
  const bytes = new Uint8Array(start + size), view = new DataView(bytes.buffer); view.setUint16(0, entries.length, true); view.setUint32(2, size, true); let offset = 0;
  entries.forEach(([name, data], i) => { view.setUint32(6 + i * 12, hashMixName(name), true); view.setUint32(10 + i * 12, offset, true); view.setUint32(14 + i * 12, data.length, true); bytes.set(data, start + offset); offset += data.length; });
  const c = await inspectBrowserCatalog([file('ra2.mix', bytes)], { profile: 'ra2', policy: 'tolerant' });
  try {
    const theaterId = c.lookup('original.ini').candidates[0]!.id;
    const altered: BrowserCatalog = { ...c, async discover(id) {
      const found = await c.discover(id); return id !== theaterId ? found : { ...found, identity: { ...found.identity, root: { ...found.identity.root, sha256: 'f'.repeat(64) } } };
    } };
    await assert.rejects(prepareTerrainPreview(altered, request), /preview-root-identity/);
  } finally { await c.dispose(); }
});
test('cell choices join by sourceRecord even when map record and projected display orders differ', async () => {
  const c = await catalog(fixture('ra2', { 'example.map': map('URBAN', 0, true) }));
  try {
    const result = await prepareTerrainPreview(c, request);
    assert.deepEqual(result.terrain.cells.map(c => [c.x, c.y, c.sourceRecord]), [[1, 1, 1], [2, 2, 0]]);
    assert.deepEqual(result.choices, [{ sourceRecord: 1, assetId: 'terrain:0', subtile: 0 }, { sourceRecord: 0, assetId: 'terrain:1', subtile: 0 }]);
  } finally { await c.dispose(); }
});
