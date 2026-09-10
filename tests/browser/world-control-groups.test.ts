// SPDX-License-Identifier: GPL-3.0-or-later
// Original UI fixtures; no retail source data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldControlGroups, controlGroupShortcut, type ControlGroupContext } from '../../apps/web/src/world-control-groups.ts';
import { controlGroupText, worldText } from '../../apps/web/src/world-i18n.ts';
import { TerrainController } from '../../apps/web/src/terrain-controller.ts';
import type { TerrainPort } from '../../apps/web/src/terrain-bridge.ts';
import type { FrameResult } from '../../apps/web/src/terrain-protocol.ts';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { originalWorld } from './world-ui.fixture.ts';

function context():ControlGroupContext {
  const session=new WorldSession(originalWorld());
  return {scene:1,playerId:0,summary:session.summary,snapshot:session.snapshot()};
}
test('ten groups own bounded sorted unique IDs and retain them across ordinary snapshot updates',()=>{
  const groups=new WorldControlGroups(),c=context();
  for(let slot=0;slot<10;slot++){
    assert.equal(groups.use(c,slot,true,[1,1,2,3,999])!.feedback.kind,'assigned');
    const first=groups.use(c,slot,false,[])!;assert.deepEqual(first.ids,[1]);first.ids!.push(999);
    assert.deepEqual(groups.use({...c,snapshot:{...c.snapshot,nextTick:1}},slot,false,[])!.ids,[1]);
  }
  assert.equal(groups.use(c,9,true,[])!.feedback.kind,'cleared');
  assert.equal(groups.use(c,9,false,[])!.feedback.kind,'empty');
  for(const slot of [-1,10,1.5,NaN])assert.equal(groups.use(c,slot,true,[1]),null);
  for(const ids of [new Array(2),[NaN],[0],Array(65).fill(1)])assert.equal(groups.use(c,0,true,ids)!.feedback.kind,'unavailable');
  assert.deepEqual(groups.use(c,0,false,[])!.ids,[1]);
});
test('recall revalidates current health, ownership, supported movement and source identity',()=>{
  for(const mutate of [
    (c:ControlGroupContext)=>({...c,snapshot:{...c.snapshot,actors:c.snapshot.actors.map(a=>a.id===1?{...a,health:0}:a)}}),
    (c:ControlGroupContext)=>({...c,summary:{...c.summary,actors:c.summary.actors.map(a=>a.id===1?{...a,owner:1}:a)}}),
    (c:ControlGroupContext)=>({...c,summary:{...c.summary,actors:c.summary.actors.map(a=>a.id===1?{...a,movable:false}:a)}}),
    (c:ControlGroupContext)=>({...c,snapshot:{...c.snapshot,modelHash:'f'.repeat(64)}})
  ]){
    const groups=new WorldControlGroups(),c=context();groups.use(c,2,true,[1]);
    const recalled=groups.use(mutate(c),2,false,[])!;assert.equal(recalled.feedback.kind,'unavailable');assert.equal(recalled.ids,null);
  }
});
test('scene, model and player changes clear every group, including switching back to an old identity',()=>{
  const base=context();
  for(const next of [{...base,scene:2},{...base,playerId:1},{...base,summary:{...base.summary,modelHash:'e'.repeat(64)},snapshot:{...base.snapshot,modelHash:'e'.repeat(64)}}]){
    const groups=new WorldControlGroups();for(let i=0;i<10;i++)groups.use(base,i,true,[1]);
    assert.equal(groups.use(next,1,false,[])!.feedback.kind,'empty');
    for(let i=0;i<10;i++)assert.equal(groups.use(base,i,false,[])!.feedback.kind,'empty');
  }
  const groups=new WorldControlGroups();groups.use(base,0,true,[1]);groups.sync(null);
  assert.equal(groups.use(base,0,false,[])!.feedback.kind,'empty');
  groups.use(base,0,true,[1]);groups.clear();assert.equal(groups.use(base,0,false,[])!.feedback.kind,'empty');
});
test('full64-actor groups retain all members without allowing a65th',()=>{
  const c=context(),info=c.summary.actors[0]!,actor=c.snapshot.actors[0]!;
  c.summary={...c.summary,actors:Array.from({length:65},(_,i)=>({...info,id:i+1}))};
  c.snapshot={...c.snapshot,actors:Array.from({length:65},(_,i)=>({...actor,id:i+1}))};
  const ids=Array.from({length:64},(_,i)=>64-i),groups=new WorldControlGroups();groups.use(c,5,true,ids);ids.fill(999);
  assert.deepEqual(groups.use(c,5,false,[])!.ids,Array.from({length:64},(_,i)=>i+1));
  assert.equal(groups.use(c,5,true,Array.from({length:65},(_,i)=>i+1))!.feedback.kind,'unavailable');
  assert.equal(groups.use(c,5,false,[])!.ids!.length,64);
});
test('only focused ready canvas digits and deliberate Ctrl combinations are shortcuts',()=>{
  const base={key:'1',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false};
  for(let slot=0;slot<10;slot++)for(const assign of [false,true])assert.deepEqual(controlGroupShortcut({...base,key:String(slot),ctrlKey:assign},true,true),{slot,assign});
  for(const key of ['s','Escape','F1','!','ArrowLeft','01',''])assert.equal(controlGroupShortcut({...base,key},true,true),null);
  for(const key of ['metaKey','altKey','shiftKey','repeat','isComposing'])for(const ctrlKey of [false,true])assert.equal(controlGroupShortcut({...base,[key]:true,ctrlKey},true,true),null);
  assert.equal(controlGroupShortcut(base,false,true),null);assert.equal(controlGroupShortcut(base,true,false),null);
  for(const kind of ['assigned','recalled','empty','cleared','unavailable'] as const){
    const feedback={kind,slot:0,count:2};assert.match(controlGroupText('en',feedback),/Group 0/);assert.match(controlGroupText('zh-Hant',feedback),/編組 0/);
  }
  assert.match(worldText('en','controlGroupsHelp'),/Control on Mac/);assert.match(worldText('zh-Hant','controlGroupsHelp'),/Control/);
});

