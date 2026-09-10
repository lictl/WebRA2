// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import type { TerrainViewport } from '../../../packages/render/src/terrain-scene.ts';
import { shape, int, validAction, centered, type SceneSummary, type TerrainProgress, type TerrainReply, type TerrainProfile, type FrameSummary, type ViewportPick } from './terrain-protocol.ts';
import { WorldSession, type WorldPreparation } from './world-session.ts';
import { validWorldAction, type WorldSnapshot } from './world-protocol.ts';
export interface ViewportFrame { readonly viewport: TerrainViewport; readonly rgba: Uint8Array; readonly allocations: Omit<FrameSummary,'voxel'> & { readonly voxel?: FrameSummary['voxel'] }; pick(x:number,y:number):ViewportPick }
export interface ViewportScene { render(viewport:TerrainViewport,world?:WorldSnapshot):ViewportFrame; locate?(x:number,y:number):{x:number;y:number}|null }
export type SceneLoader = (files: File[], profile: TerrainProfile, progress: (p: TerrainProgress)=>void) => Promise<{ scene: ViewportScene; summary: Omit<SceneSummary,'world'>; world?: WorldPreparation }>;
export interface TerrainScope { onmessage: ((event: { data: unknown }) => void) | null; postMessage(message: TerrainReply, transfer?: Transferable[]): void }
/** Per-session worker. A terminated load has no surviving background operation. */
export function attachTerrainWorker(scope: TerrainScope, load: SceneLoader): void {
  let lastId=0,busy=false,currentId=0,sequence=0,outstanding=0,scene:ViewportScene|null=null,summary:SceneSummary|null=null,frame:ViewportFrame|null=null,frameId=0,pending:TerrainProgress|null=null;
  let world:WorldSession|null=null;
  const flush=()=>{ if(!busy || outstanding || !pending)return; const progress=pending;pending=null;outstanding=++sequence;scope.postMessage({version:4,id:currentId,type:'progress',sequence,progress}); };
  scope.onmessage=event=>{
    const v=event.data;
    if(shape(v,['version','id','type','sequence']) && v.version===4 && v.type==='ack' && v.id===currentId && v.sequence===outstanding){outstanding=0;flush();return;}
    if(!shape(v,['version','id','action']) || v.version!==4 || !int(v.id,1) || v.id<=lastId || busy)return;
    lastId=v.id;currentId=v.id;const id=v.id;busy=true;pending=null;outstanding=0;
    void(async()=>{
      try{
        if(!validAction(v.action))throw new Error('invalid');const action=v.action;
        if(action.type==='load'){
          // Release any older scene before preparing replacement resources.
          scene=null;summary=null;frame=null;world=null;
          const files=action.files.map(({file,relativePath})=>{Object.defineProperty(file,'webkitRelativePath',{value:relativePath,configurable:true});return file;});
          const loaded=await load(files,action.profile,p=>{pending=p;flush();});scene=loaded.scene;world=loaded.world?new WorldSession(loaded.world):null;summary={...loaded.summary,world:world?.summary??null};
        }
        if(!scene || !summary)throw new Error('unavailable');
        if(validWorldAction(action)){
          if(!world || !frame)throw new Error('unavailable');
          try{
            const result=world.act(action);
            if(result){scope.postMessage({version:4,id,type:'result',result});return;}
          }catch(error){
            const raw=error && typeof error==='object' && 'code' in error?error.code:error instanceof Error?error.message:'';
            const code=typeof raw==='string' && /^[A-Za-z][A-Za-z0-9-]{0,95}$/.test(raw)?raw:'world-ui-invalid-document';
            scope.postMessage({version:4,id,type:'result',result:{type:'world-rejection',modelHash:world.model.sha256,revision:world.revision,code}});return;
          }
        }
        if(action.type==='pick'){
          if(!frame || action.frameId!==frameId || action.x>=frame.viewport.width || action.y>=frame.viewport.height)throw new Error('stale-frame');
          scope.postMessage({version:4,id,type:'result',result:{type:'pick',frameId,selection:frame.pick(action.x,action.y)}});
        }else{
          const snapshot=world?.snapshot()??null;
          let camera=action.type==='load'?centered(summary,action.width,action.height):action.type==='render'?action.camera:frame!.viewport;
          if(action.type==='focus'){
            const actor=snapshot?.actors.find(a=>a.id===action.entityId),point=actor&&scene.locate?.(actor.x,actor.y);
            if(!point)throw new Error('world-ui-focus');
            camera={...camera,cameraX:point.x-camera.width/camera.zoom/2,cameraY:point.y-camera.height/camera.zoom/2};
          }
          // Drop the previous picking planes before allocating the next viewport.
          frame=null;frame=scene.render({...camera,backgroundRgba:[12,18,20,255]},snapshot??undefined);frameId=id;
          const rgba=frame.rgba.buffer as ArrayBuffer;
          const {cameraX,cameraY,zoom,width,height}=camera;
          scope.postMessage({version:4,id,type:'result',result:{type:'frame',world:snapshot,frameId,camera:{cameraX,cameraY,zoom,width,height},summary,allocations:{...frame.allocations,voxel:frame.allocations.voxel??null},rgba}},[rgba]);
        }
      }catch(error){
        const raw=error && typeof error==='object' && 'code' in error?error.code:error instanceof Error?error.message:'unavailable';
        const code=typeof raw==='string' && /^[A-Za-z][A-Za-z0-9-]{0,95}$/.test(raw)?raw:'unavailable';
        scope.postMessage({version:4,id,type:'error',code});
      }finally{busy=false;pending=null;outstanding=0;}
    })();
  };
}
