# VXL/HVA decoder provenance

`src/runtime-vxl.ts`, `src/runtime-hva.ts`, their original synthetic tests and
[the decoder report](../../docs/voxel-decoder.md) are **GPL-3.0-or-later**.
Copyright 2026 WebRA2 contributors. Retain attribution to **the OpenRA Developers
and Contributors** and **Olaf van der Spek**, author of the XCC Utilities and Library
(copyright 2000). No native binary, model, normal-vector table or new dependency
is incorporated.

Pinned primary implementation references:

- OpenRA `f3ec7f8e1593b482f85fd101652deb740c33dee6`,
  [VxlReader.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileFormats/VxlReader.cs#L40-L100)
  and [HvaReader.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileFormats/HvaReader.cs#L23-L54).
  VXL column ordering, skip/count runs and raw color/normal pairs; HVA frame-major
  matrix ordering and three-row/four-column float representation. File headers
  grant GPL version 3 or later; retain the
  [OpenRA license](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/COPYING).
- EA's published FinalAlert2/XCC revision
  `6abf0f557469baea73079c6bf6550709e2e3584e`,
  [cc_structures.h](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/cc_structures.h#L476-L514),
  [vxl_file.h](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/vxl_file.h),
  [vxl_file.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/vxl_file.cpp),
  [hva_file.h](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/hva_file.h#L40-L48)
  and [hva_file.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/hva_file.cpp).
  These XCC files carry Olaf van der Spek's GPL-3.0-or-later notice. They define
  the explicit body-relative VXL start/end/data tables, inclusive span ends,
  repeated counts, 802/28/92-byte record layout, exact file sizes and raw footer
  transform/bounds. The HVA accessor/writer uses **section-major** ordering; that
  conflicts with OpenRA for multiple frames and sections.

A third factual cross-check, **not reused code**, is Voxel Section Editor's
[HVA.pas](https://github.com/hathlife/voxel_section_editor/blob/fde704b01cb4de3adeaf1a151bbeee0994a04b99/vxlseiii14x/source/document/HVA.pas#L527-L529)
at `fde704b01cb4de3adeaf1a151bbeee0994a04b99`: it indexes matrices by
`frame * sectionCount + section`, consistent with OpenRA. Its attribution names
Banshee, Stucuk and The Profound Eol; the consulted file contains no explicit
license grant, so implementation reuse is limited to the GPL sources above.
All linked line anchors were checked against downloaded raw source lines.

WebRA2 adds fixed byte snapshots, bounded numeric metadata, full span preflight,
independent owned outputs, disjoint interval checks and aggregate allocation/work
limits. It follows XCC's explicit table offsets rather than assuming adjacent
tables as OpenRA does, requires matching inclusive ends/repeated counts, and rejects
unclaimed bytes inside a span instead of reading past its boundary. Harmless gaps
between disjoint body ranges are counted. Unlike OpenRA, HVA output stays as raw
row-major 3×4 matrices and does not require an inverse, transpose into a 4×4 matrix,
match section names, flip axes or apply VXL scale/translation. Singular finite
matrices are preserved; nonfinite float variants are explicitly unsupported.

The file itself contains no HVA layout tag. Callers must choose the documented
interpretation; supporting both access formulas does **not** establish two native
formats. The private supplied sample has one frame/section per HVA and cannot
distinguish them. No original-engine animation, lighting or render claim is made.

Distribution of the combined engine/decoders needs GPL-compatible terms,
corresponding source and build instructions, attribution, this notice and the
[GPL license text](../../LICENSES/GPL-3.0-or-later.txt), as described in
[the license mapping](../../docs/licensing.md). The source-code grants convey no
license to distribute the user's voxel models or animation transforms.
