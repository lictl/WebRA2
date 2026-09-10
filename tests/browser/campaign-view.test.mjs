// SPDX-License-Identifier: GPL-3.0-or-later
// Original minimal DOM/event fixture; no claim of native browser rendering.
import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {TerrainController} from '../../apps/web/src/terrain-controller.ts';import {campaignPlan,campaignFrame} from './campaign.fixture.ts';
const settle=()=>new Promise(r=>setImmediate(r));
test('mounted chooser wires local selection, profiles, translated launches, back, retry and unavailable entries',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'webra2-campaign-view-')),nodes=new Map(),priorDocument=globalThis.document;
 class Element{
  children=[];handlers={};value='';dataset={};hidden=false;disabled=false;textContent='';attributes={};files=null;
  set innerHTML(value){assert.equal(typeof value,'string');this.template=value;for(const match of value.matchAll(/<([\w-]+)([^>]*)>/g)){const [,tag,attrs]=match,id=/\bid="([^"]+)"/.exec(attrs)?.[1],key=/data-campaign="([^"]+)"/.exec(attrs)?.[1];const e=new Element();e.tag=tag;if(key)e.dataset.campaign=key;if(id)nodes.set('#'+id,e);if(key)this.children.push(e);}}
  querySelector(selector){if(selector==='button:not(:disabled)')return this.querySelectorAll('button[data-launch]').find(n=>!n.disabled)??null;if(selector==='canvas')return null;if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector);}
  querySelectorAll(selector){const found=[];const visit=n=>{for(const c of n.children){if(selector==='[data-campaign]'&&c.dataset.campaign||selector==='button[data-launch]'&&c.tag==='button'&&c.dataset.launch)found.push(c);visit(c);}};visit(this);return found;}
  replaceChildren(...children){this.children=children;}append(...children){this.children.push(...children);}setAttribute(k,v){this.attributes[k]=v;}focus(){this.focused=true;}
  addEventListener(event,callback){this.handlers[event]=callback;}click(){if(!this.disabled)this.handlers.click?.();}
 }
 let controller,unmount;
 try{
  const output=join(directory,'campaign.mjs');await build({entryPoints:['apps/web/src/campaign-view.ts'],bundle:true,format:'esm',platform:'node',loader:{'.css':'empty'},outfile:output,logLevel:'silent',plugins:[{name:'original-viewport-fixture',setup(b){b.onResolve({filter:/terrain-view\.ts$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export function mountTerrain(root,controller){root.mountCount=(root.mountCount??0)+1;controller.setLocale(controller.state.locale);root.textContent="Original viewport fixture";return()=>{root.releaseCount=(root.releaseCount??0)+1;controller.cancelInteraction();root.textContent="";};}',loader:'js'}));}}]});
  globalThis.document={documentElement:{lang:''},createElement(tag){const e=new Element();e.tag=tag;return e;}};
  const {mountCampaign}=await import(pathToFileURL(output).href),calls=[];let plan=campaignPlan();
  const source=new File(['Original local asset'],'original.mix');
  controller=new TerrainController('en',()=>({dispose(){},async request(action){calls.push(action);if(action.type==='campaign-scan'){plan=campaignPlan(action.profile);return {type:'campaign-plan',plan};}if(action.type==='campaign-back')return {type:'campaign-plan',plan};if(action.type==='campaign-launch')return campaignFrame(calls.length,plan.profile,action.entryId,120,45);throw Error('fixture-action');}}));controller.resize(120,45);
  const root=new Element();unmount=mountCampaign(root,controller);
  const get=id=>nodes.get('#campaign-'+id),input=get('file-input');assert.equal(get('scan').disabled,true);input.files=[source];input.handlers.change();assert.equal(input.value,'');assert.equal(controller.state.files,1);
  get('scan').click();await settle();assert.equal(controller.state.phase,'choosing');assert.equal(calls[0].files[0].file,source);assert.equal(get('entries').children.length,2);
  const launch=get('entries').querySelectorAll('button[data-launch]')[1];assert.match(launch.attributes['aria-label'],/Soviet/);launch.click();await settle();assert.equal(controller.state.phase,'ready');assert.equal(get('chooser').hidden,true);assert.equal(get('viewport').textContent,'Original viewport fixture');assert.equal(get('viewport').mountCount,1,'synchronous controller notifications during viewport mount must not duplicate subscriptions or controls');
  await controller.backCampaigns();await settle();assert.equal(get('chooser').hidden,false);assert.equal(get('viewport').releaseCount,1,'cleanup notifications must not recursively release the mounted viewport');assert.equal(controller.state.files,1);assert.equal(calls.filter(a=>a.type==='campaign-scan').length,1);
  get('locale').value='zh-Hant';get('locale').handlers.change();assert.equal(document.documentElement.lang,'zh-Hant');assert.match(get('entries').querySelectorAll('button[data-launch]')[0].textContent,/預覽/);
  get('profile').value='yr';get('profile').handlers.change();assert.equal(controller.state.profile,'yr');assert.equal(controller.state.campaign,null);get('scan').click();await settle();assert.equal(controller.state.campaign.profile,'yr');assert.equal(controller.state.files,1);
  // A source label is a literal text node, not interpreted HTML.
  const changed=structuredClone(plan);changed.fingerprint='e'.repeat(64);changed.entries[0].title='<img src=x onerror=alert(1)>';changed.entries[1].status='unavailable';changed.entries[1].reasons=['source-missing:original.map'];controller.state={...controller.state,campaign:changed};controller.setLocale('en');
  assert.equal(get('entries').children[0].children.find(n=>n.tag==='h2').textContent,'<img src=x onerror=alert(1)>');assert.equal(get('entries').querySelectorAll('button[data-launch]')[1].disabled,true);
  get('clear').click();assert.equal(controller.state.files,0);assert.equal(get('scan').disabled,true);
 }finally{unmount?.();controller?.dispose();if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;await rm(directory,{recursive:true,force:true});}
});
