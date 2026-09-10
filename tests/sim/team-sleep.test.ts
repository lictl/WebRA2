// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSleepFixture } from './team-sleep-fixture.ts';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { bindTeamActors, createTeamCheckpoint, prepareTeamTick, restoreTeamCheckpoint, type TeamCheckpoint } from '../../packages/sim/src/team-runtime.ts';
import { compileTeamProgram } from '../../packages/sim/src/team-runtime-program.ts';
import { admitTeamWorldCommands, commitTeamTick, stepTeamWorld, replayTeamWorld } from '../../packages/sim/src/team-runtime-world.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamSpawnCatalog } from '../../packages/sim/src/team-spawn-context.ts';
import { admitTeamSpawnInput, createTeamSpawnCheckpoint, stepTeamSpawnWorld, prepareTeamSpawnTick, restoreTeamSpawnCheckpoint, replayTeamSpawnWorld } from '../../packages/sim/src/team-spawn-runtime.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { worldHash } from '../../packages/sim/src/world-values.ts';

for (const profile of ['ra2', 'yr'] as const) test(`${profile} complete source moves into persistent Sleep and never executes its later move`, () => {
  const f = teamSleepFixture({ profile, count: 2 }); let checkpoint = f.checkpoint;
  const kinds: string[] = [], stops: number[] = []; let enteredAt: number | null = null;
  for (let tick = 0; tick < 50; tick++) {
    const pending = prepareTeamTick(f.roster, checkpoint);
    const direct = commitTeamTick(f.roster, pending), restored = commitTeamTick(f.roster, JSON.stringify(pending));
    assert.deepEqual(direct, restored); assert.equal(checkpoint.world.nextTick, tick);
    kinds.push(...direct.events.map(e => e.kind)); stops.push(...direct.orders.filter(o => o.kind === 'stop').map(o => o.entityId));
    checkpoint = direct.checkpoint;
    if (checkpoint.team.instances[0]!.phase === 'sleep') enteredAt ??= checkpoint.team.instances[0]!.issuedAt;
  }
  assert.notEqual(enteredAt, null); assert.deepEqual(kinds, ['move', 'arrived', 'sleep']); assert.deepEqual(stops, [1, 2]);
  const sleeping = checkpoint.team.instances[0]!;
  assert.equal(sleeping.phase, 'sleep'); assert.equal(sleeping.cursor, 1); assert.equal(sleeping.lastStep, 1); assert.equal(sleeping.issuedAt, enteredAt);
  assert.equal(checkpoint.team.nextOrderId, 4); assert.deepEqual(sleeping.assignments, []);
  assert.ok(checkpoint.world.state.entities.slice(0, 2).every(e => e.goal === null && e.progress === 0 && !e.route.length));
  const later = stepTeamWorld(f.roster, checkpoint, 100); assert.equal(later.orders.length, 0); assert.equal(later.events.length, 0);
  assert.deepEqual(later.checkpoint.team.instances[0], sleeping);
  const replay = replayTeamWorld(f.roster, { schemaVersion: 1, rosterSha256: f.roster.sha256, initialCheckpoint: f.checkpoint,
    admissions: [], finalNextTick: 150, finalStateSha256: worldHash(later.checkpoint) });
  assert.deepEqual(replay.checkpoint, later.checkpoint);
});

test('Sleep entry stops an existing in-flight actor at its current whole-cell anchor with an exact receipt', () => {
  const f = teamSleepFixture({ script: '0=11,0', speed: 10 }), simulation = WorldSimulation.create(f.world.model);
  simulation.admitCommands([{ schemaVersion: 1, tick: 0, playerId: 0, sequence: 0, kind: 'move', payload: { entityId: 1, x: 3, y: 3 } }]);
  simulation.step(1); assert.ok(simulation.save().state.entities[0]!.progress > 0);
  const before = createTeamCheckpoint(f.roster, simulation.save()), pending = prepareTeamTick(f.roster, before), digest = worldHash(pending);
  const run = commitTeamTick(f.roster, pending), actor = run.checkpoint.world.state.entities[0]!;
  assert.deepEqual([actor.x, actor.y], [before.world.state.entities[0]!.x, before.world.state.entities[0]!.y]);
  assert.equal(actor.goal, null); assert.equal(actor.progress, 0); assert.deepEqual(actor.route, []);
  assert.deepEqual(run.worldEvents.filter(e => e.phase === 'command').map(e => [e.entityId, e.kind]), [[1, 'stopped']]);
  assert.equal(worldHash(pending), digest); assert.equal(run.checkpoint.team.instances[0]!.phase, 'sleep');
});

