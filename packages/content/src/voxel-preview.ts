// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Owned verified voxel resources; see ../VOXEL_RESOURCES_PROVENANCE.md.
import type { BrowserAssetCandidate, BrowserCatalog } from '../../vfs/src/browser-catalog.ts';
import { BROWSER_CATALOG_POLICY } from '../../vfs/src/browser-catalog.ts';
import { BROWSER_IMPORT_LIMITS } from '../../vfs/src/browser-import.ts';
import type { BrowserMemberIdentity } from '../../vfs/src/browser-verified.ts';
import { hashByteSource } from '../../vfs/src/hash-source.ts';
import { throwIfImportAborted } from '../../vfs/src/browser-source.ts';
import { yieldBrowserTask } from '../../vfs/src/browser-yield.ts';
import { createRuntimeVxl, RUNTIME_VXL_LIMITS } from '../../formats/src/runtime-vxl.ts';
import { createRuntimeHva, RUNTIME_HVA_LIMITS } from '../../formats/src/runtime-hva.ts';
import { decodeShpPalette } from '../../formats/src/shp-ts.ts';
import { createVoxelAtlas, VOXEL_TRANSFORM_POLICY, type VoxelAtlas, type VoxelAssetInput, type VoxelPartInput } from '../../render/src/voxel-render.ts';
import { isVoxelPlan, type VoxelPlan } from './voxel-plan.ts';
import { fail, plain, data, text as string, natural, dense, limits, compare, fingerprint, freeze } from './voxel-content-utils.ts';
export const VOXEL_PREVIEW_POLICY = 'webra2-voxel-resources-1' as const;
export const VOXEL_PREVIEW_LIMITS = Object.freeze({ references: 1024, candidates: 2048, assets: 256, parts: 256,
  sourceBytes: 128 * 1024 ** 2, rootBytes: 1024 ** 3, sections: 2048, columns: 1048576,
  runs: 4194304, voxels: 1048576, matrices: 65536 });
type Limits = { -readonly [K in keyof typeof VOXEL_PREVIEW_LIMITS]: number };
export type VoxelResourceStatus = 'ready' | 'missing' | 'blocked' | 'conflict' | 'unsupported-mount' | 'name-collision';
export interface VoxelPreviewResource { readonly id: string; readonly path: string; readonly status: VoxelResourceStatus;
  readonly candidates: readonly Readonly<{ candidate: BrowserAssetCandidate; priority: number | null; mounted: boolean; source: BrowserMemberIdentity | null }>[];
  readonly selected: readonly string[] }
export interface VoxelPreviewBinding { readonly requestId: string; readonly status: VoxelResourceStatus | 'incompatible-pair' | 'unsupported-model' | 'absent-optional';
  readonly reasons: readonly string[]; readonly partIds: readonly string[] }
