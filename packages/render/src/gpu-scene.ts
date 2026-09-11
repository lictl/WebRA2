// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../GPU_PROVENANCE.md.
import { describeTerrainRasters, type TerrainPick, type TerrainScene, type TerrainViewport } from './terrain-scene.ts';
import { describeSpriteRasters, type SpriteBatch, type SpriteObject, type SpritePick } from './sprite-layer.ts';
import { captureGpuTransfer, gpuResourceKey, prepareTransferredSprites, type GpuSpritePlacement, type GpuSpritePreparationCache } from './gpu-transfer.ts';
export { validateGpuSceneTransfer, captureGpuSpriteObjects } from './gpu-transfer.ts';
import { GPU_SCENE_TRANSFER_POLICY, GPU_DEPTH_MAX, GPU_DEPTH_MIN, GPU_DRAW_STRIDE, GPU_PREPARE_LIMITS, GPU_SCENE_POLICY,
  type GpuFrame, type GpuFrameData, type GpuPrepareLimits, type GpuRasterData, type GpuScene, type GpuSceneData, type GpuSceneTransfer, type GpuSpriteResource, type GpuTransferLimits } from './gpu-contracts.ts';

export class GpuSceneError extends Error { constructor(readonly code: string) { super(code); this.name = 'GpuSceneError'; } }
function fail(code: string): never { throw new GpuSceneError(code); }
function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('gpu-record');
}
function fields(value: unknown, keys: readonly string[]): void {
  record(value); if (Reflect.ownKeys(value).length !== keys.length) fail('gpu-fields');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d)) fail('gpu-fields'); }
}
function integer(value: unknown, min: number, max: number, code: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(code);
}
function limits(options: Partial<GpuPrepareLimits>): GpuPrepareLimits {
  record(options); const cap: GpuPrepareLimits = { ...GPU_PREPARE_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('gpu-limit-key');
    const d = Object.getOwnPropertyDescriptor(options, key)!; if (!('value' in d)) fail('gpu-limit');
    integer(d.value, 0, cap[key as keyof GpuPrepareLimits], 'gpu-limit'); cap[key as keyof GpuPrepareLimits] = d.value;
  }
  return cap;
}
interface OwnedScene {
  spritePreparations: GpuSpritePreparationCache; cap: Readonly<GpuPrepareLimits>; rasters: readonly GpuRasterData[]; packet: GpuSceneTransfer;
  resources: ReadonlyMap<string, GpuSpriteResource>; frameGeometry: ReadonlyMap<string, GpuSpriteResource>;
}
interface OwnedFrame { packet: GpuFrameData; objects: GpuSpritePlacement[] }
const scenes = new WeakMap<GpuScene, OwnedScene>(), frames = new WeakMap<GpuFrame, OwnedFrame>();
function sceneData(scene: GpuScene): OwnedScene { const data = scenes.get(scene); if (!data) fail('gpu-scene-identity'); return data; }
function frameData(frame: GpuFrame): OwnedFrame { const data = frames.get(frame); if (!data) fail('gpu-frame-identity'); return data; }

