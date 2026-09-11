// SPDX-License-Identifier: GPL-3.0-or-later
// Original source missions and real engine movement/combat; no retail assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseFixture } from './mission-house-fixture.ts';
import { ordinaryFixtureSource } from './ordinary-infantry-fixture.ts';
import { compileMissionBindings, prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionObjectEventSource } from '../../packages/sim/src/mission-object-event-source.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileOrdinaryInfantryBridge } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { bindOrdinaryInfantryWorld } from '../../packages/sim/src/source-infantry-world.ts';
import { createWorldModel, worldPosition, worldHash, type WorldModel } from '../../packages/sim/src/world-model.ts';
import { compileMissionWorld, createMissionWorld, stepMissionWorld, restoreMissionWorld, admitMissionWorld, replayMissionWorld } from '../../packages/sim/src/mission-world.ts';
import type { MissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';

function owned(base: WorldModel, ownership: MissionHouseSource) {
  return createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256,
    definitionsSha256: base.definitionsSha256, entities: base.entities, navigation: base.navigation,
    blocked: base.blocked.map(worldPosition), footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })),
    ...(base.combat ? { combat: base.combat } : {}), ownership });
}
async function cells(profile: 'ra2' | 'yr') {
  const f = houseFixture({ profile, infantryRows: '0=Commander,Walker,256,2,2,0,Guard,0,None,0,0,0,0,0', extraMap: `[Triggers]
Check=Blue,Take,Current entrant,0,1,1,1,0
Take=Blue,<none>,Capture entrant,0,1,1,1,0
[Tags]
Shared=2,Cell,Check
[Events]
Check=1,1,0,1
Take=1,1,0,0
[Actions]
Check=1,28,0,1,0,0,0,0,A
Take=1,36,0,1,0,0,0,0,A
[CellTags]
2003=Shared
3003=Shared` });
  const source = compileMissionCellEntrySource({ bindings: f.bindings });
  const prepared = await prepareMissionBindings(f.bindings, undefined, source, undefined, undefined, undefined, { houseSource: f.source });
  assert(prepared.authority, JSON.stringify(prepared.compilation?.diagnostics));
  const flags = compileMissionInitialFlags({ bindings: f.bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  const model = compileMissionWorld({ world: owned(f.world.model, f.source), bindings: prepared.authority, flags });
  return { model };
}
const move = (tick: number, playerId: number, x: number, y: number) => ({ schemaVersion: 1 as const, tick, sequence: 0, playerId, kind: 'move', payload: { entityId: 1, x, y } });

test('later cell-chain predicates see the owner changed by an earlier action in the same crossing', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const { model } = await cells(profile), initial = createMissionWorld(model);
    const first = { commands: [move(0, 0, 3, 2)], flags: [] };
    let state = admitMissionWorld(model, initial, first);
    const crossed = stepMissionWorld(model, state, 8);
    assert.deepEqual(crossed.effects.map(e => e.opcode), [36, 28]);
    assert.equal(crossed.worldEvents.filter(e => e.kind === 'moved').length, 1);
    assert.equal(crossed.checkpoint.world.state.entities[0]!.owner, 1);
    assert.equal(crossed.checkpoint.mission.globals[1], true);
    assert(model.houseCallbackPolicy);
    state = restoreMissionWorld(model, crossed.checkpoint);
    const second = { commands: [move(8, 1, 3, 3)], flags: [] };
    const admitted = admitMissionWorld(model, state, second), moved = stepMissionWorld(model, admitted, 8);
    assert.deepEqual(moved.effects.map(e => e.opcode), [28]);
    assert.equal(moved.worldEvents.filter(e => e.kind === 'moved').length, 1);
    assert.equal(moved.checkpoint.world.state.ownership!.transfers.length, 1);
    assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, admitted), 8).checkpoint, moved.checkpoint);
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, input: first }, { nextTick: 8, input: second }], finalNextTick: 16,
      finalStateSha256: worldHash(moved.checkpoint) }).checkpoint, moved.checkpoint);
  }
});

async function objects(profile: 'ra2' | 'yr', selector: number, opcode = 36) {
  const f = ordinaryFixtureSource({ profile, targetTag: 'Shared', extraCountries: '1=Red\n', extraHouses: '2=Captured\n', extraMap: `[Captured]
Country=Red
[Triggers]
Check=Blue,Take,Current attacker,0,1,1,1,0
Take=Blue,<none>,Capture during callback,0,1,1,1,0
[Tags]
Shared=2,Victim,Check
[Events]
Check=1,44,0,${selector}
Take=1,6,0,0
[Actions]
Check=1,28,0,2,0,0,0,0,A
Take=1,${opcode},0,1,0,0,0,0,A` });
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const ownership = compileMissionHouseSource({ bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const source = compileMissionObjectEventSource({ bindings });
  const prepared = await prepareMissionBindings(bindings, undefined, undefined, source, undefined, undefined, { houseSource: ownership });
  assert(prepared.authority, JSON.stringify(prepared.compilation?.diagnostics));
  const flags = compileMissionInitialFlags({ bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  const { rules, mission, ...input } = f, bridge = compileOrdinaryInfantryBridge(input);
  const model = compileMissionWorld({ world: owned(bindOrdinaryInfantryWorld(bridge, f.world.model), ownership), bindings: prepared.authority, flags });
  return { model };
}
const attack = { schemaVersion: 1 as const, tick: 0, sequence: 0, playerId: 0, kind: 'attack', payload: { entityId: 1, targetId: 2 } };

test('event44 reads the current attacker house after a preceding health callback transfers it', async () => {
  for (const profile of ['ra2', 'yr'] as const) for (const selector of [0, 2]) {
    const { model } = await objects(profile, selector), initial = createMissionWorld(model), input = { commands: [attack], flags: [] };
    const admitted = admitMissionWorld(model, initial, input), hit = stepMissionWorld(model, admitted, 3);
    assert.equal(hit.worldEvents.filter(e => e.kind === 'damaged').length, 1);
    assert.deepEqual(hit.effects.map(e => e.opcode), selector === 2 ? [36, 28] : [36]);
    assert.equal(hit.checkpoint.world.state.entities[0]!.owner, 2);
    assert.equal(hit.checkpoint.world.state.entities[1]!.owner, 1);
    assert.equal(hit.checkpoint.mission.globals[2], selector === 2);
    assert.deepEqual(restoreMissionWorld(model, hit.checkpoint), hit.checkpoint);
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, input }], finalNextTick: 3, finalStateSha256: worldHash(hit.checkpoint) }).checkpoint, hit.checkpoint);
  }
});

test('a captured recipient keeps its tag callback and never substitutes its house for the attacker', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const { model } = await objects(profile, 0, 14), initial = createMissionWorld(model);
    const admitted = admitMissionWorld(model, initial, { commands: [attack], flags: [] }), before = worldHash(admitted);
    const hit = stepMissionWorld(model, admitted, 3);
    assert.deepEqual(hit.effects.map(e => e.opcode), [14, 28]);
    assert.deepEqual(hit.checkpoint.world.state.entities.map(e => e.owner), [0, 2]);
    assert.deepEqual(stepMissionWorld(model, admitted, 3, hit.work).checkpoint, hit.checkpoint);
    assert.throws(() => stepMissionWorld(model, admitted, 3, hit.work - 1), /work/);
    assert.equal(worldHash(admitted), before);
  }
});
