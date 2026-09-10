// SPDX-License-Identifier: GPL-3.0-or-later
// Original contracts for source-bound team cell-entry context (Refs #212).
import type { CombatAbility } from '../../content/src/combat-veterancy.ts';
import type { EntityDefinitions, EntityField, LocomotorDefinition } from '../../content/src/entity-definitions.ts';
import type { RuntimeIni } from '../../content/src/runtime-ini.ts';
import type { MissionCellEntrySource } from './mission-cell-entry-source.ts';
import type { MissionTeamActionSource } from './mission-team-action-source.ts';
import type { MissionTeamContext } from './mission-team-context.ts';

export const MISSION_TEAM_CELL_SOURCE_POLICY = 'webra2-team-cell-source-1' as const;
export const MISSION_TEAM_CELL_CONTEXT_POLICY = 'webra2-team-cell-context-1' as const;
export const MISSION_TEAM_CELL_LIMITS = Object.freeze({ types: 16384, actors: 2048, actions: 4096,
  catalogs: 256, references: 262144, stages: 64, occurrences: 262144, fields: 262144,
  history: 524288, tokens: 524288, sourceWork: 16_777_216, contextWork: 262144,
  nodes: 2_000_000, characters: 64 * 1024 * 1024, missionBytes: 16 * 1024 * 1024,
  serializedBytes: 32 * 1024 * 1024 });
export type MissionTeamCellLimits = { -readonly [K in keyof typeof MISSION_TEAM_CELL_LIMITS]: number };

export interface MissionTeamCellSourceInput {
  readonly cells: MissionCellEntrySource;
  readonly actions: MissionTeamActionSource;
  readonly definitions: EntityDefinitions;
  readonly rules: RuntimeIni;
  readonly mission: Readonly<{ source: EntityDefinitions['source']; bytes: Uint8Array }>;
}
export interface MissionTeamCellArchetype {
  readonly typeId: string;
  readonly kind: 'infantry' | 'unit';
  readonly actionIds: readonly string[];
  readonly catalogSha256s: readonly string[];
  readonly fields: MissionTeamCellTypeFields;
  /** Constructor/source prerequisites only; not a claim about all native future mutations. */
  readonly constructorEligibility: 'supported' | 'unsupported';
  readonly reasons: readonly string[];
}
export type MissionTeamCellTypeFields = Readonly<{
    cloakable: EntityField<boolean>;
    passengers: EntityField<number>;
    veteranAbilities: EntityField<readonly CombatAbility[]>;
    eliteAbilities: EntityField<readonly CombatAbility[]>;
    locomotor: EntityField<LocomotorDefinition>;
  }>;
export interface MissionTeamCellSourceAction {
  readonly instructionId: string;
  readonly catalogSha256: string | null;
  readonly kind: 'spawn' | 'recruitment' | 'unsupported';
  readonly typeIds: readonly string[];
  readonly status: 'supported' | 'unsupported';
  readonly reasons: readonly string[];
}
export interface MissionTeamCellWorldInvariant {
  readonly policy: 'webra2-independent-ground-team-cell-1';
  readonly navigation: 'authenticated-flat-source-no-overlay';
  /** Additional type/placement prerequisites for every initially alive movable actor. */
  readonly initialActors: readonly Readonly<{
    entityId: number; typeId: string; fields: MissionTeamCellTypeFields;
    status: 'supported' | 'unsupported'; reasons: readonly string[];
  }>[];
  readonly initialCloakProviders: readonly Readonly<{
    entityId: number; typeId: string; cloakGenerator: EntityField<boolean>;
    status: 'inactive' | 'unsupported';
  }>[];
  readonly dynamicOwnershipSupported: false;
  readonly transportAndFollowerAttachmentSupported: false;
  readonly automaticCrateAndCloakProviderMutationSupported: false;
  readonly nativeAutonomousBehaviorVerified: false;
}
export interface MissionTeamCellSource {
  readonly policy: typeof MISSION_TEAM_CELL_SOURCE_POLICY;
  readonly profile: EntityDefinitions['profile'];
  readonly cellSourceSha256: string;
  readonly actionSourceSha256: string;
  readonly baseWorldSha256: string;
  readonly baseModelSha256: string;
  readonly definitionsSha256: string;
  readonly source: EntityDefinitions['source'];
  readonly sources: RuntimeIni['layers'];
  readonly archetypes: readonly MissionTeamCellArchetype[];
  readonly actions: readonly MissionTeamCellSourceAction[];
  readonly invariant: MissionTeamCellWorldInvariant;
  readonly diagnostics: readonly Readonly<{ code: string; subjectId: string }>[];
  readonly coverage: Readonly<{
    representedSpawnActions: number;
    representedSpawnArchetypes: number;
    unsupportedSpawnArchetypes: number;
    /** Includes every represented future spawn archetype, even with empty runtime history. */
    allRequiredConstructorsReady: boolean;
    /** Independent of constructor defaults; consumers must preserve this bounded transition policy. */
    supportedWorldInvariantReady: boolean;
  }>;
  readonly limits: Readonly<MissionTeamCellLimits>;
  readonly sha256: string;
  readonly nativeExecutionVerified: false;
  readonly canStartCampaign: false;
}
export type MissionTeamCellActorProvenance =
  | Readonly<{ kind: 'initial'; cellActorRowId: string }>
  | Readonly<{ kind: 'constructed'; birthRecordOrdinal: number; actionId: string;
      instanceId: string; teamId: string; taskForceSlot: number; bornAtTick: number }>;
export interface MissionTeamCellActor {
  readonly entityId: number;
  readonly typeId: string | null;
  readonly ownerId: string | null;
  readonly playerId: number | null;
  readonly provenance: MissionTeamCellActorProvenance;
  readonly status: 'supported' | 'unsupported';
  readonly reasons: readonly string[];
}
export interface MissionTeamCellContextInput {
  readonly source: MissionTeamCellSource;
  readonly teams: MissionTeamContext;
}
export interface MissionTeamCellContext {
  readonly policy: typeof MISSION_TEAM_CELL_CONTEXT_POLICY;
  readonly sourceSha256: string;
  readonly teamContextSha256: string;
  readonly runtimeSha256: string;
  readonly modelSha256: string;
  /** Includes all initial and historical constructed actors, including actors released from teams. */
  readonly actors: readonly MissionTeamCellActor[];
  readonly sha256: string;
}
