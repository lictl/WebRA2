// SPDX-License-Identifier: GPL-3.0-or-later
// Original data-only source authority and append-only ownership history. No TeamRuntime import cycle.
import { teamRecruitmentCatalogData, teamRecruitmentFail as fail, type TeamRecruitmentCatalog } from './team-recruitment-catalog.ts';
import { teamRuntimeFreeze as freeze, type TeamProgram } from './team-runtime-program.ts';
import { type WorldModel } from './world-model.ts';
import { worldClone, worldHash, worldInteger, worldList, worldRecord, worldSymbol } from './world-values.ts';

export interface TeamRecruitmentClaim {
  readonly kind: 'recruited'; readonly ordinal: number; readonly actionId: string; readonly instanceId: string;
  readonly teamId: string; readonly bornAtTick: number; readonly actorIds: readonly number[];
}
export interface TeamRecruitmentRelease {
  readonly kind: 'released'; readonly ordinal: number; readonly instanceId: string;
  readonly atTick: number; readonly reason: 'finished' | 'lost';
}
export type TeamRecruitmentRecord = TeamRecruitmentClaim | TeamRecruitmentRelease;
export interface TeamRecruitmentActorBinding {
  readonly entityId: number; readonly rowId: string; readonly typeId: string; readonly houseId: string;
  readonly playerId: number; readonly bornAtTick: number; readonly rankRaw: number;
}
export interface TeamRecruitmentInstanceBinding { readonly id: string; readonly teamId: string; readonly actorIds: readonly number[]; readonly bornAtTick: number }
export interface TeamRecruitmentEligibility {
  readonly entityId: number; readonly group: number | null; readonly recruitableB: boolean | null;
  readonly claimedBy: string | null; readonly releasedMissionUnverified: boolean;
}
export interface TeamRecruitmentContext {
  readonly policy: 'webra2-recruitment-context-1'; readonly catalogSha256: string; readonly recordsSha256: string;
  readonly modelSha256: string; readonly sha256: string;
}
export interface TeamRecruitmentContextData {
  readonly catalog: TeamRecruitmentCatalog; readonly program: TeamProgram; readonly model: WorldModel;
  readonly catalogSha256: string; readonly recordsSha256: string; readonly records: readonly TeamRecruitmentRecord[];
  readonly instances: readonly TeamRecruitmentInstanceBinding[]; readonly actors: readonly TeamRecruitmentActorBinding[];
  readonly eligibility: readonly TeamRecruitmentEligibility[];
}
const contexts = new WeakMap<object, TeamRecruitmentContextData>();
export const isTeamRecruitmentContext = (v: unknown): v is TeamRecruitmentContext => !!v && typeof v === 'object' && contexts.has(v);
export function teamRecruitmentContextData(c: TeamRecruitmentContext): TeamRecruitmentContextData {
  const data = contexts.get(c); if (!data) fail('context-brand'); return data;
}
/** Structural/source validation, not cryptographic authorization of past live-world transitions.
 * Commit/migration additionally proves current availability and terminal controller states. */
