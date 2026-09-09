// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors; OpenRA Developers and Contributors.
// Explicit CPU placement/palette/depth policy. See ../SPRITE_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { createRuntimeShp, SHP_RUNTIME_LIMITS, type RuntimeShp, type RuntimeShpFrame } from '../../formats/src/shp-runtime.ts';
import type { TerrainFrame, TerrainPick, TerrainViewport } from './terrain-scene.ts';

export const SPRITE_LAYER_POLICY = 'webra2-sprite-layer-1' as const;
export const SPRITE_LAYER_LIMITS = Object.freeze({ assets: 1024, frames: 4096, indexFrames: 65536,
  sourceBytes: 128 * 1024 * 1024, encodedBytes: 128 * 1024 * 1024, decodedBytes: 64 * 1024 * 1024, palettes: 256, objects: 32768 });
type Limits = { -readonly [K in keyof typeof SPRITE_LAYER_LIMITS]: number };
export interface SpriteAtlasInput {
  readonly assets: readonly Readonly<{ id: string; sha256: string; bytes: Uint8Array }>[];
  readonly frames: readonly Readonly<{ id: string; assetId: string; frame: number }>[];
}
export interface SpriteAtlasFrame {
  readonly id: string; readonly assetId: string; readonly frame: number;
  readonly canvasWidth: number; readonly canvasHeight: number; readonly rectangle: RuntimeShpFrame;
}
export interface SpriteAtlas {
  readonly policy: typeof SPRITE_LAYER_POLICY; readonly nativeBehaviorVerified: false;
  readonly assets: readonly Readonly<{ id: string; sha256: string; size: number; verification: 'sha256-verified' }>[];
  readonly frames: readonly SpriteAtlasFrame[];
  readonly allocations: Readonly<{ sourceSnapshotBytes: number; temporarySourceBytesMax: number;
    decodedPixelBytes: number; temporaryFrameBytesMax: number; indexedFrames: number; encodedFrameBytes: number }>;
  readonly diagnostics: readonly Readonly<{ code: string; count: number }>[];
}
export interface SpritePalette {
  readonly id: string; readonly rgba: Uint8Array; readonly remap: Uint8Array | null;
  /** Original source index discarded before remap; null retains all source indices. */
  readonly transparentIndex: number | null;
}
export interface SpriteObject {
  readonly id: string; readonly frameId: string; readonly paletteId: string;
  /** Scene-pixel position of the caller's canvas-space anchor. Integer pixel policy. */
  readonly x: number; readonly y: number; readonly anchorX: number; readonly anchorY: number;
  readonly depth: Readonly<{ base: number; rowStep: 0 | 1; terrainTie: 'front' | 'behind' }>;
}
export interface SpriteBatch { readonly atlas: SpriteAtlas; readonly palettes: readonly SpritePalette[]; readonly objects: readonly SpriteObject[] }
export interface SpritePick {
  readonly kind: 'object'; readonly id: string; readonly frameId: string; readonly assetId: string; readonly frame: number;
  readonly paletteId: string; readonly canvasX: number; readonly canvasY: number;
  readonly worldX: number; readonly worldY: number; readonly depth: number;
}
export interface SpriteTerrainFrame extends Omit<TerrainFrame, 'pick' | 'allocations'> {
  readonly policy: typeof SPRITE_LAYER_POLICY;
  readonly allocations: TerrainFrame['allocations'] & Readonly<{ objectOwnerBytes: number; spriteSamples: number; paletteBytes: number; objects: number }>;
  pick(viewX: number, viewY: number): (TerrainPick & { readonly kind: 'terrain' }) | SpritePick | null;
}
export class SpriteLayerError extends Error { constructor(readonly code: string) { super(code); this.name = 'SpriteLayerError'; } }
function fail(code: string): never { throw new SpriteLayerError(code); }
function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('sprite-record');
}
function fields(value: unknown, names: readonly string[]): asserts value is Record<string, unknown> {
  record(value); if (Reflect.ownKeys(value).length !== names.length) fail('sprite-fields');
  for (const name of names) { const d = Object.getOwnPropertyDescriptor(value, name); if (!d || !('value' in d) || !d.enumerable) fail('sprite-fields'); }
}
function array(value: unknown, max: number): asserts value is readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) fail('sprite-array');
  for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d) || !d.enumerable) fail('sprite-array'); }
}
function integer(value: unknown, min: number, max: number, code = 'sprite-number'): asserts value is number {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < min || (value as number) > max) fail(code);
}
function id(value: unknown): asserts value is string { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(value)) fail('sprite-id'); }
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const byteLength = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
function sizeOf(bytes: Uint8Array, min: number, max: number): number {
  if (!bytes || Object.getPrototypeOf(bytes) !== Uint8Array.prototype) fail('sprite-byte-input');
  const size = byteLength.call(bytes) as number, buffer: unknown = bufferOf.call(bytes);
  if (!buffer || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')!.get!.call(buffer) || size < min || size > max) fail('sprite-byte-limit');
  return size;
}
function copy(bytes: Uint8Array, size: number): Uint8Array { const owned = new Uint8Array(size); Uint8Array.prototype.set.call(owned, bytes); return owned; }
function digest(bytes: Uint8Array): string { return Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join(''); }
function limits(options: Partial<Limits>): Limits {
  record(options); const cap: Limits = { ...SPRITE_LAYER_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('sprite-limit');
    const d = Object.getOwnPropertyDescriptor(options, key)!; if (!('value' in d)) fail('sprite-limit');
    integer(d.value, 0, cap[key as keyof Limits], 'sprite-limit'); cap[key as keyof Limits] = d.value;
  }
  return cap;
}
interface OwnedFrame { metadata: SpriteAtlasFrame; pixels: Uint8Array }
const atlases = new WeakMap<SpriteAtlas, { frames: Map<string, OwnedFrame>; cap: Limits }>();

/** Own selected source-hashed frames only; no texture packing, native sequence selection or decoded output exposure. */
export function createSpriteAtlas(input: SpriteAtlasInput, options: Partial<Limits> = {}): SpriteAtlas {
  const cap = limits(options); fields(input, ['assets', 'frames']); array(input.assets, cap.assets); array(input.frames, cap.frames);
  const sources = new Map<string, { id: string; sha256: string; bytes: Uint8Array; size: number }>();
  let sourceBytes = 0, temporarySourceBytesMax = 0;
  for (const asset of input.assets) {
    fields(asset, ['id', 'sha256', 'bytes']); id(asset.id);
    if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) fail('sprite-sha256');
    if (sources.has(asset.id)) fail('sprite-duplicate-asset');
    const size = sizeOf(asset.bytes, 8, SHP_RUNTIME_LIMITS.fileBytes);
    sourceBytes += size; if (sourceBytes > cap.sourceBytes) fail('sprite-source-budget');
    temporarySourceBytesMax = Math.max(temporarySourceBytesMax, size);
    sources.set(asset.id, { id: asset.id, sha256: asset.sha256, bytes: asset.bytes, size });
  }
  const selections = new Map<string, { id: string; assetId: string; frame: number }>(), used = new Set<string>(), pairs = new Set<string>();
  for (const selected of input.frames) {
    fields(selected, ['id', 'assetId', 'frame']); id(selected.id); id(selected.assetId); integer(selected.frame, 0, SHP_RUNTIME_LIMITS.frames - 1);
    if (selections.has(selected.id)) fail('sprite-duplicate-frame');
    if (!sources.has(selected.assetId)) fail('sprite-missing-asset');
    const pair = selected.assetId + '\0' + selected.frame;
    if (pairs.has(pair)) fail('sprite-duplicate-selection'); pairs.add(pair); used.add(selected.assetId);
    selections.set(selected.id, { id: selected.id, assetId: selected.assetId, frame: selected.frame });
  }
  if (used.size !== sources.size) fail('sprite-unused-asset');
  const readers = new Map<string, RuntimeShp>(), assets: SpriteAtlas['assets'][number][] = [];
  let indexedFrames = 0;
  // All source sizes/selection counts pass before copying or hashing any source.
  for (const asset of sources.values()) {
    const bytes = copy(asset.bytes, asset.size);
    if (digest(bytes) !== asset.sha256) fail('sprite-source-identity');
    const count = new DataView(bytes.buffer).getUint16(6, true);
    indexedFrames += count; if (indexedFrames > cap.indexFrames) fail('sprite-index-budget');
    readers.set(asset.id, createRuntimeShp(bytes));
    assets.push(Object.freeze({ id: asset.id, sha256: asset.sha256, size: asset.size, verification: 'sha256-verified' }));
  }
  let decodedBytes = 0, temporaryFrameBytesMax = 0, encodedFrameBytes = 0;
  const frames: SpriteAtlasFrame[] = [];
  for (const selected of selections.values()) {
    const reader = readers.get(selected.assetId)!, rectangle = reader.frames[selected.frame];
    if (!rectangle) fail('sprite-missing-frame');
    encodedFrameBytes += rectangle.dataEnd - rectangle.dataOffset;
    if (encodedFrameBytes > cap.encodedBytes) fail('sprite-encoded-budget');
    const area = rectangle.width * rectangle.height;
    decodedBytes += area; if (decodedBytes > cap.decodedBytes) fail('sprite-decoded-budget');
    temporaryFrameBytesMax = Math.max(temporaryFrameBytesMax, area);
    frames.push(Object.freeze({ ...selected, canvasWidth: reader.width, canvasHeight: reader.height, rectangle }));
  }
  const owned = new Map<string, OwnedFrame>(); let clipped = 0, trailing = 0, unknown = 0, empty = 0;
  // Aggregate selected pixel/index work passes before the first decode; each selection is decoded once.
  for (const metadata of frames) {
    const decoded = readers.get(metadata.assetId)!.decodeFrame(metadata.frame);
    owned.set(metadata.id, { metadata, pixels: decoded.copyPixels() });
    clipped += decoded.clippedTerminalZeroRuns; trailing += decoded.trailingBytes;
    if (metadata.rectangle.unknownWord || metadata.rectangle.reservedWord) unknown++;
    if (metadata.rectangle.empty) empty++;
  }
  const diagnostics = [{ code: 'native-sprite-policy-unverified', count: 1 },
    { code: 'clipped-terminal-zero-runs', count: clipped }, { code: 'selected-trailing-bytes-not-interpreted', count: trailing },
    { code: 'selected-auxiliary-words-not-interpreted', count: unknown }, { code: 'selected-empty-frames', count: empty }]
    .filter(row => row.count).map(row => Object.freeze(row));
  const atlas: SpriteAtlas = Object.freeze({ policy: SPRITE_LAYER_POLICY, nativeBehaviorVerified: false,
    assets: Object.freeze(assets.sort((a, b) => compare(a.id, b.id))), frames: Object.freeze(frames.sort((a, b) => compare(a.id, b.id))),
    allocations: Object.freeze({ sourceSnapshotBytes: sourceBytes, temporarySourceBytesMax, decodedPixelBytes: decodedBytes, temporaryFrameBytesMax, indexedFrames, encodedFrameBytes }),
    diagnostics: Object.freeze(diagnostics) });
  atlases.set(atlas, { frames: owned, cap }); return atlas;
}

