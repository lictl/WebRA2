# Chrome component performance baseline

Issue [222](https://github.com/lictl/WebRA2/issues/222) moves performance measurement
ahead of further gameplay expansion. The original-only harness in
[tools/performance](../tools/performance/main.mjs) imports unchanged engine modules
from merged `7deefd203e9cceb8802d44af867ed3e0a38f4991`. It is a component baseline,
not a complete campaign benchmark or a TypeScript-versus-WASM comparison.

## Reproduction

Use Node 24.20.0 and `npm ci`, then run:

```sh
node --test tools/performance/check.test.mjs
node tools/performance/build.mjs local/performance/run-1
node tools/performance/serve.mjs local/performance/run-1 4200
```

The destination must be a fresh ignored `local/` directory. The builder refuses
retail, external runtime and symlink code inputs; its manifest records each code
input/output hash, git revision and any tracked engine-source modifications. The
localhost server loads exact manifest bytes once, accepts only allowlisted code
and notice routes, and rejects foreign Host/origin headers and non-GET methods.
It serves neither source assets nor an upload endpoint. Existing frozen servers
and builds are preserved. Browser bundle output is intentionally ignored.

Open the page in Chrome, keep it visible and click **Run warmed baseline**. Use
fresh tabs with fragments `#1`, `#2`, `#3` for forward, reversed and rotated case
order. Save the final JSON shown in the page separately for each run. Cancel or
page departure terminates the dedicated worker. Each operation has a 60-second
failure timeout. The original workload entrypoints accept only the fixed declared
profiles, scales and payload sizes. Memory measurement is an optional explicit
operation after timing, not part of the timed pass.

The bundle uses locked esbuild 0.28.2, ES2022 output and `minify: false`; the
product bundle is minified. Source equality does not make these identical
production artifacts. The diagnostic uses COOP/COEP and `crossOriginIsolated` for high-resolution timing;
the product server does not share this exact environment. These are measured
Chrome component costs, not identical end-to-end application timings. The next
product performance gate must retain product headers and normal rendering/UI
scheduling. Do not force a hidden page to continue or disable browser safeguards.

## Workloads and boundaries

The [original workload generator](../tools/performance/workloads.mjs) uses a
32,768-cell 128×256 navigation grid. Scales have **64/256/1,024 total actors** and
**8/32/64 commanded movers**, respectively. The remaining live actors are
uncommanded blockers. Eight setup ticks produce the identical moving checkpoint
used for every measured sample; route-cell and moving-actor counts are retained.
RA2/YR rows use the same original layout with different explicit content-profile
identities. They do not compare distinct native faction behavior, combat,
infantry slots, mission VM work or retail source loading.

Each world case uses seven untimed warmup iterations and 41 measured samples.
Preparation/restore to the sample's fixed starting state is outside the operation
timer unless restore itself is the measured operation. Warmup is a fixed method,
not proof of a stable JIT plateau. The first-route row has warm code but starts
without cached routes. Moving-step rows retain existing routes. The navigation
query row times one public path search with explicit occupancy.

`WorldSimulation.step` includes its own clone and final validation. Command
admission, owned-save cloning, canonical serialization, canonical SHA256, restore,
and `WorldSession.snapshot` are measured separately. The combined UI-step row
times `WorldSession.act(world-step)` plus its snapshot, including recorder and
validation work. Standalone medians must not be subtracted to invent a measured
pure-arithmetic cost, or added as if these operations had no overlapping work.

CPU rendering uses genuine compiler/renderer APIs with original generated map
packs, one TMP diamond and one SHP rectangle. Maps contain 2,016 and 8,128 cells;
sprite cases have 256 placed original rectangles. Viewports are 640×480, the
current app cap **960×640**, and a **1,280×720 renderer-only stress case above that
app cap**. Each has five warmups and 31 samples. This measures CPU scene
composition, not a WebGL renderer, voxel composition, GPU completion, display
compositing or scanout. Correctness checks compare the full RGBA hash plus
allocation metadata and one center pick; they are not an exhaustive pick oracle.

Transport uses one outstanding worker request, 20 warmups and 100 samples for
0-byte, 1 MiB and 4 MiB payloads **per leg**, copied or transferred in both
directions. That is JavaScript worker roundtrip cost, not a JS/WASM function or
marshalling benchmark. Another 31 measured frames combine worker CPU composition
and transfer at 960×640, with worker-local render time and main-thread
`putImageData` submission reported separately. Full production frame-protocol
validation, controller scheduling, DOM updates and GPU completion are outside
this frame roundtrip case; standalone UI snapshot validation is included in its
separate measured operation.

Every measured result is checked after its timer: full checkpoint and event
identity/order for steps, canonical snapshot/path identities, RGBA hashes for
frames, and full payload hashes for echo. All sample arrays are retained. Timing
excludes these explicit correctness checks, but their allocations and untimed
preparation can cause garbage collection during later samples. No GC flags,
forced collections or extensions/settings changes are used. Per-run p95 is a
descriptive sample statistic, not a release tail-latency guarantee.

## Measured Chrome result

Three final replicates completed on 2026-09-11 Japan time (2026-09-10 UTC),
without a hidden interval or benchmark failure. In these workloads the CPU
renderer is the clearest next target: at the current 960×640 cap, terrain/SHP
scene medians were **57.49–61.14 ms**. The 1,024-actor/64-mover world step plus
snapshot was **28.64–29.09 ms**, while the separately measured snapshot cost was
**10.73–11.49 ms**. These overlapping measurements justify renderer and
serialization/cadence experiments; they do not isolate a language cost or predict
a WASM speedup. The next renderer comparison is tracked in
[issue225](https://github.com/lictl/WebRA2/issues/225).

Environment: Apple M1 Max, MacBookPro18,2, 10 CPU cores, 64 GiB physical RAM,
macOS 26.6.2 build 25G83, AC power and charged battery. Actual Chrome reported
**152.0.7977.83**, ARM64, `hardwareConcurrency: 10`, browser-rounded
`deviceMemory: 32`, and `crossOriginIsolated: true`. The harness used
`performance.now()`; retained timings show approximately 0.005 ms quantization,
with floating-point representation noise. No browser settings were changed.
Existing extensions, background tabs and OS work were not removed or controlled;
no build, test suite or separate benchmark ran concurrently with these three
measurement windows. The PR tab was foreground between runs, before the second
run began. GC and scheduling variation remain possible.

Runs used forward, reverse and rotated case order, taking 82.685, 82.570 and
82.694 seconds respectively, including untimed setup and correctness work.
These are three fresh tabs/workers in one browser session, not independent
machine samples. All **11,127 measured operation results** passed their explicit
post-timer equality checks. The 261 metric rows include overlapping local-render
and canvas timings from the same frame operations; these are not additional
independent operations. A separate recalculation reproduced every median/p95 and
identical per-case result projections across all three runs.

World cells below show **range of per-run medians / range of per-run p95**, in
milliseconds, across three replicates and both explicit original profiles (six
statistics per cell). They are not percentiles of a pooled sample array. The idle
case does not command movers; counts in the header describe the active cases.
Other tables use three statistics per row. The same complete input/state is reset
for each timed sample; this is not a long-running world throughput test.

| World operation | 64 total / 8 commanded | 256 total / 32 commanded | 1,024 total / 64 commanded |
| --- | --- | --- | --- |
| step-idle | 0.54–0.67 / 0.66–0.84 | 2.09–2.32 / 2.33–2.65 | 8.59–9.29 / 9.03–10.05 |
| step-moving | 1.57–1.73 / 1.71–1.94 | 6.38–6.69 / 6.72–6.99 | 17.28–17.60 / 17.82–18.68 |
| first-route-tick | 6.12–6.80 / 6.53–12.16 | 8.40–8.71 / 8.99–11.06 | 17.25–18.43 / 18.24–19.74 |
| admit | 0.72–0.76 / 0.91–1.03 | 2.75–2.88 / 3.12–3.23 | 9.81–10.06 / 10.35–10.96 |
| save-clone | 0.31–0.32 / 0.37–0.44 | 1.24–1.31 / 1.37–1.53 | 3.66–3.82 / 3.96–4.06 |
| canonical-text | 0.28–0.30 / 0.33–0.43 | 1.17–1.22 / 1.33–1.46 | 3.50–3.65 / 3.76–4.00 |
| canonical-hash | 0.50–0.51 / 0.56–0.65 | 2.03–2.09 / 2.21–2.41 | 6.02–6.12 / 6.26–6.41 |
| restore | 1.20–1.39 / 1.40–1.73 | 4.94–5.07 / 5.22–5.50 | 13.06–13.35 / 13.50–15.96 |
| ui-snapshot | 0.91–0.97 / 1.06–1.28 | 3.68–3.88 / 3.93–4.32 | 10.73–11.49 / 11.59–12.83 |
| ui-step-snapshot | 2.55–2.70 / 2.78–3.18 | 10.15–10.36 / 10.57–11.01 | 28.64–29.09 / 29.74–33.00 |
| path-query | 0.68–0.72 / 1.05–1.46 | 0.72–0.79 / 0.96–1.20 | 1.71–1.85 / 1.94–2.21 |

| CPU scene case | Median range (ms) | p95 range (ms) |
| --- | --- | --- |
| render/32/640x480/terrain | 28.81–29.96 | 29.63–31.22 |
| render/32/640x480/sprites | 30.06–30.97 | 31.65–31.95 |
| render/32/960x640/terrain | 57.53–60.21 | 58.88–62.84 |
| render/32/960x640/sprites | 59.16–60.86 | 60.38–62.19 |
| render/32/1280x720/terrain | 86.66–89.76 | 90.95–93.92 |
| render/32/1280x720/sprites | 89.17–91.77 | 90.25–93.06 |
| render/64/640x480/terrain | 28.88–30.42 | 29.30–42.30 |
| render/64/640x480/sprites | 30.00–31.21 | 32.22–32.61 |
| render/64/960x640/terrain | 57.49–59.97 | 60.85–62.77 |
| render/64/960x640/sprites | 58.89–61.14 | 59.81–62.33 |
| render/64/1280x720/terrain | 86.52–90.16 | 90.06–93.98 |
| render/64/1280x720/sprites | 88.62–92.53 | 89.74–96.56 |

| Worker/Canvas case | Median range (ms) | p95 range (ms) |
| --- | --- | --- |
| echo/0/clone | 0.03–0.03 | 0.05–0.07 |
| echo/0/transfer | 0.03–0.03 | 0.05–0.06 |
| echo/1048576/clone | 0.53–0.54 | 1.30–1.61 |
| echo/1048576/transfer | 0.04–0.05 | 0.09–0.11 |
| echo/4194304/clone | 1.87–1.98 | 3.06–3.69 |
| echo/4194304/transfer | 0.09–0.11 | 0.12–0.15 |
| frame/worker-render-plus-transfer | 61.46–61.61 | 64.38–65.58 |
| frame/worker-render-local | 61.25–61.38 | 63.83–65.39 |
| frame/main-canvas-putImageData | 0.09–0.10 | 0.12–0.12 |

The first-route cases each performed 1,008 navigation expansions: the existing
world limit allows only eight new route queries in that tick, even when 32 or
64 commands are queued. This row does not measure creation of all queued paths. The moving checkpoints had 976/3,920/7,904 route cells and
8/32/64 moving actors. Their measured next steps had zero navigation expansions;
this distinguishes path construction from continuing a route. The standalone
path query found a 256-cell path with 256 expansions at the two smaller actor
scales and a 272-cell path with 2,000 expansions at the largest scale.

At 960×640, the separate frame roundtrip measured approximately 61.5 ms and its
worker-local CPU composition approximately 61.3 ms; no subtraction of those
percentiles is treated as measured transport overhead. The small `putImageData`
submission values do not mean presentation or GPU work completed within that
time. Pure transferred echo was inexpensive here, but those payloads neither
simulate a future WASM memory layout nor include production frame validation.

## Pinned evidence and validation

Engine input baseline: `7deefd203e9cceb8802d44af867ed3e0a38f4991`.
Timed harness source: `c4d43ec2442dbfd0d8f88ad20d718b4f5b4382d1`, using the
server-only path check correction `da593735159f5936966e19d690a3d8ee1cdb4f07`.
The private immutable build has **68 code/license outputs and 59 approved code
inputs**, no engine edits and no retail content. Exact manifest SHA256:
`4f5af6efb33266bf9d54f96fce454e4b2ba21eac06b6ef05f13e11015bb5fef1`.

| Timed file | Bytes | SHA256 |
| --- | ---: | --- |
| main.js | 7,128 | `f401a36e07412f9c236dd8d1fd26574f9964a766849b2a954ae817107ecb3ac4` |
| worker.js | 285,531 | `d77ae7f6ed62630de6ff1cb039fc8cd1ab26040bed7502e22163addf37c38c81` |
| index.html | 912 | `91b8c4b9b3968d179d231c9f42995f7d31da701b896de2b1e88b07bf46fcc157` |

| Replicate | UTC measurement window | Raw JSON SHA256 |
| --- | --- | --- |
| 1 | 2026-09-10T15:24:17.777Z – 2026-09-10T15:25:40.462Z | `97ed8809465daf9165f53bf3b73409d6b0c1adf483fd2a454053e50190ae1dc0` |
| 2 | 2026-09-10T15:30:18.607Z – 2026-09-10T15:31:41.177Z | `67deaacf3f28787f0810002233e92a78270b0895671bf88eb1b4b1b511be43ce` |
| 3 | 2026-09-10T15:32:19.823Z – 2026-09-10T15:33:42.517Z | `1a198f0e99037beb5752bab67d4e0eb1a2c6dd2c9798676ce1595e3c09a1d2e9` |

Raw sample arrays, browser metadata and every result projection remain in ignored
`local/reviews/browser-performance-222/local/performance/final-1/` as
`chrome-replicate-{1,2,3}.json`; the immutable server is on port4200. Its
`correctness-projection.json` is a sorted-key compact JSON ledger of world
model/checkpoint/result fields, render fields and frame hash. SHA256:
`79002a991deb637b036f03aca03ff5c8a0495f57b53adaf03df4e7eabacd9f82`.
These are original-only facts; the earlier exploratory4199 run is not pooled.

An independent coordinator audit fetched and hashed all68 frozen output routes,
checked all59 source inputs, CSP and four denied routes. Its private records are
`local/reviews/performance-222/local/http222-independent-summary.json` and
`chrome222-independent-summary.json`. Browser and subsequent audit traffic share
the bounded request log, so no native-only request count is inferred from it.

Five original boundary tests pass with
`node --test tools/performance/check.test.mjs`: invalid/bounded worker dispatch,
main timeout/error/messageerror/cancel/pagehide cleanup, exact HTTP identity and
Host/origin/method restrictions, corrupt/missing/path/symlink manifests, and
builder destination/symlink rejection. The new test exposed that esbuild resolved
an entrypoint symlink before `onLoad`; preserving literal paths fixes this
builder boundary. A fresh final rebuild after that builder-only correction
matches **all68 outputs and all59 inputs** of the timed build exactly; only the
manifest build revision differs. Node's fetch ignored the test's Host override,
so that assertion now uses a real `node:http` request. Neither correction changes
a measured engine module. Full public `npm run check` passes 1,229 tests, types, document/publication/M0
checks and a 77-output/145-input product build; these public
checks are not browser timing or campaign acceptance.

Frame `allocations` are accounted renderer buffers, not total live heap or peak
process RSS. Optional `measureUserAgentSpecificMemory` is feature-detected after
timing and describes a browser-specific post-run page/worker estimate that may
trigger collection; it cannot establish peak memory. No Node measurement is
presented as Chrome evidence.

The harness is original WebRA2 GPL-3.0-or-later instrumentation. Its separable
notice list is MIT and matches the broader existing
[app distribution list](../tools/performance/notices.mjs) at this baseline.
Builds retain the existing GPL/MIT provenance and locked dependency license
texts; broader notice inclusion does not imply execution of every component.
No new dependency, game asset, recording, runtime language migration or shared
simulation interface is introduced here. See [licensing](licensing.md).
