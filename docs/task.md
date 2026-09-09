# Current task and refreshed-session handoff

State: **WORKING** — commit/review/merge the planning package, then execute M0.
Date: 2026-09-09.
Task: inspect the supplied game statically, ask product questions, write the
multi-agent implementation plan and `AGENTS.md`. Engine implementation is not part
of this session's task. No workers were launched for this planning pass.
Follow-up: require issues, PRs, recorded reviews and merges through GitHub integration
or `gh`, with traceable agent ownership and evidence. The owner has now accepted
the plan and authorized committing and proceeding, with autonomous execution and
GitHub issues for blockers. Begin M0 after the planning bootstrap merges.

## Confirmed product context

- Reimplement RA2 and Yuri's Revenge in a browser, TypeScript first; vetted codecs
  and measured WASM use. GPL reuse is acceptable when useful.
- All original campaigns in both games at campaign release. Preserve mission/rule
  behavior and playability. Cinematics and WebRA2 saves required; native save import
  is best effort. Full remaining vanilla engine and multiplayer follow.
- Vanilla map/INI/asset mods first; extension mods later. Desktop Chrome, Edge,
  Firefox, Safari and keyboard/mouse. All actual playable locale packs present in
  the supplied installation, with Traditional Chinese tested from early milestones.
- `game/` comes from Steam, Traditional Chinese, exact build unknown. Owner can
  provide observations/recordings/saves from a working original game later.
- On-device import, no server asset upload, plus a localhost launcher. Agreed team:
  one coordinator and three workers, incremental milestones, no fixed finish date.
- GitHub integration or `gh` must create/reuse issues, open linked PRs, record actual
  reviews and perform validated merges. This applies to docs/research as well as code;
  record URLs and commit identities. See `docs/github-workflow.md` and decision D15.

## Work completed

- Repository baseline: initial commit `1c6bdf4`, MIT `LICENSE`, user-provided ignored
  `game/`, previously untracked `.gitignore`; no preexisting engine or root guidance.
- Read-only triage: 438 files, 1,961,556,205 bytes; 69 top-level archive containers,
  66 encrypted indexes. Three plaintext indexes have valid declared member bounds.
- PE metadata/imports and version-string candidates collected. `1.08` / `1.11`
  metadata is not an identified gameplay patch. Source/build still needs fingerprint
  investigation; do not assume pristine retail 1.006 / 1.001.
- Campaign map section structure scanned; counts are not deduplicated mission counts.
  Editor source ZIP listed; no archive assets or source extracted or copied.
- Twelve product questions answered in `docs/decisions.md`.
- Wrote README, concise AGENTS, analysis, architecture, phased agent plan,
  compatibility seed and reproducible metadata script/snapshot.
- Preserved `/game` ignore and added `/local/` for private research; retained MIT
  pending actual dependency adoption. No game binary run, engine built, or deployment.
- Added the GitHub issue/PR/review/merge workflow, issue and PR templates, agent
  responsibilities, shared-account review handling, and handoff trace fields.
- Verified origin is `https://github.com/lictl/WebRA2.git`; `gh repo view` confirms
  `lictl/WebRA2` with default branch `main`. The CLI is available (2.100.0).

## GitHub bootstrap status

Bootstrap issue: https://github.com/lictl/WebRA2/issues/1.
Branch: `codex/1-planning-bootstrap`. PR creation/review is pending this commit.
Commit the docs/tooling/metadata, obtain an independent agent review and merge via
`docs/github-workflow.md`. Then start the selected M0 work issues and branches.

## Verification

- `python3 tools/static_inventory.py game > docs/analysis/installation-inventory.json`
  completed; no archive/PE parse errors; all three readable indexes within bounds.
- Recomputed inventory from `game/` and compared parsed JSON with the snapshot:
  identical. Snapshot is 36,585 bytes of reviewed metadata; no game payloads.
- Six inline standard-library synthetic checks passed: classic index, flagged index
  with checksum trailer, member out of bounds, truncated header, encrypted-index
  detection and unknown flags. These verify triage behavior, not production codecs.
- Checked all eight Markdown files and 20 local links: passed. Checked whitespace
  with `git diff --check` and `git diff --no-index --check /dev/null <file>` for new
  files, because ordinary Git diff does not include untracked files: passed.
- `git ls-files game` returns no paths. No retail assets are tracked; new public
  outputs are original docs/tooling and structural metadata. All changes remain
  uncommitted. No app tests exist yet and no game runtime validation was performed.
- Follow-up verification: all 11 Markdown files and 24 local links passed; issue
  template metadata and PR template checked; `git diff --check` and per-file
  whitespace checks including untracked files passed. No app changes or new app
  tests were needed for this documentation-only update.

## Exact next bounded implementation slice (queued, not started)

**M0 / evidence and feasibility.** When the user requests implementation/continuation:

1. Re-read `AGENTS.md`, this file and `docs/decisions.md`; inspect current Git status.
   Complete the planning-package GitHub bootstrap above before M0 work begins.
2. Create/reuse linked M0 work issues and record M0 as WORKING with explicit tasks
   and write ownership, issue URLs and branch/PR state. Use at most three
   workers plus coordinator according to `docs/plan.md`; separate their write paths.
3. Start **M0-01 MIX reader and content census**, alongside **M0-03 behavior/evidence
   contracts** and **M0-04 media/browser/CJK feasibility** where independent. Campaign
   member enumeration M0-02 depends on M0-01; do not fabricate it from raw scans.
4. Compare a narrow licensed decoder reuse path with a new reader. Pin versions/
   provenance and handle license changes/notices with the actual chosen dependency.
5. Deliver metadata-only nested member manifests, honest unresolved names/checksums,
   candidate media path, small shared contracts, and an original-game observation
   recipe. Choose real RA2/YR first-mission IDs after manifests are resolved.

Do not start M1–M8 merely because they appear in the plan. No technical stack
dependencies, browser test harness, Node version or npm scripts have been selected.
There is no existing app command to run. Avoid expanding this first slice into
whole-engine implementation before the evidence and feasibility gates close.

## Remaining unknowns

Exact Steam build/patch precedence; complete playable locale and mission manifests;
encrypted index/nested content decode; opcode semantics; cinema codec path and
dependency licensing; measured browser memory/performance; reference observations;
native save feasibility. These are research tasks, not unanswered product questions.

For later handoffs, replace the completed-work/validation sections with the actual
active slice's files, branch/contract revisions, commands/results, evidence paths,
issue/PR/review URLs, reviewed head and merge SHA/status, blockers, and next step.
Preserve the product decisions and their source.
