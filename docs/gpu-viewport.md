# Optional GPU battlefield presentation

Status: implementation and bounded Chrome acceptance complete under
[#229](https://github.com/lictl/WebRA2/issues/229); final composition/review is in
[PR231](https://github.com/lictl/WebRA2/pull/231). This is presentation work.
Mission authority and first-mission completion remain separate
[parent230](https://github.com/lictl/WebRA2/issues/230) gates.

## Behavior

The existing CPU view loads first. An explicit **Try GPU rendering** control asks
the retained terrain worker for a resident scene. Supported terrain and SHP still
artwork use the reviewed WebGL2 renderer; scenes with voxel artwork retain the
complete CPU path with a translated explanation. No layer is removed to obtain a
GPU result. Neither mode changes simulation, command, save or replay policies.

The main thread imports the bounded scene once, creates a fresh dedicated canvas,
and releases the transfer packet and initial object metadata from controller
state. A previous 2D canvas is never reused as a WebGL canvas. Keyboard handlers
and Return-to-map controls resolve the current canvas after a mode replacement.

Worker updates carry compact sprite placements, retirement IDs, a world snapshot
and unclipped world anchors. Camera changes coalesce into one animation callback
without another worker request. The presenter redraws when data or camera changes;
an idle 15 Hz world does not manufacture 60 duplicate submissions per second.

Each successful draw publishes its own presentation sequence, exact genuine GPU
frame and owned immutable world snapshot. Picking uses the CPU raster picker for
that frame, without GPU readback. A pending update or camera change disables picks
until its draw is published. Local camera sequences invalidate obsolete selection
gestures; ordinary pan gestures retain the existing interaction pause. Selection
markers and focus reproject the matching world anchors. Completed actors retire
their artwork; standing artwork remains during the supported pending death state.

Context loss or a draw failure invalidates picks and releases the presenter once.
The controller waits for an outstanding request to settle, synchronizes the latest
local camera back to the worker, and requests a CPU frame of the same current
world. Files and local checkpoints remain available. Replacing or leaving a scene
disposes its presenter and cancels its scheduled callback; stale callbacks cannot
change the next scene.

## Component checks

The first presenter checkpoint is `626443db5f34a189e8bfccf26538a47346d01876`;
the controller/view checkpoint is `6fec257` followed by the independently authored
worker descriptor/resource validation fixes. Tests use original fixtures, not
retail files or a claimed native execution oracle.

- Eight presenter cases use genuine scenes, frames, CPU picks and source-bound
  RA2/YR pending-death states with controlled renderer/scheduler interfaces.
- Five composed controller cases exercise the real worker protocol and resident
  import, SHP picking, local pan/focus, a deferred-tick context loss, camera resync,
  refusal, replacement, Stop, save, restore and replay equality with CPU mode.
- Mounted keyboard tests exercise the current canvas after replacement, form and
  modifier exclusions, durable replay cancellation, and Return-to-map focus.
- The first composed full check passed 1,336 public tests, five performance-tool
  tests and nine GPU-tool tests, types, document/publication/evidence checks, and
  a 77-output/152-input code-only build. After the worker validation fixes and
  SHP controller regression, 109 focused GPU tests passed. The final source
  correction passes1,377 public +14 tool tests, types and the complete guard/build
  chain (78 outputs/152 inputs). The92 product/dependency inputs in the final
  95-input diagnostic exactly match the coordinator composition; the remaining
  three inputs are its private original harness. Final evidence-only changes pass
  document/link and whitespace checks.

## Browser evidence and performance work

Chrome checks use the mounted product controller, bridge, worker, presenter and
controls, with original terrain/SHP fixtures supplied by a private code-only
loader. The minified ES2022 harness uses product CSP and no cross-origin-isolation
headers. It adds timing observers, original inputs and bounded local JSON export;
it is not the production entrypoint or an original mission. The target is at least
60 useful submissions and asynchronous GPU completion observations per second
under continuous camera movement, while the real 15 Hz scheduler advances actors.
An idle scene does not require duplicate 60 Hz draws.

Measurements used an Apple M1 Max MacBookPro18,2 with 10 CPU cores and 64 GiB RAM,
macOS 26.6.2, installed Chrome 152.0.7977.83 (observed UA major 152), Node24.20.0
and esbuild0.28.2. Heavy checks from all agents paused during sustained runs.
The measured RAF opportunities were near 120 Hz; no 60 Hz display was assumed.
Hardware-versus-software WebGL backend remains unverified. Extensions and normal
browser policies were retained; these figures are machine-specific observations.

The primary workload has a 64×64 original map, 256 SHP objects, 1,024 simulated actors and
64 commanded movers at 960×640. Only 32 movers have artwork among those 256 objects.
Explicit original movement speed keeps the commands active throughout the run.
Ten seconds warm up precede 60 measured seconds; every run starts from a fresh page.
Recorded commands replay outside timing. GPU timer queries and a bounded fence
ring run asynchronously; timed cadence has no readback or `gl.finish`. The recorded
fence timestamp is the poll-start time associated with a successful zero-timeout
check, with browser scheduling delay. It is not an exact finish or scanout timestamp.

Two unsuccessful product runs remain evidence. The initial 958×638 build stopped
after 34 submissions with a fence-observation timeout while main UI callbacks
stalled for hundreds of milliseconds. Correcting the diagnostic border produced
the intended 960×640 buffer. Caching unchanged UI options/metadata then reduced
five-pan subscriber observations from hundreds of milliseconds to below 1 ms,
while preserving owner, health, selection, locale, scene and save updates.
The next 70-second run still produced only 56.95 observed frames/s and 824 logical
ticks rather than the expected 1,050. It did not pass the performance target.

Bounded attribution found duplicate deep GPU reply capture and repeated sprite
validation during camera-only preparation. Coordinator changes retain one owned
GPU reply and cache geometry only for genuine immutable captured sprite arrays,
scoped to a scene and its resource/cap identities. Per-camera sample limits remain
active. The independent raw/cached packet check covers 17 original scenes,
84 viewport variants and 83,613 CPU/picker comparisons. Short instrumented checks
are attribution evidence, not the sustained acceptance pool; their worker step
includes internal cloning/validation, and snapshot cost is measured separately.

Three candidate runs at `260994a7fb7f29f8e9ca114a91f0319d76de9577` observed
120.017–120.167 frames/s, completed all 1,050 ticks and replayed to the same state.
Their actual draw-start gap p95 was 15.3 ms and p99 17.7–18.0 ms; some gaps exceeded
16.667 ms. Average FPS does not imply an every-frame deadline guarantee. These
candidate results precede a subsequent hostile result-family descriptor correction.
The final corrected source is `6573f18cc566f6f872ee45c1bf7c09d3af839da2`, which
contains coordinator correction `7ec07d0`. Only `terrain-bridge.ts` changes among
the 95 diagnostic inputs, producing a changed main bundle; worker, renderer and
fixture bytes remain identical. A full corrected primary regression and a separate
256-actor/32-commanded-mover native-input supporting run follow below. Supporting
native controls add one further moving actor and later stop it.

| Source/run | Submitted / observed | Observed FPS | Minimum full second | Draw gap p95 / p99 ms | Gaps >16.667 ms | Ticks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 260994a candidate1 | 7,211 / 7,210 | 120.167 | 119 | 15.3 / 17.7 | 172 | 1,050 |
| 260994a candidate2 | 7,202 / 7,201 | 120.017 | 118 | 15.3 / 18.0 | 199 | 1,050 |
| 260994a candidate3 | 7,204 / 7,203 | 120.050 | 118 | 15.3 / 17.9 | 208 | 1,050 |
| 6573f18 corrected primary | 7,200 / 7,199 | 119.983 | 119 | 15.4 / 17.7 | 179 | 1,050 |
| 6573f18 corrected256/input | 7,205 / 7,204 | 120.067 | 119 | 11.5 / 12.8 | 1 | 1,050 |

All rows exceed the sustained 60 FPS target while advancing all expected ticks.
The corrected primary's maximum draw gap was 23.5 ms; its RAF opportunities had
one gap over 16.667 ms. The supporting maximum draw gap was 18.6 ms, with no such
RAF-opportunity gap. Useful submissions and completions are counted separately;
every issued fence eventually drained. No ring skips, disjoint queries or pending
GPU work remained. Peak ring size was two for primary runs and three for support.
Observed tick debt peaked at zero and one respectively; this is sampled snapshot
evidence, not a claim about unobserved internal deadlines.

Corrected draw-submit p95/p99 was 0.2/0.2 ms; query GPU time p95/p99 was
1.651/1.902 ms for primary and 1.697/1.874 ms for support. These short component
durations do not replace the end-to-end cadence figures. They exclude scanout.
Every replay matched. All four primary transcripts reached state
`1e35c10b4c9f8a5f4c341bcab0eb03445591a51320f65504370be1417a057593`;
the native-input supporting transcript reached
`366171de19be639e544dd0acc1d56836109f2cc60a29d7fc4805f3a6d08c5afa`.

The support run used the actual multiple-selection list, numeric target form and
Stop button while Run remained active. The HUD changed to moving and later idle.
Its Move/Stop worker receipts took 44.8/34.5 ms from `postMessage`; the matching
revision's fence observations were 67.8/52.3 ms. These are transport-to-observation
times, not OS input-to-scanout latency. Exact individual commands remain in the
verified replay. This single supporting row is not a stable tail-latency estimate.

Earlier original native controls at `9d1a31c` exercised GPU selection/control groups,
pan, move, Stop, save/restore/replay, EN/Traditional Chinese, current-canvas focus,
context loss and CPU recovery, GPU restart, and native hidden-page pause followed
by explicit resume. Context recovery retained the world and latest desired camera.
These are component observations at that source, not final-build performance rows.

Separate actual retail checks at `cb8546ef296c6b1469b6f56415df9083b1b30180`
loaded the selected Allied opening of both profiles from the same 16 on-device
asset files. GPU negotiation explicitly retained CPU mode because of 3D artwork.
Both preserved world/state identities, prepared artwork counts, zoom and the
repeated center pick. Local save, one tick, restore and replay equality passed;
returning to the chooser retained all 16 files. RA2 used English and YR Traditional
Chinese. This checks fallback, not retail GPU speed or full-pixel camera equality.
All 77 frozen product outputs matched their served hashes. Three unattributed
asynchronous listener-channel console errors predated the checks and remain
recorded; an entirely clean console is not claimed.

Private files, screenshots, checkpoints and raw reports remain in ignored
`local/gpu229/` in the author worktree. No asset route or upload is introduced.
Prior [GPU experiment measurements](gpu-renderer-experiment.md) remain a separate
original diagnostic build and do not establish this product gate.

Full four-browser campaign acceptance, voxel/effect GPU support, animated native
artwork and physical scanout timing remain outside this checkpoint.
The next renderer experiment is [voxel feasibility234](https://github.com/lictl/WebRA2/issues/234);
CPU fallback remains required until its measured correctness and integration gates pass.

## Evidence identities

All paths below are private relative to the author's ignored `local/gpu229/`.
The final diagnostic carries 70 code/license outputs and 95 source inputs; every
output matched HTTP bytes and product CSP. The larger retail entrypoint carries
77 outputs/152 inputs. Neither includes retail data. A later coordinator merge
may add notices without changing these measured runtime inputs; that composition
must be compared and reviewed separately.

| Frozen directory | Source | Manifest SHA-256 |
| --- | --- | --- |
| original-1 | 9d1a31caeb277c444b7934857bbba665f6182539 | `0b897659aeaa23f34a796a3aa7aedefafe9f0dff9d4df29b5edf66d0118a42c1` |
| cadence-3, failed | 9d1a31caeb277c444b7934857bbba665f6182539 | `5d77972c4aba8ee249edf35256b936916f74f15e9a439fe6c62c34e3b8baf9ff` |
| profile-1 | 9d1a31caeb277c444b7934857bbba665f6182539 | `ebbd78e2229bdc358ba060f459e37ecb38a6eb7c4554777cbcc4e644c717e048` |
| profile-2 | 9d1a31c plus recorded UI diff, later cb8546e | `b98e54f56db2cc3f36ab9cb6e887ef384573fe34dbd1992ae677bb4773c5eb26` |
| cadence-4, failed | cb8546ef296c6b1469b6f56415df9083b1b30180 | `f53d52e6349a8c24692c9caad33f0b70bd3797b655fded7852b455707f982ac3` |
| stages-3, instrumented | cb8546ef296c6b1469b6f56415df9083b1b30180 | `9fa0ff2354b7dc8c1d31ef5c9effd7ae4be921a87266e11f35d93db41acc8808` |
| stages-4, instrumented | 260994a7fb7f29f8e9ca114a91f0319d76de9577 | `d67ae8f0cb0bf59dbe52947772e36387871b4caa3c0cf2bd62b4e42caba23e20` |
| cadence-5, candidate | 260994a7fb7f29f8e9ca114a91f0319d76de9577 | `864a03f16ef8f19a4d0bfcbebdf0421de9d67a4f3f0eb03059b9f152bcee6407` |
| cadence-6, corrected | 6573f18cc566f6f872ee45c1bf7c09d3af839da2 | `cd347be1557fbae583b842aa4f82c5b89d92f55119af8c46138ba0ea049b005e` |
| retail-cb | cb8546ef296c6b1469b6f56415df9083b1b30180 | `4a628dfb378e5a1d18d87e691b26f16d26d14dbe4a4c0c34a2c39568d2ba209d` |

The `stages-*` builder records private timing-wrapper transformations; its source
hashes are pre-transform inputs. Its rows are not unmodified-product timings.
The final `cadence-6/source-harness/` retains the unchanged application build
inputs and original fixture, timing and collection source. Each `audit.py`
reconciles submitted/completed IDs, complete tick ledgers, hashes and gaps;
`input-summary.json` joins the two native commands to matching frame revisions.

| Raw file | SHA-256 |
| --- | --- |
| original-1/gpu229-original-ui.json | `5f58ac15c593a4084c2f79e1e4e13a62404033d42ee1f0ce8b5f4886547ea921` |
| original-1/gpu229-hidden.json | `fd68ec31f31c2cf21076f33c70a04da90f82fed6abade86921859d6a851788ad` |
| cadence-3/gpu229-cadence-1024.json | `579dd4e7abbacd7a3ab9efb81093d02080d2925b7edef6f100089ccbbf4a6765` |
| profile-1/subscriptions-before.json | `3b3e642a524d0045039a96915fbaf12e2feb3e1e886b0ec75ab9411e6e48e007` |
| profile-2/subscriptions-after.json | `dfb21f5af05a479e700fd7012fe7b9d510a332328ee5ca6acae8f511126eee8a` |
| cadence-4/primary-1024-1.json | `5c341ca389d4895f393a3a554d26016225683af9211e0ec95f93cc153358775f` |
| stages-3/gpu229-cadence-1024.json | `65dceac9d451fc38e6918e1e4d6dc62788a1abe79a62f002b375dede1aa4efaa` |
| stages-4/gpu229-cadence-1024.json | `ec14d2be019722fad4bffa1e762b536aaf9eca698b95602a69bc93f6155751a9` |
| cadence-5/primary-1024-1.json | `ed4ce722d1e9cb46995bc5996880e2319fe7817d6172ca2ceeed86ed9d9e4950` |
| cadence-5/primary-1024-2.json | `5f7d9e401b6805292143257d4cc620a476dde25284e6f2a615a8c3bf9a75db6f` |
| cadence-5/primary-1024-3.json | `df238b8b0d73506698be0b30338aa39121bf3a1a320e7bf526e2cd118997f4b5` |
| cadence-6/primary-1024-final.json | `87eedb378d8f13cb74c5dab413ca72b2d5072d7d80aa26e479fe76c3a37d9cc7` |
| cadence-6/support-256-input.json | `6654d0cb9009aa095b0a7a06e1923467094405ea9b512040169818f0c551a200` |
| retail-cb/native-dom-facts.json | `aea2a65150887c5a095cd3c3045b714d13bfc9e76d880021d39b4cdd460c1a6e` |

## Relevant boundaries

- [Resident scene contracts and transfer](gpu-transfer.md)
- [GPU provenance](../packages/render/GPU_PROVENANCE.md)
- [Presenter](../apps/web/src/gpu-viewport.ts) and
  [controller](../apps/web/src/terrain-controller.ts)
- [Frame protocol](../apps/web/src/gpu-protocol.ts)
- [Presenter tests](../tests/browser/gpu-viewport.test.ts) and
  [composed controller tests](../tests/browser/gpu-controller.test.ts)
