// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original composition of browser inspection and verified sessions.
import { inspectInstallation, classifyBrowserAssetScope, BROWSER_IMPORT_LIMITS } from './browser-import.ts';
import { normalizeAssetPath } from './profile.ts';
import { hashMixName } from '../../formats/src/mix-names.ts';
import { createBrowserVerifiedSession, BROWSER_VERIFIED_LIMITS, type BrowserDiscoveredMember, type BrowserVerifiedProgress } from './browser-verified.ts';
import { throwIfImportAborted } from './browser-source.ts';
import type { BrowserImportOptions, BrowserImportReport } from './browser-types.ts';

export const BROWSER_CATALOG_POLICY = 'webra2-browser-catalog-1';
export const BROWSER_CATALOG_LIMITS = Object.freeze({ roots: 512, matches: 4096 });
export interface BrowserAssetCandidate {
  readonly id: string; readonly sourceId: string; readonly rootPath: string;
  readonly archiveId: string | null; readonly ordinal: number | null;
  readonly absoluteOffset: number; readonly size: number;
  readonly kind: 'literal' | 'hash-candidate'; readonly knownNames: readonly string[];
  readonly allowed: boolean; readonly ambiguousName: boolean;
}
export interface BrowserCatalogLookup {
  readonly path: string; readonly status: 'missing' | 'candidate' | 'ambiguous' | 'blocked';
  readonly candidates: readonly BrowserAssetCandidate[];
}
export interface BrowserCatalog {
  readonly policy: typeof BROWSER_CATALOG_POLICY;
  readonly report: BrowserImportReport;
  lookup(path: string): BrowserCatalogLookup;
  /** Compute byte identity of one explicitly selected candidate. No filename or publisher authenticity is implied. */
  discover(candidateId: string): Promise<BrowserDiscoveredMember>;
  /** An expected hash is mandatory; this never falls back to discovery. */
  read(candidateId: string, expectedSha256: string): Promise<BrowserDiscoveredMember>;
  dispose(): Promise<void>;
}
export interface BrowserCatalogOptions extends BrowserImportOptions {
  readonly onVerifiedProgress?: (progress: BrowserVerifiedProgress) => void;
}
export class BrowserCatalogError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'BrowserCatalogError'; }
}
function fail(code: string): never { throw new BrowserCatalogError(code); }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const nativeSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')!.get!;
const nativeName = Object.getOwnPropertyDescriptor(File.prototype, 'name')!.get!;

