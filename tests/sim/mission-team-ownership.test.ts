// SPDX-License-Identifier: GPL-3.0-or-later
// Original fixed-actor transfer/recruitment scenarios; no retail mission payload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-transaction-fixture.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { compileMissionTeamOwnedBinding, missionTeamOwnedBindingData } from '../../packages/sim/src/mission-team-owned-binding.ts';
import { compileMissionTeamRuntime, restoreMissionTeamContext, missionTeamContextData } from '../../packages/sim/src/mission-team-context.ts';
import { createWorldModel, worldHash, worldPosition } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { bindMissionTeamActors, restoreTeamCheckpoint } from '../../packages/sim/src/team-runtime.ts';
import { createMissionTeamCheckpoint, admitMissionTeamInput, stepMissionTeamWorld, transferMissionTeamOwnership,
  restoreMissionTeamCheckpoint, replayMissionTeamWorld, prepareMissionTeamTick } from '../../packages/sim/src/mission-team-runtime.ts';

function fixture(profile: 'ra2' | 'yr', extraRules = '', initialOwner = 'Rival') {
  const f = missionTeamFixture({ profile, extraRules, script: '0=3,0\n1=50,5',
    infantryRows: `0=${initialOwner},Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1`,
    extraMap: '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\nTransfer=Red,<none>,Transfer,0,1,1,1,0\nBack=Blue,<none>,Back,0,1,1,1,0\n' +
      '[Tags]\nShared=2,Shared,Start\nChange=2,Change,Transfer\nReturn=2,Return,Back\n[Events]\nStart=1,13,0,0\nTransfer=1,13,0,0\nBack=1,13,0,0\n' +
      '[Actions]\nStart=1,4,1,Squad,0,0,0,0,A\nTransfer=1,36,0,0,0,0,0,0,A\nBack=1,36,0,1,0,0,0,0,A' });
  const house = compileMissionHouseSource({ bindings: f.bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const b = f.world.model, model = createWorldModel({ contentIdentity: b.contentIdentity, sourceSha256: b.sourceSha256,
    definitionsSha256: b.definitionsSha256, entities: b.entities, navigation: b.navigation, blocked: b.blocked.map(worldPosition),
    footprints: b.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: house });
  const binding = compileMissionTeamOwnedBinding({ source: f.source, world: model }), runtime = compileMissionTeamRuntime(f.source, {}, binding);
  const action = house.instructions.find(i => i.triggerId === 'transfer') ?? house.instructions.find(i => i.selector.playerId === 0)!;
  const reverse = house.instructions.find(i => i.selector.playerId === 1)!;
  return { ...f, house, model, binding, runtime,
    transfer: { instructionId: action.instructionId, sourceHouse: 1, triggerHouse: null },
    reverse: { instructionId: reverse.instructionId, sourceHouse: 0, triggerHouse: null } };
}

test('current ownership authorizes placed recruitment, real movement and finished release', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), initial = createMissionTeamCheckpoint(f.runtime);
    assert.equal(missionTeamOwnedBindingData(f.binding).model, f.model);
    const receipt = f.receipt(0, 0);
    const unavailable = stepMissionTeamWorld(f.runtime, stepMissionTeamWorld(f.runtime,
      admitMissionTeamInput(f.runtime, initial, { requests: [receipt], commands: [] })).checkpoint);
    assert(unavailable.actionEvents.some(e => e.kind === 'blocked'));
    const changed = transferMissionTeamOwnership(f.runtime, initial, f.transfer);
    assert.equal(changed.checkpoint.team.world.state.entities[0]!.owner, 0);
    assert.equal(f.model.entities[0]!.owner, 1);
    assert.equal(initial.team.world.state.entities[0]!.owner, 1);
    const admissions = [{ nextTick: 0, requests: [], commands: [], ownershipTransfers: [f.transfer] },
      { nextTick: 0, requests: [receipt], commands: [] }];
    let current = admitMissionTeamInput(f.runtime, changed.checkpoint, { requests: [receipt], commands: [] });
    const boundaries = [current]; let moved = false, flashed = false;
    for (let i = 0; i < 24 && !current.history.some(h => h.kind === 'released'); i++) {
      const next = stepMissionTeamWorld(f.runtime, current);
      assert.deepEqual(stepMissionTeamWorld(f.runtime, restoreMissionTeamCheckpoint(f.runtime, current)), next);
      moved ||= next.worldEvents.some(e => e.kind === 'moved'); flashed ||= next.events.some(e => e.kind === 'flash');
      current = next.checkpoint; boundaries.push(current);
    }
    assert(moved); assert(flashed); assert.equal(current.history.at(-1)!.kind, 'released');
    const claim = current.history.find(h => h.kind === 'recruited')!;
    assert.equal(claim.kind === 'recruited' && claim.ownershipRevision, 1);
    const replay = replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256,
      initialCheckpoint: initial, admissions, finalNextTick: current.team.world.nextTick, finalStateSha256: worldHash(current) });
    assert.deepEqual(replay.checkpoint, current);
    const context = restoreMissionTeamContext(f.runtime, current.history, current.team.world);
    assert(missionTeamContextData(context).eligibility[0]!.releasedMissionUnverified);
    for (const boundary of boundaries) assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime, boundary), boundary);
  }
});

