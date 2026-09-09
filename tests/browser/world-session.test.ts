// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldSession } from '../../apps/web/src/world-session.ts';
import { validWorldAction, validWorldSnapshot, validWorldSummary, WORLD_UI } from '../../apps/web/src/world-protocol.ts';
import { originalWorld } from './world-ui.fixture.ts';
const move = (x = 6, y = 3) => ({ type: 'world-order' as const, order: 'move' as const, playerId: 0, entityId: 1, x, y });
test('world UI session derives authoritative orders, detours, ownership and bounded render snapshots', () => {
  const session = new WorldSession(originalWorld());
  assert(validWorldSummary(session.summary)); assert(validWorldSnapshot(session.snapshot(), session.summary));
  assert.equal(session.summary.actors[0]!.objectId, 'object-0');
  const before = session.snapshot(); assert.throws(() => session.act({ ...move(), entityId: 2 }), /not-owner/); assert.throws(() => session.act({ ...move(), entityId: 3 }), /immovable/); assert.deepEqual(session.snapshot(), before);
  session.act(move()); assert.equal(session.snapshot().nextTick, 0); assert.equal(session.snapshot().queuedCommands, 1);
  session.act({ type: 'world-step', ticks: 1 }); const first = session.snapshot();
  assert.equal(first.actors[0]!.progress, 128); assert.equal(first.actors[0]!.x, 1); assert(first.actors[0]!.nextX !== 3 || first.actors[0]!.nextY !== 3);
  for (let i = 0; i < 5; i++) session.act({ type: 'world-step', ticks: 4 });
  const actor = session.snapshot().actors[0]!; assert.equal(actor.x, 6); assert.equal(actor.y, 3); assert.equal(actor.goalX, null);
  assert.throws(() => session.act({ type: 'world-step', ticks: 5 }), /action/);
});
test('moving save restore continues identically, resets recording, preserves command sequence and replay terminal hash', () => {
  const a = new WorldSession(originalWorld()); a.act(move()); a.act({ type: 'world-step', ticks: 1 });
  const saved = a.act({ type: 'world-save' })!; assert(saved.text);
  const b = new WorldSession(originalWorld()); b.act({ type: 'world-restore', text: saved.text });
  assert.equal(b.snapshot().stateHash, a.snapshot().stateHash);
  for (const session of [a, b]) { session.act(move(1, 3)); session.act({ type: 'world-step', ticks: 1 }); session.act({ type: 'world-order', playerId: 0, entityId: 1, order: 'stop' }); session.act({ type: 'world-step', ticks: 1 }); }
  assert.equal(b.snapshot().stateHash, a.snapshot().stateHash); assert.equal(a.snapshot().actors[0]!.goalX, null);
  const replay = b.act({ type: 'world-replay-export' })!, before = a.snapshot();
  const verified = a.act({ type: 'world-replay-validate', text: replay.text! })!;
  assert.equal(verified.stateHash, b.snapshot().stateHash); assert.deepEqual(a.snapshot(), before);
});
test('invalid, duplicate-key and mismatched documents cannot replace a live session', () => {
  const session = new WorldSession(originalWorld()); session.act(move()); const before = session.snapshot(), save = session.act({ type: 'world-save' })!;
  const wrong = JSON.parse(save.text!); wrong.state.modelSha256 = 'f'.repeat(64);
  for (const text of ['{', JSON.stringify(wrong), '{"a":1,"a":2}', 'x'.repeat(WORLD_UI.documentBytes + 1)]) { assert.throws(() => session.act({ type: 'world-restore', text })); assert.deepEqual(session.snapshot(), before); }
  const replay = JSON.parse(session.act({ type: 'world-replay-export' })!.text!); replay.finalStateSha256 = 'f'.repeat(64);
  assert.throws(() => session.act({ type: 'world-replay-validate', text: JSON.stringify(replay) })); assert.deepEqual(session.snapshot(), before);
});
test('metadata owns descriptor inputs and rejects row/ID joins and covert wire objects', () => {
  const prepared = originalWorld(), session = new WorldSession(prepared);
  (prepared.players[0] as { name: string }).name = 'changed'; assert.equal(session.summary.players[0]!.name, 'Original player');
  const bad = originalWorld(); assert.throws(() => new WorldSession({ ...bad, placements: [...bad.placements].reverse() }), /placement-join/);
  const snapshot = session.snapshot(), sparse = structuredClone(snapshot); delete sparse.actors[0]; assert.equal(validWorldSnapshot(sparse), false);
  const extra = structuredClone(snapshot); Object.assign(extra.actors, { payload: new Blob(['original']) }); assert.equal(validWorldSnapshot(extra), false);
  assert.equal(validWorldAction({ ...move(), payload: new Blob(['original']) }), false);
  assert.equal(validWorldAction({ type: 'world-step', ticks: -0 }), false);
});
