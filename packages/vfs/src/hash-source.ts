// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../HASH_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { assertRange, readExact, DEFAULT_MIX_LIMITS, type ByteSource } from '../../formats/src/mix.ts';

export type SourceHashAlgorithm = 'sha256' | 'sha1';
export const SOURCE_HASH_LIMITS = Object.freeze({ defaultBytes: 16 * 1024 * 1024,
  maxBytes: DEFAULT_MIX_LIMITS.maxArchiveBytes, defaultChunkBytes: 64 * 1024, maxChunkBytes: 1024 * 1024 });
export class SourceHashError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'SourceHashError'; }
}
export interface SourceHashProgress { readonly bytesRead: number; readonly totalBytes: number; readonly chunks: number }
export interface SourceHashOptions {
  readonly algorithm?: SourceHashAlgorithm;
  readonly offset?: number;
  readonly length?: number;
  /** Raising the ordinary-member default requires an explicit bounded root-verification operation. */
  readonly byteLimit?: number;
  readonly chunkBytes?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: SourceHashProgress) => void;
}
export interface SourceHashResult extends SourceHashProgress {
  readonly algorithm: SourceHashAlgorithm;
  readonly offset: number;
  readonly hex: string;
}
function aborted(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Source hashing cancelled', 'AbortError'); }

/** Hash one immutable source range sequentially. No partial digest is returned. */
export async function hashByteSource(source: ByteSource, options: SourceHashOptions = {}): Promise<SourceHashResult> {
  const size = source.size, offset = options.offset ?? 0, length = options.length ?? size - offset;
  const algorithm = options.algorithm ?? 'sha256', chunkBytes = options.chunkBytes ?? SOURCE_HASH_LIMITS.defaultChunkBytes;
  const byteLimit = options.byteLimit ?? SOURCE_HASH_LIMITS.defaultBytes, signal = options.signal, onProgress = options.onProgress;
  if (!['sha1', 'sha256'].includes(algorithm) || !Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > SOURCE_HASH_LIMITS.maxChunkBytes ||
      !Number.isSafeInteger(byteLimit) || byteLimit < 0 || byteLimit > SOURCE_HASH_LIMITS.maxBytes) throw new SourceHashError('hash-options');
  assertRange(size, offset, length);
  if (length > byteLimit) throw new SourceHashError('hash-byte-limit');
  aborted(signal);
  const state = (algorithm === 'sha256' ? sha256 : sha1).create();
  let bytesRead = 0, chunks = 0, lastYield = performance.now();
  function progress() { onProgress?.(Object.freeze({ bytesRead, totalBytes: length, chunks })); aborted(signal); }
  try {
    progress();
    while (bytesRead < length) {
      aborted(signal);
      if (source.size !== size) throw new SourceHashError('source-size-changed');
      const bytes = await readExact(source, offset + bytesRead, Math.min(chunkBytes, length - bytesRead));
      aborted(signal);
      if (source.size !== size) throw new SourceHashError('source-size-changed');
      state.update(bytes); bytesRead += bytes.length; chunks++; progress();
      if (chunks % 32 === 0 || performance.now() - lastYield >= 8) {
        await new Promise<void>(resolve => setTimeout(resolve, 0)); aborted(signal); lastYield = performance.now();
      }
    }
    const hex = Array.from(state.digest(), value => value.toString(16).padStart(2, '0')).join('');
    return Object.freeze({ algorithm, offset, hex, bytesRead, totalBytes: length, chunks });
  } finally { state.destroy(); }
}
