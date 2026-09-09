# Voxel rasterizer provenance

`src/voxel-render.ts`, `src/voxel-math.ts`, their original synthetic tests and
[the component report](../../docs/voxel-render.md) are **GPL-3.0-or-later**.
Copyright 2026 WebRA2 contributors. Preserve attribution to **the OpenRA Developers
and Contributors** and **Olaf van der Spek** through the composed VXL/HVA decoders.
No game model, palette, normal-vector table, proprietary implementation body or
additional dependency is incorporated.

Pinned primary reference: OpenRA revision
`f3ec7f8e1593b482f85fd101652deb740c33dee6`, GPL version 3 or later:

- [Voxel.cs, lines 38–80](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/Graphics/Voxel.cs#L38-L80)
  supplies the explicit HVA translation adjustment and bounds/scale/Y-flip
  composition. The row-major TypeScript formula implements this OpenRA policy.
  It does not establish native RA2/YR transforms or reproduce OpenRA binary32
  arithmetic. OpenRA requires equal limb counts and uses positional bindings;
  this API instead requires each selected section/pose binding from the caller.
- [VoxelLoader.cs, lines 103–171](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/Graphics/VoxelLoader.cs#L103-L171)
  supplies grid-coordinate plane geometry evidence. WebRA2's CPU unit-cube
  intersection, work preflight, depth/owner arrays and palette policy are original
  implementation choices. No OpenRA normal table or GPU texture/mesh code is copied.
- [HvaReader.cs, lines 23–54](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileFormats/HvaReader.cs#L23-L54)
  reads raw three-row/four-column matrices in frame-major order, places them in
  column-major storage and checks invertibility. The inverse check does not mean
  the HVA transform should be inverted before applying it to geometry.

Raw-source line anchors were checked independently of web viewer line numbering.
Retain [OpenRA's COPYING](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/COPYING).
The [VXL/HVA decoder notice](../formats/VOXEL_PROVENANCE.md) records the separately
pinned EA/XCC structural references and their conflicting multi-frame/multi-section
HVA ordering. This component deliberately cannot infer which ordering is native.
It preserves the selected layout and raw float bits in its private atlas metadata.

The supplied sample does not resolve that layout conflict. Known normal formats
2/4 are accepted only for unlit geometry; all normal indices remain unused.
Unknown normal formats fail explicitly. The VXL footer matrix is retained but not
applied by the named OpenRA transform policy. Caller projection/facing, palette,
transparent index and remap are explicit; no native lighting, gamma, house color,
animation, shadow, body/turret pairing or native pixel-match claim follows.

Source hashing composes the existing MIT
[@noble/hashes notice](../vfs/HASH_PROVENANCE.md). Preserve that notice, the decoder
notice, this notice, the [GPL text](../../LICENSES/GPL-3.0-or-later.txt) and
corresponding source/build instructions when distributing the combined program.
See [the license mapping](../../docs/licensing.md). Source licenses grant no rights
to distribute player-supplied voxel geometry, animation transforms or palettes.
