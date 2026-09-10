// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Entirely original synthetic movement layout.
import { createNavigationGrid } from '../../packages/sim/src/navigation.ts';
import { createWorldModel, type WorldEntityDefinition } from '../../packages/sim/src/world-model.ts';
import type { WorldPreparation } from '../../apps/web/src/world-session.ts';
export function originalWorld(): WorldPreparation {
  const contentIdentity = { profile: 'ra2' as const, manifestSha256: 'a'.repeat(64), rulesSha256: 'b'.repeat(64), orderedModHashes: [] as string[] };
  const grid = createNavigationGrid({ contentIdentity, movementClass: 'foot', cells: Array.from({ length: 35 }, (_, i) => ({ x: i % 7 + 1, y: Math.floor(i / 7) + 1, cost: 1, exits: 255 })) });
  const entity = (id: number, x: number, y: number, owner: number, movable = true): WorldEntityDefinition => ({ id, rowId: `units:${id}`, typeId: 'unit:original', owner, kind: 'unit', x, y, initialHealth: 100, maximumHealth: 100, movementPerTick: movable ? 128 : 0, navigationClass: movable ? 'foot' : null, blocksCell: true });
  const entities = [entity(1, 1, 3, 0), entity(2, 7, 5, 1), entity(3, 3, 3, 0, false)];
  return { model: createWorldModel({ contentIdentity, sourceSha256: 'c'.repeat(64), definitionsSha256: 'd'.repeat(64), entities, navigation: [{ grid, costScale: 1 }], blocked: [] }),
    players: [{ playerId: 0, houseId: 'house:original-0', name: 'Original player' }, { playerId: 1, houseId: 'house:original-1', name: 'Original opponent' }], defaultPlayerId: 0,
    placements: entities.map(e => ({ rowId: e.rowId, entityId: e.id, status: 'ready', reasons: [] })), limitations: ['original-fixture-no-native-behavior'] };
}
