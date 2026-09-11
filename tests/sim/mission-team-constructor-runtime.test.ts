// SPDX-License-Identifier: GPL-3.0-or-later
// Original owned construction transactions, not retail mission execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { constructorFixture } from './mission-team-constructor-fixture.ts';
import { restoreMissionTeamConstructorHistory } from '../../packages/sim/src/mission-team-constructor-history.ts';
import { compileMissionTeamOwnedBinding } from '../../packages/sim/src/mission-team-owned-binding.ts';
import { compileMissionTeamRuntime, restoreMissionTeamContext, missionTeamContextData } from '../../packages/sim/src/mission-team-context.ts';
import { createWorldModel, worldPosition, worldHash } from '../../packages/sim/src/world-model.ts';
import { createMissionTeamCheckpoint, admitMissionTeamInput, stepMissionTeamWorld, prepareMissionTeamTick,
  restoreMissionTeamCheckpoint, replayMissionTeamWorld, transferMissionTeamOwnership } from '../../packages/sim/src/mission-team-runtime.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { createCombatModel, combatFactor } from '../../packages/sim/src/combat-model.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
import { compileInfantryPassageCatalog } from '../../packages/sim/src/infantry-passage-catalog.ts';
import { createInfantryOccupancy } from '../../packages/sim/src/infantry-passage-occupancy.ts';
import { restoreWorldOwnership } from '../../packages/sim/src/world-ownership.ts';
const profiles = ['ra2', 'yr'] as const;
function fixture(profile: 'ra2' | 'yr', script?: string, capabilities = false) {
  const f = constructorFixture(profile, '', script, false, { transfers: true, subcells: capabilities }), b = f.world.model;
  const combat = capabilities ? createCombatModel({ allies: [], weapons: [{ id: 'original:gun', damage: 1, range: 2048, minimumRange: 0,
    reloadTicks: 2, burst: 1, burstDelayTicks: 1, delivery: 'instant', speed: 0, ground: true, air: false,
    verses: Array.from({ length: 11 }, () => combatFactor(1)) }],
    actors: b.entities.map(e => ({ entityId: e.id, armor: 0, layer: 'ground', weapons: ['original:gun'], initialAmmo: -1 })) }) : undefined;
  const infantryPassage = capabilities ? compileInfantryPassageCatalog({ world: f.world, definitions: f.definitions,
    actors: compileCombatActors({ definitions: f.definitions, rules: f.rules, mission: f.mission }), rules: f.rules, mission: f.mission }) : undefined;
  const model = createWorldModel({ contentIdentity: b.contentIdentity, sourceSha256: b.sourceSha256, definitionsSha256: b.definitionsSha256,
    entities: b.entities, navigation: b.navigation, blocked: b.blocked.map(worldPosition),
    footprints: b.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: f.input.houses,
    construction: restoreMissionTeamConstructorHistory(f.catalog, []), ...(combat ? { combat } : {}), ...(infantryPassage ? { infantryPassage } : {}) });
  const binding = compileMissionTeamOwnedBinding({ source: f.source, world: model, constructors: f.catalog });
  const runtime = compileMissionTeamRuntime(f.source, {}, binding);
  const actions = f.input.houses.instructions.filter(i => i.kind === 'action' && i.opcode === 36);
  const transfer = { instructionId: actions[0]!.instructionId, sourceHouse: 0, triggerHouse: null };
  const reverse = { instructionId: actions[1]!.instructionId, sourceHouse: 1, triggerHouse: null };
  return { ...f, model, binding, runtime, transfer, reverse, combat, infantryPassage };
}
test('owned action7/80 performs actual birth, movement, Flash and release with boundary and full replay equality', () => {
  for (const profile of profiles) for (const index of [1, 2]) {
    const f = fixture(profile), initial = createMissionTeamCheckpoint(f.runtime), admission = { requests: [f.receipt(index, 0)], commands: [] };
    let current = admitMissionTeamInput(f.runtime, initial, admission), moved = false, flashed = false;
    for (let tick = 0; tick < 8; tick++) {
      const next = stepMissionTeamWorld(f.runtime, current), pending = prepareMissionTeamTick(f.runtime, current);
      assert.deepEqual(stepMissionTeamWorld(f.runtime, restoreMissionTeamCheckpoint(f.runtime, JSON.stringify(current))), next);
      const { work: pendingWork, ...pendingResult } = stepMissionTeamWorld(f.runtime, restoreMissionTeamCheckpoint(f.runtime, pending));
      const { work: nextWork, ...nextResult } = next; assert.deepEqual(pendingResult, nextResult); assert(pendingWork >= nextWork);
      moved ||= next.worldEvents.some(e => e.kind === 'moved'); flashed ||= next.events.some(e => e.kind === 'flash');
      current = next.checkpoint;
    }
    assert(moved); assert(flashed); assert.equal(current.team.world.engineVersion, 'webra2-world-9');
    assert.equal(current.history[0]!.kind, 'spawned'); assert.equal(current.history[0]!.ownershipRevision, 0);
    assert.equal(current.history.at(-1)!.kind, 'released'); assert.deepEqual(current.team.world.state.entities.map(e => e.owner), [0, 0, 0]);
    assert.equal(current.team.world.state.ownership!.counts[0]!.registered.unit, 1);
    assert.equal(current.team.world.state.ownership!.counts[0]!.present.unit, profile === 'ra2' ? 0 : 1);
    assert.deepEqual([current.team.world.state.entities[2]!.x, current.team.world.state.entities[2]!.y], [4, 3]);
    assert.deepEqual(replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, ...admission }], finalNextTick: 8, finalStateSha256: worldHash(current) }).checkpoint, current);
    const context = missionTeamContextData(restoreMissionTeamContext(f.runtime, current.history, current.team.world));
    assert.equal(context.model.ownership, f.input.houses); assert.equal(context.model.construction!.births.length, 1);
    assert.equal(context.model.entities[2]!.kind, 'unit'); assert.equal(context.model.entities[2]!.blocksCell, true);
    assert.equal(initial.team.world.state.entities.length, 2);
  }
});
test('repeated same-boundary births preserve order, population and exclusive anchors under retained combat and slots', () => {
  for (const profile of profiles) {
    const f = fixture(profile, '0=11,0', true), initial = createMissionTeamCheckpoint(f.runtime);
    const admission = { requests: [f.receipt(1, 0), f.receipt(2, 1)], commands: [] };
    let current = admitMissionTeamInput(f.runtime, initial, admission);
    for (let n = 0; n < 5; n++) current = stepMissionTeamWorld(f.runtime, current).checkpoint;
    assert.deepEqual(current.history.map(r => [r.kind, r.ordinal, r.ownershipRevision]), [['spawned', 0, 0], ['spawned', 1, 0]]);
    assert.deepEqual(current.team.team.instances.map(i => i.phase), ['sleep', 'sleep']);
    const { model } = missionTeamContextData(restoreMissionTeamContext(f.runtime, current.history, current.team.world));
    assert.equal(model.combat, f.combat); assert.equal(model.infantryPassage, f.infantryPassage);
    assert.equal(model.construction!.births.length, 2); assert.equal(model.entities.length, 4);
    assert.equal(current.team.world.state.ownership!.counts[0]!.registered.unit, 2);
    assert.equal(current.team.world.state.ownership!.counts[0]!.present.unit, profile === 'ra2' ? 0 : 2);
    assert.deepEqual(current.team.world.state.combat, initial.team.world.state.combat);
    assert.deepEqual(current.team.world.state.infantrySlots, initial.team.world.state.infantrySlots);
    const entities = current.team.world.state.entities, ownership = restoreWorldOwnership(model, current.team.world.state.ownership, entities, 5);
    const occupied = createInfantryOccupancy(f.infantryPassage!, { entities, infantrySlots: current.team.world.state.infantrySlots!, retiredEntityIds: [] }, ownership);
    assert.equal(occupied.choose(1, entities[2]!.x + 512 * entities[2]!.y).reason, 'whole-cell-blocker');
    assert.equal(occupied.choose(1, entities[3]!.x + 512 * entities[3]!.y).reason, 'whole-cell-blocker');
    assert.equal(new Set(entities.map(e => e.x + 512 * e.y)).size, 4);
    assert.deepEqual(replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, ...admission }], finalNextTick: 5, finalStateSha256: worldHash(current) }).checkpoint, current);
    const limited = compileMissionTeamRuntime(f.source, { historicalActors: 1, retries: 1 }, f.binding);
    const limitedInitial = createMissionTeamCheckpoint(limited), admitted = admitMissionTeamInput(limited, limitedInitial, admission);
    const due = stepMissionTeamWorld(limited, admitted).checkpoint, before = worldHash(due);
    assert.throws(() => stepMissionTeamWorld(limited, due), /capacity/);
    assert.equal(worldHash(due), before); assert.equal(due.team.world.state.entities.length, 2);
  }
});
test('queued future source and target IDs cannot be activated by an owned construction receipt', () => {
  for (const profile of profiles) for (const order of [
    { kind: 'move', payload: { entityId: 3, x: 4, y: 3 } }, { kind: 'attack', payload: { entityId: 1, targetId: 3 } },
  ]) {
    const f = fixture(profile, undefined, true), initial = createMissionTeamCheckpoint(f.runtime);
    const admission = { requests: [f.receipt(1, 0)], commands: [{ schemaVersion: 1 as const, tick: 4, playerId: 0, sequence: 0, ...order }] };
    const due = stepMissionTeamWorld(f.runtime, admitMissionTeamInput(f.runtime, initial, admission)).checkpoint, before = worldHash(due);
    assert.throws(() => stepMissionTeamWorld(f.runtime, due), /queued-new-actor/);
    assert.equal(worldHash(due), before); assert.equal(due.team.world.state.entities.length, 2);
  }
});
test('birth follows the exact prior transfer revision, active capture is atomic, and released units can transfer', () => {
  for (const profile of profiles) {
    const f = fixture(profile), initial = createMissionTeamCheckpoint(f.runtime);
    const changed = transferMissionTeamOwnership(f.runtime, initial, f.transfer).checkpoint;
    const admission = { requests: [f.receipt(1, 0)], commands: [] };
    let current = admitMissionTeamInput(f.runtime, changed, admission);
    current = stepMissionTeamWorld(f.runtime, stepMissionTeamWorld(f.runtime, current).checkpoint).checkpoint;
    assert.equal(current.history[0]!.ownershipRevision, 1); assert.deepEqual(current.team.world.state.entities.map(e => e.owner), [1, 1, 0]);
    const before = worldHash(current);
    assert.throws(() => transferMissionTeamOwnership(f.runtime, current, f.transfer), /active-owner-change/);
    assert.equal(worldHash(current), before);
    const active = missionTeamContextData(restoreMissionTeamContext(f.runtime, current.history, current.team.world));
    const core = WorldSimulation.restore(active.model, current.team.world);
    core.transferOwnership(f.transfer); core.transferOwnership(f.reverse);
    assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, { ...current, team: { ...current.team, world: core.save() } }), /active-owner-change/);
    while (current.team.world.nextTick < 8) current = stepMissionTeamWorld(f.runtime, current).checkpoint;
    const transferred = transferMissionTeamOwnership(f.runtime, current, f.transfer);
    assert.deepEqual(transferred.result.entityIds, [3]); assert.equal(transferred.checkpoint.team.world.state.entities[2]!.owner, 1);
    assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime, transferred.checkpoint), transferred.checkpoint);
    assert.deepEqual(replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, requests: [], commands: [], ownershipTransfers: [f.transfer] }, { nextTick: 0, ...admission },
        { nextTick: 8, requests: [], commands: [], ownershipTransfers: [f.transfer] }], finalNextTick: 8,
      finalStateSha256: worldHash(transferred.checkpoint) }).checkpoint, transferred.checkpoint);
  }
});
test('owned construction budgets, source substitution and forged birth revisions fail without changing the checkpoint', () => {
  for (const profile of profiles) {
    const f = fixture(profile), other = fixture(profile), initial = createMissionTeamCheckpoint(f.runtime);
    assert.throws(() => compileMissionTeamOwnedBinding({ source: f.source, world: f.model, constructors: other.catalog }));
    assert.throws(() => compileMissionTeamOwnedBinding({ source: f.source, world: f.model, constructors: { ...f.catalog } }));
    assert.throws(() => compileMissionTeamOwnedBinding({ source: f.source, world: f.model }));
    const admitted = admitMissionTeamInput(f.runtime, initial, { requests: [f.receipt(1, 0)], commands: [] });
    const due = stepMissionTeamWorld(f.runtime, admitted).checkpoint, before = worldHash(due), step = stepMissionTeamWorld(f.runtime, due);
    assert.deepEqual(stepMissionTeamWorld(f.runtime, due, step.work), step);
    assert.throws(() => stepMissionTeamWorld(f.runtime, due, step.work - 1), /work/);
    assert.equal(worldHash(due), before);
    for (const ownershipRevision of [-1, 1]) {
      const forged = structuredClone(step.checkpoint); Object.assign(forged.history[0]!, { ownershipRevision });
      assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, forged));
    }
    const forged = structuredClone(step.checkpoint); delete (forged.history[0] as { ownershipRevision?: number }).ownershipRevision;
    assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, forged));
    assert.equal(f.binding.allRequiredTransfersSupported, false);
  }
});
test('a later birth follows releases and transfers without reusing IDs or rewriting the earlier population', () => {
  for (const profile of profiles) {
    const f = fixture(profile, '0=50,5'), initial = createMissionTeamCheckpoint(f.runtime);
    const first = { requests: [f.receipt(1, 0)], commands: [] };
    let current = admitMissionTeamInput(f.runtime, initial, first);
    while (current.team.world.nextTick < 4) current = stepMissionTeamWorld(f.runtime, current).checkpoint;
    assert.equal(current.history[1]!.kind, 'released');
    current = transferMissionTeamOwnership(f.runtime, current, f.transfer).checkpoint;
    const second = { requests: [f.receipt(2, 1, 4)], commands: [] };
    current = admitMissionTeamInput(f.runtime, current, second);
    while (current.team.world.nextTick < 8) current = stepMissionTeamWorld(f.runtime, current).checkpoint;
    assert.deepEqual(current.history.map(r => [r.kind, r.ordinal]), [['spawned', 0], ['released', 1], ['spawned', 2], ['released', 3]]);
    assert.equal(current.history[2]!.ownershipRevision, 1);
    assert.deepEqual(current.team.world.state.entities.map(e => [e.id, e.owner]), [[1, 1], [2, 1], [3, 1], [4, 0]]);
    assert.deepEqual(current.team.world.state.ownership!.counts.map(c => c.registered.unit), [1, 1]);
    assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime, JSON.stringify(current)), current);
    assert.deepEqual(replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, ...first }, { nextTick: 4, requests: [], commands: [], ownershipTransfers: [f.transfer] },
        { nextTick: 4, ...second }], finalNextTick: 8, finalStateSha256: worldHash(current) }).checkpoint, current);
  }
});
