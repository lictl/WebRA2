// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../GPU_PROVENANCE.md.
import { GPU_PREPARE_LIMITS, type GpuFrame, type GpuRasterData, type GpuScene } from './gpu-contracts.ts';
import { copyGpuSceneData, pickGpuFrame, visitGpuFramePixel } from './gpu-scene.ts';

export const GPU_PICKER_LIMITS = Object.freeze({ rasterBytes: GPU_PREPARE_LIMITS.rasterBytes, draws: GPU_PREPARE_LIMITS.draws });
export type GpuPickerLimits = { -readonly [K in keyof typeof GPU_PICKER_LIMITS]: number };
export type GpuPick = ReturnType<typeof pickGpuFrame>;
export interface GpuPickerStats {
  readonly state: 'ready' | 'disposed';
  /** Detached RGBA and signed-depth planes; excludes the retained genuine source scene. */
  readonly ownedRasterBytes: number;
  readonly rasterCount: number;
}
export interface GpuPicker {
  pick(frame: GpuFrame, viewX: number, viewY: number): GpuPick;
  stats(): GpuPickerStats;
  dispose(): void;
}
export class GpuPickerError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'GpuPickerError'; }
}
function fail(code: string): never { throw new GpuPickerError(code); }
function limits(options: Partial<GpuPickerLimits>): Readonly<GpuPickerLimits> {
  if (!options || typeof options !== 'object' || ![null, Object.prototype].includes(Object.getPrototypeOf(options))) fail('gpu-picker-limits');
  const result: GpuPickerLimits = { ...GPU_PICKER_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(result, key)) fail('gpu-picker-limit-key');
    const d = Object.getOwnPropertyDescriptor(options, key);
    if (!d || !('value' in d) || !Number.isSafeInteger(d.value) || d.value < 0 || d.value > result[key as keyof GpuPickerLimits]) fail('gpu-picker-limit');
    result[key as keyof GpuPickerLimits] = d.value;
  }
  return Object.freeze(result);
}
interface Owned { scene: GpuScene; rasters: readonly GpuRasterData[]; bytes: number }

/** One bounded scene copy, no GL or frame-plane copies. Caller supplies the exact displayed frame. */
export function createGpuPicker(scene: GpuScene, lowerLimits: Partial<GpuPickerLimits> = {}): GpuPicker {
  const cap = limits(lowerLimits);
  // Check the public allocation descriptor before copying. Only the genuine scene
  // can pass copyGpuSceneData below; forged or changing wrappers cannot authorize a copy.
  if (!scene || typeof scene !== 'object') fail('gpu-picker-scene');
  const allocations = Object.getOwnPropertyDescriptor(scene, 'allocations')?.value as unknown;
  const bytes: unknown = allocations && typeof allocations === 'object' ? Object.getOwnPropertyDescriptor(allocations, 'rasterBytes')?.value : undefined;
  if (!Number.isSafeInteger(bytes) || (bytes as number) < 0 || (bytes as number) > cap.rasterBytes) fail('gpu-picker-raster-budget');
  const copied = copyGpuSceneData(scene);
  let current: Owned | null = { scene, rasters: copied.rasters, bytes: bytes as number };
  return Object.freeze({
    pick(frame: GpuFrame, viewX: number, viewY: number): GpuPick {
      const owned = current; if (!owned) fail('gpu-picker-disposed');
      if (!frame || typeof frame !== 'object' || Object.getOwnPropertyDescriptor(frame, 'scene')?.value !== owned.scene) fail('gpu-picker-frame-scene');
      let terrainDepth = -2147483648, terrainOwner = -1, spriteDepth = -2147483648, spriteOwner = -1;
      const inside = visitGpuFramePixel(frame, viewX, viewY, (rasterId, texel, base, owner, kind, front) => {
        const raster = owned.rasters[rasterId]!;
        if (raster.rgba[texel * 4 + 3] === 0) return;
        const depth = base + raster.depth[texel]!;
        // The genuine packet visits terrain first, then lexical sprite order.
        // Strict comparison retains the earlier owner at equal depth. A sprite's
        // front bit is relevant only to its equality with the terrain winner.
        if (kind === 1) {
          if (depth > terrainDepth) { terrainDepth = depth; terrainOwner = owner; }
        } else if ((terrainOwner === -1 || depth > terrainDepth || depth === terrainDepth && front) && depth > spriteDepth) {
          spriteDepth = depth; spriteOwner = owner;
        }
      }, cap.draws);
      if (!inside) return null;
      const sample = spriteOwner !== -1 ? { kind: 2, owner: spriteOwner, depth: spriteDepth }
        : terrainOwner !== -1 ? { kind: 1, owner: terrainOwner, depth: terrainDepth }
          : { kind: 0, owner: -1, depth: -2147483648 };
      return pickGpuFrame(frame, sample, viewX, viewY);
    },
    stats(): GpuPickerStats { return Object.freeze({ state: current ? 'ready' : 'disposed', ownedRasterBytes: current?.bytes ?? 0, rasterCount: current?.rasters.length ?? 0 }); },
    dispose(): void { current = null; },
  });
}
