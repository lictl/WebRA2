# M0-04 real Bink browser decode evidence

Status: **small real sample decoded in Chrome and actual Safari; full cinematics
remain open**. Work [#7](https://github.com/lictl/WebRA2/issues/7), follow-up
[#12](https://github.com/lictl/WebRA2/issues/12). No game binary or Bink Windows DLL
was executed. No retail bytes, frames, recordings or codec binary are committed.

## Source and result

The supplied Steam Traditional Chinese installation contains a Bink 1 `BIKi`
member in `movmd03.mix`. The MIX worker independently validated this member's
bounds using the decrypted index and the archive payload checksum:

| Field | Observed value |
| --- | --- |
| Archive SHA-256 | `26959d790cf1f3fa98b078a6b58a6d6cb3167be4495145b65ad2f853a4a5ef71` |
| Member | ordinal 55, hashed ID `0x6ea8aa3b`, name unresolved |
| Archive data offset / relative member offset | 780 / 355,808,080 bytes |
| Absolute offset / member length | 355,808,860 / 246,492 bytes |
| Member SHA-256 | `a6f82c5b086770f0ec2e10ef97c006fbe0b316feee601cf78709c21bf85dcae8` |
| Video | Bink video, `BIKi`, 140 × 110, 15 fps, 41 frames, duration 2.733333 s |
| Audio | `binkaudio_rdft`, 44,100 Hz, stereo |

The local private sample is `local/media-feasibility/sample.bik`; archive census
metadata is `local/mix-census.json`. The sample is small in-game media, **not** a
representative full-resolution campaign cinematic. Native Homebrew FFmpeg 9.0.1
and ffprobe first confirmed the header/streams and decoded all 41 frames plus
audio to a null sink. This native check alone would not prove browser support.

The browser diagnostic then used each browser's real file picker. The selected
File was sent to a dedicated worker; the worker loaded a local single-thread WASM
core, copied that one sample into its memory filesystem and ran:

```text
-i sample.bik -t 3 -f null -
```

Actual browser results on the [same machine](browser-feasibility.md):

| Browser / UTC | Core initialization | Decode | WASM heap after decode | Result |
| --- | ---: | ---: | ---: | --- |
| Chrome 152.0.0.0 / 12:46:08 | 46 ms | 28 ms | 33,554,432 bytes | exit 0, 41 video frames and decoded audio |
| Safari 26.6.2 / 12:50:11 | 89 ms | 30 ms | 33,554,432 bytes | exit 0, 41 video frames and decoded audio |

The Safari run covers the final added Bink-header limits. A previous Safari run
also passed (102 ms initialization, 28 ms decode). These are point samples, not
cold-download, sustained-playback or peak-memory benchmarks. The core logs a final
`Aborted()` during its command-exit mechanism even with exit code 0 and the complete
frame/audio summary; do not use that string alone as a success or failure test.
Firefox media was not verified: after the successful import probe, native UI
accessibility reported the media URL while screenshots remained on the earlier
page; refreshed state and raising the window did not reconcile the mismatch. No
codec failure is inferred. Edge was unavailable. Both remain in issue #12.

## Exact research codec provenance and licensing

The evaluated core is `@ffmpeg/core@0.12.10`, downloaded from its
[official npm tarball](https://registry.npmjs.org/@ffmpeg/core/-/core-0.12.10.tgz).
The tarball SHA-512 integrity was checked before extraction:

```text
sha512-dzNplnn2Nxle2c2i2rrDhqcB19q9cglCkWnoMTDN9Q9l3PvdjZWd1HfSPjCNWc/p8Q3CT+Es9fWOR0UhAeYQZA==
```

| ESM file | Bytes | SHA-256 |
| --- | ---: | --- |
| ffmpeg-core.js | 111,804 | `67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3` |
| ffmpeg-core.wasm | 32,232,419 | `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7` |

Upstream tag `v12.15` resolves to commit
`71aa99d37c02a7b4c435275ca9ef50e612f6efa1`. Its
[Dockerfile](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/Dockerfile)
selects FFmpeg `n5.1.4`, Emscripten `3.1.40` and enables GPL, x264/x265 and other
libraries. The exact
[core package manifest](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/packages/core/package.json)
labels the core GPL-2.0-or-later. The `@ffmpeg/ffmpeg@0.12.15` JavaScript wrapper's
MIT license does not relicense the core; this diagnostic directly uses the core
and does not install that wrapper. Upstream's recipe has some floating dependency
branches; this spike pins published bytes and does not claim a reproducible
source-to-binary build audit.

**Decision:** use this build only as a private feasibility reference for the next
bounded media task. No production dependency or root license change is adopted by
this PR. Before distributing a selected build, pin all source revisions, preserve
license/attribution notices, supply the corresponding source and build changes as
required, and choose a coherent WebRA2 distribution license. Audit enabled
components and current security fixes; this older broad build is not automatically
the release choice. FFmpeg's own
[license guidance](https://www.ffmpeg.org/legal.html) explains that build options
change its obligations. GPL reuse is acceptable under owner decision D07.

A concrete next implementation route is a narrowly configured FFmpeg WASM worker
with the Bink demuxer/video/audio decoders, a bounded input adapter and bounded
video/PCM output queues feeding browser rendering and Web Audio. This is an
engineering proposal, not something this null-sink test implemented. A local
conversion helper can be optional, but the browser File importer must continue to
decode on-device without any native executable or asset upload. Compare streaming
decode against per-movie local conversion with actual time/memory measurements.

## Reproduce without publishing private content

Keep the pinned package under ignored `local/media-feasibility/core/`, checking
its integrity/hash above. For example, `npm pack @ffmpeg/core@0.12.10` in that
ignored directory fetches the official archive without running a package script;
extract the checked package there. Obtain an authorized bounded sample by reading
only the validated member range above from the matching archive, or choose another
sample and record its source/member/hash separately. Do not use unrelated data
with the fixed expected hash or publish the extracted sample.

```sh
node tools/feasibility/serve.mjs --media-core /absolute/path/to/local/media-feasibility/core/package/dist/esm
```

Open `http://127.0.0.1:8765/media-probe.html`, select the private BIK file, and record
only metadata. Only the two allowlisted core files are served from the supplied
core directory; the sample is read by the file picker and never served. Input is
capped at 64 MiB and the lightweight header rejects excessive dimensions, pixels,
frame counts/rate, track counts and inconsistent length before WASM initialization.
It is not a complete hostile-input parser. The main page can terminate the worker,
and a 60-second timeout bounds this diagnostic attempt. Successful workers are
terminated after reporting; no media output persists.

The unresolved gate is **presentation**, not just codec loading: representative
large and worst-case movies in both games, decoded-frame correctness, audio
correctness, A/V sync, frame pacing, seeking/skipping, background/resume, subtitles,
localization, cancellation, malformed content and total/peak memory. Real
terrain/sprite/voxel presentation and full browser import flows also remain open.
A null sink and tiny sample do not close any campaign playback claim. Issue
[#12](https://github.com/lictl/WebRA2/issues/12) retains these acceptance criteria.