test('dead members leave persistent Sleep without manufacturing arrival or completion', () => {
  const f = teamSleepFixture({ script: '0=11,0', count: 2 }); let checkpoint = stepTeamWorld(f.roster, f.checkpoint, 3).checkpoint;
  const entry = checkpoint.team.instances[0]!.issuedAt;
  // Original authoritative-observation fixture, not a claim that the plain movement model executes damage.
  const partial = structuredClone(checkpoint); partial.world.state.entities[0]!.health = 0;
  checkpoint = stepTeamWorld(f.roster, partial).checkpoint;
  assert.deepEqual(checkpoint.team.instances[0]!.activeMembers, [2]); assert.equal(checkpoint.team.instances[0]!.phase, 'sleep');
  assert.equal(checkpoint.team.instances[0]!.issuedAt, entry);
  const all = structuredClone(checkpoint); all.world.state.entities[1]!.health = 0;
  const lost = stepTeamWorld(f.roster, all); assert.deepEqual(lost.events.map(e => e.kind), ['lost']); assert.equal(lost.orders.length, 0);
  assert.equal(lost.checkpoint.team.instances[0]!.phase, 'lost'); assert.deepEqual(restoreTeamCheckpoint(f.roster, JSON.stringify(lost.checkpoint)), lost.checkpoint);
});

test('Sleep rejects forged completion, unreachable later cursors, active motion and rewritten pending stops', () => {
  const f = teamSleepFixture({ script: '0=11,0\n1=3,0' }), before = prepareTeamTick(f.roster, f.checkpoint);
  const pending = structuredClone(before); pending.pending!.orders = []; assert.throws(() => commitTeamTick(f.roster, pending), /pending-plan-mismatch/);
  const checkpoint = stepTeamWorld(f.roster, f.checkpoint, 3).checkpoint;
  for (const edit of [
    (s: TeamCheckpoint) => { s.team.instances[0]!.phase = 'advance'; s.team.instances[0]!.issuedAt = null; },
    (s: TeamCheckpoint) => { s.team.instances[0]!.phase = 'finished'; s.team.instances[0]!.cursor = 2; s.team.instances[0]!.lastStep = 1; s.team.instances[0]!.issuedAt = null; },
    (s: TeamCheckpoint) => { s.team.instances[0]!.issuedAt = s.world.nextTick; },
    (s: TeamCheckpoint) => { s.team.instances[0]!.assignments = [{ entityId: 1, x: 2, y: 2 }]; },
  ]) { const changed = structuredClone(checkpoint); edit(changed); assert.throws(() => restoreTeamCheckpoint(f.roster, changed)); }
  const simulation = WorldSimulation.restore(f.world.model, checkpoint.world);
  simulation.admitCommands([{ schemaVersion: 1, tick: 3, playerId: 0, sequence: 1, kind: 'move', payload: { entityId: 1, x: 3, y: 3 } }]);
  simulation.step(1); const changed = structuredClone(checkpoint); changed.world = simulation.save(); changed.team.nextTick = 4;
  assert.throws(() => restoreTeamCheckpoint(f.roster, changed), /world-motion/);
});

test('future Stop/Move orders cannot compete with sleepers; unrelated scheduled orders retain replay equivalence', () => {
  const f = teamSleepFixture({ script: '0=11,0' }), sleeping = stepTeamWorld(f.roster, f.checkpoint, 3).checkpoint;
  for (const kind of ['stop', 'move'] as const) assert.throws(() => admitTeamWorldCommands(f.roster, sleeping,
    [{ schemaVersion: 1, tick: 10, playerId: 0, sequence: 1, kind, payload: kind === 'stop' ? { entityId: 1 } : { entityId: 1, x: 3, y: 3 } }]), /competing-actor-command/);
  const command = { schemaVersion: 1 as const, tick: 5, playerId: 1, sequence: 0, kind: 'move', payload: { entityId: 3, x: 3, y: 1 } };
  const admitted = admitTeamWorldCommands(f.roster, sleeping, [command]), after = stepTeamWorld(f.roster, admitted, 20);
  assert.deepEqual(after.checkpoint.team.instances, sleeping.team.instances);
  assert.deepEqual(replayTeamWorld(f.roster, { schemaVersion: 1, rosterSha256: f.roster.sha256, initialCheckpoint: sleeping,
    admissions: [{ nextTick: 3, commands: [command] }], finalNextTick: 23, finalStateSha256: worldHash(after.checkpoint) }).checkpoint, after.checkpoint);
  const simulation = WorldSimulation.restore(f.world.model, sleeping.world);
  simulation.admitCommands([{ schemaVersion: 1, tick: 10, playerId: 0, sequence: 1, kind: 'stop', payload: { entityId: 1 } }]);
  const competing = { ...sleeping, world: simulation.save() }, digest = worldHash(competing);
  assert.throws(() => stepTeamWorld(f.roster, competing), /competing-actor-command/); assert.equal(worldHash(competing), digest);
});

