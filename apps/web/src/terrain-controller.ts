// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. DOM-independent viewport job state.
import { TerrainBridge,type TerrainPort } from './terrain-bridge.ts';
import { centered,VIEW_LIMIT,validCamera,type Camera,type FrameResult,type TerrainProfile,type TerrainProgress,type ViewportPick,type Zoom } from './terrain-protocol.ts';
import type { Locale } from './i18n.ts';
export type TerrainState={locale:Locale;profile:TerrainProfile;phase:'empty'|'selected'|'loading'|'ready'|'cancelled'|'failed';files:number;bytes:number;busy:boolean;progress:TerrainProgress|null;frame:FrameResult|null;selection:ViewportPick;notice:string;error:string|null};
export function canPick(state:TerrainState,x:number,y:number):boolean {const f=state.frame;return !!f && !state.busy && state.phase==='ready' && Number.isInteger(x) && Number.isInteger(y) && x>=0 && y>=0 && x<f.camera.width && y<f.camera.height;}
export class TerrainController{
  #files:File[]=[];#port:TerrainPort|null=null;#active:AbortController|null=null;#generation=0;#desired:Camera|null=null;#listeners=new Set<(s:TerrainState)=>void>();#width=960;#height=640;
  state:TerrainState;
  constructor(locale:Locale='en',private factory:()=>TerrainPort=()=>new TerrainBridge()){this.state={locale,profile:'ra2',phase:'empty',files:0,bytes:0,busy:false,progress:null,frame:null,selection:null,notice:'choose',error:null};}
  subscribe(fn:(s:TerrainState)=>void):()=>void{this.#listeners.add(fn);fn(this.state);return()=>this.#listeners.delete(fn);}
  #update(p:Partial<TerrainState>):void{this.state={...this.state,...p};for(const fn of this.#listeners)fn(this.state);}
  #stop():void{this.#generation++;this.#active?.abort();this.#active=null;this.#port?.dispose();this.#port=null;this.#desired=null;}
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
      this.#active=null;this.#desired={...result.camera};this.#update({phase:'ready',busy:false,progress:null,frame:result,notice:'ready'});
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
    }catch(e){this.#failure(e,generation);}
  }
  dispose():void{this.#stop();this.#files=[];this.state={...this.state,frame:null,selection:null};this.#listeners.clear();}
}
