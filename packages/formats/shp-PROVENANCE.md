# SHP subset provenance

The new SHP/PAL subset, composing analysis/browser tools and synthetic tests are
**GPL-3.0-or-later**, copyright 2026 WebRA2 contributors. Retain the OpenRA
Developers and Contributors attribution. This narrow adaptation is authorized by
D07; it does not import the OpenRA engine or claim native runtime equivalence.

Primary format references at OpenRA revision
`f3ec7f8e1593b482f85fd101652deb740c33dee6`:

- [ShpTSLoader.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Common/SpriteLoaders/ShpTSLoader.cs): file/frame table, rectangle, format and file-offset fields.
- [RLEZerosCompression.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Common/FileFormats/RLEZerosCompression.cs): consulted to distinguish zero-run records; zero-run decoding is not implemented in this subset.
- [Palette.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Game/Graphics/Palette.cs): 256 RGB entries and six-bit conversion reference. This slice uses the native-observed left shift only, without OpenRA's subsequent low-bit replication.
- [GPL license](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/COPYING).

Corroborating EA/XCC reference at
`6abf0f557469baea73079c6bf6550709e2e3584e`:
[shp_ts_file.h](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/shp_ts_file.h)
and [shp_decode.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/shp_decode.cpp).
These GPL-3.0-or-later sources attribute XCC Utilities and Library, copyright 2000
Olaf van der Spek. No source text was copied from these files. Their per-row
length-prefix handling informed the format-2 correction against actual bounded
sample evidence. Preserve this attribution and the source links.

The [sample report](../../docs/analysis/shp-sample.md) distinguishes editor/source
observations, native call-site facts, implemented subset and unresolved variants.
Native material contributes factual addresses, range hashes and data-flow
observations only; no decompiled listing is distributed. All test inputs are
original small synthetic fixtures, not extracted or transformed retail data.

There are no new dependencies. The standalone diagnostic uses the already pinned
Node/tsx toolchain; Node 24's experimental `stripTypeScriptTypes` transforms only
this repository's decoder source for the browser. No game data is served. Before
redistributing a combined browser engine, retain GPL-compatible notices, license
text and corresponding source/build/install scripts, as covered by the repository
[license mapping](../../docs/licensing.md). The coordinator owns that shared mapping.
This source license does not grant rights to retail assets.
