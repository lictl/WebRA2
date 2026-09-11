// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Presentation only; never simulation authority.
import { GpuCombinedRenderer, type GpuCombinedReceipt } from '../../../packages/render/src/gpu-combined-renderer.ts';
import { runGpuWorldSelftest, type GpuWorldSelftestOptions } from '../../../packages/render/src/gpu-world-selftest.ts';
import { createGpuVoxelLayer, type GpuVoxelLayer } from './gpu-voxel-layer.ts';
import type { GpuVoxelResources, GpuVoxelPlacement } from './gpu-voxel-protocol.ts';
import type { GpuVoxelFrame } from '../../../packages/render/src/gpu-voxel-policy.ts';
import { GpuRenderer } from '../../../packages/render/src/gpu-renderer.ts';
import { createGpuPicker, type GpuPicker } from '../../../packages/render/src/gpu-picking.ts';
import { prepareGpuFrame, captureGpuSpriteObjects } from '../../../packages/render/src/gpu-scene.ts';
import type { GpuScene, GpuFrame, GpuDrawReceipt } from '../../../packages/render/src/gpu-contracts.ts';
import type { SpriteObject } from '../../../packages/render/src/sprite-layer.ts';
import { validCamera, type Camera, type ViewportPick } from './terrain-protocol.ts';
import { validObjectPick, type ObjectInfo } from './object-protocol.ts';
import { isRetiredWorldActor, validWorldSnapshot, validWorldSummary, type WorldSnapshot, type WorldSummary } from './world-protocol.ts';

type Immutable<T> = T extends readonly (infer V)[] ? readonly Immutable<V>[] : T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;
export type GpuViewportFailure = 'unavailable' | 'context-lost' | 'draw-failed';
export interface GpuViewportUpdate {
  readonly frameId: number;
  readonly camera: Camera;
  readonly objects: readonly SpriteObject[];
  readonly retiredObjectIds: readonly string[];
  readonly world: WorldSnapshot | null;
  readonly voxelPlacements?: readonly GpuVoxelPlacement[];
}
export interface GpuViewportDisplay {
  /** Local successful submission sequence; distinct from the worker's frameId. */
  readonly sequence: number;
  readonly frameId: number;
  readonly camera: Readonly<Camera>;
  readonly world: Immutable<WorldSnapshot> | null;
  readonly frame: GpuFrame;
}
export interface GpuViewportOptions {
  /** A fresh, dedicated canvas. A canvas already used by 2D cannot be converted. */
  readonly canvas: HTMLCanvasElement;
  readonly scene: GpuScene;
  readonly objectInfo: readonly ObjectInfo[];
  readonly worldSummary: WorldSummary | null;
  readonly voxel?: GpuVoxelResources;
  readonly onDisplayed: (display: GpuViewportDisplay) => void;
  /** May fire synchronously during initialization; returned presenter then remains inactive. */
  readonly onFallback: (reason: GpuViewportFailure) => void;
}
/** Dependency seam for original lifecycle tests; production uses the dedicated WebGL2 backend. */
export interface GpuViewportPlatform {
  createRenderer(canvas: HTMLCanvasElement): Pick<GpuRenderer, 'load' | 'draw' | 'dispose'>;
  createCombinedRenderer?(canvas: HTMLCanvasElement): { renderer: Pick<GpuCombinedRenderer, 'load' | 'draw' | 'readback' | 'pick' | 'dispose'>; gl: WebGL2RenderingContext };
  runSelftest?(options: GpuWorldSelftestOptions): Promise<unknown>;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
}
export interface GpuViewport {
  /** Invalid/stale updates throw without replacing pending or displayed state. */
  update(update: GpuViewportUpdate): void;
  setCamera(camera: Camera): void;
  displayed(): GpuViewportDisplay | null;
  /** A stale gesture sequence cannot pick a newer presentation. Combined voxel picking reads one displayed winner pixel. */
  pick(x: number, y: number, expectedSequence?: number): ViewportPick;
  dispose(): void;
}
const platform: GpuViewportPlatform = {
  createRenderer(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('gpu-unavailable');
    return new GpuRenderer(gl);
  },
  createCombinedRenderer(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('gpu-unavailable');
    return { renderer: new GpuCombinedRenderer(gl), gl };
  },
  runSelftest: runGpuWorldSelftest,
  requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id),
};
const fail = (): never => { throw new Error('gpu-viewport-update'); };
const MAX_OBJECTS = 32768;

