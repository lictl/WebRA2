// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded DOM-interface fixture. Native layout is measured separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountBattlefieldPanels } from '../../apps/web/src/battlefield-panels.ts';
class Node extends EventTarget {
  hidden=false; attributes=new Map<string,string>(); focused=0; value='';
  setAttribute(name:string,value:string){this.attributes.set(name,value);}
  focus(){this.focused++;}
}
function fixture(){const nodes=new Map<string,Node>();const host=new Node() as Node&{querySelector:(s:string)=>Node};host.querySelector=s=>{let n=nodes.get(s);if(!n){n=new Node();nodes.set(s,n);}return n;};const canvas=new Node();let paused=0;const release=mountBattlefieldPanels(host as unknown as HTMLElement,canvas as unknown as HTMLCanvasElement,()=>paused++);return {nodes,host,canvas,release,get paused(){return paused;},click:(id:string)=>nodes.get('#world-'+id)!.dispatchEvent(new Event('click'))};}
test('optional panels keep form values, pause explicitly and return keyboard focus to the map',()=>{
 const f=fixture();const orders=f.nodes.get('#world-orders-panel')!,saves=f.nodes.get('#world-saves-panel')!,diagnostics=f.nodes.get('#world-diagnostics-panel')!;assert.equal(orders.hidden,false);saves.value='saved local slot choice';
 for(let i=0;i<20;i++){f.click('open-saves');assert.equal(saves.hidden,false);assert.equal(orders.hidden,true);f.click('open-diagnostics');assert.equal(saves.hidden,true);assert.equal(diagnostics.hidden,false);f.click('return-diagnostics');assert.equal(orders.hidden,false);assert.equal(diagnostics.hidden,true);assert.equal(saves.value,'saved local slot choice');}
 assert.equal(f.paused,40);assert.equal(f.canvas.focused,20);assert.equal(f.nodes.get('#world-open-orders')!.attributes.get('aria-expanded'),'true');f.release();
});
test('Escape returns from an optional panel without cancelling or consuming battlefield Escape',()=>{
 const f=fixture();f.click('open-saves');const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'key',{value:'Escape'});f.host.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(f.canvas.focused,1);assert.equal(f.nodes.get('#world-orders-panel')!.hidden,false);
 const fieldEscape=new Event('keydown',{cancelable:true});Object.defineProperty(fieldEscape,'key',{value:'Escape'});f.host.dispatchEvent(fieldEscape);assert.equal(fieldEscape.defaultPrevented,false);
 f.release();const before=f.paused;f.click('open-saves');assert.equal(f.paused,before);assert.equal(f.nodes.get('#world-saves-panel')!.hidden,true);
});
