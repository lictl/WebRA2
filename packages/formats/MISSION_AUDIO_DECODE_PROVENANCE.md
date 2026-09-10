# Mission audio PCM decoder provenance

`src/mission-audio-decode.ts` and its original tests are
**GPL-3.0-or-later**. Copyright 2026 WebRA2 contributors. The IMA step/index
tables, per-bit arithmetic and WAV block/channel layout adapt XCC Utilities and
Library, Copyright (C) 2000 Olaf van der Spek, under GPL-3.0-or-later. This is
licensed source adaptation with separately inspected native evidence, not a
formal clean-room claim. No retail bytes, waveforms or disassembly are distributed.

## Pinned primary sources

XCC commit `6f91bf8b00d3acabb1be765118a37c0cb74e85ec`:

| Source | Use | Raw source SHA256 |
| --- | --- | --- |
| [aud_decode.cpp](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/aud_decode.cpp#L24-L84) | 89-step/8-adjust tables, per-bit rounded IMA nibble decode and saturation | `bd3e23994ffae0f086d0a080a278446735797cf9918df01b5e94c6f42d4fc3c4` |
| [ima_adpcm_wav_decode.cpp](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/ima_adpcm_wav_decode.cpp#L36-L96) | Predictor-first blocks and stereo groups/interleaving | `ecd27e95ec564031145878f677d579c5e21f223e7291a66a7d19040ffccdb84d` |
| [riff_structures.h](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/riff_structures.h#L34-L54) | RIFF format/fact and four-byte IMA header layout | `88f85ee969bff91ff292bdd7d05d6cf791a4745de452d5c05edd4fad577168c5` |

The bounded parser, ownership boundary, SHA identities, complete preflight,
metadata and failure policy are original WebRA2 code. Unlike the XCC utility,
this component refuses incomplete stereo groups instead of silently discarding
remaining bytes. It also refuses mono non-group tails that the pinned native
routine reads past before reporting failure. Unknown bits/codecs are not masked
into supported formats.

[Microsoft's PCM data description](https://learn.microsoft.com/en-us/windows/win32/multimedia/devices-and-data-types)
establishes unsigned8 and signed16 little-endian/interleaved PCM conventions.
The mapping `(byte - 128) * 256` into signed16 is WebRA2's lossless output
normalization; no device mixing, gain, resampling or rounding beyond it is applied.

FFmpeg **9.0.1**, commit `bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa`, is a
private independent oracle, not a dependency or bundled binary. Its
[IMA WAV dispatch](https://github.com/FFmpeg/FFmpeg/blob/bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa/libavcodec/adpcm.c#L1521-L1572)
uses the [per-bit nibble helper](https://github.com/FFmpeg/FFmpeg/blob/bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa/libavcodec/adpcm.c#L557-L584),
not the differently rounded generic IMA helper. `adpcm.c` SHA256 is
`6c4322dc3677bc5c74eeeb3c33ec2b076e25f454e6f1f1ef3d2d7ce6bf8cfbc2`;
`adpcm_data.c` SHA256 is
`47ba6b4638586c34d6f34eaf27e1925a51c1e9a8cc2ae2666e2cb7cdf4638181`.
Those LGPL-2.1-or-later sources were inspected as references; product tables and
algorithm attribution come from GPL XCC. The local oracle executable SHA256 is
`9f5ddd4f8b36eb07b0c5d60ab6ea1e618bedd70bc45feab82b4dc23be1596ad1`.

## Paired native static evidence

[The metadata ledger](../../docs/analysis/mission-audio-decode-native.json)
records 22 ranges / 5,328 bytes: 18 complete-instruction spans and four data
ranges, checked with Capstone 5.0.6. Table bytes are compared against the pinned
licensed primary tables; native values are never copied into product source.
The ledger gives whole image hashes, virtual addresses, mapped offsets and range
hashes. Spans are inspected context, not inferred exact function extents.

| Boundary | RA2 | YR | Interpretation |
| --- | --- | --- | --- |
| Indexed format | `401640–4016a1` | same | Bit0 channels, bit3 IMA16, otherwise bit2 PCM width; chunk size copied |
| RIFF reader | `408530–408704` | `408610–4087eb` | PCM tag1 / IMA tag17; unknown chunks including fact skipped |
| Codec dispatch | `409b60–409c0c` | `409c40–409cec` | Select PCM byte copy or IMA callback and source block size |
| IMA block | `40a990–40abee` | `40aa70–40acce` | Signed predictor first; reserved0/index0..88; low then high nibble; four-byte groups/channel |
| IMA nibble | `40abf0–40ac7e` | `40acd0–40ad5e` | Individual shifted terms, signed16 saturation and index clamp |

RIFF `fact` does not trim this policy's decoded output. WebRA2 retains it and
rejects counts outside the final decoded block (or conflicting PCM counts),
rather than asserting contradictory metadata is valid. Indexed PCM accepts
flags2/3/6/7 with chunkSize0; indexed IMA accepts12/13 with aligned chunk size.
These are explicit supported families, not a claim every other flag combination
is meaningful or invalid to the native engine.

The surrounding compressed stream state has separate final-buffer bookkeeping.
This decoder does **not** emulate native stream flush/padding, timing or possible
past-end buffer contents. An aligned short final block yields only samples
supported by its supplied bytes, matching XCC/FFmpeg framing. Native buffer-tail
parity, playback, scheduling, sample choice, looping and mixing remain outside
this component.

## Distribution

Keep this notice, file attribution and [GPL-3.0-or-later](../../LICENSES/GPL-3.0-or-later.txt)
with distributed code. Provide corresponding source, build instructions and
applicable dependency notices for a bundled application. Coordinator-owned build
and licensing integration must copy this notice when the decoder becomes a
reachable application input. No FFmpeg executable, retail table, asset or PCM
sample is a product dependency. See [the focused report](../../docs/mission-audio-decode.md).
