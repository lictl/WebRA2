// SPDX-License-Identifier: GPL-3.0-or-later
// Original passive RAF diagnostic. No display settings or simulation are changed.
const status=document.querySelector('#status'),output=document.querySelector('#output');
let requestId=0,generation=0;
for(const id of ['correctness','run','move','stop','pause'])document.querySelector('#'+id).disabled=true;
function stop(){generation++;cancelAnimationFrame(requestId);document.querySelector('#refresh').disabled=false;}
addEventListener('pagehide',stop);document.querySelector('#cancel').onclick=()=>{stop();status.textContent='Cancelled';};
document.querySelector('#refresh').onclick=async()=>{
 stop();const job=generation;document.querySelector('#refresh').disabled=true;
 const info={schema:1,kind:'idle-raf-opportunities',startedAt:new Date().toISOString(),browser:navigator.userAgent,
  details:await navigator.userAgentData?.getHighEntropyValues(['fullVersionList','architecture','platformVersion'])??null,
  isolated:globalThis.crossOriginIsolated,dpr:devicePixelRatio,screen:{width:screen.width,height:screen.height},warmupMs:2000,durationMs:20000};
 if(job!==generation)return;
 const stamps=[];let start;
 const frame=stamp=>{
  if(job!==generation)return;
  if(document.visibilityState!=='visible'){stop();output.textContent=JSON.stringify({...info,error:'Page hidden'},null,2);return;}
  start??=stamp;const elapsed=stamp-start;
  if(elapsed>=2000)stamps.push(stamp);
  status.textContent=elapsed<2000?'Warming refresh observation':`Refresh observation: ${Math.min(20,Math.floor((elapsed-2000)/1000))}/20 seconds`;
  if(elapsed<22000){requestId=requestAnimationFrame(frame);return;}
  const intervals=stamps.slice(1).map((s,i)=>s-stamps[i]),sorted=[...intervals].sort((a,b)=>a-b);
  output.textContent=JSON.stringify({...info,completedAt:new Date().toISOString(),timestampsMs:stamps,intervalsMs:intervals,
   callbacks:stamps.length,elapsedMs:stamps.at(-1)-stamps[0],opportunitiesPerSecond:(stamps.length-1)*1000/(stamps.at(-1)-stamps[0]),
   medianIntervalMs:sorted[Math.floor(sorted.length/2)],p95IntervalMs:sorted[Math.ceil(sorted.length*.95)-1],p99IntervalMs:sorted[Math.ceil(sorted.length*.99)-1]},null,2);
  status.textContent='Refresh observation complete; this is not physical scanout measurement.';document.querySelector('#refresh').disabled=false;
 };
 requestId=requestAnimationFrame(frame);
};
