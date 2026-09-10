// SPDX-License-Identifier: GPL-3.0-or-later
// Original authenticated spawn catalog/model reconstruction. See ../TEAM_SPAWN_PROVENANCE.md.
import { isTeamActivationSource, teamActivationDefinitions, type TeamActivationSource, type TeamActivationPlan } from '../../content/src/team-activation.ts';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from '../../content/src/entity-definitions.ts';
import { isTerrainTraversal, type TerrainTraversal } from '../../content/src/terrain-traversal.ts';
import { type WorldContent } from './world-content.ts';
import { teamProgramWorld, teamRuntimeFreeze as freeze, type TeamProgram } from './team-runtime-program.ts';
import { createWorldModel, type WorldModel, type WorldEntityDefinition } from './world-model.ts';
import { navigationCell } from './navigation.ts';
import { worldClone, worldHash, worldInteger, worldList, worldRecord, worldPosition, worldAddress, worldSymbol, WORLD_LIMITS } from './world-values.ts';

export const TEAM_SPAWN_POLICY = 'webra2-waypoint-reinforcement-1' as const;
export const TEAM_SPAWN_LIMITS = Object.freeze({ actions: 256, records: 64, historicalActors: 256, actorsPerRecord: 64,
  livingActors: 2048, radius: 16, candidates: 1089, insertionWork: 262144, pending: 64, retries: 10000,
  retryTicks: 15, tick: WORLD_LIMITS.tick, replayTicks: 10000, replayAdmissions: 1024, trace: 32768, replayWork: 16_777_216 });