/** Expand selected TMP and (SHP frame, palette, rowStep) resources once. No GL or simulation dependency. */
export function compileGpuScene(terrainScene: TerrainScene, batch?: SpriteBatch, options: Partial<GpuPrepareLimits> = {}): GpuScene {
  const cap = limits(options), terrain = describeTerrainRasters(terrainScene);
  for (const key of ['samples', 'viewportDimension', 'viewportPixels', 'coordinate'] as const) cap[key] = Math.min(cap[key], terrain.limits[key]);
  for (const p of terrain.placements) {
    const sprite = terrain.sprites[p.sprite]!;
    for (const coordinate of [p.left, p.top, p.left + sprite.left, p.top + sprite.top,
      p.left + sprite.right, p.top + sprite.bottom, sprite.left, sprite.top, sprite.right, sprite.bottom]) {
      integer(coordinate, -cap.coordinate, cap.coordinate, 'gpu-coordinate-limit');
    }
  }
  const sprites = batch === undefined ? null : describeSpriteRasters(batch, cap.coordinate);
  const sources = [...terrain.sprites.flatMap(s => s.patches), ...(sprites?.resources ?? [])];
  if (sources.length > cap.rasters) fail('gpu-raster-count');
  let pixels = 0;
  for (const source of sources) {
    pixels += source.width * source.height;
    if (!Number.isSafeInteger(pixels) || pixels > cap.rasterPixels || pixels * 8 > cap.rasterBytes) fail('gpu-raster-budget');
  }
  const terrainPieces = terrain.placements.reduce((n, p) => n + terrain.sprites[p.sprite]!.patches.length, 0);
  if (terrainPieces + (sprites?.objects.length ?? 0) > cap.draws) fail('gpu-draw-budget');
  // All aggregate expanded plane sizes pass before the first raster allocation.
  const rasters = sources.map((source, id): GpuRasterData => Object.freeze({ id, width: source.width, height: source.height, ...source.copy() }));
  let rasterId = 0;
  const terrainGroups = terrain.sprites.map(s => Object.freeze({ left: s.left, top: s.top, right: s.right, bottom: s.bottom,
    pieces: Object.freeze(s.patches.map(p => Object.freeze({ x: p.x, y: p.y, rasterId: rasterId++ }))) }));
  const neutral: TerrainViewport = { cameraX: 0, cameraY: 0, zoom: 1, width: 1, height: 1, backgroundRgba: [0, 0, 0, 0] };
  const initial = sprites?.prepare(sprites.objects, neutral, 64 * 1024 * 1024), variants = new Map<string, GpuSpriteResource>();
  for (const p of initial?.placements ?? []) {
    const rowStep = p.object.depth.rowStep, key = gpuResourceKey({ ...p.object, rowStep }); if (variants.has(key)) continue;
    const m = p.metadata, r = m.rectangle;
    variants.set(key, Object.freeze({ frameId: p.object.frameId, paletteId: p.object.paletteId, rowStep, rasterId: rasterId++,
      assetId: m.assetId, frame: m.frame, canvasWidth: m.canvasWidth, canvasHeight: m.canvasHeight,
      rectangle: Object.freeze({ x: r.x, y: r.y, width: r.width, height: r.height }) }));
  }
  const packet: GpuSceneTransfer = Object.freeze({ schemaVersion: 1, policy: GPU_SCENE_TRANSFER_POLICY, scenePolicy: GPU_SCENE_POLICY,
    limits: Object.freeze(cap), spriteObjectLimit: sprites?.objectLimit ?? null, rasters: Object.freeze(rasters), terrainGroups: Object.freeze(terrainGroups),
    terrain: Object.freeze(terrain.placements.map(p => Object.freeze({ sourceRecord: p.sourceRecord, x: p.x, y: p.y, assetId: p.assetId, subtile: p.subtile,
      left: p.left, top: p.top, groundY: p.groundY, group: p.sprite }))), spriteResources: Object.freeze([...variants.values()]),
    objects: Object.freeze(sprites?.objects ?? []) });
  // The original bridges already own the resolved planes. Shared validation retains
  // new native views over those buffers, without a second resident raster copy.
  return registerScene(captureGpuTransfer(packet, {}, 'borrowed'));
}
function registerScene(packet: GpuSceneTransfer): GpuScene {
  const pixels = packet.rasters.reduce((n, r) => n + r.width * r.height, 0);
  const terrainPieces = packet.terrain.reduce((n, p) => n + packet.terrainGroups[p.group]!.pieces.length, 0);
  const scene: GpuScene = Object.freeze({ policy: GPU_SCENE_POLICY, nativeBehaviorVerified: false,
    allocations: Object.freeze({ rasterCount: packet.rasters.length, rasterPixels: pixels, rasterBytes: pixels * 8, terrainPieces, objects: packet.objects.length }) });
  scenes.set(scene, { spritePreparations: new WeakMap(), packet, cap: packet.limits, rasters: packet.rasters,
    resources: new Map(packet.spriteResources.map(r => [gpuResourceKey(r), r])), frameGeometry: new Map(packet.spriteResources.map(r => [r.frameId, r])) });
  return scene;
}
/** Detached, function-free resident resources. Sending its buffers may detach only the exported packet. */
export function exportGpuScene(scene: GpuScene): GpuSceneTransfer { return captureGpuTransfer(sceneData(scene).packet); }
/** Own all imported planes; valid presentation packets grant no source or simulation authority. */
export function importGpuScene(packet: unknown, options: Partial<GpuTransferLimits> = {}): GpuScene { return registerScene(captureGpuTransfer(packet, options)); }


