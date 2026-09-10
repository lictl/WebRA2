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
All native listing files remain private. The 33 spans below total 11,839 bytes;
code spans have complete instruction boundaries, including all three bytes of
`ret 4`/`ret 8`. Two explicitly labelled spans are vtable data. The PE mapping
was checked before hashing. They are bounded static observations, not original
execution or a complete native renderer reconstruction.

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

## Interpretation and limits

Body loading constructs `ImageFile.VXL` and its `.HVA` pair with CCFile. The
VXL and HVA readers use the object's read/open vtable; the pinned entries lead to
the previously reviewed loose-before-MIX and first-match lookup paths. This
establishes the missing specialized-loader connection. The actual opening LTNK
conflict is between **LOCALMD and LOCAL**. Its selected
VXL at RA2MD root offset 8,205,072 (37,506 bytes) hashes to
`356f56b751a0da2e4d7541a7a6b3e64080e8820b8bc9a6a36b6da8d687501f89`;
the selected HVA at offset 10,228,480 (88 bytes) hashes to
`d17bb8732d76964003bdab375e6ac78b0bdfaa4e083845fe52d340816d3f3ca1`.
Their RA2MD root hash is
`69d886defad9114dd440a013b364c8c004e369b5221d1889957b49d00058559d`.
The retained RA2 alternatives are at 124,343,920 / 21,953 bytes and
127,160,992 / 88 bytes in root
`896a8b64f9f1bb8ad5e0bc64fc0b8ea8c84112494761ea1a43478d10c5ef9914`.
This does not authorize a general rule that every YR-root candidate wins.

The ordinary unit loader uses the exact allocated `APC` ID for its `W` alternative,
`NoSpawnAlt` for `WO`, and `Turret` for ordinary `TUR`/`BARL`. Positive turret
counts invoke numbered helpers: index zero has no digit suffix and subsequent
indices append the decimal number. YR `IsGattling` bypasses the numbered branch;
RA2 has no corresponding branch/key. Ordinary missing turret/barrel VXLs and
numbered missing barrels are optional on this path; this component still treats a
present VXL without its HVA as incomplete. Alternative selection at render time,
resource reload/error retention and state-dependent attachment motion remain
unresolved. Required flags in the plan are explicitly a WebRA2 closure policy.

The [previous constructor evidence](ENTITY_DEFINITIONS_PROVENANCE.md) pins Object
and Techno zero initialization for these fields. The unit subclass constructors
below call those bases and initialize their own later fields, preserving the base
values. The new read spans establish prior-value fallback, exact rule keys, and
art `TurretOffset`; this compiler supports only the unchanged zero offset. Decimal
count and boolean parsing are deliberately narrow accepted subsets of native INI
conversion, not an exhaustive CRT reproduction.

Native HVA loading reads 24 header bytes, uses file offsets 16/20 as frame/section
counts, skips 16 bytes per section name, then loops frames outside sections and
copies 48 bytes per matrix. The independent copy helper preserves all twelve
float words. Both binaries have this layout. No section-name matching occurs in
that reader. VXL section identity and transform details remain subject to the
consumer's explicit compatibility gate and the renderer's separate transform
policy; successful one-section retail decoding alone would not prove layout.

