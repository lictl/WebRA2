// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Presentation only; never simulation authority.
import { GpuRenderer } from '../../../packages/render/src/gpu-renderer.ts';
import { createGpuPicker, type GpuPicker } from '../../../packages/render/src/gpu-picking.ts';
import { prepareGpuFrame } from '../../../packages/render/src/gpu-scene.ts';
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
  readonly onDisplayed: (display: GpuViewportDisplay) => void;
  /** May fire synchronously during initialization; returned presenter then remains inactive. */
  readonly onFallback: (reason: GpuViewportFailure) => void;
}
/** Dependency seam for original lifecycle tests; production uses the dedicated WebGL2 backend. */
export interface GpuViewportPlatform {
  createRenderer(canvas: HTMLCanvasElement): Pick<GpuRenderer, 'load' | 'draw' | 'dispose'>;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
}
export interface GpuViewport {
  /** Invalid/stale updates throw without replacing pending or displayed state. */
  update(update: GpuViewportUpdate): void;
  setCamera(camera: Camera): void;
  displayed(): GpuViewportDisplay | null;
  /** A stale gesture sequence cannot pick a newer presentation. No GPU readback. */
  pick(x: number, y: number, expectedSequence?: number): ViewportPick;
  dispose(): void;
}
const platform: GpuViewportPlatform = {
  createRenderer(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('gpu-unavailable');
    return new GpuRenderer(gl);
  },
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
  let renderer: ReturnType<GpuViewportPlatform['createRenderer']> | null = null, picker: GpuPicker | null = null;
  let status: 'ready' | 'failed' | 'disposed' = 'ready', scheduled: number | null = null;
  let pending: GpuViewportUpdate | null = null, camera: Camera | null = null, shown: GpuViewportDisplay | null = null, prepared: GpuFrame | null = null;
  let frameId = 0, revision = -1, stateHash: string | null = null, sequence = 0;
  function release(): void {
    if (scheduled !== null) { env.cancelFrame(scheduled); scheduled = null; }
    canvas.removeEventListener('webglcontextlost', lost);
    pending = null; camera = null; shown = null; prepared = null; scene = null; summary = null;
    metadata.clear(); actorIds.clear();
    try { renderer?.dispose(); } catch { /* Terminal cleanup must still release the CPU picker. */ }
    renderer = null; picker?.dispose(); picker = null;
  }
  function fallback(reason: GpuViewportFailure): void {
    if (status !== 'ready') return;
    status = 'failed'; release(); onFallback(reason);
  }
  function lost(event: Event): void { event.preventDefault(); fallback('context-lost'); }
  function ready(): void { if (status !== 'ready') throw new Error('gpu-viewport-inactive'); }
  function render(): void {
    scheduled = null;
    if (status !== 'ready' || !pending || !camera) return;
    const update = pending, currentCamera = camera;
    let frame: GpuFrame, receipt: GpuDrawReceipt;
    try {
      frame = prepared ?? prepareGpuFrame(scene!, viewport(currentCamera), scene!.allocations.objects ? update.objects : undefined);
      // Resizing clears the default buffer; never resize unnecessarily on a steady draw.
      if (canvas.width !== currentCamera.width) canvas.width = currentCamera.width;
      if (canvas.height !== currentCamera.height) canvas.height = currentCamera.height;
      receipt = renderer!.draw(frame);
      if (receipt.frame !== frame || receipt.submitted !== true) throw new Error('gpu-frame-receipt');
    } catch { fallback('draw-failed'); return; }
    // A synchronous context-loss callback may have disposed resources during draw.
    if (status !== 'ready') return;
    shown = Object.freeze({ sequence: ++sequence, frameId: update.frameId, camera: currentCamera, world: update.world, frame });
    onDisplayed(shown);
  }
  function schedule(): void { if (scheduled === null) scheduled = env.requestFrame(render); }
  canvas.addEventListener('webglcontextlost', lost);
  try {
    picker = createGpuPicker(scene);
    const created = env.createRenderer(canvas);
    if (status !== 'ready') created.dispose();
    else { renderer = created; renderer.load(scene); }
  }
  catch { fallback('unavailable'); }
  return Object.freeze({
    update(input: GpuViewportUpdate): void {
      ready(); const next = capture(input);
      if (Reflect.ownKeys(next).length !== 5 || !natural(next.frameId) || next.frameId <= frameId || !validCamera(next.camera) || !Array.isArray(next.objects) || !Array.isArray(next.retiredObjectIds)) return fail();
      if (summary === null ? next.world !== null : !validWorldSnapshot(next.world, summary)) return fail();
      if (next.world && (next.world.revision < revision || (next.world.revision === revision && next.world.stateHash !== stateHash))) return fail();
      const ids = new Set<string>(), actors = new Map(next.world?.actors.map(a => [a.id, a]) ?? []);
      for (const object of next.objects) { if (!metadata.has(object.id) || ids.has(object.id)) return fail(); ids.add(object.id); }
      for (const id of next.retiredObjectIds) {
        const actor = actors.get(actorIds.get(id)!);
        if (!metadata.has(id) || ids.has(id) || !actor || !isRetiredWorldActor(actor)) return fail(); ids.add(id);
      }
      if (ids.size !== metadata.size) return fail();
      // Validate resource combinations/depth/coordinates before altering pending state.
      const nextFrame = prepareGpuFrame(scene!, viewport(next.camera), scene!.allocations.objects ? next.objects : undefined);
      prepared = nextFrame;
      pending = next; camera = next.camera; frameId = next.frameId;
      revision = next.world?.revision ?? -1; stateHash = next.world?.stateHash ?? null; schedule();
    },
    setCamera(input: Camera): void {
      ready(); const next = capture(input); if (!validCamera(next)) return fail();
      if (!pending) throw new Error('gpu-viewport-empty');
      camera = next; prepared = null; schedule();
    },
    displayed: () => shown,
    pick(x: number, y: number, expectedSequence?: number): ViewportPick {
      if (status !== 'ready' || !shown || (expectedSequence !== undefined && expectedSequence !== shown.sequence) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= shown.camera.width || y >= shown.camera.height) return null;
      const hit = picker!.pick(shown.frame, x, y); if (!hit) return null;
      if (hit.kind === 'terrain') { const { kind: _kind, ...cell } = hit; return { kind: 'terrain', cell }; }
      const original = metadata.get(hit.id); if (!original) throw new Error('gpu-pick-metadata');
      const actor = shown.world?.actors.find(a => a.id === actorIds.get(hit.id));
      const object = { ...original, ...(actor ? { x: actor.x, y: actor.y } : {}) };
      return { kind: 'object', object, canvasX: hit.canvasX, canvasY: hit.canvasY, worldX: hit.worldX, worldY: hit.worldY, depth: hit.depth };
    },
    dispose(): void { if (status === 'disposed') return; status = 'disposed'; release(); },
  });
}
