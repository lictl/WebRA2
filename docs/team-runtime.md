# Team script runtime

[Issue #152](https://github.com/lictl/WebRA2/issues/152) implements an explicit
existing-actor controller over the [typed team compiler](team-definitions.md) and
[authoritative world](world-movement.md). Work is in progress. No native program is
executed and no original campaign is playable through this component yet.

The accepted boundary is a genuine TeamDefinitions result joined to genuine
WorldContent by profile, mission hash and entity-definition fingerprint. Owned
mission bytes are rehashed before reading source waypoint coordinates. Selected
team/task-force/script references and actual row/type/owner bindings are checked;
an arbitrary caller content identity or arrival boolean is not execution proof.

The pure controller prepares a bounded outbox and prospective team state at an
exact world/team checkpoint. A component-owned bridge executes commands on a cloned
WorldSimulation, verifies core command receipts, and returns both new checkpoints
together. No user callback or `ack=true` can advance the cursor. Failed admission,
execution or resource checks leave the caller's pair unchanged. Prepared orders
are saveable and retryable only after deterministic recomputation against their
pinned base state. The complete replay records external admission timing.

The admitted execution policy will use the current WebRA2 whole-cell world,
separately from native locomotor and formation behavior. Script 3's waypoint focus
and script 6's cursor arithmetic have native evidence in both supplied profiles.
Their update cadence, destination assignment and stationary-arrival policy remain
explicit WebRA2 choices. Native move completion additionally consults Stray and
RelaxedStray, regroup state, actor destination/height/transport state and destination
fallback. These are not claimed equivalent to the present world model.

Script 5 remains gated: native guard runs a member mission routine on every poll,
then checks its timer. Implementing only the duration would silently omit guard
acquisition behavior. Unsupported instructions prevent selected-script execution;
there is no generic completion fallback. Team recruitment, spawning, transports,
trigger activation and full native membership lifecycle remain separate work.

[Native evidence and provenance](../packages/sim/TEAM_RUNTIME_PROVENANCE.md).
Private source comparisons and original compound world/controller tests will be
recorded at the implementation checkpoint. No passing runtime checks are claimed
by this initial research checkpoint.

## Shared group destination planner

`planTeamDestinations({model, checkpoint, actorIds, target}, lowerLimits?)` in
`team-runtime-destinations.ts` accepts a genuine world model and validates the full
checkpoint using WorldSimulation.restore. Invalid source/state/actor inputs throw
before planning. The result has policy `webra2-nearest-distinct-cells-1`, model and
checkpoint hashes, status `ready`, `blocked` or `budget-exhausted`, assignments and
work counts. Failure returns **no partial assignments**. Geometry is not command
permission: callers must still authenticate the issuer and admit orders atomically.

Actors sort by numeric ID; candidate cells in a square around the target sort by
squared distance, y, then x. Selected actors remain obstacles until the world moves
them. A stationary actor may hold its own current cell only when it is unshared
and otherwise unoccupied. An actor partway through an edge plans from its reserved
next cell, because replacing a move order finishes that edge in the current core.
Static blockers, living footprint cells and reserved movement cells participate.

Each assignment needs a bounded path in that actor's genuine navigation grid.
Assigned destinations are distinct. Later destinations cannot occupy earlier
planned paths or required diagonal corner cells, preventing a simple permanent
choke caused by parking a follower in the leader's route. Routes can still cross
transiently and future world changes can block them. This greedy planner is neither
a global formation optimizer nor a proof that concurrent movement will terminate.
It can report blocked despite another joint assignment existing. Scripts must wait
for actual stationary arrival and retain blocked state; no timeout implies success.

Hard, lower-only bounds are 64 actors, radius 16, 1,089 candidate cells, 256 path
queries, 262,144 aggregate expansions and 1,048,576 counted visits. Each query uses
the existing navigation component's array/path caps. These limits bound work and
allocations; they are not a total RSS or frame-duration promise. A source waypoint
remains the group center, while individual assigned cells are explicit saved
WebRA2 formation decisions, not native Stray/RelaxedStray equivalence.

Queued command destinations and other groups' future endpoints are not reserved
by this call. Separate admissions can therefore select the same future destination.
The helper preserves all queued commands and makes no global reservation or
deadlock-freedom claim; applications must expose failed or congested movement
instead of treating an assignment as arrival.

The initial component checkpoint passes four source-program tests and six planner
tests, including both-profile group movement, stable input ordering, exact hold and
mid-edge behavior, atomic no-partial failures, malicious inputs, footprint lifetime,
and unreachable directed cells. The full team cursor/transaction runtime and its
compound replay are still being implemented.
