# GPU voxel precision experiment

[Issue234](https://github.com/lictl/WebRA2/issues/234) investigates the remaining
voxel layer before [product integration229](https://github.com/lictl/WebRA2/issues/229)
can use GPU composition for current mission views. This is a prototype, with no
production integration or native rendering claim. Initial actual Chrome correctness
observations are recorded below; sustained cadence has not been measured.

The current `webra2-voxel-highp-ray-2` policy owns decoded sparse xyz/color/normal
records, copied resolved palettes and model matrices. The uploaded inverse
coefficients are Float32, while the GPU evaluates its slab expressions using the
implementation's GLSL ES highp arithmetic. Slab intervals retain the half-open
parallel-axis rule and require `near > far`. Strictly greater shader depth wins;
equal depth keeps lexical instance order followed by source voxel ordinal.
Transparent source indices, remapped transparent palette entries and zero-alpha
colors cannot win. Normals remain unused under the existing unlit policy.

The CPU Float32 predicate rounds every multiplication, addition, subtraction and
division separately. It remains a **comparison reference**, not the displayed-pixel
picking authority. The optional Float64 diagnostic retains the prior renderer's
original candidate clipping and arithmetic. Neither reference determines simulation
state, RNG consumption, saves or replay. A near-depth fixture demonstrates a changed
owner when a difference of 0.0000001 at depth11 collapses under Float32.

At the earlier `webra2-voxel-f32-ray-1` checkpoint `bd733936`, actual Chrome on the
original43-case /151,488-pixel cohort matched CPU Float32 masks, owners, RGBA and
immediate default-framebuffer RGBA, but **6,283 depths differed**, with maximum
absolute difference0.000019073486328125. The first difference was at pixel46,14 of
`pose-1-zoom-0.5-shift-0`: CPU45.81476593017578, GPU45.814762115478516. A CPU calculation
with a fused origin reproduces that value, but the actual driver lowering has not
been inspected. This is a failed exact-Float32 gate, retained rather than relabeled
as equality. The private original-only report is `voxel234/oracle-2/correctness.json`
with SHA256 `028cb523e41eaec9b2665090f4e850ea76b601d17e22d31875680bca55fc50a8` in the
browser review worktree. Sampled one-pixel interactions matched the GPU target;
context loss/refusal/restore, obsolete-sequence refusal, disposal and restart passed.
These are browser-agent observations; the policy author did not perform CUA.

GLSL ES3.00 sections4.5.1 and5.11 permit rounding, expression reassociation, fused
multiply/add evaluation and reciprocal-based division that differ from the CPU's
per-operation rounding. The division precision requirement is also weaker than exact
IEEE rounding. Therefore matching storage bits do not establish CPU/GPU arithmetic
parity. See the [primary GLSL specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf).
Other drivers, transforms or near ties may change masks, owners and colors as well
as depth. Production integration must assess those deviations explicitly.

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
limits. These historical counts compare the original Float32 candidate with the
old Float64 renderer; they are distinct from the later GPU-versus-Float32 observations.

## Preparation and ownership

`createGpuVoxelScene` owns decoded geometry and palette values. The factory currently
accepts explicit decoded presentation records; it does not authenticate VXL/HVA
sources or claim complete body/turret/barrel selection. Production integration needs
a genuine source-atlas accessor and the existing complete-group selection adapter.
No arbitrary scene record grants simulation, replay or source authority.

`prepareGpuVoxelFrame` sorts instances, computes expanded clipped boxes, and prepares16×16
screen-tile candidate lists before publishing a frame. `pickGpuVoxelFrame` evaluates
only the bounded candidates for the exact owned frame as a CPU reference. Its optional
Float64 mode is for comparison with the prior renderer, including its original clipping. Detached scene/frame accessors support a
future resident upload and explicit staging measurement; mutating those copies
cannot change a prior frame or pick.

The initial nominal forward boxes did not establish shader coverage: a cube placed
at15.5000001 on both screen axes quantizes to an inverse translation of15.5, admitting
pixel15,15 in a tile omitted by the old boxes. Policy2 derives an additional envelope
from the actual uploaded inverse and unions it with the old box. It does not silently
retain the old clipping as a GPU raster rule.

For each inverse row `(u,v,d,w)` and viewport `(W,H)`, let
`S = |u| W + |v| H + |w| + 257` and `E = S / 65536`. The model-space slab is expanded
from `[lo,lo+1]` to `[lo-E,lo+1+E]`. This deliberately generous128-times-binary32-epsilon
allowance bounds the product/add/subtract errors, permitted fusion/reassociation and
reciprocal/division error after multiplying the endpoint error back by `|d|`.
Intermediate flush-to-zero absolute errors are also smaller than this allowance.
Nonzero subnormal inverse coefficients are rejected; nonzero `|d| < S * 2^-100` is
rejected so the relevant quotient/reciprocal range cannot overflow. Zero directions
retain the existing parallel-slab predicate.

The quantized inverse's linear block `A` is inverted in binary64 to `B`. Preparation
computes an upper bound `r` on `||I - B A||∞`, including64 binary64 epsilons times the
absolute product magnitudes, and requires `r <= 1/1024`. A common view-coordinate
magnitude bound `M` covers `B (q-w)` over all expanded source coordinates0..256.
The projected radius receives an additional `M * (r/(1-r) + 64*epsilon64)` to cover
the inversion residual and binary64 projection/translation rounding. Inverting the
expanded cube and unioning with the old binary64 box yields the candidate bounds.
Expanded corners must remain within±2,097,152; unsupported numerical contexts fail
the complete frame. This derivation assumes conforming GLSL highp arithmetic. It is
not a universal CPU/GPU owner or mask equality proof: near/far overlap and depth
ordering still use the driver's evaluated results.

Original tests enumerate262,144 unculled separate/fused/reciprocal ray variants and
check every hit is present exactly once in its candidate tile. This samples the
bound implementation, not every permitted driver evaluation. Two additional browser
fixtures separately cover the cross-tile quantization case and a near tie with
contrasting palettes, so a changed owner is visible in color. The original43-case
cohort remains identifiable. Expanded-box actual GPU comparisons and independent
review remain required before cadence acceptance.

Hard limits are256parts/palettes,1,048,576 resident and instantiated voxels,
4,096instances,1,280×720 total pixels with2048dimension maximum,64Mi conservative
box pixel tests,128Mi shader candidate iterations,8Mi tile-reference entries and
4,096candidates in any one tile. Projected cube corners must remain within
±1,048,576 on all three axes. The candidate iteration count includes box rejection
work at every clipped pixel of each referenced tile. All limits
are lower-only. Unsupported resource or candidate work fails the complete frame;
no partial body or silently omitted primitive is published.

The resident-byte count includes packed geometry, resolved palettes and matrix
scalar storage. The frame count conservatively reserves all instance boxes plus retained Float64-reference bounds,
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
drops retained sources, and cannot resurrect the renderer. The public context tests use a GL call recorder. The earlier actual driver
compilation/pixel/lifecycle results above do not replace renewed coverage for the
expanded bounds; cadence remains unverified.

The browser-importable original fixture module provides43 oracle cases, including
fractional transforms, overlapping complete-style parts, exact/near ties, and extreme
admitted scales. Separate16/64/256/1024 three-part group workloads report exact box,
voxel and candidate counts. These are synthetic presentation groups, not a claim
of authentic campaign body/turret/barrel selection. Preparation and changed-frame
staging belong inside coupled frame service measurements; resident load and
interaction read latency are reported separately.

The production proposal keeps existing terrain/SHP integer depth unchanged and
uses the actual compositor's depth comparison and tie ordering for combined picking.
A coordinator-owned composition hook must expose its completed GPU layer to a final
composite. The selected voxel uses its driver-evaluated depth; exact ties retain the
base layer under the proposed strict-greater rule. Displayed interaction must read
one owner/depth pixel from that completed composite, or prove a separate bounded
base/voxel comparison identical to that compositor. A CPU Float32 voxel result is
insufficient. No full-frame readback is allowed in cadence. This hook, authenticated
resident source transport and complete-group joins require a separate reviewed
integration. None is implemented by this prototype.

The original960×640 preparation workloads at the earlier `bd733936` checkpoint
admitted the following work. Policy2 expanded-bound counts are recorded separately.
Candidate iterations include conservative box rejection and exceed actual slab
sample tests. These counts do not establish a frame rate.

| Groups | Instances | Box pixel tests | Candidate iterations | Peak candidates/tile | Counted frame bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 16 | 48 | 41,472 | 1,009,664 | 151 | 134,436 |
| 64 | 192 | 165,888 | 3,780,608 | 174 | 447,300 |
| 256 | 768 | 663,552 | 14,700,544 | 182 | 1,696,196 |
| 1,024 | 3,072 | 2,654,208 | 58,802,176 | 182 | 6,698,372 |

Policy2 retains those candidate/sample counts for the four unchanged workload
poses. Counted frame bytes rise to175,908 /613,188 /2,359,748 /9,352,580 respectively,
because each candidate now also retains16 bytes of old Float64-reference bounds.
The original43-case CPU comparison counts remain16 owners /14,410 depths /
18 adjacent-integer comparisons with no mask or color changes. The separate two
boundary fixtures intentionally add a visible color change and an extra eligible
pixel across a tile edge. These are source-side calculations, not renewed GPU
observations or frame-rate measurements.

Seventeen focused tests and type checking pass for the revised policy, including
249,792 old Float64 pixel comparisons,262,144 unculled arithmetic-variant probes,
the new numeric rejection/coverage cases and six GL-call/lifecycle tests. Revised
actual-browser coverage remains pending.

Reproduce the public checks with Node24.20.0:

```sh
node --import tsx --test tests/render/gpu-voxel-policy.test.ts tests/render/gpu-voxel-renderer.test.ts
npm run typecheck
```

The original-only detailed count script and results are preserved in the author
worktree at `local/prototype234.ts` and `local/prototype234.json`; policy2 adds
`local/prototype234-policy2.ts` and `local/prototype234-policy2.json`. Actual GPU
comparisons for the revised bounds, independent numeric review, and sustained
Chrome60FPS measurements remain required. No gameplay, save or RNG code is changed by this checkpoint.
