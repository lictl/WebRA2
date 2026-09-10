// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature recruitment corpus; no retail rows or strings.
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamRecruitmentCatalog } from '../../packages/sim/src/team-recruitment-catalog.ts';
export function recruitmentFixture(options: Parameters<typeof teamSpawnFixture>[0] = {}) {
  const source = teamSpawnFixture({ script: '0=3,0', infantryRows:
    '0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1\n'+
    '1=Commander,Walker,256,2,3,0,Guard,0,None,100,-1,0,1,0\n'+
    '2=Rival,Walker,256,4,2,0,Guard,0,None,0,-1,0,1,1',
    extraMap: '[Actions]\nRecruit=1,4,1,Squad,0,0,0,0,A', ...options });
  const activation = compileTeamActivationSource({ teams: source.teams, definitions: source.definitions, rules: source.rules, mission: source.mission });
  const program = source.compilation.program;
  if (!program) throw new Error('original-fixture-unsupported-script');
  const input = { program, activation, rules: source.rules, mission: source.mission, actionIds: activation.plans.map(a => a.id) };
  return { ...source, program, activation, input, catalog: compileTeamRecruitmentCatalog(input) };
}
