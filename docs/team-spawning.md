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

## Bounds and current validation

Default limits are 256 selected actions, 64 historical team instances, 256 historical
spawn actors, 64 members per insertion, 2048 total model entities, radius 16 (at most 1089
candidate cells) and 262144 placement/reconstruction work units. Existing program
limits can lower instance/member caps. JSON/canonical world guards remain in force.
History is retained after deaths; finite capacity is explicit. Limits must be lowered
before any dependent expansion. A restored structural record cannot prove historical
occupancy; the live insertion transaction validates current occupancy independently.

Current original tests cover both profiles, genuine unplaced archetypes, multi-member
atomic insertion, mid-edge reservations, pending tampering, preserved command/admission
state, resource failure, source/brand mismatches and non-reuse after death. The dynamic
team adapter and compound activation/retry/replay are being integrated and are not
claimed complete by this checkpoint.

A separate private source probe re-reads verified opening maps/rules/art/AI through
the browser catalog adapter. It finds 75 RA2 and 104 YR action 4/7/80 frames, with 46/83
ordinary source reinforcement plans. The existing complete-script gate leaves 0 RA2
and 8 YR action occurrences across 7 templates; all 8 YR catalogs compile (one or three
members). An independent raw-INI Python projection matches all 5778 new source-plan
scalar leaves. These are source/metadata checks, not native game or browser execution.

The [45-range native ledger](analysis/team-spawning-native.json) covers 5150 bytes of
code/data in both pinned images. Reproduction uses ignored
`local/native160/{probe.py,ledger.py}` and `local/{probe160.mjs,opening160/oracle.py}`
in the author worktree. Run Node 24 `node --import tsx local/probe160.mjs`, then
`python3 local/opening160/oracle.py`; use the private Capstone 5.0.6 environment for
`local/native160/ledger.py`. Scripts, original rows and listings remain ignored.
The ledger and primary reference scope are described in
[the distribution provenance](../packages/sim/TEAM_SPAWN_PROVENANCE.md).
