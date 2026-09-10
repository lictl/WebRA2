// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_AUDIO_PROVENANCE.md.
import type { MissionCueCatalog } from './mission-cue-types.ts';
import type { BrowserRootIdentity } from '../../vfs/src/browser-verified.ts';

export const MISSION_AUDIO_POLICY = 'webra2-mission-audio-reference-1' as const;
export const MISSION_AUDIO_LIMITS = Object.freeze({ candidates: 512, inputBytes: 16 * 1024 ** 2,
  sourceBytes: 4 * 1024 ** 2, sourceLines: 65536, registryEntries: 8192, samples: 4096,
  sampleBytes: 16 * 1024 ** 2, sampleTotalBytes: 64 * 1024 ** 2, serializedBytes: 16 * 1024 ** 2 });
export type MissionAudioLimits = { readonly [K in keyof typeof MISSION_AUDIO_LIMITS]: number };
/** Explicit import namespace. archivePath excludes the root and lists outer to inner MIX names. */
export interface MissionAudioLocator {
  readonly path: string; readonly rootPath: string; readonly archivePath: readonly string[];
  readonly root: BrowserRootIdentity; readonly absoluteOffset: number; readonly size: number;
}
export interface MissionAudioSource extends MissionAudioLocator { readonly sha256: string; readonly bytes: Uint8Array }
export interface MissionAudioWave extends MissionAudioLocator { readonly sha256: string }
export interface MissionAudioPlanInput {
  readonly cues: MissionCueCatalog; readonly side: 0 | 1 | 2;
  /** Selected native audio MIX presence. YR AUDIO.MIX fallback without an absence proof is unsupported. */
  readonly audioMountCandidates: readonly MissionAudioLocator[];
  readonly sources: readonly MissionAudioSource[]; readonly bags: readonly MissionAudioLocator[];
  readonly waveCandidates: readonly MissionAudioWave[];
}
export interface MissionAudioCandidate extends MissionAudioLocator { readonly id: string; readonly sha256: string | null }
export interface MissionAudioSelection {
  readonly path: string; readonly status: 'selected' | 'missing' | 'unsupported';
  readonly candidates: readonly string[]; readonly selected: readonly string[]; readonly reasons: readonly string[];
}
export interface MissionAudioField { readonly key: string; readonly value: string; readonly line: number }
export interface MissionAudioSample {
  readonly id: string; readonly path: string; readonly kind: 'bag' | 'wav';
  readonly candidates: readonly string[]; readonly selected: readonly string[];
  readonly bankOffset: number | null; readonly size: number;
  readonly expectedSha256: string | null;
  /** Native index fields, not a decoded PCM buffer or a playback contract. */
  readonly index: Readonly<{ sourceOrdinal: number; nativeSortedIndex: number; sampleRate: number; flags: number; chunkSize: number }> | null;
}
export interface MissionAudioBinding {
  readonly instructionId: string; readonly opcode: 19 | 20 | 21;
  readonly status: 'planned-reference' | 'unsupported'; readonly reasons: readonly string[];
  readonly registryPath: string; readonly registrySha256: string | null;
  readonly registryOrdinal: number | null; readonly registryName: string | null;
  readonly fields: readonly MissionAudioField[]; readonly defaults: readonly MissionAudioField[];
  /** Ordered list, including repeated entries. This does not select a native random/loop sample. */
  readonly samples: readonly string[]; readonly pendingPlayback: readonly string[];
}
export interface MissionAudioPlan {
  readonly policy: typeof MISSION_AUDIO_POLICY; readonly profile: 'ra2' | 'yr'; readonly side: 0 | 1 | 2;
  readonly missionSha256: string; readonly cuesSha256: string; readonly sha256: string;
  readonly candidates: readonly MissionAudioCandidate[]; readonly selections: readonly MissionAudioSelection[];
  readonly selectedAudioMounts: readonly MissionAudioLocator[];
  readonly bindings: readonly MissionAudioBinding[]; readonly samples: readonly MissionAudioSample[];
  readonly scope: 'provided-import-candidates'; readonly rootIdentitiesVerified: false;
  readonly nativeExecutionVerified: false; readonly playbackReady: false; readonly canStartCampaign: false;
}
export interface MissionAudioPreparedSample {
  readonly id: string; readonly kind: 'bag' | 'wav'; readonly size: number; readonly sha256: string;
  readonly locators: readonly MissionAudioLocator[]; readonly index: MissionAudioSample['index'];
  readonly format: Readonly<{ kind: 'indexed' | 'riff-wave'; sampleRate: number; channels: number;
    bitsPerSample: number | null; formatTag: number | null; blockAlign: number }>;
}
export interface MissionAudioCatalog {
  readonly policy: typeof MISSION_AUDIO_POLICY; readonly planSha256: string; readonly sha256: string;
  readonly profile: 'ra2' | 'yr'; readonly side: 0 | 1 | 2; readonly missionSha256: string; readonly cuesSha256: string;
  readonly samples: readonly MissionAudioPreparedSample[];
  readonly bindings: readonly (Omit<MissionAudioBinding, 'status'> & { readonly status: 'verified-reference' | 'unsupported' })[];
  readonly rootIdentitiesVerified: true; readonly wholeBagMembersHashed: false;
  readonly nativeExecutionVerified: false; readonly playbackReady: false; readonly canStartCampaign: false;
}
export class MissionAudioError extends Error {
  constructor(readonly code: string) { super(`mission-audio-${code}`); this.name = 'MissionAudioError'; }
}
export function audioFail(code: string): never { throw new MissionAudioError(code); }
