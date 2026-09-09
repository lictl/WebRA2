# Runtime SHP provenance

[shp-runtime.ts](src/shp-runtime.ts) and its
[original synthetic tests](../../tests/formats/shp-runtime.test.ts) are
GPL-3.0-or-later, copyright 2026 WebRA2 contributors. Preserve the OpenRA
Developers and Contributors attribution and XCC Utilities and Library,
copyright 2000 Olaf van der Spek. This is an original bounded TypeScript
adaptation of the referenced format logic; no runtime dependency was added.
It does not change the earlier [M0 subset](shp-PROVENANCE.md).

Primary references at EA mission-editor revision
`6abf0f557469baea73079c6bf6550709e2e3584e`:

- [cc_structures.h](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/cc_structures.h#L307-L327): global header and 24-byte frame fields, including all three words before the absolute offset.
- [shp_ts_file.h](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/shp_ts_file.h): compression-bit dispatch and absolute image offsets.
- [shp_ts_file.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/shp_ts_file.cpp#L101-L131): validates an empty record using both zero dimensions and zero offset. Independent absolute-offset reads permit payload aliasing; no frame-reference chain is involved. Its separate image-export shadow convention is only a sample-selection clue here.
- [shp_decode.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/shp_decode.cpp#L800-L862): per-row length prefixes, zero-run pairs and clipping at row width. The runtime subset rejects underfill and nonterminal overruns instead of inheriting unchecked memory behavior.
- [XCC GPL text](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/COPYING).

Primary references at OpenRA revision
`f3ec7f8e1593b482f85fd101652deb740c33dee6`:

- [ShpTSLoader.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Common/SpriteLoaders/ShpTSLoader.cs): header/rectangle/offset parsing, raw formats 0/1 and format-3 row dispatch. This reader independently seeks each frame's absolute offset. We preserve the unpadded rectangle, not its even-dimension buffer layout or centered render offset.
- [RLEZerosCompression.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Common/FileFormats/RLEZerosCompression.cs): nonzero literals and zero followed by an unsigned byte run count.
- [OpenRA GPL text](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/COPYING).

The references disagree about format 2. The
[runtime report](../../docs/shp-runtime.md) retains the previously evidenced
nonzero subset and labels zero-containing format-2 rows unsupported. Empty
records, terminal clipping and shared-payload validation are documented separately;
successful parsing does not prove native palette, shadow, remap or playback behavior.

There are no copied retail fixtures or proprietary program listings. Private
samples contribute hashes, ranges, counts and decode comparisons only. GPL source
rights do not license retail assets. Redistribution must retain notices, GPL text
and complete corresponding source/build instructions, following the coordinator's
[license mapping](../../docs/licensing.md).
