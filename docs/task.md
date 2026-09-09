# Current task and refreshed-session handoff

State: **COMPLETE — M0 evidence and feasibility.** Final integration
[PR #42](https://github.com/lictl/WebRA2/pull/42) is based on reviewed main
`7b94971bef70035a06057a9d16604f60f7ce0fd5` (sprite PR #41). Consult PR #42 for its
exact-head review, hosted checks and merge SHA. The owner asked to stop at M0 or
essential human input; no essential human input was needed. Inspector #27 remains
queued. Do not start it without a new continuation request.

Read [M0 exit evidence](analysis/m0-exit.md), [decisions](decisions.md),
[reference profiles/budgets](adr/0002-reference-profiles-and-initial-budgets.md), then
the focused component report. M0 completion means an evidence baseline; no gameplay,
full renderer, mission interpreter, simulation save runtime or multiplayer exists.

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

No implementation assignment remains active after the final integration merge.
Coordinator owns shared configuration/lock/contracts/licensing and this handoff.
All worker implementations are committed and independently reviewed; merged
checkouts stay preserved. The sprite diagnostic server on port 8766 is stopped.
Check current app/server state before reusing browser UI in a future slice.

| Role | Current or preserved work | Branch / private worktree |
| --- | --- | --- |
| Coordinator | M0 integration PR #42 complete; look up final merge live | `codex/4-m0-exit`, repository root |
| browser_feasibility | #38 / PR #41 sprite proof and media #40 merged | `codex/38-sprite-sample`, `local/worktrees/sprite`; media checkpoint `local/worktrees/media-presentation` |
| mix_reader | #31 merged; native font and sprite-palette pairing research complete; implementation and review complete | `codex/31-native-profile-evidence`, `local/worktrees/native-profiles` |
| bootstrap_review | #32 merged; independently reviewed #40 and audited M0 gates; final integration reviewer | `codex/32-dependency-closure`, `local/worktrees/dependencies` |

Earlier `local/worktrees/{mix,specs,browser,campaign,checksum,profiles,graph}` and
review checkouts remain preserved. Use `git worktree list` before selecting a new
branch/worktree. Never stage a private dependency symlink as node_modules; use
`npm ci` in the checkout. There are at most four active agents including coordinator.

## Evidence and checks

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
| M0 exit integration | [#4](https://github.com/lictl/WebRA2/issues/4), [#33](https://github.com/lictl/WebRA2/issues/33), [PR #42 and its exact-head review](https://github.com/lictl/WebRA2/pull/42) | Look up PR #42 merge SHA live |

## Remaining work and exact next action

M0 exit, reference selections, the 38-mission ledger, budgets, compatibility matrix
and component notices are integrated. Independent audit found no additional
essential M0 implementation or human-input gate. Stop at the requested milestone. [#27](https://github.com/lictl/WebRA2/issues/27)
is the next queued implementation slice: a browser asset inspector with explicit
profiles, on-device import, progress/cancel, provenance and missing/unsupported
content diagnostics. Assign exclusive paths and record any build dependency choice
before starting it on a new authorized continuation. It is not a playable mission.
The deterministic synthetic foundation follows within M1.

[#18](https://github.com/lictl/WebRA2/issues/18) retains full effective-content,
packed/opcode/default and locale behavior work; [#12](https://github.com/lictl/WebRA2/issues/12)
retains persistent cinematic decoding and campaign release evidence; [#11](https://github.com/lictl/WebRA2/issues/11)
retains mismatch-cause investigation. Original comparison recipes exist and no
observation is needed now. Full runtime dependencies, minimal asset subsets, native
branch/defeat/save behavior, fonts/voice/subtitles and universal mod/theater order
must remain unverified until implemented and tested.

For the final integration PR, look up its merge SHA live; do not create an endless
commit whose only purpose is recording its own merge SHA.
