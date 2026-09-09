# Bounded TS/RA2 TMP terrain decoding

[Issue #67](https://github.com/lictl/WebRA2/issues/67) adds a pure TypeScript TMP
decoder in [tmp.ts](../packages/formats/src/tmp.ts). It decodes original 48×24 and
60×30 diamond color/depth planes and optional rectangular extra graphics from
user-supplied bytes. This is a format component: no DOM, renderer, filesystem,
network, palette selection, archive policy or game execution is involved.

## API and ownership

```ts
parseTmpIndex(bytes: Uint8Array, limits?: Partial<TmpLimits>): TmpIndex
decodeTmpTile(bytes: Uint8Array, ordinal: number, limits?: Partial<TmpLimits>): DecodedTmpTile
```

`parseTmpIndex` returns frozen grid/header/range metadata. `tiles` preserves the
row-major grid order, with `column` and `row` on each present tile; a zero offset
is `null`. Physical record order may differ from grid order. Duplicate nonzero
offsets are rejected as an unsupported shared-record layout. Leading gaps and
unclaimed record ranges are exposed by offset/length; their payloads are not
returned as metadata.

`decodeTmpTile` takes an ordinal, reparses one owned byte snapshot, and returns
that snapshot's index and tile metadata plus independent, caller-owned pixel
buffers. A previously parsed index cannot authorize ranges in a changed source:
the decode API does not accept caller metadata. Separate calls may observe
different caller bytes and make no source-hash claim; the caller's VFS supplies
verified source identity when required. Input subviews are copied exactly, native
typed-array length is checked before copying, and shared memory is rejected
because it cannot provide an atomic snapshot. Returned metadata and result records
are frozen; the pixel arrays are deliberately mutable and owned by their caller.

`pixels`, `zPixels` and `mask` are each `tileWidth * tileHeight` bytes in row-major
order. The mask is 1 inside the encoded diamond, independently of palette index
zero, and 0 outside. The diamond starts with four pixels centered on the first
row, grows by four to the center, then shrinks by four; its final row is empty.
The packed size is `tileWidth * tileHeight / 2` bytes per plane.

When extra graphics are present, `extra` contains their signed template-relative
`x`/`y`, width/height, and raw rectangular color/depth arrays. They are not combined
with the diamond or repositioned according to tile elevation. Zero colors and
depth bytes of 32 or more are retained. The pinned reference renderer treats extra
color zero as transparent and only applies extra depth below 32, but that operation
is downstream of this decoder. Returning raw values avoids silently inventing
visibility or depth for those pixels.

An absent tile rejects with `tmp-empty-tile`. A present tile without advertised
Z data remains inspectable metadata but decoding rejects with
`tmp-unsupported-no-z`; no zero-depth substitute is returned. Unsupported
dimensions, malformed input, duplicate offsets and budget violations raise
`TmpError` with a stable `code` rather than yielding a blank tile.

## Format evidence and validation

All multibyte fields are little-endian. The 16-byte file header stores grid width,
grid height, diamond width and diamond height as four 32-bit integers, followed by
one absolute 32-bit offset per grid slot. Present image headers occupy 52 bytes:

| Relative byte offset | Stored field |
| --- | --- |
| 0, 4 | Signed template X/Y |
| 8, 12, 16 | Signed relative extra-color, diamond-Z and extra-Z offsets |
| 20, 24, 28, 32 | Signed extra X/Y/width/height |
| 36 | Raw 32-bit flag word: extra bit 0, Z bit 1, damaged bit 2 |
| 40–42 | Raw height, terrain-type and ramp-type bytes |
| 43–48 | Two RGB radar triplets |
| 49–51 | Three uninterpreted padding bytes |

Color starts immediately after the header. Advertised depth/extra offsets select
their corresponding planes. Each active plane must start after its own header,
fit before the next physical tile record (or EOF) and not overlap another plane.
Inactive extra fields can contain unspecified negative values and are preserved
without treating them as dimensions or offsets. Grid/header bounds are checked
before record allocation; every active plane is checked before pixel allocation.

The upper 29 flag bits, three padding bytes, damaged bit, radar colors and raw
height/terrain/ramp bytes are retained explicitly. Nonzero reserved flag bits do
not imply unknown active features: the pinned XCC structure declares three low
bitfields and private retail samples retain nonzero upper bits. Damaged-flag samples
use the same decoded plane layout; this does not establish how the native game
selects damaged art or applies terrain rules. See [pinned source attribution and
format differences](../packages/formats/TMP_PROVENANCE.md).

Default hard limits are 16 MiB input, 4,096 grid slots, 2,048 per extra dimension
and 4,194,304 pixels for one tile's diamond rectangle plus extra rectangle. Supplied
limits may only lower these values. All indexed tiles must meet those structural
limits, even if only one is decoded. The selected output uses exactly three
diamond-sized arrays plus two extra-sized arrays when present: at most
`2 * pixels + tileWidth * tileHeight` bytes (8,390,408 bytes at the 60×30 maximum).
The bounded source snapshot and metadata are additional memory; this is not a
browser process RSS claim. There is no retained file or all-frame pixel cache.

## Public and private verification

With Node 24.20.0 and `npm ci`:

```sh
node --import tsx --test tests/formats/tmp.test.ts
npm run check
git diff --check
```

Eight [original synthetic tests](../tests/formats/tmp.test.ts) cover both diamond
sizes, geometry masks and color zero, raw extra depth, signed placement, reserved
metadata, missing/non-square/reordered slots, independent owned buffers, stale
input metadata, header/table truncation, shared/crossing records, plane overlap,
dimensions/budgets, typed-array metadata shadows, shared memory and explicit
unsupported no-Z decoding. No retail fixture or screenshot is in public tests.

Private checks on 2026-09-10 verified 64 candidate members (four per each of 16
relevant nested archives), totaling 1,423,404 source bytes, against pinned root and
member SHA-256 identities. Header candidates used the declared 48/60 width and
2:1 geometry; member filenames remain unresolved. The samples cover the archive
name candidates for temperate, snow, urban, new urban, desert and lunar theaters,
including expansion variants. This naming evidence is a hash candidate, not a
new native mount-order claim.

Across 498 slots, 485 present subtiles decoded and 13 remained absent. There were
183 extra-graphic subtiles and 140 damaged-flag subtiles. All 485 present subtiles
carried nonzero reserved flag bits; none had an unclaimed plane gap. A separately
written Python interpretation of the pinned XCC two-loop unpack and explicit
plane offsets matched all 1,821 color/depth/mask/extra SHA-256 comparisons. Total
decoded output was 3,141,168 bytes across the sample. This is an independent
interpreter comparison, not original-game execution or framebuffer equivalence.

Pinned outer roots:

- `ra2.mix`: `896a8b64f9f1bb8ad5e0bc64fc0b8ea8c84112494761ea1a43478d10c5ef9914`.
- `ra2md.mix`: `69d886defad9114dd440a013b364c8c004e369b5221d1889957b49d00058559d`.

Representative members below use archive paths from the public
[MIX census](analysis/mix-census.json), ordinal/numeric ID and root-absolute ranges.
Full private per-plane facts remain ignored under `local/`; their canonical report
SHA-256 is `96ff56e3076693422d40d079c8bb9e2797d74ad81652e77bd13e96e4547d5192`.

| Nested archive | Member ordinal / ID | Root offset | Bytes | Member SHA-256 |
| --- | --- | --- | --- | --- |
| ra2.mix/#0:80e03363 | 0 / 800caf16 | 89857746 | 22288 | 1f4426d0bf55698840f626644886a6e2d75074ec5f26ebff630b931a4f4f4566 |
| ra2.mix/#6:bccc4d97 | 0 / 805330f2 | 62606586 | 51984 | 6f8245d7840645ee1a8a2a2457b029b7d415ee9645057cd4ba1917db39c5dc7b |
| ra2.mix/#11:0f5d1d99 | 1 / 804e346f | 22401954 | 2352 | 406cd57019bc64b276222c7111221d2cc7164773e7e5d2f2656cb6dac140222c |
| ra2md.mix/#0:8c8cca19 | 2 / 801b78af | 73755626 | 5294 | 435d3a3df7ef23a8bea69919d1ae2b9eb337281a15c75be3531853f832d0f517 |
| ra2md.mix/#18:3bfb683c | 0 / 8039c835 | 130637574 | 1872 | d6e202f5671a61888b2d831f5195b633ca4cf5832e76530320e05a8f9c820fdf |
| ra2md.mix/#19:4de6a424 | 1 / 8072186d | 98520990 | 29712 | 3c04a6a49626af9656b32fac181789da05f9794f869b83d3522484df18a23f20 |

The metadata baseline supports decoding these samples. Browser terrain composition,
palettes, remap/lighting, elevation/Z ordering, tile-set INI mapping, camera and
picking still require their own integration evidence. A decoded tile or map does
not establish a rendered or playable original campaign.
