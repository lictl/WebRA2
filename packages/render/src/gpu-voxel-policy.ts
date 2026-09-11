// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original presentation experiment; no native parity claim.
import { inverse, multiply } from './voxel-math.ts';

export const GPU_VOXEL_POLICY = 'webra2-voxel-highp-clipped-ray-3' as const;
export const GPU_VOXEL_LIMITS = Object.freeze({ parts: 256, palettes: 256, voxels: 1048576,
  instances: 4096, instanceVoxels: 1048576, dimension: 2048, pixels: 1280 * 720,
  samples: 64 * 1024 * 1024, candidateTests: 128 * 1024 * 1024, binEntries: 8 * 1024 * 1024, binCandidates: 4096,
  residentBytes: 128 * 1024 * 1024, frameBytes: 128 * 1024 * 1024 });
export type GpuVoxelLimits = { -readonly [K in keyof typeof GPU_VOXEL_LIMITS]: number };
export const GPU_VOXEL_LAYOUT_LIMITS = Object.freeze({ capturedBytes: 4 * 1024 * 1024, matrixBytes: 4096 * 12 * 8 });
export type GpuVoxelLayoutLimits = { -readonly [K in keyof typeof GPU_VOXEL_LAYOUT_LIMITS]: number };
export interface GpuVoxelPartInput { readonly id: string; readonly voxels: Uint8Array; readonly modelMatrix: readonly number[] }
export interface GpuVoxelPaletteInput { readonly id: string; readonly rgba: Uint8Array; readonly remap: Uint8Array | null; readonly transparentIndex: number | null }
export interface GpuVoxelInstance { readonly id: string; readonly partId: string; readonly paletteId: string; readonly modelToView: readonly number[] }
export interface GpuVoxelScene { readonly policy: typeof GPU_VOXEL_POLICY; readonly allocations: Readonly<{ parts: number; palettes: number; voxels: number; residentBytes: number }> }
export interface GpuVoxelInstanceLayout { readonly policy: typeof GPU_VOXEL_POLICY; readonly scene: GpuVoxelScene;
  readonly allocations: Readonly<{ instances: number; capturedBytes: number; matrixBytes: number }> }
export interface GpuVoxelFrame { readonly policy: typeof GPU_VOXEL_POLICY; readonly scene: GpuVoxelScene; readonly width: number; readonly height: number;
  readonly allocations: Readonly<{ instances: number; instanceVoxels: number; boxes: number; samples: number; candidateTests: number; binEntries: number; maxBinCandidates: number; frameBytes: number }> }
export interface GpuVoxelHit { readonly instanceId: string; readonly partId: string; readonly voxelOrdinal: number; readonly x: number; readonly y: number; readonly z: number;
  readonly colorIndex: number; readonly normalIndex: number; readonly depth: number; readonly owner: number }
