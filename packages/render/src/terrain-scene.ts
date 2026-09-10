// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors; OpenRA Developers and Contributors.
// Slot-relative TMP placement/composition references: ../../../docs/terrain-scene.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { prepareSpriteBatch, SPRITE_LAYER_POLICY, type SpriteBatch, type SpriteTerrainFrame } from './sprite-layer.ts';
import type { ScenarioTerrain } from '../../content/src/scenario-terrain.ts';
import { decodeTmpTile, parseTmpIndex, TMP_LIMITS, type DecodedTmpTile, type TmpIndex } from '../../formats/src/tmp.ts';

export const TERRAIN_SCENE_POLICY = 'webra2-terrain-scene-1' as const;
export const TERRAIN_SCENE_LIMITS = Object.freeze({ cells: 130816, assets: 1024, indexSlots: 65536, decodeIndexVisits: 1048576, sourceBytes: 128 * 1024 * 1024,
  decodedBytes: 64 * 1024 * 1024, viewportDimension: 2048, viewportPixels: 2048 * 2048,
  samples: 64 * 1024 * 1024, coordinate: 1048576 });
type Limits = { -readonly [K in keyof typeof TERRAIN_SCENE_LIMITS]: number };
export interface TerrainSceneAsset { readonly id: string; readonly sha256: string; readonly bytes: Uint8Array }
export interface TerrainSceneChoice { readonly sourceRecord: number; readonly assetId: string; readonly subtile: number }
export interface TerrainProjection { readonly tileWidth: number; readonly tileHeight: number; readonly elevationStep: number }
export interface TerrainSceneInput {
  readonly terrain: ScenarioTerrain; readonly assets: readonly TerrainSceneAsset[]; readonly choices: readonly TerrainSceneChoice[];
  /** Exactly 256 RGBA entries; alpha is restricted to zero or 255. No palette/remap/lighting inference. */
  readonly palette: Uint8Array; readonly projection: TerrainProjection;
}
export interface TerrainViewport {
  readonly cameraX: number; readonly cameraY: number; readonly zoom: 0.5 | 1 | 2 | 4;
  readonly width: number; readonly height: number; readonly backgroundRgba: readonly [number, number, number, number];
}
export interface TerrainSceneRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface TerrainPick {
  readonly sourceRecord: number; readonly x: number; readonly y: number; readonly assetId: string; readonly subtile: number;
  readonly worldX: number; readonly worldY: number; readonly depth: number;
}
export interface TerrainFrame {
  /** Caller-owned; changes do not alter picking or another frame. */
  readonly rgba: Uint8Array;
  readonly viewport: TerrainViewport;
  readonly allocations: Readonly<{ rgbaBytes: number; depthBytes: number; ownerBytes: number; totalPixelBytes: number; samples: number }>;
  /** Viewport pixel coordinates; fractional positions select their containing output pixel. */
  pick(viewX: number, viewY: number): TerrainPick | null;
}
export interface TerrainScene {
  readonly policy: typeof TERRAIN_SCENE_POLICY; readonly nativeBehaviorVerified: false;
  readonly source: Readonly<{ id: string; profile: 'ra2' | 'yr'; sha256: string; verification: 'caller-provided' }>;
  readonly assets: readonly Readonly<{ id: string; sha256: string; size: number; verification: 'sha256-verified' }>[];
  readonly projection: TerrainProjection; readonly bounds: TerrainSceneRect;
  readonly diagnostics: readonly Readonly<{ code: string; count: number }>[];
  readonly allocations: Readonly<{ sourceSnapshotBytes: number; temporarySourceBytesMax: number; decodedPlaneBytes: number;
    paletteBytes: number; cells: number; decodedSlots: number }>;
  render(viewport: TerrainViewport): TerrainFrame;
  renderSprites(viewport: TerrainViewport, batch: SpriteBatch): SpriteTerrainFrame;
}
export class TerrainSceneError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'TerrainSceneError'; }
}
function fail(code: string): never { throw new TerrainSceneError(code); }
function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('scene-record');
}
function fields(value: unknown, names: readonly string[], exact = true): asserts value is Record<string, unknown> {
  record(value);
  if (exact && Reflect.ownKeys(value).length !== names.length) fail('scene-fields');
  for (const name of names) { const descriptor = Object.getOwnPropertyDescriptor(value, name); if (!descriptor || !('value' in descriptor)) fail('scene-fields'); }
}
function array(value: unknown, maximum: number): asserts value is readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) fail('scene-array-limit');
  for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d)) fail('scene-array-shape'); }
}
function integer(value: unknown, min: number, max: number, code = 'scene-number'): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(code);
}
function limits(options: Partial<Limits>): Limits {
  record(options); const output: Limits = { ...TERRAIN_SCENE_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(output, key)) fail('scene-limit-key');
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in d)) fail('scene-limit');
    integer(d.value, 0, output[key as keyof Limits], 'scene-limit'); output[key as keyof Limits] = d.value;
  }
  return output;
}
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function byteSize(value: unknown, min: number, max: number): number {
  if (!value || Object.getPrototypeOf(value) !== Uint8Array.prototype) fail('scene-byte-input');
  const size = lengthOf.call(value) as number, buffer: unknown = bufferOf.call(value);
  if (!(buffer instanceof ArrayBuffer) || resizableOf?.call(buffer) || size < min || size > max) fail('scene-byte-limit');
  return size;
}
function copy(value: Uint8Array, size: number): Uint8Array { const result = new Uint8Array(size); Uint8Array.prototype.set.call(result, value); return result; }
function digest(value: Uint8Array): string { return Array.from(sha256(value), byte => byte.toString(16).padStart(2, '0')).join(''); }
function id(value: unknown): asserts value is string { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(value)) fail('scene-id'); }
function hash(value: unknown): asserts value is string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('scene-sha256'); }
interface Cell { sourceRecord: number; x: number; y: number; column: number; row: number; elevation: number; subtile: number }
interface Sprite { decoded: Pick<DecodedTmpTile, 'pixels' | 'zPixels' | 'mask' | 'extra'>; extraX: number; extraY: number; left: number; top: number; right: number; bottom: number }
interface Placement { cell: Cell; assetId: string; sprite: Sprite; left: number; top: number; groundY: number }
const scenes = new WeakMap<TerrainScene, { placements: Placement[]; palette: Uint8Array; cap: Limits }>();

