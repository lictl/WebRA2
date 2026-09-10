// SPDX-License-Identifier: GPL-3.0-or-later
// Original fixtures exercise protocol/lifecycle, not original gameplay.
import test from 'node:test';import assert from 'node:assert/strict';
import {validCampaignResult,validCampaignAction} from '../../apps/web/src/campaign-protocol.ts';
import {TerrainBridge,type TerrainPort} from '../../apps/web/src/terrain-bridge.ts';
import {TerrainController} from '../../apps/web/src/terrain-controller.ts';
import {attachTerrainWorker,type TerrainScope} from '../../apps/web/src/terrain-worker-runtime.ts';
import type {TerrainAction,TerrainResult,TerrainReply} from '../../apps/web/src/terrain-protocol.ts';
import {campaignPlan,campaignFrame} from './campaign.fixture.ts';
import {campaignText,campaignReason} from '../../apps/web/src/campaign-i18n.ts';
const files=[new File(['Original'],'original.mix')],scan={type:'campaign-scan' as const,profile:'ra2' as const,files:files.map(file=>({file,relativePath:'local/'+file.name}))};
class Worker extends EventTarget{sent:unknown[]=[];terminated=0;postMessage(v:unknown){this.sent.push(v);}terminate(){this.terminated++;}emit(result:unknown,id:number,version=6){this.dispatchEvent(new MessageEvent('message',{data:structuredClone({version,id,type:'result',result})}));}}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('campaign metadata rejects stale hashes, mismatched shapes and payload-bearing nested rows',()=>{
 const plan=campaignPlan();assert.equal(validCampaignResult({type:'campaign-plan',plan}),true);assert.ok(validCampaignAction(scan));
 for(const change of [(p:any)=>p.entries[0].missionPath='../secret.map',(p:any)=>p.entries[0].reasons=new Array(1),(p:any)=>p.pins.payload=new Blob(['payload']),(p:any)=>p.entries[0].title=new String('boxed'),(p:any)=>p.fingerprint='0'.repeat(64),(p:any)=>p.entries.reverse(),(p:any)=>p.entries[0].title='x'.repeat(8193)]){const copy=structuredClone(plan);change(copy);assert.equal(validCampaignResult({type:'campaign-plan',plan:copy}),false);}
 assert.equal(validCampaignAction({...scan,files:[{file:files[0],relativePath:'',payload:new Blob()}]}),false);
 assert.equal(validCampaignAction({type:'campaign-launch',fingerprint:plan.fingerprint,entryId:'allied',width:961,height:1}),false);
});
test('bridge binds launch map/profile to cached metadata and retains only that plan across back',async()=>{
 for(const profile of ['ra2','yr'] as const){const worker=new Worker(),bridge=new TerrainBridge(worker),signal=new AbortController().signal,plan=campaignPlan(profile);
  await assert.rejects(bridge.request({type:'campaign-launch',fingerprint:plan.fingerprint,entryId:'allied',width:120,height:45},signal),/identity/);
  const reading=bridge.request({...scan,profile},signal);worker.emit({type:'campaign-plan',plan},1);const reply=await reading;assert.equal(reply.type,'campaign-plan');
  // Returned caller metadata is not the bridge's cached identity.
  if(reply.type==='campaign-plan')(reply.plan.entries[0] as {missionPath:string}).missionPath='forged.map';
  const launch=bridge.request({type:'campaign-launch',fingerprint:plan.fingerprint,entryId:'allied',width:120,height:45},signal);worker.emit(campaignFrame(2,profile),2);assert.equal((await launch).type,'frame');
  const back=bridge.request({type:'campaign-back',fingerprint:plan.fingerprint},signal);worker.emit({type:'campaign-plan',plan},3);await back;
  const second=bridge.request({type:'campaign-launch',fingerprint:plan.fingerprint,entryId:'soviet',width:120,height:45},signal);worker.emit(campaignFrame(4,profile,'allied'),4);await assert.rejects(second,/invalid/);assert.equal(worker.terminated,1);
 }
 const w=new Worker(),b=new TerrainBridge(w),r=b.request(scan,new AbortController().signal);w.emit({type:'campaign-plan',plan:campaignPlan()},1,5);await assert.rejects(r,/invalid/);
});
test('controller retains selected File identities across back/retry and discards cancelled and cross-profile jobs',async()=>{
 const jobs:{action:TerrainAction;signal:AbortSignal;resolve:(r:TerrainResult)=>void}[]=[],ports:{disposed:number}[]=[];
 const controller=new TerrainController('en',()=>{const p={disposed:0};ports.push(p);return {request(action,signal){return new Promise(resolve=>jobs.push({action,signal,resolve}));},dispose(){p.disposed++;}} as TerrainPort;});
 controller.resize(120,45);controller.select(files);const first=controller.scanCampaigns();controller.cancel();jobs[0]!.resolve({type:'campaign-plan',plan:campaignPlan()});await first;assert.equal(controller.state.phase,'cancelled');assert.ok(jobs[0]!.signal.aborted);assert.equal(controller.state.files,1);
 const retry=controller.scanCampaigns();jobs[1]!.resolve({type:'campaign-plan',plan:campaignPlan()});await retry;assert.equal(controller.state.phase,'choosing');assert.equal((jobs[1]!.action as typeof scan).files[0]!.file,files[0]);
 const launch=controller.launchCampaign('allied');jobs[2]!.resolve(campaignFrame(3));await launch;assert.equal(controller.state.phase,'ready');
 const back=controller.backCampaigns();jobs[3]!.resolve({type:'campaign-plan',plan:campaignPlan()});await back;assert.equal(controller.state.phase,'choosing');assert.equal(ports.length,2);assert.equal(controller.state.frame,null);
 const pending=controller.launchCampaign('soviet');controller.setProfile('yr');jobs[4]!.resolve(campaignFrame(5,'ra2','soviet'));await pending;assert.equal(controller.state.profile,'yr');assert.equal(controller.state.campaign,null);assert.equal(controller.state.files,1);controller.dispose();assert.ok(ports.every(p=>p.disposed===1));
});
test('worker retains one catalog session, releases old scene on back, and disposes catalog on replacement',async()=>{
 const messages:TerrainReply[]=[],scope:TerrainScope={onmessage:null,postMessage(message,transfer){messages.push(structuredClone(message,{transfer:transfer??[]}));}};let opened=0,disposed=0,loads=0;
 attachTerrainWorker(scope,async()=>{throw Error('legacy unused');},async(selected,profile)=>{opened++;assert.equal(selected[0]!.webkitRelativePath,'local/original.mix');const plan=campaignPlan(profile);return {plan,dispose(){disposed++;},async load(fp,id){assert.equal(fp,plan.fingerprint);loads++;const sample=campaignFrame(1,profile,id);return {summary:sample.summary,scene:{render(viewport){return {viewport,rgba:new Uint8Array(viewport.width*viewport.height*4),allocations:sample.allocations,pick(){return null;}};}}};}};});
 const send=async(id:number,action:TerrainAction)=>{scope.onmessage!({data:structuredClone({version:6,id,action})});await tick();return messages.at(-1)!;};
 await send(1,scan);const plan=campaignPlan();await send(2,{type:'campaign-launch',fingerprint:plan.fingerprint,entryId:'allied',width:120,height:45});assert.equal(loads,1);
 await send(3,{type:'campaign-back',fingerprint:plan.fingerprint});const stale=await send(4,{type:'pick',frameId:2,x:1,y:1});assert.equal(stale.type,'error');assert.equal(disposed,0);
 await send(5,{type:'campaign-launch',fingerprint:plan.fingerprint,entryId:'soviet',width:120,height:45});assert.equal(opened,1);assert.equal(loads,2);await send(6,{...scan,profile:'yr'});assert.equal(disposed,1);assert.equal(opened,2);
});
test('campaign controls and unavailable explanations have both locales with safe unknown-key fallback',()=>{
 for(const key of ['title','launch','back','scan','retry','cancel','media','scope','sourceProblem','fieldProblem','textProblem','debugProblem'])for(const locale of ['en','zh-Hant'] as const)assert.notEqual(campaignText(locale,key),key);
 assert.equal(campaignText('en','__proto__'),'__proto__');assert.match(campaignReason('zh-Hant','source-missing:original.map'),/來源/);
});
