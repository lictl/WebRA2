// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound script admission; see ../TEAM_RUNTIME_PROVENANCE.md.
import { TEAM_SLEEP_POLICY, teamSleepInstruction, type TeamSleepInstruction } from './team-sleep-policy.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { isTeamDefinitions, type TeamDefinitions } from '../../content/src/team-definitions.ts';
import { compileScenarioObjects, type ScenarioObjects } from '../../content/src/scenario-objects.ts';
import { isWorldContent, type WorldContent } from './world-content.ts';
import { worldHash, worldInteger, worldList, worldRecord, worldSymbol, worldSourceHash } from './world-values.ts';

export const TEAM_RUNTIME_POLICY = 'webra2-existing-team-cells-2' as const;
export const TEAM_RUNTIME_LIMITS = Object.freeze({ missionBytes: 16 * 1024 ** 2, teams: 64, members: 256,
  steps: 3200, orders: 256, candidateCells: 1089, work: 262144, ticks: 128, replayTicks: 10000,
  replayAdmissions: 1024, replayWork: 16_777_216, trace: 32768, tick: 1_000_000_000 });
export type TeamRuntimeLimits = { -readonly [K in keyof typeof TEAM_RUNTIME_LIMITS]: number };
export type TeamInstruction = Readonly<{ opcode: 3; sourceSlot: number; waypoint: number; rowId: string; x: number; y: number }> |
  Readonly<{ opcode: 6; sourceSlot: number; target: number }> | TeamSleepInstruction;
