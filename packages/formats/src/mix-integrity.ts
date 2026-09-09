// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors
// Original WebRA2 import policy composing the GPL MIX reader; not native behavior.
import { MixError, readExact, readMix, type ByteSource, type MixArchive, type MixLimits } from './mix.ts';

/** Trusted digest adapter. Consume every chunk and return a hexadecimal digest. */
export type MixDigest = (algorithm: 'sha1' | 'sha256', chunks: AsyncIterable<Uint8Array>) => Promise<string>;
export interface MixSourceFingerprint { readonly size: number; readonly sha256: string }
export type MixSourceIdentity =
  | { readonly status: 'not-requested' }
  | { readonly status: 'verified'; readonly sha256: string }
  | { readonly status: 'failed'; readonly reason: 'size-mismatch' | 'hash-mismatch' | 'digest-unavailable' | 'digest-failed'; readonly expected: MixSourceFingerprint; readonly actualSize: number; readonly actualSha256?: string };
export type MixIntegrityStatus = 'no-checksum' | 'unverified' | 'verified' | 'mismatch' | 'structural-failure' | 'source-identity-failure' | 'verification-failure';
export interface MixIntegrityReport {
  readonly status: MixIntegrityStatus;
  readonly sourceIdentity: MixSourceIdentity;
  readonly archive?: MixArchive;
  readonly reason?: string;
  readonly expectedSha1?: string;
  readonly actualSha1?: string;
}
export interface MixIntegrityOptions {
  readonly digest?: MixDigest;
  readonly expectedSource?: MixSourceFingerprint;
  readonly verifyChecksum?: boolean;
  readonly chunkBytes?: number;
  readonly limits?: Partial<MixLimits>;
}
export type MixImportPolicy = 'tolerant' | 'strict';
export interface MixImportDecision {
  readonly policy: MixImportPolicy;
  readonly allow: boolean;
  readonly reason: MixIntegrityStatus;
  readonly warnings: readonly ('checksum-absent' | 'checksum-unverified' | 'checksum-mismatch')[];
}

async function digestRange(source: ByteSource, offset: number, size: number, algorithm: 'sha1' | 'sha256', digest: MixDigest, chunkBytes: number): Promise<string> {
  let delivered = 0;
  async function* chunks() {
    while (delivered < size) {
      const bytes = await readExact(source, offset + delivered, Math.min(chunkBytes, size - delivered));
      delivered += bytes.length;
      yield bytes;
    }
  }
  const result = await digest(algorithm, chunks());
  if (delivered !== size) throw new MixError('digest-incomplete', 'Digest adapter did not consume the complete range');
  if (typeof result !== 'string' || !(algorithm === 'sha1' ? /^[0-9a-f]{40}$/i : /^[0-9a-f]{64}$/i).test(result))
    throw new MixError('digest-result', 'Digest adapter returned an invalid result');
  return result.toLowerCase();
}

/** Inspect immutable imported bytes; checksum verification never repairs the source. */
export async function inspectMixIntegrity(source: ByteSource, options: MixIntegrityOptions = {}): Promise<MixIntegrityReport> {
  const chunkBytes = options.chunkBytes ?? 256 * 1024;
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 1024 * 1024)
    throw new MixError('integrity-options', 'Digest chunks must be 1 byte to 1 MiB');
  const expected = options.expectedSource ? { ...options.expectedSource } : undefined;
  const digest = options.digest, verifyChecksum = options.verifyChecksum;
  const limits = options.limits ? { ...options.limits } : undefined;
  if (expected && (!Number.isSafeInteger(expected.size) || expected.size < 0 || !/^[0-9a-f]{64}$/i.test(expected.sha256)))
    throw new MixError('integrity-options', 'Expected source fingerprint requires a safe size and SHA256 hex');
  let sourceIdentity: MixSourceIdentity = { status: 'not-requested' };
  // Enforce archive/index/range caps before a potentially expensive identity scan.
  let archive: MixArchive;
  try { archive = await readMix(source, limits); }
  catch (error) { return { status: 'structural-failure', sourceIdentity, reason: error instanceof MixError ? error.code : 'source-read-failed' }; }
  if (archive.trailingBytes || archive.diagnostics.length) return { status: 'structural-failure', sourceIdentity, archive, reason: 'ambiguous-layout' };
  if (expected) {
    if (source.size !== expected.size) return { status: 'source-identity-failure', sourceIdentity: { status: 'failed', reason: 'size-mismatch', expected, actualSize: source.size } };
    if (!digest) return { status: 'source-identity-failure', sourceIdentity: { status: 'failed', reason: 'digest-unavailable', expected, actualSize: source.size } };
    let actual: string;
    try { actual = await digestRange(source, 0, source.size, 'sha256', digest, chunkBytes); }
    catch { return { status: 'source-identity-failure', sourceIdentity: { status: 'failed', reason: 'digest-failed', expected, actualSize: source.size } }; }
    if (actual !== expected.sha256.toLowerCase()) return { status: 'source-identity-failure', sourceIdentity: { status: 'failed', reason: 'hash-mismatch', expected, actualSize: source.size, actualSha256: actual } };
    sourceIdentity = { status: 'verified', sha256: actual };
  }
  if (archive.checksum.status === 'absent') return { status: 'no-checksum', sourceIdentity, archive };
  const expectedSha1 = archive.checksum.expectedSha1!;
  if (verifyChecksum === false || !digest) return { status: 'unverified', sourceIdentity, archive, expectedSha1, reason: verifyChecksum === false ? 'not-requested' : 'digest-unavailable' };
  let actualSha1: string;
  try { actualSha1 = await digestRange(source, archive.dataOffset, archive.dataSize, 'sha1', digest, chunkBytes); }
  catch { return { status: 'verification-failure', sourceIdentity, archive, expectedSha1, reason: 'digest-or-read-failed' }; }
  return { status: actualSha1 === expectedSha1 ? 'verified' : 'mismatch', sourceIdentity, archive, expectedSha1, actualSha1 };
}

/** WebRA2 policy v1: tolerant retains explicit checksum warnings, never layout/identity failures. */
export function decideMixImport(report: MixIntegrityReport, policy: MixImportPolicy): MixImportDecision {
  if (policy !== 'tolerant' && policy !== 'strict') throw new MixError('integrity-options', 'Unknown MIX import policy');
  // Check the identity dimension too so a recomposed report cannot bypass a pinned source.
  if (report.sourceIdentity.status === 'failed') return { policy, allow: false, reason: 'source-identity-failure', warnings: [] };
  switch (report.status) {
    case 'verified': return { policy, allow: true, reason: report.status, warnings: [] };
    // Classic archives legitimately have no checksum; strict enforces advertised checksums.
    case 'no-checksum': return { policy, allow: true, reason: report.status, warnings: ['checksum-absent'] };
    case 'unverified': return { policy, allow: policy === 'tolerant', reason: report.status, warnings: ['checksum-unverified'] };
    case 'mismatch': return { policy, allow: policy === 'tolerant', reason: report.status, warnings: ['checksum-mismatch'] };
    default: return { policy, allow: false, reason: report.status, warnings: [] };
  }
}
