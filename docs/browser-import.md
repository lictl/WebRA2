# Browser installation inspection

[Issue #44](https://github.com/lictl/WebRA2/issues/44) implements the on-device
metadata kernel for [the inspector #27](https://github.com/lictl/WebRA2/issues/27).
This is an index inspection pass. It cannot start a campaign, verify a complete
installation, select effective mod content or certify the minimum asset subset.

## API and ownership

`inspectInstallation(files, options)` is exported from
[browser-import.ts](../packages/vfs/src/browser-import.ts); its readonly interfaces
are in [browser-types.ts](../packages/vfs/src/browser-types.ts).

```ts
const report = await inspectInstallation(selectedFiles, {
  profile: 'yr',                 // 'ra2' | 'yr'; no inferred default
  policy: 'tolerant',            // 'tolerant' | 'strict'
  signal: controller.signal,
  onProgress(progress) { /* render counts; never send selected content */ },
});
```

The caller supplies a dense array of browser `File` instances, usually copied from
a file/folder picker. Inputs and option values are captured before asynchronous
work. A common selected folder prefix among valid paths is removed; invalid entries
remain diagnosed without hiding that prefix. Deeper directory namespaces stay
distinct. Paths use the existing VFS NFC/ASCII-casefold normalization. Unsafe paths
are rejected, and every duplicate normalized path is blocked instead of selecting
the first file. EXE/DLL and other program files are ignored and never required.
Unknown extensions are reported as unsupported. Supported loose assets need no MIX
wrapper; their literal names are inventoried without reading their payloads.

The returned frozen metadata includes selection-scoped file IDs, numeric archive
records and root ranges, filename candidates with provenance, ten initial required
definition/opening candidates, diagnostics and byte counts. A nested member's root
offset is `archive.absoluteOffset + archive.dataOffset + member.offset`. Neither
File/Blob handles, byte arrays, arbitrary payload strings nor callbacks appear in
the report. The implementation performs no network or storage operations and does
not retain the handles in module state. The shell owns selections and must discard
stale results after replacement/cancellation using its own job identity.

`AbortSignal` cancellation rejects with `AbortError`; callback exceptions also
reject the job. Progress phases are `validate`, `archives`, and `requirements`.
There is no partially successful cancellation report. Invalid option/selection
shapes reject before file reads. A normal report can contain malformed or missing
content: `status: 'inspected'` means that this bounded pass finished, while `limited`
means a configured inspection cap prevented completion. Diagnostics qualify either
state. `canStartCampaign` is always `false`.

## Identity, candidate names and explicit profile scope

Every file/archive identity is `{ status: 'unverified', sha256: null }`. No whole
file is allocated for WebCrypto and no fake hash is supplied to the existing
verified profile resolver. Advertised MIX checksums remain `unverified`; classic
archives report `no-checksum`. The shared
[integrity policy](analysis/checksum-policy.md) allows both with warnings in tolerant
mode and blocks advertised unverified checksums in strict mode. A blocked ancestor
also blocks its nested archives. Numeric records remain visible even when policy
blocks use; structural ambiguity prevents recursive interpretation.

Names come from a bounded, original list of standard filename candidates, selected
filenames and validated XCC local filename databases. The existing
[MIX hash resolver](../packages/formats/src/mix-names.ts) preserves both hash families
and collisions. An ID match is a candidate, not proof of a filename. Later databases
can add names to earlier numeric rows; they do not retrospectively establish a
native mount assignment. Archive identification distinguishes selected filenames,
hashed name candidates and structural probes. An unnamed nonempty member may be
probed as a MIX, but successful structure does not establish native mounting.

Profile eligibility is a conservative WebRA2 inspection policy. Known YR roots and
definitions are excluded from RA2. Known original-only definitions/expansion roots
are excluded from YR, while known shared archives are eligible for both. Unknown
archive names and nested directory namespaces stay unassigned; their numeric census
does not make them effective content. Numeric unnamed nested archives inherit their
parent's scope. No wildcard/native mount ranks or content winners are inferred.

The ten requirement rows comprise rules, art, AI, battle, map selection, mission,
sound, CSF, GAME.FNT and the chosen first campaign map. `literal` means one accepted
loose filename; `candidate` means one allowed indexed name candidate; `ambiguous`
preserves duplicate paths, hash collisions or multiple physical candidates;
`blocked` means a single policy-blocked match; `missing` means no eligible candidate
was found by this pass. None verifies payloads. In a limited report, missing may
simply mean uninspected. Identical retail copies remain ambiguous until hashing
establishes equivalence, and patched YR alternatives remain visible until verified
selection applies the separately evidenced native policy. Full dependencies,
localization, mission decoding and campaign readiness are separate gates.

## Bounds and cancellation

The adapter in [browser-source.ts](../packages/vfs/src/browser-source.ts) checks
integer ranges and exact read lengths. All archive slices delegate to the same
root adapter and shared job read budget.

| Resource | Limit |
| --- | --- |
| Selected files | 4,096 |
| Single range / active reads per adapter | 1 MiB / one |
| Underlying range operations across the loaded adapter module | Four |
| Total reserved inspection reads | 64 MiB |
| Archives / numeric member records | 512 / 250,000 |
| Entries per archive | 8,192; checked before index allocation |
| Nested archive depth | Four edges below a selected root |
| One XCC database / names in it | 1 MiB / 8,192 |
| Resolver candidates / name evidence per member | 10,000 / 16 |
| Diagnostics | 4,096 including the cap diagnostic |

The MIX reader's remaining byte/index limits also apply. Declared archive/index,
database and aggregate limits produce explicit diagnostics. Unknown structural
probes rejected by parser limits do not become asserted archives. The pass yields
between selected files/archives and during record metadata completion, aiming at
the [ADR 0002 responsiveness gate](adr/0002-reference-profiles-and-initial-budgets.md).
The gate still requires foreground measurements in the integrated browser app.

`Blob.arrayBuffer()` cannot be cancelled underneath. The returned promise rejects
promptly, but its at-most-1-MiB operation keeps its slot until it settles. Repeated
cancellation cannot release slots early to accumulate unbounded pending reads.
Exceeding the module-wide four-operation limit rejects a range instead of queuing
it. These are I/O allocation bounds, not a claim about total browser RSS, metadata
object overhead, parser copies or browser-internal buffering.

## Validation and private probe

With Node 24.20.0 and `npm ci` in the checkout:

```sh
node --import tsx --test tests/vfs/browser-*.test.ts
npm run check
git diff --check
```

Twenty-three original synthetic tests cover nested ranges and privacy, strict parent
policy propagation, files-only input, unsafe/duplicate paths, explicit profiles,
malformed archives, filename databases, declared caps, the shared 64-MiB budget,
input replacement, cancellation races, callback reentrancy/cleanup, exact reads and
four outstanding operations.
They run in Node's File/Blob implementation and are not browser acceptance evidence.

A separate private read-only probe selected the 129 flat files in the supplied
Steam Traditional Chinese `game/` directory. Node `fs.openAsBlob` provided each
file's range reads through a File-compatible adapter, avoiding a full installation
copy. It opened no programs for execution, did not inspect subdirectories, and
published only the following aggregate facts:

| Tolerant profile | Archives / members | Candidate-named members | Bytes read | Largest index |
| --- | --- | --- | --- | --- |
| RA2 | 73 / 6,996 | 49 | 901,310 | 1,257 entries |
| YR | 117 / 13,814 | 91 | 1,112,042 | 1,923 entries |

Both finished with `inspected`, below every configured cap. RA2 had 62 advertised
unverified checksums and 11 absent; YR had 103 unverified and 14 absent. RA2's opening
map had two candidate sources; YR's rules and sound tables each had two. The other
listed requirement groups each had one candidate. Forty-five selected paths in
each pass remained unassigned. This smaller name dictionary intentionally does not
repeat the M0 executable-string candidate harvest. The private fact report lives in
ignored `local/native-profile-evidence/browser-import-private.json`; it is a
component probe, not an actual browser run, checksum verification or campaign test.

## Bounded header reuse

[Issue #69](https://github.com/lictl/WebRA2/issues/69) removes duplicate native reads
while probing unnamed members. The inspector already reads up to ten bytes to
exclude known non-archive signatures. The recursive MIX parser now reuses that
prefix for entirely contained reads, returning independent slices. Larger requests
forward unchanged to the original bounded source; there is no payload read-ahead,
installation-wide cache, format shortcut or change to integrity decisions. Only
the active recursion retains prefixes (at most ten bytes per frame, depth capped
at four). Abort and source range checks also apply to prefix hits. The 64 MiB
inspection budget and reported bytes count underlying reads, not reused bytes.

Two new original tests exercise exact native read ranges for a numeric nested
archive and false candidates, including a six-byte truncated candidate and abort
after its prefix read. Existing malformed archive, strict ancestry, recursion and
aggregate budget tests still apply. All 17 importer tests pass.

A private Node File-compatible range probe compared the same recursively selected
438-file corpus against the pre-reuse implementation. Every report field matched
after excluding only `summary.bytesRead`; no archive/member/name/policy outcome
changed. RA2 native requests fell from 20,384 to 8,456 and bytes from 938,416 to
866,848. YR requests fell from 36,923 to 15,438 and bytes from 1,149,148 to 1,020,238.
The reports retain 74 / 118 archives and 8,094 / 14,912 member rows respectively.
The additional editor archive in this recursive corpus explains its difference
from the flat selection above. This is a request-count measurement, not a browser
speed claim. Rebuilt browser evidence remains in [the shell PR](https://github.com/lictl/WebRA2/pull/56)
under [#27](https://github.com/lictl/WebRA2/issues/27) and
[#64](https://github.com/lictl/WebRA2/issues/64). Private script/aggregate results
remain in ignored `local/probe-headers.ts` and `local/header-probe-facts.json` in
the header-probes worktree; no retail payloads are included.

## Provenance

These new modules and original tests are GPL-3.0-or-later. They compose the existing
GPL MIX reader/name resolver/integrity policy and call the original MIT VFS path
normalizer. No new runtime dependency, algorithm copy or game payload is added.
The exact inherited OpenRA/Blowfish sources and notices remain in
[format provenance](../packages/formats/PROVENANCE.md); combined distribution follows
[project licensing](licensing.md). Standard filename candidates are format metadata.