export interface TeamTemplate {
  readonly id: string; readonly taskForceId: string; readonly scriptId: string;
  readonly houseId: string; readonly playerId: number;
  readonly members: readonly Readonly<{ typeId: string; quantity: number }>[];
  readonly steps: readonly TeamInstruction[];
}
export interface TeamProgram {
  readonly schemaVersion: 1; readonly policy: typeof TEAM_RUNTIME_POLICY; readonly sleepPolicy: typeof TEAM_SLEEP_POLICY;
  readonly profile: 'ra2' | 'yr'; readonly teamsSha256: string; readonly worldSha256: string;
  readonly modelSha256: string; readonly missionSha256: string; readonly entitiesSha256: string;
  readonly templates: readonly TeamTemplate[]; readonly limits: Readonly<TeamRuntimeLimits>;
  readonly sha256: string; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export interface TeamRuntimeDiagnostic { readonly subjectId: string; readonly code: string }
export interface TeamCompilation {
  readonly program: TeamProgram | null;
  readonly coverage: readonly Readonly<{ teamId: string; steps: number; supportedSteps: number; reasons: readonly string[] }>[];
  readonly diagnostics: readonly TeamRuntimeDiagnostic[];
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export class TeamRuntimeError extends Error { constructor(readonly code: string) { super(`team-runtime-${code}`); this.name = 'TeamRuntimeError'; } }
export function teamRuntimeFail(code: string): never { throw new TeamRuntimeError(code); }
export function teamRuntimeFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const child of Object.values(v)) teamRuntimeFreeze(child); Object.freeze(v); } return v;
}
const worlds = new WeakMap<object, WorldContent>();
export const isTeamProgram = (v: unknown): v is TeamProgram => !!v && typeof v === 'object' && worlds.has(v);
export function teamProgramWorld(program: TeamProgram): WorldContent { const world = worlds.get(program); if (!world) teamRuntimeFail('program-brand'); return world; }
function settings(value: Partial<TeamRuntimeLimits>): TeamRuntimeLimits {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) teamRuntimeFail('limits');
  const cap: TeamRuntimeLimits = { ...TEAM_RUNTIME_LIMITS };
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) teamRuntimeFail('limits');
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in d) || !d.enumerable) teamRuntimeFail('limits');
    cap[key as keyof TeamRuntimeLimits] = worldInteger(d.value, 0, cap[key as keyof TeamRuntimeLimits]);
  }
  return cap;
}
function ownedBytes(value: Uint8Array, cap: number): Uint8Array {
  if (!value || Object.getPrototypeOf(value) !== Uint8Array.prototype ||
    ['byteLength', 'buffer', 'byteOffset'].some(k => Object.hasOwn(value, k))) teamRuntimeFail('mission-bytes');
  if (!(value.buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(value.buffer) ||
    value.byteLength < 1 || value.byteLength > cap) teamRuntimeFail('mission-bytes');
  const bytes = new Uint8Array(value.byteLength); Uint8Array.prototype.set.call(bytes, value); return bytes;
}

/** Select complete scripts only. Existing-actor activation is explicit and does not implement native team creation. */
export function compileTeamProgram(input: { readonly teams: TeamDefinitions; readonly world: WorldContent;
  readonly mission: { readonly source: ScenarioObjects['source']; readonly bytes: Uint8Array };
  readonly teamIds: readonly string[] }, lowerLimits: Partial<TeamRuntimeLimits> = {}): TeamCompilation {
  const r = worldRecord(input, ['teams', 'world', 'mission', 'teamIds']), cap = settings(lowerLimits);
  if (!isTeamDefinitions(r.teams) || !isWorldContent(r.world)) teamRuntimeFail('source-brand');
  const teams = r.teams, world = r.world, mission = worldRecord(r.mission, ['source', 'bytes']), source = worldRecord(mission.source, ['id', 'profile', 'sha256']);
  if (teams.entityFingerprint !== world.definitionsSha256 || teams.profile !== world.model.contentIdentity.profile ||
    teams.source.sha256 !== world.model.sourceSha256 || world.model.definitionsSha256 !== world.sha256 ||
    source.profile !== teams.profile || source.id !== teams.source.id || source.sha256 !== teams.source.sha256) teamRuntimeFail('source-identity');
  worldSourceHash(source.sha256); worldSymbol(source.id);
  const selected = worldList(r.teamIds, cap.teams).map(worldSymbol).sort();
  if (!selected.length || new Set(selected).size !== selected.length) teamRuntimeFail('team-selection');
  const bytes = ownedBytes(mission.bytes as Uint8Array, cap.missionBytes);
  if (Array.from(sha256(bytes), n => n.toString(16).padStart(2, '0')).join('') !== source.sha256) teamRuntimeFail('mission-hash');
  const objects = compileScenarioObjects({ profile: teams.profile, source: teams.source, bytes });
  const waypoints = new Map(objects.waypoints.map(w => [w.row.id, w]));
  const allTeams = new Map(teams.teams.map(t => [t.id, t])), scripts = new Map(teams.scripts.map(s => [s.id, s]));
  const forces = new Map(teams.taskForces.map(f => [f.id, f])), players = new Map(world.players.map(p => [p.houseId, p.playerId]));
  const templates: TeamTemplate[] = [], coverage: { teamId: string; steps: number; supportedSteps: number; reasons: string[] }[] = [];
  const diagnostics: TeamRuntimeDiagnostic[] = []; let totalSteps = 0, members = 0, work = 0;
  const charge = () => { if (++work > cap.work) teamRuntimeFail('program-work-limit'); };
  for (const teamId of selected) {
    charge(); const t = allTeams.get(teamId); if (!t) teamRuntimeFail('missing-selected-team');
    const reasons = new Set<string>(), add = (code: string) => reasons.add(code);
    if (!t.typed) add('unsupported-team-source');
    if (t.tag.status !== 'none') add('tag-lifecycle');
    // Activation/assembly flags are retained by teamsSha256, but not executed for explicit complete bindings.
    for (const [key, value] of Object.entries(t.fields)) {
      charge(); if (value.status === 'unsupported') add(`unsupported-field:${key}`);
      if (typeof value.value === 'boolean' && value.value && !['full', 'autocreate', 'prebuild', 'recruiter', 'areTeamMembersRecruitable'].includes(key)) add(`team-behavior:${key}`);
    }
    const owner = t.owner.value, playerId = owner?.houseId ? players.get(owner.houseId) : undefined;
    if (!owner || owner.status !== 'country-house' || t.owner.status === 'unsupported' || playerId === undefined) add('team-house');
    const script = t.script.targetId ? scripts.get(t.script.targetId) : undefined;
    const force = t.taskForce.targetId ? forces.get(t.taskForce.targetId) : undefined;
    if (!script || !script.numericFramingComplete || !script.steps.length) add('script-source');
    if (!force || !force.typed || !force.members.length) add('taskforce-source');
    const types = new Map<string, number>();
    for (const member of force?.members ?? []) {
      charge(); const n = member.quantity;
      if (member.status !== 'typed' || n === null || n < 1 || !member.typeId) { add('taskforce-member'); continue; }
      if (n > cap.members - members) teamRuntimeFail('program-member-limit'); members += n;
      types.set(member.typeId, (types.get(member.typeId) ?? 0) + n);
    }
    const steps: TeamInstruction[] = [];
    if (script && script.steps.length > cap.steps - totalSteps) teamRuntimeFail('program-step-limit');
    totalSteps += script?.steps.length ?? 0;
    for (const s of script?.steps ?? []) {
      charge();
      const sleep = teamSleepInstruction(s.opcode, s.argument, s.sourceSlot);
      if (sleep) { steps.push(sleep); continue; }
      if (s.status !== 'typed') { add(`unsupported-operand:${s.sourceSlot}`); continue; }
      if (s.opcode === 3) {
        const wp = s.waypointRowId ? waypoints.get(s.waypointRowId) : undefined;
        if (!wp || wp.number !== s.argument || !wp.insideDiamond || wp.row.origin.sectionSpelling !== 'Waypoints') { add(`waypoint-source:${s.sourceSlot}`); continue; }
        steps.push({ opcode: 3, sourceSlot: s.sourceSlot, waypoint: wp.number, rowId: wp.row.id, x: wp.x, y: wp.y });
      } else if (s.opcode === 6 && s.operand.targetRuntimeIndex !== null && s.operand.targetRuntimeIndex >= 0 && s.operand.targetRuntimeIndex < script!.steps.length) {
        steps.push({ opcode: 6, sourceSlot: s.sourceSlot, target: s.operand.targetRuntimeIndex });
      } else add(s.opcode === 5 ? 'guard-acquisition' : `unsupported-opcode:${s.opcode}`);
    }
    if (steps.some(s => s.opcode === 11) && world.model.combat) add('sleep-combat-policy');
    const row = { teamId, steps: script?.steps.length ?? 0, supportedSteps: steps.length, reasons: [...reasons].sort() }; coverage.push(row);
    for (const code of row.reasons) diagnostics.push({ subjectId: teamId, code });
    if (!reasons.size) templates.push({ id: teamId, taskForceId: force!.id, scriptId: script!.id, houseId: owner!.houseId!, playerId: playerId!,
      members: [...types].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([typeId, quantity]) => ({ typeId, quantity })), steps });
  }
  if (diagnostics.length) return teamRuntimeFreeze({ program: null, coverage, diagnostics, nativeExecutionVerified: false, canStartCampaign: false });
  const data = { schemaVersion: 1 as const, policy: TEAM_RUNTIME_POLICY, sleepPolicy: TEAM_SLEEP_POLICY, profile: teams.profile, teamsSha256: teams.fingerprint,
    worldSha256: world.sha256, modelSha256: world.model.sha256, missionSha256: teams.source.sha256, entitiesSha256: teams.entityFingerprint,
    templates, limits: cap, nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const program: TeamProgram = teamRuntimeFreeze({ ...data, sha256: worldHash(data) }); worlds.set(program, world);
  return teamRuntimeFreeze({ program, coverage, diagnostics, nativeExecutionVerified: false, canStartCampaign: false });
}
