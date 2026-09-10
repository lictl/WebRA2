// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. DOM-independent viewport job state.
import { TerrainBridge,type TerrainPort } from './terrain-bridge.ts';
import { centered,VIEW_LIMIT,validCamera,type Camera,type FrameResult,type TerrainProfile,type TerrainProgress,type ViewportPick,type Zoom } from './terrain-protocol.ts';
import type { Locale } from './i18n.ts';
import { WORLD_UI, worldDocumentText, type WorldAction, type WorldDocument } from './world-protocol.ts';
import { LocalWorldStorage, type WorldStorage, type SaveSlot } from './world-storage.ts';
export type TerrainState={locale:Locale;profile:TerrainProfile;phase:'empty'|'selected'|'loading'|'ready'|'cancelled'|'failed';files:number;bytes:number;busy:boolean;progress:TerrainProgress|null;frame:FrameResult|null;selection:ViewportPick;notice:string;error:string|null;running:boolean;playerId:number|null;selectedEntity:number|null;slot:SaveSlot;worldNotice:string;replayHash:string|null};
export function canPick(state:TerrainState,x:number,y:number):boolean {const f=state.frame;return !!f && !state.busy && state.phase==='ready' && Number.isInteger(x) && Number.isInteger(y) && x>=0 && y>=0 && x<f.camera.width && y<f.camera.height;}
export class TerrainController{
  #files:File[]=[];#port:TerrainPort|null=null;#active:AbortController|null=null;#generation=0;#desired:Camera|null=null;#listeners=new Set<(s:TerrainState)=>void>();#width=960;#height=640;
  state:TerrainState;
  constructor(locale:Locale='en',private factory:()=>TerrainPort=()=>new TerrainBridge(),private storage:WorldStorage=new LocalWorldStorage()){this.state={locale,profile:'ra2',phase:'empty',files:0,bytes:0,busy:false,progress:null,frame:null,selection:null,notice:'choose',error:null,running:false,playerId:null,selectedEntity:null,slot:1,worldNotice:'worldPaused',replayHash:null};}
  subscribe(fn:(s:TerrainState)=>void):()=>void{this.#listeners.add(fn);fn(this.state);return()=>this.#listeners.delete(fn);}
  #update(p:Partial<TerrainState>):void{this.state={...this.state,...p};for(const fn of this.#listeners)fn(this.state);}
  #stop():void{this.#generation++;this.#active?.abort();this.#active=null;this.#port?.dispose();this.#port=null;this.#desired=null;this.state={...this.state,running:false,playerId:null,selectedEntity:null,replayHash:null,worldNotice:'worldPaused'};}
  select(files:ArrayLike<File>):void{
    this.#stop();if(!Number.isSafeInteger(files.length) || files.length<0 || files.length>VIEW_LIMIT.files){this.#files=[];this.#update({phase:'failed',files:0,bytes:0,busy:false,progress:null,frame:null,selection:null,notice:'tooMany',error:null});return;}
    this.#files=Array.from(files);this.#update({phase:files.length?'selected':'empty',files:files.length,bytes:this.#files.reduce((n,f)=>n+f.size,0),busy:false,progress:null,frame:null,selection:null,notice:files.length?'selected':'choose',error:null});
  }
  setLocale(locale:Locale):void{if(locale==='en'||locale==='zh-Hant')this.#update({locale});}
  setProfile(profile:TerrainProfile):void{if((profile!=='ra2'&&profile!=='yr')||profile===this.state.profile)return;this.#stop();this.#update({profile,phase:this.#files.length?'selected':'empty',frame:null,selection:null,progress:null,busy:false,notice:this.#files.length?'selected':'choose',error:null});}
  cancel():void{if(!this.state.busy)return;this.#stop();this.#update({phase:'cancelled',frame:null,selection:null,progress:null,busy:false,notice:'cancelled',error:null});}
  leave():void{this.#stop();this.#update({phase:this.#files.length?'selected':'empty',frame:null,selection:null,progress:null,busy:false,notice:this.#files.length?'selected':'choose',error:null});}
  async load():Promise<void>{
    if(!this.#files.length || this.state.busy)return;this.#stop();const generation=this.#generation,active=new AbortController();this.#active=active;
    this.#update({phase:'loading',frame:null,selection:null,busy:true,progress:null,notice:'loading',error:null});
    try{
      const port=this.factory();this.#port=port;
      const result=await port.request({type:'load',profile:this.state.profile,files:this.#files.map(file=>({file,relativePath:file.webkitRelativePath||''})),width:this.#width,height:this.#height},active.signal,p=>{if(generation===this.#generation)this.#update({progress:p});});
      if(generation!==this.#generation)return;if(result.type!=='frame')throw new Error('invalid');
      this.#active=null;this.#desired={...result.camera};const playerId=result.summary.world?.defaultPlayerId??null;this.#update({phase:'ready',busy:false,progress:null,frame:result,notice:'ready',playerId,selectedEntity:result.summary.world?.actors.find(a=>a.owner===playerId&&a.movable)?.id??null});
      // A resize during load changes the desired next viewport, not the in-flight request.
      if(result.camera.width!==this.#width || result.camera.height!==this.#height)this.resize(this.#width,this.#height);
    }catch(e){this.#failure(e,generation);}
  }
  #failure(e:unknown,generation:number):void{if(generation!==this.#generation)return;this.#stop();this.#update({phase:'failed',busy:false,progress:null,frame:null,selection:null,notice:'failure',error:e instanceof Error?e.message:'unavailable'});}
  resize(width:number,height:number):void{
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height))return;this.#width=Math.max(1,Math.min(VIEW_LIMIT.width,width));this.#height=Math.max(1,Math.min(VIEW_LIMIT.height,height));
    const old=this.#desired;if(!old || (old.width===this.#width&&old.height===this.#height))return;
    this.#camera({...old,cameraX:old.cameraX+(old.width-this.#width)/old.zoom/2,cameraY:old.cameraY+(old.height-this.#height)/old.zoom/2,width:this.#width,height:this.#height});
  }
  pan(dx:number,dy:number):void{const c=this.#desired;if(c && Number.isFinite(dx)&&Number.isFinite(dy))this.#camera({...c,cameraX:c.cameraX+dx/c.zoom,cameraY:c.cameraY+dy/c.zoom});}
  zoom(zoom:Zoom):void{const c=this.#desired;if(c && [0.5,1,2,4].includes(zoom))this.#camera({...c,cameraX:c.cameraX+c.width/c.zoom/2-c.width/zoom/2,cameraY:c.cameraY+c.height/c.zoom/2-c.height/zoom/2,zoom});}
  reset():void{const f=this.state.frame;if(f)this.#camera(centered(f.summary,this.#width,this.#height));}
  #camera(camera:Camera):void{if(!validCamera(camera))return;this.#desired=camera;this.#update({selection:null});void this.#render();}
  async #render():Promise<void>{
    if(this.state.busy || !this.#desired || !this.#port || this.state.phase!=='ready')return;
    const camera={...this.#desired},generation=this.#generation,active=new AbortController();this.#active=active;this.#update({busy:true,notice:'rendering'});
    try{
      const result=await this.#port.request({type:'render',camera},active.signal);if(generation!==this.#generation)return;if(result.type!=='frame')throw new Error('invalid');
      this.#active=null;const current=this.#desired && Object.entries(camera).every(([k,v])=>this.#desired![k as keyof Camera]===v);
      this.#update({busy:false,...(current?{frame:result,notice:'ready'}:{})});if(!current)void this.#render();
    }catch(e){this.#failure(e,generation);}
  }
  async pick(x:number,y:number):Promise<void>{
    const frame=this.state.frame;if(!frame||!this.#port||!canPick(this.state,x,y))return;
    const generation=this.#generation,active=new AbortController();this.#active=active;this.#update({busy:true,notice:'picking'});
    try{
      const result=await this.#port.request({type:'pick',frameId:frame.frameId,x,y},active.signal);if(generation!==this.#generation)return;if(result.type!=='pick'||result.frameId!==this.state.frame?.frameId)throw new Error('invalid');
      this.#active=null;const cameraCurrent=this.#desired && Object.entries(frame.camera).every(([k,v])=>this.#desired![k as keyof Camera]===v);
      this.#update({busy:false,...(cameraCurrent?{selection:result.selection,notice:result.selection?'picked':'background'}:{})});if(!cameraCurrent)void this.#render();
      if(cameraCurrent && result.selection?.kind==='object'){const objectId=result.selection.object.id,actor=this.state.frame?.summary.world?.actors.find(a=>a.objectId===objectId);if(actor)this.selectEntity(actor.id);}
    }catch(e){this.#failure(e,generation);}
  }
  selectEntity(id:number):void{if(this.state.frame?.summary.world?.actors.some(a=>a.id===id))this.#update({selectedEntity:id});}
  async focusEntity():Promise<void>{
    const entityId=this.state.selectedEntity;if(entityId===null||!this.#port||this.state.busy||!this.state.frame)return;
    const generation=this.#generation,active=new AbortController();this.#active=active;this.#update({busy:true,selection:null});
    try{const result=await this.#port.request({type:'focus',entityId},active.signal);if(generation!==this.#generation)return;if(result.type!=='frame')throw new Error('invalid');this.#active=null;this.#desired={...result.camera};this.#update({frame:result,busy:false,notice:'ready'});if(result.camera.width!==this.#width||result.camera.height!==this.#height)this.resize(this.#width,this.#height);}catch(e){this.#failure(e,generation);}
  }
  setPlayer(id:number|null):void{if(this.state.busy)return;if(id!==null&&!this.state.frame?.summary.world?.players.some(p=>p.id===id))return;this.#update({playerId:id,running:false,selectedEntity:this.state.frame?.summary.world?.actors.find(a=>a.owner===id&&a.movable)?.id??null});}
  setSlot(slot:SaveSlot):void{if(!this.state.busy&&[1,2,3].includes(slot))this.#update({slot});}
  setRunning(running:boolean):void{const active=running&&!this.state.busy&&this.state.phase==='ready'&&!!this.state.frame?.world;this.#update({running:active,worldNotice:active?'worldRunning':'worldPaused'});}
  hidden():void{this.#update({running:false,worldNotice:'worldHidden'});}
  canOrder():boolean{const a=this.state.frame?.summary.world?.actors.find(a=>a.id===this.state.selectedEntity);return !!a&&a.movable&&a.owner!==null&&a.owner===this.state.playerId&&!this.state.busy;}
  async #worldOperation(run:(signal:AbortSignal,request:(action:WorldAction)=>Promise<WorldDocument|null>)=>Promise<WorldDocument|null>):Promise<WorldDocument|null>{
    if(this.state.busy||!this.#port||!this.state.frame?.world||this.state.phase!=='ready')return null;
    const generation=this.#generation,port=this.#port,active=new AbortController();let transportFailed=false;this.#active=active;this.#update({busy:true,error:null});
    const live=()=>generation===this.#generation&&!active.signal.aborted;
    const request=async(action:WorldAction):Promise<WorldDocument|null>=>{
      let result;try{result=await port.request(action,active.signal);}catch(error){transportFailed=true;throw error;}if(!live())return null;
      if(result.type==='world-rejection'){this.#update({running:false,worldNotice:'worldRejected',error:result.code});return null;}
      if(result.type==='world-document')return result;
      if(result.type!=='frame'||!result.world)throw new Error('invalid');
      this.#update({frame:result,selection:null,notice:'ready',worldNotice:action.type==='world-restore'?'worldLoaded':this.state.running?'worldRunning':'worldPaused',replayHash:null});return null;
    };
    try{const result=await run(active.signal,request);return live()?result:null;}
    catch(error){if(live()){if(transportFailed)this.#failure(error,generation);else{const code=error instanceof Error?error.message:'unavailable';this.#update({running:false,worldNotice:['quota','storage','empty'].includes(code)?'world'+code[0]!.toUpperCase()+code.slice(1):'worldRejected',error:code});}}return null;}
    finally{if(live()){this.#active=null;this.#update({busy:false});const camera=this.state.frame?.camera;if(camera&&this.#desired&&Object.entries(camera).some(([k,v])=>this.#desired![k as keyof Camera]!==v))void this.#render();}}
  }
  async step(ticks=1):Promise<void>{await this.#worldOperation(async(_signal,request)=>request({type:'world-step',ticks}));}
  async order(x?:number,y?:number):Promise<void>{if(!this.canOrder())return;const playerId=this.state.playerId!,entityId=this.state.selectedEntity!;await this.#worldOperation(async(_signal,request)=>request(x===undefined?{type:'world-order',order:'stop',playerId,entityId}:{type:'world-order',order:'move',playerId,entityId,x,y:y!}));}
  async saveWorld():Promise<void>{this.setRunning(false);const slot=this.state.slot;await this.#worldOperation(async(signal,request)=>{const result=await request({type:'world-save'});if(!result?.text||signal.aborted)return null;await this.storage.write(slot,result.text,signal);if(!signal.aborted)this.#update({worldNotice:'worldSaved'});return null;});}
  async loadWorld():Promise<void>{this.setRunning(false);const slot=this.state.slot;await this.#worldOperation(async(signal,request)=>{const text=await this.storage.read(slot,signal);if(signal.aborted)return null;if(!text)throw new Error('empty');return request({type:'world-restore',text});});}
  async deleteWorld():Promise<void>{this.setRunning(false);const slot=this.state.slot;await this.#worldOperation(async(signal)=>{await this.storage.remove(slot,signal);if(!signal.aborted)this.#update({worldNotice:'worldDeleted'});return null;});}
  async importWorld(file:Pick<File,'size'|'text'>,kind:'save'|'replay'):Promise<void>{
    this.setRunning(false);await this.#worldOperation(async(signal,request)=>{if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>WORLD_UI.documentBytes)throw new Error('invalid');const text=await file.text();if(signal.aborted)return null;if(!worldDocumentText(text))throw new Error('invalid');const result=await request({type:kind==='save'?'world-restore':'world-replay-validate',text});if(result?.kind==='validated'&&!signal.aborted)this.#update({worldNotice:'worldVerified',replayHash:result.stateHash});return null;});
  }
  async exportWorld(kind:'save'|'replay'):Promise<{text:string;name:string}|null>{this.setRunning(false);const profile=this.state.profile;const result=await this.#worldOperation(async(_signal,request)=>request({type:kind==='save'?'world-save':'world-replay-export'}));return result?.text?{text:result.text,name:`webra2-world-${profile}-${kind}-${result.revision}.json`}:null;}
  async verifyWorld():Promise<void>{this.setRunning(false);await this.#worldOperation(async(signal,request)=>{const replay=await request({type:'world-replay-export'});if(!replay?.text||signal.aborted)return null;const result=await request({type:'world-replay-validate',text:replay.text});if(result?.kind==='validated'&&!signal.aborted)this.#update({worldNotice:'worldVerified',replayHash:result.stateHash});return null;});}
  dispose():void{this.#stop();this.#files=[];this.state={...this.state,frame:null,selection:null};this.#listeners.clear();}
}
