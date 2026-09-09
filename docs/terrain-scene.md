# CPU terrain scene

[Issue #83](https://github.com/lictl/WebRA2/issues/83) adds
[createTerrainScene](../packages/render/src/terrain-scene.ts), a bounded CPU
compositor over [compiled map geometry](scenario-terrain.md) and
[TMP decoding](tmp-decoder.md). It renders caller-selected terrain pixels and
provides visible-cell picking from the same depth/owner result. It does not select
files, variants, palettes, rules or missions, and makes no native rendering or
campaign-playability claim.

## Inputs and ownership

```ts
const scene = createTerrainScene({
  terrain, // Frozen ScenarioTerrain from compileScenarioTerrain.
  assets: [{ id: 'selected-tile', sha256, bytes }],
  choices: terrain.cells.map(cell => ({
    sourceRecord: cell.sourceRecord,
    assetId: 'selected-tile',
    subtile: cell.subtile,
  })),
  palette, // Uint8Array: exactly 256 RGBA entries.
  projection: { tileWidth: 60, tileHeight: 30, elevationStep: 15 },
});
const frame = scene.render({
  cameraX: scene.bounds.x, cameraY: scene.bounds.y,
  zoom: 1, width: 640, height: 480,
  backgroundRgba: [0, 0, 0, 255],
});
const visibleCell = frame.pick(100, 80); // null for background/transparent pixels.
// frame.rgba is a caller-owned row-major RGBA array.
```

The example projection is an explicit caller choice; it is not evidence that 15
is the correct native elevation step for every installation or mod. The selected
TMP dimensions must match the projection (60×30 or 48×24). Elevation step is an
integer from 0 to 256. The source map hash is retained as **caller-provided**
provenance, since the scene receives compiled geometry rather than map bytes.
Each asset SHA-256 is checked over its own fixed snapshot using the already pinned
[`@noble/hashes` dependency](../packages/vfs/HASH_PROVENANCE.md); mismatches throw.
No sentinel hash or unverified source is used as a cache identity.

Every cell needs exactly one choice, including clear-tile sentinel cells after
explicit [theater resolution](theater-tiles.md). The choice must retain the map's
subtile. Missing/duplicate choices, missing/empty TMP slots, absent Z planes,
unreferenced/duplicate asset IDs and dimension mismatches fail explicitly. Asset
records have exactly `id`, `sha256`, `bytes`; callers project those fields from
richer source metadata. IDs are bounded ASCII identifiers, not filesystem paths
to open. The renderer performs no filesystem, network, DOM or catalog operations.

Input records use own data properties and dense arrays. Geometry/provenance is
validated and copied from frozen compiler output; arbitrary caller index tables
cannot authorize pixels. Byte inputs must be ordinary fixed `Uint8Array` views;
shared/resizable backing memory and subclasses are unsupported. Palette and asset
bytes are copied before use. Palette alpha is restricted to **0 or 255**; partial
alpha is unsupported because this baseline has no blending/ownership policy.

Only selected slots are decoded, once per asset ID/subtile pair. The scene retains
their color/depth/mask/extra planes, copied palette and bounded placement metadata;
it releases source snapshots and avoids retaining an entire TMP index per slot.
Scene metadata is frozen. Every render allocates a new image and private depth and
owner buffers. Mutating `frame.rgba` does not change picking or later renders.
The caller owns scene/frame lifetime; there is no hidden frame cache. Holding many
frames or requesting many copies is outside the per-frame allocation bound.

## Versioned composition policy

`webra2-terrain-scene-1` is a WebRA2 CPU baseline, with
`nativeBehaviorVerified: false`. It uses integer scene pixels before zoom:

- Cell rectangle origin: `left = projectedColumn * tileWidth / 2`,
  `groundY = projectedRow * tileHeight / 2`,
  `top = groundY - elevation * elevationStep`.
- An extra plane's local origin subtracts the selected TMP slot's template
  position: `extraX - (slotColumn-slotRow)*tileWidth/2` and
  `extraY - (slotColumn+slotRow)*tileHeight/2`. Header `x/y` differences are
  diagnosed; they do not silently change this slot-relative policy.
- The decoded diamond mask determines base coverage. **Index zero remains a
  covered diamond pixel** and uses caller palette entry zero. Outside the mask is
  uncovered regardless of that palette entry.
- Extra color zero retains the underlying diamond color/coverage. Nonzero extra
  color replaces it, including when its palette entry is fully transparent.
  Inside the extra rectangle, a raw extra depth below 32 replaces the underlying
  depth independently of extra color. Values 32–255 preserve base depth (or zero
  outside the diamond) and are counted diagnostically.
- Covered pixels whose final palette alpha is zero write neither color, depth nor
  ownership. No damaged-state choice, ice animation, lighting, remap, overlay,
  object or shadow layer is inferred. Diagnostics count the relevant omitted
  terrain data, reserved TMP flags and unclaimed ranges.
- Pixel depth is `groundY + localY - rawDepth`, where `localY` is relative to the
  selected cell's rectangle origin. Larger depth wins. Equal depth chooses the
  **lower original `sourceRecord`**. This fixed integer depth ramp and tie policy
  are WebRA2 decisions; they are not a reproduction of native Z buffering, OpenGL
  depth normalization, OpenRA per-tile Z offsets or lighting.

Bounds enclose all selected diamond/extra rectangles, including transparent holes
and the TMP diamond's empty final row. They can be negative after elevation/extra
placement. A whole-map color canvas is never allocated.

Camera coordinates are finite scene-pixel numbers (fractional pan is supported).
At output integer pixel `(px,py)`, nearest-neighbor sampling is
`floor(camera + (pixel + 0.5) / zoom)`, independently on both axes. Supported zooms
are 0.5, 1, 2 and 4. Clipping uses the same pixel-center inequalities. `pick(x,y)`
uses the containing output pixel; it returns source record, map cell, asset ID,
subtile, sampled scene coordinates and the winning depth. Out-of-viewport,
non-finite, background and fully transparent positions return null. Picking is
visible ownership, not geometric selection of an obscured cell.

## Bounds and work

All options may lower, never raise, these hard limits:

| Resource | Limit / accounting |
| --- | --- |
| Cells / asset IDs | 130,816 / 1,024 |
| Source snapshots | 128 MiB aggregate, with existing TMP 16 MiB per source |
| TMP index metadata | 65,536 aggregate slots; 1,048,576 total slot visits across repeated decoder index parses |
| Selected decoded planes | 64 MiB; exact `3*diamondRectangleArea + 2*extraArea` per unique selected slot |
| Scene/camera coordinate magnitude | 1,048,576 pixels; no whole-map allocation |
| Viewport | 2,048 per dimension and 4,194,304 pixels |
| Render work | 67,108,864 sampled cell-rectangle/output-pixel intersections before image allocation |
| Palette | 1,024 bytes |

Source count/size and choices pass before asset copies/hashes. All index-slot,
selected-plane, coordinate and decoder-work checks precede pixel decoding. The
underlying TMP reader independently checks index/record/plane bounds. Render
dimensions and aggregate visible sampling work pass before image/depth/owner
allocation; many overlapping extra rectangles cannot bypass that work cap.

`scene.allocations` reports construction source snapshot bytes, maximum temporary
single-source copy, retained decoded-plane bytes, palette bytes, cell count and
unique decoded slots. `frame.allocations` reports four bytes each for RGBA, signed
integer depth and signed integer owner: **12 bytes per output pixel**, at most
48 MiB, plus bounded visible-rectangle metadata. These are explicit pixel/source
allocations, not measured process RSS or a claim about JavaScript object overhead.
The synchronous hashing/decoding/rendering API is intended to run in a worker at
browser integration. Cancellation, cooperative scheduling, GPU presentation and
frame lifetime limits across requests belong to that integration boundary.

## Primary references and licensing

The module/tests/documentation are **GPL-3.0-or-later**, with original synthetic
fixtures by WebRA2 contributors. The slot-relative placement and extra composition
are informed by OpenRA Developers and Contributors. Existing TMP parsing/diamond
work retains its [OpenRA/XCC provenance](../packages/formats/TMP_PROVENANCE.md).
No game binary listing or retail image is included.

All OpenRA references below are pinned at
`f3ec7f8e1593b482f85fd101652deb740c33dee6`; source anchors were checked against raw
file line numbers:

- [TmpTSLoader.cs, lines 48–111](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/SpriteLoaders/TmpTSLoader.cs#L48-L111):
  slot-relative extra origin, nonzero extra color, independent extra-depth `<32`
  replacement. Base index-zero coverage is kept separately here to avoid conflating
  the diamond mask with a palette transparency choice.
- [TerrainSpriteLayer.cs, lines 99–110](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Game/Graphics/TerrainSpriteLayer.cs#L99-L110)
  and [WorldRenderer.cs, lines 415–425](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Game/Graphics/WorldRenderer.cs#L415-L425):
  terrain sprite placement and separation of screen Y, elevation and screen depth.
- [Sprite.cs, lines 32–39](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Game/Graphics/Sprite.cs#L32-L39),
  [Util.cs, lines 45–61](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Game/Graphics/Util.cs#L45-L61)
  and [DefaultTileCache.cs, lines 99–114](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Common/Terrain/DefaultTileCache.cs#L99-L114):
  sprite depth ramp and optional tile offsets; this baseline fixes a unit ramp.
- [SpriteRenderer.cs, lines 264–290](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Game/Graphics/SpriteRenderer.cs#L264-L290)
  and [combined.frag, lines 192–205](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/glsl/combined.frag#L192-L205):
  transparent fragment rejection and depth-texture contribution. The CPU integer
  formula above is explicitly not OpenGL's normalized-depth arithmetic.

## Validation and remaining integration

Run with the repository's documented Node 24 toolchain:

```sh
node --import tsx --test tests/render/terrain-scene.test.ts
npm run check
git diff --check
```

The original synthetic tests cover distinct diamonds/index zero, elevation,
per-pixel depth, equal-depth ties and reordered inputs, slot-relative extras,
transparent occlusion, invalid extra-depth fallback, pixel-center zoom/fractional
pan/clipping, mutation, malformed metadata/choices/slots and aggregate limits.
Standalone synthetic image evidence is generated under ignored `local/` and
visually inspected during review. No retail rendering or four-browser frame-time
claim follows from these tests; selected opening assets, caller palette conversion
and actual browser camera/input acceptance remain subsequent integration gates.
