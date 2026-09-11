// SPDX-License-Identifier: GPL-3.0-or-later
// Original placed-mission cases built on the miniature source fixture.
import { missionTeamFixture } from './mission-team-transaction-fixture.ts';
import { compileMissionHouseSource } from '../../packages/sim/src/mission-house-source.ts';
import { compileMissionTeamOwnedBinding } from '../../packages/sim/src/mission-team-owned-binding.ts';
import { createWorldModel, worldPosition } from '../../packages/sim/src/world-model.ts';
import { compileMissionStationarySource } from '../../packages/sim/src/mission-stationary-source.ts';

export function stationaryFixture(profile: 'ra2' | 'yr', options: { rules?: string; rows?: string; map?: string; constructors?: boolean } = {}) {
  const f = missionTeamFixture({ profile, script: '0=50,3', extraRules: options.rules ?? '[Sleep]\nRecruitable=no\nZombie=yes',
    infantryRows: options.rows ?? '0=Rival,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1\n1=Rival,Walker,256,2,3,0,Sleep,0,None,0,-1,0,1,1',
    extraMap: '[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\nChange=Blue,<none>,Change,0,1,1,1,0\n' +
      '[Tags]\nShared=2,Shared,Start\nChanged=2,Changed,Change\n[Events]\nStart=1,13,0,0\nChange=1,13,0,0\n' +
      '[Actions]\nStart=' + (options.constructors ? '3,4,1,Squad,0,0,0,0,A,7,1,Squad,0,0,0,0,A,80,1,Squad,0,0,0,0,A' : '1,4,1,Squad,0,0,0,0,A') +
      '\nChange=1,36,0,0,0,0,0,0,A\n' + (options.map ?? '') });
  const houses = compileMissionHouseSource({ bindings: f.bindings, definitions: f.definitions, rules: f.rules, mission: f.mission });
  const base = f.world.model;
  const model = createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256,
    definitionsSha256: base.definitionsSha256, entities: base.entities, navigation: base.navigation,
    blocked: base.blocked.map(worldPosition), footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), ownership: houses });
  const binding = compileMissionTeamOwnedBinding({ source: f.source, world: model }), stationary = compileMissionStationarySource({ binding });
  const transfer = { instructionId: houses.instructions.find(i => i.kind === 'action')!.instructionId, sourceHouse: 1, triggerHouse: null };
  return { ...f, houses, model, binding, stationary, transfer };
}
