// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature mixed-action corpus; no retail assets or source rows.
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileTeamActivationSource } from '../../packages/content/src/team-activation.ts';
import { compileTeamSpawnCatalog } from '../../packages/sim/src/team-spawn-context.ts';
import { compileTeamRecruitmentCatalog } from '../../packages/sim/src/team-recruitment-catalog.ts';
import { compileMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionTeamActionSource } from '../../packages/sim/src/mission-team-action-source.ts';
import { compileMissionTeamRuntime, type MissionTeamLimits } from '../../packages/sim/src/mission-team-context.ts';
import type { MissionTeamReceipt } from '../../packages/sim/src/mission-team-runtime.ts';
export function missionTeamFixture(options: Parameters<typeof teamSpawnFixture>[0] = {}, lowerLimits: Partial<MissionTeamLimits> = {}) {
  const f = teamSpawnFixture({ script: '0=50,5', infantryRows:
    '0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1\n1=Commander,Walker,256,2,3,0,Guard,0,None,0,-1,0,1,1',
    extraMap: '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=2,Shared,Start\n[Events]\nStart=1,13,0,0\n[Actions]\nStart=3,4,1,Squad,0,0,0,0,A,7,1,Squad,0,0,0,0,A,80,1,Squad,0,0,0,0,A', ...options });
  const bindings = compileMissionBindings({ world: f.world, definitions: f.definitions, rules: f.rules, mission: f.mission, difficulty: 1 });
  const activation = compileTeamActivationSource({ teams: f.teams, definitions: f.definitions, rules: f.rules, mission: f.mission }), program = f.compilation.program!;
  if (!program) throw new Error('fixture-unsupported');
  const spawnIds = activation.plans.filter(a => a.opcode !== 4).map(a => a.id), recruitIds = activation.plans.filter(a => a.opcode === 4).map(a => a.id);
  const spawnCatalogs = spawnIds.length ? [compileTeamSpawnCatalog({ program, activation, definitions: f.definitions, traversal: f.traversal, actionIds: spawnIds })] : [];
  const recruitmentCatalogs = recruitIds.length ? [compileTeamRecruitmentCatalog({ program, activation, rules: f.rules, mission: f.mission, actionIds: recruitIds })] : [];
  const source = compileMissionTeamActionSource({ bindings, activation, programs: [program], spawnCatalogs, recruitmentCatalogs });
  const runtime = compileMissionTeamRuntime(source, lowerLimits);
  const receipt = (index: number, effectOrder: number, emittedAtTick = 0): MissionTeamReceipt => {
    const action = source.actions[index]!; return { effectOrder, emittedAtTick, dueTick: emittedAtTick + 1,
      instructionId: action.instructionId, triggerId: action.triggerId, bindingId: bindings.tags[0]!.id, opcode: action.opcode };
  };
  return { ...f, bindings, activation, program, source, runtime, receipt, spawnCatalogs, recruitmentCatalogs };
}
