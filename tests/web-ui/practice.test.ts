// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PracticeModel } from '../../apps/web/src/practice-model.ts';
import { PracticeController } from '../../apps/web/src/practice-controller.ts';
import { PracticeBridge, type PracticePort, type PracticeResult } from '../../apps/web/src/practice-bridge.ts';
import { validAction, validSnapshot, type PracticeAction, SAVE_BYTES } from '../../apps/web/src/practice-protocol.ts';
import type { PracticeStorage } from '../../apps/web/src/practice-storage.ts';
import { canonicalText } from '../../packages/sim/src/index.ts';
const digest = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function port(): PracticePort { const model = new PracticeModel(digest); return { request: action => model.act(action), dispose() {} }; }
const emptyStorage: PracticeStorage = { async read() { return null; }, async write() {}, async remove() {} };
test('practice commands, delayed combat and state hash reflect actual synthetic simulation', async () => {
  const model = new PracticeModel(digest); const initial = await model.act({ type: 'init', scenario: 'relay' });
  assert.equal(initial.snapshot.nextTick, 0); assert.equal(validSnapshot(initial.snapshot), true);
  let result = await model.act({ type: 'move', entityId: 1, x: 4, y: 3 });
  assert.equal(result.snapshot.pending, 1); assert.equal(result.snapshot.units[0]!.x, 2);
  result = await model.act({ type: 'step', ticks: 2 }); assert.equal(result.snapshot.units[0]!.x, 4);
  result = await model.act({ type: 'attack', entityId: 1, targetId: 3 }); assert.equal(result.snapshot.pending, 1);
  result = await model.act({ type: 'step', ticks: 1 }); assert.equal(result.snapshot.pending, 1); assert.equal(result.snapshot.units.find(u => u.id === 3)!.hp, 12);
  result = await model.act({ type: 'step', ticks: 2 }); assert.ok(result.snapshot.units.find(u => u.id === 3)!.hp < 12);
  const raw = JSON.parse(result.snapshot.checkpoint); assert.ok(raw.simulation.rngStates.simulation.draws > 0);
  assert.equal(result.snapshot.hash, createHash('sha256').update(canonicalText(raw.simulation)).digest('hex'));
  assert.equal((await model.act({ type: 'verify' })).verified, true);
});
test('save/restore at command, impact, RNG and reinforcement boundaries matches uninterrupted and replay paths', async () => {
  for (const boundary of [0, 1, 3, 4, 5, 23, 24, 25]) {
    const control = new PracticeModel(digest); await control.act({ type: 'init', scenario: 'crossfire' });
    await control.act({ type: 'move', entityId: 1, x: 4, y: 3 });
    for (let i = 0; i < boundary; i++) await control.act({ type: 'step', ticks: 1 });
    const checkpoint = (await control.act({ type: 'verify' })).snapshot;
    const restored = new PracticeModel(digest); assert.equal((await restored.act({ type: 'restore', text: checkpoint.checkpoint })).snapshot.hash, checkpoint.hash);
    for (let i = boundary; i < 30; i++) {
      const a = await control.act({ type: 'step', ticks: 1 }), b = await restored.act({ type: 'step', ticks: 1 });
      assert.equal(a.snapshot.hash, b.snapshot.hash); assert.equal(a.snapshot.checkpoint, b.snapshot.checkpoint);
    }
    assert.equal((await control.act({ type: 'verify' })).snapshot.hash, (await restored.act({ type: 'verify' })).snapshot.hash);
  }
});
test('step grouping cannot change enemy decisions and invalid identity/policy/shape restore preserves state', async () => {
  const a = new PracticeModel(digest), b = new PracticeModel(digest); await a.act({ type: 'init', scenario: 'relay' }); await b.act({ type: 'init', scenario: 'relay' });
  for (let i = 0; i < 5; i++) await a.act({ type: 'step', ticks: 4 });
  for (let i = 0; i < 20; i++) await b.act({ type: 'step', ticks: 1 });
  const before = (await a.act({ type: 'verify' })).snapshot;
  assert.equal(before.hash, (await b.act({ type: 'verify' })).snapshot.hash);
  for (const mutate of [(s: any) => { s.scenario = 'crossfire'; }, (s: any) => { s.simulation.simulationRulesVersion = 'retail'; }, (s: any) => { s.simulation.contentIdentity.rulesSha256 = '0'.repeat(64); }, (s: any) => { s.simulation.state.width = 13; }]) {
    const save = JSON.parse(before.checkpoint); mutate(save); await assert.rejects(a.act({ type: 'restore', text: JSON.stringify(save) })); assert.equal((await a.act({ type: 'verify' })).snapshot.hash, before.hash);
  }
  await assert.rejects(a.act({ type: 'restore', text: '{"kind":1,"kind":2}' }));
});
test('protocol refuses oversized, sparse, boxed and payload-bearing messages', async () => {
  assert.equal(validAction({ type: 'step', ticks: 5 }), false); assert.equal(validAction({ type: 'verify', bytes: new Blob() }), false);
  assert.equal(validAction({ type: 'restore', text: 'a'.repeat(SAVE_BYTES + 1) }), false);
  const snapshot = (await new PracticeModel(digest).act({ type: 'init', scenario: 'relay' })).snapshot;
  assert.equal(validSnapshot(snapshot), true);
  const extra = structuredClone(snapshot); Object.assign(extra.units, { payload: new Blob() }); assert.equal(validSnapshot(extra), false);
  const sparse = structuredClone(snapshot); delete sparse.units[0]; assert.equal(validSnapshot(sparse), false);
  assert.equal(validSnapshot({ ...snapshot, outcome: new String('active') }), false);
  assert.equal(validSnapshot({ ...snapshot, width: 400 }), false);
});
test('controller cancellation ignores stale completion and restores only the last acknowledged checkpoint', async () => {
  let delayed: ((value: PracticeResult) => void) | undefined, pendingAction: PracticeAction | undefined; let calls = 0;
  const initialPort = port(), recovered: PracticeAction[] = [];
  const controller = new PracticeController('en', () => ++calls === 1 ? { request(action, signal) { if (action.type === 'step') { pendingAction = action; return new Promise(resolve => { delayed = resolve; }); } return initialPort.request(action, signal); }, dispose() {} } : { ...port(), async request(action, signal) { recovered.push(action); return second.request(action, signal); } }, emptyStorage);
  const second = port(); await controller.start(); const first = controller.state.snapshot!;
  const pending = controller.step(); assert.equal(controller.state.busy, true); controller.cancel(); assert.equal(controller.state.notice, 'cancelled');
  delayed!(await initialPort.request(pendingAction!, new AbortController().signal)); await pending;
  assert.equal(controller.state.snapshot!.hash, first.hash); assert.equal(controller.state.busy, false);
  await controller.step(); assert.deepEqual(recovered.map(a => a.type), ['restore', 'step']); assert.equal(controller.state.snapshot!.nextTick, 1);
  controller.dispose();
});
test('controller persists fixed slots, rejects file size before read, retains state on quota/malformed load, pauses on visibility', async () => {
  const slots = new Map<number, string>(); let quota = false, reads = 0;
  const storage: PracticeStorage = { async write(slot, text) { if (quota) throw new Error('quota'); slots.set(slot, text); }, async read(slot) { return slots.get(slot) ?? null; }, async remove(slot) { slots.delete(slot); } };
  const controller = new PracticeController('zh-Hant', port, storage); await controller.start(); await controller.step(); const hash = controller.state.snapshot!.hash;
  controller.setSlot(2); controller.setRunning(true); await controller.save(); assert.equal(controller.state.running, false); assert.equal(controller.state.notice, 'saved');
  await controller.step(); await controller.load(); assert.equal(controller.state.snapshot!.hash, hash);
  quota = true; await controller.save(); assert.equal(controller.state.notice, 'quota'); assert.equal(controller.state.snapshot!.hash, hash);
  await controller.importFile({ size: SAVE_BYTES + 1, async text() { reads++; return ''; } }); assert.equal(reads, 0); assert.equal(controller.state.notice, 'invalid');
  slots.set(2, '{}'); await controller.load(); assert.equal(controller.state.notice, 'invalid'); assert.equal(controller.state.snapshot!.hash, hash);
  controller.setRunning(true); controller.hidden(); assert.equal(controller.state.running, false); assert.equal(controller.state.notice, 'hidden');
  await controller.remove(); assert.equal(controller.state.notice, 'deleted'); await controller.load(); assert.equal(controller.state.notice, 'empty'); controller.dispose();
});
class FakeWorker extends EventTarget {
  terminated = 0; sent: unknown[] = [];
  postMessage(value: unknown) { this.sent.push(value); }
  terminate() { this.terminated++; }
  reply(value: unknown) { this.dispatchEvent(new MessageEvent('message', { data: value })); }
}
test('worker bridge permits one pending request, ignores stale IDs and terminates malformed/cancelled jobs', async () => {
  const worker = new FakeWorker(), bridge = new PracticeBridge(worker), abort = new AbortController();
  const pending = bridge.request({ type: 'init', scenario: 'relay' }, abort.signal);
  await assert.rejects(bridge.request({ type: 'verify' }, abort.signal), /unavailable/);
  worker.reply({ id: 2, bad: true }); const result = await new PracticeModel(digest).act({ type: 'init', scenario: 'relay' });
  worker.reply({ version: 1, id: 1, ok: true, ...result }); assert.equal((await pending).snapshot.hash, result.snapshot.hash);
  const bad = bridge.request({ type: 'verify' }, abort.signal); worker.reply({ version: 1, id: 2, ok: true, snapshot: { units: [null] }, verified: true }); await assert.rejects(bad, /invalid/); assert.equal(worker.terminated, 1);
  const another = new FakeWorker(), other = new PracticeBridge(another); const cancelled = other.request({ type: 'verify' }, abort.signal); abort.abort(); await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(another.terminated, 1);
});
