// SPDX-License-Identifier: MIT
import type { ProfileId } from '../../contracts/src/index.ts';

/** The caller supplies verified byte identities. This module never reads or hashes assets. */
export interface AssetSource {
  readonly id: string;
  readonly rootPath: string;
  readonly rootSha256: string;
  readonly rootSize: number;
  readonly archiveSha256: string | null;
  readonly ordinal: number | null;
  readonly memberId: string | null;
  readonly absoluteOffset: number;
  readonly size: number;
  readonly sha256: string;
}

export interface NameEvidence {
  readonly path: string;
  readonly kind: 'literal' | 'hash-candidate';
  readonly evidence: string;
}

export interface ProfileAsset {
  readonly profiles: readonly ProfileId[];
  /** Multiple different normalized names mean an unresolved identity, not aliases. */
  readonly names: readonly NameEvidence[];
  readonly source: AssetSource;
}

export interface ContentLayer {
  readonly id: string;
  readonly profiles: readonly ProfileId[];
  /** Greater ranks override smaller ranks. Equal ranks never use input order to win. */
  readonly rank: number;
  readonly kind: 'archive' | 'loose' | 'mod';
  /** Explain who chose this rank; archive names do not imply a native load order. */
  readonly rankEvidence: string;
  readonly assets: readonly ProfileAsset[];
}

export interface Candidate {
  readonly layerId: string;
  readonly rank: number;
  readonly kind: ContentLayer['kind'];
  readonly rankEvidence: string;
  readonly profiles: readonly ProfileId[];
  readonly names: readonly NameEvidence[];
  readonly source: AssetSource;
  readonly ambiguousName: boolean;
}

export interface Resolution {
  readonly path: string;
  readonly status: 'resolved' | 'candidate' | 'ambiguous' | 'missing';
  readonly content: { readonly sha256: string; readonly size: number } | null;
  /** All equivalent highest-rank sources; empty if missing or ambiguous. */
  readonly selected: readonly Candidate[];
  /** Includes shadowed sources and all contenders when selection is ambiguous. */
  readonly alternatives: readonly Candidate[];
  readonly diagnostics: readonly ('name-collision' | 'content-conflict' | 'shadowed-name-collision')[];
}

export interface ResolverLimits {
  readonly layers: number;
  readonly assets: number;
  readonly names: number;
  readonly namesPerAsset: number;
  readonly required: number;
}

export const PROFILE_LIMITS: ResolverLimits = Object.freeze({
  layers: 512, assets: 250_000, names: 500_000, namesPerAsset: 16, required: 4096,
});

function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function text(value: string, limit: number, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > limit || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`Invalid ${field}`);
  }
}
function natural(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`Invalid ${field}`);
}
function hash(value: string): void {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new TypeError('Expected lowercase SHA-256');
}
function profiles(values: readonly ProfileId[]): readonly ProfileId[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 2 ||
      values.some(value => value !== 'ra2' && value !== 'yr') || new Set(values).size !== values.length) {
    throw new TypeError('Explicit unique RA2/YR profiles required');
  }
  return Object.freeze([...values].sort(compare));
}

