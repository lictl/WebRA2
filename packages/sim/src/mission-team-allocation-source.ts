// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded native source interpretation; see ../MISSION_TEAM_ALLOCATION_PROVENANCE.md.
import type { RuntimeIni, IniOrigin } from '../../content/src/runtime-ini.ts';
import type { TeamDefinition, TeamDefinitions } from '../../content/src/team-definitions.ts';
import type { MissionTeamActionSource } from './mission-team-action-source.ts';

export const MISSION_TEAM_ALLOCATION_POLICY = 'webra2-fresh-campaign-team-allocation-source-1' as const;
export const MISSION_TEAM_ALLOCATION_LIMITS = Object.freeze({ missionBytes: 16 * 1024 ** 2, stages: 64,
  occurrences: 262144, declarations: 32768, roots: 131072, references: 131072, history: 262144,
  tokens: 524288, diagnostics: 131072, work: 4_194_304, nodes: 2_000_000,
  characters: 64 * 1024 ** 2, serializedBytes: 64 * 1024 ** 2 });
export type MissionTeamAllocationLimits = { -readonly [K in keyof typeof MISSION_TEAM_ALLOCATION_LIMITS]: number };
export interface MissionTeamAllocationInput {
  readonly source: MissionTeamActionSource; readonly rules: RuntimeIni; readonly ai: RuntimeIni;
  readonly mission: Readonly<{ source: TeamDefinitions['source']; bytes: Uint8Array }>;
  readonly initialization: 'fresh-campaign';
}
export interface MissionTeamNativeNameLoad {
  readonly phase: string; readonly layerId: string; readonly sectionLine: number | null;
  readonly origin: IniOrigin | null; readonly before: string | null; readonly after: string | null;
  readonly status: 'explicit' | 'retained' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionTeamNativeName {
  readonly id: string; readonly kind: 'team' | 'script' | 'taskforce'; readonly allocationIndex: number;
  readonly storedId: string; readonly initial: string; readonly value: string | null;
  readonly status: 'supported' | 'unsupported'; readonly loads: readonly MissionTeamNativeNameLoad[];
}
export interface MissionTeamAliasReference {
  readonly id: string; readonly origin: IniOrigin; readonly token: number;
  readonly raw: string; readonly lookup: 'per-entry-id-then-name-ascii-case-insensitive';
  readonly lookupStage: 'after-team-definition-loads';
  readonly status: 'resolved' | 'none' | 'missing' | 'unsupported';
  /** First allocated matching entry wins, even when its Name precedes a later exact ID. */
  readonly targetId: string | null; readonly matchedBy: 'id' | 'name' | null;
  readonly matches: readonly Readonly<{ teamId: string; allocationIndex: number; matchedBy: 'id' | 'name' }>[];
  readonly reasons: readonly string[];
}
export interface MissionTeamAITriggerLoad {
  readonly phase: 'global-ai' | 'mission-ai'; readonly origin: IniOrigin; readonly tokens: readonly string[];
  readonly team1ReferenceId: string; readonly team2ReferenceId: string;
  readonly isGlobal: boolean; readonly isForSkirmish: boolean | null;
  readonly difficulties: readonly (boolean | null)[];
  readonly reasons: readonly string[];
}
export interface MissionTeamAITrigger {
  readonly id: string; readonly storedId: string; readonly allocationIndex: number;
  readonly loads: readonly MissionTeamAITriggerLoad[];
  readonly enables: readonly Readonly<{ origin: IniOrigin; value: boolean | null }>[];
  readonly initialEnabled: boolean | null;
  /** These are initial ConditionMet gates, never lifetime inactivity or allocation permission. */
  readonly initialCondition: 'proven-excluded' | 'conditional' | 'unsupported';
  readonly reasons: readonly string[];
}
export interface MissionTeamAllocationRoot {
  readonly id: string;
  readonly kind: 'explicit-action' | 'ai-trigger' | 'script-18' | 'automatic-template' | 'native-unmodeled';
  readonly origin: IniOrigin | null; readonly instructionId: string | null;
  readonly teamIds: readonly string[]; readonly scriptId: string | null;
  readonly status: 'required' | 'conditional' | 'proven-excluded-initial';
  readonly owner: 'template-default' | 'caller-house-overrides-template' | 'current-team-house' | 'unknown';
  readonly reasons: readonly string[];
}
export interface MissionTeamAllocationDeclaration {
  readonly id: string; readonly kind: MissionTeamNativeName['kind'];
  readonly nativeName: MissionTeamNativeName; readonly sourceDeclarationIndex: number;
  readonly incomingRootIds: readonly string[];
  /** No source row is discarded merely because there is no explicit action edge. */
  readonly reachability: 'required' | 'conditional' | 'unproven';
  readonly owner: TeamDefinition['owner'] | null;
  readonly defaultHouseAvailable: boolean | null;
}
export interface MissionTeamAllocationResolution {
  readonly sourceDiagnosticIndex: number; readonly namespace: string; readonly subjectId: string; readonly code: string;
  readonly status: 'resolved-source-field' | 'required'; readonly rule: 'native-name-load-history' | null;
  readonly origins: readonly IniOrigin[];
}
export interface MissionTeamAllocationSource {
  readonly policy: typeof MISSION_TEAM_ALLOCATION_POLICY; readonly profile: TeamDefinitions['profile'];
  readonly sourceSha256: string; readonly teamsSha256: string; readonly worldContentSha256: string;
  readonly initialization: 'fresh-campaign';
  readonly authentication: Readonly<{ scope: 'owned-mission-and-pinned-upstream-tables';
    upstreamRulesAIBytesRequired: true; rulesSha256: string; aiSha256: string; missionSha256: string }>;
  readonly declarations: readonly MissionTeamAllocationDeclaration[];
  readonly references: readonly MissionTeamAliasReference[]; readonly aiTriggers: readonly MissionTeamAITrigger[];
  readonly roots: readonly MissionTeamAllocationRoot[];
  readonly ignoreGlobalAITriggers: Readonly<{ value: boolean | null; origin: IniOrigin | null; reasons: readonly string[] }>;
  readonly diagnosticResolutions: readonly MissionTeamAllocationResolution[];
  readonly diagnostics: readonly Readonly<{ subjectId: string; code: string; origin: IniOrigin | null }>[];
  readonly sourceDiagnostics: MissionTeamActionSource['diagnostics'];
  readonly retainedDeclarations: MissionTeamActionSource['declarations'];
  readonly tables: Readonly<{ rules: RuntimeIni; ai: RuntimeIni }>;
  readonly nativeAllocationComplete: false; readonly runtimeAuthority: false;
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
  readonly sha256: string;
}
