// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature missions; no retail data or native expected output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionBindingsFixture } from './mission-bindings-fixture.ts';
import { compileMissionBindings, prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags, isMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileMissionWorld, createMissionWorld, restoreMissionWorld, admitMissionWorld, stepMissionWorld, replayMissionWorld } from '../../packages/sim/src/mission-world.ts';
import { createWorldModel } from '../../packages/sim/src/world-model.ts';
import { worldHash, worldPosition } from '../../packages/sim/src/world-values.ts';
import { ordinaryFixtureSource } from './ordinary-infantry-fixture.ts';
import { compileOrdinaryInfantryBridge } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { bindOrdinaryInfantryWorld } from '../../packages/sim/src/source-infantry-world.ts';
import { compileInfantryPassageCatalog } from '../../packages/sim/src/infantry-passage-catalog.ts';
import { bindInfantryPassageWorld } from '../../packages/sim/src/world-infantry-passage.ts';
function input({ profile = 'ra2' as 'ra2' | 'yr', variables = '', event = '13,0,1', action = '28,0,1,0,0,0,0,A' } = {}) {
  return missionBindingsFixture({ profile, extraMap: `[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=0,Sharing,Start\n[Events]\nStart=1,${event}\n[Actions]\nStart=1,${action}\n[VariableNames]\n${variables}` });
}
async function setup(options: Parameters<typeof input>[0] = {}) {
  const f = input(options), catalog = compileMissionBindings(f), prepared = await prepareMissionBindings(catalog);
  assert.ok(prepared.authority, JSON.stringify(prepared.diagnostics));
  const flags = compileMissionInitialFlags({ bindings: catalog, bytes: f.mission.bytes, initialization: 'new-campaign' });
  const model = flags.canInitialize ? compileMissionWorld({ world: f.world.model, bindings: prepared.authority, flags }) : null;
  return { f, catalog, prepared, flags, model };
}
test('source local initialization uses profile capacities, zero fresh globals and explicit int32 truth', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const maximum = profile === 'ra2' ? 49 : 99;
    const s = await setup({ profile, variables: `0=Cold\n1=Ready,1\n2=Negative,-2147483648\n3=Clear,0\n${maximum}=Last,2147483647` });
    assert.ok(s.model); assert.ok(isMissionInitialFlags(s.flags));
    assert.equal(s.flags.localCapacity, maximum + 1); assert.deepEqual(s.flags.globals, Array(50).fill(false));
    assert.deepEqual(s.flags.locals.map((v, i) => v ? i : -1).filter(i => i >= 0), [1, 2, maximum]);
    assert.equal(s.flags.locals.length, 100); assert.equal(s.flags.declarations[0]!.explicitValue, null);
    assert.ok(Object.isFrozen(s.flags.locals)); assert.equal(s.flags.canStartCampaign, false);
    const initial = createMissionWorld(s.model); assert.deepEqual(initial.mission.locals, s.flags.locals);
    assert.equal(compileMissionInitialFlags({ bindings: s.catalog, bytes: s.f.mission.bytes, initialization: 'new-campaign' }).sha256, s.flags.sha256);
  }
});
test('ambiguous, overflowing or unsafe native VariableNames rows do not initialize', async () => {
  for (const variables of ['50=Outside,1', '01=Alias,1', '0=Name,2147483648', '0=Name,-0', '0=Name,yes', '0=Name,', '0=Name,1,2', '0=,1', '0=Name, 1', `0=${'N'.repeat(40)},1`, '0=Name,1\n0=Again,0', '[variablenames]\n0=Case,1', 'BrokenRow']) {
    const f = input({ variables }), c = compileMissionBindings(f);
    const flags = compileMissionInitialFlags({ bindings: c, bytes: f.mission.bytes, initialization: 'new-campaign' });
    assert.equal(flags.canInitialize, false, variables); assert.ok(flags.diagnostics.length);
  }
});
test('initial flags own hash-verified bytes and reject forged catalogs, getters and exhausted bounds', () => {
  const f = input({ variables: '1=Ready,1' }), bindings = compileMissionBindings(f), args = { bindings, bytes: f.mission.bytes, initialization: 'new-campaign' as const };
  const flags = compileMissionInitialFlags(args); assert.equal(isMissionInitialFlags({ ...flags }), false);
  assert.throws(() => compileMissionInitialFlags({ ...args, bindings: { ...bindings } }), /authority/);
  const corrupted = f.mission.bytes.slice(); corrupted[0] = corrupted[0]! ^ 1;
  assert.throws(() => compileMissionInitialFlags({ ...args, bytes: corrupted }), /mission-hash/);
  assert.throws(() => compileMissionInitialFlags(args, { bytes: 1 }), /bytes/);
  assert.throws(() => compileMissionInitialFlags(args, { rows: 0 }), /row-limit/);
  assert.throws(() => compileMissionInitialFlags(args, { work: 0 }), /work-limit/);
  let called = false; const getter = Object.defineProperty({ ...args }, 'bytes', { get() { called = true; return f.mission.bytes; } });
  assert.throws(() => compileMissionInitialFlags(getter)); assert.equal(called, false);
  f.mission.bytes.fill(0); assert.equal(flags.locals[1], true);
});
test('whole program and complete world authority are required, including source initialization identity', async () => {
  const a = await setup(), b = await setup({ variables: '1=Changed,1' }); assert.ok(a.model); assert.ok(b.model);
  assert.throws(() => compileMissionWorld({ world: a.f.world.model, bindings: a.prepared.authority!, flags: b.flags }), /source-join/);
  assert.throws(() => compileMissionWorld({ world: a.f.world.model, bindings: { ...a.prepared.authority! }, flags: a.flags }), /authority/);
  assert.throws(() => compileMissionWorld({ world: a.f.world.model, bindings: a.prepared.authority!, flags: { ...a.flags } }), /authority/);
  const base = a.f.world.model, altered = createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256,
    definitionsSha256: base.definitionsSha256, entities: base.entities, navigation: base.navigation,
    footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), blocked: [{ x: 3, y: 3 }] });
  assert.throws(() => compileMissionWorld({ world: altered, bindings: a.prepared.authority!, flags: a.flags }), /world-join/);
  const unsupported = input({ action: '55,0,0,0,0,0,0,A' }), catalog = compileMissionBindings(unsupported);
  assert.equal((await prepareMissionBindings(catalog)).authority, null);
  assert.throws(() => createMissionWorld({ ...a.model! }), /model/);
});
test('both clocks advance together with pending commands and local inputs, every boundary restores and replays', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const s = await setup({ profile }); const model = s.model!, initial = createMissionWorld(model);
    const first = { commands: [{ schemaVersion: 1 as const, tick: 0, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 1, x: 3, y: 3 } }], flags: [{ tick: 5, sequence: 0, kind: 'local' as const, index: 2, value: true }] };
    let checkpoint = admitMissionWorld(model, initial, first); const savedPending = checkpoint;
    for (let i = 0; i < 20; i++) {
      const restored = restoreMissionWorld(model, JSON.stringify(checkpoint));
      const stepped = stepMissionWorld(model, checkpoint); assert.deepEqual(stepped, stepMissionWorld(model, restored)); checkpoint = stepped.checkpoint;
      assert.equal(checkpoint.world.nextTick, checkpoint.mission.nextTick);
    }
    assert.equal(checkpoint.mission.locals[2], true); assert.equal(checkpoint.mission.globals[1], true);
    assert.deepEqual([checkpoint.world.state.entities[0]!.x, checkpoint.world.state.entities[0]!.y], [3, 3]);
    const replay = replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: savedPending,
      admissions: [], finalNextTick: 20, finalStateSha256: worldHash(checkpoint) });
    assert.deepEqual(replay.checkpoint, checkpoint); assert.equal(replay.effects.filter(e => e.kind === 'input').length, 1);
    assert.equal(replay.effects.filter(e => e.opcode === 28).length, 1);
  }
});
test('host admissions and multi-tick work failures leave all caller-owned state unchanged', async () => {
  const s = await setup({ event: '8,0,0' }), model = s.model!, initial = createMissionWorld(model), text = JSON.stringify(initial);
  const one = stepMissionWorld(model, initial);
  assert.throws(() => stepMissionWorld(model, initial, 2, one.work), /work-limit/); assert.equal(JSON.stringify(initial), text);
  assert.throws(() => admitMissionWorld(model, initial, { commands: [], flags: [{ tick: 1, sequence: 0, kind: 'local', index: 50, value: true }] }), /local-capacity/);
  assert.equal(JSON.stringify(initial), text);
  assert.throws(() => admitMissionWorld(model, initial, { commands: [{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'stop', payload: { entityId: 1 } }],
    flags: [{ tick: 1, sequence: 0, kind: 'local', index: 0, value: true }, { tick: 1, sequence: 0, kind: 'local', index: 1, value: true }] }));
  assert.equal(JSON.stringify(initial), text);
});
test('compound restore rejects a forged initial flag, binding, clock, model or unsupported RA2 slot', async () => {
  const s = await setup(), model = s.model!, initial = createMissionWorld(model);
  for (const mutate of [
    (v: typeof initial) => { v.mission.locals[0] = true; },
    (v: typeof initial) => { v.mission.bindings[0]!.attachmentIds = ['invented']; },
    (v: typeof initial) => { v.mission.nextTick = 1; },
    (v: typeof initial) => { v.mission.locals[50] = true; },
  ]) { const edited = structuredClone(initial); mutate(edited); assert.throws(() => restoreMissionWorld(model, edited)); }
  const other = await setup({ variables: '1=Other,1' }); assert.throws(() => restoreMissionWorld(other.model!, initial), /checkpoint-identity/);
});
test('ordered later admissions reproduce and outcome effects remain explicit requests', async () => {
  const s = await setup({ event: '36,0,1', action: '1,0,0,0,0,0,0,A' }), model = s.model!, initial = createMissionWorld(model);
  const before = stepMissionWorld(model, initial, 3).checkpoint;
  const input = { commands: [], flags: [{ tick: 4, sequence: 0, kind: 'local' as const, index: 1, value: true }] };
  const after = stepMissionWorld(model, admitMissionWorld(model, before, input), 4);
  assert.equal(after.effects.find(e => e.kind === 'outcome-request')?.tick, 4);
  assert.equal(model.canStartCampaign, false); assert.equal(Object.hasOwn(after.checkpoint, 'victory'), false);
  const replay = { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial, admissions: [{ nextTick: 3, input }], finalNextTick: 7, finalStateSha256: worldHash(after.checkpoint) };
  assert.deepEqual(replayMissionWorld(model, replay).checkpoint, after.checkpoint);
  assert.throws(() => replayMissionWorld(model, { ...replay, finalStateSha256: '0'.repeat(64) }), /replay-final-hash/);
  assert.throws(() => replayMissionWorld(model, { ...replay, admissions: [{ nextTick: 3, input }, { nextTick: 2, input }] }));
});

