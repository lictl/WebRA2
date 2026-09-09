// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Browser inspection composes the GPL MIX reader.
import type { ProfileId } from '../../contracts/src/index.ts';
import type { MixImportPolicy, MixIntegrityStatus } from '../../formats/src/mix-integrity.ts';

export interface ImportProgress {
  readonly phase: 'validate' | 'archives' | 'requirements';
  readonly filesProcessed: number;
  readonly totalFiles: number;
  readonly archives: number;
  readonly members: number;
  readonly bytesRead: number;
  readonly currentPath?: string;
}
export interface BrowserImportOptions {
  readonly profile: ProfileId;
  readonly policy: MixImportPolicy;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: ImportProgress) => void;
}
/** File/Blob selection is a local handle, not a verified content fingerprint. */
export interface BrowserUnverifiedIdentity { readonly status: 'unverified'; readonly sha256: null }
export type BrowserProfileStatus = 'eligible' | 'excluded' | 'unassigned';
export interface BrowserImportFile {
  readonly id: string;
  readonly path: string;
  readonly size: number;
  readonly kind: 'archive' | 'loose' | 'program' | 'unsupported';
  readonly status: 'accepted' | 'ignored' | 'invalid' | 'duplicate';
  readonly profileStatus: BrowserProfileStatus;
  readonly identity: BrowserUnverifiedIdentity;
}
export interface BrowserImportMember {
  readonly ordinal: number;
  readonly idHex: string;
  /** Relative to the archive payload; use archive.dataOffset to form a root range. */
  readonly offset: number;
  readonly size: number;
  readonly names: readonly string[];
  readonly nameEvidence: readonly { readonly name: string; readonly source: string; readonly hashKind: 'classic' | 'crc32' }[];
}
export interface BrowserImportArchive {
  readonly id: string;
  readonly sourceId: string;
  readonly parentId: string | null;
  readonly absoluteOffset: number;
  readonly size: number;
  readonly nameCandidates: readonly string[];
  readonly identification: 'filename' | 'name-candidate' | 'structural-probe';
  readonly profileStatus: BrowserProfileStatus;
  readonly identity: BrowserUnverifiedIdentity;
  readonly format: 'classic' | 'flagged' | 'encrypted' | null;
  readonly dataOffset: number;
  readonly memberCount: number;
  readonly integrity: MixIntegrityStatus;
  readonly allowed: boolean;
  readonly members: readonly BrowserImportMember[];
}
export interface BrowserImportRequirement {
  readonly path: string;
  /** These statuses concern candidate presence, never verified bytes or campaign readiness. */
  readonly status: 'literal' | 'candidate' | 'ambiguous' | 'missing' | 'blocked';
  readonly matches: readonly { readonly sourceId: string; readonly archiveId: string | null; readonly ordinal: number | null }[];
}
export interface BrowserImportDiagnostic {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly sourceId?: string;
  readonly archiveId?: string;
  readonly path?: string;
}
export interface BrowserImportReport {
  readonly schemaVersion: 1;
  readonly profile: ProfileId;
  readonly policy: MixImportPolicy;
  /** Inspected means the bounded pass finished, not that content is complete or valid. */
  readonly status: 'inspected' | 'limited';
  readonly files: readonly BrowserImportFile[];
  readonly archives: readonly BrowserImportArchive[];
  readonly requirements: readonly BrowserImportRequirement[];
  readonly diagnostics: readonly BrowserImportDiagnostic[];
  readonly summary: {
    readonly selectedFiles: number;
    readonly acceptedFiles: number;
    readonly ignoredFiles: number;
    readonly archives: number;
    readonly members: number;
    readonly namedMembers: number;
    readonly bytesRead: number;
  };
  readonly canStartCampaign: false;
}
