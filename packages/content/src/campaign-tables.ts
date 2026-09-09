// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Structural table evidence only; no native progression algorithm.
import { censusValue, ContentError, type IniDocument } from './ini.ts';
import { validateGraphSource, type GraphSource } from './campaign-graph.ts';

export interface CampaignTableInput { profile: 'ra2' | 'yr'; role: 'battle' | 'mission-table'; source: GraphSource; document: IniDocument }
export interface ScenarioCandidate { profile: 'ra2' | 'yr'; filename: string; sha256: string }
const filename = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}\.map$/i;
const folded = (value: string) => censusValue(value).toLowerCase();
/** Retains declaration/reference positions, but never converts list order or legacy fields to progression edges. */
export function censusCampaignTables(tables: CampaignTableInput[], candidates: ScenarioCandidate[]) {
  if (tables.length > 32 || candidates.length > 10_000 || tables.reduce((n, t) => n + t.document.entries.length, 0) > 100_000) throw new ContentError('campaign-table-limit', 0, 'Campaign table cap');
  const known = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    if (!['ra2', 'yr'].includes(candidate.profile) || !filename.test(candidate.filename) || !/^[a-f0-9]{64}$/.test(candidate.sha256)) throw new ContentError('campaign-candidate-identity', 0, 'Invalid candidate identity');
    const key = `${candidate.profile}:${candidate.filename.toLowerCase()}`, hashes = known.get(key) ?? new Set<string>(); hashes.add(candidate.sha256); known.set(key, hashes);
  }
  const result: { profile: 'ra2' | 'yr'; role: CampaignTableInput['role']; source: GraphSource; declarationCount: number; references: { filename: string; line: number; membershipLines: number[]; hashes: string[] }[]; diagnostics: { code: string; line: number }[] }[] = [];
  const key = (t: CampaignTableInput) => JSON.stringify([t.source.rootFile, t.source.rootSha256, t.source.absoluteOffset, t.source.size, t.source.sha256, t.role]);
  const seen = new Set<string>();
  for (const table of [...tables].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)) {
    validateGraphSource(table.source);
    if (!['ra2', 'yr'].includes(table.profile) || !['battle', 'mission-table'].includes(table.role) || seen.has(key(table))) throw new ContentError('campaign-table-identity', 0, 'Invalid or duplicate table identity');
    seen.add(key(table));
    const diagnostics: { code: string; line: number }[] = [], references: typeof result[number]['references'] = [];
    const listed = new Map<string, number[]>();
    const scenarios = new Set<string>();
    for (const row of table.document.entries) {
      if (row.keyOccurrence > 0) diagnostics.push({ code: 'duplicate-table-key', line: row.line });
      if (table.role === 'battle' && folded(row.section) === 'battles') {
        const key = folded(row.value), lines = listed.get(key) ?? []; lines.push(row.line); listed.set(key, lines);
      }
    }
    function reference(value: string, line: number, membershipLines: number[]) {
      if (!filename.test(value)) { diagnostics.push({ code: 'unsupported-scenario-filename', line }); return; }
      const name = value.toLowerCase(), hashes = [...(known.get(`${table.profile}:${name}`) ?? [])].sort();
      references.push({ filename: name, line, membershipLines, hashes });
      if (!hashes.length) diagnostics.push({ code: 'missing-scenario-candidate', line });
      if (hashes.length > 1) diagnostics.push({ code: 'scenario-candidate-variants', line });
    }
    if (table.role === 'battle') {
      for (const row of table.document.entries) if (folded(row.key) === 'scenario') {
        scenarios.add(folded(row.section)); reference(censusValue(row.value), row.line, listed.get(folded(row.section)) ?? []);
      }
      for (const [section, lines] of listed) {
        if (!scenarios.has(section)) for (const line of lines) diagnostics.push({ code: 'listed-entry-has-no-scenario', line });
        if (lines.length > 1) diagnostics.push({ code: 'duplicate-battle-membership', line: lines[1]! });
      }
    } else for (const section of table.document.sections) if (filename.test(section.name)) reference(section.name, section.line, []);
    for (const issue of table.document.diagnostics) diagnostics.push({ code: 'ini-diagnostic', line: issue.line });
    result.push({ profile: table.profile, role: table.role, source: { ...table.source }, declarationCount: [...listed.values()].reduce((n, a) => n + a.length, 0), references, diagnostics });
  }
  return { tables: result, nativeProgression: 'unverified' as const, progressionEdges: [] as never[], tableReferencesComplete: result.length > 0 && result.every(t => t.references.length > 0 && t.diagnostics.length === 0) };
}