test('source-bound ground combat and saved infantry slots compose without weakening the original world join', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = ordinaryFixtureSource({ profile, ground: true, subcells: true }), { rules, mission, ...bridgeInput } = f;
    const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules, mission, difficulty: 1 });
    const prepared = await prepareMissionBindings(bindings); assert.ok(prepared.authority);
    const flags = compileMissionInitialFlags({ bindings, bytes: mission.bytes, initialization: 'new-campaign' });
    const world = bindInfantryPassageWorld(compileInfantryPassageCatalog({ world: f.world, definitions: f.definitions, actors: f.actors, rules, mission }),
      bindOrdinaryInfantryWorld(compileOrdinaryInfantryBridge(bridgeInput), f.world.model));
    const model = compileMissionWorld({ world, bindings: prepared.authority, flags });
    const initial = admitMissionWorld(model, createMissionWorld(model), { commands: [{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'attack', payload: { entityId: 1, targetId: 2 } }], flags: [] });
    const moving = stepMissionWorld(model, initial).checkpoint;
    assert.equal(moving.world.engineVersion, 'webra2-world-7'); assert.equal(moving.world.state.infantrySlots!.length, 2);
    const terminal = stepMissionWorld(model, restoreMissionWorld(model, moving), 80).checkpoint;
    assert.equal(terminal.world.state.entities[1]!.health, 0); assert.equal(terminal.world.state.combat!.deaths!.length, 1);
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [], finalNextTick: terminal.world.nextTick, finalStateSha256: worldHash(terminal) }).checkpoint, terminal);
  }
});
