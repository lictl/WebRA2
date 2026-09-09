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

Current checkpoint: original synthetic boundary/lifecycle tests pass; three actual
private samples (RA2 audiovisual, YR long audiovisual, YR silent) match all native
oracle RGBA bytes. Long-sample input reads are exactly one input length, and PCM
sample counts match with maximum observed float error below 3e-7. An initial
Chrome full playback completed. Final immutable four-browser evidence, source
bundle manifest and exact measurements are still being collected on this draft.
