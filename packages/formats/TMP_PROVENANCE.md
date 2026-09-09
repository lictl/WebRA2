# TMP decoder provenance

`src/tmp.ts` and the original synthetic TMP tests use **GPL-3.0-or-later**.
Copyright 2026 WebRA2 contributors. Retain attribution to **the OpenRA Developers
and Contributors** and **Olaf van der Spek**, author of the XCC Utilities and Library
(copyright 2000). The implementation adapts their format definitions and diamond
unpacking algorithm; it is not MIT. No new package dependency or native library
is linked or distributed.

Pinned primary references, checked 2026-09-10:

- OpenRA revision `f3ec7f8e1593b482f85fd101652deb740c33dee6`,
  [TmpTSLoader.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/SpriteLoaders/TmpTSLoader.cs):
  52-byte image header, diamond color/depth unpacking and extra-plane interpretation.
  [OpenRA license](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/COPYING)
  and file header grant GPL version 3 or later.
- EA's published FinalAlert2/XCC revision
  `6abf0f557469baea73079c6bf6550709e2e3584e`,
  [cc_structures.h](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/cc_structures.h)
  (`t_tmp_ts_header`, `t_tmp_image_header`),
  [tmp_ts_file.h](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/tmp_ts_file.h)
  (48/60-pixel tile sizes, relative color/Z/extra ranges), and
  [tmp_ts_file.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/tmp_ts_file.cpp)
  (`decode_tile`, `draw`). These XCC source files carry Olaf van der Spek's
  GPL-3.0-or-later notice. They provide editor/format evidence, not proof of original
  engine rendering, elevation, terrain movement or damage-state selection.

WebRA2 replaces unchecked stream/pointer reads with bounded immutable metadata and
owned byte snapshots. It validates index/header/plane ranges and overlap before
pixel allocation, supports missing index slots explicitly, preserves padding and
reserved bitfield values, and retains raw extra planes rather than applying a
renderer-specific composition policy. The output mask distinguishes diamond geometry
from a zero-valued palette index. Unknown bytes/ranges remain metadata; no tile
palette, lighting, remap, screen-depth or archive precedence policy is embedded.

OpenRA reads the planes sequentially and composites extras; WebRA2 follows the
explicit XCC relative offsets, allows bounded non-overlapping gaps, and returns
uncomposited planes. Absent-Z decoding is explicitly unsupported in this slice;
the metadata parser still identifies its absent plane. Reserved upper flag bits
are not treated as active feature flags: XCC declares only three low bitfields,
and the private sample corpus retains nonzero reserved bits throughout.

The eight public tests use original constructed headers and pixel patterns, not
retail images or compressed bytes. Private verification uses a separate Python
interpretation of the pinned XCC two-loop unpack and plane offsets; no game executable
or editor is run. Only reviewed hashes, counts and source ranges are published in
[the decoder report](../../docs/tmp-decoder.md).

Distributing the combined decoder/browser engine requires GPL-compatible terms,
corresponding source and build scripts, retained copyright notices, this provenance
and the [GPL license text](../../LICENSES/GPL-3.0-or-later.txt). See the project's
[distribution license mapping](../../docs/licensing.md). These source-code grants
do not grant rights to the user's game assets.
