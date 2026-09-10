// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTeamFixture } from './mission-team-transaction-fixture.ts';
import { compileMissionTeamRuntime, restoreMissionTeamContext, missionTeamContextData, missionTeamRuntimeData } from '../../packages/sim/src/mission-team-context.ts';
import { planMissionTeamClaim } from '../../packages/sim/src/mission-team-selection.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';
test('common context source brands and complete spawn/recruit force ownership in both profiles', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = missionTeamFixture({ profile }), initial = restoreMissionTeamContext(f.runtime, []), before = missionTeamContextData(initial), world = WorldSimulation.create(before.model).save();
    assert.equal(before.model, f.world.model); assert.equal(missionTeamRuntimeData(f.runtime).source, f.source);
    const recruit = planMissionTeamClaim(initial, world, f.receipt(0, 0).instructionId, 100000), c1 = restoreMissionTeamContext(f.runtime, [recruit.record]);
    assert.equal(recruit.record!.kind, 'recruited'); const d1 = missionTeamContextData(c1); assert.equal(d1.actors.length, 1);
    const second = planMissionTeamClaim(c1, world, f.receipt(0, 0).instructionId, 100000); assert.equal(second.record!.kind, 'recruited');
    if (recruit.record!.kind === 'recruited' && second.record!.kind === 'recruited') assert.notDeepEqual(recruit.record!.actorIds, second.record!.actorIds);
    const spawn = planMissionTeamClaim(c1, world, f.receipt(1, 1).instructionId, 100000), c2 = restoreMissionTeamContext(f.runtime, [...d1.records, spawn.record]);
    const d2 = missionTeamContextData(c2); assert.equal(d2.instances.length, 2); assert.equal(d2.model.entities.length, before.model.entities.length + 1);
    assert.equal(d2.model.entities.at(-1)!.rowId, 'mission-spawn:1:0'); assert.equal(d2.model.entities.at(-1)!.id, before.model.entities.at(-1)!.id + 1);
    assert.deepEqual(d2.model.entities.slice(0, before.model.entities.length), before.model.entities); assert.equal(worldHash(world), worldHash(WorldSimulation.create(before.model).save()));
    assert.throws(() => compileMissionTeamRuntime({ ...f.source })); assert.throws(() => restoreMissionTeamContext({ ...f.runtime }, [])); assert.throws(() => missionTeamContextData({ ...c2 }));
    assert.throws(() => restoreMissionTeamContext(f.runtime, [...d1.records, { ...spawn.record, ordinal: 99 }]));
    assert.throws(() => planMissionTeamClaim(initial, world, f.receipt(0, 0).instructionId, 0));
  }
});
test('whole-force shortage returns no partial claim and descriptor readers ignore hostile get traps', () => {
  const f = missionTeamFixture({ count: 3 }), c = restoreMissionTeamContext(f.runtime, []), world = WorldSimulation.create(f.world.model).save();
  const p = planMissionTeamClaim(c, world, f.receipt(0, 0).instructionId, 100000); assert.equal(p.status, 'blocked'); assert.equal(p.record, null);
  const one = missionTeamFixture(), c1 = restoreMissionTeamContext(one.runtime, []), w1 = WorldSimulation.create(one.world.model).save();
  const claim = planMissionTeamClaim(c1, w1, one.receipt(0, 0).instructionId, 100000).record!;
  const proxy = new Proxy(claim, { get() { throw new Error('must-not-read'); } });
  assert.equal(missionTeamContextData(restoreMissionTeamContext(one.runtime, [proxy])).records.length, 1);
  assert.throws(() => restoreMissionTeamContext(one.runtime, [Object.defineProperty({ ...claim }, 'ordinal', { get: () => 0, enumerable: true })]));
  assert.throws(() => restoreMissionTeamContext(one.runtime, Array(1)));
});
test('release preserves common ownership mutations and does not invent spawned recruitment authority', () => {
  const f = missionTeamFixture(), initial = restoreMissionTeamContext(f.runtime, []), world = WorldSimulation.create(f.world.model).save();
  const spawn = planMissionTeamClaim(initial, world, f.receipt(1,0).instructionId, 100000).record!;
  if (spawn.kind !== 'spawned') throw new Error('spawn');
  const c = restoreMissionTeamContext(f.runtime, [spawn, { kind:'released', ordinal:1, instanceId:spawn.instanceId, atTick:2, reason:'finished' }]);
  const data = missionTeamContextData(c); assert.equal(data.instances.length, 0); assert.equal(data.historyBindings.length, 1);
  assert.equal(data.model.entities.length, 3); assert.equal(data.eligibility.at(-1)!.releasedMissionUnverified, true);
  assert.equal(data.eligibility.at(-1)!.group, null); assert.equal(data.eligibility.at(-1)!.recruitableB, null);
  assert.throws(() => restoreMissionTeamContext(f.runtime, [spawn, { kind:'released', ordinal:1, instanceId:spawn.instanceId, atTick:0, reason:'finished' }]));
});

import { compileTeamProgram } from '../../packages/sim/src/team-runtime-program.ts';
import { compileTeamSpawnCatalog } from '../../packages/sim/src/team-spawn-context.ts';
import { compileTeamRecruitmentCatalog } from '../../packages/sim/src/team-recruitment-catalog.ts';
import { compileMissionTeamActionSource } from '../../packages/sim/src/mission-team-action-source.ts';
test('complete overlapping family programs union without a manufactured subset or discarded template', () => {
  const f = missionTeamFixture(), p2 = compileTeamProgram({teams:f.teams,world:f.world,mission:f.mission,teamIds:['team:squad']},{ticks:1}).program!;
  const spawnCatalogs = f.spawnCatalogs.map(c => compileTeamSpawnCatalog({program:p2,activation:f.activation,definitions:f.definitions,traversal:f.traversal,actionIds:c.actions.map(a=>a.id)}));
  const source = compileMissionTeamActionSource({bindings:f.bindings,activation:f.activation,programs:[f.program,p2],spawnCatalogs,recruitmentCatalogs:f.recruitmentCatalogs});
  const runtime = compileMissionTeamRuntime(source), data=missionTeamRuntimeData(runtime); assert.equal(data.program.templates.length,1);
  assert.equal(data.program.limits.ticks,1); assert.equal(data.program.sourceProgramSha256s!.length,2);
  const c=restoreMissionTeamContext(runtime,[]), world=WorldSimulation.create(f.world.model).save();
  assert.equal(planMissionTeamClaim(c,world,source.actions[0]!.instructionId,100000).status,'ready');
  assert.equal(planMissionTeamClaim(c,world,source.actions[1]!.instructionId,100000).status,'ready');
  const lowRecruit = compileTeamRecruitmentCatalog({program:f.program,activation:f.activation,rules:f.rules,mission:f.mission,actionIds:f.recruitmentCatalogs[0]!.actions.map(a=>a.id)},{retries:1,pending:2,history:4});
  const lowered = compileMissionTeamRuntime(compileMissionTeamActionSource({bindings:f.bindings,activation:f.activation,programs:[f.program],spawnCatalogs:f.spawnCatalogs,recruitmentCatalogs:[lowRecruit]}));
  assert.equal(lowered.limits.retries,1);assert.equal(lowered.limits.pending,2);assert.equal(lowered.limits.history,4);
});
