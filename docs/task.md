# Current task and refreshed-session handoff

State: **WORKING — M2 presentation and M3 gameplay foundations.** The owner
now authorizes continuing toward a fully playable UI and original RA2/YR campaigns
until essential human input is needed. This supersedes the previous M0 stopping
point. M0 integration [PR #42](https://github.com/lictl/WebRA2/pull/42) merged as
`d590992382d1ce1526942e12b0c5dc51796da1a2`; its evidence remains the baseline.
The import shell [PR #56](https://github.com/lictl/WebRA2/pull/56), localhost
build [PR #46](https://github.com/lictl/WebRA2/pull/46), and original practice/save
UI [PR #85](https://github.com/lictl/WebRA2/pull/85) have merged after their recorded
reviews and browser acceptance. Verified profile loading, terrain preparation and
CPU composition are also merged. Both opening terrains now render in actual desktop Chrome, Edge, Firefox and Safari.
Placed artwork, typed entities and flat terrain traversal are merged. Current work
connects authoritative movement and save/replay to the browser, then combat and
mission behavior. No original mission is playable yet.

Current wave: coordinator [numerical world integration #164](https://github.com/lictl/WebRA2/issues/164)
and [actor modifiers and firing/death #147](https://github.com/lictl/WebRA2/issues/147),
continuing [authoritative combat #132](https://github.com/lictl/WebRA2/issues/132) after the
reviewed [core/source-preparation checkpoint PR137](https://github.com/lictl/WebRA2/pull/137);
browser agent implements fresh actor and standing-fire source/scheduler facts under147 after reviewed162;
format agent implements [ordinary infantry death #163](https://github.com/lictl/WebRA2/issues/163)
after merged death prerequisites155;
simulation agent [source team activation/spawning #160](https://github.com/lictl/WebRA2/issues/160),
after the reviewed [team runtime PR158](https://github.com/lictl/WebRA2/pull/158).
The owner unlocked the Mac and the browser tool confirms access. Per the new D17
priority, use Chrome for development acceptance and defer full Firefox/Edge/Safari
end-to-end checks until the remaining implementation is finished. No essential
human input is currently needed. Finish reviewed slices and continue through
the accepted milestones; do not stop merely because a worker wave merges.

Recent reviewed merges:

| Component | PR / merge SHA | Exact-head evidence |
| --- | --- | --- |
| Veteran/elite ability selection | [162](https://github.com/lictl/WebRA2/pull/162), `7512b6707a337a7ca3bab0b46fc18dc7253dd6d2` | 827 checks; [independent review](https://github.com/lictl/WebRA2/pull/162#pullrequestreview-5163054208); 67,602 private values and25 native spans; ability preparation only |
| Chrome RTS controls | [153](https://github.com/lictl/WebRA2/pull/153), `b063749b52aab1ed57a833dd991961e72daaa326` | 808 checks; independent source/final COMMENT reviews; both openings in actual Chrome, group orders and local save/replay; modifier drags synthetic only |
| Actor death prerequisites | [161](https://github.com/lictl/WebRA2/pull/161), `6f7db8cfc025c47541e9df63d9a98a7876bb7ed1` | 819 checks; [source review](https://github.com/lictl/WebRA2/pull/161#pullrequestreview-5162937715) and [integration review](https://github.com/lictl/WebRA2/pull/161#pullrequestreview-5162963777); source preparation only, ordinary execution remains163 |
| Source-bound campaign house modifiers | [159](https://github.com/lictl/WebRA2/pull/159), `8f9b4b08340dc80fa0ec4636de38cc1b2cc9cc12` | 780 checks; [independent review](https://github.com/lictl/WebRA2/pull/159#pullrequestreview-5162842856); 999 private numerical comparisons; explicit difficulty indices, preparation only |
| Existing-member team transactions | [158](https://github.com/lictl/WebRA2/pull/158), `ec904eff30b59662b19607096cf6f282ea5abb21` | 796 checks; root source review and [separate integration review](https://github.com/lictl/WebRA2/pull/158#pullrequestreview-5162862680); source move/jump, compound saves/replay; spawning remains160 |
| Native combat arithmetic | [157](https://github.com/lictl/WebRA2/pull/157), `48bb1908116166e30c01c537923977ba90a77e0c` | 772 tests; independent source and final integration COMMENT reviews on PR; numerical stages only |
| Shared group destinations | [156](https://github.com/lictl/WebRA2/pull/156), `f7ece4216bc520d889a8350407c5dabcb383e055` | 765 tests; independent source and final distribution COMMENT reviews on PR; explicit WebRA2 policy |
| Native random primitive | [154](https://github.com/lictl/WebRA2/pull/154), `a35c989b4d35f3b635de54d7c3c20dc6ef6d9130` | 759 tests; independent source and [integration review](https://github.com/lictl/WebRA2/pull/154#pullrequestreview-5162531908); explicit state only, global sequencing remains open |
| Invisible impact context | [148](https://github.com/lictl/WebRA2/pull/148), `fae39c705cdbe3d20fa78768eb4c225d18bbe962` | 733 tests; source review and [integration review](https://github.com/lictl/WebRA2/pull/148#pullrequestreview-5162400221); context only, no weapon execution |
| Animation effect closure | [150](https://github.com/lictl/WebRA2/pull/150), `7a8c5e66dde9068cd4c21ac088dcb4e496b6ff08` | 747 tests; source review and [integration review](https://github.com/lictl/WebRA2/pull/150#pullrequestreview-5162434183); ordinary effect classification only |
| Combat core/source preparation | [137](https://github.com/lictl/WebRA2/pull/137), `ebc23ead7a8553d008c017b375a5a0e6df51e93e` | 723 tests; core/capability/placement/roster and final integration COMMENT reviews on PR;132 remains open |
| Authoritative movement | [123](https://github.com/lictl/WebRA2/pull/123), `7bc2167d88a2ad6ef74ea4a41f53f3dd8b460050` | 623 tests; [review](https://github.com/lictl/WebRA2/pull/123#pullrequestreview-5160666607) |
| Native foundation masks | [129](https://github.com/lictl/WebRA2/pull/129), `a97f7b08f05afa943c1bb043713466b1e9a9cb32` | 585 tests; [review](https://github.com/lictl/WebRA2/pull/129#pullrequestreview-5160598887) |
| Typed weapon graph | [130](https://github.com/lictl/WebRA2/pull/130), `55c20f89ac2c36521bfdcd3bead4d708f5f4d4b3` | 597 tests; [review](https://github.com/lictl/WebRA2/pull/130#pullrequestreview-5160648304) |
| Selection-stable identity | [135](https://github.com/lictl/WebRA2/pull/135), `e3eb619ad97a9edff2b1469dd0e17e7e6cd50d51` | 625 tests; [review](https://github.com/lictl/WebRA2/pull/135#pullrequestreview-5161693533) |
| Voxel resource preparation | [136](https://github.com/lictl/WebRA2/pull/136), `c2e135851b4d9d08c2baaa31cdeef2420beb5c12` | 637 tests; source/private review on PR, [notice review](https://github.com/lictl/WebRA2/pull/136#pullrequestreview-5161845408) |
| Typed teams/task forces/scripts | [138](https://github.com/lictl/WebRA2/pull/138), `3bbb1821b21e0995d3be37cabc02c4c57ced583d` | 650 tests; [source review](https://github.com/lictl/WebRA2/pull/138#pullrequestreview-5161835060), [integration review](https://github.com/lictl/WebRA2/pull/138#pullrequestreview-5161911619) |
| Browser movement/checkpoints | [128](https://github.com/lictl/WebRA2/pull/128), `4ae578ec540b0c54c821e1068d83611d80684349` | 640 tests; source and final browser-evidence COMMENT reviews on PR |
| Voxel world presentation | [144](https://github.com/lictl/WebRA2/pull/144), `33519f4aae4d27b52a46a10660829d43d7aafb39` | 672 tests; exact source and final four-browser evidence COMMENT reviews on PR |
| Initial weapon spelling proof | [142](https://github.com/lictl/WebRA2/pull/142), `c9ab75a280eaed4956de0b986ac2258210527f05` | 644 tests; [review](https://github.com/lictl/WebRA2/pull/142#pullrequestreview-5162066332) |
| Combat actor initialization | [143](https://github.com/lictl/WebRA2/pull/143), `21588d19fa5d870163a6aaad38cdc40c017c9ba6` | 678 tests; source review on PR, [integration review](https://github.com/lictl/WebRA2/pull/143#pullrequestreview-5162128139) |

Issues131,133,134,139,140,141,145,146,149,151,152,155 are closed within their component scope. #127 and parent120 remain open for the Safari
automatic-running acceptance row shared with115; GitHub unexpectedly closed127
during squash, so the coordinator reopened it with the exact remaining criterion.
Both opening worlds have matching model/moving-save/replay identities in actual
Chrome, Edge, Firefox and Safari. Chrome/Edge/Firefox automatic running works;
Safari reports hidden and stays paused, while explicit steps reach the same
terminal states. Chrome full reload/reselection/restore and continuation match the
private oracle. Exports/reload were not repeated in the other families; their
local restores and cross-browser imports were checked. See the precise
[browser acceptance report](analysis/world-browser-acceptance.md).
Preserve immutable corrected server4176 and historical pre-fix4175. Policy2
traversal excludes only the session source handle from durable hashing; full
source audit metadata and integrity guards remain intact.

Voxel private review reproduced all78 frames (3,833,856 exact color/owner pixels),
full source/mount histories and33 native ranges. Preview fingerprints are
session/audit identities and must never enter world/save hashes.
Typed team review reproduced368,268 raw-source scalar leaves and55 complete
native instruction ranges/12,950 bytes. Both compilers remain data/presentation
components: no team spawning or script execution is implied.

The original [combat core](world-combat.md) is independently reviewed at
`abcdfd0008ac2ea4320080d7fa55362cd7fd41ba`:
[review](https://github.com/lictl/WebRA2/pull/137#pullrequestreview-5161789173).
Its14 original tests cover targeting, firing, exact factors, impacts/death,
atomic bounds and save/replay, plus independent generated checks. The current
reviewed capability head94a3429 adds7 source-bound direct-weapon tests and passes686
public tests; [review](https://github.com/lictl/WebRA2/pull/137#pullrequestreview-5162061487)
also reproduces26 adversarial cases and both private admission projections. The weapon admission policy
currently admits no retail weapon: review identified unverified animation-side
gameplay, so animation references now block executable admission. All other
unsupported reasons remain; original combat is not playable. Root merged the reviewed139
actor state and140 corrected weapon graph, preserving both distribution notices.
The new placement helper admits only authenticated zero-rank, ground infantry/unit
rows without follower links. The integrated root checkpoint passes709 public
tests,111docs/585links and44outputs/95inputs at7f6e34b. The later four-test
placement correction bd814f2 passes its [independent review](https://github.com/lictl/WebRA2/pull/137#pullrequestreview-5162201463). A separate raw-source oracle
check1,381 rows/9,681 scalar leaves and14 complete native ranges/3,660 bytes.
The new source-bound combat roster now joins genuine WorldContent with actor,
entity and weapon results; six tests and a private38,067-leaf composition oracle
verify1,381row joins and44/69 initial-state candidates. It remains preparation only
with canExecuteCombat=false. Its exact7cb9e42 [independent review](https://github.com/lictl/WebRA2/pull/137#pullrequestreview-5162315791)
passes716 public tests and13 additional reviewer cases, and independently reproduces
the full source preparation and raw actor/entity/composition oracles. Require145
obstruction/impact context,146 animation effects and147 source-bound actor modifiers
before enabling weapons. PR137 is a reviewed core/preparation checkpoint;132 stays
open for actual source combat and browser attack integration.
The final integration with reviewed144 passes723 public tests,112docs/592links,
408 publication paths and44outputs/105inputs; the new integration changes no
source-adapter or core implementation.
The reviewed voxel presentation and subsequent Chrome RTS controls149 are merged.
Team/script runtime and mission/world trigger integration follow these foundations.

The media component has complete long-clip playback in Chrome, Edge and Firefox;
Safari's hidden-page scheduling gap remains [#115](https://github.com/lictl/WebRA2/issues/115),
and campaign cinematic acceptance remains #12. #103 retains exact-source consumer
migrations. No original mission is playable. Build/import decisions are recorded
in [ADR 0003](adr/0003-browser-build-and-import-boundary.md).

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
| Coordinator | #164 numerical world execution; #147 integration; #160 adapter/review; shared contracts/handoff | `codex/164-ordinary-combat` at root; `codex/160-spawn-team-adapter`, `local/worktrees/spawn-team-adapter` |
| browser_feasibility | #147 source fresh actor/standing fire facts and pure scheduler; sole native UI owner | new isolated source worktree; preserved `local/reviews/combat-veterancy-162` and `local/worktrees/world-controls` |
| mix_reader | #163 ordinary human infantry death decision/lifecycle; new content source/tests/provenance | `codex/163-ordinary-death`; preserved `local/worktrees/combat-death` and `local/worktrees/native-random` |
| bootstrap_review | #160 source reinforcement context/insertion/scheduler/replay; new content and sim source/tests/provenance | `codex/160-team-spawning`, `local/worktrees/team-spawning`; preserved `local/worktrees/team-runtime` |

Voxel UI [PR144](https://github.com/lictl/WebRA2/pull/144) merged after exact-head
source and final browser-evidence review. All four actual browser families passed
both openings using explicit steps, moving tick-2 local save/Stop/restore, tick-22
source picks and exact replay, language retention, cancellation/retry and disposal.
The coordinator independently reproduced all2,457,600 voxel-over-base pixels and
verified the42-file final/frozen/HTTP manifest. Base terrain/SHP planes in that oracle
were captured inputs. See [the precise report](voxel-world-ui.md); no new Run,
file export/import, reload, timing or campaign acceptance is implied. Preserve4177.
Preview metadata and app-private terrain protocol v4 never enter gameplay identity.

Invisible impact context [PR148](https://github.com/lictl/WebRA2/pull/148) and
animation closure [PR150](https://github.com/lictl/WebRA2/pull/150) are merged.
The coordinator independently reproduced their complete native range ledgers,
source projections and extra adversarial cases. They do not authorize attacks by
themselves. Reviewed159 supplies campaign house modifiers;157 supplies numerical
stages;154 supplies the random primitive;161 supplies death prerequisites. PR162
adds source-bound veteran/elite ability selection, including the RA2 double versus
YR float rank representation. Current actor state, firing integration and world
attachment remain147/132; ordinary human infantry death execution is163.

Reviewed158 supplies existing-member source move/jump transactions. Its distinct
per-member destinations are an explicit WebRA2 formation policy; native regrouping,
Guard/acquisition and source spawning remain separate. Reviewed153 reuses the
helper for direct Chrome group orders and HUD controls, preserving atomic admission
and exact saved commands. Actual Chrome acceptance and independent private
save/replay probes passed for both openings. Shift/Alt/middle modifier drags have
synthetic coverage only. The locked-Mac blocker is resolved; no browser security or
visibility settings were changed. All source execution gates remain explicit.
The accepted preview server4174 remains immutable, alongside prior4173/media8767. The coordinator
owns navigation/world motion; the simulation worker owns typed-definition policy. New world
integration must join those policies deliberately before exposing native orders.
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
| Exact staged artwork and profile identity | [#110 / PR #114](https://github.com/lictl/WebRA2/pull/114), [review](https://github.com/lictl/WebRA2/pull/114#pullrequestreview-5159809248) | ced32189d045ab7992619d7aaed422817421e871 |
| Persistent Bink component | [#101 / PR #107 and reviews](https://github.com/lictl/WebRA2/pull/107) | 9d7d35881ca002219af9f900a29a9740e5c4420c |
| Deterministic navigation | [#116 / PR #118](https://github.com/lictl/WebRA2/pull/118), [review](https://github.com/lictl/WebRA2/pull/118#pullrequestreview-5159968036) | 612f494e8073cb4b093ec950d6e608ed9f1e3664 |
| Unlit voxel rasterizer | [#112 / PR #117 and scoped reviews](https://github.com/lictl/WebRA2/pull/117) | 14eb89b8abf004ffb9f03e5fda43186f26a5cb62 |

## Remaining work and exact next action

Navigation #116 and voxel renderer #112 have merged after independent reviews.
Finish #120 [world movement](world-movement.md), #111 actual browser artwork, #113
typed entity review and #119 terrain traversal. The first world model/motion/save/
replay core passes sixteen focused public tests, including partial-edge restores,
stable reservations, fair planning and atomic rollback. Native adapters remain in
progress; no original mission movement or combat claim follows. [Navigation](navigation.md) uses
explicit cell costs/directed edges, stable bounded A* and separate grid/query hashes;
its original synthetic oracle does not establish native traversal semantics.

Merged #110 passed 496 full tests, 15 focused artwork/resource tests, eight
independently checked native ranges and the complete private source/pixel comparison
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
#110 migrated artwork and profile policy identities; #113 compiles typed native entity fields. General
RuntimeIni remains ASCII-case-folded. Neither a resolved ID nor a typed outcome
request is an executable mission. The merged #91 interpreter supports bounded
timer/flag and trigger controls; teams, scripts, object conditions and many actions
remain.

Merged #101 replaces repeated cinematic restarts with a narrow retained FFmpeg
component. Final head passed 454 public tests, independent native/build/source
review and three full long-clip browser runs, each with 1,084 frames and no dropped
frames or PCM trimming. Final telemetry also passed Chrome RA2/silent/hash-retry
checks. The independent source rebuild matches decoded data but exact WASM byte
reproducibility is not established; measured/rebuilt hashes are retained in the
[component report](persistent-media.md). Safari authenticates/decodes/cancels but
reports hidden+focused with no animation callbacks or presentation: #115 retains
that gate. No human input is needed while software/environment diagnosis and
other gameplay work continue. Parent #12 retains campaign, synchronization,
variant/localization, attributable memory and complete release acceptance.

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

## Active continuation after PR153/161

Reviewed main is `7512b6707a337a7ca3bab0b46fc18dc7253dd6d2`. PR162's
source veterancy component passes827 checks,131docs/678links, and53 build outputs
with108 inputs. Independent review reproduces67,602 private source scalars and25
complete native spans (7,539 bytes), with no executable-combat claim. Its exact-head
review and CI passed and it is merged. Root164 now connects these numerical
primitives to the world core; source actor/firing admission147 and death163 follow.

PR153 merged Chrome acceptance at runtime
`adbd0e7b694c9d39c9e164f4a44c107dd3344713` on4178. Root independently matched
all48 tested built/frozen/HTTP artifact hashes and all51 final integration outputs.
The captured request log has19 total GETs (18 successful code/style requests and
one favicon404), with no asset endpoint or body. Private source group/save/replay
probes reproduce both openings, including the actual paused Chrome tick states;
actual interactions remain author-observed evidence. Modifier-drag combinations
are synthetic tests only; other-browser development reruns remain deferred per D17.

Issue160 owns source-defined team activation and spawning. The worker has coherent
unmerged source catalog/context and atomic insertion checkpoints261596d/2eb45f5;
root implements the existing team runtime adapter in an isolated worktree. Spawned
actors derive from source TaskForces/type definitions, use monotonic IDs and preserve
prior model descriptors and queued state. Saved retry/compound replay follows.
Do not fabricate map placements, preallocate dead actors, or skip unsupported
scripts. Seven YR opening templates admit current move/jump; RA2 needs more opcodes.
These counts do not imply mission playability. Issue163 implements the ordinary
human infantry death subset with explicit WebRA2 sequence-completion cadence;
unit/special-effect paths remain guarded. No essential human input is needed.

Root160 adapter checkpoint `ba18ae633f6b467efe287e06f312384854b36587` is
integrated in the worker tree as20e44c4 after separate worker inspection. Seven
original adapter tests and817 checks on that prototype baseline pass. The worker's
compound scheduler now covers source spawning, saved retries and pending replay;
private runs spawn all8 eligible YR action occurrences and move12 actors across
7 templates, with312 checkpoint restores and8 replay comparisons. Its final PR,
source review and distribution integration are still pending; none of this enables
an original mission yet. Root164 adds an explicit numerical core mode preserving
existing hashes, with complete explicit factors/seed and saved RNG. Follow
[the policy](ordinary-combat.md) for scope and original test evidence.