test('active capture and mixed transfer admissions fail atomically', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), initial = createMissionTeamCheckpoint(f.runtime), changed = transferMissionTeamOwnership(f.runtime, initial, f.transfer);
    let current = admitMissionTeamInput(f.runtime, changed.checkpoint, { requests: [f.receipt(0, 0)], commands: [] });
    current = stepMissionTeamWorld(f.runtime, stepMissionTeamWorld(f.runtime, current).checkpoint).checkpoint;
    assert(current.history.some(h => h.kind === 'recruited'));
    const before = worldHash(current);
    assert.throws(() => transferMissionTeamOwnership(f.runtime, current, f.reverse), /active-owner-change/);
    assert.equal(worldHash(current), before);
    assert.throws(() => transferMissionTeamOwnership(f.runtime, prepareMissionTeamTick(f.runtime, current), f.reverse), /pending/);
    assert.throws(() => admitMissionTeamInput(f.runtime, initial,
      { requests: [f.receipt(0, 0)], commands: [], ownershipTransfers: [f.transfer] }), /admission-order/);
    assert.deepEqual(transferMissionTeamOwnership(f.runtime, initial, f.transfer, changed.work), changed);
    assert.throws(() => transferMissionTeamOwnership(f.runtime, initial, f.transfer, changed.work - 1), /work/);
  }
});

test('same-tick change-back cannot reuse an earlier claim revision', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), initial = createMissionTeamCheckpoint(f.runtime);
    let current = transferMissionTeamOwnership(f.runtime, initial, f.transfer).checkpoint;
    current = stepMissionTeamWorld(f.runtime, admitMissionTeamInput(f.runtime, current,
      { requests: [f.receipt(0, 0)], commands: [] })).checkpoint;
    assert.equal(current.team.world.nextTick, 1); assert.equal(current.history.length, 0);
    current = transferMissionTeamOwnership(f.runtime, current, f.reverse).checkpoint;
    current = transferMissionTeamOwnership(f.runtime, current, f.transfer).checkpoint;
    const claimed = stepMissionTeamWorld(f.runtime, current).checkpoint;
    assert.equal(claimed.history[0]!.kind === 'recruited' && claimed.history[0]!.ownershipRevision, 3);
    for (const ownershipRevision of [0, 1, 2, 4]) {
      const forged = structuredClone(claimed);
      Object.assign(forged.history[0]!, { ownershipRevision });
      assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, forged), /owner|integer|recruit/);
    }
    // Even direct core transitions cannot bypass the runtime's active-member gate
    // by returning to the same owner before restoring the team checkpoint.
    const core = WorldSimulation.restore(f.model, claimed.team.world);
    core.transferOwnership(f.reverse); core.transferOwnership(f.transfer);
    const staleContext = restoreMissionTeamContext(f.runtime, claimed.history, claimed.team.world), staleRoster = bindMissionTeamActors(staleContext);
    assert.throws(() => restoreTeamCheckpoint(staleRoster, { ...claimed.team, world: core.save() }), /owner-checkpoint/);
    assert.throws(() => restoreMissionTeamCheckpoint(f.runtime,
      { ...claimed, team: { ...claimed.team, world: core.save() } }), /active-owner-change/);
    assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime, claimed), claimed);
  }
});

