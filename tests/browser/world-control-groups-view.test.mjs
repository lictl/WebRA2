// SPDX-License-Identifier: GPL-3.0-or-later
// Original minimal DOM fixture. This tests mounted event wiring, not browser rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { TerrainController } from '../../apps/web/src/terrain-controller.ts';
import { originalWorld } from './world-ui.fixture.ts';
test('mounted group keys require canvas focus, preserve forms/browser combinations and leave replay cancellation visible',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'webra2-group-view-')),nodes=new Map(),priorDocument=globalThis.document;
 class Element {
  children=[];handlers={};value='';dataset={};hidden=false;
  set innerHTML(value){this.firstElementChild=new Element();}
  querySelector(selector){if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector);}
  querySelectorAll(){return [];}
  before(){} after(){} remove(){} setAttribute(name,value){this[name]=value;} focus(){globalThis.document.activeElement=this;}
  replaceChildren(...children){this.children=children;} append(...children){for(const child of children){this.children=this.children.filter(c=>c!==child);this.children.push(child);child.parentElement=this;}} prepend(...children){for(const child of [...children].reverse()){this.children=this.children.filter(c=>c!==child);this.children.unshift(child);child.parentElement=this;}}
  get options(){return this.children;}
  addEventListener(event,callback){this.handlers[event]=callback;}removeEventListener(event){delete this.handlers[event];}
 }
 let unmount,controller;
 try{
  const output=join(directory,'view.mjs');
  await build({entryPoints:['apps/web/src/world-view.ts'],bundle:true,format:'esm',platform:'node',loader:{'.css':'empty'},outfile:output,logLevel:'silent'});
  globalThis.document={createElement(){return new Element();},hidden:false,addEventListener(){},removeEventListener(){}};
  const {mountWorld}=await import(pathToFileURL(output).href);
  const session=new WorldSession(originalWorld());
  controller=new TerrainController('en');
  controller.state={...controller.state,phase:'ready',playerId:0,selectedEntity:1,selectedEntities:[1],selection:{kind:'object',object:{id:'object-1'}},frame:{summary:{world:session.summary},world:session.snapshot()}};
  unmount=mountWorld(new Element(),controller);const canvas=nodes.get('#terrain-canvas');canvas.focus();
  const send=(extra={})=>{let prevented=false;canvas.handlers.keydown({key:'1',target:canvas,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,preventDefault(){prevented=true;},...extra});return prevented;};
  const initial=session.act({type:'world-replay-export'}).text;
  assert(send({ctrlKey:true}));assert.match(nodes.get('#world-group-notice').textContent,/Group 1: assigned 1/);
  controller.clearSelection();assert(send());assert.deepEqual(controller.state.selectedEntities,[1]);assert.match(nodes.get('#world-group-notice').textContent,/selected 1/);
  for(const extra of [{metaKey:true},{altKey:true},{shiftKey:true},{repeat:true},{isComposing:true},{key:'F1'},{target:nodes.get('#world-unit')}])assert(!send(extra));
  nodes.get('#world-unit').focus();assert(!send());canvas.focus();canvas.isContentEditable=true;assert(!send());canvas.isContentEditable=false;
  controller.setLocale('zh-Hant');assert.match(nodes.get('#world-group-notice').textContent,/編組 1/);
  assert(send({key:'9'}));assert.match(nodes.get('#world-group-notice').textContent,/尚未設定/);assert.deepEqual(controller.state.selectedEntities,[1]);
  controller.clearSelection();assert(send({ctrlKey:true}));assert.match(nodes.get('#world-group-notice').textContent,/已清除編組 1/);
  controller.selectEntity(1);assert(send({ctrlKey:true}));
  controller.state={...controller.state,busy:true,verifyingReplay:true,worldNotice:'worldVerifying'};controller.setLocale('en');
  assert(!send());assert(!send({ctrlKey:true}));assert.equal(nodes.get('#world-cancel-replay').hidden,false);assert.match(nodes.get('#world-notice').textContent,/Verifying/);
  nodes.get('#world-open-diagnostics').handlers.click();nodes.get('#world-return-diagnostics').handlers.click();assert(!send());assert.equal(nodes.get('#world-cancel-replay').hidden,false);
  assert.equal(session.act({type:'world-replay-export'}).text,initial);
 }finally{unmount?.();controller?.dispose();if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;await rm(directory,{recursive:true,force:true});}
});
