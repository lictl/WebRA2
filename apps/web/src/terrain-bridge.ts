// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import { shape,int,code,validAction,validProgress,validResult,type TerrainAction,type TerrainResult,type TerrainProgress } from './terrain-protocol.ts';
import type { CampaignLaunchPlan } from './campaign-protocol.ts';
import { validWorldAction } from './world-protocol.ts';
import { captureGpuFrame } from './gpu-protocol.ts';
import {gpuVoxelResourceIdentity,retainGpuVoxelMetadata,validateGpuVoxelWorld,type GpuVoxelResident} from './gpu-voxel-protocol.ts';
type ResidentIndex={objects:Set<string>;resources:Set<string>;voxel:{metadata:GpuVoxelResident;identity:string}|null};
const sameMembers=(a:Set<string>,b:Set<string>)=>a.size===b.size&&[...a].every(id=>b.has(id));
/** Pin every top-level descriptor before choosing a codec. A switching Proxy
 * cannot enter a different result family during the fallback validator. */
function captureResult(input:unknown):TerrainResult {
  if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)throw new Error('invalid');
  const keys=Reflect.ownKeys(input);if(keys.length>13)throw new Error('invalid');
  const value:Record<string,unknown>={};
  for(const key of keys){
    if(typeof key!=='string'||key==='__proto__')throw new Error('invalid');
    const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!('value'in d))throw new Error('invalid');
    value[key]=d.value;
  }
  if(value.type==='gpu-frame')return captureGpuFrame(value);
  if(!validResult(value))throw new Error('invalid');
  return value;
}
export const TERRAIN_DEADLINES=Object.freeze({load:15*60_000,operation:30_000,replay:180_000});
export interface TerrainPort { request(action:TerrainAction,signal:AbortSignal,progress?:(p:TerrainProgress)=>void):Promise<TerrainResult>; dispose():void }
export type TerrainWorkerPort=Pick<Worker,'postMessage'|'terminate'|'addEventListener'|'removeEventListener'>;
export class TerrainBridge implements TerrainPort {
  #sequence=0;#pending:((e:Error)=>void)|null=null;#dead=false;#identity:string|null=null;#worldHash:string|null=null;#revision=0;#campaign:CampaignLaunchPlan|null=null;#sceneId=0;#gpu=false;
  #resident:ResidentIndex|null=null;
  constructor(private worker:TerrainWorkerPort=new Worker('/workers/terrain.js',{type:'module'})){}
  request(action:TerrainAction,signal:AbortSignal,progress?:(p:TerrainProgress)=>void):Promise<TerrainResult>{
    if(this.#dead || this.#pending || !validAction(action))return Promise.reject(new Error('unavailable'));
    if(signal.aborted){this.dispose();return Promise.reject(new DOMException('Cancelled','AbortError'));}
    if(action.type==='campaign-launch'&&(!this.#campaign||this.#campaign.fingerprint!==action.fingerprint||!this.#campaign.entries.some(e=>e.id===action.entryId&&e.status==='ready')))return Promise.reject(new Error('campaign-plan-identity'));
    if(action.type==='campaign-back'&&this.#campaign?.fingerprint!==action.fingerprint)return Promise.reject(new Error('campaign-plan-identity'));
    const id=++this.#sequence;
    return new Promise((resolve,reject)=>{
      let settled=false,lastProgress=0;
      const finish=(error?:Error,result?:TerrainResult)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);this.worker.removeEventListener('message',message);this.worker.removeEventListener('error',failed);this.worker.removeEventListener('messageerror',failed);this.#pending=null;if(error){this.#dead=true;this.worker.terminate();reject(error);}else resolve(result!);};
      const abort=()=>finish(new DOMException('Cancelled','AbortError')),failed=()=>finish(new Error('unavailable'));
      const message=(event:Event)=>{
        const v:unknown=(event as MessageEvent).data;
        if(!v || typeof v!=='object' || !Object.hasOwn(v,'id') || (v as {id:unknown}).id!==id)return;
        if(shape(v,['version','id','type','sequence','progress']) && v.version===7 && v.type==='progress' && ['load','campaign-scan','campaign-launch'].includes(action.type) && int(v.sequence,1) && v.sequence>lastProgress && validProgress(v.progress)){
          lastProgress=v.sequence;try{progress?.(v.progress);if(!settled)this.worker.postMessage({version:7,id,type:'ack',sequence:v.sequence});}catch{failed();}return;
        }
        if(shape(v,['version','id','type','code']) && v.version===7 && v.type==='error' && code(v.code)){finish(new Error(v.code));return;}
        if(!shape(v,['version','id','type','result']) || v.version!==7 || v.type!=='result'){finish(new Error('invalid'));return;}
        // GPU capture is also its complete validation; retain its one owned snapshot.
        let result:TerrainResult;
        try{result=captureResult(v.result);}catch{finish(new Error('invalid'));return;}
        if(result.type==='campaign-plan'){
          if(action.type==='campaign-scan'?result.plan.profile!==action.profile:action.type==='campaign-back'?result.plan.fingerprint!==action.fingerprint:true){finish(new Error('invalid'));return;}
          this.#campaign=structuredClone(result.plan);this.#identity=null;this.#worldHash=null;this.#revision=0;this.#sceneId=0;this.#gpu=false;this.#resident=null;finish(undefined,result);return;
        }
        if(action.type==='campaign-scan'||action.type==='campaign-back'){finish(new Error('invalid'));return;}
        if(result.type==='renderer-refusal'){
          if(action.type!=='renderer-mode'||action.mode!=='gpu'||!this.#identity||this.#gpu){finish(new Error('invalid'));return;}
          finish(undefined,result);return;
        }

        if(result.type==='world-document' || result.type==='world-rejection'){
          if(!validWorldAction(action) || result.modelHash!==this.#worldHash || result.revision!==this.#revision){finish(new Error('invalid'));return;}
          if(result.type==='world-document'){
            const expected=action.type==='world-save'?'save':action.type==='world-replay-export'?'replay':action.type==='world-replay-validate'?'validated':null;
            if(result.kind!==expected){finish(new Error('invalid'));return;}
          }
          finish(undefined,result);return;
        }
        if(action.type==='pick'){
          if(result.type!=='pick' || result.frameId!==action.frameId){finish(new Error('invalid'));return;}
        }else{
          if((result.type!=='frame'&&result.type!=='gpu-frame') || result.frameId!==id || (action.type==='load' && (result.summary.profile!==action.profile || result.camera.width!==action.width || result.camera.height!==action.height)) || (action.type==='render' && Object.entries(action.camera).some(([key,value])=>result.camera[key as keyof typeof result.camera]!==value))){finish(new Error('invalid'));return;}
          const initializing=action.type==='load'||action.type==='campaign-launch',expectedGpu=initializing?false:action.type==='renderer-mode'?action.mode==='gpu':this.#gpu;
          if((result.type==='gpu-frame')!==expectedGpu){finish(new Error('invalid'));return;}
          if(result.type==='gpu-frame'&&(result.sceneId!==this.#sceneId||((result.resources!==null)!==(action.type==='renderer-mode'&&action.mode==='gpu')))){finish(new Error('invalid'));return;}
          let resident=initializing?null:this.#resident;
          if(result.type==='gpu-frame'){
            if(result.resources){
              const vr=result.voxel?.resources;
              const next:ResidentIndex={objects:new Set(result.resources.objects.map(o=>o.id)),resources:new Set(result.resources.spriteResources.map(r=>JSON.stringify([r.frameId,r.paletteId,r.rowStep]))),
                voxel:vr?{metadata:retainGpuVoxelMetadata(vr),identity:gpuVoxelResourceIdentity(vr)}:null};
              if(resident&&(!sameMembers(next.objects,resident.objects)||!sameMembers(next.resources,resident.resources)||next.voxel?.identity!==resident.voxel?.identity)){finish(new Error('invalid'));return;}
              resident=next;
            }
            if(!resident){finish(new Error('invalid'));return;}
            if((resident.voxel!==null)!==(result.voxel!==undefined)){finish(new Error('invalid'));return;}
            if(resident.voxel){try{validateGpuVoxelWorld(resident.voxel.metadata,result.voxel!.placements,result.summary.world,result.world);}catch{finish(new Error('invalid'));return;}}
            const covered=new Set(result.retiredObjectIds);
            for(const object of result.objects){
              if(!resident.objects.has(object.id)||covered.has(object.id)||!resident.resources.has(JSON.stringify([object.frameId,object.paletteId,object.depth.rowStep]))){finish(new Error('invalid'));return;}
              covered.add(object.id);
            }
            for(const p of result.voxel?.placements??[]){if(covered.has(p.objectId)){finish(new Error('invalid'));return;}covered.add(p.objectId);}
            if(!sameMembers(covered,new Set([...resident.objects,...(resident.voxel?.metadata.groups.map(g=>g.id)??[])]))){finish(new Error('invalid'));return;}
          }
          if(action.type==='load'&&result.summary.mission!==(action.profile==='ra2'?'all01t.map':'all01umd.map')){finish(new Error('invalid'));return;}
          if(action.type==='campaign-launch'){
            const entry=this.#campaign!.entries.find(e=>e.id===action.entryId)!;
            if(result.summary.profile!==this.#campaign!.profile||result.summary.mission!==entry.missionPath||result.summary.mapHash!==entry.missionSha256||result.camera.width!==action.width||result.camera.height!==action.height){finish(new Error('invalid'));return;}
          }
          const identity=result.summary.profile+':'+result.summary.mapHash+':'+result.summary.contentHash+':'+result.summary.artwork.presentation+':'+(result.summary.artwork.voxel?.presentation??'none')+':'+(result.summary.world?.modelHash??'none');
          if(action.type!=='load' && action.type!=='campaign-launch' && identity!==this.#identity){finish(new Error('invalid'));return;}
          const expectedRevision=(action.type==='load'||action.type==='campaign-launch')?0:validWorldAction(action)?this.#revision+1:this.#revision;
          if(result.world && result.world.revision!==expectedRevision){finish(new Error('invalid'));return;}
          if(validWorldAction(action) && (!result.world || !['world-order','world-orders','world-step','world-restore'].includes(action.type))){finish(new Error('invalid'));return;}
          this.#identity=identity;this.#worldHash=result.summary.world?.modelHash??null;this.#revision=result.world?.revision??0;
          if(initializing)this.#sceneId=id;this.#gpu=result.type==='gpu-frame';this.#resident=resident;
        }
        finish(undefined,result);
      };
      // Source replay is independently bounded; a measured 2,379-tick case takes over 30s.
      // Abort terminates the worker. No deadline promises background browser execution.
      const timer=setTimeout(()=>finish(new Error('timeout')),['load','campaign-scan','campaign-launch'].includes(action.type)?TERRAIN_DEADLINES.load:action.type==='world-replay-validate'?TERRAIN_DEADLINES.replay:TERRAIN_DEADLINES.operation);
      this.#pending=e=>finish(e);signal.addEventListener('abort',abort,{once:true});this.worker.addEventListener('message',message);this.worker.addEventListener('error',failed);this.worker.addEventListener('messageerror',failed);
      try{this.worker.postMessage({version:7,id,action});}catch{failed();}
    });
  }
  dispose():void{this.#resident=null;if(this.#dead)return;this.#dead=true;this.#pending?.(new DOMException('Cancelled','AbortError'));this.worker.terminate();}
}
