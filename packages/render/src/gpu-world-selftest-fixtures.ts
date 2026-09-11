// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original finite startup probes, no game data.
import { GPU_PREPARE_LIMITS, GPU_SCENE_POLICY, GPU_SCENE_TRANSFER_POLICY, type GpuFrame, type GpuScene, type GpuSceneTransfer } from './gpu-contracts.ts';
import { importGpuScene, prepareGpuFrame } from './gpu-scene.ts';
import { createGpuVoxelScene, prepareGpuVoxelFrame, type GpuVoxelFrame, type GpuVoxelInstance, type GpuVoxelScene } from './gpu-voxel-policy.ts';

export type GpuWorldProbeKind = 'empty' | 'terrain' | 'sprite' | 'voxel';
export interface GpuWorldProbePixel {
  readonly kind: GpuWorldProbeKind;
  readonly id: string | null;
  readonly depth: number | null;
  readonly rgba: readonly [number, number, number, number];
}
export interface GpuWorldSelftestCase {
  readonly id: string;
  readonly base: GpuScene;
  readonly voxel: GpuVoxelScene;
  readonly baseFrame: GpuFrame;
  readonly voxelFrame: GpuVoxelFrame;
  /** Hand-authored full output, independent of either CPU/GPU pick implementation. */
  readonly expected: readonly GpuWorldProbePixel[];
}
const background = Object.freeze([19, 23, 29, 37] as const);
const red = Object.freeze([201, 31, 43, 255] as const), green = Object.freeze([17, 211, 61, 255] as const);
const blue = Object.freeze([41, 67, 229, 255] as const), yellow = Object.freeze([239, 193, 13, 255] as const);
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const empty: GpuWorldProbePixel = Object.freeze({ kind: 'empty', id: null, depth: null, rgba: background });
const terrain: GpuWorldProbePixel = Object.freeze({ kind: 'terrain', id: '0', depth: 7, rgba: red });
const sprite: GpuWorldProbePixel = Object.freeze({ kind: 'sprite', id: 'sprite', depth: 8, rgba: green });
function hit(id: string, depth: number): GpuWorldProbePixel { return Object.freeze({ kind: 'voxel', id, depth, rgba: blue }); }

const boundaryDepths = [2097151, -2097151, 1048000, 1048000, 1048000, -1048000, -1048000, -1048000, 0, -1, 0, 0] as const;
const voxelDepths = [0, 0, 1048000, 1048000.0625, 1047999.9375, -1048000, -1047999.9375, -1048000.0625, -.25, -.25, 0, -0] as const;
function baseScene(mixed: boolean): GpuScene {
  const colors = new Uint8Array(48 * 24 * 4), depths = new Int32Array(48 * 24);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x >= 2 || y >= 2) {
    colors.set(red, (y * 48 + x) * 4); depths[y * 48 + x] = 7;
  }
  boundaryDepths.forEach((d, i) => { depths[11 * 48 + i + 2] = d; });
  const spriteColors = new Uint8Array(4 * 4);
  for (let x = 0; x < 3; x++) spriteColors.set(green, x * 4);
  const packet: GpuSceneTransfer = {
    schemaVersion: 1, policy: GPU_SCENE_TRANSFER_POLICY, scenePolicy: GPU_SCENE_POLICY,
    limits: GPU_PREPARE_LIMITS, spriteObjectLimit: mixed ? 1 : null,
    rasters: mixed ? [
      { id: 0, width: 48, height: 24, rgba: colors, depth: depths, minDepth: -2097151, maxDepth: 2097151 },
      { id: 1, width: 4, height: 1, rgba: spriteColors, depth: new Int32Array(4), minDepth: 0, maxDepth: 0 },
    ] : [],
    terrainGroups: mixed ? [{ left: 0, top: 0, right: 48, bottom: 24, pieces: [{ x: 0, y: 0, rasterId: 0 }] }] : [],
    terrain: mixed ? [{ sourceRecord: 0, x: 1, y: 1, assetId: 'original-terrain', subtile: 0, left: 0, top: 0, groundY: 0, group: 0 }] : [],
    spriteResources: mixed ? [{ frameId: 'frame', paletteId: 'palette', rowStep: 0, rasterId: 1,
      assetId: 'original-sprite', frame: 0, canvasWidth: 4, canvasHeight: 1, rectangle: { x: 0, y: 0, width: 4, height: 1 } }] : [],
    objects: mixed ? [{ id: 'sprite', frameId: 'frame', paletteId: 'palette', x: 3, y: 4, anchorX: 0, anchorY: 0,
      depth: { base: 8, rowStep: 0, terrainTie: 'front' } }] : [],
  };
  return importGpuScene(packet);
}
function voxelScene(mixed: boolean): GpuVoxelScene {
  const rgba = new Uint8Array(1024); rgba.set(blue, 4); rgba.set(yellow, 8);
  return createGpuVoxelScene({ parts: [
    { id: 'blue', voxels: new Uint8Array([0, 0, 0, 1, 7]), modelMatrix: identity },
    ...(mixed ? [
      { id: 'yellow', voxels: new Uint8Array([0, 0, 0, 2, 11]), modelMatrix: identity },
      { id: 'transparent', voxels: new Uint8Array([0, 0, 0, 0, 13]), modelMatrix: identity },
    ] : []),
  ], palettes: [{ id: 'palette', rgba, remap: null, transparentIndex: 0 }] });
}
function instance(id: string, x: number, y: number, depth: number, partId = 'blue'): GpuVoxelInstance {
  // A unit cube has near ray intersection at translationZ + 1.
  return { id, partId, paletteId: 'palette', modelToView: [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, depth - 1] };
}
function makeCase(id: string, mixed: boolean, instances: GpuVoxelInstance[], expected: GpuWorldProbePixel[]): GpuWorldSelftestCase {
  const width = mixed ? 16 : 32, height = mixed ? 16 : 24, base = baseScene(mixed), voxel = voxelScene(mixed);
  const baseFrame = prepareGpuFrame(base, { cameraX: 0, cameraY: 0, zoom: 1, width, height, backgroundRgba: background });
  const voxelFrame = prepareGpuVoxelFrame(voxel, { instances, width, height });
  return Object.freeze({ id, base, voxel, baseFrame, voxelFrame, expected: Object.freeze(expected) });
}

