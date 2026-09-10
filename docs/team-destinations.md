# Shared group destination planner

[Issue #152](https://github.com/lictl/WebRA2/issues/152) and
[RTS controls #149](https://github.com/lictl/WebRA2/issues/149) share this pure
geometry helper. It adds no team/script execution, browser controls, source
compiler or native formation claim. It is an original GPL-3.0-or-later component
composing the existing MIT [navigation](navigation.md) and
[world model](world-movement.md), without a new dependency or native-code reuse.

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

## Verification

Six original synthetic tests cover both profile labels, distinct group commands
executed by WorldSimulation, stable actor ordering, exact hold/mid-edge behavior,
no-partial budget failures, malicious model/save/actor inputs, living footprints,
unreachable directed cells and the explicit queued-command scope. These use
original model/graph data only: no retail assets, private oracle or browser run
is required or claimed by this helper.

Use Node 24.20.0, `npm ci`,
`node --import tsx --test tests/sim/team-runtime-destinations.test.ts`, and
`npm run check`. Browser integration and mission-team compound state remain
separate reviewed work; issues 149 and 152 remain open.