/** Inspect owned native File snapshots, then expose bounded candidate lookup and verified local reads. */
export async function inspectBrowserCatalog(input: readonly File[], options: BrowserCatalogOptions): Promise<BrowserCatalog> {
  if (!options || (options.profile !== 'ra2' && options.profile !== 'yr') || !['strict', 'tolerant'].includes(options.policy)) fail('catalog-options');
  const profile = options.profile, policy = options.policy, signal = options.signal, onProgress = options.onProgress, onVerifiedProgress = options.onVerifiedProgress;
  throwIfImportAborted(signal);
  if (!Array.isArray(input) || input.length > BROWSER_IMPORT_LIMITS.files) fail('catalog-file-limit');
  const selected: File[] = [];
  for (let i = 0; i < input.length; i++) {
    if (!Object.hasOwn(input, i) || !(input[i] instanceof File)) fail('catalog-file-type');
    const original = input[i]!, size = nativeSize.call(original) as number, name = nativeName.call(original) as string;
    // Preserve the explicit folder path supplied by the browser bridge, but never
    // retain caller-overridden read methods or a mutable selection array.
    const relativePath = original.webkitRelativePath === undefined ? '' : original.webkitRelativePath;
    if (typeof relativePath !== 'string' || relativePath.length > 4096 || name.length > 4096) fail('catalog-file-path');
    const file = new File([Blob.prototype.slice.call(original, 0, size)], name);
    Object.defineProperty(file, 'webkitRelativePath', { value: relativePath }); selected.push(file);
  }
  const report = await inspectInstallation(selected, { profile, policy, ...(signal ? { signal } : {}), ...(onProgress ? { onProgress } : {}) });
  throwIfImportAborted(signal);
  const usable = report.files.filter(file => file.status === 'accepted' && file.profileStatus === 'eligible');
  if (usable.length > BROWSER_CATALOG_LIMITS.roots) fail('catalog-root-limit');
  const roots = usable.map(file => ({ sourceId: file.id, blob: selected[Number(file.id.slice(5))]! }));
  const candidates = new Map<string, BrowserAssetCandidate>(), byName = new Map<string, BrowserAssetCandidate[]>(), byHash = new Map<number, BrowserAssetCandidate[]>();
  const files = new Map(report.files.map(file => [file.id, file]));
  const add = <K>(key: K, value: BrowserAssetCandidate, target: Map<K, BrowserAssetCandidate[]>) => {
    const rows = target.get(key) ?? []; rows.push(value); target.set(key, rows);
  };
  for (const file of report.files) {
    if (file.profileStatus !== 'eligible' || file.kind !== 'loose') continue;
    const candidate = Object.freeze({ id: file.id, sourceId: file.id, rootPath: file.path, archiveId: null, ordinal: null,
      absoluteOffset: 0, size: file.size, kind: 'literal' as const, knownNames: Object.freeze([file.path]), allowed: file.status === 'accepted', ambiguousName: file.status === 'duplicate' });
    candidates.set(candidate.id, candidate); add(file.path, candidate, byName);
  }
  for (const archive of report.archives) {
    if (archive.profileStatus !== 'eligible') continue;
    const file = files.get(archive.sourceId)!;
    for (const member of archive.members) {
      if (member.names.length && member.names.every(name => classifyBrowserAssetScope(name, profile, false) === 'excluded')) continue;
      const candidate = Object.freeze({ id: `${archive.id}/member:${member.ordinal}`, sourceId: archive.sourceId, rootPath: file.path,
        archiveId: archive.id, ordinal: member.ordinal, absoluteOffset: archive.absoluteOffset + archive.dataOffset + member.offset, size: member.size,
        kind: 'hash-candidate' as const, knownNames: Object.freeze([...member.names]), allowed: archive.allowed, ambiguousName: member.names.length > 1 });
      candidates.set(candidate.id, candidate); add(Number.parseInt(member.idHex, 16), candidate, byHash);
    }
  }
  selected.length = 0;
  const session = createBrowserVerifiedSession(roots, { limits: { maxRoots: BROWSER_CATALOG_LIMITS.roots, chunkBytes: 1024 * 1024 }, ...(signal ? { signal } : {}), ...(onVerifiedProgress ? { onProgress: onVerifiedProgress } : {}) });
  roots.length = 0;
  let closed = false, busy = false;
  const clear = () => { candidates.clear(); byName.clear(); byHash.clear(); files.clear(); };
  const guard = () => { if (closed) fail('catalog-disposed'); throwIfImportAborted(signal); };
  const aborted = () => { closed = true; clear(); void session.dispose(); };
  signal?.addEventListener('abort', aborted, { once: true }); if (signal?.aborted) aborted();
  async function retrieve(id: string, expected?: string): Promise<BrowserDiscoveredMember> {
    guard(); if (busy) fail('catalog-busy'); busy = true;
    try {
      if (typeof id !== 'string') fail('catalog-candidate-id');
      const candidate = candidates.get(id); if (!candidate) fail('catalog-candidate-id');
      if (!candidate.allowed) fail('catalog-candidate-blocked');
      if (candidate.size > BROWSER_VERIFIED_LIMITS.maxMemberBytes) fail('catalog-member-limit');
      const root = await session.identify(candidate.sourceId); guard();
      const range = { root, absoluteOffset: candidate.absoluteOffset, size: candidate.size };
      const result = expected === undefined ? await session.discover(range) : Object.freeze({ bytes: await session.read({ ...range, sha256: expected }), identity: Object.freeze({ ...range, sha256: expected }) });
      guard(); return result;
    } finally { busy = false; }
  }
  return Object.freeze({ policy: BROWSER_CATALOG_POLICY, report,
    lookup(path: string): BrowserCatalogLookup {
      guard(); const normalized = normalizeAssetPath(path), result = new Map<string, BrowserAssetCandidate>();
      if (classifyBrowserAssetScope(normalized, profile, false) === 'excluded') return Object.freeze({ path: normalized, status: 'missing', candidates: Object.freeze([]) });
      const take = (rows: readonly BrowserAssetCandidate[]) => { for (const row of rows) { if (!result.has(row.id) && result.size >= BROWSER_CATALOG_LIMITS.matches) fail('catalog-match-limit'); result.set(row.id, row); } };
      take(byName.get(normalized) ?? []);
      if (/^[\x20-\x7e]{1,255}$/.test(normalized)) for (const kind of ['classic', 'crc32'] as const) take(byHash.get(hashMixName(normalized, kind)) ?? []);
      const rows = [...result.values()].sort((a, b) => compare(a.rootPath, b.rootPath) || a.absoluteOffset - b.absoluteOffset || compare(a.id, b.id));
      const status = !rows.length ? 'missing' : rows.length > 1 || rows.some(row => row.ambiguousName || (row.kind === 'hash-candidate' && row.knownNames.length > 0 && !row.knownNames.includes(normalized))) ? 'ambiguous' : !rows[0]!.allowed ? 'blocked' : 'candidate';
      return Object.freeze({ path: normalized, status, candidates: Object.freeze(rows) });
    },
    discover(id: string) { return retrieve(id); },
    read(id: string, expected: string) {
      if (typeof expected !== 'string' || !/^[a-f\d]{64}$/i.test(expected)) return Promise.reject(new BrowserCatalogError('catalog-expected-hash'));
      return retrieve(id, expected.toLowerCase());
    },
    async dispose() { closed = true; clear(); signal?.removeEventListener('abort', aborted); await session.dispose(); },
  });
}
