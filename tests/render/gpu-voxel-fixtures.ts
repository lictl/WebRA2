// SPDX-License-Identifier: GPL-3.0-or-later
// Original browser-importable sparse cube fixtures. No retail assets, Node APIs or native expected values.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { createRuntimeVxl } from '../../packages/formats/src/runtime-vxl.ts';
import { createVoxelAtlas, type VoxelFrameInput } from '../../packages/render/src/voxel-render.ts';
import { createGpuVoxelScene, prepareGpuVoxelFrame, type GpuVoxelFrame } from '../../packages/render/src/gpu-voxel-policy.ts';
type Cell = readonly [number, number, number, number, number];
const hash = (bytes: Uint8Array) => bytesToHex(sha256(bytes));
// Same original constant-layout encoder as the existing voxel tests; no file-derived fixture data.
function vxl(cells: readonly Cell[], size: readonly number[], scale = 1, bounds: readonly number[] = [0, 0, 0, ...size]): Uint8Array {
  const [sx, sy, sz] = size as [number, number, number], columns = sx * sy, rows: number[][] = [];
  for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) { const values = cells.filter(c => c[0] === x && c[1] === y).sort((a, b) => a[2] - b[2]), row: number[] = []; let z = 0;
    for (const c of values) { row.push(c[2] - z, 1, c[3], c[4], 1); z = c[2] + 1; } if (values.length && z < sz) row.push(sz - z, 0, 0); rows.push(row); }
  const body = 830, bodySize = columns * 8 + rows.reduce((n, r) => n + r.length, 0), footer = body + bodySize, bytes = new Uint8Array(footer + 92), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('Voxel Animation\0')); view.setUint32(16, 1, true); view.setUint32(20, 1, true); view.setUint32(24, 1, true); view.setUint32(28, bodySize, true); view.setUint16(32, 0x1f10, true); bytes.set(new TextEncoder().encode('original'), 802); view.setUint32(822, 1, true); let at = columns * 8;
  rows.forEach((r, i) => { view.setInt32(body + i * 4, r.length ? at - columns * 8 : -1, true); bytes.set(r, body + at); at += r.length; view.setInt32(body + columns * 4 + i * 4, r.length ? at - columns * 8 - 1 : -1, true); });
  view.setUint32(footer + 4, columns * 4, true); view.setUint32(footer + 8, columns * 8, true); view.setFloat32(footer + 12, scale, true); for (const i of [0, 5, 10]) view.setFloat32(footer + 16 + i * 4, 1, true); bounds.forEach((n, i) => view.setFloat32(footer + 64 + i * 4, n, true)); bytes.set([...size, 4], footer + 88); return bytes;
}
function hva(m: readonly number[]): Uint8Array { const bytes = new Uint8Array(88), view = new DataView(bytes.buffer); view.setUint32(16, 1, true); view.setUint32(20, 1, true); bytes.set(new TextEncoder().encode('original'), 24); m.forEach((n, i) => view.setFloat32(40 + i * 4, n, true)); return bytes; }
function prepare(cells: readonly Cell[], size: readonly number[], pose: readonly number[] | null, instances: VoxelFrameInput['instances'], width: number, height: number, bounds?: number[], contrast = false) {
  const bytes = vxl(cells, size, 1, bounds), animation = pose ? hva(pose) : null;
  const atlas = createVoxelAtlas({ assets: [{ id: 'source', kind: 'vxl', sha256: hash(bytes), bytes }, ...(animation ? [{ id: 'animation', kind: 'hva' as const, sha256: hash(animation), bytes: animation }] : [])], parts: [{ id: 'part', vxlAssetId: 'source', vxlSection: 0, hva: animation ? { assetId: 'animation', layout: 'frame-major', frame: 0, section: 0 } : null, transformPolicy: 'openra-hva-bounds-scale' }] });
  const rgba = new Uint8Array(1024); for (let i = 0; i < 256; i++) rgba.set([i, 255 - i, i * 17 % 256, i % 11 ? 255 : 0], i * 4);
  const palette = { id: 'palette', rgba, remap: null, transparentIndex: 0 }, contrastRgba = rgba.slice();
  for (let i = 0; i < 256; i++) { contrastRgba[i * 4] = 255 - rgba[i * 4]!; contrastRgba[i * 4 + 1] = rgba[i * 4]!; }
  const palettes = contrast ? [palette, { ...palette, id: 'contrast', rgba: contrastRgba }] : [palette], scene = createGpuVoxelScene({ parts: [{ id: 'part', voxels: createRuntimeVxl(bytes).decodeSection(0).voxels, modelMatrix: atlas.parts[0]!.modelMatrix }], palettes });
  const frame = prepareGpuVoxelFrame(scene, { instances, width, height });
  const reference: VoxelFrameInput = { atlas, instances, palettes, viewport: { width, height, backgroundRgba: [0, 0, 0, 0] }, lighting: 'unlit' };
  return { scene, frame, reference };
}
const instance = (id: string, modelToView: number[]) => ({ id, partId: 'part', paletteId: 'palette', modelToView });
export interface GpuVoxelOracleCase { id: string; frame: GpuVoxelFrame; reference: VoxelFrameInput }
export function gpuVoxelOracleCases(): GpuVoxelOracleCase[] {
  const cases: GpuVoxelOracleCase[] = [], cells: Cell[] = []; for (let z = 0; z < 3; z++) for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) if ((x + y + z) % 3) cells.push([x, y, z, 1 + (x + y * 5 + z * 20) % 253, 7]);
  const poses = [null, [1, .15, 0, .125, 0, 1, -.2, .3, .1, 0, 1, -.1], [.3333333, 0, 0, .5, 0, 1.7, 0, .25, 0, 0, .75, -.2]];
  for (let pi = 0; pi < poses.length; pi++) for (const zoom of [.5, 1, 2, 4]) for (const shift of [0, .25, -.375]) {
    const m = [8 * zoom, -8 * zoom, 0, 30 + shift, 4 * zoom, 4 * zoom, -8 * zoom, 30 - shift, 4, 4, 8, 30];
    cases.push({ id: `pose-${pi}-zoom-${zoom}-shift-${shift}`, ...prepare(cells, [5, 4, 3], poses[pi]!, [instance('body', m)], 64, 64, [0, 0, 0, 5.1, 4.3, 3.7]) });
  }
  for (const difference of [0, 1e-7, -.0000001, .25]) { const a = [4, 0, 0, 10, 0, 4, 0, 10, 0, 0, 1, 10], b = [...a]; b[11] = b[11]! + difference;
    cases.push({ id: `part-tie-${difference}`, ...prepare([[0, 0, 0, 1, 7]], [1, 1, 1], null, [instance('body', a), instance('turret', b)], 24, 24) }); }
  for (const scale of [1 / 1024, 1, 1024]) { const pose = [scale, 0, 0, 0, 0, 1 / scale, 0, 0, 0, 0, 1, 0], m = [1 / scale, 0, 0, 8.5, 0, -scale, 0, 8.5, 0, 0, 1, 1048000];
    cases.push({ id: `extreme-${scale}`, ...prepare([[0, 0, 0, 1, 7]], [1, 1, 1], pose, [instance('body', m)], 24, 24) }); }
  return cases;
}
/** Additional policy-2 cases; keep the original 43-case cohort identifiable. */
export function gpuVoxelBoundaryCases(): GpuVoxelOracleCase[] {
  const a = [4, 0, 0, 10, 0, 4, 0, 10, 0, 0, 1, 10], b = [...a]; b[11] = 10 + 1e-7;
  return [
    { id: 'boundary-contrast-near-tie', ...prepare([[0, 0, 0, 1, 7]], [1, 1, 1], null, [instance('body', a), { ...instance('turret', b), paletteId: 'contrast' }], 24, 24, undefined, true) },
    { id: 'boundary-quantized-inverse-crosses-tile', ...prepare([[0, 0, 0, 1, 7]], [1, 1, 1], null,
      [instance('body', [1, 0, 0, 15.5000001, 0, 1, 0, 15.5000001, 0, 0, 1, 10])], 32, 32) }
  ];
}
/** Explicit original workload, not a replacement for selected source scenes or campaign actors. */
export function gpuVoxelWorkload(groups: number, width = 960, height = 640) {
  if (![16, 64, 256, 1024].includes(groups)) throw Error('original-voxel-workload');
  const cells: Cell[] = []; for (let z = 0; z < 4; z++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (x + y + z > 2) cells.push([x, y, z, 1 + (x + y * 4 + z * 16) % 253, 7]);
  const instances: VoxelFrameInput['instances'][number][] = [];
  for (let i = 0; i < groups; i++) { const x = 24 + i % 32 * 28, y = 24 + Math.floor(i / 32) * 18;
    for (let part = 0; part < 3; part++) instances.push(instance(`actor-${String(i).padStart(4, '0')}-${part}`, [2, -2, 0, x + part, 1, 1, -2, y - part, 1, 1, 2, y + part * .125])); }
  return prepare(cells, [4, 4, 4], null, instances, width, height);
}
