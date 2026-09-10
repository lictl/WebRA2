// SPDX-License-Identifier: GPL-3.0-or-later
// Original lightweight harness boundary tests; no engine performance measurement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { buildGpuPerformance, repositoryRoot } from './build.mjs';
import { serveGpuPerformance } from './serve.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');

import { originalWorld } from './world-fixture.mjs';
import { WorldReplayRecorder,replayWorld } from '../../packages/sim/src/world-replay.ts';
import { worldHash } from '../../packages/sim/src/world-model.ts';
import { canonicalText,parseJson } from '../../packages/sim/src/canonical.ts';
import { GpuTiming } from './gpu-timing.mjs';
function fakeSnapshot(){return {nextTick:0,modelHash:'a'.repeat(64),stateHash:'b'.repeat(64),queued:0,actors:Array.from({length:64},(_,i)=>({id:i+1,x:2,y:2,progress:0,moving:false}))};}
test('genuine original worker admits commands, advances, saves and independently replays both profiles',async()=>{
 const code=(await readFile(new URL('./simulation-worker.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
 for(const profile of ['ra2','yr']){
  const replies=[],self={postMessage:r=>replies.push(r)};
  Function('originalWorld','WorldReplayRecorder','replayWorld','worldHash','canonicalText','parseJson','self','performance',code)(originalWorld,WorldReplayRecorder,replayWorld,worldHash,canonicalText,parseJson,self,performance);
  self.onmessage({data:{id:1,type:'init',profile,count:64}});assert.equal(replies.at(-1).type,'init');
  let id=1;for(let tick=0;tick<20;tick+=4){self.onmessage({data:{id:++id,type:'advance',expectedTick:tick,ticks:4,order:tick===0?'right':tick===12?'stop':null}});assert.equal(replies.at(-1).type,'advance');assert.equal(replies.at(-1).snapshot.nextTick,tick+4);}
  self.onmessage({data:{id:++id,type:'export'}});const exported=replies.at(-1);assert.equal(exported.type,'export');
  self.onmessage({data:{id:++id,type:'verify',text:exported.text}});assert.equal(replies.at(-1).stateHash,exported.snapshot.stateHash);
  self.onmessage({data:{id:++id,type:'advance',expectedTick:0,ticks:4,order:'right'}});assert.match(replies.at(-1).error,/Stale tick/);
  self.onmessage({data:{id:++id,type:'export'}});assert.match(replies.at(-1).error,/closed/);
 }
});
test('null, accessor, unknown, oversized and incomplete requests fail before fixture work',async()=>{
 const code=(await readFile(new URL('./simulation-worker.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
 for(const input of [null,[],{}, {id:1,type:'__proto__'}, {id:1,type:'init',profile:'bad',count:1e9}, {id:1,type:'init',profile:'ra2',count:64,extra:1}, {id:1,get type(){throw Error('getter executed');},profile:'ra2',count:64}]){
  let calls=0;const replies=[],self={postMessage:r=>replies.push(r)};
  const fixture=(...args)=>{originalWorld(...args);calls++;throw Error('Unexpected fixture');};
  Function('originalWorld','WorldReplayRecorder','replayWorld','worldHash','canonicalText','parseJson','self','performance',code)(fixture,null,null,null,null,null,self,performance);
  self.onmessage({data:input});assert.equal(replies.at(-1).type,'error');assert.equal(calls,0);assert.doesNotMatch(replies.at(-1).error,/getter executed/);
 }
});
test('worker client bounds metadata and clears timers on failure, timeout, cancellation and stale replies',async()=>{
 const code=(await readFile(new URL('./worker-client.mjs',import.meta.url),'utf8')).replaceAll('export ','');
 for(const kind of ['valid','error','messageerror','timeout','cancel','obsolete','sparse','extra','oversized','post']){
  let worker,next=0;const timers=new Map();class FakeWorker{constructor(){worker=this;}postMessage(){if(kind==='post')throw Error('post');}terminate(){this.terminated=true;}}
  const {SimulationClient,validSnapshot}=Function('Worker','setTimeout','clearTimeout',code+';return {SimulationClient,validSnapshot};')(FakeWorker,f=>{timers.set(++next,f);return next;},id=>timers.delete(id));
  const client=new SimulationClient(),pending=client.request('init',{profile:'ra2',count:64});const settled=pending.then(()=>true,()=>false);
  if(kind==='error')worker.onerror();else if(kind==='messageerror')worker.onmessageerror();else if(kind==='timeout')[...timers.values()][0]();else if(kind==='cancel')client.dispose();else if(kind!=='post'){
   const snapshot=fakeSnapshot();if(kind==='sparse'){delete snapshot.actors[0];snapshot.actors.payload={};}if(kind==='extra')snapshot.actors.payload={};if(kind==='oversized')snapshot.actors.length=4294967295;
   worker.onmessage({data:{id:kind==='obsolete'?2:1,type:'init',snapshot,movers:8}});
  }
  assert.equal(await settled,kind==='valid');assert.equal(timers.size,0);assert.equal(validSnapshot(fakeSnapshot()),true);
  if(kind!=='valid'){assert.equal(worker.terminated,true);assert.equal(await client.request('export').then(()=>true,()=>false),false);}client.dispose();
 }
});
test('GPU timing never blocks and bounds outstanding fences, query disjoint and disposal',()=>{
 const queries=new Set(),syncs=new Set(),completed=[];let ready=false,disjoint=false;
 const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2},gl={SYNC_GPU_COMMANDS_COMPLETE:3,WAIT_FAILED:4,ALREADY_SIGNALED:5,CONDITION_SATISFIED:6,QUERY_RESULT_AVAILABLE:7,QUERY_RESULT:8,
  getExtension:()=>ext,createQuery(){const q={};queries.add(q);return q;},beginQuery(){},endQuery(){},deleteQuery:q=>queries.delete(q),fenceSync(){const s={};syncs.add(s);return s;},deleteSync:s=>syncs.delete(s),flush(){},getParameter:()=>disjoint,
  clientWaitSync(s,flags,timeout){assert.equal(flags,0);assert.equal(timeout,0);return ready?5:9;},getQueryParameter(q,p){return p===7?ready:2e6;}};
 const timing=new GpuTiming(gl,r=>completed.push(r));for(let i=0;i<8;i++){assert.equal(timing.begin(i,0,{}),true);timing.end();}assert.equal(timing.begin(9,0,{}),false);assert.equal(timing.peak,8);
 timing.poll(1);assert.equal(completed.length,0);ready=true;timing.poll(2);assert.equal(completed.length,8);assert.equal(completed[0].gpuMs,2);assert.equal(queries.size+syncs.size,0);
 timing.begin(10,3,{});timing.end();disjoint=true;timing.poll(4);assert.equal(completed.at(-1).gpuMs,null);assert.equal(timing.disjoint,1);
 timing.begin(11,5,{});timing.end();timing.dispose();timing.dispose();assert.equal(queries.size+syncs.size,0);assert.throws(()=>timing.begin(12,5,{}));
});
async function port() {
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const n=server.address().port;
  await new Promise(resolve=>server.close(resolve));return n;
}
function foreignHostStatus(url) {
  return new Promise((resolve, reject) => {
    const req=httpRequest(url,{headers:{Host:'evil.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);req.end();
  });
}
async function fixture() {
  await mkdir(resolve(repositoryRoot,'local'),{recursive:true});
  const root=await mkdtemp(resolve(repositoryRoot,'local/performance-test-')),base=resolve(root,'local/build');
  await mkdir(resolve(base,'dist/LICENSES'),{recursive:true});
  const names=['style.css','main.js','worker.js','index.html','LICENSE.txt','NOTICES.txt','LICENSES/GPL-3.0-or-later.txt'];
  const files=[];
  for(const name of names){const data=Buffer.from('Original fixture '+name);await writeFile(resolve(base,'dist',name),data);files.push({name,bytes:data.length,sha256:hash(data)});}
  const manifest={schema:1,mode:'full',files};await writeFile(resolve(base,'manifest.json'),JSON.stringify(manifest));return{root,base,manifest};
}
test('server admits exact code identities and denies asset/query/upload/foreign-host/origin routes', async () => {
  const f=await fixture();let handle;
  try {
    const n=await port();handle=await serveGpuPerformance('local/build',n,false,f.root);const url=`http://127.0.0.1:${n}`;
    for(const path of ['/','/worker.js','/manifest.json','/LICENSES/GPL-3.0-or-later.txt']){const r=await fetch(url+path);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);assert.equal(r.headers.get('cross-origin-opener-policy'),null);}
    for(const path of ['/game/rules.ini','/worker.js?query=1','/%77orker.js','/../game/asset','/dist/worker.js'])assert.equal((await fetch(url+path)).status,404);
    assert.equal((await fetch(url+'/',{method:'POST',body:'original'})).status,405);
    assert.equal(await foreignHostStatus(url+'/'),403);
    assert.equal((await fetch(url+'/',{headers:{Origin:'https://evil.example'}})).status,403);
    await writeFile(resolve(f.base,'dist/worker.js'),'changed after start');assert.equal(await (await fetch(url+'/worker.js')).text(),'Original fixture worker.js');
  } finally {if(handle)await new Promise(resolve=>handle.server.close(resolve));await rm(f.root,{recursive:true,force:true});}
});
test('manifest mismatch, missing code, symlinks and out-of-local serve directories fail before listening', async () => {
  for(const change of ['hash','missing','symlink','path']) {
    const f=await fixture();try{
      if(change==='hash')f.manifest.files[0].sha256='0'.repeat(64);
      else if(change==='missing')f.manifest.files=f.manifest.files.filter(f=>f.name!=='worker.js');
      else if(change==='path')f.manifest.files[0].name='../../game/asset';
      else{await rm(resolve(f.base,'dist/main.js'));await symlink('worker.js',resolve(f.base,'dist/main.js'));}
      await writeFile(resolve(f.base,'manifest.json'),JSON.stringify(f.manifest));
      await assert.rejects(serveGpuPerformance('local/build',await port(),false,f.root));
      await assert.rejects(serveGpuPerformance('../outside',await port(),false,f.root));
    }finally{await rm(f.root,{recursive:true,force:true});}
  }
});
test('builder refuses existing destinations and symlink entrypoints before emitting a code build', async () => {
  const f=await fixture();try{
    await assert.rejects(buildGpuPerformance('local/build','full',f.root));
    await assert.rejects(buildGpuPerformance('dist','full',f.root));
    await mkdir(resolve(f.root,'tools/gpu-performance'),{recursive:true});
    await writeFile(resolve(f.root,'tools/gpu-performance/main.mjs'),'console.log("original");');
    await writeFile(resolve(f.root,'tools/gpu-performance/actual.mjs'),'console.log("original");');
    await symlink('actual.mjs',resolve(f.root,'tools/gpu-performance/simulation-worker.mjs'));
    await assert.rejects(buildGpuPerformance('local/new-build','full',f.root),/Symlink code input refused/);
  }finally{await rm(f.root,{recursive:true,force:true});}
});

test('hidden, pagehide and cancellation terminate pending initialization without stale UI writes',async()=>{
 const code=(await readFile(new URL('./main.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
 for(const trigger of ['visibilitychange','pagehide','cancel']){
  const nodes=new Map(),events=new Map();const document={visibilityState:'visible',querySelector(id){if(!nodes.has(id))nodes.set(id,{value:({'#profile':'ra2','#actors':'64','#viewport':'960','#mode':'coupled','#map-size':'64'})[id],textContent:'',disabled:false,addEventListener(){},getContext(){return {NO_ERROR:0,getError(){return 0;},getParameter(){return 'original';},getContextAttributes(){return {};}};}});return nodes.get(id);}};
  let client;class Renderer{load(){}draw(){return {drawCalls:1,uploadedBytes:0};}dispose(){this.disposed=true;}stats(){return {state:this.disposed?'disposed':'ready',requestedGpuBytes:0,ownedCpuBytes:0};}}
  class Client{constructor(){client=this;this.closed=false;this.busy=false;}request(){this.busy=true;return new Promise((resolve,reject)=>{this.reject=reject;});}dispose(){this.closed=true;this.busy=false;this.reject?.(Error('cancelled'));}}
  class Timing{constructor(gl,complete){this.complete=complete;this.pending=[];}begin(){}end(){}poll(){this.complete({metadata:{cold:true},observedAt:performance.now(),gpuMs:null});}dispose(){}}
  Function('GpuRenderer','compileGpuScene','prepareGpuFrame','pickGpuFrame','createTerrainScene','gpuOracleCases','renderFixture','digest','GpuTiming','SimulationClient','document','navigator','devicePixelRatio','requestAnimationFrame','cancelAnimationFrame','addEventListener',code)(Renderer,()=>({allocations:{}}),()=>({}),null,null,null,()=>({scene:{},batch:{}}),null,Timing,Client,document,{userAgent:'original'},1,()=>1,()=>{},(type,fn)=>events.set(type,fn));
  const run=nodes.get('#run').onclick();await new Promise(resolve=>setTimeout(resolve,15));assert.ok(client);assert.equal(client.busy,true);
  if(trigger==='cancel')nodes.get('#cancel').onclick();else{if(trigger==='visibilitychange')document.visibilityState='hidden';events.get(trigger)();}
  const status=nodes.get('#status').textContent;await run;assert.equal(nodes.get('#status').textContent,status);assert.equal(client.closed,true);assert.equal(client.busy,false);assert.equal(nodes.get('#run').disabled,false);
  const report=JSON.parse(nodes.get('#output').textContent);assert.equal(report.kind,'terminated');assert.equal(report.stats.state,'disposed');assert.equal(report.pendingWorker,false);
 }
});
