// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Cold, finite current-context verification.
import type { GpuFrame, GpuScene } from './gpu-contracts.ts';
import { pickGpuFrame } from './gpu-scene.ts';
import { resolveGpuVoxelOwner, type GpuVoxelFrame, type GpuVoxelScene } from './gpu-voxel-policy.ts';
import { gpuWorldSelftestCases, type GpuWorldProbePixel, type GpuWorldSelftestCase } from './gpu-world-selftest-fixtures.ts';

export const GPU_WORLD_SELFTEST_POLICY = 'webra2-gpu-world-startup-1' as const;
export const GPU_WORLD_SELFTEST_DEADLINE_MS = 5000;
interface Receipt { readonly sequence: number; readonly base: GpuFrame; readonly voxel: GpuVoxelFrame | null; readonly width: number; readonly height: number; readonly submitted: true }
interface Readback {
  readonly sequence: number; readonly width: number; readonly height: number;
  readonly rgba: Uint8Array; readonly kind: Uint8Array; readonly owner: Int32Array;
  readonly depthWord: Uint32Array; readonly depth: Float64Array;
}
/** Structural test seam; the product supplies its real dedicated combined renderer. */
export interface GpuWorldSelftestRenderer {
  load(base: GpuScene, voxel: GpuVoxelScene | null): void;
  draw(base: GpuFrame, voxel: GpuVoxelFrame | null): Receipt;
  readback(sequence: number): Readback;
  pick(sequence: number, x: number, y: number): unknown;
}
type Gl = Pick<WebGL2RenderingContext, 'fenceSync' | 'clientWaitSync' | 'deleteSync' | 'flush' | 'isContextLost' | 'getError' | 'readPixels' |
  'SYNC_GPU_COMMANDS_COMPLETE' | 'ALREADY_SIGNALED' | 'CONDITION_SATISFIED' | 'TIMEOUT_EXPIRED' | 'RGBA' | 'UNSIGNED_BYTE' | 'NO_ERROR'>;
export interface GpuWorldSelftestPlatform {
  now(): number;
  setTimer(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  clearTimer(id: ReturnType<typeof setTimeout>): void;
}
const platform: GpuWorldSelftestPlatform = { now: () => performance.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: id => clearTimeout(id) };
export interface GpuWorldSelftestOptions {
  readonly canvas: Pick<HTMLCanvasElement, 'width' | 'height'>;
  readonly gl: Gl;
  readonly renderer: GpuWorldSelftestRenderer;
  readonly signal: AbortSignal;
  /** May only reduce the production total bound. This cannot preempt synchronous driver calls. */
  readonly deadlineMs?: number;
}
export interface GpuWorldSelftestResult { readonly policy: typeof GPU_WORLD_SELFTEST_POLICY; readonly cases: 2; readonly pixels: 1024; readonly picks: 28 }
const fail = (reason: string): never => { throw new Error(`gpu-world-selftest-${reason}`); };
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const elementType = Object.getOwnPropertyDescriptor(typed, Symbol.toStringTag)!.get!;
const length = Object.getOwnPropertyDescriptor(typed, 'length')!.get!;
function plane(value: unknown, name: string, count: number): void {
  try { if (elementType.call(value) !== name || length.call(value) !== count) fail('readback'); }
  catch { fail('readback'); }
}
const kinds = ['empty', 'terrain', 'sprite', 'voxel'] as const;
function expectedHit(value: unknown, expected: GpuWorldProbePixel): void {
  if (expected.kind === 'empty') { if (value !== null) fail('pick'); return; }
  if (!value || typeof value !== 'object') fail('pick');
  const h = value as { kind?: unknown; id?: unknown; sourceRecord?: unknown; instanceId?: unknown; depth?: unknown };
  const kind = h.kind === 'object' ? 'sprite' : h.kind;
  const id = h.kind === 'terrain' ? String(h.sourceRecord) : h.kind === 'voxel' ? h.instanceId : h.id;
  if (kind !== expected.kind || id !== expected.id || h.depth !== expected.depth) fail('pick');
}
function checkReadback(c: GpuWorldSelftestCase, receipt: Receipt, value: Readback): void {
  const { width, height } = c.baseFrame.viewport, count = width * height;
  if (!value || value.sequence !== receipt.sequence || value.width !== width || value.height !== height) fail('readback');
  plane(value.rgba, 'Uint8Array', count * 4); plane(value.kind, 'Uint8Array', count);
  plane(value.owner, 'Int32Array', count); plane(value.depthWord, 'Uint32Array', count); plane(value.depth, 'Float64Array', count);
  const word = new Uint32Array(1), asFloat = new Float32Array(word.buffer);
  for (let i = 0; i < count; i++) {
    const expected = c.expected[i]!, kind = value.kind[i]!;
    if (kinds[kind] !== expected.kind || expected.rgba.some((b, k) => value.rgba[i * 4 + k] !== b)) fail('pixel');
    if (kind === 0) { if (value.owner[i] !== -1) fail('owner'); continue; }
    if (value.depth[i] !== expected.depth) fail('depth');
    word[0] = value.depthWord[i]!;
    if ((kind === 3 ? asFloat[0] : word[0]! | 0) !== value.depth[i]) fail('depth-word');
    const hit = kind === 3 ? resolveGpuVoxelOwner(c.voxelFrame, value.owner[i]!, value.depth[i]!)
      : pickGpuFrame(c.baseFrame, { kind, owner: value.owner[i]!, depth: value.depth[i]! }, i % width, Math.floor(i / width));
    expectedHit(kind === 3 && hit ? { kind: 'voxel', ...hit } : hit, expected);
  }
}
function checkDefault(gl: Gl, c: GpuWorldSelftestCase): void {
  const { width, height } = c.baseFrame.viewport, rgba = new Uint8Array(width * height * 4);
  // Combined draw leaves the default framebuffer bound. Read immediately: waiting
  // for RAF/another task may clear it when preserveDrawingBuffer is false.
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const expected = c.expected[y * width + x]!.rgba, at = ((height - 1 - y) * width + x) * 4;
    if (expected.some((b, k) => rgba[at + k] !== b)) fail('default-pixel');
  }
  if (gl.getError() !== gl.NO_ERROR) fail('gl-error');
}

