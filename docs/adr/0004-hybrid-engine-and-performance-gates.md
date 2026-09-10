# ADR 0004 — Hybrid engine and early performance gates

Status: adopted engineering direction for [issue222](https://github.com/lictl/WebRA2/issues/222),
2026-09-11. The owner raised TypeScript performance risk and the possible need for
WebAssembly. This advances the measurement gate in D04; it does not record an owner
choice of Rust, C++, or a complete engine rewrite. Implementation and comparison
results belong in the [performance baseline](../performance-baseline.md).

## Decision

Build a hybrid browser engine. TypeScript owns the application shell, file/content
orchestration and browser API integration. Keep a replaceable deterministic engine
behind versioned commands, snapshots and saves. Move measured expensive kernels or
justified reusable codecs to WebAssembly; choose the language and exact toolchain
for each accepted migration. GPU rendering through WebGL2 is a separate planned
change. The existing CPU renderer and TypeScript simulation remain correctness
references during migration.

WebAssembly complements JavaScript and uses linear memory that JavaScript can
access; it does not directly provide the DOM application shell.
[MDN WebAssembly concepts](https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Concepts).
Worker placement and module lifetime also matter: CPU work in WASM on the main
thread still blocks that thread, and repeated compilation/instantiation has costs.
[WebAssembly performance patterns](https://web.dev/articles/webassembly-performance-patterns-for-web-apps).
Measure complete integration costs, not just a tight native loop.

The project already uses a persistent FFmpeg WASM cinematic decoder with explicit
memory and queue bounds. See [the measured media path](../persistent-media.md) and
[its build script](../../tools/media/build-codec.sh). That reuse decision supports
this architecture; it does not measure simulation performance.

## Current implementation and candidates

The audited baseline is main7deefd203e9cceb8802d44af867ed3e0a38f4991. These are source
observations, not measured attribution of time:

| Path | Current work | Experiment before a language decision |
| --- | --- | --- |
| [world.ts](../../packages/sim/src/world.ts), [world-values.ts](../../packages/sim/src/world-values.ts) | A successful step batch clones canonical JSON once, then validation clones its input and checks the combined output with another roundtrip; maps/occupancy are rebuilt | Measure inclusive step and separate clone/validation costs; compare an owned-state transaction without weakening rollback or external validation |
| [world-session.ts](../../apps/web/src/world-session.ts) | A snapshot clones a save, projects actors, calculates the full canonical SHA and validates the projection | Measure snapshot/hash separately; evaluate revision-based reuse and a bounded render projection |
| [terrain-worker-runtime.ts](../../apps/web/src/terrain-worker-runtime.ts) | World operations and camera renders produce a snapshot and full CPU frame before replying; the RGBA buffer already transfers ownership | Measure input-to-acknowledgement latency; separate simulation acknowledgement from latest-snapshot rendering without admitting stale commands |
| [navigation.ts](../../packages/sim/src/navigation.ts) | A viable query allocates fixed512×512 search/occupancy arrays, sorts/hashes occupancy and runs A* | Reuse bounded scratch/indexes, then compare an identical packed TS/WASM path batch with stable tie ordering |
| [terrain-scene.ts](../../packages/render/src/terrain-scene.ts), [voxel-render.ts](../../packages/render/src/voxel-render.ts) | CPU placement scans, rasterization and voxel sampling/picking | Separate terrain/SHP and voxel costs; compare GPU rendering or coarse raster kernels against CPU pixels, depth and picking |

The current browser runs the world and terrain renderer in the same worker. The
target diagram's independently scheduled simulation and WebGL renderer are not
yet implemented. A WASM port alone would retain repeated serialization, searches,
memory clearing, overdraw and acknowledgement delays.

## Boundary for a selected migration

The following is an API direction, not a new implemented public schema:

```text
loadModel(version, profile, contentFingerprint, packedTables, limits) -> handle
advance(handle, expectedRevision, ticks, commandBuffer, workBudget)
  -> revision, actorDeltas, orderedEvents
checkpoint(handle) / restore(validatedCheckpoint)
dispose(handle)
```

- Compile names, INI precedence and source provenance in the content layer. Give
  runtime tables stable numeric IDs, explicit offsets/counts and bounded typed
  buffers. Keep descriptive strings and browser objects outside inner loops.
- Cross JS/WASM once per tick batch or path batch. Keep the authoritative working
  set and scratch memory resident with their owning engine instance. Do not call
  back into JavaScript for every actor, neighbour or pixel. Worker messages and
  JS/WASM calls are different boundaries; record copies at both.
- Specify field widths, signedness, null sentinels, byte order, alignment, growth
  limits and buffer lifetimes before implementing the ABI. Current command
  sequences can exceed32 bits; do not silently narrow them. Reacquire views after
  memory growth and never retain detached/transferred storage as live state.
- Use private handles and profile/content fingerprints to bind tables and commands.
  A copied wire object does not transfer the authority of an in-realm branded
  source catalog. Re-establish that binding in the receiving engine instance.
- Preserve integer overflow, division/rounding, native float semantics where
  evidenced, RNG stream identity/draw order and stable iteration/tie ordering.
  Do not enable relaxed floating-point optimizations without equivalence evidence.
- Commit a complete requested tick batch atomically or retain its prior checkpoint
  on failure. Bounded work, cancellation at defined boundaries and resource errors
  remain part of the contract. Faster code must not silently increase accepted work
  limits or discard validation of imported files, saves and commands.
- Keep canonical save/replay formats as portable adapters over runtime storage.
  Remove redundant internal work only with independent equivalence and corruption
  tests. Any change to a required snapshot hash or wire schema needs a separate
  versioned contract change; a performance goal is not authority to omit it.

No mandatory shared memory or cross-origin isolation is introduced by this ADR.
Start with owned transferable buffers and bounded queues; adopt threading/SIMD
only when a measured slice and browser acceptance justify that added requirement.
Original map/INI/asset mods continue through the same content compiler and engine
rules. WASM does not imply loading legacy Windows DLL mods.

## Gate before further broad gameplay expansion

1. Freeze a code/build revision and run scalable original workloads in foreground
   Chrome. Record machine, browser, workload, warmup, sample count, timer granularity,
   median/p95, work performed and outputs. Separate cold load/compile from warm
   execution. Avoid overlapping builds/tests and record interruptions or hidden tabs.
2. Separate command admission, inclusive world step, pathfinding, save clone,
   canonical hash, restore, snapshot projection, worker roundtrip and CPU rendering.
   Inclusive stages overlap: their percentiles must not be added or subtracted to
   claim a causal profile. Hash results outside measured regions where possible;
   required internal hashes remain timed and identified. Add browser profiler
   traces or controlled variants before claiming the cost of an internal substage.
3. Retain reproducible original fixtures/tools and safe timing metadata. Treat retail
   opening evidence separately and keep its payloads private. Include memory owned
   by the engine, scratch, transfer queues, WASM, JS and GPU separately when available.
   Allocation sizes or aggregate browser RSS are not exact live peak measurements.
4. Select the next bounded optimization from the results. Address repeated work,
   copying and worker/render coupling; compare TS and WASM when a coarse CPU kernel
   remains expensive. Hold algorithm, limits, inputs, outputs and compiler/build
   settings explicit. Measure end-to-end command/tick/render time, startup, code
   size and memory as well as kernel time. Record an unsuccessful WASM experiment
   without forcing it into production.
5. Before merging a replacement, independently verify original-fixture command/
   event ordering, numeric/RNG cases, every-boundary save/restore, replay hashes,
   malformed inputs, work exhaustion and atomic failure. Verify pixels/depth/picking
   separately for rendering. Re-run applicable Chrome flows with pinned outputs.
   Other-browser release E2E remains scheduled under D17.

Initial engineering alerts: the current15 Hz logical schedule provides66.7 ms per
tick, so investigate combined tick service above33.3 ms p95 to retain headroom.
The planned60 Hz presentation target provides16.7 ms per frame. These are separate
provisional engineering targets, not native speed claims, final hardware minimums
or evidence of60 fps. Faster speed modes need their own throughput measurements.
Use repeated runs and a matched baseline for regressions; shared CI machines enforce
correctness and resource bounds, not uncalibrated wall-clock thresholds.

This gate is a baseline and prioritization step. Repeat it as combat, visibility,
economy and campaign AI are integrated, and on representative large campaigns and
all release browser families in M5/M6. An original microbenchmark or an incomplete
opening world cannot close campaign performance acceptance.

## Alternatives and consequences

An immediate whole-engine port risks reproducing the same data movement and
scheduling costs while reopening tested semantics. Waiting until all campaigns
are implemented leaves too much architecture unmeasured. A hybrid design with an
early gate lets us choose a bounded migration and preserve the reference behavior.

Maintaining a WASM toolchain, binary/source notices, debugging and deterministic
cross-language adapters adds work. Each migration needs a documented benefit large
enough to matter to its missed budget after boundary costs. No language, dependency,
performance speedup or complete-campaign capability is selected by assertion here.
