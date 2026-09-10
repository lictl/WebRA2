# Source-defined team spawning

Work on [issue #160](https://github.com/lictl/WebRA2/issues/160) extends the
[existing-member team controller](team-runtime.md) with a source-bound reinforcement
catalog and atomic world insertion. This is a movement foundation; original
campaign execution, native recruitment, transport/drop entry and combat initialization
remain incomplete. The whole selected script must already pass the team program
gate. There is no mission-specific activation or fake map placement.

## Source and model boundaries

`compileTeamActivationSource` requires genuine typed teams/entities, their pinned
rules layers and owned rehashed mission bytes. Exact Actions/Waypoints sections and
raw operands retain provenance. Create Team 4 is recorded with an explicit recruitment
gate; 7/80 resolve ordinary source/team waypoints. Missing implicit definitions and
physical team indices stay unsupported. See the
[source provenance](../packages/content/TEAM_ACTIVATION_PROVENANCE.md).

`compileTeamSpawnCatalog` joins a genuine TeamProgram, activation source, entity
archetypes and traversal. It fails the entire selected action set if any action,
full selected script, owner, mobile type or ordinary reinforcement branch is not
supported. TaskForce member order is retained even when the runtime program's
quantity summary groups types. Archetypes need not have any placed map actor.

`restoreTeamSpawnContext` reconstructs a genuine WorldModel from immutable base
WorldContent and monotonic source records. Each record pins action/team/instance,
birth tick, exact type/house/player, initial health and initial cells. Entity IDs
append above the largest base ID and are never recycled after death. Rows named
`spawn:<record>:<member>` are dynamic metadata, not map placement rows. The opaque
context gives the team adapter validated model/actor bindings and exact records for
prefix comparison. Source policy and record/model hashes are separate.

`prepareTeamSpawnInsertion` chooses distinct passable cells by squared distance,
y then x around the source waypoint, in TaskForce order. It checks all current
living anchors, foundation cells and active edge reservations. Queued commands
for newly allocated IDs are rejected; unrelated queues/cursors are preserved.
Blocked/exhausted proposals contain no record and consume no IDs.
`commitTeamSpawnInsertion` recomputes the exact proposal and creates a candidate
model/save at the same tick, preserving prior actors, routes and orders. No caller
input is mutated on success or failure.

Native reinforcement performs actor generation followed by entry/placement branches.
The bounded atomic waypoint placement and integer movement are explicit D03
playability policies. Native entry edges, formation/Stray, passengers, rank,
constructor side effects, Scenario RNG consumption and precise cadence are not
claimed. Fresh ordinary infantry/unit health is source Strength in both inspected
images; this alone does not establish full actor initialization or combat eligibility.

## Compound admission, retries and replay

`createTeamSpawnCheckpoint` starts with the genuine base world and an empty dynamic
roster. `admitTeamSpawnInput` accepts source action IDs and unrelated world commands
atomically between ticks. It does not decide when a native trigger fires. The
monotonic request history distinguishes queued, spawned and exhausted requests;
every completed record joins exactly one source request. Restored initial records
and pending requests are not resubmitted as replay admissions.

A compound tick processes due requests by admission ID before the existing team
controller and one world tick. A blocked request consumes no actor IDs and retries
exactly 15 ticks later. Exhaustion stays explicit, with no fake script completion.
Pending proposals pin the complete candidate checkpoint and outputs. Commit
recomputes the candidate against source identities, prior state and pending inputs;
only the resulting complete checkpoint is published. A later insertion, world,
resource or trace failure rolls back all earlier candidates from that call.

`prepareTeamSpawnTick` and `commitTeamSpawnTick` expose the pending-save seam;
`stepTeamSpawnWorld` and `replayTeamSpawnWorld` apply it with aggregate tick, work,
admission and trace limits. Replay starts from an explicit compound checkpoint and
records only later input admissions. Ordinary prepared/committed tick work counts
both computation passes, including insertion recomputation; additional standalone
restore validation is separately bounded by the same input/tick limits. This is a
WebRA2 transaction/phase policy, not native scheduling or Scenario RNG equivalence.

## Bounds and current validation

Default limits are 256 selected actions, 64 historical team instances, 256 historical
spawn actors, 64 members per insertion, 2048 total model entities, radius 16 (at most 1089
candidate cells) and 262144 placement/reconstruction work units. Existing program
limits can lower instance/member caps. At most 64 requests may be queued, with 1024 retained requests/replay input items,
10000 attempts per request, 10000 replay ticks, 32768 aggregate trace items and
16777216 reported work units per batch/replay. JSON/canonical world guards remain in force.
History is retained after deaths; finite capacity is explicit. Limits must be lowered
before any dependent expansion. A restored structural record cannot prove historical
occupancy; the live insertion transaction validates current occupancy independently.

Current original tests cover both profiles, genuine unplaced archetypes, multi-member
atomic insertion, mid-edge reservations, pending tampering, preserved command/admission
state, resource failure, source/brand mismatches and non-reuse after death. The coordinator-authored dynamic adapter preserves existing team cursors, timers,
orders and per-instance birth ticks while appending complete source-bound instances.
Its source changes are reviewed independently from this worker-authored compiler/runtime.

A separate private source probe re-reads verified opening maps/rules/art/AI through
the browser catalog adapter. It finds 75 RA2 and 104 YR action 4/7/80 frames, with 46/83
ordinary source reinforcement plans. The existing complete-script gate leaves 0 RA2
and 8 YR action occurrences across 7 templates; all 8 YR catalogs compile (one or three
members). Each eligible YR action was run in isolation from the same verified base
world for 40 ticks. All 12 spawned actors moved; all 312 subsequent checkpoint
round trips and 8 final pending/admission replay comparisons matched. An independent raw-INI Python projection matches all 5778 new source-plan
scalar leaves. The [private census](analysis/team-spawning-census.json) retains aggregate counts,
source pins and hashes. These are static-source and WebRA2 runtime checks, not
native game or browser execution.

The [45-range native ledger](analysis/team-spawning-native.json) covers 5150 bytes of
code/data in both pinned images. Reproduction uses ignored
`local/native160/{probe.py,ledger.py}` and `local/{probe160.mjs,opening160/oracle.py}`
in the author worktree. Run Node 24 `node --import tsx local/probe160.mjs`, then
`python3 local/opening160/oracle.py`; use the private Capstone 5.0.6 environment for
`local/native160/ledger.py`. Scripts, original rows and listings remain ignored.
The ledger and primary reference scope are described in
[the distribution provenance](../packages/sim/TEAM_SPAWN_PROVENANCE.md).

## Next closure

The source admission API is ready for trigger/world integration; it does not execute
original trigger conditions. Create Team 4 requires actual recruitment semantics and
must not be replaced by reinforcement. For the RA2 opening, the smallest previously
identified additional single-opcode script sets are 11 (3 teams), 50 (3), 1 (2) and 0 (2),
subject to complete source/context admission. Guard 5 needs acquisition. Native
transport entry, off-map positioning, formation, constructor side effects and live
team lifecycle remain explicit gaps. No full campaign readiness is claimed.
