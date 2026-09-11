// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound transfer/combat scenarios. No retail data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ordinaryFixtureSource } from './ordinary-infantry-fixture.ts';
import { compileCombatModifiers } from '../../packages/content/src/combat-modifiers.ts';
import { compileMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { compileOrdinaryInfantryBridge, evaluateOrdinaryInfantryAttack } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { bindOrdinaryInfantryWorld } from '../../packages/sim/src/source-infantry-world.ts';
import { createWorldModel, worldPosition, worldHash } from '../../packages/sim/src/world-model.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { WorldReplayRecorder, replayWorld } from '../../packages/sim/src/world-replay.ts';

function fixture(profile: 'ra2' | 'yr', options: Parameters<typeof ordinaryFixtureSource>[0] = {}) {
  const f = ordinaryFixtureSource({ profile, sourceTag: 'SourceTag', targetTag: 'VictimTag', ...options,
    extraCountries: '1=Red\n', extraHouses: '2=Captured\n',
    extraRules: '[Red]\nFirepower=2\nArmorInfantryMult=3\nROF=.5\n' + (options.extraRules ?? ''),
    extraMap: '[Easy]\nFirePower=2\nROF=.5\n[Captured]\nCountry=Red\n[Triggers]\nTakeSource=Blue,<none>,Source,0,1,1,1,0\nTakeVictim=Blue,<none>,Victim,0,1,1,1,0\nTakeHouse=Blue,<none>,House,0,1,1,1,0\n[Tags]\nSourceTag=2,Source,TakeSource\nVictimTag=2,Victim,TakeVictim\n[Events]\nTakeSource=1,9,0,0\nTakeVictim=1,9,0,1\nTakeHouse=1,9,0,1\n[Actions]\nTakeSource=1,14,0,1,0,0,0,0,A\nTakeVictim=1,14,0,1,0,0,0,0,A\nTakeHouse=1,36,0,1,0,0,0,0,A\n' + (options.extraMap ?? '') });
  f.modifiers = compileCombatModifiers({ actors: f.actors, rules: f.rules, mission: f.mission, houseDifficultyIndices: f.actors.houses.map((h, i) => ({ houseId: h.houseId, index: i === 2 ? 0 : 1 })) });
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const ownership = compileMissionHouseSource({ bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const { rules, mission, ...input } = f, bridge = compileOrdinaryInfantryBridge(input), base = bindOrdinaryInfantryWorld(bridge, f.world.model);
  const model = createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256, definitionsSha256: base.definitionsSha256,
    entities: base.entities, navigation: base.navigation, blocked: base.blocked.map(worldPosition),
    footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), combat: base.combat!, ownership });
  const take = (triggerId: string) => ({ instructionId: ownership.instructions.find(i => i.kind === 'action' && i.triggerId === `trigger:${triggerId.toLowerCase()}`)!.instructionId, sourceHouse: 0, triggerHouse: 0 });
  return { f, ownership, bridge, model, take };
}
const attack = (playerId = 0, tick = 0, sequence = 0) => ({ schemaVersion: 1, tick, playerId, sequence, kind: 'attack', payload: { entityId: 1, targetId: 2 } });
function checkedStep(r: WorldReplayRecorder, model: ReturnType<typeof fixture>['model']) {
  const restored = WorldSimulation.restore(model, r.save()), result = r.step();
  assert.deepEqual(restored.step(), result); assert.deepEqual(restored.save(), r.save()); return result;
}