/** Exactly two small scenes / 1,024 pixels. A finite current-context check is not
 * universal highp coverage proof or game/source admission. No caller inputs. */
export function gpuWorldSelftestCases(): readonly GpuWorldSelftestCase[] {
  const expected = Array.from({ length: 256 }, (_, i) => i % 16 < 2 && Math.floor(i / 16) < 2 ? empty : terrain);
  for (let x = 3; x < 6; x++) expected[4 * 16 + x] = sprite;
  const instances = [
    instance('front-terrain', 3, 8, 8), instance('equal-terrain', 4, 8, 7), instance('behind-terrain', 5, 8, 6),
    instance('front-sprite', 3, 4, 9), instance('equal-sprite', 4, 4, 8), instance('behind-sprite', 5, 4, 7),
    instance('sprite-hole', 6, 4, 8), instance('transparent-voxel', 7, 8, 100, 'transparent'),
    instance('a-equal-voxel', 8, 8, 9), instance('z-equal-voxel', 8, 8, 9, 'yellow'),
  ];
  expected[8 * 16 + 3] = hit('front-terrain', 8); expected[4 * 16 + 3] = hit('front-sprite', 9);
  expected[4 * 16 + 6] = hit('sprite-hole', 8); expected[8 * 16 + 8] = hit('a-equal-voxel', 9);
  boundaryDepths.forEach((base, i) => {
    const x = i + 2, depth = voxelDepths[i]!, id = `depth-${i}`, selected = instance(id, x, 11, depth);
    // Reverse the z ray for a negative-zero near value; either zero must tie base0.
    if (i === 11) (selected.modelToView as number[]).splice(10, 2, -1, 0);
    instances.push(selected);
    expected[11 * 16 + x] = depth > base ? hit(id, depth) : Object.freeze({ kind: 'terrain', id: '0', depth: base, rgba: red });
  });
  const edge = new Array<GpuWorldProbePixel>(32 * 24).fill(empty);
  // Inverse translation quantizes to -15.5. Pixel15 is retained by the clipped-ray
  // policy; pixel16 is on the exclusive cube boundary. This probes both bins.
  edge[15 * 32 + 15] = hit('edge', 11);
  return Object.freeze([
    makeCase('mixed-layer-order', true, instances, expected),
    makeCase('quantized-bin-edge', false, [instance('edge', 15.5000001, 15.5000001, 11)], edge),
  ]);
}
