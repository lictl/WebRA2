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

Actual shader results, exact builds and bounded cadence results will be recorded
after the first correctness run. Any shader/CPU discrepancy blocks a parity claim;
Float64 differences are an explicit experimental policy change, not tolerated
silently as matching output. GPU memory counters describe requested/accounted
resources, not browser-process RSS or guaranteed reclamation.
