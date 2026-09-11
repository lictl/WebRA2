// SPDX-License-Identifier: GPL-3.0-or-later
// Original-only GPU acceptance. Rendering never decides authoritative simulation state.
import {GpuRenderer} from '../../packages/render/src/gpu-renderer.ts';
import {compileGpuScene,prepareGpuFrame,pickGpuFrame} from '../../packages/render/src/gpu-scene.ts';
import {createTerrainScene} from '../../packages/render/src/terrain-scene.ts';
import {gpuOracleCases} from '../../tests/render/gpu-fixtures.ts';
import {renderFixture,digest} from '../performance/workloads.mjs';
import {GpuTiming} from './gpu-timing.mjs';
import {SimulationClient} from './worker-client.mjs';
import {ReportStore} from './report-store.mjs';
const $=id=>document.querySelector('#'+id),canvas=document.querySelector('canvas');
const options={alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false};
const reports=new ReportStore($('download'),$('output'));
let generation=0,current=null,raf=0;
$('refresh').disabled=true;
function stats(times){const a=[...times].sort((a,b)=>a-b);return {samples:a.length,medianMs:a[Math.floor(a.length/2)]??null,p95Ms:a[Math.ceil(a.length*.95)-1]??null,p99Ms:a[Math.ceil(a.length*.99)-1]??null,maxMs:a.at(-1)??null};}
async function metadata(){return {schema:1,startedAt:new Date().toISOString(),browser:navigator.userAgent,details:await navigator.userAgentData?.getHighEntropyValues(['fullVersionList','architecture','platformVersion'])??null,isolated:globalThis.crossOriginIsolated,dpr:devicePixelRatio};}
function buttons(busy){for(const id of ['run','correctness'])$(id).disabled=busy;for(const id of ['profile','actors','viewport','mode','map-size'])$(id).disabled=busy;}
function cleanup(reason='Disposed'){
 generation++;cancelAnimationFrame(raf);const c=current;current=null;
 if(c){c.abort?.abort();c.client?.dispose(reason);c.verifier?.dispose(reason);c.timing?.dispose();c.renderer?.dispose();c.reject?.(Error(reason));}
 buttons(false);
}
function append(list,value){if(list.length>=20000)throw Error('Telemetry cap');list.push(value);}
function plainPickEqual(a,b){if(a===null||b===null)return a===b;const x={...a,kind:a.kind??'terrain'},y={...b,kind:b.kind??'terrain'};const keys=Object.keys(x);return keys.length===Object.keys(y).length&&keys.every(k=>x[k]===y[k]);}
function waitEvent(target,type,trigger,signal){return new Promise((resolve,reject)=>{let timer;const finish=error=>{clearTimeout(timer);target.removeEventListener(type,done);signal.removeEventListener('abort',abort);error?reject(error):resolve();};const done=()=>finish(),abort=()=>finish(Error('Cancelled lifecycle'));target.addEventListener(type,done);signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>finish(Error('Lifecycle timeout '+type)),10000);try{trigger();}catch(error){finish(error);}});}
function defaultPixels(gl,width,height){
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);const bottom=new Uint8Array(width*height*4),top=new Uint8Array(bottom.length);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bottom);
 for(let y=0;y<height;y++)top.set(bottom.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);return top;
}
async function correctness(){
 cleanup();const job=generation;buttons(true);reports.clear();const result={...await metadata(),kind:'pixel-depth-owner-lifecycle',cases:[]};if(job!==generation)return;
 try{
  const gl=canvas.getContext('webgl2',options);if(!gl)throw Error('WebGL2 unavailable');const abort=new AbortController();current={renderer:null,abort};
  result.gl={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),attributes:gl.getContextAttributes()};
  let lastFrame,lastHash,renderer;
  for(const textureSide of [null,16,32]){
   renderer?.dispose();renderer=new GpuRenderer(gl,textureSide===null?undefined:{textureSide});current.renderer=renderer;
   for(const c of gpuOracleCases()){
    if(job!==generation)throw Error('Obsolete correctness pass');
    const cpu=createTerrainScene(c.terrainInput),scene=compileGpuScene(cpu,c.batch??undefined);renderer.load(scene);
    for(const originalView of c.viewports){
     const view=textureSide===null?originalView:{...originalView,width:Math.min(originalView.width,textureSide),height:Math.min(originalView.height,textureSide)};
     canvas.width=view.width;canvas.height=view.height;const frame=prepareGpuFrame(scene,view);renderer.draw(frame);const presented=defaultPixels(gl,view.width,view.height),gpu=renderer.readback(),expected=c.batch?cpu.renderSprites(view,c.batch):cpu.render(view);
     if(gpu.width!==view.width||gpu.height!==view.height||gpu.rgba.length!==expected.rgba.length)throw Error('Readback shape');
     for(let i=0;i<gpu.rgba.length;i++){
      if(gpu.rgba[i]!==expected.rgba[i])throw Error(`RGBA mismatch ${c.id} side${textureSide} byte${i}: ${gpu.rgba[i]} != ${expected.rgba[i]}`);
      if(presented[i]!==expected.rgba[i])throw Error(`Presented RGBA mismatch ${c.id} side${textureSide} byte${i}: ${presented[i]} != ${expected.rgba[i]}`);
     }
     for(let y=0;y<view.height;y++)for(let x=0;x<view.width;x++){
      const at=y*view.width+x,sample={kind:gpu.kind[at],owner:gpu.owner[at],depth:gpu.depth[at]};
      if(!plainPickEqual(pickGpuFrame(frame,sample,x,y),expected.pick(x,y)))throw Error(`Depth/owner/pick mismatch ${c.id} side${textureSide} pixel${at}`);
     }
     if(gl.getError()!==gl.NO_ERROR)throw Error('GL correctness error');lastFrame=frame;lastHash=digest(gpu.rgba);result.cases.push({id:c.id,textureSide,width:view.width,height:view.height,view,rgbaHash:lastHash,depthHash:digest(new Uint8Array(gpu.depth.buffer)),ownerHash:digest(new Uint8Array(gpu.owner.buffer)),kindHash:digest(gpu.kind),presentedHash:digest(presented),pixels:view.width*view.height,allocations:scene.allocations,stats:renderer.stats()});
     $('status').textContent=`Correctness: ${c.id} ${view.width}×${view.height}, atlas ${textureSide??'default'}`;await new Promise(resolve=>setTimeout(resolve,0));if(job!==generation)throw Error('Obsolete correctness pass');
    }
   }
  }
  const lose=gl.getExtension('WEBGL_lose_context');result.lifecycle={lossExtension:!!lose};
  if(lose){await waitEvent(canvas,'webglcontextlost',()=>lose.loseContext(),abort.signal);if(job!==generation)throw Error('Obsolete lifecycle');result.lifecycle.lost=renderer.stats();let rejected=false;try{renderer.draw(lastFrame);}catch{rejected=true;}if(!rejected)throw Error('Lost draw accepted');
   await new Promise(resolve=>setTimeout(resolve,100));if(job!==generation)throw Error('Obsolete restoration');await waitEvent(canvas,'webglcontextrestored',()=>lose.restoreContext(),abort.signal);if(job!==generation)throw Error('Obsolete restoration');renderer.restore();renderer.draw(lastFrame);const presented=defaultPixels(gl,lastFrame.viewport.width,lastFrame.viewport.height),restored=renderer.readback();if(digest(restored.rgba)!==lastHash||digest(presented)!==lastHash)throw Error('Restored pixels differ');result.lifecycle.restored=renderer.stats();
  }
  renderer.dispose();renderer.dispose();result.lifecycle.disposed=renderer.stats();if(result.lifecycle.disposed.requestedGpuBytes!==0)throw Error('Resource disposal accounting');
  result.completedAt=new Date().toISOString();$('status').textContent='Pixel/depth/pick and lifecycle checks complete';
 }catch(error){result.error=String(error);if(job===generation)$('status').textContent=result.error;}
 finally{if(job===generation){cleanup();reports.show(result);}}
}
async function run(){
 cleanup();const job=generation;buttons(true);reports.clear();
 const profile=$('profile').value,mapSize=Number($('map-size').value),count=Number($('actors').value),width=Number($('viewport').value),height=width===960?640:720,coupled=$('mode').value==='coupled';
 const result={...await metadata(),kind:'sustained-gpu',worldProfile:coupled?profile:null,rendererProfile:'ra2',mapSize,count,width,height,coupled,warmupMs:10000,durationMs:60000,frames:[],completions:[],rafTimes:[],worker:[],inputs:[],samples:[],pauseEvents:[]};if(job!==generation)return;
 let c;
 try{
  if(!['ra2','yr'].includes(profile)||![64,256,1024].includes(count)||![960,1280].includes(width)||![32,64].includes(mapSize))throw Error('Invalid controls');
  const coldStart=performance.now(),fixture=renderFixture(mapSize),cpuPreparedAt=performance.now(),scene=compileGpuScene(fixture.scene,fixture.batch),scenePreparedAt=performance.now();
  canvas.width=width;canvas.height=height;const gl=canvas.getContext('webgl2',options);if(!gl)throw Error('WebGL2 unavailable');const renderer=new GpuRenderer(gl);renderer.load(scene);const loadedAt=performance.now();
  c={renderer,client:coupled?new SimulationClient():null,verifier:null,timing:null,paused:false,snapshot:null,snapshotReceivedAt:0,frameId:0,autoBucket:-1,pendingInput:null,finished:false};current=c;
  result.cold={fixtureMs:cpuPreparedAt-coldStart,sceneMs:scenePreparedAt-cpuPreparedAt,contextAndLoadSubmitMs:loadedAt-scenePreparedAt,sceneAllocations:scene.allocations,rendererStats:renderer.stats()};
  result.gl={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),attributes:gl.getContextAttributes()};
  let coldComplete=null;
  c.timing=new GpuTiming(gl,r=>{if(r.metadata.cold)coldComplete=r;if(r.metadata.measured)append(result.completions,r);const input=result.inputs.find(i=>i.frameId===r.id);if(input)input.frameCompletedObservedAt=r.observedAt;});result.timerQueryAvailable=!!c.timing.ext;
  const firstAt=performance.now(),firstFrame=prepareGpuFrame(scene,{cameraX:mapSize*30-width/2,cameraY:mapSize*15-height/2,zoom:1,width,height,backgroundRgba:[17,21,23,255]}),firstPrepared=performance.now();
  c.timing.begin(0,firstPrepared,{cold:true,measured:false});const firstReceipt=renderer.draw(firstFrame),firstSubmitted=performance.now();c.timing.end();
  while(!coldComplete){await new Promise(resolve=>setTimeout(resolve,0));if(job!==generation)return;c.timing.poll(performance.now());}
  result.cold.firstUse={prepareMs:firstPrepared-firstAt,submitMs:firstSubmitted-firstPrepared,observedCompleteMs:coldComplete.observedAt-firstAt,gpuMs:coldComplete.gpuMs,receipt:{drawCalls:firstReceipt.drawCalls,uploadedBytes:firstReceipt.uploadedBytes}};
  if(gl.getError()!==gl.NO_ERROR)throw Error('Cold GL error');
  if(c.client){const at=performance.now(),r=await c.client.request('init',{profile,count});if(job!==generation)return;c.snapshot=r.snapshot;c.snapshotReceivedAt=performance.now();result.world={modelHash:r.snapshot.modelHash,movers:r.movers,initRoundtripMs:c.snapshotReceivedAt-at};}
  let start,measuredStart,lastStatus=0,simulationOrigin,pausedMs=0,pauseStarted=null;
  function advance(ticks,order,input=null){
   const at=performance.now(),expectedTick=c.snapshot.nextTick;
   c.client.request('advance',{expectedTick,ticks,order}).then(r=>{
    if(job!==generation)return;c.snapshot=r.snapshot;c.snapshotReceivedAt=performance.now();
    if(c.snapshotReceivedAt>=measuredStart)append(result.worker,{requestedAt:at,receivedAt:c.snapshotReceivedAt,expectedTick,ticks,order,admitted:r.admitted,nextTick:r.snapshot.nextTick,stateHash:r.snapshot.stateHash,timings:r.timings,work:r.work});
    if(input){input.receivedAt=c.snapshotReceivedAt;input.acceptedCommands=r.admitted;input.nextTick=r.snapshot.nextTick;input.frameId=null;c.pendingInput=input;}
   }).catch(error=>{if(job===generation){result.error=String(error);c.reject?.(error);}});
  }
  c.order=order=>{
   const entry={at:performance.now(),order,status:'refused',reason:null};append(result.inputs,entry);
   if(!c.client||c.finished||c.paused||c.client.busy){entry.reason='not-coupled, paused or worker busy';$('status').textContent='Order refused: worker unavailable/busy';return;}
   entry.status='sent';advance(1,order,entry);
  };
  c.togglePause=()=>{c.paused=!c.paused;const now=performance.now();append(result.pauseEvents,{at:now,paused:c.paused});if(c.paused)pauseStarted=now;else if(pauseStarted!==null){pausedMs+=now-pauseStarted;pauseStarted=null;}};
  await new Promise((resolve,reject)=>{c.reject=reject;
   const frame=stamp=>{if(job!==generation)return;try{
    const now=performance.now();if(document.visibilityState!=='visible')throw Error('Hidden measurement; no forced execution');
    start??=stamp;simulationOrigin??=now;measuredStart??=start+10000;const elapsed=stamp-start,measured=elapsed>=10000;
    c.timing.poll(now);if(measured)append(result.rafTimes,stamp);
    if(c.client&&!c.paused){const activeElapsed=now-simulationOrigin-pausedMs,target=Math.floor(activeElapsed*15/1000),debt=Math.max(0,target-c.snapshot.nextTick);
     if(debt>60)throw Error('Simulation debt exceeds60ticks');
     if(debt>0&&!c.client.busy){const bucket=Math.floor(c.snapshot.nextTick/120),order=bucket>c.autoBucket?(bucket%2?'left':'right'):null;c.autoBucket=Math.max(c.autoBucket,bucket);advance(Math.min(4,debt),order);}
     if(measured&&now-lastStatus>1000)append(result.samples,{at:now,nextTick:c.snapshot.nextTick,targetTick:target,debt,snapshotAgeMs:now-c.snapshotReceivedAt,rendererStats:renderer.stats()});
    }
    if(!c.paused&&c.timing.pending.length<8){
     const id=++c.frameId,phase=id%600,dx=(phase<300?phase:600-phase)-150,dy=((id%240)<120?id%240:240-id%240)-60;
     const view={cameraX:mapSize*30-width/2+dx,cameraY:mapSize*15-height/2+dy,zoom:1,width,height,backgroundRgba:[17,21,23,255]};
     const objects=fixture.batch.objects.map((o,i)=>{const actor=c.snapshot?.actors[(i*4)%count],offset=actor?(actor.x-2)*.25:((id+i)%60)*.25;return {...o,x:o.x+Math.floor(offset),y:o.y+(id+i)%3,depth:{...o.depth,base:o.depth.base+(id+i)%3}};});
     const prepareAt=performance.now(),prepared=prepareGpuFrame(scene,view,objects),preparedAt=performance.now(),meta={measured,frameId:id,snapshotTick:c.snapshot?.nextTick??null,snapshotAgeMs:c.snapshot?prepareAt-c.snapshotReceivedAt:null};
     if(c.timing.begin(id,preparedAt,meta)){const receipt=renderer.draw(prepared),submittedAt=performance.now();c.timing.end();const endedAt=performance.now();
      if(measured)append(result.frames,{id,rafAt:stamp,prepareAt,submittedAt,endedAt,prepareMs:preparedAt-prepareAt,submitMs:submittedAt-preparedAt,totalServiceMs:endedAt-prepareAt,drawCalls:receipt.drawCalls,uploadedBytes:receipt.uploadedBytes,allocations:prepared.allocations,...meta});
      if(c.pendingInput){c.pendingInput.frameId=id;c.pendingInput.frameSubmittedAt=submittedAt;c.pendingInput=null;}
     }
    }else if(!c.paused)c.timing.skipped++;
    if(now-lastStatus>1000){lastStatus=now;$('status').textContent=`${measured?'Measuring':'Warming'} ${Math.floor(elapsed/1000)}s; frames ${result.frames.length}; tick ${c.snapshot?.nextTick??'renderer only'}`;}
    if(elapsed<70000){raf=requestAnimationFrame(frame);return;}c.finished=true;resolve();
   }catch(error){reject(error);}};raf=requestAnimationFrame(frame);
  });
  c.reject=null;result.measuredEnd=performance.now();result.measuredStart=measuredStart;
  while(c.timing.pending.length){if(job!==generation)return;await new Promise(resolve=>setTimeout(resolve,0));c.timing.poll(performance.now());}
  result.gpuTiming={peakPending:c.timing.peak,skipped:c.timing.skipped,disjoint:c.timing.disjoint};
  if(c.client){while(c.client.busy){if(job!==generation)return;await new Promise(resolve=>setTimeout(resolve,1));}
   const exported=await c.client.request('export');if(job!==generation)return;result.replay=exported;
   const verifyAt=performance.now();c.verifier=new SimulationClient();await c.verifier.request('init',{profile,count});if(job!==generation)return;const verified=await c.verifier.request('verify',{text:exported.text});if(job!==generation)return;
   if(verified.stateHash!==exported.snapshot.stateHash||verified.nextTick!==exported.snapshot.nextTick)throw Error('Independent replay mismatch');result.verified={...verified,elapsedMs:performance.now()-verifyAt};
  }
  const duration=result.measuredEnd-result.measuredStart,intervals=result.frames.slice(1).map((f,i)=>f.rafAt-result.frames[i].rafAt);
  result.summary={durationMs:duration,submittedFps:result.frames.length*1000/duration,observedCompletedWithinWindowFps:result.completions.filter(r=>r.observedAt<=result.measuredEnd).length*1000/duration,rafIntervals:stats(result.rafTimes.slice(1).map((t,i)=>t-result.rafTimes[i])),usefulFrameIntervals:stats(intervals),gapsOver16_667Ms:intervals.filter(t=>t>1000/60).length,prepare:stats(result.frames.map(f=>f.prepareMs)),submit:stats(result.frames.map(f=>f.submitMs)),frameService:stats(result.frames.map(f=>f.totalServiceMs)),gpu:stats(result.completions.filter(r=>r.gpuMs!==null).map(r=>r.gpuMs)),observedCompletion:stats(result.completions.map(r=>r.observedAt-r.submittedAt)),workerRoundtrip:stats(result.worker.map(r=>r.receivedAt-r.requestedAt))};
  result.completedAt=new Date().toISOString();$('status').textContent=`Complete: ${result.summary.submittedFps.toFixed(3)} useful submissions/s; inspect completion and replay evidence`;
 }catch(error){result.error=String(error);if(job===generation)$('status').textContent=result.error;}
 finally{if(job===generation){cleanup();result.disposedStats=c?.renderer.stats();reports.show(result);}}
}
$('run').onclick=run;$('correctness').onclick=correctness;
function terminate(reason){const c=current,previousGeneration=generation;cleanup(reason);$('status').textContent=reason+'; worker and GPU resources disposed';reports.show({kind:'terminated',reason,generation:previousGeneration,nextGeneration:generation,snapshotTick:c?.snapshot?.nextTick??null,workerClosed:c?.client?.closed??null,verifierClosed:c?.verifier?.closed??null,pendingWorker:c?.client?.busy??false,gpuPending:c?.timing?.pending.length??0,stats:c?.renderer?.stats()??null});}
$('cancel').onclick=()=>terminate('Cancelled');
$('move').onclick=()=>current?.order?.('right');$('stop').onclick=()=>current?.order?.('stop');$('pause').onclick=()=>current?.togglePause?.();
addEventListener('pagehide',()=>{terminate('Page left');reports.clear();});
addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'&&current)terminate('Hidden measurement invalidated');});
canvas.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='KeyS'){e.preventDefault();current?.order?.('stop');}else if(e.code==='Space'){e.preventDefault();current?.togglePause?.();}});
