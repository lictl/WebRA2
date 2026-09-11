// SPDX-License-Identifier: GPL-3.0-or-later
// One explicit request at a time. Main owns wall-clock scheduling; engine owns state.
import {originalWorld} from './world-fixture.mjs';
import {WorldReplayRecorder,replayWorld} from '../../packages/sim/src/world-replay.ts';
import {worldHash} from '../../packages/sim/src/world-model.ts';
import {canonicalText,parseJson} from '../../packages/sim/src/canonical.ts';
let world=null,recorder=null,lastId=0,sequence=0,closed=false;
function record(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw Error('Invalid request');const out={};const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))throw Error('Invalid request fields');for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!('value'in d))throw Error('Request accessor');out[k]=d.value;}return out;}
function integer(n,min,max){if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Request integer');return n;}
function snapshot(){const save=recorder.save();return {nextTick:save.nextTick,modelHash:world.model.sha256,stateHash:worldHash(save),queued:save.queuedCommands.length,actors:save.state.entities.map(e=>({id:e.id,x:e.x,y:e.y,progress:e.progress,moving:e.goal!==null}))};}
self.onmessage=e=>{let id=0;try{
 const v=e.data;if(!v||Object.getPrototypeOf(v)!==Object.prototype)throw Error('Invalid request');
 const type=Object.getOwnPropertyDescriptor(v,'type')?.value,allowed={init:['id','type','profile','count'],advance:['id','type','expectedTick','ticks','order'],export:['id','type'],verify:['id','type','text']};
 if(typeof type!=='string'||!Object.hasOwn(allowed,type))throw Error('Invalid operation');const r=record(v,allowed[type]);id=integer(r.id,lastId+1,10000);if(closed)throw Error('Worker closed');lastId=id;
 if(type==='init'){if(world)throw Error('Already initialized');world=originalWorld(r.profile,r.count);recorder=new WorldReplayRecorder(world.model);self.postMessage({id,type,snapshot:snapshot(),movers:world.movers.length});return;}
 if(!world)throw Error('Not initialized');
 if(type==='advance'){
  integer(r.expectedTick,0,2000);if(r.expectedTick!==recorder.nextTick)throw Error('Stale tick');integer(r.ticks,1,4);
  if(![null,'left','right','stop'].includes(r.order))throw Error('Invalid order');if(recorder.nextTick+r.ticks>1800)throw Error('Diagnostic tick cap');
  let admitted=0;const start=performance.now();
  if(r.order){const commands=world.movers.map((m,i)=>({schemaVersion:1,tick:recorder.nextTick,playerId:0,sequence:sequence+i,kind:r.order==='stop'?'stop':'move',payload:r.order==='stop'?{entityId:m.id}:{entityId:m.id,x:r.order==='right'?126:2,y:m.y}}));recorder.admitCommands(commands);sequence+=commands.length;admitted=commands.length;}
  const admittedAt=performance.now(),step=recorder.step(r.ticks),steppedAt=performance.now(),snap=snapshot(),done=performance.now();
  self.postMessage({id,type,snapshot:snap,admitted,work:step.work,timings:{admitMs:admittedAt-start,stepMs:steppedAt-admittedAt,snapshotMs:done-steppedAt,totalMs:done-start}});return;
 }
 if(type==='export'){const text=canonicalText(recorder.document());if(text.length>2*1024*1024)throw Error('Replay cap');self.postMessage({id,type,text,snapshot:snapshot()});return;}
 if(typeof r.text!=='string'||r.text.length>2*1024*1024)throw Error('Replay size');const document=parseJson(r.text);integer(document?.finalNextTick,0,1800);const result=replayWorld(world.model,document);self.postMessage({id,type,stateHash:result.stateSha256,nextTick:result.simulation.nextTick,work:result.work});
 }catch(error){closed=true;self.postMessage({id,type:'error',error:String(error).slice(0,512)});}
};