test('current source house selects Firepower/ROF while current victim house selects infantry armor', () => {
  for (const profile of ['ra2', 'yr'] as const) for (const victim of [false, true]) {
    const f = fixture(profile), r = new WorldReplayRecorder(f.model);
    r.transferOwnership(f.take(victim ? 'TakeVictim' : 'TakeSource'));
    const decision = evaluateOrdinaryInfantryAttack(f.bridge, f.model, r.save(), { sourceId: 1, targetId: 2 });
    assert.equal(decision.status, 'eligible');
    assert.equal(decision.deathSelection!.victim.ownerId, victim ? 'houses:2' : 'houses:1');
    assert.equal(decision.deathSelection!.attacker.ownerId, victim ? 'houses:0' : 'houses:2');
    r.admitCommands([attack(victim ? 0 : 2)]);
    const steps = [checkedStep(r, f.model), checkedStep(r, f.model), checkedStep(r, f.model)], hit = steps[2]!.events.find(e => e.kind === 'damaged')!;
    assert.equal(hit.value, victim ? 3 : 20);
    const jitter = steps[2]!.events.find(e => e.kind === 'reload-sampled')!.value!;
    assert.equal(r.save().state.combat!.infantryFiring![0]!.state.rearm!.nativeRof, (victim ? 4 : 2) + jitter);
    assert.equal(replayWorld(f.model, r.document()).stateSha256, worldHash(r.save()));
  }
});

test('capture preserves actor/veterancy factors and a previous house reload schedule', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile, { rank: '100', targetRank: '100', sourceFields: 'VeteranAbilities=FIREPOWER,ROF', targetFields: 'VeteranAbilities=STRONGER' });
    const r = new WorldReplayRecorder(f.model); r.admitCommands([attack()]);
    checkedStep(r, f.model); checkedStep(r, f.model); const first = checkedStep(r, f.model);
    assert.equal(first.events.find(e => e.kind === 'damaged')!.value, 8);
    const rearm = r.save().state.combat!.infantryFiring![0]!.state.rearm;
    r.transferOwnership(f.take('TakeSource'));
    assert.deepEqual(r.save().state.combat!.infantryFiring![0]!.state.rearm, rearm);
    assert.deepEqual(WorldSimulation.restore(f.model, r.save()).save(), r.save());
    r.admitCommands([attack(2, 3)]);
    let hit = false;
    for (let n = 0; n < 15 && !hit; n++) {
      const step = checkedStep(r, f.model), damage = step.events.find(e => e.kind === 'damaged');
      if (damage) { assert.equal(damage.value, 16); hit = true;
        const jitter = step.events.find(e => e.kind === 'reload-sampled')!.value!;
        assert.equal(r.save().state.combat!.infantryFiring![0]!.state.rearm!.nativeRof, Math.trunc((2 + jitter) * .75)); }
    }
    assert(hit); assert.equal(replayWorld(f.model, r.document()).stateSha256, worldHash(r.save()));
  }
});

test('capture cancels source windup without RNG and damage-time owners survive later transfers', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture(profile, { damage: 200 }), r = new WorldReplayRecorder(f.model);
    r.admitCommands([attack()]); checkedStep(r, f.model);
    assert(r.save().state.combat!.infantryFiring![0]!.state.pending);
    r.transferOwnership(f.take('TakeSource')); assert.equal(r.save().state.combat!.infantryFiring![0]!.state.pending, null);
    assert.equal(r.save().state.combat!.ordinaryRandom!.draws, 0);
    r.admitCommands([attack(2, 1)]); checkedStep(r, f.model); checkedStep(r, f.model); checkedStep(r, f.model);
    const death = r.save().state.combat!.deaths![0]!;
    assert.equal(death.sourceOwner, 2); assert.equal(death.victimOwner, 1);
    assert.equal(death.startedTick, 3);
    r.transferOwnership(f.take('TakeVictim')); // action14 excludes an already dying victim.
    assert.equal(r.save().state.entities[1]!.owner, 1);
    r.transferOwnership({ ...f.take('TakeHouse'), sourceHouse: 1 });
    assert.equal(r.save().state.entities[1]!.owner, 2);
    assert.equal(r.save().state.combat!.deaths![0]!.victimOwner, 1);
    for (let n = 0; n < 3; n++) checkedStep(r, f.model);
    assert.deepEqual(r.save().state.combat!.deaths![0], { ...death, corpseIndex: 0 });
    assert.equal(replayWorld(f.model, r.document()).stateSha256, worldHash(r.save()));
  }
});
