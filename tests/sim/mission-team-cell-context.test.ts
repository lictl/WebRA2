// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-transaction-fixture.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionTeamCellSource } from '../../packages/sim/src/mission-team-cell-source.ts';
import { compileMissionTeamCellContext, isMissionTeamCellContext, missionTeamCellContextData } from '../../packages/sim/src/mission-team-cell-context.ts';
import { restoreMissionTeamContext, missionTeamContextData } from '../../packages/sim/src/mission-team-context.ts';
import { createMissionTeamCheckpoint, admitMissionTeamInput, stepMissionTeamWorld, restoreMissionTeamCheckpoint } from '../../packages/sim/src/mission-team-runtime.ts';
function fixture(options: Parameters<typeof missionTeamFixture>[0] = {}) {
  const f = missionTeamFixture(options), cells = compileMissionCellEntrySource({ bindings: f.bindings });
  const source = compileMissionTeamCellSource({ cells, actions: f.source, definitions: f.definitions, rules: f.rules, mission: f.mission });
  return { ...f, cells, cellSource: source };
}
test('empty, spawned, recruited and released histories preserve all actor provenance across both profiles', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile }), initial = createMissionTeamCheckpoint(f.runtime);
    let checkpoint = admitMissionTeamInput(f.runtime, initial, { requests: [f.receipt(0, 0), f.receipt(1, 1)], commands: [] });
    for (let i = 0; i < 5; i++) {
      const teams = restoreMissionTeamContext(f.runtime, checkpoint.history), c = compileMissionTeamCellContext({ source: f.cellSource, teams });
      assert(isMissionTeamCellContext(c)); assert(Object.isFrozen(c.actors)); assert(c.actors.every(a => a.status === 'supported'));
      assert.deepEqual(c.actors.slice(0, 2).map(a => a.provenance.kind), ['initial', 'initial']);
      assert.deepEqual(c.actors.map(a => a.entityId), missionTeamContextData(teams).model.entities.map(e => e.id));
      if (i >= 2) {
        const born = c.actors.at(-1)!; assert.equal(born.provenance.kind, 'constructed'); assert.equal(born.ownerId, c.actors[0]!.ownerId);
        if (born.provenance.kind === 'constructed') { assert.equal(born.provenance.taskForceSlot, 0); assert.equal(born.provenance.birthRecordOrdinal, 1); }
        assert.equal(Object.hasOwn(born, 'origin'), false); assert.equal(Object.hasOwn(born, 'rowId'), false);
      }
      if (i >= 3) { assert.equal(missionTeamContextData(teams).actors.length, 0); assert.equal(c.actors.length, 3); }
      const restored = restoreMissionTeamCheckpoint(f.runtime, JSON.stringify(checkpoint));
      assert.deepEqual(compileMissionTeamCellContext({ source: f.cellSource, teams: restoreMissionTeamContext(f.runtime, restored.history) }), c);
      checkpoint = stepMissionTeamWorld(f.runtime, checkpoint).checkpoint;
    }
  }
});
test('context charges exact work and ignores sufficient transient budgets in identity', () => {
  const f = fixture(), teams = restoreMissionTeamContext(f.runtime, []), input = { source: f.cellSource, teams };
  const c = compileMissionTeamCellContext(input), data = missionTeamCellContextData(c); assert(data.contextWork > 0);
  assert.equal(data.source, f.cellSource); assert.equal(data.cells, f.cells); assert.equal(data.actions, f.source); assert.equal(data.teams, teams);
  assert.equal(data.runtime, f.runtime); assert.equal(data.model, f.world.model); assert.equal(data.actors, c.actors);
  assert.deepEqual(compileMissionTeamCellContext(input, { contextWork: data.contextWork }), c);
  assert.throws(() => compileMissionTeamCellContext(input, { contextWork: data.contextWork - 1 }), /context-work-limit/);
  assert.throws(() => compileMissionTeamCellContext(input, { actors: 1 }), /context-count-limit/);
  assert.throws(() => compileMissionTeamCellContext(input, { nodes: 0 }), /context-node-limit/);
  assert.throws(() => compileMissionTeamCellContext(input, { characters: 0 }), /context-character-limit/);
  assert.throws(() => compileMissionTeamCellContext(input, { serializedBytes: 0 }));
});
test('forged or mismatched sources and histories cannot become a context; descriptor snapshots are owned', () => {
  const f = fixture(), other = fixture({ extraRules: 'Cloakable=no' }), teams = restoreMissionTeamContext(f.runtime, []), input = { source: f.cellSource, teams };
  const c = compileMissionTeamCellContext(input); assert(!isMissionTeamCellContext({ ...c })); assert.throws(() => missionTeamCellContextData({ ...c }));
  for (const patch of [{ source: { ...f.cellSource } }, { source: other.cellSource }, { teams: { ...teams } }, { teams: new Proxy(teams, {}) }])
    assert.throws(() => compileMissionTeamCellContext({ ...input, ...patch }));
  assert.deepEqual(compileMissionTeamCellContext(new Proxy(input, { get() { throw new Error('get'); } })), c);
  assert.throws(() => compileMissionTeamCellContext(Object.defineProperty({ ...input }, 'source', { enumerable: true, get() { throw new Error('get'); } })));
  assert.throws(() => restoreMissionTeamContext(f.runtime, [{ kind: 'spawned', ordinal: 0, actionId: f.source.actions[1]!.instructionId,
    instanceId: 'invented', teamId: 'team:squad', bornAtTick: 0, actors: [{ entityId: 3, typeId: 'type:infantry:walker', houseId: 'missing', playerId: 0, initialHealth: 100, x: 3, y: 3 }] }]));
});
test('partial component use retains unsupported births without mislabeling constructor defaults', () => {
  const f = fixture({ extraRules: 'Cloakable=yes' }), initial = createMissionTeamCheckpoint(f.runtime);
  let c = admitMissionTeamInput(f.runtime, initial, { requests: [f.receipt(1, 0)], commands: [] });
  c = stepMissionTeamWorld(f.runtime, stepMissionTeamWorld(f.runtime, c).checkpoint).checkpoint;
  const result = compileMissionTeamCellContext({ source: f.cellSource, teams: restoreMissionTeamContext(f.runtime, c.history) });
  assert.equal(f.cellSource.coverage.allRequiredConstructorsReady, false); assert.equal(result.actors.at(-1)!.status, 'unsupported');
  assert(result.actors.at(-1)!.reasons.includes('cloakable-construction')); assert.equal(result.actors.length, 3);
});
