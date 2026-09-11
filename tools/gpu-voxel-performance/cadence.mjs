// SPDX-License-Identifier: GPL-3.0-or-later
// Renderer-only changed-frame experiment; no simulation, polling readback or gl.finish.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { gpuVoxelWorkload } from '../../tests/render/gpu-voxel-fixtures.ts';
import { prepareGpuVoxelFrame } from '../../packages/render/src/gpu-voxel-policy.ts';
import { GpuVoxelRenderer } from '../../packages/render/src/gpu-voxel-renderer.ts';
import { GpuTiming } from '../gpu-performance/gpu-timing.mjs';
const hash=a=>bytesToHex(sha256(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)));
function distribution(values){const sorted=values.slice().sort((a,b)=>a-b);return {n:sorted.length,median:sorted.length?sorted[Math.ceil(sorted.length*.5)-1]:null,p95:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:null,p99:sorted.length?sorted[Math.ceil(sorted.length*.99)-1]:null,max:sorted.at(-1)??null};}
export function cadenceOptions(groups,width,mode){if(![16,64,256,1024].includes(groups)||![960,1280].includes(width)||!['probe','sustained'].includes(mode))throw Error('Cadence options');return{groups,width,height:width===960?640:720,warmupMs:mode==='probe'?2000:10000,measureMs:mode==='probe'?8000:60000,mode};}
export function summarizeCadence(frames,completed,start,end,opportunities){const measured=frames.filter(v=>v.submittedAt>=start&&v.submittedAt<end),done=completed.filter(v=>v.id>0&&v.metadata.measured&&v.observedAt<end),gaps=measured.slice(1).map((v,i)=>v.submittedAt-measured[i].submittedAt),raf=opportunities.filter(v=>v>=start&&v<end),rafGaps=raf.slice(1).map((v,i)=>v-raf[i]),windows=[];for(let t=start;t+1000<=end;t+=1000)windows.push({start:t,submitted:measured.filter(v=>v.submittedAt>=t&&v.submittedAt<t+1000).length,observed:done.filter(v=>v.observedAt>=t&&v.observedAt<t+1000).length});return{seconds:(end-start)/1000,submitted:measured.length,observedWithinWindow:done.length,submittedFps:measured.length*1000/(end-start),observedFps:done.length*1000/(end-start),minimumFullSecondObserved:Math.min(...windows.map(v=>v.observed)),windows,frameGaps:distribution(gaps),frameDeadlineMisses:gaps.filter(v=>v>1000/60).length,rafGaps:distribution(rafGaps),rafDeadlineMisses:rafGaps.filter(v=>v>1000/60).length,prepareMs:distribution(measured.map(v=>v.preparedAt-v.begin)),stageAndSubmitMs:distribution(measured.map(v=>v.returnedAt-v.preparedAt)),serviceMs:distribution(measured.map(v=>v.returnedAt-v.begin)),gpuQueryMs:distribution(done.filter(v=>v.gpuMs!==null).map(v=>v.gpuMs))};}
export async function runVoxelCadence({canvas,gl,token,report,check,status,options}){
 const {groups,width,height,warmupMs,measureMs}=options;Object.assign(report,options,{rendererOnly:true,worldSimulation:false});
 const startFixture=performance.now(),workload=gpuVoxelWorkload(groups,width,height),readyFixture=performance.now();canvas.width=width;canvas.height=height;
 const renderer=new GpuVoxelRenderer(gl);let timing=null,lastFrame=workload.frame,rafId=null;
 const completed=[],frames=[],opportunities=[];let next=0,measuredStart=null,measuredEnd=null;
 report.frames=frames;report.completed=completed;report.opportunities=opportunities;report.initialAllocations=workload.frame.allocations;report.sceneAllocations=workload.scene.allocations;report.environment.contextAttributes=gl.getContextAttributes();
 try{
  const beforeLoad=performance.now();renderer.load(workload.scene);const afterLoad=performance.now();timing=new GpuTiming(gl,r=>completed.push(r));
  const beforeFirst=performance.now();timing.begin(0,beforeFirst,{cold:true});renderer.draw(workload.frame,[17,31,47,37]);timing.end();const afterFirst=performance.now();
  async function loop(step){await new Promise((resolve,reject)=>{function fail(error){if(rafId!==null)cancelAnimationFrame(rafId);token.abort=null;reject(error);}token.abort=()=>fail(Error(token.reason??'cancelled'));function frame(raf){try{check(token);const now=performance.now();timing.poll(now);if(step(raf,now)){token.abort=null;resolve();}else rafId=requestAnimationFrame(frame);}catch(e){fail(e);}}rafId=requestAnimationFrame(frame);});}
  await loop(()=>completed.some(v=>v.id===0));const cold=completed[0];
  report.cold={fixtureMs:readyFixture-startFixture,loadSubmitMs:afterLoad-beforeLoad,firstDrawSubmitMs:afterFirst-beforeFirst,firstObservedElapsedMs:cold.observedAt-beforeFirst,gpuMs:cold.gpuMs};
  const warmupStart=performance.now();measuredStart=warmupStart+warmupMs;measuredEnd=measuredStart+measureMs;report.window={warmupStart,measuredStart,measuredEnd};
  status.textContent=`Renderer only: ${groups} groups / ${groups*3} instances; ${warmupMs/1000}s warmup + ${measureMs/1000}s measurement.`;
  await loop((raf,now)=>{if(now>=measuredEnd)return true;opportunities.push(raf);if(timing.pending.length>=8){timing.skipped++;return false;}
   const id=++next,begin=performance.now(),phase=(begin-warmupStart)/1000,dx=Math.sin(phase*.7)*5,dy=Math.cos(phase*.9)*3;
   const instances=workload.reference.instances.map((v,i)=>{const modelToView=v.modelToView.slice();modelToView[3]+=dx+(i%3-1)*Math.sin(phase)*.25;modelToView[7]+=dy;return{...v,modelToView};});
   lastFrame=prepareGpuVoxelFrame(workload.scene,{instances,width,height});const preparedAt=performance.now(),submittedAt=performance.now(),measured=submittedAt>=measuredStart&&submittedAt<measuredEnd;
   if(!timing.begin(id,submittedAt,{measured}))throw Error('Unexpected fence admission change');const receipt=renderer.draw(lastFrame,[17,31,47,37]);timing.end();const returnedAt=performance.now();
   frames.push({id,raf,begin,preparedAt,submittedAt,returnedAt,sequence:receipt.sequence,uploadedBytes:receipt.uploadedBytes,allocations:lastFrame.allocations});return false;
  });
  status.textContent='Measurement finished; draining bounded GPU receipts.';await loop(()=>timing.pending.length===0);
  report.summary=summarizeCadence(frames,completed,measuredStart,measuredEnd,opportunities);report.summary.ringPeak=timing.peak;report.summary.skipped=timing.skipped;report.summary.disjoint=timing.disjoint;report.summary.pendingAtEnd=timing.pending.length;
  const ids=new Set(completed.filter(v=>v.id>0).map(v=>v.id));if(ids.size!==frames.length||frames.some(v=>!ids.has(v.id)))throw Error('Receipt ledger mismatch');
  // Full final planes are deliberately after the measured window and complete fence drain.
  const pixels=renderer.readback();report.finalHashes={rgba:hash(pixels.rgba),owner:hash(pixels.owner),depth:hash(pixels.depth)};report.finalAllocations=lastFrame.allocations;report.stats=renderer.stats();report.verified=true;
 }finally{token.abort=null;if(rafId!==null)cancelAnimationFrame(rafId);timing?.dispose();renderer.dispose();report.disposed=renderer.stats();}
}
