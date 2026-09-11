// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../GPU_PROVENANCE.md.
import { describeTerrainRasters, type TerrainPick, type TerrainScene, type TerrainViewport } from './terrain-scene.ts';
import { describeSpriteRasters, type SpriteBatch, type SpriteObject, type SpritePick } from './sprite-layer.ts';
import { GPU_DEPTH_MAX, GPU_DEPTH_MIN, GPU_DRAW_STRIDE, GPU_PREPARE_LIMITS, GPU_SCENE_POLICY,
  type GpuFrame, type GpuFrameData, type GpuPrepareLimits, type GpuRasterData, type GpuScene, type GpuSceneData } from './gpu-contracts.ts';

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
type TerrainSource = ReturnType<typeof describeTerrainRasters>;
type SpriteSource = ReturnType<typeof describeSpriteRasters>;
type SpritePlacement = ReturnType<SpriteSource['prepare']>['placements'][number];
interface Piece { x: number; y: number; raster: number }
interface OwnedScene {
  cap: Readonly<GpuPrepareLimits>; rasters: GpuRasterData[]; terrain: TerrainSource;
  pieces: Piece[][]; sprites: SpriteSource | null; spriteRasters: Map<string, number>;
}
interface OwnedFrame { packet: GpuFrameData; objects: SpritePlacement[] }
const scenes = new WeakMap<GpuScene, OwnedScene>(), frames = new WeakMap<GpuFrame, OwnedFrame>();
const resourceKey = (object: SpriteObject): string => JSON.stringify([object.frameId, object.paletteId, object.depth.rowStep]);
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
  const pieces = terrain.sprites.map(s => s.patches.map(p => ({ x: p.x, y: p.y, raster: rasterId++ })));
  const spriteRasters = new Map((sprites?.resources ?? []).map(r => [r.key, rasterId++]));
  const scene: GpuScene = Object.freeze({ policy: GPU_SCENE_POLICY, nativeBehaviorVerified: false,
    allocations: Object.freeze({ rasterCount: rasters.length, rasterPixels: pixels, rasterBytes: pixels * 8,
      terrainPieces, objects: sprites?.objects.length ?? 0 }) });
  scenes.set(scene, { cap: Object.freeze(cap), terrain, sprites, rasters, pieces, spriteRasters }); return scene;
}

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
  if (!data.sprites && objects !== undefined) fail('gpu-no-sprite-catalog');
  const sprites = data.sprites?.prepare(objects ?? data.sprites.objects, viewport, cap.samples);
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
  for (const p of data.terrain.placements) {
    const sprite = data.terrain.sprites[p.sprite]!;
    const [x0, y0, x1, y1] = bounds(p.left + sprite.left, p.top + sprite.top, p.left + sprite.right, p.top + sprite.bottom);
    cpuSamples += Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    if (cpuSamples > cap.samples) fail('gpu-cpu-reference-sample-budget');
    if (x0 >= x1 || y0 >= y1) continue;
    for (const piece of data.pieces[p.sprite]!) add(p.left + piece.x, p.top + piece.y, piece.raster, p.groundY, p.sourceRecord, 1, 0);
  }
  const terrainDraws = draws.length / GPU_DRAW_STRIDE, objectPlacements = sprites?.placements ?? [];
  for (let i = 0; i < objectPlacements.length; i++) {
    const p = objectPlacements[i]!, raster = data.spriteRasters.get(resourceKey(p.object));
    if (raster === undefined) fail('gpu-unprepared-sprite-resource');
    add(p.left, p.top, raster, p.object.depth.base, i, 2, p.object.depth.terrainTie === 'front' ? 1 : 0);
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
    const p = scene.terrain.placements[owner]; if (!p) fail('gpu-pick-owner');
    return Object.freeze({ kind: 'terrain', sourceRecord: p.sourceRecord, x: p.x, y: p.y, assetId: p.assetId, subtile: p.subtile, worldX, worldY, depth });
  }
  const p = data.objects[owner]; if (!p) fail('gpu-pick-owner');
  const o = p.object;
  return Object.freeze({ kind: 'object', id: o.id, frameId: o.frameId, assetId: p.metadata.assetId, frame: p.metadata.frame, paletteId: o.paletteId,
    canvasX: worldX - o.x + o.anchorX, canvasY: worldY - o.y + o.anchorY, worldX, worldY, depth });
}
