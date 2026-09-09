// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Composes GPL content scanners; no retail data bundled.
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createVerifiedSourceReader } from './verified-source.ts';
import { scanIni } from '../../packages/content/src/ini.ts';
import { compileCampaignGraph, copyGraphSource, summarizeCampaignGraph, type GraphDocument, type GraphSource } from '../../packages/content/src/campaign-graph.ts';
import { censusCampaignTables, type CampaignTableInput, type ScenarioCandidate } from '../../packages/content/src/campaign-tables.ts';

interface Candidate { candidateNames: string[]; profileCandidates: string[]; sources: GraphSource[]; sha256: string }
interface Definition { candidateNames: string[]; source: GraphSource }
export interface GraphCensusInput { missions: Candidate[]; definitions: Definition[] }
const profiles = [
  { id: 'ra2' as const, opening: 'all01t.map', rules: 'rules.ini', ai: 'ai.ini', art: 'art.ini', battle: 'battle.ini', table: 'mission.ini' },
  { id: 'yr' as const, opening: 'all01umd.map', rules: 'rulesmd.ini', ai: 'aimd.ini', art: 'artmd.ini', battle: 'battlemd.ini', table: 'missionmd.ini' },
];
function namesOf(row: { candidateNames: string[] }): string[] { return row.candidateNames.map(name => name.toLowerCase()); }
export const GRAPH_MANIFEST_BYTES = 4 * 1024 * 1024;
/** Cap before allocation and read at most cap+1 bytes even if the file grows after stat. */
export async function readCampaignGraphManifest(path: string): Promise<Uint8Array> {
  const file = await open(path, 'r');
  try {
    const before = await file.stat({ bigint: true });
    if (!before.isFile() || before.size > BigInt(GRAPH_MANIFEST_BYTES)) throw new Error('graph-manifest-byte-limit');
    const bytes = new Uint8Array(GRAPH_MANIFEST_BYTES + 1);
    let done = 0;
    while (done < bytes.length) {
      const { bytesRead } = await file.read(bytes, done, bytes.length - done, done);
      if (bytesRead === 0) break;
      done += bytesRead;
    }
    if (done > GRAPH_MANIFEST_BYTES) throw new Error('graph-manifest-byte-limit');
    const after = await file.stat({ bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || BigInt(done) !== after.size) throw new Error('graph-manifest-changed');
    return bytes.slice(0, done);
  } finally { await file.close(); }
}
/** Explicit candidate file policy, not a claim about the native engine's effective load order. */
export async function campaignGraphReport(directory: string, census: GraphCensusInput) {
  if (!Array.isArray(census.missions) || !Array.isArray(census.definitions) || census.missions.length > 1000 || census.definitions.length > 64) throw new Error('graph-census-limit');
  if ([...census.missions, ...census.definitions].some(row => !Array.isArray(row.candidateNames) || row.candidateNames.length > 64 || row.candidateNames.some(name => typeof name !== 'string' || name.length > 255))) throw new Error('graph-census-name-limit');
  const reader = await createVerifiedSourceReader(directory);
  let bytesRead = 0, membersRead = 0;
  async function read(source: GraphSource) {
    if (bytesRead + source.size > 64 * 1024 * 1024 || membersRead >= 128) throw new Error('graph-read-budget');
    const bytes = await reader.read(source); bytesRead += bytes.length; membersRead++; return bytes;
  }
  try {
    const openingGraphs: { filename: string; sha256: string; equivalentPhysicalSources: GraphSource[]; graph: ReturnType<typeof summarizeCampaignGraph> }[] = [];
    const tables: CampaignTableInput[] = [], candidates: ScenarioCandidate[] = [];
    const diagnostics: { profile: string; code: string; filename: string }[] = [];
    for (const profile of profiles) {
      for (const candidate of census.missions) {
        if (!Array.isArray(candidate.profileCandidates) || !Array.isArray(candidate.sources) || candidate.sources.length > 128) throw new Error('graph-census-candidate-shape');
        if (candidate.profileCandidates.includes(profile.id)) for (const filename of namesOf(candidate)) if (/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}\.map$/.test(filename)) candidates.push({ profile: profile.id, filename, sha256: candidate.sha256 });
        if (profile.id === 'ra2' && candidate.profileCandidates.length === 0) for (const filename of namesOf(candidate)) if (/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}\.map$/.test(filename)) candidates.push({ profile: 'unclassified', filename, sha256: candidate.sha256 });
      }
      const definitions: GraphDocument[] = [];
      for (const [role, filename] of [['rules', profile.rules], ['ai', profile.ai], ['art', profile.art], ['battle', profile.battle], ['mission-table', profile.table]] as const) {
        const matches = census.definitions.filter(d => namesOf(d).includes(filename));
        if (!matches.length) diagnostics.push({ profile: profile.id, code: 'missing-definition-candidate', filename });
        for (const match of matches) {
          const document = scanIni(await read(match.source)), source = copyGraphSource(match.source);
          if (role === 'battle' || role === 'mission-table') tables.push({ profile: profile.id, role, document, source });
          else definitions.push({ profile: profile.id, role, document, source });
        }
      }
      const openings = census.missions.filter(m => namesOf(m).includes(profile.opening) && m.profileCandidates.includes(profile.id));
      if (!openings.length) diagnostics.push({ profile: profile.id, code: 'missing-opening-candidate', filename: profile.opening });
      if (openings.length > 1) diagnostics.push({ profile: profile.id, code: 'opening-candidate-variants', filename: profile.opening });
      for (const opening of openings) {
        if (!opening.sources.length || opening.sources.some(s => s.sha256 !== opening.sha256)) throw new Error('opening-source-identity-mismatch');
        const copies = [...opening.sources].sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
        const document = scanIni(await read(copies[0]!));
        for (const copy of copies.slice(1)) await read(copy); // Verify equivalence attestations; retain every physical source.
        const graph = compileCampaignGraph(profile.id, [{ profile: profile.id, role: 'mission', source: copyGraphSource(copies[0]!), document }, ...definitions]);
        openingGraphs.push({ filename: profile.opening, sha256: opening.sha256, equivalentPhysicalSources: copies.map(copyGraphSource), graph: summarizeCampaignGraph(graph) });
      }
    }
    return { schemaVersion: 1, scope: 'opening-Allied-candidate-structural-overapproximation', bytesRead, membersRead,
      scenarioCandidateEvidence: 'hashes from census; only opening payloads reverified here',
      openingGraphs, campaignTables: censusCampaignTables(tables, candidates), diagnostics,
      effectiveProfilePolicy: 'unresolved', dependencyClosureComplete: false, nativeProgressionVerified: false };
  } finally { await reader.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, path] = process.argv.slice(2);
  if (!directory || !path) throw new Error('Usage: node --import tsx tools/analysis/campaign-graph.ts <game-directory> <campaign-census.json>');
  const bytes = await readCampaignGraphManifest(path);
  const report = await campaignGraphReport(directory, JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(bytes)) as GraphCensusInput);
  process.stdout.write(JSON.stringify({ inputManifestSha256: createHash('sha256').update(bytes).digest('hex'), ...report }, null, 2) + '\n');
}