/** Capture descriptor values once, with bounds before traversal; no caller data survives an await/RAF. */
function capture<T>(input: T): T {
  let nodes = 0, characters = 0;
  const visit = (value: unknown, depth: number): unknown => {
    if (++nodes > 1048576 || depth > 8) return fail();
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') { characters += value.length; if (value.length > 4096 || characters > 8 * 1024 ** 2) return fail(); return value; }
    if (!value || typeof value !== 'object') return fail();
    if (Array.isArray(value)) {
      const length = Object.getOwnPropertyDescriptor(value, 'length')?.value as unknown;
      if (!Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > MAX_OBJECTS || Object.getPrototypeOf(value) !== Array.prototype) return fail();
      if (Reflect.ownKeys(value).length !== (length as number) + 1) return fail();
      const result = [];
      for (let i = 0; i < (length as number); i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d)) return fail(); result.push(visit(d.value, depth + 1)); }
      return Object.freeze(result);
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return fail();
    const keys = Reflect.ownKeys(value); if (keys.length > 32) return fail();
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || key === '__proto__' || key.length > 64) return fail();
      const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d)) return fail();
      result[key] = visit(d.value, depth + 1);
    }
    return Object.freeze(result);
  };
  return visit(input, 0) as T;
}
const natural = (n: number): boolean => Number.isSafeInteger(n) && n > 0;
const viewport = (camera: Camera) => ({ ...camera, backgroundRgba: [12, 18, 20, 255] as const });

