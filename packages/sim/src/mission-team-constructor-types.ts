// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound ordinary unit construction contracts (Refs #245).
import type { MissionTeamActionSource } from './mission-team-action-source.ts';
import type { MissionHouseSource } from './mission-house-types.ts';
import type { MissionTeamCellSource } from './mission-team-cell-types.ts';
import type { WorldEntityDefinition, WorldModel } from './world-model.ts';

export const MISSION_TEAM_CONSTRUCTOR_POLICY = 'webra2-owned-unit-constructor-1' as const;
export const MISSION_TEAM_CONSTRUCTOR_LIMITS = Object.freeze({ actions: 4096, types: 16384, records: 1024,
  actors: 2048, births: 256, members: 64, references: 262144, work: 2_097_152 });
export type MissionTeamConstructorLimits = { -readonly [K in keyof typeof MISSION_TEAM_CONSTRUCTOR_LIMITS]: number };
export interface MissionTeamConstructorSourceInput {
  readonly actions: MissionTeamActionSource; readonly houses: MissionHouseSource; readonly constructors: MissionTeamCellSource;
}
export interface MissionTeamConstructorAction {
  readonly instructionId: string; readonly opcode: 4 | 7 | 80; readonly teamId: string | null;
  readonly catalogSha256: string | null; readonly typeIds: readonly string[];
  readonly status: 'supported' | 'unsupported' | 'not-construction'; readonly reasons: readonly string[];
}
export interface MissionTeamConstructorArchetype {
  readonly typeId: string; readonly kind: 'unit' | 'infantry'; readonly maximumHealth: number;
  readonly movementPerTick: number; readonly navigationClass: string;
  readonly registeredClass: 'unit' | 'none' | null; readonly presentClass: 'unit' | 'none' | null;
  readonly status: 'supported' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionTeamConstructorSource {
  readonly policy: typeof MISSION_TEAM_CONSTRUCTOR_POLICY; readonly profile: 'ra2' | 'yr';
  readonly actionSourceSha256: string; readonly houseSourceSha256: string; readonly constructorSourceSha256: string;
  readonly baseModelSha256: string; readonly definitionsSha256: string;
  readonly actions: readonly MissionTeamConstructorAction[]; readonly archetypes: readonly MissionTeamConstructorArchetype[];
  readonly allRequiredConstructorsReady: boolean;
  /** Independent existing cell-entry gate, never granted by population preparation. */
  readonly cellWorldInvariantReady: boolean;
  readonly limits: Readonly<MissionTeamConstructorLimits>; readonly sha256: string;
  readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export interface MissionTeamConstructorActor {
  readonly entityId: number; readonly typeId: string; readonly houseId: string; readonly playerId: number;
  readonly initialHealth: number; readonly x: number; readonly y: number;
}
export interface MissionTeamConstructorBirth {
  /** Ordinal within complete common-team history, including recruitment/releases. */
  readonly ordinal: number; readonly actionId: string; readonly instanceId: string; readonly teamId: string;
  readonly bornAtTick: number; readonly ownershipRevision: number; readonly actors: readonly MissionTeamConstructorActor[];
}
export interface MissionTeamConstructorHistory {
  readonly policy: typeof MISSION_TEAM_CONSTRUCTOR_POLICY; readonly sourceSha256: string; readonly baseModelSha256: string;
  readonly births: readonly MissionTeamConstructorBirth[]; readonly sha256: string;
}
export interface MissionTeamConstructorHistoryData {
  readonly source: MissionTeamConstructorSource; readonly base: WorldModel;
  readonly births: readonly MissionTeamConstructorBirth[]; readonly entities: readonly WorldEntityDefinition[];
  readonly work: number;
}
