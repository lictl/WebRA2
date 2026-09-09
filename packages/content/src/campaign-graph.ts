// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Editor field evidence: docs/analysis/campaign-graph.md.
import { censusValue, ContentError, type IniDocument, type IniEntry } from './ini.ts';
import { censusMission } from './mission-census.ts';

export interface GraphSource { rootFile: string; rootSha256: string; absoluteOffset: number; size: number; sha256: string }
export type GraphRole = 'mission' | 'rules' | 'ai' | 'art';
export interface GraphDocument { profile: 'ra2' | 'yr'; role: GraphRole; source: GraphSource; document: IniDocument }
export const GRAPH_LIMITS = Object.freeze({ documents: 32, entries: 400_000, codeUnits: 64 * 1024 * 1024, nodes: 30_000, edges: 150_000, diagnostics: 50_000, tokens: 256 });
export type GraphLimits = { readonly [Key in keyof typeof GRAPH_LIMITS]: number };
export type NodeKind = 'mission' | 'house' | 'country' | 'team' | 'taskforce' | 'script' | 'type' | 'art' | 'trigger' | 'tag' | 'event-row' | 'action-row' | 'placement' | 'ai-trigger' | 'media' | 'missing';
export interface GraphLocation { source: number; line: number }
export interface GraphNode { id: number; kind: NodeKind; at: GraphLocation }
export interface GraphEdge { from: number; to: number; relation: string; at: GraphLocation }
export interface GraphDiagnostic { code: string; at: GraphLocation; node?: number; relation?: string }
export interface CampaignGraph {
  profile: 'ra2' | 'yr'; sources: { role: GraphRole; identity: GraphSource }[];
  nodes: GraphNode[]; edges: GraphEdge[]; diagnostics: GraphDiagnostic[];
  reachable: number[]; cycles: number[][];
  capabilities: string[]; structuralClosureComplete: boolean; behaviorClosureComplete: false;
  effectivePrecedence: 'unresolved';
}
const lists: Record<string, NodeKind> = {
  houses: 'house', countries: 'country', teamtypes: 'team', taskforces: 'taskforce', scripttypes: 'script',
  infantrytypes: 'type', vehicletypes: 'type', aircrafttypes: 'type', buildingtypes: 'type',
};
const rowKinds: Record<string, NodeKind> = { triggers: 'trigger', tags: 'tag', events: 'event-row', actions: 'action-row', aitriggertypes: 'ai-trigger' };
const placementTag: Record<string, number> = { infantry: 8, units: 7, aircraft: 7, structures: 6 };
const mediaFields = new Set(['intro', 'brief', 'win', 'lose', 'action', 'postscore', 'premapselect']);
const asciiFold = (value: string) => value.replace(/[A-Z]/g, c => c.toLowerCase());
const symbol = (value: string) => asciiFold(censusValue(value));
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const absent = (value: string) => /^(?:<none>|none|-1)?$/i.test(value);
const keyFor = (kind: NodeKind, value: string) => `${kind}:${symbol(value)}`;
const ownValue = <T>(table: Record<string, T>, key: string): T | undefined => Object.hasOwn(table, key) ? table[key] : undefined;
function fail(code: string): never { throw new ContentError(code, 0, code); }
function sourceKey(s: GraphSource): string { return JSON.stringify([s.rootFile, s.rootSha256, s.absoluteOffset, s.size, s.sha256]); }
export function validateGraphSource(s: GraphSource): void {
  if (!s.rootFile || s.rootFile.length > 255 || /[/\\:\x00-\x1f\x7f]/.test(s.rootFile) || s.rootFile === '.' || s.rootFile === '..' || !/^[a-f0-9]{64}$/.test(s.rootSha256) || !/^[a-f0-9]{64}$/.test(s.sha256)) fail('graph-source-identity');
  if (![s.absoluteOffset, s.size, s.absoluteOffset + s.size].every(n => Number.isSafeInteger(n) && n >= 0 && !Object.is(n, -0))) fail('graph-source-range');
}
export function copyGraphSource(s: GraphSource): GraphSource { return { rootFile: s.rootFile, rootSha256: s.rootSha256, absoluteOffset: s.absoluteOffset, size: s.size, sha256: s.sha256 }; }

