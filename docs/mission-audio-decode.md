# Bounded mission audio decoding

[Issue205](https://github.com/lictl/WebRA2/issues/205) adds a pure owned PCM decoder
for the encoded samples prepared by [mission audio references](mission-audio.md).
It does not play audio or choose a registry/sample alternative. Both profiles use
the same proven block arithmetic; no artificial profile difference is introduced.

## API and ownership

`packages/formats/src/mission-audio-decode.ts` exports:

- `decodeMissionAudio(input, lowerOnlyLimits?)` returns frozen branded metadata.
  RIFF input is `{kind:'riff-wave', bytes, expectedSha256}`. Indexed input adds
  `{kind:'indexed', flags, sampleRate, chunkSize}` instead.
- `copyMissionAudioPcm(result)` returns a new caller-owned interleaved `Int16Array`.
  Mutating it never changes the retained samples, metadata or future copies.
- `isMissionAudioPcm(value)` recognizes genuine results only; JSON copies and
  proxies around a result cannot acquire that identity.

Input metadata is copied from own data descriptors before parsing. The byte
snapshot uses native typed-array accessors; proxies, shared/resizable buffers,
empty payloads and oversized inputs are refused. The expected lowercase SHA256
must match the owned byte snapshot. This is **content identity**, not proof of
registry selection, source installation, trigger dispatch or playback authority.
An adapter must independently join the existing verified sample catalog.

The result records codec, encoded/data byte counts, channels, sample rate, frames,
scalar count, block count, partial final block size, format metadata and encoded
SHA256. PCM SHA256 serializes signed samples as little-endian16, independent of
host endian. A separate result SHA256 includes interpretation metadata and source
hash. Lower limits do not alter successful content identity. No retained decoded
sample cache is shared across calls.

## Supported sample rules

| Input | Supported form | Output |
| --- | --- | --- |
| Indexed PCM | Flags2/3 unsigned8 or6/7 signed16; chunkSize0 | Mono/stereo PCM16; unsigned8 uses `(b-128)*256` |
| Indexed IMA | Flags12/13; chunk size4..65,536 and a multiple of4×channels | Block-local predictor/index state, mono or stereo |
| RIFF PCM | Exact RIFF/WAVE length; tag1; bits8/16; channels1/2; fmt16 or fmt18 with cbSize0 | Interleaved signed16; aligned whole frames |
| RIFF IMA | Tag17; bits4; fmt20/cbSize2; exact samplesPerBlock; block alignment divisible by4×channels | Same IMA block decoder as indexed samples |

Rates must be positive integers up to192,000. RIFF chunk ranges and odd-byte
padding are checked. There is exactly one fmt before exactly one nonempty data
chunk; duplicate fmt/data/fact, malformed extensions, truncated headers and
unsupported formats fail. Unknown RIFF chunks are bounded and counted, without
assigning meaning. PCM byte rate must equal rate×alignment. IMA's raw average
byte-rate field is retained and must be nonzero; it does not determine output
length. No RF64, extensible/float PCM, 24-bit samples, other ADPCM formats or more
than two channels are admitted.

An IMA block begins with four bytes per channel: signed16 little-endian predictor,
uint8 step index0..88, reserved0. The predictor is the first output frame. Each
channel then consumes four compressed bytes, low nibble before high, producing
eight frames; stereo groups are left4 bytes then right4 bytes, written interleaved.
Every block resets its channel state. Delta is the sum of separately shifted
step terms; predictor saturates at−32768/32767 and index at0/88. A single multiply
then shift is not equivalent and is not used.

Short last blocks are accepted only with a complete header and complete groups
for every channel. A predictor-only block is one frame. Incomplete channel groups
are rejected before allocating PCM. No output samples are invented from adjacent
memory or zero padding. Empty audio is a deliberate WebRA2 rejection.

The pinned native RIFF reader skips fact. This policy keeps complete decoded
blocks, records `factFrames` and `ignoredFactPaddingFrames`, and does not trim.
A present fact must be positive, no larger than decoded output and, for IMA,
inside the final block; PCM fact must equal its frame count. Contradictory metadata
is rejected. Native stream flush, final buffer contents and playback duration
are not reproduced merely by adopting this block policy.

## Resource bounds

Default hard limits are16MiB encoded input,64MiB retained PCM,65,536 blocks,
65,536 RIFF chunks and64Mi work units. Callers may only lower each limit, including
to zero. Work units reserve encoded bytes plus scalar output samples; they bound
linear decode work, not measured CPU instructions. All block headers, final ranges
and aggregate output counts are checked before PCM allocation or painting.
Canonical PCM hashing uses an8KiB scratch buffer. Each requested PCM copy may
allocate another output-sized array; caller lifetime/aggregate session limits
remain the adapter's responsibility. The synchronous pure component has no DOM,
wall clock, filesystem, network, audio device or RNG; worker placement is a caller
choice, not an implicit main-thread responsiveness guarantee.

## Verification and evidence

`npm run check` passes 1,126 public tests, type checking, 176 Markdown files /
877 local links, the publication guard, M0 consistency and the existing build
(71 outputs / 144 approved inputs). After staging this slice, the publication
guard covers 622 tracked paths. These are synthetic/build checks, separate from
the private source comparisons below.

Nine original public tests cover PCM8/16 signedness/interleaving, additive IMA
rounding, all16 nibbles at all89 initial indices, predictor/index saturation,
mono/stereo block reset/order, aligned short/header-only blocks, malformed final
groups, RIFF fact/extension/chunk errors, lower-only aggregate limits, byte and
metadata ownership, proxy/accessor rejection and canonical output hashing.

The separate fresh private check repeats verified438-file catalogs for both
profiles and source-side choices. All135 prepared sample instances (69 unique
encoded hashes) decode successfully; **8,546,825 scalar samples** match FFmpeg
9.0.1 byte for byte. No PCM8 or stereo mission sample was present in that selected
corpus, so this is specifically mono IMA evidence. The raw registry/index/source
oracle separately repeats6,143 checks across seven source roots.

An additional independently verified bank probe covers15 physical sample
instances from both profiles, including PCM16 mono/stereo and IMA stereo. Fourteen
decode and match another1,414,637 scalar samples. One YR stereo sample has an
incomplete final channel group and remains explicitly unsupported; it is not
required by the prepared mission cue corpus. No samples are silently dropped to
make a decoder comparison pass. These probes rehash complete containing roots
and source indexes, then each exact encoded range; two roots contain the selected
audio payloads. PCM8 is covered by original fixtures, not claimed retail evidence.

The combined149 successful comparisons cover **9,961,462 scalar samples**.
[The metadata census](analysis/mission-audio-decode-census.json) retains75 distinct
decode identities (encoded/PCM hashes, codec/count metadata), profile totals and
the unsupported sample hash. It contains no waveform or sample-name text.
[The paired native ledger](analysis/mission-audio-decode-native.json) verifies
22 ranges /5,328 bytes. The [provenance notice](../packages/formats/MISSION_AUDIO_DECODE_PROVENANCE.md)
records exact primary source pins, licenses, arithmetic and native limits.

Private commands run from the isolated decoder tree, with all scripts/results
under ignored `local/`:

```sh
node --import tsx local/probe196.mjs
python3 local/oracle196.py
node --import tsx local/decode205.mjs
python3 local/oracle205.py
node --import tsx local/variants205.mjs
python3 local/variant-oracle205.py
local-python-with-capstone local/native205/ledger205.py
python3 local/census205.py
```

The private reviewer must copy scripts and adapt output paths into their checkout;
`ledger205.py` and `census205.py` regenerate the public factual JSON and should be
redirected to ignored reviewer paths for a read-only audit. Native tables/listings,
source file names and all encoded/decoded sample bytes stay private. FFmpeg is
only the separately installed oracle; no game program or audio output was run.
Listening tests, Chrome playback, dispatch/selection/RNG/priority/loop behavior and
complete campaign audio remain subsequent integration gates.
