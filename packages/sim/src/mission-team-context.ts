// SPDX-License-Identifier: GPL-3.0-or-later
// Original shared source-bound team context; see ../MISSION_TEAM_RUNTIME_PROVENANCE.md.
import type { MissionTeamActionSource } from './mission-team-action-source.ts';
import type { TeamProgram } from './team-runtime-program.ts';
import type { WorldModel } from './world-model.ts';

export const MISSION_TEAM_RUNTIME_POLICY = 'webra2-mission-team-transaction-1' as const;
export const MISSION_TEAM_LIMITS = Object.freeze({ history: 256, historicalActors: 256, activeTeams: 64,
  members: 256, actorsPerTeam: 64, requests: 1024, pending: 64, retries: 10000, retryTicks: 15,
  insertionWork: 262144, selectionWork: 524288, tickWork: 16_777_216, replayWork: 16_777_216,
  replayTicks: 10000, trace: 32768, tick: 1_000_000_000 });
export type MissionTeamLimits = { -readonly [K in keyof typeof MISSION_TEAM_LIMITS]: number };
export interface MissionTeamRuntime {
  readonly policy: typeof MISSION_TEAM_RUNTIME_POLICY; readonly sourceSha256: string;
  readonly programSha256: string; readonly baseModelSha256: string;
  readonly limits: Readonly<MissionTeamLimits>; readonly ownedBindingSha256?: string; readonly sha256: string;
}
export interface MissionTeamSpawnActor {
  readonly entityId: number; readonly typeId: string; readonly houseId: string; readonly playerId: number;
  readonly initialHealth: number; readonly x: number; readonly y: number;
}
export interface MissionTeamSpawnRecord {
  readonly kind: 'spawned'; readonly ordinal: number; readonly actionId: string; readonly instanceId: string;
  readonly teamId: string; readonly bornAtTick: number; readonly actors: readonly MissionTeamSpawnActor[]; readonly ownershipRevision?: number;
}
export interface MissionTeamRecruitRecord {
  readonly kind: 'recruited'; readonly ordinal: number; readonly actionId: string; readonly instanceId: string;
  readonly teamId: string; readonly bornAtTick: number; readonly actorIds: readonly number[]; readonly ownershipRevision?: number;
}
export interface MissionTeamReleaseRecord {
  readonly kind: 'released'; readonly ordinal: number; readonly instanceId: string;
  readonly atTick: number; readonly reason: 'finished' | 'lost'; readonly ownershipRevision?: number;
}
export type MissionTeamRecord = MissionTeamSpawnRecord | MissionTeamRecruitRecord | MissionTeamReleaseRecord;
export interface MissionTeamActorBinding {
  readonly entityId: number; readonly rowId: string; readonly typeId: string; readonly houseId: string;
  readonly playerId: number; readonly bornAtTick: number;
}
export interface MissionTeamInstanceBinding {
  readonly id: string; readonly teamId: string; readonly actorIds: readonly number[]; readonly bornAtTick: number;
}
export interface MissionTeamEligibility {
  readonly entityId: number; readonly group: number | null; readonly recruitableB: boolean | null;
  readonly claimedBy: string | null; readonly releasedMissionUnverified: boolean;
}
export interface MissionTeamContext {
  readonly policy: 'webra2-mission-team-context-1'; readonly runtimeSha256: string;
  readonly recordsSha256: string; readonly modelSha256: string; readonly ownershipTransfersSha256?: string; readonly sha256: string;
}
export interface MissionTeamRuntimeData {
  readonly source: MissionTeamActionSource; readonly program: TeamProgram; readonly baseModel: WorldModel; readonly owned: MissionTeamOwnedBinding | null;
}
export interface MissionTeamContextData {
  readonly runtime: MissionTeamRuntime; readonly program: TeamProgram; readonly model: WorldModel;
  readonly records: readonly MissionTeamRecord[]; readonly actors: readonly MissionTeamActorBinding[];
  readonly instances: readonly MissionTeamInstanceBinding[]; readonly historyBindings: readonly MissionTeamInstanceBinding[];
  readonly eligibility: readonly MissionTeamEligibility[]; readonly work: number; readonly worldRestoreWork: number;
}

