# Current task and refreshed-session handoff

State: **WORKING** — M0 evidence and feasibility, first implementation wave.
Date: 2026-09-09. The owner accepted the plan and authorized commits, GitHub
issues/PRs/reviews/merges, autonomous blocker resolution and implementation.

## Product decisions

Read `docs/decisions.md` (D01–D16). Both RA2/YR campaigns, cinematics, WebRA2 saves,
installed playable locales (Steam Traditional Chinese reference), browser-local
assets/localhost, desktop Chrome/Edge/Firefox/Safari, vanilla mods first, TypeScript
and vetted GPL reuse. One coordinator plus three workers; original save import is
best effort. Owner can provide original-game observations when actually needed.

## GitHub history

| Work | Issue / PR / review | Status |
| --- | --- | --- |
| Planning bootstrap | [#1](https://github.com/lictl/WebRA2/issues/1), [PR #3](https://github.com/lictl/WebRA2/pull/3), [review](https://github.com/lictl/WebRA2/pull/3#pullrequestreview-5154276388) | Merged bf241241e44d369d74662b01ccbf6e9b23d24a9f; reviewed head c2910ea1f3eb0b90bd095903fea3e28b2b4996da |
| Git credential mismatch | [#2](https://github.com/lictl/WebRA2/issues/2) | Resolved without human input; gh login lictl has access, osxkeychain used another account |
| Hosted CI activation | [#10](https://github.com/lictl/WebRA2/issues/10) | CLI token lacks workflow scope; preserve template and run checks locally while evaluating authorized integration |
| M0 tracker | [#4](https://github.com/lictl/WebRA2/issues/4) | Open; full exit criteria not yet complete |
| MIX reader/census | [#5](https://github.com/lictl/WebRA2/issues/5) | Worker mix_reader, codex/5-mix-reader, PR pending |
| Behavior/reference specs | [#6](https://github.com/lictl/WebRA2/issues/6) | Worker bootstrap_review reassigned to specs, codex/6-behavior-specs, PR pending |
| Browser/media probe | [#7](https://github.com/lictl/WebRA2/issues/7) | Worker browser_feasibility, codex/7-browser-feasibility, PR pending |
| Toolchain/contracts | [#8](https://github.com/lictl/WebRA2/issues/8) | Coordinator, codex/8-foundation, PR pending |

Use per-command Git credentials if the host keychain selects the wrong account:

```sh
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
```

Do not change global credentials or expose tokens. GitHub work uses `gh` or the
integration; each genuine blocker needs a linked issue with evidence/attempts.

## Active ownership and worktrees

Coordinator owns root configuration/lockfiles, `packages/contracts/`, CI and shared
docs. Workers own their issue-assigned paths, in `local/worktrees/mix`, `specs`, and
`browser`. These are ignored isolated Git worktrees based on the merged bootstrap.
They read the original `/Users/lucus/Projects/WebRA2/game` only; no copy is required.
Independent agent reviews and coordinator merges remain mandatory. Do not merge
another worker's changes or mutate their files without coordination.

## Foundation and validation

Node 24.20.0, TypeScript 7.0.2, tsx 4.23.13, node:test, locked npm dependencies.
Local Node 24 is under ignored `local/toolchain/node_modules/node/bin`; the user's
global Node was left unchanged. Use `.nvmrc` in new environments, then `npm ci` and
`npm run check`. Focused tests: `node tools/run-tests.mjs tests/<area>`.

The foundation adds command validation/order and save/replay/evidence types;
original tick/RNG/phase semantics and actual save loading remain unimplemented.
Six public contract tests passed before the final publication/CI pass. Record PR
and subsequent validation/review results as the wave finishes. The CI template uses
synthetic fixtures only, pinned actions and read-only permission; activation is
tracked in #10, and local results are not reported as remote CI passes. The publication
guard checks paths/extensions, not arbitrary payload provenance; manual review is
still needed. GPL MIX provenance and combined distribution requirements are explicit
in `docs/licensing.md`, preserving MIT terms for original separable material.

Initial triage remains reproducible: 438 files, 1,961,556,205 bytes, 69 top-level
archives, 66 encrypted index flags. Its metadata snapshot was independently
reproduced in PR #3 review; eight synthetic header checks, 24 links and whitespace
passed. Raw map section counts are not unique mission counts. No original game
binary was run and no retail assets/private evidence were published.

## Next bounded actions

1. Finish, commit and independently review each M0 PR; match reviewed heads on merge.
2. Integrate root toolchain before validating dependent worker branches on main.
3. Run the MIX reader against synthetic vectors and the private local corpus; record
   unresolved names/checksums/nested archives. Use member boundaries for later census.
4. Integrate behavior specs and measured browser reports. Open linked issues for
   real-codec or unavailable-browser evidence gaps; do not claim static research as
   a passing browser test or solicit human input for routine implementation choices.
5. Update #4 and this handoff with actual PR/review/merge links, results and remaining
   M0 criteria. Do not close M0 merely because its first PRs merged. Continue the next
   dependent M0 slice once its inputs are available; M1–M8 gates remain in the plan.

## Remaining evidence

Effective Steam build/patch precedence, complete playable locale/mission manifests,
verified encrypted/nested index decode, actual original trigger/AI semantics,
measured cinematic browser path, full four-browser evidence, memory/performance
budgets and native save feasibility. These are tracked M0/later research tasks,
not unanswered initial product questions.
