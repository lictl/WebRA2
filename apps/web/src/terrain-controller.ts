// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. DOM-independent viewport job state.
import type { CampaignLaunchPlan, CampaignFaction } from './campaign-protocol.ts';
import { TerrainBridge,type TerrainPort } from './terrain-bridge.ts';
import { centered,VIEW_LIMIT,validCamera,type Camera,type DisplayFrame,type TerrainProfile,type TerrainProgress,type ViewportPick,type Zoom } from './terrain-protocol.ts';
import type { GpuViewport, GpuViewportDisplay, GpuViewportFailure } from './gpu-viewport.ts';
import { actorsInBox, controllable, selectWorldActors, type SelectionBox, type SelectionMode } from './world-selection.ts';
import type { Locale } from './i18n.ts';
import { WorldControlGroups, type ControlGroupContext, type ControlGroupFeedback } from './world-control-groups.ts';
import { WORLD_UI, worldDocumentText, type WorldAction, type WorldDocument } from './world-protocol.ts';
import { LocalWorldStorage, type WorldStorage, type SaveSlot } from './world-storage.ts';
export type TerrainState={locale:Locale;profile:TerrainProfile;phase:'empty'|'selected'|'loading'|'choosing'|'ready'|'cancelled'|'failed';campaign:CampaignLaunchPlan|null;files:number;bytes:number;busy:boolean;verifyingReplay:boolean;progress:TerrainProgress|null;frame:DisplayFrame|null;selection:ViewportPick;notice:string;error:string|null;running:boolean;playerId:number|null;selectedEntity:number|null;selectedEntities:number[];interactionEpoch:number;interacting:boolean;slot:SaveSlot;controlGroupFeedback:ControlGroupFeedback|null;worldNotice:string;replayHash:string|null;rendererNotice:string;presentationSequence:number;gpuDisplayedFrameId:number};
export function canPick(state:TerrainState,x:number,y:number):boolean {const f=state.frame;return !!f && (f.type==='frame'||state.gpuDisplayedFrameId===f.frameId) && !state.busy && state.phase==='ready' && Number.isInteger(x) && Number.isInteger(y) && x>=0 && y>=0 && x<f.camera.width && y<f.camera.height;}
export class TerrainController{
  #files:File[]=[];#port:TerrainPort|null=null;#active:AbortController|null=null;#generation=0;#desired:Camera|null=null;#listeners=new Set<(s:TerrainState)=>void>();#width=960;#height=640;
  #controlGroups=new WorldControlGroups();
  #gpu:GpuViewport|null=null;#fallbackPending=false;#fallbackScheduled=false;
  state:TerrainState;
  constructor(locale:Locale='en',private factory:()=>TerrainPort=()=>new TerrainBridge(),private storage:WorldStorage=new LocalWorldStorage()){this.state={locale,profile:'ra2',phase:'empty',campaign:null,files:0,bytes:0,busy:false,verifyingReplay:false,progress:null,frame:null,selection:null,notice:'choose',error:null,running:false,playerId:null,selectedEntity:null,selectedEntities:[],interactionEpoch:0,interacting:false,slot:1,controlGroupFeedback:null,worldNotice:'worldPaused',replayHash:null,rendererNotice:'rendererCpu',presentationSequence:0,gpuDisplayedFrameId:0};}
  subscribe(fn:(s:TerrainState)=>void):()=>void{this.#listeners.add(fn);fn(this.state);return()=>this.#listeners.delete(fn);}
  #update(p:Partial<TerrainState>):void{
    if(Object.hasOwn(p,'frame')&&p.frame?.type!=='gpu-frame'){this.#gpu?.dispose();this.#gpu=null;this.#fallbackPending=false;p={...p,gpuDisplayedFrameId:0,presentationSequence:0};}
    if(p.frame?.type==='gpu-frame'&&p.frame.frameId!==this.state.frame?.frameId)p={...p,gpuDisplayedFrameId:0};
    this.state={...this.state,...p};
    if(Object.hasOwn(p,'frame')){const f=this.state.frame;const ids=this.state.selectedEntities.filter(id=>controllable(f?.summary.world,f?.world,this.state.playerId,id));this.state={...this.state,selectedEntities:ids,selectedEntity:ids[0]??null};}
    if(this.#controlGroups.sync(this.#groupContext()))this.state={...this.state,controlGroupFeedback:null};
    for(const fn of this.#listeners)fn(this.state);
    if(this.#fallbackPending&&!this.state.busy&&!this.#fallbackScheduled){this.#fallbackScheduled=true;queueMicrotask(()=>{this.#fallbackScheduled=false;if(this.#fallbackPending)void this.setRenderer('cpu');});}
  }
  #groupContext():ControlGroupContext|null{const f=this.state.frame;return this.state.phase==='ready'&&f?.summary.world&&f.world?{scene:this.#generation,summary:f.summary.world,snapshot:f.world,playerId:this.state.playerId}:null;}
  #stop():void{this.#gpu?.dispose();this.#gpu=null;this.#fallbackPending=false;this.#controlGroups.clear();this.#generation++;this.#active?.abort();this.#active=null;this.#port?.dispose();this.#port=null;this.#desired=null;this.state={...this.state,campaign:null,verifyingReplay:false,running:false,playerId:null,selectedEntity:null,selectedEntities:[],interactionEpoch:this.state.interactionEpoch+1,interacting:false,replayHash:null,controlGroupFeedback:null,worldNotice:'worldPaused',rendererNotice:'rendererCpu',presentationSequence:0,gpuDisplayedFrameId:0};}
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
      this.#active=null;this.#desired={...result.camera};const playerId=result.summary.world?.defaultPlayerId??null;this.#update({phase:'ready',busy:false,progress:null,frame:result,notice:'ready',playerId,selectedEntities:result.summary.world?.actors.filter(a=>a.owner===playerId&&a.movable).slice(0,1).map(a=>a.id)??[]});
      // A resize during load changes the desired next viewport, not the in-flight request.
      if(result.camera.width!==this.#width || result.camera.height!==this.#height)this.resize(this.#width,this.#height);
    }catch(e){this.#failure(e,generation);}
  }
  async scanCampaigns():Promise<void>{
    if(!this.#files.length||this.state.busy)return;this.#stop();const generation=this.#generation,active=new AbortController();this.#active=active;
    this.#update({phase:'loading',frame:null,selection:null,busy:true,progress:null,notice:'loading',error:null});
    try{
      const port=this.factory();this.#port=port;
      const result=await port.request({type:'campaign-scan',profile:this.state.profile,files:this.#files.map(file=>({file,relativePath:file.webkitRelativePath||''}))},active.signal,p=>{if(generation===this.#generation)this.#update({progress:p});});
      if(generation!==this.#generation)return;if(result.type!=='campaign-plan')throw new Error('invalid');
      this.#active=null;this.#update({phase:'choosing',campaign:result.plan,busy:false,progress:null,notice:'selected'});
    }catch(e){this.#failure(e,generation);}
  }
  async launchCampaign(entryId:CampaignFaction):Promise<void>{
    const plan=this.state.campaign,port=this.#port;if(!port||!plan||this.state.phase!=='choosing'||this.state.busy||!plan.entries.some(e=>e.id===entryId&&e.status==='ready'))return;
    const generation=this.#generation,active=new AbortController();this.#active=active;
    this.#update({phase:'loading',frame:null,selection:null,busy:true,progress:null,notice:'loading',error:null});
    try{
      const result=await port.request({type:'campaign-launch',fingerprint:plan.fingerprint,entryId,width:this.#width,height:this.#height},active.signal,p=>{if(generation===this.#generation)this.#update({progress:p});});
      if(generation!==this.#generation)return;if(result.type!=='frame')throw new Error('invalid');
      this.#active=null;this.#desired={...result.camera};const playerId=result.summary.world?.defaultPlayerId??null;
      this.#update({phase:'ready',busy:false,progress:null,frame:result,notice:'ready',playerId,selectedEntities:result.summary.world?.actors.filter(a=>a.owner===playerId&&a.movable).slice(0,1).map(a=>a.id)??[]});
      if(result.camera.width!==this.#width||result.camera.height!==this.#height)this.resize(this.#width,this.#height);
    }catch(e){this.#failure(e,generation);}
  }
  async backCampaigns():Promise<void>{
    const plan=this.state.campaign,port=this.#port;if(!plan||!port||this.state.busy)return;
    this.setRunning(false);this.cancelInteraction();const generation=this.#generation,active=new AbortController();this.#active=active;this.#update({busy:true});
    try{
      const result=await port.request({type:'campaign-back',fingerprint:plan.fingerprint},active.signal);
      if(generation!==this.#generation)return;if(result.type!=='campaign-plan')throw new Error('invalid');
      this.#active=null;this.#desired=null;this.#update({phase:'choosing',campaign:result.plan,frame:null,selection:null,busy:false,progress:null,playerId:null,selectedEntity:null,selectedEntities:[],replayHash:null,worldNotice:'worldPaused'});
    }catch(e){this.#failure(e,generation);}
  }
  #failure(e:unknown,generation:number):void{if(generation!==this.#generation)return;this.#stop();this.#update({phase:'failed',busy:false,progress:null,frame:null,selection:null,notice:'failure',error:e instanceof Error?e.message:'unavailable'});}
  camera():Camera|null{return this.#desired?{...this.#desired}:null;}
  presentationToken():number{return this.state.frame?.type==='gpu-frame'?this.state.presentationSequence:this.state.frame?.frameId??0;}
  attachGpu(presenter:GpuViewport):boolean{
    const f=this.state.frame;if(f?.type!=='gpu-frame'||this.#fallbackPending)return false;
    this.#gpu?.dispose();this.#gpu=presenter;
    // The importer/presenter owns resident planes now. Do not retain the transient packet in app state.
    this.#update({frame:{...f,resources:null,objectInfo:null},gpuDisplayedFrameId:0});return true;
  }
  gpuDisplayed(presenter:GpuViewport,display:GpuViewportDisplay):void{
    const f=this.state.frame;
    if(this.#gpu!==presenter||f?.type!=='gpu-frame'||f.frameId!==display.frameId||f.world?.revision!==display.world?.revision||f.world?.stateHash!==display.world?.stateHash)return;
    const camera={...display.camera},controlPoints=f.worldPoints.flatMap(p=>{const x=Math.floor((p.x-camera.cameraX)*camera.zoom),y=Math.floor((p.y-camera.cameraY)*camera.zoom);return x>=0&&y>=0&&x<camera.width&&y<camera.height?[{entityId:p.entityId,x,y}]:[];});
    this.#update({frame:{...f,camera,controlPoints},gpuDisplayedFrameId:f.frameId,presentationSequence:display.sequence});
  }
  gpuFailed(presenter:GpuViewport|null,reason:GpuViewportFailure,sceneId?:number):void{
    const f=this.state.frame;if(f?.type!=='gpu-frame'||(presenter!==null&&this.#gpu!==presenter)||(sceneId!==undefined&&f.sceneId!==sceneId))return;
    this.#gpu?.dispose();this.#gpu=null;this.#fallbackPending=true;
    this.#update({frame:{...f,resources:null,objectInfo:null},gpuDisplayedFrameId:0,selection:null,rendererNotice:reason==='context-lost'?'rendererLost':'rendererUnavailable'});
  }
  async setRenderer(mode:'gpu'|'cpu'):Promise<void>{
    if(this.state.busy||!this.#port||this.state.phase!=='ready'||!this.state.frame)return;
    if(mode==='gpu'&&this.state.frame.type==='gpu-frame'||mode==='cpu'&&this.state.frame.type==='frame'){this.#fallbackPending=false;return;}
    const generation=this.#generation,port=this.#port,active=new AbortController(),fallback=this.#fallbackPending;this.#active=active;this.#fallbackPending=false;
    this.cancelInteraction();this.#update({busy:true,selection:null,...(fallback?{}:{rendererNotice:mode==='gpu'?'rendererPreparing':'rendererCpu'})});
    try{
      // Worker camera may lag local RAF pans. Synchronize without advancing the world before CPU fallback.
      if(mode==='cpu'&&this.#desired){await port.request({type:'render',camera:{...this.#desired}},active.signal);if(generation!==this.#generation)return;}
      const result=await port.request({type:'renderer-mode',mode},active.signal);if(generation!==this.#generation)return;
      this.#active=null;
      if(result.type==='renderer-refusal'){this.#update({busy:false,rendererNotice:result.reason==='voxel-layer'?'rendererVoxel':'rendererUnavailable'});return;}
      if(mode==='gpu'?result.type!=='gpu-frame'||!result.resources:result.type!=='frame')throw new Error('invalid');
      if(result.type!=='frame'&&result.type!=='gpu-frame')throw new Error('invalid');
      if(mode==='cpu'){this.#gpu?.dispose();this.#gpu=null;}
      this.#update({frame:result,busy:false,gpuDisplayedFrameId:0,presentationSequence:0,notice:'ready',rendererNotice:fallback?'rendererRestored':mode==='gpu'?'rendererGpu':'rendererCpu'});
      if(mode==='cpu'&&this.#desired&&Object.entries(result.camera).some(([k,v])=>this.#desired![k as keyof Camera]!==v))void this.#render();
    }catch(e){this.#failure(e,generation);}
  }
  resize(width:number,height:number):void{
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height))return;this.#width=Math.max(1,Math.min(VIEW_LIMIT.width,width));this.#height=Math.max(1,Math.min(VIEW_LIMIT.height,height));
    const old=this.#desired;if(!old || (old.width===this.#width&&old.height===this.#height))return;
    this.#camera({...old,cameraX:old.cameraX+(old.width-this.#width)/old.zoom/2,cameraY:old.cameraY+(old.height-this.#height)/old.zoom/2,width:this.#width,height:this.#height});
  }
  pan(dx:number,dy:number):void{const c=this.#desired;if(c && Number.isFinite(dx)&&Number.isFinite(dy))this.#camera({...c,cameraX:c.cameraX+dx/c.zoom,cameraY:c.cameraY+dy/c.zoom});}
  zoom(zoom:Zoom):void{const c=this.#desired;if(c && [0.5,1,2,4].includes(zoom))this.#camera({...c,cameraX:c.cameraX+c.width/c.zoom/2-c.width/zoom/2,cameraY:c.cameraY+c.height/c.zoom/2-c.height/zoom/2,zoom});}
  reset():void{const f=this.state.frame;if(f)this.#camera(centered(f.summary,this.#width,this.#height));}
  #camera(camera:Camera):void{if(!validCamera(camera))return;this.#desired=camera;this.#update({selection:null,...(this.state.frame?.type==='gpu-frame'?{gpuDisplayedFrameId:0}:{})});if(this.state.frame?.type==='gpu-frame'){try{this.#gpu?.setCamera(camera);}catch{this.gpuFailed(this.#gpu,'draw-failed');}}else void this.#render();}
  async #render():Promise<void>{
    if(this.state.busy || !this.#desired || !this.#port || this.state.phase!=='ready'||this.state.frame?.type==='gpu-frame')return;
    const camera={...this.#desired},generation=this.#generation,active=new AbortController();this.#active=active;this.#update({busy:true,notice:'rendering'});
    try{
      const result=await this.#port.request({type:'render',camera},active.signal);if(generation!==this.#generation)return;if(result.type!=='frame')throw new Error('invalid');
      this.#active=null;const current=this.#desired && Object.entries(camera).every(([k,v])=>this.#desired![k as keyof Camera]===v);
      this.#update({busy:false,...(current?{frame:result,notice:'ready'}:{})});if(!current)void this.#render();
    }catch(e){this.#failure(e,generation);}
  }
  async pick(x:number,y:number,mode:SelectionMode|'inspect'='replace'):Promise<ViewportPick|undefined>{
    const frame=this.state.frame;if(!frame||!this.#port||!canPick(this.state,x,y))return;
    if(frame.type==='gpu-frame'){
      if(!this.#gpu)return;const picked=this.#gpu.pick(x,y,this.state.presentationSequence);
      this.#update({selection:picked,notice:picked?'picked':'background'});
      if(mode!=='inspect'){const actor=picked?.kind==='object'?frame.summary.world?.actors.find(a=>a.objectId===picked.object.id):null;if(actor)this.selectEntities([actor.id],mode);else if(mode==='replace')this.clearSelection(false);}
      return picked;
    }
    const generation=this.#generation,epoch=this.state.interactionEpoch,active=new AbortController();this.#active=active;this.#update({busy:true,notice:'picking'});
    try{
      const result=await this.#port.request({type:'pick',frameId:frame.frameId,x,y},active.signal);if(generation!==this.#generation)return;if(result.type!=='pick'||result.frameId!==this.state.frame?.frameId)throw new Error('invalid');
      this.#active=null;const cameraCurrent=epoch===this.state.interactionEpoch && this.#desired && Object.entries(frame.camera).every(([k,v])=>this.#desired![k as keyof Camera]===v);
      this.#update({busy:false,...(cameraCurrent?{selection:result.selection,notice:result.selection?'picked':'background'}:{})});if(!cameraCurrent)void this.#render();
      if(cameraCurrent && mode!=='inspect'){
        const actor=result.selection?.kind==='object'?this.state.frame?.summary.world?.actors.find(a=>a.objectId===(result.selection?.kind==='object'?result.selection.object.id:'')):null;
        if(actor)this.selectEntities([actor.id],mode);
        else if(mode==='replace')this.clearSelection(false);
      }
      return cameraCurrent?result.selection:undefined;
    }catch(e){this.#failure(e,generation);}
  }
  setInteracting(active:boolean):boolean{if(active&&(this.state.busy||this.state.phase!=='ready'||!this.state.frame||this.state.frame.type==='gpu-frame'&&this.state.gpuDisplayedFrameId!==this.state.frame.frameId))return false;this.#update({interacting:active});return true;}
  cancelInteraction():void{this.#update({interacting:false,interactionEpoch:this.state.interactionEpoch+1});}
  clearSelection(clearInspection=true):void{this.#update({selectedEntities:[],selectedEntity:null,interacting:false,interactionEpoch:this.state.interactionEpoch+1,...(clearInspection?{selection:null}:{}),worldNotice:'worldSelectionCleared'});}
  selectEntities(ids:readonly number[],mode:SelectionMode='replace'):boolean{
    const frame=this.state.frame;if(this.state.busy||!frame?.world||!frame.summary.world)return false;
    if(ids.length>WORLD_UI.entities){this.#update({worldNotice:'worldSelectionLimit'});return false;}
    const selected=selectWorldActors(this.state.selectedEntities,ids,mode,frame.summary.world,frame.world,this.state.playerId);
    const cleared=!ids.length || (mode==='toggle' && ids.some(id=>controllable(frame.summary.world,frame.world,this.state.playerId,id)));
    this.#update({selectedEntities:selected.ids,selectedEntity:selected.ids[0]??null,interactionEpoch:this.state.interactionEpoch+1,worldNotice:selected.limited?'worldSelectionLimit':!selected.ids.length?(cleared?'worldSelectionCleared':'worldCannotSelect'):'worldSelectionChanged'});return !selected.limited;
  }
  controlGroup(slot:number,assign:boolean):boolean{
    const context=this.#groupContext();if(!context||this.state.busy||this.state.verifyingReplay||typeof assign!=='boolean')return false;
    const result=this.#controlGroups.use(context,slot,assign,this.state.selectedEntities);if(!result)return false;
    this.#update({controlGroupFeedback:result.feedback,interacting:false,interactionEpoch:this.state.interactionEpoch+1,
      ...(result.ids?{selectedEntities:result.ids,selectedEntity:result.ids[0]??null,selection:null}:{})});return true;
  }
  selectEntity(id:number):void{this.selectEntities([id]);}
  selectBox(frameId:number,box:SelectionBox,additive=false):boolean{
    const frame=this.state.frame;if(!frame||this.presentationToken()!==frameId||!canPick(this.state,box.left,box.top)||!canPick(this.state,box.right,box.bottom)||box.left>box.right||box.top>box.bottom)return false;
    return this.selectEntities(actorsInBox(frame.controlPoints,box),additive?'add':'replace');
  }
  async moveAt(x:number,y:number):Promise<void>{
    const frame=this.state.frame,epoch=this.state.interactionEpoch,presentation=this.presentationToken();if(!this.canOrder()||!frame){this.#update({worldNotice:this.state.busy?'worldControlsBusy':'worldCannotOrder'});return;}
    const picked=await this.pick(x,y,'inspect');
    if(epoch!==this.state.interactionEpoch||frame.frameId!==this.state.frame?.frameId||presentation!==this.presentationToken()||picked===undefined)return;
    if(picked?.kind==='object'){
      const target=frame.summary.world?.actors.find(a=>a.objectId===picked.object.id);
      if(target&&target.owner!==this.state.playerId){await this.attack(target.id);return;}
    }
    if(picked?.kind!=='terrain'){this.#update({worldNotice:'worldExposedGround'});return;}
    await this.order(picked.cell.x,picked.cell.y);
  }
  async focusEntity():Promise<void>{
    const entityId=this.state.selectedEntity;if(entityId===null||!this.#port||this.state.busy||!this.state.frame)return;
    if(this.state.frame.type==='gpu-frame'){const point=this.state.frame.worldPoints.find(p=>p.entityId===entityId),c=this.#desired;if(point&&c)this.#camera({...c,cameraX:point.x-c.width/c.zoom/2,cameraY:point.y-c.height/c.zoom/2});return;}
    const generation=this.#generation,active=new AbortController();this.#active=active;this.#update({busy:true,selection:null});
    try{const result=await this.#port.request({type:'focus',entityId},active.signal);if(generation!==this.#generation)return;if(result.type!=='frame')throw new Error('invalid');this.#active=null;this.#desired={...result.camera};this.#update({frame:result,busy:false,notice:'ready'});if(result.camera.width!==this.#width||result.camera.height!==this.#height)this.resize(this.#width,this.#height);}catch(e){this.#failure(e,generation);}
  }
  setPlayer(id:number|null):void{if(this.state.busy)return;if(id!==null&&!this.state.frame?.summary.world?.players.some(p=>p.id===id))return;this.#update({playerId:id,running:false,selectedEntity:null,selectedEntities:[],selection:null,interacting:false,interactionEpoch:this.state.interactionEpoch+1,worldNotice:'worldSelectionCleared'});}
  setSlot(slot:SaveSlot):void{if(!this.state.busy&&[1,2,3].includes(slot))this.#update({slot});}
  setRunning(running:boolean):void{const active=running&&!this.state.busy&&this.state.phase==='ready'&&!!this.state.frame?.world;this.#update({running:active,worldNotice:active?'worldRunning':'worldPaused'});}
  hidden():void{this.#update({running:false,worldNotice:'worldHidden'});}
  canOrder():boolean{const f=this.state.frame;return !this.state.busy&&this.state.selectedEntities.length>0&&this.state.selectedEntities.every(id=>controllable(f?.summary.world,f?.world,this.state.playerId,id));}
  canAttack(targetId:number):boolean{
    const f=this.state.frame;if(!this.canOrder()||!f?.summary.world?.combatPolicy)return false;
    const target=f.summary.world.actors.find(a=>a.id===targetId),state=f.world?.actors.find(a=>a.id===targetId);
    return !!target&&target.owner!==this.state.playerId&&target.combatRole!=='movement-only'&&state?.health!==null&&state?.health!==undefined&&state.health>0&&this.state.selectedEntities.every(id=>f.summary.world!.actors.find(a=>a.id===id)?.combatRole==='attacker');
  }
  async attack(targetId:number):Promise<void>{
    if(!this.canAttack(targetId)){this.#update({worldNotice:this.state.busy?'worldControlsBusy':'worldAttackUnsupported'});return;}
    const playerId=this.state.playerId!,entityIds=this.state.selectedEntities.slice(),expectedRevision=this.state.frame!.world!.revision;
    await this.#worldOperation(async(signal,request)=>{await request({type:'world-orders',order:'attack',targetId,playerId,entityIds,expectedRevision});if(!signal.aborted&&this.state.error===null)this.#update({worldNotice:'worldOrdersQueued'});return null;});
  }
  async #worldOperation(run:(signal:AbortSignal,request:(action:WorldAction)=>Promise<WorldDocument|null>)=>Promise<WorldDocument|null>):Promise<WorldDocument|null>{
    if(this.state.busy||!this.#port||!this.state.frame?.world||this.state.phase!=='ready')return null;
    const generation=this.#generation,port=this.#port,active=new AbortController();let transportFailed=false;this.#active=active;this.#update({busy:true,error:null});
    const live=()=>generation===this.#generation&&!active.signal.aborted;
    const request=async(action:WorldAction):Promise<WorldDocument|null>=>{
      if(action.type==='world-replay-validate')this.#update({verifyingReplay:true,worldNotice:'worldVerifying'});
      let result;try{result=await port.request(action,active.signal);}catch(error){transportFailed=true;throw error;}if(!live())return null;
      if(result.type==='world-rejection'){this.#update({running:false,worldNotice:result.code==='world-ui-group-blocked'?'worldGroupBlocked':result.code==='world-ui-group-budget-exhausted'?'worldGroupBudget':result.code==='world-ui-attack-range'?'worldAttackRange':result.code==='world-ui-attack-moving'?'worldAttackMoving':result.code==='world-ui-attack-context'?'worldAttackContext':result.code==='world-ui-attack-unsupported'?'worldAttackUnsupported':'worldRejected',error:result.code});return null;}
      if(result.type==='world-document')return result;
      if((result.type!=='frame'&&result.type!=='gpu-frame')||!result.world)throw new Error('invalid');
      if(action.type==='world-restore'){this.#controlGroups.clear();this.#update({selectedEntities:[],selectedEntity:null,controlGroupFeedback:null,interacting:false,interactionEpoch:this.state.interactionEpoch+1});}
      // Automatic frames update the clock, not the acknowledgement of the last
      // user action. In particular, a busy-order refusal must remain readable.
      this.#update({frame:result,selection:null,notice:'ready',...(action.type==='world-step'?{}:{worldNotice:action.type==='world-restore'?'worldLoaded':this.state.running?'worldRunning':'worldPaused'}),replayHash:null});return null;
    };
    try{const result=await run(active.signal,request);return live()?result:null;}
    catch(error){if(live()){if(transportFailed)this.#failure(error,generation);else{const code=error instanceof Error?error.message:'unavailable';this.#update({running:false,worldNotice:['quota','storage','empty'].includes(code)?'world'+code[0]!.toUpperCase()+code.slice(1):'worldRejected',error:code});}}return null;}
    finally{if(live()){this.#active=null;this.#update({busy:false,verifyingReplay:false});const camera=this.state.frame?.camera;if(camera&&this.#desired&&Object.entries(camera).some(([k,v])=>this.#desired![k as keyof Camera]!==v))void this.#render();}}
  }
  async step(ticks=1):Promise<void>{await this.#worldOperation(async(_signal,request)=>request({type:'world-step',ticks}));}
  async order(x?:number,y?:number):Promise<void>{
    if(!this.canOrder()){this.#update({worldNotice:this.state.busy?'worldControlsBusy':'worldCannotOrder'});return;}
    const playerId=this.state.playerId!,entityIds=this.state.selectedEntities.slice(),expectedRevision=this.state.frame!.world!.revision;
    await this.#worldOperation(async(signal,request)=>{await request(x===undefined?{type:'world-orders',order:'stop',playerId,entityIds,expectedRevision}:{type:'world-orders',order:'move',playerId,entityIds,expectedRevision,x,y:y!});if(!signal.aborted&&this.state.error===null)this.#update({worldNotice:'worldOrdersQueued'});return null;});
  }
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
