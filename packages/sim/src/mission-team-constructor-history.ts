// SPDX-License-Identifier: GPL-3.0-or-later
// Original structural construction provenance, not proof that a trigger executed.
import { constructorFail as fail, missionTeamConstructorSourceData } from './mission-team-constructor-source.ts';
import { missionTeamActionSourceContext } from './mission-team-action-source.ts';
import { navigationCell } from './navigation.ts';
import { worldHash, worldInteger as integer, worldList, worldRecord, worldAddress, WORLD_LIMITS } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { MISSION_TEAM_CONSTRUCTOR_POLICY, type MissionTeamConstructorSource, type MissionTeamConstructorBirth,
  type MissionTeamConstructorHistory, type MissionTeamConstructorHistoryData } from './mission-team-constructor-types.ts';
import type { WorldEntityDefinition } from './world-model.ts';
export type { MissionTeamConstructorHistory, MissionTeamConstructorBirth, MissionTeamConstructorHistoryData } from './mission-team-constructor-types.ts';
const histories = new WeakMap<object, MissionTeamConstructorHistoryData>();
export function missionTeamConstructorHistoryData(history: MissionTeamConstructorHistory): MissionTeamConstructorHistoryData {
  return histories.get(history) ?? fail('history-brand');
}
/** Restores exact source-born identities. The common runtime separately proves
 * receipt/claim order and live insertion occupancy. A structural history alone is
 * not permission to execute an action or to reclassify an initial map actor. */
export function restoreMissionTeamConstructorHistory(source: MissionTeamConstructorSource, input: unknown,
  workLimit?: number): MissionTeamConstructorHistory {
  const sc = missionTeamConstructorSourceData(source), ac = missionTeamActionSourceContext(sc.actions), base = ac.world.model;
  const cap = source.limits, budget = workLimit === undefined ? cap.work : integer(workLimit, 0, cap.work); let work = 0;
  const charge = (n = 1) => { if (n > budget - work) fail('history-work'); work += n; };
  charge(source.actions.length + source.archetypes.length + ac.spawnCatalogs.length + sc.actions.actions.length + base.entities.length + base.navigation.length);
  const rows = worldList(input, cap.records); charge(rows.length);
  const actions = new Map(source.actions.map(a => [a.instructionId, a])), archetypes = new Map(source.archetypes.map(a => [a.typeId, a]));
  const originals = new Map(sc.actions.actions.map(a => [a.instructionId, a])), catalogs = new Map(ac.spawnCatalogs.map(c => [c.sha256, c]));
  const grids = new Map(base.navigation.map(n => [n.grid.movementClass, n.grid]));
  const births: MissionTeamConstructorBirth[] = [], entities: WorldEntityDefinition[] = [];
  let ordinal = -1, tick = 0, revision = 0, nextId = (base.entities.at(-1)?.id ?? 0) + 1;
  const catalogUse = new Map<string, { records: number; actors: number }>();
  for (const value of rows) {
    const r = worldRecord(value, ['ordinal', 'actionId', 'instanceId', 'teamId', 'bornAtTick', 'ownershipRevision', 'actors']);
    const n = integer(r.ordinal, ordinal + 1, cap.records - 1), bornAtTick = integer(r.bornAtTick, tick, WORLD_LIMITS.tick);
    const ownershipRevision = integer(r.ownershipRevision, revision, WORLD_LIMITS.replayAdmissions);
    if (typeof r.actionId !== 'string') fail('birth-action');
    const a = actions.get(r.actionId), original = originals.get(r.actionId), catalog = a?.catalogSha256 === null ? undefined : catalogs.get(a?.catalogSha256 ?? '');
    if (!a || a.status !== 'supported' || !original || !catalog || r.teamId !== a.teamId || r.instanceId !== `mission-team:${n}`) fail('birth-source');
    charge(catalog.templates.length);
    const template = catalog.templates.find(t => t.teamId === a.teamId); if (!template) fail('birth-template');
    const members = worldList(r.actors, Math.min(cap.members, catalog.limits.actorsPerRecord)); charge(members.length * 16);
    const use = catalogUse.get(catalog.sha256) ?? { records: 0, actors: 0 };
    if (members.length !== a.typeIds.length || members.length > cap.births - entities.length ||
      members.length > cap.actors - base.entities.length - entities.length || members.length > WORLD_LIMITS.entities - base.entities.length - entities.length ||
      members.length > catalog.limits.historicalActors - use.actors || use.records >= catalog.limits.records || nextId + members.length - 1 > 2147483647) fail('birth-capacity');
    const at = original.plan.waypoint; if (at.x === null || at.y === null) fail('birth-waypoint');
    const occupied = new Set<number>();
    const actors = members.map((value, i) => {
      const r = worldRecord(value, ['entityId', 'typeId', 'houseId', 'playerId', 'initialHealth', 'x', 'y']), type = archetypes.get(a.typeIds[i]!);
      if (!type || type.status !== 'supported' || type.kind !== 'unit' || r.entityId !== nextId || r.typeId !== type.typeId ||
        r.houseId !== template.houseId || r.playerId !== template.playerId || r.initialHealth !== type.maximumHealth) fail('birth-actor');
      const cell = worldAddress(r.x, r.y), x = cell % 512, y = Math.floor(cell / 512), grid = grids.get(type.navigationClass);
      if (!grid || occupied.has(cell) || Math.abs(x - at.x!) > catalog.limits.radius || Math.abs(y - at.y!) > catalog.limits.radius || !navigationCell(grid, { x, y })) fail('birth-cell');
      occupied.add(cell); const entityId = nextId++;
      entities.push({ id: entityId, rowId: `mission-spawn:${n}:${i}`, typeId: type.typeId, owner: template.playerId, kind: 'unit', x, y,
        initialHealth: type.maximumHealth, maximumHealth: type.maximumHealth, movementPerTick: type.movementPerTick,
        navigationClass: type.navigationClass, blocksCell: true });
      return { entityId, typeId: type.typeId, houseId: template.houseId, playerId: template.playerId, initialHealth: type.maximumHealth, x, y };
    });
    births.push({ ordinal: n, actionId: a.instructionId, instanceId: `mission-team:${n}`, teamId: a.teamId!, bornAtTick, ownershipRevision, actors });
    ordinal = n; tick = bornAtTick; revision = ownershipRevision; catalogUse.set(catalog.sha256, { records: use.records + 1, actors: use.actors + members.length });
  }
  charge(births.length * 12 + entities.length * 28);
  const common = { policy: MISSION_TEAM_CONSTRUCTOR_POLICY, sourceSha256: source.sha256, baseModelSha256: base.sha256, births };
  const result = freeze({ ...common, sha256: worldHash(common) });
  histories.set(result, freeze({ source, base, births: result.births, entities, work })); return result;
}