export type TeamSpawnLimits = { -readonly [K in keyof typeof TEAM_SPAWN_LIMITS]: number };
export interface TeamSpawnArchetype {
  readonly typeId: string; readonly kind: 'infantry' | 'unit'; readonly maximumHealth: number;
  readonly movementPerTick: number; readonly navigationClass: string;
  readonly fields: Readonly<{ strength: EntityField<number>; speed: EntityField<number>; speedType: EntityField<number> }>;
}
export interface TeamSpawnCatalog {
  readonly policy: typeof TEAM_SPAWN_POLICY; readonly programSha256: string; readonly activationSha256: string;
  readonly baseWorldSha256: string; readonly baseModelSha256: string; readonly entitiesSha256: string; readonly traversalSha256: string;
  readonly actions: readonly TeamActivationPlan[]; readonly archetypes: readonly TeamSpawnArchetype[];
  readonly templates: readonly Readonly<{ teamId: string; houseId: string; playerId: number; memberTypeIds: readonly string[] }>[];
  readonly limits: Readonly<TeamSpawnLimits>; readonly sha256: string; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export interface TeamSpawnActorRecord {
  readonly entityId: number; readonly typeId: string; readonly houseId: string; readonly playerId: number;
  readonly initialHealth: number; readonly x: number; readonly y: number;
}
export interface TeamSpawnRecord {
  readonly ordinal: number; readonly actionId: string; readonly teamId: string; readonly instanceId: string;
  readonly bornAtTick: number; readonly actors: readonly TeamSpawnActorRecord[];
}
export interface TeamSpawnActorBinding {
  readonly entityId: number; readonly rowId: string; readonly typeId: string; readonly houseId: string;
  readonly playerId: number; readonly bornAtTick: number;
}
export interface TeamSpawnInstanceBinding { readonly id: string; readonly teamId: string; readonly actorIds: readonly number[]; readonly bornAtTick: number }
export interface TeamSpawnContext {
  readonly policy: typeof TEAM_SPAWN_POLICY; readonly catalogSha256: string; readonly recordsSha256: string;
  readonly modelSha256: string; readonly sha256: string;
}
export interface TeamSpawnContextData {
  readonly program: TeamProgram; readonly model: WorldModel; readonly actors: readonly TeamSpawnActorBinding[];
  readonly instances: readonly TeamSpawnInstanceBinding[]; readonly catalogSha256: string;
  readonly recordsSha256: string; readonly records: readonly TeamSpawnRecord[];
}
export class TeamSpawnError extends Error { constructor(readonly code: string) { super(`team-spawn-${code}`); this.name = 'TeamSpawnError'; } }
export function teamSpawnFail(code: string): never { throw new TeamSpawnError(code); }
const catalogs = new WeakMap<object, Readonly<{ program: TeamProgram; world: WorldContent }>>();
const contexts = new WeakMap<object, TeamSpawnContextData>();
export const isTeamSpawnCatalog = (v: unknown): v is TeamSpawnCatalog => !!v && typeof v === 'object' && catalogs.has(v);
export const isTeamSpawnContext = (v: unknown): v is TeamSpawnContext => !!v && typeof v === 'object' && contexts.has(v);
export function teamSpawnCatalogData(catalog: TeamSpawnCatalog): Readonly<{ program: TeamProgram; world: WorldContent }> {
  const d = catalogs.get(catalog); if (!d) teamSpawnFail('catalog-brand'); return d;
}
export function teamSpawnContextData(context: TeamSpawnContext): TeamSpawnContextData {
  const d = contexts.get(context); if (!d) teamSpawnFail('context-brand'); return d;
}
function limits(v: Partial<TeamSpawnLimits>): TeamSpawnLimits {
  if (!v || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) teamSpawnFail('limits');
  const c: TeamSpawnLimits = { ...TEAM_SPAWN_LIMITS };
  for (const key of Reflect.ownKeys(v)) { if (typeof key !== 'string' || !Object.hasOwn(c, key)) teamSpawnFail('limits');
    const d = Object.getOwnPropertyDescriptor(v, key)!; if (!('value' in d) || !d.enumerable) teamSpawnFail('limits');
    c[key as keyof TeamSpawnLimits] = worldInteger(d.value, 0, c[key as keyof TeamSpawnLimits]); }
  return c;
}
const known = <T>(f: EntityField<T>): T | null => f.status === 'unsupported' || f.status === 'not-applicable' ? null : f.value;
/** Complete selected scripts are already authenticated by TeamProgram. No placed actor is used as an archetype. */
export function compileTeamSpawnCatalog(input: { readonly program: TeamProgram; readonly activation: TeamActivationSource;
  readonly definitions: EntityDefinitions; readonly traversal: TerrainTraversal; readonly actionIds: readonly string[] }, lowerLimits: Partial<TeamSpawnLimits> = {}): TeamSpawnCatalog {
  const r = worldRecord(input, ['program', 'activation', 'definitions', 'traversal', 'actionIds']), cap = limits(lowerLimits);
  const program = r.program as TeamProgram, world = teamProgramWorld(program);
  if (!isTeamActivationSource(r.activation) || !isEntityDefinitions(r.definitions) || !isTerrainTraversal(r.traversal)) teamSpawnFail('source-brand');
  const activation = r.activation, definitions = r.definitions, traversal = r.traversal, teams = teamActivationDefinitions(activation);
  if (program.teamsSha256 !== activation.teamsSha256 || program.entitiesSha256 !== definitions.fingerprint ||
    activation.entitiesSha256 !== definitions.fingerprint || world.traversalSha256 !== traversal.sha256 ||
    activation.source.sha256 !== program.missionSha256 || activation.profile !== program.profile ||
    world.model.combat || program.modelSha256 !== world.model.sha256) teamSpawnFail('source-identity');
  const selected = worldList(r.actionIds, cap.actions).map(worldSymbol).sort();
  if (!selected.length || new Set(selected).size !== selected.length) teamSpawnFail('action-selection');
  const allActions = new Map(activation.plans.map(a => [a.id, a])), selectedTeams = new Set<string>();
  const actions = selected.map(id => { const a = allActions.get(id);
    if (!a || a.status !== 'supported-source' || a.branch !== 'reinforce' || a.teamId === null) teamSpawnFail('unsupported-action');
    selectedTeams.add(a.teamId); return a; });
  if (selectedTeams.size !== program.templates.length || program.templates.some(t => !selectedTeams.has(t.id))) teamSpawnFail('program-selection');
  const typeById = new Map(definitions.definitions.map(d => [d.id, d])), teamById = new Map(teams.teams.map(t => [t.id, t]));
  const forceById = new Map(teams.taskForces.map(f => [f.id, f])), archetypes = new Map<string, TeamSpawnArchetype>();
  const grids = new Map(world.model.navigation.map(b => [b.grid.movementClass, b.grid]));
  const bySpeed = new Map(traversal.movementClasses.map(c => [c.speedType, c]));
  const templates: TeamSpawnCatalog['templates'][number][] = []; let work = 0;
  const charge = (n = 1) => { if (n > cap.insertionWork - work) teamSpawnFail('catalog-work'); work += n; };
  charge(definitions.definitions.length + teams.teams.length + teams.taskForces.length);
  for (const t of program.templates) {
    charge(); const source = teamById.get(t.id)!, force = source.taskForce.targetId ? forceById.get(source.taskForce.targetId) : undefined;
    if (!force || !force.typed || known(source.fields.veteranLevel!) !== 1) teamSpawnFail('reinforcement-veterancy');
    // Constructor/routing branches requiring passengers, alternate entry, or member mutation are not skipped.
    for (const key of ['loadable', 'droppod', 'useTransportOrigin', 'onTransOnly', 'looseRecruit'])
      if (known(source.fields[key]!) !== false) teamSpawnFail(`reinforcement-${key}`);
    const memberTypeIds: string[] = [], quantities = new Map<string, number>();
    for (const m of force.members) {
      charge(); if (!m.typeId || m.status !== 'typed' || m.quantity === null || m.quantity < 1) teamSpawnFail('taskforce-member');
      if (m.quantity > cap.actorsPerRecord - memberTypeIds.length) teamSpawnFail('member-limit');
      const d = typeById.get(m.typeId); if (!d || (d.kind !== 'infantry' && d.kind !== 'unit')) teamSpawnFail('actor-kind');
      if (!archetypes.has(d.id)) {
        const maximumHealth = known(d.strength), speed = known(d.speed), speedType = known(d.speedType), zone = known(d.movementZone), locomotor = known(d.locomotor);
        const c = speedType === null ? undefined : bySpeed.get(speedType);
        if (maximumHealth === null || speed === null || zone === null || !Number.isInteger(zone) || zone < 0 || zone > (program.profile === 'yr' ? 12 : 11) ||
          !locomotor || !['walk', 'drive', 'hover', 'mech', 'ship'].includes(locomotor.kind ?? '') || !c || c.status !== 'ground-subset' || !grids.has(c.id)) teamSpawnFail('actor-movement');
        worldInteger(maximumHealth, 1, WORLD_LIMITS.health); worldInteger(speed, 1, 255);
        archetypes.set(d.id, { typeId: d.id, kind: d.kind, maximumHealth, movementPerTick: speed, navigationClass: c.id,
          fields: { strength: d.strength, speed: d.speed, speedType: d.speedType } });
      }
      charge(m.quantity); for (let i = 0; i < m.quantity; i++) memberTypeIds.push(m.typeId);
      quantities.set(m.typeId, (quantities.get(m.typeId) ?? 0) + m.quantity);
    }
    if (quantities.size !== t.members.length || t.members.some(m => quantities.get(m.typeId) !== m.quantity)) teamSpawnFail('program-taskforce');
    templates.push({ teamId: t.id, houseId: t.houseId, playerId: t.playerId, memberTypeIds });
  }
  const data = { policy: TEAM_SPAWN_POLICY, programSha256: program.sha256, activationSha256: activation.sha256,
    baseWorldSha256: world.sha256, baseModelSha256: world.model.sha256, entitiesSha256: definitions.fingerprint, traversalSha256: traversal.sha256,
    actions, templates, archetypes: [...archetypes.values()].sort((a, b) => a.typeId < b.typeId ? -1 : a.typeId > b.typeId ? 1 : 0), limits: cap,
    nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const catalog = freeze({ ...data, sha256: worldHash(data) }); catalogs.set(catalog, { program, world }); return catalog;
}
/** Rebuilds source-bound actor descriptors only. This validates a structural save, not an unforgeable history of past occupancy. */
export function restoreTeamSpawnContext(catalog: TeamSpawnCatalog, input: unknown): TeamSpawnContext {
  const { program, world } = teamSpawnCatalogData(catalog), cap = catalog.limits;
  const rows = worldList(worldClone(input), Math.min(cap.records, program.limits.teams));
  const byAction = new Map(catalog.actions.map(a => [a.id, a])), byTeam = new Map(catalog.templates.map(t => [t.teamId, t]));
  const byType = new Map(catalog.archetypes.map(t => [t.typeId, t])), grids = new Map(world.model.navigation.map(b => [b.grid.movementClass, b.grid]));
  const records: TeamSpawnRecord[] = [], actors: TeamSpawnActorBinding[] = [], instances: TeamSpawnInstanceBinding[] = [];
  const entities: WorldEntityDefinition[] = [...world.model.entities]; let nextId = (entities.at(-1)?.id ?? 0) + 1, tick = 0, work = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = worldRecord(rows[i], ['ordinal', 'actionId', 'teamId', 'instanceId', 'bornAtTick', 'actors']), action = byAction.get(worldSymbol(r.actionId));
    const t = action?.teamId ? byTeam.get(action.teamId) : undefined;
    if (!action || !t || r.ordinal !== i || r.teamId !== t.teamId || r.instanceId !== `spawn-team:${i}`) teamSpawnFail('record-source');
    const bornAtTick = worldInteger(r.bornAtTick, tick, cap.tick); tick = bornAtTick;
    const entries = worldList(r.actors, cap.actorsPerRecord);
    if (entries.length !== t.memberTypeIds.length || entries.length > Math.min(cap.historicalActors, program.limits.members) - actors.length || entries.length > WORLD_LIMITS.entities - entities.length) teamSpawnFail('record-actors');
    const members: TeamSpawnActorRecord[] = [], occupied = new Set<number>();
    for (let j = 0; j < entries.length; j++) {
      if (++work > cap.insertionWork) teamSpawnFail('record-work');
      const e = worldRecord(entries[j], ['entityId', 'typeId', 'houseId', 'playerId', 'initialHealth', 'x', 'y']), d = byType.get(t.memberTypeIds[j]!)!;
      if (e.entityId !== nextId || e.typeId !== d.typeId || e.houseId !== t.houseId || e.playerId !== t.playerId || e.initialHealth !== d.maximumHealth) teamSpawnFail('record-actor-source');
      worldInteger(nextId, 1, 2147483647); const at = worldAddress(e.x, e.y), pos = worldPosition(at);
      if (occupied.has(at) || Math.abs(pos.x - action.waypoint.x!) > cap.radius || Math.abs(pos.y - action.waypoint.y!) > cap.radius || !navigationCell(grids.get(d.navigationClass)!, pos)) teamSpawnFail('record-placement');
      occupied.add(at); const rowId = `spawn:${i}:${j}`;
      actors.push({ entityId: nextId, rowId, typeId: d.typeId, houseId: t.houseId, playerId: t.playerId, bornAtTick });
      members.push({ entityId: nextId, typeId: d.typeId, houseId: t.houseId, playerId: t.playerId, initialHealth: d.maximumHealth, ...pos });
      entities.push({ id: nextId++, rowId, typeId: d.typeId, kind: d.kind, owner: t.playerId, ...pos,
        initialHealth: d.maximumHealth, maximumHealth: d.maximumHealth, movementPerTick: d.movementPerTick, navigationClass: d.navigationClass, blocksCell: true });
    }
    const record = { ordinal: i, actionId: action.id, teamId: t.teamId, instanceId: `spawn-team:${i}`, bornAtTick, actors: members };
    records.push(record); instances.push({ id: record.instanceId, teamId: t.teamId, actorIds: members.map(e => e.entityId), bornAtTick });
  }
  const model = rows.length ? createWorldModel({ contentIdentity: world.model.contentIdentity, sourceSha256: world.model.sourceSha256,
    definitionsSha256: world.model.definitionsSha256, navigation: world.model.navigation, blocked: world.model.blocked.map(worldPosition),
    footprints: world.model.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })), entities }) : world.model;
  const recordsSha256 = worldHash(records), data = { policy: TEAM_SPAWN_POLICY, catalogSha256: catalog.sha256, recordsSha256, modelSha256: model.sha256 };
  const context = freeze({ ...data, sha256: worldHash(data) });
  contexts.set(context, freeze({ program, model, actors, instances, catalogSha256: catalog.sha256, recordsSha256, records })); return context;
}
