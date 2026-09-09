// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original composition of verified content/format APIs.
import { assertJsonValue, type ProfileId } from '../../contracts/src/index.ts';
import type { BrowserAssetCandidate, BrowserCatalog } from '../../vfs/src/browser-catalog.ts';
import type { BrowserMemberIdentity } from '../../vfs/src/browser-verified.ts';
import { normalizeAssetPath } from '../../vfs/src/profile.ts';
import { throwIfImportAborted } from '../../vfs/src/browser-source.ts';
import { hashByteSource } from '../../vfs/src/hash-source.ts';
import { parseTmpIndex, type TmpIndex } from '../../formats/src/tmp.ts';
import { decodeShpPalette } from '../../formats/src/shp-ts.ts';
import { loadInstallationProfile, type InstallationProfileResult } from './installation-profile.ts';
import { compileScenarioTerrain, type ScenarioTerrain } from './scenario-terrain.ts';
import { compileScenarioObjects, type ScenarioObjects } from './scenario-objects.ts';
import { compileTheaterTiles, resolveTheaterTile, type TheaterTiles, type TileTheater } from './theater-tiles.ts';

export const TERRAIN_PREVIEW_POLICY = 'webra2-terrain-preview-base-1';
export interface TerrainPreviewLimits { readonly assets: number; readonly assetBytes: number; readonly rootBytes: number; readonly references: number; readonly cells: number }
export const TERRAIN_PREVIEW_LIMITS: TerrainPreviewLimits = Object.freeze({ assets: 1024, assetBytes: 128 * 1024 ** 2,
  rootBytes: 1024 ** 3, references: 16384, cells: 130816 });
export interface TerrainPreviewRequest {
  readonly profile: ProfileId; readonly engineVersion: string; readonly missionPath: string;
  readonly theaterIniPath: string; readonly palettePath: string;
  /** An explicit preview choice. Native replacement-variant selection is not implemented here. */
  readonly variantPolicy: 'base-only';
}
export interface TerrainPreviewAsset {
  readonly id: string; readonly path: string; readonly sha256: string; readonly source: BrowserMemberIdentity;
  /** Owned source snapshot for the renderer. Not a public metadata/report field. */
  readonly bytes: Uint8Array;
}
export interface TerrainPreview {
  readonly policy: typeof TERRAIN_PREVIEW_POLICY; readonly canStartCampaign: false;
  readonly assetSelection: 'unique-candidate-base-only';
  readonly definitions: InstallationProfileResult;
  readonly terrain: ScenarioTerrain; readonly objects: ScenarioObjects; readonly theater: TheaterTiles;
  readonly theaterSource: BrowserMemberIdentity; readonly paletteSource: BrowserMemberIdentity;
  readonly paletteRgba: Uint8Array;
  readonly assets: readonly TerrainPreviewAsset[];
  readonly choices: readonly Readonly<{ sourceRecord: number; assetId: string; subtile: number }>[];
  readonly unresolvedRendering: readonly ['replacement-variants', 'native-lighting', 'native-depth-policy', 'overlays', 'objects', 'effects'];
}
export interface TerrainPreviewProgress { readonly phase: 'definitions' | 'mission' | 'theater' | 'tiles'; readonly completed: number; readonly total: number; readonly path: string }
export class TerrainPreviewError extends Error {
  constructor(readonly code: string, readonly path = '') { super(code); this.name = 'TerrainPreviewError'; }
}
function fail(code: string, path = ''): never { throw new TerrainPreviewError(code, path); }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const active = new WeakSet<BrowserCatalog>();
const typedArray = Object.getPrototypeOf(Uint8Array.prototype) as object;
const lengthOf = Object.getOwnPropertyDescriptor(typedArray, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typedArray, 'buffer')!.get!;
function sameIdentity(a: BrowserMemberIdentity, b: BrowserMemberIdentity): boolean {
  return a.root.sourceId === b.root.sourceId && a.root.size === b.root.size && a.root.sha256 === b.root.sha256 &&
    a.absoluteOffset === b.absoluteOffset && a.size === b.size && a.sha256 === b.sha256;
}

