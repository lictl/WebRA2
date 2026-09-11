// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Presentation messages, never simulation authority.
import type { GpuSceneTransfer } from '../../../packages/render/src/gpu-contracts.ts';
import type { SpriteObject } from '../../../packages/render/src/sprite-layer.ts';
import { validateGpuSceneTransfer, captureGpuSpriteObjects } from '../../../packages/render/src/gpu-scene.ts';
import { shape, rows, int, number, validCamera, validScene, type Camera, type SceneSummary } from './terrain-protocol.ts';
import { validObjectPick, type ObjectInfo } from './object-protocol.ts';
import { isRetiredWorldActor, validWorldSnapshot, WORLD_UI, type WorldSnapshot } from './world-protocol.ts';
import { validControlPoints, type WorldControlPoint } from './world-selection.ts';
import {captureGpuVoxelUpdate,validateGpuVoxelWorld,type GpuVoxelUpdate} from './gpu-voxel-protocol.ts';

export type RendererRefusal = { type:'renderer-refusal'; reason:'voxel-layer'|'scene-unavailable'|'scene-budget' };
export type GpuFrameResult = {
  type:'gpu-frame'; sceneId:number; frameId:number; camera:Camera; summary:SceneSummary;
  world:WorldSnapshot|null; controlPoints:WorldControlPoint[]; worldPoints:WorldControlPoint[];
  resources:GpuSceneTransfer|null; objectInfo:ObjectInfo[]|null;
  objects:readonly SpriteObject[]; retiredObjectIds:string[];
  /** Versioned complete voxel layer. Omitted only for a scene with no rendered voxel groups. */
  voxel?:GpuVoxelUpdate;
};

function messageFields(input:unknown):Record<string,unknown>{
  const keys=['type','sceneId','frameId','camera','summary','world','controlPoints','worldPoints','resources','objectInfo','objects','retiredObjectIds'];
  if(input&&typeof input==='object'&&Object.getOwnPropertyDescriptor(input,'voxel'))keys.push('voxel');
  if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==keys.length)throw new Error('gpu-message');
  const result:Record<string,unknown>={};
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!('value'in d))throw new Error('gpu-message');result[key]=d.value;}
  return result;
}
/** Capture scalar metadata once. Raster planes and sprite geometry use their own bounded codec. */
function captureMetadata(input:Record<string,unknown>):Record<string,unknown>{
  let nodes=0,characters=0;
  const visit=(value:unknown,depth:number):unknown=>{
    if(++nodes>1048576||depth>9)throw new Error('gpu-message');
    if(value===null||typeof value==='number'||typeof value==='boolean')return value;
    if(typeof value==='string'){characters+=value.length;if(characters>16*1024**2||value.length>4096)throw new Error('gpu-message');return value;}
    if(!value||typeof value!=='object')throw new Error('gpu-message');
    if(Array.isArray(value)){
      const length=Object.getOwnPropertyDescriptor(value,'length')?.value;
      if(!int(length,0,32768)||Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==length+1)throw new Error('gpu-message');
      const result:unknown[]=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!('value'in d))throw new Error('gpu-message');result.push(visit(d.value,depth+1));}return result;
    }
    if(Object.getPrototypeOf(value)!==Object.prototype)throw new Error('gpu-message');
    const keys=Reflect.ownKeys(value);if(keys.length>32)throw new Error('gpu-message');const result:Record<string,unknown>={};
    for(const key of keys){if(typeof key!=='string'||key.length>64||key==='__proto__')throw new Error('gpu-message');const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))throw new Error('gpu-message');result[key]=visit(d.value,depth+1);}return result;
  };
  return visit(input,0) as Record<string,unknown>;
}

/** Captured metadata, with borrowed raster planes until importGpuScene takes ownership. */
export function captureGpuFrame(input:unknown):GpuFrameResult {
  const fail=():never=>{throw new Error('gpu-message');};
  const raw=messageFields(input),{resources:rawResources,objects:rawObjects,voxel:rawVoxel,...metadata}=raw;
  const hasVoxel=Object.hasOwn(raw,'voxel'),voxel=hasVoxel?captureGpuVoxelUpdate(rawVoxel):undefined;
  const value:Record<string,unknown>={...captureMetadata(metadata),resources:rawResources,objects:rawObjects};
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
  const voxelCount=summary.artwork.voxel?.rendered??0;
  if((voxelCount>0)!==hasVoxel||!rows(value.retiredObjectIds,WORLD_UI.entities) || objects.length+value.retiredObjectIds.length+(voxel?.placements.length??0)!==summary.artwork.rendered)return fail();
  if(voxel&&((value.resources===null)!==(voxel.resources===null)))return fail();
  if(voxel?.resources){if(voxel.resources.groups.length!==voxelCount)return fail();validateGpuVoxelWorld(voxel.resources,voxel.placements,summary.world,world);}
  const retired=new Set((summary.world?.actors??[]).filter(a=>{const s=live.get(a.id);return s&&isRetiredWorldActor(s);}).map(a=>a.objectId));
  const liveIds=new Set(objects.map(o=>o.id));for(const p of voxel?.placements??[]){if(liveIds.has(p.objectId))return fail();liveIds.add(p.objectId);}let previous='';
  for(const id of value.retiredObjectIds){if(typeof id!=='string'||id<=previous||!retired.has(id)||liveIds.has(id))return fail();previous=id;}
  let resources:GpuSceneTransfer|null=null,objectInfo:ObjectInfo[]|null=null;
  if(value.resources===null){if(value.objectInfo!==null)return fail();}
  else{
    resources=validateGpuSceneTransfer(value.resources);
    if(!rows(value.objectInfo,32768) || value.objectInfo.length!==summary.artwork.rendered-voxelCount)return fail();
    const ids=new Set<string>();let characters=0;objectInfo=[];
    for(const info of value.objectInfo){
      if(!validObjectPick({kind:'object',object:info,canvasX:0,canvasY:0,worldX:0,worldY:0,depth:0}) || (info as ObjectInfo).format!=='shp')return fail();
      const o=info as ObjectInfo;if(ids.has(o.id))return fail();ids.add(o.id);
      characters+=Object.values(o).reduce<number>((n,s)=>n+(typeof s==='string'?s.length:0),0);if(characters>8*1024**2)return fail();
      objectInfo.push({...o});
    }
    if(resources.objects.length!==objectInfo.length || resources.objects.some(o=>!ids.has(o.id)) || objects.some(o=>!ids.has(o.id)))return fail();
    if(voxel?.resources?.groups.some(g=>ids.has(g.id)))return fail();
  }
  return {type:'gpu-frame',sceneId:value.sceneId,frameId:value.frameId,camera:{...camera},summary,world,
    controlPoints:value.controlPoints.map(p=>({...p})),worldPoints:(value.worldPoints as WorldControlPoint[]).map(p=>({...p})),resources,objectInfo,objects,retiredObjectIds:[...value.retiredObjectIds] as string[],...(voxel?{voxel}:{})};
}
export function validGpuResult(value:unknown):value is GpuFrameResult|RendererRefusal {
  if(shape(value,['type','reason'])&&value.type==='renderer-refusal')return ['voxel-layer','scene-unavailable','scene-budget'].includes(value.reason as string);
  try{captureGpuFrame(value);return true;}catch{return false;}
}
