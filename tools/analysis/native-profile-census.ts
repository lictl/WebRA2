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
/** Verifies factual span identities. This does not disassemble or infer their meaning. */
export function verifyNativeRanges(bytes: Uint8Array, ranges: NativeRange[]): void {
  if (ranges.length > 64) throw new Error('native-range-count-limit');
  for (const row of ranges) {
    if (!Number.isSafeInteger(row.absoluteOffset) || !Number.isSafeInteger(row.size) || row.absoluteOffset < 0 || row.size < 1 || row.absoluteOffset > bytes.length || row.size > bytes.length - row.absoluteOffset) throw new Error('native-range-bounds');
    if (hash(bytes.subarray(row.absoluteOffset, row.absoluteOffset + row.size)) !== row.sha256) throw new Error('native-range-hash');
  }
}
export async function nativeProfileReport(directory: string, locators: Locators, census: Census) {
  if (locators.schemaVersion !== 1 || locators.images.length !== 2 || locators.mapSelectionSources.length !== 2 || census.missions.length > 128 || census.definitions.length > 64) throw new Error('native-report-input-limit');
  for (const row of [...census.missions, ...census.definitions]) {
    if (!Array.isArray(row.candidateNames) || row.candidateNames.length > 64 || row.candidateNames.some(name => typeof name !== 'string' || name.length > 255)) throw new Error('native-report-name-limit');
  }
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
  if (!directory || !locatorPath || !censusPath) throw new Error('Usage: native-profile-census.ts <game-directory> <native-profile-locators.json> <campaign-census.json>');
  const locatorBytes = await readCampaignGraphManifest(locatorPath), censusBytes = await readCampaignGraphManifest(censusPath);
  const report = await nativeProfileReport(directory, JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(locatorBytes)) as Locators, JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(censusBytes)) as Census);
  process.stdout.write(JSON.stringify({ inputLocatorsSha256: hash(locatorBytes), inputCensusSha256: hash(censusBytes), ...report }, null, 2) + '\n');
}
