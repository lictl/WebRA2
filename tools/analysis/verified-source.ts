// SPDX-License-Identifier: MIT
// Copyright 2026 WebRA2 contributors.
import { createHash } from 'node:crypto';
import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, realpath, stat, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';

/** Existing census identity. Archive payloads and translated strings are not metadata. */
export interface VerifiedSourceIdentity {
  rootFile: string;
  rootSha256: string;
  absoluteOffset: number;
  size: number;
  sha256: string;
}
export interface VerifiedSourceOptions {
  maxMemberBytes?: number;
  maxRootBytes?: number;
  maxRoots?: number;
  chunkBytes?: number;
}
export interface VerifiedSourceReader {
  /** Sequential reads only. The returned buffer belongs to the caller. */
  read(identity: VerifiedSourceIdentity): Promise<Uint8Array>;
  /** Prevents new reads and waits for any active read to release its file handle. */
  close(): Promise<void>;
}
export class VerifiedSourceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'VerifiedSourceError';
  }
}

const MIB = 1024 * 1024;
function fail(code: string, message: string): never { throw new VerifiedSourceError(code, message); }
function limit(value: number | undefined, fallback: number, maximum: number, minimum = 0): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) fail('invalid-limit', 'Source reader limit is outside the supported range');
  return result;
}
function identityCopy(input: VerifiedSourceIdentity): VerifiedSourceIdentity {
  if (!input || typeof input !== 'object') fail('invalid-identity', 'Source identity must be an object');
  const { rootFile, rootSha256, absoluteOffset, size, sha256 } = input;
  if (typeof rootFile !== 'string' || !rootFile || rootFile.length > 255 || rootFile === '.' || rootFile === '..' || /[\\/:\x00-\x1f\x7f]/.test(rootFile)) {
    fail('unsafe-root-name', 'Source root must be a single safe filename');
  }
  if (typeof rootSha256 !== 'string' || typeof sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(rootSha256) || !/^[a-f\d]{64}$/i.test(sha256)) {
    fail('invalid-hash', 'Source identity requires complete SHA-256 hashes');
  }
  if (!Number.isSafeInteger(absoluteOffset) || absoluteOffset < 0 || !Number.isSafeInteger(size) || size < 0) {
    fail('invalid-range', 'Source range must use nonnegative safe integers');
  }
  return { rootFile, rootSha256: rootSha256.toLowerCase(), absoluteOffset, size, sha256: sha256.toLowerCase() };
}
function unchanged(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}
async function fill(file: FileHandle, buffer: Uint8Array, offset: number, length: number): Promise<void> {
  let done = 0;
  while (done < length) {
    const { bytesRead } = await file.read(buffer, done, length - done, offset + done);
    if (!bytesRead) fail('truncated-source', 'Source ended before its declared range');
    done += bytesRead;
  }
}

/** Node analysis adapter. Verifies bytes against a pinned census, not publisher authenticity. */
export async function createVerifiedSourceReader(directory: string, options: VerifiedSourceOptions = {}): Promise<VerifiedSourceReader> {
  const maxMemberBytes = limit(options.maxMemberBytes, 16 * MIB, 64 * MIB);
  const maxRootBytes = limit(options.maxRootBytes, 4_296_000_000, 4_296_000_000);
  const maxRoots = limit(options.maxRoots, 128, 512, 1);
  const chunkBytes = limit(options.chunkBytes, MIB, 8 * MIB, 1);
  let root: string;
  try {
    root = await realpath(directory);
    if (!(await stat(root)).isDirectory()) fail('invalid-directory', 'Source root must be a directory');
  } catch {
    fail('invalid-directory', 'Source directory is unavailable');
  }
  const verifiedRoots = new Map<string, { snapshot: BigIntStats; sha256: string }>();
  let closed = false;
  let active: Promise<Uint8Array> | undefined;

  async function readSource(input: VerifiedSourceIdentity): Promise<Uint8Array> {
    const identity = identityCopy(input);
    if (identity.size > maxMemberBytes) fail('member-limit', 'Source member exceeds the configured byte limit');
    if (!verifiedRoots.has(identity.rootFile) && verifiedRoots.size >= maxRoots) fail('root-count-limit', 'Source reader has reached its verified-root limit');
    const path = join(root, identity.rootFile);
    try {
      const named = await lstat(path, { bigint: true });
      if (!named.isFile()) fail('unsafe-source-file', 'Source root must be a regular file, not a link or directory');
      const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const before = await file.stat({ bigint: true });
        if (!before.isFile() || !unchanged(named, before)) fail('source-changed', 'Source file changed while opening');
        if (before.size > BigInt(maxRootBytes)) fail('root-byte-limit', 'Source root exceeds the configured byte limit');
        const rootSize = Number(before.size);
        if (identity.absoluteOffset > rootSize || identity.size > rootSize - identity.absoluteOffset) fail('range-outside-root', 'Source range exceeds the root file');
        const cached = verifiedRoots.get(identity.rootFile);
        if (cached) {
          if (!unchanged(cached.snapshot, before)) fail('source-changed', 'Source revision changed; create a new reader for a new census');
          if (cached.sha256 !== identity.rootSha256) fail('root-hash-mismatch', 'Source root hash differs from the pinned identity');
        } else {
          const hash = createHash('sha256');
          const chunk = new Uint8Array(Math.min(chunkBytes, rootSize));
          for (let at = 0; at < rootSize; at += chunk.length) {
            const length = Math.min(chunk.length, rootSize - at);
            await fill(file, chunk, at, length);
            hash.update(chunk.subarray(0, length));
          }
          if (!unchanged(before, await file.stat({ bigint: true }))) fail('source-changed', 'Source changed while hashing');
          if (hash.digest('hex') !== identity.rootSha256) fail('root-hash-mismatch', 'Source root hash differs from the pinned identity');
          verifiedRoots.set(identity.rootFile, { snapshot: before, sha256: identity.rootSha256 });
        }
        const bytes = new Uint8Array(identity.size);
        for (let done = 0; done < bytes.length; done += chunkBytes) {
          const length = Math.min(chunkBytes, bytes.length - done);
          await fill(file, bytes.subarray(done, done + length), identity.absoluteOffset + done, length);
        }
        if (!unchanged(before, await file.stat({ bigint: true }))) fail('source-changed', 'Source changed while reading a member');
        if (createHash('sha256').update(bytes).digest('hex') !== identity.sha256) fail('member-hash-mismatch', 'Source member hash differs from the pinned identity');
        return bytes;
      } finally {
        await file.close();
      }
    } catch (error) {
      if (error instanceof VerifiedSourceError) throw error;
      fail('source-io', 'Source file could not be read');
    }
  }

  return {
    read(identity) {
      if (closed) return Promise.reject(new VerifiedSourceError('reader-closed', 'Source reader is closed'));
      if (active) return Promise.reject(new VerifiedSourceError('reader-busy', 'Source reads must be sequential'));
      const pending = readSource(identity);
      active = pending;
      void pending.then(() => { active = undefined; }, () => { active = undefined; });
      return pending;
    },
    async close() {
      closed = true;
      await active?.catch(() => undefined);
      verifiedRoots.clear();
    },
  };
}
