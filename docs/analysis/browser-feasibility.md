# M0-04 browser import and Traditional Chinese feasibility

Status: **measured diagnostic, incomplete release gate**. Work issue
[#7](https://github.com/lictl/WebRA2/issues/7); remaining presentation/browser/memory
work [#12](https://github.com/lictl/WebRA2/issues/12). Measurements on 2026-09-09,
MacBookPro18,2, 64 GiB RAM, macOS 26.6.2 (25G83). These are metadata-only records
from actual browsers operated through their UI; no headless/WebKit substitute.

## Run the original synthetic probe

From the repository root, with the project's selected Node 24 runtime:

```sh
node --test tests/feasibility/*.test.mjs
node tools/feasibility/serve.mjs
```

Open `http://127.0.0.1:8765/` in the target browser and press **Run synthetic File
and storage checks**. Stop the server with Ctrl-C. The server binds only loopback,
accepts only GETs for explicitly named diagnostic sources, rejects other Host
headers and paths, and has no upload endpoint. It serves neither the repository
root nor `game/`. This is a developer diagnostic, not the product localhost launcher.

The probe constructs a 65,798,144-byte (62.75 MiB) synthetic `File`, reads every
byte through `Blob.slice().arrayBuffer()`, checks the offset-dependent byte pattern,
and reports an unsigned checksum. Requests are sequential and each returned
buffer is at most 262,144 bytes. Synthetic construction itself can allocate/copy
more than this: the range cap is **not** a total browser memory claim. A separately
selected local file is sampled only through its first 8 MiB; cancellation yields
between slices, and the selected filename/content are not included in that report.

The probe queries quota and existing persistence permission without requesting a
permission change. OPFS and IndexedDB each write/read a unique synthetic 32-byte
record and remove that record. It does not copy the installation into browser
storage, fill the quota or test eviction. IndexedDB reads wait for transaction
completion before deletion; the first Safari run exposed and led to a fix for a
cleanup race. The subsequent Safari run has no cleanup error.

## Recorded actual results

These are single interactive smoke runs, with other applications open. The timed
read loop includes byte verification and a zero-delay timer yield per slice; OS
focus/background timer scheduling was not controlled. **Do not rank browser I/O
performance from these durations.** The later Safari repetition verifies the
cleanup fix; the earlier timings are not treated as a benchmark distribution.

| Browser / observation UTC | File construction | Complete synthetic read/verify | OPFS and IDB | Reported quota / persisted |
| --- | ---: | ---: | --- | --- |
| Chrome 152.0.0.0 / 12:40:31 | 75.4 ms | 1,563.5 ms | Both passed | 10,737,418,240 bytes / false |
| Firefox 151.0 / 12:41:59 | 41 ms | 509 ms | Both passed | 10,737,418,240 bytes / false |
| Safari 26.6.2 / 12:43:40 | 88 ms | 8,957 ms | Both passed, cleanup fixed | 82,463,372,084 bytes / false |
| Edge | — | **Not run: unavailable on this machine** | Unmeasured | Unmeasured |

All three completed exactly 65,798,144 bytes, checksum `3929800704`, maximum
returned slice 262,144 bytes, and a zero-length read at EOF. Their loopback origin
was a secure context without cross-origin isolation. `File`, Blob slicing,
WebAssembly, `VideoDecoder`, and the `webkitdirectory` input property were present.
`showDirectoryPicker` was present in Chrome and absent in Firefox/Safari. API
presence is not proof of directory-selection UX, codec support or persistence.
Firefox's application bundle before launch was 150.0.2; its actual running user
agent after launch was 151.0, which is the version recorded for the measured run.

Original Traditional Chinese diagnostic text, punctuation and the short save-name
field were inspected in screenshots from all three browsers. Glyphs were visible
and the multiline sample wrapped without clipping at the observed viewport. This
verifies system-font rendering of that **synthetic** text only. It does not verify
retail CSF decoding, legacy encodings, objective UI, font coverage for the installed
language census, IME composition, long names, subtitles or gameplay hotkeys.

## Next boundary

Use a File/Blob range-read fallback on all targets; treat directory handles and
OPFS as capabilities. Browser quota is a changing estimate, not reserved capacity;
retain save export/reimport and quota-error recovery. Mozilla documents
[Blob slicing](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice) and
[browser storage quotas/eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

[#12](https://github.com/lictl/WebRA2/issues/12) retains the unmeasured gates: actual
Edge, representative whole-install import, controlled foreground cold/warm load
runs, total/peak memory using browser and OS tools, storage eviction/relaunch,
network interception, and real terrain/sprite/voxel presentation. No decoded visual
asset sample is claimed here. Cinematic evidence and its separate limits are in
[media feasibility](media-feasibility.md).

Validation: seven original synthetic Node tests passed under Node 24.20.0 (and the
five initial range tests also passed under Node 22.23.0). They exercise unaligned
slices/EOF, malformed and oversized ranges, cancellation/reuse, concurrency,
short reads, Bink header offsets and oversized dimensions/counts/rates. Manual HTTP
checks verified diagnostic GET 200 and private paths/traversal, POST and foreign
Host 404. These are not campaign or product browser-flow tests.
