# Original voxel GPU browser diagnostic

State: WORKING, [issue234](https://github.com/lictl/WebRA2/issues/234).
This original-only experiment checks the explicit Float32 ray policy against actual
WebGL2 output, separately retaining changes from the existing Float64 renderer.
No product voxel composition, retail GPU performance or native render equivalence
is claimed. Renderer/policy source remains in the component author's scope.

The [harness](../tools/gpu-voxel-performance/main.mjs) compares all pixels in the
43 original fixtures, integer GPU owner/depth/color planes and immediate default
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
strict completion upper bounds. No sustained timing result is yet claimed.

 Any shader/CPU discrepancy blocks a parity claim;
Float64 differences are an explicit experimental policy change, not tolerated
silently as matching output. GPU memory counters describe requested/accounted
resources, not browser-process RSS or guaranteed reclamation.
