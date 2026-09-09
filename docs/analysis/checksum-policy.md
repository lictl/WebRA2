# MIX integrity investigation and WebRA2 import policy

Issue [#11](https://github.com/lictl/WebRA2/issues/11) remains **open**. This slice
implements an explicit WebRA2 policy and rules out five checksum-domain candidates;
it does not establish why two supplied movie archive trailers disagree with their
payloads or how every native RA2/YR load path handles them.

## Bounded static findings

The [reproducible metadata](checksum-domains.json) compares `movies01.mix`,
`movies02.mix` and the checksum-matching control `movmd03.mix`. Every source first
matched its size and full SHA-256 from the merged MIX census; file device/inode,
size and nanosecond modification/change times must remain unchanged through the run.
All reads were local,
read-only and chunked at 256 KiB; no game program was run or payload published.

| Archive | Declared payload SHA-1 vs stored trailer | Members / Bink signatures | Gaps between members |
| --- | --- | ---: | ---: |
| movies01.mix | mismatch | 44 / 43 | 36 ranges, 289 bytes (279 nonzero) |
| movies02.mix | mismatch | 41 / 40 | 31 ranges, 249 bytes (244 nonzero) |
| movmd03.mix | match | 57 / 56 | 43 ranges, 333 bytes (308 nonzero) |

Five SHA-1 domains were compared: the declared payload, all file bytes before the
trailer, members concatenated in physical order with gaps excluded, members in
index order, and the reconstructed logical 6-byte header/12-byte records followed
by the payload. None matches either RA2 movie trailer. Only the declared-payload
domain matches the YR control. Reversing the trailer bytes or swapping byte order
inside its 32-bit words also does not explain either mismatch. All 139 Bink-signature
members have Bink declared lengths equal to their MIX member lengths; this checks
length fields, not media decoding or frame correctness.

These comparisons weaken the specific explanations of hashing the index, omitting
alignment gaps, concatenating in hash-index order or simply reversing stored bytes.
They are not exhaustive proof of the checksum's history. Nonzero alignment padding
also occurs in the matching control and is not evidence of corruption. Exact
source/trailer/domain hashes are in the metadata; the inputs were not repaired,
normalized or rewritten.

## Primary source evidence and its limits

EA's published Red Alert source is pinned to commit
`f1f0d42bc2dcd06d5d1df943c6150ab34bf307ae`:

- [REDALERT/MIXFILE.CPP, Cache()](https://github.com/electronicarts/CnC_Remastered_Collection/blob/f1f0d42bc2dcd06d5d1df943c6150ab34bf307ae/REDALERT/MIXFILE.CPP#L399-L449)
  connects a SHA stream, starts at `DataStart`, reads `DataSize` bytes, then compares
  the next 20 bytes to that digest; a mismatch fails that cache operation.
- [REDALERT/SHASTRAW.CPP](https://github.com/electronicarts/CnC_Remastered_Collection/blob/f1f0d42bc2dcd06d5d1df943c6150ab34bf307ae/REDALERT/SHASTRAW.CPP#L60-L91)
  hashes the bytes passed through the stream and exposes the result.
- [FinalAlert2/XCC mix_file.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/mix_file.cpp#L54-L78),
  pinned to `6abf0f557469baea73079c6bf6550709e2e3584e`, corroborates the flag, padded
  encrypted index, declared data size and optional 20-byte trailer layout.

The first two references are **RA1 source released with the Remastered Collection**,
not the supplied RA2/YR executable. They support the payload-domain interpretation
and show one historical cache path; they do not prove RA2/YR streaming/cache policy,
Steam packaging history or the provenance of these two trailer values. The editor
source also is not native gameplay evidence. No code from these references is
copied into this slice; only source locations and observed format facts are used.

## Explicit policy API

[Implementation](../../packages/formats/src/mix-integrity.ts) composes the existing
bounded parser. It accepts a trusted streaming SHA adapter, with digest chunks from
1 byte to 1 MiB (256 KiB default). Parsing/range limits run before any full-source
hash. The browser-independent implementation has no Node or filesystem imports;
the Node adapter lives in [the diagnostic CLI](../../tools/analysis/checksum-domains.ts).
No dependency was added. Original policy code/tests use GPL-3.0-or-later consistently
with the format component they compose.

`inspectMixIntegrity(source, options)` produces a status and the independent source
identity result. A supplied expected size/SHA-256 is mandatory evidence: mismatched
or unverifiable identity cannot be treated as an ordinary checksum warning. Without
an expected fingerprint, the identity status is `not-requested`, even if the payload
checksum matches. `verified` means only that the advertised legacy payload SHA-1
matches; it is not publisher authenticity, a whole-file identity proof, or proof
that every decoder/game behavior accepts the content.

`decideMixImport(report, policy)` requires the caller to choose `tolerant` or
`strict`; it never silently changes policy:

| Integrity status | Tolerant | Strict |
| --- | --- | --- |
| verified | allow | allow |
| no-checksum | allow with `checksum-absent` | allow with `checksum-absent` |
| unverified (skipped or no digest provider) | allow with `checksum-unverified` | reject |
| mismatch | allow with `checksum-mismatch` | reject |
| structural-failure | reject | reject |
| source-identity-failure | reject | reject |
| verification-failure (failed/short read or broken digest adapter) | reject | reject |

Strict means enforcing **advertised** checksums; classic/flagged archives that
legitimately omit one remain usable. Both policies reject unknown flags, truncated
or invalid ranges, trailing data, duplicate IDs and overlapping members. The latter
layout choices are deliberately stricter than the low-level census parser, which
retains such diagnostics for research. This is **WebRA2 import policy v1**, not an
assertion about native-game behavior. The supplied movie mismatches are usable with
an explicit tolerant warning and rejected under strict mode; no filename-specific
exception or checksum replacement is embedded in the implementation.

Digest adapters must consume every chunk and return a valid hexadecimal digest;
truncated consumption, adapter errors and malformed results cannot become a passing
verification. The `ByteSource` must stay immutable for the operation, as its existing
contract requires. Callers must pin a new source identity when intentionally changing
mods/assets; they must not reuse old offsets merely by selecting tolerant policy.
Returned reports/decisions are trusted application data, not an authentication token.
Warnings still need product UI integration in M1; this module is not that UI.

## Reproduction and remaining work

```sh
node --import tsx --test tests/formats/mix-integrity.test.ts
node --import tsx tools/analysis/checksum-domains.ts game > local/checksum-domains.json
npm run check
```

Ten original synthetic tests cover the policy matrix, payload-only versus full
source identity, unavailable/failed digest providers, short reads, incomplete
consumption, empty payloads, chunk limits, ambiguous layouts, malformed options and
pre-hash resource caps and input-identity snapshotting. The source-change test edits an original synthetic index
while preserving its payload checksum; expected full-source identity still rejects it.
The private domain comparison uses the recorded installation only and is not a
campaign or native-playback test.

No immediate owner action is required to integrate this policy. Issue #11 remains
open for the native cause and behavior: compare against another authorized,
independently identified copy of the same storefront/build and investigate whether
movie streaming uses the historical cache check. If agents later need original-game
observations, a minimal request is to play the relevant opening Allied/Soviet media
with unchanged, fingerprinted files and record visible errors/success. Such a run
would show that playback path's behavior; it would not explain the trailer mismatch
by itself. Do not modify the installation or request a broad reinstall merely to
make the checksums agree.