/** One resident scene and one coalesced RAF. Callbacks describe submissions, not physical scanout. */
export function createGpuViewport(options: GpuViewportOptions, env: GpuViewportPlatform = platform): GpuViewport {
  const { canvas, onDisplayed, onFallback } = options;
  let scene: GpuScene | null = options.scene, summary = capture(options.worldSummary);
  const info = capture(options.objectInfo);
  if (!Array.isArray(info) || info.length > MAX_OBJECTS || info.length !== scene.allocations.objects || (summary !== null && !validWorldSummary(summary))) return fail();
  const metadata = new Map<string, ObjectInfo>(), actorIds = new Map(summary?.actors.map(a => [a.objectId, a.id]) ?? []);
  for (const object of info) {
    if (metadata.has(object.id) || object.format !== 'shp' || !validObjectPick({ kind: 'object', object, canvasX: 0, canvasY: 0, worldX: 0, worldY: 0, depth: 0 })) return fail();
    metadata.set(object.id, object);
  }
  let voxelLayer: GpuVoxelLayer | null = options.voxel === undefined ? null : createGpuVoxelLayer(options.voxel);
  for (const group of voxelLayer?.groups ?? []) {
    if (metadata.has(group.id)) return fail();
    if (group.actorId !== null && actorIds.get(group.id) !== group.actorId) return fail();
  }
  let renderer: ReturnType<GpuViewportPlatform['createRenderer']> | null = null, picker: GpuPicker | null = null;
  let combined: ReturnType<NonNullable<GpuViewportPlatform['createCombinedRenderer']>>['renderer'] | null = null;
  const startupAbort = new AbortController();
  let preparedVoxel: GpuVoxelFrame | null = null, shownCombinedSequence = 0;
  let status: 'starting' | 'ready' | 'failed' | 'disposed' = voxelLayer ? 'starting' : 'ready', scheduled: number | null = null;
  let pending: GpuViewportUpdate | null = null, camera: Camera | null = null, shown: GpuViewportDisplay | null = null, prepared: GpuFrame | null = null;
  let frameId = 0, revision = -1, stateHash: string | null = null, sequence = 0;
  function release(): void {
    if (scheduled !== null) { env.cancelFrame(scheduled); scheduled = null; }
    startupAbort.abort();
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.ownerDocument?.removeEventListener('visibilitychange', hidden);
    pending = null; camera = null; shown = null; prepared = null; scene = null; summary = null;
    metadata.clear(); actorIds.clear();
    try { renderer?.dispose(); } catch { /* Terminal cleanup must still release the CPU picker. */ }
    renderer = null; picker?.dispose(); picker = null;
    try { combined?.dispose(); } catch { /* Dispose both components even after context loss. */ }
    combined = null; voxelLayer?.dispose(); voxelLayer = null; preparedVoxel = null; shownCombinedSequence = 0;
  }
  function fallback(reason: GpuViewportFailure): void {
    if (status === 'failed' || status === 'disposed') return;
    status = 'failed'; release(); onFallback(reason);
  }
  function lost(event: Event): void { event.preventDefault(); fallback('context-lost'); }
  function hidden(): void { if (status === 'starting' && canvas.ownerDocument?.visibilityState === 'hidden') fallback('unavailable'); }
  function ready(): void { if (status !== 'ready' && status !== 'starting') throw new Error('gpu-viewport-inactive'); }
  function render(): void {
    scheduled = null;
    if (status !== 'ready' || !pending || !camera) return;
    const update = pending, currentCamera = camera;
    let frame: GpuFrame;
    try {
      frame = prepared ?? prepareGpuFrame(scene!, viewport(currentCamera), scene!.allocations.objects ? update.objects : undefined);
      // Resizing clears the default buffer; never resize unnecessarily on a steady draw.
      if (canvas.width !== currentCamera.width) canvas.width = currentCamera.width;
      if (canvas.height !== currentCamera.height) canvas.height = currentCamera.height;
      if (combined && voxelLayer) {
        const voxelFrame = preparedVoxel ?? voxelLayer.prepare(update.voxelPlacements!, currentCamera);
        const receipt: GpuCombinedReceipt = combined.draw(frame, voxelFrame);
        if (receipt.base !== frame || receipt.voxel !== voxelFrame || receipt.submitted !== true || !natural(receipt.sequence) || receipt.sequence <= shownCombinedSequence || receipt.width !== currentCamera.width || receipt.height !== currentCamera.height) throw new Error('gpu-frame-receipt');
        shownCombinedSequence = receipt.sequence;
      } else {
        const receipt: GpuDrawReceipt = renderer!.draw(frame);
        if (receipt.frame !== frame || receipt.submitted !== true) throw new Error('gpu-frame-receipt');
      }
    } catch { fallback('draw-failed'); return; }
    // A synchronous context-loss callback may have disposed resources during draw.
    if (status !== 'ready') return;
    shown = Object.freeze({ sequence: ++sequence, frameId: update.frameId, camera: currentCamera, world: update.world, frame });
    onDisplayed(shown);
  }
  function schedule(): void { if (status === 'ready' && scheduled === null) scheduled = env.requestFrame(render); }
  canvas.addEventListener('webglcontextlost', lost);
  canvas.ownerDocument?.addEventListener('visibilitychange', hidden);
  try {
    if (voxelLayer) {
      if (!env.createCombinedRenderer) throw new Error('gpu-unavailable');
      const created = env.createCombinedRenderer(canvas);
      if (status !== 'starting') created.renderer.dispose();
      else {
        combined = created.renderer;
        const startup = (env.runSelftest ?? runGpuWorldSelftest)({ canvas, gl: created.gl, renderer: combined, signal: startupAbort.signal });
        void startup.then(() => {
          if (status !== 'starting') return;
          try { combined!.load(scene!, voxelLayer!.scene); if (status === 'starting') { status = 'ready'; schedule(); } }
          catch { fallback('unavailable'); }
        }, () => fallback('unavailable'));
      }
      hidden();
    } else {
    picker = createGpuPicker(scene);
    const created = env.createRenderer(canvas);
    if (status !== 'ready') created.dispose();
    else { renderer = created; renderer.load(scene); }
    }
  }
  catch { fallback('unavailable'); }
  return Object.freeze({
    update(input: GpuViewportUpdate): void {
      ready(); const next = capture(input);
      if (Reflect.ownKeys(next).length !== (voxelLayer ? 6 : 5) || (voxelLayer !== null) !== Object.hasOwn(next, 'voxelPlacements') || !natural(next.frameId) || next.frameId <= frameId || !validCamera(next.camera) || !Array.isArray(next.objects) || !Array.isArray(next.retiredObjectIds)) return fail();
      if (summary === null ? next.world !== null : !validWorldSnapshot(next.world, summary)) return fail();
      if (next.world && (next.world.revision < revision || (next.world.revision === revision && next.world.stateHash !== stateHash))) return fail();
      if (voxelLayer) { if (!Array.isArray(next.voxelPlacements)) return fail(); voxelLayer.validate(next.voxelPlacements, summary, next.world); }
      const voxelGroups = new Map(voxelLayer?.groups.map(g => [g.id, g]) ?? []);
      const ids = new Set<string>(), actors = new Map(next.world?.actors.map(a => [a.id, a]) ?? []);
      for (const object of next.objects) { if (!metadata.has(object.id) || ids.has(object.id)) return fail(); ids.add(object.id); }
      for (const p of next.voxelPlacements ?? []) { if (!voxelGroups.has(p.objectId) || ids.has(p.objectId)) return fail(); ids.add(p.objectId); }
      for (const id of next.retiredObjectIds) {
        const actor = actors.get(actorIds.get(id)!);
        if ((!metadata.has(id) && !voxelGroups.has(id)) || ids.has(id) || !actor || !isRetiredWorldActor(actor)) return fail(); ids.add(id);
      }
      if (ids.size !== metadata.size + voxelGroups.size) return fail();
      // Validate resource combinations/depth/coordinates before altering pending state.
      const owned = Object.freeze({ ...next, objects: captureGpuSpriteObjects(next.objects) });
      const nextFrame = prepareGpuFrame(scene!, viewport(next.camera), scene!.allocations.objects ? owned.objects : undefined);
      const nextVoxel = voxelLayer?.prepare(next.voxelPlacements!, next.camera) ?? null;
      prepared = nextFrame; preparedVoxel = nextVoxel;
      pending = owned; camera = next.camera; frameId = next.frameId;
      revision = next.world?.revision ?? -1; stateHash = next.world?.stateHash ?? null; schedule();
    },
    setCamera(input: Camera): void {
      ready(); const next = capture(input); if (!validCamera(next)) return fail();
      if (!pending) throw new Error('gpu-viewport-empty');
      camera = next; prepared = null; preparedVoxel = null; schedule();
    },
    displayed: () => shown,
    pick(x: number, y: number, expectedSequence?: number): ViewportPick {
      if (status !== 'ready' || !shown || (expectedSequence !== undefined && expectedSequence !== shown.sequence) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= shown.camera.width || y >= shown.camera.height) return null;
      let hit;
      try { hit = combined ? combined.pick(shownCombinedSequence, x, y) : picker!.pick(shown.frame, x, y); }
      catch { fallback('draw-failed'); return null; }
      if (status !== 'ready' || !shown || !hit) return null;
      if (hit.kind === 'voxel') {
        const original = voxelLayer!.info(hit.instanceId); if (!original || original.voxel?.partId !== hit.partId) { fallback('draw-failed'); return null; }
        const actor = shown.world?.actors.find(a => a.id === actorIds.get(original.id));
        const object = { ...original, ...(actor ? { x: actor.x, y: actor.y } : {}), voxel: { ...original.voxel!, voxelOrdinal: hit.voxelOrdinal } };
        return { kind: 'object', object, canvasX: x, canvasY: y, worldX: Math.floor(shown.camera.cameraX + (x + .5) / shown.camera.zoom),
          worldY: Math.floor(shown.camera.cameraY + (y + .5) / shown.camera.zoom), depth: hit.depth };
      }
      if (hit.kind === 'terrain') { const { kind: _kind, ...cell } = hit; return { kind: 'terrain', cell }; }
      const original = metadata.get(hit.id); if (!original) throw new Error('gpu-pick-metadata');
      const actor = shown.world?.actors.find(a => a.id === actorIds.get(hit.id));
      const object = { ...original, ...(actor ? { x: actor.x, y: actor.y } : {}) };
      return { kind: 'object', object, canvasX: hit.canvasX, canvasY: hit.canvasY, worldX: hit.worldX, worldY: hit.worldY, depth: hit.depth };
    },
    dispose(): void { if (status === 'disposed') return; status = 'disposed'; release(); },
  });
}
