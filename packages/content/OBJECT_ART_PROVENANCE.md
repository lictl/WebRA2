# Object artwork provenance

`src/object-art.ts`, `src/object-preview.ts`, their original fixtures and
[the report](../../docs/object-art.md) are GPL-3.0-or-later, copyright 2026 WebRA2
contributors. No new dependency or proprietary implementation body is incorporated.

Primary reference: EA FinalAlert2 revision
`6abf0f557469baea73079c6bf6550709e2e3584e`, copyright 1999–2024 Electronic Arts,
authored by Matthias Wagner, GPL-3.0-or-later:
[Loading.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp).
Its `FindUnitShp`, theater suffix/palette helpers and image lookup provide factual
examples of image indirection, theater-specific names and palette association.
The editor searches additional theaters and applies its own fallback and frame
choices. Those are not treated as native runtime evidence. This implementation's
single still, flag source, fallback ordering and palette policy are explicitly
WebRA2 choices, not a translation of the editor renderer.

The resource adapter composes existing [catalog verification](../vfs/HASH_PROVENANCE.md),
[SHP decoding](../formats/SHP_RUNTIME_PROVENANCE.md) and
[palette decoding](../formats/shp-PROVENANCE.md). Preserve their OpenRA/EA-XCC/Olaf
van der Spek and MIT hash attribution. The bounded planner and adapter are original
code; no decoded index plane, palette, retail INI field values or placement geometry
is distributed in source or fixtures. Private player bytes remain on-device.

The [GPL text](../../LICENSES/GPL-3.0-or-later.txt), this notice and corresponding
source/build instructions accompany a distributed combined program. The root MIT
license does not relicense these GPL components or grant rights to game assets.

## Custom palette native observations

Both complete executable identities are pinned in [scenario construction provenance](CONSTRUCTION_PROVENANCE.md). Static reads of the Palette field feed the palette manager. Its filename builder appends the selected theater suffix, a period and PAL to the prefix. The suffix tables have TEM/SNO/URB for RA2 and TEM/SNO/URB/DES/UBN/LUN for YR. The resulting private missing resource resolves under that general rule; no object name is hardcoded. The browser planner restricts prefix length to 31 ASCII basename characters and does not reproduce native truncation, cache lifetime or lighting.

Ranges below are factual metadata, with exclusive ends and PE-mapped offsets. Whole images and ranges were rehashed before inspection using private Python/Capstone; no executable ran. Some ranges are call-site slices or four-byte suffix-table fields, not whole functions. Raw listings stay under ignored local/native-bindings/.

| Profile | VA start–end exclusive | File offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| RA2 | `0x6dd960–0x6dd996` | 3004768 / 54 | `7ea9aa3d0d81fa38cbcee84ea219a5336cc7b4952e5cbbc1c579f3a550e4432f` |
| RA2 | `0x603380–0x60360a` | 2110336 / 650 | `e9bca1f16475a33acc2e1b3a3d8a1e78477247a50d45767d99875e067ad8040f` |
| RA2 | `0x604567–0x604662` | 2114919 / 251 | `d73cf9db2035d65382a7a1a0bf9e7163fa5c608c6c0997e00d2f9a2a4750dc6e` |
| RA2 | `0x79abac–0x79abb0` | 3779500 / 4 | `d344e30ceba1d720c8c225275d940a013585a6b1302d5aa156e253e36a7a42c4` |
| RA2 | `0x79ac14–0x79ac18` | 3779604 / 4 | `067de17019ef9836d3d05d7e1c43b7d64849c7bc00814cabd8e420d85c76f42f` |
| RA2 | `0x79ac7c–0x79ac80` | 3779708 / 4 | `63cee8828f09ebb3b45f589660e0d09270dfe98efe5e045e8cda9377e5b9e0bf` |
| YR | `0x71582b–0x715857` | 3233835 / 44 | `82969a33b8223393f91f6b0d55bae09c7431e724f34df707f60efbe9c4f788f8` |
| YR | `0x717820–0x717840` | 3242016 / 32 | `0d6cf8ffb592878a2f5cb9622f37a590760542077ebb89fea6ec56506fe669e3` |
| YR | `0x6263d0–0x62665a` | 2253776 / 650 | `b23055d2aae8a1d8d224e7139f971790bb941a2a7a26fa1b0730431fd5270314` |
| YR | `0x6275b7–0x6276b9` | 2258359 / 258 | `fed5eaad986f99f96c9b60c35be527c0abeace0c03815c9c50fa72e8bcbd3eac` |
| YR | `0x7e1bc6–0x7e1bca` | 4070342 / 4 | `d344e30ceba1d720c8c225275d940a013585a6b1302d5aa156e253e36a7a42c4` |
| YR | `0x7e1c36–0x7e1c3a` | 4070454 / 4 | `067de17019ef9836d3d05d7e1c43b7d64849c7bc00814cabd8e420d85c76f42f` |
| YR | `0x7e1ca6–0x7e1caa` | 4070566 / 4 | `63cee8828f09ebb3b45f589660e0d09270dfe98efe5e045e8cda9377e5b9e0bf` |
| YR | `0x7e1d16–0x7e1d1a` | 4070678 / 4 | `cb680b67fab6d3986687649d91624220ceedff351579ffd262cce99c77092d2e` |
| YR | `0x7e1d86–0x7e1d8a` | 4070790 / 4 | `85afcc4929b4bed4ac59eceec62739de792c8ccefaab9bc72a6f89484723f586` |
| YR | `0x7e1df6–0x7e1dfa` | 4070902 / 4 | `87f221e8bb2a51247b085c2b5b82369cc2c9f95a32f1d696f4b364cd095c62c9` |