/** Bounded presentation bridge. Descriptors expose no retained planes; copy allocates one sparse patch. */
export function describeTerrainRasters(scene: TerrainScene) {
  const data = scenes.get(scene); if (!data) fail('scene-identity');
  const sprites = [...new Set(data.placements.map(p => p.sprite))];
  const indices = new Map(sprites.map((s, i) => [s, i]));
  const { tileWidth, tileHeight } = scene.projection;
  return {
    limits: Object.freeze({ ...data.cap }),
    placements: data.placements.map(p => Object.freeze({ ...p.cell, assetId: p.assetId, left: p.left,
      top: p.top, groundY: p.groundY, sprite: indices.get(p.sprite)! })),
    sprites: sprites.map(s => Object.freeze({ left: s.left, top: s.top, right: s.right, bottom: s.bottom,
      patches: [{ x: 0, y: 0, width: tileWidth, height: tileHeight },
        ...(s.decoded.extra ? [{ x: s.extraX, y: s.extraY, width: s.decoded.extra.width, height: s.decoded.extra.height }] : [])]
        .map(rect => Object.freeze({ ...rect, copy() {
          const rgba = new Uint8Array(rect.width * rect.height * 4), depth = new Int32Array(rect.width * rect.height);
          const d = s.decoded; let minDepth = 0, maxDepth = 0;
          // Each patch resolves the entire base/extra policy, including their overlap. No dense union allocation.
          for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) {
            const lx = x + rect.x, ly = y + rect.y, baseAt = ly * tileWidth + lx;
            const base = lx >= 0 && lx < tileWidth && ly >= 0 && ly < tileHeight && d.mask[baseAt] === 1;
            let covered = base, color = base ? d.pixels[baseAt]! : 0, z = base ? d.zPixels[baseAt]! : 0;
            const ex = lx - s.extraX, ey = ly - s.extraY;
            if (d.extra && ex >= 0 && ex < d.extra.width && ey >= 0 && ey < d.extra.height) {
              const at = ey * d.extra.width + ex, value = d.extra.pixels[at]!;
              if (value !== 0) { covered = true; color = value; }
              if (d.extra.zPixels[at]! < 32) z = d.extra.zPixels[at]!;
            }
            if (!covered || data.palette[color * 4 + 3] === 0) continue;
            const at = y * rect.width + x, value = ly - z;
            depth[at] = value; minDepth = Math.min(minDepth, value); maxDepth = Math.max(maxDepth, value);
            for (let c = 0; c < 4; c++) rgba[at * 4 + c] = data.palette[color * 4 + c]!;
          }
          return { rgba, depth, minDepth, maxDepth };
        } })),
    })),
  };
}

