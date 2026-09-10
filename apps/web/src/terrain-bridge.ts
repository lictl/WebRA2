// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import { shape,int,code,validAction,validProgress,validResult,type TerrainAction,type TerrainResult,type TerrainProgress } from './terrain-protocol.ts';
import { validWorldAction } from './world-protocol.ts';
export interface TerrainPort { request(action:TerrainAction,signal:AbortSignal,progress?:(p:TerrainProgress)=>void):Promise<TerrainResult>; dispose():void }
export type TerrainWorkerPort=Pick<Worker,'postMessage'|'terminate'|'addEventListener'|'removeEventListener'>;
export class TerrainBridge implements TerrainPort {
  #sequence=0;#pending:((e:Error)=>void)|null=null;#dead=false;#identity:string|null=null;#worldHash:string|null=null;#revision=0;
  constructor(private worker:TerrainWorkerPort=new Worker('/workers/terrain.js',{type:'module'})){}
  request(action:TerrainAction,signal:AbortSignal,progress?:(p:TerrainProgress)=>void):Promise<TerrainResult>{
    if(this.#dead || this.#pending || !validAction(action))return Promise.reject(new Error('unavailable'));
    if(signal.aborted){this.dispose();return Promise.reject(new DOMException('Cancelled','AbortError'));}
    const id=++this.#sequence;
    return new Promise((resolve,reject)=>{
      let settled=false,lastProgress=0;
      const finish=(error?:Error,result?:TerrainResult)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);this.worker.removeEventListener('message',message);this.worker.removeEventListener('error',failed);this.worker.removeEventListener('messageerror',failed);this.#pending=null;if(error){this.#dead=true;this.worker.terminate();reject(error);}else resolve(result!);};
      const abort=()=>finish(new DOMException('Cancelled','AbortError')),failed=()=>finish(new Error('unavailable'));
      const message=(event:Event)=>{
        const v:unknown=(event as MessageEvent).data;
        if(!v || typeof v!=='object' || !Object.hasOwn(v,'id') || (v as {id:unknown}).id!==id)return;
        if(shape(v,['version','id','type','sequence','progress']) && v.version===5 && v.type==='progress' && action.type==='load' && int(v.sequence,1) && v.sequence>lastProgress && validProgress(v.progress)){
          lastProgress=v.sequence;try{progress?.(v.progress);if(!settled)this.worker.postMessage({version:5,id,type:'ack',sequence:v.sequence});}catch{failed();}return;
        }
        if(shape(v,['version','id','type','code']) && v.version===5 && v.type==='error' && code(v.code)){finish(new Error(v.code));return;}
        if(!shape(v,['version','id','type','result']) || v.version!==5 || v.type!=='result' || !validResult(v.result)){finish(new Error('invalid'));return;}
        const result=v.result;
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
          if(result.type!=='frame' || result.frameId!==id || (action.type==='load' && (result.summary.profile!==action.profile || result.camera.width!==action.width || result.camera.height!==action.height)) || (action.type==='render' && Object.entries(action.camera).some(([key,value])=>result.camera[key as keyof typeof result.camera]!==value))){finish(new Error('invalid'));return;}
          const identity=result.summary.profile+':'+result.summary.mapHash+':'+result.summary.contentHash+':'+result.summary.artwork.presentation+':'+(result.summary.artwork.voxel?.presentation??'none')+':'+(result.summary.world?.modelHash??'none');
          if(action.type!=='load' && identity!==this.#identity){finish(new Error('invalid'));return;}
          const expectedRevision=action.type==='load'?0:validWorldAction(action)?this.#revision+1:this.#revision;
          if(result.world && result.world.revision!==expectedRevision){finish(new Error('invalid'));return;}
          if(validWorldAction(action) && (!result.world || !['world-order','world-orders','world-step','world-restore'].includes(action.type))){finish(new Error('invalid'));return;}
          this.#identity=identity;this.#worldHash=result.summary.world?.modelHash??null;this.#revision=result.world?.revision??0;
        }
        finish(undefined,result);
      };
      // Full root hashing can be slow in Safari. Neither timeout promises background execution.
      const timer=setTimeout(()=>finish(new Error('timeout')),action.type==='load'?15*60_000:30_000);
      this.#pending=e=>finish(e);signal.addEventListener('abort',abort,{once:true});this.worker.addEventListener('message',message);this.worker.addEventListener('error',failed);this.worker.addEventListener('messageerror',failed);
      try{this.worker.postMessage({version:5,id,action});}catch{failed();}
    });
  }
  dispose():void{if(this.#dead)return;this.#dead=true;this.#pending?.(new DOMException('Cancelled','AbortError'));this.worker.terminate();}
}
