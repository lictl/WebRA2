// SPDX-License-Identifier: GPL-3.0-or-later
// Original minimal DOM fixture. This tests mounted event wiring, not browser rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ordinaryFixture } from '../sim/ordinary-infantry-fixture.ts';
import { compileOrdinaryInfantryBridge } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { bindOrdinaryInfantryWorld } from '../../packages/sim/src/source-infantry-world.ts';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { TerrainController } from '../../apps/web/src/terrain-controller.ts';
test('manual target choice survives subscription updates until a new enemy inspection',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'webra2-target-view-')),nodes=new Map(),priorDocument=globalThis.document;
 class Element {
  children=[];handlers={};value='';dataset={};hidden=false;
  set innerHTML(value){this.firstElementChild=new Element();}
  querySelector(selector){if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector);}
  querySelectorAll(){return [];}
  before(){} remove(){} setAttribute(){}
  replaceChildren(...children){this.children=children;} append(...children){this.children.push(...children);}
  get options(){return this.children;}
  addEventListener(event,callback){this.handlers[event]=callback;}removeEventListener(event){delete this.handlers[event];}
 }
 let unmount,controller;
 try{
  const output=join(directory,'view.mjs');
  await build({entryPoints:['apps/web/src/world-view.ts'],bundle:true,format:'esm',platform:'node',loader:{'.css':'empty'},outfile:output,logLevel:'silent'});
  globalThis.document={createElement(){return new Element();},hidden:false,addEventListener(){},removeEventListener(){}};
  const {mountWorld}=await import(pathToFileURL(output).href),f=ordinaryFixture({sharedTarget:true}),bridge=compileOrdinaryInfantryBridge(f);
  const session=new WorldSession({...f.world,model:bindOrdinaryInfantryWorld(bridge,f.world.model)});
  controller=new TerrainController('en');
  controller.state={...controller.state,phase:'ready',playerId:0,selectedEntity:1,selectedEntities:[1],selection:{kind:'object',object:{id:'object-1'}},frame:{summary:{world:session.summary},world:session.snapshot()}};
  unmount=mountWorld(new Element(),controller);const target=nodes.get('#world-attack-target');assert.equal(target.value,'2');
  target.value='3';target.handlers.change();assert.equal(target.value,'3');assert.deepEqual(controller.state.selectedEntities,[1]);
  controller.selectEntities([1]);assert.equal(target.value,'3');
  controller.state={...controller.state,selection:{kind:'object',object:{id:'object-1'}}};controller.selectEntities([1]);assert.equal(target.value,'2');
  target.value='3';target.handlers.change();controller.clearSelection(false);assert.equal(target.value,'3');
 }finally{unmount?.();controller?.dispose();if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;await rm(directory,{recursive:true,force:true});}
});