import { missionTeamActionSourceContext } from './mission-team-action-source.ts';
import { unionTeamPrograms, teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { teamSpawnCatalogData } from './team-spawn-context.ts';
import { teamRecruitmentCatalogData, type TeamRecruitmentActor } from './team-recruitment-catalog.ts';
import { createWorldModel, WORLD_MOTION_POLICY, type WorldEntityDefinition } from './world-model.ts';
import { navigationCell } from './navigation.ts';
import { teamSleepFlow } from './team-sleep-policy.ts';
import { worldHash, worldInteger, worldList, worldRecord, worldSymbol, WORLD_LIMITS, worldAddress } from './world-values.ts';
import { missionTeamFail as fail, missionTeamSnapshot } from './mission-team-values.ts';
import { missionTeamOwnedBindingData, restoreMissionTeamOwnedWorld, missionTeamOwnedConstructionModel, type MissionTeamOwnedBinding } from './mission-team-owned-binding.ts';
import type { MissionTeamConstructorBirth } from './mission-team-constructor-types.ts';
import { worldOwnershipAtRevision } from './world-ownership.ts';
const runtimes = new WeakMap<object, MissionTeamRuntimeData>();
const contexts = new WeakMap<object, MissionTeamContextData>();
export function missionTeamRuntimeData(runtime: MissionTeamRuntime): MissionTeamRuntimeData {
  const data = runtimes.get(runtime); if (!data) fail('runtime-brand'); return data;
}
export const isMissionTeamContext = (value: unknown): value is MissionTeamContext => !!value && typeof value === 'object' && contexts.has(value);
export function missionTeamContextData(context: MissionTeamContext): MissionTeamContextData {
  const data = contexts.get(context); if (!data) fail('context-brand'); return data;
}
function limits(input: Partial<MissionTeamLimits>): MissionTeamLimits {
  const keys = Reflect.ownKeys(input); if (keys.some(k => typeof k !== 'string' || !Object.hasOwn(MISSION_TEAM_LIMITS, k))) fail('limits');
  const values = worldRecord(input, keys as string[]), cap: MissionTeamLimits = { ...MISSION_TEAM_LIMITS };
  for (const key of keys as (keyof MissionTeamLimits)[]) cap[key] = worldInteger(values[key], 0, cap[key]);
  return cap;
}
/** Scoped action execution capability only; wholeSourceReady must additionally gate mission authority. */
export function compileMissionTeamRuntime(source: MissionTeamActionSource, lowerLimits: Partial<MissionTeamLimits> = {}, owned: MissionTeamOwnedBinding | null = null): MissionTeamRuntime {
  const data = missionTeamActionSourceContext(source), cap = limits(lowerLimits), original = data.world.model;
  const bound = owned === null ? null : missionTeamOwnedBindingData(owned);
  if (bound && bound.source !== source) fail('owned-source');
  const base = bound?.model ?? original;
  if (!owned && (base.combat || base.infantryPassage || base.motionPolicy !== WORLD_MOTION_POLICY)) fail('dynamic-world-context');
  const program = unionTeamPrograms(data.programs);
  cap.activeTeams = Math.min(cap.activeTeams, program.limits.teams); cap.members = Math.min(cap.members, program.limits.members);
  cap.tick = Math.min(cap.tick, program.limits.tick); cap.tickWork = Math.min(cap.tickWork, program.limits.replayWork);
  cap.replayWork = Math.min(cap.replayWork, program.limits.replayWork); cap.trace = Math.min(cap.trace, program.limits.trace);
  if (program.modelSha256 !== original.sha256 || program.worldSha256 !== data.world.sha256) fail('program-world');
  for (const c of [...data.spawnCatalogs, ...data.recruitmentCatalogs]) {
    cap.retries = Math.min(cap.retries, c.limits.retries); cap.retryTicks = Math.min(cap.retryTicks, c.limits.retryTicks);
    cap.pending = Math.min(cap.pending, c.limits.pending); cap.requests = Math.min(cap.requests, c.limits.replayAdmissions);
    cap.tick = Math.min(cap.tick, c.limits.tick); cap.tickWork = Math.min(cap.tickWork, c.limits.replayWork);
    cap.replayWork = Math.min(cap.replayWork, c.limits.replayWork); cap.trace = Math.min(cap.trace, c.limits.trace);
  }
  for (const c of data.recruitmentCatalogs) cap.history = Math.min(cap.history, c.limits.history);
  for (const c of data.spawnCatalogs) if (teamSpawnCatalogData(c).world.model.sha256 !== original.sha256) fail('spawn-world');
  const actorRows = new Map<number, TeamRecruitmentActor>();
  for (const c of data.recruitmentCatalogs) {
    if (teamRecruitmentCatalogData(c).world.model.sha256 !== original.sha256) fail('recruit-world');
    for (const a of c.actors) { const prior = actorRows.get(a.entityId); if (prior && worldHash(prior) !== worldHash(a)) fail('actor-source-conflict'); actorRows.set(a.entityId, a); }
  }
  const value = { policy: MISSION_TEAM_RUNTIME_POLICY, sourceSha256: source.sha256, programSha256: program.sha256, baseModelSha256: base.sha256, limits: cap, ...(owned ? { ownedBindingSha256: owned.sha256 } : {}) };
  const runtime = freeze({ ...value, sha256: worldHash(value) }); runtimes.set(runtime, freeze({ source, program, baseModel: base, owned })); return runtime;
}
export function missionTeamAction(runtime: MissionTeamRuntime, actionId: string) {
  const { source, owned } = missionTeamRuntimeData(runtime), context = missionTeamActionSourceContext(source);
  const action = source.actions.find(a => a.instructionId === actionId);
  if (owned && !owned.actions.some(a => a.instructionId === actionId && a.status === 'supported')) fail('owned-action-unsupported');
  if (!action || action.status !== 'supported-source' || action.teamId === null || action.catalogSha256 === null) fail('unsupported-action');
  const spawn = context.spawnCatalogs.find(c => c.sha256 === action.catalogSha256);
  const recruitment = context.recruitmentCatalogs.find(c => c.sha256 === action.catalogSha256);
  if ((!spawn && !recruitment) || (spawn && recruitment)) fail('catalog-identity');
  return { action, spawn, recruitment };
}
/** Append-only structural/source validation. Live occupancy/availability is proved at the transaction boundary. */
export function restoreMissionTeamContext(runtime: MissionTeamRuntime, input: unknown, currentWorld?: unknown, workLimit = runtime.limits.tickWork): MissionTeamContext {
  const { source, program, baseModel: base, owned } = missionTeamRuntimeData(runtime), cap = runtime.limits;
  const budget = worldInteger(workLimit, 0, cap.tickWork); let work = 0;
  const charge = (n: number) => { if (n > budget - work) fail('context-work'); work += n; };
  const constructors = owned && missionTeamOwnedBindingData(owned).constructors;
  let constructed: Readonly<{ model: WorldModel; work: number }> | null = null;
  let copiedRows: unknown[] | undefined;
  if (constructors) {
    copiedRows = worldList(missionTeamSnapshot(input, charge), cap.history);
    const births = copiedRows.flatMap(raw => {
      const value = worldRecord(raw, Reflect.ownKeys(raw as object) as string[]);
      if (value.kind !== 'spawned') return [];
      const { kind: _kind, ...birth } = worldRecord(raw, ['kind', 'ordinal', 'actionId', 'instanceId', 'teamId', 'bornAtTick', 'actors', 'ownershipRevision']);
      return [birth as unknown as MissionTeamConstructorBirth];
    });
    constructed = missionTeamOwnedConstructionModel(owned!, births, budget - work); charge(constructed.work);
  }
  const live = owned ? restoreMissionTeamOwnedWorld(owned, currentWorld, budget - work, constructed?.model) : null;
  if (live) charge(live.work);
  const sourceData = missionTeamActionSourceContext(source), rows = copiedRows ?? worldList(missionTeamSnapshot(input, owned ? charge : undefined), cap.history);
  const revisionAt = (value: unknown, atTick: number, minimum = 0) => {
    const revision = worldInteger(value, minimum, live!.ownership.transfers.length);
    if (atTick > live!.world.nextTick || (live!.ownership.transfers[revision - 1]?.nextTick ?? 0) > atTick ||
      (live!.ownership.transfers[revision]?.nextTick ?? Infinity) < atTick) fail('owner-revision-time');
    return revision;
  };
  if (owned) charge(base.entities.length * 3 + base.navigation.length + sourceData.recruitmentCatalogs.length +
    sourceData.recruitmentCatalogs.reduce((n, c) => n + c.actors.length * 2, 0));
  const placed = new Map<number, TeamRecruitmentActor>();
  for (const c of sourceData.recruitmentCatalogs) for (const a of c.actors) placed.set(a.entityId, a);
  const eligibility = new Map<number, MissionTeamEligibility>([...placed].map(([entityId, a]) => [entityId,
    { entityId, group: a.group, recruitableB: a.recruitableB, claimedBy: null, releasedMissionUnverified: false }]));
  const records: MissionTeamRecord[] = [], entities: WorldEntityDefinition[] = [...base.entities];
  const active = new Map<string, MissionTeamInstanceBinding>(), historyBindings: MissionTeamInstanceBinding[] = [];
  const bindings = new Map<number, MissionTeamActorBinding>(), grids = new Map(base.navigation.map(n => [n.grid.movementClass, n.grid]));
  const catalogCounts = new Map<string, { records: number; actors: number }>();
  let tick = 0, nextId = (entities.at(-1)?.id ?? 0) + 1, spawned = 0, memberCount = 0, ownershipRevision = 0;
  for (let ordinal = 0; ordinal < rows.length; ordinal++) {
    if (owned) charge(1 + base.entities.length + source.actions.length + sourceData.recruitmentCatalogs.length + program.templates.length);
    const raw = rows[ordinal], kind = worldRecord(raw, Reflect.ownKeys(raw as object) as string[]).kind;
    if (kind === 'released') {
      const r = worldRecord(raw, ['kind', 'ordinal', 'instanceId', 'atTick', 'reason', ...(owned ? ['ownershipRevision'] : [])]), instanceId = worldSymbol(r.instanceId), claim = active.get(instanceId);
      if (!claim || r.ordinal !== ordinal || (r.reason !== 'finished' && r.reason !== 'lost')) fail('release-record');
      let earliest = claim.bornAtTick + 1;
      if (r.reason === 'finished') {
        if (owned) charge(program.templates.reduce((n, t) => n + t.steps.length, 0));
        const steps = program.templates.find(t => t.id === claim.teamId)!.steps;
        if (!teamSleepFlow(steps).canFinish) fail('release-unfinishable-script');
        // D03 executes at most one instruction update per tick. Move additionally
        // observes arrival on a later update; the final finished update is separate.
        let cursor = 0, updates = 1;
        while (cursor < steps.length) {
          const step = steps[cursor]!; updates += step.opcode === 3 ? 2 : 1;
          cursor = step.opcode === 6 ? step.target : cursor + 1;
        }
        earliest = claim.bornAtTick + updates;
      }
      const atTick = worldInteger(r.atTick, Math.max(tick, earliest), cap.tick); tick = atTick;
      const releasedRevision = owned ? revisionAt(r.ownershipRevision, atTick, ownershipRevision) : null;
      if (owned) ownershipRevision = releasedRevision!;
      if (owned) {
        const record = records.find(r => r.kind !== 'released' && r.instanceId === claim.id)! as MissionTeamRecruitRecord | MissionTeamSpawnRecord;
        if (releasedRevision! < record.ownershipRevision! || (live!.ownership.transfers[releasedRevision! - 1]?.nextTick ?? 0) > atTick) fail('release-owner-time');
        for (const id of claim.actorIds) if (worldOwnershipAtRevision(live!.model, live!.ownership, id, releasedRevision!).lastChangeRevision > record.ownershipRevision!) fail('active-owner-change');
      }
      for (const id of claim.actorIds) { const state = eligibility.get(id); if (!state || state.claimedBy !== instanceId) fail('release-ownership');
        eligibility.set(id, { ...state, claimedBy: null, releasedMissionUnverified: true }); bindings.delete(id); }
      memberCount -= claim.actorIds.length; active.delete(instanceId);
      records.push({ kind, ordinal, instanceId, atTick, reason: r.reason, ...(owned ? { ownershipRevision: releasedRevision! } : {}) }); continue;
    }
    if (kind !== 'spawned' && kind !== 'recruited') fail('record-kind');
    const r = worldRecord(raw, ['kind', 'ordinal', 'actionId', 'instanceId', 'teamId', 'bornAtTick', kind === 'spawned' ? 'actors' : 'actorIds', ...(owned ? ['ownershipRevision'] : [])]);
    const actionId = worldSymbol(r.actionId), selected = missionTeamAction(runtime, actionId), instanceId = `mission-team:${ordinal}`;
    const postTransferReady = !owned || owned.actions.some(a => a.instructionId === actionId && a.postTransferRecruitment === 'stationary-guard-sleep');
    if (r.ordinal !== ordinal || r.instanceId !== instanceId || r.teamId !== selected.action.teamId || (kind === 'spawned') !== !!selected.spawn) fail('record-source');
    const teamId = selected.action.teamId!, bornAtTick = worldInteger(r.bornAtTick, tick, cap.tick); tick = bornAtTick;
    const catalog = selected.spawn ?? selected.recruitment!, counter = catalogCounts.get(catalog.sha256) ?? { records: 0, actors: 0 };
    const t = catalog.templates.find(t => t.teamId === teamId)!;
    if (!t || active.size >= cap.activeTeams || t.memberTypeIds.length > cap.members - memberCount || t.memberTypeIds.length > cap.actorsPerTeam ||
      ordinal + 1 + active.size + 1 > cap.history) fail('claim-capacity');
    const ids: number[] = [];
    const revision = owned ? revisionAt(r.ownershipRevision, bornAtTick, ownershipRevision) : null;
    if (owned) ownershipRevision = revision!;
    if (kind === 'spawned') {
      const c = selected.spawn!, members = worldList(r.actors, Math.min(cap.actorsPerTeam, c.limits.actorsPerRecord));
      if (members.length !== t.memberTypeIds.length || members.length > cap.historicalActors - spawned ||
        members.length > c.limits.historicalActors - counter.actors || counter.records >= c.limits.records ||
        members.length > WORLD_LIMITS.entities - entities.length || nextId + members.length - 1 > 2147483647) fail('spawn-capacity');
      const types = new Map(c.archetypes.map(a => [a.typeId, a])), actors: MissionTeamSpawnActor[] = [], occupied = new Set<number>();
      const waypoint = selected.action.plan.waypoint;
      if (waypoint.x === null || waypoint.y === null) fail('spawn-waypoint');
      for (let j = 0; j < members.length; j++) {
        const a = worldRecord(members[j], ['entityId', 'typeId', 'houseId', 'playerId', 'initialHealth', 'x', 'y']), archetype = types.get(t.memberTypeIds[j]!);
        if (!archetype || a.entityId !== nextId || a.typeId !== archetype.typeId || a.houseId !== t.houseId || a.playerId !== t.playerId || a.initialHealth !== archetype.maximumHealth) fail('spawn-actor');
        const at = worldAddress(a.x, a.y), x = at % 512, y = Math.floor(at / 512);
        if (occupied.has(at) || Math.abs(x - waypoint.x) > c.limits.radius || Math.abs(y - waypoint.y) > c.limits.radius || !navigationCell(grids.get(archetype.navigationClass)!, { x, y })) fail('spawn-cell');
        occupied.add(at); const id = nextId++, rowId = `mission-spawn:${ordinal}:${j}`; ids.push(id);
        actors.push({ entityId: id, typeId: archetype.typeId, houseId: t.houseId, playerId: t.playerId, initialHealth: archetype.maximumHealth, x, y });
        entities.push({ id, rowId, typeId: archetype.typeId, owner: t.playerId, kind: archetype.kind, x, y, initialHealth: archetype.maximumHealth,
          maximumHealth: archetype.maximumHealth, movementPerTick: archetype.movementPerTick, navigationClass: archetype.navigationClass, blocksCell: true });
        bindings.set(id, { entityId: id, rowId, typeId: archetype.typeId, houseId: t.houseId, playerId: t.playerId, bornAtTick });
        // Constructors do not authenticate recruitment mission/group state. They cannot become placed recruitment candidates.
        eligibility.set(id, { entityId: id, group: null, recruitableB: null, claimedBy: instanceId, releasedMissionUnverified: false });
      }
      spawned += actors.length; counter.actors += actors.length; records.push({ kind, ordinal, actionId, instanceId, teamId, bornAtTick, actors, ...(owned ? { ownershipRevision: revision! } : {}) });
    } else {
      const c = selected.recruitment!, template = c.templates.find(t => t.teamId === teamId)!;
      if (owned) charge(c.actors.length + c.templates.length + t.memberTypeIds.length);
      if (template.status !== 'supported-source' || counter.records >= c.limits.history) fail('recruit-source');
      const values = worldList(r.actorIds, Math.min(cap.actorsPerTeam, c.limits.members)), sourceActors = new Map(c.actors.map(a => [a.entityId, a])), seen = new Set<number>();
      if (values.length !== template.memberTypeIds.length) fail('recruit-force');
      for (let i = 0; i < values.length; i++) {
        const id = worldInteger(values[i], 1, 2147483647), a = sourceActors.get(id), state = eligibility.get(id);
        if (!a || a.status !== 'source-candidate' || !state || seen.has(id) || state.claimedBy !== null || state.releasedMissionUnverified ||
          a.typeId !== template.memberTypeIds[i] || (!owned && (a.houseId !== template.houseId || a.playerId !== template.playerId)) ||
          (owned && (worldOwnershipAtRevision(live!.model, live!.ownership, id, revision!).owner !== template.playerId ||
            (worldOwnershipAtRevision(live!.model, live!.ownership, id, revision!).lastChangeRevision > 0 &&
              !postTransferReady))) ||
          !(a.recruitableA || template.autocreate) || (!state.recruitableB && template.autocreate) ||
          (template.group !== -2 && state.group !== template.group && !template.recruiter)) fail('recruit-actor');
        seen.add(id); ids.push(id); eligibility.set(id, { ...state, group: template.group, recruitableB: template.areTeamMembersRecruitable, claimedBy: instanceId });
        bindings.set(id, { entityId: id, rowId: a.rowId, typeId: a.typeId, houseId: template.houseId, playerId: template.playerId, bornAtTick });
      }
      records.push({ kind, ordinal, actionId, instanceId, teamId, bornAtTick, actorIds: ids, ...(owned ? { ownershipRevision: revision! } : {}) });
    }
    counter.records++; catalogCounts.set(catalog.sha256, counter); memberCount += ids.length;
    const binding = { id: instanceId, teamId, actorIds: [...ids].sort((a, b) => a - b), bornAtTick };
    active.set(instanceId, binding); historyBindings.push(binding);
  }
  if (owned) charge(active.size * records.length + memberCount * 12);
  if (owned) for (const claim of active.values()) {
    const record = records.find(r => r.kind !== 'released' && r.instanceId === claim.id)! as MissionTeamRecruitRecord | MissionTeamSpawnRecord;
    for (const id of claim.actorIds) if (worldOwnershipAtRevision(live!.model, live!.ownership, id, live!.ownership.transfers.length).lastChangeRevision > record.ownershipRevision!) fail('active-owner-change');
  }
  const model = owned ? live!.model : spawned ? createWorldModel({ contentIdentity: base.contentIdentity, sourceSha256: base.sourceSha256, definitionsSha256: base.definitionsSha256,
    entities, navigation: base.navigation, blocked: base.blocked.map(n => ({ x: n % 512, y: Math.floor(n / 512) })),
    footprints: base.footprints.map(f => ({ entityId: f.entityId, cells: f.cells.map(n => ({ x: n % 512, y: Math.floor(n / 512) })) })) }) : base;
  if (constructed && worldHash(model.entities) !== worldHash(entities)) fail('owned-constructor-definitions');
  const value = { policy: 'webra2-mission-team-context-1' as const, runtimeSha256: runtime.sha256, recordsSha256: worldHash(records), modelSha256: model.sha256,
    ...(owned ? { ownershipTransfersSha256: worldHash(live!.world.state.ownership!.transfers) } : {}) };
  const context = freeze({ ...value, sha256: worldHash(value) });
  contexts.set(context, freeze({ runtime, program, model, records, actors: [...bindings.values()].sort((a, b) => a.entityId - b.entityId),
    instances: [...active.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), historyBindings,
    eligibility: [...eligibility.values()].sort((a, b) => a.entityId - b.entityId), work, worldRestoreWork: live?.work ?? 0 })); return context;
}
