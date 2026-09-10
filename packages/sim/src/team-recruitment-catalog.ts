// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound existing-actor eligibility; native scope is documented in TEAM_RECRUITMENT_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { compileScenarioObjects, type ScenarioObjects, type ScenarioPlacement } from '../../content/src/scenario-objects.ts';
import { createIniSourceView, findIniSourceSections, findIniSourceEntries } from '../../content/src/ini-source-view.ts';
import { type RuntimeIni, type IniOrigin } from '../../content/src/runtime-ini.ts';
import { teamBoolean } from '../../content/src/team-values.ts';
import { teamActivationDefinitions, isTeamActivationSource, type TeamActivationSource, type TeamActivationPlan } from '../../content/src/team-activation.ts';
import { type EntityField } from '../../content/src/entity-definitions.ts';
import { teamProgramWorld, teamRuntimeFreeze as freeze, type TeamProgram } from './team-runtime-program.ts';
import { type WorldContent } from './world-content.ts';
import { worldHash, worldInteger, worldList, worldRecord, worldSymbol, WORLD_LIMITS } from './world-values.ts';

export const TEAM_RECRUITMENT_POLICY = 'webra2-existing-force-recruitment-1' as const;
export const TEAM_RECRUITMENT_LIMITS = Object.freeze({ missionBytes: 16 * 1024 ** 2, actions: 256, actors: 2048,
  members: 64, history: 256, pending: 64, retries: 10000, retryTicks: 15, work: 524288,
  tick: WORLD_LIMITS.tick, replayTicks: 10000, replayAdmissions: 1024, replayWork: 16_777_216, trace: 32768 });
