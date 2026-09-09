# Current task and refreshed-session handoff

State: **COMPLETE** for the current bounded content wave on 2026-09-09.
M0 remains **WORKING**. Source verification #24, integrity policy #11, explicit
profiles #22 and structural campaign graphs #23 are merged. Integrated code main
is `9ccdf0aed07a2eeb70fde4f58da52e47ac6b3198` before this handoff PR.
The owner authorized implementation, coherent commits, GitHub issues/PRs/reviews/
merges and autonomous blocker resolution. No playable game app exists yet.
The exact next bounded product slice is [#27](https://github.com/lictl/WebRA2/issues/27),
the on-device installation/asset inspector; its implementation has not started.

## Product decisions

Read `docs/decisions.md` (D01–D16). Both RA2/YR campaigns, cinematics, WebRA2 saves,
installed playable locales (Steam Traditional Chinese reference), browser-local
assets/localhost, desktop Chrome/Edge/Firefox/Safari, vanilla mods first, TypeScript
and vetted GPL reuse. One coordinator plus three workers; original save import is
best effort. Owner can provide original-game observations when actually needed.

## GitHub history

All reviews below are independent agent COMMENT reviews under the shared `lictl`
account, not approvals from separate GitHub identities. Each merge matched the
reviewed head. Check live GitHub for the final documentation merge of this wave;
it must not create an endless commit solely to record its own merge SHA.

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

Reviewed heads respectively: `c2910ea1f3eb0b90bd095903fea3e28b2b4996da`,
`4c139f3b9c7e92d475f13047b0a8913b891704de`,
`3319b2a0d9251689253277c3ec7ddbee9e5df777`,
`76312b730893b0e67e2a332da33ae3f8e29c7985`,
`08cd33e60e51a0326888155517ff026fbeffab36`,
`84fd571b31b6799db5404917b5e5c032f672f6ac`,
`342ba90220fcb463c38431577143130cdbb8d132`,
`6dca4543e03c10ff353fcee2b3f2691eeb3911c4`,
`1bd4c7109f5a76a644c8aaf4309978c08170356d`,
`d0f4345a2744caac0bd12376239e5a95fd3d8384`,
`559976d37c505d890052ca930b2826d96a70db6e`,
`0eefe49071ae7efdc164f65877cc820527dc1ea3`,
`3af48f833e87aca65e817baf63fe1001dc32c255`.
Issues #1/#5/#6/#7/#8/#10/#16/#22/#23/#24 are closed.
The [M0 tracker #4](https://github.com/lictl/WebRA2/issues/4) remains open.

The Git credential mismatch [#2](https://github.com/lictl/WebRA2/issues/2) was resolved
without human input: `gh` login `lictl` has access; the host keychain selected another
account. Use a per-command helper for Git network operations when needed:

```sh
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
```

Do not change global credentials or expose tokens. Use `gh` or the integration for
GitHub work. Do not push all local branches: `codex/8-foundation-ci-local` preserves
an unpublished historical workflow attempt; it is not the reviewed foundation branch.

## Preserved ownership and checkouts

The current implementation wave is complete. Workers have clean preserved checkouts;
there is no pending implementation assignment. Coordinator integration is on
`codex/18-content-integration`, owning the shared handoff/README/compatibility/license
mapping changes and their review/merge. Check live GitHub before duplicating work.

| Role | Completed scope | Branch / worktree |
| --- | --- | --- |
| Coordinator | #24 verified Node source reader, shared integration and merge gates | `codex/24-verified-source-reader`; integration branch above |
| `browser_feasibility` | #22 pure VFS/profile resolver and metadata projection | `codex/22-profile-resolver`, `local/worktrees/profiles` |
| `bootstrap_review` | #23 structural campaign graph/tables and verified CLI | `codex/23-campaign-graph`, `local/worktrees/graph` |
| `mix_reader` | #11 integrity policy/domain investigation; independent #25/#28 reviews | `codex/11-checksum-policy`, `local/worktrees/checksum` |

Earlier `local/worktrees/{mix,specs,browser,campaign}` and detached review checkouts
remain preserved. Never stage a private dependency symlink as `node_modules`;
prefer `npm ci` in the worktree or explicit path staging. Create fresh scoped paths
for the next wave, and reassign ownership before edits. Only the coordinator changes
root configuration, locks, contracts and this handoff. The four-agent limit persists.

Private corpus is `/Users/lucus/Projects/WebRA2/game`; workers read it in place.
Keep private outputs in ignored `local/` and never execute bundled game programs.

## Implemented evidence and validation

Node 24.20.0, TypeScript 7.0.2, tsx 4.23.13, node:test, locked npm dependencies.
On this host the ignored Node installation is
`local/toolchain/node_modules/node/bin`; the user's global Node remains unchanged.
Use `.nvmrc` in new environments, then `npm ci` and `npm run check`.
Focused tests: `node tools/run-tests.mjs tests/<area>`.

- Integrated current wave: **102 public synthetic tests pass**, strict type checking,
  Markdown local-link validation, publication-path checks and `git diff --check`.
  New suites add 8 verified-reader, 10 integrity, 18 VFS and 19 graph/table/CLI tests
  to the 47-test baseline. No test is a retail campaign playthrough.
  [PR #25](https://github.com/lictl/WebRA2/actions/runs/34359627772),
  [PR #26](https://github.com/lictl/WebRA2/actions/runs/34360287465),
  [PR #28](https://github.com/lictl/WebRA2/actions/runs/34361000322) and
  [PR #29](https://github.com/lictl/WebRA2/actions/runs/34361326310) hosted checks passed.
  Earlier review fixed command identity/JSON loss, short MIX reads and false census
  completeness. This wave fixed split physical-source identity bypass in the VFS,
  inherited-schema lookup through imported prototype-shaped INI names, and unbounded
  manifest reads before checking the limit. Each has a regression test.
- [Verified Node source reader](analysis/verified-source-reader.md): full-root and
  member SHA-256, safe ranges, stable file metadata, path/symlink checks, bounded
  streaming, cached root identity and one active read. The coordinator independently
  verified both opening maps and both CSFs. It is analysis infrastructure; browser
  File handles require their own adapter.
- [MIX integrity policy](analysis/checksum-policy.md): explicit tolerant/strict policy
  with injected bounded digest adapter and required pinned-source identity. Both
  modes reject structural/source/verification failures; tolerant warns on checksum
  mismatch. Private domain analysis repeats exactly; separate Python verified all
  15 SHA-1 domains and three source identities. Five domains/byte-order variants do
  not explain the two RA2 movie trailers. #11 remains open for native cause/handling.
- [Profile resolver](analysis/profile-resolution.md): original MIT browser-capable
  metadata API with explicit ranks/profile eligibility, collision/duplicate/range
  rejection, immutable output and retained provenance/alternatives. Public metadata
  projection repeats exactly (93,984 bytes): 62 sources, 55 mounted candidates,
  seven unassigned. RA2 requests have 30 single-content hash candidates; YR has 18
  plus two ambiguous `rulesmd.ini`/`all02umd.map` entries. No literal-confirmed or
  effective native profile is claimed. Independent review verified both executable
  hashes/all eleven filename offsets and pinned editor evidence without execution.
- [Campaign graph](analysis/campaign-graph.md): pure bounded structural graph and
  campaign table census; verified CLI reads 14 members / 3,449,092 bytes. Private
  output independently reproduces the committed metadata byte-for-byte. RA2 opening
  graph has 3,006 nodes / 2,931 edges / 1,010 reachable nodes; YR has 5,046 / 9,051 /
  2,028, retaining rule alternatives. Country selectors and unclassified demo/training
  maps remain explicit. One reachable RA2 placement-type reference is unresolved.
  Native progression is unverified; full closure remains false. See the precise
  [remaining dependency edges](analysis/mission-dependencies.md) under #18.
- `packages/contracts/`: validated finite JSON command payloads, duplicate-safe batch
  ordering, save/replay/evidence types. Tick/RNG/state-hash behavior and save runtime
  remain unimplemented; abstract probes in `docs/specs/` are not executed engine tests.
- `packages/formats/` and [MIX report](analysis/mix-reader.md): bounded classic,
  flagged and encrypted indexes, nested sources and candidate hash resolution.
  Private census: 69 top-level / 117 total archives, 83 encrypted, 13,814 members,
  629 candidate-name resolutions, 13,185 unknown names. All indexes structurally
  decoded; 101 of 103 flagged checksum payloads matched. Repeat census reproduced
  the committed metadata byte-for-byte. Two movie archives remain under investigation.
- `packages/content/` and [campaign report](analysis/campaign-census.md): bounded
  byte-preserving INI/CSF and opcode scanners, verified source ranges, exact-byte
  deduplication and rule overlap metadata. Private corpus: 384 physical map records,
  368 hashes, 45 detailed candidates. Battle tables reference 24 RA2 faction filenames
  (24 hashes) and 14 YR filenames (15 hashes including an unresolved patch variant).
  Candidate event/action/script unions contain 40/67/33 RA2 IDs and 37/78/33 YR IDs;
  these are structural occurrences, not implemented or recovered behavior meanings.
  The coordinator's separate private CLI run reproduced the 876,998-byte snapshot
  exactly. Wrong/missing references, source changes and caps have synthetic coverage.
- [CSF report](analysis/locale-census.md): 4,479 RA2 and 5,211 YR labels/strings,
  raw language field 9, with 3/0 case-folded duplicate labels. A separate Python
  parser verified hashes/counts/Han code units at exact archive offsets. No translated
  strings were emitted; playable-locale status remains unverified in #18.
- [Browser report](analysis/browser-feasibility.md): Chrome 152, Firefox 151 and
  Safari 26.6.2 measured on the recorded Mac; bounded 62.75 MiB synthetic file read,
  OPFS/IndexedDB probes and synthetic CJK rendering. Edge was unavailable. This is
  diagnostic code, not a complete import/storage/launcher implementation.
- [Media report](analysis/media-feasibility.md): one 246,492-byte real Bink member,
  41 frames plus stereo audio, decoded to null by FFmpeg WASM in actual Chrome and
  Safari. This does not prove presentation, A/V synchronization, long-video memory
  or Firefox/Edge playback. Private research WASM/sample files remain in `local/`;
  no production codec bundle was adopted.
- Initial triage: 438 files / 1,961,556,205 bytes, metadata-only snapshot independently
  reproduced in PR #3. Raw section counts are not unique campaign mission counts.
  No bundled game program was run and no game payload/private recording was published.

The publication guard checks tracked paths/extensions, not arbitrary payload provenance;
manual review remains necessary. GPL MIX/content provenance and combined distribution terms
are explicit in [licensing](licensing.md), preserving MIT for separable original work.

## Open issues and human involvement

| Issue | Impact and next action |
| --- | --- |
| [#11: movie MIX checksums](https://github.com/lictl/WebRA2/issues/11) | Explicit tolerant/strict policy is merged in PR #26. Five candidate hash domains and byte-order variants do not explain the two mismatches. Native cause/runtime handling remains unresolved; preserve unchanged source identities. No immediate owner action. |
| [#12: media/browser evidence](https://github.com/lictl/WebRA2/issues/12) | Full cinematic A/V/subtitle/seek path, realistic large inputs/peak memory, actual Edge and Firefox codec evidence, real visual assets and full import/storage recovery remain. No immediate owner action required. |
| [#18: effective content](https://github.com/lictl/WebRA2/issues/18) | Resolve RA2/YR patch/loose/profile precedence, effective campaign progression/dependencies and playable locales using #16 candidates. Profile/graph primitives now support this investigation; native selection, full dependency closure and playable locales remain. No immediate owner action required. |

The next product slice is [#27: on-device asset inspector](https://github.com/lictl/WebRA2/issues/27),
queued with concrete acceptance criteria. It does not depend on claiming M0 complete.

CI access [#10](https://github.com/lictl/WebRA2/issues/10) is **resolved** through the
already authorized GitHub browser session. Both the
[PR run](https://github.com/lictl/WebRA2/actions/runs/34356060476) and
[merged-main run](https://github.com/lictl/WebRA2/actions/runs/34356266462) passed.
The earlier requested `gh auth refresh` is no longer needed for this activation;
no credential scopes or repository rules were changed. Future workflow writes can
use that authorized UI route if CLI credentials still lack workflow scope.

All initial product questions are answered. Ask the owner only for necessary missing
access, an essential decision or an original-game comparison agents cannot obtain.

## Next bounded actions

1. Start [#27: browser asset inspector](https://github.com/lictl/WebRA2/issues/27)
   on a fresh branch/worktree and assign exclusive paths. Implement a real on-device
   file/folder import surface over the merged readers/resolver, explicit RA2/YR
   selection, progress/cancel and accurate checksum/ambiguity diagnostics. Establish
   root build dependencies through a short pinned decision. Use English and
   Traditional Chinese shell labels and browser network evidence for no asset upload.
   This is inspection, not gameplay; it is queued until the next implementation slice.
2. Continue [#18](https://github.com/lictl/WebRA2/issues/18) alongside that product work:
   full first-mission dependency edges, effective patch/loose/theater/language policy,
   country-to-house binding and playable locales. Preserve ambiguous `all02umd.map`
   and `rulesmd.ini`, unselected `sov09t.map`, unnamed `MAPS02.MIX/#6:b7ce3f39`,
   unclassified demo/training maps and legacy `Basic/NextScenario` references.
   `all01t.map` / `all01umd.map` remain source-pinned opening candidates; their graphs
   are over-approximations, not selected fully playable slices.
3. Progress [#12](https://github.com/lictl/WebRA2/issues/12) with actual cinematic
   presentation/A/V sync and realistic memory in the remaining browsers. #11 policy
   no longer blocks ordinary tolerant inspection; native checksum cause remains a
   separate evidence question. Request narrow original-game observations only when
   agents cannot resolve a required comparison themselves.
4. Reassess M0 exit criteria in `docs/plan.md`: effective manifests/dependency closure,
   unsupported format/opcode inventory, media path, dependency decisions, first
   mission selection and reference comparison plan. M0 remains open; M1–M8 are
   not complete, and the tick/RNG/save runtime is still unimplemented.

Commit coherent slices and preserve issue → PR → independent review → merge history.
Do not manufacture follow-up documentation commits solely to insert their own merge SHA;
GitHub records the final merge, and the next ordinary handoff update can incorporate it.
