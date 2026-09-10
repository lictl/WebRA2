// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature source fixture, composed from the reviewed synthetic spawning corpus.
import assert from 'node:assert/strict';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { bindTeamActors, createTeamCheckpoint } from '../../packages/sim/src/team-runtime.ts';
export function teamSleepFixture(options: Parameters<typeof teamSpawnFixture>[0] = {}) {
  const source = teamSpawnFixture({ waypoint: '0=3003\n1=1003', script: '0=3,0\n1=11,0\n2=3,1', ...options });
  assert.ok(source.compilation.program, JSON.stringify(source.compilation.coverage));
  const roster = bindTeamActors(source.compilation.program, [{ id: 'sleepers', teamId: 'team:squad', actorIds: options.count === 2 ? [1, 2] : [1] }]);
  return { ...source, roster, checkpoint: createTeamCheckpoint(roster) };
}
