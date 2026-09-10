// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. App-private metadata, never model geometry.
export const WORLD_VOXEL_POLICY = 'webra2-world-voxel-still-1' as const;
export const WORLD_VOXEL_LIMITS = Object.freeze({ pixels: 960 * 640, instances: 4096, placements: 4096, parts: 256,
  instanceVoxels: 1048576, samples: 64 * 1024 ** 2, descriptorCharacters: 1024 * 1024 });
export type VoxelArtworkSummary = { policy: 'webra2-voxel-resources-1'; presentation: typeof WORLD_VOXEL_POLICY;
  types: number; readyTypes: number; placements: number; rendered: number; unavailable: number;
  assets: number; parts: number; sourceBytes: number; geometryBytes: number; selectedVoxels: number; matrices: number };
export type VoxelPickSource = { partId: string; role: 'body' | 'turret' | 'barrel'; section: number;
  hvaPath: string; hvaHash: string; hvaSection: number; hvaFrame: 0; voxelOrdinal: number };
export type VoxelFrameSummary = { rgbaBytes: number; depthBytes: number; ownerBytes: number; maskBytes: number;
  workBytes: number; paletteBytes: number; instanceVoxels: number; samples: number; instances: number };
function fields(v: unknown, names: readonly string[]): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype && Reflect.ownKeys(v).length === names.length &&
    names.every(k => { const d = Object.getOwnPropertyDescriptor(v, k); return d && 'value' in d; });
}
const n = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && !Object.is(v, -0) && v >= 0 && v <= max;
const path = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\u0000-\u001f\u007f]/.test(v);
export function validVoxelSummary(v: unknown): v is VoxelArtworkSummary | null {
  if (v === null) return true;
  return fields(v, ['policy','presentation','types','readyTypes','placements','rendered','unavailable','assets','parts','sourceBytes','geometryBytes','selectedVoxels','matrices']) &&
    v.policy === 'webra2-voxel-resources-1' && v.presentation === WORLD_VOXEL_POLICY && n(v.types,256) && n(v.readyTypes,v.types) &&
    n(v.placements,4096) && n(v.rendered,v.placements) && n(v.unavailable,v.placements) && v.rendered + v.unavailable === v.placements &&
    n(v.assets,256) && n(v.parts,256) && n(v.sourceBytes,128*1024**2) && n(v.geometryBytes,5*1048576) && n(v.selectedVoxels,1048576) && n(v.matrices,65536);
}
export function validVoxelPickSource(v: unknown): v is VoxelPickSource {
  return fields(v,['partId','role','section','hvaPath','hvaHash','hvaSection','hvaFrame','voxelOrdinal']) &&
    typeof v.partId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(v.partId) && ['body','turret','barrel'].some(r=>v.role===r) &&
    n(v.section,255) && path(v.hvaPath) && typeof v.hvaHash === 'string' && /^[a-f0-9]{64}$/.test(v.hvaHash) && n(v.hvaSection,255) && v.hvaFrame===0 && n(v.voxelOrdinal,1048575);
}
export function validVoxelFrame(v: unknown, pixels: number): v is VoxelFrameSummary | null {
  if (v === null) return true;
  return fields(v,['rgbaBytes','depthBytes','ownerBytes','maskBytes','workBytes','paletteBytes','instanceVoxels','samples','instances']) &&
    v.rgbaBytes === pixels*4 && v.depthBytes === pixels*8 && v.ownerBytes === pixels*4 && v.maskBytes === pixels &&
    n(v.workBytes,16*1048576) && n(v.paletteBytes,256*1280) && n(v.instanceVoxels,1048576) && n(v.samples,64*1024**2) && n(v.instances,4096);
}
