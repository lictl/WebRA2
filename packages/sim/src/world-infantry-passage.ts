// SPDX-License-Identifier: GPL-3.0-or-later
// Source composition: optional ordinary slots preserve the entire original world.
import type { InfantryPassageCatalog } from './infantry-passage-catalog.ts';
import { assertWorldModel, createWorldModel, worldPosition, worldFail, type WorldModel } from './world-model.ts';

/** Apply after optional source combat binding. The model factory proves both original base identities. */
export function bindInfantryPassageWorld(catalog: InfantryPassageCatalog, base: WorldModel): WorldModel {
  assertWorldModel(base);
  if (base.infantryPassage) worldFail('world-infantry-already-bound');
  return createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256, definitionsSha256: base.definitionsSha256,
    entities: base.entities, navigation: base.navigation, blocked: base.blocked.map(worldPosition),
    footprints: base.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })),
    ...(base.combat ? { combat: base.combat } : {}), ...(base.ownership ? { ownership: base.ownership } : {}), infantryPassage: catalog });
}
