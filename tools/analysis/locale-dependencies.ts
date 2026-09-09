// SPDX-License-Identifier: GPL-3.0-or-later
// Metadata-only CSF/font evidence. Private strings and glyph pixels are never emitted.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { inspectLocaleStrings, inspectUnicodeBitmapFont } from '../../packages/content/src/locale-font.ts';
import { createVerifiedSourceReader, type VerifiedSourceIdentity } from './verified-source.ts';
import { readCampaignGraphManifest } from './campaign-graph.ts';

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('locale-input-object');
  return value as RecordValue;
}
function list(value: unknown, cap: number): unknown[] {
  if (!Array.isArray(value) || value.length > cap) throw new TypeError('locale-input-list');
  for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) throw new TypeError('locale-sparse-list');
  return value;
}
function profiles(value: unknown): ('ra2' | 'yr')[] {
  const result = list(value, 2).map(profile => {
    if (profile !== 'ra2' && profile !== 'yr') throw new TypeError('locale-input-profile');
    return profile;
  });
  if (new Set(result).size !== result.length) throw new TypeError('locale-duplicate-profile');
  return result;
}
function names(value: unknown, extension: string): string[] {
  const result = list(value, 16).map(name => {
    if (typeof name !== 'string' || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/.test(name) || !name.toLowerCase().endsWith(extension)) throw new TypeError('locale-input-filename');
    return name.toLowerCase();
  });
  if (!result.length || new Set(result).size !== result.length) throw new TypeError('locale-duplicate-or-missing-name');
  return result.sort();
}
function candidate(input: unknown, extension: string) {
  const row = object(input);
  const raw = object(row.source);
  if (typeof raw.rootFile !== 'string' || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,254}$/.test(raw.rootFile)) throw new TypeError('locale-source-path');
  for (const key of ['rootSha256', 'sha256']) if (typeof raw[key] !== 'string' || !/^[a-f0-9]{64}$/.test(raw[key])) throw new TypeError('locale-source-hash');
  for (const key of ['size', 'absoluteOffset']) if (typeof raw[key] !== 'number' || !Number.isSafeInteger(raw[key]) || raw[key] < 0) throw new TypeError('locale-source-range');
  const source: VerifiedSourceIdentity = { rootFile: raw.rootFile, rootSha256: raw.rootSha256 as string, sha256: raw.sha256 as string, absoluteOffset: raw.absoluteOffset as number, size: raw.size as number };
  return { candidateNames: names(row.candidateNames, extension), profileCandidates: profiles(row.profileCandidates), source };
}

/** Reverify all pinned candidates; retain font alternatives without inventing native selection. */
export async function localeDependencyReport(directory: string, campaignInput: unknown, fontInput: unknown) {
  const campaign = object(campaignInput), fontManifest = object(fontInput);
  if (campaign.schemaVersion !== 1 || fontManifest.schemaVersion !== 1) throw new TypeError('locale-input-version');
  const locales = list(campaign.locales, 32).map(row => candidate(row, '.csf'));
  const fontCandidates = list(fontManifest.fonts, 8).map(row => candidate(row, '.fnt'));
  const identities = new Set<string>();
  let plannedBytes = 0;
  for (const item of [...locales, ...fontCandidates]) {
    const { rootFile, absoluteOffset, size } = item.source;
    const identity = JSON.stringify([rootFile.toLowerCase(), absoluteOffset, size]);
    if (identities.has(identity)) throw new TypeError('locale-duplicate-physical-source');
    identities.add(identity); plannedBytes += size;
    if (plannedBytes > 64 * 1024 * 1024) throw new RangeError('locale-read-budget');
  }
  const reader = await createVerifiedSourceReader(directory);
  try {
    const fontBytes: Uint8Array[] = [];
    const fonts = [];
    for (const item of fontCandidates) {
      const bytes = await reader.read(item.source);
      fontBytes.push(bytes);
      const { coverage: _coverage, ...structure } = inspectUnicodeBitmapFont(bytes);
      fonts.push({ ...item, structure });
    }
    const strings = [];
    for (const item of locales) {
      const usage = inspectLocaleStrings(await reader.read(item.source));
      const coverage = fontCandidates.flatMap((font, index) => font.profileCandidates.some(profile => item.profileCandidates.includes(profile))
        ? [{ fontSource: font.source, ...inspectUnicodeBitmapFont(fontBytes[index]!, usage.codepoints).coverage }] : []);
      strings.push({ ...item, structure: usage.structure, uniqueCodepoints: usage.codepoints.length, duplicateValues: usage.duplicates, fontCandidates: coverage,
        candidateCoverage: coverage.length === 0 ? 'no-font-candidate' : coverage.every(row => row.allNonControlMapped) ? 'all-candidates-map-non-control-characters' : 'missing-character-or-font-variant',
        nativeDuplicateResolutionVerified: false, verifiedPlayableLocale: null });
    }
    return { schemaVersion: 1, scope: 'pinned-CSF-and-Unicode-font-candidates', membersRead: locales.length + fonts.length, bytesRead: plannedBytes, fonts, strings,
      coverageMeaning: 'Mapping presence only; zero-width/blank glyphs and layout controls are separate. No text layout or playable-locale claim.',
      effectiveFontSelectionVerified: false, playableLocaleEnumerationComplete: false };
  } finally { await reader.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, campaignPath, fontPath, ...extra] = process.argv.slice(2);
  if (!directory || !campaignPath || !fontPath || extra.length) throw new Error('Usage: node --import tsx tools/analysis/locale-dependencies.ts <game-directory> <campaign-census.json> <locale-font-sources.json>');
  const campaign = await readCampaignGraphManifest(campaignPath), fonts = await readCampaignGraphManifest(fontPath);
  const parse = (bytes: Uint8Array) => JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(bytes)) as unknown;
  const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const report = await localeDependencyReport(directory, parse(campaign), parse(fonts));
  process.stdout.write(JSON.stringify({ inputHashes: { campaignSha256: sha256(campaign), fontManifestSha256: sha256(fonts) }, ...report }, null, 2) + '\n');
}
