# Bounded SHP object composition

[Issue #99](https://github.com/lictl/WebRA2/issues/99) adds an owned selected-frame
sprite atlas and `scene.renderSprites(viewport, batch)` to the CPU terrain renderer.
The existing `scene.render(viewport)` API, terrain-only RGBA/picks, and its 12-byte
per-pixel allocation remain unchanged. There is no browser integration or campaign
readiness claim in this component.

## Inputs and ownership

Import `createSpriteAtlas`, `SpriteBatch`, `SpriteObject`, `SpritePalette` and
`SpriteTerrainFrame` from [sprite-layer.ts](../packages/render/src/sprite-layer.ts).
Create the terrain scene with its existing explicit compiler output, selected TMP
slots, palette and projection; see [terrain-scene.md](terrain-scene.md).

```ts
const atlas = createSpriteAtlas({
  assets: [{ id: 'building-source', sha256: expectedShpSha256, bytes: suppliedShp }],
  frames: [{ id: 'building-frame', assetId: 'building-source', frame: selectedFrame }],
});
const frame = scene.renderSprites(viewport, {
  atlas,
  palettes: [{ id: 'chosen-palette', rgba: suppliedRgba, remap: null, transparentIndex: 0 }],
  objects: [{
    id: 'object-17', frameId: 'building-frame', paletteId: 'chosen-palette',
    x: 120, y: 90, anchorX: 40, anchorY: 60,
    depth: { base: 90, rowStep: 0, terrainTie: 'front' },
  }],
});
const visible = frame.pick(120, 90); // {kind:'object', ...}, {kind:'terrain', ...}, or null
```

The scene's bounds remain terrain bounds; a sprite batch does not resize the map.
Objects outside those bounds can still render inside the requested viewport.
The example's frame, anchor and depth are caller policies. They do not select a
native animation sequence or infer building foundations from its filename.
`x/y` use **scene pixels**, before the existing camera and zoom transform; they
are not map-cell coordinates or viewport pixels. Values and anchors are integers.
An odd-sized canvas has no implicit half-pixel center: the caller chooses an anchor.

Asset and frame IDs are unique, bounded, case-sensitive ASCII identifiers. Each
selected `(assetId, frame)` pair appears once; one selected frame can be referenced
by many objects. Unused asset sources and missing frames fail. Different assets
may deliberately have identical bytes/hashes: each supplied ID is still checked
and charged in full. There is no silent physical asset selection or deduplication.
Shared payload offsets at distinct SHP frame ordinals remain distinct selections,
including their different rectangle positions. The decoder validates their layout.

The atlas validates count and byte budgets before source copies/hashes. It verifies
each complete expected SHA-256 against its owned snapshot, indexes the source, then
preflights all selected encoded ranges and decoded pixel sizes before decoding.
Source/index snapshots can become collectible after construction. The atlas retains
only selected private pixel planes and frozen metadata, not a whole-sheet texture.
No pixel array or decoder handle is exposed. An empty selection is allowed only
with no asset sources. Empty SHP records remain empty; opaque index-zero rectangles
remain a different case.

`renderSprites` accepts only a real atlas from this module, not a reconstructed
metadata object. Atlas construction and rendering are synchronous and intended for
a worker; an atlas cannot be structured-cloned into another worker. Send bounded
source bytes/selections and construct it in the worker that renders. Worker request
lifetimes, cancellation and animation scheduling remain the integration's concern.

Each render validates and detaches palette/remap bytes and all object/depth scalars.
Object IDs and palette IDs must be unique; unused palettes, missing references,
unknown fields, accessors, sparse arrays, foreign containers and invalid numbers
fail. Native fixed `Uint8Array` inputs use intrinsic byte bounds; shared/resizable
buffers and subclasses are rejected. The frame retains captured placement and
palette state for picking. Mutating inputs, returned RGBA, or a later batch cannot
alter an earlier frame's owner/depth results. Retained frames can retain referenced
atlas planes; release old frames to release their lifetimes.

## Explicit pixel policy

`webra2-sprite-layer-1` uses the existing terrain pixel-center camera sampling:
`floor(camera + (outputPixel + 0.5) / zoom)`, with zoom 0.5, 1, 2 or 4. All clipping
uses the same inequalities; no full-map color canvas is allocated.

For a selected SHP rectangle `(frame.x, frame.y, width, height)`:

- Rectangle origin is `left = x - anchorX + frame.x`,
  `top = y - anchorY + frame.y`. The original unpadded rectangle is preserved.
- `transparentIndex` is one original source index, or `null` for none. It is
  discarded **before remap**. `remap` is either `null` for identity or exactly 256
  destination indices, not an implicit native house-color range.
- `rgba` contains exactly 256 RGBA entries. Each alpha must be 0 or 255. The
  remapped index chooses this palette; alpha-zero fragments write no color, depth
  or owner. An index mapped to an alpha-zero destination reveals the prior owner.
  The atlas does not convert a raw PAL, infer its pairing, or modify palette values.
- Sprite depth is `base + localRectangleRow * rowStep`, where `rowStep` is 0 or 1.
  Larger depth wins, in the terrain renderer's existing integer depth space.
  A sprite equal to existing terrain is eligible only with `terrainTie: 'front'`.
  Equal-depth eligible objects select the lower stable ASCII object ID, independent
  of input order. A nearer terrain fragment remains visible over a farther sprite.
- Shadow halves, translucent blending, sprite Z textures, rotation, native normal
  lighting, remap ramps and animation are not interpreted. Decoder diagnostics
  retain auxiliary-word, trailing-byte and terminal-zero clipping observations.

The [pinned source review](../packages/render/SPRITE_PROVENANCE.md) supports keeping
canvas offsets, placement, palette and depth separate, and discarding transparent
fragments before depth writes. It does not establish the integer depth/tie policy
above as native behavior. OpenRA pads odd SHP rectangles and applies its own world
position, tint and normalized GPU depth math; this API exposes unpadded integer
choices. The existing TMP extra-color/depth policy was rechecked against its pinned
source and remains unchanged.

`frame.pick(x,y)` returns the visible owner's kind. Terrain picks retain every
existing terrain field. Object picks return `id`, `frameId`, `assetId`, selected
frame ordinal, `paletteId`, sampled `canvasX/canvasY`, `worldX/worldY`, and depth.
Fractional view positions pick their containing output pixel. Background,
out-of-viewport and non-finite positions return null. Fully obscured objects are
not selected geometrically. Picking never consults the caller's mutable RGBA.

## Limits and allocation accounting

`createSpriteAtlas(input, lowerLimits?)` permits only lower versions of these caps:

| Resource | Hard cap |
| --- | --- |
| Asset IDs / selected frames | 1,024 / 4,096 |
| Aggregate indexed SHP headers | 65,536; underlying decoder also caps each source at 4,096 |
| Source bytes | 128 MiB aggregate; existing decoder caps each file at 16 MiB |
| Selected encoded frame ranges | 128 MiB, counting every selected ordinal including shared aliases and trailing bytes |
| Selected decoded index planes | 64 MiB; each selected rectangle is charged its full area before any decode |
| Palettes / objects in each render | 256 / 32,768 |

The frame decoder also caps dimensions at 2,048 and each frame at 4,194,304 pixels.
Atlas allocation metadata reports aggregate `sourceSnapshotBytes`, maximum extra
single-source snapshot, retained `decodedPixelBytes`, maximum extra single decoded
frame copy, `indexedFrames`, and `encodedFrameBytes`. The decoder's internal pixels
coexist briefly with the owned copy; this extra copy is reported separately from
retained planes. Every selected payload is decoded once, even if reused by many
objects. Alias ranges are charged again so index reuse cannot evade decode work.

Scene/camera/anchor/rectangle endpoints and both sprite depth endpoints have absolute
limits of 1,048,576, lowered by the terrain scene's coordinate limit. Viewports retain
the existing 2,048 dimension / 4,194,304 pixel caps. The existing 67,108,864 sample
budget now applies to **terrain plus sprite rectangle/output-pixel intersections**
in a combined render, including transparent samples. Count/coordinate/palette checks
and aggregate visible work checks complete before painting or pixel-buffer allocation.

A combined frame owns RGBA, depth, terrain owner and object owner arrays: **16 bytes
per output pixel**, at most 64 MiB, plus up to 327,680 palette/remap bytes. Its sample
count includes terrain and sprites; `spriteSamples` is also reported separately.
Palette bytes and object counts are explicit. Arrays/records, engine overhead and
simultaneous caller-held frames are not an RSS estimate or covered by a global
memory cap. No renderer frame rate or result influences simulation state.

## Validation

```sh
node --import tsx --test tests/render/terrain-scene.test.ts tests/render/sprite-layer.test.ts
npm run check
git diff --check
```

Original tests cover offsets/canvas picking, terrain elevation and depth occlusion,
constant/ramped depths and cross-kind ties, reordered equal-depth object IDs,
transparent originals and remapped alpha-zero holes, every supported zoom and
fractional/negative camera clipping, detached state, empty/zero frames, duplicate
identities, unsupported references, source hash checks, shared-payload decode-work
limits, malformed inputs and aggregate allocations. All existing terrain tests run.

After integration with the current application and coordinator-owned copied notices,
all **444 public tests** pass, including seven build/server boundary tests. Strict
types, 78 Markdown files / 380 local links, 280 publication paths, M0 evidence and
the actual development build pass. The integrated build contains 31 code/license
files from 68 approved inputs, including the sprite, voxel and mission-runtime
notices. These counts describe this issue's checked integrated revision.

Private checks re-read five SHP sources and two explicit diagnostic PAL candidates
against complete root/member hashes. A separate Python interpreter rehashes roots,
rereads ranges and decodes ten selected frames; all **84,925 indices** agree. It
independently rasterizes the original synthetic terrain plus six explicit sprite
placements, then compares every RGBA, owner and depth value across **725,000 output
pixels**. Images were inspected locally. No retail image or pixel array is published.

The two viewports are a mixed-source diagnostic composition, not a mission or
cross-profile asset selection policy. The two unit palettes were deliberately
selected and converted by `component << 2`; the explosion's conspicuous colors show
that this is not proof of its native palette pairing. The second view deliberately
remaps source indices 16–31 to 80–95 and uses a fractional camera at 2x zoom. Visible
building/infantry edges, transparent holes, remapped regions and viewport clipping
were inspected; native frame choice, shadowing, anchoring and rendering fidelity
remain unverified.

| Private viewport | Size / zoom | Visible sprite pixels | RGBA SHA-256 |
| --- | --- | --- | --- |
| Normal diagnostic | 800×400 / 1 | 28,548 | `350a17334da8078ae959aa9f5749095c05d59b3069c2f4529a1de10275317fac` |
| Remapped close view | 900×450 / 2 | 102,488 | `da388c11d2a0b6c709b1d0edcf9de7f2a6d5c2dcd55d35e97ddbe3ecc293cdce` |

The private scripts and images are under this issue's ignored worktree `local/`:
`extract.ts`, `render-private.ts`, `oracle.py`, `render-metadata.json`, `normal.png`,
and `remapped-close.png`. Reviewers rerun from an isolated checkout with those scripts'
imports resolved to the reviewed source. Private corpus absence is a skipped gate.
Metadata source identities follow; file basenames are traceable candidates, not
native selection proof. All range offsets are absolute within the named root.

| Source | Root | Offset / bytes | Member SHA-256 |
| --- | --- | --- | --- |
| `gi.shp` | `ra2.mix` | 10016536 / 186032 | `bceaee9c270d6382d80d509f2c4b2893c10565f779096b3add37a4d5321e8be1` |
| `gtpowexp.shp` | `ra2.mix` | 3057400 / 116536 | `fe91dac9230d1febda143fbcec2dd8be30a9ac071c1ec2b822a1bbf71f8dbd10` |
| `gacnst.shp` | `ra2.mix` | 244635442 / 63736 | `136ba846085ecbbce35630ce2cc7eff4cd1c9d547de2ed0764df393d77f73e58` |
| `gaspst.shp` | `ra2.mix` | 256019122 / 19592 | `ca197b6a60344ee4b5688d164dbe244aec70e6471b6eacce25cd94026c8ff6cc` |
| `ggi.shp` | `ra2md.mix` | 1704744 / 229016 | `736bb542838bb62e556f9fabdf26b2ac2bd49068e35228d836fe8eac44fa7744` |
| `uniturb.pal` | `ra2.mix` | 164208 / 768 | `ed785e62eed291480f3198dd44f6b656ebe3a9b75e9f641944d710abc6bde3e3` |
| `unitubn.pal` | `ra2md.mix` | 4496 / 768 | `ed785e62eed291480f3198dd44f6b656ebe3a9b75e9f641944d710abc6bde3e3` |

| Root | SHA-256 |
| --- | --- |
| `ra2.mix` | `896a8b64f9f1bb8ad5e0bc64fc0b8ea8c84112494761ea1a43478d10c5ef9914` |
| `ra2md.mix` | `69d886defad9114dd440a013b364c8c004e369b5221d1889957b49d00058559d` |
