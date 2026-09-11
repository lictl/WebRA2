// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../GPU_PROVENANCE.md.
// Internal bounded snapshots; only gpu-scene.ts grants presentation factory identity.
import { GPU_DEPTH_MAX, GPU_DEPTH_MIN, GPU_PREPARE_LIMITS, GPU_SCENE_POLICY, GPU_SCENE_TRANSFER_POLICY,
  GPU_TRANSFER_LIMITS, type GpuPrepareLimits, type GpuRasterData, type GpuSceneTransfer, type GpuSpriteResource,
  type GpuTerrainGroup, type GpuTerrainPlacement, type GpuTransferLimits } from './gpu-contracts.ts';
import type { SpriteObject } from './sprite-layer.ts';
import type { TerrainViewport } from './terrain-scene.ts';

export class GpuTransferError extends Error { constructor(readonly code: string) { super(code); this.name = 'GpuTransferError'; } }
function fail(code: string): never { throw new GpuTransferError(code); }
function number(value: unknown, min: number, max: number, code = 'gpu-transfer-number'): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(code);
  return value as number;
}
interface Budget { work: number; strings: number; cap: Readonly<GpuTransferLimits> }
function charge(b: Budget, n: number): void { b.work += n; if (!Number.isSafeInteger(b.work) || b.work > b.cap.work) fail('gpu-transfer-work-budget'); }
function fields(value: unknown, keys: readonly string[], b?: Budget): Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![null, Object.prototype].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) fail('gpu-transfer-fields');
  if (b) charge(b, keys.length);
  const result: Record<string, unknown> = {};
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d) || !d.enumerable) fail('gpu-transfer-fields'); result[key] = d.value; }
  return result;
}
function array(value: unknown, maximum: number, b?: Budget, code = 'gpu-transfer-array'): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(code);
  const n = number(Object.getOwnPropertyDescriptor(value, 'length')?.value, 0, maximum, code);
  if (Reflect.ownKeys(value).length !== n + 1) fail(code); if (b) charge(b, n);
  const result: unknown[] = [];
  for (let i = 0; i < n; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d) || !d.enumerable) fail(code); result.push(d.value); }
  return result;
}
function id(value: unknown, b?: Budget): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:/#-]*$/.test(value)) fail('gpu-transfer-id');
  if (b) { b.strings += value.length; if (b.strings > b.cap.stringBytes) fail('gpu-transfer-string-budget'); }
  return value;
}
function lower(options: Partial<GpuTransferLimits>): GpuTransferLimits {
  if (!options || typeof options !== 'object' || ![null, Object.prototype].includes(Object.getPrototypeOf(options))) fail('gpu-transfer-limits');
  const cap: GpuTransferLimits = { ...GPU_TRANSFER_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('gpu-transfer-limit-key');
    const d = Object.getOwnPropertyDescriptor(options, key); if (!d || !('value' in d)) fail('gpu-transfer-limit');
    cap[key as keyof GpuTransferLimits] = number(d.value, 0, cap[key as keyof GpuTransferLimits], 'gpu-transfer-limit');
  }
  return cap;
}
export const gpuResourceKey = (o: Pick<SpriteObject, 'frameId' | 'paletteId'> & { rowStep: number }): string => JSON.stringify([o.frameId, o.paletteId, o.rowStep]);
const objectKeys = ['id', 'frameId', 'paletteId', 'x', 'y', 'anchorX', 'anchorY', 'depth'] as const;
function objects(input: unknown, maximum: number, coordinate: number, b?: Budget): SpriteObject[] {
  const result: SpriteObject[] = [], ids = new Set<string>();
  for (const raw of array(input, maximum, b, 'sprite-array')) {
    const o = fields(raw, objectKeys, b), d = fields(o.depth, ['base', 'rowStep', 'terrainTie'], b);
    const name = id(o.id, b); if (ids.has(name)) fail('sprite-duplicate-object'); ids.add(name);
    for (const v of [o.x, o.y, o.anchorX, o.anchorY]) if (Object.is(v, -0)) fail('sprite-coordinate-limit');
    if (Object.is(d.base, -0)) fail('sprite-depth-limit'); if (Object.is(d.rowStep, -0)) fail('sprite-depth-policy');
    const rowStep = number(d.rowStep, 0, 1, 'sprite-depth-policy') as 0 | 1;
    if (d.terrainTie !== 'front' && d.terrainTie !== 'behind') fail('sprite-depth-policy');
    result.push(Object.freeze({ id: name, frameId: id(o.frameId, b), paletteId: id(o.paletteId, b),
      x: number(o.x, -coordinate, coordinate, 'sprite-coordinate-limit'), y: number(o.y, -coordinate, coordinate, 'sprite-coordinate-limit'),
      anchorX: number(o.anchorX, -coordinate, coordinate, 'sprite-coordinate-limit'), anchorY: number(o.anchorY, -coordinate, coordinate, 'sprite-coordinate-limit'),
      depth: Object.freeze({ base: number(d.base, -coordinate, coordinate, 'sprite-depth-limit'), rowStep, terrainTie: d.terrainTie }) }));
  }
  result.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0); return result;
}
export interface GpuSpritePlacement { object: SpriteObject; metadata: GpuSpriteResource; left: number; top: number; x0: number; y0: number; x1: number; y1: number }
/** Common compiled/imported geometry policy; it never decodes, remaps or copies a palette per frame. */
export function prepareTransferredSprites(input: unknown, maximum: number, coordinate: number, samplesLimit: number,
  resources: ReadonlyMap<string, GpuSpriteResource>, frameGeometry: ReadonlyMap<string, GpuSpriteResource>, viewport: TerrainViewport): { placements: GpuSpritePlacement[]; samples: number } {
  const captured = objects(input, maximum, coordinate), placements: GpuSpritePlacement[] = []; let samples = 0;
  const { cameraX, cameraY, zoom, width, height } = viewport;
  for (const object of captured) {
    const geometry = frameGeometry.get(object.frameId); if (!geometry) fail('gpu-unprepared-sprite-resource');
    const r = geometry.rectangle, left = object.x - object.anchorX + r.x, top = object.y - object.anchorY + r.y;
    for (const value of [left, top, left + r.width, top + r.height]) number(value, -coordinate, coordinate, 'sprite-coordinate-limit');
    number(object.depth.base + Math.max(0, r.height - 1) * object.depth.rowStep, -coordinate, coordinate, 'sprite-depth-limit');
    const metadata = resources.get(gpuResourceKey({ ...object, rowStep: object.depth.rowStep })); if (!metadata) fail('gpu-unprepared-sprite-resource');
    const x0 = Math.max(0, Math.ceil((left - cameraX) * zoom - 0.5)), y0 = Math.max(0, Math.ceil((top - cameraY) * zoom - 0.5));
    const x1 = Math.min(width, Math.ceil((left + r.width - cameraX) * zoom - 0.5)), y1 = Math.min(height, Math.ceil((top + r.height - cameraY) * zoom - 0.5));
    samples += Math.max(0, x1 - x0) * Math.max(0, y1 - y0); if (samples > samplesLimit) fail('sprite-sample-budget');
    placements.push({ object, metadata, left, top, x0, y0, x1, y1 });
  }
  return { placements, samples };
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const byteLength = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset')!.get!;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')!.get!;
function plane(value: unknown, prototype: object, size: number): Uint8Array | Int32Array {
  try {
    if (!value || Object.getPrototypeOf(value) !== prototype || byteLength.call(value) !== size) fail('gpu-transfer-plane');
    const buffer: unknown = bufferOf.call(value);
    if (!buffer || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || resizable.call(buffer)) fail('gpu-transfer-buffer');
    // A detached zero-sized view must not impersonate a legitimate empty raster.
    ArrayBuffer.prototype.slice.call(buffer, 0, 0);
    const offset = offsetOf.call(value) as number;
    return prototype === Uint8Array.prototype ? new Uint8Array(buffer as ArrayBuffer, offset, size) : new Int32Array(buffer as ArrayBuffer, offset, size / 4);
  } catch (e) { if (e instanceof GpuTransferError) throw e; fail('gpu-transfer-plane'); }
}


