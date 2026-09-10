# Voxel resource provenance

The new `voxel-plan.ts`, `voxel-preview.ts`, `voxel-content-utils.ts` and original
synthetic voxel content tests are GPL-3.0-or-later. Copyright 2026 WebRA2
contributors. The boundary helpers adapt original WebRA2 object-preview and entity
compiler patterns; synthetic voxel bytes adapt the project's original renderer
tests. No game implementation body or extracted model is included.

This component composes the existing [content](PROVENANCE.md),
[typed definitions](ENTITY_DEFINITIONS_PROVENANCE.md),
[artwork](OBJECT_ART_PROVENANCE.md), [VXL/HVA decoders](../formats/VOXEL_PROVENANCE.md),
[voxel rasterizer](../render/VOXEL_PROVENANCE.md) and verified browser catalog.
Their licenses/notices remain applicable. No new dependency is added. The
coordinator owns root distribution-notice integration before merge.

The primary locator source is YRpp at
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`:
[ObjectTypeClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectTypeClass.h),
[TechnoTypeClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoTypeClass.h),
[VXL](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/FileFormats/VXL.h),
[HVA](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/FileFormats/HVA.h), and
[CCFileClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CCFileClass.h).
The headers provide locators; actual supplied binary bytes, rather than labels,
are the static evidence. Capstone 5.0.6 is an ignored private analysis dependency,
not product/runtime code. Neither game executable was run.

Whole-image pins are RA2 `game.exe`, 5,077,312 bytes,
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`,
and YR `gamemd.exe`, 5,286,208 bytes,
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
Private listings and candidate range metadata are being consolidated at this
checkpoint; complete instruction-aligned evidence ranges and the independent
private oracle will be recorded here before final review.

The reviewed [ordinary profile-loading evidence](../../docs/analysis/native-profile-evidence.md)
already pins expansion 99-to-00, RA2MD-before-RA2, tail insertion, first numeric ID
match and loose-before-MIX reads. New static traces connect both native VXL/HVA
readers to that CCFile read path. YR bootstrap constructs CACHEMD before CACHE;
LOCALMD precedes LOCAL. The scope remains ordinary successful initialization.
Unknown archive trees are not ranked from filename similarity.

Both native HVA readers consume frame count followed by section count, skip the
section-name bytes, and copy frame-major 48-byte matrices. The consumer requires
matching section counts and VXL section ID equal to its ordinal; it does not infer
an alternative mapping. Loader evidence is separate from the renderer's explicit
OpenRA transform policy and does not establish native lighting/world transforms.