export interface VoxelPreview {
  readonly policy: typeof VOXEL_PREVIEW_POLICY; readonly plan: VoxelPlan; readonly atlas: VoxelAtlas;
  readonly resources: readonly VoxelPreviewResource[];
  readonly assets: readonly Readonly<{ id: string; path: string; sha256: string; source: BrowserMemberIdentity; bytes: Uint8Array }>[];
  readonly palettes: readonly Readonly<{ id: string; path: string; source: BrowserMemberIdentity; rgba: Uint8Array; remap: null; transparentIndex: 0 }>[];
  readonly types: readonly Readonly<{ id: string; status: 'ready' | 'unsupported'; reasons: readonly string[];
    paletteId: string | null; bindings: readonly VoxelPreviewBinding[]; stillPartIds: readonly string[] }>[];
  readonly allocations: Readonly<{ verifiedSourceBytes: number; selectedSourceBytes: number; sections: number; columns: number; runs: number; voxels: number; matrices: number }>;
  /** Session/audit identity includes catalog handles/candidate IDs; never a durable gameplay/save identity. */
  readonly fingerprint: string; readonly canStartCampaign: false; readonly nativeBehaviorVerified: false;
}
export interface VoxelPreviewProgress { readonly phase: 'verify' | 'decode'; readonly completed: number; readonly total: number; readonly path: string }
const prepared = new WeakSet<object>();
export function isVoxelPreview(value: unknown): value is VoxelPreview { return !!value && typeof value === 'object' && prepared.has(value); }
function rootIdentity(value: unknown): BrowserMemberIdentity['root'] {
  const sourceId = string(data(value, 'sourceId'), 128), size = natural(data(value, 'size')), sha256 = string(data(value, 'sha256'), 64);
  if (!/^[a-f0-9]{64}$/.test(sha256)) fail('root-identity');
  return Object.freeze({ sourceId, size, sha256 });
}
function memberIdentity(value: unknown): BrowserMemberIdentity {
  const root = rootIdentity(data(value, 'root')), absoluteOffset = natural(data(value, 'absoluteOffset')), size = natural(data(value, 'size')), sha256 = string(data(value, 'sha256'), 64);
  if (absoluteOffset > root.size || size > root.size - absoluteOffset || !/^[a-f0-9]{64}$/.test(sha256)) fail('source-identity');
  return Object.freeze({ root, absoluteOffset, size, sha256 });
}
function candidateSnapshot(value: unknown): BrowserAssetCandidate {
  const id = string(data(value, 'id')), sourceId = string(data(value, 'sourceId'), 128), rootPath = string(data(value, 'rootPath'));
  const archive = data(value, 'archiveId'), ordinalValue = data(value, 'ordinal'), archiveId = archive === null ? null : string(archive), ordinal = ordinalValue === null ? null : natural(ordinalValue);
  const absoluteOffset = natural(data(value, 'absoluteOffset')), size = natural(data(value, 'size')), kind = data(value, 'kind'), allowed = data(value, 'allowed'), ambiguousName = data(value, 'ambiguousName');
  if ((kind !== 'literal' && kind !== 'hash-candidate') || typeof allowed !== 'boolean' || typeof ambiguousName !== 'boolean') fail('metadata');
  const knownNames = dense(data(value, 'knownNames'), BROWSER_IMPORT_LIMITS.namesPerMember).map(name => string(name));
  return Object.freeze({ id, sourceId, rootPath, archiveId, ordinal, absoluteOffset, size, kind, allowed, ambiguousName, knownNames: Object.freeze(knownNames) });
}
const active = new WeakSet<BrowserCatalog>();
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const sizeOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
type Archive = Readonly<{ id: string; sourceId: string; parentId: string | null; absoluteOffset: number; size: number; names: readonly string[]; allowed: boolean }>;
/** Limited ordinary bootstrap mount tree; a chosen container shadows its complete lower-priority counterpart. */
function mountResolver(catalog: BrowserCatalog, roots: Map<string, Readonly<{ id: string; path: string; size: number }>>, profile: 'ra2' | 'yr') {
  const archives = new Map<string, Archive>();
  for (const value of dense(catalog.report.archives, BROWSER_IMPORT_LIMITS.archives)) {
    const id = string(data(value, 'id')), sourceId = string(data(value, 'sourceId'), 128), parent = data(value, 'parentId');
    const parentId = parent === null ? null : string(parent), absoluteOffset = natural(data(value, 'absoluteOffset')), size = natural(data(value, 'size'));
    const names = Object.freeze(dense(data(value, 'nameCandidates'), BROWSER_IMPORT_LIMITS.namesPerMember).map(n => string(n)));
    const allowed = data(value, 'allowed'), root = roots.get(sourceId);
    if (typeof allowed !== 'boolean' || archives.has(id) || !root || absoluteOffset > root.size || size > root.size - absoluteOffset) fail('archive-identity');
    archives.set(id, Object.freeze({ id, sourceId, parentId, absoluteOffset, size, names, allowed }));
  }
  for (const a of archives.values()) if (a.parentId !== null) {
    const parent = archives.get(a.parentId);
    if (!parent || parent.sourceId !== a.sourceId || a.absoluteOffset <= parent.absoluteOffset || a.absoluteOffset + a.size > parent.absoluteOffset + parent.size) fail('archive-ancestry');
  } else if (a.absoluteOffset !== 0 || a.size !== roots.get(a.sourceId)!.size) fail('archive-root');
  const rootRank = (path: string): number | null => {
    const expansion = (profile === 'yr' ? /^expandmd(\d{2})\.mix$/ : /^expand(\d{2})\.mix$/).exec(path);
    if (expansion) return 200 + Number(expansion[1]);
    return path === 'ra2md.mix' && profile === 'yr' ? 190 : path === 'ra2.mix' ? 180 : null;
  };
  const containers = profile === 'yr' ? ['cachemd.mix', 'cache.mix', 'localmd.mix', 'local.mix'] : ['cache.mix', 'local.mix'];
  const chosen = new Map<string, Set<string>>(), uncertain = new Set<string>();
  for (const name of containers) {
    const contenders: { archive: Archive; rank: number | null }[] = [];
    for (const a of archives.values()) {
      const path = roots.get(a.sourceId)!.path;
      if (a.parentId === null && path === name) contenders.push({ archive: a, rank: 1000 });
      else if (a.names.includes(name)) {
        const parent = a.parentId === null ? null : archives.get(a.parentId)!;
        contenders.push({ archive: a, rank: a.names.length !== 1 || !parent || parent.parentId !== null ? null : rootRank(path) });
      }
    }
    if (contenders.some(c => c.rank === null || !c.archive.allowed)) uncertain.add(name);
    const highest = Math.max(-1, ...contenders.map(c => c.rank ?? -1));
    const top = contenders.filter(c => c.rank === highest);
    if (top.length > 1) uncertain.add(name); // Container payload equality is not inferred from equal paths/ranges.
    chosen.set(name, new Set(top.map(c => c.archive.id)));
  }
  return (candidate: BrowserAssetCandidate): { priority: number | null; mounted: boolean } => {
    if (candidate.kind === 'literal') {
      if (candidate.archiveId !== null || candidate.ordinal !== null || candidate.absoluteOffset !== 0 || candidate.size !== roots.get(candidate.sourceId)!.size) fail('candidate-identity');
      return { priority: 1000, mounted: true };
    }
    if (candidate.archiveId === null || candidate.ordinal === null) fail('candidate-identity');
    const a = archives.get(candidate.archiveId);
    if (!a || a.sourceId !== candidate.sourceId || candidate.absoluteOffset < a.absoluteOffset || candidate.absoluteOffset + candidate.size > a.absoluteOffset + a.size) fail('candidate-ancestry');
    const direct = a.parentId === null ? rootRank(candidate.rootPath) : null;
    if (direct !== null) return { priority: direct, mounted: true };
    const name = containers.find(n => (a.parentId === null && candidate.rootPath === n) || a.names.includes(n));
    if (!name || uncertain.has(name)) return { priority: null, mounted: true };
    return { priority: 160 - containers.indexOf(name) * 10, mounted: chosen.get(name)!.has(a.id) };
  };
}

