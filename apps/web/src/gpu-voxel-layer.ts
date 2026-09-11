// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Complete presentation groups, no game authority.
import { createGpuVoxelScene, createGpuVoxelInstanceLayout, prepareGpuVoxelLayoutFrame,
  type GpuVoxelScene, type GpuVoxelFrame, type GpuVoxelInstanceLayout } from '../../../packages/render/src/gpu-voxel-policy.ts';
import { captureGpuVoxelResources, retainGpuVoxelMetadata, validateGpuVoxelWorld,
  type GpuVoxelResources, type GpuVoxelResident, type GpuVoxelPlacement } from './gpu-voxel-protocol.ts';
import { voxelWorldProjection } from './world-voxel-compositor.ts';
import type { Camera } from './terrain-protocol.ts';
import type { WorldSnapshot, WorldSummary } from './world-protocol.ts';
import type { ObjectInfo } from './object-protocol.ts';

export interface GpuVoxelLayer {
  readonly scene: GpuVoxelScene;
  readonly groups: GpuVoxelResident['groups'];
  validate(placements: readonly GpuVoxelPlacement[], summary: WorldSummary | null, world: WorldSnapshot | null): void;
  /** Placements are immutable values captured and validated by the presenter. */
  prepare(placements: readonly GpuVoxelPlacement[], camera: Camera): GpuVoxelFrame;
  info(instanceId: string): ObjectInfo | undefined;
  dispose(): void;
}
/** Cold ownership transfer: no geometry packet is retained after genuine scene construction. */
export function createGpuVoxelLayer(input: GpuVoxelResources): GpuVoxelLayer {
  const captured = captureGpuVoxelResources(input);
  let resident: GpuVoxelResident | null = retainGpuVoxelMetadata(captured);
  let scene: GpuVoxelScene | null = createGpuVoxelScene({ parts: captured.parts, palettes: captured.palettes });
  let layout: GpuVoxelInstanceLayout | null = null, membership: readonly string[] = [];
  const metadata = new Map(resident.groups.flatMap(g => g.parts.map(p => [p.instanceId, p.info] as const)));
  function active(): void { if (!scene || !resident) throw new Error('gpu-voxel-layer-disposed'); }
  return Object.freeze({
    get scene() { active(); return scene!; },
    get groups() { active(); return resident!.groups; },
    validate(placements: readonly GpuVoxelPlacement[], summary: WorldSummary | null, world: WorldSnapshot | null) {
      active(); validateGpuVoxelWorld(resident!, placements, summary, world);
    },
    prepare(placements: readonly GpuVoxelPlacement[], camera: Camera) {
      active(); const current = new Map(placements.map(p => [p.objectId, p]));
      const selected = resident!.groups.filter(g => current.has(g.id));
      const ids = selected.map(g => g.id), unchanged = layout !== null && ids.length === membership.length && ids.every((id, i) => id === membership[i]);
      const instances = selected.flatMap(g => {
        const matrix = voxelWorldProjection(current.get(g.id)!, { ...camera, backgroundRgba: [12, 18, 20, 255] });
        return g.parts.map(p => ({ id: p.instanceId, partId: p.partId, paletteId: p.paletteId, modelToView: matrix }));
      });
      const candidate = unchanged ? layout! : createGpuVoxelInstanceLayout(scene!, instances);
      const matrices = new Float64Array(instances.length * 12);
      for (const [i, instance] of instances.entries()) matrices.set(instance.modelToView, i * 12);
      const frame = prepareGpuVoxelLayoutFrame(candidate, { matrices, width: camera.width, height: camera.height });
      // Retirement changes all parts atomically. A failed candidate leaves the previous layout intact.
      layout = candidate; membership = ids; return frame;
    },
    info: (instanceId: string) => metadata.get(instanceId),
    dispose() { scene = null; resident = null; layout = null; membership = []; metadata.clear(); },
  });
}
