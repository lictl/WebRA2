// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Presentation-only GPU experiment contracts.
import type { TerrainViewport } from './terrain-scene.ts';

export const GPU_SCENE_POLICY = 'webra2-gpu-scene-1' as const;
export const GPU_PREPARE_LIMITS = Object.freeze({ rasters: 8192, rasterPixels: 16 * 1024 * 1024,
  rasterBytes: 128 * 1024 * 1024, draws: 327680, samples: 64 * 1024 * 1024,
  viewportDimension: 2048, viewportPixels: 2048 * 2048, coordinate: 1048576 });
export type GpuPrepareLimits = { -readonly [K in keyof typeof GPU_PREPARE_LIMITS]: number };
export const GPU_DEPTH_MIN = -2097151;
export const GPU_DEPTH_MAX = 2097151;
/** 12 signed integers per instance; instances are terrain first, then sprites. */
export const GPU_DRAW_STRIDE = 12;
export const GPU_DRAW = Object.freeze({ x0: 0, y0: 1, x1: 2, y1: 3, left: 4, top: 5,
  raster: 6, depthBase: 7, owner: 8, kind: 9, front: 10, reserved: 11 });

/** Factory identity is checked by gpu-scene.ts; this descriptor exposes no texture bytes. */
export interface GpuScene {
  readonly policy: typeof GPU_SCENE_POLICY;
  readonly nativeBehaviorVerified: false;
  readonly allocations: Readonly<{ rasterCount: number; rasterPixels: number; rasterBytes: number;
    terrainPieces: number; objects: number }>;
}
/** Integer depth offsets are relative to the draw's depthBase; alpha is either 0 or 255. */
export interface GpuRasterData {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
  readonly depth: Int32Array;
  readonly minDepth: number;
  readonly maxDepth: number;
}
/** Returned detached to a renderer once per load. Keep textures resident across draws. */
export interface GpuSceneData {
  readonly scene: GpuScene;
  readonly rasters: readonly GpuRasterData[];
  readonly limits: Readonly<GpuPrepareLimits>;
}
export interface GpuFrame {
  readonly scene: GpuScene;
  readonly viewport: TerrainViewport;
  readonly allocations: Readonly<{ draws: number; terrainDraws: number; objects: number;
    samples: number; axisBytes: number; drawBytes: number }>;
}
/** Owned draw records; source axes reproduce the CPU's binary64 floor expression exactly. */
export interface GpuFrameData {
  readonly frame: GpuFrame;
  readonly scene: GpuScene;
  readonly viewport: TerrainViewport;
  readonly sampleX: Int32Array;
  readonly sampleY: Int32Array;
  readonly draws: Int32Array;
  readonly terrainDraws: number;
}
/** Diagnostic readback only; top-left row-major pixels. None has kind0/owner-1/depth INT32_MIN. */
export interface GpuReadback {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
  readonly depth: Int32Array;
  readonly kind: Uint8Array;
  readonly owner: Int32Array;
}
export interface GpuDrawReceipt {
  readonly sequence: number;
  readonly frame: GpuFrame;
  readonly submitted: true;
  readonly drawCalls: number;
  readonly uploadedBytes: number;
}
export const GPU_RENDERER_LIMITS = Object.freeze({ gpuBytes: 256 * 1024 * 1024,
  textureSide: 2048, textureLayers: 64, instances: 327680 });
export type GpuRendererLimits = { -readonly [K in keyof typeof GPU_RENDERER_LIMITS]: number };
export interface GpuRendererStats {
  readonly state: 'empty' | 'ready' | 'lost' | 'disposed';
  readonly generation: number;
  readonly requestedGpuBytes: number;
  readonly peakRequestedGpuBytes: number;
  readonly ownedCpuBytes: number;
}
