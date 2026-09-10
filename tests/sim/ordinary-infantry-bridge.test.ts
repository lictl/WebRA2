// SPDX-License-Identifier: GPL-3.0-or-later
// Original source/world behavior fixtures, distinct from private retail validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileOrdinaryInfantryBridge, evaluateOrdinaryInfantryAttack, isOrdinaryInfantryBridge, ORDINARY_INFANTRY_BRIDGE_LIMITS } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { WorldReplayRecorder, replayWorld } from '../../packages/sim/src/world-replay.ts';
import { ordinaryFixture, ordinaryWorld } from './ordinary-infantry-fixture.ts';

test('both profiles bind real source factories to armed and target-only actors with exact current-world eligibility', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = ordinaryFixture({ profile }), bridge = compileOrdinaryInfantryBridge(f), model = ordinaryWorld(f, bridge), sim = WorldSimulation.create(model);
    assert(isOrdinaryInfantryBridge(bridge)); assert(!isOrdinaryInfantryBridge({ ...bridge }));
    assert.deepEqual(bridge.coverage, { attackers: 1, targetOnly: 1, movementOnly: 0, weapons: 1 });
    assert.deepEqual(bridge.combat!.actors.map(a => a.weapons), [['weapon:pulse'], []]);
    assert.equal(bridge.programs.length, 1); assert.equal(bridge.programs[0]!.fireUp, 2);
    assert.equal(bridge.combat!.ordinary!.seed, 1234); assert.equal(bridge.combat!.ordinaryDeath!.actors[1]!.sequence11Ticks, 3);
    const before = sim.saveText(), decision = evaluateOrdinaryInfantryAttack(bridge, model, sim.save(), { sourceId: 1, targetId: 2 });
    assert.equal(decision.status, 'eligible', JSON.stringify(decision.reasons)); assert.equal(decision.deathSelection!.status, 'ready-ordinary-human');
    assert.equal(sim.saveText(), before); assert.equal(decision.deathSelection!.victim.id, '2'); assert(Object.isFrozen(decision));
    assert(evaluateOrdinaryInfantryAttack(bridge, model, sim.save(), { sourceId: 2, targetId: 1 }).reasons.includes('source-not-attacker'));
  }
});

test('source corpse, firing and numerical rules execute through saved windup, death and replay without granting target-only attacks', () => {
  const f = ordinaryFixture(), bridge = compileOrdinaryInfantryBridge(f), model = ordinaryWorld(f, bridge), recorder = new WorldReplayRecorder(model);
  recorder.admitCommands([{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'attack', payload: { entityId: 1, targetId: 2 } }]);
  recorder.step(2); assert.equal(recorder.save().state.entities[1]!.health, 100);
  const checkpoint = recorder.save(), restored = WorldSimulation.restore(model, checkpoint);
  assert.deepEqual(restored.step(1), recorder.step(1)); assert.equal(recorder.save().state.entities[1]!.health, 90);
  recorder.step(100); const final = recorder.save();
  assert.equal(final.state.entities[1]!.health, 0); assert.equal(final.state.combat!.deaths!.length, 1); assert.equal(final.state.combat!.deaths![0]!.corpseIndex, 0);
  assert.deepEqual(replayWorld(model, recorder.document()).simulation.save(), recorder.save());
});

test('conditional animation fields are closed only for the inspected mode and never bypass active ordinary effects', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const conditional = compileOrdinaryInfantryBridge(ordinaryFixture({ profile, weaponFields: 'AssaultAnim=Unknown\nOccupantAnim=Unknown' }));
    assert.equal(conditional.coverage.attackers, 1);
    for (const weaponFields of ['OpenToppedAnim=Unknown', 'Anim=Missing', 'Suicide=yes', 'RadLevel=10', 'occupantAnim=Unknown']) {
      const b = compileOrdinaryInfantryBridge(ordinaryFixture({ profile, weaponFields })); assert.equal(b.coverage.attackers, 0, weaponFields);
    }
    const active = compileOrdinaryInfantryBridge(ordinaryFixture({ profile, weaponFields: 'Anim=Quiet', artFields: 'Damage=2' }));
    assert.equal(active.coverage.attackers, 0); assert(active.actors[0]!.attackReasons.includes('ordinary-animation-closure'));
  }
});

