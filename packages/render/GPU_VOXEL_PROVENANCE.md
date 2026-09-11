# GPU voxel experiment provenance

The new `src/gpu-voxel-policy.ts` and its original synthetic tests are GPL-3.0-or-later.
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

The possible framebuffer implementation is informed by primary Khronos extension
specifications for [EXT_color_buffer_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/)
and [EXT_float_blend](https://registry.khronos.org/webgl/extensions/EXT_float_blend/).
These specifications describe capabilities; they do not establish performance,
CPU/GPU arithmetic parity, native game behavior or device support.

This source-only checkpoint is not imported into the application bundle. The
coordinator must add the retained GPL notice/distribution mapping when integrating
it into a distributed runtime. GPU code and actual browser tests are still pending.
