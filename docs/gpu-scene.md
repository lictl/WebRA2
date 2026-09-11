# Resident GPU scene preparation

[Issue225](https://github.com/lictl/WebRA2/issues/225) evaluates an original WebGL2
backend against the existing [terrain](terrain-scene.md) and
[SHP composition](sprite-layer.md). The owner target is at least 60 FPS. This
preparation layer is presentation-only; it does not change simulation, save/replay,
mod schemas, asset lookup precedence or native compatibility authority.

## Ownership and resource preparation

`compileGpuScene` accepts a genuine `createTerrainScene` result and an optional
source-hashed sprite atlas batch. It snapshots palettes and placements and resolves
selected raster resources once. The frozen public scene has no writable texture
bytes. `copyGpuSceneData` provides detached arrays for a backend to own and upload;
changing those copies cannot mutate the original CPU scene or later copies.

The resource catalog contains each used TMP slot and each initially selected
SHP frame/palette/row-step combination. Subsequent `prepareGpuFrame` calls may
change object IDs, positions, anchors and depth bases using that catalog, or remove
objects. An unprepared frame/palette/row-step combination fails explicitly and needs
a new scene. This is a bounded still-resource experiment, not complete native
animation, shadow, voxel, lighting or effect rendering.

Aggregate resource counts, expanded pixels and bytes pass before expanded raster
allocation. Defaults cap 8,192 rasters, 16 Mi pixels and 128 MiB of RGBA plus signed
depth planes. Each resource costs eight bytes per texel. Existing CPU source/decode
limits remain effective. Compilation retains the original bounded CPU scene/atlas
as well as the expanded resources; expanded bytes are not total application memory.
Backend upload copies, padding and driver allocations require separate accounting.

## Exact sparse composition

A TMP slot produces a base rectangle and, if present, a separate extra rectangle.
It never allocates the potentially enormous rectangle spanning two distant pieces.
Each piece fully resolves base plus extra at its coordinates. Overlapping pieces
therefore have identical final RGBA and depth and the same terrain owner.

Base coverage comes from the decoder mask, including its asymmetric final row.
Base palette index zero can be opaque. Extra color zero preserves underlying color
and coverage, while an extra Z value below 32 can still replace depth. Nonzero extra
color replaces the base before testing palette alpha; alpha zero suppresses the
result. Extra Z values at least 32 retain base Z, or zero outside the base. Local
depth remains original base-local Y minus the resolved Z, even for an extra patch.

SHP source transparency is tested before remapping, then palette alpha. Only binary
alpha is supported. A sprite depth raster contains local row times the explicit
row step; the instance supplies its depth base. Empty frames remain empty.

## Per-frame sampling, bounds and picking

`prepareGpuFrame` validates and snapshots the viewport and optional objects. Terrain
instances follow ascending source record, and objects follow lexical ID order.
Output axes evaluate `floor(camera + (pixel + 0.5) / zoom)` in JavaScript binary64.
The GPU reads those integer axes instead of narrowing arbitrary camera coordinates
to float32. Integer clipping uses the same pixel-center boundaries as the CPU.

Frame defaults retain the 2,048 dimension, 4 Mi output pixels, bounded camera and
64 Mi projected sample limits. Both actual patch-quad work and the CPU reference's
union-rectangle work must fit their limits. The draw cap is 327,680, with twelve
signed integers per draw. Covered integer depths must fit the GPU's explicit
[-2,097,151, 2,097,151] range before submission. Axis and draw copies are detached;
retaining many scene/frame objects remains the caller's responsibility.

The backend performs terrain selection and then sprite eligibility against that
terrain result. Larger depth wins; equal terrain depth selects the lower source
record. Equal eligible sprite depth selects the lower lexical ID. A sprite's
front/behind policy applies only when comparing equal depth with terrain. A global
depth bias would change behavior where terrain is absent and is not equivalent.

`pickGpuFrame` maps a diagnostic kind/owner/depth sample through the exact submitted
frame's retained metadata and sample axes. Its terrain and object results use the
CPU pick fields, with an explicit kind tag. It does not authenticate arbitrary
caller-supplied pixels or determine game state. The experiment's full-frame GPU
readback belongs to correctness checks and is excluded from cadence measurements.

## Validation boundary

Original fixture tests compare prepared pixels, depth and picks with the CPU
reference, including independent hand probes and adversarial bounds/ownership
checks. Actual WebGL correctness, context lifecycle and sustained cadence are
separate Chrome gates in the [experiment report](gpu-renderer-experiment.md).
Node preparation time or GPU submission time alone cannot establish 60 FPS.
Retain [GPU provenance](../packages/render/GPU_PROVENANCE.md) and composed notices.