## Exact staged source migration

Policy `webra2-object-still-2` uses the reviewed
[construction stages](CONSTRUCTION_PROVENANCE.md) and
[exact retained source view](INI_SOURCE_PROVENANCE.md). Pinned primary YRpp
[ObjectTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectTypeClass.h)
provides factual field/function labels; native bytes were inspected independently.
No header implementation or proprietary function body is copied.

Both native constructors copy the allocated ID into their 25-byte ImageFile field
and initialize the generic Theater/NewTheater/Voxel flags to false. The generic
ReadFromINI path reads exact Image under the allocated ID, with the existing
ImageFile as the default. The art reads then use the resulting ImageFile against
the global art INI and pass each existing flag as its default. This supports
staged Image updates and flag retention when a later art section omits a key.
The construction component separately establishes when each exact type section
is visited, including late registration.

The building theater loader reads art Image under ImageFile with an empty default,
using a nonempty redirect for the filename while retaining flags from the original
art source. The inspected generic SHP loader uses ImageFile directly. The new
planner supports the building redirect and conservatively reports another family's
explicit redirect as unsupported; it does not extrapolate the editor's generic
Image alias behavior to all native classes.

Native limits/truncation, arctic variants, filename fallback, family constructor
overrides, native Foundation source/default policy, native duplicate parser ties,
lighting and frame/sequence selection remain separate. In particular Foundation
in this planner is explicit rectangular presentation metadata, not the native
occupancy enum; typed gameplay construction is tracked in
[#113](https://github.com/lictl/WebRA2/issues/113). Art layers use an explicit exact
last-layer presentation policy, not a claim that a populated native INI merges
identically. Source and policy fingerprints prevent this migration from silently
reusing policy-1 content identities.

These eight exclusive-end PE-mapped ranges were rehashed in the previously pinned
full executable images. Raw Capstone listings and primary-header copies remain
private under `local/native-bindings/`; scripts/range JSON are in
`local/native-art/`. No original program ran.

| Profile | VA start–end exclusive | File offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| RA2 | `0x5d57f0–0x5d59d7` | 1923056 / 487 | `a8664353d80a13fd27f4e2d93cf2e80c8e1ae95393e9087899b124ed50ba9303` |
| RA2 | `0x5d7810–0x5d7874` | 1931280 / 100 | `6cea2a85bb5617f68bb662155630ccc35740b82c24d5de7509a376d3b8e94bf7` |
| RA2 | `0x5d7aae–0x5d7b72` | 1931950 / 196 | `736a407061d9d56f72ae2878f48544d00c848042f6bf15e76791d9d13ffcb8a2` |
| RA2 | `0x459517–0x4595c8` | 365847 / 177 | `a2a54e528c597f0f6e2bff0f34eba2b070adb9ace0d20a246f43a6d01a533362` |
| YR | `0x5f7090–0x5f7277` | 2060432 / 487 | `2784f80070eb3b38f75b0f92ca65d12a5353f51eb393802919a64147de5f49a6` |
| YR | `0x5f92d0–0x5f9340` | 2069200 / 112 | `d61fd496f80b2bdd35843c3d77533b714eed23ef56ab27897db09f5a5b6af571` |
| YR | `0x5f9574–0x5f963a` | 2069876 / 198 | `575b63f43bab92197c514e1bb80c6ae7cc3bcf705c1d3716c04e0f03bd7b9652` |
| YR | `0x45f928–0x45f9e5` | 391464 / 189 | `cedd06f93d85501699d2f67486d88db1551fe5ee8d33e16b90e07b7da1d2b1f1` |
