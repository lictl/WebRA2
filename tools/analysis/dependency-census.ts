// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Metadata-only private-input adapter.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createVerifiedSourceReader } from './verified-source.ts';
import { readCampaignGraphManifest, type GraphCensusInput } from './campaign-graph.ts';
import { scanIni } from '../../packages/content/src/ini.ts';
import { censusMission } from '../../packages/content/src/mission-census.ts';
import { copyGraphSource, type GraphSource } from '../../packages/content/src/campaign-graph.ts';
import { compileDependencyCandidates, DEPENDENCY_LIMITS, type AudioCandidate, type DependencyDocument } from '../../packages/content/src/dependency-candidates.ts';
import { createDependencyFileResolver, type PhysicalDependencyInventory } from '../../packages/content/src/dependency-inventory.ts';
import { readDependencyAudioIndex } from '../../packages/content/src/dependency-audio-index.ts';
function count(values: string[]) { const result: Record<string, number> = Object.create(null) as Record<string, number>; for (const value of values.sort()) result[value] = (result[value] ?? 0) + 1; return result; }
const AUDIO_CENSUS_LIMITS = Object.freeze({ indexEntries: 100_000, pairAttempts: 80_000 });
export async function dependencyCensus(directory: string, campaign: GraphCensusInput, physical: PhysicalDependencyInventory) {
  if (!Array.isArray(campaign.missions) || !Array.isArray(campaign.definitions) || campaign.missions.length > 1000 || campaign.definitions.length > 64) throw new Error('dependency-campaign-limit');
  const resolveFile = createDependencyFileResolver(physical, [{ filename: 'lib.pal', id: 2124019542, evidence: 'EA editor 6abf0f5 Loading.cpp:4361-4363; numeric lookup, filename not proven' }]), reader = await createVerifiedSourceReader(directory);
  let bytesRead = 0, membersRead = 0, audioIndexEntries = 0, audioPairAttempts = 0;
  const discovered: { filename: string; identity: GraphSource }[] = [], samples = new Map<string, AudioCandidate[]>();
  async function discover(filename: string, range: { rootFile: string; rootSha256: string; absoluteOffset: number; size: number }) {
    if (membersRead >= 128 || range.size > 16 * 1024 * 1024 || bytesRead + range.size > 64 * 1024 * 1024) throw new Error('dependency-read-limit');
    const result = await reader.discover({ rootFile: range.rootFile, rootSha256: range.rootSha256, absoluteOffset: range.absoluteOffset, size: range.size });
    membersRead++; bytesRead += result.bytes.length; discovered.push({ filename, identity: result.identity }); return result;
  }
  async function read(source: GraphSource) {
    if (membersRead >= 128 || bytesRead + source.size > 64 * 1024 * 1024) throw new Error('dependency-read-limit');
    const bytes = await reader.read(source); membersRead++; bytesRead += bytes.length; return bytes;
  }
  try {
    const audioIndexes: { source: GraphSource; entries: number; duplicateNames: number; bagCandidates: number; outOfRangePairs: number }[] = [];
    const bags = resolveFile('audio.bag');
    for (const candidate of resolveFile('audio.idx')) {
      const result = await discover('audio.idx', candidate), entries = readDependencyAudioIndex(result.bytes);
      // Same-container pairing is evidence for a candidate pair, not the native choice among mounted indexes/bags.
      const paired = bags.filter(b => b.archivePath === candidate.archivePath && b.archiveSha256 === candidate.archiveSha256);
      // Bound the Cartesian product before materializing candidates, including rejected ranges.
      if (entries.length > AUDIO_CENSUS_LIMITS.indexEntries - audioIndexEntries) throw new Error('dependency-audio-index-entry-limit');
      if (entries.length && paired.length > Math.floor((AUDIO_CENSUS_LIMITS.pairAttempts - audioPairAttempts) / entries.length)) throw new Error('dependency-audio-pairing-limit');
      audioIndexEntries += entries.length; audioPairAttempts += entries.length * paired.length;
      const names = new Set<string>(); let duplicateNames = 0, outOfRangePairs = 0;
      for (const sample of entries) {
        if (names.has(sample.name)) duplicateNames++; names.add(sample.name);
        const list = samples.get(sample.name) ?? [];
        for (const bag of paired) {
          if (sample.offset > bag.size || sample.size > bag.size - sample.offset) { outOfRangePairs++; continue; }
          list.push({ index: result.identity, bag, ordinal: sample.ordinal, offset: sample.offset, size: sample.size, sampleRate: sample.sampleRate, flags: sample.flags, chunkSize: sample.chunkSize });
        }
        samples.set(sample.name, list);
      }
      audioIndexes.push({ source: result.identity, entries: entries.length, duplicateNames, bagCandidates: paired.length, outOfRangePairs });
    }
    const openings = [], diagnostics: { profile: string; code: string; filename: string }[] = [];
    for (const [profile, suffix, filename] of [['ra2', '', 'all01t.map'], ['yr', 'md', 'all01umd.map']] as const) {
      const docs: DependencyDocument[] = [];
      for (const role of ['rules', 'ai', 'art'] as const) {
        const name = `${role}${suffix}.ini`, definitions = campaign.definitions.filter(d => d.candidateNames.map(s => s.toLowerCase()).includes(name));
        if (!definitions.length) diagnostics.push({ profile, code: 'missing-definition', filename: name });
        for (const def of definitions) docs.push({ profile, role, source: copyGraphSource(def.source), document: scanIni(await read(def.source)) });
      }
      const soundName = `sound${suffix}.ini`, soundFiles = resolveFile(soundName);
      if (!soundFiles.length) diagnostics.push({ profile, code: 'missing-sound-table', filename: soundName });
      for (const candidate of soundFiles) { const result = await discover(soundName, candidate); docs.push({ profile, role: 'sound', source: result.identity, document: scanIni(result.bytes) }); }
      const missions = campaign.missions.filter(m => m.candidateNames.includes(filename) && m.profileCandidates.includes(profile)).sort((a, b) => a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0);
      if (!missions.length) diagnostics.push({ profile, code: 'missing-opening-candidate', filename });
      for (const mission of missions) {
        if (!mission.sources.length || mission.sources.length > 64 || mission.sources.some(s => s.sha256 !== mission.sha256)) throw new Error('dependency-mission-identity');
        const copies = [...mission.sources].sort((a, b) => JSON.stringify(copyGraphSource(a)) < JSON.stringify(copyGraphSource(b)) ? -1 : JSON.stringify(copyGraphSource(a)) > JSON.stringify(copyGraphSource(b)) ? 1 : 0);
        const source = copies[0]!, document = scanIni(await read(source));
        for (const copy of copies.slice(1)) await read(copy);
        const graph = compileDependencyCandidates(profile, [...docs, { profile, role: 'mission', source, document }], resolveFile, DEPENDENCY_LIMITS, name => samples.get(name) ?? []);
        const opcodes = censusMission(document);
        const files = graph.nodes.filter(n => n.kind === 'file'), audio = graph.nodes.filter(n => n.kind === 'audio-sample');
        const fileIncoming = new Map<number, Set<string>>();
        for (const edge of graph.edges) { const set = fileIncoming.get(edge.to) ?? new Set<string>(); set.add(edge.requirement); fileIncoming.set(edge.to, set); }
        const sourceGroups = new Map<string, GraphSource[]>();
        for (const s of graph.sources) { const name = s.role === 'mission' ? filename : `${s.role}${suffix}.ini`, group = sourceGroups.get(name) ?? []; group.push(s.identity); sourceGroups.set(name, group); }
        openings.push({ filename, sha256: mission.sha256, equivalentPhysicalSources: copies.map(copyGraphSource), sources: graph.sources,
          seedCount: graph.seeds.length, nodeCount: graph.nodes.length, edgeCount: graph.edges.length,
          nodeKinds: count(graph.nodes.map(n => n.kind)), edgeRequirements: count(graph.edges.map(e => e.requirement)), edgeFields: count(graph.edges.map(e => e.field)),
          diagnosticCounts: count(graph.diagnostics.map(d => d.code)), diagnosticFields: count(graph.diagnostics.filter(d => d.field).map(d => `${d.code}:${d.field}`)), cycleBackEdgeCount: graph.cycleBackEdges.length,
          importManifest: { status: 'candidate-only; native policy not applied',
            requiredSourceGroups: [...sourceGroups].map(([filename, sources]) => ({ filename, selection: 'one effective variant needed; all supplied variants retained for this census', sources })),
            audioContainerCandidates: bags, audioIndexCandidates: audioIndexes.map(a => a.source),
            assetEntries: 'fileRequests; declared local dependencies remain conditional on runtime activation',
            externalRequiredManifestGates: ['localized CSF/fonts and native profile selection in #33/#31', 'packed map/theater assets and opcode-generated dependencies'],
            unsupportedFormatNeeds: [...new Set(files.map(n => n.filename!.split('.').at(-1)!))].sort().map(format => ({ format, requirement: 'conditional', decoderStatus: 'not implemented by this dependency compiler' })),
            audioCodecs: { status: 'unsupported', observedFlags: count(audio.flatMap(n => n.audioCandidates!.map(c => String(c.flags)))) } },
          fileRequests: files.map(n => ({ filename: n.filename!, requirements: [...fileIncoming.get(n.id) ?? []].sort(), importClass: [...fileIncoming.get(n.id) ?? []].every(r => r === 'optional') ? 'optional-probe' : 'conditional-candidate', status: n.candidates!.length ? 'matched-unranked' : 'absent-from-inventory', candidates: n.candidates! })),
          audio: { requestedSamples: audio.length, withIndexCandidates: audio.filter(n => n.audioCandidates!.length > 0).length,
            candidatePairs: audio.reduce((n, a) => n + a.audioCandidates!.length, 0), missingIndexSampleNames: audio.filter(n => !n.audioCandidates!.length).map(n => n.filename),
            codecFlags: count(audio.flatMap(n => n.audioCandidates!.map(c => String(c.flags)))), pairingPolicy: 'same physical archive; native profile choice unresolved' },
          opcodeOperands: { source: copyGraphSource(source), framingComplete: opcodes.framingComplete, classification: 'unsupported', events: opcodes.eventOpcodes, actions: opcodes.actionOpcodes, scripts: opcodes.scriptOpcodes },
          unsupportedCapabilities: graph.unsupportedCapabilities, nativeDependencyClosureComplete: false });
      }
    }
    return { schemaVersion: 1, scope: 'transitive candidates from opening Allied structural seeds', membersRead, bytesRead, audioIndexEntries, audioPairAttempts,
      readBudget: { maxMembers: 128, maxMemberBytes: 16 * 1024 * 1024, maxTotalBytes: 64 * 1024 * 1024, manifestsIndividuallyBoundedToBytes: 4 * 1024 * 1024, maxAudioIndexEntries: AUDIO_CENSUS_LIMITS.indexEntries, maxAudioPairAttempts: AUDIO_CENSUS_LIMITS.pairAttempts }, discovered, audioIndexes, openings, diagnostics,
      fileMatchPolicy: 'all physical MIX hash matches plus explicit EA numeric lib.pal alias; no effective native profile or payload identity chosen',
      requirementsMeaning: 'edge-local research classification; optional file probes are alternatives, not missing required content', nativeDependencyClosureComplete: false };
  } finally { await reader.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, campaignPath, physicalPath, ...extra] = process.argv.slice(2);
  if (!directory || !campaignPath || !physicalPath || extra.length) throw new Error('Usage: node --import tsx tools/analysis/dependency-census.ts <game-directory> <campaign-census.json> <mix-census.json>');
  const campaign = await readCampaignGraphManifest(campaignPath), physical = await readCampaignGraphManifest(physicalPath);
  const decoder = new TextDecoder('utf8', { fatal: true });
  const report = await dependencyCensus(directory, JSON.parse(decoder.decode(campaign)) as GraphCensusInput, JSON.parse(decoder.decode(physical)) as PhysicalDependencyInventory);
  process.stdout.write(JSON.stringify({ inputHashes: { campaign: createHash('sha256').update(campaign).digest('hex'), physical: createHash('sha256').update(physical).digest('hex') }, ...report }, null, 2) + '\n');
}
