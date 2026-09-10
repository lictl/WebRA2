// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Explicit non-native still composition policy.
import type { TerrainViewport } from '../../../packages/render/src/terrain-scene.ts';
import type { VoxelFrame } from '../../../packages/render/src/voxel-render.ts';
import type { ViewportFrame } from './terrain-worker-runtime.ts';
import { validObjectPick, type ObjectInfo } from './object-protocol.ts';
import { WORLD_VOXEL_LIMITS, type VoxelFrameSummary } from './voxel-protocol.ts';

/** Heading zero, 8 pixels per transformed model unit. Depth is unzoomed, unlike screen rows. */
export function voxelWorldProjection(cell: { column: number; row: number; elevation: number }, view: TerrainViewport): number[] {
  for (const n of [cell.column,cell.row,cell.elevation]) if (!Number.isSafeInteger(n) || Math.abs(n)>1048576) throw new Error('voxel-world-cell');
  if (![.5,1,2,4].includes(view.zoom) || ![view.cameraX,view.cameraY].every(n=>Number.isFinite(n) && Math.abs(n)<=1048576)) throw new Error('voxel-world-camera');
  const gx=cell.column*30+30,gy=cell.row*15+15,z=view.zoom;
  return [8*z,-8*z,0,(gx-view.cameraX)*z,4*z,4*z,-8*z,(gy-cell.elevation*15-view.cameraY)*z,4,4,8,gy+15];
}

/** A genuine renderer frame owns immutable ray picks. Only the copied mask/descriptors join its winning pixels to this world frame. */
export function composeVoxelWorld(base: ViewportFrame, voxel: VoxelFrame, instances: ReadonlyMap<string,ObjectInfo>): ViewportFrame {
  const {width,height}=base.viewport,pixels=width*height;
  if (!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>960||height>640||pixels>WORLD_VOXEL_LIMITS.pixels || voxel.width!==width || voxel.height!==height || base.rgba.byteLength!==pixels*4 || voxel.rgba.byteLength!==pixels*4) throw new Error('voxel-world-frame');
  if(instances.size>WORLD_VOXEL_LIMITS.instances || base.allocations.voxel)throw new Error('voxel-world-instances');
  const sources=new Map<string,ObjectInfo>(),objects=new Set<string>();let characters=0;
  for(const [id,source] of instances){
    if(!/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(id)||source.format!=='voxel'||!source.voxel||!validObjectPick({kind:'object',object:source,canvasX:0,canvasY:0,worldX:0,worldY:0,depth:0}))throw new Error('voxel-world-source');
    const info=Object.freeze({...source,voxel:Object.freeze({...source.voxel})});characters+=JSON.stringify(info).length+id.length;
    if(characters>WORLD_VOXEL_LIMITS.descriptorCharacters)throw new Error('voxel-world-metadata-budget');
    sources.set(id,info);objects.add(info.id);
  }
  const mask=new Uint8Array(pixels),rgba=base.rgba,pickVoxel=voxel.pick,pickBase=base.pick,view=Object.freeze({...base.viewport});
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const at=y*width+x;if(voxel.rgba[at*4+3]===0)continue;
    const front=pickVoxel(x,y),source=front&&sources.get(front.instanceId);
    if(!front||!source||source.voxel!.partId!==front.partId||!Number.isFinite(front.depth)||Math.abs(front.depth)>2097152)throw new Error('voxel-world-owner');
    const behind=pickBase(x,y),depth=behind?.kind==='object'?behind.depth:behind?.kind==='terrain'?behind.cell.depth:null;
    // Equal depth keeps the already composed terrain/SHP owner. Internal voxel ties are renderer-defined.
    if(depth!==null && front.depth<=depth)continue;
    mask[at]=1;rgba.set(voxel.rgba.subarray(at*4,at*4+4),at*4);
  }
  const a=voxel.allocations;
  const allocations:VoxelFrameSummary=Object.freeze({rgbaBytes:a.rgbaBytes,depthBytes:a.privateDepthBytes,ownerBytes:a.privateOwnerBytes,maskBytes:mask.byteLength,
    workBytes:a.projectionWorkBytes,paletteBytes:a.paletteBytes,instanceVoxels:a.instanceVoxels,samples:a.samples,instances:instances.size});
  return {viewport:view,rgba,allocations:{...base.allocations,voxel:allocations,objects:base.allocations.objects+objects.size,
    totalPixelBytes:base.allocations.totalPixelBytes+a.rgbaBytes+a.privateDepthBytes+a.privateOwnerBytes+mask.byteLength},pick(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=width||y>=height)return null;
    const px=Math.floor(x),py=Math.floor(y);if(!mask[py*width+px])return pickBase(px,py);
    const hit=pickVoxel(px,py)!;const original=sources.get(hit.instanceId)!;
    const object=Object.freeze({...original,voxel:Object.freeze({...original.voxel!,voxelOrdinal:hit.voxelOrdinal})});
    return {kind:'object',object,canvasX:px,canvasY:py,worldX:Math.floor(view.cameraX+(px+.5)/view.zoom),worldY:Math.floor(view.cameraY+(py+.5)/view.zoom),depth:hit.depth};
  }};
}
