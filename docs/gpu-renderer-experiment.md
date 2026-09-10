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
will be included when the backend is integrated.

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
