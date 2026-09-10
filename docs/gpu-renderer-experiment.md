# GPU renderer experiment

[Issue225](https://github.com/lictl/WebRA2/issues/225) measures a bounded WebGL2
terrain/SHP path against the existing CPU renderer. The owner requires at least
60 FPS. No result is claimed by this scaffold. Simulation identities and the
existing app remain unchanged; this original-only diagnostic grants no campaign
or retail-source authority.

Use Node24.20.0 and `npm ci`. The refresh-only page can be built before the GPU
backend is ready:

```sh
node tools/gpu-performance/build.mjs local/gpu/refresh-1 refresh
node tools/gpu-performance/serve.mjs local/gpu/refresh-1 4201
```

The builder uses locked esbuild0.28.2, minified ES2022, approved source inputs and
exact code/license output hashes. The code-only immutable server uses the product
CSP and no cross-origin-isolation headers by default; an explicit `isolated`
argument enables a separately labeled optional diagnostic. It serves no source
installation, upload or arbitrary path. Previous frozen servers are preserved.
The broader existing GPL/MIT notice list is retained; the new GPU component notice
is copied byte-for-byte from the GPU provenance notice.

Click **Measure idle refresh** in a visible Chrome tab. Two seconds of warmup
precede twenty seconds of RAF timestamps. Record actual callback opportunities,
intervals and outliers; do not assume the monitor is60Hz or claim physical
scanout from callbacks. Hidden pages fail the observation. No display or browser
setting is changed.

The full experiment will compare all supported fixture pixels/depth/owners
outside timing, then measure original changing camera/sprite frames at960×640
and1280×720 stress. Genuine worker simulation will advance at15Hz, with bounded
command/step receipts and independently checked replay. Preparation, CPU submit,
GPU timer queries, observed asynchronous fence completion, cadence, input latency
and backlog remain separate metrics; submission alone cannot establish60FPS.
Warmup10seconds and three rotated60second runs are planned after correctness and
lifecycle checks. Context loss/recovery, pending cancellation/disposal and stale
callbacks are separate acceptance cases. Raw observations stay in ignored local
artifacts; the final report will preserve failures and scope limits.


The current original harness is implemented in `tools/gpu-performance/`. Its
focused boundary checks run with:

```sh
node --import tsx --test tools/gpu-performance/check.test.mjs
node tools/gpu-performance/build.mjs local/gpu/<fresh-name>
node tools/gpu-performance/serve.mjs local/gpu/<fresh-name> 4203
```

The worker owns one genuine world and replay recorder. The main thread requests
at most four fixed logical ticks per outstanding request, with a sixty-tick debt
failure bound. At64/256/1024 total actors,8/32/64 are commanded movers; these are
original profile-tagged workloads, not native RA2/YR gameplay comparisons. Snapshot
clone/hash work remains included and is reported separately from step and command
admission. A second fresh worker verifies the complete exported transcript after
the timed interval. Manual commands refuse immediately while a request is busy.

Each useful submission changes camera or sprite positions. Main-frame preparation,
backend submission and fence insertion/flush are measured separately. At most eight
GPU query/fence receipts are retained; a full ring skips a render opportunity,
not a simulation tick. Polls use zero-timeout `clientWaitSync`; disjoint timer
queries are discarded. Fence observation is an upper bound obtained on a later
JavaScript turn, not a precise GPU finish or physical display timestamp. No timed
readback or `gl.finish` occurs. Renderer resource counters describe owned/requested
buffers, not total browser/GPU RSS. Initial shader compilation/upload is outside
warm timings and labeled as submission work.

Correctness also reads the default framebuffer immediately after drawing, before
the diagnostic integer-plane readback. Both are compared with the CPU result.
The dedicated context requests alpha with no premultiplication/antialias/depth/
stencil or preserved drawing buffer. Tiny16/32-pixel atlas variants use matching
clipped viewports and retain global source order. Forced context loss/restoration
and double disposal are measured separately. Final corrected measurements remain
pending; exploratory failure observations are preserved privately.

The frozen matrix uses an explicitly RA2-tagged original renderer fixture. The
profile selector applies only to the original worker model. Map32/64 is recorded
independently of actor count and viewport. Required primary rows are map64 with
1024 total actors/64 movers, at960×640 with the RA2 world and1280×720 with the YR
world, three rotated runs each. Supporting single-run rows cover renderer-only
32/64 maps at both viewports and coupled64/256 actors at960×640. Single-run rows
will not be presented as repeated evidence. Cold first use reports preparation,
submission, an asynchronous completion observation and the available GPU query.
