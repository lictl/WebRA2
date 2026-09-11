// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { stationaryFixture } from './mission-stationary-fixture.ts';
import { createMissionStationaryWitness, advanceMissionStationaryWitness, observeMissionStationaryTeams,
  missionStationaryGuardCandidate, saveMissionStationaryWitness, restoreMissionStationaryWitness } from '../../packages/sim/src/mission-stationary-policy.ts';
import { WorldSimulation, readWorldStationaryBoundary, worldStationaryBoundaryHash, readWorldStationaryOperation } from '../../packages/sim/src/world.ts';
import { compileMissionTeamRuntime, restoreMissionTeamContext } from '../../packages/sim/src/mission-team-context.ts';
import { createMissionTeamCheckpoint, transferMissionTeamOwnership, admitMissionTeamInput, stepMissionTeamWorld, missionTeamWorldStep } from '../../packages/sim/src/mission-team-runtime.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';

function setup(profile: 'ra2' | 'yr', options: Parameters<typeof stationaryFixture>[1] = {}) {
  const f = stationaryFixture(profile, options), created = createMissionStationaryWitness(f.stationary);
  const runtime = compileMissionTeamRuntime(f.source, {}, f.binding);
  const context = (world: WorldSimulation) => restoreMissionTeamContext(runtime, [], world.save());
  const candidate = (w: typeof created.witness, world = created.world, id = 1) => missionStationaryGuardCandidate(f.stationary, w,
    context(world), world, f.source.actions[0]!.instructionId, id);
  return { ...f, ...created, runtime, context, candidate };
}
const command = (kind: 'move' | 'stop', sequence: number, tick = 0) => ({ schemaVersion: 1, tick, playerId: 1, sequence, kind,
  payload: kind === 'move' ? { entityId: 1, x: 3, y: 2 } : { entityId: 1 } });

test('untouched Guard survives genuine transfers and idle ticks; Sleep stays unverified', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = setup(profile), old = saveMissionStationaryWitness(f.stationary, f.witness).save;
    assert.equal(f.candidate(f.witness).eligible, true);
    let witness = advanceMissionStationaryWitness(f.stationary, f.witness, f.world.transferOwnership(f.transfer)).witness;
    for (let i = 0; i < 4; i++) witness = advanceMissionStationaryWitness(f.stationary, witness, f.world.step()).witness;
    assert.equal(f.candidate(witness).eligible, true); assert.equal(f.candidate(witness, f.world, 2).eligible, false);
    const saved = saveMissionStationaryWitness(f.stationary, witness).save;
    assert.equal(saved.actors[0]!.currentMission, 5); assert.equal(saved.actors[0]!.queuedMission, -1);
    assert.equal(saved.actors[0]!.ownershipRevision, 1); assert.equal(saved.actors[1]!.currentMission, null);
    assert.equal(saved.journal.length, 2); assert.equal(saved.journal[1]!.repetitions, 4);
    assert.deepEqual(saveMissionStationaryWitness(f.stationary, f.witness).save, old);
    const restored = restoreMissionStationaryWitness(f.stationary, saved, f.world.save(), f.context(f.world));
    assert.deepEqual(saveMissionStationaryWitness(f.stationary, restored.witness).save, saved);
    assert.deepEqual(restored.world.save(), f.world.save());
  }
});

test('admitted orders invalidate immediately and returning to rest cannot mint a new certificate', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = setup(profile), before = f.world.save();
    const commands = f.world.admitCommands([command('move', 0), command('stop', 1)]);
    // Public receipt mutation does not alter the privately captured operation.
    (commands[0]!.payload as Record<string, number>).entityId = 2; commands.splice(1, 1);
    let witness = advanceMissionStationaryWitness(f.stationary, f.witness, commands).witness;
    assert.equal(f.candidate(witness).eligible, false);
    witness = advanceMissionStationaryWitness(f.stationary, witness, f.world.step()).witness;
    assert.equal(f.world.save().state.entities[0]!.goal, null);
    assert.equal(f.world.save().state.entities[0]!.x, before.state.entities[0]!.x);
    const saved = saveMissionStationaryWitness(f.stationary, witness).save;
    assert(saved.actors[0]!.reasons.includes('command'));
    assert.deepEqual(restoreMissionStationaryWitness(f.stationary, saved, f.world.save(), f.context(f.world)).world.save(), f.world.save());
    const forged = structuredClone(saved); Object.assign(forged.actors[0]!, { currentMission: 5, queuedMission: -1, reasons: [], invalidatedAtTick: null });
    assert.throws(() => restoreMissionStationaryWitness(f.stationary, forged, f.world.save(), f.context(f.world)), /reconstruction/);
    const omitted = structuredClone(saved); (omitted.journal as unknown[]).shift();
    assert.throws(() => restoreMissionStationaryWitness(f.stationary, omitted, f.world.save(), f.context(f.world)), /reconstruction/);
  }
});

