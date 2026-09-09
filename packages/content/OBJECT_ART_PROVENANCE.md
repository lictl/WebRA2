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