/** Caller owns catalog lifetime. Returned tile/palette buffers are private on-device renderer inputs. */
export async function prepareTerrainPreview(catalog: BrowserCatalog, input: TerrainPreviewRequest,
  options: { readonly signal?: AbortSignal; readonly onProgress?: (progress: TerrainPreviewProgress) => void; readonly limits?: Partial<TerrainPreviewLimits> } = {}): Promise<TerrainPreview> {
  if (active.has(catalog)) fail('preview-busy'); active.add(catalog);
  try {
    assertJsonValue(input);
    const keys = ['profile', 'engineVersion', 'missionPath', 'theaterIniPath', 'palettePath', 'variantPolicy'];
    if (Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key)) || input.variantPolicy !== 'base-only') fail('preview-request');
    const profile = input.profile, engineVersion = input.engineVersion, missionPath = normalizeAssetPath(input.missionPath),
      theaterIniPath = normalizeAssetPath(input.theaterIniPath), palettePath = normalizeAssetPath(input.palettePath);
    if (!theaterIniPath.endsWith('.ini') || !palettePath.endsWith('.pal')) fail('preview-resource-path');
    const signal = options.signal, onProgress = options.onProgress, cap = { ...TERRAIN_PREVIEW_LIMITS, ...options.limits };
    for (const key of Object.keys(cap) as (keyof TerrainPreviewLimits)[]) {
      if (!Object.hasOwn(TERRAIN_PREVIEW_LIMITS, key) || !Number.isSafeInteger(cap[key]) || cap[key] < 0 || cap[key] > TERRAIN_PREVIEW_LIMITS[key]) fail('preview-limit');
    }
    const guard = () => throwIfImportAborted(signal); guard();
    const progress = (phase: TerrainPreviewProgress['phase'], completed: number, total: number, path: string) => {
      onProgress?.(Object.freeze({ phase, completed, total, path })); guard();
    };
    const definitions = await loadInstallationProfile(catalog, { profile, engineVersion, missionPath }, { ...(signal ? { signal } : {}),
      limits: { rootBytes: cap.rootBytes }, onProgress(value) { progress('definitions', value.completed, value.total, value.path); } });
    guard(); if (!definitions.content) fail('preview-definitions-unresolved');
    const roots = new Map(catalog.report.files.map(file => [file.id, file])), reservedRoots = new Set<string>(), namesByCandidate = new Map<string, string>(); let rootBytes = 0;
    const rootIdentities = new Map<string, BrowserMemberIdentity['root']>();
    function bindName(candidate: BrowserAssetCandidate, path: string): void {
      if (namesByCandidate.has(candidate.id) && namesByCandidate.get(candidate.id) !== path) fail('preview-name-collision', path);
      namesByCandidate.set(candidate.id, path);
    }
    function bindRoot(root: BrowserMemberIdentity['root']): void {
      const prior = rootIdentities.get(root.sourceId);
      if (prior && (prior.size !== root.size || prior.sha256 !== root.sha256)) fail('preview-root-identity');
      rootIdentities.set(root.sourceId, root);
    }
    function reserveRoot(candidate: BrowserAssetCandidate): void {
      if (reservedRoots.has(candidate.sourceId)) return;
      const root = roots.get(candidate.sourceId); if (!root) fail('preview-root');
      if (root.size > cap.rootBytes - rootBytes) fail('preview-root-budget', candidate.rootPath);
      rootBytes += root.size; reservedRoots.add(root.id);
    }
    // The definitions loader preflighted these roots before I/O. Include them in
    // the cumulative preview root budget before discovering any additional root.
    for (const group of definitions.definitions) for (const value of group.candidates) {
      reserveRoot(value.candidate); bindName(value.candidate, group.path); bindRoot(value.identity!.root);
    }
    function unique(path: string, limit: number): BrowserAssetCandidate {
      const lookup = catalog.lookup(path);
      if (!lookup.candidates.length) fail('preview-missing-asset', path);
      if (lookup.candidates.length !== 1 || lookup.status === 'ambiguous') fail('preview-ambiguous-asset', path);
      const candidate = lookup.candidates[0]!;
      if (!candidate.allowed) fail('preview-blocked-asset', path);
      if (candidate.ambiguousName || (candidate.knownNames.length && !candidate.knownNames.includes(path))) fail('preview-name-collision', path);
      bindName(candidate, path);
      if (candidate.size > limit) fail('preview-member-budget', path);
      reserveRoot(candidate); return candidate;
    }
    async function read(candidate: BrowserAssetCandidate, expected?: BrowserMemberIdentity) {
      guard(); const found = expected ? await catalog.read(candidate.id, expected.sha256) : await catalog.discover(candidate.id); guard();
      const reported = found.identity, source = Object.freeze({ root: Object.freeze({ sourceId: reported.root.sourceId, size: reported.root.size, sha256: reported.root.sha256 }),
        absoluteOffset: reported.absoluteOffset, size: reported.size, sha256: reported.sha256 });
      if (source.root.sourceId !== candidate.sourceId || source.root.size !== roots.get(candidate.sourceId)!.size || source.absoluteOffset !== candidate.absoluteOffset ||
        source.size !== candidate.size || !/^[a-f\d]{64}$/.test(source.sha256) || !/^[a-f\d]{64}$/.test(source.root.sha256) || (expected && !sameIdentity(source, expected))) fail('preview-read-identity');
      bindRoot(source.root);
      if (!(found.bytes instanceof Uint8Array) || lengthOf.call(found.bytes) !== candidate.size || !(bufferOf.call(found.bytes) instanceof ArrayBuffer)) fail('preview-read-bytes');
      const bytes = new Uint8Array(candidate.size); Uint8Array.prototype.set.call(bytes, found.bytes);
      const digest = await hashByteSource({ size: bytes.length, async read(offset, length) { return bytes.subarray(offset, offset + length); } }, { ...(signal ? { signal } : {}) });
      guard(); if (digest.hex !== source.sha256) fail('preview-read-hash');
      return { bytes, source };
    }
    const mission = definitions.content.files.find(file => file.role === 'mission')!;
    const pinned = catalog.lookup(mission.path).candidates.filter(candidate => candidate.sourceId === mission.source.root.sourceId &&
      candidate.absoluteOffset === mission.source.absoluteOffset && candidate.size === mission.source.size);
    if (pinned.length !== 1 || !pinned[0]!.allowed) fail('preview-mission-source');
    bindName(pinned[0]!, mission.path);
    const map = await read(pinned[0]!, mission.source);
    const scenario = { profile, source: { id: 'selected-mission', profile, sha256: map.source.sha256 }, bytes: map.bytes };
    const terrain = compileScenarioTerrain(scenario, { cells: cap.cells }), objects = compileScenarioObjects(scenario);
    if (terrain.size.width !== objects.size.width || terrain.size.height !== objects.size.height) fail('preview-geometry-mismatch');
    progress('mission', 1, 1, mission.path);
    const iniCandidate = unique(theaterIniPath, 8 * 1024 ** 2), paletteCandidate = unique(palettePath, 768);
    if (paletteCandidate.size !== 768) fail('preview-palette-size', palettePath);
    const ini = await read(iniCandidate), palette = await read(paletteCandidate);
    const theater = compileTheaterTiles({ profile, theater: terrain.theater as TileTheater,
      layers: [{ id: 'selected-theater', profile, kind: profile === 'yr' ? 'expansion' : 'base', order: 0, sourceSha256: ini.source.sha256, bytes: ini.bytes }] });
    const paletteRgba = decodeShpPalette(palette.bytes); progress('theater', 2, 2, theaterIniPath);
    const referenceNames = new Map<string, string>(), names = new Set<string>();
    const key = (cell: ScenarioTerrain['cells'][number]) => `${cell.tileIndex}:${cell.extraTileWord}:${cell.subtile}`;
    for (const cell of terrain.cells) {
      const reference = key(cell); if (referenceNames.has(reference)) continue;
      if (referenceNames.size >= cap.references) fail('preview-reference-budget');
      const resolution = resolveTheaterTile(theater, { tileIndex: cell.tileIndex, extraTileWord: cell.extraTileWord, subtile: cell.subtile });
      if (resolution.status !== 'candidate' && resolution.status !== 'clear-sentinel') fail('preview-unsupported-tile');
      const name = normalizeAssetPath(resolution.candidates[0]!.filename);
      referenceNames.set(reference, name); names.add(name);
      if (names.size > cap.assets) fail('preview-asset-budget');
    }
    // Preflight every tile candidate's aggregate source bytes/root hash budget
    // before reading the first tile. Repeated cells do not reread the same asset.
    let sourceBytes = 0;
    const tileCandidates = [...names].sort(compare).map(path => {
      const candidate = unique(path, 16 * 1024 ** 2);
      if (candidate.size > cap.assetBytes - sourceBytes) fail('preview-source-budget', path);
      sourceBytes += candidate.size; return { path, candidate };
    });
    const assets: TerrainPreviewAsset[] = [], indexes = new Map<string, TmpIndex>(), assetIds = new Map<string, string>();
    for (const [i, value] of tileCandidates.entries()) {
      const found = await read(value.candidate), index = parseTmpIndex(found.bytes);
      if (index.tileWidth !== 60 || index.tileHeight !== 30) fail('preview-tile-dimensions', value.path);
      const id = `terrain:${i}`;
      assets.push(Object.freeze({ id, path: value.path, sha256: found.source.sha256, source: found.source, bytes: found.bytes }));
      indexes.set(value.path, index); assetIds.set(value.path, id); progress('tiles', i + 1, tileCandidates.length, value.path);
    }
    const choices = terrain.cells.map(cell => {
      const path = referenceNames.get(key(cell))!, index = indexes.get(path)!, tile = index.tiles[cell.subtile];
      if (!tile) fail('preview-missing-subtile', path);
      if (!tile.hasZ) fail('preview-missing-depth', path);
      return Object.freeze({ sourceRecord: cell.sourceRecord, assetId: assetIds.get(path)!, subtile: cell.subtile });
    });
    guard(); return Object.freeze({ policy: TERRAIN_PREVIEW_POLICY, canStartCampaign: false, assetSelection: 'unique-candidate-base-only',
      definitions, terrain, objects, theater, theaterSource: ini.source, paletteSource: palette.source, paletteRgba,
      assets: Object.freeze(assets), choices: Object.freeze(choices),
      unresolvedRendering: Object.freeze(['replacement-variants', 'native-lighting', 'native-depth-policy', 'overlays', 'objects', 'effects'] as const) });
  } finally { active.delete(catalog); }
}