export type TeamRecruitmentLimits = { -readonly [K in keyof typeof TEAM_RECRUITMENT_LIMITS]: number };
export interface TeamRecruitmentActor {
  readonly entityId: number; readonly rowId: string; readonly typeId: string; readonly houseId: string | null; readonly playerId: number | null;
  readonly kind: string; readonly origin: IniOrigin; readonly rankRaw: number | null; readonly group: number | null;
  readonly recruitableA: boolean | null; readonly recruitableB: boolean | null; readonly mission: string | null;
  readonly status: 'source-candidate' | 'unsupported'; readonly reasons: readonly string[];
}
export interface TeamRecruitmentTemplate {
  readonly teamId: string; readonly houseId: string; readonly playerId: number; readonly memberTypeIds: readonly string[];
  readonly anchor: Readonly<{ x: number; y: number; rowId: string }> | null;
  readonly group: number; readonly recruiter: boolean; readonly autocreate: boolean; readonly areTeamMembersRecruitable: boolean;
  readonly fields: Readonly<Record<string, EntityField<number | boolean | string>>>;
  readonly status: 'supported-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface TeamRecruitmentCatalog {
  readonly policy: typeof TEAM_RECRUITMENT_POLICY; readonly programSha256: string; readonly activationSha256: string;
  readonly worldSha256: string; readonly modelSha256: string; readonly missionSha256: string; readonly rulesSources: RuntimeIni['layers'];
  readonly actions: readonly TeamActivationPlan[]; readonly templates: readonly TeamRecruitmentTemplate[]; readonly actors: readonly TeamRecruitmentActor[];
  readonly missionControl: readonly Readonly<{ mission: 'Guard' | 'Sleep'; recruitable: boolean | null; history: readonly IniOrigin[]; reasons: readonly string[] }>[];
  readonly limits: Readonly<TeamRecruitmentLimits>; readonly sha256: string; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export class TeamRecruitmentError extends Error { constructor(readonly code: string) { super(`team-recruitment-${code}`); this.name = 'TeamRecruitmentError'; } }
export function teamRecruitmentFail(code: string): never { throw new TeamRecruitmentError(code); }
const catalogs = new WeakMap<object, Readonly<{ program: TeamProgram; world: WorldContent }>>();
export function teamRecruitmentCatalogData(c: TeamRecruitmentCatalog): Readonly<{ program: TeamProgram; world: WorldContent }> {
  const data = catalogs.get(c); if (!data) teamRecruitmentFail('catalog-brand'); return data;
}
export const isTeamRecruitmentCatalog = (v: unknown): v is TeamRecruitmentCatalog => !!v && typeof v === 'object' && catalogs.has(v);
const known = <T>(f: EntityField<T> | undefined): T | null => !f || f.status === 'unsupported' || f.status === 'not-applicable' ? null : f.value;
function limits(input: Partial<TeamRecruitmentLimits>): TeamRecruitmentLimits {
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) teamRecruitmentFail('limits');
  const c: TeamRecruitmentLimits = { ...TEAM_RECRUITMENT_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(c, key)) teamRecruitmentFail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key)!; if (!('value' in d) || !d.enumerable) teamRecruitmentFail('limits');
    c[key as keyof TeamRecruitmentLimits] = worldInteger(d.value, 0, c[key as keyof TeamRecruitmentLimits]);
  } return c;
}
const integer = (v: string | undefined, min = -2147483648, max = 2147483647): number | null => {
  if (v === undefined || !/^[+-]?\d{1,10}$/.test(v)) return null;
  const n = Number(v); return Number.isSafeInteger(n) && n >= min && n <= max ? n || 0 : null;
};
function actorFields(p: ScenarioPlacement): { rankRaw: number | null; group: number | null; recruitableA: boolean | null; recruitableB: boolean | null; reasons: string[] } {
  const reasons: string[] = [], v = p.row.values;
  // Native 128-byte row buffer + strtok omits empty tokens. The bounded policy excludes truncation and missing fields.
  const semantic = p.row.origin.rawValue.split(';', 1)[0]!.trim();
  if (!['infantry', 'unit'].includes(p.kind) || v.length !== 14 || !v.every(s => s.length > 0) || semantic.length > 127 || /[^\x20-\x7e]/.test(semantic))
    reasons.push('placement-tail-framing');
  const infantry = p.kind === 'infantry', rankRaw = integer(v[infantry ? 9 : 8], 0), group = integer(v[infantry ? 10 : 9]);
  const bridge = integer(v[infantry ? 11 : 10]), follower = infantry ? -1 : integer(v[11]);
  const a = integer(v[12], 0, 1), b = integer(v[13], 0, 1);
  if (rankRaw === null || group === null || a === null || b === null) reasons.push('placement-tail-values');
  if (bridge !== 0 || follower !== -1) reasons.push('bridge-or-follower-state');
  if (p.tag !== null && !/^none$/i.test(p.tag)) reasons.push('actor-tag-lifecycle');
  if (p.mission !== 'Guard' && p.mission !== 'Sleep') reasons.push('actor-mission-runtime');
  return { rankRaw, group, recruitableA: a === null ? null : a !== 0, recruitableB: b === null ? null : b !== 0, reasons };
}

/** Validates source authority and retains permanent capability failures separately from live shortages.
 * `rules` byte authenticity remains the verified import session's obligation, exactly as for TeamDefinitions/WorldContent. */