test('gaps, copied receipts, cross-source receipts and failed transactions cannot advance a witness', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = setup(profile), before = f.world.save();
    assert.throws(() => f.world.admitCommands([command('move', -1)])); assert.deepEqual(f.world.save(), before);
    const first = f.world.step(), second = f.world.step();
    assert.throws(() => advanceMissionStationaryWitness(f.stationary, f.witness, second), /clock|gap/);
    for (const receipt of [structuredClone(first), new Proxy(first, {}), setup(profile).world.step()])
      assert.throws(() => advanceMissionStationaryWitness(f.stationary, f.witness, receipt), /receipt/);
    const updated = advanceMissionStationaryWitness(f.stationary, f.witness, first).witness;
    assert.throws(() => advanceMissionStationaryWitness(f.stationary, updated, first), /clock|gap/);
    assert.throws(() => advanceMissionStationaryWitness(f.stationary, { ...f.witness }, first), /brand/);
    assert.throws(() => advanceMissionStationaryWitness(setup(profile).stationary, f.witness, first), /source/);
    assert.equal(advanceMissionStationaryWitness(f.stationary, updated, second).witness.nextTick, 2);
  }
});

test('restored core forks join by charged digest and subsequent uninterrupted steps use exact tokens', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = setup(profile), fork = WorldSimulation.restore(f.model, f.world.save());
    const first = fork.step(), a = advanceMissionStationaryWitness(f.stationary, f.witness, first);
    const second = fork.step(), b = advanceMissionStationaryWitness(f.stationary, a.witness, second);
    assert(a.work > b.work); assert.equal(b.witness.nextTick, 2);
    const raw = readWorldStationaryOperation(f.model, second), boundary = readWorldStationaryBoundary(fork);
    assert.equal(raw.toBoundary, boundary.boundary);
    const h = worldStationaryBoundaryHash(f.model, raw.toBoundary);
    assert.equal(h.sha256, worldHash(fork.save()));
    assert.deepEqual(worldStationaryBoundaryHash(f.model, raw.toBoundary, h.work), h);
    assert.throws(() => worldStationaryBoundaryHash(f.model, raw.toBoundary, h.work - 1), /work/);
    assert.throws(() => worldStationaryBoundaryHash(f.model, { ...raw.toBoundary }), /boundary/);
  }
});

