// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Composes GPL MIX readers; see packages/content/PROVENANCE.md.
import { createHash } from 'node:crypto';
import { open, readFile, readdir, lstat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type ByteSource, readExact, readMix, mixMemberSource, sliceSource } from '../../packages/formats/src/mix.ts';
import { MixNameResolver } from '../../packages/formats/src/mix-names.ts';
import type { CensusArchive } from './mix-census.ts';
import { censusValue, entriesIn, scanIni, type IniDocument } from '../../packages/content/src/ini.ts';
import { censusMission } from '../../packages/content/src/mission-census.ts';
import { censusCsf } from '../../packages/content/src/csf.ts';

export const CAMPAIGN_LIMITS = Object.freeze({ archives: 512, members: 250_000, memberBytes: 16 * 1024 * 1024, sniffBytes: 4096, textCandidates: 2048, totalTextBytes: 128 * 1024 * 1024, chunkBytes: 1024 * 1024 });
interface SourceIdentity { path: string; rootFile: string; rootSha256: string; archiveSha256: string | null; ordinal: number | null; idHex: string | null; absoluteOffset: number; size: number; sha256: string }
interface Member { source: SourceIdentity; names: { name: string; source: string; hashKind: string }[]; id?: number; document?: IniDocument; csf?: ReturnType<typeof censusCsf> }
interface Failure { source: string; code: string; offset?: number }
async function digest(source: ByteSource): Promise<string> {
  const hash = createHash('sha256');
  for (let at = 0; at < source.size; at += CAMPAIGN_LIMITS.chunkBytes) hash.update(await readExact(source, at, Math.min(CAMPAIGN_LIMITS.chunkBytes, source.size - at)));
  return hash.digest('hex');
}
function namesOf(member: Member): string[] { return [...new Set(member.names.map(n => n.name.toLowerCase()))].sort(); }
function safeFilename(value: string): string | undefined {
  return /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}\.(?:map|ini|csf|bik)$/i.test(value) ? value.toLowerCase() : undefined;
}
function references(document: IniDocument) {
  const rows: { filename: string; section: string; key: string; line: number; occurrence: number }[] = [];
  for (const section of document.sections) {
    const filename = safeFilename(section.name);
    if (filename) rows.push({ filename, section: section.name, key: '(section-name)', line: section.line, occurrence: section.occurrence });
  }
  for (const row of document.entries) {
    for (const match of censusValue(row.value).matchAll(/(?<![A-Za-z0-9_.-])[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}\.(?:map|ini|csf|bik)(?![A-Za-z0-9_.-])/gi)) {
      const filename = safeFilename(match[0]);
      if (filename) rows.push({ filename, section: row.section, key: row.key, line: row.line, occurrence: row.keyOccurrence });
    }
  }
  return rows;
}
function profiles(names: readonly string[]): ('ra2' | 'yr')[] {
  const result = new Set<'ra2' | 'yr'>();
  for (const name of names) {
    if (/^(all|sov)\d{2}[a-z]*md\.map$/i.test(name) || /^(battle|mission|rules|ai|art|ra2)md\.(ini|csf)$/i.test(name)) result.add('yr');
    else if (/^(all|sov)\d{2}[a-z]*\.map$/i.test(name) || /^(battle|mission|rules|ai|art)\.ini$/i.test(name) || name === 'ra2.csf') result.add('ra2');
  }
  return [...result].sort();
}
export async function campaignCensus(directory: string, manifest: { archives: CensusArchive[] }) {
  if (!Array.isArray(manifest.archives) || manifest.archives.length > CAMPAIGN_LIMITS.archives) throw new Error('Invalid/archive-limited physical manifest');
  if (manifest.archives.reduce((n, a) => n + a.members.length, 0) > CAMPAIGN_LIMITS.members) throw new Error('Physical manifest exceeds member cap');
  const root = resolve(directory), members: Member[] = [], failures: Failure[] = [], limitations: { source: string; code: string }[] = [];
  const resolver = new MixNameResolver();
  for (const archive of manifest.archives) for (const member of archive.members) for (const name of member.names) resolver.add({ name: name.name, source: name.source });
  for (const name of ['battle.ini', 'battlemd.ini', 'mission.ini', 'missionmd.ini', 'rules.ini', 'rulesmd.ini', 'ra2.csf', 'ra2md.csf']) resolver.add({ name, source: 'campaign-format-candidate-v1' });
  const archivesByPath = new Map(manifest.archives.map(a => [a.path, a]));
  let totalTextBytes = 0, sniffed = 0, rejectedSniff = 0, oversized = 0;
  async function inspect(source: ByteSource, identity: Omit<SourceIdentity, 'sha256'>, names: Member['names'], id?: number): Promise<void> {
    const knownText = names.some(n => /\.(ini|map|csf)$/i.test(n.name));
    const namedCsf = names.some(n => /\.csf$/i.test(n.name)), namedMap = names.some(n => /\.map$/i.test(n.name));
    if (source.size > CAMPAIGN_LIMITS.memberBytes) { oversized++; if (knownText) limitations.push({ source: identity.path, code: 'member-byte-limit' }); return; }
    const head = await readExact(source, 0, Math.min(source.size, CAMPAIGN_LIMITS.sniffBytes)); sniffed++;
    const csf = head[0] === 32 && head[1] === 70 && head[2] === 83 && head[3] === 67;
    if (namedCsf && !csf) { failures.push({ source: identity.path, code: 'named-csf-candidate-magic-mismatch' }); return; }
    // A heuristic only for unnamed members. Known candidates are read regardless of the prefix.
    const prefix = Buffer.from(head).toString('latin1');
    const textLike = !head.includes(0) && /(?:^|[\r\n])[ \t]*\[[A-Za-z][^\]\r\n]{0,80}\]/.test(prefix);
    if (!knownText && !csf && !textLike) { rejectedSniff++; return; }
    if (members.length >= CAMPAIGN_LIMITS.textCandidates || totalTextBytes + source.size > CAMPAIGN_LIMITS.totalTextBytes) throw new Error('Text census resource cap reached');
    totalTextBytes += source.size;
    const bytes = await readExact(source, 0, source.size);
    const member: Member = { source: { ...identity, sha256: createHash('sha256').update(bytes).digest('hex') }, names, ...(id === undefined ? {} : { id }) };
    try {
      if (csf) member.csf = censusCsf(bytes);
      else member.document = scanIni(bytes);
      if (namedMap && (!member.document || !censusMission(member.document).isMapCandidate)) {
        failures.push({ source: identity.path, code: 'named-map-candidate-missing-structure' });
      }
      members.push(member);
      if (member.document) for (const reference of references(member.document)) resolver.add({ name: reference.filename, source: `${identity.path}:${reference.section}/${reference.key}@${reference.line}` });
    } catch (error) {
      const problem = error as { code?: string; offset?: number };
      failures.push({ source: identity.path, code: problem.code ?? 'decode-failure', ...(problem.offset === undefined ? {} : { offset: problem.offset }) });
    }
  }
  const rootFiles = [...new Set(manifest.archives.map(a => a.rootFile))].sort();
  for (const filename of rootFiles) {
    if (basename(filename) !== filename || filename === '.' || filename === '..') throw new Error('Manifest root must be a filename');
    const path = join(root, filename);
    if (!(await lstat(path)).isFile()) throw new Error('Manifest root must be a regular file');
    const file = await open(path, 'r');
    try {
      const size = (await file.stat()).size;
      const source: ByteSource = { size, async read(offset, length) {
        const bytes = new Uint8Array(length); let done = 0;
        while (done < length) { const { bytesRead } = await file.read(bytes, done, length - done, offset + done); if (!bytesRead) break; done += bytesRead; }
        return bytes.subarray(0, done);
      } };
      const rootSha256 = await digest(source), rootRow = archivesByPath.get(filename);
      if (!rootRow || rootRow.sha256 !== rootSha256 || rootRow.size !== size) throw new Error(`Physical root manifest mismatch: ${filename}`);
      for (const row of manifest.archives.filter(a => a.rootFile === filename)) {
        const archiveSource = sliceSource(source, row.absoluteOffset, row.size);
        if (row.absoluteOffset !== 0 && await digest(archiveSource) !== row.sha256) throw new Error(`Physical archive manifest mismatch: ${row.path}`);
        const archive = await readMix(archiveSource);
        if (archive.dataOffset !== row.dataOffset || archive.entries.length !== row.members.length) throw new Error(`Physical index manifest mismatch: ${row.path}`);
        for (const entry of archive.entries) {
          const recorded = row.members[entry.ordinal]!;
          if (recorded.id !== entry.id || recorded.offset !== entry.offset || recorded.size !== entry.size) throw new Error(`Physical member manifest mismatch: ${row.path}`);
          const path = `${row.path}/#${entry.ordinal}:${recorded.idHex}`;
          if (archivesByPath.has(path)) continue;
          await inspect(mixMemberSource(archiveSource, archive, entry), { path, rootFile: filename, rootSha256, archiveSha256: row.sha256, ordinal: entry.ordinal, idHex: recorded.idHex, absoluteOffset: row.absoluteOffset + archive.dataOffset + entry.offset, size: entry.size }, [...recorded.names], entry.id);
        }
      }
    } finally { await file.close(); }
  }
  // Loose imports are also candidates, never automatically higher-priority winners.
  for (const entry of (await readdir(root, { withFileTypes: true })).filter(e => e.isFile() && /\.(map|ini|csf)$/i.test(e.name)).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const path = join(root, entry.name), size = (await lstat(path)).size;
    if (size > CAMPAIGN_LIMITS.memberBytes) { limitations.push({ source: entry.name, code: 'loose-byte-limit' }); continue; }
    const bytes = await readFile(path), sha256 = createHash('sha256').update(bytes).digest('hex');
    await inspect({ size, async read(at, length) { return bytes.subarray(at, at + length); } }, { path: entry.name, rootFile: entry.name, rootSha256: sha256, archiveSha256: null, ordinal: null, idHex: null, absoluteOffset: 0, size }, [{ name: entry.name, source: 'loose-filename', hashKind: 'not-applicable' }]);
  }
  for (const member of members) if (member.id !== undefined) member.names = [...resolver.resolve(member.id)];
  const represented = new Set([...members.map(m => m.source.path), ...failures.map(f => f.source), ...limitations.map(l => l.source)]);
  for (const archive of manifest.archives) for (const member of archive.members) {
    const path = `${archive.path}/#${member.ordinal}:${member.idHex}`;
    if (!represented.has(path) && !archivesByPath.has(path) && resolver.resolve(member.id).some(n => /\.(ini|map|csf)$/i.test(n.name))) {
      limitations.push({ source: path, code: 'late-named-format-candidate-not-inspected' });
    }
  }
  for (const member of members) {
    if (failures.some(f => f.source === member.source.path)) continue;
    if (namesOf(member).some(n => /\.csf$/i.test(n)) && !member.csf) failures.push({ source: member.source.path, code: 'named-csf-candidate-magic-mismatch' });
    if (namesOf(member).some(n => /\.map$/i.test(n)) && (!member.document || !censusMission(member.document).isMapCandidate)) failures.push({ source: member.source.path, code: 'named-map-candidate-missing-structure' });
  }
  const documents = members.filter((member): member is Member & { document: IniDocument } => member.document !== undefined);
  const rules = documents.filter(m => namesOf(m).some(n => /^rules(md)?\.ini$/i.test(n)));
  const ruleIndexes = new Map(rules.map(rule => {
    const index = new Map<string, Map<string, string[]>>();
    for (const entry of rule.document.entries) {
      const section = entry.section.toLowerCase(), key = entry.key.toLowerCase(), keys = index.get(section) ?? new Map<string, string[]>();
      const values = keys.get(key) ?? []; values.push(censusValue(entry.value)); keys.set(key, values); index.set(section, keys);
    }
    return [rule, index] as const;
  }));
  const physicalMaps = documents.map(member => ({ member, census: censusMission(member.document) })).filter(row => row.census.isMapCandidate);
  const groups = new Map<string, typeof physicalMaps>();
  for (const row of physicalMaps) { const group = groups.get(row.member.source.sha256) ?? []; group.push(row); groups.set(row.member.source.sha256, group); }
  const mapGroups = [...groups].sort(([a], [b]) => a < b ? -1 : 1).map(([sha256, copies]) => {
    const first = copies[0]!, candidateNames = [...new Set(copies.flatMap(c => namesOf(c.member)))].sort();
    const profileCandidates = profiles(candidateNames);
    const campaignCandidates = candidateNames.filter(n => /^(all|sov)\d{2}[a-z]*\.map$/i.test(n));
    const referencesFromMap = references(first.member.document);
    const ruleComparisons = rules.filter(rule => profiles(namesOf(rule)).some(p => profileCandidates.includes(p))).map(rule => {
      const bySection = ruleIndexes.get(rule)!;
      const sections = new Map<string, { keyCount: number; differentValueKeys: number; newKeys: number }>();
      for (const entry of first.member.document.entries) {
        const baseline = bySection.get(entry.section.toLowerCase()); if (!baseline) continue;
        const result = sections.get(entry.section) ?? { keyCount: 0, differentValueKeys: 0, newKeys: 0 };
        const peers = baseline.get(entry.key.toLowerCase()) ?? [];
        result.keyCount++;
        if (!peers.length) result.newKeys++; else if (peers.some(value => value !== censusValue(entry.value))) result.differentValueKeys++;
        sections.set(entry.section, result);
      }
      return { rulesNames: namesOf(rule), rulesSha256: rule.source.sha256, sections: [...sections].sort(([a], [b]) => a < b ? -1 : 1).map(([section, counts]) => ({ section, ...counts })) };
    }).filter(comparison => comparison.sections.length);
    const nameEvidence = [...new Map(copies.flatMap(c => c.member.names).map(n => [`${n.name.toLowerCase()}\0${n.source}\0${n.hashKind}`, n])).values()];
    return { sha256, candidateNames, nameEvidence, profileCandidates, campaignCandidates, sources: copies.map(c => c.member.source), references: referencesFromMap, census: first.census,
      iniDiagnostics: first.member.document.diagnostics, ruleComparisons };
  });
  const missions = mapGroups.filter(m => m.campaignCandidates.length || m.candidateNames.some(n => /^trn\d+.*\.map$/i.test(n)) || m.sources.some(s => /^maps(?:md)?\d+\.mix$/i.test(s.rootFile)));
  const byName = new Map<string, Set<string>>();
  for (const mission of missions) for (const name of mission.candidateNames) { const hashes = byName.get(name) ?? new Set<string>(); hashes.add(mission.sha256); byName.set(name, hashes); }
  const definitionFiles = documents.filter(member => namesOf(member).some(name => /^(battle|mission|rules|ai|art)(md)?\.ini$/i.test(name))).map(member => ({
    source: member.source, candidateNames: namesOf(member), profileCandidates: profiles(namesOf(member)),
    sectionCount: member.document.sections.length, entryCount: member.document.entries.length,
    references: references(member.document), diagnostics: member.document.diagnostics,
  }));
  const battleScenarios = documents.filter(m => namesOf(m).some(n => /^battle(md)?\.ini$/i.test(n))).flatMap(member => {
    const listed = new Set(entriesIn(member.document, 'Battles').map(row => censusValue(row.value).toLowerCase()));
    return member.document.entries.filter(row => row.key.toLowerCase() === 'scenario').flatMap(row => {
      const filename = safeFilename(censusValue(row.value)); if (!filename || !filename.endsWith('.map')) return [];
      const debug = entriesIn(member.document, row.section).filter(entry => entry.key.toLowerCase() === 'debugonly').map(entry => censusValue(entry.value).toLowerCase());
      return [{ definitionSource: member.source.path, definitionSha256: member.source.sha256, profileCandidates: profiles(namesOf(member)),
        section: row.section, line: row.line, listedInBattles: listed.has(row.section.toLowerCase()), debugOnlyTokens: debug.filter(value => /^(yes|no|true|false|0|1)$/.test(value)),
        filename, matchingHashes: mapGroups.filter(map => map.candidateNames.includes(filename)).map(map => map.sha256) }];
    });
  });
  const campaignOpcodeUnion = (['ra2', 'yr'] as const).map(profile => {
    const filenames = [...new Set(battleScenarios.filter(row => row.profileCandidates.includes(profile) && /^(all|sov)\d{2}[a-z]*\.map$/i.test(row.filename)).map(row => row.filename))].sort();
    const candidates = missions.filter(m => m.candidateNames.some(name => filenames.includes(name)));
    const missingFilenames = filenames.filter(name => !candidates.some(m => m.candidateNames.includes(name)));
    const parsedCandidatesFramingComplete = candidates.length > 0 && candidates.every(m => m.census.framingComplete);
    const ids = (field: 'eventOpcodes' | 'actionOpcodes' | 'scriptOpcodes') => [...new Set(candidates.flatMap(m => m.census[field].map(row => row.id)))].sort((a, b) => a - b);
    return { profile, filenames, variantHashes: candidates.map(m => m.sha256).sort(), missingFilenames,
      eventIds: ids('eventOpcodes'), actionIds: ids('actionOpcodes'), scriptIds: ids('scriptOpcodes'), parsedCandidatesFramingComplete,
      framingComplete: filenames.length > 0 && missingFilenames.length === 0 && parsedCandidatesFramingComplete };
  });
  return { schemaVersion: 1, physicalManifestRevision: 'mix-census-v1', limits: CAMPAIGN_LIMITS,
    summary: { physicalArchiveRoots: rootFiles.length, prefixInspectedMembers: sniffed, prefixRejectedMembers: rejectedSniff, oversizedSkippedMembers: oversized, candidateBytes: totalTextBytes, parsedCandidates: members.length,
      physicalMapRecords: physicalMaps.length, uniqueMapHashes: mapGroups.length, detailedCampaignOrTrainingHashes: missions.length,
      otherMapHashes: mapGroups.length - missions.length, namedCampaignHashes: missions.filter(m => m.campaignCandidates.length).length,
      ambiguousCandidateRecords: members.filter(m => namesOf(m).length > 1).length,
      csfRecords: members.filter(m => m.csf).length, framingDiagnostics: mapGroups.reduce((n, m) => n + m.census.diagnostics.length, 0) },
    definitions: definitionFiles, battleScenarios, campaignOpcodeUnion, missions,
    variants: [...byName].filter(([, hashes]) => hashes.size > 1).sort(([a], [b]) => a < b ? -1 : 1).map(([name, hashes]) => ({ name, hashes: [...hashes].sort(), effectiveWinner: null })),
    locales: members.filter(m => m.csf).map(member => ({ source: member.source, candidateNames: namesOf(member), profileCandidates: profiles(namesOf(member)), structure: member.csf,
      verifiedPlayableLocale: null })),
    failures, limitations,
    interpretation: ['Physical sources and content hashes are verified; candidate filename hashes are not collision-free identity proof.', 'Map content hashes deduplicate exact bytes; distinct variants and candidate profiles are retained without selecting effective precedence.', 'Opcode IDs are structural occurrences, not recovered runtime meanings or implemented capabilities.', 'Unnamed text discovery uses a bounded prefix heuristic; undiscovered text and unidentified filenames remain possible.', 'CSF character-class/header metadata does not by itself establish a playable language pack or distinguish Traditional from Simplified Chinese.', 'Retail values, mission payloads and translated strings are not emitted.'],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node --import tsx tools/analysis/campaign-census.ts /path/to/game [physical-manifest.json]');
  const manifest = JSON.parse(await readFile(process.argv[3] ?? 'docs/analysis/mix-census.json', 'utf8')) as { archives: CensusArchive[] };
  const result = await campaignCensus(directory, manifest);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.failures.length || result.limitations.length) process.exitCode = 1;
}
