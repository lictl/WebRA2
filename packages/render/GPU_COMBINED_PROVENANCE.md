# Combined GPU renderer provenance

The original WebRA2 TypeScript, shaders and synthetic checks for the combined
terrain/SHP/voxel presentation policy are licensed GPL-3.0-or-later. They compose
the existing [GPU renderer](GPU_PROVENANCE.md) and
[voxel experiment](GPU_VOXEL_PROVENANCE.md). No retail bytes, native listings,
third-party shader implementation or game execution contributed to this module.

Issue [242](https://github.com/lictl/WebRA2/issues/242) authorizes this bounded
product dependency. The implementation author is bootstrap_review; the coordinator
owns source atlas, transport, application integration and distribution. Independent
source review and actual Chrome combined shader/startup checks remain required at
this checkpoint. Call recorder tests are not shader execution evidence.

The [WebGL2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/)
and [GLSL ES3.00 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
are primary API references for integer textures, shader bit operations, multiple
render targets and explicit readback. Integer base-depth encoding uses bounded
shifts; it requires no later-language bit-scan extension. All4,194,303 admitted
base integers are checked against binary32 encoding in an original arithmetic
check of the emitted shader expression. This checks the integer algebra in a
JavaScript uint32 harness, not execution by an actual driver.

The actual voxel depth remains the driver's output under the existing
`webra2-voxel-highp-clipped-ray-3` presentation policy. Its documented arithmetic
family, clipping restriction and standards-permitted repeated-add counterexample
remain unchanged. No CPU-f32 equality, universal conforming-driver coverage,
native rendering equivalence or simulation authority is granted by composition.

The [focused report](../../docs/gpu-combined-renderer.md) documents interfaces,
limits, invalid presentation handling, tests and pending hardware acceptance.
Distribution must retain this notice and the inherited renderer notices alongside
the source under their existing GPL terms; root integration owns manifest wiring.

The original finite startup modules `gpu-world-selftest.ts` and
`gpu-world-selftest-fixtures.ts`, authored by browser_feasibility, have the same
GPL terms. Their hand-authored small scenes contain no retail content or external
fixture dependency. They screen the actual current context before product display;
they cannot confer source authority or universal driver correctness. The code-only
web build includes this notice, both inherited GPU notices and the GPL text.
