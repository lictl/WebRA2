# M0 local cinematic presentation evidence

The private Bink candidate now displays decoded frames and schedules decoded PCM
in **actual Chrome, Edge, Firefox and Safari**. This establishes a usable direction
for M0; it does **not** establish campaign cinematic compatibility. Work and
remaining R1 obligations are tracked in [#12](https://github.com/lictl/WebRA2/issues/12).
This report extends the [earlier null-sink spike](media-feasibility.md), superseding
its missing Edge/Firefox measurements, without rewriting that historical evidence.
No game program or Windows DLL was executed; no retail payload or codec binary is
committed. All results are single observations on the
[previously recorded Mac](browser-feasibility.md), not comparative benchmarks.

## Reproducible source and method

[Reviewed metadata](media-presentation-evidence.json) retains source identities,
measurements and private evidence paths. The larger sample was read only after
matching the outer file SHA-256 to the private census:

| Field | Observation |
| --- | --- |
| Outer file | `movmd03.mix` |
| Outer SHA-256 | `26959d790cf1f3fa98b078a6b58a6d6cb3167be4495145b65ad2f853a4a5ef71` |
| Member | ordinal 18, ID `f0e22a0c`, absolute offset 315,362,428, length 18,870,828 |
| Member SHA-256 | `15ace99013367e0aa477fee776cbf4e10e731cf02a5fdb67f790f84558fe70fd` |
| Video | Bink 1 `BIKi`, 800 × 600, 15 fps, 1,084 frames, 72.2667 seconds |
| Audio | `binkaudio_rdft`, 44,100 Hz, stereo; independently confirmed with local ffprobe 9.0.1 |

The file picker passes a File to a dedicated worker. A 44-byte header read checks
size, dimensions, rate and one audio track. The worker mounts that File through
Emscripten WORKERFS. It does not copy the entire input to MEMFS or send it to the
HTTP server. WORKERFS provides worker-side read-only File/Blob access using bounded
reads; see the [official filesystem documentation](https://emscripten.org/docs/api_reference/Filesystem-API.html#workerfs).
Instrumentation on its actual read operation measured a largest requested input
range of 32,768 bytes for this sample in all four browsers.

Each command decodes at most approximately one second into RGBA and interleaved
stereo float PCM. A two-chunk queue supplies Canvas `putImageData` and Web Audio
`AudioBufferSourceNode`s. The AudioContext clock selects frames and schedules PCM;
nonzero analyser RMS downstream of gain 0.15 and connected to the destination
confirms decoded output signal. This is **not** a recording or listening test of
the physical speaker, nor an acoustic or original-game lip-sync comparison. An
agent inspected a live decoded frame in actual Edge; that retail screenshot is
not retained in the repository or attached to the issue/PR.

## Measured presentation and memory

All four eight-second runs used the same larger sample and displayed **120/120
frames**, with **zero dropped frames and zero queue-underrun callbacks**. Core
initialization and first-frame time are warm/local observations; first-frame time
starts after the user-gesture audio resume, not from navigation or file selection.

| Browser (actual installed version) | Core ms | First frame ms | Slowest chunk ms | Maximum frame/audio-clock lag ms | RMS peak |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chrome 152.0.7977.83 | 48.0 | 417.5 | 177.5 | 11.45 | 0.05082539 |
| Edge 152.0.4191.66 | 53.4 | 426.0 | 170.7 | 20.25 | 0.05050955 |
| Firefox 151.0.1 | 130.0 | 466.0 | 191.0 | 5.83 | 0.05088854 |
| Safari 26.6.2 | 93.0 | 429.0 | 169.0 | 19.43 | 0.05088854 |

All four scheduled 352,800 samples per channel, held at most 58,305,600 bytes of
owned RGBA/PCM queue buffers, and reported 33,554,432 bytes of WASM linear memory
at measured chunk boundaries. That queue counter excludes MEMFS output/copies,
AudioBuffers, Canvas storage, GC retention and browser overhead. WASM samples are
not allocator peak telemetry. Chrome's final JS point was 88,413,542 bytes and
Edge's 60,500,947; Firefox/Safari do not expose that nonstandard field.

A separate read-only macOS `ps` sampler recorded aggregate family RSS while each
run played. It requests a 200 ms delay between samples, plus command overhead;
the actual sample times are retained privately. These are **sampled aggregate
process totals with other tabs open**, not isolated media allocation or an exact
peak. Safari includes all WebKit WebContent services, potentially from other apps.
The unusually large baselines are intentionally visible rather than subtracted
and mislabeled as attributable media memory.

| Eight-second run | Baseline aggregate MiB | Sampled peak aggregate MiB | Difference MiB |
| --- | ---: | ---: | ---: |
| Chrome | 7,660.64 | 8,006.38 | 345.73 |
| Edge | 1,588.58 | 1,984.03 | 395.45 |
| Firefox | 2,338.14 | 2,655.45 | 317.31 |
| Safari | 1,865.98 | 2,417.19 | 551.20 |

These establish measured browser load/memory evidence for M0, without claiming
performance parity, low-memory acceptance or mobile suitability.

## Long-clip limit and cancellation

Chrome also completed all 73 decoder commands for the full 72.2667-second movie:
1,081 of 1,084 frames displayed, three dropped, 42 animation callbacks observed an
empty presentation interval, maximum frame/audio-clock lag 65.69 ms and maximum
frame interval 250.1 ms. First frame was 387.8 ms. Queue/WASM boundary highs stayed
the same; aggregate RSS baseline/peak were 7,821.47/8,201.25 MiB.

The CLI approach is unsuitable for sustained production playback: every `-ss`
command starts reading at offset zero. The first chunk read 294,912 bytes in
95.7 ms; the last read all 18,870,828 bytes in 1,048.7 ms. Total reads reached
709,321,816 bytes, about **37.59 times the file size**; the slowest chunk took
1,067 ms. This measured restart cost explains an important limitation, although
it does not isolate every cause of frame loss. A late `AudioBufferSourceNode.start`
starts its buffer immediately from sample zero; this diagnostic does not trim late
PCM. Once underruns occur, the frame/audio-clock lag counter is therefore **not**
the actual audio/video content skew. Do not describe these repeated
commands as a persistent streaming decoder.

A separate Chrome stop test cancelled at 125 of 450 planned frames. The resulting
report showed AudioContext `closed`, two sources stopped, zero retained queue
items, a requested worker termination, cleared File selection and restored
controls. The code also cancels when the page becomes hidden; that path was not
separately exercised here. Seeking, pause/resume and subtitles are not implemented.

## Browser acquisition and remaining import evidence

Edge was absent in the earlier spike. The official
[Microsoft update feed](https://edgeupdates.microsoft.com/api/products?view=enterprise)
identified stable macOS universal 152.0.4191.66. The downloaded package was
432,276,854 bytes with SHA-256
`ea0cb511706321fbe7800d3e1d6b8e7c1237d9abea97d68a9ac56f7317479b38`.
`pkgutil --check-signature` reported a trusted/notarized Microsoft installer,
team `UBF8T346G9`; `pkgutil --expand-full` extracted it under ignored `local/`
without running its installer scripts. The application ran from that private
path. First launch skipped account sign-in and data import, and disabled its
optional telemetry and default-browser choices. No browser extension permissions
or system security settings were changed.

The original [File/storage probe](../../tools/feasibility/index.html) also ran in
actual Edge and Firefox. Both verified all 65,798,144 synthetic File bytes with a
262,144-byte returned-range cap and zero-byte EOF read. Edge took 464.3 ms and
Firefox 521 ms; construction took 16.6/38 ms respectively. Both passed their own
32-byte OPFS and IndexedDB write/read/remove checks, with no persistent-storage
permission request. Both reported a 10 GiB quota and `persisted: false`; this is
an estimate, not guaranteed durable storage. `showDirectoryPicker` was available
in Edge and unavailable in Firefox; `webkitdirectory` existed in both. Synthetic
Traditional Chinese glyphs, punctuation and wrapping were visually inspected in
both, with no replacement boxes or clipping seen. Keyboard/IME editing and retail
font rendering are separate gates.

## Exact codec choice and bounded next experiment

The measured private reference remains **`@ffmpeg/core@0.12.10`**, with the exact
JS/WASM/tarball hashes, upstream recipe and GPL-2.0-or-later notice recorded in the
[earlier provenance report](media-feasibility.md). This PR adds original MIT
diagnostic code; it does not adopt or redistribute the codec, change the root
license, or imply that its MIT wrapper makes the GPL core MIT. The broad 32.2 MB
WASM binary is the experiment's reference, not a production download target.

The next investigation in #12 should replace repeated CLI invocations with one
persistent libavformat/libavcodec packet loop. To keep the experimental variable
bounded, use these exact **prototype baseline** source pins:

- [FFmpeg `n5.1.4`](https://github.com/FFmpeg/FFmpeg/tree/4729204c17f756e186d622060088371d10b34f7e), commit `4729204c17f756e186d622060088371d10b34f7e`.
- [Emscripten `3.1.40`](https://github.com/emscripten-core/emscripten/tree/5c27e79dd0a9c4e27ef2326841698cdd4f6b5784), commit `5c27e79dd0a9c4e27ef2326841698cdd4f6b5784`.

The experiment should build only the Bink demuxer, Bink video and RDFT/DCT audio
decoders, libavutil, required RGBA conversion and audio resampling; exclude
encoders, network protocols, unrelated demuxers and optional GPL codecs. Export
an open/step/close API with an interrupt callback, bounded File-range adapter,
persistent decoder state and explicit frame/audio timestamps. Step only when the
consumer has queue capacity; present RGBA and PCM locally using the proven browser
APIs. Preserve packet ordering and reference frames instead of seeking/reopening
for every chunk. Pin configure output, toolchain and all compiled sources; measure
cold bytes/startup, read amplification, total memory and long clips against this
reference. These source pins are **not built or adopted by this PR**, and are not
a recommendation to ship old versions without a security review.

Root/coordinator owns production codec and distribution selection. A release must
bundle approved JS/WASM as app code for offline/on-device decoding, provide the
actual build's notices and corresponding source/relink materials as required,
and audit its enabled components and security updates. A future narrow build's
license follows its actual linked configuration; it is not established by this
proposal. See [FFmpeg's own license guidance](https://ffmpeg.org/legal.html).
No asset server, Windows DLL or remote conversion service is part of this route.

## Run and verify

Use Node 24 and the existing privately downloaded, hash-verified core. No new npm
dependency is needed. In the authoring environment Node was 24.20.0 and the core
was under ignored `local/media-feasibility/core/package/dist/esm`.

```sh
node tools/feasibility/serve.mjs --media-core /absolute/private/core/package/dist/esm
```

Open `http://127.0.0.1:8765/media-presentation.html`, choose an authorized local
Bink file and press Play. For this source choose eight seconds for the comparable
run, then the full-clip option for the long test. The server serves only diagnostic
code and the two pinned core files; File/WORKERFS reads never use an upload route.
HTTP checks passed for all four new allowlisted files, while POST, game paths,
a supposed sample under the core path and traversal returned 404. This checks the
app/server boundary; it is not a packet capture of unrelated browser services.

```sh
python3 tools/feasibility/media-presentation-rss.py chrome --seconds 22 > /absolute/private/chrome-rss.json
node --test tests/feasibility/media-presentation.test.mjs
npm run check
git diff --check
```

Start the sampler just before Play; family choices are `chrome`, `edge`, `firefox`
and `safari`. It does not operate browser UI or collect tab titles/URLs. Private
summary JSON and RSS time series remain in `local/media-presentation/`; the
committed metadata explicitly labels manually transcribed DOM/AX summaries and
retains timestamps. Synthetic tests cover header/range rejection, frame alignment,
queue backpressure, malformed outputs and queue release. The diagnostic accepts
at most 128 MiB input, 1024×768/60 fps, 180 seconds and one audio track, with at
most two owned chunks and a 32 MiB output-chunk limit. Header checks, post-decode
output validation and worker watchdogs are **not** a complete hostile-codec memory
sandbox; use authorized known samples for this diagnostic.

R1 still needs a persistent decoder build, long/worst-case movies in both profiles,
track selection and silent movies, decoded-frame/audio correctness, original-game
A/V comparison, end/skip/seek/pause/background behavior, subtitles/localization,
malformed inputs and isolated low-memory budgets. Keep #12 open for that work.