function harness(){
  const sessions:WorldSession[]=[];
  const controller=new TerrainController('en',()=>{
    const session=new WorldSession(originalWorld());sessions.push(session);
    const frame=():FrameResult=>({type:'frame',frameId:session.revision+1,summary:{world:session.summary},world:session.snapshot(),camera:{width:240,height:160,zoom:1,cameraX:0,cameraY:0}} as FrameResult);
    const port:TerrainPort={dispose(){},async request(action){if(action.type==='load')return frame();if(action.type.startsWith('world-'))return session.act(action as Parameters<WorldSession['act']>[0])??frame();throw Error('unexpected original fixture action');}};
    return port;
  });
  controller.resize(240,160);controller.select([new File(['original'],'fixture.mix')]);return {controller,sessions};
}
test('controller group recall emits no commands and equivalent orders retain exact save/replay semantics',async()=>{
  const {controller,sessions}=harness();await controller.load();const session=sessions[0]!,direct=new WorldSession(originalWorld());
  const before=session.act({type:'world-replay-export'})!.text;
  assert(controller.controlGroup(1,true));controller.clearSelection();assert(controller.controlGroup(1,false));
  assert.deepEqual(controller.state.selectedEntities,[1]);assert.equal(session.act({type:'world-replay-export'})!.text,before);
  await controller.order(2,3);direct.act({type:'world-orders',order:'move',entityIds:[1],playerId:0,expectedRevision:0,x:2,y:3});
  await controller.step();direct.act({type:'world-step',ticks:1});
  controller.clearSelection();controller.controlGroup(1,false);await controller.order();direct.act({type:'world-orders',order:'stop',entityIds:[1],playerId:0,expectedRevision:direct.revision});
  assert.equal(session.act({type:'world-save'})!.text,direct.act({type:'world-save'})!.text);
  assert.equal(session.act({type:'world-replay-export'})!.text,direct.act({type:'world-replay-export'})!.text);
  controller.dispose();
});
test('controller empty recall, successful restore, player/source replacement and busy gates are explicit',async()=>{
  const {controller}=harness();await controller.load();controller.controlGroup(2,true);
  controller.controlGroup(9,false);assert.deepEqual(controller.state.selectedEntities,[1]);assert.equal(controller.state.controlGroupFeedback!.kind,'empty');
  controller.setLocale('zh-Hant');controller.clearSelection();controller.controlGroup(2,false);assert.deepEqual(controller.state.selectedEntities,[1]);
  const save=(await controller.exportWorld('save'))!;
  await controller.importWorld(new File([save.text],'original-save.json'),'save');
  controller.controlGroup(2,false);assert.equal(controller.state.controlGroupFeedback!.kind,'empty');
  controller.selectEntity(1);controller.controlGroup(2,true);controller.setPlayer(1);controller.setPlayer(0);controller.controlGroup(2,false);assert.equal(controller.state.controlGroupFeedback!.kind,'empty');
  controller.selectEntity(1);controller.controlGroup(2,true);
  controller.state={...controller.state,busy:true,verifyingReplay:true};const before=controller.state;
  assert(!controller.controlGroup(2,false));assert(!controller.controlGroup(2,true));assert.equal(controller.state,before);
  controller.cancel();assert.equal(controller.state.files,1);await controller.load();controller.controlGroup(2,false);assert.equal(controller.state.controlGroupFeedback!.kind,'empty');
  controller.controlGroup(2,true);controller.leave();await controller.load();controller.controlGroup(2,false);assert.equal(controller.state.controlGroupFeedback!.kind,'empty');
  controller.controlGroup(2,true);controller.select([new File(['replacement'],'replacement.mix')]);await controller.load();controller.controlGroup(2,false);assert.equal(controller.state.controlGroupFeedback!.kind,'empty');
  controller.dispose();
});
