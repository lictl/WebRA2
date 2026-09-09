// SPDX-License-Identifier: MIT
import test from 'node:test';import assert from 'node:assert/strict';
import { pauseMedia,resumeMedia,seekMedia,closeMedia,type AudioResource } from '../../packages/media/src/actions.ts';
function deferred(){let resolve!:()=>void,reject!:(e:Error)=>void;const promise=new Promise<void>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
class Audio implements AudioResource{state='running';suspendTask=deferred();resumeTask=deferred();closeTask=deferred();suspendCalls=0;resumeCalls=0;closeCalls=0;suspend(){this.suspendCalls++;return this.suspendTask.promise;}resume(){this.resumeCalls++;return this.resumeTask.promise;}close(){this.closeCalls++;return this.closeTask.promise;}}
test('old suspend/resume success or rejection cannot alter a newly started session',async()=>{
 for(const action of [pauseMedia,resumeMedia]) for(const reject of [false,true]){
  let generation=1,state='old';const audio=new Audio(),scope={audio,current:()=>generation===1};
  const task=action(scope,()=>{state='old-finished';},()=>{state='old-failed';});generation=2;state='new-playing';
  const wait=action===pauseMedia?audio.suspendTask:audio.resumeTask;if(reject)wait.reject(new Error('old failure'));else wait.resolve();await task;assert.equal(state,'new-playing');
 }
});
test('seek checks cancellation after each async boundary and ignores old worker rejection',async()=>{
 for(const boundary of ['idle','resume','worker']){
  let generation=1,state='seeking',reset=0,seekCalls=0;const audio=new Audio(),idle=deferred(),worker=deferred(),scope={audio,current:()=>generation===1};
  const task=seekMedia(scope,()=>idle.promise,()=>{reset++;},()=>{seekCalls++;return worker.promise;},()=>{state='old-ready';},()=>{state='old-failed';});
  if(boundary!=='idle'){idle.resolve();await Promise.resolve();await Promise.resolve();}
  if(boundary==='worker'){audio.resumeTask.resolve();await Promise.resolve();await Promise.resolve();}
  generation=2;state='new-playing';
  if(boundary==='idle')idle.resolve();else if(boundary==='resume')audio.resumeTask.reject(new Error('suspended old audio'));else worker.reject(new Error('terminated old worker'));
  await task;assert.equal(state,'new-playing');assert.equal(reset,boundary==='idle'?0:1);assert.equal(seekCalls,boundary==='worker'?1:0);
 }
});
test('delayed old close releases only its captured audio and does not overwrite new controls',async()=>{
 let generation=1,state='cancelled';const old=new Audio(),newAudio=new Audio();
 const task=closeMedia({audio:old,current:()=>generation===1},()=>{state='old-closed';},()=>{state='old-close-failed';});generation=2;state='new-playing';old.closeTask.resolve();await task;assert.equal(old.closeCalls,1);assert.equal(newAudio.closeCalls,0);assert.equal(state,'new-playing');
});
test('current generation suspension failure is surfaced and a normal resume completes once',async()=>{
 const a=new Audio();let failures=0,done=0;const scope={audio:a,current:()=>true};const p=pauseMedia(scope,()=>done++,()=>failures++);a.suspendTask.reject(new Error('device'));await p;assert.equal(failures,1);const r=resumeMedia(scope,()=>done++,()=>failures++);a.resumeTask.resolve();await r;assert.equal(done,1);assert.equal(failures,1);
});
