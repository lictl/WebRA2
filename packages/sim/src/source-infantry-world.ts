// SPDX-License-Identifier: GPL-3.0-or-later
// Genuine source/model binding; no UI-supplied capability switches.
import { createCombatModel } from './combat-model.ts';
import { assertWorldModel, createWorldModel, worldPosition, worldFail, type WorldModel } from './world-model.ts';
import { isOrdinaryInfantryBridge, type OrdinaryInfantryBridge } from './ordinary-infantry-bridge.ts';
export function bindOrdinaryInfantryWorld(bridge: OrdinaryInfantryBridge, base: WorldModel): WorldModel {
  assertWorldModel(base);
  if(!isOrdinaryInfantryBridge(bridge)||base.combat||bridge.baseModelSha256!==base.sha256)worldFail('source-world-join');
  const c=bridge.combat;if(!c)return base;
  const combat=createCombatModel({actors:c.actors,weapons:c.weapons,allies:c.allies,ordinary:c.ordinary!,ordinaryDeath:c.ordinaryDeath!,infantryFiring:c.infantryFiring!,sourceBridge:bridge});
  return createWorldModel({contentIdentity:base.contentIdentity,sourceSha256:base.sourceSha256,definitionsSha256:base.definitionsSha256,
    entities:base.entities,navigation:base.navigation,blocked:base.blocked.map(worldPosition),
    footprints:base.footprints.map(p=>({entityId:p.entityId,cells:p.cells.map(worldPosition)})),combat});
}
