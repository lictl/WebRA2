# Runtime indexed SHP frames

Issue [#78](https://github.com/lictl/WebRA2/issues/78) adds a bounded SHP(TS)
reader for UI and world-sprite consumers. It returns indexed frame rectangles;
palette selection, zero-index transparency, remap, shadows, lighting, animation
timing and scene placement remain renderer/content policies. This is not a
campaign renderer or native rendering-equivalence claim. The earlier
[M0 sample decoder](analysis/shp-sample.md) is unchanged. Exact source versions
and license obligations are in [SHP_RUNTIME_PROVENANCE.md](../packages/formats/SHP_RUNTIME_PROVENANCE.md).

## API and ownership

`createRuntimeShp(bytes, lowerLimits?)` in
[shp-runtime.ts](../packages/formats/src/shp-runtime.ts) owns one fixed input
snapshot and returns frozen metadata plus `decodeFrame(ordinal)`. The snapshot
accepts a native fixed `Uint8Array`, including a subview; Buffer/subclass,
SharedArrayBuffer and resizable-buffer inputs reject. Imported accessors and
iterators are not consulted for the byte copy. The policy is `webra2-shp-1`.
Content/session code supplies verified source identity separately.

Metadata preserves canvas width/height, table extent and frame ordinal, x/y,
width/height, all three complete LE32 words at frame offsets 8/12/16, absolute
data offset, bounded data end, emptiness and shared payload ownership. The legacy
`compressionWord` name retains the raw word at +8; it is not a mode enum.
`compressionByte` is byte +8 and a frozen `auxiliaryBytes` tuple retains bytes
+9/+10/+11. It does not pad odd dimensions, convert coordinates or infer the
meaning of those higher bytes or the other words.

Each successful decode owns one private `width * height` index buffer.
`copyPixels()` returns a fresh native `Uint8Array`; mutations cannot affect
metadata, later copies or subsequent decodes. The returned object is frozen,
but JavaScript typed-array elements are not described as frozen. There is no
decoded-frame cache or all-frame allocation. Consumers must budget retained
frame objects and pixel copies and release their references when finished.

Index construction validates all frame-table geometry, offsets, caps and shared
layouts. **It does not decode or certify every payload.** Unknown compression
bytes remain in metadata; selecting a byte greater than 3 throws
`shp-unsupported-compression`, including for empty records. Higher bytes of the
raw word do not select a mode.
Errors contain a code, frame ordinal when available and input byte offset,
without pixel values. Decode failures publish no partial output.

## Supported subset

| Record | Interpretation and boundary |
| --- | --- |
| Formats 0/1 | Exactly `width * height` raw indices, including zero. |
| Format 3 | Each row starts with an LE16 byte length including that prefix. Nonzero bytes are literals; zero followed by an unsigned byte counts zero indices. |
| Format 2 | Only per-row `width + 2` prefixes followed by nonzero literals. Zero or another row length throws `shp-format2-ambiguous`. |
| Empty | Both dimensions and the data offset must be zero. No pixel buffer content is invented; retained x/y/words are uninterpreted. |
| Shared payload | Equal nonzero offset, dimensions and compression byte. Each record retains its own origin, full flags word and auxiliary bytes/words. Lowest ordinal identifies the payload owner; mismatched layouts reject. |

The next **distinct**, sorted nonzero offset or EOF bounds a payload, independently
of table order. Shared payloads have no recursive frame-reference semantics.
Bytes after the consumed rows/raw rectangle remain `trailingBytes`; their value
or purpose is not assumed to be padding. Prefixes into another payload,
truncated runs, literal overruns and underfilled rows reject.

Format-3 terminal zero runs may exceed the remaining width; the reader consumes
the pair, fills only the remaining indices and reports `clippedTerminalZeroRuns`
and `clippedZeroIndices`. The unsigned count bounds each clip to at most 255
indices. A run overflowing before the row ends rejects. Zero-count runs consume
their pair, produce no indices and increment `zeroLengthRuns`; they cannot create
an infinite loop. Underfill does not silently become transparent pixels.

This terminal clipping follows the pinned XCC decoder's width clamp. All observed
private clips were exactly one index beyond width, for both odd and even widths.
The implementation does not assume this observation limits every valid sprite;
larger terminal clips are supported by the same bounded source algorithm. The
strict nonterminal/underfill policy is WebRA2's safety subset, not verified native
error handling. No empty rows were inferred from truncated data.

Format 2 remains deliberately narrow: OpenRA reads one literal-row prefix outside
its row loop, while XCC's compressed-bit path reads every row and applies zero
runs. The real M0 loading sample proves per-row nonzero data only. This change
does not resolve the divergent zero semantics or silently pick one.

## Compression-byte correction

Issue [#104](https://github.com/lictl/WebRA2/issues/104) corrects the former
full-word mode dispatch. The pinned OpenRA loader reads one byte at frame +8,
then skips eleven bytes before the absolute data offset. XCC preserves a 32-bit
`compression` field but checks bit 1; neither source makes the complete word an
enum restricted to 0–3. The public fields are additive and the policy remains
`webra2-shp-1`; code that assumed `compressionWord` was a mode must use
`compressionByte` instead. Frozen auxiliary bytes preserve information without
inventing shadow, palette, remap or memory-initialization semantics.

A read-only static check of the pinned YR executable supports the byte access.
The helper at VA `0x69e900` resolves SHP data, validates the frame index, uses
the 24-byte frame stride after the eight-byte global header, and reads frame
byte +8 before checking bit 1. The adjacent helper at `0x69e8d0` checks bit 0
from the same byte. YRpp supplied the address lead; the actual supplied binary
was checked with Capstone 5.0.6. No game code was executed or published.

| Native evidence | Identity |
| --- | --- |
| gamemd.exe SHA-256 | `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600` |
| Half-open virtual range | `0x69e8d0` to `0x69e92e` |
| File range | offset 2,746,576; 94 bytes |
| Range SHA-256 | `01473ad444d5daa82eba193d5290eb5a1da1fb37fb7f0b484a1655412681d10e` |

This supports the field-width correction, not every native draw path or the
meaning of unknown bits. A matching RA2 native helper has not been established.
WebRA2 still rejects low-byte modes greater than 3 instead of masking them with
3. Its strict bounds and ambiguous-format-2 rejection also remain unchanged.

The triggering private member is identified without publishing its filename:

| Source fact | Value |
| --- | --- |
| Root | ra2.mix, with the SHA-256 pinned below |
| Member range | offset 269,770,650; 1,792 bytes |
| Member SHA-256 | `f1e41e109a305a93a692257f1642ddad9305a32921da33023087fed43d4802ea` |
| Header census | Four records; each raw word `0xcccc0003`, mode byte 3, auxiliary bytes `[0, 204, 204]` |

A separate Python comparison rehashed every root and selected member, checked
the selected frame's retained header fields, decoded its bounded payload using
the primary raw/row-zero-run interpretation and compared every index against
the actual TypeScript output. This covers the first frames selected by the
private [#100](https://github.com/lictl/WebRA2/issues/100) preparation probe:

| Profile | Selected first frames | Indexed headers | Compared indices | Selected modes 1 / 3 | Headers with nonzero upper bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| RA2 | 106 | 3,434 | 951,139 | 3 / 103 | 4 |
| YR | 131 | 3,594 | 1,597,457 | 4 / 127 | 0 |

All 237 selected frames matched, representing 231 distinct physical members
and 2,548,596 compared indices. Only one selected first frame required the
upper-byte correction. All 7,028 indexed headers had mode 1 or 3; the header
census does not certify the other payloads. This is a decoder comparison of an
explicit preparation selection, not independent proof of art-name, palette,
frame-choice or native campaign behavior. The preparation's missing resource
and voxel rows remain separate content/renderer work.

## Resource limits

| Limit | Maximum |
| --- | ---: |
| Input snapshot | 16 MiB |
| Frame records | 4,096 |
| Canvas dimension | 2,048 each |
| Any frame's indexed rectangle | 4,194,304 pixels |

Overrides only lower these limits, using nonnegative safe integers. Table size
is checked before frame-object allocation; pixel bounds apply before any decoded
allocation. Indexing is bounded by input copy plus `O(frames log frames)` offset
sorting. A selected decode consumes at most its bounded payload and scans at most
its capped pixel count. Default owned byte storage is at most 16 MiB input plus
4 MiB per retained decoded frame; `copyPixels()` adds up to another 4 MiB per
retained copy. These are owned byte bounds, not JS/process peak memory claims.

## Private comparison

Eight profile/sample cases from the
[opening dependency candidates](analysis/dependency-candidates.json) cover seven
distinct members. They are explicit candidate ranges, not a new claim about
effective archive selection. GTPowExp is shared by both profiles. The RA2 and YR
building samples each have three nonempty latter-half frames containing only
indices 0/1; these are **shadow candidates**, selected using the XCC export
convention, without applying that convention in this decoder.

The verified source reader checked full root and member SHA-256. A separate
Python interpreter independently checked root/range bytes, decoded every frame
using XCC's raw/row-zero-run rule and compared every per-frame indexed SHA-256
with TypeScript. No raw pixels, original frame records, palettes or screenshots
are published. Every selected payload passed; no row underfill, unknown format,
zero-count run or shared nonzero offset occurred in this sample set. Shared
offsets, format 0 and zero-count runs have primary-source plus synthetic coverage,
not private retail confirmation.

Separately, the pinned M0 GLSLMD.SHP format-2 frame produced the same 480,000
indexed bytes hash `dc0cffb28e774f9b34c27eb43540449866be869a9db0df6982f9bceb2a85c3d9`,
481,200 consumed bytes and zero trailing bytes with this runtime decoder. Its
source identity and independent earlier byte result remain in the linked M0 report.

Root pins:

| Root | SHA-256 |
| --- | --- |
| ra2.mix | `896a8b64f9f1bb8ad5e0bc64fc0b8ea8c84112494761ea1a43478d10c5ef9914` |
| ra2md.mix | `69d886defad9114dd440a013b364c8c004e369b5221d1889957b49d00058559d` |
| language.mix | `870c3bcc596e8690c55077a4c651f88d0dbc35f2a786c6c4891df8ffdb9ce192` |
| langmd.mix | `0290bc3e40c38406e2ec6805dc18ef6c3a9b6feee6db42df717ac920e93294c8` |

| Profile/member candidate | Root / absolute offset / bytes | Member SHA-256 |
| --- | --- | --- |
| RA2 GI.SHP | ra2.mix / 10,016,536 / 186,032 | `bceaee9c270d6382d80d509f2c4b2893c10565f779096b3add37a4d5321e8be1` |
| RA2 GIICON.SHP | language.mix / 52,328,424 / 2,912 | `f530fb10172d129bbd83839c9816a8187fed4276fa8af2ac1bd005e70e147519` |
| RA2/YR GTPOWEXP.SHP | ra2.mix / 3,057,400 / 116,536 | `fe91dac9230d1febda143fbcec2dd8be30a9ac071c1ec2b822a1bbf71f8dbd10` |
| RA2 GACNST.SHP | ra2.mix / 244,635,442 / 63,736 | `136ba846085ecbbce35630ce2cc7eff4cd1c9d547de2ed0764df393d77f73e58` |
| YR GASPST.SHP | ra2.mix / 256,019,122 / 19,592 | `ca197b6a60344ee4b5688d164dbe244aec70e6471b6eacce25cd94026c8ff6cc` |
| YR GGI.SHP | ra2md.mix / 1,704,744 / 229,016 | `736bb542838bb62e556f9fabdf26b2ac2bd49068e35228d836fe8eac44fa7744` |
| YR GDGIICON.SHP | langmd.mix / 84,468,438 / 2,912 | `4bfd8f876cbf4f6078a642c92ae5c792ba89616f982d407d92252392a321865a` |

Counts below include all frames, including empty records. Clipped indices equal
clipped runs for these samples. Trailing bytes are summed once per decoded frame.

| Member | Frames / empty | Decoded indices | Clipped runs | Trailing bytes |
| --- | ---: | ---: | ---: | ---: |
| GI | 744 / 372 | 207,488 | 5,716 | 1,270 |
| GIICON | 1 / 0 | 2,880 | 0 | 0 |
| GTPOWEXP | 29 / 0 | 221,544 | 2,053 | 103 |
| GACNST | 6 / 0 | 176,248 | 766 | 19 |
| GASPST | 6 / 0 | 39,008 | 333 | 20 |
| GGI | 744 / 372 | 289,453 | 8,291 | 1,277 |
| GDGIICON | 1 / 0 | 2,880 | 0 | 0 |

The digest below is SHA-256 of lower-case per-frame pixel SHA-256 hex strings in
ordinal order, joined with one LF and **no terminal LF**. Empty frames contribute
the SHA-256 of zero bytes. This aggregates results without publishing pixels or
the original frame table.

| Member | Digest of indexed-frame digests |
| --- | --- |
| GI | `7e26a5171249805c3c1aebe3e62c16c35adf53f36b81bbc9f6dd237a7bc97b8b` |
| GIICON | `8d04ca7f223e3682cb77a222cf14e12ac36ac9d6feea90b8f8d752852506da52` |
| GTPOWEXP | `9c894b8bd26da064229c84c4000c56f2a4a6fcfaf91c5fc47b6b0b32cd3d4eb9` |
| GACNST | `d96a5fbb941645d581f1c32638f0a0ba031dc842c4be75e5770371633d05df07` |
| GASPST | `89c77ab442f77776bfc7fc76cbfb7566ff6f10b5635ad2a23035d029292320e4` |
| GGI | `209942f0d4a683fa750f58fd04f1f4dc12c912399fa6c3624ecca3649f4252e8` |
| GDGIICON | `c64f2d792c94f93771a0d23c0eda0671d6b86a230af9809230d5aeb92b0fd51d` |

## Reproduce and handoff

Use Node 24.20.0 and `npm ci`:

```sh
node --import tsx --test tests/formats/shp-runtime.test.ts
npm run check
git diff --check
```

For a private replay, create an ignored `local/shp-identity.json` with one exact
table identity using keys `rootFile`, `rootSha256`, `absoluteOffset`, `size` and
`sha256`. Save the following as ignored `local/replay-shp.ts`, then run
`node --import tsx local/replay-shp.ts /absolute/path/to/game`:

```ts
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createVerifiedSourceReader } from '../tools/analysis/verified-source.ts';
import { createRuntimeShp } from '../packages/formats/src/shp-runtime.ts';
const identity = JSON.parse(await readFile('local/shp-identity.json', 'utf8'));
const reader = await createVerifiedSourceReader(process.argv[2]!);
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
try {
  const shp = createRuntimeShp(await reader.read(identity));
  const hashes: string[] = [];
  let pixels = 0, clippedRuns = 0, trailingBytes = 0;
  for (let ordinal = 0; ordinal < shp.frames.length; ordinal++) {
    const frame = shp.decodeFrame(ordinal);
    hashes.push(sha(frame.copyPixels())); pixels += frame.pixelCount;
    clippedRuns += frame.clippedTerminalZeroRuns; trailingBytes += frame.trailingBytes;
  }
  console.log({ frames: hashes.length, pixels, clippedRuns, trailingBytes,
    pixelHashesSha256: sha(hashes.join('\n')) });
} finally { await reader.close(); }
```

Independent reproduction must not import the TypeScript decoder: read the pinned
range, unpack `<4H` globally and `<4H4I` per frame, follow the referenced XCC raw
and per-row zero-run algorithm using byte +8 for the mode, clamp terminal zero runs to the remaining width,
require exact row fill and compare every indexed-frame hash. The worker retained
`local/probe.ts`, `local/oracle.py`, `local/verify.ts` and aggregate verification
metadata in its isolated worktree for independent PR review; they are private
research outputs, not public fixtures or prerequisites of CI.

The #104 worktree additionally retains ignored `local/object-art/prepare.mjs`,
its pinned preparation metadata and decoded first-frame indices, plus
`local/oracle.py` and `local/oracle-facts.json`. Run `python3 local/oracle.py`
from that worktree to repeat the independent root/member and 237-frame comparison.
The private native probe retains hash/range metadata and its uncommitted listing
for independent review; these artifacts are not required or copied by public CI.

Seventeen original synthetic tests cover formats, row framing, clipping, malformed
and truncated input, shared offsets, empty records, byte/geometry/frame/pixel caps,
unknown low-byte modes, nonzero auxiliary bytes across all four supported modes,
aliases with differing upper bytes, immutable snapshots and hostile accessor/buffer inputs. Public
synthetic success does not substitute for retail or native rendering tests.
Next consumers must implement palette/material policy and bounded frame caching;
unknown format-2 zero semantics and native playback remain explicit follow-ups.
