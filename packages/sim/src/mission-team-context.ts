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
  readonly limits: Readonly<MissionTeamLimits>; readonly sha256: string;
}
export interface MissionTeamSpawnActor {
  readonly entityId: number; readonly typeId: string; readonly houseId: string; readonly playerId: number;
  readonly initialHealth: number; readonly x: number; readonly y: number;
}
export interface MissionTeamSpawnRecord {
  readonly kind: 'spawned'; readonly ordinal: number; readonly actionId: string; readonly instanceId: string;
  readonly teamId: string; readonly bornAtTick: number; readonly actors: readonly MissionTeamSpawnActor[];
}
export interface MissionTeamRecruitRecord {
  readonly kind: 'recruited'; readonly ordinal: number; readonly actionId: string; readonly instanceId: string;
  readonly teamId: string; readonly bornAtTick: number; readonly actorIds: readonly number[];
}
export interface MissionTeamReleaseRecord {
  readonly kind: 'released'; readonly ordinal: number; readonly instanceId: string;
  readonly atTick: number; readonly reason: 'finished' | 'lost';
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
  readonly recordsSha256: string; readonly modelSha256: string; readonly sha256: string;
}
export interface MissionTeamRuntimeData {
  readonly source: MissionTeamActionSource; readonly program: TeamProgram; readonly baseModel: WorldModel;
}
export interface MissionTeamContextData {
  readonly runtime: MissionTeamRuntime; readonly program: TeamProgram; readonly model: WorldModel;
  readonly records: readonly MissionTeamRecord[]; readonly actors: readonly MissionTeamActorBinding[];
  readonly instances: readonly MissionTeamInstanceBinding[]; readonly historyBindings: readonly MissionTeamInstanceBinding[];
  readonly eligibility: readonly MissionTeamEligibility[];
}
