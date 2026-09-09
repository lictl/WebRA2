# WebRA2 agent instructions

## Start and scope

1. Read `docs/task.md`, then `docs/decisions.md`. Inspect `git status --short`.
2. Read `docs/plan.md` and the focused architecture/analysis/compatibility sections
   relevant to your assigned slice. Distinguish observations from assumptions.
3. Continue the user-authorized slice. A queued milestone is not an instruction to
   implement the entire roadmap. If the previous task is COMPLETE, use the new user
   request to select the next bounded slice and record it before editing.

Build a browser-native TypeScript engine for **both RA2 and Yuri's Revenge**.
Prioritize original campaign behavior and playability. Campaign release includes
cinematics and WebRA2 saves. Original Windows save import is best effort. Support
desktop Chrome, Edge, Firefox, and Safari with mouse/keyboard. Vanilla maps, INI
mods, and replacement assets precede Ares/Phobos extension compatibility.
WebAssembly is justified by measurements or a documented codec reuse decision.
The source installation is Steam, Traditional Chinese, build unverified. Support
all playable language packs present; test Traditional Chinese from the first UI slice.

## Content and evidence

- Treat `game/` as a read-only local reference. Never execute bundled programs as
  part of static analysis. Do not upload or commit game data, extracted assets,
  original saves, credentials, decompiled listings, or game screenshots/recordings.
- Put private research outputs in ignored `local/`. Publish only reviewed factual
  metadata/specifications and original or appropriately licensed test fixtures.
- No retail content in `public/`, build outputs, packages, or public CI artifacts.
  File selection is intended to read assets on the user's device, not transfer them
  to a server. The owner confirmed on-device import plus a localhost launcher.
- Preserve source provenance and dependency licenses. GPL reuse is acceptable per
  the owner, but do not silently label reused GPL material MIT. Select exact versions
  and record notices and distribution obligations when adopting code.
- Static strings, editor labels, and successful decoding do not prove runtime
  behavior. Record source/hash/offset or section, interpretation, confidence, and the
  test needed to verify each compatibility claim. Do not describe this as a formal
  clean-room process unless an actual separation protocol has been established.

## Engine boundaries

- Simulation has no DOM, rendering, wall-clock, filesystem, network, or unseeded RNG
  dependencies. Commands enter through a versioned deterministic interface.
- Use stable IDs, defined ordering, seeded RNG, explicit numeric rules, serializable
  scheduled work, canonical hashes, and replay/save equivalence from the first slice.
- Keep RA2/YR content profiles explicit. Loading YR files must not override RA2 rules
  accidentally. Preserve archive and INI precedence with source provenance.
- Interpret mission triggers and AI scripts as data. Do not hardcode a mission path
  to make a demo pass. Surface unsupported semantics; do not silently skip them.
- Render snapshots; never use GPU output or render frame rate to decide game state.
- Parse imported content with bounds/resource limits. Legacy DLL mods are not browser
  plugins. Arbitrary mod JavaScript is outside the initial mod contract.

## Collaboration

For implementation work, use the agent waves in `docs/plan.md` when the user requests
collaboration. The agreed default is one coordinator plus up to three workers;
honor a newer user budget/concurrency decision. Assign independent bounded tasks,
exclusive write paths, dependencies, acceptance tests, and a return format first.
Only the coordinator edits shared contracts, root configuration, lockfiles, and
`docs/task.md`. Workers propose changes to those files instead of racing edits.
Use `codex/` branches/worktrees if isolation helps; never overwrite another agent's
or the user's work. Report evidence and limitations, not only completion claims.

## GitHub traceability

Use the GitHub integration or `gh` CLI for issues, PRs, reviews and merges. Follow
`docs/github-workflow.md`; the repository is currently `lictl/WebRA2` (verify origin).
Every substantive slice, including documentation/research, needs an issue, a linked
`codex/` branch and PR, validation evidence, and a recorded review before merge.
Search for existing issues/PRs first. The coordinator owns issue assignment and
merges; workers implement and open/update PRs; another agent reviews the diff.
Record the reviewer role and reviewed commit SHA. Agents sharing a GitHub account
must not represent a comment as a separate account's approval or bypass required
reviews. Merge only the reviewed revision after applicable checks and repository
rules pass; ordinary in-scope GitHub work is authorized without repeated permission.
Keep issue/PR/review URLs and the merge SHA in the handoff. No direct pushes to the
default branch, invented review results, or retail content in GitHub discussions.
Commit coherent changes during implementation and before handing work off; do not
leave completed slices only in a dirty checkout. Record genuine blockers as linked
GitHub issues with evidence, attempted fixes, impact and the next action. Continue
independent work and resolve routine problems autonomously. Involve the owner only
when needed for missing access, an essential product decision, required external
approval, or original-game observations that agents cannot obtain themselves.

## Verification and handoff

Use Node from `.nvmrc` (24.20.0), `npm ci`, then `npm run check` for type checking,
public synthetic tests, document links and publication-path checks. Run focused
tests with `node tools/run-tests.mjs tests/<area>`. Installation triage remains
`python3 tools/static_inventory.py game`; private corpus commands are documented
with their component. Do not describe public synthetic checks as retail validation.
For docs, check local links and `git diff --check`. For engine changes, run relevant
synthetic parser/behavior tests, deterministic save/replay checks, and browser tests
appropriate to the feature. Private retail-asset tests must be separately labeled;
missing assets are a skipped private gate, not a passing campaign test.

Before finishing, update `docs/task.md` with state (WORKING/BLOCKED/COMPLETE), changed
files, commands/results, unresolved questions, and the exact next slice. Update
compatibility rows only with supporting evidence. Do not claim full compatibility
from a rendered map, a mocked mission, or one successful playthrough.
