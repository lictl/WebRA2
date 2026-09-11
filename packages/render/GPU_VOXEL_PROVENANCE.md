# GPU voxel experiment provenance

The new `src/gpu-voxel-policy.ts`, `src/gpu-voxel-renderer.ts`, browser-importable
original fixtures and synthetic tests are GPL-3.0-or-later.
They derive the sparse-cube projection, interval and ordering policy from WebRA2's
existing `src/voxel-render.ts` and import its original `src/voxel-math.ts` helpers.
Existing VXL/HVA decoding provenance remains in [VOXEL_PROVENANCE.md](VOXEL_PROVENANCE.md).
No external shader implementation, new dependency, native executable listing or
retail asset is included in this experiment.

The current presentation policy uploads Float32 inverse coefficients and uses
driver-evaluated GLSL highp slab arithmetic within explicit bounded candidate clips. Explicit per-operation CPU Float32
rounding remains a comparison reference; it is not the displayed-pixel authority.
The optional Float64 diagnostic retains the old CPU clipping and arithmetic. Both
precision changes and driver evaluation can change depth, mask and near-tie ownership.
The candidate allowance covers a stated ordinary arithmetic family, not all legal
GLSL rewrites. A permitted repeated-addition counterexample is retained in the report
and original tests; future product use requires bounded startup checks and CPU fallback.
The allowance derivation and its numeric guards are documented in the report; no external implementation was copied. The
factory accepts owned decoded presentation data, not authenticated source authority.
See [the experiment report](../../docs/gpu-voxel-feasibility.md) for the current
bounds, tested counts and incomplete GPU/performance gates.

The original shader uses primary Khronos specifications for
[GLSL ES 3.00](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
and [WebGL2](https://registry.khronos.org/webgl/specs/latest/2.0/). It encodes the
selected Float32 depth with `floatBitsToUint` in an integer owner/depth attachment;
no floating-point framebuffer extension is required. These specifications do not
establish performance, CPU/GPU arithmetic parity or native game behavior.

This experimental checkpoint is not imported into the application bundle. The
coordinator must add the retained GPL notice/distribution mapping when integrating
it into a distributed runtime. The earlier browser checkpoint failed exact CPU/GPU Float32 depth equality. Revised
coverage, independent review and sustained cadence remain pending; the report
preserves the measured differences and their scope.

The bounded reuse candidate is original WebRA2 implementation work under the same
GPL-3.0-or-later notice. It retains exact checked affine terms and immutable bin
plans from this module's existing numeric policy; no new native-game behavior,
shader precision guarantee, third-party code or source asset is introduced. Its
resource reservations, zero-reuse reference, independent packet comparisons and
pending actual-browser gate are described in the focused feasibility report.
