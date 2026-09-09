// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. No retail content bundled.
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createVerifiedSourceReader, type VerifiedSourceIdentity } from './verified-source.ts';
import { decodeShpFrame, decodeShpPalette, shpRgba } from '../../packages/formats/src/shp-ts.ts';
export interface ShpSampleManifest { sprite: VerifiedSourceIdentity; palette: VerifiedSourceIdentity; frame?: number }
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function source(identity: VerifiedSourceIdentity) {
  return { rootFile: identity.rootFile, rootSha256: identity.rootSha256, absoluteOffset: identity.absoluteOffset, size: identity.size, sha256: identity.sha256 };
}
export async function readShpManifest(path: string): Promise<ShpSampleManifest> {
  const file = await open(path, 'r');
  try {
    const before = await file.stat({ bigint: true });
    if (!before.isFile() || before.size > 8192n) throw new Error('shp-manifest-size');
    const bytes = new Uint8Array(8193); let done = 0;
    while (done < bytes.length) { const result = await file.read(bytes, done, bytes.length - done, done); if (!result.bytesRead) break; done += result.bytesRead; }
    const after = await file.stat({ bigint: true });
    if (done > 8192 || BigInt(done) !== before.size || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw new Error('shp-manifest-changed');
    return JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(bytes.subarray(0, done))) as ShpSampleManifest;
  } finally { await file.close(); }
}
export async function shpSampleReport(directory: string, manifest: ShpSampleManifest) {
  if (!manifest || typeof manifest !== 'object' || !manifest.sprite || !manifest.palette) throw new Error('shp-manifest-shape');
  const spriteSource = source(manifest.sprite), paletteSource = source(manifest.palette);
  if (paletteSource.size !== 768 || (manifest.frame !== undefined && (!Number.isSafeInteger(manifest.frame) || manifest.frame < 0))) throw new Error('shp-manifest-range');
  const ordinal = manifest.frame ?? 0;
  const reader = await createVerifiedSourceReader(directory, { maxMemberBytes: 16 * 1024 * 1024, maxRoots: 2 });
  try {
    const sprite = await reader.read(spriteSource), palette = await reader.read(paletteSource);
    const decoded = decodeShpFrame(sprite, ordinal), colors = decodeShpPalette(palette), rgba = shpRgba(decoded.pixels, colors);
    return { schemaVersion: 1, scope: 'one-format2-nonzero-literal-SHP-frame', spriteSource, paletteSource,
      geometry: { canvasWidth: decoded.index.width, canvasHeight: decoded.index.height, frameCount: decoded.index.frames.length, ...decoded.frame },
      consumedBytes: decoded.consumedBytes, trailingBytes: decoded.trailingBytes, pixels: decoded.pixels.length,
      paletteExpansion: 'six-bit-components-shift-left-two; opaque; native loading-function observation',
      indexedPixelSha256: hash(decoded.pixels), rgbaSha256: hash(rgba), paletteRgbaSha256: hash(colors),
      distinctIndices: new Set(decoded.pixels).size, decodedRgbaBytes: rgba.length,
      compatibility: 'Source identity and decoder evidence only; no full sprite/game renderer or native framebuffer comparison' };
  } finally { await reader.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, manifestPath] = process.argv.slice(2);
  if (!directory || !manifestPath || process.argv.length !== 4) throw new Error('Usage: node --import tsx tools/analysis/shp-sample.ts <game-directory> <manifest.json>');
  process.stdout.write(JSON.stringify(await shpSampleReport(directory, await readShpManifest(manifestPath)), null, 2) + '\n');
}
