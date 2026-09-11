# Mission audio reference provenance

All new `mission-audio*.ts` modules and original tests are GPL-3.0-or-later.
They compose the existing GPL mission cue, index and verified source components;
no retail code, tables, sample bytes, or native listings are distributed. This is
static analysis with retained provenance, not a formal clean-room claim.

The [native ledger](../../docs/analysis/mission-audio-native.json) pins both full
supplied executables and85 factual records:58 complete instruction spans and27
fixed schema/filename data spans, totaling15,015 bytes. Native programs were never
executed. Capstone5.0.6 performs private read-only disassembly; its code is not a
product dependency. Spans identify inspected evidence, not complete function extents.

Pinned primary address/layout leads:

- [YRpp VocClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/VocClass.h),
  [VoxClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/VoxClass.h),
  [Audio](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/Audio.h)
  and [CCINIClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CCINIClass.h)
  guide native lookup, constructor, file and entry enumeration inspection. Their
  implementation bodies are not copied and no upstream GPL license is asserted.
- Existing `dependency-audio-index.ts` framing derives from XCC
  [cc_structures.h](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/cc_structures.h)
  and [audio_idx_file.h](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/audio_idx_file.h).
  Its GPL provenance is retained. This slice calls that existing parser; it does
  not add an external decoder dependency.

The `sound-list`, `eva-list`, `theme-list`, `ini-entry-order` and reset records
establish fresh registry entry enumeration, first case-insensitive allocation and
immediate property reads. Property section/key lookup stays case-sensitive in the
supported exact-name subset. Repeated sections/keys, duplicate registry values,
truncating allocation names and extended encodings are rejected or unsupported;
native INI CRC collisions are detected and fail closed. Both polynomial tables are
independently regenerated; no table bytes are copied. General native overwrite
behavior is not claimed.

The `audio-bank-bootstrap` records are critical: RA2 mounts AUDIO.MIX. YR tests
AUDIOMD.MIX existence, mounting it if present and AUDIO.MIX otherwise. It does not
mount both and search the old bank for each missing sample. A null external path
is passed to the indexed bank constructor. The plan authenticates explicit
provided parent locators and selects only a supported present mount; YR fallback
absence remains unsupported. Ordinary loose files still precede MIX lookup.
Cross-family language/game priorities and custom dynamic mounts remain unresolved.

`sound-add-sample` strips every leading `$`/`#`, performs indexed lookup and caps
samples at32. The flags are not interpreted as permission to choose, loop or mix a
sample. Source ordinal and sorted native index are distinct. `eva-fields` stores
only eight side-stem bytes, and `eva-wav-caller` appends `.wav`. RA2 accepts explicit
side0/1 here; YR additionally accepts2. These are preparation inputs, not proof of
house identity. `theme-fields` normalizes a bounded Sound stem, and
`theme-wav-caller` appends `.wav`. Both WAV consumers pass one to AudioStream,
bypassing its preliminary raw-only path and opening through CCFile.

The index-format records support retaining rate, channel, flags and chunk metadata.
The bounded RIFF/PCM/IMA-ADPCM header inspection is a WebRA2 validation policy;
it does not decode waveforms, prove native permissiveness, or start playback.
See the [component report](../../docs/mission-audio.md) for limits and evidence.

The optional [spatial mission source slice](../../docs/mission-spatial-audio.md)
reuses this same sound registry and sample-reference pipeline for action99, with
its original opcode and genuine opt-in cue identity retained. It neither disguises
99 as19 nor treats116's ignored scalar as a sound lookup. No new playback authority
or sample bytes are distributed.
