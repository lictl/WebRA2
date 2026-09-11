// SPDX-License-Identifier: GPL-3.0-or-later
// Original scene and movement fixture. No retail sources or native behavior claim.
import { attachTerrainWorker, type TerrainScope, type SceneLoader } from '../../apps/web/src/terrain-worker-runtime.ts';
import { type TerrainReply, type SceneSummary, type TerrainAction } from '../../apps/web/src/terrain-protocol.ts';
import { createTerrainScene } from '../../packages/render/src/terrain-scene.ts';
import { compileGpuScene } from '../../packages/render/src/gpu-scene.ts';
import { makeOriginalTerrain, makeOriginalSprites, originalObject } from '../render/gpu-fixtures.ts';
import type { ObjectInfo } from '../../apps/web/src/object-protocol.ts';
import type { WorldSnapshot } from '../../apps/web/src/world-protocol.ts';
import { originalWorld } from './world-ui.fixture.ts';
export const gpuOriginalSummary:Omit<SceneSummary,'world'>={profile:'ra2',mission:'all01t.map',contentHash:'a'.repeat(64),mapHash:'c'.repeat(64),paletteHash:'e'.repeat(64),
  artwork:{policy:'webra2-object-still-2',presentation:'webra2-placed-still-1',voxel:null,types:0,rendered:0,unavailable:3,assets:0,palettes:0,sourceBytes:0,decodedBytes:0,indexedFrames:0,rows:[],omittedTypes:0,omittedPlacements:3,omittedRendered:0,truncatedFields:0,unplaced:0},
  cells:1,objects:3,assets:1,verifiedBytes:100,sourceBytes:100,decodedBytes:100,decodedSlots:1,bounds:{x:0,y:0,width:100,height:100},diagnostics:[]};
export const gpuOriginalLoad:TerrainAction={type:'load',files:[{file:new File(['original-fixture'],'original.mix'),relativePath:''}],profile:'ra2',width:120,height:80};
export const gpuOriginalInfo:ObjectInfo={id:'object-0',typeId:'type-0',name:'Original',family:'unit',owner:'Original',format:'shp',voxel:null,x:1,y:3,frame:0,sourcePath:'original.shp',sourceHash:'a'.repeat(64),palettePath:'original.pal',paletteHash:'b'.repeat(64)};
export class GpuOriginalWorker extends EventTarget {
  terminated=0;cpuRenders=0;gpuPreparations=0;transferred:number[]=[];messages:TerrainReply[]=[];transform:((reply:TerrainReply)=>TerrainReply)|null=null;readonly scope:TerrainScope;
  constructor(refusal?:'voxel-layer'|'scene-unavailable'|'scene-budget',withSprite=false){
    super();
    const terrain=createTerrainScene(makeOriginalTerrain()),batch=makeOriginalSprites({objects:withSprite?[originalObject({id:'object-0',x:20,y:30})]:[]}).batch,summary=structuredClone(gpuOriginalSummary);
    if(withSprite)Object.assign(summary.artwork,{types:1,rendered:1,unavailable:2,omittedTypes:1,omittedRendered:1,assets:1,palettes:1});
    const project=(snapshot?:WorldSnapshot)=>({objects:batch.objects.map(o=>{const a=snapshot?.actors[0];return a?{...o,x:a.x*20,y:a.y*10}:o;}),retiredObjectIds:[]});
    const loader:SceneLoader=async()=>({world:originalWorld(),summary,scene:{
      locate:(x,y)=>({x:x*20,y:y*10}),
      ...(refusal&&refusal!=='scene-budget'?{gpuRefusal:refusal}:{gpu:()=>{this.gpuPreparations++;if(refusal==='scene-budget')throw new Error('gpu-raster-budget');return {scene:compileGpuScene(terrain,batch),objectInfo:withSprite?[gpuOriginalInfo]:[],project};}}),
      render:(viewport,snapshot)=>{this.cpuRenders++;const frame=terrain.renderSprites(viewport,{...batch,objects:project(snapshot).objects});return {...frame,pick:()=>null};}
    }});
    this.scope={onmessage:null,postMessage:(reply,transfer)=>{
      this.transferred.push(transfer?.length??0);const data=structuredClone(reply,{transfer:transfer??[]});this.messages.push(data);
      queueMicrotask(()=>{if(!this.terminated)this.dispatchEvent(new MessageEvent('message',{data:this.transform?.(data)??data}));});
    }};attachTerrainWorker(this.scope,loader);
  }
  postMessage(message:unknown){const data=structuredClone(message);queueMicrotask(()=>{if(!this.terminated)this.scope.onmessage?.({data});});}
  terminate(){this.terminated++;}
}