/** Leaves this dedicated renderer loaded with a tiny probe scene. The presenter
 * must load its latest real scene after success and before publishing any frame.
 * No normal frame readback, simulation authority or universal driver proof. */
export async function runGpuWorldSelftest(options: GpuWorldSelftestOptions, env: GpuWorldSelftestPlatform = platform): Promise<GpuWorldSelftestResult> {
  const { gl, renderer, canvas, signal } = options, duration = options.deadlineMs ?? GPU_WORLD_SELFTEST_DEADLINE_MS;
  if (!Number.isFinite(duration) || duration <= 0 || duration > GPU_WORLD_SELFTEST_DEADLINE_MS) fail('deadline');
  const deadline = env.now() + duration;
  const guard = (): void => { if (signal.aborted) fail('aborted'); if (gl.isContextLost()) fail('context-lost'); if (env.now() >= deadline) fail('timeout'); };
  let previousSequence = 0;
  function draw(c: GpuWorldSelftestCase): Receipt {
    guard(); const r = renderer.draw(c.baseFrame, c.voxelFrame); guard();
    if (!r || !Number.isSafeInteger(r.sequence) || r.sequence <= previousSequence || r.submitted !== true || r.base !== c.baseFrame || r.voxel !== c.voxelFrame || r.width !== canvas.width || r.height !== canvas.height) fail('receipt');
    previousSequence = r.sequence; return r;
  }
  function wait(): Promise<void> {
    guard(); const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) ?? fail('fence');
    try { gl.flush(); } catch (e) { gl.deleteSync(fence); throw e; }
    return new Promise((resolve, reject) => {
      let pollTimer: ReturnType<typeof setTimeout> | null = null, timeout: ReturnType<typeof setTimeout> | null = null, done = false;
      const finish = (error?: unknown): void => {
        if (done) return; done = true;
        if (pollTimer !== null) env.clearTimer(pollTimer); if (timeout !== null) env.clearTimer(timeout);
        signal.removeEventListener('abort', abort); try { gl.deleteSync(fence); } catch { /* Context may already be gone. */ }
        if (error) reject(error); else resolve();
      };
      const abort = (): void => finish(new Error('gpu-world-selftest-aborted'));
      const poll = (): void => {
        pollTimer = null;
        try { guard(); const status = gl.clientWaitSync(fence, 0, 0); guard();
          if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) finish();
          else if (status === gl.TIMEOUT_EXPIRED) pollTimer = env.setTimer(poll, Math.min(8, Math.max(1, deadline - env.now())));
          else fail('fence');
        } catch (e) { finish(e); }
      };
      signal.addEventListener('abort', abort, { once: true });
      timeout = env.setTimer(() => finish(new Error('gpu-world-selftest-timeout')), Math.max(0, deadline - env.now())); poll();
    });
  }
  guard(); const cases = gpuWorldSelftestCases(); guard();
  for (const [index, c] of cases.entries()) {
    guard(); canvas.width = c.baseFrame.viewport.width; canvas.height = c.baseFrame.viewport.height;
    renderer.load(c.base, c.voxel); previousSequence = 0; guard();
    const receipt = draw(c); await wait(); guard();
    checkReadback(c, receipt, renderer.readback(receipt.sequence)); guard();
    // One identical cold redraw permits immediate default presentation verification.
    const delivered = draw(c); checkDefault(gl, c); guard();
    const probes = index === 0 ? [[0, 0], [2, 2], ...Array.from({ length: 12 }, (_, i) => [i + 2, 11]), [3, 8], [4, 8], [5, 8], [3, 4], [4, 4], [5, 4], [6, 4], [7, 8], [8, 8]]
      : [[15, 15], [16, 15], [15, 16], [16, 16], [0, 0]];
    for (const [x, y] of probes as [number, number][]) { guard(); expectedHit(renderer.pick(delivered.sequence, x, y), c.expected[y * c.baseFrame.viewport.width + x]!); }
    if (gl.getError() !== gl.NO_ERROR) fail('gl-error');
  }
  guard(); return Object.freeze({ policy: GPU_WORLD_SELFTEST_POLICY, cases: 2, pixels: 1024, picks: 28 });
}
