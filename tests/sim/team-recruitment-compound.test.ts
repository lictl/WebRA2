// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { recruitmentFixture } from './team-recruitment-fixture.ts';
import { compileTeamRecruitmentCatalog } from '../../packages/sim/src/team-recruitment-catalog.ts';
import { createTeamRecruitmentCheckpoint as create, admitTeamRecruitmentInput as admit, prepareTeamRecruitmentTick as prepare,
  commitTeamRecruitmentTick as commit, stepTeamRecruitmentWorld as step, restoreTeamRecruitmentCheckpoint as restore,
  replayTeamRecruitmentWorld as replay } from '../../packages/sim/src/team-recruitment-runtime.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const mutable = <T>(value: T): Mutable<T> => structuredClone(value) as Mutable<T>;

test('both profiles recruit existing complete forces, move/flash/sleep, and reproduce every tick from pending and mid-run saves', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = recruitmentFixture({ profile, count: 2, script: '0=3,0\n1=50,6\n2=11,0' }), catalog = f.catalog;
    const base = create(catalog), pending = prepare(catalog, admit(catalog, base, { actions: f.input.actionIds, commands: [] }));
    assert.equal(base.records.length, 0); assert.equal(pending.records.length, 0); assert.equal(pending.pending!.checkpoint.records.length, 1);
    let checkpoint = pending; const initialActors = base.team.world.state.entities.length;
    for (let i = 0; i < 35; i++) {
      checkpoint = step(catalog, checkpoint).checkpoint;
      assert.equal(checkpoint.team.world.state.entities.length, initialActors);
      assert.deepEqual(restore(catalog, JSON.stringify(checkpoint)), checkpoint);
      assert.deepEqual(replay(catalog, { schemaVersion: 1, catalogSha256: catalog.sha256, initialCheckpoint: pending, admissions: [],
        finalNextTick: checkpoint.team.world.nextTick, finalStateSha256: worldHash(checkpoint) }).checkpoint, checkpoint);
      const next = step(catalog, checkpoint).checkpoint;
      assert.deepEqual(replay(catalog, { schemaVersion: 1, catalogSha256: catalog.sha256, initialCheckpoint: prepare(catalog, checkpoint), admissions: [],
        finalNextTick: next.team.world.nextTick, finalStateSha256: worldHash(next) }).checkpoint, next);
    }
    assert.equal(checkpoint.team.team.instances[0]!.phase, 'sleep'); assert.equal(checkpoint.records.length, 1);
    assert.equal(checkpoint.requests[0]!.status, 'recruited'); assert.equal(checkpoint.team.team.flashes.length, 2);
    assert(checkpoint.team.team.flashes.every(f => f.remaining === 0));
    const record = checkpoint.records[0]!; assert.equal(record.kind, 'recruited');
    if (record.kind === 'recruited') assert.deepEqual([...record.actorIds].sort((a,b) => a-b), [1,2]);
  }
});
test('overlapping requests never duplicate members; unavailable requests retry and exhaust without consuming a record', () => {
  const f = recruitmentFixture({ script: '0=11,0' }), catalog = compileTeamRecruitmentCatalog(f.input, { retries: 2 });
  const start = create(catalog), action = f.input.actionIds[0]!, admitted = admit(catalog, start, { actions: [action, action, action], commands: [] });
  const first = step(catalog, admitted).checkpoint;
  assert.deepEqual(first.requests.map(r => r.status), ['recruited','recruited','queued']); assert.equal(first.records.length, 2);
  assert.equal(first.requests[2]!.nextAttemptTick, 15);
  const end = step(catalog, first, 15).checkpoint;
  assert.deepEqual(end.requests.map(r => r.status), ['recruited','recruited','exhausted']); assert.equal(end.records.length, 2);
  assert.deepEqual(replay(catalog, { schemaVersion: 1, catalogSha256: catalog.sha256, initialCheckpoint: first, admissions: [],
    finalNextTick: end.team.world.nextTick, finalStateSha256: worldHash(end) }).checkpoint, end);
  assert.deepEqual(create(catalog), start);
});
test('an existing queued order delays a full force until retry; release preserves Flash and permits unrelated control', () => {
  const f = recruitmentFixture({ count: 2, script: '0=50,30' }), catalog = f.catalog;
  const command = { schemaVersion: 1, tick: 2, playerId: 0, sequence: 0, kind: 'stop', payload: { entityId: 1 } } as const;
  const admitted = admit(catalog, create(catalog), { actions: f.input.actionIds, commands: [command] });
  const early = step(catalog, admitted, 3).checkpoint; assert.equal(early.records.length, 0); assert.equal(early.requests[0]!.nextAttemptTick, 15);
  const end = step(catalog, early, 14).checkpoint;
  assert.equal(end.records.length, 2); assert.equal(end.records[0]!.kind, 'recruited'); assert.equal(end.records[1]!.kind, 'released');
  assert.equal(end.team.team.instances.length, 0); assert.equal(end.team.team.flashes[0]!.remaining, 29);
  const sequence = end.team.world.state.admissionCursors.find(c => c.playerId === 0)!.sequence + 1;
  const controlled = admit(catalog, end, { actions: [], commands: [{ ...command, tick: 17, sequence }] });
  const next = step(catalog, controlled).checkpoint;
  assert.deepEqual(replay(catalog, { schemaVersion: 1, catalogSha256: catalog.sha256, initialCheckpoint: admitted,
    admissions: [{ nextTick: 17, actions: [], commands: [{ ...command, tick: 17, sequence }] }], finalNextTick: 18,
    finalStateSha256: worldHash(next) }).checkpoint, next);
  assert.equal(next.team.team.flashes[0]!.remaining, 28);
});
test('source errors, resource failures and corrupt pending/history data leave all inputs unchanged', () => {
  const f = recruitmentFixture({ count: 2, script: '0=3,0\n1=11,0' }), catalog = f.catalog, base = create(catalog);
  const pending = prepare(catalog, admit(catalog, base, { actions: f.input.actionIds, commands: [] })), hash = worldHash(pending);
  const bad = mutable(pending); bad.pending!.checkpoint.requests[0]!.attempts = 2;
  assert.throws(() => restore(catalog, bad), /pending-tick-mismatch/); assert.equal(worldHash(pending), hash);
  assert.throws(() => admit(catalog, pending, { actions: f.input.actionIds, commands: [] }), /pending-admission/);
  assert.deepEqual(commit(catalog, pending), commit(catalog, pending));
  const run = commit(catalog, pending).checkpoint;
  const owner = mutable(run); const claim = owner.records[0]!; if (claim.kind === 'recruited') claim.actorIds[0] = 3;
  assert.throws(() => restore(catalog, owner));
  const orphan = mutable(run); orphan.requests = []; orphan.nextRequestId = 0; assert.throws(() => restore(catalog, orphan));
  const impossible = mutable(run); impossible.requests[0]!.nextAttemptTick = 15; assert.throws(() => restore(catalog, impossible));
  const limited = compileTeamRecruitmentCatalog(f.input, { trace: 1 }), limitedBase = admit(limited, create(limited), { actions: f.input.actionIds, commands: [] });
  const limitedHash = worldHash(limitedBase); assert.throws(() => step(limited, limitedBase)); assert.equal(worldHash(limitedBase), limitedHash);
  const source = recruitmentFixture({ extraTeam: 'Waypoint=B' }); assert.throws(() => admit(source.catalog, create(source.catalog), { actions: source.input.actionIds, commands: [] }));
  assert.deepEqual(create(catalog), base);
});