interface OwnedPalette { rgba: Uint8Array; remap: Uint8Array | null; transparentIndex: number | null }
interface Placement { object: SpriteObject; frame: OwnedFrame; palette: OwnedPalette; left: number; top: number; x0: number; y0: number; x1: number; y1: number }
/** Internal scene bridge. Only scalar fragments leave the owned atlas; no retained pixel/palette array is exposed. */
export function prepareSpriteBatch(batch: SpriteBatch, viewport: TerrainViewport, coordinate: number, sampleLimit: number) {
  fields(batch, ['atlas', 'palettes', 'objects']); const atlas = atlases.get(batch.atlas); if (!atlas) fail('sprite-atlas');
  integer(coordinate, 0, 1048576, 'sprite-coordinate-limit'); integer(sampleLimit, 0, 64 * 1024 * 1024, 'sprite-sample-budget');
  fields(viewport, ['cameraX', 'cameraY', 'zoom', 'width', 'height', 'backgroundRgba']);
  const { cameraX, cameraY, zoom, width, height } = viewport;
  if (typeof cameraX !== 'number' || typeof cameraY !== 'number' || !Number.isFinite(cameraX) || !Number.isFinite(cameraY) || Math.abs(cameraX) > coordinate || Math.abs(cameraY) > coordinate || ![0.5, 1, 2, 4].includes(zoom)) fail('sprite-camera');
  integer(width, 1, 2048); integer(height, 1, 2048);
  array(batch.palettes, atlas.cap.palettes); array(batch.objects, atlas.cap.objects);
  const palettes = new Map<string, OwnedPalette>(); let paletteBytes = 0;
  for (const palette of batch.palettes) {
    fields(palette, ['id', 'rgba', 'remap', 'transparentIndex']); id(palette.id);
    if (palettes.has(palette.id)) fail('sprite-duplicate-palette');
    sizeOf(palette.rgba, 1024, 1024); if (palette.remap !== null) sizeOf(palette.remap, 256, 256);
    if (palette.transparentIndex !== null) integer(palette.transparentIndex, 0, 255, 'sprite-transparent-index');
    palettes.set(palette.id, { rgba: palette.rgba, remap: palette.remap, transparentIndex: palette.transparentIndex });
    paletteBytes += 1024 + (palette.remap === null ? 0 : 256);
  }
  const usedPalettes = new Set<string>(), objectIds = new Set<string>(), placements: Placement[] = [];
  let samples = 0;
  for (const input of batch.objects) {
    fields(input, ['id', 'frameId', 'paletteId', 'x', 'y', 'anchorX', 'anchorY', 'depth']); id(input.id); id(input.frameId); id(input.paletteId);
    if (objectIds.has(input.id)) fail('sprite-duplicate-object'); objectIds.add(input.id);
    const frame = atlas.frames.get(input.frameId), palette = palettes.get(input.paletteId);
    if (!frame || !palette) fail('sprite-missing-reference'); usedPalettes.add(input.paletteId);
    for (const value of [input.x, input.y, input.anchorX, input.anchorY]) integer(value, -coordinate, coordinate, 'sprite-coordinate-limit');
    fields(input.depth, ['base', 'rowStep', 'terrainTie']); integer(input.depth.base, -coordinate, coordinate, 'sprite-depth-limit');
    if (![0, 1].includes(input.depth.rowStep) || Object.is(input.depth.rowStep, -0) || !['front', 'behind'].includes(input.depth.terrainTie)) fail('sprite-depth-policy');
    const depth = Object.freeze({ base: input.depth.base, rowStep: input.depth.rowStep, terrainTie: input.depth.terrainTie });
    const object = Object.freeze({ id: input.id, frameId: input.frameId, paletteId: input.paletteId, x: input.x, y: input.y, anchorX: input.anchorX, anchorY: input.anchorY, depth });
    const r = frame.metadata.rectangle, left = input.x - input.anchorX + r.x, top = input.y - input.anchorY + r.y;
    for (const value of [left, top, left + r.width, top + r.height]) integer(value, -coordinate, coordinate, 'sprite-coordinate-limit');
    integer(depth.base + Math.max(0, r.height - 1) * depth.rowStep, -coordinate, coordinate, 'sprite-depth-limit');
    const x0 = Math.max(0, Math.ceil((left - cameraX) * zoom - 0.5)), y0 = Math.max(0, Math.ceil((top - cameraY) * zoom - 0.5));
    const x1 = Math.min(width, Math.ceil((left + r.width - cameraX) * zoom - 0.5)), y1 = Math.min(height, Math.ceil((top + r.height - cameraY) * zoom - 0.5));
    samples += Math.max(0, x1 - x0) * Math.max(0, y1 - y0); if (samples > sampleLimit) fail('sprite-sample-budget');
    placements.push({ object, frame, palette, left, top, x0, y0, x1, y1 });
  }
  if (usedPalettes.size !== palettes.size) fail('sprite-unused-palette');
  for (const palette of palettes.values()) {
    palette.rgba = copy(palette.rgba, 1024); palette.remap = palette.remap === null ? null : copy(palette.remap, 256);
    for (let i = 3; i < 1024; i += 4) if (palette.rgba[i] !== 0 && palette.rgba[i] !== 255) fail('sprite-palette-alpha');
  }
  placements.sort((a, b) => compare(a.object.id, b.object.id));
  return Object.freeze({ samples, paletteBytes, objects: placements.length,
    /** The callback receives opaque RGBA components; transparent fragments never invoke it. */
    paint(write: (at: number, depth: number, object: number, front: boolean, r: number, g: number, b: number) => void): void {
      for (let ordinal = 0; ordinal < placements.length; ordinal++) {
        const p = placements[ordinal]!, r = p.frame.metadata.rectangle;
        for (let y = p.y0; y < p.y1; y++) {
          const sy = Math.floor(cameraY + (y + 0.5) / zoom) - p.top, candidateDepth = p.object.depth.base + sy * p.object.depth.rowStep;
          for (let x = p.x0; x < p.x1; x++) {
            const sx = Math.floor(cameraX + (x + 0.5) / zoom) - p.left, original = p.frame.pixels[sy * r.width + sx]!;
            if (original === p.palette.transparentIndex) continue;
            const mapped = p.palette.remap === null ? original : p.palette.remap[original]!, offset = mapped * 4;
            if (p.palette.rgba[offset + 3] === 0) continue;
            write(y * width + x, candidateDepth, ordinal, p.object.depth.terrainTie === 'front', p.palette.rgba[offset]!, p.palette.rgba[offset + 1]!, p.palette.rgba[offset + 2]!);
          }
        }
      }
    },
    pick(ordinal: number, worldX: number, worldY: number, depth: number): SpritePick {
      integer(ordinal, 0, placements.length - 1, 'sprite-pick-object'); const p = placements[ordinal]!;
      return Object.freeze({ kind: 'object', id: p.object.id, frameId: p.object.frameId, assetId: p.frame.metadata.assetId, frame: p.frame.metadata.frame,
        paletteId: p.object.paletteId, canvasX: worldX - p.object.x + p.object.anchorX, canvasY: worldY - p.object.y + p.object.anchorY, worldX, worldY, depth });
    },
  });
}
