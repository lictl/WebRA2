// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature missions; no retail rows, recordings or native expected saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseFixture } from './mission-house-fixture.ts';
import { prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { createWorldModel, worldPosition, worldHash } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { MissionLogic, missionProgramHouseSource } from '../../packages/sim/src/mission-logic.ts';
import { createMissionWorld, compileMissionWorld, stepMissionWorld, restoreMissionWorld, replayMissionWorld } from '../../packages/sim/src/mission-world.ts';
import { createMissionActionWorldContext } from '../../packages/sim/src/mission-action-world-context.ts';

const mission = (target = '1', opcode = 36) => `[Triggers]
Start=Blue,<none>,Transfer,0,1,1,1,0
Check=Blue,<none>,Population,0,1,1,1,0
[Tags]
AStart=0,Initial,Start
ZCheck=0,After,Check
[Events]
Start=1,8,0,0
Check=3,9,0,0,10,0,0,11,0,0
[Actions]
Start=1,${opcode},0,${target},0,0,0,0,A
Check=1,28,0,1,0,0,0,0,A`;
async function fixture(profile: 'ra2' | 'yr', text = mission()) {
  const f = houseFixture({ profile, extraMap: text,
    infantryRows: '0=Commander,Walker,256,2,2,0,Guard,0,AStart\n1=Commander,Walker,256,2,3,0,Guard,0,None\n2=Rival,Walker,256,4,2,0,Guard,0,AStart' });
  const prepared = await prepareMissionBindings(f.bindings, undefined, undefined, undefined, undefined, undefined, { houseSource: f.source });
  const base = f.world.model;
  const world = createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256,
    definitionsSha256: base.definitionsSha256, entities: base.entities, navigation: base.navigation,
    blocked: base.blocked.map(worldPosition), footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: f.source });
  const flags = compileMissionInitialFlags({ bindings: f.bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  return { f, prepared, flags, world };
}

test('source-bound transfers are visible to a later population predicate in the same poll', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const s = await fixture(profile); assert(s.prepared.authority, JSON.stringify(s.prepared));
    const model = compileMissionWorld({ world: s.world, bindings: s.prepared.authority, flags: s.flags });
    const before = createMissionWorld(model), step = stepMissionWorld(model, before);
    assert.deepEqual(before.world.state.entities.map(e => e.owner), [0, 0, 1]);
    assert.deepEqual(step.checkpoint.world.state.entities.map(e => e.owner), [1, 1, 1]);
    assert.equal(step.checkpoint.mission.globals[1], true);
    assert.deepEqual(step.effects.map(e => [e.opcode, e.kind]), [[36, 'house-transfer'], [28, 'action']]);
    assert.equal(step.checkpoint.world.state.ownership!.transfers.length, 1);
    assert.equal(step.checkpoint.world.state.ownership!.transfers[0]!.triggerHouse, null);
    assert.equal(step.checkpoint.world.state.ownership!.transfers[0]!.sourceHouse, 0);
    assert.equal(step.checkpoint.world.nextTick, 1); assert.equal(step.checkpoint.mission.nextTick, 1);
    assert.deepEqual(restoreMissionWorld(model, step.checkpoint), step.checkpoint);
    const replay = { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: before, admissions: [],
      finalNextTick: 1, finalStateSha256: worldHash(step.checkpoint) };
    assert.deepEqual(replayMissionWorld(model, replay).checkpoint, step.checkpoint);
    const resumed = stepMissionWorld(model, step.checkpoint, 2);
    assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, step.checkpoint), 2).checkpoint, resumed.checkpoint);
  }
});

test('tag transfer retains source trigger membership rather than only a firing actor', async () => {
  const s = await fixture('ra2', mission('1', 14)); assert(s.prepared.authority);
  const model = compileMissionWorld({ world: s.world, bindings: s.prepared.authority, flags: s.flags });
  const result = stepMissionWorld(model, createMissionWorld(model));
  assert.deepEqual(result.checkpoint.world.state.entities.map(e => e.owner), [1, 0, 1]);
  assert.deepEqual(result.checkpoint.world.state.ownership!.transfers[0]!.entityIds, [1, 3]);
  assert.equal(result.checkpoint.mission.globals[1], false);
});

