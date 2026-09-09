# Bounded map-pack decompression

The browser-compatible [decoder](../packages/formats/src/map-pack.ts) implements
LCW/Format80 and LZO1X with exact-length validation. Source attribution and local
changes are in [map-pack provenance](../packages/formats/MAP_PACK_PROVENANCE.md).

`decodeLcwBlock(bytes, expectedLength, reverse = false)` handles literal, fill,
relative and absolute copies, including forward overlap. `reverse` changes the
absolute copy operands into backward distances. `decodeLzoBlock(bytes,
expectedLength)` handles initial/extended literals, all match classes and trailing
literals. Both require the end marker, consume all compressed input, and return
exactly the requested output length. An incomplete result is never returned.
Each standalone codec accepts at most 65,535 input bytes and 65,536 output bytes.

`decodeMapPack(bytes, 'lcw' | 'lzo', options)` reads repeated little-endian uint16
compressed/output length pairs followed by independently compressed blocks. It
preflights every header and aggregate size before allocating combined output.
Each block must have nonzero lengths and expand to at most 8,192 bytes. Defaults:
16 MiB packed input, 32 MiB output, 4,096 chunks. `outputLimit`, `chunkLimit` and
optional `expectedLength` can reduce the budgets; they cannot increase hard caps.
`MapPackError` reports a stable code and offset within the supplied packed bytes.

The caller owns Base64/INI assembly, profile/source verification, cancellation and
worker scheduling. This synchronous bounded primitive has no File/DOM/network/native
runtime dependency. It returns caller-owned mutable bytes and does not cache assets.
Empty framed input is valid only as an empty pack; terrain consumers must enforce
required section/data lengths. Zero/zero headers are rejected; the observed terrain
sentinel is inside the decompressed data, not an empty compression chunk. Terrain
cell records, object placement, renderer and native fallback behavior remain later
work. Do not infer a playable mission from successful decompression.

## Evidence

Public synthetic tests exercise literal and extended runs, every LZO match class,
overlap, LCW modes, exact lengths, truncation at every byte of representative streams,
invalid distances/end markers, multiple blocks and aggregate budgets. One original
8 KiB patterned-text vector was compressed independently with liblzo2 2.10.

Private verification reads the two pinned opening members from
[the selected profiles](analysis/m0-reference-profile.json) through the existing
verified-source reader. INI numeric keys were checked unique and ordered, then the
three packed sections were Base64-decoded on-device. All six streams decoded:

| Profile / section | Packed bytes | Output bytes | Output SHA-256 |
| --- | ---: | ---: | --- |
| RA2 IsoMapPack5 | 31,977 | 69,700 | c2fe652e2c839c08b0718207be5baebc73e1b348e24d9989175b14f3b20aab2a |
| RA2 OverlayPack | 652 | 262,144 | 76d87878a951ad02666e464e64afb2062f791992a53e6eff9070a9cc43ab98b5 |
| RA2 OverlayDataPack | 681 | 262,144 | b230c808e341091cf5706738cadb0a7e73bc89fedec861707bb295c19984492b |
| YR IsoMapPack5 | 82,264 | 170,284 | e6b63575bc9779a1b2d9b78eb54cf4f7284c9641c34c9c57a08b90d08beab193 |
| YR OverlayPack | 939 | 262,144 | c6f33bd38821f24dc72da78542e1608fc0a04c2235deab3b899f6ca63c9b2ce8 |
| YR OverlayDataPack | 1,027 | 262,144 | 7fb659359a8435d58288ea1d0dca0c2d93e9d84eec2a8d891ef1232f6ef7adb6 |

The LZO outputs match liblzo2 2.10 `lzo1x_decompress_safe` byte-for-byte. LCW outputs
match a separate Python interpretation of the pinned OpenRA command grammar; this
is an independent implementation check, not comparison with a native game. A further
51 original random/repeated/mixed vectors, 0–50,000 bytes, compressed with liblzo2,
decode to identical hashes. No retail data is embedded in these public tests.
Private scripts/results are preserved under `local/worktrees/map-packs/local/`:
`verify-retail.mjs`, `verify-oracle.py`, `check-oracle.mjs`, `retail-summary.json`,
`oracle-summary.json`. Browser presentation remains a separate integration gate.
