// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded source composition. See ../MISSION_TEAM_ACTION_PROVENANCE.md.
import type { ScenarioLogic, LogicDefinition } from '../../content/src/scenario-logic.ts';
import type { TeamActivationSource, TeamActivationPlan } from '../../content/src/team-activation.ts';
import type { TeamDefinitions, TeamDefinition, TaskForceDefinition, TeamScriptDefinition } from '../../content/src/team-definitions.ts';
import type { MissionBindingCatalog } from './mission-bindings.ts';
import type { TeamProgram } from './team-runtime-program.ts';
import type { TeamSpawnCatalog } from './team-spawn-context.ts';
import type { TeamRecruitmentCatalog } from './team-recruitment-catalog.ts';
import type { WorldContent } from './world-content.ts';

export const MISSION_TEAM_ACTION_POLICY = 'webra2-mission-team-action-source-1' as const;
export const MISSION_TEAM_ACTION_LIMITS = Object.freeze({ programs: 256, catalogs: 512, actions: 8192,
  declarations: 32768, scriptRows: 131072, diagnostics: 131072, work: 4_194_304,
  nodes: 2_000_000, characters: 32 * 1024 ** 2, serializedBytes: 32 * 1024 ** 2 });
export type MissionTeamActionLimits = { -readonly [K in keyof typeof MISSION_TEAM_ACTION_LIMITS]: number };
export interface MissionTeamActionInput {
  readonly bindings: MissionBindingCatalog; readonly activation: TeamActivationSource;
  readonly programs: readonly TeamProgram[]; readonly spawnCatalogs: readonly TeamSpawnCatalog[];
  readonly recruitmentCatalogs: readonly TeamRecruitmentCatalog[];
}
export interface MissionTeamActionCandidate {
  readonly family: 'spawn' | 'recruitment'; readonly programSha256: string; readonly catalogSha256: string;
}
export interface MissionTeamAction {
  readonly instructionId: string; readonly triggerId: string; readonly rowId: string; readonly ordinal: number;
  readonly opcode: 4 | 7 | 80; readonly parameters: readonly string[]; readonly rawTokens: readonly string[];
  readonly plan: TeamActivationPlan; readonly teamId: string | null; readonly branch: TeamActivationPlan['branch'];
  readonly candidates: readonly MissionTeamActionCandidate[];
  readonly programSha256: string | null; readonly catalogSha256: string | null;
  readonly status: 'supported-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionTeamActionDeclaration<T> {
  readonly id: string;
  /** Exact mission declaration, including every raw field and unreachable script row. */
  readonly mission: LogicDefinition | null;
  /** Complete effective typed source and load history; global declarations are retained too. */
  readonly definition: T | null;
  readonly programSha256s: readonly string[];
  readonly status: 'supported-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionTeamActionDiagnostic {
  readonly namespace: 'bindings' | 'logic' | 'definitions' | 'action' | 'team' | 'script' | 'taskforce' | 'orphan';
  readonly subjectId: string; readonly code: string;
}
export interface MissionTeamActionSource {
  readonly policy: typeof MISSION_TEAM_ACTION_POLICY; readonly profile: ScenarioLogic['profile'];
  readonly source: ScenarioLogic['source']; readonly bindingsSha256: string; readonly activationSha256: string;
  readonly worldContentSha256: string; readonly baseWorldSha256: string; readonly teamsSha256: string;
  readonly entitiesSha256: string; readonly initialWaypointsSha256: string;
  readonly programSha256s: readonly string[]; readonly spawnCatalogSha256s: readonly string[];
  readonly recruitmentCatalogSha256s: readonly string[]; readonly actions: readonly MissionTeamAction[];
  readonly declarations: Readonly<{
    teams: readonly MissionTeamActionDeclaration<TeamDefinition>[];
    scripts: readonly MissionTeamActionDeclaration<TeamScriptDefinition>[];
    taskForces: readonly MissionTeamActionDeclaration<TaskForceDefinition>[];
  }>;
  readonly sourceDiagnostics: Readonly<{ bindings: MissionBindingCatalog['diagnostics']; logic: ScenarioLogic['diagnostics']; definitions: TeamDefinitions['diagnostics'] }>;
  readonly orphanSections: ScenarioLogic['orphanSections']; readonly diagnostics: readonly MissionTeamActionDiagnostic[];
  readonly allActionsSupported: boolean; readonly declarationsComplete: boolean; readonly wholeSourceReady: boolean;
  readonly runtimeAuthority: false; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
  readonly sha256: string;
}
export interface MissionTeamActionSourceContext extends MissionTeamActionInput {
  readonly world: WorldContent; readonly logic: ScenarioLogic; readonly definitions: TeamDefinitions;
}
export class MissionTeamActionError extends Error {
  constructor(readonly code: string) { super(`mission-team-action-${code}`); this.name = 'MissionTeamActionError'; }
}
