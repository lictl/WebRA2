// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Verified static artwork, without entity simulation.
import type { BrowserAssetCandidate, BrowserCatalog } from '../../vfs/src/browser-catalog.ts';
import { BROWSER_CATALOG_POLICY } from '../../vfs/src/browser-catalog.ts';
import type { BrowserMemberIdentity } from '../../vfs/src/browser-verified.ts';
import { hashByteSource } from '../../vfs/src/hash-source.ts';
import { throwIfImportAborted } from '../../vfs/src/browser-source.ts';
import { createRuntimeShp, SHP_RUNTIME_LIMITS, ShpRuntimeError } from '../../formats/src/shp-runtime.ts';
import { decodeShpPalette } from '../../formats/src/shp-ts.ts';
import { assertObjectArtPlan, type ObjectArtPlan } from './object-art.ts';

export const OBJECT_PREVIEW_POLICY = 'webra2-object-resources-1' as const;
export const OBJECT_PREVIEW_LIMITS = Object.freeze({ references: 8192, candidates: 2048, assets: 1024,
  sourceBytes: 128 * 1024 ** 2, rootBytes: 1024 ** 3, indexedFrames: 65536, decodedPixels: 64 * 1024 ** 2 });
type Limits = { -readonly [K in keyof typeof OBJECT_PREVIEW_LIMITS]: number };
type ResourceStatus = 'ready' | 'missing' | 'blocked' | 'conflict' | 'unsupported-mount' | 'name-collision';
export interface ObjectPreviewResource {
  readonly id: string; readonly path: string; readonly status: ResourceStatus;
  readonly candidates: readonly Readonly<{ candidate: BrowserAssetCandidate; priority: number | null; source: BrowserMemberIdentity | null }>[];
  readonly selected: readonly string[];
}
export interface ObjectPreviewAsset {
  readonly id: string; readonly path: string; readonly sha256: string; readonly source: BrowserMemberIdentity;
  /** Player payload, owned by the caller; never a public report field. */
  readonly bytes: Uint8Array;
}
export interface ObjectPreview {
  readonly policy: typeof OBJECT_PREVIEW_POLICY; readonly plan: ObjectArtPlan;
  readonly canStartCampaign: false; readonly nativeBehaviorVerified: false;
  readonly resources: readonly ObjectPreviewResource[];
  readonly assets: readonly ObjectPreviewAsset[];
  readonly palettes: readonly Readonly<{ id: string; path: string; source: BrowserMemberIdentity; rgba: Uint8Array }>[];
  readonly types: readonly Readonly<{ id: string; status: ResourceStatus | 'voxel' | 'unsupported-plan'; assetId: string | null; paletteId: string | null; frame: 0;
    canvas: Readonly<{ width: number; height: number }> | null }>[];
  readonly allocations: Readonly<{ verifiedSourceBytes: number; selectedSourceBytes: number; selectedFramePixels: number; indexedFrames: number; paletteBytes: number }>;
}
export interface ObjectPreviewProgress { readonly phase: 'verify' | 'decode'; readonly completed: number; readonly total: number; readonly path: string }
export class ObjectPreviewError extends Error {
  constructor(readonly code: string, readonly path = '') { super(code); this.name = 'ObjectPreviewError'; }
}
function fail(code: string, path = ''): never { throw new ObjectPreviewError(code, path); }
function plain(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('object-preview-options');
}
function limits(value: Partial<Limits>): Limits {
  plain(value); const cap: Limits = { ...OBJECT_PREVIEW_LIMITS };
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('object-preview-limit');
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[key as keyof Limits]) fail('object-preview-limit');
    cap[key as keyof Limits] = d.value;
  }
  return cap;
}
const active = new WeakSet<BrowserCatalog>();
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const sizeOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
function priority(candidate: BrowserAssetCandidate, profile: 'ra2' | 'yr'): number | null {
  if (candidate.kind === 'literal') return 200;
  const expansion = (profile === 'ra2' ? /^expand(\d{2})\.mix$/ : /^expandmd(\d{2})\.mix$/).exec(candidate.rootPath);
  if (expansion) return 1 + Number(expansion[1]);
  // Equivalent content is required among all highest-tier copies. No nested mount ordering is invented.
  const base = profile === 'ra2' ? /^(?:ra2|language|local|cache|conquer|temperat|snow|urban|isotemp|isosnow|isourb)\.mix$/ :
    /^(?:ra2|ra2md|language|langmd|local|localmd|cache|cachemd|conquer|conqmd|temperat|snow|urban|urbann|desert|lunar|isotemp|isosnow|isourb|isoubn|isodes|isolun)\.mix$/;
  return base.test(candidate.rootPath) ? 0 : null;
}