interface Part { id: string; start: number; count: number; matrix: number[] }
interface Selection { id: string; part: Part; palette: number; m: number[]; inputIndex: number }
interface Layout { scene: GpuVoxelScene; resident: Resident; cap: GpuVoxelLayoutLimits; bindings: Omit<Selection, 'm'>[] }
interface Placement { id: string; part: Part; palette: number; start: number; end: number; inverse64: number[] }
interface Resident { cap: GpuVoxelLimits; parts: Part[]; paletteIds: string[]; geometry: Uint32Array; rgba: Uint8Array }
interface Prepared { cap: GpuVoxelLimits; resident: Resident; placements: Placement[]; inverses: Float32Array; boxes: Int32Array; oldBounds: Int32Array; offsets: Uint32Array; candidates: Uint32Array; tilesX: number }
const scenes = new WeakMap<GpuVoxelScene, Resident>(), frames = new WeakMap<GpuVoxelFrame, Prepared>();
const layouts = new WeakMap<GpuVoxelInstanceLayout, Layout>();
function fail(code: string): never { throw new Error('gpu-voxel-' + code); }
function projectionBound(value: number): boolean { return Number.isFinite(value) && Math.abs(value) <= 1048576; }
function integer(value: unknown, min: number, max: number): number { if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < min || (value as number) > max) fail('integer'); return value as number; }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) fail('record');
  const out: Record<string, unknown> = {}; for (const key of keys) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d)) fail('record'); out[key] = d.value; } return out;
}
function array(value: unknown, cap: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail('array');
  const n = integer(Object.getOwnPropertyDescriptor(value, 'length')?.value, 0, cap); if (Reflect.ownKeys(value).length !== n + 1) fail('array');
  const out = []; for (let i = 0; i < n; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d)) fail('array'); out.push(d.value); } return out;
}
function name(value: unknown): string { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(value)) fail('id'); return value as string; }
function matrix(value: unknown): number[] { const a = array(value, 12); if (a.length !== 12 || a.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1048576)) fail('matrix'); inverse(a as number[]); return a as number[]; }
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const byteLength = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!, buffer = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!, byteOffset = Object.getOwnPropertyDescriptor(typed, 'byteOffset')!.get!;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function bytes(value: unknown, cap: number): Uint8Array {
  if (!value || Object.getPrototypeOf(value) !== Uint8Array.prototype) fail('bytes');
  let n: number, b: ArrayBuffer, at: number; try { n = byteLength.call(value); b = buffer.call(value); at = byteOffset.call(value); } catch { return fail('bytes'); }
  if (Object.getPrototypeOf(b) !== ArrayBuffer.prototype || resizable?.call(b) || n > cap) fail('bytes');
  try { return new Uint8Array(b, at, n); } catch { return fail('bytes'); }
}
function limits(value: Partial<GpuVoxelLimits> | undefined, parent: GpuVoxelLimits = GPU_VOXEL_LIMITS): GpuVoxelLimits {
  const cap: GpuVoxelLimits = { ...parent }; if (value === undefined) return cap;
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail('limits');
  for (const key of Reflect.ownKeys(value)) { if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits'); const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d)) fail('limits'); cap[key as keyof GpuVoxelLimits] = integer(d.value, 0, cap[key as keyof GpuVoxelLimits]); } return cap;
}
function layoutLimits(value?: Partial<GpuVoxelLayoutLimits>): GpuVoxelLayoutLimits {
  const cap = { ...GPU_VOXEL_LAYOUT_LIMITS }; if (value === undefined) return cap;
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail('layout-limits');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('layout-limits');
    const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d)) fail('layout-limits');
    cap[key as keyof GpuVoxelLayoutLimits] = integer(d.value, 0, cap[key as keyof GpuVoxelLayoutLimits]);
  }
  return cap;
}
function selectInstances(resident: Resident, value: unknown, cap: GpuVoxelLimits): Selection[] {
  const values = array(value, cap.instances), ids = new Set<string>();
  return values.map((value, inputIndex) => {
    const r = record(value, ['id', 'partId', 'paletteId', 'modelToView']), id = name(r.id), partId = name(r.partId), paletteId = name(r.paletteId), m = matrix(r.modelToView);
    if (ids.has(id)) fail('instance'); ids.add(id);
    const part = resident.parts.find(p => p.id === partId), palette = resident.paletteIds.indexOf(paletteId);
    if (!part || palette < 0) fail('reference'); return { id, part, palette, m, inputIndex };
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Capture static joins once. Subsequent matrix planes remain in this original caller order. */
export function createGpuVoxelInstanceLayout(scene: GpuVoxelScene, instances: readonly GpuVoxelInstance[], lower?: Partial<GpuVoxelLayoutLimits>): GpuVoxelInstanceLayout {
  const resident = scenes.get(scene); if (!resident) return fail('scene'); const cap = layoutLimits(lower);
  const selected = selectInstances(resident, instances, resident.cap);
  // Logical captured strings + numeric joins, not a measurement of JavaScript object overhead.
  const capturedBytes = selected.reduce((n, p) => n + 16 + 2 * (p.id.length + p.part.id.length + resident.paletteIds[p.palette]!.length), 0), matrixBytes = selected.length * 12 * 8;
  if (capturedBytes > cap.capturedBytes || matrixBytes > cap.matrixBytes) fail('layout-budget');
  let instanceVoxels = 0; for (const p of selected) { instanceVoxels += p.part.count; if (instanceVoxels > resident.cap.instanceVoxels) fail('instance-budget'); }
  const bindings = selected.map(({ m: _matrix, ...binding }) => binding);
  const layout: GpuVoxelInstanceLayout = Object.freeze({ policy: GPU_VOXEL_POLICY, scene, allocations: Object.freeze({ instances: bindings.length, capturedBytes, matrixBytes }) });
  layouts.set(layout, { scene, resident, cap, bindings }); return layout;
}

function matrixPlane(value: unknown, expectedBytes: number, maximumBytes: number): Float64Array {
  if (!value || Object.getPrototypeOf(value) !== Float64Array.prototype) return fail('matrix-plane');
  let n: number, b: ArrayBuffer, at: number;
  try { n = byteLength.call(value); b = buffer.call(value); at = byteOffset.call(value); } catch { return fail('matrix-plane'); }
  if (n !== expectedBytes || n > maximumBytes || Object.getPrototypeOf(b) !== ArrayBuffer.prototype || resizable?.call(b)) fail('matrix-plane');
  // Intrinsics bypass named shadow accessors; a detached buffer rejects even for an empty layout.
  try { return new Float64Array(new Float64Array(b, at, n / 8)); } catch { return fail('matrix-plane'); }
}

/** Own one bounded binary64 plane; no approximate transforms, bounds or inverse reuse. */
export function prepareGpuVoxelLayoutFrame(layout: GpuVoxelInstanceLayout, input: { readonly matrices: Float64Array; readonly width: number; readonly height: number }, lower?: Partial<GpuVoxelLimits>): GpuVoxelFrame {
  const owned = layouts.get(layout); if (!owned) return fail('layout');
  const cap = limits(lower, owned.resident.cap), raw = record(input, ['matrices', 'width', 'height']);
  const width = integer(raw.width, 1, cap.dimension), height = integer(raw.height, 1, cap.dimension); if (width * height > cap.pixels) fail('pixel-budget');
  if (owned.bindings.length > cap.instances) fail('instance-budget');
  const plane = matrixPlane(raw.matrices, owned.bindings.length * 12 * 8, owned.cap.matrixBytes);
  const selected = owned.bindings.map(binding => {
    const m: number[] = []; for (let i = 0; i < 12; i++) { const n = plane[binding.inputIndex * 12 + i]!; if (!Number.isFinite(n) || Math.abs(n) > 1048576) fail('matrix'); m.push(n); }
    inverse(m); return { ...binding, m };
  });
  return prepareSelectedFrame(owned.scene, owned.resident, cap, width, height, selected);
}

/** Own already decoded sparse geometry. This experimental factory does not authenticate a game source. */
export function createGpuVoxelScene(input: { readonly parts: readonly GpuVoxelPartInput[]; readonly palettes: readonly GpuVoxelPaletteInput[] }, lower?: Partial<GpuVoxelLimits>): GpuVoxelScene {
  const cap = limits(lower), top = record(input, ['parts', 'palettes']), rawParts = array(top.parts, cap.parts), rawPalettes = array(top.palettes, cap.palettes);
  const parts: Part[] = [], planes: Uint8Array[] = [], paletteIds: string[] = [], colors: Uint8Array[] = [], partIds = new Set<string>(); let total = 0;
  for (const raw of rawParts) { const r = record(raw, ['id', 'voxels', 'modelMatrix']), id = name(r.id), data = bytes(r.voxels, cap.voxels * 5), m = matrix(r.modelMatrix);
    if (partIds.has(id) || data.length % 5) fail('part'); partIds.add(id); const start = total; total += data.length / 5; if (total > cap.voxels) fail('voxel-budget');
    parts.push({ id, start, count: data.length / 5, matrix: m }); planes.push(data); }
  const residentBytes = total * 8 + rawPalettes.length * 1024 + parts.length * 96; if (residentBytes > cap.residentBytes) fail('resident-budget');
  for (const raw of rawPalettes) { const r = record(raw, ['id', 'rgba', 'remap', 'transparentIndex']), id = name(r.id), data = bytes(r.rgba, 1024), remap = r.remap === null ? null : bytes(r.remap, 256);
    if (paletteIds.includes(id) || data.length !== 1024 || (remap && remap.length !== 256)) fail('palette'); const transparent = r.transparentIndex === null ? null : integer(r.transparentIndex, 0, 255);
    const owned = data.slice(), mapped = remap?.slice() ?? null, color = new Uint8Array(1024);
    for (let i = 0; i < 256; i++) { if (owned[i * 4 + 3] !== 0 && owned[i * 4 + 3] !== 255) fail('alpha'); const n = (mapped?.[i] ?? i) * 4; if (i !== transparent && owned[n + 3] === 255) color.set(owned.subarray(n, n + 4), i * 4); }
    paletteIds.push(id); colors.push(color); }
  const geometry = new Uint32Array(total * 2), rgba = new Uint8Array(rawPalettes.length * 1024);
  for (let pi = 0; pi < parts.length; pi++) { const p = parts[pi]!, data = planes[pi]!.slice(), seen = new Set<number>();
    for (let i = 0; i < data.length; i += 5) { const xyz = data[i]! | data[i + 1]! << 8 | data[i + 2]! << 16; if (seen.has(xyz)) fail('duplicate-voxel'); seen.add(xyz); const at = (p.start + i / 5) * 2; geometry[at] = (xyz | data[i + 3]! << 24) >>> 0; geometry[at + 1] = data[i + 4]!; } }
  colors.forEach((p, i) => rgba.set(p, i * 1024));
  const scene: GpuVoxelScene = Object.freeze({ policy: GPU_VOXEL_POLICY, allocations: Object.freeze({ parts: parts.length, palettes: paletteIds.length, voxels: total, residentBytes }) });
  scenes.set(scene, { cap, parts, paletteIds, geometry, rgba }); return scene;
}

// Bounded candidate clipping is part of this experimental presentation policy.
// The allowance covers ordinary mul/add/FMA/division evaluations, not every legal GLSL
// rewrite (notably repeated addition). See the report and retained counterexample.
function candidateAllowance(inv: number[], width: number, height: number) {
  if (inv.some(v => !Number.isFinite(v) || (v !== 0 && Math.abs(v) < 2 ** -126))) fail('candidate-numeric-context');
  const error = [0, 4, 8].map(row => {
    const scale = Math.abs(inv[row]!) * width + Math.abs(inv[row + 1]!) * height + Math.abs(inv[row + 3]!) + 257;
    const d = Math.abs(inv[row + 2]!);
    // Avoid overflow in either direct division or reciprocal/multiply lowering.
    if (d !== 0 && d < scale * 2 ** -100) fail('candidate-numeric-context');
    return scale * 2 ** -16;
  });
  const forward = inverse(inv);
  let residual = 0, magnitude = 0;
  for (let row = 0; row < 3; row++) {
    let rowError = 0, bound = 0;
    for (let col = 0; col < 3; col++) {
      let product = 0, absolute = 0;
      for (let k = 0; k < 3; k++) { const term = forward[row * 4 + k]! * inv[k * 4 + col]!; product += term; absolute += Math.abs(term); }
      rowError += Math.abs((row === col ? 1 : 0) - product) + 64 * Number.EPSILON * (1 + absolute);
      bound += Math.abs(forward[row * 4 + col]!) * (257 + error[col]! + Math.abs(inv[col * 4 + 3]!));
    }
    residual = Math.max(residual, rowError); magnitude = Math.max(magnitude, bound);
  }
  if (!Number.isFinite(residual) || residual > 1 / 1024) fail('candidate-numeric-context');
  const margin = magnitude * (residual / (1 - residual) + 64 * Number.EPSILON);
  const radii = [0, 4, 8].map(row => margin + [0, 1, 2].reduce((n, col) => n + Math.abs(forward[row + col]!) * (.5 + error[col]!), 0));
  return { forward, radii };
}

/** Bounded candidate-clipped highp experiment; CPU Float32 remains a comparison reference. */
export function prepareGpuVoxelFrame(scene: GpuVoxelScene, input: { readonly instances: readonly GpuVoxelInstance[]; readonly width: number; readonly height: number }, lower?: Partial<GpuVoxelLimits>): GpuVoxelFrame {
  const resident = scenes.get(scene); if (!resident) return fail('scene'); const cap = limits(lower, resident.cap), raw = record(input, ['instances', 'width', 'height']);
  const width = integer(raw.width, 1, cap.dimension), height = integer(raw.height, 1, cap.dimension); if (width * height > cap.pixels) fail('pixel-budget');
  return prepareSelectedFrame(scene, resident, cap, width, height, selectInstances(resident, raw.instances, cap));
}
function prepareSelectedFrame(scene: GpuVoxelScene, resident: Resident, cap: GpuVoxelLimits, width: number, height: number, selected: Selection[]): GpuVoxelFrame {
  const placements: Placement[] = [], forwards: number[][] = [];
  let instanceVoxels = 0; for (const p of selected) { const start = instanceVoxels; instanceVoxels += p.part.count; if (instanceVoxels > cap.instanceVoxels) fail('instance-budget');
    const forward = multiply(p.m, p.part.matrix), inverse64 = inverse(forward); placements.push({ id: p.id, part: p.part, palette: p.palette, start, end: instanceVoxels, inverse64 }); forwards.push(forward); }
  const tilesX = Math.ceil(width / 16), tilesY = Math.ceil(height / 16), tileCount = tilesX * tilesY; let samples = 0, binEntries = 0;
  // Reserve worst-case box storage and the fixed frame arrays before allocation.
  const initialBytes = instanceVoxels * 48 + placements.length * (48 + 96) + (tileCount * 3 + 1) * 4; if (initialBytes > cap.frameBytes) fail('frame-budget');
  const counts = new Uint32Array(tileCount), scratch = new Int32Array(instanceVoxels * 8), oldBounds = new Int32Array(instanceVoxels * 4), inverses = new Float32Array(placements.length * 12); let used = 0;
  placements.forEach((p, pi) => { const m = forwards[pi]!; inverses.set(p.inverse64, pi * 12);
    const envelope = candidateAllowance(Array.from(inverses.subarray(pi * 12, pi * 12 + 12)), width, height), em = envelope.forward;
    const rx = (Math.abs(m[0]!) + Math.abs(m[1]!) + Math.abs(m[2]!)) / 2, ry = (Math.abs(m[4]!) + Math.abs(m[5]!) + Math.abs(m[6]!)) / 2,
      rz = (Math.abs(m[8]!) + Math.abs(m[9]!) + Math.abs(m[10]!)) / 2,
      erx = envelope.radii[0]!, ery = envelope.radii[1]!, erz = envelope.radii[2]!;
    for (let i = 0; i < p.part.count; i++) { const word = resident.geometry[(p.part.start + i) * 2]!, x = word & 255, y = word >>> 8 & 255, z = word >>> 16 & 255;
      const cx = m[0]! * (x + .5) + m[1]! * (y + .5) + m[2]! * (z + .5) + m[3]!, cy = m[4]! * (x + .5) + m[5]! * (y + .5) + m[6]! * (z + .5) + m[7]!;
      const cz = m[8]! * (x + .5) + m[9]! * (y + .5) + m[10]! * (z + .5) + m[11]!;
      // Keep the same binary64 arithmetic and bounds without transient arrays per voxel.
      if (!projectionBound(cx - rx) || !projectionBound(cx + rx) || !projectionBound(cy - ry) || !projectionBound(cy + ry) || !projectionBound(cz - rz) || !projectionBound(cz + rz)) fail('projection');
      const ox0 = Math.max(0, Math.ceil(cx - rx - .5)), oy0 = Math.max(0, Math.ceil(cy - ry - .5)), ox1 = Math.min(width, Math.floor(cx + rx - .5) + 1), oy1 = Math.min(height, Math.floor(cy + ry - .5) + 1);
      const ecx = em[0]! * (x + .5) + em[1]! * (y + .5) + em[2]! * (z + .5) + em[3]!,
        ecy = em[4]! * (x + .5) + em[5]! * (y + .5) + em[6]! * (z + .5) + em[7]!,
        ecz = em[8]! * (x + .5) + em[9]! * (y + .5) + em[10]! * (z + .5) + em[11]!;
      if (!Number.isFinite(ecx) || Math.abs(ecx) + erx > 2097152 || !Number.isFinite(ecy) || Math.abs(ecy) + ery > 2097152 || !Number.isFinite(ecz) || Math.abs(ecz) + erz > 2097152) fail('candidate-numeric-context');
      const x0 = Math.max(0, Math.min(ox0, Math.ceil(ecx - erx - .5))), y0 = Math.max(0, Math.min(oy0, Math.ceil(ecy - ery - .5))),
        x1 = Math.min(width, Math.max(ox1, Math.floor(ecx + erx - .5) + 1)), y1 = Math.min(height, Math.max(oy1, Math.floor(ecy + ery - .5) + 1));
      samples += Math.max(0, x1 - x0) * Math.max(0, y1 - y0); if (samples > cap.samples) fail('sample-budget'); if (x0 >= x1 || y0 >= y1) continue;
      const at = used * 8, oldAt = used * 4;
      scratch[at] = x0; scratch[at + 1] = y0; scratch[at + 2] = x1; scratch[at + 3] = y1;
      scratch[at + 4] = p.part.start + i; scratch[at + 5] = pi; scratch[at + 6] = p.start + i;
      oldBounds[oldAt] = ox0; oldBounds[oldAt + 1] = oy0; oldBounds[oldAt + 2] = ox1; oldBounds[oldAt + 3] = oy1; used++;
      for (let by = Math.floor(y0 / 16); by <= Math.floor((y1 - 1) / 16); by++) for (let bx = Math.floor(x0 / 16); bx <= Math.floor((x1 - 1) / 16); bx++) { const b = by * tilesX + bx; counts[b] = counts[b]! + 1; if (counts[b]! > cap.binCandidates || ++binEntries > cap.binEntries) fail('candidate-budget'); }
    }
  });
  let candidateTests = 0; for (let i = 0; i < counts.length; i++) candidateTests += counts[i]! * Math.min(16, width - i % tilesX * 16) * Math.min(16, height - Math.floor(i / tilesX) * 16);
  if (candidateTests > cap.candidateTests) fail('candidate-work-budget');
  const frameBytes = initialBytes + binEntries * 4; if (frameBytes > cap.frameBytes) fail('frame-budget');
  const offsets = new Uint32Array(counts.length + 1); for (let i = 0; i < counts.length; i++) offsets[i + 1] = offsets[i]! + counts[i]!;
  const candidates = new Uint32Array(binEntries), cursor = offsets.slice(0, -1);
  for (let i = 0; i < used; i++) { const at = i * 8; for (let by = Math.floor(scratch[at + 1]! / 16); by <= Math.floor((scratch[at + 3]! - 1) / 16); by++) for (let bx = Math.floor(scratch[at]! / 16); bx <= Math.floor((scratch[at + 2]! - 1) / 16); bx++) { const b = by * tilesX + bx; candidates[cursor[b]!] = i; cursor[b] = cursor[b]! + 1; } }
  const frame: GpuVoxelFrame = Object.freeze({ policy: GPU_VOXEL_POLICY, scene, width, height, allocations: Object.freeze({ instances: placements.length, instanceVoxels, boxes: used, samples, candidateTests, binEntries, maxBinCandidates: counts.reduce((a, b) => Math.max(a, b), 0), frameBytes }) });
  frames.set(frame, { cap, resident, placements, inverses, boxes: scratch.subarray(0, used * 8), oldBounds: oldBounds.subarray(0, used * 4), offsets, candidates, tilesX }); return frame;
}
const f = Math.fround, add = (a: number, b: number) => f(f(a) + f(b)), sub = (a: number, b: number) => f(f(a) - f(b)), mul = (a: number, b: number) => f(f(a) * f(b)), div = (a: number, b: number) => f(f(a) / f(b));
function ray(p: Prepared, box: number, x: number, y: number, mode: 'float32' | 'float64'): number {
  const at = box * 8, pi = p.boxes[at + 5]!, word = p.resident.geometry[p.boxes[at + 4]! * 2]!, inv = mode === 'float32' ? p.inverses : p.placements[pi]!.inverse64, base = mode === 'float32' ? pi * 12 : 0;
  let far = -Infinity, near = Infinity;
  for (let axis = 0; axis < 3; axis++) { const row = base + axis * 4, lo = word >>> (axis * 8) & 255, d = inv[row + 2]!;
    const origin = mode === 'float32' ? add(add(mul(inv[row]!, x + .5), mul(inv[row + 1]!, y + .5)), inv[row + 3]!) : inv[row]! * (x + .5) + inv[row + 1]! * (y + .5) + inv[row + 3]!;
    if (d === 0) { if (origin < lo || origin >= lo + 1) return -Infinity; continue; }
    const a = mode === 'float32' ? div(sub(lo, origin), d) : (lo - origin) / d, b = mode === 'float32' ? div(sub(lo + 1, origin), d) : (lo + 1 - origin) / d;
    far = Math.max(far, Math.min(a, b)); near = Math.min(near, Math.max(a, b)); if (near <= far) return -Infinity;
  }
  return Number.isFinite(near) ? near : -Infinity;
}
/** CPU comparison reference only. Exact displayed interaction uses GpuVoxelRenderer.pick(sequence). */
export function pickGpuVoxelFrame(frame: GpuVoxelFrame, x: number, y: number, mode: 'float32' | 'float64' = 'float32'): GpuVoxelHit | null {
  const p = frames.get(frame); if (!p) return fail('frame'); if (mode !== 'float32' && mode !== 'float64') fail('numeric-policy');
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= frame.width || y >= frame.height) return null; x = Math.floor(x); y = Math.floor(y);
  const bin = Math.floor(y / 16) * p.tilesX + Math.floor(x / 16); let depth = -Infinity, winner = -1;
  for (let n = p.offsets[bin]!; n < p.offsets[bin + 1]!; n++) { const b = p.candidates[n]!, at = b * 8; if (x < p.boxes[at]! || y < p.boxes[at + 1]! || x >= p.boxes[at + 2]! || y >= p.boxes[at + 3]!) continue;
    if (mode === 'float64' && (x < p.oldBounds[b * 4]! || y < p.oldBounds[b * 4 + 1]! || x >= p.oldBounds[b * 4 + 2]! || y >= p.oldBounds[b * 4 + 3]!)) continue;
    const pi = p.boxes[at + 5]!, word = p.resident.geometry[p.boxes[at + 4]! * 2]!, color = word >>> 24;
    if (p.resident.rgba[p.placements[pi]!.palette * 1024 + color * 4 + 3] !== 255) continue;
    const value = ray(p, b, x, y, mode); if (value > depth) { depth = value; winner = b; } }
  if (winner < 0) return null; const at = winner * 8, pi = p.boxes[at + 5]!, placement = p.placements[pi]!, global = p.boxes[at + 4]!, word = p.resident.geometry[global * 2]!;
  return Object.freeze({ instanceId: placement.id, partId: placement.part.id, voxelOrdinal: global - placement.part.start, x: word & 255, y: word >>> 8 & 255, z: word >>> 16 & 255, colorIndex: word >>> 24,
    normalIndex: p.resident.geometry[global * 2 + 1]!, depth, owner: p.boxes[at + 6]! });
}
/** Detached resident arrays for one upload; no mutable simulation state. */
export function copyGpuVoxelSceneData(scene: GpuVoxelScene) { const r = scenes.get(scene); if (!r) return fail('scene'); return { geometry: r.geometry.slice(), rgba: r.rgba.slice() }; }
/** Detached frame staging. Timed callers account for this copy along with preparation. */
export function copyGpuVoxelFrameData(frame: GpuVoxelFrame) { const p = frames.get(frame); if (!p) return fail('frame'); return { inverses: p.inverses.slice(), boxes: p.boxes.slice(), offsets: p.offsets.slice(), candidates: p.candidates.slice(), tilesX: p.tilesX,
  placements: p.placements.map(v => ({ id: v.id, partId: v.part.id, palette: v.palette, start: v.start, end: v.end })) }; }

/** Resolve a diagnostic shader owner/depth pair against an exact factory-owned frame. */
export function resolveGpuVoxelOwner(frame: GpuVoxelFrame, owner: number, depth: number): GpuVoxelHit | null {
  const p = frames.get(frame); if (!p) return fail('frame'); if (owner === 0xffffffff) return null;
  integer(owner, 0, frame.allocations.instanceVoxels - 1); if (!Number.isFinite(depth) || Math.abs(depth) > 2097152) fail('depth');
  const placement = p.placements.find(v => owner >= v.start && owner < v.end); if (!placement) return fail('owner');
  const ordinal = owner - placement.start, global = placement.part.start + ordinal, word = p.resident.geometry[global * 2]!;
  return Object.freeze({ instanceId: placement.id, partId: placement.part.id, voxelOrdinal: ordinal, x: word & 255, y: word >>> 8 & 255, z: word >>> 16 & 255, colorIndex: word >>> 24,
    normalIndex: p.resident.geometry[global * 2 + 1]!, depth, owner });
}

export function assertGpuVoxelScene(scene: GpuVoxelScene): void { if (!scenes.has(scene)) fail('scene'); }
export function assertGpuVoxelFrame(frame: GpuVoxelFrame): void { if (!frames.has(frame)) fail('frame'); }
