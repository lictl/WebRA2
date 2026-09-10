// SPDX-License-Identifier: GPL-3.0-or-later
// Original complete miniature sources and authoritative combat, never retail rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ordinaryFixtureSource } from './ordinary-infantry-fixture.ts';
import { compileMissionBindings, prepareMissionBindings, missionBindingSourceContext } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileMissionObjectEventSource } from '../../packages/sim/src/mission-object-event-source.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionProgram, MissionLogic, replayMission, MISSION_TIMING_POLICY, type MissionObjectEventObservation } from '../../packages/sim/src/mission-logic.ts';
import { compileMissionWorld, createMissionWorld, restoreMissionWorld, admitMissionWorld, stepMissionWorld, replayMissionWorld, isMissionWorldPresentation } from '../../packages/sim/src/mission-world.ts';
import { compileOrdinaryInfantryBridge } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { bindOrdinaryInfantryWorld } from '../../packages/sim/src/source-infantry-world.ts';
import { compileMissionCues } from '../../packages/content/src/mission-cues.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
const digest = async (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function fixture({ profile = 'ra2' as 'ra2'|'yr', mode = 2, event = '6,0,999', actions = 'Start=1,28,0,1,0,0,0,0,A',
  eventCount = 1, startAttached = '<none>', extraTriggers = '', extraTags = '', extraEvents = '', extraActions = '', extra = '', damage = 10, extraInfantryRows = '', targetTag = 'Shared', sourceTag = 'None' } = {}) {
  return ordinaryFixtureSource({ profile, targetTag, sourceTag, damage, extraInfantryRows, extraMap:
    `[Triggers]\nStart=Blue,${startAttached},Original,0,1,1,1,0\n${extraTriggers}\n[Tags]\nShared=${mode},Original,Start\n${extraTags}\n[Events]\nStart=${eventCount},${event}\n${extraEvents}\n[Actions]\n${actions}\n${extraActions}\n${extra}` });
}
async function setup(options: Parameters<typeof fixture>[0] = {}, presentation = false, cellEvents = false) {
  const f = fixture(options), bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const objects = compileMissionObjectEventSource({ bindings }); assert.deepEqual(objects.diagnostics, []);
  const cells = cellEvents ? compileMissionCellEntrySource({ bindings }) : undefined;
  const cues = presentation ? compileMissionCues({ profile: f.mission.source.profile, mission: { path: 'original.map', ...f.mission }, strings: null }) : undefined;
  const prepared = await prepareMissionBindings(bindings, cues, cells, objects);
  assert.ok(prepared.authority, JSON.stringify(prepared.compilation?.diagnostics));
  const flags = compileMissionInitialFlags({ bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  const { rules, mission, ...bridgeInput } = f;
  const bridge = compileOrdinaryInfantryBridge(bridgeInput), world = bindOrdinaryInfantryWorld(bridge, f.world.model);
  const model = compileMissionWorld({ world, bindings: prepared.authority, flags });
  const vm = () => MissionLogic.create(prepared.authority!.program, { bindings: prepared.authority!.bindings, globals: flags.globals, locals: flags.locals });
  return { f, bindings, objects, cells, cues, prepared, flags, world, model, vm };
}
const attack = { schemaVersion: 1 as const, tick: 0, playerId: 0, sequence: 0, kind: 'attack', payload: { entityId: 1, targetId: 2 } };
const observation = (opcode: MissionObjectEventObservation['opcode'], sourceId: number|null = 1): MissionObjectEventObservation => ({ opcode, entityId: 2, sourceId });
const assignments = (effects: readonly { opcode: number }[]) => effects.filter(e => e.opcode === 28).length;

test('object predicates require genuine complete source joins and exact original operands', async () => {
  for (const profile of ['ra2','yr'] as const) {
    const s = await setup({ profile });
    assert.equal((await prepareMissionBindings(s.bindings)).authority, null);
    await assert.rejects(prepareMissionBindings(s.bindings, undefined, undefined, { ...s.objects }), /object-source/);
    const other = await setup({ profile, event: '7,0,999' });
    await assert.rejects(prepareMissionBindings(other.bindings, undefined, undefined, s.objects), /object-source/);
    const logic = structuredClone(missionBindingSourceContext(s.bindings).logic);
    Object.defineProperty(logic.events[0]!.instructions[0]!, 'parameters', { value: ['0','998'] });
    const changed = await compileMissionProgram(logic, { contentIdentity: s.world.contentIdentity, difficulty: 1, timingPolicy: MISSION_TIMING_POLICY }, digest, undefined, undefined, s.objects);
    assert.equal(changed.program, null); assert.ok(changed.diagnostics.some(d => d.code === 'unsupported-object-event-source'));
    await assert.rejects(replayMission(s.prepared.authority!.program, {} as never, digest), /requires-world/);
    const withUnknown = fixture({ profile, extraEvents: 'Other=1,4,0,0', extraTriggers: 'Other=Blue,<none>,Other,0,1,1,1,0', extraTags: 'More=2,Other,Other', extraActions: 'Other=1,28,0,2,0,0,0,0,A' });
    const b = compileMissionBindings({ world: withUnknown.world, definitions: withUnknown.definitions, rules: withUnknown.rules, mission: withUnknown.mission, difficulty: 1 });
    assert.equal((await prepareMissionBindings(b, undefined, undefined, compileMissionObjectEventSource({ bindings: b }))).authority, null);
  }
});

test('literal attacker house and actual callback kind control event44, retaining shared-tag dispatch', async () => {
  for (const profile of ['ra2','yr'] as const) for (const selector of [0,1]) {
    const s = await setup({ profile, event: `44,0,${selector}`, sourceTag: 'Shared' }), vm = s.vm();
    assert.equal(s.objects.bindingGroups[0]!.objectEntityIds.length, 2);
    assert.equal(assignments(vm.stepObjectEvents([observation(6)]).effects), 0);
    const result = vm.stepObjectEvents([observation(44,1), observation(44,2)]);
    assert.equal(assignments(result.effects), 1);
    assert.equal(result.effects.find(e => e.opcode === 28)!.bindingId, s.objects.actors[1]!.bindingId);
    assert.equal(assignments(vm.step().effects), 0);
  }
});

test('death latches persist only in mode2 and attacked predicates remain transient', async () => {
  for (const profile of ['ra2','yr'] as const) for (const mode of [0,2]) {
    const s = await setup({ profile, mode, eventCount: 2, event: '48,0,123,27,0,3' }), vm = s.vm();
    assert.equal(assignments(vm.stepObjectEvents([observation(48, null)]).effects), 0);
    const boundary = vm.save(), restored = MissionLogic.restore(s.prepared.authority!.program, boundary);
    restored.enqueue([{ tick: 2, sequence: 0, kind: 'global', index: 3, value: true }]);
    assert.equal(assignments(restored.step().effects), 0);
    assert.equal(assignments(restored.step().effects), mode === 2 ? 1 : 0);
    const attacked = await setup({ profile, mode, eventCount: 2, event: '6,0,0,27,0,3' }), transient = attacked.vm();
    transient.stepObjectEvents([observation(6)]);
    transient.enqueue([{ tick: 1, sequence: 0, kind: 'global', index: 3, value: true }]);
    assert.equal(assignments(transient.step().effects), 0);
  }
});

test('private authoritative hits dispatch before animation completion and never from the completion trace', async () => {
  for (const profile of ['ra2','yr'] as const) {
    const s = await setup({ profile, event: '48,0,777' });
    let state = admitMissionWorld(s.model, createMissionWorld(s.model), { commands: [attack], flags: [] });
    let deaths = 0, finished = 0;
    for (let tick = 0; tick < 110; tick++) {
      const result = stepMissionWorld(s.model, state), dying = result.worldEvents.some(e => e.kind === 'dying');
      assert.equal(assignments(result.effects), dying ? 1 : 0);
      deaths += assignments(result.effects); finished += result.worldEvents.filter(e => e.kind === 'destroyed').length;
      state = restoreMissionWorld(s.model, JSON.stringify(result.checkpoint));
    }
    assert.equal(deaths, 1); assert.equal(finished, 1); assert.equal(state.world.state.entities[1]!.health, 0);
  }
});

test('nonfatal callbacks arrive in6/44 order and a lethal infantry callback adds6 then7 then48', async () => {
  for (const profile of ['ra2','yr'] as const) {
    const s = await setup({ profile, event: '6,0,0', startAttached: 'Owned', extraTriggers: 'Owned=Blue,Killed,Original,0,1,1,1,0\nKilled=Blue,Dead,Original,0,1,1,1,0\nDead=Blue,<none>,Original,0,1,1,1,0',
      extraEvents: 'Owned=1,44,0,0\nKilled=1,7,0,0\nDead=1,48,0,0', extraActions: 'Owned=1,28,0,2,0,0,0,0,A\nKilled=1,28,0,3,0,0,0,0,A\nDead=1,28,0,4,0,0,0,0,A' });
    let state = admitMissionWorld(s.model, createMissionWorld(s.model), { commands: [attack], flags: [] });
    for (let tick = 0; tick < 110; tick++) {
      const result = stepMissionWorld(s.model, state);
      if (result.worldEvents.some(e => e.kind === 'damaged')) {
        const lethal = result.worldEvents.some(e => e.kind === 'dying');
        const selected = result.effects.filter(e => e.opcode === 28).map(e => e.target);
        assert.deepEqual(selected, lethal ? ['global:1','global:3','global:4','global:3'] : ['global:1','global:2']);
      }
      state = result.checkpoint;
    }
  }
});

test('generic observation failure is atomic and cannot impersonate private source presentation', async () => {
  const s = await setup(), vm = s.vm(), initial = vm.save();
  assert.throws(() => vm.stepObjectEvents([observation(6), { ...observation(6), entityId: 999 }]), /observation/);
  assert.deepEqual(vm.save(), initial);
  let reads = 0; const hostile = Object.defineProperty({ ...observation(6) }, 'sourceId', { get() { reads++; return 1; } });
  assert.throws(() => vm.stepObjectEvents([hostile])); assert.equal(reads, 0); assert.deepEqual(vm.save(), initial);
  assert.throws(() => vm.stepObjectEvents([observation(44, null)]), /observation/); assert.deepEqual(vm.save(), initial);
  assert.throws(() => vm.stepObjectEvents(Array.from({ length: 8193 }, () => observation(6)))); assert.deepEqual(vm.save(), initial);
  assert.equal(isMissionWorldPresentation(s.model, vm.stepObjectEvents([observation(6)])), false);
  const admitted = admitMissionWorld(s.model, createMissionWorld(s.model), { commands: [attack], flags: [] }), copy = structuredClone(admitted);
  const measured = stepMissionWorld(s.model, admitted, 4);
  assert.throws(() => stepMissionWorld(s.model, admitted, 4, measured.work - 1), /work-limit/); assert.deepEqual(admitted, copy);
});

test('source forcing/deletion preserves entered action order across several actual hits in one tick', async () => {
  for (const profile of ['ra2','yr'] as const) {
    const s = await setup({ profile, damage: 50, sourceTag: 'OtherTag',
      extraInfantryRows: '2=Commander,Walker,256,5,6,0,Guard,0,None,0,-1,0,1,1\n',
      actions: 'Start=3,22,2,Other,0,0,0,0,A,12,2,Start,0,0,0,0,A,28,0,1,0,0,0,0,A',
      extraTriggers: 'Other=Blue,<none>,Other,0,1,1,1,0', extraTags: 'OtherTag=2,Original,Other',
      extraEvents: 'Other=1,0,0,0', extraActions: 'Other=1,28,0,2,0,0,0,0,A' });
    const commands = [attack, { ...attack, sequence: 1, payload: { entityId: 3, targetId: 2 } }];
    const start = admitMissionWorld(s.model, createMissionWorld(s.model), { commands, flags: [] });
    const result = stepMissionWorld(s.model, start, 4);
    assert.equal(result.worldEvents.filter(e => e.kind === 'damaged').length, 2);
    assert.equal(new Set(result.worldEvents.filter(e => e.kind === 'damaged').map(e => e.tick)).size, 1);
    assert.deepEqual(result.effects.map(e => e.opcode), [22,28,12,28]);
    assert.equal(result.checkpoint.mission.globals[1], true); assert.equal(result.checkpoint.mission.globals[2], true);
    assert.equal(result.checkpoint.mission.bindings.find(b => b.id === 'binding:tag:shared')!.active, false);
    assert.deepEqual(restoreMissionWorld(s.model, result.checkpoint), result.checkpoint);
  }
});

test('every boundary and replay retain pending fire, death latches, cell events and ordered source cues', async () => {
  for (const profile of ['ra2','yr'] as const) {
    const s = await setup({ profile, damage: 100, event: '48,0,0',
      actions: 'Start=2,48,0,0,0,0,0,0,A,28,0,1,0,0,0,0,A',
      extraTriggers: 'Cross=Blue,<none>,Cross,0,1,1,1,0', extraTags: 'CrossTag=2,Original,Cross',
      extraEvents: 'Cross=1,1,0,0', extraActions: 'Cross=1,48,0,0,0,0,0,0,A',
      extra: '[CellTags]\n7006=CrossTag\n[Waypoints]\n0=6006' }, true, true);
    const initial = createMissionWorld(s.model), first = { commands: [attack], flags: [] };
    const later = { commands: [{ schemaVersion: 1 as const, tick: 6, playerId: 0, sequence: 1, kind: 'move', payload: { entityId: 1, x: 6, y: 7 } }],
      flags: [{ tick: 8, sequence: 0, kind: 'local' as const, index: 2, value: true }] };
    let state = admitMissionWorld(s.model, initial, first);
    const checkpoints = [state], effects: unknown[] = [], requests: unknown[] = [], worldEvents: unknown[] = [];
    for (let tick = 0; tick < 18; tick++) {
      if (tick === 4) state = admitMissionWorld(s.model, state, later);
      const result = stepMissionWorld(s.model, state); effects.push(...result.effects); requests.push(...result.presentation!.requests); worldEvents.push(...result.worldEvents);
      state = restoreMissionWorld(s.model, JSON.stringify(result.checkpoint)); checkpoints.push(state);
    }
    assert.equal(requests.length, 2); assert.equal(state.presentation!.nextSequence, 2); assert.equal(state.mission.locals[2], true);
    assert.equal(state.world.state.entities[1]!.health, 0); assert.equal(state.world.state.entities[0]!.y, 7);
    const beforeLater = stepMissionWorld(s.model, checkpoints[0]!, 4);
    const rest = stepMissionWorld(s.model, admitMissionWorld(s.model, beforeLater.checkpoint, later), 14);
    assert.deepEqual(rest.checkpoint, state); assert.deepEqual([...beforeLater.effects, ...rest.effects], effects);
    assert.deepEqual([...beforeLater.worldEvents, ...rest.worldEvents], worldEvents);
    assert.deepEqual([...beforeLater.presentation!.requests, ...rest.presentation!.requests], requests);
    for (let at = 0; at < 18; at++) {
      const replay = replayMissionWorld(s.model, { schemaVersion: 1 as const, modelSha256: s.model.sha256, initialCheckpoint: checkpoints[at],
        admissions: at <= 4 ? [{ nextTick: 4, input: later }] : [], finalNextTick: 18, finalStateSha256: worldHash(state) });
      assert.deepEqual(replay.checkpoint, state);
      assert.deepEqual(replay.effects, effects.filter((e: any) => e.tick >= at));
      assert.deepEqual(replay.worldEvents, worldEvents.filter((e: any) => e.tick >= at));
      assert.deepEqual(replay.presentation!.requests, requests.filter((e: any) => e.tick >= at));
      assert.equal(isMissionWorldPresentation(s.model, replay.presentation), true);
    }
    const all = replayMissionWorld(s.model, { schemaVersion: 1 as const, modelSha256: s.model.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 0, input: first }, { nextTick: 4, input: later }], finalNextTick: 18, finalStateSha256: worldHash(state) });
    assert.deepEqual(all.checkpoint, state); assert.deepEqual(all.presentation!.requests, requests);
  }
});