test('owned model and source capabilities cannot be copied or substituted, and constructors stay gated', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), other = fixture(profile);
    assert.throws(() => compileMissionTeamOwnedBinding({ source: f.source, world: { ...f.model } }), /world-model/);
    assert.throws(() => compileMissionTeamOwnedBinding({ source: other.source, world: f.model }), /owned-source/);
    assert.throws(() => compileMissionTeamRuntime(f.source, {}, { ...f.binding }), /owned-binding/);
    for (const value of [false, 0, '']) assert.throws(() => compileMissionTeamRuntime(f.source, {}, value as never), /owned-binding/);
    assert.throws(() => compileMissionTeamRuntime(f.source, {}, new Proxy(f.binding, {})), /owned-binding/);
    assert.throws(() => compileMissionTeamRuntime(other.source, {}, f.binding), /owned-source/);
    const initial = createMissionTeamCheckpoint(f.runtime);
    assert.throws(() => restoreMissionTeamContext(f.runtime, []), /owned-world|input-value/);
    assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, createMissionTeamCheckpoint(compileMissionTeamRuntime(f.source))), /identity|source|checkpoint/);
    assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime, createMissionTeamCheckpoint(other.runtime)), initial);
    const mixed = missionTeamFixture({ profile });
    const houses = compileMissionHouseSource({ bindings: mixed.bindings, definitions: mixed.definitions, rules: mixed.rules, mission: mixed.mission });
    const b = mixed.world.model, model = createWorldModel({ contentIdentity: b.contentIdentity, sourceSha256: b.sourceSha256,
      definitionsSha256: b.definitionsSha256, entities: b.entities, navigation: b.navigation, blocked: b.blocked.map(worldPosition),
      footprints: b.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: houses });
    const binding = compileMissionTeamOwnedBinding({ source: mixed.source, world: model }), runtime = compileMissionTeamRuntime(mixed.source, {}, binding);
    assert.equal(binding.allRequiredActionsSupported, false);
    assert.equal(binding.actions.filter(a => a.reasons.includes('dynamic-ownership-constructor-required')).length, 2);
    for (const index of [1, 2]) assert.throws(() => admitMissionTeamInput(runtime, createMissionTeamCheckpoint(runtime),
      { requests: [mixed.receipt(index, index)], commands: [] }), /owned-action-unsupported/);
    assert.equal(initial.team.world.state.ownership!.transfers.length, 0);
  }
});

