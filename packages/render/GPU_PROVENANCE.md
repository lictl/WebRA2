# GPU renderer experiment provenance

The original GPU contracts, preparation adapters, WebGL2 renderer and shaders in
`src/gpu-*.ts`, their original tests, and the composing diagnostic in
`../../tools/gpu-performance/` use **GPL-3.0-or-later**. Copyright 2026 WebRA2
contributors. No new decoder, engine dependency or proprietary implementation is
adopted by this experiment.

The preparation adapters preserve the existing WebRA2 CPU terrain and sprite
policies. Retain the [terrain notice](PROVENANCE.md),
[sprite notice](SPRITE_PROVENANCE.md), their pinned OpenRA references and the
underlying TMP/SHP decoder notices. GPU equivalence is tested against that explicit
CPU policy; it is not evidence of complete native RA2/YR visual compatibility.

Implementation references are the public
[WebGL2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/),
[OpenGL ES 3.0 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.pdf),
and [WebGL guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).
These API references are distinct from adopted source code. Shaders, texture
packing, integer sample axes, depth/owner passes and resource lifecycle code are
original WebRA2 implementations. Source/game state never depends on rendered pixels.

Only original generated maps, tiles, palettes, sprites and simulation commands
belong in the public diagnostic. Do not distribute imported retail planes,
screenshots, source tables, native listings or user saves. Generated runs remain in
ignored local storage. The [experiment report](../../docs/gpu-renderer-experiment.md)
records the covered subset, code identities, measurement conditions and limitations.

Distributions containing these components must retain this notice, the composed
component notices, [GPL text](../../LICENSES/GPL-3.0-or-later.txt) and applicable
corresponding source. The repository's MIT license does not relicense these modules.