/** Pure structural over-approximation. Input hashes are attestations; only the Node adapter verifies bytes. */
export function compileCampaignGraph(profile: 'ra2' | 'yr', input: GraphDocument[], limits: GraphLimits = GRAPH_LIMITS): CampaignGraph {
  for (const key of Object.keys(GRAPH_LIMITS) as (keyof GraphLimits)[]) if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > GRAPH_LIMITS[key]) fail('graph-invalid-limit');
  if (!['ra2', 'yr'].includes(profile) || input.length > limits.documents) fail('graph-input-limit');
  let entryCount = 0, codeUnits = 0;
  const physical = new Map<string, string>();
  for (const doc of input) {
    validateGraphSource(doc.source);
    if (doc.profile !== profile || !['mission', 'rules', 'ai', 'art'].includes(doc.role)) fail('graph-profile-or-role');
    entryCount += doc.document.entries.length + doc.document.sections.length;
    if (entryCount > limits.entries) fail('graph-entry-limit');
    for (const row of doc.document.entries) codeUnits += row.section.length + row.key.length + row.value.length;
    if (codeUnits > limits.codeUnits) fail('graph-text-limit');
    const range = JSON.stringify([doc.source.rootFile, doc.source.absoluteOffset, doc.source.size]);
    const identity = sourceKey(doc.source);
    if (physical.has(range)) fail(physical.get(range) === identity ? 'graph-duplicate-source' : 'graph-conflicting-source');
    physical.set(range, identity);
  }
  if (input.filter(d => d.role === 'mission').length !== 1) fail('graph-requires-one-mission');
  const docs = [...input].sort((a, b) => compare(sourceKey(a.source), sourceKey(b.source)));
  const nodes: GraphNode[] = [], edges: GraphEdge[] = [], diagnostics: GraphDiagnostic[] = [];
  const index = new Map<string, number[]>(), declared = new Map<string, Set<NodeKind>>();
  const rowsBySection = docs.map(d => {
    const result = new Map<string, IniEntry[]>();
    for (const row of d.document.entries) {
      const key = `${symbol(row.section)}:${row.sectionOccurrence}`;
      const entries = result.get(key) ?? []; entries.push(row); result.set(key, entries);
    }
    return result;
  });
  const nodeRows = new Map<number, IniEntry[]>();
  const location = (source: number, line: number): GraphLocation => ({ source, line });
  function diagnostic(code: string, at: GraphLocation, node?: number, relation?: string): void {
    if (diagnostics.length >= limits.diagnostics) fail('graph-diagnostic-limit');
    diagnostics.push({ code, at, ...(node === undefined ? {} : { node }), ...(relation === undefined ? {} : { relation }) });
  }
  function node(kind: NodeKind, at: GraphLocation, name?: string): number {
    if (nodes.length >= limits.nodes) fail('graph-node-limit');
    const id = nodes.length; nodes.push({ id, kind, at });
    if (name !== undefined) { const key = keyFor(kind, name); const found = index.get(key) ?? []; found.push(id); index.set(key, found); }
    return id;
  }
  function edge(from: number, to: number, relation: string, at: GraphLocation): void {
    if (edges.length >= limits.edges) fail('graph-edge-limit');
    edges.push({ from, to, relation, at });
  }
  function reference(from: number, kind: NodeKind, name: string, relation: string, at: GraphLocation, optional = false): void {
    const value = censusValue(name);
    if (absent(value)) {
      if (!optional) diagnostic('required-reference-empty', at, from, relation);
      return;
    }
    const matches = index.get(keyFor(kind, value)) ?? [];
    if (!matches.length) {
      const missing = node('missing', at); edge(from, missing, relation, at); diagnostic('missing-reference', at, from, relation);
    } else {
      if (matches.length > 1) diagnostic('multiple-candidate-definitions', at, from, relation);
      for (const target of matches) edge(from, target, relation, at);
    }
  }
  function houseSelector(from: number, name: string, relation: string, at: GraphLocation): void {
    if (absent(censusValue(name))) { diagnostic('house-selector-sentinel-unresolved', at, from, relation); return; }
    const countries = index.get(keyFor('country', name)) ?? [];
    if (countries.length) {
      diagnostic('country-house-selector-unresolved', at, from, relation);
      reference(from, 'country', name, `${relation}-country-selector`, at);
    }
    // Keep both namespaces when both exist; the editor's country selector is not a native binding algorithm.
    if (!countries.length || index.has(keyFor('house', name))) reference(from, 'house', name, relation, at);
  }
  function tokens(row: IniEntry, source: number, minimum: number, exact?: number): string[] | undefined {
    const value = censusValue(row.value);
    // Count before split so malformed wide rows cannot allocate unbounded token arrays.
    let count = 1; for (const c of value) if (c === ',' && ++count > limits.tokens) { diagnostic('reference-token-limit', location(source, row.line)); return; }
    const result = value.split(',').map(v => v.trim());
    if (result.length < minimum || (exact !== undefined && result.length !== exact)) { diagnostic('unsupported-reference-framing', location(source, row.line)); return; }
    return result;
  }
  for (const doc of docs) for (const row of doc.document.entries) {
    const kind = ownValue(lists, symbol(row.section));
    if (kind) { const name = symbol(row.value); const kinds = declared.get(name) ?? new Set<NodeKind>(); kinds.add(kind); declared.set(name, kinds); }
  }
  const missionIndex = docs.findIndex(d => d.role === 'mission');
  const root = node('mission', location(missionIndex, 0));
  for (let d = 0; d < docs.length; d++) {
    const doc = docs[d]!;
    for (const issue of doc.document.diagnostics) diagnostic('ini-diagnostic', location(d, issue.line));
    for (const section of doc.document.sections) {
      const kinds = doc.role === 'art' ? new Set<NodeKind>(['art']) : declared.get(symbol(section.name));
      if (kinds && !ownValue(lists, symbol(section.name))) for (const kind of kinds) {
        const id = node(kind, location(d, section.line), section.name);
        nodeRows.set(id, rowsBySection[d]!.get(`${symbol(section.name)}:${section.occurrence}`) ?? []);
        if (section.occurrence > 0) diagnostic('duplicate-section', location(d, section.line), id);
      }
    }
    for (const row of doc.document.entries) {
      const section = symbol(row.section), kind = ownValue(rowKinds, section);
      if (kind && doc.role !== 'art') { const id = node(kind, location(d, row.line), row.key); nodeRows.set(id, [row]); if (doc.role === 'mission') edge(root, id, 'declares-row', location(d, row.line)); }
      if (Object.hasOwn(placementTag, section) && doc.role === 'mission') { const id = node('placement', location(d, row.line)); nodeRows.set(id, [row]); edge(root, id, 'places-object', location(d, row.line)); }
      if (row.keyOccurrence > 0) diagnostic('duplicate-key', location(d, row.line));
    }
  }
  // All literal declarations in the mission are potential dependencies, even if runtime never activates them.
  for (const row of docs[missionIndex]!.document.entries) {
    const kind = ownValue(lists, symbol(row.section)), at = location(missionIndex, row.line);
    if (kind) reference(root, kind, row.value, `declares-${kind}`, at);
    if (symbol(row.section) === 'basic' && symbol(row.key) === 'player') reference(root, 'house', row.value, 'player-house', at);
    if (symbol(row.section) === 'basic' && mediaFields.has(symbol(row.key)) && !absent(censusValue(row.value))) {
      const id = node('media', at); edge(root, id, `cinematic-${symbol(row.key)}`, at); diagnostic('media-identifier-unresolved', at, id);
    }
    if (symbol(row.section) === 'basic' && ['nextscenario', 'altnextscenario'].includes(symbol(row.key))) diagnostic('legacy-progression-field-not-followed', at, root);
  }
  // Snapshot because missing-reference nodes are appended during resolution.
  for (const [id, rows] of nodeRows) {
    const n = nodes[id]!, source = n.at.source;
    for (const row of rows) {
      const key = symbol(row.key), at = location(source, row.line);
      const fields: Partial<Record<NodeKind, Record<string, NodeKind>>> = {
        team: { house: 'house', taskforce: 'taskforce', script: 'script', tag: 'tag' },
        house: { country: 'country', allies: 'house' }, country: { parentcountry: 'country' }, type: { image: 'art' },
      };
      const fieldTable = fields[n.kind];
      const targetKind = fieldTable ? ownValue(fieldTable, key) : undefined;
      if (targetKind) {
        const values = key === 'allies' ? tokens(row, source, 1) : [censusValue(row.value)];
        for (const value of values ?? []) {
          if (n.kind === 'team' && key === 'house') houseSelector(id, value, 'team-house', at);
          else reference(id, targetKind, value, `${n.kind}-${key}`, at, key === 'tag');
        }
      }
      if (n.kind === 'type' && ['primary', 'secondary', 'eliteprimary', 'elitesecondary', 'deploysinto', 'undeploysinto', 'powersupbuilding', 'prerequisite', 'voiceselect', 'voicemove', 'voiceattack', 'debrisanims', 'explosion'].includes(key)) diagnostic('rule-reference-field-untraced', at, id, `type-${key}`);
      if (n.kind === 'taskforce' && /^\d+$/.test(key)) {
        const parts = tokens(row, source, 2, 2);
        if (parts && /^\d+$/.test(parts[0]!)) reference(id, 'type', parts[1]!, 'taskforce-type', at);
        else if (parts) diagnostic('invalid-taskforce-count', at, id);
      }
      if (n.kind === 'placement') {
        const tag = placementTag[symbol(row.section)]!, parts = tokens(row, source, tag + 1);
        if (parts) { reference(id, 'house', parts[0]!, 'placement-house', at); reference(id, 'type', parts[1]!, 'placement-type', at); reference(id, 'tag', parts[tag]!, 'placement-tag', at, true); }
      }
      if (n.kind === 'trigger') {
        const parts = tokens(row, source, 7);
        if (parts) { houseSelector(id, parts[0]!, 'trigger-house', at); reference(id, 'trigger', parts[1]!, 'attached-trigger', at, true); }
        reference(id, 'event-row', row.key, 'trigger-events', at); reference(id, 'action-row', row.key, 'trigger-actions', at);
      }
      if (n.kind === 'tag') { const parts = tokens(row, source, 3, 3); if (parts) reference(id, 'trigger', parts[2]!, 'tag-trigger', at); }
      if (n.kind === 'ai-trigger') {
        const parts = tokens(row, source, 18, 18);
        if (parts) {
          reference(id, 'team', parts[1]!, 'ai-primary-team', at, true); reference(id, 'team', parts[14]!, 'ai-secondary-team', at, true);
          // The editor stores an all-houses selector here; it is not a missing house definition.
          if (parts[2]!.toLowerCase() !== '<all>') houseSelector(id, parts[2]!, 'ai-owner', at);
          reference(id, 'type', parts[5]!, 'ai-condition-type', at, true);
        }
      }
    }
  }
  const census = censusMission(docs[missionIndex]!.document);
  for (const issue of census.diagnostics) diagnostic('opcode-framing-incomplete', location(missionIndex, issue.line));
  if (!census.isMapCandidate) diagnostic('missing-mission-structure', location(missionIndex, 0));
  const capabilities = ['effective-content-precedence', 'country-to-house-selector-binding', 'rules:weapon-to-projectile-and-warhead', 'rules:weapon-selection-and-elite-variants', 'rules:prerequisite-and-object-transformations', 'rules:audio-and-animation-references', 'art:implicit-image-and-theater-resolution', 'map-pack-dependencies', 'campaign-progression', 'media-file-resolution', 'ai-activation-semantics',
    ...census.eventOpcodes.map(o => `event:${o.id}`), ...census.actionOpcodes.map(o => `action:${o.id}`), ...census.scriptOpcodes.map(o => `script:${o.id}`)];
  const adjacency = nodes.map(() => [] as number[]), reverse = nodes.map(() => [] as number[]);
  for (const e of edges) { adjacency[e.from]!.push(e.to); reverse[e.to]!.push(e.from); }
  const reachable = new Set<number>([root]), queue = [root];
  for (let i = 0; i < queue.length; i++) for (const target of adjacency[queue[i]!]!) if (!reachable.has(target)) { reachable.add(target); queue.push(target); }
  // Iterative Kosaraju: bounded linear traversal even for deep mod graphs; no recursive JS stack.
  const seen = new Set<number>(), finish: number[] = [];
  for (const start of nodes.map(n => n.id)) if (!seen.has(start)) {
    seen.add(start); const stack: { id: number; next: number }[] = [{ id: start, next: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1]!, target = adjacency[top.id]![top.next++];
      if (target === undefined) { finish.push(top.id); stack.pop(); }
      else if (!seen.has(target)) { seen.add(target); stack.push({ id: target, next: 0 }); }
    }
  }
  seen.clear(); const cycles: number[][] = [];
  for (const start of finish.reverse()) if (!seen.has(start)) {
    const group: number[] = [], stack = [start]; seen.add(start);
    while (stack.length) { const id = stack.pop()!; group.push(id); for (const target of reverse[id]!) if (!seen.has(target)) { seen.add(target); stack.push(target); } }
    if (group.length > 1 || adjacency[start]!.includes(start)) cycles.push(group.sort((a, b) => a - b));
  }
  for (const group of cycles) diagnostic('structural-cycle-not-runtime-error', nodes[group[0]!]!.at, group[0]);
  return { profile, sources: docs.map(d => ({ role: d.role, identity: copyGraphSource(d.source) })), nodes, edges, diagnostics, reachable: [...reachable].sort((a, b) => a - b), cycles,
    capabilities: capabilities.sort(compare), structuralClosureComplete: false, behaviorClosureComplete: false, effectivePrecedence: 'unresolved' };
}