function viewportCopy(request: TerrainViewport, cap: Readonly<GpuPrepareLimits>): TerrainViewport {
  fields(request, ['cameraX', 'cameraY', 'zoom', 'width', 'height', 'backgroundRgba']);
  const { cameraX, cameraY, zoom, width, height } = request;
  if (typeof cameraX !== 'number' || typeof cameraY !== 'number' || !Number.isFinite(cameraX) || !Number.isFinite(cameraY) ||
    Math.abs(cameraX) > cap.coordinate || Math.abs(cameraY) > cap.coordinate || ![0.5, 1, 2, 4].includes(zoom)) fail('gpu-camera');
  integer(width, 1, cap.viewportDimension, 'gpu-viewport'); integer(height, 1, cap.viewportDimension, 'gpu-viewport');
  if (width * height > cap.viewportPixels) fail('gpu-viewport');
  const bg = request.backgroundRgba;
  if (!Array.isArray(bg) || Object.getPrototypeOf(bg) !== Array.prototype || Object.getOwnPropertyDescriptor(bg, 'length')?.value !== 4 || Reflect.ownKeys(bg).length !== 5) fail('gpu-background');
  const background: number[] = [];
  for (let i = 0; i < 4; i++) { const d = Object.getOwnPropertyDescriptor(bg, String(i)); if (!d || !('value' in d)) fail('gpu-background'); integer(d.value, 0, 255, 'gpu-background'); background.push(d.value); }
  return Object.freeze({ cameraX, cameraY, zoom, width, height, backgroundRgba: Object.freeze(background) as unknown as TerrainViewport['backgroundRgba'] });
}