/** Capture all descriptors and aggregate sizes before the first resident-plane copy. */
export function captureGpuTransfer(input: unknown, options: Partial<GpuTransferLimits> = {}, ownership: 'owned' | 'borrowed' = 'owned'): GpuSceneTransfer {
  const cap = lower(options), b: Budget = { work: 0, strings: 0, cap };
  const top = fields(input, ['schemaVersion', 'policy', 'scenePolicy', 'limits', 'spriteObjectLimit', 'rasters', 'terrainGroups', 'terrain', 'spriteResources', 'objects'], b);
  if (top.schemaVersion !== 1 || top.policy !== GPU_SCENE_TRANSFER_POLICY || top.scenePolicy !== GPU_SCENE_POLICY) fail('gpu-transfer-policy');
  const sourceLimits = fields(top.limits, Object.keys(GPU_PREPARE_LIMITS), b), limits = { ...GPU_PREPARE_LIMITS } as GpuPrepareLimits;
  for (const k of Object.keys(GPU_PREPARE_LIMITS) as (keyof GpuPrepareLimits)[]) limits[k] = Math.min(number(sourceLimits[k], 0, GPU_PREPARE_LIMITS[k], 'gpu-transfer-limit'), cap[k]);
  const coordinate = limits.coordinate, spriteObjectLimit = top.spriteObjectLimit === null ? null : Math.min(number(top.spriteObjectLimit, 0, GPU_TRANSFER_LIMITS.objects), cap.objects);
  let pixels = 0, bytes = 0;
  const rawRasters = array(top.rasters, limits.rasters, b).map((raw, ordinal) => {
    const r = fields(raw, ['id', 'width', 'height', 'rgba', 'depth', 'minDepth', 'maxDepth'], b);
    if (r.id !== ordinal) fail('gpu-transfer-raster-order');
    const width = number(r.width, 0, 2048), height = number(r.height, 0, 2048), area = width * height;
    if ((width === 0) !== (height === 0)) fail('gpu-transfer-raster-dimensions');
    pixels += area; bytes += area * 8;
    if (pixels > limits.rasterPixels || bytes > limits.rasterBytes) fail('gpu-transfer-raster-budget');
    charge(b, area);
    const minDepth = number(r.minDepth, GPU_DEPTH_MIN, 0), maxDepth = number(r.maxDepth, 0, GPU_DEPTH_MAX);
    return { id: ordinal, width, height, minDepth, maxDepth, rgba: plane(r.rgba, Uint8Array.prototype, area * 4) as Uint8Array,
      depth: plane(r.depth, Int32Array.prototype, area * 4) as Int32Array };
  });
  let rasterOrdinal = 0;
  const terrainGroups: GpuTerrainGroup[] = array(top.terrainGroups, limits.rasters, b).map(raw => {
    const g = fields(raw, ['left', 'top', 'right', 'bottom', 'pieces'], b);
    const left = number(g.left, -coordinate, coordinate), top = number(g.top, -coordinate, coordinate), right = number(g.right, -coordinate, coordinate), bottom = number(g.bottom, -coordinate, coordinate);
    const pieces = array(g.pieces, 2, b).map(raw => {
      const p = fields(raw, ['x', 'y', 'rasterId'], b), x = number(p.x, -coordinate, coordinate), y = number(p.y, -coordinate, coordinate);
      if (p.rasterId !== rasterOrdinal || !rawRasters[rasterOrdinal]) fail('gpu-transfer-raster-reference');
      return Object.freeze({ x, y, rasterId: rasterOrdinal++ });
    });
    if (!pieces.length) fail('gpu-transfer-terrain-pieces');
    const first = pieces[0]!, base = rawRasters[first.rasterId]!;
    if (first.x !== 0 || first.y !== 0 || ![48, 60].includes(base.width) || base.height * 2 !== base.width) fail('gpu-transfer-terrain-base');
    if (left !== Math.min(...pieces.map(p => p.x)) || top !== Math.min(...pieces.map(p => p.y)) ||
      right !== Math.max(...pieces.map(p => p.x + rawRasters[p.rasterId]!.width)) || bottom !== Math.max(...pieces.map(p => p.y + rawRasters[p.rasterId]!.height))) fail('gpu-transfer-terrain-bounds');
    if (pieces.length === 2) { const p = pieces[1]!, r = rawRasters[p.rasterId]!; if (!r.width) fail('gpu-transfer-terrain-extra');
      charge(b, Math.max(0, Math.min(base.width, p.x + r.width) - Math.max(0, p.x)) * Math.max(0, Math.min(base.height, p.y + r.height) - Math.max(0, p.y))); }
    return Object.freeze({ left, top, right, bottom, pieces: Object.freeze(pieces) });
  });
  const usedGroups = new Set<number>(), cells = new Set<number>(); let terrainPieces = 0;
  const terrain: GpuTerrainPlacement[] = array(top.terrain, Math.min(130816, limits.draws), b).map((raw, ordinal) => {
    const t = fields(raw, ['sourceRecord', 'x', 'y', 'assetId', 'subtile', 'left', 'top', 'groundY', 'group'], b);
    if (t.sourceRecord !== ordinal) fail('gpu-transfer-terrain-order');
    const x = number(t.x, 1, 511), y = number(t.y, 1, 511), key = x + y * 512;
    if (cells.has(key)) fail('gpu-transfer-terrain-cell'); cells.add(key);
    const group = number(t.group, 0, terrainGroups.length - 1), g = terrainGroups[group]!; usedGroups.add(group);
    terrainPieces += g.pieces.length; if (terrainPieces > limits.draws) fail('gpu-transfer-draw-budget');
    const left = number(t.left, -coordinate, coordinate), top = number(t.top, -coordinate, coordinate), groundY = number(t.groundY, -coordinate, coordinate);
    for (const value of [left + g.left, top + g.top, left + g.right, top + g.bottom]) number(value, -coordinate, coordinate, 'gpu-transfer-coordinate');
    return Object.freeze({ sourceRecord: t.sourceRecord as number, x, y, assetId: id(t.assetId, b), subtile: number(t.subtile, 0, 255), left, top, groundY, group });
  });
  if (usedGroups.size !== terrainGroups.length) fail('gpu-transfer-unused-terrain');
  const frameMetadata = new Map<string, string>(), framePairs = new Map<string, string>(), paletteIds = new Set<string>(), resources = new Map<string, GpuSpriteResource>();
  const spriteResources: GpuSpriteResource[] = array(top.spriteResources, limits.rasters, b).map(raw => {
    const r = fields(raw, ['frameId', 'paletteId', 'rowStep', 'rasterId', 'assetId', 'frame', 'canvasWidth', 'canvasHeight', 'rectangle'], b);
    if (r.rasterId !== rasterOrdinal || !rawRasters[rasterOrdinal]) fail('gpu-transfer-raster-reference');
    const raster = rawRasters[rasterOrdinal++]!; charge(b, raster.width * raster.height);
    const q = fields(r.rectangle, ['x', 'y', 'width', 'height'], b);
    const rectangle = Object.freeze({ x: number(q.x, 0, 65535), y: number(q.y, 0, 65535), width: number(q.width, 0, 2048), height: number(q.height, 0, 2048) });
    const resource: GpuSpriteResource = Object.freeze({ frameId: id(r.frameId, b), paletteId: id(r.paletteId, b), rowStep: number(r.rowStep, 0, 1) as 0 | 1,
      rasterId: raster.id, assetId: id(r.assetId, b), frame: number(r.frame, 0, 4095), canvasWidth: number(r.canvasWidth, 1, 2048), canvasHeight: number(r.canvasHeight, 1, 2048), rectangle });
    if (rectangle.width !== raster.width || rectangle.height !== raster.height || (rectangle.width && (rectangle.x + rectangle.width > resource.canvasWidth || rectangle.y + rectangle.height > resource.canvasHeight))) fail('gpu-transfer-sprite-geometry');
    const metadata = JSON.stringify([resource.assetId, resource.frame, resource.canvasWidth, resource.canvasHeight, rectangle]);
    if (frameMetadata.has(resource.frameId) && frameMetadata.get(resource.frameId) !== metadata) fail('gpu-transfer-frame-metadata'); frameMetadata.set(resource.frameId, metadata);
    const pair = JSON.stringify([resource.assetId, resource.frame]); if (framePairs.has(pair) && framePairs.get(pair) !== resource.frameId) fail('gpu-transfer-frame-alias'); framePairs.set(pair, resource.frameId);
    paletteIds.add(resource.paletteId); if (frameMetadata.size > 4096 || paletteIds.size > 256) fail('gpu-transfer-sprite-catalog-budget');
    const key = gpuResourceKey(resource); if (resources.has(key)) fail('gpu-transfer-duplicate-resource'); resources.set(key, resource);
    return resource;
  });
  if (rasterOrdinal !== rawRasters.length) fail('gpu-transfer-unused-raster');
  if (spriteObjectLimit === null && spriteResources.length) fail('gpu-transfer-no-sprites');
  const initialObjects = objects(top.objects, spriteObjectLimit ?? 0, coordinate, b), usedResources = new Set<string>();
  if (initialObjects.length + terrainPieces > limits.draws) fail('gpu-transfer-draw-budget');
  for (const o of initialObjects) { const key = gpuResourceKey({ ...o, rowStep: o.depth.rowStep }); if (!resources.has(key)) fail('gpu-transfer-object-reference'); usedResources.add(key); }
  if (usedResources.size !== resources.size) fail('gpu-transfer-unused-resource');
  // Charge immutable metadata/geometry validation before plane allocation.
  charge(b, initialObjects.length);
  prepareTransferredSprites(initialObjects, spriteObjectLimit ?? 0, coordinate, GPU_PREPARE_LIMITS.samples, resources,
    new Map(spriteResources.map(r => [r.frameId, r])), { cameraX: 0, cameraY: 0, zoom: 1, width: 1, height: 1, backgroundRgba: [0, 0, 0, 0] });
  // Recheck intrinsic sizes after all user-controlled descriptors have been captured.
  const rasters: GpuRasterData[] = rawRasters.map(r => {
    const size = r.width * r.height;
    let rgba = plane(r.rgba, Uint8Array.prototype, size * 4) as Uint8Array, depth = plane(r.depth, Int32Array.prototype, size * 4) as Int32Array;
    try { if (ownership === 'owned') { const colors = new Uint8Array(size * 4), depths = new Int32Array(size);
      Uint8Array.prototype.set.call(colors, rgba); Int32Array.prototype.set.call(depths, depth); rgba = colors; depth = depths; } }
    catch (e) { if (e instanceof GpuTransferError) throw e; fail('gpu-transfer-plane'); }
    for (let i = 0; i < size; i++) { const a = rgba[i * 4 + 3]!, d = depth[i]!;
      if ((a !== 0 && a !== 255) || d < r.minDepth || d > r.maxDepth || (a === 0 && (d !== 0 || rgba[i * 4] !== 0 || rgba[i * 4 + 1] !== 0 || rgba[i * 4 + 2] !== 0))) fail('gpu-transfer-raster-value'); }
    return Object.freeze({ id: r.id, width: r.width, height: r.height, minDepth: r.minDepth, maxDepth: r.maxDepth, rgba, depth });
  });
  for (const g of terrainGroups) if (g.pieces.length === 2) {
    const base = rasters[g.pieces[0]!.rasterId]!, p = g.pieces[1]!, extra = rasters[p.rasterId]!;
    for (let y = Math.max(0, p.y); y < Math.min(base.height, p.y + extra.height); y++) for (let x = Math.max(0, p.x); x < Math.min(base.width, p.x + extra.width); x++) {
      const a = y * base.width + x, c = (y - p.y) * extra.width + x - p.x;
      if (base.depth[a] !== extra.depth[c]) fail('gpu-transfer-patch-overlap');
      for (let k = 0; k < 4; k++) if (base.rgba[a * 4 + k] !== extra.rgba[c * 4 + k]) fail('gpu-transfer-patch-overlap');
    }
  }
  for (const r of spriteResources) { const raster = rasters[r.rasterId]!;
    for (let i = 0; i < raster.depth.length; i++) if (raster.rgba[i * 4 + 3] !== 0 && raster.depth[i] !== Math.floor(i / raster.width) * r.rowStep) fail('gpu-transfer-sprite-depth'); }
  return Object.freeze({ schemaVersion: 1, policy: GPU_SCENE_TRANSFER_POLICY, scenePolicy: GPU_SCENE_POLICY, limits: Object.freeze(limits), spriteObjectLimit,
    rasters: Object.freeze(rasters), terrainGroups: Object.freeze(terrainGroups), terrain: Object.freeze(terrain), spriteResources: Object.freeze(spriteResources), objects: Object.freeze(initialObjects) });
}


/** Frozen descriptor snapshot with borrowed ordinary buffer views. Import must still own the planes. */
export function validateGpuSceneTransfer(input: unknown, options: Partial<GpuTransferLimits> = {}): GpuSceneTransfer {
  return captureGpuTransfer(input, options, 'borrowed');
}
/** Scalar snapshot only. Resident frame/palette/geometry references are checked by prepareGpuFrame. */
export function captureGpuSpriteObjects(input: unknown, options: Partial<GpuTransferLimits> = {}): readonly SpriteObject[] {
  const cap = lower(options), b: Budget = { work: 0, strings: 0, cap };
  return Object.freeze(objects(input, cap.objects, cap.coordinate, b));
}
