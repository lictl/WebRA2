# Mission cell-entry source provenance

`src/mission-cell-entry-source.ts` and its original tests are WebRA2-authored
GPL-3.0-or-later code, composed with the existing GPL source-binding/content
components. Preserve this notice and corresponding source when distributing it.
No retail instructions, strings, source rows or disassembled listings are included.

Static interpretation uses read-only pinned Steam images:

| Profile | File | SHA-256 |
| --- | --- | --- |
| RA2 | game.exe | `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df` |
| YR | gamemd.exe | `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600` |

The paired event1 branches are RA2 `0x6e6705..0x6e6754` and YR
`0x71f1bd..0x71f218` (exclusive ends); the country-to-first-house lookups are
`0x4ed760..0x4ed790` and `0x502d30..0x502d60`. Paired entrant owner index helpers
are `0x6c7420..0x6c742a` and `0x6f9db0..0x6f9dba`. Native cell tags share the
Tag instance stored at Cell+0x3c. Infantry/Unit Foot updates route ordinary cell
entry through that tag; object capture/transport tag callbacks are separate.
A complete factual range ledger and private independent source comparison are
being finalized before this draft becomes merge-ready.

Primary layout leads are pinned YRpp
[TEventClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TEventClass.h),
[HouseClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/HouseClass.h),
[FootClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/FootClass.h) and
[CellClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CellClass.h).
These are layout references, not an adopted library or proof that a header declares
every native parameter. Branches and vtable targets are checked against both
images. Private decoding uses Capstone5.0.6, without executing the game.

See the [focused report](../../docs/mission-cell-entry-source.md) for context gates,
source authority and the distinct coordinator-owned runtime composition.
