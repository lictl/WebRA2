# M0 evidence exit record

State: **COMPLETE** — the accepted M0 evidence and feasibility gates are satisfied.
The final integration is [PR #42](https://github.com/lictl/WebRA2/pull/42); its review,
checks and merge are the authoritative completion record. No essential human input
was needed. Work stops at the owner-requested milestone; inspector #27 is queued.
This record evaluates the accepted [M0 plan](../plan.md), not campaign release compatibility.

| M0 criterion | Reviewed evidence | Current boundary |
| --- | --- | --- |
| Bounded archive reader, member/hash inventory, checksum and name handling | [MIX reader/census](mix-reader.md), [integrity policy](checksum-policy.md), [verified ranges](verified-source-reader.md); PRs #14/#25/#26/#35 | 117 archives / 13,814 members structurally indexed; hashed names remain candidates; two movie trailer causes tracked in #11 |
| Supplied build/profile/patch/loose evidence | [Native evidence](native-profile-evidence.md), [reference source selections](m0-reference-profile.json); PR #36 | Exact source identities and ordinary expansion/loose/first-match behavior; historical version number and universal dynamic order unverified |
| Campaign/opcode and dependency census | [Campaign census](campaign-census.md), [structural graphs](campaign-graph.md), [transitive candidates](dependency-candidates.md), [38-mission ledger](m0-campaign-ledger.md); PRs #20/#29/#39 | Required source groups, conditional/optional file candidates and unsupported operands explicit; native dependency/behavior closure remains false |
| Opening/continuation/end selection | [Native MAPSEL tables](native-profile-census.json) and [ledger](m0-campaign-ledger.md); PR #36 | Both Allied openings selected; normal table targets and four EndOfGame controls identified; no played branch, defeat, save or ending |
| Installed locale/font/UI/media dependencies | [Locale evidence](locale-dependencies.md), [source manifest](locale-font-sources.json); PR #37 | One observed Traditional Chinese candidate spanning both games; every non-control CSF character mapped; native layout/speech/subtitle release gates remain |
| Bounded browser-local reads/storage and CJK | [Initial browser probe](browser-feasibility.md), [Edge/Firefox follow-up](media-presentation.md); PRs #15/#40 | Actual Chrome/Edge/Firefox/Safari File/storage/CJK smoke evidence; full import, eviction, IME and offline product flows await M1/R1 |
| Candidate real cinematic path and load/memory evidence | [Presentation report](media-presentation.md); PR #40 | Real Bink/PCM displayed/scheduled in four browser families; long-clip rereads/underruns measured; persistent decoder and full cinematic gates remain #12 |
| Real non-cinematic visual sample | [SHP/palette sample](shp-sample.md), [native pairing locators](shp-native-pairing.json); PR #41 | Real 800×600 sample displayed in Chrome with independently reproduced pixel hashes; native paired palette uses RGB << 2; bounded format-2 nonzero literal subset only |
| Initial behavior/save/command/evidence contracts and comparison plan | [Contracts](../../packages/contracts/src/index.ts), [specifications](../specs/README.md), [reference recipes](../specs/reference-recipes.md); PRs #9/#13 | Versioned research/command boundaries and original abstract probes; simulation/save runtime unimplemented |
| Exact dependencies, licenses, toolchain and budgets | [Licensing](../licensing.md), [ADR 0001](../adr/0001-m0-toolchain-and-contracts.md), [ADR 0002](../adr/0002-reference-profiles-and-initial-budgets.md) | Dependency/source pins and component notices retained; explicit next-slice numeric gates on measured hardware; production codec remains a separate choice |

## Reference content and first slices

[The reference manifest](m0-reference-profile.json) binds ten definition/locale source
groups per opening to member hashes and exact physical source alternatives. It selects
the expansion `rulesmd.ini` and `soundmd.ini` copies using the reviewed native
expansion-before-base evidence. The second YR mission's expansion selection appears
in the campaign ledger. A unique content hash identifies a candidate even when the
original filename directory is unavailable; it does not prove all runtime loaders
have been recovered.

The manifest also preserves the 69 observed data archive roots as a conservative
assets-only import set. It includes shared/expansion definitions, campaign maps,
language/UI/audio, theater/side assets and movie candidates, plus unused/multiplayer
alternatives. That is deliberately broader than a minimal campaign set. No native
EXE/DLL is required at runtime. The transitive manifest provides the narrower
required-definition, conditional-asset and optional-probe classifications; unknown
packed-map, default, media and opcode-generated dependencies remain explicit.

First RA2 slice: `all01t.map`, content SHA-256
`ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c`.
Its current conservative graph has 98 structural seeds, 1,889 nodes and 2,958 edges;
32 weapon, 11 projectile, 18 warhead and 81 animation candidates; all 320 requested
sound sample IDs have indexed candidates. Native MAPSEL points to `all02s.map`.

First YR slice: `all01umd.map`, content SHA-256
`dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0`.
Its conservative graph retains base/patch alternatives: 252 structural seeds,
3,763 nodes and 10,811 edges; 166 weapon, 40 projectile, 81 warhead and 109 animation
candidates; all 670 requested sound sample IDs have indexed candidates. Native MAPSEL
points to the expansion `all02umd.map` content. These counts describe research
candidates and must be recomputed as effective rules/defaults are compiled.

The RA2 opening provides the smaller initial runtime target; the YR opening is a
required expansion path after the shared systems. M1 first builds synthetic
determinism and the on-device inspector; M2 prepares real content rendering; M3/M4
target these missions. No mission behavior will be hardcoded to bypass missing
capabilities. All 38 ledger missions remain INVENTORIED.

## Known implementation work retained

- [Effective content #18](https://github.com/lictl/WebRA2/issues/18): native/default
  compilation, theater/side and unresolved file selection, packed cells/overlays,
  typed opcode operands, runtime-generated dependencies and playable locale behavior.
- [Cinematics #12](https://github.com/lictl/WebRA2/issues/12): persistent packet-loop
  prototype with pinned sources, long clips and worst cases, decoded A/V correctness,
  silent/multiple tracks, seek/skip/pause/background, subtitles and isolated memory.
- [Checksum cause #11](https://github.com/lictl/WebRA2/issues/11): source pins and
  tolerant/strict import policy exist; the two mismatching movie trailers remain
  unexplained. Native cache stubs are a handling observation, not a cause.
- [On-device inspector #27](https://github.com/lictl/WebRA2/issues/27): the next queued
  implementation slice, with file/folder selection, missing/unsupported diagnostics,
  source profiles, bounded progress/cancellation and no asset transfer to a server.

The [remaining dependency table](mission-dependencies.md) maps each gap to concrete
next work. Gameplay, full renderers, mission interpreters, AI, saves and multiplayer
remain unimplemented. M0 records an evidence baseline and a viable implementation
route while preserving those release requirements.

Final integrated validation: **154 public tests pass**, strict TypeScript,
local documentation links, publication paths, metadata consistency and whitespace
checks. Private source, native-range and pixel reproductions are described in the
component reports and exact-head reviews; no retail fixture is needed in public CI.

Public `npm run check:evidence` checks source-report hashes, filename/source joins,
selected definition fingerprints, all conservative data roots, the 38 campaign rows,
opcode counts and native-table transition targets. It reads only published metadata.
The private component commands reverify actual asset bytes separately; public metadata
consistency is not a substitute for those checks or an original-game comparison.
