# Theater definitions and TMP candidates

Issue [#76](https://github.com/lictl/WebRA2/issues/76) adds a bounded, browser-safe
compiler from explicit theater INI layers to global tile ranges and TMP filename
candidates. It closes candidate/slot coverage for the two pinned opening Allied
maps. It does not select a physical archive winner, choose a replacement image,
render terrain, or establish playable campaign behavior.

## API and caller responsibilities

The original TypeScript implementation and synthetic tests are GPL-3.0-or-later.
The format interpretation uses the GPL EA editor reference and the private native
observations below; it contains no game data or disassembled code. There is no new
product dependency. See [licensing](licensing.md),
[runtime INI policy](runtime-ini.md), [scenario geometry](scenario-terrain.md),
[browser catalog](browser-catalog.md), and [TMP decoder](tmp-decoder.md).

```ts
import { compileTheaterTiles, resolveTheaterTile }
  from '../packages/content/src/theater-tiles.ts';

const table = compileTheaterTiles({ profile: 'yr', theater: 'NEWURBAN', layers });
const result = resolveTheaterTile(table, {
  tileIndex: cell.tileIndex, extraTileWord: cell.extraTileWord, subtile: cell.subtile,
});
```

Callers verify each source hash before providing `RuntimeIniLayer` records. The
compiler does not authenticate the supplied hash. It internally compiles explicit
layer `order` values using `webra2-ini-1`; neither array order nor an `md` filename
creates implicit precedence. Cross-layer overrides retain selected and shadowed
origins. Any same-layer duplicate of a mapping field is rejected, including one
hidden by a later layer. Unknown INI fields, section occurrences, raw values and
scanner diagnostics remain available in `table.ini`; per-set fields retain their
origins. This is still an explicit WebRA2 INI policy, not a claim that native
duplicate/comment/merge semantics are fully reproduced.

`sets` contains contiguous four-digit section IDs, zero-based `firstTile`, file
count, prefix and fields. A global tile number selects a file within that range;
its filename number starts at one with a minimum width of two decimal digits.
The subtile is an independent zero-based TMP index-table slot. Empty sets consume
no global numbers. Repeated file prefixes are retained as separate set ranges with
`shared-file-prefix` diagnostics: actual definitions reuse files this way.

The explicit theater determines `.tem`, `.sno`, `.urb`, `.ubn`, `.des` or `.lun`.
RA2 accepts TEMPERATE/SNOW/URBAN; the other three require YR. No editor-only
`.ubn` to `.urb` to `.tem` fallback is applied. Missing base files remain missing
assets for the caller to report.

`resolveTheaterTile` accepts only an immutable table produced by this compiler.
It returns `candidate`, `clear-sentinel`, `tile-out-of-range`,
`unsupported-extra-word`, or `clear-unavailable`. The raw words and subtile are
always preserved. An exact raw tile value `0x0000ffff` returns the first file of
the set identified by `[General] ClearTile`, with `clear-sentinel` status. A
nonzero high word remains unsupported, even if the low word is `0xffff`.
Missing ClearTile metadata prevents sentinel resolution; an invalid/empty target
set rejects compilation. There is no fabricated blank tile.

Successful results contain the base name followed by bounded `a` through `z`
replacement candidates. Probe in order and stop at the first missing filename;
later names are not automatically valid replacements. Every physical match for a
name remains a separate candidate. `variantSelection: 'unresolved'`,
`physicalAssetsVerified: false`, and `replacementCompleteness: 'bounded'` prevent
a list of names from masquerading as a selected, verified image. A caller must
verify candidate bytes and confirm the requested slot is present using
`parseTmpIndex`. Reaching the suffix cap without a missing file is an incomplete
replacement census, not proof that the sequence ends there. Deterministic visual
variant choice, damaged tile states and animation semantics are later work.

## Supported counts and limits

An ordinary ASCII count consumes a signed decimal digit prefix. A present value
with no digits converts to zero with a `no-digit-count-zero` diagnostic; a value
with a noncanonical decimal prefix emits `decimal-prefix-count`. The raw text is
never rewritten. This supports the verified YR definition's one nonnumeric count
at TileSet0105 line 1374, which contributes zero files. YR's native decimal branch
and the EA editor's `atoi` agree for that value. RA2 remains editor-supported,
with native RA2 behavior explicitly unverified.

Missing or empty counts, negative counts, section gaps/non-four-digit spellings, unsafe
nonempty file prefixes, integer overflow, hexadecimal count syntax, invalid clear
sets, and a `LastTilesInSet` other than -1 or `TilesInSet` reject
compilation. Native negative/missing-count termination and old-count remapping
are observed but intentionally unsupported rather than silently truncating the
table or shifting a mod's indices. An absent, explicit -1 or equal LastTilesInSet
needs no remap. Zero with a positive TilesInSet requires remapping and is rejected.

Defaults can only be lowered: 8 MiB input layers, 10,000 sets, 65,535 files,
4,096 files per set, 26 replacement suffixes, 1,769,445 potential candidate names,
and 4,096 compiler diagnostics. Potential candidate count is checked before any
filename expansion. Only one resolution's at-most-27 names are allocated per
call; the compiler stores ranges rather than every possible name. The existing
INI scanner's additional caps still apply. Results retain decoded metadata, not
the caller's mutable byte buffer, and every returned metadata record is frozen.
There is no filesystem, network, DOM, clock or RNG dependency.

## Evidence and provenance

Primary references are pinned, rather than inferred from successfully opening a
file:

- EA Mission Editor commit `6abf0f557469baea73079c6bf6550709e2e3584e`,
  [Loading.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp),
  `InitTMPs` lines 4389–4488: contiguous set numbers, cumulative `atoi` counts,
  one-based minimum-two-digit filenames and theater extensions. Lines 4496–4519
  try only four replacement suffixes; the WebRA2 candidate bound is not copied
  from that editor limit. The same function's theater fallback is editor evidence
  only. Lines 404–457 show editor-specific base/MD definition composition; WebRA2
  requires callers to select layers explicitly.
- The same pinned editor's
  [MapData.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp),
  lines 3299–3306 and 4795–4798, substitutes global tile zero for the 16-bit
  sentinel and validates subtiles separately. The native YR observations below
  refine this to the configured ClearTile set rather than a universal hardcoded
  zero. Editor random replacement is not a native simulation oracle.
- YRpp commit `9402d7da0fe14d46703ba871ce3e6b3cde855bfc`,
  [CCINIClass.h](https://github.com/Phobos-developers/YRpp/blob/9402d7da0fe14d46703ba871ce3e6b3cde855bfc/CCINIClass.h),
  [Theater.h](https://github.com/Phobos-developers/YRpp/blob/9402d7da0fe14d46703ba871ce3e6b3cde855bfc/Theater.h),
  [CellClass.h](https://github.com/Phobos-developers/YRpp/blob/9402d7da0fe14d46703ba871ce3e6b3cde855bfc/CellClass.h),
  and [IsometricTileTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/9402d7da0fe14d46703ba871ce3e6b3cde855bfc/IsometricTileTypeClass.h)
  supply address/layout leads for the independent bounded native checks. Header
  labels alone are not treated as execution evidence.

Native evidence uses read-only `gamemd.exe`, SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
Addresses below are virtual addresses in this pinned PE; factual decimal file
offsets and lengths identify the checked bytes. No game process was executed.
Disassembly and raw extracted inputs remain ignored in `local/`.

| Fact / interpretation | VA | File offset / bytes |
| --- | --- | --- |
| TilesInSet / LastTilesInSet call sites; missing count defaults to -1 | `0x545fca` | 1335242 / 66 |
| Present ordinary count delegates to decimal conversion | `0x5278ba` | 1210554 / 40 |
| Decimal converter starts at zero and accumulates only digit prefix | `0x7c9b72` | 3971954 / 139 |
| Local file number and successive suffix construction | `0x546299` | 1335961 / 52 |
| Continue suffix attempts while present; advance file and set loops | `0x546ba7` | 1338279 / 124 |
| IsoMapPack5 reader reads a full four-byte tile value before subtile | `0x56bb51` | 1489745 / 48 |
| Old-count adjustment preserves exact `0x0000ffff` | `0x544e30` | 1330736 / 57 |
| General/ClearTile is read as a set ID | `0x545595` | 1332629 / 27 |
| Current set's first global file index stored for ClearTile | `0x545d1e` | 1334558 / 15 |
| Cell path uses configured clear index for sentinel, then chooses variant and reads subtile | `0x47bfa8` | 507816 / 142 |

The IsoMapPack5 string pointer at `0x7e6038`, read at `0x4ad67d`, is followed by
the dispatch call at `0x4ad6e6` to `0x56bac0`. ClearTile's global index is held at
`0xaa10b0`; a second cell path at `0x47c0d9`–`0x47c0fc` uses the same substitution.
The six native Theater records begin at `0x7e1b78`, stride `0x70`; their extension
fields at record offset 78 agree with the six listed extensions. These are
bounded static call-path interpretations, not recorded native playthroughs.
Equivalent RA2 native paths and universal mod behavior remain unverified.

The private disassembler was [Capstone 5.0.6](https://pypi.org/project/capstone/5.0.6/),
installed only into this research worktree's ignored virtual environment. Its
macOS arm64 wheel SHA-256 is
`e0b87b283905e4fc43635ca04cf26f4a5d9e8375852e5464d38938f3a28c207a`.
It is a BSD-licensed research tool, not a shipped engine dependency. Published
code references above and private executable byte checks are separate evidence.

## Private opening-map verification

Node 24.20.0 used genuine local Blob/File sources, `inspectBrowserCatalog`, full
root/member hash verification, `compileScenarioTerrain`, this compiler, and
`parseTmpIndex`. Every available physical TMP candidate was checked without choosing
an archive winner. Root identities matched the public
[MIX census](analysis/mix-census.json); opening-map hashes matched the
[reference profile](analysis/m0-reference-profile.json).

| Profile / theater | Definition root / offset / bytes | Definition SHA-256 |
| --- | --- | --- |
| RA2 / URBAN | ra2.mix / 119215488 / 30093 | `6b74ebbbd157773ff54b315d5249e27cbfea2322f571b9e8bec2cb9aa3898ee6` |
| YR / NEWURBAN | ra2md.mix / 7698368 / 32614 | `fe64bd6020a24111ac8e086efe7f193912f0dbff1925dc440118b76b7646f785` |

| Gate | RA2 all01t | YR all01umd |
| --- | ---: | ---: |
| Definition sets / files | 110 / 1077 | 122 / 1175 |
| Non-sentinel cells with base candidates and present slots | 5831 / 5831 | 13328 / 13328 |
| Sentinel cells with explicit configured clear candidates and present slots | 505 / 505 | 2152 / 2152 |
| Distinct tile-word/subtile references, including sentinel | 658 | 804 |
| Distinct base filenames referenced | 188 | 242 |
| Distinct physical base/replacement members verified | 326 | 414 |
| Candidate/slot checks independently reproduced | 831 | 998 |

All present replacement candidates had the requested slots. Each sequence reached
a missing filename before the suffix cap; the largest present suffix was `g`.
Both definitions set ClearTile to set zero, whose first global file is zero.
Four shared-prefix occurrences per profile are retained as diagnostics, plus the
one YR no-digit count. This covers these definitions and opening terrain
references; it does not prove every declared file, all campaign maps, other
theaters, draw order, palette choice, elevation, picking, animation or gameplay.

Private reproduction commands, run in the issue worktree with Node 24 on PATH:

```sh
node --import tsx local/probe-theater.mjs
python3 local/theater-oracle.py
```

The separate Python standard-library oracle parses the raw INIs with ConfigParser,
rebuilds cumulative ranges and filename numbers independently, verifies every
retained TMP payload hash, and reads grid/index slots with `struct`. It matched
all 1,829 candidate/slot comparisons. The geometry input is the separately tested
scenario compiler; this is an independent definition/slot interpretation, not a
second full native map loader. Raw inputs and scripts are private because they
operate on local retail data. Metadata report SHA-256:
`9de8a232f0de7016c7585d77e7a09ab117bf082c573f65bf84b392977328e5c7`.

Public validation:

```sh
node --import tsx --test tests/content/theater-tiles.test.ts
npm run check
git diff --check
```

Eight original synthetic tests cover range boundaries and zero-file sets,
nonzero clear-set mapping, high-word/sentinel separation, layer order and
duplicates, count diagnostics and rejected remapping, safe filenames, lowered
budgets, immutable metadata, untrusted table rejection and bounded replacement
names. Private retail checks are a separate gate and never run in public CI.
