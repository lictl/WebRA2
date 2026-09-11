# Resident GPU scene transfer

[Issue229](https://github.com/lictl/WebRA2/issues/229) moves resolved presentation
resources from a worker to the viewport once per scene. The public functions are
exported from `packages/render/src/gpu-scene.ts`:

- `exportGpuScene(scene)` returns a detached `GpuSceneTransfer` from a genuine scene.
- `validateGpuSceneTransfer(packet, lowerLimits?)` throws on invalid input and returns
  frozen, captured metadata with **borrowed buffer views**. It copies no raster bytes.
- `importGpuScene(packet, lowerLimits?)` validates and owns every raster before
  granting a new genuine presentation scene identity.
- `captureGpuSpriteObjects(objects, lowerLimits?)` returns a bounded frozen scalar
  snapshot. `prepareGpuFrame` still checks its references against the resident scene.

The worker/message adapter must use the returned captured metadata instead of
rereading the original input. Borrowed validation is not immutable pixel ownership:
its caller can still modify or detach the shared ordinary buffers. Immediate import
recaptures, validates and copies them. Shared/resizable/detached buffers and typed-array
wrappers are rejected. Native typed-array length, offset and buffer accessors bypass
shadowing properties; cleaned borrowed views expose no caller-defined accessors.

## Packet and policy

`GpuSceneTransfer` has version1 and policy `webra2-gpu-scene-transfer-1`. Its scene
policy remains `webra2-gpu-scene-1`. It carries effective preparation limits, the
original atlas's optional lower object limit, and:

- Resolved RGBA plus signed local-depth rasters, eight bytes per texel. Palette,
  transparency and TMP base/extra policy are already resolved; no encoded assets,
  decoder state, functions or WeakMap contents cross the worker boundary.
- Ordered terrain groups and sparse pieces, contiguous source-record placements,
  and bounded source-cell/asset metadata for picking. The existing terrain factory
  already requires every ordinal exactly once and stores it in ascending order.
- Prepared frame/palette/row-step resources with rectangle/canvas and pick metadata,
  followed by initial `SpriteObject` values. Later frames can move/drop/add objects
  only using the resident resource combinations.

Compiled and imported scenes use the same canonical preparation implementation.
This preserves binary64 camera sampling, clipping, sample limits, numeric object
rules, lexical ties, palette-independent dropped objects, and exact frame picking.
Once canonical resources are compiled, a GPU scene no longer retains the original
CPU scene/atlas callbacks or decoders. A caller can retain its CPU fallback separately.

Import accepts untrusted presentation data; it does **not** authenticate the packet
as an export from another process. Source/profile/generation associations remain the
application's message boundary. Neither a valid packet nor a genuine imported scene
grants simulation, content-source, mission or compatibility authority. The packet
contains no game state, decoded-file hash claim or load/frame revision counter.

## Bounds and ownership

All top-level counts, descriptors, resource references and aggregate plane sizes
pass before the first imported plane allocation. Default raster limits remain
8,192 resources /16Mi texels /128MiB. The fixed 2,048 raster dimension, 130,816
terrain cells, 4,096 unique sprite frames and256 palette IDs retain source-component
bounds. Limits may only be lowered. Effective runtime limits and custom object caps
survive export/import, including a valid zero-sample scene used outside its coverage.

Transfer-specific limits cap32,768 objects,64MiB aggregate ASCII identifier characters
and64Mi work units. Work charges captured record fields, array entries, initial
geometry rows, each general raster-validation texel, each sprite-depth-validation
texel and each overlapping patch texel. These are explicit bounded units, not CPU
instructions or measured milliseconds. Plane validation checks binary alpha, zeroed
transparent texels, conservative signed depth ranges and sprite row depth. Overlap
pixels of the two resolved terrain pieces must have equal color and depth.

Export owns one additional eight-byte-per-texel copy. Its buffers may be transferred
with `structuredClone`/`postMessage`; detaching them does not detach the source scene.
Import owns one new copy. Borrowed validation creates bounded metadata and typed-array
views but no plane copy. Compiled scenes own the original bridge's expanded planes
through canonical views. The picker and renderer each have their own separately
bounded ownership described in their component docs. The caller must account for
coexisting export/import, renderer, picker and CPU-fallback lifetimes; these limits
are not a global memory/RSS quota. Per-frame preparation copies no palette or source
raster and uses the original draw/axis budgets.

## Original verification

Structured-clone and transferred-buffer tests compare every raster, prepared draw,
axis, allocation and per-pixel pick against the existing CPU oracle for all17
original GPU scenes. Tests also cover old-frame picking, dynamic move/drop/add
updates at all zooms, both-profile generated geometry, source/detached mutations,
changing descriptor wrappers, intrinsic typed-array access, offsets, empty frames,
shared/resizable/detached buffers, malformed references/overlaps and exact/lower
work, string and resource budgets.

```sh
node --import tsx --test tests/render/gpu-transfer.test.ts
```

No browser, network or retail program is involved in these tests. Actual once-per-load
worker transport, generation ordering, resource lifetime and product cadence remain
integration gates. Retain [GPU provenance](../packages/render/GPU_PROVENANCE.md),
[scene semantics](gpu-scene.md) and [readback-free picking](gpu-picking.md).

Product profiling follow-up under #229 removes the bridge's duplicate GPU message
capture. The retained descriptor snapshot is the validated result; already owned
scalar metadata needs no second structured clone. The presenter captures each
sprite update once into a genuine immutable scalar array. Each scene weakly caches
that array's validated resource joins and geometry for later camera changes.
Caller-frozen or mutable arrays still receive full validation, and caches are bound
to resident resources and object/coordinate limits. Every camera frame recomputes
clipping, sample/draw budgets and exact binary64 sampling. Old frame picks retain
their original geometry. These changes do not establish a product FPS result;
Chrome measurement remains required.
