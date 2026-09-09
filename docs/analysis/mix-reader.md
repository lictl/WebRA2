# M0-01 MIX reader and member census

Issue: [#5](https://github.com/lictl/WebRA2/issues/5). Date: 2026-09-09.
Scope: read-only archive structure, candidate filenames and content boundaries.
This slice does not establish campaign behavior, asset precedence or exact builds.

## Result and evidence

The bounded TypeScript reader parses all **69 top-level archives** in the supplied
installation and finds **48 nested archives**: 117 archive records and 13,814 member
records in [the metadata manifest](mix-census.json). Eighty-three parsed archives
have encrypted indexes, including 66 top-level archives. There are no index/range
failures, duplicate IDs, overlapping member ranges, trailing bytes, or reached
census depth/entry/archive limits in this corpus.

| Observation | Evidence and limit |
| --- | --- |
| 629 member records have filename candidates; 13,185 remain numeric IDs | CRC32/classic hashes against generated format names, installation filenames and bounded executable filename references; no ambiguous distinct-name matches in this candidate set |
| 37 nested archives identified through candidate names; 11 through structure | Unknown members are probed with the same bounded parser and accepted only at exact declared size without index diagnostics; structural identification is not filename proof |
| 101 of 103 checksum-flagged archive payloads match the 20-byte trailer | Node SHA1 over exactly the declared payload; format-layer status remains `unverified`, with measured `payloadMatch` reported separately |
| `movies01.mix` and `movies02.mix` have mismatched payload SHA1 | Independently reproduced with Python hashlib; hashing all bytes before the trailer also does not match. [Issue #11](https://github.com/lictl/WebRA2/issues/11) tracks cause and import policy; do not infer corruption or silently discard these archives |
| 146 member records begin with a Bink signature | Magic classification only, not successful cinematic decoding |
| `language.mix` and `langmd.mix` each contain a CSF candidate | `ra2.csf` and `ra2md.csf` hash matches and CSF signature; string decoding and playable language identity remain separate gates |

The two movie archive SHA256 values are
`b372192bec31af8e1137ed487b55bdb261d7068553d7e465e1bf65b7f56ff0ba` and
`24e7f9435a593ee4eac44f8d18191aeaaead639418725397fda134b3c254dd35`.
Their measured and expected SHA1 values and exact offsets are in the manifest.

For the media investigation, `movmd03.mix` SHA256
`26959d790cf1f3fa98b078a6b58a6d6cb3167be4495145b65ad2f853a4a5ef71`
has a BIKi-signature member at ordinal 55, numeric ID `0x6ea8aa3b`, absolute offset
355,808,860 and length 246,492. Its archive data offset is 780; its payload-relative
member offset is 355,808,080. No movie payload is published here.

## API and resource policy

[Parser](../../packages/formats/src/mix.ts) is browser-capable TypeScript with only
an MIT Blowfish primitive dependency; it has no filesystem, DOM or Node imports.
The [census CLI](../../tools/analysis/mix-census.ts) supplies Node range reads and
streaming hashes. Browser callers can implement `ByteSource.read` with
`new Uint8Array(await file.slice(offset, offset + length).arrayBuffer())` and use
`File.size`; actual browser-family tests remain a later integration gate.

- Classic: 6-byte header and 12-byte records. Zero-count classic files are ambiguous
  with flagged files and are not accepted as a distinct format.
- Flagged: 4-byte flags then the header/index. Only checksum `0x10000` and encryption
  `0x20000` are supported. Unknown flags fail explicitly.
- Encrypted: 80-byte RSA-encoded key block followed by an ECB Blowfish index padded
  to an 8-byte boundary. Only index data is decrypted; payload reads remain ranges.
- Header/index cap: 786,432 bytes; maximum 65,535 entries and archive size
  4,296,000,000 bytes. Options must be nonnegative safe integers. All ranges are
  checked without 32-bit addition overflow. Short reads fail.
- Member IDs remain unsigned numeric records in original order. Duplicate IDs and
  overlaps are diagnosed without silently selecting a member. `mixMemberSource`
  prevents reading outside a validated member range.
- Filename resolution preserves both hash families, source provenance and all
  collisions. Input names are limited to 1–255 printable ASCII characters; Unicode
  filename hashing is unsupported, distinct from Unicode game text. Resolver cap:
  100,000 candidate names. XCC local databases require valid magic, size, version,
  count and terminated names; they are not paths to extract onto disk.
- Census cap: nesting depth 4, 512 archives, 250,000 member records, 4 MiB local
  database read, 1 MiB hash/reference chunks. Optional `game.exe`/`gamemd.exe`
  filename scans each have an 8 MiB size cap. No executable is run.
- Structural probes cannot prove that every unnamed nested format was discovered.
  The report lists failed named candidates and reached limits separately. Parsing
  success and checksum payload mismatches are separate facts.

The primitive dependency and source adaptations are pinned in
[PROVENANCE.md](../../packages/formats/PROVENANCE.md). Derived code is
GPL-3.0-or-later; retail assets remain outside the repository and distribution.

## Reproduction and verification

From repository root after the coordinator's toolchain package is installed:

```sh
node --import tsx --test tests/formats/*.test.ts
node --import tsx tools/analysis/mix-census.ts game > local/mix-census.json
```

The implementation was run with Node 24.20.0, TypeScript 7.0.2, tsx 4.23.13 and
`egoroof-blowfish` 4.0.3. During isolated worktree development Node came from
`/Users/lucus/Projects/WebRA2/local/toolchain/node_modules/node/bin/node`.
Twenty-one original synthetic tests pass, covering all format variants, every
truncation boundary, unknown flags, checksum trailer presence, uint32 overflow,
resource caps, zero-count ambiguity, short reads, payload-lazy reads, nested ranges,
duplicate IDs, overlaps, filename collisions and bounded XCC parsing. The RSA
known answer was computed independently with Python's `pow`; the Blowfish primitive
has a fixed published known-answer test. Census tests create only original temporary
payloads and check nested provenance, checksum disagreement and parse failures.
Strict TypeScript checking with `noUncheckedIndexedAccess` passes.

The private retail gate successfully enumerates headers/member bounds and emits
metadata. It is not a passing campaign, codec, checksum-integrity or browser gate.
No game program, installer, simulation or mod code was executed. The public manifest
records root and nested SHA256 values, physical archive offsets, source hashes for
optional executable filename candidates, size/flag diagnostics and candidate name
provenance. It intentionally omits payloads and arbitrary executable strings.
The CLI emits deterministic ordering and no timestamp or machine-specific root path.

## Next bounded work

M0-02 can now read exact mission/rules members and compare hashes to deduplicate
missions. Opening mission candidates `all01t.map` and `all01umd.map` have hash matches;
that is not final first-slice selection. Establish RA2/YR mount/patch/loose-file
precedence, resolve remaining relevant names, census campaign dependencies and
variable-arity opcodes, decode CSF text and investigate checksum issue #11.
Required/optional playable import manifests, exact Steam patch identity and complete
language/campaign coverage are still open M0 work. The present manifest is a physical
member census, not an effective merged game content profile.
