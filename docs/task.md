# Current task and refreshed-session handoff

State: **WORKING — M1 runtime/UI and M2 map presentation.** The owner
now authorizes continuing toward a fully playable UI and original RA2/YR campaigns
until essential human input is needed. This supersedes the previous M0 stopping
point. M0 integration [PR #42](https://github.com/lictl/WebRA2/pull/42) merged as
`d590992382d1ce1526942e12b0c5dc51796da1a2`; its evidence remains the baseline.
The import shell [PR #56](https://github.com/lictl/WebRA2/pull/56), localhost
build [PR #46](https://github.com/lictl/WebRA2/pull/46), and original practice/save
UI [PR #85](https://github.com/lictl/WebRA2/pull/85) have merged after their recorded
reviews and browser acceptance. Verified profile loading, terrain preparation and
CPU composition are also merged. Both opening terrains now render in actual desktop Chrome, Edge, Firefox and Safari.
The current work adds object artwork, native scenario construction and persistent
cinematics. No original mission is playable yet.

Current wave: coordinator [exact staged artwork #110](https://github.com/lictl/WebRA2/issues/110);
browser agent finishes [persistent media #101](https://github.com/lictl/WebRA2/issues/101)
then [placed-object viewport #111](https://github.com/lictl/WebRA2/issues/111);
format agent finishes #100 review then [voxel rasterizer #112](https://github.com/lictl/WebRA2/issues/112);
simulation agent reviews media core then [typed entity definitions #113](https://github.com/lictl/WebRA2/issues/113).
Scenario construction #94, sprite composition #99, SHP header fields #104 and exact
source view #109 have merged. #100 passed final independent review; both private
opening resource preparations and source/pixel comparisons pass. #103 stays open
for deliberate exact-source consumer migrations. #100 is now merged as recorded below.
Build/import decisions are recorded in [ADR 0003](adr/0003-browser-build-and-import-boundary.md).
No essential human input is currently needed. Finish each reviewed slice and continue
through the accepted milestones; do not stop simply because this first wave merges.

Read [M0 exit evidence](analysis/m0-exit.md), [decisions](decisions.md),
[reference profiles/budgets](adr/0002-reference-profiles-and-initial-budgets.md), then
the focused component report. M0 completion means an evidence baseline; no gameplay,
full renderer, mission interpreter or multiplayer exists. M1 now adds a synthetic
simulation/save/replay runtime; it makes no original campaign behavior claim.

## Owner decisions

Both RA2/YR campaigns and cinematics, WebRA2 saves, vanilla maps/INI/replacement
assets first; original Windows saves best effort. Browser-native TypeScript with
WASM when justified; vetted GPL reuse acceptable. On-device files/folders and
localhost with no server asset uploads. Desktop Chrome/Edge/Firefox/Safari,
keyboard/mouse; all observed installed locales, with this Steam Traditional Chinese
reference first. Exact historical patch numbers remain unverified. One coordinator
and up to three workers. Original-game observations can be requested only when
an essential ambiguity cannot be settled autonomously. Do not repeat answered
product questions or permission requests for ordinary in-scope GitHub work.

## Current ownership and preserved worktrees

Coordinator owns shared configuration/lock/contracts/licensing and this handoff.
Workers use isolated worktrees with exclusive paths; all GitHub merges belong to
the coordinator after independent exact-head COMMENT review and successful checks.

| Role | Current work and exclusive paths | Branch / private worktree |
| --- | --- | --- |
| Coordinator | #110 exact staged artwork; shared profile identity/configuration/notices/handoff; independent reviews | `codex/110-native-art` at root |
| browser_feasibility | #101 retained Bink decoder/player; packages/media/**, tests/media/**, tools/media/**, docs/persistent-media.md; sole native UI owner | `codex/101-persistent-media`, `local/worktrees/persistent-media` |
| mix_reader | Independent #100 final review, then #112 voxel rasterizer | New #112 worktree after #100 review; preserved earlier worktrees |
| bootstrap_review | Independent #101 native/build review, then #113 typed entity definitions | Preserved `local/worktrees/ini-source-view`; new #113 worktree after media review |

The current wire contracts stay unchanged. The simulation worker owns its internal
synthetic state policy; importer/UI shared types are coordinated before integration.
Past merged research worktrees remain preserved. No worker starts extra agents.

Earlier `local/worktrees/{mix,specs,browser,campaign,checksum,profiles,graph}` and
review checkouts remain preserved. Use `git worktree list` before selecting a new
branch/worktree. Never stage a private dependency symlink as node_modules; use
`npm ci` in the checkout. There are at most four active agents including coordinator.

## Evidence and checks

Revision-specific validation counts are recorded in each PR; do not add counts
across branches. Merged #86 passed 369 tests and both independent private terrain
resource comparisons. Merged #75 passed 370 tests on its integrated head and actual
four-browser persistence/replay evidence. Merged #83 passed 348 tests on its branch,
with independent private CPU composition of both openings. Current #93 final check
counts are recorded with its PR; all earlier claims remain scoped to their revisions.

All four actual browsers completed the worker's full-folder YR/tolerant import:
438 files, 118 archives / 14,912 entries, 158 accepted / 280 ignored, 91 named entries,
eight candidate/two ambiguous requirements. Chrome/Firefox/Edge expose 1,020,238
bytes; Safari shows the rounded 996.33 KiB display. Chrome RA2/strict completes with
74 archives / 8,094 entries and 866,848 bytes. The extra editor archive compared
with the flat M0 probe is unassigned `finalalert2/marble.mix`. Earlier partial counts
must not replace final results. See [the application report](import-shell.md) for
exact tested code hashes, UI/cancellation/locale checks and localhost request evidence.
Observed intervals include native/tool scheduling delays and are not benchmarks;
Safari remains noticeably slower. No owner input or browser settings change was needed.

After browser acceptance, #74 only renames the shared scope-classification function
in the inspector's runtime graph. A direct comparison of built output confirms that
app/CSS/shared chunk bytes are identical to the tested bundle and the import worker
differs only by that function name and generated local identifier names. No new
runtime behavior is inferred from the different worker hash. Catalog code is not yet
connected to the UI. The additional license files do not change runtime behavior.

Verified browser source sessions match both pinned opening root/member identities
using genuine Node file-backed Blobs; those are component tests, not browser evidence.
The new map-pack codecs independently decode both openings' six terrain/overlay
packs; LZO agrees with liblzo2 2.10, LCW with a separate Python grammar implementation.
PR #58 merged after independent review. Terrain PR #65 additionally compiles 6,336
RA2 and 15,480 YR cells; all decoded fields and full rectangular overlay arrays
match independent checks. Unknown tile words/sentinels remain explicit. Those parser checks alone did not render cells or play a mission. The later
CPU composition described below renders terrain; original gameplay remains absent.

Merged PR #68 privately assembles all ten verified definition groups in each profile,
including local CSF catalogs, map-overridden rules and separate other namespaces.
It remains a definitions-and-opening-mission identity, not a full runtime manifest.
Subsequent application integration remains required. Merged PR #74 connects native
File snapshots to explicit candidate lookup and verified reads. Its private full
selection probe reproduces every selected M0 definition root/member identity; conflicts
remain visible. The first catalog is bounded to 512 eligible roots and 16 MiB members.

A measured full-folder scan originally issued 36,923 small range reads; merged #69
reuses already-read headers and reduces YR requests to 15,438 while preserving all
metadata except actual byte counts. #64's worker/termination and nested report
validation passed independent code review and actual browser acceptance. These are
request-count/control-flow improvements, not a controlled performance benchmark.

TMP PR #73 decodes both supported diamond sizes and optional extra color/depth
planes; an independent private Python interpreter matches all 1,821 plane hashes
across 485 present subtiles in 64 members. The later #83/#86 private composition
uses the complete selected base-tile closure.

Final integrated baseline: **154 public tests pass**, strict types,
Markdown links, publication paths and whitespace checks. The new public M0 metadata
check additionally validates source/report hashes, profile/source joins, definition
fingerprints and all 38 campaign ledger rows without opening retail files. Negative
metadata regression checks reject cross-profile groups, wrong patches, omitted
alternatives, changed openings/progression targets and stale source reports.
Component private reproduction is a separate gate.

- MIX: 69 outer / 117 total archives, 83 encrypted, 13,814 members; 629 candidate
  name resolutions and 13,185 unknown names in the initial inventory. All indexes
  structurally decoded; 101 of 103 advertised payload checksums match. Two movie
  trailer causes remain #11. Tolerant/strict policies are explicit, bounded and tested.
- Native: two complete executable hashes and 27 range hashes pinned; expansion
  99→00, append/first-match lookup, ordinary loose-first reads, MAPSEL consumption
  and win control branches established statically. Forty classified mission-content
  candidates and table/rule sources reverified in 48 reads / 22,405,216 bytes.
- Campaign: 38 selected faction mission content identities, with normal MAPSEL
  targets and four EndOfGame controls; every mission remains INVENTORIED. Select
  `all01t.map` then `all01umd.map` for the first campaign implementation slices.
- Dependencies: 15 verified reads / 3,810,446 bytes; 1,889/3,763 candidate nodes and
  2,958/10,811 edges for the two openings. All 320/670 requested sound sample names
  have indexed BAG candidates. Indexed-entry/pair expansion is capped before its
  Cartesian expansion, including rejected ranges. Full closure remains false.
- Locale: three verified members / 2,200,536 bytes; GAME.FNT maps every non-control
  character in both CSFs (1,877/1,978 unique codepoints including LF). Blank/zero-width
  glyphs and three differing RA2 duplicate labels remain explicit. One observed
  Traditional Chinese candidate pack spans RA2/YR; full native locale behavior awaits
  implementation/reference checks. Raw native/font research remains private.
- Browser/media: bounded File/storage/CJK smoke in actual four browser families;
  real 800×600 Bink/PCM eight-second runs present 120/120 frames without underruns.
  The 72-second Chrome run exposes 37.59× repeated reads, three dropped frames and
  underruns. Source/queue/linear-memory/aggregate-RSS scope is recorded; persistent
  decoder and campaign acceptance remain #12. Codec binaries/retail media are private.
- Sprite: a real 800×600 SHP frame and its statically paired PAL displayed in
  Chrome; 600 row prefixes and indexed/palette/RGBA hashes independently reproduced.
  Decoder explicitly accepts only the bounded format-2 nonzero literal subset;
  other compression, remaps, transparency and the full renderer remain unimplemented.
- Review fixes this wave: source discovery cannot downgrade an expected member hash;
  native reports strip extra payload fields; sparse/case-alias locale inputs fail;
  audio pairing fanout is capped before expansion. Each code correction has regression
  coverage. These checks do not claim an original campaign playthrough.

## Commands and private research

Use Node 24.20.0 from `.nvmrc`, then `npm ci` and `npm run check`. On this host the
ignored runtime is `local/toolchain/node_modules/node/bin`; do not change global Node.
Focused tests: `node tools/run-tests.mjs tests/<area>` accepts directories; single
files use `node --import tsx --test tests/content/example.test.ts`.

The corpus is `/Users/lucus/Projects/WebRA2/game`, always read-only. Never execute
bundled game/editor binaries. Private output belongs under ignored `local/`; no
assets, extracted strings/frames, native saves, raw disassembly, recordings or
credentials in GitHub, public CI, web assets or packages. Component reports contain
reproduction commands and exact source/hash/range identities. Missing retail files
skip private gates; they are not a passing compatibility check.

Useful private output locations: `local/native-profile-evidence/`,
`local/media-presentation/`, `local/media-feasibility/`, `local/locale-*`, and the
worker's ignored sprite evidence. The public metadata snapshots are independently
reproduced by the associated verified-source CLIs. A new environment only needs
synthetic fixtures for public checks.

## GitHub traceability and continuing

Every substantive slice uses issue → codex branch/coherent commits → PR → independent
exact-head review → successful checks → coordinator merge. All reviews below are
independent agent **COMMENT** reviews under the shared `lictl` account, not separate
account approvals. Never bypass repository rules or push directly to main. Only the
reviewed head may merge. Record blockers as issues and continue independent work.

Remote: `https://github.com/lictl/WebRA2.git`. `gh` is authenticated as `lictl`;
the host keychain previously chose another account for Git. Use this per-command
helper if needed, without changing global credentials or exposing tokens:

```sh
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
```

Hosted CI is active; the earlier workflow-scope problem #10 was resolved through
the existing authorized GitHub browser session. Do not request auth scope changes
again. Do not push historical unreviewed local branches such as
`codex/8-foundation-ci-local`.

| Work | Issue / PR / final review | Merge SHA |
| --- | --- | --- |
| Planning bootstrap | [#1](https://github.com/lictl/WebRA2/issues/1), [PR #3](https://github.com/lictl/WebRA2/pull/3), [review](https://github.com/lictl/WebRA2/pull/3#pullrequestreview-5154276388) | bf241241e44d369d74662b01ccbf6e9b23d24a9f |
| Toolchain/contracts | [#8](https://github.com/lictl/WebRA2/issues/8), [PR #13](https://github.com/lictl/WebRA2/pull/13), [review](https://github.com/lictl/WebRA2/pull/13#pullrequestreview-5154505853) | fe5978ff6a0844e163e924784851b08276064f92 |
| Behavior/reference specs | [#6](https://github.com/lictl/WebRA2/issues/6), [PR #9](https://github.com/lictl/WebRA2/pull/9), [review](https://github.com/lictl/WebRA2/pull/9#pullrequestreview-5154529411) | 4d586cd45726194ba30fd5fae03edb2b06a9491b |
| Browser/media diagnostics | [#7](https://github.com/lictl/WebRA2/issues/7), [PR #15](https://github.com/lictl/WebRA2/pull/15), [review](https://github.com/lictl/WebRA2/pull/15#pullrequestreview-5154539016) | bcf9b7b7ff3772c7382b826bfe7a46274a605a70 |
| MIX reader/census | [#5](https://github.com/lictl/WebRA2/issues/5), [PR #14](https://github.com/lictl/WebRA2/pull/14), [review](https://github.com/lictl/WebRA2/pull/14#pullrequestreview-5154566975) | 762d6aa6de0ea7c79a3ce0194cf823374764b414 |
| First-wave integration handoff | [#4](https://github.com/lictl/WebRA2/issues/4), [PR #17](https://github.com/lictl/WebRA2/pull/17), [review](https://github.com/lictl/WebRA2/pull/17#pullrequestreview-5154778852) | a520216ce224beb4098b5702eb9dc819a4cf2a75 |
| Hosted public CI | [#10](https://github.com/lictl/WebRA2/issues/10), [PR #19](https://github.com/lictl/WebRA2/pull/19), [review](https://github.com/lictl/WebRA2/pull/19#pullrequestreview-5154855718) | 679228cfc06eabb5857cfe51cdbe5f367dccf5a7 |
| Campaign/opcode/locale census | [#16](https://github.com/lictl/WebRA2/issues/16), [PR #20](https://github.com/lictl/WebRA2/pull/20), [review](https://github.com/lictl/WebRA2/pull/20#pullrequestreview-5154973503) | c181f43e852cef684ea85740b071f53f8612d158 |
| Census/CI handoff | [#4](https://github.com/lictl/WebRA2/issues/4), [PR #21](https://github.com/lictl/WebRA2/pull/21), [review](https://github.com/lictl/WebRA2/pull/21#pullrequestreview-5155017716) | 09b0c952c3623ac3a983def3c1e3a50a1af7129c |
| Verified source reader | [#24](https://github.com/lictl/WebRA2/issues/24), [PR #25](https://github.com/lictl/WebRA2/pull/25), [review](https://github.com/lictl/WebRA2/pull/25#pullrequestreview-5155241496) | c768c53472d6da5e6633d388da6cadeb582b6901 |
| MIX integrity policy | [#11](https://github.com/lictl/WebRA2/issues/11), [PR #26](https://github.com/lictl/WebRA2/pull/26), [review](https://github.com/lictl/WebRA2/pull/26#pullrequestreview-5155323336) | aa89abaacd83263abab505ac1ef1d540e99acd56 |
| Explicit profiles | [#22](https://github.com/lictl/WebRA2/issues/22), [PR #28](https://github.com/lictl/WebRA2/pull/28), [review](https://github.com/lictl/WebRA2/pull/28#pullrequestreview-5155420257) | bdb99040164d28f015aaa626885cb41e882f4863 |
| Structural campaign graphs | [#23](https://github.com/lictl/WebRA2/issues/23), [PR #29](https://github.com/lictl/WebRA2/pull/29), [review](https://github.com/lictl/WebRA2/pull/29#pullrequestreview-5155438898) | 9ccdf0aed07a2eeb70fde4f58da52e47ac6b3198 |
| Prior content-wave handoff | [PR #30](https://github.com/lictl/WebRA2/pull/30), [review](https://github.com/lictl/WebRA2/pull/30#pullrequestreview-5155489186) | 109977241a9bfc0468a5376ff4a74cf0ce5a0f4a |
| Verified source discovery | [#34](https://github.com/lictl/WebRA2/issues/34), [PR #35](https://github.com/lictl/WebRA2/pull/35), [review](https://github.com/lictl/WebRA2/pull/35#pullrequestreview-5155763983) | c8ebf1f63881f97ac70268535531794f9bb8c9b4 |
| Native profile/progression | [#31](https://github.com/lictl/WebRA2/issues/31), [PR #36](https://github.com/lictl/WebRA2/pull/36), [review](https://github.com/lictl/WebRA2/pull/36#pullrequestreview-5155989864) | 9c0238210b3b07a80ccd96f5716af81362252c81 |
| Locale/font coverage | [#33](https://github.com/lictl/WebRA2/issues/33), [PR #37](https://github.com/lictl/WebRA2/pull/37), [review](https://github.com/lictl/WebRA2/pull/37#pullrequestreview-5156090630) | 1c3d34e8f4641e87742769a87c23444983f26968 |
| Transitive dependency candidates | [#32](https://github.com/lictl/WebRA2/issues/32), [PR #39](https://github.com/lictl/WebRA2/pull/39), [review](https://github.com/lictl/WebRA2/pull/39#pullrequestreview-5156103573) | 223684578674763e69f790736875b165f2f1b74e |
| Four-browser cinematic presentation | [#12](https://github.com/lictl/WebRA2/issues/12), [PR #40](https://github.com/lictl/WebRA2/pull/40), [review](https://github.com/lictl/WebRA2/pull/40#pullrequestreview-5156098847) | 8867db03dbfcefcfc0bbf3004107d08d4925393a |
| Real SHP/palette proof | [#38](https://github.com/lictl/WebRA2/issues/38), [PR #41](https://github.com/lictl/WebRA2/pull/41), [implementation review](https://github.com/lictl/WebRA2/pull/41#pullrequestreview-5156299078), [native evidence review](https://github.com/lictl/WebRA2/pull/41#pullrequestreview-5156347564) | 7b94971bef70035a06057a9d16604f60f7ce0fd5 |
| M0 exit integration | [PR #42 and review](https://github.com/lictl/WebRA2/pull/42) | d590992382d1ce1526942e12b0c5dc51796da1a2 |
| Runtime CSF | [#47 / PR #48](https://github.com/lictl/WebRA2/pull/48), [review](https://github.com/lictl/WebRA2/pull/48#pullrequestreview-5156949929) | 5faa730635de01c20600d5224fccae9952b03acb |
| Synthetic simulation/save/replay | [#43 / PR #50](https://github.com/lictl/WebRA2/pull/50), [review](https://github.com/lictl/WebRA2/pull/50#pullrequestreview-5157079175) | f851660b37d4ba21af9782b4d52fe8045297b672 |
| Bounded browser inspection | [#44 / PR #51](https://github.com/lictl/WebRA2/pull/51), [review](https://github.com/lictl/WebRA2/pull/51#pullrequestreview-5157079383) | 4229951020ac9693f94fe34204c8563c05c4678a |
| Incremental source hashing | [#49 / PR #52](https://github.com/lictl/WebRA2/pull/52), [review](https://github.com/lictl/WebRA2/pull/52#pullrequestreview-5157046824) | f7159ccf4c9049cc6cf91472e19c7ae731321727 |
| Verified browser source sessions | [#53 / PR #57 and review](https://github.com/lictl/WebRA2/pull/57) | 94d57978b5b1b1734e70098fb484e7f24a618f9f |
| Map-pack LZO/LCW codecs | [#55 / PR #58](https://github.com/lictl/WebRA2/pull/58), [review](https://github.com/lictl/WebRA2/pull/58#pullrequestreview-5157261040) | 61dbf2214ea1f606c4eb058bc09995a79ceb4f13 |
| Runtime INI | [#54 / PR #60](https://github.com/lictl/WebRA2/pull/60), [review](https://github.com/lictl/WebRA2/pull/60#pullrequestreview-5157317798) | 72b38afdbfbfe160d096135b7cdc992a7c0b0649 |
| Browser task yields | [#59 / PR #63](https://github.com/lictl/WebRA2/pull/63), [review](https://github.com/lictl/WebRA2/pull/63#pullrequestreview-5157364457) | b04d619c97f3e7e46eb2980809d0d6d9d5096103 |
| Scenario terrain grids | [#61 / PR #65](https://github.com/lictl/WebRA2/pull/65), [review](https://github.com/lictl/WebRA2/pull/65#pullrequestreview-5157536685) | 050b6f3f7962972ea19f58da6a1af9409cf40029 |
| Dedicated-worker range reads | [#64 / PR #66](https://github.com/lictl/WebRA2/pull/66), [review](https://github.com/lictl/WebRA2/pull/66#pullrequestreview-5157514259) | 29aad7c898cff8e8729fd52bfddbd0ce55afa9ae |
| Profile content composition | [#62 / PR #68](https://github.com/lictl/WebRA2/pull/68), [review](https://github.com/lictl/WebRA2/pull/68#pullrequestreview-5157569762) | 8c873f8a011a7737fa4c323379082dc0c22b032a |
| Bounded member header reuse | [#69 / PR #70](https://github.com/lictl/WebRA2/pull/70), [review](https://github.com/lictl/WebRA2/pull/70#pullrequestreview-5157632074) | be96497f5efe1b18850f1879262acf4f6c72196e |
| TMP terrain decoder | [#67 / PR #73](https://github.com/lictl/WebRA2/pull/73), [review](https://github.com/lictl/WebRA2/pull/73#pullrequestreview-5157728400) | a0dde393889bb2f92ea356a19f3e3c71c2eed8b9 |
| Verified browser asset catalog | [#71 / PR #74](https://github.com/lictl/WebRA2/pull/74), [review](https://github.com/lictl/WebRA2/pull/74#pullrequestreview-5157755352) | 9457341122ed9459f00e6132a3839b45933d13fc |
| Four-browser import shell | [#27 / PR #56](https://github.com/lictl/WebRA2/pull/56), [review](https://github.com/lictl/WebRA2/pull/56#pullrequestreview-5157785291) | 41f0183ccc6d4a39162b9cbdf75f6fbc08eee0cc |
| Scenario object placements | [#72 / PR #77](https://github.com/lictl/WebRA2/pull/77), [review](https://github.com/lictl/WebRA2/pull/77#pullrequestreview-5157870528) | 4b0e30b9558cbfe0395e09ab3cfd42ed456db330 |
| Browser build and localhost launcher | [#45 / PR #46](https://github.com/lictl/WebRA2/pull/46), [review](https://github.com/lictl/WebRA2/pull/46#pullrequestreview-5157905738) | 71f46269c8f779764e6b736c3ecc69de3c2c53e2 |
| Selected-frame runtime SHP | [#78 / PR #80](https://github.com/lictl/WebRA2/pull/80), [review](https://github.com/lictl/WebRA2/pull/80#pullrequestreview-5158136475) | f18e25b75f689851efa4b9b02cf7048299b7e8ab |
| Theater tile candidate mapping | [#76 / PR #81](https://github.com/lictl/WebRA2/pull/81), [review](https://github.com/lictl/WebRA2/pull/81#pullrequestreview-5158152506) | 7fe3459fb4242e2df144bab7c582864e7fe106ab |
| Catalog-to-profile loading | [#79 / PR #84](https://github.com/lictl/WebRA2/pull/84), [review](https://github.com/lictl/WebRA2/pull/84#pullrequestreview-5158255110) | 4a2ab46fc945486fb4ae4ed80ed9470ba9159479 |
| Scenario logic compilation | [#82 / PR #87](https://github.com/lictl/WebRA2/pull/87), [review](https://github.com/lictl/WebRA2/pull/87#pullrequestreview-5158394712) | fd28eb974a82bd40798e6d13756f44f00e6ec7c0 |
| Verified terrain preparation | [#86 / PR #89](https://github.com/lictl/WebRA2/pull/89), [review](https://github.com/lictl/WebRA2/pull/89#pullrequestreview-5158520499) | 78d31e423cbbe16bce1bbae1bebe96762ecc47bb |
| Original practice/save UI | [#75 / PR #85](https://github.com/lictl/WebRA2/pull/85), [review](https://github.com/lictl/WebRA2/pull/85#pullrequestreview-5158554385) | 2d5b012e02d6d1fe45e0d5323e2a2eb00fb5a235 |
| CPU terrain scene | [#83 / PR #88](https://github.com/lictl/WebRA2/pull/88), [review](https://github.com/lictl/WebRA2/pull/88#pullrequestreview-5158554593) | efecb03d9a494826996e8ce4256200a13e1b3454 |
| Structural object binding | [#93 / PR #96 and review](https://github.com/lictl/WebRA2/pull/96) | 2cd4b9e07560fa7aa8a0da6000f5ca0f56d5b881 |
| VXL/HVA decoding | [#90 / PR #97 and review](https://github.com/lictl/WebRA2/pull/97) | 47e6cb0fe251ca2ac32b7beab6e6bad8d0e4f61f |
| Bounded mission trigger runtime | [#91 / PR #98 and review](https://github.com/lictl/WebRA2/pull/98) | d9bb13b478cf261a6bdd167a5cc3235121d84179 |
| Four-browser terrain viewport | [#92 / PR #95 and reviews](https://github.com/lictl/WebRA2/pull/95) | 524754571beaa13be9cdaa1ed5e662919dfff9d4 |
| SHP sprite layer | [#99 / PR #102 and scoped reviews](https://github.com/lictl/WebRA2/pull/102) | f22c8b33f7f608b8021ab65234600c6efe126be4 |
| Native scenario construction | [#94 / PR #105 and reviews](https://github.com/lictl/WebRA2/pull/105) | c0049272a6bd3a9f9ec92db1443988a7d908f1f8 |
| SHP compression byte/auxiliary fields | [#104 / PR #108 and review](https://github.com/lictl/WebRA2/pull/108) | f822914b44d19c9ec9b7832ae761b2d1f71f77bc |
| Exact retained INI source view | [#103 / PR #109 and review](https://github.com/lictl/WebRA2/pull/109) | 4f4e1c92fe58e41316fa3b03dabfb3f195859c56 |

| Verified placed-object artwork | [#100 / PR #106](https://github.com/lictl/WebRA2/pull/106), [review](https://github.com/lictl/WebRA2/pull/106#pullrequestreview-5159608146) | 7d9b0b7b8860d77ae03a17ee3989f55dc07b0746 |

## Remaining work and exact next action

Finish #110 exact staged artwork/native evidence review. The new policy passes
15 focused artwork/resource tests and the complete private source/pixel comparison
for both openings. Policy-2 source/field metadata changes while selected assets
remain 107/131 SHPs and 3/2 palettes; 10/5 voxel types remain explicit. All 2,578,276
selected pixels match. Private scripts/reports are under `local/native-art/`;
prior #100 evidence remains `local/object-art/`. Profile content policy2 exposes
source views and incorporates the adopted consumer policies in its fingerprints.
See [the artwork report](object-art.md) for exact scope and projection hashes.

Merged #94's staged registry/property/country/house/placement model passed 444 tests
and independent raw-source/native-range checks. The private oracle reproduces all
811/570 placements, but modeled allocation order is not complete native runtime
indices or implemented statistics. Merged #103 PR #109 exposes exact source occurrences
and extracts construction's repeated walk without changing its private hashes.
#110 now migrates artwork; #113 will compile typed native entity fields. General
RuntimeIni remains ASCII-case-folded. Neither a resolved ID nor a typed outcome
request is an executable mission. The merged #91 interpreter supports bounded
timer/flag and trigger controls; teams, scripts, object conditions and many actions
remain.

#101 replaces repeated cinematic restarts with a narrow retained FFmpeg decoder.
Its exact source/toolchain/build configuration and native sample oracle must be
reviewed before adoption, followed by actual four-browser playback and source/queue
memory evidence. The private original 72-second decode currently reads input once;
that component observation does not close campaign playback #12.

Merged #92 terrain UI passed actual four-browser file import, rendering, pan/zoom,
picking, cancellation/retry and locale checks. The exact tested source/build hashes
and scope are in [the viewport report](terrain-viewport.md). Safari observations
remain slower and timing includes tool scheduling. An old Edge process displayed
stale paint; a normal quit/relaunch resolved it with no security/settings changes.
Merged #99 sprite atlas/compositor passed 444 tests at its integrated head and an
independent private comparison of 84,925 selected indices and 725,000 combined
color/depth/pick pixels. Its anchors/remaps/depth remain explicit caller policies.

Next integration connects verified artwork and native object definitions to the
browser scene, then entity movement/occupancy/combat and mission logic. Preserve
unsupported semantics visibly while implementing their behavior; do not bypass
unknown actions or hardcode a mission path to claim a campaign. The original
practice scenarios remain separately playable with saves/replays.

[#18](https://github.com/lictl/WebRA2/issues/18) retains full content/runtime closure;
[#12](https://github.com/lictl/WebRA2/issues/12) retains campaign cinematics;
[#11](https://github.com/lictl/WebRA2/issues/11) retains two movie checksum causes.
No essential human input is currently needed. Continue through accepted milestones;
completion of a worker wave or a rendered map is not a stopping point.

For final integration PRs, verify merge SHAs live. Record a PR's own final merge SHA
in GitHub until the next substantive handoff update, avoiding metadata-only cycles.
