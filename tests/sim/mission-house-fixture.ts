// SPDX-License-Identifier: GPL-3.0-or-later
// Original three-actor miniature source corpus, independent of retail missions.
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import type { MissionHouseParticipation } from '../../packages/sim/src/mission-house-types.ts';
export const houseTrigger = '[Triggers]\nStart=Blue,<none>,Ownership,0,1,1,1,0\n[Tags]\nShared=2,Shared,Start\n[Events]\nStart=3,9,0,0,10,0,0,11,0,0\n[Actions]\nStart=2,14,0,1,0,0,0,0,A,36,0,1,0,0,0,0,A';
export function houseFixture(options: Parameters<typeof teamSpawnFixture>[0] = {}) {
  const f = teamSpawnFixture({ extraMap: houseTrigger,
    infantryRows: '0=Commander,Walker,256,2,2,0,Guard,0,Shared\n1=Commander,Walker,256,2,3,0,Guard,0,None\n2=Rival,Walker,256,4,2,0,Guard,0,Shared', ...options });
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const input = { bindings, definitions: f.definitions, rules: f.rules, mission: f.mission }, source = compileMissionHouseSource(input);
  const participation: MissionHouseParticipation[] = source.initialActors.map(a => ({ entityId: a.entityId, exists: true, registered: true, present: true, tagEligible: true }));
  return { ...f, bindings, input, source, participation };
}
