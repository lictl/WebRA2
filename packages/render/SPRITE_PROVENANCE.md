# Sprite layer provenance

`src/sprite-layer.ts`, the sprite extension to `src/terrain-scene.ts`, their original
fixtures, and `docs/sprite-layer.md` are **GPL-3.0-or-later**. Copyright 2026 WebRA2
contributors; rendering references are by OpenRA Developers and Contributors.

The layer composes the existing [SHP runtime decoder](../formats/SHP_RUNTIME_PROVENANCE.md)
and [terrain renderer](../../docs/terrain-scene.md), with source hashing from the
existing MIT-licensed [noble implementation](../vfs/HASH_PROVENANCE.md). The SHP
decoder retains its OpenRA/EA-XCC/Olaf van der Spek attribution; the layer does not
add a decoder dependency or copy a proprietary implementation.

Pinned OpenRA revision: `f3ec7f8e1593b482f85fd101652deb740c33dee6`:

- [ShpTSLoader.cs, lines 34–52](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Common/SpriteLoaders/ShpTSLoader.cs#L34-L52)
  distinguishes the decoded rectangle and original canvas, and computes an offset.
- [SpriteRenderable.cs, lines 93–112](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Game/Graphics/SpriteRenderable.cs#L93-L112)
  separates placement, scale, world tint and drawing.
- [Util.cs, lines 45–61](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Game/Graphics/Util.cs#L45-L61)
  supplies a sprite quad's vertical depth variation.
- [combined.frag, lines 180–206](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/glsl/combined.frag#L180-L206)
  performs palette lookup and rejects alpha-zero fragments before writing depth.

WebRA2 changes: owned source-hashed selected frames, unpadded canvas coordinates,
explicit integer anchor/depth inputs, a complete caller index-remap table, binary
alpha, bounded CPU clipping/sampling, deterministic ID ties and private picking.
These policies are not a claim to reproduce native RA2/YR or OpenRA renderer output.
No native art-frame selection, player-color ramp, animation, shadow, lighting,
blend operation, world transform or per-sprite Z texture is inferred.

The [GPLv3 text](../../LICENSES/GPL-3.0-or-later.txt), this notice and referenced
component notices must accompany a distributed combined build with its applicable
corresponding source. The root MIT license does not relicense GPL-derived rendering.
No retail pixels, palette values, map geometry, screenshots or derived arrays are
included in the source or original tests. Private diagnostic images remain on-device.