async function combatFixture(profile: 'ra2' | 'yr') {
  const { ordinaryFixtureSource } = await import('./ordinary-infantry-fixture.ts');
  const { compileRuntimeIni } = await import('../../packages/content/src/runtime-ini.ts');
  const { compileTeamDefinitions } = await import('../../packages/content/src/team-definitions.ts');
  const { compileTeamProgram } = await import('../../packages/sim/src/team-runtime-program.ts');
  const { compileTeamActivationSource } = await import('../../packages/content/src/team-activation.ts');
  const { compileTeamRecruitmentCatalog } = await import('../../packages/sim/src/team-recruitment-catalog.ts');
  const { compileMissionBindings } = await import('../../packages/sim/src/mission-bindings.ts');
  const { compileMissionTeamActionSource } = await import('../../packages/sim/src/mission-team-action-source.ts');
  const { compileOrdinaryInfantryBridge } = await import('../../packages/sim/src/ordinary-infantry-bridge.ts');
  const { bindOrdinaryInfantryWorld } = await import('../../packages/sim/src/source-infantry-world.ts');
  const { compileInfantryPassageCatalog } = await import('../../packages/sim/src/infantry-passage-catalog.ts');
  const { bindInfantryPassageWorld } = await import('../../packages/sim/src/world-infantry-passage.ts');
  const { createHash } = await import('node:crypto');
  const f = ordinaryFixtureSource({ profile, subcells: true, ground: true, targetPrimary: 'Pulse', damage: 200,
    extraCountries: '1=Red\n', extraHouses: '2=Captured\n', extraMap: '[Captured]\nCountry=Red\n[Waypoints]\n0=6008\n' +
      '[Triggers]\nStart=Red,<none>,Start,0,1,1,1,0\nTransfer=Blue,<none>,Transfer,0,1,1,1,0\n' +
      '[Tags]\nShared=2,Shared,Start\nChange=2,Change,Transfer\n[Events]\nStart=1,13,0,0\nTransfer=1,13,0,0\n' +
      '[Actions]\nStart=1,4,1,Squad,0,0,0,0,A\nTransfer=1,36,0,1,0,0,0,0,A' });
  const bytes = new TextEncoder().encode('[TeamTypes]\n0=Squad\n[Squad]\nHouse=Red\nTaskForce=Troop\nScript=Route\nWaypoint=A\n[TaskForces]\n0=Troop\n[Troop]\n0=1,Walker\n[ScriptTypes]\n0=Route\n[Route]\n0=3,0\n1=50,5');
  const ai = compileRuntimeIni(profile, [{ id: 'ai', profile, order: 0, kind: 'base', sourceSha256: createHash('sha256').update(bytes).digest('hex'), bytes }]);
  const teams = compileTeamDefinitions({ definitions: f.definitions, rules: f.rules, ai, mission: f.mission });
  const program = compileTeamProgram({ teams, world: f.world, mission: f.mission, teamIds: ['team:squad'] }).program!;
  assert(program);
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const activation = compileTeamActivationSource({ teams, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const recruitment = compileTeamRecruitmentCatalog({ program, activation, rules: f.rules, mission: f.mission, actionIds: activation.plans.map(p => p.id) });
  const source = compileMissionTeamActionSource({ bindings, activation, programs: [program], spawnCatalogs: [], recruitmentCatalogs: [recruitment] });
  const house = compileMissionHouseSource({ bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const { rules, mission, ...input } = f, bridge = compileOrdinaryInfantryBridge(input);
  const slots = compileInfantryPassageCatalog({ world: f.world, definitions: f.definitions, actors: f.actors, rules, mission });
  const base = bindInfantryPassageWorld(slots, bindOrdinaryInfantryWorld(bridge, f.world.model));
  const model = createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256, definitionsSha256: base.definitionsSha256,
    entities: base.entities, navigation: base.navigation, blocked: base.blocked.map(worldPosition),
    footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), combat: base.combat!, infantryPassage: slots, ownership: house });
  const binding = compileMissionTeamOwnedBinding({ source, world: model }), runtime = compileMissionTeamRuntime(source, {}, binding), action = source.actions[0]!;
  assert.equal(binding.actions[0]!.status, 'supported');
  const receipt = { instructionId: action.instructionId, triggerId: action.triggerId, bindingId: bindings.tags[0]!.id,
    opcode: action.opcode, effectOrder: 0, emittedAtTick: 0, dueTick: 1 };
  return { model, runtime, slots, bridge, receipt, transfer: { instructionId: house.instructions.find(i => i.kind === 'action')!.instructionId, sourceHouse: 0, triggerHouse: null } };
}

test('genuine source combat and infantry slots survive recruitment, loss and release', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = await combatFixture(profile), initial = createMissionTeamCheckpoint(f.runtime);
    let current = transferMissionTeamOwnership(f.runtime, initial, f.transfer).checkpoint;
    current = admitMissionTeamInput(f.runtime, current, { requests: [f.receipt], commands: [] });
    const admissions: { nextTick: number; requests: typeof f.receipt[]; commands: unknown[]; ownershipTransfers?: typeof f.transfer[] }[] = [
      { nextTick: 0, requests: [], commands: [], ownershipTransfers: [f.transfer] }, { nextTick: 0, requests: [f.receipt], commands: [] }];
    let aliveSlots: unknown, sawDying = false, sawCompleted = false, moved = false;
    for (let tick = 0; tick < 12; tick++) {
      if (tick === 2) {
        assert.equal(current.history[0]!.kind, 'recruited');
        const commands = [{ schemaVersion: 1 as const, tick, playerId: 1, sequence: 0, kind: 'attack', payload: { entityId: 2, targetId: 1 } }];
        current = admitMissionTeamInput(f.runtime, current, { requests: [], commands }); admissions.push({ nextTick: tick, requests: [], commands });
      }
      const step = stepMissionTeamWorld(f.runtime, current), restored = stepMissionTeamWorld(f.runtime, restoreMissionTeamCheckpoint(f.runtime, current));
      assert.deepEqual(restored, step); current = step.checkpoint;
      moved ||= step.worldEvents.some(e => e.entityId === 1 && e.kind === 'moved');
      const death = current.team.world.state.combat!.deaths!.find(d => d.entityId === 1);
      if (death) {
        assert.equal(death.sourceOwner, 1); assert.equal(death.victimOwner, 2);
        if (death.corpseIndex === null) { sawDying = true; assert(current.team.world.state.infantrySlots!.some(s => s.entityId === 1)); }
        else sawCompleted = true;
      } else aliveSlots = current.team.world.state.infantrySlots;
    }
    assert(aliveSlots); assert(moved); assert(sawDying); assert(sawCompleted);
    assert.equal(current.history.at(-1)!.kind, 'released');
    const release = current.history.at(-1)!; assert.equal(release.kind === 'released' && release.reason, 'lost');
    assert.equal(current.team.world.state.ownership!.lifecycle[0]!.removedTick, 12);
    const replay = replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256, initialCheckpoint: initial,
      admissions, finalNextTick: current.team.world.nextTick, finalStateSha256: worldHash(current) });
    assert.deepEqual(replay.checkpoint, current);
    assert.equal(f.model.infantryPassage, f.slots);
  }
});

