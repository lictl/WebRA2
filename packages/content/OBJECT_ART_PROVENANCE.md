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