test('exhausted aggregate work leaves both caller checkpoint and VM unchanged', async () => {
  const s = await fixture('ra2'); assert(s.prepared.authority);
  const model = compileMissionWorld({ world: s.world, bindings: s.prepared.authority, flags: s.flags });
  const before = createMissionWorld(model), hash = worldHash(before), result = stepMissionWorld(model, before);
  assert.deepEqual(stepMissionWorld(model, before, 1, result.work).checkpoint, result.checkpoint);
  assert.throws(() => stepMissionWorld(model, before, 1, result.work - 1), /work/); assert.equal(worldHash(before), hash);
  const external = WorldSimulation.create(s.world); external.step(); const worldText = external.saveText();
  const vm = MissionLogic.restore(s.prepared.authority.program, before.mission), vmText = vm.saveText();
  const context = createMissionActionWorldContext({ world: s.world, bindings: s.prepared.authority,
    checkpoint: external.save(), missionNextTick: 0 }, 100);
  assert.throws(() => vm.stepWorldContext(context), /work/);
  assert.equal(vm.saveText(), vmText); assert.equal(external.saveText(), worldText);
  assert.throws(() => vm.stepWorldContext(context), /context/);
});

test('genuine source and one-use world context are required; generic VM calls cannot grant effects', async () => {
  const s = await fixture('ra2'); assert(s.prepared.authority);
  const p = s.prepared.authority.program; assert.equal(missionProgramHouseSource(p), s.f.source);
  const initial = MissionLogic.create(p, { bindings: s.prepared.authority.bindings, globals: s.flags.globals, locals: s.flags.locals });
  assert.throws(() => initial.step(), /world-context-required/);
  const w = WorldSimulation.create(s.world); w.step();
  const args = { world: s.world, bindings: s.prepared.authority, checkpoint: w.save(), missionNextTick: 0 };
  let checkpointReads = 0;
  const untouched = new Proxy(args.checkpoint, { getOwnPropertyDescriptor() { checkpointReads++; throw new Error('unexpected-checkpoint-read'); } });
  assert.throws(() => createMissionActionWorldContext({ ...args, checkpoint: untouched }, 0), /work-limit/);
  assert.equal(checkpointReads, 0);
  assert.throws(() => createMissionActionWorldContext({ ...args, bindings: { ...args.bindings } }, 100000), /authority/);
  assert.throws(() => createMissionActionWorldContext({ ...args, missionNextTick: 1 }, 100000), /clock/);
  const context = createMissionActionWorldContext(args, 100000);
  assert.throws(() => initial.stepWorldContext({ ...context }), /context/);
  const result = initial.stepWorldContext(context); assert.equal(result.nextTick, 1);
  assert.throws(() => initial.stepWorldContext(context), /context/);
  await assert.rejects(prepareMissionBindings(s.f.bindings, undefined, undefined, undefined, undefined, undefined,
    { houseSource: { ...s.f.source } }), /house-source/);
  const other = await fixture('ra2');
  await assert.rejects(prepareMissionBindings(s.f.bindings, undefined, undefined, undefined, undefined, undefined,
    { houseSource: other.f.source }), /house-source/);
  assert.throws(() => compileMissionWorld({ world: s.f.world.model, bindings: s.prepared.authority!, flags: s.flags }), /house-source/);
});

test('YR current event-derived house remains explicitly unadmitted and unrelated diagnostics remain', async () => {
  const s = await fixture('yr', mission('8997'));
  assert.equal(s.prepared.authority, null);
  assert(s.prepared.compilation!.diagnostics.some(d => d.code === 'unsupported-current-trigger-house'));
  const unsupported = await fixture('ra2', mission().replace('Check=1,28,', 'Check=1,63,'));
  assert.equal(unsupported.prepared.authority, null);
  assert(unsupported.prepared.compilation!.diagnostics.some(d => d.code === 'unsupported-action-opcode'));
});
