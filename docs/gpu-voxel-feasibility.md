# GPU voxel precision experiment

[Issue234](https://github.com/lictl/WebRA2/issues/234) investigates the remaining
voxel layer before [product integration229](https://github.com/lictl/WebRA2/issues/229)
can use GPU composition for current mission views. This is a prototype, with no
production integration or native rendering claim. Initial actual Chrome correctness
observations are recorded below; sustained cadence has not been measured.

The current `webra2-voxel-highp-clipped-ray-3` policy owns decoded sparse xyz/color/normal
records, copied resolved palettes and model matrices. The uploaded inverse
coefficients are Float32, while the GPU evaluates its slab expressions using the
implementation's GLSL ES highp arithmetic **within the prepared integer candidate
clips**. These clips are an explicit bounded presentation policy, not a promise to
include every hit from an unculled shader under every permitted lowering. Slab
intervals retain the half-open
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
pixel15,15 in a tile omitted by the old boxes. The candidate-clipping policy derives
an additional allowance
from the actual uploaded inverse and unions it with the old box. It does not silently
retain the old clipping as a GPU raster rule.

For each inverse row `(u,v,d,w)` and viewport `(W,H)`, let
`S = |u| W + |v| H + |w| + 257` and `E = S / 65536`. The model-space slab is expanded
from `[lo,lo+1]` to `[lo-E,lo+1+E]`. This deliberately generous128-times-binary32-epsilon
allowance covers the stated ordinary multiplication/addition/subtraction, fusion,
reassociation and direct-division/reciprocal-multiply evaluation family after
multiplying the endpoint error back by `|d|`.
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
the complete frame. This derivation is limited to that stated evaluation family.
It is neither a
universal conforming-highp coverage proof nor a CPU/GPU owner or mask equality proof;
near/far overlap and depth ordering use the driver's evaluated results.

GLSL ES3.00 section5.11 also permits replacing multiplication with repeated addition.
An independent review produced a genuine2048×1 frame whose uploaded inverse has
`u=1.283205509185791`, `w=-2627.517333984375`, and forward translation2047.62. At pixel2047,
ordinary multiplication gives origin−0.1540539264678955. Repeated addition with upward
rounding gives+0.08154296875, inside the voxel, while the prepared clip has no candidates.
The model-space error0.2355968952178955 exceeds the allowance0.08411441370844841.
This is a retained standards-permitted counterexample, **not an observed Chrome
lowering**. Increasing an arbitrary epsilon would not establish universal coverage.
A public original regression records this limitation; the experimental clip remains
explicitly authoritative for candidate membership.

The D03 disposition accepts this bounded clipping policy for the measured Chrome
experiment only. The actual-driver oracle remains mandatory. Future product use must
perform bounded startup correctness checks and retain CPU fallback on failure; a
finite startup corpus still cannot prove every future transform or conforming driver.
No cross-driver, production or retail compatibility is established here.

Original tests enumerate262,144 unculled separate/fused/reciprocal ray variants and
check every hit is present exactly once in its candidate tile. This samples the
bound implementation, not every permitted driver evaluation. Two additional browser
fixtures separately cover the cross-tile quantization case and a near tie with
contrasting palettes, so a changed owner is visible in color. The original43-case
cohort remains identifiable. Expanded-box actual GPU comparisons and independent
review remain required before cadence acceptance.

Hard limits are256parts/palettes,1,048,576 resident and instantiated voxels,
4,096instances,1,280×720 total pixels with2048dimension maximum,64Mi candidate
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

Eighteen focused tests and type checking pass for the revised policy, including
249,792 old Float64 pixel comparisons,262,144 unculled arithmetic-variant probes,
the numeric rejection/coverage cases and retained repeated-add counterexample and six GL-call/lifecycle tests. Revised
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

## Preparation allocation follow-up

The first four short Chrome scale probes exposed CPU preparation as the dominant
cost. At 16/64/256/1,024 original groups, the browser worker recorded observed rates
of 109.375/44.75/11.25/3 frames per second, with median preparation costs
2.8/16.4/72.4/290.7 ms. GPU query medians were 1.13/1.73/3.59/8.02 ms. These are
short diagnostic runs, not sustained acceptance, and the large cases fail the
60 FPS target. Their raw evidence remains under the browser worker's ignored
`local/voxel234/final-1` directory.

The first optimization removes transient arrays and callbacks from each voxel's
bounds calculation and hoists instance-invariant radii. Binary64 expression order,
integer clipping, candidate order, resource accounting and shader code stay the
same. An alternating original-only Node comparison reproduced all copied packet
and allocation hashes for 45 oracle cases and 72 moving workload frames. For the
1,024-group case, 14 measured samples per version after four warmups gave median
preparation 36.43 ms before and 20.50 ms after; p95 was 52.80 and 39.77 ms.
Hashes were compared outside timing. This local result neither predicts the
browser rate nor establishes the 60 FPS target; the corrected browser probe is
still required. A public six-frame multipart regression pins the earlier complete
packet digest and checks previous-frame ownership across successful and failed
preparation.

### Retained instance layout checkpoint (16a26cb)

That checkpoint introduced an optional path that captures the static instance IDs, part/palette joins and
caller-order to sorted-owner mapping once, using
`createGpuVoxelInstanceLayout(scene, instances, lowerLayoutLimits?)`. Each later
`prepareGpuVoxelLayoutFrame(layout, { matrices, width, height }, lowerFrameLimits?)`
receives a `Float64Array` with 12 coefficients per instance in the **original caller
order**. It owns a fixed-length copy, validates every matrix and runs the same frame
preparation as the existing record-based API. The original API remains available.
At that revision there was no transform, inverse, envelope, box or bin cache.

The genuine layout binds its exact scene. Caller edits, detached exports, forged
layouts and a copied scene cannot change that binding. Top-level accessor properties
reject. The numeric plane uses intrinsic buffer/offset/length accessors: unused named
shadows are ignored without invocation, while foreign/proxy/subclass/shared/resizable
or detached storage rejects. Failure leaves previous frames and the layout usable.

Separate lowerable layout limits bound captured bytes (default 4 MiB) and one owned
matrix plane (default 393,216 bytes: 4,096 × 12 × 8). Captured bytes count UTF-16 string
units plus 16 logical bytes of joins/mapping per instance; this is not an actual
JavaScript heap measurement. Factory validation still has the existing bounded
instance/matrix temporary objects. These extra layout/plane counters are exposed
on `layout.allocations`; the existing frame allocation values remain unchanged.
All matrices and derived numeric arrays still use the original bounds and arithmetic.

Public comparisons cover all 45 oracle packets/allocations and 153,088 old-Float64
picks, plus 64 changing-linear/rounding-boundary frames, caller-order ownership,
byte/storage limits, successful/failed retries and input mutation. This checkpoint
was subsequently measured with the same recorded inputs and bundle; the
[browser report](gpu-voxel-browser.md) preserves the captured-only result and
the earlier condition-sensitive measurements.

### Bounded exact reuse candidate

The subsequent candidate keeps the `16a26cb` captured path available with
`{ reuseBytes: 0 }` in the layout limits. The default reuse allowance is 32 MiB,
lowerable only. It does not change `GPU_VOXEL_POLICY`, shader arithmetic, source
admission, public frame allocation counters or the record-based entrypoint.

An owned layout may retain a temporary matrix workspace, exact linear bases and
one bin plan. A basis is keyed by the immutable part identity and all nine caller
linear coefficients, distinguishing signed zero. It retains the checked linear
inverse terms, quantized-envelope linear inverse and residual, and six binary64
pre-translation center terms per resident voxel. Each frame still owns its input
plane and validates every value. All translations, translated inverse bounds,
Float32 translation quantization, viewport-dependent error scales/margins/radii,
old Float64 pixel bounds and expanded clipping are recalculated with the existing
arithmetic grouping. Changing an animation matrix cannot reuse a mismatched basis.
A different part or palette requires a different captured layout, as before.

Bin reuse requires the same viewport and limits plus equal ordered voxel-owner
and integer tile ranges for every compact box. It never infers equal boxes from
an equal aggregate count. The first different box rebuilds the previously matched
prefix and resumes the original ordered budget checks. A removed trailing box
also prevents reuse. The immutable offsets/candidates can be shared by frames;
every diagnostic export still returns owned copies. No earlier frame or cache
array is overwritten. Failed preparation leaves the last committed cache and
frames unchanged; internal scratch values are rewritten on retry.

`gpuVoxelLayoutStats(layout)` reports logical bytes for the last **successful**
preparation, not JavaScript heap, allocator or driver measurements. The reuse cap
charges the persistent workspace, complete basis arrays/strings/metadata, compact
bin membership, and the full backing bytes of retained offsets/candidates. It
also reserves old plus candidate data and 2,048 bytes of temporary key/math
metadata before reuse allocations. Shared old/candidate planes are conservatively
charged again. A workspace reserves 128 logical bytes per instance; transient
inverse references are cleared even after failed validation. Capacity exhaustion
falls back to ordinary computation and retains the last committed cache; it does
not reject a frame that the existing frame limits admit.

The separate working reservation includes the existing `frameBytes`, 288 bytes
per instance for the owned input plane and additional matrix/validation scratch,
and 2,048 bytes of bounded numeric metadata. `lastCombinedPeakBytes` adds that to
the peak reuse reservation. Existing frame and renderer limits still apply. These
counters do not bound frames or detached copies intentionally retained by external
callers. A cache alias is charged for its complete backing plane, not merely a
reference, and no pool recycles storage while an earlier frame can observe it.

Original checks compare zero-reuse and retained paths across every linear
coefficient, signed zero, near ties, viewport changes, clipping, all frame-budget
boundaries, source part/palette selection, caller mutation, and failed retries.
The private preserved-`16a` comparison reproduced 129 complete packets/allocation
projections (45 oracle cases plus 84 recorded original diagnostic inputs) and
306,176 comparison picks. Another generated check matched 1,728 successful frames,
2,112 errors and 255,872 picks, retaining eight earlier frames through later work.

An exploratory alternating Node run of the bounded candidate measured 15.87 ms
versus 10.69 ms median preparation at 1,024 groups over 80 measured recorded inputs;
p95 was 36.02 ms versus 38.11 ms. The earlier unbounded private prototype was faster
in a separate run and is not the public implementation. Hashing/comparison stayed
outside the timed interval. The candidate has no Chrome timing or 60 FPS result
yet; the captured-only 42 FPS failure and all prior driver/coverage limitations in
the [browser report](gpu-voxel-browser.md) remain applicable evidence.
