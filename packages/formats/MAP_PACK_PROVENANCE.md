# Map-pack codec provenance

`src/map-pack.ts` and its original tests use **GPL-3.0-or-later**. Copyright 2026
WebRA2 contributors; retain attribution to the OpenRA Developers and Contributors.
This is a TypeScript adaptation of the command framing and decoding algorithms in
OpenRA revision `f3ec7f8e1593b482f85fd101652deb740c33dee6`:

- [LCWCompression.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileFormats/LCWCompression.cs).
- [LZOCompression.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileFormats/LZOCompression.cs).
- [ImportGen2MapCommand.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/UtilityCommands/ImportGen2MapCommand.cs), length-prefixed chunk framing only.
- [OpenRA GPLv3 license](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/COPYING), also in this repository's [license directory](../../LICENSES/GPL-3.0-or-later.txt).

The LZO reference credits **Frank Razenberg**, author of the C# port of minilzo
2.06, and retains the following original upstream notice. These attributions apply
to the adapted TypeScript LZO command decoder; no C# or native binary is shipped.

> minilzo.c — mini subset of the LZO real-time data compression library.
> This file is part of the LZO real-time data compression library.
>
> Copyright (C) 1996–2011 Markus Franz Xaver Johannes Oberhumer.
> All Rights Reserved.
>
> The LZO library is free software; you can redistribute it and/or modify it under
> the terms of the GNU General Public License as published by the Free Software
> Foundation; either version 2 of the License, or (at your option) any later version.
>
> The LZO library is distributed in the hope that it will be useful, but WITHOUT ANY
> WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
> PARTICULAR PURPOSE. See the GNU General Public License for more details.
>
> You should have received a copy of the GNU General Public License along with the
> LZO library; see the file COPYING. If not, write to the Free Software Foundation,
> Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
>
> Markus F.X.J. Oberhumer, <markus@oberhumer.com>
> <https://www.oberhumer.com/opensource/lzo/>

The combined adaptation is distributed under GPL-3.0-or-later, an allowed later
version of the minilzo grant. WebRA2 replaces pointer/goto code with bounded byte
operations and an explicit state machine; validates input/output lengths, distances,
terminators and resource budgets; removes encoding and unsafe word-copy paths; and
returns newly allocated output only after complete validation. Native handling of
corrupt maps is not reproduced. Map geometry and original game behavior are outside
this codec slice.

Tests use hand-constructed original streams and one liblzo2 2.10 compression of the
original phrase `original synthetic patterned data!`. The local reference library
is used only for verification, is not linked or packaged, and adds no dependency.
Retail compressed or decompressed bytes remain in ignored `local/`. Corresponding
source, this notice and GPL license must accompany a combined browser distribution;
see [the license mapping](../../docs/licensing.md).
