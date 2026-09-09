# Unicode font and locale evidence provenance

The locale scanners, Node report and original synthetic tests use GPL-3.0-or-later
because they compose the [content/CSF component](PROVENANCE.md). Copyright 2026
WebRA2 contributors. No game font, glyph image, translated value or source row is
included. The font parser is a bounded TypeScript format adaptation with an explicit
one-based Unicode map and MSB-first bitmap inspection. It emits coverage facts,
not an implementation of the native text renderer.

Reference: [Phobos-developers/ra2fnt](https://github.com/Phobos-developers/ra2fnt/tree/56da5b30fb53eebfaf35e98b2e1c6b3e150f58af),
revision `56da5b30fb53eebfaf35e98b2e1c6b3e150f58af`, MIT, copyright 2026 Belonit.
The [FNT parser](https://github.com/Phobos-developers/ra2fnt/blob/56da5b30fb53eebfaf35e98b2e1c6b3e150f58af/src/internal/fnt/fnt.go)
supplies field layout and symbol records; the
[PNG-set converter](https://github.com/Phobos-developers/ra2fnt/blob/56da5b30fb53eebfaf35e98b2e1c6b3e150f58af/src/internal/pngset/pngset.go)
supplies one-based map interpretation (zero absent) and bitmap bit order. No Go
source is vendored or executed. WebRA2 adds exact-length validation, resource limits,
all-map/all-glyph validation, detached metadata, duplicate-string ordinal evidence,
and requested-character coverage with controls and blank/zero-width glyphs separated.
The parser deliberately rejects the older `FoNt` format and unexplained tails.

The YRpp [StringTable header](https://github.com/Phobos-developers/YRpp/blob/9402d7da0fe14d46703ba871ce3e6b3cde855bfc/StringTable.h)
is an address/schema reference only: its enum labels raw language ID 9 as Chinese.
That is not evidence distinguishing Traditional and Simplified Chinese. No YRpp
implementation is copied into this locale component. Native runtime selection,
string layout, fallback and duplicate lookup remain separate observations.

The adopted MIT permission notice is retained below. Future combined distributions
must retain it together with GPL terms and the corresponding source/build information.
See [root licensing](../../docs/licensing.md).

MIT License

Copyright (c) 2026 Belonit

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