/** Synchronous CPU construction, intended for a worker. No file/catalog lookup and no inferred asset winner. */
export function createTerrainScene(input: TerrainSceneInput, options: Partial<Limits> = {}): TerrainScene {
  const cap = limits(options);
  fields(input, ['terrain', 'assets', 'choices', 'palette', 'projection']);
  const terrain = input.terrain;
  fields(terrain, ['schemaVersion', 'policy', 'profile', 'source', 'geometryComplete', 'size', 'cells', 'overlays', 'diagnostics'], false);
  fields(terrain.size, ['x', 'y', 'width', 'height']); fields(terrain.source, ['id', 'profile', 'sha256']);
  if (!Object.isFrozen(terrain) || !Object.isFrozen(terrain.cells) || !Object.isFrozen(terrain.size) || !Object.isFrozen(terrain.source) ||
      terrain.schemaVersion !== 1 || terrain.policy !== 'webra2-terrain-1' || terrain.geometryComplete !== true ||
      (terrain.profile !== 'ra2' && terrain.profile !== 'yr') || terrain.source.profile !== terrain.profile) fail('scene-terrain');
  id(terrain.source.id); hash(terrain.source.sha256);
  const source = Object.freeze({ id: terrain.source.id, profile: terrain.profile, sha256: terrain.source.sha256, verification: 'caller-provided' as const });
  integer(terrain.size.width, 1, 256); integer(terrain.size.height, 1, 256);
  if (terrain.size.x !== 0 || terrain.size.y !== 0) fail('scene-terrain-origin');
  array(terrain.cells, cap.cells); array(terrain.overlays, 262144); array(terrain.diagnostics, 1024);
  const count = (2 * terrain.size.width - 1) * terrain.size.height;
  if (terrain.cells.length !== count) fail('scene-terrain-count');
  const cells = new Map<number, Cell>(), coordinates = new Set<number>();
  let ignoredWords = 0, ignoredIce = 0;
  for (const cell of terrain.cells) {
    fields(cell, ['sourceRecord', 'x', 'y', 'projectedColumn', 'projectedRow', 'elevation', 'subtile', 'extraTileWord', 'iceRaw'], false);
    if (!Object.isFrozen(cell)) fail('scene-terrain-cell');
    integer(cell.sourceRecord, 0, count - 1); integer(cell.x, 1, 511); integer(cell.y, 1, 511);
    integer(cell.elevation, 0, 255); integer(cell.subtile, 0, 255); integer(cell.extraTileWord, 0, 65535); integer(cell.iceRaw, 0, 255);
    const column = cell.x - cell.y + terrain.size.width - 1, row = cell.x + cell.y - terrain.size.width - 1;
    if (cell.projectedColumn !== column || cell.projectedRow !== row || column < 0 || column > terrain.size.width * 2 - 2 ||
        row < 0 || row >= terrain.size.height * 2 || column % 2 !== row % 2 || cells.has(cell.sourceRecord) || coordinates.has(cell.x + 512 * cell.y)) fail('scene-terrain-cell');
    coordinates.add(cell.x + 512 * cell.y);
    cells.set(cell.sourceRecord, Object.freeze({ sourceRecord: cell.sourceRecord, x: cell.x, y: cell.y, column, row, elevation: cell.elevation, subtile: cell.subtile }));
    if (cell.extraTileWord) ignoredWords++; if (cell.iceRaw) ignoredIce++;
  }
  fields(input.projection, ['tileWidth', 'tileHeight', 'elevationStep']);
  const { tileWidth, tileHeight, elevationStep } = input.projection;
  if ((tileWidth !== 48 && tileWidth !== 60) || tileHeight !== tileWidth / 2) fail('scene-projection');
  integer(elevationStep, 0, 256, 'scene-projection');
  const projection = Object.freeze({ tileWidth, tileHeight, elevationStep });
  array(input.assets, cap.assets); array(input.choices, cap.cells);
  if (input.choices.length !== count) fail('scene-choice-count');
  const assetInputs = new Map<string, { id: string; sha256: string; bytes: Uint8Array; size: number }>();
  let sourceBytes = 0, temporarySourceBytesMax = 0;
  for (const asset of input.assets) {
    fields(asset, ['id', 'sha256', 'bytes']); id(asset.id); hash(asset.sha256);
    if (assetInputs.has(asset.id)) fail('scene-duplicate-asset');
    const size = byteSize(asset.bytes, 16, TMP_LIMITS.fileBytes);
    sourceBytes += size; if (sourceBytes > cap.sourceBytes) fail('scene-source-budget');
    temporarySourceBytesMax = Math.max(temporarySourceBytesMax, size);
    assetInputs.set(asset.id, { id: asset.id, sha256: asset.sha256, bytes: asset.bytes, size });
  }
  const choices = new Map<number, TerrainSceneChoice>(), usedAssets = new Set<string>();
  for (const choice of input.choices) {
    fields(choice, ['sourceRecord', 'assetId', 'subtile']); integer(choice.sourceRecord, 0, count - 1); id(choice.assetId); integer(choice.subtile, 0, 255);
    if (choices.has(choice.sourceRecord)) fail('scene-duplicate-choice');
    if (!assetInputs.has(choice.assetId)) fail('scene-missing-asset');
    if (choice.subtile !== cells.get(choice.sourceRecord)!.subtile) fail('scene-choice-subtile');
    choices.set(choice.sourceRecord, Object.freeze({ sourceRecord: choice.sourceRecord, assetId: choice.assetId, subtile: choice.subtile })); usedAssets.add(choice.assetId);
  }
  if (usedAssets.size !== assetInputs.size) fail('scene-unused-asset');
  const palette = copy(input.palette, byteSize(input.palette, 1024, 1024));
  for (let i = 3; i < palette.length; i += 4) if (palette[i] !== 0 && palette[i] !== 255) fail('scene-palette-alpha');
  // All source sizes, choices and the palette pass before any asset snapshot/hash.
  const parsed = new Map<string, { bytes: Uint8Array; index: TmpIndex }>();
  const snapshots = new Map<string, Uint8Array>(); let indexSlots = 0;
  const assets: { id: string; sha256: string; size: number; verification: 'sha256-verified' }[] = [];
  for (const asset of assetInputs.values()) {
    const bytes = copy(asset.bytes, asset.size);
    if (digest(bytes) !== asset.sha256) fail('scene-source-identity');
    const header = new DataView(bytes.buffer), columns = header.getUint32(0, true), rows = header.getUint32(4, true);
    if (!columns || !rows || columns > TMP_LIMITS.tiles || rows > Math.floor(TMP_LIMITS.tiles / columns)) fail('scene-index-limit');
    indexSlots += columns * rows; if (indexSlots > cap.indexSlots) fail('scene-index-limit');
    snapshots.set(asset.id, bytes);
    assets.push(Object.freeze({ id: asset.id, sha256: asset.sha256, size: asset.size, verification: 'sha256-verified' }));
  }
  for (const [assetId, bytes] of snapshots) {
    const index = parseTmpIndex(bytes);
    if (index.tileWidth !== tileWidth || index.tileHeight !== tileHeight) fail('scene-asset-dimensions');
    parsed.set(assetId, { bytes, index });
  }
  let decodedBytes = 0, decodeIndexVisits = 0;
  const selected = new Map<string, Map<number, Sprite | null>>();
  // Sum exact plane sizes for unique asset/slot pairs before allocating any decoded pixels.
  for (const choice of choices.values()) {
    let slots = selected.get(choice.assetId); if (!slots) { slots = new Map(); selected.set(choice.assetId, slots); }
    const index = parsed.get(choice.assetId)!.index, tile = index.tiles[choice.subtile];
    if (!tile) fail('scene-missing-slot');
    if (!tile.hasZ) fail('scene-unsupported-no-z');
    const cell = cells.get(choice.sourceRecord)!, left = cell.column * tileWidth / 2, top = cell.row * tileHeight / 2 - cell.elevation * elevationStep;
    const extraX = tile.hasExtra ? tile.extraX - (tile.column - tile.row) * tileWidth / 2 : 0;
    const extraY = tile.hasExtra ? tile.extraY - (tile.column + tile.row) * tileHeight / 2 : 0;
    for (const value of [extraX, extraY, extraX + (tile.hasExtra ? tile.extraWidth : 0), extraY + (tile.hasExtra ? tile.extraHeight : 0), left, top, left + tileWidth, top + tileHeight,
      left + extraX, top + extraY, left + extraX + (tile.hasExtra ? tile.extraWidth : 0), top + extraY + (tile.hasExtra ? tile.extraHeight : 0)]) {
      integer(value, -cap.coordinate, cap.coordinate, 'scene-coordinate-limit');
    }
    if (slots.has(choice.subtile)) continue;
    // decodeTmpTile reparses its fixed snapshot; cap those repeated metadata visits too.
    decodeIndexVisits += index.tiles.length; if (decodeIndexVisits > cap.decodeIndexVisits) fail('scene-decode-work-budget');
    decodedBytes += tileWidth * tileHeight * 3 + (tile.hasExtra ? tile.extraWidth * tile.extraHeight * 2 : 0);
    if (decodedBytes > cap.decodedBytes) fail('scene-decoded-budget');
    slots.set(choice.subtile, null);
  }
  const diagnostics: { code: string; count: number }[] = [];
  const diagnostic = (code: string, amount: number) => { if (amount) diagnostics.push(Object.freeze({ code, count: amount })); };
  diagnostic('native-composition-unverified', 1); diagnostic('caller-palette-no-lighting-or-remap', 1);
  diagnostic('terrain-diagnostics-present', terrain.diagnostics.length); diagnostic('overlays-not-rendered', terrain.overlays.length);
  diagnostic('tile-extra-word-not-interpreted', ignoredWords); diagnostic('ice-not-rendered', ignoredIce);
  let invalidDepth = 0, unknownFlags = 0, damaged = 0, unclaimed = 0, headerOrigin = 0, decodedSlots = 0;
  for (const [assetId, slots] of selected) {
    const asset = parsed.get(assetId)!;
    for (const ordinal of slots.keys()) {
      const decoded = decodeTmpTile(asset.bytes, ordinal), tile = decoded.tile;
      const slotX = (tile.column - tile.row) * tileWidth / 2, slotY = (tile.column + tile.row) * tileHeight / 2;
      const extraX = decoded.extra ? decoded.extra.x - slotX : 0, extraY = decoded.extra ? decoded.extra.y - slotY : 0;
      const left = Math.min(0, extraX), top = Math.min(0, extraY);
      const right = Math.max(tileWidth, decoded.extra ? extraX + decoded.extra.width : 0), bottom = Math.max(tileHeight, decoded.extra ? extraY + decoded.extra.height : 0);
      for (const value of [left, top, right, bottom]) integer(value, -cap.coordinate, cap.coordinate, 'scene-coordinate-limit');
      if (decoded.extra) for (const z of decoded.extra.zPixels) if (z >= 32) invalidDepth++;
      if (tile.reservedFlags) unknownFlags++; if (tile.hasDamaged) damaged++; if (tile.unclaimedRanges.length || decoded.index.unclaimedRanges.length) unclaimed++;
      if (tile.x !== slotX || tile.y !== slotY) headerOrigin++;
      // Do not retain a full index table per decoded slot.
      const planes = { pixels: decoded.pixels, zPixels: decoded.zPixels, mask: decoded.mask, extra: decoded.extra };
      slots.set(ordinal, { decoded: planes, extraX, extraY, left, top, right, bottom }); decodedSlots++;
    }
  }
  diagnostic('extra-depth-outside-0-31-preserves-underlying-depth', invalidDepth);
  diagnostic('reserved-tmp-flags-not-interpreted', unknownFlags); diagnostic('damaged-state-not-rendered', damaged);
  diagnostic('unclaimed-tmp-ranges-not-interpreted', unclaimed); diagnostic('header-origin-differs-from-slot-origin', headerOrigin);
  const placements: Placement[] = []; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cell of cells.values()) {
    const choice = choices.get(cell.sourceRecord)!, sprite = selected.get(choice.assetId)!.get(choice.subtile)!;
    const left = cell.column * tileWidth / 2, groundY = cell.row * tileHeight / 2, top = groundY - cell.elevation * elevationStep;
    for (const value of [left + sprite.left, top + sprite.top, left + sprite.right, top + sprite.bottom]) integer(value, -cap.coordinate, cap.coordinate, 'scene-coordinate-limit');
    minX = Math.min(minX, left + sprite.left); minY = Math.min(minY, top + sprite.top);
    maxX = Math.max(maxX, left + sprite.right); maxY = Math.max(maxY, top + sprite.bottom);
    placements.push({ cell, assetId: choice.assetId, sprite, left, top, groundY });
  }
  placements.sort((a, b) => a.cell.sourceRecord - b.cell.sourceRecord);
  const bounds = Object.freeze({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  const allocations = Object.freeze({ sourceSnapshotBytes: sourceBytes, temporarySourceBytesMax, decodedPlaneBytes: decodedBytes, paletteBytes: 1024, cells: count, decodedSlots });
  // Source snapshots/index tables become collectible; the scene retains selected planes and bounded placement metadata only.
  parsed.clear(); snapshots.clear(); assetInputs.clear(); selected.clear();
  function renderFrame(request: TerrainViewport, batch?: SpriteBatch): TerrainFrame | SpriteTerrainFrame {
      fields(request, ['cameraX', 'cameraY', 'zoom', 'width', 'height', 'backgroundRgba']);
      const { cameraX, cameraY, zoom, width, height } = request;
      if (typeof cameraX !== 'number' || typeof cameraY !== 'number' || !Number.isFinite(cameraX) || !Number.isFinite(cameraY) ||
          Math.abs(cameraX) > cap.coordinate || Math.abs(cameraY) > cap.coordinate || ![0.5, 1, 2, 4].includes(zoom)) fail('scene-camera');
      integer(width, 1, cap.viewportDimension, 'scene-viewport-limit'); integer(height, 1, cap.viewportDimension, 'scene-viewport-limit');
      const pixels = width * height; if (pixels > cap.viewportPixels) fail('scene-viewport-limit');
      array(request.backgroundRgba, 4); if (request.backgroundRgba.length !== 4) fail('scene-background');
      for (const component of request.backgroundRgba) integer(component, 0, 255, 'scene-background');
      const backgroundRgba = Object.freeze([...request.backgroundRgba]) as unknown as TerrainViewport['backgroundRgba'];
      const viewport = Object.freeze({ cameraX, cameraY, zoom, width, height, backgroundRgba });
      const sprites = batch === undefined ? null : prepareSpriteBatch(batch, viewport, cap.coordinate, cap.samples);
      const visible: { placement: Placement; x0: number; y0: number; x1: number; y1: number }[] = []; let samples = sprites?.samples ?? 0;
      for (const placement of placements) {
        const s = placement.sprite;
        const x0 = Math.max(0, Math.ceil((placement.left + s.left - cameraX) * zoom - 0.5)), y0 = Math.max(0, Math.ceil((placement.top + s.top - cameraY) * zoom - 0.5));
        const x1 = Math.min(width, Math.ceil((placement.left + s.right - cameraX) * zoom - 0.5)), y1 = Math.min(height, Math.ceil((placement.top + s.bottom - cameraY) * zoom - 0.5));
        if (x0 >= x1 || y0 >= y1) continue;
        samples += (x1 - x0) * (y1 - y0); if (samples > cap.samples) fail('scene-sample-budget');
        visible.push({ placement, x0, y0, x1, y1 });
      }
      const rgba = new Uint8Array(pixels * 4), depth = new Int32Array(pixels), owner = new Int32Array(pixels); owner.fill(-1); depth.fill(-2147483648);
      const objectOwner = sprites ? new Int32Array(pixels) : null; objectOwner?.fill(-1);
      for (let i = 0; i < pixels; i++) rgba.set(backgroundRgba, i * 4);
      for (const { placement: p, x0, y0, x1, y1 } of visible) {
        const { decoded: d, extraX, extraY } = p.sprite;
        for (let vy = y0; vy < y1; vy++) {
          const localY = Math.floor(cameraY + (vy + 0.5) / zoom) - p.top;
          for (let vx = x0; vx < x1; vx++) {
            const localX = Math.floor(cameraX + (vx + 0.5) / zoom) - p.left;
            const baseAt = localY * tileWidth + localX;
            const base = localX >= 0 && localX < tileWidth && localY >= 0 && localY < tileHeight && d.mask[baseAt] === 1;
            let covered = base, color = base ? d.pixels[baseAt]! : 0, z = base ? d.zPixels[baseAt]! : 0;
            const ex = localX - extraX, ey = localY - extraY;
            if (d.extra && ex >= 0 && ex < d.extra.width && ey >= 0 && ey < d.extra.height) {
              const at = ey * d.extra.width + ex, value = d.extra.pixels[at]!;
              if (value !== 0) { covered = true; color = value; }
              if (d.extra.zPixels[at]! < 32) z = d.extra.zPixels[at]!;
            }
            if (!covered || palette[color * 4 + 3] === 0) continue;
            const at = vy * width + vx, candidateDepth = p.groundY + localY - z, prior = owner[at]!;
            // Larger depth is nearer. Equal depth selects the lower original source-record index.
            if (candidateDepth < depth[at]! || (candidateDepth === depth[at]! && prior >= 0 && prior < p.cell.sourceRecord)) continue;
            depth[at] = candidateDepth; owner[at] = p.cell.sourceRecord;
            for (let channel = 0; channel < 4; channel++) rgba[at * 4 + channel] = palette[color * 4 + channel]!;
          }
        }
      }
      const pick = (viewX: number, viewY: number): TerrainPick | null => {
        if (!Number.isFinite(viewX) || !Number.isFinite(viewY) || viewX < 0 || viewY < 0 || viewX >= width || viewY >= height) return null;
        const px = Math.floor(viewX), py = Math.floor(viewY), at = py * width + px, record = owner[at]!;
        if (record < 0) return null;
        const p = placements[record]!;
        return Object.freeze({ sourceRecord: record, x: p.cell.x, y: p.cell.y, assetId: p.assetId, subtile: p.cell.subtile,
          worldX: Math.floor(cameraX + (px + 0.5) / zoom), worldY: Math.floor(cameraY + (py + 0.5) / zoom), depth: depth[at]! });
      };
      const pixelAllocations = { rgbaBytes: rgba.byteLength, depthBytes: depth.byteLength, ownerBytes: owner.byteLength, totalPixelBytes: pixels * 12, samples };
      if (!sprites || !objectOwner) return Object.freeze({ rgba, viewport, allocations: Object.freeze(pixelAllocations), pick });
      sprites.paint((at, candidateDepth, object, front, r, g, b) => {
        const priorObject = objectOwner[at]!;
        if (candidateDepth < depth[at]!) return;
        if (candidateDepth === depth[at]!) {
          if (priorObject >= 0 && priorObject < object) return;
          if (priorObject < 0 && owner[at]! >= 0 && !front) return;
        }
        depth[at] = candidateDepth; objectOwner[at] = object;
        rgba[at * 4] = r; rgba[at * 4 + 1] = g; rgba[at * 4 + 2] = b; rgba[at * 4 + 3] = 255;
      });
      return Object.freeze({ rgba, viewport, policy: SPRITE_LAYER_POLICY,
        allocations: Object.freeze({ ...pixelAllocations, totalPixelBytes: pixels * 16, objectOwnerBytes: objectOwner.byteLength,
          spriteSamples: sprites.samples, paletteBytes: sprites.paletteBytes, objects: sprites.objects }),
        pick(viewX: number, viewY: number) {
          if (!Number.isFinite(viewX) || !Number.isFinite(viewY) || viewX < 0 || viewY < 0 || viewX >= width || viewY >= height) return null;
          const px = Math.floor(viewX), py = Math.floor(viewY), at = py * width + px, object = objectOwner[at]!;
          if (object >= 0) return sprites.pick(object, Math.floor(cameraX + (px + 0.5) / zoom), Math.floor(cameraY + (py + 0.5) / zoom), depth[at]!);
          const terrain = pick(viewX, viewY); return terrain ? Object.freeze({ kind: 'terrain' as const, ...terrain }) : null;
        },
      });
  }
  const scene = Object.freeze({ policy: TERRAIN_SCENE_POLICY, nativeBehaviorVerified: false as const, source, assets: Object.freeze(assets), projection, bounds,
    diagnostics: Object.freeze(diagnostics), allocations,
    render: (request: TerrainViewport): TerrainFrame => renderFrame(request) as TerrainFrame,
    renderSprites: (request: TerrainViewport, batch: SpriteBatch): SpriteTerrainFrame => {
      if (batch === undefined) fail('scene-sprite-batch');
      return renderFrame(request, batch) as SpriteTerrainFrame;
    },
  });
  scenes.set(scene, { placements, palette, cap }); return scene;
}
