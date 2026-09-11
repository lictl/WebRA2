# First RA2 Allied mission: execution closure

[Issue230](https://github.com/lictl/WebRA2/issues/230) requires the original
`all01t` mission to reach legitimate victory or defeat from its normal player
house, including restart and save/quit/restore. The current engine cannot do that.
This audit turns the source preflight into implementation dependencies; it does
not grant partial-mission authority or change any gate.

The audited revision is `28ed58273164ad8556c378b5d9b75da9f8645d5e`. A fresh
438-file on-device catalog preparation reproduces **254 required RA2 diagnostics**:
168 unknown action occurrences, 63 unsupported team-action occurrences, 22 unknown
event occurrences and one aggregate team-catalog failure. There are no source
framing, binding, tag-mode, missing-trigger or logic-compiler diagnostics in this
preparation. Thus parser cleanup alone will not make this mission executable.
The [machine-readable census](analysis/first-mission-closure.json) retains every
opcode count, source hash and the narrower YR regression comparison.

## What was measured

The RA2 map SHA-256 is
`ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c`.
Rules, art, AI and mission members were read through the verified catalog with
explicit profile/root identities. The probe rebuilt definitions, flat traversal,
foundations, world, bindings, waypoints, complete per-team programs, activation,
spawn/recruitment catalogs, cue/cell/object catalogs, the team-cell constructor
gate and the new allocation-source audit. Whole authority remains null.

This is the reproducible **flat source/team baseline**, not the product's wider
ground traversal plus infantry slots and combat world. The product currently
builds those adapters in
[world-content-loader.ts](../apps/web/src/world-content-loader.ts); no fresh
browser run, route proof or original-game execution is claimed here. The existing
[infantry passage acceptance](infantry-browser.md) covers the earlier default
player route. That does not prove mission objectives or arbitrary naval/air routes.

A separate Python parser independently checks **6,954 comparisons** across both
profiles: member lengths/hashes, raw action/event count framing and all operands,
selected source lines, all mission-declared effective script rows and coverage
totals. RA2 has 567 event/action instructions and 88 local script rows; YR has
1,595 and 375. These script counts include declarations not referenced by a local
team, unlike older selected-team censuses. The oracle does not reconstruct native
semantics or independently redo every upstream world/INI/MIX proof. No source
rows, names, coordinates, assets or native listings are published.

## Required instruction families

Counts are occurrences, not independent features. Labels below are research names
from the pinned primary interfaces referenced by
[MISSION_LOGIC_PROVENANCE](../packages/sim/MISSION_LOGIC_PROVENANCE.md).
For currently unsupported operations, an enum label does **not** establish operand
loading, caller context or runtime side effects. Paired native consumer proof is
still required before each family is admitted.

| Missing action family | Opcodes and occurrences | Required implementation and dependency |
| --- | --- | --- |
| Sound/EVA and spatial audio | 19×39, 21×18, 99×26, 116×1 = **84** | Join exact registries/sample alternatives and native controls; source-authorized dispatch, positional/stop identity, saved deduplication and browser scheduling. Existing reference/PCM decoders are building blocks. The main VM only dispatches cues11/48/55; drafts outside this revision are not counted as merged behavior. |
| Reveal and shroud | 17×27, 101×1 = **28** | Source waypoint/radius plus per-house visibility state, discovery callbacks and saved shroud. Drawing the entire map does not implement reveal or event4. |
| Input, sidebar and team emphasis | 46×2, 47×1, 104×8, 113×1, 114×4, 115×4 = **20** | Authoritative input lock/unlock and request lifecycle; live team-instance lookup for flash; house/sidebar/type identities for cheer/tab/cameo effects. A text log alone is insufficient. |
| Ownership and team destruction | 14×7, 36×1, 5×2 = **10** | Mutable house ownership, authorization/alliances/counts, attached-object versus whole-house scope, and exact team-instance destruction/release. Preserve tags and invalidate dependent combat/team context atomically. |
| Scripted damage | 63×10 | Location/target enumeration and actual damage/death effects. Reuse numerical primitives, but do not equate this native path to the restricted ordinary infantry target-only shot. |
| Crates | 108×9 | Source crate selection/placement, pickup and its gameplay effects, deterministic RNG and saves. Initial team-cell invariants explicitly do not authorize crate-induced mutation. |
| In-game cinematics | 100×3 | Three distinct source operands; prove sidebar/movie selection and simulation/input behavior, then bind the persistent media component. Zero occurrences of action10 does not mean this mission has no movies. |
| Production and AI enable | 3×1, 74×1 | Resolve houses and apply native production/AI controls, with scheduler/constructor/accounting effects. These operations prevent treating all unselected templates as permanently inert. |
| World animation | 41×2 | Authenticate animation/type/waypoint and complete gameplay-effect closure before construction. Do not classify arbitrary animation objects as presentation-only. |

These nine disjoint groups account for all168 unknown action occurrences.
The separate75 actions4/7/80 retain their exact source operands: only11 of29
Create Team occurrences, one of25 Reinforcement occurrences and none of21
Reinforcement At occurrences currently obtain complete family/program catalogs.
There is no unsupported operand-only failure hidden inside a supposedly admitted
regular VM instruction; failures above are whole opcode or source-family gates.

| Missing event family | Opcodes and occurrences | Required authoritative observations |
| --- | --- | --- |
| House population and type existence | 9×1, 10×1, 11×2, 32×4, 57×3 = **11** | Living unit/building membership and exact type/house selectors, including birth, death, ownership change, sell/remove and potentially limbo distinctions. Define predicates from native consumers, not renderer counts. |
| Selection | 33×7 | Source attachment and actual admitted player selection; deselection/reselection, once/repeat, lock state and save/replay treatment. Current UI selection is not a mission callback. |
| Discovery | 4×2 | Visibility/shroud and discovered-object lifecycle, not a viewport pick or camera rectangle. |
| Production | 20×1, 21×1 | Actual completed unit/infantry production and the correct house/type observer. A spawned reinforcement is not automatically a production event. |

Already admitted events1/6/13/36/48 and actions1/2/11/12/48/53/54/55 remain useful.
Their admission is not proof of the missing world consumers. No tag mode1 occurs
as a failure here; implementing that general feature is not the next priority.

## Declaration closure: avoid both overbuilding and unsafe pruning

| Scope | Teams | Distinct scripts | Distinct task forces |
| --- | ---: | ---: | ---: |
| Loaded global plus mission declarations | 152 | 90 | 110 |
| Mission-declared registries | 49 | 38 | 29 |
| References from mission-declared teams | 49 | 37 | 28 |
| References from explicit actions4/7/80 | **33** | **28** | **19** |

The action-source gate retains1,575 diagnostics, including352 `Name` warnings,
336 unrepresented declarations and286 older unsupported-script-operand warnings.
They overlap dependencies and must not become1,575 implementation tickets.
[Allocation source policy213](mission-team-allocation-source.md) now proves all352
`Name` histories and records their separate resolutions, but has not changed the
old executable catalog. It also preserves77 required automatic-template roots,
111 initially excluded AI roots, two conditional AI roots, and three unresolved
native allocation/scheduling paths. An absent default house is not lifetime
inertness: a native caller may provide the house.

The shortest safe reduction is a **source-bound lifetime allocation closure**:
enumerate all explicit team selectors, automatic/template activation, AI controls,
script-driven substitutions and native callers; propagate possible live templates,
scripts and task forces to a fixed point; retain every omitted declaration with
its independently proved exclusion reason. Reuse the Name proof only for those
exact diagnostics. Unknown callers or future enabling behavior must keep the
relevant closure unsupported. `IsForSkirmish`, initial disabled state, an unselected
program and absence from actions4/7/80 are not sufficient exclusion proofs.

Similarly, 51 triggers start enabled on Normal. An intentionally loose syntactic
closure through enable/force references reaches129 of130 triggers even before
checking event truth, target difficulty or physical binding. It is **not** an
execution proof, but it shows why dropping all initially disabled triggers would
discard most of the mission. Difficulty-specific exclusion could remove only a
small source portion and needs an explicit compiler policy; this audit changes none.

The28 directly referenced scripts contain unsupported opcode occurrences
0×12, 1×4, 5×3, 8×2, 20×1, 37×9, 39×2 and46×1. Existing3/6/11/50 behavior covers
the remaining32 rows. Complete scripts and all retained effective rows must remain
checked, including rows after a Sleep or jump. Team behavior gates additionally
include suicide, transport-origin/drop entry, aggressive/guard acquisition and tag
lifecycle; these are not safely replaced with ordinary movement.

Adding script0 alone would remove the sole script-family gap for two directly
referenced infantry templates, but they still require recruitment and the source
target-class operands' combat semantics. The script1-only candidate is naval;
the script46-only candidate is a vehicle. Therefore there is no honest one-opcode
shortcut to first-mission playability. The earlier Sleep/Flash work already captured
the smaller movement-only opportunities.

## World and objective dependencies beyond opcode counts

1. **One mutable actor lifecycle.**
   [compileMissionTeamRuntime](../packages/sim/src/mission-team-context.ts) rejects
   combat/infantry-passage base models, while
   [compileMissionWorld](../packages/sim/src/mission-world.ts) rejects teams together
   with object-event callbacks. The product has both combat and infantry slots.
   Birth, recruitment, release, ownership transfer, damage and removal need one
   source-authorized actor/tag/combat/occupancy model and one atomic tick. A forged
   placed-row origin is not a dynamic constructor proof. Team-cell context also
   rejects four initially movable ship actors and cannot certify all future births.
   Their exact entry consumers need proof; making them immobile would alter gameplay.
2. **Autonomous orders and general combat.** The58 source-mobile actors already
   include34 Guard, nine Area Guard, four Attack and11 Sleep initial missions.
   The world currently initializes movement goals, not those native mission
   controllers. Team acquisition, naval/vehicle/aircraft behavior, transport/drop
   entry and attacks against structures are outside the standing-human-primary
   combat bridge. Structures cannot satisfy destruction objectives merely by
   being rendered. Movement-only unsupported actors must remain physical obstacles.
3. **House state and terminal outcomes.** There is one win and one lose action,
   both initially disabled and delayed through elapsed-time triggers. The immediate
   enabling predecessor of the win request uses event10, all-buildings-destroyed.
   Loss has house-destruction and attached-object-death ancestors. These are source
   graph facts, not a hardcoded objective recipe. Current actions1/2 only emit
   `outcome-request`; no campaign terminal state exists. Native country/house and
   acceptance rules must decide the real local player's outcome, with deterministic
   simultaneous-result ordering and saved terminal state.
4. **The browser runs a WorldSave, not the compound mission.**
   [WorldSession](../apps/web/src/world-session.ts) uses WorldReplayRecorder;
   [the loader](../apps/web/src/world-content-loader.ts) never prepares complete
   mission bindings/flags/teams. Its static summary also assumes placement-derived
   actor IDs and fixed ownership. A mission session must carry dynamic actors,
   tags, flags, teams, locks, objectives, presentation requests and terminal state
   through revisions, rendering, local save, restore and replay. Reimport must
   reconstruct genuine source authority before restoring that compound format.
5. **Cinematic/UI acceptance.** The existing verified chooser retains an Intro
   reference for this opening, and source action100 contributes three in-game
   movie requests. [Persistent Bink](persistent-media.md) already provides a
   bounded decoder/player component, not those source/transition bindings.
   [Mission audio](mission-audio.md) and [PCM/IMA decoding](mission-audio-decode.md)
   similarly do not authorize VM playback. Full first-mission acceptance needs
   source briefing/objective text, EN/Traditional Chinese controls, lock-aware input,
   victory/defeat/restart and explicit intro/in-game movie handling. Per issue230,
   any temporary presentation deviation must be individually resolved, not hidden
   behind `canStartCampaign` or an unacknowledged missing-assets fallback.

## Dependency order and next bounded implementation

Keep parallel work where dependencies allow it:

| Order | Deliverable | Concrete completion gate |
| --- | --- | --- |
| A | Allocation/lifetime closure and exact source selector inventory | Every retained declaration is executable or has a native/source-supported lifetime exclusion. Unknown automatic/AI paths still block; source mutations that enable them reopen closure. No mission filename branch. |
| B | Mutable ownership/house ledger and unified actor lifecycle | Atomic transfers/births/deaths preserve source IDs, team claims, tags, combat eligibility and infantry reservations. Saved counts are recomputed/validated; dynamic team plus object callbacks use the same world. |
| C | Required mission orders, acquisition/combat, production, transport and crates | Required source templates and initial missions execute complete scripts; unsupported actor/effect families are resolved rather than removed. Real damage reaches structure/house accounting. Source callbacks and all RNG are saved. |
| D, alongside B/C | Visibility/discovery, selection, audio/UI/movie requests | Exact source operands and owner context; authoritative gameplay observers separated from presentation; source-authorized requests survive restore without duplicate side effects. |
| E | Outcome reducer and browser compound session | Original player, full preflight, real source win/lose chain, terminal restart, active save/quit/reimport/restore and continued replay equivalence. |
| F | First-mission Chrome acceptance | Normal chooser → original play → legitimate win; separate legitimate loss/restart; save while moving, pending attack, queued team, active trigger and media state. Actual UI evidence, no debug flags/alternate owner/teleport/hidden omitted instructions. |

**Recommended next engine slice: source-bound ownership and house population.**
This is a useful prerequisite for the exact win chain and for control/AI behavior,
not another isolated renderer diagnostic. Scope action14/36 selection and transfer,
event9/10/11 population predicates, and a reusable internal house-state ledger.
Leave event32/57 type existence and terminal acceptance separate until their
native scopes are confirmed. This slice does not claim first-mission closure.

- Inputs: genuine world/bindings, exact action/event source records and source
  owner/country mapping. Do not accept arbitrary UI ownership edits or inferred
  player IDs. Runtime owns current owner, counted membership and removal state.
- Native work: follow the pinned YR action dispatcher and candidate helpers
  `SwitchAttachedObjectsToHouse` at `0x6e0aa0` and `SwitchAllObjectsToHouse` at
  `0x6e0b60`; event dispatcher `0x71e940` is a prior inspected span. Find paired RA2
  paths, exact selector resolution, count increments/decrements, limbo/production/
  death/removal handling and allied/civilian filters. These helper addresses are
  **leads**, not newly established behavioral evidence.
- Original tests: attachment-scoped versus house-wide transfer; enemy-to-player
  rescue changes command authority; actor death versus corpse completion; empty
  house and initially dead objects; spawn/production adds counts; transfer during
  a pending shot/team claim; simultaneous last-object loss; wrong source/owner
  rejection; every-boundary save/replay and rollback on budget failure.
- Private acceptance: all eight ownership-transfer occurrences and four
  population-event occurrences receive exact operand/context coverage. The
  source-derived winning predecessor observes the resulting ledger in a private
  source-bound component probe. Full mission admission remains false until every
  other family closes; never inject a fake last-building death into a claimed
  playable campaign test.

Root should sequence this with the broader team/combat/object adapter, not remove
the current incompatible-model checks first. Audio work can progress independently.
No essential human observation is currently blocking these static/source and
implementation tasks. If native terminal/media ambiguity later needs a reference
observation, first narrow it to the exact branch and recorded expected alternatives;
do not request an unspecified original-game playthrough.

## Reproduction and handoff

Private scripts and all source projections live in the `mission-closure` worktree:

```sh
# Node 24.20.0; real npm ci performed in this isolated worktree.
node --import tsx local/probe230.mjs > local/probe230.log
python3 local/audit230.py
```

The probe imports this checkout's modules and reads root `game/` without executing
it. It writes only `local/mission230/`; the oracle reads those four INIs/projection
files per profile. The probe's CSF source selection reuses the reviewed chooser
plan but re-reads its selected bytes through a verified session. Upstream native
records remain in the linked component ledgers; no native evidence is broadened
by a successful census. YR remains explicit and reproduces461 required diagnostics;
this task does not prioritize completing that opening before RA2.

Only this report and its aggregate JSON are new tracked files. Engine gates,
browser code, shared contracts, license mapping and coordinator handoff remain
unchanged. The coordinator owns follow-up issue assignment, independent review,
integration and the eventual first-mission acceptance record.

Documentation validation passes197 Markdown files/1,013 local links, the713-path
publication guard, M0 consistency and `git diff --check`. No public runtime test is
added or reclassified as a campaign test for this documentation-only change.
