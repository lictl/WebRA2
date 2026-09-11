// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original benchmark instrumentation.
const worker=new Worker('/worker.js',{type:'module'});let cursor=0,terminated=false;const pending=new Map();
const status=document.querySelector('#status'),output=document.querySelector('#output');
const replicate=Number(location.hash.slice(1))||1;
const results={schema:2,engineBaseline:'7deefd203e9cceb8802d44af867ed3e0a38f4991',replicate,browser:navigator.userAgent,
  hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null,timeOrigin:performance.timeOrigin,
  crossOriginIsolated:globalThis.crossOriginIsolated,worlds:[],renders:[],transport:[],visibility:[]};
function terminate(message){terminated=true;worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(message));}pending.clear();}
function request(type,data={},transfer=[]){
  if(terminated||pending.size)return Promise.reject(Error('Worker unavailable or busy'));
  const id=++cursor;return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>terminate('Benchmark operation timed out after60seconds'),60000);
    pending.set(id,{resolve,reject,timer});
    try{worker.postMessage({id,type,...data},transfer);}catch(error){terminate(String(error));}
  });
}
worker.onmessage=e=>{
  const r=e.data;if(!r||typeof r!=='object')return terminate('Invalid worker message');
  if(typeof r.progress==='string'&&r.progress.length<=128&&pending.size){status.textContent=r.progress;return;}
  const job=pending.get(r.id);if(!job)return terminate('Obsolete worker message');
  clearTimeout(job.timer);pending.delete(r.id);r.error?job.reject(Error(String(r.error).slice(0,1024))):job.resolve(r);
};
worker.onerror=e=>{status.textContent='worker failure: '+e.message;terminate(e.message);};
worker.onmessageerror=()=>terminate('Worker message deserialization failed');
addEventListener('pagehide',()=>terminate('Page left'));
addEventListener('visibilitychange',()=>results.visibility.push({at:performance.now(),state:document.visibilityState}));
function stats(name,times,other={}){const a=[...times].sort((a,b)=>a-b);return{name,samples:a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.ceil(a.length*.95)-1],minMs:a[0],maxMs:a.at(-1),timingsMs:times,...other};}
async function transport(){
  for(const bytes of [0,1024*1024,4*1024*1024])for(const transfer of [false,true]){
    let payload=new Uint8Array(bytes);for(let n=0;n<bytes;n++)payload[n]=n*73%256;const times=[];
    const expected=await crypto.subtle.digest('SHA-256',payload);let checked=0;
    for(let i=0;i<120;i++){const start=performance.now();const r=await request('echo',{payload,transfer},transfer?[payload.buffer]:[]);const elapsed=performance.now()-start;payload=r.payload;if(i>=20){times.push(elapsed);const actual=await crypto.subtle.digest('SHA-256',payload);if(new Uint8Array(actual).some((v,n)=>v!==new Uint8Array(expected)[n]))throw Error('echo payload mismatch');checked++;}}
    results.transport.push(stats(`echo/${bytes}/${transfer?'transfer':'clone'}`,times,{warmup:20,bytesPerLeg:bytes,transfer,identicalCheckedResults:checked}));
  }
  await request('frame-init');const times=[],render=[],present=[];let hash;
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
  let checked=0;
  for(let i=0;i<36;i++){
    const start=performance.now(),r=await request('frame'),end=performance.now();
    if(!(r.rgba instanceof Uint8Array)||r.rgba.byteLength!==960*640*4||!Number.isFinite(r.renderMs))throw Error('Invalid frame');
    const before=performance.now();ctx.putImageData(new ImageData(new Uint8ClampedArray(r.rgba.buffer),960,640),0,0);const after=performance.now();
    if(i>=5){times.push(end-start);render.push(r.renderMs);present.push(after-before);}
    if(i>=5){const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.rgba)),b=>b.toString(16).padStart(2,'0')).join('');if(hash&&hash!==actual)throw Error('frame mismatch');hash=actual;checked++;}
  }
  results.transport.push(stats('frame/worker-render-plus-transfer',times,{warmup:5,bytes:960*640*4,rgbaHash:hash,identicalCheckedResults:checked}));
  results.transport.push(stats('frame/worker-render-local',render,{warmup:5}));
  results.transport.push(stats('frame/main-canvas-putImageData',present,{warmup:5,excludes:'GPU completion/compositing/scanout'}));
}
document.querySelector('#run').addEventListener('click',async e=>{
  e.target.disabled=true;results.startedAt=new Date().toISOString();results.visibility.push({at:performance.now(),state:document.visibilityState});
  try{
    results.browserDetails=await navigator.userAgentData?.getHighEntropyValues(['fullVersionList','architecture','bitness','platformVersion'])??null;
    const cases=[['ra2',64],['ra2',256],['ra2',1024],['yr',64],['yr',256],['yr',1024]];
    const ordered=replicate===2?[...cases].reverse():replicate===3?[...cases.slice(3),...cases.slice(0,3)]:cases;
    results.caseOrder=ordered;
    for(const [profile,count] of ordered){status.textContent=`Preparing ${profile} / ${count}`;results.worlds.push((await request('world',{profile,count})).result);}
    for(const size of replicate===2?[64,32]:[32,64])results.renders.push((await request('render',{size})).result);
    status.textContent='Transport and CPU canvas upload';await transport();results.completedAt=new Date().toISOString();status.textContent='Complete — original Chrome baseline';
  }catch(error){results.error=String(error);status.textContent=results.error;terminate(results.error);}
  output.textContent=JSON.stringify(results,null,2);
});
Object.assign(window,{perf222:results});
document.querySelector('#cancel').addEventListener('click',()=>{if(!results.completedAt)terminate('Cancelled by user');});
document.querySelector('#memory').addEventListener('click',async e=>{
  if(!results.completedAt)return; e.target.disabled=true;
  results.memory={kind:'post-timing-page-and-workers-estimate',available:typeof performance.measureUserAgentSpecificMemory==='function'};
  if(results.memory.available)try{results.memory.value=await performance.measureUserAgentSpecificMemory();}catch(error){results.memory.error=String(error);}
  output.textContent=JSON.stringify(results,null,2);
});
