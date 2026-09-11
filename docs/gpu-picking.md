# Exact picking without GPU readback

[Issue229](https://github.com/lictl/WebRA2/issues/229) integrates the measured GPU
subset into the product. `createGpuPicker(scene, lowerLimits?)` accepts a genuine
GPU scene and returns `pick(frame, x, y)`, `stats()` and idempotent `dispose()`.
It evaluates only the requested output pixel, without a GL context, rendering,
framebuffer readback or simulation dependency.

The caller supplies the **exact displayed frame**. A retained older frame still
picks its own camera, object identities and positions after newer frames exist;
it is not redirected to the latest state. Cross-scene and fabricated frames fail.
Nonfinite or out-of-viewport coordinates return null; fractional coordinates select
the containing output pixel. Scene replacement is a caller-owned lifetime change:
dispose its old picker and construct one for the replacement. A disposed picker
rejects all queries. This module does not prove that a frame was actually submitted
or displayed; the presentation controller owns that association.

## Winner selection

The coordinator's `visitGpuFramePixel` accesses the genuine frame's private integer
axes and ordered draw records. It visits only covering source texels, exposing
scalar values and no mutable arrays. Axes retain the CPU's JavaScript binary64
sampling. The picker reads the detached raster's binary alpha and signed local
depth at that texel. Transparent fragments contribute nothing.

Terrain is visited first in source-record order. Greater depth wins and equality
retains the earlier owner. Sprites follow lexical object order and must first pass
the winning terrain depth, including their front/behind equality policy. Greater
eligible sprite depth wins; equal sprite depth retains the earlier object, without
a global front bias. The final sample goes through existing `pickGpuFrame` for
terrain/source coordinates or exact frame-specific sprite metadata.

This is the already tested terrain/SHP policy. It does not add voxel, shadow,
nonbinary blending, fog or effect support, or create source/gameplay authority.
Product capability fallback must preserve those existing layers separately.

## Bounds and ownership

One detached RGBA/depth raster copy is made per picker, eight bytes per raster
pixel, capped by `rasterBytes` (default128MiB). The cap is checked before copying;
only a genuine scene can authorize that copy. Palettes, source descriptors and
later detached copies cannot mutate the picker. `stats().ownedRasterBytes` counts
these detached planes, not the retained genuine scene, original decoded resources,
JS object overhead or browser memory. The caller must budget simultaneous scene
and picker lifetimes; this is not a global memory quota.

There is no per-frame cache or draw/axis copy. Each query scans at most `draws`
records (default327,680), charged against the full frame count before visiting any
candidate. Both limits may only be lowered. Work is linear in frame draw count;
this first product seam makes no new latency or cadence claim. Per-query temporary
state is constant size apart from ordinary callback/result objects. Disposal drops
the scene and detached planes; garbage collection timing remains engine-owned.

## Original validation

The focused test compares complete pick results at every pixel of the17 existing
original terrain/SHP oracle cases, including hand-designed ties, remapping,
transparency, sparse extras, signed depths and binary64 camera boundaries. Another
32 generated cases span both profile tags,48/60-pixel tiles and all four zooms.
Tests also cover fractional queries, older/newer frame identity, mutations of
source and detached data, forged/cross-scene frames, exact/lower resource caps,
accessor rejection, nested scalar traversal and disposal. They use the independent
CPU renderer as oracle and execute no GPU or retail program.

Run with Node24.20.0 and `npm ci`:

```sh
node --import tsx --test tests/render/gpu-picking.test.ts
```

Retain the existing [GPU provenance](../packages/render/GPU_PROVENANCE.md),
[scene policy](gpu-scene.md) and component GPL notices. Actual displayed-frame
transport/UI acceptance belongs to the product integration, not this isolated test.
