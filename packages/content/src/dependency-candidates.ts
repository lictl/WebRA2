// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Literal/transitive research graph, not an effective rules compiler.
import { censusValue, ContentError, type IniDocument, type IniEntry } from './ini.ts';
import { compileCampaignGraph, copyGraphSource, summarizeCampaignGraph, validateGraphSource, type GraphDocument, type GraphSource } from './campaign-graph.ts';
import { DEPENDENCY_FIELDS, PREREQUISITE_GROUPS, type DependencyKind, type Requirement } from './dependency-schema.ts';
export interface DependencyDocument { profile: 'ra2' | 'yr'; role: GraphDocument['role'] | 'sound'; source: GraphSource; document: IniDocument }
export interface FileCandidate { rootFile: string; rootSha256: string; archivePath: string; archiveSha256: string; absoluteOffset: number; size: number; memberId: string; ordinal: number; hashKinds: ('classic' | 'crc32')[]; numericAliasEvidence?: string }
export interface AudioCandidate { index: GraphSource; bag: FileCandidate; ordinal: number; offset: number; size: number; sampleRate: number; flags: number; chunkSize: number }
export interface DependencyLocation { source: number; line: number }
export interface DependencyNode { id: number; kind: DependencyKind; at: DependencyLocation; filename?: string; candidates?: FileCandidate[]; audioCandidates?: AudioCandidate[] }
export interface DependencyEdge { from: number; to: number; field: string; requirement: Requirement; evidence: string; at: DependencyLocation }
export interface DependencyDiagnostic { code: string; at: DependencyLocation; node?: number; field?: string }
export const DEPENDENCY_LIMITS = Object.freeze({ documents: 40, entries: 500_000, text: 64 * 1024 * 1024, nodes: 25_000, edges: 100_000, diagnostics: 40_000, fileMatches: 80_000, tokens: 128 });
export type DependencyLimits = { [K in keyof typeof DEPENDENCY_LIMITS]: number };
const fold = (s: string) => censusValue(s).replace(/[A-Z]/g, c => c.toLowerCase());
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sourceKey = (s: GraphSource) => JSON.stringify(copyGraphSource(s));
const absent = (s: string) => /^(?:none|<none>|-1)?$/i.test(s);
const validSymbol = (s: string) => /^[a-z0-9_][a-z0-9_.-]{0,127}$/i.test(s);
const fail = (s: string): never => { throw new ContentError(s, 0, s); };
interface Section { name: string; at: DependencyLocation; rows: IniEntry[]; role: DependencyDocument['role'] }
export function compileDependencyCandidates(profile: 'ra2' | 'yr', inputs: DependencyDocument[], resolveFile: (filename: string) => readonly FileCandidate[], limits: DependencyLimits = DEPENDENCY_LIMITS, resolveAudio: (name: string) => readonly AudioCandidate[] = () => []) {
  for (const key of Object.keys(DEPENDENCY_LIMITS) as (keyof DependencyLimits)[]) if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > DEPENDENCY_LIMITS[key]) fail('dependency-limit-invalid');
  if (inputs.length > limits.documents) fail('dependency-document-limit');
  const docs = [...inputs].sort((a, b) => compare(sourceKey(a.source), sourceKey(b.source))), identities = new Set<string>();
  let entries = 0, text = 0;
  for (const doc of docs) {
    validateGraphSource(doc.source);
    if (doc.profile !== profile || !['mission', 'rules', 'ai', 'art', 'sound'].includes(doc.role)) fail('dependency-profile');
    const key = sourceKey(doc.source); if (identities.has(key)) fail('dependency-duplicate-source'); identities.add(key);
    entries += doc.document.entries.length + doc.document.sections.length;
    for (const row of doc.document.entries) text += row.section.length + row.key.length + row.value.length;
    if (entries > limits.entries || text > limits.text) fail('dependency-input-limit');
  }
  const structural = compileCampaignGraph(profile, docs.filter((d): d is GraphDocument => d.role !== 'sound'));
  const graphSource = new Map(docs.map((d, i) => [sourceKey(d.source), i]));
  const sections = new Map<string, Section[]>(), byLine = new Map<string, Section>();
  for (let source = 0; source < docs.length; source++) {
    const doc = docs[source]!, rows = new Map<string, IniEntry[]>();
    for (const row of doc.document.entries) { const k = `${fold(row.section)}:${row.sectionOccurrence}`, list = rows.get(k) ?? []; list.push(row); rows.set(k, list); }
    for (const sec of doc.document.sections) {
      const section: Section = { name: sec.name, at: { source, line: sec.line }, rows: rows.get(`${fold(sec.name)}:${sec.occurrence}`) ?? [], role: doc.role };
      const list = sections.get(fold(sec.name)) ?? []; list.push(section); sections.set(fold(sec.name), list); byLine.set(`${source}:${sec.line}`, section);
    }
  }
  const nodes: DependencyNode[] = [], edges: DependencyEdge[] = [], diagnostics: DependencyDiagnostic[] = [];
  const memo = new Map<string, number>(), queue: { node: number; section: Section }[] = [], seeds: number[] = [];
  let matchCount = 0;
  const rootAt = { source: docs.findIndex(d => d.role === 'mission'), line: 0 };
  function diagnostic(code: string, at: DependencyLocation, node?: number, field?: string) {
    if (diagnostics.length >= limits.diagnostics) fail('dependency-diagnostic-limit');
    diagnostics.push({ code, at, ...(node === undefined ? {} : { node }), ...(field === undefined ? {} : { field }) });
  }
  function node(kind: DependencyKind, at: DependencyLocation) {
    if (nodes.length >= limits.nodes) fail('dependency-node-limit');
    const id = nodes.length; nodes.push({ id, kind, at }); return id;
  }
  function edge(from: number, to: number, field: string, at: DependencyLocation, requirement: Requirement, evidence: string) {
    if (edges.length >= limits.edges) fail('dependency-edge-limit');
    edges.push({ from, to, field, requirement, evidence, at });
  }
  function sectionNode(kind: DependencyKind, section: Section): number {
    const key = `${kind}:${section.at.source}:${section.at.line}`;
    const found = memo.get(key); if (found !== undefined) return found;
    const id = node(kind, section.at); memo.set(key, id); queue.push({ node: id, section }); return id;
  }
  function eligible(kind: DependencyKind, s: Section) {
    if (kind === 'sound') return s.role === 'sound';
    if (['art', 'animation'].includes(kind)) return s.role === 'art';
    return s.role === 'rules' || s.role === 'mission';
  }
  function reference(from: number, kind: DependencyKind, name: string, field: string, at: DependencyLocation, requirement: Requirement, evidence: string) {
    const normalized = fold(name); if (absent(normalized)) return;
    if (!validSymbol(normalized)) { diagnostic('unsupported-reference-token', at, from, field); return; }
    if (kind === 'group') {
      const group = PREREQUISITE_GROUPS.get(normalized);
      if (!group) return reference(from, 'type', name, field, at, requirement, evidence);
      const general = (sections.get('general') ?? []).filter(s => s.role === 'mission' || s.role === 'rules');
      const rows = general.flatMap(s => s.rows.filter(r => fold(r.key) === group).map(r => ({ s, r })));
      if (!rows.length) diagnostic('prerequisite-group-unresolved', at, from, field);
      for (const { s, r } of rows) for (const token of tokens(r, s.at.source, true)) reference(from, 'type', token, `group-${group}`, { source: s.at.source, line: r.line }, 'conditional', 'yrpp-types');
      return;
    }
    const matches = (sections.get(normalized) ?? []).filter(s => eligible(kind, s));
    if (!matches.length) {
      const missing = node('missing', at); edge(from, missing, field, at, requirement, evidence); diagnostic('missing-section-candidate', at, from, field);
      if (['art', 'animation', 'voxel-animation'].includes(kind)) file(from, normalized, '.shp', `${field}-implicit-file-probe`, at, 'optional');
    } else {
      if (matches.length > 1) diagnostic('section-candidates-unranked', at, from, field);
      for (const match of matches) edge(from, sectionNode(kind, match), field, at, requirement, evidence);
    }
  }
  function tokens(row: IniEntry, source: number, list: boolean): string[] {
    const value = censusValue(row.value);
    if (absent(value)) return [];
    if (!list) { if (value.includes(',')) { diagnostic('unsupported-scalar-list', { source, line: row.line }); return []; } return [value]; }
    let count = 1; for (const c of value) if (c === ',' && ++count > limits.tokens) fail('dependency-token-limit');
    const values = value.split(',').map(s => s.trim());
    if (values.some(s => !s)) diagnostic('empty-list-operand', { source, line: row.line });
    return values;
  }
  function file(from: number, base: string, extension: string, field: string, at: DependencyLocation, requirement: Requirement) {
    const stem = fold(base); if (absent(stem)) return;
    if (!validSymbol(stem)) { diagnostic('unsupported-filename-operand', at, from, field); return; }
    const filename = stem.endsWith(extension) ? stem : stem + extension;
    const key = `file:${filename}`; let id = memo.get(key);
    if (id === undefined) {
      const matches = resolveFile(filename);
      if (matches.length > limits.fileMatches - matchCount) fail('dependency-file-match-limit'); matchCount += matches.length;
      id = node('file', at); memo.set(key, id);
      nodes[id]!.filename = filename;
      nodes[id]!.candidates = matches.map(copyFile).sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
      if (!matches.length) diagnostic('missing-file-candidate', at, id, field);
      else diagnostic('file-candidate-not-effective-or-payload-verified', at, id, field);
    }
    edge(from, id, field, at, requirement, 'ea-editor-file-convention');
  }
  function copyFile(m: FileCandidate): FileCandidate { return { rootFile: m.rootFile, rootSha256: m.rootSha256, archivePath: m.archivePath, archiveSha256: m.archiveSha256, absoluteOffset: m.absoluteOffset, size: m.size, memberId: m.memberId, ordinal: m.ordinal, hashKinds: [...m.hashKinds], ...(m.numericAliasEvidence ? { numericAliasEvidence: m.numericAliasEvidence } : {}) }; }
  function sample(from: number, name: string, at: DependencyLocation) {
    const normalized = fold(name).replace(/\.wav$/, '');
    if (!validSymbol(normalized)) { diagnostic('unsupported-audio-name', at, from); return; }
    const key = `sample:${normalized}`; let id = memo.get(key);
    if (id === undefined) {
      const matches = resolveAudio(normalized); if (matches.length > limits.fileMatches - matchCount) fail('dependency-file-match-limit'); matchCount += matches.length;
      id = node('audio-sample', at); memo.set(key, id); nodes[id]!.filename = `${normalized}.wav`;
      nodes[id]!.audioCandidates = matches.map(m => ({ index: copyGraphSource(m.index), bag: copyFile(m.bag), ordinal: m.ordinal, offset: m.offset, size: m.size, sampleRate: m.sampleRate, flags: m.flags, chunkSize: m.chunkSize }));
      diagnostic(matches.length ? 'audio-index-bag-pairing-unverified' : 'audio-sample-not-in-supplied-index', at, id);
    }
    edge(from, id, 'sounds-index-candidate', at, 'conditional', 'xcc-audio-index-and-local-sound-table');
  }
  for (const id of structural.reachable) {
    const item = structural.nodes[id]!; if (item.kind !== 'type' && item.kind !== 'art') continue;
    const source = graphSource.get(sourceKey(structural.sources[item.at.source]!.identity))!;
    const section = byLine.get(`${source}:${item.at.line}`); if (!section) fail('dependency-seed-location');
    seeds.push(sectionNode(item.kind, section!));
  }
  if (seeds.length) {
    const mission = docs[rootAt.source]!;
    const theaters = new Map([['temperate', ['tem', 'temperat']], ['snow', ['sno', 'snow']], ['urban', ['urb', 'urban']], ['newurban', ['ubn', 'urbann']], ['desert', ['des', 'desert']], ['lunar', ['lun', 'lunar']]]);
    for (const row of mission.document.entries) {
      const at = { source: rootAt.source, line: row.line };
      if (fold(row.section) === 'map' && fold(row.key) === 'theater') {
        const theater = theaters.get(fold(row.value));
        if (!theater) diagnostic('unsupported-theater-name', at);
        else for (const base of [`unit${theater[0]}`, `iso${theater[0]}`, theater[1]!]) file(seeds[0]!, base, '.pal', 'map-theater-palette-candidate', at, 'conditional');
      }
      if (fold(row.section) === 'basic' && /^(intro|brief|win|lose|action|postscore|premapselect)$/.test(fold(row.key))) {
        for (const extension of ['.bik', '.vqa']) file(seeds[0]!, row.value, extension, 'cinematic-direct-name-probe', at, 'optional');
      }
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const item = queue[cursor]!, n = nodes[item.node]!, s = item.section;
    const atRow = (r: IniEntry) => ({ source: s.at.source, line: r.line });
    const images = s.rows.filter(r => fold(r.key) === 'image');
    if (n.kind === 'type' || n.kind === 'projectile' || n.kind === 'particle') {
      if (images.length) for (const r of images) reference(n.id, 'art', r.value, 'explicit-image', atRow(r), 'required', 'ea-editor');
      else { reference(n.id, 'art', s.name, 'implicit-image', s.at, 'conditional', 'ea-editor'); diagnostic('implicit-image-may-be-inherited', s.at, n.id); }
    }
    if (['art', 'animation', 'voxel-animation'].includes(n.kind)) {
      const values = images.length ? images.map(r => ({ value: r.value, at: atRow(r) })) : [{ value: s.name, at: s.at }];
      const voxels = s.rows.filter(r => fold(r.key) === 'voxel').map(r => fold(r.value));
      const hasVoxel = n.kind === 'voxel-animation' || voxels.some(v => /^(yes|true|1)$/.test(v));
      const isTheater = s.rows.some(r => ['theater', 'newtheater'].includes(fold(r.key)) && /^(yes|true|1)$/.test(fold(r.value)));
      for (const { value, at } of values) {
        file(n.id, value, hasVoxel ? '.vxl' : '.shp', 'image-file', at, n.kind === 'voxel-animation' ? 'optional' : 'required');
        if (hasVoxel) {
          file(n.id, value, '.hva', 'voxel-transform-file', at, n.kind === 'voxel-animation' ? 'optional' : 'required');
          for (const part of ['tur', 'barl']) for (const extension of ['.vxl', '.hva']) file(n.id, value + part, extension, 'voxel-attachment-probe', at, 'optional');
        }
        if (isTheater && fold(value).length > 1) {
          diagnostic('theater-fallback-order-unverified', at, n.id);
          for (const theater of ['a', 't', 'u', 'd', 'l', 'n']) file(n.id, fold(value)[0]! + theater + fold(value).slice(2), '.shp', 'theater-image-probe', at, 'optional');
        }
      }
    }
    for (const row of s.rows) {
      const key = fold(row.key), at = atRow(row);
      if (row.keyOccurrence > 0) diagnostic('duplicate-field-preserved', at, n.id);
      for (const schema of DEPENDENCY_FIELDS) if (schema.owners.includes(n.kind) && schema.pattern.test(key)) {
        for (const value of tokens(row, s.at.source, schema.list)) reference(n.id, schema.target, value, key, at, schema.requirement, schema.evidence);
      }
      if (n.kind === 'art' && /^(cameo|altcameo|buildup)$/.test(key)) file(n.id, row.value, '.shp', key, at, key === 'altcameo' ? 'optional' : 'conditional');
      if (n.kind === 'art' && key === 'bibshape') file(n.id, row.value, '.shp', key, at, 'conditional');
      if (['art', 'animation'].includes(n.kind) && key === 'palette') file(n.id, row.value, '.pal', 'explicit-palette', at, 'conditional');
      if (n.kind === 'sound' && key === 'sounds') {
        const raw = censusValue(row.value); let count = 0;
        let inToken = false, tokenCount = 0;
        for (const character of raw) { if (/[\s,]/.test(character)) inToken = false; else if (!inToken) { inToken = true; if (++tokenCount > limits.tokens) fail('dependency-token-limit'); } }
        const values = raw.split(/[\s,]+/); if (values.length > limits.tokens) fail('dependency-token-limit');
        for (const value of values) if (value) { const name = value.replace(/^\$/, ''); if (value !== name) diagnostic('audio-token-prefix-unverified', at, n.id); file(n.id, name, '.wav', 'sound-loose-wave-candidate', at, 'optional'); sample(n.id, name, at); count++; }
        if (!count) diagnostic('empty-sound-sample-list', at, n.id, 'sounds');
      }
      if ((n.kind === 'animation' && key === 'spawnsparticle') || (n.kind === 'projectile' && key === 'airburstspread') || (n.kind === 'voxel-animation' && key === 'voxelindex')) {
        diagnostic('numeric-operand-semantics-unsupported', at, n.id, key);
        edge(n.id, node('missing', at), key, at, 'unsupported', 'numeric-selector-not-recovered');
      }
    }
  }
  const adjacency = nodes.map(() => [] as number[]); for (const e of edges) adjacency[e.from]!.push(e.to);
  const colors = new Uint8Array(nodes.length), backEdges: { from: number; to: number }[] = [];
  for (const start of seeds) if (!colors[start]) {
    colors[start] = 1; const stack = [{ id: start, next: 0 }];
    while (stack.length) { const top = stack[stack.length - 1]!, target = adjacency[top.id]![top.next++]; if (target === undefined) { colors[top.id] = 2; stack.pop(); } else if (colors[target] === 1) backEdges.push({ from: top.id, to: target }); else if (!colors[target]) { colors[target] = 1; stack.push({ id: target, next: 0 }); } }
  }
  return { profile, sources: docs.map(d => ({ role: d.role, identity: copyGraphSource(d.source) })), seeds, nodes, edges, diagnostics, cycleBackEdges: backEdges,
    structuralSeedEvidence: summarizeCampaignGraph(structural), requirementsMeaning: 'edge-local research classification; activation and native failure behavior unverified',
    unsupportedCapabilities: ['effective-layer-selection', 'opcode-operand-binding', 'packed-map-terrain-and-overlay-types', 'runtime-generated-objects', 'implicit-rule-defaults', 'cinematic-name-to-stream-selection', 'audio-bag-pairing-and-codecs', 'palette-and-theater-defaults'].map(capability => ({ capability, requirement: 'unsupported' as const })),
    candidateTraversalComplete: diagnostics.every(d => !d.code.startsWith('unsupported') && !d.code.startsWith('missing')), nativeDependencyClosureComplete: false, rootAt };
}
