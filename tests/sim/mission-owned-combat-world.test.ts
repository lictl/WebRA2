// SPDX-License-Identifier: GPL-3.0-or-later
// Original complete source mission with real combat, slots, ownership and teams.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ordinaryFixtureSource } from './ordinary-infantry-fixture.ts';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { compileTeamDefinitions } from '../../packages/content/src/team-definitions.ts';
import { compileTeamProgram } from '../../packages/sim/src/team-runtime-program.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamRecruitmentCatalog } from '../../packages/sim/src/team-recruitment-catalog.ts';
import { compileMissionTeamActionSource } from '../../packages/sim/src/mission-team-action-source.ts';
import { compileMissionBindings, prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { compileMissionObjectEventSource } from '../../packages/sim/src/mission-object-event-source.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileOrdinaryInfantryBridge } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
import { bindOrdinaryInfantryWorld } from '../../packages/sim/src/source-infantry-world.ts';
import { compileInfantryPassageCatalog } from '../../packages/sim/src/infantry-passage-catalog.ts';
import { bindInfantryPassageWorld } from '../../packages/sim/src/world-infantry-passage.ts';
import { createWorldModel, worldPosition, worldHash } from '../../packages/sim/src/world-model.ts';
import { compileMissionWorld, createMissionWorld, admitMissionWorld, stepMissionWorld, restoreMissionWorld, replayMissionWorld } from '../../packages/sim/src/mission-world.ts';

async function fixture(profile: 'ra2' | 'yr') {
  const f = ordinaryFixtureSource({ profile, subcells: true, ground: true, targetPrimary: 'Pulse', damage: 200, targetTag: 'Victim',
    extraInfantryRows: '2=Stranger,Observer,256,6,7,3,Guard,0,None,0,-1,0,1,1\n',
    extraCountries: '1=Red\n2=Green\n', extraHouses: '2=Captured\n3=Stranger\n', extraMap: `[Stranger]
Country=Green
[Captured]
Country=Red
[Waypoints]
0=6008
[Triggers]
Start=Blue,<none>,Transfer and recruit,0,1,1,1,0
Killed=Red,<none>,Lethal callback,0,1,1,1,0
Empty=Red,<none>,Population after retirement,0,1,1,1,0
[Tags]
Start=0,Start,Start
Victim=0,Victim,Killed
Empty=0,Empty,Empty
[Events]
Start=1,8,0,0
Killed=1,48,0,0
Empty=2,27,0,2,9,0,1
[Actions]
Start=2,36,0,1,0,0,0,0,A,4,1,Squad,0,0,0,0,A
Killed=1,28,0,2,0,0,0,0,A
Empty=1,28,0,3,0,0,0,0,A` });
  const bytes = new TextEncoder().encode('[TeamTypes]\n0=Squad\n[Squad]\nHouse=Red\nTaskForce=Troop\nScript=Route\nWaypoint=A\n[TaskForces]\n0=Troop\n[Troop]\n0=1,Walker\n[ScriptTypes]\n0=Route\n[Route]\n0=3,0\n1=50,5');
  const ai = compileRuntimeIni(profile, [{ id: 'ai', profile, order: 0, kind: 'base', sourceSha256: createHash('sha256').update(bytes).digest('hex'), bytes }]);
  const teams = compileTeamDefinitions({ definitions: f.definitions, rules: f.rules, ai, mission: f.mission });
  const program = compileTeamProgram({ teams, world: f.world, mission: f.mission, teamIds: ['team:squad'] }).program!; assert(program);
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const activation = compileTeamActivationSource({ teams, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const recruitment = compileTeamRecruitmentCatalog({ program, activation, rules: f.rules, mission: f.mission, actionIds: activation.plans.map(p => p.id) });
  const source = compileMissionTeamActionSource({ bindings, activation, programs: [program], spawnCatalogs: [], recruitmentCatalogs: [recruitment] });
  const ownership = compileMissionHouseSource({ bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const objects = compileMissionObjectEventSource({ bindings });
  const prepared = await prepareMissionBindings(bindings, undefined, undefined, objects, source, undefined, { houseSource: ownership });
  assert(prepared.authority, JSON.stringify(prepared.compilation?.diagnostics));
  const { rules, mission, ...input } = f, bridge = compileOrdinaryInfantryBridge(input);
  const infantryPassage = compileInfantryPassageCatalog({ world: f.world, definitions: f.definitions, actors: f.actors, rules, mission });
  const b = bindInfantryPassageWorld(infantryPassage, bindOrdinaryInfantryWorld(bridge, f.world.model));
  const world = createWorldModel({ contentIdentity: b.contentIdentity, sourceSha256: b.sourceSha256, definitionsSha256: b.definitionsSha256,
    entities: b.entities, navigation: b.navigation, blocked: b.blocked.map(worldPosition),
    footprints: b.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), combat: b.combat!, infantryPassage, ownership });
  const flags = compileMissionInitialFlags({ bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  return compileMissionWorld({ world, bindings: prepared.authority, flags });
}

test('actual mission capture and recruitment retain lethal callbacks, pending slots and retirement population', async () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const model = await fixture(profile), initial = createMissionWorld(model);
    const input = { flags: [], commands: [
      { schemaVersion: 1 as const, tick: 2, playerId: 1, sequence: 0, kind: 'attack', payload: { entityId: 2, targetId: 1 } },
      { schemaVersion: 1 as const, tick: 16, playerId: 3, sequence: 0, kind: 'attack', payload: { entityId: 3, targetId: 2 } },
    ] };
    let state = initial, moved = false, pending = false, retired = false, callbacks = 0, empty = 0;
    for (let tick = 0; tick < 28; tick++) {
      if (tick === 2) state = admitMissionWorld(model, state, input);
      const result = stepMissionWorld(model, state);
      if (tick === 0) assert.deepEqual(result.effects.map(e => e.opcode), [36, 4], profile);
      if (tick === 1) assert.equal(result.teams!.actions[0]?.kind, 'recruited', profile);
      assert.deepEqual(stepMissionWorld(model, restoreMissionWorld(model, JSON.stringify(state))), result);
      state = result.checkpoint; moved ||= result.worldEvents.some(e => e.kind === 'moved' && e.entityId === 1);
      const lethal = result.worldEvents.some(e => e.kind === 'dying' && e.entityId === 2);
      const fired = result.effects.filter(e => e.opcode === 28 && e.target === 'global:2').length;
      assert.equal(fired, lethal ? 1 : 0); callbacks += fired;
      const death = state.world.state.combat!.deaths!.find(d => d.entityId === 1);
      if (death) {
        assert.equal(death.sourceOwner, 1); assert.equal(death.victimOwner, 2);
        const population = state.world.state.ownership!.counts.find(h => h.playerId === 2)!.registered.infantry;
        if (death.corpseIndex === null) { pending = true; assert.equal(population, 1); assert.equal(state.mission.globals[3], false); }
        else { retired = true; assert.equal(population, 0); assert.equal(state.mission.globals[3], state.mission.globals[2]); }
        assert(state.world.state.infantrySlots!.some(s => s.entityId === 1));
      }
      empty += result.effects.filter(e => e.opcode === 28 && e.target === 'global:3').length;
      assert.deepEqual(state.teams!.team.world, state.world);
    }
    assert(moved, JSON.stringify(state.teams!.history)); assert(pending); assert(retired); assert.equal(callbacks, 1); assert.equal(empty, 1);
    assert.equal(state.world.state.ownership!.transfers.length, 1);
    const release = state.teams!.history.at(-1)!; assert.equal(release.kind, 'released');
    assert.equal(release.kind === 'released' && release.reason, 'lost');
    assert.deepEqual(replayMissionWorld(model, { schemaVersion: 1, modelSha256: model.sha256, initialCheckpoint: initial,
      admissions: [{ nextTick: 2, input }], finalNextTick: 28, finalStateSha256: worldHash(state) }).checkpoint, state);
  }
});
