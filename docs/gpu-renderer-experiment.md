# GPU renderer experiment

[Issue225](https://github.com/lictl/WebRA2/issues/225) meets the owner’s **at least
60 FPS** target for this original-only Chrome diagnostic: all six primary runs
sustained **119.990–120.105 observed completed frames/s**, with no RAF timestamp interval
between submitted frames above16.667ms. This is evidence for the bounded terrain/SHP
backend and decoupled scheduling, not a production campaign or physical scanout
claim. [Issue229](https://github.com/lictl/WebRA2/issues/229) owns integration into
the actual viewport, bounded snapshot transport and retained voxel/effect fallback.

## Reproduction and exact artifacts

Use Node24.20.0, `npm ci`, then:

```sh
node --import tsx --test tools/gpu-performance/check.test.mjs
node tools/gpu-performance/build.mjs local/gpu/<fresh-name>
node tools/gpu-performance/serve.mjs local/gpu/<fresh-name> 4209
```

The fresh ignored destination contains a manifest, bundler input list and immutable
code/license files. The builder uses locked esbuild0.28.2, **minified ES2022**,
restricted repository inputs and locked runtime dependencies. It rejects symlinks
and retail/external code paths. The broad existing GPL/MIT notices and GPU component
provenance are copied; original fixture data is generated locally. The loopback
server serves only exact manifest code/notice routes, no asset/upload endpoint.
Its CSP is the product policy, including `connect-src 'none'`; these runs have no
COOP/COEP and report `crossOriginIsolated:false`. An optional `isolated` server
argument exists but was not used for the final matrix.

Final timed source: `ee3634eef42155debf8d553369203bc299eb2f2c`.
Frozen private build: `local/worktrees/gpu-performance/local/gpu/final-6`, port4209.
Manifest SHA256: `1aa4d91c64f8e9eb9470dbd2d9e98623337773c53571a1816c5a693f2225fcfc`.
It identifies **70 output files and67 inputs**. The coordinator independently
matched every disk/HTTP output digest and every input to the composed source;
six unlisted/query/upload/foreign-origin requests were rejected. Earlier servers
and exploratory artifacts remain separate and were not overwritten.

Chrome152.0.7977.83 ran on an Apple M1 Max,10 CPU cores,64GiB RAM,macOS26.6.2,
with devicePixelRatio2 and the normal browser profile/extensions. No settings were
changed. Separate original22-second idle probes (2-second warmup,20-second sample)
observed120.028 and120.050 RAF opportunities/s. That establishes observed callback
cadence, not display refresh hardware or physical presentation completion.

Dedicated WebGL2 attributes were alpha:true, premultipliedAlpha:false,
antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,
powerPreference:default. `EXT_disjoint_timer_query_webgl2` was available. The
exposed renderer string was `WebKit WebGL`; opening `chrome://gpu/` was blocked by
browser security policy, so hardware versus software rendering is **unconfirmed**.
No alternative route or settings change was used to bypass that restriction.

## Method and bounded work

The original222 generator supplies maps32/64 with2,016/8,128 terrain pieces and
256 original SHP rectangles. Both maps reuse two raster resources totaling2,016
pixels. The renderer fixture is always explicitly RA2-tagged; the RA2/YR selector
changes the original worker’s profile identity, not native faction mechanics.
The128×256 navigation grid and64/256/1,024 total actors have8/32/64 commanded movers;
other live actors are uncommanded blockers. This excludes campaign VM, combat,
infantry-slot behavior, retail loading and production UI frame validation.

Each row has10seconds warmup and60seconds measurement. Primary rows use map64 and
1,024 actors/64 movers: A=RA2 world960×640, B=YR world1280×720. Runs were rotated
A1,B1,B2,A2,A3,B3. Four renderer-only rows compare32/64 maps at both sizes; two
coupled support rows use64/256 actors at960×640. Those six support rows are single
observations, not repeated tail estimates. Native Move/Stop inputs occurred only
in the two smaller coupled rows. Other agents paused heavy checks during timing.

Each useful frame changes camera and sprite coordinates. Genuine scene preparation
and atlas upload happen once per run. `prepareGpuFrame`, draw submission and fence
insertion/flush service are measured separately. A dedicated worker owns one
WorldReplayRecorder, receives at most one request, advances15 logical ticks/s with
at most4 catch-up ticks per request and rejects debt above60. Automatic commands
alternate destinations every120 ticks. Commands, steps and snapshot clone/hash
costs remain recorded separately; inclusive costs must not be subtracted to invent
pure arithmetic time. Rendering never decides world state.

At most8 asynchronous fences/queries are pending. A full ring skips a rendering
opportunity, not logical time. `clientWaitSync` uses zero timeout; timed code uses
no readback or `gl.finish`. A recorded completion time is the **poll-start timestamp
associated with a successful fence check**, affected by browser scheduling. It is
not a strict upper bound: the GPU may finish during the check. Timer-query elapsed
values measure GPU work separately; disjoint results would be discarded. Neither
metric proves physical scanout. Counts use the actual measured interval, not a
rounded59.x-to60 threshold or CPU draw duration alone.

After the measured interval, outstanding work drains and a second fresh worker
replays the complete exported transcript to the exact saved state hash. Replay
work is outside cadence. Prepare/draw work, raw intervals, worker receipts, inputs,
queries, sampled debt and final replay are retained in each downloaded report.

## Results

FPS below is successful fence observations within the measurement window. Gap
percentiles are RAF timestamp intervals for submitted frames; service is main-thread
preparation+draw+fence service. Millisecond values are rounded only for display.

| Row | Completed FPS | Gap p95/p99 ms | Service p95 ms | GPU p95 ms | Gaps >16.667ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| ra2-960-1 | 119.996 | 8.60/9.20 | 1.40 | 1.439 | 0 |
| ra2-960-2 | 119.990 | 9.30/9.40 | 1.60 | 1.473 | 0 |
| ra2-960-3 | 120.105 | 9.20/9.40 | 1.50 | 1.289 | 0 |
| yr-1280-1 | 120.087 | 9.20/9.30 | 1.70 | 1.551 | 0 |
| yr-1280-2 | 120.013 | 9.30/9.40 | 1.60 | 1.524 | 0 |
| yr-1280-3 | 119.996 | 9.20/9.40 | 1.70 | 1.518 | 0 |
| coupled-256-960-input | 119.990 | 9.10/9.30 | 1.90 | 1.431 | 0 |
| coupled-64-960-input | 120.038 | 9.20/9.30 | 3.50 | 1.421 | 0 |
| render-32-1280 | 120.012 | 9.30/9.40 | 3.70 | 1.524 | 0 |
| render-32-960 | 120.048 | 9.30/9.40 | 4.20 | 1.419 | 0 |
| render-64-1280 | 119.987 | 9.20/9.30 | 3.20 | 1.418 | 0 |
| render-64-960 | 120.039 | 8.70/9.20 | 3.60 | 1.365 | 1 |

The12 rows contain86,437 useful submissions and86,425 fence observations inside
measurement windows. Primary full1-second windows had at least118 observed
completions. Their p99 gap is9.2–9.4ms, peak query/fence backlog is1–2, and sampled
simulation debt never exceeds2 ticks. No primary skip, disjoint query or deadline
miss was recorded. The renderer-only64-map960×640 row has one16.70ms RAF gap; it is
retained, not removed as noise. Browser/GC/foreground variance and this finite
sample prevent a universal tail-latency or release-performance guarantee.

Primary preparation p95 is1.3–1.6ms; complete main service p95 is1.4–1.7ms.
Worker roundtrip p95 is33.3–33.8ms at1,024 actors, yet rendering stays independent
at about120Hz. The earlier [CPU baseline](performance-baseline.md) measured
58.89–61.14ms median64-map960×640 sprite composition and28.64–29.09ms inclusive
1,024-actor UI-step+snapshot. These used a different diagnostic build/header
configuration; this is not a controlled speedup ratio or a TS-versus-WASM result.
The practical result is that decoupled worker scheduling and resident GPU rendering
can meet the target without rewriting the simulation in this workload.

Cold primary fixture generation took59.2–70.5ms, genuine GPU scene preparation
3.5–6.1ms and context/load submission4.3–7.4ms. First-use prepare+submit+observed
fence completion took8.7–11.5ms, outside warm timing. This includes shader/allocation
work and may benefit from browser caches across runs; it is not process-cold
startup. Peak requested GPU resource accounting reached33,349,920bytes. It is not
measured GPU residency, total JS heap, browser RSS or process peak memory. Successful
cleanup reported zero retained/requested component resources; browser allocations
and transient frame preparation are not fully represented by those counters.

All8 coupled transcripts replayed exactly. RA2 primary runs end at tick1050 with
hash `0b41e7c920e3ba9621332cd6db9fbfe82d8d3770dd3470fe8e1df8a519e71018`.
YR B1 ends at1050 with `7d6a95e349ddd361c6aa292da45099306c2b78b778f99c027e6c49f0688089ee`;
B2/B3 end at1049 with `130de9162119ff092e6d801d7ce844b49c1f7770e46cb62b17aad50c59097b41`.
The different final ticks follow each wall-clock boundary; each exact transcript,
not an assumed common final tick, is independently checked.

Both64-actor Move/Stop button inputs admitted8 commands, acknowledged in9/11ms,
and reached an observed completed frame in22.4/21.1ms. The256-actor Move button
and canvas S shortcut admitted32 commands, acknowledged in30/25.4ms, and reached
an observed completed frame in48.4/42.6ms. These four individual observations are
not latency percentiles. Their row-specific final saves and replays match exactly.

## Correctness, lifecycle and collection

Final correctness covers17 original scenes,28 full viewports and56 clipped16/32
atlas variants: **84 comparisons and46,501 pixels**. Every RGBA pixel from both
the diagnostic integer targets and immediate default-framebuffer presentation
matches the CPU oracle; every depth/owner/kind pick matches. Fixtures exercise
signed depth, alpha, transparent/remapped pixels, ties and atlas row/page boundaries.
The coordinator independently rebuilt all84 CPU RGBA outputs and matched both
recorded GPU/default-framebuffer hashes. Readbacks occur only in this check.

Forced context loss rejects drawing, clears GPU handles, and explicit restoration
recreates resources with identical pixels. An exploratory immediate restoration
attempt timed out; the final harness waits for a later100ms task after the loss
event before requesting restoration. Double disposal returns component CPU/GPU
accounting to zero. No renderer behavior was silently inferred from submission.

Separate native smoke observes paused tick142/zero new measured frames at elapsed
19s and30s, an explicit refusal for Move while paused, resumed progress, cancellation
and restart. Active cancellation records workerClosed:true, pendingWorker:false,
gpuPending:0 and disposed resource counts0. A native tab switch still left the
controlled page’s `visibilityState` as visible; actual hidden-event cleanup is
therefore unconfirmed in this debugging environment. Original controlled-async
fixtures independently exercise immediate visibilitychange/pagehide cleanup and
stale continuations. No forced hidden playback or settings changes were used.

[Issue228](https://github.com/lictl/WebRA2/issues/228) records an earlier harness
failure: inserting the multi-megabyte full JSON into the DOM froze Chrome after a
successful measured run. Native Save Page As eventually recovered it, but that run
is preliminary and excluded here. The final collector keeps the full report only
in a bounded32MiB local Blob, exposes a compact summary/download filename, and
revokes replaced/page-exit URLs. All12 final downloads parsed correctly and repeated
runs remained responsive. No full raw JSON, including a hidden node, enters the DOM.

Captured browser logs include six extension-origin warnings and three asynchronous
message-channel errors attributed to the page, without a harness error/result
failure. Their source is not conclusively established; a clean console is not
claimed. No benchmark input, output or source asset is uploaded by the harness.

## Evidence identities and validation

Raw reports remain ignored under the frozen build directory. Their file-byte
SHA256 identities are below. `timed-report-index.json` contains names, lengths and
hashes; its own file SHA256 is
`e2182d54b0f8dcb73e9e2fd9ff3c1b0cd9f0b0cd9d3f67c153724d82e9bc248f`.

| Raw report | SHA256 |
| --- | --- |
| `primary-ra2-960-1.json` | `315254be6c4a94278f26412e0d0eba318e6fbec6c66fecc51956536c4ac4caf5` |
| `primary-ra2-960-2.json` | `27dde9997ad5dc1b5f31ad93841b629dfaa3859ab32b9e6e35734a90c73896ce` |
| `primary-ra2-960-3.json` | `f2e841860eed611965abc34b0b3846b14f4d322aa3a6324fd31d3654cb0f8fda` |
| `primary-yr-1280-1.json` | `e406018b9c6c5653beb5b9abfa78cd4a0b29c02d326291b09421af971223e1f0` |
| `primary-yr-1280-2.json` | `b83e52c860e51441585dffb435946cef0ed84b4fb6bd693c35da5aba824b4b55` |
| `primary-yr-1280-3.json` | `24f24ab63ba8a527c9dd2aaad1143e48dbc7c04d87dd52fa5b7afac127bd27ac` |
| `support-coupled-256-960-input.json` | `5912c012381b89f3d893a8fc2a30a9136490ca2b11bb86950d17907d935d7924` |
| `support-coupled-64-960-input.json` | `05753059c3543970253436a20dd8a3cad7cef809d8e106535e69d63348ac02c3` |
| `support-render-32-1280.json` | `cec6313087b248206b36d31cf14b489f2718ace1512761da36699405ef16f95c` |
| `support-render-32-960.json` | `ee56145865574f03b72530a721a1b038698ceee92a4d4928eed78665723baaa8` |
| `support-render-64-1280.json` | `20fad94b3fadca9fa98936c87acd85118566a75027aee908332570b73a1c1feb` |
| `support-render-64-960.json` | `43ec06ac1b29e5b87a025589fda0a1c2fb389431e2e71d07cc9fd2d3c9adf99f` |

Private `correctness.json`, `lifecycle-cancel.json`, `lifecycle-pause.json`,
`hidden-observation.json`, browser logs and screenshots retain the separate gates.
Coordinator audits are in its ignored `local/gpu-final-audit.json` and
`local/gpu-build-audit.json`: all raw counts/percentiles, command/tick/replay
ledgers,70 disk/HTTP files,67 source inputs and all84 CPU image hashes reproduced.
The composed source passes1,271 public synthetic checks,5 baseline-tool checks,
9 GPU-tool checks, types,196 docs/1,001 links, publication and the CPU product
build (77 outputs/145 inputs). These checks do not establish retail campaign compatibility.

The next decision is to integrate this backend into the genuine product viewport
under [issue229](https://github.com/lictl/WebRA2/issues/229), preserving the CPU
reference and explicit unsupported voxel/effect fallback. Product UI/layout,
snapshot transport, original source scenes, other browsers, actual hidden-state
behavior and hardware backend confirmation remain separate gates. No wider engine
rewrite or resumed audio/gameplay expansion is implied by this experiment.
