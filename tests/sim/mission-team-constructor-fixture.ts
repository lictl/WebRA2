// SPDX-License-Identifier: GPL-3.0-or-later
// Original unit-constructor source fixture; no retail rows.
import { missionTeamFixture } from './mission-team-transaction-fixture.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { compileMissionCellEntrySource } from '../../packages/sim/src/mission-cell-entry-source.ts';
import { compileMissionTeamCellSource } from '../../packages/sim/src/mission-team-cell-source.ts';
import { compileMissionTeamConstructorSource } from '../../packages/sim/src/mission-team-constructor-source.ts';
import type { createMissionTeamCheckpoint } from '../../packages/sim/src/mission-team-runtime.ts';
import type { MissionTeamConstructorBirth } from '../../packages/sim/src/mission-team-constructor-types.ts';
const unit = '[VehicleTypes]\n0=Carrier\n[Carrier]\nStrength=110\nSpeed=128\nSpeedType=Foot\nLocomotor={4A582741-9839-11D1-B709-00A024DDAFD1}';
export function constructorFixture(profile: 'ra2' | 'yr', extra = '', script = '0=3,1\n1=50,5', infantry = false, options: { transfers?: boolean; count?: number; subcells?: boolean; infantryRows?: string } = {}) {
  const keys = new Set(extra.split('\n').filter(r => r.includes('=')).map(r => r.split('=')[0]));
  const rules = unit.split('\n').filter(r => !keys.has(r.split('=')[0])).join('\n') + '\n' + extra;
  const extraMap = '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=2,Shared,Start\n[Events]\nStart=2,13,0,0,9,0,0\n[Actions]\nStart=5,4,1,Squad,0,0,0,0,A,7,1,Squad,0,0,0,0,A,80,1,Squad,0,0,0,0,A,36,0,1,0,0,0,0,A,36,0,0,0,0,0,0,A';
  const f = missionTeamFixture({ profile, ...(options.infantryRows ? { infantryRows: options.infantryRows } : {}), ...(options.subcells ? { infantryRows: '0=Commander,Walker,256,2,2,2,Guard,0,None,0,-1,0,1,1\n1=Commander,Walker,256,2,3,3,Guard,0,None,0,-1,0,1,1' } : {}), ...(options.transfers ? { extraMap } : {}), ...(options.count ? { count: options.count } : {}), forceType: infantry ? 'Walker' : 'Carrier', script, waypoint: '0=3003\n1=3004', extraRules: rules });
  const houses = compileMissionHouseSource({ bindings: f.bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const constructors = compileMissionTeamCellSource({ cells: compileMissionCellEntrySource({ bindings: f.bindings }), actions: f.source,
    definitions: f.definitions, rules: f.rules, mission: f.mission });
  const input = { actions: f.source, houses, constructors }, catalog = compileMissionTeamConstructorSource(input);
  return { ...f, input, catalog };
}
export function constructorBirths(history: ReturnType<typeof createMissionTeamCheckpoint>['history']): MissionTeamConstructorBirth[] {
  return history.filter(r => r.kind === 'spawned').map(({ kind: _kind, ...r }) => ({ ...r, ownershipRevision: 0 }));
}
