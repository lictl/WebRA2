// SPDX-License-Identifier: GPL-3.0-or-later
// Original lightweight harness boundary tests; no engine performance measurement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { buildPerformance, repositoryRoot } from './build.mjs';
import { servePerformance } from './serve.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');

test('worker validates messages before bounded entrypoints, including null and oversized requests', async () => {
  const code = (await readFile(new URL('./worker.mjs', import.meta.url), 'utf8')).replace(/^import .*;$/m, '');
  const calls = [], replies = [], scope = { postMessage: value => replies.push(value) };
  const world = (...args) => { calls.push(['world', ...args.slice(0,2)]); return {}; };
  const render = (...args) => { calls.push(['render', args[0]]); return {}; };
  Function('runWorld', 'runRender', 'renderFixture', 'digest', 'self', 'performance', code)(world, render, () => ({}), hash, scope, { now: () => 1 });
  const invalid = [null, {}, [], {id:1,type:'world',profile:'invalid',count:1e9}, {id:1,type:'world',profile:'ra2',count:1e9},
    {id:1,type:'render',size:1e9}, {id:1,type:'frame'}, {id:1,type:'__proto__'},
    {id:1,type:'echo',payload:new Uint8Array(2),transfer:false},
    {id:1,type:'echo',payload:new Uint8Array(new ArrayBuffer(2*1024*1024),0,1024*1024),transfer:true},
    {id:1,type:'echo',payload:new Uint8Array(new SharedArrayBuffer(1024*1024)),transfer:true},
    {id:1,type:'world',profile:'ra2',count:64,extra:new Uint8Array(1)}];
  for (const value of invalid) { scope.onmessage({data:value}); assert.match(replies.at(-1).error,/Error/); }
  assert.deepEqual(calls, []);
  scope.onmessage({data:{id:1,type:'world',profile:'ra2',count:64}}); assert.deepEqual(calls,[['world','ra2',64]]);
  scope.onmessage({data:{id:1,type:'render',size:32}}); assert.match(replies.at(-1).error,/Invalid request/);
  scope.onmessage({data:{id:2,type:'render',size:32}}); assert.deepEqual(calls.at(-1),['render',32]);
});

test('main worker failure, timeout, cancellation and pagehide terminate outstanding jobs', async () => {
  const code = await readFile(new URL('./main.mjs', import.meta.url), 'utf8');
  for (const kind of ['error','messageerror','timeout','cancel','pagehide']) {
    const nodes = new Map(), events = new Map(), timers = new Map(); let worker, timerId = 0;
    const node = () => ({textContent:'',disabled:false,addEventListener(type,fn){this[type]=fn;}});
    const document = {visibilityState:'visible',querySelector(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}};
    class FakeWorker { constructor(){worker=this;this.terminated=false;} postMessage(){} terminate(){this.terminated=true;} }
    const window = {};
    Function('Worker','document','navigator','location','performance','addEventListener','window','setTimeout','clearTimeout',code)(
      FakeWorker,document,{userAgent:'original',hardwareConcurrency:1}, {hash:'#1'}, {now:()=>0,timeOrigin:0},(name,fn)=>events.set(name,fn),window,
      fn=>{const id=++timerId;timers.set(id,fn);return id;},id=>timers.delete(id));
    const running = nodes.get('#run').click({target:nodes.get('#run')});
    await Promise.resolve(); await Promise.resolve();
    if(kind==='error')worker.onerror({message:'original worker failure'});
    else if(kind==='messageerror')worker.onmessageerror();
    else if(kind==='timeout')[...timers.values()][0]();
    else if(kind==='cancel')nodes.get('#cancel').click();
    else events.get('pagehide')();
    await running; assert.equal(worker.terminated,true,kind); assert.equal(timers.size,0,kind); assert.ok(window.perf222.error,kind);
  }
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
  const names=['main.js','worker.js','index.html','LICENSE.txt','NOTICES.txt','LICENSES/GPL-3.0-or-later.txt'];
  const files=[];
  for(const name of names){const data=Buffer.from('Original fixture '+name);await writeFile(resolve(base,'dist',name),data);files.push({name,bytes:data.length,sha256:hash(data)});}
  const manifest={schema:1,files};await writeFile(resolve(base,'manifest.json'),JSON.stringify(manifest));return{root,base,manifest};
}
test('server admits exact code identities and denies asset/query/upload/foreign-host/origin routes', async () => {
  const f=await fixture();let handle;
  try {
    const n=await port();handle=await servePerformance('local/build',n,f.root);const url=`http://127.0.0.1:${n}`;
    for(const path of ['/','/worker.js','/manifest.json','/LICENSES/GPL-3.0-or-later.txt']){const r=await fetch(url+path);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);}
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
      await assert.rejects(servePerformance('local/build',await port(),f.root));
      await assert.rejects(servePerformance('../outside',await port(),f.root));
    }finally{await rm(f.root,{recursive:true,force:true});}
  }
});
test('builder refuses existing destinations and symlink entrypoints before emitting a code build', async () => {
  const f=await fixture();try{
    await assert.rejects(buildPerformance('local/build',f.root));
    await assert.rejects(buildPerformance('dist',f.root));
    await mkdir(resolve(f.root,'tools/performance'),{recursive:true});
    await writeFile(resolve(f.root,'tools/performance/main.mjs'),'console.log("original");');
    await writeFile(resolve(f.root,'tools/performance/actual.mjs'),'console.log("original");');
    await symlink('actual.mjs',resolve(f.root,'tools/performance/worker.mjs'));
    await assert.rejects(buildPerformance('local/new-build',f.root),/Symlink code input refused/);
  }finally{await rm(f.root,{recursive:true,force:true});}
});
