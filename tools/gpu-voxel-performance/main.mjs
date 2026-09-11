// SPDX-License-Identifier: GPL-3.0-or-later
// Original-only browser diagnostic. Readbacks are correctness/interaction checks, never cadence.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { GpuVoxelRenderer } from '../../packages/render/src/gpu-voxel-renderer.ts';
import { GPU_VOXEL_POLICY, pickGpuVoxelFrame, copyGpuVoxelSceneData, copyGpuVoxelFrameData } from '../../packages/render/src/gpu-voxel-policy.ts';
import { renderVoxelFrame } from '../../packages/render/src/voxel-render.ts';
import { gpuVoxelOracleCases } from '../../tests/render/gpu-voxel-fixtures.ts';
import { ReportStore } from '../gpu-performance/report-store.mjs';
const $=id=>document.getElementById(id), canvas=document.querySelector('canvas');
const store=new ReportStore($('download'),$('output'));
const hash=a=>bytesToHex(sha256(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)));
const pause=()=>new Promise(r=>setTimeout(r,0));
const attributes={alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false};
let active=null, renderer=null, gl=null;
const environment=()=>({ua:navigator.userAgent,platform:navigator.platform,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null,crossOriginIsolated,visibility:document.visibilityState,devicePixelRatio});
function assert(ok,message){if(!ok)throw Error(message);}
function check(token){if(active!==token||token.cancelled)throw Error(token.reason??'cancelled');}
function cleanup(){renderer?.dispose();renderer=null;}
function cancel(reason='cancelled'){if(active){active.cancelled=true;active.reason=reason;active.abort?.();}cleanup();}
function context(){gl=canvas.getContext('webgl2',attributes);assert(gl,'WebGL2 unavailable');return gl;}
function top(bytes,width,height){const out=new Uint8Array(bytes.length);for(let y=0;y<height;y++)out.set(bytes.subarray(y*width*4,(y+1)*width*4),(height-1-y)*width*4);return out;}
function presentation(frame){const pixels=new Uint8Array(frame.width*frame.height*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.readBuffer(gl.BACK);gl.readPixels(0,0,frame.width,frame.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);assert(gl.getError()===gl.NO_ERROR,'default framebuffer read error');return top(pixels,frame.width,frame.height);}
function identity(p){return p?`${p.instanceId}/${p.partId}/${p.voxelOrdinal}`:null;}
function sumCases(cases){const keys=['pixels','gpuMaskDifferences','gpuOwnerDifferences','gpuDepthDifferences','gpuRgbaDifferences','defaultRgbaDifferences','oldMaskDifferences','oldOwnerDifferences','oldDepthDifferences','oldRgbaDifferences','float64OracleDifferences','interactionDifferences'];return Object.fromEntries(keys.map(k=>[k,cases.reduce((n,c)=>n+c[k],0)]));}
async function correctness(token,report){
 const cases=gpuVoxelOracleCases();report.cases=[];report.policy=GPU_VOXEL_POLICY;context();report.contextAttributes=gl.getContextAttributes();report.gl={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR)};
 for(const c of cases){check(token);$('status').textContent=`Checking ${report.cases.length+1}/${cases.length}: ${c.id}`;await pause();
  cleanup();canvas.width=c.frame.width;canvas.height=c.frame.height;renderer=new GpuVoxelRenderer(gl);
  const start=performance.now();renderer.load(c.frame.scene);const loaded=performance.now();const receipt=renderer.draw(c.frame,[17,31,47,37]);const drawn=performance.now();
  const shown=presentation(c.frame),gpu=renderer.readback();assert(gl.getError()===gl.NO_ERROR,'diagnostic GL error');
  const old=renderVoxelFrame(c.reference),resident=copyGpuVoxelSceneData(c.frame.scene),packet=copyGpuVoxelFrameData(c.frame);
  const expected=new Uint8Array(gpu.rgba.length),expectedOwner=new Uint32Array(gpu.owner.length),expectedDepth=new Float32Array(gpu.depth.length);expectedOwner.fill(0xffffffff);expectedDepth.fill(-Infinity);
  const row={id:c.id,width:c.frame.width,height:c.frame.height,pixels:gpu.owner.length,gpuMaskDifferences:0,gpuOwnerDifferences:0,gpuDepthDifferences:0,gpuRgbaDifferences:0,defaultRgbaDifferences:0,oldMaskDifferences:0,oldOwnerDifferences:0,oldDepthDifferences:0,oldRgbaDifferences:0,float64OracleDifferences:0,interactionDifferences:0,maxGpuDepthError:0,firstDifferences:[],picks:[],loadSubmitMs:loaded-start,firstDrawSubmitMs:drawn-loaded,allocations:c.frame.allocations};
  const probes=[];let hits=0,empty=0;
  for(let y=0;y<c.frame.height;y++)for(let x=0;x<c.frame.width;x++){
   const i=y*c.frame.width+x,p=pickGpuVoxelFrame(c.frame,x,y),fp64=pickGpuVoxelFrame(c.frame,x,y,'float64'),prior=old.pick(x,y);const priorDepth=prior?.depth??-Infinity;
   if(identity(fp64)!==identity(prior)||(fp64?.depth??-Infinity)!==priorDepth)row.float64OracleDifferences++;
   if(p){const placement=packet.placements.find(v=>p.owner>=v.start&&p.owner<v.end);assert(placement,'owner palette join');expectedOwner[i]=p.owner;expectedDepth[i]=p.depth;expected.set(resident.rgba.subarray(placement.palette*1024+p.colorIndex*4,placement.palette*1024+p.colorIndex*4+4),i*4);}
   if((gpu.owner[i]===0xffffffff)!==(p===null))row.gpuMaskDifferences++;
   if(gpu.owner[i]!==expectedOwner[i])row.gpuOwnerDifferences++;
   if(gpu.depth[i]!==expectedDepth[i]){row.gpuDepthDifferences++;if(p&&gpu.owner[i]!==0xffffffff)row.maxGpuDepthError=Math.max(row.maxGpuDepthError,Math.abs(gpu.depth[i]-p.depth));}
   if((p===null)!==(prior===null))row.oldMaskDifferences++;
   if(identity(p)!==identity(prior))row.oldOwnerDifferences++;
   if((p?.depth??-Infinity)!==priorDepth)row.oldDepthDifferences++;
   let rgbaDiff=false,displayDiff=false,oldDiff=false;
   for(let k=0;k<4;k++){const target=expected[i*4+k];rgbaDiff ||= gpu.rgba[i*4+k]!==target;displayDiff ||= shown[i*4+k]!== (p?target:[17,31,47,37][k]);oldDiff ||=old.rgba[i*4+k]!==target;}
   row.gpuRgbaDifferences+=Number(rgbaDiff);row.defaultRgbaDifferences+=Number(displayDiff);row.oldRgbaDifferences+=Number(oldDiff);
   if((rgbaDiff||displayDiff||gpu.owner[i]!==expectedOwner[i]||gpu.depth[i]!==expectedDepth[i])&&row.firstDifferences.length<16)row.firstDifferences.push({x,y,cpu:p,gpuOwner:gpu.owner[i],gpuDepth:gpu.depth[i],rgbaDiff,displayDiff});
   if(p&&hits++<3||!p&&empty++<3)probes.push({x,y,p});
  }
  for(const probe of probes){const start=performance.now(),pick=renderer.pick(probe.x,probe.y,receipt.sequence),ms=performance.now()-start;const at=probe.y*c.frame.width+probe.x;const matches=pick?.owner===(gpu.owner[at]===0xffffffff?undefined:gpu.owner[at])&&(pick?.depth??-Infinity)===gpu.depth[at];row.interactionDifferences+=Number(!matches);row.picks.push({x:probe.x,y:probe.y,ms,matches});}
  assert(renderer.pick(0,0,receipt.sequence+1)===null,'obsolete pick accepted');assert(renderer.pick(-1,0,receipt.sequence)===null,'outside pick accepted');
  row.hashes={gpuRgba:hash(gpu.rgba),gpuOwner:hash(gpu.owner),gpuDepth:hash(gpu.depth),defaultFramebuffer:hash(shown),cpuRgba:hash(expected),cpuOwner:hash(expectedOwner),cpuDepth:hash(expectedDepth),oldRgba:hash(old.rgba)};row.stats=renderer.stats();report.cases.push(row);
 }
 report.summary=sumCases(report.cases);report.verified=report.summary.gpuOwnerDifferences===0&&report.summary.gpuDepthDifferences===0&&report.summary.gpuRgbaDifferences===0&&report.summary.defaultRgbaDifferences===0&&report.summary.float64OracleDifferences===0&&report.summary.interactionDifferences===0;
}
function eventOnce(target,name,token){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{target.removeEventListener(name,handler);reject(Error(`${name} timeout`));},5000);function handler(){clearTimeout(timer);try{check(token);resolve();}catch(e){reject(e);}}target.addEventListener(name,handler,{once:true});});}
async function lifecycle(token,report){context();const c=gpuVoxelOracleCases()[0];canvas.width=c.frame.width;canvas.height=c.frame.height;renderer=new GpuVoxelRenderer(gl);renderer.load(c.frame.scene);const first=renderer.draw(c.frame);const before=hash(renderer.readback().rgba);const ext=gl.getExtension('WEBGL_lose_context');assert(ext,'WEBGL_lose_context unavailable');
 const lost=eventOnce(canvas,'webglcontextlost',token);ext.loseContext();await lost;check(token);let refused=false;try{renderer.draw(c.frame);}catch{refused=true;}assert(refused,'lost draw accepted');await new Promise(r=>setTimeout(r,100));check(token);const restored=eventOnce(canvas,'webglcontextrestored',token);ext.restoreContext();await restored;check(token);renderer.restore();const second=renderer.draw(c.frame);const after=hash(renderer.readback().rgba);assert(before===after,'restored pixels differ');assert(renderer.pick(0,0,first.sequence)===null,'old generation pick accepted');renderer.dispose();renderer.dispose();const disposed=renderer.stats();assert(disposed.state==='disposed'&&disposed.requestedGpuBytes===0&&disposed.ownedCpuBytes===0,'dispose accounting');renderer=new GpuVoxelRenderer(gl);renderer.load(c.frame.scene);renderer.draw(c.frame);assert(hash(renderer.readback().rgba)===before,'restarted pixels differ');report.lifecycle={lostDrawRefused:refused,restoredPixelsEqual:true,oldPickRefused:true,doubleDispose:disposed,restartedPixelsEqual:true,restoredSequence:second.sequence};report.verified=true;
}
async function refresh(token,report){const rows=[];let start=null;await new Promise((resolve,reject)=>{let handle=null;const fail=()=>{if(handle!==null)cancelAnimationFrame(handle);token.abort=null;reject(Error(token.reason??'cancelled'));};token.abort=fail;function frame(now){try{check(token);start??=now;rows.push(now);if(now-start>=22000){token.abort=null;resolve();}else handle=requestAnimationFrame(frame);}catch(e){token.abort=null;reject(e);}}handle=requestAnimationFrame(frame);});const kept=rows.filter(t=>t>=rows[0]+2000),gaps=kept.slice(1).map((t,i)=>t-kept[i]).sort((a,b)=>a-b);report.timestamps=kept;report.summary={opportunities:kept.length-1,elapsedMs:kept.at(-1)-kept[0],rate:(kept.length-1)*1000/(kept.at(-1)-kept[0]),p95:gaps[Math.ceil(gaps.length*.95)-1],p99:gaps[Math.ceil(gaps.length*.99)-1],maximum:gaps.at(-1)};report.verified=true;}
async function run(kind,fn){if(active)return;cleanup();const token={cancelled:false};active=token;const report={schema:1,kind,environment:environment(),startedAt:new Date().toISOString(),cases:[]};store.clear();try{await fn(token,report);check(token);}catch(e){report.error=String(e?.stack??e);report.verified=false;}finally{cleanup();report.completedAt=new Date().toISOString();report.finalEnvironment=environment();active=null;store.show(report);$('status').textContent=report.verified?'Completed. Full JSON is available for local download.':'Completed with differences or failure. Download the full evidence.';}}
$('correctness').onclick=()=>run('voxel-correctness',correctness);$('lifecycle').onclick=()=>run('voxel-lifecycle',lifecycle);$('refresh').onclick=()=>run('voxel-refresh',refresh);$('cancel').onclick=()=>cancel();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')cancel('hidden');});window.addEventListener('pagehide',()=>{cancel('pagehide');store.clear();});
