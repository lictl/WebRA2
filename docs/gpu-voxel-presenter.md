# Combined voxel viewport presenter

[Issue242](https://github.com/lictl/WebRA2/issues/242) implementation and bounded
Chrome acceptance are complete, pending final PR review. The
presenter connects the [complete voxel transport](gpu-voxel-product.md) to the
[combined renderer](gpu-combined-renderer.md). Component tests, actual Chrome
startup, both imported opening controls and original complete-part lifecycle checks
pass. Two original sustained rows exceed 60 submitted/fence-observed frames per
second while the world advances at 15 Hz; individual deadline misses remain below.
A separate actual-asset row also exceeds60 FPS, with a one-tick timing deficit
and explicit scope limits below. These are presentation checks, not original
mission completion.

The main thread imports the complete geometry/palette data into a genuine scene,
then drops the transient transfer packet. It retains immutable group/source
metadata and the source-ground lookup. Every worker update validates current
actor position, complete membership and retirement before replacing pending state.
All body/turret/barrel instances use the same reviewed `voxelWorldProjection` as
the CPU path. Retirement rebuilds the complete layout; ordinary camera changes
reuse the captured layout and exact bounded preparation cache. No part is dropped
to fit a resource limit.

Startup coalesces camera and world updates without publishing a game frame. A
successful check loads the current complete scene and schedules one RAF. Disposal,
replacement, hidden startup or context loss aborts it; stale promise completion
cannot revive a presenter. The canvas stays hidden until the first game submission,
so original startup patterns do not appear as battlefield artwork. This is a
presentation lifetime, outside world commands, clocks, saves and replay identity.

Each successful game submission pins a local sequence, the corresponding combined
renderer sequence and immutable world revision. Voxel picking reads one current
winner pixel and resolves its complete part metadata. Pending camera/worker updates
do not alter the displayed pick. Stale gesture sequences return null without a
read. Ordinary draws perform no full-frame readback. Preparation, startup, context
or picking failures invalidate the whole combined presentation and request the
existing complete CPU fallback at the latest desired camera/current world.

The cold `gpu-world-selftest.ts` runner creates two original genuine scenes through
the normal import/frame factories: 1,024 total viewport pixels and 28 interaction
probes. Hand-authored expectations cover front/equal/behind terrain/SHP/voxel
ordering, palette transparency, lexical voxel ties, base signed-depth extrema,
admitted voxel ties and adjacent binary32 values near positive/negative1,048,000,
fractional negative depths, signed-zero ties, background alpha37 and the pixel15/16
candidate-bin boundary. Voxel projections at the base extrema±2,097,151 are not
admitted by the current factory; the test does not fabricate such frames.

Four cold draws include one identical redraw per scene for immediate default-
framebuffer verification with `preserveDrawingBuffer:false`. One asynchronous
zero-timeout fence at a time precedes diagnostic plane reads. Timers/fences are
released on success, timeout, abort or failure. A five-second total deadline may
only be lowered; it cannot preempt synchronous driver calls or browser scheduling.
This finite current-context screen is not universal GLSL arithmetic/coverage proof.

Original tests use controlled async renderers to check coalescing, cancellation,
hidden/lost startup, loss during scene load/picking, ownership, complete-group
retirement/restoration and exact shared projection. Real original worker/session
tests preserve movement, Stop, active save/restore/replay, current camera and retained
Files through CPU fallback/re-negotiation. Their GL doubles do not prove pixels;
structural retirement fixtures do not prove native death behavior.

The first actual Chrome startup check used backend03cb40e and startup9ef02dd at
composed `f8bd66880c4f2b1534b4e0b9979101b25e9bf58a`, frozen localhost4231. Both
scenes matched all expected full RGBA/kind/owner/depth planes, immediate default
framebuffer bytes and28 picks. `getError` returned0; disposed accounting returned
zero owned CPU/GPU bytes. Alpha was enabled, premultiplication/antialias/depth/stencil
disabled; `preserveDrawingBuffer:false`, product nonisolated headers. Native Chrome
tab selection and the Run button were observed. This was a cold correctness check,
without a quiet timing window; its349.8ms elapsed is not a performance benchmark.

Private evidence is under
`local/worktrees/gpu-voxel-presenter/local/gpu242/startup-1/`. Manifest SHA256:
`64c8261ecc16f028935afab683629ea2b2eb55c9925114d66e1c91fbae2feaf5`;
normalized result JSON:
`3db61f070d875ddd608eec59763cc75afa33ceff9ca590734a463c53b974e55c`.
Six console warnings identify an installed extension; three listener-channel errors
are page-attributed with no confirmed cause. They remain in the private observation.
No game program ran and no retail asset, sample or screenshot was published.

## Product and complete-part lifecycle

The final product source is `e55321b5db88eadc9edf2bfcf655ec864430185b`;
coordinator `882c208` has the same complete tree. It includes the independently
reviewed transport/backend, startup, presenter and current main dependencies.
The localized renderer label says “supported still artwork,” covering the admitted
terrain, SHP and complete voxel groups without implying animation or lighting.

Chrome on localhost4233 used the normal chooser and the same 16 on-device asset
Files for RA2/English and YR/Traditional Chinese. Both loaded genuine initial
worlds, enabled combined GPU presentation, selected and centered vehicle artwork,
and picked a complete part. RA2 used the explicitly labeled development-house
control; YR used the default player. Normal Move, Run/Pause, queued Stop, local
checkpoint restoration and UI replay verification passed. RA2 additionally exported
a native replay file and restored an active movement checkpoint across CPU/GPU
mode switches. Returning to campaigns retained all 16 Files in both profiles.
These finite controls used the actual 960×435 drawing buffer.

A dense YR centered view exceeded the current GPU preparation budget at 100% zoom.
The whole scene fell back to CPU with the same world hash and desired camera;
its complete vehicle part remained pickable. At 200% zoom, explicit GPU negotiation
succeeded again. No resource cap was raised and no part was discarded. This is an
observed, supported fallback, not a claim that every retail camera fits the GPU
budget or runs at 60 FPS.

The separate localhost4234 original harness uses the actual controller, worker,
bridge, genuine source-bound ordinary combat world and an original three-part
visual group. Both profile models independently equal the repository's original
combat fixture. Native keyboard controls issued an attack, saved tick1 windup,
advanced through health-zero/death-pending with all three parts retained, then to
tick6 completed death with zero parts. A background terrain pick replaced the dead
object pick. Restoring the pending checkpoint restored all three parts and identical
full RGBA/kind/owner/depth plane hashes. Both replay transcripts independently
reproduce their recorded tick6 state. This proves genuine fixture death-driven
retirement; it does not grant retail vehicle combat or native death animation.

Actual `WEBGL_lose_context` after local camera movement triggered complete CPU
fallback at the same camera and tick1 world hash. Explicit renegotiation restored
GPU presentation; disposed renderer accounting returned zero owned CPU/GPU bytes.
Scene replacement retained the original File and successfully loaded the other
profile. The native tab-switch attempt produced no visibility-change event in this
browser session and the world continued until explicit Pause. Therefore native
hidden-state pausing is **unverified**; controlled async hidden-startup tests pass,
but are a separate scope. No browser policy or setting was changed.

## Original sustained mounted-product cadence

The private original harness on localhost4235 mounts the actual product controller,
views, bridge and worker. It retains 1,024 actors, commands 64 movers, and presents
256 SHPs plus 64 three-part voxel groups (192 instances, 10,368 instance voxels).
All measured world rows retain 64 moving actors. Continuous meaningful camera
updates run independently of the normal 15 Hz world timer. Full terrain/SHP/voxel
composition, controls, subscriptions and scheduling remain active. These sparse
original shapes are not equivalent to retail VXL geometry.

The machine is an Apple M1 Max with10 CPU cores and64GiB RAM, macOS26.6.2,
installed Chrome152.0.7977.83 (actual UA major152). Node24.20.0/esbuild0.28.2
built the diagnostics; no Node timing is represented as Chrome evidence.

Each row has 10 seconds of warmup followed by the stated measurement interval.
Native Chrome tab selection was confirmed before the button-triggered runs;
coordinator/peer heavy work was paused. The original diagnostic is ES2022 minified,
with product nonisolated headers. It is a diagnostic bundle of the pinned source,
not a byte-identical production bundle. The observed RAF/submission opportunities
were approximately 120 Hz; this is not a claim about display scanout or a verified
hardware GPU backend.

| Row | Measured seconds | Submitted / fence observed | FPS submitted / observed | Gap p95 / p99 ms | Gaps >16.667 ms | Lowest full 1s observations | Final tick |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original short | 8 | 954 / 953 | 119.250 / 119.125 | 16.0 / 19.7 | 41 | 118 | 270 |
| Original sustained 1 | 60 | 7,169 / 7,168 | 119.483 / 119.467 | 17.0 / 19.3 | 403 | 117 | 1,050 |
| Original sustained 2 | 60 | 7,170 / 7,169 | 119.500 / 119.483 | 16.5 / 19.0 | 330 | 118 | 1,050 |

All rows reached 15 logical ticks per second over warmup plus measurement, retained
all 192 voxel instances, verified replay outside timing, and reported zero skipped
queries, disjoint observations, terminal pending fences or harness errors. Bounded
fence occupancy peaked at2/3/3. World notifications can batch ticks; their row count
is not the simulation tick count. The sustained terminal replay hash is
`1e35c10b4c9f8a5f4c341bcab0eb03445591a51320f65504370be1417a057593`.

Camera culling produced positive voxel sample work on954/954 short submissions,
6,364/7,169 sustained1 submissions and6,365/7,170 sustained2 submissions. Every
frame still retained the complete group layout. GPU query p95/p99 were
3.02/3.42ms,3.02/3.58ms and2.99/3.60ms, respectively. Draw submission p95 was0.4ms;
this small inclusive backend-submit duration is not the overall frame cost. The
observed frame gaps above include preparation, mounted UI, worker scheduling and
browser variability and remain evidence of individual missed deadlines despite
the aggregate rate exceeding60.

A bounded ring uses timer queries and zero-timeout fences, with no cadence full
readback or `gl.finish`. Fence observation uses the poll-start timestamp associated
with a successful check. The GPU may finish during that check; this is not a strict
completion upper bound, nor presentation completion. One final measured submission
per row completed after the window and is excluded from its in-window count.
Nearest-rank quantiles are descriptive; no universal tail-latency guarantee follows
from these rows. Separate standalone medians are not subtracted to invent a pure
CPU or simulation cost.

## Actual on-device RA2 artwork cadence

Localhost4236 loads the unchanged actual app entry after bounded instrumentation
captures controller subscriptions, worker receipts and combined draws. The normal
chooser reads the same16 on-device Files and prepares the genuine RA2 opening.
All197 product source inputs are present, plus three private instrumentation inputs.
Product `minify:false` and nonisolated headers are retained; `splitting:false` joins
the diagnostic dynamic entry and is an explicit build difference. Raw JSON's inherited
`original:true` denotes original instrumentation only: its `run.scope` is explicitly
`actual-on-device-selected-opening`; these reports contain private retail-derived
world metadata and are never published.

This source catalog reports82,249 selected geometry voxels across14 parts;
the rendered presentation retains18 complete voxel instances. Catalog selected
voxels are not the sum of every repeated instance's voxels. The measured camera
performs positive voxel work on every submission (about4.25–4.57million candidate
tests per frame). No geometry was reduced to the original fixture. The actual
canvas is960×435; the explicitly selected development house issues one normal
finite move. That move finishes during warmup. Measured world rows have zero
moving actors, so this is real-art camera/current-world performance, not sustained
retail movement or an autonomous original mission.

| Row | Measured seconds | Submitted / fence observed | FPS submitted / observed | Gap p95 / p99 ms | Gaps >16.667 ms | Lowest full 1s observations | Final tick |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| RA2 short | 8 | 910 / 908 | 113.750 / 113.500 | 20.4 / 22.9 | 133 | 112 | 270 |
| RA2 sustained | 60 | 6,939 / 6,937 | 115.650 / 115.617 | 19.8 / 22.1 | 953 | 111 | 1,049 |

Both rows retain all18 instances and verify their replay outside timing. No skipped
queries, disjoint observations, terminal pending fences or harness errors occur;
ring peaks are4/5. GPU query p95/p99 are7.46/9.23ms and7.28/9.41ms. Two measured
submissions in each row are excluded from the in-window completion count. The
sustained world's1,049 ticks over70 seconds are one below1,050 (14.986Hz), retained
as an observed deficit rather than rounded to exact15Hz. Its terminal replay hash
is `6251b71e8fcbb5e9e70f37ef26188d8d77cc8405a0b8a0dd1741a80c16d4bc03`.
The frame-rate target passes for this camera/workload; exact15Hz retail scheduling,
other cameras, YR retail cadence and sustained moving retail groups remain unproven.

## Evidence and limits

All runtime builds, source/input manifests, raw reports, local exports and retail
observations stay ignored under
`local/worktrees/gpu-voxel-presenter/local/gpu242/`. The product head's full check
passed1,520 public tests plus14 tool tests, types,220 documents/1,136 links,
publication/M0 and82 output/197 input build checks before the two localized string
changes;20 focused presenter/controller checks passed afterward. Public fixtures
and controlled GL doubles remain distinct from actual Chrome and on-device tests.

The coordinator independently checked both fixture world-model identities, both
finite replay transcripts, all original cadence completion/time joins and output
identities (95,403 assertions). Its private audit is `local/root244-audit.json`.
Reported raw quantiles are reproducible with `local/cadence242/summarize.py`.
The two actual-app loads retain six additional page-attributed listener-channel
errors and12 installed-extension warnings; the cause of the former is unresolved.

| Frozen evidence | Manifest SHA256 |
| --- | --- |
|4233 actual product,82 outputs/197 inputs | `759b57e5edcb405bd2403766bbb20d93d7d0a5e359636940acdbe6925b1b7d61` |
|4234 original finite lifecycle,72 outputs/159 inputs | `3f23c8232f18f639e2a026c6e60011609244c385fcd9830ce4326f83ab423545` |
|4235 original cadence,72 outputs/158 inputs | `8d9fb90574510f7511ee02436fa25cedde33c2aa128422e8ada5c89399ec799c` |
|4236 actual-app cadence wrapper,76 outputs/200 inputs | `bda458315f8229a6c83f0dd664ded4e5d4c8e47296ed03a5ff90d3bf50f66226` |

| Private raw artifact | SHA256 |
| --- | --- |
| Original lifecycle final | `15989e1473157757657799d1a583a567ad764fa1cd40c134277bbf5d3a7c26ca` |
| Original short cadence | `53c34cc2a741b4c63903791e9a0e88f45c0e1be1a3166873d9591ba979b94022` |
| Original sustained 1 | `7ac0e07a9a63859469e52aed29b783c60b1e4633ca000f80775a5c8d8a099466` |
| Original sustained 2 | `5d10d189afa7aa23d670128e5c6e6d942a5e76411149fa9d35de5911554bcd36` |
| RA2 actual short cadence | `e93a7a6f6d37713598237098fc5fabf50c6cf586b4895757bb74c01eb0465664` |
| RA2 actual sustained cadence | `1a048e673d66145babc46b106930be5fa4cb6641c29d6b254c04969f9508e949` |
| RA2 native replay export | `234f1344755b15f8c7cb2cb2f547c6730cc83dd6b2065d4ac2376ab07b1af0c5` |

The earlier4232 product load is preliminary evidence before final composition and
label correction. An original-1 preparation failure and a retail-wrapper build
failure were retained; neither failed build entered the timing pool. Three
unattributed listener-channel console errors remain in the finite original browser
observation despite an empty harness error ledger. No console-clean claim is made.
Native hidden delivery, universal driver arithmetic portability, full animation,
lighting, campaign objectives and a first playable original mission remain outside
these passes. GPU output never changes simulation authority or save/replay identity.
