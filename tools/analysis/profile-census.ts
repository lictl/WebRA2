// SPDX-License-Identifier: MIT
// Metadata-only adapter. No game assets, payload strings, or host file paths are emitted.
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProfileId } from '../../packages/contracts/src/index.ts';
import { createProfileResolver, normalizeAssetPath, type AssetSource, type ContentLayer, type ProfileAsset } from '../../packages/vfs/src/profile.ts';

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('Expected metadata object');
  return value as RecordValue;
}
function list(value: unknown, cap: number): unknown[] {
  if (!Array.isArray(value) || value.length > cap) throw new TypeError('Metadata array missing or over limit');
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new TypeError('Invalid metadata text');
  return value;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid metadata integer');
  return value;
}
function nullableString(value: unknown): string | null { return value === null ? null : string(value); }
function candidateProfiles(value: unknown): ProfileId[] {
  return list(value, 2).map(item => {
    if (item !== 'ra2' && item !== 'yr') throw new TypeError('Invalid profile metadata');
    return item;
  });
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
const RANK_EVIDENCE = 'Unresolved original mount order: all observed physical roots deliberately share rank 0.';

/** Join reviewed snapshots by exact physical identity; this does not re-read retail bytes. */
export function profileCensus(campaignInput: unknown, physicalInput: unknown) {
  const campaign = object(campaignInput);
  const physical = object(physicalInput);
  if (campaign.schemaVersion !== 1 || physical.schemaVersion !== 1) throw new TypeError('Unsupported census schema');
  const archives = new Map<string, RecordValue>();
  const roots = new Map<string, RecordValue>();
  const membersByArchive = new Map<string, Map<number, RecordValue>>();
  let memberCount = 0;
  for (const item of list(physical.archives, 512)) {
    const archive = object(item);
    const path = string(archive.path);
    if (archives.has(path)) throw new TypeError('Duplicate archive metadata identity');
    archives.set(path, archive);
    const members = list(archive.members, 65_535);
    memberCount += members.length;
    if (memberCount > 250_000) throw new RangeError('Physical census member limit');
    const byOrdinal = new Map<number, RecordValue>();
    for (const value of members) {
      const member = object(value);
      const ordinal = number(member.ordinal);
      if (byOrdinal.has(ordinal)) throw new TypeError('Duplicate physical member ordinal');
      byOrdinal.set(ordinal, member);
    }
    membersByArchive.set(path, byOrdinal);
    if (path === archive.rootFile && archive.absoluteOffset === 0) roots.set(path, archive);
  }
  const assetsByRoot = new Map<string, ProfileAsset[]>();
  const unassigned: { sourceId: string; sha256: string; candidateNames: string[]; reason: string }[] = [];
  const sources = new Set<string>();
  let acceptedSources = 0;
  function add(sourceInput: unknown, namesInput: unknown, profilesInput: unknown, evidence: string): void {
    const raw = object(sourceInput);
    const id = string(raw.path);
    if (sources.has(id)) throw new TypeError('Duplicate campaign source metadata');
    sources.add(id);
    if (sources.size > 8192) throw new RangeError('Profile projection source limit');
    const rootPath = string(raw.rootFile);
    const root = roots.get(rootPath);
    const size = number(raw.size);
    const archiveSha256 = nullableString(raw.archiveSha256);
    const source: AssetSource = {
      id, rootPath, rootSha256: string(raw.rootSha256), rootSize: root ? number(root.size) : size,
      archiveSha256, ordinal: raw.ordinal === null ? null : number(raw.ordinal), memberId: nullableString(raw.idHex),
      absoluteOffset: number(raw.absoluteOffset), size, sha256: string(raw.sha256),
    };
    if (archiveSha256 !== null) {
      const archivePath = id.slice(0, id.lastIndexOf('/#'));
      const archive = archives.get(archivePath);
      if (!root || !archive) throw new TypeError(`Source absent from physical manifest: ${id}`);
      const member = source.ordinal === null ? undefined : membersByArchive.get(archivePath)?.get(source.ordinal);
      if (!member || id !== `${archivePath}/#${source.ordinal}:${source.memberId}` ||
          member.idHex !== source.memberId || member.size !== source.size || archive.sha256 !== source.archiveSha256 ||
          root.sha256 !== source.rootSha256 || archive.rootFile !== rootPath ||
          number(archive.absoluteOffset) + number(archive.dataOffset) + number(member.offset) !== source.absoluteOffset) {
        throw new TypeError(`Physical source metadata disagrees: ${id}`);
      }
    }
    const names = list(namesInput, 16).map(value => normalizeAssetPath(string(value))).sort(compare);
    const profiles = candidateProfiles(profilesInput);
    // Validate source bounds/hashes even for unnamed or unassigned records, without inventing identity.
    const check: ProfileAsset = { source, profiles: ['ra2'], names: [{ path: 'validation-only', kind: 'hash-candidate', evidence }] };
    createProfileResolver('ra2', [{ id: 'validation', kind: archiveSha256 === null ? 'loose' : 'archive', rank: 0,
      rankEvidence: RANK_EVIDENCE, profiles: ['ra2'], assets: [check] }]);
    if (!names.length || !profiles.length) {
      unassigned.push({ sourceId: id, sha256: source.sha256, candidateNames: names,
        reason: !names.length ? 'No candidate filename in campaign snapshot' : 'No candidate profile in campaign snapshot' });
      return;
    }
    const assets = assetsByRoot.get(rootPath) ?? [];
    assets.push({ source, profiles, names: names.map(path => ({ path,
      kind: archiveSha256 === null && normalizeAssetPath(rootPath) === path ? 'literal' : 'hash-candidate', evidence })) });
    assetsByRoot.set(rootPath, assets);
    acceptedSources++;
  }
  for (const key of ['definitions', 'locales'] as const) {
    for (const item of list(campaign[key], 2048)) {
      const record = object(item);
      add(record.source, record.candidateNames, record.profileCandidates, `campaign-census.json:${key}:candidateNames/profileCandidates`);
    }
  }
  for (const item of list(campaign.missions, 2048)) {
    const mission = object(item);
    for (const source of list(mission.sources, 512)) {
      if (object(source).sha256 !== mission.sha256) throw new TypeError('Mission deduplication hash disagrees');
      add(source, mission.candidateNames, mission.profileCandidates, 'campaign-census.json:missions:candidateNames/profileCandidates');
    }
  }
  const layers: ContentLayer[] = [...assetsByRoot].sort(([a], [b]) => compare(a, b)).map(([rootPath, assets]) => ({
    id: rootPath, rank: 0, kind: assets[0]!.source.archiveSha256 === null ? 'loose' : 'archive', rankEvidence: RANK_EVIDENCE,
    profiles: [...new Set(assets.flatMap(asset => asset.profiles))].sort(compare), assets,
  }));
  const factionRequests = new Map<ProfileId, string[]>();
  for (const item of list(campaign.campaignOpcodeUnion, 2)) {
    const union = object(item);
    const profile = candidateProfiles([union.profile])[0]!;
    if (factionRequests.has(profile)) throw new TypeError('Duplicate profile union');
    factionRequests.set(profile, list(union.filenames, 256).map(value => normalizeAssetPath(string(value))));
  }
  const requiredDefinitions = {
    ra2: ['rules.ini', 'ai.ini', 'art.ini', 'battle.ini', 'mission.ini', 'ra2.csf'],
    yr: ['rulesmd.ini', 'aimd.ini', 'artmd.ini', 'battlemd.ini', 'missionmd.ini', 'ra2md.csf'],
  } as const;
  const profiles = (['ra2', 'yr'] as const).map(profile => {
    const resolver = createProfileResolver(profile, layers);
    const requests = [...requiredDefinitions[profile], ...factionRequests.get(profile) ?? []];
    const requirements = resolver.require(requests);
    return { profile, mode: 'candidate-only-unranked', effectiveProfileVerified: false,
      selectionCounts: Object.fromEntries(['resolved', 'candidate', 'ambiguous', 'missing'].map(status =>
        [status, requirements.entries.filter(entry => entry.status === status).length])),
      requestScope: 'Six definition/string names plus faction filenames from the prior census; not a full dependency closure.',
      requested: requirements.entries.map(entry => ({ path: entry.path, status: entry.status })),
      excludedSourceIds: resolver.excludedSourceIds, entries: resolver.entries };
  });
  return { schemaVersion: 1, policy: 'webra2-explicit-rank-v1; candidate report deliberately assigns rank 0 to all roots',
    inputScope: 'Existing reviewed campaign and physical MIX metadata; no retail bytes re-read by this adapter.',
    physicalSourcesInCampaignSnapshot: sources.size, mountedCandidateSources: acceptedSources,
    unassigned: unassigned.sort((a, b) => compare(a.sourceId, b.sourceId)), profiles,
    limitations: [
      'Filename hashes and candidate profile labels are hypotheses, not proof of effective runtime identity.',
      'No native patch, loose-file, nested archive, theater, language, or mod precedence is selected.',
      'Content fingerprints are accepted from the prior census; this report does not verify current on-disk game bytes.',
      'Unnamed and unassigned content, full graphics/audio dependencies and playable locale evidence remain outside this projection.',
    ],
  };
}

async function readMetadata(path: string): Promise<{ value: unknown; sha256: string }> {
  const handle = await open(path, 'r');
  try {
    const cap = 16 * 1024 * 1024;
    const size = (await handle.stat()).size;
    if (size > cap) throw new RangeError('Census JSON exceeds 16 MiB');
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await handle.read(buffer, 0, size, 0);
    if (bytesRead !== size || (await handle.stat()).size !== size) throw new Error('Census JSON changed while reading');
    return { value: JSON.parse(buffer.toString('utf8')) as unknown, sha256: createHash('sha256').update(buffer).digest('hex') };
  } finally { await handle.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [campaignPath, physicalPath, ...extra] = process.argv.slice(2);
  if (!campaignPath || !physicalPath || extra.length) throw new Error('Usage: node --import tsx tools/analysis/profile-census.ts <campaign-census.json> <mix-census.json>');
  const campaign = await readMetadata(campaignPath);
  const physical = await readMetadata(physicalPath);
  const report = { ...profileCensus(campaign.value, physical.value), inputHashes: { campaignSha256: campaign.sha256, physicalSha256: physical.sha256 } };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
