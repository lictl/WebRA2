// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Composes existing browser/hash sources; see docs/browser-verified.md.
import { assertRange, type ByteSource } from '../../formats/src/mix.ts';
import { createBrowserByteSource, throwIfImportAborted } from './browser-source.ts';
import { hashByteSource, SOURCE_HASH_LIMITS, type SourceHashProgress } from './hash-source.ts';

export interface BrowserSelectedRoot { readonly sourceId: string; readonly blob: Blob }
export interface BrowserRootIdentity { readonly sourceId: string; readonly size: number; readonly sha256: string }
export interface BrowserMemberRange { readonly root: BrowserRootIdentity; readonly absoluteOffset: number; readonly size: number }
export interface BrowserMemberIdentity extends BrowserMemberRange { readonly sha256: string }
export interface BrowserDiscoveredMember { readonly bytes: Uint8Array; readonly identity: BrowserMemberIdentity }
export interface BrowserVerifiedProgress extends SourceHashProgress {
  readonly phase: 'root' | 'member'; readonly sourceId: string; readonly sessionBytesRead: number; readonly memberAttempts: number;
}
export interface BrowserVerifiedLimits {
  readonly maxRoots: number; readonly maxRootBytes: number; readonly maxMemberBytes: number;
  readonly maxMemberAttempts: number; readonly maxReadBytes: number; readonly chunkBytes: number;
}
export const BROWSER_VERIFIED_LIMITS: Readonly<BrowserVerifiedLimits> = Object.freeze({ maxRoots: 128,
  maxRootBytes: SOURCE_HASH_LIMITS.maxBytes, maxMemberBytes: 16 * 1024 * 1024,
  maxMemberAttempts: 4096, maxReadBytes: 8 * 1024 ** 3, chunkBytes: 64 * 1024 });
export interface BrowserVerifiedOptions {
  readonly signal?: AbortSignal; readonly onProgress?: (progress: BrowserVerifiedProgress) => void;
  readonly limits?: Partial<BrowserVerifiedLimits>;
}
export interface BrowserVerifiedSession {
  /** Computes a complete root identity; no publisher authenticity is implied. */
  identify(sourceId: string): Promise<BrowserRootIdentity>;
  read(identity: BrowserMemberIdentity): Promise<Uint8Array>;
  /** A supplied member hash is never discarded; use read for an expected identity. */
  discover(range: BrowserMemberRange): Promise<BrowserDiscoveredMember>;
  /** Terminal cancellation. Native pending ranges keep their adapter slots until settled. */
  dispose(): Promise<void>;
}
export class BrowserVerifiedError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'BrowserVerifiedError'; }
}
function fail(code: string): never { throw new BrowserVerifiedError(code); }
function sourceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value)) fail('invalid-source-id');
  return value;
}
function sha256(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) fail('invalid-sha256');
  return value.toLowerCase();
}
function size(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) fail('invalid-size'); return value as number; }
function rootCopy(input: BrowserRootIdentity): BrowserRootIdentity {
  if (!input || typeof input !== 'object') fail('invalid-root-identity');
  return Object.freeze({ sourceId: sourceId(input.sourceId), size: size(input.size), sha256: sha256(input.sha256) });
}
function rangeCopy(input: BrowserMemberRange): BrowserMemberRange {
  if (!input || typeof input !== 'object') fail('invalid-member-range');
  return Object.freeze({ root: rootCopy(input.root), absoluteOffset: size(input.absoluteOffset), size: size(input.size) });
}
const blobSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')!.get!;