/** Camera sampling is evaluated in JS binary64 once per output axis, never rounded to a GPU float camera. */
export function prepareGpuFrame(scene: GpuScene, request: TerrainViewport, objects?: readonly SpriteObject[]): GpuFrame {
  const data = sceneData(scene), cap = data.cap, viewport = viewportCopy(request, cap);
  const resident = data.packet;
  if (resident.spriteObjectLimit === null && objects !== undefined) fail('gpu-no-sprite-catalog');
  const sprites = resident.spriteObjectLimit === null ? null : prepareTransferredSprites(objects ?? resident.objects, resident.spriteObjectLimit, cap.coordinate, cap.samples, data.resources, data.frameGeometry, viewport, data.spritePreparations);
  const draws: number[] = []; let samples = 0, cpuSamples = sprites?.samples ?? 0;
  const { cameraX, cameraY, zoom, width, height } = viewport;
  const bounds = (left: number, top: number, right: number, bottom: number): [number, number, number, number] => [
    Math.max(0, Math.ceil((left - cameraX) * zoom - 0.5)), Math.max(0, Math.ceil((top - cameraY) * zoom - 0.5)),
    Math.min(width, Math.ceil((right - cameraX) * zoom - 0.5)), Math.min(height, Math.ceil((bottom - cameraY) * zoom - 0.5))];
  const add = (left: number, top: number, rasterId: number, depthBase: number, owner: number, kind: number, front: number): void => {
    const raster = data.rasters[rasterId]!;
    integer(depthBase + raster.minDepth, GPU_DEPTH_MIN, GPU_DEPTH_MAX, 'gpu-depth-range');
    integer(depthBase + raster.maxDepth, GPU_DEPTH_MIN, GPU_DEPTH_MAX, 'gpu-depth-range');
    const [x0, y0, x1, y1] = bounds(left, top, left + raster.width, top + raster.height);
    if (x0 >= x1 || y0 >= y1) return;
    samples += (x1 - x0) * (y1 - y0); if (samples > cap.samples) fail('gpu-sample-budget');
    if (draws.length / GPU_DRAW_STRIDE >= cap.draws) fail('gpu-draw-budget');
    draws.push(x0, y0, x1, y1, left, top, rasterId, depthBase, owner, kind, front, 0);
  };
  for (const p of resident.terrain) {
    const sprite = resident.terrainGroups[p.group]!;
    const [x0, y0, x1, y1] = bounds(p.left + sprite.left, p.top + sprite.top, p.left + sprite.right, p.top + sprite.bottom);
    cpuSamples += Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    if (cpuSamples > cap.samples) fail('gpu-cpu-reference-sample-budget');
    if (x0 >= x1 || y0 >= y1) continue;
    for (const piece of sprite.pieces) add(p.left + piece.x, p.top + piece.y, piece.rasterId, p.groundY, p.sourceRecord, 1, 0);
  }
  const terrainDraws = draws.length / GPU_DRAW_STRIDE, objectPlacements = sprites?.placements ?? [];
  for (let i = 0; i < objectPlacements.length; i++) {
    const p = objectPlacements[i]!;
    add(p.left, p.top, p.metadata.rasterId, p.object.depth.base, i, 2, p.object.depth.terrainTie === 'front' ? 1 : 0);
  }
  const sampleX = new Int32Array(width), sampleY = new Int32Array(height), packed = Int32Array.from(draws);
  for (let x = 0; x < width; x++) sampleX[x] = Math.floor(cameraX + (x + 0.5) / zoom);
  for (let y = 0; y < height; y++) sampleY[y] = Math.floor(cameraY + (y + 0.5) / zoom);
  const frame: GpuFrame = Object.freeze({ scene, viewport, allocations: Object.freeze({ draws: draws.length / GPU_DRAW_STRIDE,
    terrainDraws, objects: objectPlacements.length, samples, axisBytes: sampleX.byteLength + sampleY.byteLength, drawBytes: packed.byteLength }) });
  frames.set(frame, { objects: objectPlacements, packet: { frame, scene, viewport, sampleX, sampleY, draws: packed, terrainDraws } }); return frame;
}

/** Detached arrays. Mutations cannot alter future uploads, CPU composition, or frame picking. */
export function copyGpuSceneData(scene: GpuScene): GpuSceneData {
  const data = sceneData(scene); return { scene, limits: data.cap,
    rasters: data.rasters.map(r => ({ ...r, rgba: r.rgba.slice(), depth: r.depth.slice() })) };
}
/** Authenticate an existing factory-owned value without copying resident or frame planes. */
export function assertGpuScene(scene: GpuScene): void { sceneData(scene); }
export function assertGpuFrame(frame: GpuFrame): void { frameData(frame); }
export function copyGpuFrameData(frame: GpuFrame): GpuFrameData {
  const { packet: p } = frameData(frame); return { ...p, sampleX: p.sampleX.slice(), sampleY: p.sampleY.slice(), draws: p.draws.slice() };
}

