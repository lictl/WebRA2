# ADR 0002 — Reference profiles and initial engineering budgets

Status: accepted for the next implementation slices, 2026-09-10 (Asia/Tokyo).
Parent work: [M0 #4](https://github.com/lictl/WebRA2/issues/4) and
[integration #33](https://github.com/lictl/WebRA2/issues/33).

Use the source selections in [the reference manifest](../analysis/m0-reference-profile.json)
for the supplied Steam Traditional Chinese installation. Identify versions by
content/executable SHA-256 evidence. Historical `1.08`/`1.11` resource labels do not
establish retail patch numbers, so those numbers remain unassigned. The manifest's
definition fingerprint covers its listed filename/member-hash pairs only. A future
simulation save needs a full compiled-content identity, including mods and all rules.

The selected first campaign slices are `all01t.map` and `all01umd.map`. Apply the
statically supported YR expansion selections for `rulesmd.ini`, `soundmd.ini` and
the continuation `all02umd.map`, retaining all alternatives and their evidence.
Identical RA2 opening copies remain equivalent source choices. Do not infer general
wildcard, dynamic theater or mod precedence from this installation-specific decision.

M1 begins with the on-device inspector and deterministic synthetic foundation,
then M2 decoders/rendering prepare these mission slices. Assets-only import must
work without any EXE or DLL. The conservative manifest preserves the 69 observed
data archive roots; minimal subsets are certified only as dependency compilation
resolves them. Unsupported required operands must block mission startup with a
diagnostic. They must never be ignored to produce a working-looking mission.

Use File/Blob range access as the portable browser baseline, with folder selection,
directory handles and OPFS enabled by capability checks. Avoid copying the full
installation into memory or requiring permanent browser storage. The user supplies
files entirely on-device; the localhost helper serves allowlisted app code and
authorized local content without a remote asset service. Browser/WASM dependencies
must be available locally for the eventual offline app.

## Initial measurable limits

Reference measurement machine: MacBookPro18,2, 64 GiB RAM, macOS 26.6.2 (25G83).
Measured browser versions and methods are in the
[File/storage](../analysis/browser-feasibility.md) and
[presentation](../analysis/media-presentation.md) reports. These initial acceptance
limits guide implementation on that reference machine; a lower-end minimum device
and broad browser-version floor remain release decisions.

| Next gate | Numeric limit / target | How to measure |
| --- | --- | --- |
| M1 import I/O | At most 1 MiB per range and four outstanding range buffers (4 MiB); one active read per adapter | Instrument buffer ownership across main/worker transfers and cancellation; test exact EOF, malformed ranges and races |
| M1 metadata/parsers | Preserve component hard limits, including 512 archives, 250,000 member records, 16 MiB ordinary member input and 64 MiB analysis read budget where applicable | Reject declarations before allocation/expansion; keep the tighter component limit when several apply |
| M1 import responsiveness | No deliberate main-thread work block above 50 ms; progress/cancel response within 250 ms during the synthetic import probe | Foreground performance marks and cancellation acknowledgement; include cleanup of retained buffers |
| M1 portable File smoke | Read/verify the existing 65,798,144-byte fixture within 15 seconds in each reference browser | Separate fixture construction from the foreground read loop; preserve the probe's yields and checksum; record cold/warm repetitions |
| Persistent media prototype | Eight-second 800×600/15-fps reference: first frame within 2 seconds after user-gesture audio resume with local core, zero dropped frames/underruns | Same pinned clip in all four families, decoded sample counts and presentation timestamps |
| Persistent media input | Full 72.2667-second clip total input reads at most twice source length | Instrument actual range reads; the current 37.59× repeated-CLI result fails this future gate |
| Persistent media output | At most two queued seconds and 64 MiB owned RGBA/PCM queue buffers; target at most 256 MiB WASM linear memory | Count transferred/retained buffers and sample actual memory growth; additionally measure MEMFS, AudioBuffers, Canvas and isolated process memory |

The 15-second File limit covers the recorded Safari smoke duration, whose yields
are part of the test. It is not a throughput target for a multi-gigabyte installation.
The media targets apply to a persistent decoder experiment tracked in
[#12](https://github.com/lictl/WebRA2/issues/12); the existing CLI diagnostic does not
pass sustained playback. Aggregate browser RSS with other tabs open is not an
attributable memory budget. Before a production memory claim, run isolated processes
and count all owned allocations; an output check after decoding cannot bound codec
allocation in advance.

These limits may be revised with measured evidence and a recorded ADR change.
Exceeding a configured parser limit must return an explicit diagnostic. Do not
increase limits silently to make a single retail sample pass. Gameplay tick/frame
budgets require a real simulation workload and are set when that workload exists;
render FPS will never determine simulation state.

The toolchain and combined GPL/MIT component boundary remain as recorded in
[ADR 0001](0001-m0-toolchain-and-contracts.md) and [licensing](../licensing.md).
The privately evaluated FFmpeg build and proposed narrow build are research pins.
Production decoder adoption still requires a reproducible build, component audit,
appropriate notices and source distribution. No new runtime dependency is selected
by this ADR.