test('Flash-only claims and release remain disqualifying without movement', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = setup(profile, { rules: '[Sleep]\nRecruitable=yes',
      rows: '0=Rival,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1' });
    let checkpoint = createMissionTeamCheckpoint(f.runtime), witness = f.witness;
    const transfer = transferMissionTeamOwnership(f.runtime, checkpoint, f.transfer); checkpoint = transfer.checkpoint;
    witness = advanceMissionStationaryWitness(f.stationary, witness, transfer.result).witness;
    checkpoint = admitMissionTeamInput(f.runtime, checkpoint, { requests: [f.receipt(0, 0)], commands: [] });
    for (let tick = 0; tick < 5; tick++) {
      const result = stepMissionTeamWorld(f.runtime, checkpoint); checkpoint = result.checkpoint;
      witness = advanceMissionStationaryWitness(f.stationary, witness, missionTeamWorldStep(result).step).witness;
      witness = observeMissionStationaryTeams(f.stationary, witness, restoreMissionTeamContext(f.runtime, checkpoint.history, checkpoint.team.world)).witness;
    }
    assert(checkpoint.history.some(r => r.kind === 'released'));
    const context = restoreMissionTeamContext(f.runtime, checkpoint.history, checkpoint.team.world), world = WorldSimulation.restore(f.model, checkpoint.team.world);
    assert.throws(() => missionStationaryGuardCandidate(f.stationary, f.witness, context, f.world,
      f.source.actions[0]!.instructionId, 1), /query-team-history/);
    assert.equal(missionStationaryGuardCandidate(f.stationary, witness, context, world, f.source.actions[0]!.instructionId, 1).eligible, false);
    const saved = saveMissionStationaryWitness(f.stationary, witness).save;
    assert(saved.actors[0]!.reasons.includes('team'));
    assert.deepEqual(saveMissionStationaryWitness(f.stationary, restoreMissionStationaryWitness(f.stationary, saved, checkpoint.team.world, context).witness).save, saved);
    assert.throws(() => observeMissionStationaryTeams(f.stationary, witness, restoreMissionTeamContext(f.runtime, [], checkpoint.team.world)), /history-gap/);
    assert.deepEqual(observeMissionStationaryTeams(f.stationary, witness, context, 1), { witness, work: 1 });
    assert.throws(() => observeMissionStationaryTeams(f.stationary, witness, context, 0), /work/);
  }
});

test('unchanged genuine team histories and indexed Guard queries have constant logical work', () => {
  const f = setup('yr'), context = f.context(f.world);
  assert.deepEqual(observeMissionStationaryTeams(f.stationary, f.witness, context, 1), { witness: f.witness, work: 1 });
  assert.equal(f.candidate(f.witness, f.world).work, 2);
  const candidate = missionStationaryGuardCandidate(f.stationary, f.witness, context, f.world,
    f.source.actions[0]!.instructionId, 1, 2);
  assert.equal(candidate.eligible, true);
  assert.throws(() => missionStationaryGuardCandidate(f.stationary, f.witness, context, f.world,
    f.source.actions[0]!.instructionId, 1, 1), /work/);
  assert.throws(() => observeMissionStationaryTeams(f.stationary, f.witness, { ...context }), /brand/);
});

test('journal and exact work limits fail without changing earlier witnesses', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = setup(profile), before = saveMissionStationaryWitness(f.stationary, f.witness).save;
    const receipt = f.world.step(), full = advanceMissionStationaryWitness(f.stationary, f.witness, receipt);
    assert.deepEqual(advanceMissionStationaryWitness(f.stationary, f.witness, receipt, full.work), full);
    assert.throws(() => advanceMissionStationaryWitness(f.stationary, f.witness, receipt, full.work - 1), /work/);
    for (const cap of [{ journalRows: 0 }, { operations: 0 }, { ticks: 0 }]) {
      const c = createMissionStationaryWitness(f.stationary, cap);
      assert.throws(() => advanceMissionStationaryWitness(f.stationary, c.witness, c.world.step()), /limit|budget/);
    }
    const c = createMissionStationaryWitness(f.stationary, { commands: 0 });
    assert.throws(() => advanceMissionStationaryWitness(f.stationary, c.witness, c.world.admitCommands([command('stop', 0)])), /budget/);
    assert.deepEqual(saveMissionStationaryWitness(f.stationary, f.witness).save, before);
  }
});

test('long idle journals retain call boundaries and restore without per-tick rows', () => {
  const f = setup('ra2'); let witness = f.witness;
  for (let tick = 0; tick < 600; tick++) witness = advanceMissionStationaryWitness(f.stationary, witness, f.world.step()).witness;
  const saved = saveMissionStationaryWitness(f.stationary, witness).save;
  assert.equal(saved.journal.length, 1); assert.equal(saved.journal[0]!.repetitions, 600);
  const restored = restoreMissionStationaryWitness(f.stationary, saved, f.world.save(), f.context(f.world));
  assert.deepEqual(saveMissionStationaryWitness(f.stationary, restored.witness).save, saved);
  assert.equal(f.candidate(restored.witness, restored.world).eligible, true);
});