/** Caller owns catalog lifetime; returned payloads/palettes are private and owned. CPU atlas work is intended for a worker. */
export async function prepareVoxelPreview(catalog: BrowserCatalog, plan: VoxelPlan,
  options: { readonly signal?: AbortSignal; readonly onProgress?: (value: VoxelPreviewProgress) => void; readonly limits?: Partial<Limits>;
    readonly anchors?: readonly BrowserMemberIdentity[] } = {}): Promise<VoxelPreview> {
  if (!isVoxelPlan(plan)) fail('plan'); plain(options);
  for (const key of Reflect.ownKeys(options)) {
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!['signal', 'onProgress', 'limits', 'anchors'].includes(String(key)) || !('value' in d)) fail('options');
  }
  const cap = limits({ ...VOXEL_PREVIEW_LIMITS }, options.limits ?? {}), signal = options.signal, progress = options.onProgress;
  if (active.has(catalog)) fail('busy'); active.add(catalog);
  try {
    const guard = () => throwIfImportAborted(signal); guard();
    if (catalog.policy !== BROWSER_CATALOG_POLICY || catalog.report.profile !== plan.profile || catalog.report.status !== 'inspected') fail('catalog');
    const roots = new Map<string, Readonly<{ id: string; path: string; size: number }>>(), knownRoots = new Map<string, Readonly<BrowserMemberIdentity['root']>>(), reserved = new Set<string>();
    for (const f of dense(catalog.report.files, BROWSER_IMPORT_LIMITS.files)) {
      const id = string(data(f, 'id'), 128), path = string(data(f, 'path')), size = natural(data(f, 'size'));
      if (roots.has(id)) fail('root'); roots.set(id, Object.freeze({ id, path, size }));
    }
    let rootBytes = 0;
    const reserve = (sourceId: string) => {
      const root = roots.get(sourceId); if (!root) fail('root');
      if (!reserved.has(sourceId)) { if (root.size > cap.rootBytes - rootBytes) fail('root-limit'); rootBytes += root.size; reserved.add(sourceId); }
      return root;
    };
    const bindRoot = (root: BrowserMemberIdentity['root']) => {
      const file = reserve(root.sourceId), old = knownRoots.get(root.sourceId);
      if (file.size !== root.size || !/^[a-f0-9]{64}$/.test(root.sha256) || (old && (old.size !== root.size || old.sha256 !== root.sha256))) fail('root-identity');
      knownRoots.set(root.sourceId, Object.freeze({ sourceId: root.sourceId, size: root.size, sha256: root.sha256 }));
    };
    const anchors = options.anchors ?? [];
    if (!Array.isArray(anchors) || Object.getPrototypeOf(anchors) !== Array.prototype || anchors.length > 512 || Reflect.ownKeys(anchors).length !== anchors.length + 1) fail('anchors');
    for (let i = 0; i < anchors.length; i++) {
      const d = Object.getOwnPropertyDescriptor(anchors, String(i)); if (!d || !('value' in d)) fail('anchors');
      const anchor = d.value as BrowserMemberIdentity;
      // Only root facts are used, so no unverified member hash/range claim is made about anchors.
      plain(anchor); const r = Object.getOwnPropertyDescriptor(anchor, 'root'); if (!r || !('value' in r)) fail('anchors');
      plain(r.value); for (const key of ['sourceId', 'size', 'sha256']) { const f = Object.getOwnPropertyDescriptor(r.value, key); if (!f || !('value' in f)) fail('anchors'); }
      bindRoot(rootIdentity(r.value));
    }
    const rankCandidate = mountResolver(catalog, roots, plan.profile);
    type Pending = { path: string; status: VoxelResourceStatus | 'pending'; candidates: { candidate: BrowserAssetCandidate; priority: number | null; mounted: boolean; source: BrowserMemberIdentity | null }[]; selected: string[] };
    const resources = new Map<string, Pending>(), unique = new Map<string, { candidate: BrowserAssetCandidate; path: string }>(), names = new Map<string, string>();
    let references = 0, candidates = 0, sourceBytes = 0;
    function lookup(path: string, maximum: number): Pending {
      if (++references > cap.references) fail('reference-limit');
      const existing = resources.get(path); if (existing) return existing;
      const found = catalog.lookup(path);
      const foundCandidates = dense(found.candidates, BROWSER_IMPORT_LIMITS.nameCandidates);
      if (foundCandidates.length > cap.candidates - candidates) fail('candidate-limit'); candidates += foundCandidates.length;
      const ids = new Set<string>();
      const rows = foundCandidates.map(value => {
        const candidate = candidateSnapshot(value), file = roots.get(candidate.sourceId);
        if (ids.has(candidate.id)) fail('candidate-identity', path); ids.add(candidate.id);
        if (!file || file.path !== candidate.rootPath || candidate.absoluteOffset > file.size || candidate.size > file.size - candidate.absoluteOffset) fail('source-identity', path);
        if (names.has(candidate.id) && names.get(candidate.id) !== path) fail('name-collision', path); names.set(candidate.id, path);
        const rank = rankCandidate(candidate);
        if (!unique.has(candidate.id)) {
          if (candidate.size > maximum || candidate.size > cap.sourceBytes - sourceBytes) fail('source-limit', path);
          sourceBytes += candidate.size; reserve(candidate.sourceId); unique.set(candidate.id, { candidate, path });
        }
        return { candidate, ...rank, source: null };
      });
      const live = rows.filter(r => r.mounted);
      const status = !live.length ? 'missing' : live.some(r => !r.candidate.allowed) ? 'blocked' :
        live.some(r => r.candidate.ambiguousName || (r.candidate.knownNames.length && !r.candidate.knownNames.includes(path))) ? 'name-collision' :
        live.some(r => r.priority === null) ? 'unsupported-mount' : 'pending';
      const result: Pending = { path, status, candidates: rows, selected: [] }; resources.set(path, result); return result;
    }
    const choices = plan.types.map(type => ({ type, palette: type.palettePath ? lookup(type.palettePath, 768) : null,
      pairs: type.requests.map(request => ({ request, vxl: lookup(request.vxlPath, 16 * 1024 ** 2), hva: lookup(request.hvaPath, 16 * 1024 ** 2) })) }));
    const possibleModels = new Set(choices.flatMap(c => c.pairs.flatMap(p =>
      p.vxl.status === 'pending' && p.hva.status === 'pending' ? [p.vxl.path, p.hva.path] : [])));
    if (possibleModels.size > cap.assets) fail('asset-limit');
    const readable = [...resources.values()].filter(r => r.status === 'pending');
    const needed = new Set(readable.flatMap(r => r.candidates.filter(c => c.mounted).map(c => c.candidate.id)));
    const cache = new Map<string, { source: BrowserMemberIdentity; bytes: Uint8Array }>(); let completed = 0, verifiedSourceBytes = 0;
    for (const id of needed) {
      const { candidate, path } = unique.get(id)!; guard(); const found = await catalog.discover(id); guard();
      const source = memberIdentity(data(found, 'identity'));
      const payload = data(found, 'bytes');
      if (source.root.sourceId !== candidate.sourceId || source.absoluteOffset !== candidate.absoluteOffset || source.size !== candidate.size || !/^[a-f0-9]{64}$/.test(source.sha256)) fail('source-identity', path);
      bindRoot(source.root);
      if (!payload || Object.getPrototypeOf(payload) !== Uint8Array.prototype) fail('bytes', path);
      const buffer = bufferOf.call(payload);
      if (!(buffer instanceof ArrayBuffer) || resizableOf?.call(buffer) || sizeOf.call(payload) !== candidate.size) fail('bytes', path);
      const bytes = new Uint8Array(candidate.size); Uint8Array.prototype.set.call(bytes, payload as Uint8Array);
      const hash = await hashByteSource({ size: bytes.length, async read(at, count) { return bytes.subarray(at, at + count); } }, { ...(signal ? { signal } : {}) }); guard();
      if (hash.hex !== source.sha256) fail('source-hash', path);
      cache.set(id, { bytes, source }); verifiedSourceBytes += bytes.length;
      progress?.(Object.freeze({ phase: 'verify', completed: ++completed, total: needed.size, path })); guard();
    }
    for (const resource of readable) {
      for (const row of resource.candidates.filter(c => c.mounted)) row.source = cache.get(row.candidate.id)!.source;
      const live = resource.candidates.filter(r => r.mounted);
      const highest = Math.max(...live.map(r => r.priority!)), top = live.filter(r => r.priority === highest);
      if (new Set(top.map(r => `${r.source!.size}:${r.source!.sha256}`)).size !== 1) resource.status = 'conflict';
      else { resource.status = 'ready'; resource.selected = top.map(r => r.candidate.id).sort(compare); }
    }
    const select = (resource: Pending) => {
      const rows = resource.candidates.filter(r => resource.selected.includes(r.candidate.id)).sort((a, b) => compare(a.candidate.rootPath, b.candidate.rootPath) || a.candidate.absoluteOffset - b.candidate.absoluteOffset || compare(a.candidate.id, b.candidate.id));
      return cache.get(rows[0]!.candidate.id)!;
    };
    type Asset = VoxelPreview['assets'][number];
    const selected = new Map<string, Asset>();
    const addSource = (resource: Pending) => {
      if (resource.status !== 'ready' || selected.has(resource.path)) return;
      if (selected.size >= cap.assets) fail('asset-limit');
      const found = select(resource); selected.set(resource.path, Object.freeze({ id: `model:${resource.path}`, path: resource.path,
        sha256: found.source.sha256, source: found.source, bytes: found.bytes }));
    };
    for (const { pairs } of choices) for (const pair of pairs) if (pair.vxl.status === 'ready' && pair.hva.status === 'ready') {
      addSource(pair.vxl); addSource(pair.hva);
    }
    // Aggregate complete-span preflight precedes all decoded geometry allocation.
    const vxls = new Map<string, ReturnType<typeof createRuntimeVxl>>(), hvas = new Map<string, ReturnType<typeof createRuntimeHva>>();
    let sections = 0, columns = 0, runs = 0, voxels = 0, matrices = 0, selectedSourceBytes = 0; completed = 0;
    for (const [path, asset] of selected) {
      guard(); await yieldBrowserTask(signal); guard(); selectedSourceBytes += asset.bytes.length;
      if (path.endsWith('.vxl')) {
        const model = createRuntimeVxl(asset.bytes, { sections: Math.min(RUNTIME_VXL_LIMITS.sections, cap.sections - sections),
          columns: cap.columns - columns, runs: cap.runs - runs, voxels: cap.voxels - voxels });
        sections += model.sections.length; columns += model.columnCount; runs += model.runCount; voxels += model.voxelCount; vxls.set(path, model);
      } else {
        const animation = createRuntimeHva(asset.bytes, { layout: plan.hvaLayout }, { matrices: Math.min(RUNTIME_HVA_LIMITS.matrices, cap.matrices - matrices) });
        matrices += animation.matrixCount; hvas.set(path, animation);
      }
      progress?.(Object.freeze({ phase: 'decode', completed: ++completed, total: selected.size, path })); guard();
    }
    const usedAssets = new Set<string>(), parts = new Map<string, VoxelPartInput>(), bindings = new Map<string, VoxelPreviewBinding>();
    for (const { pairs } of choices) for (const { request, vxl, hva } of pairs) {
      const reasons: string[] = [], partIds: string[] = [];
      let status: VoxelPreviewBinding['status'];
      if (vxl.status === 'missing' && !request.required) status = 'absent-optional';
      else if (vxl.status !== 'ready') status = vxl.status as VoxelResourceStatus;
      else if (hva.status !== 'ready') status = hva.status as VoxelResourceStatus;
      else {
        const model = vxls.get(vxl.path)!, animation = hvas.get(hva.path)!;
        if (model.sections.length !== animation.sectionCount || model.sections.some(s => s.sectionId !== s.ordinal)) {
          status = 'incompatible-pair'; reasons.push('section-count-or-id');
        } else if (model.sections.some(s => s.normalTable === 'unsupported')) {
          status = 'unsupported-model'; reasons.push('unsupported-normal-table');
        } else {
          status = 'ready';
          const v = selected.get(vxl.path)!, h = selected.get(hva.path)!;
          for (const section of model.sections) {
            const id = `${v.id}/${section.ordinal}/${h.id}`;
            if (!parts.has(id)) {
              if (parts.size >= cap.parts) fail('part-limit');
              parts.set(id, Object.freeze({ id, vxlAssetId: v.id, vxlSection: section.ordinal,
                hva: Object.freeze({ assetId: h.id, layout: plan.hvaLayout, frame: plan.hvaFrame, section: section.ordinal }), transformPolicy: VOXEL_TRANSFORM_POLICY }));
            }
            partIds.push(id); usedAssets.add(v.id); usedAssets.add(h.id);
          }
        }
      }
      if (status !== 'ready' && status !== 'absent-optional') reasons.push(`resource-${status}`);
      bindings.set(request.id, freeze({ requestId: request.id, status, reasons, partIds }));
    }
    const assets = [...selected.values()].filter(a => usedAssets.has(a.id)).sort((a, b) => compare(a.id, b.id));
    const atlasSources: VoxelAssetInput[] = assets.map(a => ({ id: a.id, kind: a.path.endsWith('.vxl') ? 'vxl' : 'hva', sha256: a.sha256, bytes: a.bytes }));
    guard(); await yieldBrowserTask(signal); guard();
    // The existing atlas independently snapshots/hashes and preflights again before decoding selected geometry.
    const atlas = createVoxelAtlas({ assets: atlasSources, parts: [...parts.values()].sort((a, b) => compare(a.id, b.id)) },
      { assets: cap.assets, parts: cap.parts, sourceBytes: cap.sourceBytes, sections: cap.sections, columns: cap.columns,
        runs: cap.runs, sourceVoxels: cap.voxels, selectedVoxels: cap.voxels, matrices: cap.matrices });
    guard();
    const palettes = new Map<string, VoxelPreview['palettes'][number]>();
    for (const choice of choices) if (choice.palette?.status === 'ready' && !palettes.has(choice.palette.path)) {
      const { source, bytes } = select(choice.palette), path = choice.palette.path;
      palettes.set(path, Object.freeze({ id: `pal:${path}`, path, source, rgba: decodeShpPalette(bytes), remap: null, transparentIndex: 0 }));
    }
    const types = choices.map(({ type, palette }) => {
      const bound = type.requests.map(request => bindings.get(request.id)!);
      const reasons = [...type.reasons];
      if (!palette || palette.status !== 'ready') reasons.push(`palette-${palette?.status ?? 'missing'}`);
      for (const binding of bound) if (!['ready', 'absent-optional'].includes(binding.status)) reasons.push(`${binding.requestId}:${binding.status}`);
      return freeze({ id: type.id, status: reasons.length ? 'unsupported' as const : 'ready' as const, reasons,
        paletteId: palette?.status === 'ready' ? palettes.get(palette.path)!.id : null, bindings: bound,
        // A consumer must not paint a partial model when conditional selection is unresolved.
        stillPartIds: reasons.length ? [] : type.requests.filter(r => r.still).flatMap(r => bindings.get(r.id)!.partIds) });
    });
    const resourceRows = [...resources.values()].map(r => {
      if (r.status === 'pending') fail('pending');
      return freeze({ id: `resource:${r.path}`, path: r.path, status: r.status, candidates: r.candidates, selected: r.selected });
    }).sort((a, b) => compare(a.path, b.path));
    const allocations = Object.freeze({ verifiedSourceBytes, selectedSourceBytes, sections, columns, runs, voxels, matrices });
    const metadata = { policy: VOXEL_PREVIEW_POLICY, planSha256: plan.fingerprint, atlas, resources: resourceRows, types, allocations,
      assets: assets.map(({ bytes: _bytes, ...metadata }) => metadata), palettes: [...palettes.values()].map(({ rgba: _rgba, ...metadata }) => metadata) };
    const result: VoxelPreview = Object.freeze({ policy: VOXEL_PREVIEW_POLICY, plan, atlas,
      resources: Object.freeze(resourceRows), assets: Object.freeze(assets), palettes: Object.freeze([...palettes.values()]), types: Object.freeze(types),
      allocations, fingerprint: fingerprint(metadata), canStartCampaign: false, nativeBehaviorVerified: false });
    guard(); prepared.add(result); return result;
  } finally { active.delete(catalog); }
}