/** Visit one pixel's candidate texels in source order without exposing or copying owned planes. */
export function visitGpuFramePixel(frame: GpuFrame, viewX: number, viewY: number,
  visit: (rasterId: number, texelIndex: number, depthBase: number, owner: number, kind: 1 | 2, front: boolean) => void,
  maxDraws: number = GPU_PREPARE_LIMITS.draws): boolean {
  const { packet } = frameData(frame), scene = sceneData(packet.scene), v = packet.viewport;
  integer(maxDraws, 0, GPU_PREPARE_LIMITS.draws, 'gpu-pick-draw-limit');
  if (packet.draws.length / GPU_DRAW_STRIDE > maxDraws) fail('gpu-pick-draw-budget');
  if (typeof visit !== 'function') fail('gpu-pick-visitor');
  if (!Number.isFinite(viewX) || !Number.isFinite(viewY) || viewX < 0 || viewY < 0 || viewX >= v.width || viewY >= v.height) return false;
  const x = Math.floor(viewX), y = Math.floor(viewY), worldX = packet.sampleX[x]!, worldY = packet.sampleY[y]!, d = packet.draws;
  for (let i = 0; i < d.length; i += GPU_DRAW_STRIDE) {
    if (x < d[i]! || y < d[i + 1]! || x >= d[i + 2]! || y >= d[i + 3]!) continue;
    const rasterId = d[i + 6]!, raster = scene.rasters[rasterId]!, u = worldX - d[i + 4]!, w = worldY - d[i + 5]!;
    if (u < 0 || w < 0 || u >= raster.width || w >= raster.height) continue;
    visit(rasterId, w * raster.width + u, d[i + 7]!, d[i + 8]!, d[i + 9]! as 1 | 2, d[i + 10] === 1);
  }
  return true;
}

/** Map a diagnostic GPU owner/depth sample using the exact submitted frame, never the latest mutable objects. */
export function pickGpuFrame(frame: GpuFrame, sample: Readonly<{ kind: number; owner: number; depth: number }>, viewX: number, viewY: number): (TerrainPick & { readonly kind: 'terrain' }) | SpritePick | null {
  const data = frameData(frame), scene = sceneData(frame.scene), v = frame.viewport;
  if (!Number.isFinite(viewX) || !Number.isFinite(viewY) || viewX < 0 || viewY < 0 || viewX >= v.width || viewY >= v.height) return null;
  fields(sample, ['kind', 'owner', 'depth']);
  const kind: unknown = Object.getOwnPropertyDescriptor(sample, 'kind')!.value;
  const owner: unknown = Object.getOwnPropertyDescriptor(sample, 'owner')!.value;
  const depth: unknown = Object.getOwnPropertyDescriptor(sample, 'depth')!.value;
  integer(kind, 0, 2, 'gpu-pick-kind'); integer(owner, -1, GPU_PREPARE_LIMITS.draws, 'gpu-pick-owner');
  integer(depth, -2147483648, GPU_DEPTH_MAX, 'gpu-pick-depth');
  if (kind === 0) { if (owner !== -1 || depth !== -2147483648) fail('gpu-pick-empty'); return null; }
  const worldX = data.packet.sampleX[Math.floor(viewX)]!, worldY = data.packet.sampleY[Math.floor(viewY)]!;
  if (depth < GPU_DEPTH_MIN) fail('gpu-pick-depth');
  if (kind === 1) {
    const p = scene.packet.terrain[owner]; if (!p) fail('gpu-pick-owner');
    return Object.freeze({ kind: 'terrain', sourceRecord: p.sourceRecord, x: p.x, y: p.y, assetId: p.assetId, subtile: p.subtile, worldX, worldY, depth });
  }
  const p = data.objects[owner]; if (!p) fail('gpu-pick-owner');
  const o = p.object;
  return Object.freeze({ kind: 'object', id: o.id, frameId: o.frameId, assetId: p.metadata.assetId, frame: p.metadata.frame, paletteId: o.paletteId,
    canvasX: worldX - o.x + o.anchorX, canvasY: worldY - o.y + o.anchorY, worldX, worldY, depth });
}