/** Compact publication form: no original symbols, field values, names or strings. */
export function summarizeCampaignGraph(graph: CampaignGraph) {
  function counts(values: string[]) { const result: Record<string, number> = Object.create(null) as Record<string, number>; for (const value of values.sort(compare)) result[value] = (result[value] ?? 0) + 1; return result; }
  const reachable = new Set(graph.reachable);
  return { profile: graph.profile, sources: graph.sources, nodes: graph.nodes.length, edges: graph.edges.length,
    nodeKinds: counts(graph.nodes.map(n => n.kind)), reachableNodeKinds: counts(graph.nodes.filter(n => reachable.has(n.id)).map(n => n.kind)),
    edgeRelations: counts(graph.edges.map(e => e.relation)), reachableEdgeRelations: counts(graph.edges.filter(e => reachable.has(e.from)).map(e => e.relation)),
    diagnostics: counts(graph.diagnostics.map(d => d.code)), diagnosticRelations: counts(graph.diagnostics.filter(d => d.relation).map(d => `${d.code}:${d.relation}`)),
    reachableDiagnostics: counts(graph.diagnostics.filter(d => d.node !== undefined && reachable.has(d.node)).map(d => d.code)),
    unresolvedReferenceLocations: graph.diagnostics.filter(d => d.code === 'missing-reference' || d.code === 'media-identifier-unresolved' || d.code === 'legacy-progression-field-not-followed').map(d => ({ code: d.code, at: d.at, ...(d.relation ? { relation: d.relation } : {}) })),
    cycles: graph.cycles.map(ids => ({ nodeCount: ids.length, reachable: ids.some(id => reachable.has(id)), kinds: counts(ids.map(id => graph.nodes[id]!.kind)) })),
    capabilities: graph.capabilities, structuralClosureComplete: graph.structuralClosureComplete, behaviorClosureComplete: graph.behaviorClosureComplete, effectivePrecedence: graph.effectivePrecedence };
}
