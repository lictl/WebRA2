# Current task and refreshed-session handoff

State: **WORKING** — M0 evidence and feasibility; first implementation wave merged,
campaign/opcode/locale census active. Date: 2026-09-09.
The owner accepted the plan and authorized commits, GitHub issues/PRs/reviews/merges,
autonomous blocker resolution and implementation. This is not a playable engine yet.

## Product decisions

Read `docs/decisions.md` (D01–D16). Both RA2/YR campaigns, cinematics, WebRA2 saves,
installed playable locales (Steam Traditional Chinese reference), browser-local
assets/localhost, desktop Chrome/Edge/Firefox/Safari, vanilla mods first, TypeScript
and vetted GPL reuse. One coordinator plus three workers; original save import is
best effort. Owner can provide original-game observations when actually needed.

## GitHub history

All reviews below are independent agent COMMENT reviews under the shared `lictl`
account, not approvals from separate GitHub identities. Each merge matched the
reviewed head. Current integrated main before this documentation slice: `762d6aa`.

| Work | Issue / PR / final review | Merge SHA |
| --- | --- | --- |
| Planning bootstrap | [#1](https://github.com/lictl/WebRA2/issues/1), [PR #3](https://github.com/lictl/WebRA2/pull/3), [review](https://github.com/lictl/WebRA2/pull/3#pullrequestreview-5154276388) | bf241241e44d369d74662b01ccbf6e9b23d24a9f |
| Toolchain/contracts | [#8](https://github.com/lictl/WebRA2/issues/8), [PR #13](https://github.com/lictl/WebRA2/pull/13), [review](https://github.com/lictl/WebRA2/pull/13#pullrequestreview-5154505853) | fe5978ff6a0844e163e924784851b08276064f92 |
| Behavior/reference specs | [#6](https://github.com/lictl/WebRA2/issues/6), [PR #9](https://github.com/lictl/WebRA2/pull/9), [review](https://github.com/lictl/WebRA2/pull/9#pullrequestreview-5154529411) | 4d586cd45726194ba30fd5fae03edb2b06a9491b |
| Browser/media diagnostics | [#7](https://github.com/lictl/WebRA2/issues/7), [PR #15](https://github.com/lictl/WebRA2/pull/15), [review](https://github.com/lictl/WebRA2/pull/15#pullrequestreview-5154539016) | bcf9b7b7ff3772c7382b826bfe7a46274a605a70 |
| MIX reader/census | [#5](https://github.com/lictl/WebRA2/issues/5), [PR #14](https://github.com/lictl/WebRA2/pull/14), [review](https://github.com/lictl/WebRA2/pull/14#pullrequestreview-5154566975) | 762d6aa6de0ea7c79a3ce0194cf823374764b414 |

Reviewed heads respectively: `c2910ea1f3eb0b90bd095903fea3e28b2b4996da`,
`4c139f3b9c7e92d475f13047b0a8913b891704de`,
`3319b2a0d9251689253277c3ec7ddbee9e5df777`,
`76312b730893b0e67e2a332da33ae3f8e29c7985`,
`08cd33e60e51a0326888155517ff026fbeffab36`.
Issues #1/#5/#6/#7 are closed. #8 retains the hosted CI gate tracked in #10.
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

## Active ownership

- Coordinator: `codex/4-m0-integration`, shared docs/config/contracts and merge gates.
- Worker `bootstrap_review`: [campaign census #16](https://github.com/lictl/WebRA2/issues/16),
  branch `codex/16-campaign-census`, worktree `local/worktrees/campaign`, based on
  merged MIX/specs. Owns `packages/content/`, `tests/content/`,
  `tools/analysis/campaign-*`, `docs/analysis/campaign-*` and `docs/analysis/locale-*`.
  Implement bounded INI/CSF metadata analysis, source-preserving mission candidates,
  event/action/script census and locale evidence; do not infer winning precedence.
- Workers `mix_reader` and `browser_feasibility`: first-wave implementations/reviews
  complete; available for bounded independent review. Their original worktrees
  `local/worktrees/mix`, `specs` and `browser` remain; do not overwrite them.

Private corpus is `/Users/lucus/Projects/WebRA2/game`; workers read it in place.
Only the coordinator edits root configuration, lockfiles, contracts and this handoff.
Check live GitHub/agent state before duplicating a task after refresh.

## Implemented evidence and validation

Node 24.20.0, TypeScript 7.0.2, tsx 4.23.13, node:test, locked npm dependencies.
On this host the ignored Node installation is
`local/toolchain/node_modules/node/bin`; the user's global Node remains unchanged.
Use `.nvmrc` in new environments, then `npm ci` and `npm run check`.
Focused tests: `node tools/run-tests.mjs tests/<area>`.

- Integrated first wave: **34 public synthetic tests pass**, strict type checking,
  Markdown local-link validation, publication-path checks and `git diff --check`.
  Contract review fixed retimed duplicate command identity and lossy Array subclass
  serialization. MIX review fixed short signature probing and short named archives.
- `packages/contracts/`: validated finite JSON command payloads, duplicate-safe batch
  ordering, save/replay/evidence types. Tick/RNG/state-hash behavior and save runtime
  remain unimplemented; abstract probes in `docs/specs/` are not executed engine tests.
- `packages/formats/` and [MIX report](analysis/mix-reader.md): bounded classic,
  flagged and encrypted indexes, nested sources and candidate hash resolution.
  Private census: 69 top-level / 117 total archives, 83 encrypted, 13,814 members,
  629 candidate-name resolutions, 13,185 unknown names. All indexes structurally
  decoded; 101 of 103 flagged checksum payloads matched. Repeat census reproduced
  the committed metadata byte-for-byte. Two movie archives remain under investigation.
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
manual review remains necessary. GPL MIX provenance and combined distribution terms
are explicit in [licensing](licensing.md), preserving MIT for separable original work.

## Open issues and human involvement

| Issue | Impact and next action |
| --- | --- |
| [#10: CI access](https://github.com/lictl/WebRA2/issues/10) | CLI credential lacks `workflow` scope; GitHub integration also returned 403. Reviewed workflow design is preserved in `docs/ci/public-checks.yml.example`; local checks continue. Owner was asked to authorize `gh auth refresh -h github.com -s workflow` for `lictl`. Once access exists, activate through a reviewed PR and verify a real hosted run; do not claim CI passes before then. |
| [#11: movie MIX checksums](https://github.com/lictl/WebRA2/issues/11) | Two stored/payload SHA-1 mismatches reproduced independently; cause and tolerant/strict import policy unresolved. Structural reads succeed; do not label the installation corrupt without evidence. Agent investigation can continue without owner action. |
| [#12: media/browser evidence](https://github.com/lictl/WebRA2/issues/12) | Full cinematic A/V/subtitle/seek path, realistic large inputs/peak memory, actual Edge and Firefox codec evidence, real visual assets and full import/storage recovery remain. No immediate owner action required. |

All initial product questions are answered. Ask the owner only for necessary missing
access, an essential decision or an original-game comparison agents cannot obtain.

## Next bounded actions

1. Finish #16; commit and open a linked PR, inspect metadata publication boundaries,
   independently review the actual head, run synthetic and private census checks,
   then merge the reviewed revision. Record actual PR/review/merge links here or in #4
   if this handoff PR has already merged.
2. Use mission/locale candidates to define the next effective-profile/override and
   first RA2/YR dependency-closure investigation. Keep unresolved names and semantics
   explicit; static parsing alone cannot choose patch precedence or prove behavior.
3. Progress #11/#12 independently and activate CI only when #10 access is available.
4. Reassess the M0 exit criteria in `docs/plan.md`: effective manifests/dependency graph,
   unsupported format/opcode inventory, media path, dependency decisions, first mission
   selection and reference comparison plan. M0 remains open; M1–M8 are not complete.

Commit coherent slices and preserve issue → PR → independent review → merge history.
Do not manufacture follow-up documentation commits solely to insert their own merge SHA;
GitHub records the final merge, and the next ordinary handoff update can incorporate it.