| Profile / observation | Native VA range (end exclusive) | File offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| RA2 / unit subclass constructor | `0x70a600–0x70a7d4` | 3188224 / 468 | `e0753ad63351f3e8a6b6d4555b71e5426e2404c731a31dbd8e6112f9b54a55ef` |
| RA2 / body/ordinary/alternative voxel loading | `0x5d6730–0x5d72a7` | 1926960 / 2935 | `3f92f4d6915fa82262c056addfe47dc969e0dd23646ccb3961895143a6f129b9` |
| RA2 / numbered turret loading | `0x5d6150–0x5d63ec` | 1925456 / 668 | `9285e186005133684baa3783924b84aa54406f6c369e603e731d1620df785bb9` |
| RA2 / numbered barrel loading | `0x5d63f0–0x5d669f` | 1926128 / 687 | `0d50a66ebc292be1c1658e42867e982f8dfb4c8639015880959c90eb6b114322` |
| RA2 / CCFile constructor | `0x468f50–0x468f83` | 429904 / 51 | `577a1fb60828182a0f4042bbea0a303b2b05211f0bae2b7e333188b0ea58b880` |
| RA2 / VoxelLib constructor | `0x719080–0x7190b7` | 3248256 / 55 | `2e01d2d1db9601efd98e01f4a473246e312e10ed400574c09491c1448d50c7b1` |
| RA2 / VoxelLib open dispatch | `0x719160–0x7191bf` | 3248480 / 95 | `36d1483f1cbcb45984706dc77dcf572e4bb5707ec32ddc2635b97a2944673e8d` |
| RA2 / HVA reader/frame-major copy | `0x59ebc0–0x59ed2a` | 1698752 / 362 | `ed3e58b5849b3c8a7f12173458c45c634c33ccca7046ca888fedc5bcd901696b` |
| RA2 / matrix copy helper | `0x58fde0–0x58fe01` | 1637856 / 33 | `3565089194bae11930aabc609986ce9376265921ac204da2c747bfb607e2cb73` |
| RA2 / turret count load | `0x6db614–0x6db62e` | 2995732 / 26 | `e99706fc15db1b27130c6c027ce3fc94835e12088d688808ebff4cc43a8b1941` |
| RA2 / turret flag load | `0x6dc024–0x6dc061` | 2998308 / 61 | `4fe9e10109291c760b62025fc23c9078bf2d34dca702757e97d2bee99a572eb9` |
| RA2 / art turret offset load | `0x6dd9b5–0x6dd9d2` | 3004853 / 29 | `d15442130fe47bd077a06e7961a9b3e5ea2e471cfb70add6e0d0d24096b2af4c` |
| RA2 / alternate flags load | `0x5d796b–0x5d79ae` | 1931627 / 67 | `ee4e97e23faad967a158c2330c35678f22928e16288209602b69f0e18c671c37` |
| RA2 / count predicate | `0x6df680–0x6df68e` | 3012224 / 14 | `07e2e206d224b52d6ec0a3281adc6245f7e74b95199557d91e23c67923624fb8` |
| RA2 / CCFile read/open vtable data | `0x79a6bc–0x79a6c8` | 3778236 / 12 | `67fc60b410d819a8760a065f38b5d356b32940e1c535177bcdcd5e9934c17191` |
| YR / unit subclass constructor | `0x7470d0–0x7472b7` | 3436752 / 487 | `cec269fdd3af3dfc84a8eb4f7447d33ea535f3fb30b157b1121f382ae6cf22af` |
| YR / body/ordinary/alternative voxel loading | `0x5f8110–0x5f8cdb` | 2064656 / 3019 | `fff00c924e6d45191e503597964ad95f0481ea6efba2e2dbbf190837baad62cc` |
| YR / numbered turret loading | `0x5f7a90–0x5f7dad` | 2062992 / 797 | `c3446fec730d6f2c7ed7916ed6b63ac3332838b437a197b90c536f76e9cbf055` |
| YR / numbered barrel loading | `0x5f7db0–0x5f807f` | 2063792 / 719 | `c4ace9ebc3c2a3aada6b42b8b14521ebcb16ca01baedc58559b50e528569c230` |
| YR / CCFile constructor | `0x4739f0–0x473a2a` | 473584 / 58 | `1b1defc95075f6802e9ff31c7f3c00a1c0d760b2e6d2bee5f50e385f188024b0` |
| YR / VoxelLib constructor | `0x755cd0–0x755d07` | 3497168 / 55 | `2e01d2d1db9601efd98e01f4a473246e312e10ed400574c09491c1448d50c7b1` |
| YR / VoxelLib open dispatch | `0x755db0–0x755e0f` | 3497392 / 95 | `535849d208f1ae648ec0dbee36603be26026c6729d4fd4f1a60fa51ec63ffdee` |
| YR / HVA reader/frame-major copy | `0x5bd5c0–0x5bd72a` | 1824192 / 362 | `55cfc7d21625b8a63865b1c55e08ba935d6bcb3f555203ba33741749eb0f95e8` |
| YR / matrix copy helper | `0x5ae5e0–0x5ae601` | 1762784 / 33 | `3565089194bae11930aabc609986ce9376265921ac204da2c747bfb607e2cb73` |
| YR / cache/local bootstrap order | `0x530290–0x530405` | 1245840 / 373 | `37ca687e831adb7056fc8bc534489212b9dd6556be0a4ecd7b5ecfb68022fb69` |
| YR / turret count load | `0x71284a–0x712864` | 3221578 / 26 | `04c73004767cb08b440436891485a996ec7bf8e9d15c2da9970a558e64856ae0` |
| YR / turret flag load | `0x71338b–0x7133c8` | 3224459 / 61 | `7a7a66522f9880dea6d2ee601d07a32f08e675d2ef50b16a604473ccb76f4d70` |
| YR / gattling flag load | `0x714016–0x714030` | 3227670 / 26 | `4598d6bb4a9777de74e843d56a1b0ed7eb0c282887947b462851b9f37cb4a45d` |
| YR / art turret offset load | `0x715876–0x71589a` | 3233910 / 36 | `b67211b3bb61998b634ab72c55da5bc421f758e90596dfa103ab515ee90f1f63` |
| YR / alternate flags load | `0x5f9437–0x5f947a` | 2069559 / 67 | `e6a2db7f0609004b8d789208aeca0f874ee837be2a7e835278d6af088464b01d` |
| YR / voxel loader dispatch | `0x716090–0x7160b4` | 3235984 / 36 | `a9c090e9d90200c028a4dd7827bb23163cdaa06523956a4e1718b4434f823877` |
| YR / count predicate | `0x717880–0x71788e` | 3242112 / 14 | `29202ab7d88dfb068cb26dcaea26f9b5075711d2744c3dfcf9075cf808212370` |
| YR / CCFile read/open vtable data | `0x7e16cc–0x7e16d8` | 4069068 / 12 | `04742e5f8c13e46d6c79071a1a4ebf4105c99da997d690103f6808821d8e05c7` |

## Pinned locator file digests

| Primary file at the YRpp revision above | Bytes | SHA-256 |
| --- | --- | --- |
| ObjectTypeClass.h | 3387 | `2868ff861c24244da9bfd41f236614c8479ea024cb757fde7a52d19c554d3b27` |
| TechnoTypeClass.h | 15107 | `1a5aa9007b5974ac19de815add5ea1aac9386c69c52570896f2386c46e3b9ce8` |
| FileFormats-VXL.h | 2272 | `b3ef43ed413d8b7e4fadd1d1f81379ed50cb21cdd601f12f9819477ddbe77c34` |
| FileFormats-HVA.h | 306 | `c8a68240a2fdfd6ad91e8971112480e3af56ad1cc42e461fa15e41dc6c32c634` |
| CCFileClass.h | 5397 | `59852dc24458c318b10b62b1da134ad73b469d971fcd6f0a6c769ccdb7bde1bb` |

The independent private oracle separately rehashes source roots/ranges, rebuilds
80 field values/origins and 31 requests from raw source INIs, compares all 133,864
selected voxel records and 27 HVA matrix records, and uses a forward-face raster
calculation against the TypeScript inverse-slab implementation. The
[component report](../../docs/voxel-resources.md) records counts and limits;
private source lines, matrices, voxels, images and listings are not published.
