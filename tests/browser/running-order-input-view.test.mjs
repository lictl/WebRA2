// SPDX-License-Identifier: GPL-3.0-or-later
// Original minimal DOM fixture; native browser activation has a separate gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runningFixture } from './running-order-input.fixture.ts';
import { worldText } from '../../apps/web/src/world-i18n.ts';
import { worldTemplate } from '../../apps/web/src/world-template.ts';

test('mounted busy controls stay disabled; the canvas Stop refusal stays readable until another user action',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'webra2-running-input-')),nodes=new Map(),priorDocument=globalThis.document,priorInterval=globalThis.setInterval;
  class Element {
    children=[];handlers={};value='';dataset={};hidden=false;disabled=false;isContentEditable=false;
    set innerHTML(value){this.firstElementChild=new Element();}
    querySelector(selector){if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector);}
    querySelectorAll(){return [];}
    before(){} after(){} remove(){} setAttribute(name,value){this[name]=value;} focus(){globalThis.document.activeElement=this;}
    replaceChildren(...children){this.children=children;} append(...children){for(const child of children){this.children=this.children.filter(c=>c!==child);this.children.push(child);child.parentElement=this;}} prepend(...children){for(const child of [...children].reverse()){this.children=this.children.filter(c=>c!==child);this.children.unshift(child);child.parentElement=this;}}
    get options(){return this.children;}
    addEventListener(event,callback){this.handlers[event]=callback;}removeEventListener(event){delete this.handlers[event];}
  }
  let unmount,c;
  try{
    const output=join(directory,'view.mjs');await build({entryPoints:['apps/web/src/world-view.ts'],bundle:true,format:'esm',platform:'node',loader:{'.css':'empty'},outfile:output,logLevel:'silent'});
    globalThis.document={createElement(){return new Element();},hidden:false,addEventListener(){},removeEventListener(){}};
    globalThis.setInterval=()=>0; // The test explicitly releases every worker tick.
    const {mountWorld}=await import(pathToFileURL(output).href),fixture=await runningFixture();c=fixture.controller;
    const viewRoot=new Element();unmount=mountWorld(viewRoot,c);const w=fixture.workers[0],canvas=viewRoot.querySelector('#terrain-canvas'),notice=nodes.get('#world-notice');
    c.setRunning(true);w.holdType='world-step';const pending=c.step();
    for(const id of ['move','stop'])assert.equal(nodes.get('#world-'+id).disabled,true);
    assert.equal(nodes.get('#world-run').disabled,false);assert.equal(nodes.get('#world-x').disabled,false);
    const sent=w.sent.length;viewRoot.handlers.keydown({key:'s',target:canvas,ctrlKey:false,metaKey:false,altKey:false,repeat:false,preventDefault(){}});
    assert.equal(w.sent.length,sent);assert.equal(notice.textContent,worldText('en','worldControlsBusy'));
    w.release();await pending;await c.step();assert.equal(notice.textContent,worldText('en','worldControlsBusy'));
    c.setLocale('zh-Hant');assert.equal(notice.textContent,worldText('zh-Hant','worldControlsBusy'));
    nodes.get('#world-run').handlers.click();assert.equal(c.state.running,false);assert.equal(notice.textContent,worldText('zh-Hant','worldPaused'));
    nodes.get('#world-stop').handlers.click();for(let i=0;i<10&&c.state.busy;i++)await new Promise(r=>setImmediate(r));
    assert.equal(notice.textContent,worldText('zh-Hant','worldOrdersQueued'));assert.equal(c.state.frame.world.queuedCommands,1);
    for(const locale of ['en','zh-Hant'])assert.notEqual(worldText(locale,'orderTiming'),worldText(locale,'unknown'));
    for(const id of ['move','stop','picked','attack'])assert.match(worldTemplate,new RegExp('id="world-'+id+'"[^>]+aria-describedby="world-order-timing"'));
    assert.match(worldTemplate,/id="world-order-timing" data-world="orderTiming"/);
  }finally{unmount?.();c?.dispose();globalThis.setInterval=priorInterval;if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;await rm(directory,{recursive:true,force:true});}
});
