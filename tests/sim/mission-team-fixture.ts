// SPDX-License-Identifier: GPL-3.0-or-later
// Original small source corpus for shared mission/team transactions.
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamSpawnCatalog } from '../../packages/sim/src/team-spawn-context.ts';
import { compileTeamRecruitmentCatalog } from '../../packages/sim/src/team-recruitment-catalog.ts';
import { compileMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionTeamActionSource } from '../../packages/sim/src/mission-team-action-source.ts';
import { compileMissionTeamRuntime } from '../../packages/sim/src/mission-team-context.ts';
export function missionTeamFixture(options: Parameters<typeof teamSpawnFixture>[0] = {}) {
  const f = teamSpawnFixture({ script: '0=50,20', infantryRows:
    '0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1\n'+
    '1=Commander,Walker,256,2,3,0,Guard,0,None,0,-1,0,1,1\n'+
    '2=Rival,Walker,256,4,2,0,Guard,0,None,0,-1,0,1,1',
    extraMap: '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=0,Shared,Start\n[Events]\nStart=1,8,0,0\n'+
    '[Actions]\nStart=3,4,1,Squad,0,0,0,0,A,7,1,Squad,0,0,0,0,A,80,1,Squad,0,0,0,0,A', ...options });
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const activation = compileTeamActivationSource({ teams: f.teams, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const program = f.compilation.program; if (!program) throw Error('original-team-fixture-program');
  const spawnIds = activation.plans.filter(a => a.opcode !== 4).map(a => a.id), recruitIds = activation.plans.filter(a => a.opcode === 4).map(a => a.id);
  const spawnCatalogs = spawnIds.length ? [compileTeamSpawnCatalog({ program, activation, definitions: f.definitions, traversal: f.traversal, actionIds: spawnIds })] : [];
  const recruitmentCatalogs = recruitIds.length ? [compileTeamRecruitmentCatalog({ program, activation, rules: f.rules, mission: f.mission, actionIds: recruitIds })] : [];
  const input = { bindings, activation, programs: [program], spawnCatalogs, recruitmentCatalogs };
  const source = compileMissionTeamActionSource(input), runtime = compileMissionTeamRuntime(source);
  return { ...f, bindings, activation, program, input, source, runtime };
}
