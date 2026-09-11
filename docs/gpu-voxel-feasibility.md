# GPU voxel precision experiment

[Issue234](https://github.com/lictl/WebRA2/issues/234) investigates the remaining
voxel layer before [product integration229](https://github.com/lictl/WebRA2/issues/229)
can use GPU composition for current mission views. This is a prototype, with no
production integration, GPU measurement or native rendering claim yet.

The initial `webra2-voxel-f32-ray-1` candidate owns decoded sparse xyz/color/normal
records, copied resolved palettes and model matrices. It prepares conservative
pixel boxes using the existing binary64 affine multiplication and inverse. The
candidate ray predicate then stores inverse coefficients as Float32 and rounds each
multiply, addition, subtraction and division to Float32. Slab intervals retain the
existing half-open parallel-axis rule and require `near > far`. Strictly greater
near depth wins; equal depth keeps lexical instance order followed by source voxel
ordinal. Transparent source indices, remapped transparent palette entries and
zero-alpha colors cannot win. Normals remain unused under the existing unlit policy.

These operations are an explicit CPU reference for the proposed GPU policy, not a
cross-driver GLSL arithmetic guarantee. The unchanged Float64 diagnostic is retained
alongside it. Eight numeric/ownership tests include249,792 complete pixel comparisons of the
Float64 diagnostic against the existing cube renderer. Six additional tests check
GL calls, resource limits, replacement failure, diagnostic orientation, loss and
retryable restore; they do not execute a shader. A near-depth fixture
intentionally demonstrates a changed owner: a difference of 0.0000001 at depth11
collapses under Float32, so the earlier instance wins. This prevents an accidental
claim that all old depth and pick identities survive the numeric change.

A private original-only exploratory corpus currently contains60 pose/zoom/camera
cases and245,760 pixels. It found no mask, owner or RGBA differences,14,158 changed
depths, maximum absolute difference0.0017416558 and no changed comparisons against
the adjacent integer terrain depths. This preliminary corpus excludes the deliberate
near-tie case and is insufficient to choose the final policy. Boundary, overlapping
multipart and extreme admitted transform cases, an independently written oracle and
actual GPU comparisons remain required.

The expanded browser-fixture matrix now compares43 cases /151,488 pixels. The
Float32 candidate changes16 pixel owners,14,410 depths and18 comparisons against
adjacent integer depths (floor/ceil checks, which may share a threshold). It changes
no masks or RGBA values in those fixtures; the near-tied instances deliberately
share colors. Maximum depth difference is0.0000172538. This corpus differs from
the earlier exploratory one and does not replace its larger depth-range observation.
Both demonstrate that numeric-policy migration requires explicit compatibility
limits. These counts are CPU calculations, not GPU observations.

## Preparation and ownership

`createGpuVoxelScene` owns decoded geometry and palette values. The factory currently
accepts explicit decoded presentation records; it does not authenticate VXL/HVA
sources or claim complete body/turret/barrel selection. Production integration needs
a genuine source-atlas accessor and the existing complete-group selection adapter.
No arbitrary scene record grants simulation, replay or source authority.

`prepareGpuVoxelFrame` sorts instances, computes clipped boxes, and prepares16×16
screen-tile candidate lists before publishing a frame. `pickGpuVoxelFrame` evaluates
only the bounded candidates for the exact owned frame. Its optional Float64 mode is
for comparison with the prior renderer. Detached scene/frame accessors support a
future resident upload and explicit staging measurement; mutating those copies
cannot change a prior frame or pick.

Hard limits are256parts/palettes,1,048,576 resident and instantiated voxels,
4,096instances,1,280×720 total pixels with2048dimension maximum,64Mi conservative
box pixel tests,128Mi shader candidate iterations,8Mi tile-reference entries and
4,096candidates in any one tile. Projected cube corners must remain within
±1,048,576 on all three axes. The candidate iteration count includes box rejection
work at every clipped pixel of each referenced tile. All limits
are lower-only. Unsupported resource or candidate work fails the complete frame;
no partial body or silently omitted primitive is published.

The resident-byte count includes packed geometry, resolved palettes and matrix
scalar storage. The frame count conservatively reserves all instance boxes,
inverse coefficients, binary64 inverse scalar storage, tile counts/offsets/cursors
and candidate indices, including temporary typed arrays. These counters exclude
JavaScript object/Map/Set overhead, caller-owned input bytes and detached upload
copies. The renderer must separately account for those copies, GPU allocations and
replacement peaks. They are allocation accounting, not measured browser RSS.

## Callable GPU prototype and remaining gates

`GpuVoxelRenderer` uses one fullscreen candidate pass. Each pixel evaluates its
bounded tile list in the same lexical-instance / source-voxel order, and replaces
its current winner only at a strictly greater shader depth. The selected color is
stored in `RGBA8UI`; owner and `floatBitsToUint(depth)` are stored in `RG32UI`. A
second GPU pass copies the selected color or explicit background to the default
framebuffer. Integer storage avoids another normalized-depth quantization and
requires no floating-point framebuffer or blend extension. This follows the
[GLSL ES 3.00 bit conversion definition](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
and [WebGL2 integer texture/framebuffer APIs](https://registry.khronos.org/webgl/specs/latest/2.0/).
Exact storage of the shader result does not establish equality with CPU arithmetic.

The context is dedicated and caller-owned. Request WebGL2 with `alpha: true`,
`premultipliedAlpha: false`, and `antialias: false`, and set the drawing-buffer size
to the frame dimensions. `load(scene)` owns one detached resident geometry/palette
copy and uploads it once. `draw(frame, backgroundRgba)` uploads bounded inverse,
box, tile and candidate data when the genuine frame changes. Repeating the same
frame makes two draw calls without new uploads, readback or error/capability
getters. The receipt pins the exact frame and a monotonically increasing submission
sequence. Canvas resizing is the caller's responsibility.

`readback()` is diagnostic-only and returns top-left RGBA, owner and Float32 depth
planes; empty owners are `0xffffffff` and empty depth is `-Infinity`. It does not
include the background, so the browser oracle must also read the default framebuffer
immediately after `draw` to verify final composition and nonopaque background alpha.
`pick(x, y, sequence)` is an interaction-only fallback. It reads one owner/depth
pixel from the most recent submitted frame; an old sequence or outside coordinate
returns null. Its latency must be measured separately. Neither readback nor picking
is used by normal presentation or simulation.

The renderer caps requested GPU allocations and combined renderer-owned resident /
transient typed-array storage separately at256MiB, with lower-only limits and a
2048texture-side maximum. It charges replacement allocations while old resources
are still live. Frame staging, padding and diagnostic buffers are charged before
allocation. Stats distinguish current/peak requested GPU bytes, peak counted CPU
storage and owned resident bytes. Driver storage, shader/program implementation
memory, JavaScript metadata, factory-owned scene/frame arrays and browser RSS are
not measured by these counters. Scene replacement failure preserves the previous
scene; a failed draw invalidates its pick frame until another successful draw.

Context loss cancels normal drawing and diagnostic frame access, retains only
owned CPU source data, and permits explicit `restore()` after browser restoration.
A failed restore is retryable. `dispose()` removes listeners, deletes live handles,
drops retained sources, and cannot resurrect the renderer. Context tests currently
use a GL call recorder; actual driver compilation, pixels, restoration and cadence
remain unverified.

The browser-importable original fixture module provides43 oracle cases, including
fractional transforms, overlapping complete-style parts, exact/near ties, and extreme
admitted scales. Separate16/64/256/1024 three-part group workloads report exact box,
voxel and candidate counts. These are synthetic presentation groups, not a claim
of authentic campaign body/turret/barrel selection. Preparation and changed-frame
staging belong inside coupled frame service measurements; resident load and
interaction read latency are reported separately.

The production proposal keeps existing terrain/SHP integer depth unchanged. A
coordinator-owned composition hook would expose its completed GPU layer to a final
composite; a voxel replaces that winner only at strictly greater Float32 depth.
Exact ties retain terrain/SHP. CPU terrain/SHP picking remains exact; if GLSL differs
from the Float32 CPU voxel predicate, combine its CPU base hit with the one-pixel GPU
voxel result under the same strict depth comparison. This hook, authenticated
resident source transport and complete-group joins require a separate reviewed
integration. None is implemented by this prototype.

The original960×640 preparation workloads currently admit the following work.
Candidate iterations include conservative box rejection and exceed actual slab
sample tests. These counts do not establish a frame rate.

| Groups | Instances | Box pixel tests | Candidate iterations | Peak candidates/tile | Counted frame bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 16 | 48 | 41,472 | 1,009,664 | 151 | 134,436 |
| 64 | 192 | 165,888 | 3,780,608 | 174 | 447,300 |
| 256 | 768 | 663,552 | 14,700,544 | 182 | 1,696,196 |
| 1,024 | 3,072 | 2,654,208 | 58,802,176 | 182 | 6,698,372 |

Reproduce the public checks with Node24.20.0:

```sh
node --import tsx --test tests/render/gpu-voxel-policy.test.ts tests/render/gpu-voxel-renderer.test.ts
npm run typecheck
```

The original-only detailed count script and results are preserved in the author
worktree at `local/prototype234.ts` and `local/prototype234.json`. Actual GPU
comparisons, independent numeric review, and sustained Chrome60FPS measurements remain
required. No gameplay, save or RNG code is changed by this checkpoint.
