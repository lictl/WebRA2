// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_AUDIO_POLICY_PROVENANCE.md.
import type { MissionCueCatalog, MissionCueInstruction } from './mission-cue-types.ts';
import type { MissionAudioBinding, MissionAudioCatalog, MissionAudioField } from './mission-audio-types.ts';

export const MISSION_AUDIO_SOURCE_POLICY = 'webra2-mission-audio-source-policy-1' as const;
export const MISSION_AUDIO_SOURCE_LIMITS = Object.freeze({ bindings: 8192, fields: 262144, tokens: 262144,
  histories: 524288, samples: 131072, diagnostics: 262144, work: 2097152,
  characters: 16 * 1024 ** 2, serializedBytes: 32 * 1024 ** 2 });
export type MissionAudioSourceLimits = { -readonly [K in keyof typeof MISSION_AUDIO_SOURCE_LIMITS]: number };
export interface MissionAudioPolicyInput {
  readonly cues: MissionCueCatalog;
  readonly audio: MissionAudioCatalog;
  /** Default globals are a process-start assumption, never restored/native live state. */
  readonly initialization: 'fresh-process-audio-load';
}
export interface MissionAudioPolicyOrigin {
  readonly stage: 'image-default' | 'defaults-section' | 'definition-section' | 'action-override';
  readonly registrySha256: string | null;
  readonly section: string | null;
  readonly field: MissionAudioField | null;
}
export interface MissionAudioPolicyValue {
  readonly key: string;
  readonly status: 'supported-source' | 'unsupported';
  readonly value: number | readonly number[] | null;
  readonly unit: string;
  readonly history: readonly Readonly<{ origin: MissionAudioPolicyOrigin;
    value: number | readonly number[] | null; status: 'explicit' | 'default' | 'retained' | 'unsupported' }>[];
  readonly reasons: readonly string[];
}
export interface MissionSoundSelectionPolicy {
  readonly kind: 'sound-sample-partitions';
  readonly status: 'supported-source' | 'unsupported';
  /** Source order and duplicates remain meaningful. These are candidates, not chosen samples. */
  readonly attack: readonly string[];
  readonly body: readonly string[];
  readonly decay: readonly string[];
  readonly bodyRule: 'first-body' | 'random-body' | 'all-body-ordered' | 'all-body-random-order' | null;
  readonly attackRule: 'none' | 'random-partition-member' | null;
  readonly decayRule: 'none' | 'random-partition-member' | null;
  readonly loopCount: number | null;
  readonly reasons: readonly string[];
}
export interface MissionEvaRequestPolicy {
  readonly kind: 'eva-request';
  readonly status: 'supported-source' | 'unsupported';
  readonly side: 0 | 1 | 2;
  readonly selectedSamples: readonly string[];
  /** The mission caller supplies2 regardless of the stored definition Type. */
  readonly callerType: 2;
  readonly priority: number | null;
  readonly reasons: readonly string[];
}
export interface MissionAudioPolicyBinding {
  readonly instructionId: string;
  readonly opcode: 19 | 20 | 21;
  readonly instruction: MissionCueInstruction;
  readonly reference: MissionAudioCatalog['bindings'][number];
  readonly status: 'supported-source' | 'unsupported';
  readonly values: readonly MissionAudioPolicyValue[];
  readonly selection: MissionSoundSelectionPolicy | MissionEvaRequestPolicy | null;
  readonly caller: Readonly<{ type: 'global-sound'; panning: 8192; volume: 1; controller: null }>
    | Readonly<{ type: 'eva'; typeOverride: 2; priorityOverride: -1 }> | null;
  readonly requiredState: readonly string[];
  readonly reasons: readonly string[];
  readonly retainedFields: readonly MissionAudioField[];
  readonly retainedDefaults: readonly MissionAudioField[];
  readonly pendingPlayback: MissionAudioBinding['pendingPlayback'];
}
export interface MissionAudioPolicyCatalog {
  readonly policy: typeof MISSION_AUDIO_SOURCE_POLICY;
  readonly profile: 'ra2' | 'yr';
  readonly initialization: 'fresh-process-audio-load';
  readonly missionSha256: string;
  readonly cuesSha256: string;
  readonly audioSha256: string;
  readonly side: 0 | 1 | 2;
  readonly sha256: string;
  readonly sourceScope: 'verified-audio-reference-normalized-fields';
  readonly bindings: readonly MissionAudioPolicyBinding[];
  readonly diagnostics: readonly Readonly<{ instructionId: string; code: string }>[];
  readonly runtimeAuthority: false;
  readonly nativeExecutionVerified: false;
  readonly playbackReady: false;
  readonly canStartCampaign: false;
}
