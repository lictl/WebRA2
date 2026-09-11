// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import type { CampaignSession, CampaignSessionFactory } from './campaign-session.ts';
import type { TerrainViewport } from '../../../packages/render/src/terrain-scene.ts';
import type { GpuScene } from '../../../packages/render/src/gpu-contracts.ts';
import type { SpriteObject } from '../../../packages/render/src/sprite-layer.ts';
import { exportGpuScene } from '../../../packages/render/src/gpu-scene.ts';
import type { ObjectInfo } from './object-protocol.ts';
import { shape, int, validAction, centered, type SceneSummary, type TerrainProgress, type TerrainReply, type TerrainProfile, type FrameSummary, type ViewportPick } from './terrain-protocol.ts';
import { locateWorldActor } from './infantry-slot-projection.ts';
import { projectControlPoints, projectWorldControlPoints } from './world-selection.ts';
import { WorldSession, type WorldPreparation } from './world-session.ts';
import { validWorldAction, type WorldSnapshot } from './world-protocol.ts';
export interface ViewportFrame { readonly viewport: TerrainViewport; readonly rgba: Uint8Array; readonly allocations: Omit<FrameSummary,'voxel'> & { readonly voxel?: FrameSummary['voxel'] }; pick(x:number,y:number):ViewportPick }
export interface GpuViewportSource { readonly scene:GpuScene; readonly objectInfo:readonly ObjectInfo[]; project(world?:WorldSnapshot):{objects:readonly SpriteObject[];retiredObjectIds:string[]} }
export interface ViewportScene { render(viewport:TerrainViewport,world?:WorldSnapshot):ViewportFrame; locate?(x:number,y:number):{x:number;y:number}|null; gpu?():GpuViewportSource; gpuRefusal?:'voxel-layer'|'scene-unavailable' }
export type SceneLoader = (files: File[], profile: TerrainProfile, progress: (p: TerrainProgress)=>void) => Promise<{ scene: ViewportScene; summary: Omit<SceneSummary,'world'>; world?: WorldPreparation }>;
export interface TerrainScope { onmessage: ((event: { data: unknown }) => void) | null; postMessage(message: TerrainReply, transfer?: Transferable[]): void }
/** Per-session worker. A terminated load has no surviving background operation. */
export function attachTerrainWorker(scope: TerrainScope, load: SceneLoader, campaigns?:CampaignSessionFactory): void {
  let lastId=0,busy=false,currentId=0,sequence=0,outstanding=0,scene:ViewportScene|null=null,summary:SceneSummary|null=null,frame:ViewportFrame|null=null,frameId=0,pending:TerrainProgress|null=null;
  let world:WorldSession|null=null,campaign:CampaignSession|null=null;
  let gpu:Omit<GpuViewportSource,'scene'>|null=null,sceneId=0,lastCamera:TerrainViewport|null=null;
  const clearScene=()=>{scene=null;summary=null;frame=null;world=null;frameId=0;gpu=null;sceneId=0;lastCamera=null;};
  const filesFor=(files:{file:File;relativePath:string}[])=>files.map(({file,relativePath})=>{Object.defineProperty(file,'webkitRelativePath',{value:relativePath,configurable:true});return file;});
  const flush=()=>{ if(!busy || outstanding || !pending)return; const progress=pending;pending=null;outstanding=++sequence;scope.postMessage({version:7,id:currentId,type:'progress',sequence,progress}); };
  scope.onmessage=event=>{
    const v=event.data;
    if(shape(v,['version','id','type','sequence']) && v.version===7 && v.type==='ack' && v.id===currentId && v.sequence===outstanding){outstanding=0;flush();return;}
    if(!shape(v,['version','id','action']) || v.version!==7 || !int(v.id,1) || v.id<=lastId || busy)return;
    lastId=v.id;currentId=v.id;const id=v.id;busy=true;pending=null;outstanding=0;
    void(async()=>{
      try{
        if(!validAction(v.action))throw new Error('invalid');const action=v.action;
        const report=(p:TerrainProgress)=>{pending=p;flush();};
        if(action.type==='campaign-scan'){
          clearScene();campaign?.dispose();campaign=null;if(!campaigns)throw new Error('campaign-unavailable');
          campaign=await campaigns(filesFor(action.files),action.profile,report);
          scope.postMessage({version:7,id,type:'result',result:{type:'campaign-plan',plan:campaign.plan}});return;
        }
        if(action.type==='campaign-back'){
          if(!campaign||campaign.plan.fingerprint!==action.fingerprint)throw new Error('campaign-plan-identity');
          clearScene();scope.postMessage({version:7,id,type:'result',result:{type:'campaign-plan',plan:campaign.plan}});return;
        }
        if(action.type==='load'||action.type==='campaign-launch'){
          clearScene();
          let loaded:Awaited<ReturnType<SceneLoader>>;
          if(action.type==='load'){campaign?.dispose();campaign=null;loaded=await load(filesFor(action.files),action.profile,report);}
          else{if(!campaign)throw new Error('campaign-unavailable');loaded=await campaign.load(action.fingerprint,action.entryId,report);}
          scene=loaded.scene;world=loaded.world?new WorldSession(loaded.world):null;summary={...loaded.summary,world:world?.summary??null};
          sceneId=id;
        }
        if(!scene || !summary)throw new Error('unavailable');
        if(validWorldAction(action)){
          if(!world || !lastCamera)throw new Error('unavailable');
          try{
            const result=world.act(action);
            if(result){scope.postMessage({version:7,id,type:'result',result});return;}
          }catch(error){
            const raw=error && typeof error==='object' && 'code' in error?error.code:error instanceof Error?error.message:'';
            const code=typeof raw==='string' && /^[A-Za-z][A-Za-z0-9-]{0,95}$/.test(raw)?raw:'world-ui-invalid-document';
            scope.postMessage({version:7,id,type:'result',result:{type:'world-rejection',modelHash:world.model.sha256,revision:world.revision,code}});return;
          }
        }
        let initializeGpu:GpuScene|null=null;
        if(action.type==='renderer-mode'){
          if(!lastCamera)throw new Error('unavailable');
          if(action.mode==='cpu')gpu=null;
          else{
            if(!scene.gpu){scope.postMessage({version:7,id,type:'result',result:{type:'renderer-refusal',reason:scene.gpuRefusal??'scene-unavailable'}});return;}
            try{const prepared=scene.gpu();initializeGpu=prepared.scene;gpu={objectInfo:prepared.objectInfo,project:prepared.project};}catch{gpu=null;scope.postMessage({version:7,id,type:'result',result:{type:'renderer-refusal',reason:'scene-budget'}});return;}
          }
        }
        if(action.type==='pick'){
          if(!frame || action.frameId!==frameId || action.x>=frame.viewport.width || action.y>=frame.viewport.height)throw new Error('stale-frame');
          scope.postMessage({version:7,id,type:'result',result:{type:'pick',frameId,selection:frame.pick(action.x,action.y)}});
        }else{
          const snapshot=world?.snapshot()??null;
          let camera=(action.type==='load'||action.type==='campaign-launch')?centered(summary,action.width,action.height):action.type==='render'?action.camera:lastCamera!;
          if(action.type==='focus'){
            const actor=snapshot?.actors.find(a=>a.id===action.entityId),point=actor&&summary.world&&scene.locate&&locateWorldActor(summary.world,actor,scene.locate.bind(scene));
            if(!point)throw new Error('world-ui-focus');
            camera={...camera,cameraX:point.x-camera.width/camera.zoom/2,cameraY:point.y-camera.height/camera.zoom/2};
          }
          // The camera and world remain valid across renderer fallback; no session reload.
          lastCamera={...camera,backgroundRgba:[12,18,20,255]};frameId=id;
          const {cameraX,cameraY,zoom,width,height}=camera;
          const controlPoints=projectControlPoints(summary.world,snapshot,camera,scene.locate?.bind(scene));
          if(gpu){
            frame=null;
            // Only compact projection metadata survives this request in the worker.
            const state=gpu.project(snapshot??undefined),resources=initializeGpu?exportGpuScene(initializeGpu):null;
            const transfer:Transferable[]=resources?resources.rasters.flatMap(r=>[r.rgba.buffer as ArrayBuffer,r.depth.buffer as ArrayBuffer]):[];
            scope.postMessage({version:7,id,type:'result',result:{type:'gpu-frame',sceneId,frameId,camera:{cameraX,cameraY,zoom,width,height},summary,world:snapshot,controlPoints,
              worldPoints:projectWorldControlPoints(summary.world,snapshot,scene.locate?.bind(scene)),resources,objectInfo:initializeGpu?[...gpu.objectInfo]:null,objects:state.objects,retiredObjectIds:state.retiredObjectIds}},transfer);return;
          }
          // Drop the previous picking planes before allocating the next CPU viewport.
          frame=null;frame=scene.render(lastCamera,snapshot??undefined);
          const rgba=frame.rgba.buffer as ArrayBuffer;
          scope.postMessage({version:7,id,type:'result',result:{type:'frame',controlPoints,world:snapshot,frameId,camera:{cameraX,cameraY,zoom,width,height},summary,allocations:{...frame.allocations,voxel:frame.allocations.voxel??null},rgba}},[rgba]);
        }
      }catch(error){
        const raw=error && typeof error==='object' && 'code' in error?error.code:error instanceof Error?error.message:'unavailable';
        const code=typeof raw==='string' && /^[A-Za-z][A-Za-z0-9-]{0,95}$/.test(raw)?raw:'unavailable';
        scope.postMessage({version:7,id,type:'error',code});
      }finally{busy=false;pending=null;outstanding=0;}
    })();
  };
}
