# Persistent local Bink component

[#101](https://github.com/lictl/WebRA2/issues/101) replaces repeated CLI decoding
with one retained FFmpeg demuxer/codec packet loop. It is a local component and
diagnostic, not integrated campaign cinematic playback. Parent
[#12](https://github.com/lictl/WebRA2/issues/12) retains campaign/worst-case media,
original-game A/V comparisons, subtitles and localization acceptance.

## Boundary and current validation

The worker authenticates an explicitly selected immutable File/Blob range with
SHA-256 before decoding. Input hashing is a separate bounded pass; codec reads
are at most 32 KiB through a custom AVIO callback. A session retains video/audio
reference state and emits one transferable RGBA frame or float PCM block per
request. No asset fetch/upload, Windows DLL, virtual input filesystem, repeated
CLI invocation or shared memory is involved. The package's `blobRange` also
supports a member subrange supplied by a verified content resolver; the harness
selects a standalone local Bink file.

Video timestamps retain integer frame ticks and rational time base. Audio retains
integer sample positions; Bink's later blocks in a packet omit PTS, so those
blocks advance from the preceding exact sample end. Discontinuities, truncated
video counts, malformed dimensions/output sizes and nonfinite PCM fail closed.
Track `-1` intentionally disables audio; indexes `0..7` select a declared track.

The native module has 32 MiB initial / 128 MiB maximum linear memory, a 32 MiB
single FFmpeg allocation cap and a 3 MiB decoded event cap. Input is at most
128 MiB, 1024×768, 60 fps, 600 seconds and eight tracks. The owned transferable
queue is capped at 12 MiB / 64 events; Web Audio has at most 24 scheduled nodes,
counted separately. JS/Canvas/browser overhead is outside the WASM memory cap.
Worker termination is the hard cancellation mechanism while a synchronous codec
call is running. Open has a 60-second watchdog; other commands have 15 seconds.
These guards constrain resources; they are not a proof that a native codec has
no exploitable defects.

The AudioContext clock drives video presentation and PCM scheduling. Late PCM is
trimmed at sample boundaries, while late video frames are dropped and counted.
Pause suspends this same clock and scheduled sources; resume preserves the epoch.
Hidden pages pause. Seek stops scheduled audio, clears queues, flushes codecs and
rebuilds the content clock after preroll. **Upstream Bink seeking resets to frame
zero**; an explicit seek decodes/drops to the target rather than claiming constant
time random access. Four seeks and eight input lengths plus 1 MiB of codec reads
are allowed. Normal uninterrupted playback is sequential. Skip/cancel/EOF/failure
close audio, terminate the worker and release retained queue entries.

## Reproduce

[Component provenance](../packages/media/PROVENANCE.md) pins the maintained source
and toolchain, replacing the unbuilt old-version experiment proposal in the
[historical report](analysis/media-presentation.md). Download the two exact source
archives identified there into a private directory, extract FFmpeg, clone the
pinned emsdk and install/activate 6.0.9. Keep all source/toolchain/build outputs in
ignored `local/`. The source-bundle script verifies the expected directory layout.

```sh
tools/media/build-codec.sh /absolute/private/ffmpeg-9.0.1 /absolute/private/emsdk /absolute/private/build
python3 tools/media/source-bundle.py /absolute/private
node tools/media/serve.mjs /absolute/private/build /absolute/private/browser
```

Open `http://127.0.0.1:8767`, choose a local Bink file and an audio track, optionally
provide the expected SHA-256, then Play. The server snapshots an exact code-only
route map and retains a private served-file hash manifest/request log. The
standalone diagnostic uses EN/Traditional Chinese control labels; it is not the
product's complete localization surface.

```sh
node tools/run-tests.mjs tests/media
npm run check
node --import tsx tools/media/private-verify.ts /absolute/private/sample.bik /absolute/private/build /absolute/private/comparison
```

The private verification command writes decoded PCM only into the explicitly
provided private output directory. It compares RGBA hashes against a separate
native FFmpeg 9.0.1 process (`-cpuflags 0 -sws_flags bilinear+bitexact`) and compares
PCM hashes, lengths and numeric error. No private test is a public CI fixture.

## Private codec evidence

These are private retail-asset checks, separate from public synthetic tests. The
current component was checked against a separately compiled native FFmpeg 9.0.1
oracle using generic CPU paths and bitexact bilinear RGBA conversion.

| Sample | Compressed bytes | Video frames | Audio samples/channel | Codec reads | Maximum PCM absolute error |
| --- | ---: | ---: | ---: | ---: | ---: |
| RA2, 640×480, 6 s | 1,480,176 | 90 | 264,960 | 46 | 1.4901161193847656e-7 |
| YR, 800×600, 72.267 s | 18,870,828 | 1,084 | 3,187,200 | 576 | 2.980232238769531e-7 |
| YR silent, 632×570, 28.733 s | 7,185,136 | 431 | 0 | 220 | N/A |

All three complete RGBA streams match the oracle byte-for-byte; PCM counts match
exactly, while float bytes differ within the measured errors. The two audiovisual
samples are RDFT stereo. A bounded census-header check found 140 single-track RDFT
and six silent candidates, with no DCT or multiple-track candidates in that
examined set. DCT and multiple-track decoding have **no real-sample acceptance**.
They remain part of parent #12's variant coverage, despite the codecs being built
and track bounds being tested synthetically.

Uninterrupted codec reads equal exactly one compressed input length in all three
samples, in requests no larger than 32,768 bytes, with no backward reads. This
replaces the earlier 37.59× long-sample read amplification from restarting CLI
chunks. Authentication adds one separate full-file pass plus the 44-byte header
probe; the 1× figure describes codec I/O, not total access. Sampled WASM memory
remained 33,554,432 bytes. Seeking the long sample to 10 s resets once, discards
397 decoded events and emits a first video PTS of exactly 10; total codec I/O
including the preceding complete decode and seek is 21,688,876 bytes. This is
bounded sequential preroll, not constant-time seeking.

The private evidence directory is `local/persistent-media/` in the coordinator
checkout: `large-final/facts.json`, `ra2-check/facts.json`, `silent-check/facts.json`,
`source-samples.json`, `audio-variant-candidates.json` and `browser-final/` retain
hashes, source ranges, oracle measurements and native browser observations. Only
factual metadata is described here; decoded PCM and images stay private.

Source identities, SHA-256:

- Long YR member: `15ace99013367e0aa477fee776cbf4e10e731cf02a5fdb67f790f84558fe70fd`;
  `movmd03.mix` ordinal 18, offset 315,362,428, length 18,870,828; root
  `26959d790cf1f3fa98b078a6b58a6d6cb3167be4495145b65ad2f853a4a5ef71`.
- RA2 member: `1edcbaa2f79d194267e4c2f80607a3817ba5fe858de9cfd8b7a242c859e9ecc2`;
  `movies01.mix` ordinal 6, offset 147,331,116, length 1,480,176; root
  `b372192bec31af8e1137ed487b55bdb261d7068553d7e465e1bf65b7f56ff0ba`.
- Silent YR member: `1e700e4b0489b5b484d71a863d0d9f3fb15399002c40df22cf924ee79f600d49`;
  `langmd.mix` ordinal 5, offset 75,361,202, length 7,185,136; root
  `0290bc3e40c38406e2ec6805dc18ef6c3a9b6feee6db42df717ac920e93294c8`.

## Native browser checkpoint

The full-length Chrome/Edge/Firefox playback evidence uses implementation commit
`17856993f6c12e2d8b6ea34141092b01e948257d` and the same immutable loopback code
snapshot. Chrome, Firefox and Edge completed the long YR sample with 1,084 presented
frames, zero dropped frames, all 3,187,200 audio samples/channel scheduled and
zero trimmed samples. At EOF all three reported closed audio, terminated worker,
zero retained queue bytes and no scheduled audio copies/nodes.

Firefox native pause froze its presentation clock and frame count across separate
observations; resume continued it. Seek subsequently resumed advancing playback
with one backward source read; skip released the worker/audio/queues. The exact
10-second first seek PTS is established by the private decoder check, not by a
late native screenshot. Deferred regression tests separately cover old
pause/resume/seek/close continuations after cancellation and new playback.

| Native browser | Load / first decoded / first presented, ms | Largest observed decode response, ms | Video clock lag maximum, ms | Peak owned queue bytes / items |
| --- | --- | ---: | ---: | --- |
| Chrome 152.0.7977.83 | 403 / 438.5 / 600.2 | 9.2 | 15.34 | 9,907,200 / 25 |
| Edge 152.0.4191.66 | 377.4 / 520.7 / 686.3 | 15.6 | 20.67 | 9,968,640 / 29 |
| Firefox 151.0.1 | 534 / 592 / 751 | 24 | 20.67 | 9,907,200 / 28 |
| Safari 26.6.2, partial gate | 1,088 / 1,363 / **not presented** | 83 after explicit resume | N/A | 9,968,640 / 29 |

The three completed runs each peaked at seven scheduled audio nodes and 107,520
bytes of scheduled PCM copies, separate from the owned queue. Nonzero analyser
RMS was observed in each run. Load includes authentication and codec initialization;
first presentation includes a deliberate 150 ms clock lead. These are single
local observations, not comparative browser benchmarks. Edge's run may
overlap an independent reviewer's approximately 35-second Python text comparison;
that contention is retained in its timing record.

Process-family RSS was sampled at a requested 200 ms interval (actual intervals
and timestamps are retained), with unrelated tabs/processes open:

| Browser run | Baseline / sampled peak bytes | Sampling window |
| --- | --- | --- |
| Chrome full clip | 8,420,605,952 / 8,506,032,128 | 84 s, 290 samples |
| Edge full clip | 1,193,033,728 / 1,422,442,496 | 84 s, 296 samples |
| Firefox full clip | 3,039,281,152 / 3,304,783,872 | 84 s, 287 samples |
| Safari stalled startup | 1,462,714,368 / 1,540,456,448 | 30 s, 104 samples |

These are family aggregates, **not attributable allocations or exact peaks**;
Safari includes all WebKit WebContent services. Safari's partial interval is not
comparable to completed playback. WASM linear memory, JS-owned queue bytes, Web
Audio copies and aggregate RSS describe different allocations and must not be
added together as independent totals.

### Safari visibility limitation and final telemetry revision

A normal Safari restart and a uniquely identified fresh native window produced
`visibilityState="hidden"` together with `hasFocus=true`. Its HTML/address fragment
matched `#safari-visible`, and no file chooser/modal remained open. Native
raise/bring-to-front, normal minimize/reopen, zoom/fullscreen and a brief display
wake did not restore animation callbacks; no browser flags, permissions or site
settings were changed. Earlier blank/stale-window attempts are excluded from the
performance table.

Diagnostic-only commit `4655894d4a13c9586c8665f5d9596fa4e2bb1fe5` adds visible
page-lifetime visibility/focus/animation/timer counters. The one-second observation
timer does not drive playback. Safari authenticated the real long clip and decoded
its first frame using 32 MiB WASM; hidden startup correctly auto-paused. Explicit
Resume advanced the audio clock, but animation callbacks remained zero as timer
callbacks advanced 11→13; no frame or PCM was presented/scheduled. The queue stayed
bounded. Cancel then closed audio, terminated the worker and cleared the queue.
This is **a missing Safari presentation gate**, not successful four-browser
cinematic acceptance and not evidence that Bink decoding itself failed.

On that final telemetry revision, a Chrome wrong-hash check failed with
`identity-mismatch`, closed audio and released the worker before presenting any
frame. Correcting the hash then played the full RA2 sample: 90 frames, no drops,
264,960 samples/channel, no trimming, and all resources released at EOF. This
short final-revision regression and a complete silent YR run (431 frames, zero
drops, explicit track −1, no scheduled audio, cleanup at EOF) are separate from the three full-length runs on
1785699. Private final-revision observations live under
`local/persistent-media/browser-visibility/`.

Web Audio RMS is measured before the diagnostic's 0.15 output gain and is not an
acoustic recording or an original-game lip-sync comparison. Parent #12 retains
complete campaign integration, subtitle/language selection, all movie variants,
worst-case hardware and original-runtime A/V gates. The unresolved Safari native
presentation gate must be closed before claiming complete browser support.

## Distributed diagnostic artifact identities

The served code/license/source routes are an immutable allowlist. Request logs
contain only GET requests for these local code routes (plus rejected favicon
requests); selected retail bytes never appear in a URL or server route. The
source/license download routes deliver corresponding materials, not game data.

The measured codec is 14,034 bytes of JavaScript, SHA-256
`f2b416376994310ce46de7c9a6eb31706346a1c7526621531156e460f9cb4b1f`, plus 1,158,821
bytes of WASM, SHA-256
`478039151c027121f8caa09274f4ed29d6254a23bf5ca0e0af68cad32553492e`.
Both snapshots use worker SHA-256
`9e0ed6bc120eb5a16a973c180151d3f14fc41b33fb0ae64d45f7513df2287251`.
The 1785699 main bundle is
`4705011fddaef4115e2769f914bd3881e912cf32412da1dac36259588de9d237`;
its 44,970,300-byte source archive is
`2f76e13aea6f4389fbca00655c4c755358433057cbfbcbf8a36df9901198b699`.
The diagnostic-only 4655894 main bundle is
`f7221530583f9c9684c5869c4994de88f492b50264f6aadd072cd7a32f1e6df4`;
its updated 44,971,166-byte source archive is
`70e048d0097cbd8f1322913c74b3d0531f5f3b3e057602a4084665fcf3f2f291`.
Private `served-manifest.json` files retain all nine route identities. Later
report-only edits do not change the measured runtime or its archived build source.
The [provenance note](../packages/media/PROVENANCE.md) records the independent
rebuild's source-path spelling sensitivity and exact nonidentical WASM hash.
