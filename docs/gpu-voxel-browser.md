# Original voxel GPU browser diagnostic

State: WORKING, [issue234](https://github.com/lictl/WebRA2/issues/234).
This original-only experiment checks driver-evaluated highp ray arithmetic within
explicit bounded candidate clips, separately comparing CPU Float32 and the existing
Float64 renderer. The current policy is `webra2-voxel-highp-clipped-ray-3`.
No product voxel composition, retail GPU performance or native render equivalence
is claimed. Renderer/policy source remains in the component author's scope.

The [harness](../tools/gpu-voxel-performance/main.mjs) compares all pixels in the
43 original fixtures plus two separate boundary cases, integer GPU owner/depth/color planes and immediate default
framebuffer RGBA (background alpha37). It also checks a bounded set of one-pixel
interaction reads, obsolete picks, context loss/restoration/disposal and idle RAF.
Readbacks belong to correctness and interaction diagnostics, never warmed cadence.

Use Node24.20.0 and `npm ci`, then:

```sh
node tools/gpu-voxel-performance/build.mjs local/voxel234/<fresh-directory>
node tools/gpu-voxel-performance/serve.mjs local/voxel234/<fresh-directory> 4223
```

The builder emits a minified ES2022 diagnostic into a fresh ignored directory,
records every code input/output hash and retains the broader existing license set.
The server checks exact loopback Host/origin, routes and hashes, serves no assets,
and uses product CSP/non-isolated headers by default. An optional `isolated`
argument is a separately labeled environment. Reports remain out of the DOM and
are available through a bounded, revoked local Blob URL.

The first actual Chrome run at frozen `22b7c719c3d698b8f1ef2e629cce5288dc961f94`,
port4223, completes43cases/151,488pixels. GPU mask/owner/color and default
framebuffer color match the CPU-f32 reference at every pixel. There are6,283
depth differences, maximum absolute1.9073486328125e-5, so the exact-f32 gate
fails. A driver-evaluated highp presentation policy is being recorded explicitly;
GPU depth and current-sequence owner govern displayed interaction only. The
independent old Float64 oracle matches its prior implementation; the CPU-f32
policy changes16owners and14,410depths with zero mask/color differences.

The same frozen run passes lost-context draw refusal, native context restoration
with equal colors, old-sequence pick refusal, double disposal and fresh renderer
restart. Private original JSON is in `local/voxel234/oracle-2/`; no retail data
is present. Future updated harness runs verify candidate-bin membership/order
independently and retain exact build identities.

The cadence controls use16/64/256/1,024 original three-part groups. Short probes
use2s warmup/8s measurement; sustained rows use10s/60s. Every submitted frame
changes matrices and includes preparation, detached staging and GPU submission.
Simulation is absent in this isolated renderer experiment. Idle RAF opportunities,
issued/observed frame rates, p95/p99 gaps/misses, bounded fence/query resources and
post-window final plane hashes remain separate. Fence times are poll-start
timestamps associated with a successful zero-timeout check, not scanout times or
strict completion upper bounds. No sustained timing result is yet claimed; the short scale failures below are retained.

Any shader/CPU discrepancy blocks a parity claim;
Float64 differences are an explicit experimental policy change, not tolerated
silently as matching output. GPU memory counters describe requested/accounted
resources, not browser-process RSS or guaranteed reclamation.

The clipping allowance is scoped to ordinary mul/add/FMA/division evaluations.
Independent review found a standards-permitted repeated-addition evaluation that
would hit outside the prepared clip. The source tests retain that original
counterexample; this is not an observed Chrome lowering. The D03 disposition accepts
a measured, bounded clipping experiment, not universal conforming-highp coverage.
See [the policy derivation and limitation](gpu-voxel-feasibility.md). Future product
integration requires bounded startup correctness checks and CPU fallback; no such
product gate is implemented by this diagnostic.

## Frozen scale checkpoint

The initial scale freeze is `8f10c8f7ae56bf011003ff0df4c70145c4300d4e`,
port4225, private `local/voxel234/final-1/`. Manifest SHA256 is
`e07f02b4c5c4b07a59333dfb068ddb9ec9225ca02aa846cd9f79d8d7da7d0d5a`.
All70 disk/HTTP code/license outputs and16 source/dependency inputs match.
The minified ES2022 build uses Node24.20.0/esbuild0.28.2 and product headers:
CSP `connect-src 'none'`, without COOP/COEP isolation. The broad notice bundle
includes the exact voxel provenance text.

Actual Chrome152 on the M1 Max MacBookPro18,2 (10 CPU cores,64GiB RAM,
macOS26.6.2) completed45cases/153,088pixels. The43 original and2 boundary
cohorts remain separate in the raw report. GPU versus CPU-f32 has zero measured
mask/owner/color differences and6,283 depth differences. GPU versus old Float64
has2 mask,34 owner,14,428 depth and18 RGBA-pixel differences across the expanded
cohort. The optional CPU Float64 oracle still exactly matches the old renderer.
Default framebuffer versus GPU planes and sampled current-sequence picks match.
This is measured presentation consistency, with `exactCpuF32=false`, not universal
shader parity. Final context loss/refusal/restoration/obsolete-pick/disposal/restart
checks pass. Hardware versus software WebGL backend remains unverified.

A separate quiet22second idle RAF run on the earlier4223 build measured
118.005 opportunities/s after2seconds warmup:2,360 intervals over19,999.1ms,
p95/p99 gaps10/10.5ms, maximum125.6ms. Eleven gaps exceeded16.667ms.
This observes animation callbacks rather than physical display refresh or scanout.

Four quiet, original-only scale probes use2seconds warmup and8seconds measured
changing-frame work at960×640. Every group has3instances sharing one54-voxel
part; all instances change x/y translation each submitted frame. There is no
simulation, terrain/SHP compositor or user-content preparation in these rows.

| Groups / instances | Submitted / observed in window | Observed/s | Minimum full-second observed | Gap p95 / p99 ms | Gaps >16.667ms | Prepare median ms | GPU query median ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
|16 /48|876 /875|109.375|100|16.2 /34.9|40|2.8|1.135|
|64 /192|359 /358|44.750|31|42.5 /103.8|249|16.4|1.730|
|256 /768|91 /90|11.250|9|206.8 /268.3|90|72.4|3.593|
|1,024 /3,072|24 /24|3.000|2|450 /500|23|290.7|8.022|

All issued receipts eventually drained; peak pending ring2, no skips or disjoint
queries. The64+ workloads **fail60FPS in these recorded conditions**. The later
native-tab-controlled repeat below shows that document visibility alone did not
establish a comparable foreground condition. The16-group mean does not
establish sustained performance or every-frame deadlines. Long failing-scale
repetitions are deferred while preparation is optimized. The renderer's reported
resource counters reach zero after disposal; its peak staging includes the final
full diagnostic readback and is not solely steady-frame transport. No browser RSS,
physical reclamation or hardware backend inference follows.

| Original report | SHA256 |
| --- | --- |
|Correctness|`c81ab343474bc5ddb829f1aeec15df5b1d5bf117c0f9358d9298e87d4a6638e8`|
|Lifecycle|`a6d02f57a05650f9ee88c959279d5d0853a412a1739cfffd530880b77eb7c4c3`|
|16-group probe|`3508e5696871f8fee521114f674357e83b65794a0c4c1417ad961eaf19a51fa5`|
|64-group probe|`6b1333f12a6f1677bc48cfb73759bf07d68eddd31fe33c1142e3eab45697c3c6`|
|256-group probe|`dc2de20ac837bb4948f924361ad327475fcf9f156b1f279a515b89ad4bf67179`|
|1,024-group probe|`002588c3bdb2552b3c1a4d27263da64cc4e193de0cd20d08837f3904d859e9c0`|

The failed gate is recorded in [issue234](https://github.com/lictl/WebRA2/issues/234#issuecomment-5628940260)
and [PR237](https://github.com/lictl/WebRA2/pull/237#issuecomment-5628942193).
It is a software performance finding, not a request for human intervention.

## Bounded CPU attribution and next change

A separate Node24 profile uses the same original source workload, three preparation
warmups and11 changed frames per scale. An instrumented copy records phase costs;
all44 copied frame projections and allocation records match the uninstrumented
factory. These are Node measurements, **not Chrome timings**. The instrumentation,
CPU samples and raw projections remain under private `local/voxel234/attribution/`.

At1,024groups, median original Node preparation is40.87ms, versus42.87ms in the
instrumented copy. Its phase medians are28.52ms for bounds plus first-bin counting,
6.84ms for descriptor capture/validation/sort,3.94ms for candidate allowance,
2.12ms for prefix/fill and1.58ms for transform composition/inversion. Standalone
detached frame copying is0.55ms. Independent medians must not be added or
subtracted to infer Chrome costs. CPU sampling also identifies the bounds loop as
the largest hotspot; garbage collection remains visible.

All3,072 transforms change, but only6,144 x/y translation scalars: IDs, palettes,
source geometry and linear coefficients are constant. Across six sampled1/60second
pairs, all uploaded inverses change; integer box coordinates change for0–55,296
of165,888 boxes. Offsets and candidate arrays happen to match in five pairs. This
is an opportunity for exact reuse, not permission to retain stale boxes/inverses.
The first proposed core change removes per-voxel temporary arrays and hoists
invariant scalar calculations while preserving operation order and every packet
byte. Fresh Chrome measurements must establish any improvement.

## Scalar allocation correction and browser attribution

The first correction removes temporary per-voxel arrays, preserving arithmetic
order and all packet bytes. Frozen source `3f3e9370ef6cb264ecd0e1b48d765fab5d94861b`
contains component commit7202860; private `scalar-1/`, port4226, manifest
`f58e3c1bb8e340d81ef5de5763dd94a4b4b57dfeaea205921df8b5a774dbced4`.
All70 outputs/16inputs verify. All45 actual oracle case hashes and44 independent
moving-frame packet/allocation projections equal the previous implementation.

| Groups | Observed/s | Prepare median / p95 ms | GPU median ms | Gaps >16.667ms | Raw SHA256 |
| --- | --- | --- | --- | --- | --- |
|64|54.875|9.8 /44.0|1.802|124|`60734d2fd9cc929135321aca790af8432178ac1a62accb546c6220af1129e58f`|
|256|15.500|43.5 /206.9|3.572|124|`3f195d4ee4037ec806f9faf19dfcb024b2f602fbde1c9879cb37242ea8650cdb`|
|1,024|3.875|186.7 /385.3|8.157|30|`124f3571143aff9a70c6bfddc63405dfeea3309d8aa9b1754b36fb43981f1485`|

These single2s/8s probes report lower preparation times but still fail60FPS. All issued work
drains with no skips/disjoint queries; long failing repetitions remain deferred.
Separate native Cancel during active4225 work reports explicit failure and zero
owned CPU/requested GPU bytes; restart then passes the lifecycle checks. Incomplete
cancelled receipts are retained, never counted as a successful cadence result.

A private paired stage diagnostic on4227 removes GL entirely and uses the exact
recorded scalar-1 inputs. Both genuine factories receive the same matrices; one
only adds stage clocks. Three warmups and11 samples at each of64/1,024groups
produce22 equal complete packets and allocation records. The actual Chrome
1,024-group medians remain191.0ms pristine and191.1ms instrumented: bounds/count79.0,
capture/validation/sort43.2, allowance32.1, prefix/fill16.3 and composition/inverse15.8ms.
Thus GPU work alone does not explain the slow preparation.

Running the **byte-identical minified script** in Node24 with a collection-only
DOM shim preserves all22 inputs/outputs, but gives39.76ms pristine at1,024groups
and1.96ms at64groups; Chrome gives191.0/16.9ms respectively. The earlier20.77ms
Node scalar result used a different unminified single-factory harness and must not
be treated as the same experimental context. These initial stages alone do not
identify compiler, scheduling, GC or OS causes.
No browser settings changed; no unsupported profiling API was used.

The preparation-only Chrome raw SHA is
`851944aef8b9a2ff4e0b52fdd9128436473fcc4bc50de40e8022b5afd3eeb6e8`;
its Node control SHA is
`ecc33b34bc730ca7aa181fa2320042d609c98db3f2eef7000291a51767143eb4`.
Private `stages-1/` records exact driver/instrumented-source hashes and13 actual
bundler inputs; it is a distinct diagnostic build, not the frozen cadence artifact.
The native-tab-controlled repeat below supersedes a language-bottleneck inference
from this initial comparison. Every original result remains preserved.

## Retained layout and controlled foreground comparison

Component commits `b10066c` and `16a26cb` capture scene-bound instance IDs, part and
palette joins once. Each frame still copies and validates a bounded Float64 matrix
plane, then recomputes all transforms, boxes and bins. Independent review corrected
a forged typed-array prototype case by checking the intrinsic element type. An
independent reversed-caller-order comparison against scalar source `3f3e937` passes
89 complete packets/allocation projections and306,176 Float32/Float64 picks. No
shader or numeric-policy change is involved.

A paired minified diagnostic at source `098011d03de43a4f27974234f11a0d3c8ec5893a`,
port4228, records native Chrome's selected tab before pressing its native Compare
button. It uses the same22 recorded input frames as4227, three warmups per scale,
rotating original/captured call order, and complete packet comparison after timing.
All22 projections also equal the earlier scalar outputs. GL and simulation are absent.

| Groups | Chrome original / retained median ms | Same-bundle Node original / retained ms | Cold Chrome layout ms |
| --- | --- | --- | --- |
|64|1.9 /1.7|1.43 /1.21|0.9|
|1,024|22.7 /17.9|27.30 /19.62|7.2|

The1,024-group layout accounts190,464 captured bytes and294,912 matrix bytes;
these are bounded data counters, not total JavaScript heap measurements. The caller
reuses its matrix plane; the frame factory owns a fresh copy. Input construction,
detached output copying and cold capture are recorded separately from preparation.

An additional native-tab/button repeat of the **unchanged4227 bundle** gives
1.5/1.7ms pristine/instrumented at64groups and22.5/23.9ms at1,024groups, versus
the earlier16.9/15.6 and191.0/191.1ms. All22 input/output projections still match.
Earlier runs recorded a visible document but did not independently establish the
native selected tab under debugging. This large change without a code update
demonstrates condition sensitivity; it does not establish the exact browser/OS
cause. It must not be attributed to retained capture, TypeScript or WASM. The actual
paired22.7→17.9ms result is the narrower observed capture improvement.

The controlled4227 instrumented1,024-group medians are8.5ms bounds/count,6.0ms
capture,4.4ms allowance,2.5ms composition and2.3ms prefix/fill. Independent medians
must not be summed. Changed-frame cadence using the retained path is the following gate;
these preparation samples alone establish neither60FPS nor product readiness.

Private `layout-1/` has manifest SHA
`e68f3560e5852f1698d8df22317b43172d61823cf71dc3f0cf86192512eca6f3`:
all70 disk/HTTP outputs,13 actual inputs and product headers verify. Chrome raw SHA
is `12527026bac8ea0bf5e4551104659e05f0c783685b42d9bc2db8ab2c3738aae2`;
the same-bundle Node control is
`18502fa91ec6e3a2c0a7e60bef7c7c345a1131c20e64f895f0aa28354bc7090a`.
The unchanged4227 native-repeat SHA is
`5da242b3484076c05905e978b7ec01955c001333a728e439ce0bbbde10daa4d8`.

## Native-selected captured cadence

Source `0cf57255df48e4bab3956eb9a4ece4652e72a3d5` changes the original cadence
caller to retain the genuine layout and write a reused caller matrix plane. The
factory still owns a fresh copy; frame preparation is timed including the caller's
matrix writes. Cold layout/caller storage are recorded separately. The unchanged
shader45-case checks pass with the same reported differences above. Source/tool
validation passes26 focused checks, including exact changing-plane values and
cancellation cleanup. No simulation or user content enters this experiment.

Three short2s/8s probes explicitly verify the native4229 tab and press its native
Run button. All2,755 issued frame receipts eventually complete, with peak ring2/3/2,
no skips/disjoint queries and zero owned/requested bytes reported after disposal.

| Groups | Submitted / observed in window | Observed/s | Minimum full-second observed | Gap p95 / p99 ms | Gaps >16.667ms | Prepare median / p95 ms | GPU median ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
|64|966 /965|120.625|120|16.1 /16.8|13|1.4 /8.3|1.920|
|256|908 /906|113.250|112|19.8 /20.9|56|4.7 /16.7|2.856|
|1,024|337 /336|42.000|41|39.8 /41.0|336|18.8 /37.2|5.818|

The1,024-group workload still fails60FPS under these controlled conditions; long
failing runs remain deferred. The smaller rows exceed60 observed completions/s in
these short windows but do not establish sustained performance or every-frame
deadlines. Exact retained basis/geometry reuse is the next bounded optimization;
policy, matrices, clips, ordering and error/limit behavior must remain equivalent.
Fifteen sampled complete packets, including every final frame, equal the scalar
reference and each recorded allocation ledger. This does not check every timed
packet or imply exact CPU-f32 shader depth parity.

Private `captured-1/` manifest is
`6028291f0f592fd9405ae745e3673d1046b605453a6b6e907e291d17dcd82e01`;
all70 disk/HTTP outputs and16 inputs verify with product headers. Raw probe hashes:

| Groups | SHA256 |
| --- | --- |
|64|`9d3ce3b39b292eeeabc4b15c709d60fbd5a96ae5d8e014be3e0ae008332bd09b`|
|256|`52769225033f2d1b168b7267a54609b6698d409c52719fc5dc9f0bdb741963f8`|
|1,024|`4efe4319e74c707006fd870f0eb14da321cb8e044a9434542e905e6a029fcc35`|

## Native-selected exact-reuse probe

Core `d6f96f62f39128e3ea8e060b232f6c1e82808de5` adds bounded exact basis and
bin reuse. The uncached path remains available; policy, shader and candidate caps
are unchanged. Frozen browser source
`2d5226dadaaf2b149594d4402fea12ea75ea85eb` adds only a post-measurement layout
accounting field to the preceding harness. The same changing-transform generator,
viewport, warmup and measurement schedule are retained. No simulation runs here.

Independent source comparison passes129 complete packets/allocation projections
and306,176 CPU-reference picks, including84 recorded4229 moving inputs. Thirty-one
focused policy/harness tests pass. Actual Chrome repeats all45 shader cases with
identical GPU/default-framebuffer/CPU hash rows and the previously reported depth
differences. This does not turn the highp policy into exact CPU-f32 arithmetic.

At4230, the native selected Chrome tab and native Run button are verified for each
short2s/8s row. Other agents paused heavy work. All3,094 issued receipts complete;
ring peaks2/3/3, no skipped work, no disjoint queries and no pending receipt at end.
The complete raw ledgers independently reproduce rates, windows and quantiles.

| Groups | Submitted / observed in window | Observed/s | Minimum full-second observed | Gap p95 / p99 ms | Gaps >16.667ms | Prepare median / p95 ms | GPU median ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
|64|966 /965|120.625|118|13.5 /14.6|4|1.0 /5.9|1.868|
|256|917 /916|114.500|111|21.4 /24.1|65|2.5 /15.9|2.807|
|1,024|597 /596|74.500|73|16.7 /19.5|32|9.4 /13.7|5.262|

The largest short row improves from42 to74.5 observed completions/s and18.8 to9.4ms
median preparation. Its maximum submission gap remains38.6ms. These single short
rows pass an average/full-second60 threshold, **not sustained, every-frame or retail
performance**. No long run is inferred. Fence timestamps remain successful poll-start
observations, not strict completion upper bounds or scanout measurements. Native
selected-tab verification removes the earlier ambiguity, but does not control all
OS/browser/GC variability or establish a hardware backend.

Last-success retained reuse accounting is314,492 /1,184,924 /4,700,828 bytes for the
three scales; combined logical frame/reuse peaks are1,285,980 /4,864,956 /19,283,388
bytes. All use one basis entry. These counters include the documented logical
workspace/cache reservations, not actual heap, RSS or driver memory. Renderer
disposal reports zero owned/requested bytes; that counter excludes layout reuse
storage, whose lifetime ends when the caller releases the layout. No GC completion
claim is made. Fifteen sampled complete packets, including all three final frames,
equal the pristine reference and recorded allocations; not every timed packet was
compared. The full untimed comparison above is separate.

Private `reuse-1/frozen/` manifest SHA is
`e732ae67a78d038d65530481c781c29b73034ac0919f8baeac40190ad563f23a`;
all70 disk/HTTP outputs and16 source inputs verify with product headers. Only the
voxel policy and post-timing harness accounting source differ from4229. Correctness
raw SHA is `c5d1c59ba8922ebd154aae073b3244ce194493dd2708a1abc04ac601ff813e51`.
Raw cadence hashes:

| Groups | SHA256 |
| --- | --- |
|64|`6397543100604deeac562362d200caf3aa469e0611bff7518905efb5ebb32d8f`|
|256|`a3015c6bc27584e63bd8fa00e0c8ba43b8c9e608421f2de24787081fd8fe514a`|
|1,024|`27496b09da1e710066574ec17c45acd978f6069a9dbf100a257a59f04807fe28`|

The next product gate is [complete voxel composition](https://github.com/lictl/WebRA2/issues/242):
genuine source groups, terrain/SHP/voxel depth and displayed picking, bounded
startup checks and complete CPU fallback. Dense real-source parts can exceed a
per-bin cap despite far fewer instances than this sparse synthetic workload.
Source preparation or these renderer-only timings cannot establish a retail GPU
mission, supported native lighting/facing, or the first playable mission.