test('actual current terrain, complete occupancy and movement state determine firing permission', () => {
  for (const options of [{ overlay: true }, { elevation: true }, { sharedTarget: true }]) {
    const f = ordinaryFixture(options), b = compileOrdinaryInfantryBridge(f), m = ordinaryWorld(f, b);
    const d = evaluateOrdinaryInfantryAttack(b, m, WorldSimulation.create(m).save(), { sourceId: 1, targetId: 2 }); assert.equal(d.status, 'unsupported', JSON.stringify(options));
  }
  const f = ordinaryFixture(), b = compileOrdinaryInfantryBridge(f), m = ordinaryWorld(f, b), s = WorldSimulation.create(m);
  s.admitCommands([{ schemaVersion: 1, tick: 0, playerId: 1, sequence: 0, kind: 'move', payload: { entityId: 2, x: 7, y: 7 } }]); s.step();
  assert(evaluateOrdinaryInfantryAttack(b, m, s.save(), { sourceId: 1, targetId: 2 }).reasons.includes('moving-actor'));
  for (let i = 0; i < 10; i++) s.step();
  assert.equal(evaluateOrdinaryInfantryAttack(b, m, s.save(), { sourceId: 1, targetId: 2 }).status, 'eligible');
});

test('authored rank selects reviewed factors and rejects active unsupported consumers; unknown inactive lists do not veto rookies', () => {
  const veteran = ordinaryFixture({ rank: '100', sourceFields: 'VeteranAbilities=FIREPOWER,STRONGER,ROF' });
  const b = compileOrdinaryInfantryBridge(veteran); assert.equal(b.coverage.attackers, 1); assert.equal(b.actors[0]!.veterancy, 1);
  assert.notEqual(b.combat!.ordinary!.sha256, compileOrdinaryInfantryBridge(ordinaryFixture()).combat!.ordinary!.sha256);
  assert.equal(compileOrdinaryInfantryBridge(ordinaryFixture({ rank: '100', sourceFields: 'VeteranAbilities=SELF_HEAL' })).coverage.attackers, 0);
  assert.equal(compileOrdinaryInfantryBridge(ordinaryFixture({ sourceFields: 'VeteranAbilities=UNKNOWN' })).coverage.attackers, 1);
  assert.equal(compileOrdinaryInfantryBridge(ordinaryFixture({ sourceFields: 'Ammo=3\nInitialAmmo=2' })).actors[0]!.role, 'target-only');
});

test('unproven elite slot selection cannot grant normal-primary attacks or victim current-weapon death admission', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    for (const sourceFields of ['ElitePrimary=Complex', 'ElitePrimary=Pulse', '']) {
      const f = ordinaryFixture({ profile, rank: '200', sourceFields }), b = compileOrdinaryInfantryBridge(f), m = ordinaryWorld(f, b);
      assert.equal(b.actors[0]!.role, 'movement-only'); assert.equal(b.actors[0]!.currentWeaponId, null);
      assert(b.actors[0]!.attackReasons.includes('elite-current-weapon-selection'));
      assert.equal(evaluateOrdinaryInfantryAttack(b, m, WorldSimulation.create(m).save(), { sourceId: 1, targetId: 2 }).status, 'unsupported');
    }
    const f = ordinaryFixture({ profile, targetRank: '200', targetFields: 'ElitePrimary=Pulse' }), b = compileOrdinaryInfantryBridge(f), m = ordinaryWorld(f, b);
    assert.equal(b.actors[1]!.currentWeaponId, null); assert(b.actors[1]!.targetReasons.includes('elite-current-weapon-selection'));
    assert(evaluateOrdinaryInfantryAttack(b, m, WorldSimulation.create(m).save(), { sourceId: 1, targetId: 2 }).reasons.includes('target-not-damageable'));
  }
});

test('zero native ROF stays zero and source-valid windups beyond the world cap stay target-only', () => {
  const f = ordinaryFixture({ rof: 0, fireUp: 0 }), b = compileOrdinaryInfantryBridge(f), m = ordinaryWorld(f, b), s = WorldSimulation.create(m);
  assert.equal(b.combat!.weapons[0]!.reloadTicks, 0);
  s.admitCommands([{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'attack', payload: { entityId: 1, targetId: 2 } }]);
  const shots = s.step(8).events.filter(e => e.kind === 'fired'); assert(shots.length > 1); assert.equal(new Set(shots.map(s => s.tick)).size, shots.length);
  const long = compileOrdinaryInfantryBridge(ordinaryFixture({ fireUp: 10001 }));
  assert.equal(long.actors[0]!.role, 'target-only'); assert(long.actors[0]!.attackReasons.includes('world-fire-up-limit'));
});

