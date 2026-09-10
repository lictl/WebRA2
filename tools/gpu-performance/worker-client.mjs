// SPDX-License-Identifier: GPL-3.0-or-later
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const number=(v,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
function keys(v,names){return v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k)&&'value'in Object.getOwnPropertyDescriptor(v,k));}
function dense(value){return Array.isArray(value)&&Reflect.ownKeys(value).length===value.length+1&&Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).every(d=>d&&'value'in d);}
export function validSnapshot(v){return keys(v,['nextTick','modelHash','stateHash','queued','actors'])&&Number.isInteger(v.nextTick)&&number(v.nextTick,1800)&&sha(v.modelHash)&&sha(v.stateHash)&&Number.isInteger(v.queued)&&number(v.queued,256)&&dense(v.actors)&&v.actors.length<=1024&&v.actors.length>=64&&Reflect.ownKeys(v.actors).length===v.actors.length+1&&v.actors.every((a,i)=>keys(a,['id','x','y','progress','moving'])&&a.id===i+1&&Number.isInteger(a.x)&&number(a.x,511)&&Number.isInteger(a.y)&&number(a.y,511)&&Number.isInteger(a.progress)&&number(a.progress)&&typeof a.moving==='boolean');}
function validReply(r,type){
 if(type==='init')return keys(r,['id','type','snapshot','movers'])&&validSnapshot(r.snapshot)&&[8,32,64].includes(r.movers);
 if(type==='advance')return keys(r,['id','type','snapshot','admitted','work','timings'])&&validSnapshot(r.snapshot)&&Number.isInteger(r.admitted)&&number(r.admitted,64)&&keys(r.work,['entityVisits','navigationExpansions','transitions'])&&Object.values(r.work).every(v=>number(v))&&keys(r.timings,['admitMs','stepMs','snapshotMs','totalMs'])&&Object.values(r.timings).every(v=>number(v,180000));
 if(type==='export')return keys(r,['id','type','snapshot','text'])&&validSnapshot(r.snapshot)&&typeof r.text==='string'&&r.text.length<=2*1024*1024;
 return keys(r,['id','type','stateHash','nextTick','work'])&&sha(r.stateHash)&&Number.isInteger(r.nextTick)&&number(r.nextTick,1800)&&number(r.work,16777216);
}
export class SimulationClient{
 constructor(){this.worker=new Worker('/worker.js',{type:'module'});this.cursor=0;this.pending=null;this.closed=false;
  this.worker.onerror=()=>this.dispose('Worker failure');this.worker.onmessageerror=()=>this.dispose('Worker message failure');
  this.worker.onmessage=e=>{const r=e.data,p=this.pending;if(!p||!r||r.id!==p.id)return this.dispose('Obsolete worker reply');
   if(r.type!==p.type||!validReply(r,p.type))return this.dispose(r.type==='error'&&typeof r.error==='string'?r.error.slice(0,512):'Invalid worker reply');
   clearTimeout(p.timer);this.pending=null;p.resolve(r);
  };
 }
 get busy(){return this.pending!==null;}
 request(type,data={}){if(this.closed||this.pending)return Promise.reject(Error('Worker unavailable or busy'));if(!['init','advance','export','verify'].includes(type))return Promise.reject(Error('Invalid operation'));
  const id=++this.cursor;if(id>10000)return Promise.reject(Error('Request count cap'));
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.dispose('Worker timeout'),type==='verify'?180000:30000);this.pending={id,type,timer,resolve,reject};try{this.worker.postMessage({id,type,...data});}catch{this.dispose('Worker posting failed');}});
 }
 dispose(reason='Disposed'){if(this.closed)return;this.closed=true;this.worker.terminate();if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(Error(reason));this.pending=null;}}
}
