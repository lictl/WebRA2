// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import type { TerrainScene, TerrainFrame } from '../../../packages/render/src/terrain-scene.ts';
import { shape, int, validAction, centered, type SceneSummary, type TerrainProgress, type TerrainReply, type TerrainProfile } from './terrain-protocol.ts';
export type SceneLoader = (files: File[], profile: TerrainProfile, progress: (p: TerrainProgress)=>void) => Promise<{ scene: TerrainScene; summary: SceneSummary }>;
export interface TerrainScope { onmessage: ((event: { data: unknown }) => void) | null; postMessage(message: TerrainReply, transfer?: Transferable[]): void }
/** Per-session worker. A terminated load has no surviving background operation. */
export function attachTerrainWorker(scope: TerrainScope, load: SceneLoader): void {
  let lastId=0,busy=false,currentId=0,sequence=0,outstanding=0,scene:TerrainScene|null=null,summary:SceneSummary|null=null,frame:TerrainFrame|null=null,frameId=0,pending:TerrainProgress|null=null;
  const flush=()=>{ if(!busy || outstanding || !pending)return; const progress=pending;pending=null;outstanding=++sequence;scope.postMessage({version:1,id:currentId,type:'progress',sequence,progress}); };
  scope.onmessage=event=>{
    const v=event.data;
    if(shape(v,['version','id','type','sequence']) && v.version===1 && v.type==='ack' && v.id===currentId && v.sequence===outstanding){outstanding=0;flush();return;}
    if(!shape(v,['version','id','action']) || v.version!==1 || !int(v.id,1) || v.id<=lastId || busy)return;
    lastId=v.id;currentId=v.id;const id=v.id;busy=true;pending=null;outstanding=0;
    void(async()=>{
      try{
        if(!validAction(v.action))throw new Error('invalid');const action=v.action;
        if(action.type==='load'){
          // Release any older scene before preparing replacement resources.
          scene=null;summary=null;frame=null;
          const files=action.files.map(({file,relativePath})=>{Object.defineProperty(file,'webkitRelativePath',{value:relativePath,configurable:true});return file;});
          const loaded=await load(files,action.profile,p=>{pending=p;flush();});scene=loaded.scene;summary=loaded.summary;
        }
        if(!scene || !summary)throw new Error('unavailable');
        if(action.type==='pick'){
          if(!frame || action.frameId!==frameId || action.x>=frame.viewport.width || action.y>=frame.viewport.height)throw new Error('stale-frame');
          scope.postMessage({version:1,id,type:'result',result:{type:'pick',frameId,cell:frame.pick(action.x,action.y)}});
        }else{
          const camera=action.type==='load'?centered(summary,action.width,action.height):action.camera;
          // Drop the previous picking planes before allocating the next viewport.
          frame=null;frame=scene.render({...camera,backgroundRgba:[12,18,20,255]});frameId=id;
          const rgba=frame.rgba.buffer as ArrayBuffer;
          scope.postMessage({version:1,id,type:'result',result:{type:'frame',frameId,camera,summary,allocations:{...frame.allocations},rgba}},[rgba]);
        }
      }catch(error){
        const raw=error && typeof error==='object' && 'code' in error?error.code:error instanceof Error?error.message:'unavailable';
        const code=typeof raw==='string' && /^[A-Za-z][A-Za-z0-9-]{0,95}$/.test(raw)?raw:'unavailable';
        scope.postMessage({version:1,id,type:'error',code});
      }finally{busy=false;pending=null;outstanding=0;}
    })();
  };
}