test('owned restores and ticks reserve history work before reconstruction, including exact boundaries', async () => {
  const { restoreMissionTeamOwnedWorld } = await import('../../packages/sim/src/mission-team-owned-binding.ts');
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile), initial = createMissionTeamCheckpoint(f.runtime), core = WorldSimulation.restore(f.model, initial.team.world);
    const empty = restoreMissionTeamOwnedWorld(f.binding, core.save());
    for (let n = 0; n < 32; n++) core.transferOwnership(n % 2 === 0 ? f.transfer : f.reverse);
    const full = restoreMissionTeamOwnedWorld(f.binding, core.save());
    assert(full.work > empty.work * 3);
    assert.deepEqual(restoreMissionTeamOwnedWorld(f.binding, core.save(), full.work), full);
    assert.throws(() => restoreMissionTeamOwnedWorld(f.binding, core.save(), full.work - 1), /work/);
    const rebound = bindMissionTeamActors(restoreMissionTeamContext(f.runtime, [], core.save()));
    const input = { ...initial, team: { ...initial.team, rosterSha256: rebound.sha256, world: core.save() } }, text = JSON.stringify(input);
    const step = stepMissionTeamWorld(f.runtime, input);
    assert.deepEqual(stepMissionTeamWorld(f.runtime, input, step.work), step);
    assert.throws(() => stepMissionTeamWorld(f.runtime, input, step.work - 1), /work/);
    assert.equal(JSON.stringify(input), text);
    const savedRestore = WorldSimulation.restore; let restores = 0;
    WorldSimulation.restore = () => { restores++; throw new Error('must-not-restore'); };
    try { assert.throws(() => restoreMissionTeamOwnedWorld(f.binding, core.save(), 5), /work/); }
    finally { WorldSimulation.restore = savedRestore; }
    assert.equal(restores, 0);
    const pending = prepareMissionTeamTick(f.runtime, input);
    assert.deepEqual(stepMissionTeamWorld(f.runtime, pending).checkpoint, step.checkpoint);
    assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime, JSON.stringify(pending)), pending);
    const total = replayMissionTeamWorld(f.runtime, { schemaVersion: 1, runtimeSha256: f.runtime.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, requests: [], commands: [], ownershipTransfers: [f.transfer] }], finalNextTick: 0,
      finalStateSha256: worldHash(transferMissionTeamOwnership(f.runtime, initial, f.transfer).checkpoint) }).work;
    for (const budget of [total, total - 1]) {
      const runtime = compileMissionTeamRuntime(f.source, { replayWork: budget }, f.binding), start = createMissionTeamCheckpoint(runtime);
      const changed = transferMissionTeamOwnership(runtime, start, f.transfer);
      const document = { schemaVersion: 1, runtimeSha256: runtime.sha256, initialCheckpoint: start,
        admissions: [{ nextTick: 0, requests: [], commands: [], ownershipTransfers: [f.transfer] }], finalNextTick: 0, finalStateSha256: worldHash(changed.checkpoint) };
      if (budget === total) assert.equal(replayMissionTeamWorld(runtime, document).work, total);
      else assert.throws(() => replayMissionTeamWorld(runtime, document), /work/);
    }
  }
});

