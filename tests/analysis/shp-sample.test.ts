// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Synthetic input only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readShpManifest, shpSampleReport } from '../../tools/analysis/shp-sample.ts';
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'webra2-shp-'));
  const sprite = new Uint8Array(36), d = new DataView(sprite.buffer);
  d.setUint16(2, 2, true); d.setUint16(4, 1, true); d.setUint16(6, 1, true);
  d.setUint16(12, 2, true); d.setUint16(14, 1, true); d.setUint8(16, 2); d.setUint32(28, 32, true);
  sprite.set([4, 0, 1, 2], 32);
  const palette = new Uint8Array(768); palette.set([16, 32, 63], 3); palette.set([1, 2, 3], 6);
  const root = new Uint8Array(sprite.length + palette.length); root.set(sprite); root.set(palette, sprite.length);
  await writeFile(join(directory, 'fixture.mix'), root);
  const base = { rootFile: 'fixture.mix', rootSha256: hash(root) };
  return { directory, manifest: { sprite: { ...base, absoluteOffset: 0, size: sprite.length, sha256: hash(sprite) }, palette: { ...base, absoluteOffset: sprite.length, size: palette.length, sha256: hash(palette) } } };
}
test('verified report exposes only metadata, exact colors and physical identities', async () => {
  const { directory, manifest } = await fixture();
  try {
    Object.assign(manifest.sprite, { unrelatedPayload: 'must not appear in published report' });
    const r = await shpSampleReport(directory, manifest);
    assert.equal(r.pixels, 2); assert.equal(r.consumedBytes, 4); assert.equal(r.trailingBytes, 0);
    assert.equal(r.rgbaSha256, hash(Uint8Array.of(64, 128, 252, 255, 4, 8, 12, 255)));
    assert.equal(JSON.stringify(r).includes('unrelatedPayload'), false);
    assert.equal(JSON.stringify(r).includes('must not appear'), false);
    assert.deepEqual(await shpSampleReport(directory, manifest), r);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('root/member mismatch, traversal, palette and frame bounds prevent a verified result', async () => {
  const { directory, manifest } = await fixture();
  try {
    for (const key of ['rootSha256', 'sha256'] as const) await assert.rejects(shpSampleReport(directory, { ...manifest, sprite: { ...manifest.sprite, [key]: '0'.repeat(64) } }), /hash/i);
    await assert.rejects(shpSampleReport(directory, { ...manifest, sprite: { ...manifest.sprite, rootFile: '../fixture.mix' } }), /safe/i);
    await assert.rejects(shpSampleReport(directory, { ...manifest, palette: { ...manifest.palette, size: 769 } }), /manifest-range/);
    await assert.rejects(shpSampleReport(directory, { ...manifest, frame: -1 }), /manifest-range/);
    await assert.rejects(shpSampleReport(directory, { ...manifest, frame: 1 }), /frame-index/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('CLI manifest parsing is bounded before allocating its declared file', async () => {
  const { directory, manifest } = await fixture();
  try {
    const path = join(directory, 'manifest.json'); await writeFile(path, JSON.stringify(manifest));
    assert.deepEqual(await readShpManifest(path), manifest);
    await writeFile(path, ' '.repeat(8193)); await assert.rejects(readShpManifest(path), /manifest-size/);
    await writeFile(path, '{'); await assert.rejects(readShpManifest(path), SyntaxError);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