/** Immutable native Blob snapshots, sequential verified operations, no filesystem/network. */
export function createBrowserVerifiedSession(input: readonly BrowserSelectedRoot[], options: BrowserVerifiedOptions = {}): BrowserVerifiedSession {
  const limits = { ...BROWSER_VERIFIED_LIMITS, ...options.limits };
  const maxima: BrowserVerifiedLimits = { ...BROWSER_VERIFIED_LIMITS, maxRoots: 512, maxMemberAttempts: 16_384, maxReadBytes: 16 * 1024 ** 3, chunkBytes: 1024 * 1024 };
  for (const name of Object.keys(maxima) as (keyof BrowserVerifiedLimits)[]) {
    if (!Number.isSafeInteger(limits[name]) || limits[name] < (name === 'chunkBytes' ? 1 : 0) || limits[name] > maxima[name]) fail('invalid-session-limit');
  }
  // Validate the complete selection before creating any snapshot.
  if (!Array.isArray(input) || input.length > limits.maxRoots) fail('root-count-limit');
  const selected: { sourceId: string; blob: Blob; size: number }[] = [], ids = new Set<string>();
  for (let i = 0; i < input.length; i++) {
    if (!Object.hasOwn(input, i) || !input[i] || typeof input[i] !== 'object') fail('invalid-selected-root');
    const id = sourceId(input[i]!.sourceId), blob = input[i]!.blob;
    if (ids.has(id)) fail('duplicate-source-id');
    if (!(blob instanceof Blob)) fail('invalid-selected-blob');
    let length: number; try { length = size(blobSize.call(blob)); } catch { fail('invalid-selected-blob'); }
    if (length > limits.maxRootBytes) fail('root-byte-limit');
    ids.add(id); selected.push({ sourceId: id, blob, size: length });
  }
  const signal = options.signal, onProgress = options.onProgress, controller = new AbortController();
  throwIfImportAborted(signal);
  let closed = false, busy = false, active: Promise<unknown> | undefined, bytesRead = 0, reservedBytes = 0, memberAttempts = 0;
  const roots = new Map<string, { source: ByteSource; identity?: BrowserRootIdentity }>();
  function guard(): void { throwIfImportAborted(controller.signal); if (closed) fail('session-disposed'); }
  for (const entry of selected) {
    // Calling the native method ignores caller-overridden slice/size methods and
    // detaches this session from replacement selections without copying the root.
    const snapshot = Blob.prototype.slice.call(entry.blob, 0, entry.size) as Blob;
    roots.set(entry.sourceId, { source: createBrowserByteSource(snapshot, { signal: controller.signal,
      beforeRead(length) { guard(); if (length > limits.maxReadBytes - reservedBytes) fail('session-read-budget'); reservedBytes += length; },
      onRead(length) { bytesRead += length; },
    }) });
  }
  selected.length = 0;
  const aborted = () => { controller.abort(); roots.clear(); };
  signal?.addEventListener('abort', aborted, { once: true });
  if (signal?.aborted) aborted();
  function rootEntry(id: string) { const entry = roots.get(id); if (!entry) fail('unknown-source-id'); return entry; }
  function progress(phase: BrowserVerifiedProgress['phase'], id: string) {
    return (value: SourceHashProgress) => {
      guard(); onProgress?.(Object.freeze({ ...value, phase, sourceId: id, sessionBytesRead: bytesRead, memberAttempts })); guard();
    };
  }
  async function identify(id: string): Promise<BrowserRootIdentity> {
    const entry = rootEntry(id);
    if (entry.identity) return entry.identity;
    const hash = await hashByteSource(entry.source, { byteLimit: limits.maxRootBytes, chunkBytes: limits.chunkBytes,
      signal: controller.signal, onProgress: progress('root', id) });
    guard();
    entry.identity = Object.freeze({ sourceId: id, size: entry.source.size, sha256: hash.hex });
    return entry.identity;
  }
  async function member(range: BrowserMemberRange, expected?: string): Promise<BrowserDiscoveredMember> {
    guard();
    const entry = rootEntry(range.root.sourceId);
    if (range.root.size !== entry.source.size) fail('root-size-mismatch');
    assertRange(entry.source.size, range.absoluteOffset, range.size);
    if (range.size > limits.maxMemberBytes) fail('member-byte-limit');
    if (memberAttempts >= limits.maxMemberAttempts) fail('member-attempt-limit');
    memberAttempts++;
    const root = await identify(range.root.sourceId);
    if (root.sha256 !== range.root.sha256) fail('root-hash-mismatch');
    guard();
    // Reject before allocating an output whose full range cannot be consumed.
    if (range.size > limits.maxReadBytes - reservedBytes) fail('session-read-budget');
    const bytes = new Uint8Array(range.size);
    const source: ByteSource = { size: range.size, async read(offset, length) {
      assertRange(range.size, offset, length);
      const chunk = await entry.source.read(range.absoluteOffset + offset, length);
      guard(); bytes.set(chunk, offset); return chunk;
    } };
    const result = await hashByteSource(source, { byteLimit: limits.maxMemberBytes, chunkBytes: limits.chunkBytes,
      signal: controller.signal, onProgress: progress('member', root.sourceId) });
    guard();
    if (expected !== undefined && result.hex !== expected) fail('member-hash-mismatch');
    return Object.freeze({ bytes, identity: Object.freeze({ root, absoluteOffset: range.absoluteOffset, size: range.size, sha256: result.hex }) });
  }
  function run<T>(operation: () => Promise<T>): Promise<T> {
    if (closed) return Promise.reject(new BrowserVerifiedError('session-disposed'));
    if (busy) return Promise.reject(new BrowserVerifiedError('session-busy'));
    // Reserve before any input getters or progress callbacks can re-enter. Set
    // the completion promise first so dispose called by a callback can await it.
    busy = true;
    let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
    const pending = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); active = pending;
    void (async () => { guard(); const value = await operation(); guard(); return value; })().then(
      value => { busy = false; active = undefined; resolve(value); },
      error => { busy = false; active = undefined; reject(error); },
    );
    return pending;
  }
  return Object.freeze({
    identify(id: string) { return run(() => identify(sourceId(id))); },
    read(input: BrowserMemberIdentity) {
      return run(async () => { const expected = sha256(input?.sha256), range = rangeCopy(input); return (await member(range, expected)).bytes; });
    },
    discover(input: BrowserMemberRange) {
      return run(async () => {
        const range = rangeCopy(input);
        if ('sha256' in input) fail('discovery-has-member-hash');
        return member(range);
      });
    },
    async dispose() {
      closed = true; controller.abort(); signal?.removeEventListener('abort', aborted); roots.clear();
      await active?.catch(() => undefined);
    },
  });
}