test('owned input snapshots ignore get traps and reject accessors or forged byte views', () => {
  const f = fixture('ra2'), initial = createMissionTeamCheckpoint(f.runtime), failGet = { get() { throw new Error('unexpected-get'); } };
  const original = structuredClone(initial);
  Object.assign(original, { history: new Proxy(original.history, failGet), team: new Proxy(original.team, failGet) });
  assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime, new Proxy(original, failGet)), initial);
  const accessor = structuredClone(initial); Object.defineProperty(accessor, 'history', { get() { throw new Error('accessor-ran'); }, enumerable: true });
  assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, accessor), /record|descriptor|fields/);
  const bytes = new TextEncoder().encode(JSON.stringify(initial));
  Object.defineProperty(bytes, 'byteLength', { get() { throw new Error('byte-get'); } });
  Object.defineProperty(bytes, Symbol.iterator, { get() { throw new Error('iterator-get'); } });
  assert.deepEqual(restoreMissionTeamCheckpoint(f.runtime, bytes), initial);
  assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, new Proxy(bytes, failGet)), /input-bytes/);
  assert.throws(() => restoreMissionTeamCheckpoint(f.runtime, Object.setPrototypeOf({}, Uint8Array.prototype)), /input-bytes/);
});


test('unknown post-transfer mission gates only changed actors, without losing complete action coverage', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile, '[Sleep]\nRecruitable=no'), initial = createMissionTeamCheckpoint(f.runtime);
    assert.equal(f.binding.allRequiredActionsSupported, true); assert.equal(f.binding.allRequiredTransfersSupported, false);
    const changed = transferMissionTeamOwnership(f.runtime, initial, f.transfer).checkpoint;
    const attempted = stepMissionTeamWorld(f.runtime, stepMissionTeamWorld(f.runtime,
      admitMissionTeamInput(f.runtime, changed, { requests: [f.receipt(0, 0)], commands: [] })).checkpoint);
    assert(attempted.actionEvents.some(e => e.kind === 'blocked')); assert.equal(attempted.checkpoint.history.length, 0);
    const unchanged = fixture(profile, '[Sleep]\nRecruitable=no', 'Commander');
    const claim = stepMissionTeamWorld(unchanged.runtime, stepMissionTeamWorld(unchanged.runtime,
      admitMissionTeamInput(unchanged.runtime, createMissionTeamCheckpoint(unchanged.runtime), { requests: [unchanged.receipt(0, 0)], commands: [] })).checkpoint);
    assert(claim.actionEvents.some(e => e.kind === 'recruited'));
  }
});
