// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Metadata only; never executes reference programs.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createVerifiedSourceReader, type VerifiedSourceIdentity } from './verified-source.ts';
import { readCampaignGraphManifest } from './campaign-graph.ts';
import { scanIni } from '../../packages/content/src/ini.ts';
import { censusNativeCampaignControls, censusNativeMapSelection } from '../../packages/content/src/native-profile.ts';

export interface NativeRange { id: string; virtualAddress: number; absoluteOffset: number; size: number; sha256: string }
interface Locators {
  schemaVersion: number;
  images: (VerifiedSourceIdentity & { ranges: NativeRange[] })[];
  mapSelectionSources: (VerifiedSourceIdentity & { name: string; archivePath: string })[];
}
interface Mission { candidateNames: string[]; profileCandidates: string[]; sources: VerifiedSourceIdentity[]; sha256: string }
interface Census { missions: Mission[]; definitions: { candidateNames: string[]; source: VerifiedSourceIdentity }[] }
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sha256 = /^[a-f0-9]{64}$/;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('native-record-shape');
  return value as Record<string, unknown>;
}
function list(value: unknown, maximum: number, minimum = 0): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new Error('native-array-limit');
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new Error('native-sparse-array');
  return value;
}
function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error('native-integer');
  return value;
}
function text(value: unknown, maximum: number, pattern: RegExp): string {
  if (typeof value !== 'string' || !value.length || value.length > maximum || !pattern.test(value)) throw new Error('native-text-shape');
  return value;
}
type PublicSource = VerifiedSourceIdentity & { path?: string; archiveSha256?: string; ordinal?: number; idHex?: string };
function sourceCopy(input: unknown): PublicSource {
  const row = record(input);
  const result: PublicSource = {
    rootFile: text(row.rootFile, 255, /^(?!\.{1,2}$)[^\\/:\x00-\x1f\x7f]+$/),
    rootSha256: text(row.rootSha256, 64, sha256), absoluteOffset: integer(row.absoluteOffset),
    size: integer(row.size, 16 * 1024 * 1024), sha256: text(row.sha256, 64, sha256),
  };
  if (row.path !== undefined) {
    const path = text(row.path, 1024, /^.+(?:\/#\d{1,5}:[a-f0-9]{8})+$/);
    if (!path.startsWith(result.rootFile) || !/^(?:\/#\d{1,5}:[a-f0-9]{8})+$/.test(path.slice(result.rootFile.length))) throw new Error('native-source-path');
    result.path = path;
  }
  if (row.archiveSha256 !== undefined) result.archiveSha256 = text(row.archiveSha256, 64, sha256);
  if (row.ordinal !== undefined) result.ordinal = integer(row.ordinal, 65535);
  if (row.idHex !== undefined) result.idHex = text(row.idHex, 8, /^[a-f0-9]{8}$/);
  return { ...(result.path !== undefined ? { path: result.path } : {}), rootFile: result.rootFile, rootSha256: result.rootSha256,
    ...(result.archiveSha256 !== undefined ? { archiveSha256: result.archiveSha256 } : {}),
    ...(result.ordinal !== undefined ? { ordinal: result.ordinal } : {}), ...(result.idHex !== undefined ? { idHex: result.idHex } : {}),
    absoluteOffset: result.absoluteOffset, size: result.size, sha256: result.sha256 };
}
function names(input: unknown): string[] {
  return list(input, 64).map(name => text(name, 132, /^[a-z0-9_][a-z0-9_.-]*\.(?:map|ini|csf)$/));
}
function profiles(input: unknown): string[] {
  const result = list(input, 2).map(value => text(value, 3, /^(ra2|yr)$/));
  if (new Set(result).size !== result.length) throw new Error('native-duplicate-profile');
  return result;
}
function rangeCopy(input: unknown): NativeRange {
  const row = record(input);
  return { id: text(row.id, 64, /^[a-z][a-z0-9-]*$/), virtualAddress: integer(row.virtualAddress, 0xffffffff),
    absoluteOffset: integer(row.absoluteOffset), size: integer(row.size), sha256: text(row.sha256, 64, sha256) };
}
function uniqueSources(sources: readonly VerifiedSourceIdentity[]): void {
  const keys = sources.map(source => JSON.stringify([source.rootFile.toLowerCase(), source.absoluteOffset, source.size]));
  if (new Set(keys).size !== keys.length) throw new Error('native-duplicate-source');
}
/** Only explicitly validated metadata survives the JSON boundary; unknown fields are ignored. */
function inputCopies(locatorInput: unknown, censusInput: unknown): { locators: Locators; census: Census } {
  const locator = record(locatorInput), input = record(censusInput);
  if (locator.schemaVersion !== 1) throw new Error('native-locator-version');
  const images = list(locator.images, 2, 2).map(input => {
    const row = record(input), source = sourceCopy(row);
    if (!['game.exe', 'gamemd.exe'].includes(source.rootFile) || source.absoluteOffset !== 0 || source.sha256 !== source.rootSha256) throw new Error('native-image-identity');
    const ranges = list(row.ranges, 64, 1).map(rangeCopy);
    if (new Set(ranges.map(range => range.id)).size !== ranges.length) throw new Error('native-duplicate-range');
    return { ...source, ranges };
  });
  if (new Set(images.map(row => row.rootFile)).size !== 2) throw new Error('native-duplicate-image');
  const mapSelectionSources = list(locator.mapSelectionSources, 2, 2).map(input => {
    const row = record(input), source = sourceCopy(row);
    const name = text(row.name, 12, /^(mapsel|mapselmd)\.ini$/);
    const archivePath = text(row.archivePath, 1024, /^.+(?:\/#\d{1,5}:[a-f0-9]{8})+$/);
    if (!archivePath.startsWith(source.rootFile) || !/^(?:\/#\d{1,5}:[a-f0-9]{8})+$/.test(archivePath.slice(source.rootFile.length))) throw new Error('native-table-path');
    return { name, rootFile: source.rootFile, rootSha256: source.rootSha256, archivePath,
      absoluteOffset: source.absoluteOffset, size: source.size, sha256: source.sha256 };
  });
  if (new Set(mapSelectionSources.map(row => row.name)).size !== 2) throw new Error('native-duplicate-table');
  uniqueSources(mapSelectionSources);
  const missions = list(input.missions, 128).map(input => {
    const row = record(input), candidateNames = names(row.candidateNames), profileCandidates = profiles(row.profileCandidates);
    const sources = list(row.sources, 128, 1).map(sourceCopy), sha = text(row.sha256, 64, sha256);
    if (sources.some(source => source.sha256 !== sha)) throw new Error('native-mission-source-identity');
    return { candidateNames, profileCandidates, sources, sha256: sha };
  });
  const definitions = list(input.definitions, 64).map(input => { const row = record(input); return { candidateNames: names(row.candidateNames), source: sourceCopy(row.source) }; });
  uniqueSources([...images, ...mapSelectionSources, ...missions.flatMap(row => row.sources), ...definitions.map(row => row.source)]);
  return { locators: { schemaVersion: 1, images, mapSelectionSources }, census: { missions, definitions } };
}
/** Verifies factual span identities. This does not disassemble or infer their meaning. */
export function verifyNativeRanges(bytes: Uint8Array, ranges: NativeRange[]): void {
  if (ranges.length > 64) throw new Error('native-range-count-limit');
  for (const row of ranges) {
    if (!Number.isSafeInteger(row.absoluteOffset) || !Number.isSafeInteger(row.size) || row.absoluteOffset < 0 || row.size < 1 || row.absoluteOffset > bytes.length || row.size > bytes.length - row.absoluteOffset) throw new Error('native-range-bounds');
    if (hash(bytes.subarray(row.absoluteOffset, row.absoluteOffset + row.size)) !== row.sha256) throw new Error('native-range-hash');
  }
}
export async function nativeProfileReport(directory: string, locatorInput: unknown, censusInput: unknown) {
  const { locators, census } = inputCopies(locatorInput, censusInput);
  const reader = await createVerifiedSourceReader(directory);
  let membersRead = 0, bytesRead = 0;
  async function read(source: VerifiedSourceIdentity) {
    if (membersRead >= 192 || !Number.isSafeInteger(source.size) || source.size < 0 || bytesRead + source.size > 64 * 1024 * 1024) throw new Error('native-report-read-limit');
    const bytes = await reader.read(source); membersRead++; bytesRead += bytes.length; return bytes;
  }
  try {
    for (const image of locators.images) {
      if (image.absoluteOffset !== 0 || image.sha256 !== image.rootSha256) throw new Error('native-image-identity');
      verifyNativeRanges(await read(image), image.ranges);
    }
    const tables = [];
    for (const source of locators.mapSelectionSources) {
      const profile = source.name === 'mapsel.ini' ? 'ra2' : source.name === 'mapselmd.ini' ? 'yr' : null;
      if (!profile) throw new Error('native-table-name');
      const known = [...new Set(census.missions.filter(row => row.profileCandidates.includes(profile)).flatMap(row => row.candidateNames).filter(name => /^[a-z0-9_][a-z0-9_.-]{0,127}\.map$/.test(name)))];
      tables.push({ profile, source, ...censusNativeMapSelection(scanIni(await read(source)), known) });
    }
    const missions = [];
    for (const row of census.missions) {
      if (!Array.isArray(row.profileCandidates) || !Array.isArray(row.sources) || row.sources.length > 128) throw new Error('native-mission-shape');
      if (!row.profileCandidates.some(profile => profile === 'ra2' || profile === 'yr')) continue;
      if (!row.sources.length || row.sources.some(source => source.sha256 !== row.sha256)) throw new Error('native-mission-source-identity');
      let controls: ReturnType<typeof censusNativeCampaignControls> | undefined;
      for (const source of row.sources) {
        const bytes = await read(source);
        controls ??= censusNativeCampaignControls(scanIni(bytes));
      }
      missions.push({ candidateNames: row.candidateNames.filter(name => /^[a-z0-9_][a-z0-9_.-]{0,127}\.map$/.test(name)), profiles: row.profileCandidates, sha256: row.sha256, sources: row.sources, ...controls! });
    }
    const rules = census.definitions.filter(row => row.candidateNames.includes('rulesmd.ini'));
    for (const row of rules) await read(row.source);
    const alternatives = [
      { filename: 'rulesmd.ini', sources: rules.map(row => row.source) },
      { filename: 'all02umd.map', sources: census.missions.filter(row => row.candidateNames.includes('all02umd.map')).flatMap(row => row.sources) },
    ].map(row => {
      const patch = row.sources.filter(source => source.rootFile.toLowerCase() === 'expandmd01.mix');
      if (patch.length !== 1 || row.sources.length !== 2) throw new Error('native-patch-candidate-shape');
      return { filename: row.filename, proposedSelectedSource: patch[0]!, alternatives: row.sources.filter(source => source !== patch[0]), evidence: 'pinned native expansion construction + list traversal; supplied-install proposal, not universal mount policy' };
    });
    return { schemaVersion: 1, scope: 'pinned-native-static-profile-and-progression-evidence', membersRead, bytesRead, images: locators.images, tables, missions, alternatives,
      nativeProgramsExecuted: false, runtimeComparisonVerified: false, effectiveProfileComplete: false,
      limits: { memberReads: 192, totalMemberBytes: 64 * 1024 * 1024, imageRanges: 64 },
      limitations: ['Wildcard enumeration and every dynamically mounted theater/side/locale layer are not fully traced.', 'Choice edges are table references, not an implemented or observed native campaign run.', 'Literal name identities remain filename/hash candidates.'] };
  } finally { await reader.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, locatorPath, censusPath] = process.argv.slice(2);
  if (process.argv.length !== 5 || !directory || !locatorPath || !censusPath) throw new Error('Usage: native-profile-census.ts <game-directory> <native-profile-locators.json> <campaign-census.json>');
  const locatorBytes = await readCampaignGraphManifest(locatorPath), censusBytes = await readCampaignGraphManifest(censusPath);
  const report = await nativeProfileReport(directory, JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(locatorBytes)) as Locators, JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(censusBytes)) as Census);
  process.stdout.write(JSON.stringify({ inputLocatorsSha256: hash(locatorBytes), inputCensusSha256: hash(censusBytes), ...report }, null, 2) + '\n');
}
