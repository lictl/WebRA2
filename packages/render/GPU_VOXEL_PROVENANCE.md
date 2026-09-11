# GPU voxel experiment provenance

The new `src/gpu-voxel-policy.ts`, `src/gpu-voxel-renderer.ts`, browser-importable
original fixtures and synthetic tests are GPL-3.0-or-later.
They derive the sparse-cube projection, interval and ordering policy from WebRA2's
existing `src/voxel-render.ts` and import its original `src/voxel-math.ts` helpers.
Existing VXL/HVA decoding provenance remains in [VOXEL_PROVENANCE.md](VOXEL_PROVENANCE.md).
No external shader implementation, new dependency, native executable listing or
retail asset is included in this experiment.

The initial policy explicitly rounds inverse coefficients and ray operations to
Float32. Its optional Float64 diagnostic reproduces the unchanged CPU renderer in
original fixtures; the Float32 policy can change depth and near-tie ownership. The
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
it into a distributed runtime. Actual browser validation remains pending.
