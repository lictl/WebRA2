// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Presentation messages, never simulation authority.
import type { GpuSceneTransfer } from '../../../packages/render/src/gpu-contracts.ts';
import type { SpriteObject } from '../../../packages/render/src/sprite-layer.ts';
import { validateGpuSceneTransfer, captureGpuSpriteObjects } from '../../../packages/render/src/gpu-scene.ts';
import { shape, rows, int, number, validCamera, validScene, type Camera, type SceneSummary } from './terrain-protocol.ts';
import { validObjectPick, type ObjectInfo } from './object-protocol.ts';
import { isRetiredWorldActor, validWorldSnapshot, WORLD_UI, type WorldSnapshot } from './world-protocol.ts';
import { validControlPoints, type WorldControlPoint } from './world-selection.ts';

export type RendererRefusal = { type:'renderer-refusal'; reason:'voxel-layer'|'scene-unavailable'|'scene-budget' };
export type GpuFrameResult = {
  type:'gpu-frame'; sceneId:number; frameId:number; camera:Camera; summary:SceneSummary;
  world:WorldSnapshot|null; controlPoints:WorldControlPoint[]; worldPoints:WorldControlPoint[];
  resources:GpuSceneTransfer|null; objectInfo:ObjectInfo[]|null;
  objects:readonly SpriteObject[]; retiredObjectIds:string[];
};

/** Captured metadata, with borrowed raster planes until importGpuScene takes ownership. */
export function captureGpuFrame(value:unknown):GpuFrameResult {
  const fail=():never=>{throw new Error('gpu-message');};
  if(!shape(value,['type','sceneId','frameId','camera','summary','world','controlPoints','worldPoints','resources','objectInfo','objects','retiredObjectIds']) || value.type!=='gpu-frame' || !int(value.sceneId,1) || !int(value.frameId,value.sceneId) || !validCamera(value.camera) || !validScene(value.summary))return fail();
  const {summary,camera}=value;
  if(summary.world===null?value.world!==null:!validWorldSnapshot(value.world,summary.world))return fail();
  const world=value.world as WorldSnapshot|null;
  if(!validControlPoints(value.controlPoints,camera.width,camera.height,summary.world,world) || !rows(value.worldPoints,WORLD_UI.entities))return fail();
  const actors=new Map(summary.world?.actors.map(a=>[a.id,a])??[]),live=new Map(world?.actors.map(a=>[a.id,a])??[]);
  let prior=0;
  for(const p of value.worldPoints){
    if(!shape(p,['entityId','x','y']) || !int(p.entityId,prior+1) || !number(p.x) || !number(p.y))return fail();
    const info=actors.get(p.entityId),actor=live.get(p.entityId);
    if(!info?.movable || actor?.health===null || actor?.health===undefined || actor.health<=0)return fail();
    prior=p.entityId;
  }
  const objects=captureGpuSpriteObjects(value.objects);
  if(!rows(value.retiredObjectIds,WORLD_UI.entities) || objects.length+value.retiredObjectIds.length!==summary.artwork.rendered || summary.artwork.voxel?.rendered)return fail();
  const retired=new Set((summary.world?.actors??[]).filter(a=>{const s=live.get(a.id);return s&&isRetiredWorldActor(s);}).map(a=>a.objectId));
  const liveIds=new Set(objects.map(o=>o.id));let previous='';
  for(const id of value.retiredObjectIds){if(typeof id!=='string'||id<=previous||!retired.has(id)||liveIds.has(id))return fail();previous=id;}
  let resources:GpuSceneTransfer|null=null,objectInfo:ObjectInfo[]|null=null;
  if(value.resources===null){if(value.objectInfo!==null)return fail();}
  else{
    resources=validateGpuSceneTransfer(value.resources);
    if(!rows(value.objectInfo,32768) || value.objectInfo.length!==summary.artwork.rendered)return fail();
    const ids=new Set<string>();let characters=0;objectInfo=[];
    for(const info of value.objectInfo){
      if(!validObjectPick({kind:'object',object:info,canvasX:0,canvasY:0,worldX:0,worldY:0,depth:0}) || (info as ObjectInfo).format!=='shp')return fail();
      const o=info as ObjectInfo;if(ids.has(o.id))return fail();ids.add(o.id);
      characters+=Object.values(o).reduce<number>((n,s)=>n+(typeof s==='string'?s.length:0),0);if(characters>8*1024**2)return fail();
      objectInfo.push({...o});
    }
    if(resources.objects.length!==objectInfo.length || resources.objects.some(o=>!ids.has(o.id)) || objects.some(o=>!ids.has(o.id)))return fail();
  }
  return {type:'gpu-frame',sceneId:value.sceneId,frameId:value.frameId,camera:{...camera},summary:structuredClone(summary),world:world?structuredClone(world):null,
    controlPoints:value.controlPoints.map(p=>({...p})),worldPoints:(value.worldPoints as WorldControlPoint[]).map(p=>({...p})),resources,objectInfo,objects,retiredObjectIds:[...value.retiredObjectIds] as string[]};
}
export function validGpuResult(value:unknown):value is GpuFrameResult|RendererRefusal {
  if(shape(value,['type','reason'])&&value.type==='renderer-refusal')return ['voxel-layer','scene-unavailable','scene-budget'].includes(value.reason as string);
  try{captureGpuFrame(value);return true;}catch{return false;}
}