test('genuine-but-mismatched components and source proxies fail before publication or ordinary getter execution', () => {
  const a = ordinaryFixture(), changed = ordinaryFixture({ extraRules: '[Unused]\nValue=1\n' });
  const fields = ['world', 'definitions', 'actors', 'weapons', 'instant', 'effects', 'modifiers', 'veterancy', 'initial', 'death', 'ordinaryDeath', 'traversal'] as const;
  for (const field of fields) {
    assert.throws(() => compileOrdinaryInfantryBridge({ ...a, [field]: { ...a[field] } }), /factory/);
    assert.throws(() => compileOrdinaryInfantryBridge({ ...a, [field]: changed[field] }), /join/);
  }
  const proxy = new Proxy(a, { get() { throw new Error('ordinary property get forbidden'); } });
  assert.equal(compileOrdinaryInfantryBridge(proxy).fingerprint, compileOrdinaryInfantryBridge(a).fingerprint);
  const getter = Object.defineProperty({ ...a }, 'seed', { enumerable: true, get() { throw new Error('getter called'); } });
  assert.throws(() => compileOrdinaryInfantryBridge(getter), /fields/);
});

test('checkpoint validation rejects forged current geometry, identities, status fields and stale source joins', () => {
  const f = ordinaryFixture(), b = compileOrdinaryInfantryBridge(f), m = ordinaryWorld(f, b), save = WorldSimulation.create(m).save();
  const evaluate = (value: unknown) => evaluateOrdinaryInfantryAttack(b, m, value, { sourceId: 1, targetId: 2 });
  for (const mutate of [
    (s: typeof save) => { s.state.entities[1]!.x = 512; },
    (s: typeof save) => { s.state.entities[1]!.health = 101; },
    (s: typeof save) => { (s.state.entities[1] as unknown as Record<string, unknown>).inTransport = false; },
    (s: typeof save) => { s.state.modelSha256 = 'f'.repeat(64); },
  ]) { const c = structuredClone(save); mutate(c); assert.throws(() => evaluate(c)); }
  const other = ordinaryFixture({ seed: 42 }), otherBridge = compileOrdinaryInfantryBridge(other), otherModel = ordinaryWorld(other, otherBridge);
  assert.throws(() => evaluateOrdinaryInfantryAttack(b, otherModel, WorldSimulation.create(otherModel).save(), { sourceId: 1, targetId: 2 }), /combat-join/);
  assert.throws(() => evaluateOrdinaryInfantryAttack({ ...b }, m, save, { sourceId: 1, targetId: 2 }), /bridge-factory/);
  const noFlags = { sourceId: 1, targetId: 2, standing: true }; assert.throws(() => evaluateOrdinaryInfantryAttack(b, m, save, noFlags));
});

test('resource caps cannot be raised and failed context queries leave the checkpoint unchanged', () => {
  const f = ordinaryFixture();
  for (const key of ['actors', 'types', 'weapons', 'terrainCells', 'work', 'reasonCharacters', 'serializedBytes'] as const)
    assert.throws(() => compileOrdinaryInfantryBridge(f, { [key]: 0 }), key);
  for (const key of Object.keys(ORDINARY_INFANTRY_BRIDGE_LIMITS) as (keyof typeof ORDINARY_INFANTRY_BRIDGE_LIMITS)[])
    assert.throws(() => compileOrdinaryInfantryBridge(f, { [key]: ORDINARY_INFANTRY_BRIDGE_LIMITS[key] + 1 }), key);
  const b = compileOrdinaryInfantryBridge(f, { contextCells: 0 }), m = ordinaryWorld(f, b), s = WorldSimulation.create(m), before = s.saveText();
  assert.deepEqual(evaluateOrdinaryInfantryAttack(b, m, s.save(), { sourceId: 1, targetId: 2 }).reasons, ['context-cell-limit']); assert.equal(s.saveText(), before);
  const c = compileOrdinaryInfantryBridge(f, { contextWork: 0 }), cm = ordinaryWorld(f, c);
  assert.throws(() => evaluateOrdinaryInfantryAttack(c, cm, WorldSimulation.create(cm).save(), { sourceId: 1, targetId: 2 }), /context-work/);
});
