# GitHub work and review history

The owner requires GitHub integration or `gh` CLI for issues, pull requests, reviews,
and merges. This is standing authorization for those actions within the assigned
project scope; do not ask for routine confirmation at each step. A roadmap entry
alone does not authorize starting unrelated work, deploying the app, changing
repository access/rules, or purchasing services.

Repository verified on 2026-09-09: [lictl/WebRA2](https://github.com/lictl/WebRA2),
default branch `main`. Recheck the configured remote/default branch and access when
resuming. Use whichever authorized integration/CLI supports the needed operation;
do not assume every connector exposes issue creation, review and merge tools.

## Required chain for each substantive slice

1. **Issue.** Search open and closed issues/PRs before creating anything. Create or
   reuse a work issue before implementation; include milestone/task ID, objective,
   acceptance criteria, dependencies, write ownership, evidence requirements and
   scope exclusions. Link milestone/parent issues where present. Research/docs work
   also needs an issue. Fixups within an existing issue/PR do not need new issues.
2. **Ownership and branch.** Coordinator records the assigned worker/reviewer roles
   and dependency state in the issue. Use `codex/<issue-number>-<short-name>` for a
   task branch and an isolated worktree when needed. GitHub assignees are real
   accounts; distinguish agent roles in text when all agents share one account.
3. **Implementation and PR.** Worker commits scoped changes and opens a linked draft
   PR once there is a meaningful diff. Use `Closes #N` only when the PR completes that
   issue; otherwise use `Refs #N` and keep remaining acceptance work open. The body
   explains the problem/result, relevant design choices, exact validation and
   outcomes, private/skipped checks, provenance/license changes and limitations.
   Keep the title/body current as scope changes. Exclude retail payloads and private
   recordings/saves from commits, attachments, logs, issues and PRs.
4. **Review.** A coordinator/worker who did not implement the change inspects the
   actual diff and appropriate evidence. Post a GitHub PR review with reviewer role,
   reviewed head SHA, actionable findings with file/line references where helpful,
   checks inspected/run and disposition. An agent mailbox message or local final
   response alone is not a review record. Authors address findings, push fixes and
   obtain a review covering the updated head; do not reuse stale approval claims.
5. **Merge.** Coordinator confirms issue acceptance, current head/base, recorded
   review, resolved findings and applicable CI/private checks. Honor repository
   protections and required reviews; never use admin bypass to make the workflow
   appear complete. Merge via GitHub integration or `gh`, matching the reviewed head
   SHA (`gh pr merge --match-head-commit` where applicable). Prefer squash if allowed
   by repository policy; retain the issue reference. If a queue/auto-merge is used,
   wait for actual completion before reporting MERGED. Do not push directly to `main`.
6. **Close and hand off.** Verify merged status and merge SHA, and whether linked
   issues closed. Close only fully satisfied issues; record follow-ups as linked
   issues with remaining acceptance criteria. Post a concise completion/evidence
   comment when the PR does not already supply it. Update `docs/task.md` with issue,
   PR and review URLs, branch, reviewed head, merge SHA/status, validation and next
   issue. If a documentation change is needed afterward, keep it on a linked PR;
   final post-merge metadata can live in the GitHub issue/PR until the next normal
   handoff update, avoiding an endless merge-SHA-only commit cycle.

## Shared accounts and real approvals

Independent agent review is a work-allocation rule; it does not create a separate
GitHub identity. GitHub prevents a PR author from approving their own PR.
See [GitHub's required-review documentation](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews).

When agents share the author account, the reviewing agent posts a COMMENT review
that truthfully identifies its role, findings, reviewed SHA and readiness assessment.
That records the independent analysis but does not count as another account's formal
approval. If repository rules require such approval, obtain it from an eligible
reviewer; retain the open PR and state the exact blocker. Do not invent an approval,
change account identities, or disable rules. When no such rule blocks merge, the
coordinator may merge after the recorded agent review and applicable checks pass.

## Agent responsibilities and operational details

- Commit coherent increments after relevant checks and before handoff. In-progress
  work may be committed on the task branch with its incomplete state documented;
  do not merge failing/incomplete acceptance work or leave completed slices only
  as uncommitted edits. Preserve scoped commit history on the PR branch.
- On a genuine blocker, search for and create/reuse a linked GitHub blocker issue.
  Record reproduction, expected/observed behavior, source/commit identity, safe
  diagnostics, attempted remedies, blocked acceptance criteria, owner/next action,
  and whether human input is necessary. Link it from the work issue and PR; update
  and close it when resolved. If GitHub itself is inaccessible, record this locally
  and publish the issue as soon as access returns.
- Resolve routine implementation, dependency and integration problems autonomously;
  continue independent tasks while one is blocked. Contact the owner only for
  essential decisions, unavailable access, a required external approval, or original
  game evidence that cannot be obtained by agents. A blocker issue is not by itself
  a reason to stop the whole wave or request permission again.
- Coordinator owns issue creation/deduplication, dependency links, assignments,
  shared contracts, integration order and merge decisions. Workers own their scoped
  implementation, commits, PR body/evidence and responses to review.
- Reviewer records an actual assessment on GitHub. Rotate a worker into review
  rather than adding a fifth concurrent agent; use the agreed four-agent budget.
- Search before retrying uncertain create/review/merge requests. Verify results by
  returned URL/number/state so timeouts do not produce duplicate issues or PRs.
- With `gh`, use `--repo lictl/WebRA2` or a verified repository context. Use structured
  tool arguments or UTF-8 body files with `--body-file`; do not shell-interpolate
  untrusted issue/PR text or expose tokens. Preserve actual newlines.
- Authentication/permission/outage failures leave a clear pending GitHub action and
  local handoff. Continue independent local work where possible; do not describe
  local artifacts as published or a queued merge as completed.
- Public test results use original/synthetic fixtures and metadata-only summaries.
  Private original-game evidence remains under ignored `local/`; GitHub records the
  scenario/build/hash, result and limitations without redistributing the evidence.

## Bootstrap and resuming

The planning bootstrap is complete: [issue #1](https://github.com/lictl/WebRA2/issues/1),
[PR #3](https://github.com/lictl/WebRA2/pull/3), independent COMMENT review, merge
`bf241241e44d369d74662b01ccbf6e9b23d24a9f`. Subsequent slices follow the same chain.
Do not include `game/`, `local/`, or unrelated user changes. Record real URLs as
operations succeed; no placeholder issue numbers should be mistaken for existing work.

Then create/reuse the milestone and bounded work issues for the selected M0 wave.
Check existing GitHub state alongside `docs/task.md` after every session refresh.
Use [the work-item template](../.github/ISSUE_TEMPLATE/work-item.md) and
[the PR template](../.github/pull_request_template.md) as concise starting points.