export function compileTeamRecruitmentCatalog(input: { readonly program: TeamProgram; readonly activation: TeamActivationSource;
  readonly rules: RuntimeIni; readonly mission: { readonly source: ScenarioObjects['source']; readonly bytes: Uint8Array };
  readonly actionIds: readonly string[] }, options: Partial<TeamRecruitmentLimits> = {}): TeamRecruitmentCatalog {
  const r = worldRecord(input, ['program', 'activation', 'rules', 'mission', 'actionIds']), cap = limits(options);
  const program = r.program as TeamProgram, world = teamProgramWorld(program);
  if (!isTeamActivationSource(r.activation)) teamRecruitmentFail('activation-brand');
  const activation = r.activation, teams = teamActivationDefinitions(activation), mission = worldRecord(r.mission, ['source', 'bytes']);
  const source = worldRecord(mission.source, ['id', 'profile', 'sha256']);
  if (program.teamsSha256 !== teams.fingerprint || program.entitiesSha256 !== teams.entityFingerprint ||
      activation.profile !== program.profile || activation.source.id !== source.id || source.profile !== program.profile ||
      source.sha256 !== program.missionSha256 || activation.source.sha256 !== source.sha256 || world.model.combat) teamRecruitmentFail('source-identity');
  const rules = r.rules as RuntimeIni, view = createIniSourceView(rules, { work: cap.work });
  if (view.profile !== program.profile || worldHash(rules.layers) !== worldHash(teams.sources.rules) ||
      worldHash(rules.layers) !== worldHash(activation.rulesSources)) teamRecruitmentFail('rules-identity');
  const raw = mission.bytes as Uint8Array;
  if (!raw || Object.getPrototypeOf(raw) !== Uint8Array.prototype || !(raw.buffer instanceof ArrayBuffer) ||
      ['buffer', 'byteOffset', 'byteLength'].some(k => Object.hasOwn(raw, k)) ||
      Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(raw.buffer) || raw.byteLength < 1 || raw.byteLength > cap.missionBytes) teamRecruitmentFail('mission-bytes');
  const bytes = new Uint8Array(raw.byteLength); Uint8Array.prototype.set.call(bytes, raw);
  if (Array.from(sha256(bytes), n => n.toString(16).padStart(2, '0')).join('') !== source.sha256) teamRecruitmentFail('mission-hash');
  const objects = compileScenarioObjects({ profile: program.profile, source: teams.source, bytes }, { objects: cap.actors });
  if (objects.placements.length !== world.placements.length || world.model.entities.length > cap.actors) teamRecruitmentFail('placement-count');
  let work = 0; const charge = (n = 1) => { if (n > cap.work - work) teamRecruitmentFail('catalog-work'); work += n; };
  charge(teams.teams.length + teams.taskForces.length + objects.placements.length + world.placements.length);
  const missionControl: TeamRecruitmentCatalog['missionControl'][number][] = [];
  for (const name of ['Guard', 'Sleep'] as const) {
    let recruitable: boolean | null = true; const history: IniOrigin[] = [], reasons: string[] = [];
    for (const stage of view.stages) {
      charge(); const sections = findIniSourceSections(view, stage.layer.id, name);
      if (sections.length > 1) { recruitable = null; reasons.push('repeated-mission-section'); continue; }
      if (!sections.length) continue;
      const entries = findIniSourceEntries(sections[0]!, 'Recruitable'); charge(entries.length);
      history.push(...entries.map(e => e.origin));
      if (entries.length > 1) { recruitable = null; reasons.push('repeated-mission-key'); continue; }
      if (entries[0]) { const value = teamBoolean(entries[0].value); if (value === null) reasons.push('mission-boolean-syntax'); recruitable = value; }
    }
    missionControl.push({ mission: name, recruitable: reasons.length ? null : recruitable, history, reasons });
  }
  const controls = new Map(missionControl.map(m => [m.mission as string, m]));
  const placements = new Map(world.placements.map(p => [p.rowId, p])), entities = new Map(world.model.entities.map(e => [e.id, e]));
  const actors: TeamRecruitmentActor[] = objects.placements.map(p => {
    charge(); const joined = placements.get(p.row.id), d = joined ? entities.get(joined.entityId) : undefined;
    if (!joined || !d || d.rowId !== p.row.id || d.typeId !== (joined.typeId ?? `unresolved-${d.id}`) || d.owner !== joined.playerId || d.kind !== p.kind) teamRecruitmentFail('placement-join');
    const f = actorFields(p), reasons = [...f.reasons];
    if (joined.status !== 'mobile' || !['infantry', 'unit'].includes(d.kind)) reasons.push('actor-movement-capability');
    if (p.row.origin.sectionSpelling !== (p.kind === 'infantry' ? 'Infantry' : 'Units')) reasons.push('actor-exact-section');
    const control = p.mission ? controls.get(p.mission) : undefined;
    if (!control || control.recruitable === null) reasons.push('actor-mission-control');
    else if (!control.recruitable) reasons.push('actor-mission-not-recruitable');
    return { entityId: d.id, rowId: d.rowId, typeId: d.typeId, houseId: joined.ownerId, playerId: d.owner, kind: d.kind,
      origin: p.row.origin, rankRaw: f.rankRaw, group: f.group, recruitableA: f.recruitableA, recruitableB: f.recruitableB,
      mission: p.mission, status: reasons.length ? 'unsupported' : 'source-candidate', reasons: [...new Set(reasons)].sort() };
  });
  actors.sort((a, b) => a.entityId - b.entityId);
  const selected = worldList(r.actionIds, cap.actions).map(worldSymbol).sort();
  if (!selected.length || new Set(selected).size !== selected.length) teamRecruitmentFail('action-selection');
  const allActions = new Map(activation.plans.map(a => [a.id, a])), selectedTeams = new Set<string>();
  const actions = selected.map(id => {
    const a = allActions.get(id);
    if (!a || a.opcode !== 4 || a.branch !== 'create-team' || a.teamId === null ||
      a.teamOperand.lookup !== 'literal' || a.reasons.length !== 1 || a.reasons[0] !== 'native-recruitment-unimplemented') teamRecruitmentFail('unsupported-action');
    selectedTeams.add(a.teamId); return a;
  });
  if (selectedTeams.size !== program.templates.length || program.templates.some(t => !selectedTeams.has(t.id))) teamRecruitmentFail('program-selection');
  const allTeams = new Map(teams.teams.map(t => [t.id, t])), allForces = new Map(teams.taskForces.map(f => [f.id, f]));
  const waypoints = new Map(objects.waypoints.map(w => [w.number, w]));
  const templates = program.templates.map(t => {
    charge(); const s = allTeams.get(t.id)!, force = allForces.get(s.taskForce.targetId!)!, reasons: string[] = [];
    const field = (key: string) => known(s.fields[key]);
    const groupField = field('group'), group = groupField === -1 ? known(force.fields.group) : groupField;
    if (typeof group !== 'number' || !Number.isSafeInteger(group)) teamRecruitmentFail('group-field');
    const recruiter = field('recruiter'), autocreate = field('autocreate'), areTeamMembersRecruitable = field('areTeamMembersRecruitable');
    if ([recruiter, autocreate, areTeamMembersRecruitable].some(v => typeof v !== 'boolean')) teamRecruitmentFail('flag-field');
    const wp = field('waypoint'), anchor = typeof wp === 'number' ? waypoints.get(wp) : undefined;
    if (!anchor || !anchor.insideDiamond || anchor.row.origin.sectionSpelling !== 'Waypoints') reasons.push('recruitment-anchor');
    const memberTypeIds: string[] = [], seen = new Set<string>();
    for (const m of force.members) {
      charge(); if (!m.typeId || m.quantity === null || m.quantity < 1 || m.status !== 'typed') teamRecruitmentFail('taskforce-member');
      if (seen.has(m.typeId)) reasons.push('duplicate-taskforce-type'); seen.add(m.typeId);
      if (m.quantity > cap.members - memberTypeIds.length) teamRecruitmentFail('member-limit'); charge(m.quantity);
      for (let i = 0; i < m.quantity; i++) memberTypeIds.push(m.typeId);
    }
    const quantities = new Map<string, number>(); for (const id of memberTypeIds) quantities.set(id, (quantities.get(id) ?? 0) + 1);
    if (quantities.size !== t.members.length || t.members.some(m => quantities.get(m.typeId) !== m.quantity)) teamRecruitmentFail('program-taskforce');
    return { teamId: t.id, houseId: t.houseId, playerId: t.playerId, memberTypeIds, anchor: anchor ? { x: anchor.x, y: anchor.y, rowId: anchor.row.id } : null,
      group, recruiter: recruiter as boolean, autocreate: autocreate as boolean, areTeamMembersRecruitable: areTeamMembersRecruitable as boolean,
      fields: { group: s.fields.group!, taskForceGroup: force.fields.group!, recruiter: s.fields.recruiter!, autocreate: s.fields.autocreate!,
        areTeamMembersRecruitable: s.fields.areTeamMembersRecruitable!, veteranLevel: s.fields.veteranLevel!, priority: s.fields.priority! },
      status: reasons.length ? 'unsupported' as const : 'supported-source' as const, reasons: [...new Set(reasons)].sort() };
  });
  const data = { policy: TEAM_RECRUITMENT_POLICY, programSha256: program.sha256, activationSha256: activation.sha256, worldSha256: world.sha256,
    modelSha256: world.model.sha256, missionSha256: program.missionSha256, rulesSources: rules.layers, actions, templates, actors, missionControl, limits: cap,
    nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const catalog: TeamRecruitmentCatalog = freeze({ ...data, sha256: worldHash(data) }); catalogs.set(catalog, freeze({ program, world })); return catalog;
}