export function restoreTeamRecruitmentContext(catalog: TeamRecruitmentCatalog, input: unknown): TeamRecruitmentContext {
  const { program, world } = teamRecruitmentCatalogData(catalog), cap = catalog.limits;
  const rows = worldList(worldClone(input), cap.history), records: TeamRecruitmentRecord[] = [];
  const byAction = new Map(catalog.actions.map(a => [a.id, a])), templates = new Map(catalog.templates.map(t => [t.teamId, t]));
  const sourceActors = new Map(catalog.actors.map(a => [a.entityId, a]));
  const eligibility = new Map(catalog.actors.map(a => [a.entityId, { entityId: a.entityId, group: a.group,
    recruitableB: a.recruitableB, claimedBy: null as string | null, releasedMissionUnverified: false }]));
  const active = new Map<string, TeamRecruitmentClaim>(); let tick = 0, work = 0, memberCount = 0;
  const charge = (n = 1) => { if (n > cap.work - work) fail('context-work'); work += n; };
  for (let ordinal = 0; ordinal < rows.length; ordinal++) {
    charge(); const raw = rows[ordinal], d = raw && typeof raw === 'object' ? Object.getOwnPropertyDescriptor(raw, 'kind') : undefined;
    if (!d || !('value' in d)) fail('record-kind');
    if (d.value === 'recruited') {
      const r = worldRecord(raw, ['kind', 'ordinal', 'actionId', 'instanceId', 'teamId', 'bornAtTick', 'actorIds']);
      const actionId = worldSymbol(r.actionId), action = byAction.get(actionId), t = action?.teamId ? templates.get(action.teamId) : undefined;
      if (!t || t.status !== 'supported-source' || r.ordinal !== ordinal || r.teamId !== t.teamId || r.instanceId !== `recruit-team:${ordinal}`) fail('record-source');
      const bornAtTick = worldInteger(r.bornAtTick, tick, cap.tick); tick = bornAtTick;
      const ids = worldList(r.actorIds, cap.members).map(v => worldInteger(v, 1, 2147483647));
      if (ids.length !== t.memberTypeIds.length || ids.length > program.limits.members - memberCount || active.size >= program.limits.teams) fail('record-members');
      if (ordinal + 1 + active.size + 1 > cap.history) fail('record-release-capacity');
      const seen = new Set<number>(); charge(ids.length);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]!, a = sourceActors.get(id), state = eligibility.get(id);
        if (!a || !state || a.status !== 'source-candidate' || a.typeId !== t.memberTypeIds[i] || a.houseId !== t.houseId || a.playerId !== t.playerId ||
          state.claimedBy !== null || state.releasedMissionUnverified || seen.has(id) ||
          !(a.recruitableA || t.autocreate) || (!state.recruitableB && t.autocreate) ||
          (t.group !== -2 && state.group !== t.group && !t.recruiter)) fail('record-actor');
        seen.add(id); state.claimedBy = r.instanceId as string; state.group = t.group; state.recruitableB = t.areTeamMembersRecruitable;
      }
      const claim: TeamRecruitmentClaim = { kind: 'recruited', ordinal, actionId, instanceId: r.instanceId as string,
        teamId: t.teamId, bornAtTick, actorIds: ids };
      active.set(claim.instanceId, claim); records.push(claim); memberCount += ids.length;
    } else if (d.value === 'released') {
      const r = worldRecord(raw, ['kind', 'ordinal', 'instanceId', 'atTick', 'reason']), instanceId = worldSymbol(r.instanceId), claim = active.get(instanceId);
      if (r.ordinal !== ordinal || !claim || (r.reason !== 'finished' && r.reason !== 'lost')) fail('release-record');
      const atTick = worldInteger(r.atTick, Math.max(tick, claim.bornAtTick + 1), cap.tick); tick = atTick; charge(claim.actorIds.length);
      for (const id of claim.actorIds) {
        const state = eligibility.get(id)!; if (state.claimedBy !== instanceId) fail('release-owner');
        state.claimedBy = null; state.releasedMissionUnverified = true;
      }
      active.delete(instanceId); memberCount -= claim.actorIds.length;
      records.push({ kind: 'released', ordinal, instanceId, atTick, reason: r.reason });
    } else fail('record-kind');
  }
  const actors: TeamRecruitmentActorBinding[] = [], instances: TeamRecruitmentInstanceBinding[] = [];
  for (const claim of active.values()) {
    instances.push({ id: claim.instanceId, teamId: claim.teamId, actorIds: [...claim.actorIds].sort((a, b) => a - b), bornAtTick: claim.bornAtTick });
    for (const id of claim.actorIds) {
      const a = sourceActors.get(id)!; actors.push({ entityId: id, rowId: a.rowId, typeId: a.typeId, houseId: a.houseId!,
        playerId: a.playerId!, rankRaw: a.rankRaw!, bornAtTick: claim.bornAtTick });
    }
  }
  instances.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0); actors.sort((a, b) => a.entityId - b.entityId);
  const recordsSha256 = worldHash(records), value = { policy: 'webra2-recruitment-context-1' as const, catalogSha256: catalog.sha256,
    recordsSha256, modelSha256: world.model.sha256 };
  const context = freeze({ ...value, sha256: worldHash(value) });
  contexts.set(context, freeze({ catalog, program, model: world.model, catalogSha256: catalog.sha256, recordsSha256, records,
    instances, actors, eligibility: [...eligibility.values()] })); return context;
}
