// SPDX-License-Identifier: GPL-3.0-or-later
// Original source/ledger contracts. See ../MISSION_HOUSE_PROVENANCE.md.
import type { EntityDefinitions, EntityField } from '../../content/src/entity-definitions.ts';
import type { RuntimeIni } from '../../content/src/runtime-ini.ts';
import type { MissionBindingCatalog } from './mission-bindings.ts';

export const MISSION_HOUSE_SOURCE_POLICY = 'webra2-mission-house-source-1' as const;
export const MISSION_HOUSE_STATE_POLICY = 'webra2-mission-house-ledger-1' as const;
export const MISSION_HOUSE_LIMITS = Object.freeze({ actors: 32768, types: 16384, houses: 256, instructions: 8192,
  changes: 32768, references: 1_048_576, sourceWork: 29_360_128, work: 2_097_152,
  stages: 64, occurrences: 131072, nodes: 2_000_000, characters: 32 * 1024 ** 2,
  fields: 1_048_576, history: 524288, missionBytes: 16 * 1024 ** 2, serializedBytes: 32 * 1024 ** 2 });
export type MissionHouseLimits = { -readonly [K in keyof typeof MISSION_HOUSE_LIMITS]: number };
export interface MissionHouseInput {
  readonly bindings: MissionBindingCatalog; readonly definitions: EntityDefinitions; readonly rules: RuntimeIni;
  readonly mission: Readonly<{ source: EntityDefinitions['source']; bytes: Uint8Array }>;
}
export type HousePopulationClass = 'none' | 'building' | 'unit' | 'infantry' | 'aircraft';
export interface MissionHouseType {
  readonly typeId: string; readonly kind: string;
  readonly fields: Readonly<{ insignificant: EntityField<boolean>; dontScore: EntityField<boolean>;
    undeploysInto: EntityField<string>; constructionYard: EntityField<boolean>; resourceGatherer: EntityField<boolean>;
    powered: EntityField<boolean>; poweredSpecial: EntityField<boolean> }>;
  readonly undeployTargetTypeId: string | null;
  /** Null means the contribution needs a further native classification, not zero. */
  readonly registeredClass: HousePopulationClass | null; readonly presentClass: HousePopulationClass | null;
  readonly transferPhase: 0 | 1 | null;
  readonly status: 'supported-counts' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionHouseSelector {
  readonly kind: 'first-country-house' | 'current-trigger-house' | 'unsupported';
  readonly raw: string | null; readonly countryIndex: number | null; readonly houseId: string | null; readonly playerId: number | null;
}
export interface MissionHouseInstruction {
  readonly instructionId: string; readonly triggerId: string; readonly rowId: string; readonly ordinal: number;
  readonly opcode: 9 | 10 | 11 | 14 | 36; readonly kind: 'event' | 'action';
  readonly parameters: readonly string[]; readonly rawTokens: readonly string[];
  readonly selector: MissionHouseSelector; readonly status: 'supported-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionHouseSource {
  readonly policy: typeof MISSION_HOUSE_SOURCE_POLICY; readonly profile: EntityDefinitions['profile'];
  readonly source: EntityDefinitions['source']; readonly bindingsSha256: string; readonly definitionsSha256: string;
  readonly worldContentSha256: string; readonly baseWorldSha256: string;
  readonly houses: readonly Readonly<{ playerId: number; houseId: string; countryIndex: number | null }>[];
  readonly initialActors: readonly Readonly<{ entityId: number; typeId: string; owner: number | null; tagId: string | null }>[];
  readonly types: readonly MissionHouseType[]; readonly instructions: readonly MissionHouseInstruction[];
  readonly tagChains: readonly Readonly<{ tagId: string; triggerIds: readonly string[] }>[];
  readonly diagnostics: readonly Readonly<{ code: string; subjectId: string }>[];
  readonly allInstructionsSupported: boolean; readonly initialPopulationTypesSupported: boolean;
  readonly limits: Readonly<MissionHouseLimits>; readonly sha256: string;
  readonly runtimeAuthority: false; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
/** Engine-owned participation facts. Health is deliberately absent: the two native
 * counter families have different lifecycle consumers. The adapter must establish
 * ordinary, non-absorbed/non-technician participation before using this ledger. */
export interface MissionHouseParticipation {
  readonly entityId: number; readonly exists: boolean; readonly registered: boolean; readonly present: boolean; readonly tagEligible: boolean;
}
export interface MissionHouseActor extends MissionHouseParticipation {
  readonly typeId: string; readonly owner: number | null; readonly tagId: string | null;
}
export interface MissionHouseCounts {
  readonly playerId: number;
  readonly registered: Readonly<Record<Exclude<HousePopulationClass, 'none'>, number>>;
  readonly present: Readonly<Record<Exclude<HousePopulationClass, 'none'>, number>>;
  readonly unknownRegistered: number; readonly unknownPresent: number;
}
export interface MissionHouseState {
  readonly schemaVersion: 1; readonly policy: typeof MISSION_HOUSE_STATE_POLICY; readonly sourceSha256: string;
  readonly actors: readonly MissionHouseActor[]; readonly nextEntityId: number; readonly revision: number;
  readonly counts: readonly MissionHouseCounts[]; readonly sha256: string;
}
export type MissionHouseChange =
  | Readonly<{ kind: 'insert'; actor: MissionHouseActor }>
  | Readonly<{ kind: 'participation'; participation: MissionHouseParticipation }>
  | Readonly<{ kind: 'transfer'; entityId: number; owner: number }>
  | Readonly<{ kind: 'remove'; entityId: number }>;
export interface MissionHouseTransferPlan {
  readonly sourceSha256: string; readonly stateSha256: string; readonly instructionId: string;
  readonly sourceHouse: number; readonly destinationHouse: number;
  /** Native array order, with the YR powered-building pass last. */
  readonly entityIds: readonly number[]; readonly changedEntityIds: readonly number[];
  readonly orderPolicy: 'stable-entity-id-with-yr-powered-second-pass';
}
