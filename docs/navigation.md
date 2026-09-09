# Deterministic mission-grid navigation

[#116](https://github.com/lictl/WebRA2/issues/116) adds an original MIT component
for M3 movement. [The implementation](../packages/sim/src/navigation.ts) accepts
explicit terrain costs/edges and occupancy, finds paths and returns immutable
results. It has no DOM, clocks, render state, unseeded randomness or filesystem
dependency. It uses the already adopted MIT SHA-256 primitive for identities.

This is **WebRA2 routing policy**, not native RA2/YR route or locomotor equivalence.
The original practice simulation still uses its versioned synthetic movement.
Typed entity definitions, terrain traversal compilation, authoritative orders,
subcell occupancy, movement speed/turning and browser integration remain separate
work. An available route does not make an original mission playable.

## Input and identity

`createNavigationGrid({contentIdentity, movementClass, cells}, lowerLimits?)`
owns sparse cells on the integer domain `0..511` on each axis. Each cell provides
`{x,y,cost,exits}`. Absence means unavailable; cost is a positive integer destination
multiplier `1..65535`. Cost zero is rejected. The caller supplies terrain/movement
semantics and directional permissions from authoritative data; pixels do not
determine them. A grid represents one movement class and content/mod identity.

The eight low bits of `exits`, in order, permit these relative moves:

| Bit | Delta X | Delta Y |
| --- | ---: | ---: |
| 0 | 0 | -1 |
| 1 | 1 | -1 |
| 2 | 1 | 0 |
| 3 | 1 | 1 |
| 4 | 0 | 1 |
| 5 | -1 | 1 |
| 6 | -1 | 0 |
| 7 | -1 | -1 |

These are map-axis deltas, not named screen directions. An exit is directed:
reverse permission is separate. Boundaries never wrap. A diagonal additionally
requires both adjacent cardinal cells to be available/unoccupied and **both**
two-cardinal routes across that square to have all four directed permissions.
This deliberate conservative corner policy must be versioned if changed.

The factory returns a branded frozen handle containing policy, SHA-256, owned
content identity, movement class and cell count. `navigationCell(grid, position)`
returns detached frozen metadata or null; internal typed arrays never escape.
Plain copied/JSON handles are not accepted. Reconstruct grids from authenticated
content when restoring a world; a saved route must bind the same grid identity.

Grid hashing starts with UTF-8 canonical integer JSON plus LF for
`{policy,contentIdentity,movementClass,cellCount}`, using the
[canonical simulation format](simulation-foundation.md). It then appends one
seven-byte record per cell, sorted by `address=x+512*y`: little-endian uint32
address, little-endian uint16 cost, uint8 exits. Array input order is immaterial;
duplicate addresses are errors. Content/profile, ordered mods, movement class,
costs, edges and routing policy all affect the identity.

## Route transaction

`findNavigationPath(grid, {start,goal,occupied}, lowerLimits?)` snapshots and
validates every query before searching. Occupancy is a set of cell coordinates;
duplicates are rejected, absent-grid occupancy is retained in the identity and
has no traversal effect. The caller must exclude the moving object's own cells
when appropriate. A supplied occupied start remains explicitly blocked.

A cardinal move costs `256*destination.cost`; a diagonal costs
`362*destination.cost`. A* uses the minimum grid multiplier times the octile lower
bound `256*max(dx,dy)+106*min(dx,dy)`. Positive weights and this consistent
heuristic allow each cell to close once. Total ordering is ascending estimated
total cost, then remaining heuristic, then cell address. Neighbors use bit order
above. An equal-cost parent retains the first predecessor reached under that
order. There is one heap entry per open cell, updated by decrease-key.

Results contain grid/query SHA-256, status, expanded count, and a path/cost only
when found. The path includes both endpoints; start=goal costs zero. Missing or
occupied endpoints, unreachable goals, exhausted expansion budgets and excessive
path length have distinct statuses. Popping the goal counts as an expansion, so
even start=goal requires a budget of one. No partial route or resumable search
frontier survives a failed search. The synchronous call is one bounded transaction
and never changes grid or occupancy state; a later world adapter budgets calls per
tick and owns any accepted route/replanning state.

Query hashing uses canonical JSON plus LF for
`{policy,gridSha256,start,goal,occupied,limits}`, where endpoints are addresses,
`occupied` is the count, and `limits` contains all effective caps. Sorted occupied
addresses follow as little-endian uint32 records. The input order of occupancy
does not affect results. A changed work budget changes the query identity.

## Bounds and validation

The maximum is 130,816 cells, occupied positions, expansions and path cells,
matching the maximum currently compiled diamond cell count. Callers may only
lower caps. Costs, coordinates, permissions, hashes, profiles and movement-class
IDs are validated; nonfinite/fractional numbers, negative zero, accessors, hidden
properties, sparse/expanded arrays, unsupported prototypes and duplicate cells
are rejected. No callbacks occur inside parsing or searching.

Each grid stores 786,432 bytes in dense cost/exit arrays. An active search uses
4,718,592 bytes of occupancy, distance, parent, heap-position and closed arrays,
plus bounded JavaScript arrays, validation snapshots and result records. These
are storage accounting, not a measured browser heap peak. Expansions inspect at
most eight neighbors with logarithmic heap operations. Distances stay exact safe
integers: even the conservative maximum simple route bound is below `2^45`.
The cap is not a promised per-frame duration; world integration must measure its
work budget in the target browsers.

## Checks and next integration

Run `node --import tsx --test tests/sim/navigation.test.ts` and `npm run check`.
Original tests cover weighted detours, stable ties, directed edges, all corner
permissions, blocked/missing endpoints, boundary wrapping, limits, detached state,
metadata hashing and costs exceeding uint32. An independent O(V²) Dijkstra builds
an explicit graph for 240 generated sparse weighted/directed/occupied grids and
checks optimal costs; reversing source arrays must preserve full results.

This component does not read retail assets, so these are public algorithm tests,
not native mission movement evidence. The next world slice consumes reviewed
[typed entity definitions #113](https://github.com/lictl/WebRA2/issues/113),
explicit terrain/occupancy compilation and versioned commands, then records
authoritative paths and progress in WebRA2 save/replay state.
