# Chrome component performance baseline

Issue [222](https://github.com/lictl/WebRA2/issues/222) moves performance measurement
ahead of further gameplay expansion. The original-only harness in
[tools/performance](../tools/performance/main.mjs) imports unchanged engine modules
from merged `7deefd203e9cceb8802d44af867ed3e0a38f4991`. It is a component baseline,
not a complete campaign benchmark or a TypeScript-versus-WASM comparison.

## Reproduction

Use Node 24.20.0 and `npm ci`, then run:

```sh
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

The diagnostic uses COOP/COEP and `crossOriginIsolated` for high-resolution timing;
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

## Evidence status

Three final foreground Chrome replicates are pending at this source checkpoint.
An earlier private exploratory run used the same engine with different harness
checks and only 640×480/1,280×720 render sizes; it will remain separate and will
not be pooled into final results. Final evidence will record browser/machine,
build hashes, run order, visibility, median/p95, result identities and limits.

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
