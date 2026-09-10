// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { runningFixture } from './running-order-input.fixture.ts';

test('busy order rejection and accepted orders remain acknowledged after automatic ticks, with no deferred envelope', async()=>{
  const {controller:c,workers}=await runningFixture(),w=workers[0]!;
  try {
    c.setRunning(true);w.holdType='world-step';const pending=c.step();
    assert(c.state.busy);assert.equal(c.canOrder(),false);
    const actions=w.sent.length;await c.order(6,3);
    assert.equal(c.state.worldNotice,'worldControlsBusy');assert.equal(w.sent.length,actions);
    w.release();await pending;
    assert.equal(c.state.worldNotice,'worldControlsBusy');assert.equal(c.state.frame!.world!.queuedCommands,0);
    await c.step(2);assert.equal(c.state.worldNotice,'worldControlsBusy');
    const revision=c.state.frame!.world!.revision;
    await c.order(6,3);assert.equal(c.state.worldNotice,'worldOrdersQueued');
    assert.deepEqual(w.sent.at(-1),{type:'world-orders',order:'move',playerId:0,entityIds:[1],expectedRevision:revision,x:6,y:3});
    await c.step();assert.equal(c.state.worldNotice,'worldOrdersQueued');assert.equal(c.state.frame!.world!.actors[0]!.goalX,6);
    c.setRunning(false);assert.equal(c.state.worldNotice,'worldPaused');
    await c.order();await c.step();assert.equal(c.state.worldNotice,'worldOrdersQueued');assert.equal(c.state.frame!.world!.actors[0]!.goalX,null);
  }finally{c.dispose();}
});

test('selection, player, cancel and replacement never transfer a refused order',async()=>{
  const {controller:c,workers}=await runningFixture(),w=workers[0]!;
  try{
    c.setRunning(true);w.holdType='world-step';const pending=c.step();await c.order();
    c.clearSelection();w.release();await pending;
    assert.equal(c.state.worldNotice,'worldSelectionCleared');assert.deepEqual(c.state.selectedEntities,[]);
    c.setPlayer(1);c.selectEntity(2);await c.step();assert.equal(c.state.frame!.world!.queuedCommands,0);
    c.setPlayer(0);c.selectEntity(1);w.holdType='world-step';const old=c.step();await c.order(6,3);c.cancel();await old;
    assert.equal(c.state.files,1);assert.equal(c.state.frame,null);assert.equal(c.state.phase,'cancelled');
    await c.load();const fresh=c.state.frame!.world!.stateHash;w.release();await Promise.resolve();
    assert.equal(c.state.worldNotice,'worldPaused');assert.equal(c.state.frame!.world!.stateHash,fresh);
    assert(workers.every(worker=>worker.sent.every(a=>a.type!=='world-orders')));
  }finally{c.dispose();}
});

test('rejection, restore and transport failure retain authoritative recovery rather than an earlier busy acknowledgement',async()=>{
  const {controller:c,workers,saved}=await runningFixture(),w=workers[0]!;
  try{
    await c.saveWorld();const initial=c.state.frame!.world!.stateHash;assert(saved.has(1));
    c.setRunning(true);await c.order(511,511);assert.equal(c.state.worldNotice,'worldGroupBlocked');assert.equal(c.state.running,false);
    await c.step();assert.equal(c.state.worldNotice,'worldGroupBlocked');assert.equal(c.state.frame!.world!.queuedCommands,0);
    w.holdType='world-restore';const restored=c.loadWorld();
    for(let i=0;i<10&&!w.held;i++)await new Promise<void>(r=>setImmediate(r));
    assert(w.held);await c.order(6,3);assert.equal(c.state.worldNotice,'worldControlsBusy');w.release();await restored;
    assert.equal(c.state.worldNotice,'worldLoaded');assert.equal(c.state.frame!.world!.stateHash,initial);assert.deepEqual(c.state.selectedEntities,[]);
    c.selectEntity(1);w.holdType='world-step';const failed=c.step();await c.order(6,3);w.dispatchEvent(new Event('error'));await failed;
    assert.equal(c.state.phase,'failed');assert.equal(c.state.frame,null);assert.equal(c.state.worldNotice,'worldPaused');assert.equal(c.state.files,1);
  }finally{c.dispose();}
});