/** Caller owns catalog/result lifetime. Share its AbortSignal for prompt I/O cancellation. */
export async function prepareObjectPreview(catalog: BrowserCatalog, plan: ObjectArtPlan,
  options: { readonly signal?: AbortSignal; readonly onProgress?: (value: ObjectPreviewProgress) => void; readonly limits?: Partial<Limits>;
    /** Root identities already verified by the consuming scene. Captured before the first await. */
    readonly anchors?: readonly BrowserMemberIdentity[] } = {}): Promise<ObjectPreview> {
  assertObjectArtPlan(plan); plain(options);
  for (const key of Reflect.ownKeys(options)) {
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!['signal', 'onProgress', 'limits', 'anchors'].includes(String(key)) || !('value' in d)) fail('object-preview-options');
  }
  const cap = limits(options.limits ?? {}), signal = options.signal, progress = options.onProgress;
  if (active.has(catalog)) fail('object-preview-busy'); active.add(catalog);
  try {
    const guard = () => throwIfImportAborted(signal); guard();
    if (catalog.policy !== BROWSER_CATALOG_POLICY || catalog.report.profile !== plan.profile || catalog.report.status !== 'inspected') fail('object-preview-catalog');
    const roots = new Map(catalog.report.files.map(f => [f.id, f])), knownRoots = new Map<string, Readonly<BrowserMemberIdentity['root']>>(), reserved = new Set<string>();
    let rootBytes = 0;
    const reserve = (sourceId: string) => {
      const root = roots.get(sourceId); if (!root) fail('object-preview-root');
      if (!reserved.has(sourceId)) { if (root.size > cap.rootBytes - rootBytes) fail('object-preview-root-limit'); rootBytes += root.size; reserved.add(sourceId); }
      return root;
    };
    const bindRoot = (root: BrowserMemberIdentity['root']) => {
      const file = reserve(root.sourceId), old = knownRoots.get(root.sourceId);
      if (file.size !== root.size || !/^[a-f0-9]{64}$/.test(root.sha256) || (old && (old.size !== root.size || old.sha256 !== root.sha256))) fail('object-preview-root-identity');
      knownRoots.set(root.sourceId, Object.freeze({ sourceId: root.sourceId, size: root.size, sha256: root.sha256 }));
    };
    const anchors = options.anchors ?? [];
    if (!Array.isArray(anchors) || Object.getPrototypeOf(anchors) !== Array.prototype || anchors.length > 512 || Reflect.ownKeys(anchors).length !== anchors.length + 1) fail('object-preview-anchors');
    for (let i = 0; i < anchors.length; i++) {
      const d = Object.getOwnPropertyDescriptor(anchors, String(i)); if (!d || !('value' in d)) fail('object-preview-anchors');
      const anchor = d.value as BrowserMemberIdentity;
      // Only root facts are used, so no unverified member hash/range claim is made about anchors.
      plain(anchor); const r = Object.getOwnPropertyDescriptor(anchor, 'root'); if (!r || !('value' in r)) fail('object-preview-anchors');
      plain(r.value); for (const key of ['sourceId', 'size', 'sha256']) { const f = Object.getOwnPropertyDescriptor(r.value, key); if (!f || !('value' in f)) fail('object-preview-anchors'); }
      bindRoot({ sourceId: r.value.sourceId as string, size: r.value.size as number, sha256: r.value.sha256 as string });
    }
    type Pending = { path: string; status: ResourceStatus | 'pending'; candidates: { candidate: BrowserAssetCandidate; priority: number | null; source: BrowserMemberIdentity | null }[]; selected: string[] };
    const resources = new Map<string, Pending>(), unique = new Map<string, { candidate: BrowserAssetCandidate; path: string }>(), names = new Map<string, string>();
    let references = 0, candidates = 0, sourceBytes = 0;
    function lookup(path: string, maximum: number): Pending {
      if (++references > cap.references) fail('object-preview-reference-limit');
      const existing = resources.get(path); if (existing) return existing;
      const found = catalog.lookup(path);
      if (found.candidates.length > cap.candidates - candidates) fail('object-preview-candidate-limit'); candidates += found.candidates.length;
      const rows = found.candidates.map(candidate => {
        if (names.has(candidate.id) && names.get(candidate.id) !== path) fail('object-preview-name-collision', path); names.set(candidate.id, path);
        const rank = priority(candidate, plan.profile);
        if (!unique.has(candidate.id)) {
          if (candidate.size > maximum || candidate.size > cap.sourceBytes - sourceBytes) fail('object-preview-source-limit', path);
          sourceBytes += candidate.size; reserve(candidate.sourceId); unique.set(candidate.id, { candidate, path });
        }
        return { candidate, priority: rank, source: null };
      });
      const status = !rows.length ? 'missing' : rows.some(r => !r.candidate.allowed) ? 'blocked' :
        rows.some(r => r.candidate.ambiguousName || (r.candidate.knownNames.length && !r.candidate.knownNames.includes(path))) ? 'name-collision' :
        rows.some(r => r.priority === null) ? 'unsupported-mount' : 'pending';
      const result: Pending = { path, status, candidates: rows, selected: [] }; resources.set(path, result); return result;
    }
    const choices = plan.types.map(type => {
      if (type.status !== 'shp') return { type, image: null, palette: null };
      let image: Pending | null = null;
      for (const path of type.paths) { image = lookup(path, SHP_RUNTIME_LIMITS.fileBytes); if (image.status !== 'missing') break; }
      const palette = type.palettePath ? lookup(type.palettePath, 768) : null;
      return { type, image, palette };
    });
    const readable = [...resources.values()].filter(r => r.status === 'pending');
    const needed = new Set(readable.flatMap(r => r.candidates.map(c => c.candidate.id)));
    const cache = new Map<string, { source: BrowserMemberIdentity; bytes: Uint8Array }>(); let completed = 0, verifiedSourceBytes = 0;
    for (const id of needed) {
      const { candidate, path } = unique.get(id)!; guard(); const found = await catalog.discover(id); guard();
      const r = found.identity, source = Object.freeze({ root: Object.freeze({ sourceId: r.root.sourceId, size: r.root.size, sha256: r.root.sha256 }), absoluteOffset: r.absoluteOffset, size: r.size, sha256: r.sha256 });
      if (source.root.sourceId !== candidate.sourceId || source.absoluteOffset !== candidate.absoluteOffset || source.size !== candidate.size || !/^[a-f0-9]{64}$/.test(source.sha256)) fail('object-preview-source-identity', path);
      bindRoot(source.root);
      if (!found.bytes || Object.getPrototypeOf(found.bytes) !== Uint8Array.prototype) fail('object-preview-bytes', path);
      const buffer = bufferOf.call(found.bytes);
      if (!(buffer instanceof ArrayBuffer) || resizableOf?.call(buffer) || sizeOf.call(found.bytes) !== candidate.size) fail('object-preview-bytes', path);
      const bytes = new Uint8Array(candidate.size); Uint8Array.prototype.set.call(bytes, found.bytes);
      const hash = await hashByteSource({ size: bytes.length, async read(at, count) { return bytes.subarray(at, at + count); } }, { ...(signal ? { signal } : {}) }); guard();
      if (hash.hex !== source.sha256) fail('object-preview-source-hash', path);
      cache.set(id, { bytes, source }); verifiedSourceBytes += bytes.length;
      progress?.(Object.freeze({ phase: 'verify', completed: ++completed, total: needed.size, path })); guard();
    }
    for (const resource of readable) {
      for (const row of resource.candidates) row.source = cache.get(row.candidate.id)!.source;
      const highest = Math.max(...resource.candidates.map(r => r.priority!)), top = resource.candidates.filter(r => r.priority === highest);
      if (new Set(top.map(r => `${r.source!.size}:${r.source!.sha256}`)).size !== 1) resource.status = 'conflict';
      else { resource.status = 'ready'; resource.selected = top.map(r => r.candidate.id).sort(compare); }
    }
    const select = (resource: Pending) => {
      const rows = resource.candidates.filter(r => resource.selected.includes(r.candidate.id)).sort((a, b) => compare(a.candidate.rootPath, b.candidate.rootPath) || a.candidate.absoluteOffset - b.candidate.absoluteOffset || compare(a.candidate.id, b.candidate.id));
      return cache.get(rows[0]!.candidate.id)!;
    };
    const selectedImages = new Map<string, { resource: Pending; source: BrowserMemberIdentity; bytes: Uint8Array }>(), selectedPalettes = new Map<string, Pending>();
    for (const { image, palette } of choices) if (image?.status === 'ready' && palette?.status === 'ready') {
      if (!selectedImages.has(image.path)) {
        if (selectedImages.size >= cap.assets) fail('object-preview-asset-limit'); selectedImages.set(image.path, { resource: image, ...select(image) });
      }
      selectedPalettes.set(palette.path, palette);
    }
    // Preflight aggregate index/pixel work before decoder index/plane allocation.
    let indexedFrames = 0, selectedFramePixels = 0, selectedSourceBytes = 0;
    for (const { bytes, resource } of selectedImages.values()) {
      if (bytes.length < 32) fail('object-preview-shp-header', resource.path);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), count = view.getUint16(6, true);
      if (!count || count > SHP_RUNTIME_LIMITS.frames || count > cap.indexedFrames - indexedFrames) fail('object-preview-index-limit', resource.path);
      indexedFrames += count;
      const pixels = view.getUint16(12, true) * view.getUint16(14, true);
      if (pixels > cap.decodedPixels - selectedFramePixels) fail('object-preview-pixel-limit', resource.path);
      selectedFramePixels += pixels; selectedSourceBytes += bytes.length;
    }
    const assets: ObjectPreviewAsset[] = [], canvases = new Map<string, Readonly<{ width: number; height: number }>>(); completed = 0;
    for (const { bytes, source, resource } of selectedImages.values()) {
      guard(); let shp;
      try { shp = createRuntimeShp(bytes); shp.decodeFrame(0); }
      catch (error) { if (error instanceof ShpRuntimeError) fail(error.code, resource.path); throw error; }
      canvases.set(resource.path, Object.freeze({ width: shp.width, height: shp.height }));
      assets.push(Object.freeze({ id: `shp:${resource.path}`, path: resource.path, sha256: source.sha256, source, bytes }));
      progress?.(Object.freeze({ phase: 'decode', completed: ++completed, total: selectedImages.size, path: resource.path })); guard();
    }
    const palettes = [...selectedPalettes].map(([path, resource]) => { const { source, bytes } = select(resource); return Object.freeze({ id: `pal:${path}`, path, source, rgba: decodeShpPalette(bytes) }); });
    const types = choices.map(({ type, image, palette }) => {
      const status = type.status === 'voxel' ? 'voxel' : type.status !== 'shp' ? 'unsupported-plan' : image?.status !== 'ready' ? image?.status ?? 'missing' : palette?.status ?? 'missing';
      if (status === 'pending') fail('object-preview-pending');
      const ready = status === 'ready';
      return Object.freeze({ id: type.id, status, assetId: ready ? `shp:${image!.path}` : null, paletteId: ready ? `pal:${palette!.path}` : null, frame: 0 as const, canvas: ready ? canvases.get(image!.path)! : null });
    });
    const reports = [...resources.values()].map(r => {
      if (r.status === 'pending') fail('object-preview-pending');
      return Object.freeze({ id: `resource:${r.path}`, path: r.path, status: r.status, candidates: Object.freeze(r.candidates.map(c => Object.freeze(c))), selected: Object.freeze(r.selected) });
    });
    return Object.freeze({ policy: OBJECT_PREVIEW_POLICY, plan, canStartCampaign: false, nativeBehaviorVerified: false,
      resources: Object.freeze(reports), assets: Object.freeze(assets), palettes: Object.freeze(palettes), types: Object.freeze(types),
      allocations: Object.freeze({ verifiedSourceBytes, selectedSourceBytes, selectedFramePixels, indexedFrames, paletteBytes: palettes.length * 1024 }) });
  } finally { active.delete(catalog); }
}