test('full scripts retain unsupported later lines and mission operands, while explicit jumps may bypass Sleep', () => {
  for (const script of ['0=11,1', '0=11,11', '0=11,-1', '0=11,zero', '0=11,0\n1=50,-1', '0=11,0\n1=99,0']) {
    assert.equal(teamSpawnFixture({ script }).compilation.program, null);
  }
  const f = teamSleepFixture({ script: '0=6,3\n1=11,0\n2=3,0' }), run = stepTeamWorld(f.roster, f.checkpoint, 30);
  assert.equal(run.checkpoint.team.instances[0]!.phase, 'finished'); assert.equal(run.events.some(e => e.kind === 'sleep'), false);
});

test('a later Sleep outbox budget failure rolls back every earlier instance candidate', () => {
  const f = teamSleepFixture({ script: '0=11,0' }), program = compileTeamProgram({ teams: f.teams, world: f.world, mission: f.mission, teamIds: f.teamIds }, { orders: 1 }).program!;
  const roster = bindTeamActors(program, [{ id: 'a', teamId: 'team:squad', actorIds: [1] }, { id: 'b', teamId: 'team:squad', actorIds: [2] }]);
  const before = createTeamCheckpoint(roster), digest = worldHash(before);
  assert.throws(() => stepTeamWorld(roster, before), /order-limit/); assert.equal(worldHash(before), digest); assert.equal(before.team.nextOrderId, 0);
});

test('blocked prior movement retains its retry and cannot enter Sleep early', () => {
  const cells = [[1, 3], [2, 2], [3, 1], [2, 3], [3, 2], [2, 4], [3, 3], [4, 2], [3, 4], [4, 3]];
  const infantryRows = ['0=Commander,Walker,256,2,2,0,Guard,0,None', ...cells.map(([x, y], i) => `${i + 1}=Rival,Walker,256,${x},${y},0,Guard,0,None`)].join('\n');
  const f = teamSleepFixture({ infantryRows }), run = stepTeamWorld(f.roster, f.checkpoint, 30);
  assert.equal(run.checkpoint.team.instances[0]!.phase, 'retry'); assert.equal(run.checkpoint.team.instances[0]!.cursor, 0);
  assert.equal(run.checkpoint.team.instances[0]!.retryAt, 30); assert.equal(run.orders.length, 0);
  assert.deepEqual(run.events.map(e => e.kind), ['blocked', 'blocked']);
  assert.deepEqual(restoreTeamCheckpoint(f.roster, JSON.stringify(run.checkpoint)), run.checkpoint);
});

for (const profile of ['ra2', 'yr'] as const) test(`${profile} source reinforcement preserves Sleep across birth, second insertion, pending restore and replay`, () => {
  const f = teamSleepFixture({ profile, waypoint: '0=1003\n1=3003', script: '0=3,1\n1=11,0\n2=3,0' });
  const activation = compileTeamActivationSource({ teams: f.teams, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const action = 'action:actions:spawn:0', catalog = compileTeamSpawnCatalog({ program: f.compilation.program!, activation, definitions: f.definitions, traversal: f.traversal, actionIds: [action] });
  const initial = prepareTeamSpawnTick(catalog, admitTeamSpawnInput(catalog, createTeamSpawnCheckpoint(catalog), { actions: [action], commands: [] }));
  let checkpoint = stepTeamSpawnWorld(catalog, JSON.stringify(initial), 30).checkpoint;
  assert.equal(checkpoint.team.team.instances[0]!.phase, 'sleep'); const prior = checkpoint.team.team.instances[0]!;
  const admitted = admitTeamSpawnInput(catalog, checkpoint, { actions: [action], commands: [] });
  checkpoint = stepTeamSpawnWorld(catalog, admitted, 30).checkpoint;
  assert.deepEqual(checkpoint.team.team.instances[0], prior); assert.equal(checkpoint.records.length, 2);
  assert.ok(checkpoint.team.team.instances.every(s => s.phase === 'sleep'));
  assert.deepEqual(restoreTeamSpawnCheckpoint(catalog, JSON.stringify(checkpoint)), checkpoint);
  assert.deepEqual(replayTeamSpawnWorld(catalog, { schemaVersion: 1, catalogSha256: catalog.sha256, initialCheckpoint: initial,
    admissions: [{ nextTick: 30, actions: [action], commands: [] }], finalNextTick: 60, finalStateSha256: worldHash(checkpoint) }).checkpoint, checkpoint);
});
