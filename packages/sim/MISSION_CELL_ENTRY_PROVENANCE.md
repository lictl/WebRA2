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
The native Foot argument2 route is RA2 0x4c7220 and YR 0x4d85d0.
Infantry owner/update vtables come from constructor-installed 0x7a3540 and
0x7eb058; Unit tables are 0x7addf8 and 0x7f5c70. Walk cell updates call
these actor virtuals at 0x71f196/0x75be3c. Drive Process vtable slots
0x7a050c/0x7e7ef0 lead through 0x4a0666/0x4b0576 into the arrival
stages whose cell update calls are 0x4a1d51/0x4a2254 and
0x4b1cfd/0x4b220f. Drive RTTI and pointer chains are independently pinned.
Both Foot paths contain bridge-layer guards; the RA2 block additionally
skips CloakState2. Current whole-cell world movement is an explicit WebRA2
policy, not a simulation of every native locomotor or cloak transition.
The [native ledger](../../docs/analysis/mission-cell-entry-source-native.json)
rehashes 64 ranges/15,878 bytes, including 48 complete instruction spans and
16 data spans. Selected spans are not necessarily whole functions.
Placement framing, bridge and follower operands also reuse and reverify the
[existing placement evidence](../../docs/analysis/combat-placement-native.json).
The private independent source comparison is being finalized before this draft
becomes merge-ready.

Primary layout leads are pinned YRpp
[TEventClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TEventClass.h),
[HouseClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/HouseClass.h),
[FootClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/FootClass.h) and
[CellClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CellClass.h).
These are layout references, not an adopted library or proof that a header declares
every native parameter. Branches and vtable targets are checked against both
images. Private decoding uses Capstone5.0.6, without executing the game.

See the [focused report](../../docs/mission-cell-entry-source.md) for context gates,
source authority and the distinct coordinator-owned runtime composition.