/** Logical paths only: never URL-decode or join these to a host filesystem. */
export function normalizeAssetPath(path: string): string {
  text(path, 512, 'asset path');
  // Reject unpaired UTF-16 and alternate URL/drive syntax before normalization.
  if (/[\ud800-\udfff:%?#*<>"|]/u.test(path)) throw new TypeError('Unsafe asset path');
  const normalized = path.normalize('NFC').replaceAll('\\', '/').replace(/[A-Z]/g, value => value.toLowerCase());
  const parts = normalized.split('/');
  if (parts.length > 32 || parts.some(part => !part || part === '.' || part === '..' ||
      /^[ .]|[ .]$/u.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/u.test(part))) {
    throw new TypeError('Unsafe asset path');
  }
  return normalized;
}

function copySource(source: AssetSource): AssetSource {
  text(source.id, 1024, 'source ID');
  normalizeAssetPath(source.rootPath);
  hash(source.rootSha256);
  hash(source.sha256);
  for (const field of ['rootSize', 'absoluteOffset', 'size'] as const) natural(source[field], field);
  if (source.absoluteOffset > source.rootSize || source.size > source.rootSize - source.absoluteOffset) {
    throw new RangeError('Source exceeds root byte range');
  }
  if (source.archiveSha256 === null) {
    if (source.ordinal !== null || source.memberId !== null || source.absoluteOffset !== 0 ||
        source.size !== source.rootSize || source.sha256 !== source.rootSha256) {
      throw new TypeError('Inconsistent loose source identity');
    }
  } else {
    hash(source.archiveSha256);
    if (source.ordinal === null) throw new TypeError('Missing member ordinal');
    natural(source.ordinal, 'member ordinal');
    if (typeof source.memberId !== 'string' || !/^[a-f0-9]{8}$/.test(source.memberId)) {
      throw new TypeError('Invalid member ID');
    }
  }
  return Object.freeze({ id: source.id, rootPath: source.rootPath, rootSha256: source.rootSha256, rootSize: source.rootSize,
    archiveSha256: source.archiveSha256, ordinal: source.ordinal, memberId: source.memberId,
    absoluteOffset: source.absoluteOffset, size: source.size, sha256: source.sha256 });
}

function resolveCandidates(path: string, candidates: readonly Candidate[]): Resolution {
  const rank = candidates[0]?.rank;
  const top = candidates.filter(candidate => candidate.rank === rank);
  const rest = candidates.filter(candidate => candidate.rank !== rank);
  const diagnostics: Resolution['diagnostics'][number][] = [];
  if (top.some(candidate => candidate.ambiguousName)) diagnostics.push('name-collision');
  if (new Set(top.map(candidate => `${candidate.source.sha256}:${candidate.source.size}`)).size > 1) {
    diagnostics.push('content-conflict');
  }
  if (rest.some(candidate => candidate.ambiguousName)) diagnostics.push('shadowed-name-collision');
  const blocked = diagnostics.includes('name-collision') || diagnostics.includes('content-conflict');
  const first = top[0];
  const status = !first ? 'missing' : blocked ? 'ambiguous' :
    top.some(candidate => candidate.names.some(name => name.path === path && name.kind === 'literal')) ? 'resolved' : 'candidate';
  return Object.freeze({ path, status,
    content: !first || blocked ? null : Object.freeze({ sha256: first.source.sha256, size: first.source.size }),
    selected: Object.freeze(blocked ? [] : top), alternatives: Object.freeze(blocked ? [...candidates] : rest),
    diagnostics: Object.freeze(diagnostics),
  });
}

export interface ProfileResolver {
  readonly profile: ProfileId;
  readonly excludedSourceIds: readonly string[];
  /** Sorted by code-unit path order, independent of host locale and input order. */
  readonly entries: readonly Resolution[];
  resolve(path: string): Resolution;
  /** Candidate identities are not counted as verified required assets. */
  require(paths: readonly string[]): {
    readonly complete: boolean;
    readonly entries: readonly Resolution[];
  };
}

/** Pure metadata resolution; ranks are WebRA2 policy, not a reconstruction of native mount order. */
export function createProfileResolver(profile: ProfileId, layers: readonly ContentLayer[], options: Partial<ResolverLimits> = {}): ProfileResolver {
  profiles([profile]);
  const limits = { ...PROFILE_LIMITS, ...options };
  for (const key of Object.keys(limits) as (keyof ResolverLimits)[]) {
    natural(limits[key], key);
    if (limits[key] > PROFILE_LIMITS[key]) throw new RangeError(`Cannot increase ${key} hard limit`);
  }
  if (layers.length > limits.layers) throw new RangeError('Too many layers');
  const layerIds = new Set<string>();
  const sourceIds = new Set<string>();
  const physicalSources = new Set<string>();
  const contentSizes = new Map<string, number>();
  const physicalHashes = new Map<string, string>();
  const rootIdentities = new Map<string, string>();
  const byPath = new Map<string, Candidate[]>();
  const excluded: string[] = [];
  let assetCount = 0;
  let nameCount = 0;
  for (const layer of layers) {
    text(layer.id, 256, 'layer ID');
    text(layer.rankEvidence, 2048, 'rank evidence');
    if (layerIds.has(layer.id)) throw new TypeError('Duplicate layer ID');
    layerIds.add(layer.id);
    const layerProfiles = profiles(layer.profiles);
    if (!Number.isSafeInteger(layer.rank)) throw new TypeError('Invalid layer rank');
    if (!['archive', 'loose', 'mod'].includes(layer.kind)) throw new TypeError('Invalid layer kind');
    if ((assetCount += layer.assets.length) > limits.assets) throw new RangeError('Too many assets');
    for (const asset of layer.assets) {
      const assetProfiles = profiles(asset.profiles);
      if (assetProfiles.some(value => !layerProfiles.includes(value))) throw new TypeError('Asset profile exceeds layer scope');
      if (!asset.names.length || asset.names.length > limits.namesPerAsset || (nameCount += asset.names.length) > limits.names) {
        throw new RangeError('Name evidence limit exceeded');
      }
      const source = copySource(asset.source);
      if ((layer.kind === 'loose' && source.archiveSha256 !== null) ||
          (layer.kind === 'archive' && source.archiveSha256 === null)) throw new TypeError('Layer/source kind mismatch');
      if (sourceIds.has(source.id)) throw new TypeError('Duplicate source ID');
      sourceIds.add(source.id);
      const physicalKey = JSON.stringify([source.rootSha256, source.absoluteOffset, source.size]);
      if (physicalHashes.has(physicalKey) && physicalHashes.get(physicalKey) !== source.sha256) {
        throw new TypeError('Conflicting content hash for one physical range');
      }
      physicalHashes.set(physicalKey, source.sha256);
      const locator = JSON.stringify([normalizeAssetPath(source.rootPath), source.rootSha256, source.absoluteOffset, source.size]);
      if (physicalSources.has(locator)) throw new TypeError('Duplicate physical source range; combine its name evidence in one asset');
      physicalSources.add(locator);
      for (const [sha, size] of [[source.sha256, source.size], [source.rootSha256, source.rootSize]] as const) {
        const previous = contentSizes.get(sha);
        if (previous !== undefined && previous !== size) throw new TypeError('Same SHA-256 has conflicting sizes');
        contentSizes.set(sha, size);
      }
      // Root names can repeat across layers (for example, replacement mods), but not within one layer.
      const rootKey = JSON.stringify([layer.id, normalizeAssetPath(source.rootPath)]);
      if (rootIdentities.has(rootKey) && rootIdentities.get(rootKey) !== source.rootSha256) {
        throw new TypeError('Conflicting root identity within layer');
      }
      rootIdentities.set(rootKey, source.rootSha256);
      const names = asset.names.map(name => {
        const path = normalizeAssetPath(name.path);
        if (name.kind !== 'literal' && name.kind !== 'hash-candidate') throw new TypeError('Invalid name evidence kind');
        text(name.evidence, 2048, 'name evidence');
        return Object.freeze({ path, kind: name.kind, evidence: name.evidence });
      }).sort((a, b) => compare(a.path, b.path) || compare(a.kind, b.kind) || compare(a.evidence, b.evidence));
      const distinctPaths = new Set(names.map(name => name.path));
      if (!assetProfiles.includes(profile)) { excluded.push(source.id); continue; }
      const candidate: Candidate = Object.freeze({ layerId: layer.id, rank: layer.rank, kind: layer.kind,
        rankEvidence: layer.rankEvidence, profiles: assetProfiles, names: Object.freeze(names), source,
        ambiguousName: distinctPaths.size > 1 });
      for (const path of distinctPaths) {
        const values = byPath.get(path) ?? [];
        values.push(candidate);
        byPath.set(path, values);
      }
    }
  }
  const resolved = new Map<string, Resolution>();
  for (const path of [...byPath.keys()].sort(compare)) {
    const candidates = byPath.get(path)!;
    candidates.sort((a, b) => (a.rank === b.rank ? 0 : a.rank > b.rank ? -1 : 1) ||
      compare(a.layerId, b.layerId) || compare(a.source.id, b.source.id));
    resolved.set(path, resolveCandidates(path, candidates));
  }
  function resolve(path: string): Resolution {
    const normalized = normalizeAssetPath(path);
    return resolved.get(normalized) ?? resolveCandidates(normalized, []);
  }
  return Object.freeze({ profile, excludedSourceIds: Object.freeze(excluded.sort(compare)),
    entries: Object.freeze([...resolved.values()]), resolve,
    require(paths: readonly string[]) {
      if (paths.length > limits.required) throw new RangeError('Too many required paths');
      const entries = [...new Set(paths.map(normalizeAssetPath))].sort(compare).map(resolve);
      return Object.freeze({ complete: entries.length > 0 && entries.every(entry => entry.status === 'resolved'), entries: Object.freeze(entries) });
    },
  });
}
