# Bounded explicit voxel rasterizer

[Issue #112](https://github.com/lictl/WebRA2/issues/112) adds a standalone pure CPU
component in [voxel-render.ts](../packages/render/src/voxel-render.ts). It composes
the [VXL/HVA decoders](voxel-decoder.md) and leaves existing terrain/sprite APIs
unchanged. It is intended to run in a worker. There is no DOM, I/O, simulation,
wall-clock, animation scheduler or automatic filename/profile choice.
Every output states `nativeBehaviorVerified: false`.

## Inputs and ownership

`createVoxelAtlas({assets, parts}, lowerLimits?)` accepts source assets
`{id, kind: 'vxl'|'hva', sha256, bytes}` and parts
`{id, vxlAssetId, vxlSection, hva, transformPolicy}`. `hva` is explicitly null
(identity pose) or `{assetId, layout, frame, section}`. The only transform policy
is `openra-hva-bounds-scale`; layout must be `frame-major` or `section-major`.
The component never guesses a layout, section correspondence, body/turret/barrel
association, physical archive winner or animation frame.

All source sizes and binding counts are checked before any source copy/hash. The
atlas hashes fixed owned snapshots against the required SHA-256, then preflights
every VXL span and all HVA matrix records with remaining aggregate budgets.
Sparse geometry for each distinct selected VXL section is retained privately;
different poses can share it. Duplicate IDs, duplicate exact binding tuples,
unused assets, incompatible source kinds, conflicting layout choices for one HVA,
unknown selected normal formats and unsupported transforms fail explicitly. Identical bytes
under separate asset IDs consume separate source budgets; byte hashes do not imply
the caller's semantic names are authentic.

Metadata freezes source IDs/hashes/sizes, selected VXL header/footer fields and
float bits, selected HVA record/offset/raw matrix bits/values, layout and applied
model matrix. The atlas is locally branded; JSON or structured cloning cannot
recreate its private geometry capability. Caller byte mutations cannot change it.
This metadata contains player-supplied names and geometry parameters: it is **not
a public-report sanitizer**. Render images, palettes, atlas metadata and picks
must stay on-device/private unless separately reviewed for publication.

`renderVoxelFrame({atlas, instances, palettes, viewport, lighting:'unlit'}, lowerLimits?)`
accepts instances `{id, partId, paletteId, modelToView}`. `modelToView` is a plain
array containing exactly 12 finite row-major affine values. Its rows produce
pixel X, pixel Y and depth, with greater depth nearer. It includes all caller
facing, world placement and orthographic projection choices. Perspective is not
supported. Every palette is `{id, rgba, remap, transparentIndex}` with exactly
1,024 RGBA bytes, a null or 256-byte index remap, and a null or byte original
transparent index. Palette alpha and the four-byte background allow only 0/255.
Palette IDs must be unique and used by an instance. Inputs require dense ordinary
arrays/records and fixed native Uint8Arrays; shared, resizable or detached buffers,
accessor fields, malformed references and repeated IDs fail.

The frame owns mutable `rgba`, `width`, `height`, allocation counts, `copyDepth()`
and `pick(x,y)`. `copyDepth()` returns a fresh Float64Array; empty pixels contain
negative infinity. `pick` returns null or frozen instance/part/source-section,
voxel ordinal, local x/y/z, original color/normal index and near-surface depth.
Private depth/owner arrays are independent of returned RGBA/depth copies.

## Explicit transform and raster policy

The [pinned OpenRA reference](../packages/render/VOXEL_PROVENANCE.md) supports the
named policy, rather than a native behavior claim. Let `s` be VXL footer scale,
`bmin/bmax` the bounds and `n` the integer section dimensions. Starting from the
chosen row-major HVA matrix `H` (identity for null), adjust each translation:

```text
H[k,3] *= s * (bmax[k] - bmin[k]) / n[k]
model = Scale(s, -s, s) * H * Translate(bmin)
view  = callerModelToView * model
```

Occupied records represent unit cubes `[x,x+1] × [y,y+1] × [z,z+1]` before that
transform. The stored VXL footer matrix is preserved and diagnosed as not applied.
Known normal formats 2/4 are accepted, but normal indices are unused and are not
validated against or mapped through a normal-vector table. No native light,
normal rotation, house remap, palette association, gamma or shadow is inferred.

Rendering intersects a ray at each pixel center with the transformed cube using
the inverse affine matrix and slab intervals. Positive-length intersections use
the nearest surface; tangencies are excluded. A parallel ray owns a slab's lower
edge and excludes its upper edge. Higher binary64 depth wins. Exact computed-depth
ties preserve the lexicographically smaller explicit instance ID, then the lower
decoded voxel ordinal (y, x, z order). Input instance enumeration cannot change
the result. No depth epsilon is applied by the renderer.

An original index matching `transparentIndex` is skipped before remapping.
Remapped alpha-zero pixels also skip depth and owner updates. Opaque colors write
the selected RGBA and ownership together. Empty/offscreen geometry preserves the
background and null ownership; it is never replaced with a placeholder model.
Binary64 operations are a rendering policy, not simulation determinism or an
OpenRA/native framebuffer equivalence guarantee.

## Limits and failure behavior

Every option can lower a hard cap only. Per-frame caps also cannot exceed the
atlas's selected caps. Decoder per-source maxima still apply.

| Budget | Hard maximum |
| --- | --- |
| Assets / selected parts | 256 / 256 |
| Aggregate source bytes / single source | 128 MiB / 16 MiB |
| VXL sections / columns / runs | 2,048 / 1,048,576 / 4,194,304 |
| Decoded source voxels / selected part voxels | 1,048,576 / 1,048,576 |
| HVA matrix records | 65,536 |
| Palettes / instances | 256 / 4,096 |
| Instance voxels per frame | 1,048,576 |
| Viewport dimension / pixel count | 1,024 / 1,048,576 |
| Projected rectangle samples per frame | 67,108,864 |

All matrix components, inverses, bounds and transformed section corners must be
finite within ±1,048,576. Scale must be positive and at most 4,096; each bound extent
must be positive. Linear matrices must be invertible and their infinity-norm
condition estimate no greater than 100,000,000. Unknown/singular input is not
coerced into identity. Small negative zero float components remain representable;
integer counts/coordinates reject negative zero.

Before any framebuffer/depth/owner allocation or painting, the renderer validates
all instances, bounds aggregate instance voxels, allocates a bounded four-int
clipped rectangle per voxel, and charges all rectangle samples. The conservative
charge includes transparent voxels and overlapping work; offscreen rectangles
charge zero. A budget error returns no partial frame. Source parsing/decode,
palette snapshots and the projection preflight itself are bounded earlier work.

At the largest frame caps, explicit image/depth/owner buffers occupy 4/8/4 MiB;
the rectangle work buffer occupies at most 16 MiB, palettes at most 320 KiB and
unique retained geometry at most 5 MiB. Each caller-retained depth copy adds up to
8 MiB. Source readers/snapshots are transient during atlas creation; their source
budget is separate. These are named typed-array bounds, not a JavaScript heap/RSS
or browser responsiveness guarantee. Callers should use lower measured scene
budgets and discard frames/atlases when done; this synchronous component has no
mid-call cancellation mechanism.

## Verification

Thirteen original synthetic tests cover cube surface depth, oblique intersections,
near/far occlusion, source transparency/remapped alpha, stable exact ties, HVA pose
and divergent layout records, footer/bounds/scale/Y flip, ownership, malformed
geometry/references/matrices, aggregate source/decode/sample budgets, storage
aliases, empty geometry and offscreen output.

```sh
node --import tsx --test tests/render/voxel-render.test.ts
npm run check
```

Private scripts remain in this task's ignored `local/`: `extract.ts` reads genuine
File-backed catalog sources; `render-probe.ts` invokes the actual component;
`oracle.py` independently rehashes original roots/ranges, decodes raw voxel spans
and HVA floats, and uses forward-projected face-plane intersections instead of the
TypeScript inverse-matrix/slab implementation. Pixel buffers and contact sheets
are private, and no original program or browser UI ran for this gate.

The frozen opening-art plan inputs come from reviewed #114
`2da21dec75f1cc10ce6524f98df7dff568c8c569`. They contain 10 RA2 and 5 YR voxel body
types. RA2 contributes 21 VXL/HVA/palette resources and 21 candidates; YR contributes
11 resources and 13 candidates. The sole YR type with conflicting highest-tier
model and pose sources is preserved as four explicit pair alternatives; the
[metadata-only follow-up on #18](https://github.com/lictl/WebRA2/issues/18#issuecomment-5608716105)
records that unresolved integration choice. No source is silently selected.

The comparison verifies two roots and 32 distinct member ranges, including 15
distinct VXL payloads. Eighteen explicit model/pose pairs at three caller-chosen
headings produce 54 frames of 256×192 pixels. All 2,654,208 RGBA pixels and owner
pairs agree exactly with the independent face oracle. It examines 333,360 instance
voxels, 814,040 conservative sample positions and 67,563 visible pixels. Maximum
absolute binary64 depth difference is `7.904787935331115e-14` (comparison tolerance
`1e-10`); empty-depth coverage also agrees. Model-transform values agree within
`1e-12`. These numerical tolerances belong to the independent comparison, not a
renderer tie rule. Both sides derive geometry/transforms from raw sources.

The private contact sheet was visually inspected: all body alternatives have
coherent silhouettes and explicit heading changes, including exposed chassis
where a separate turret/barrel would be needed. This gate covers the selected
body VXL/HVA inputs, not automatic attached-art closure. All sampled HVAs have
one frame and one section, so they cannot settle multi-frame/section layout.
No lighting/native facing/animation or playable campaign claim follows. Missing
retail inputs skip this private gate; they do not pass it.

Publication includes only the facts above, source/range identities below and the
[license/provenance notice](../packages/render/VOXEL_PROVENANCE.md); geometry,
transforms, palettes and rendered images remain ignored.

### Reproduction identities

Root A is `ra2.mix`, SHA-256
`896a8b64f9f1bb8ad5e0bc64fc0b8ea8c84112494761ea1a43478d10c5ef9914`.
Root B is `ra2md.mix`, SHA-256
`69d886defad9114dd440a013b364c8c004e369b5221d1889957b49d00058559d`.
These numeric locators include all consulted physical candidates, including
equivalent/repeated-content ranges; they do not define mount precedence.

| Root | Kind | Absolute offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| A | PAL | 164208 / 768 | `ed785e62eed291480f3198dd44f6b656ebe3a9b75e9f641944d710abc6bde3e3` |
| A | VXL | 122010096 / 37581 | `0bec1774299ab54471e0aec3b49c467832fe19e5c19fcaa3b2bb4964b31903c1` |
| A | VXL | 122479344 / 116773 | `857eff8b607610bd4600466554839d36e4407940c247b9d08aee4c14ac546a1a` |
| A | VXL | 123867360 / 28121 | `11eef26d8ed7d7fa73e24496987ce3ed3cc1c57f19a6f32dd7096447d64e5518` |
| A | VXL | 123965984 / 19888 | `cf85d7a292f3589ec3ed557eeae3a3c79d200dfdf2d02969b7ec17cf1bf0e78f` |
| A | VXL | 124303392 / 29258 | `88b326908acb5c2a98860d8f65169e8745ae858c5cbfe98e0bb2f283f49a3b81` |
| A | VXL | 124343920 / 21953 | `b61286a272e758a9bae0012b6b632d1ddf1f9f7e953f16303c6c404044006ab2` |
| A | VXL | 124377312 / 53459 | `5ffa424b33fbb14a51743c69a02d9fe0137922e19b474e32402f5aba0f00f985` |
| A | VXL | 124744944 / 31370 | `96bfbe29d4554749eab8b4399214bf6bf183f83628434f29167f03063fdff350` |
| A | VXL | 125139392 / 55059 | `f9ab81a01eb3019e62f0eb2aa68d19b4cb25290b5886b491d020aa9bd2784e9c` |
| A | VXL | 126550896 / 35583 | `31e78a7559bbfb19a8e763550d17366e4e386d934c695188cd7336cef68a8f3e` |
| A | VXL | 126848864 / 16067 | `a35db9c7bb8c7e877c27394b383ac1c247b9d47f6c0df9676757af76665deca2` |
| A | VXL | 126864944 / 19452 | `a8e418da9f52bcda735781c2c7d3508473b05f4e5b0fc9c478991fd302a38316` |
| A | VXL | 126884400 / 19452 | `d981a788d749aac095e1acf631e41b29f6b97e4ced1a22ce538871cb4c421a0b` |
| A | VXL | 126918768 / 19205 | `c3a7a8b117a49af493f99c7423a59802cf061aadddd5ab0fb467a36f6f6947ec` |
| A | HVA | 127155056 / 88 | `03c5759b2e710f024f78add39e08eeb27040cf200b84b78bd4a0a45a2cd23faa` |
| A | HVA | 127156208 / 88 | `810dae94db5ae67cef0866897da63f20d3b8d36ff2b73769abc0f5664ff4a2fe` |
| A | HVA | 127158400 / 88 | `810dae94db5ae67cef0866897da63f20d3b8d36ff2b73769abc0f5664ff4a2fe` |
| A | HVA | 127158592 / 88 | `16f3cd28642a66b1a0dc3f6cb4b063889c9f4721e46f12054fd60ed88cdc32ca` |
| A | HVA | 127160704 / 88 | `4a15fc9c2633667812465c4b08f28cab5d595ae4f80eddbb77d1a9f9ed0480a4` |
| A | HVA | 127160992 / 88 | `7b89493e80659f917c4785849ad14e0e550283323b8f0149a4b571db76b528fa` |
| A | HVA | 127161280 / 88 | `16f3cd28642a66b1a0dc3f6cb4b063889c9f4721e46f12054fd60ed88cdc32ca` |
| A | HVA | 127163584 / 88 | `ae4ba7805d0b87dd7b98fa18ba034c36147c51b20cf037a8cf7448dab6a6d25b` |
| A | HVA | 127164832 / 88 | `83acad38f7755df0a5197992df05b810e274704917279039e0f681d0aa900498` |
| A | HVA | 127180768 / 88 | `16f3cd28642a66b1a0dc3f6cb4b063889c9f4721e46f12054fd60ed88cdc32ca` |
| A | HVA | 127182592 / 88 | `bca134005d18bc161009df22e5593f54b92408a24baad64dd824d68a864047b8` |
| A | HVA | 127182688 / 88 | `efbd933066037849f205b320f311c1c9b0c011a62fd10afb131c5664d6e44b99` |
| A | HVA | 127182784 / 88 | `efbd933066037849f205b320f311c1c9b0c011a62fd10afb131c5664d6e44b99` |
| A | HVA | 127182976 / 88 | `5e6f85bf2e42fef64b4f53fe7871488269ee8d31c204565233753b2ae616ee9a` |
| B | PAL | 4496 / 768 | `ed785e62eed291480f3198dd44f6b656ebe3a9b75e9f641944d710abc6bde3e3` |
| B | VXL | 8205072 / 37506 | `356f56b751a0da2e4d7541a7a6b3e64080e8820b8bc9a6a36b6da8d687501f89` |
| B | HVA | 10228480 / 88 | `d17bb8732d76964003bdab375e6ac78b0bdfaa4e083845fe52d340816d3f3ca1` |
