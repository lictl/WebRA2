# Authoritative cell movement

[#120](https://github.com/lictl/WebRA2/issues/120) connects owned world entities to
the [navigation substrate](navigation.md), versioned commands and checkpoints.
The original MIT implementation is in
[world-model.ts](../packages/sim/src/world-model.ts),
[world.ts](../packages/sim/src/world.ts) and
[world-replay.ts](../packages/sim/src/world-replay.ts).

Current component scope is explicit WebRA2 cell movement on caller-supplied data.
The native typed-entity and terrain adapter now runs both opening placement sets;
stationary base footprint masks are bound to their owning entities. No
original campaign is playable, and this code does not change the existing
practice simulation or its saved-game policy.

## Model and interpretation boundary

`createWorldModel` takes content identity, mission/definition hashes, stable entity
IDs and source row/type joins, initial health, owners, navigation-class bindings,
explicit extra blocked cells and optional stationary-entity footprint cells. It owns/freeze-copies these values; grids must
be genuine navigation factory handles with the same content identity. An entity
has a logical cell, optional health, explicit whole-cell blocking and an integer
movement credit `0..255`. Each grid supplies a cost scale `1..256`. Neither pixels
nor model bounds determine collision. Passive objects can retain null health.

`webra2-world-model-1` hashes the sorted entity/blocked/grid identities with the
content, source and definition hashes and `webra2-cell-motion-1` policy. The hash
uses existing canonical integer JSON and SHA-256. Navigation records in that
projection contain only grid SHA-256 and cost scale. Initial overlapping anchors
are preserved and counted, not silently assigned to one placement. Typed native
indices or statically observed health/speed do not establish native locomotion.

## Tick and command policy

The caller schedules logical ticks at the explicit **15 Hz WebRA2 policy**;
render timing and audio clocks never enter the simulation. `WorldSimulation`
accepts schema-v1 `move` and `stop` envelopes ordered by tick/player/sequence.
Move payload is `{entityId,x,y}`; stop payload is `{entityId}`. Whole batches
validate before changing cursors/queues. Missing entities, incorrect ownership
and immovable entities produce ordered gameplay rejections when executed.

Each tick executes these phases:

1. Consume all due commands. A replacement move during an active edge finishes
   that edge before replanning. Stop releases the reservation at the last
   completed logical cell; it does not preserve a native fractional position.
2. Decrement retry counters and plan through a saved rotating entity cursor.
   At most eight queries share 8,192 expansions per tick. Found paths bind the
   immutable grid; failed requests remain explicit and retry after fifteen ticks,
   or one tick after expansion exhaustion. The cursor prevents one expensive
   request from permanently taking the first scheduling position. Searches are
   atomic, so a repeatedly over-budget path still requires a future larger or
   resumable routing policy.
3. Move in ascending stable entity-ID order. Credit per tick is
   `movementPerTick*grid.costScale`; each edge consumes the navigation step cost
   (256 or 362 times destination-cell cost). Unused credit can continue along
   an existing path within that tick; arrival discards it. The next cell stays
   reserved throughout a partial edge. No reciprocal swap or automatic pushing
   occurs. A newly obstructed edge clears the route and schedules a retry.

Starting from a shared anchor is allowed by excluding the current cell when
planning an exit. New destinations still require free occupancy. Diagonal
permissions/corners are checked before an edge starts; only its source and
destination are reserved while moving. Infantry subcells, flight layers, bridges,
dynamic foundations, acceleration, turning, transport and native collision fidelity need
their own interpreted model/policy. This whole-cell baseline makes those
limitations explicit rather than calling them original behavior. Optional model `footprints` hold extra
absolute cells per stationary entity, excluding an anchor already handled by
`blocksCell`. Their sorted identity is hashed; they are occupied while the owning
entity has nonzero or null health. Zero health releases both anchor and extra
cells. Mobile owners, duplicate cells/owners and empty footprints fail. Total
extra footprint cells are independently capped at 16,384. This supports later
health changes without making destroyed structures permanently block a route.

## Checkpoints, replay and resource bounds

World saves use the existing schema-v1 envelope with engine `webra2-world-1` and
the motion policy. Every entity's logical position, health, goal, full remaining
route, edge progress and retry counter is saved, along with admission cursors,
queued commands and the planning cursor. The model hash binds immutable content
and grids. This slice has no scheduled work or RNG and requires both containers
to be empty. Restore requires the genuine model, validates every route edge and
active destination reservation, and rejects mismatched content/versions/state
before creating the simulation. The restored checkpoint need not prove the
original user never edited a legal save; it must be internally valid. Only actors
still on their originally occupied shared anchor may overlap; relocated actors
cannot enter another anchor or an explicit blocker. Entities with zero movement
credit retain their model position, keeping static footprint bindings coherent.
Reviving an initially absent footprint cannot introduce new sharing with another
anchor, footprint or explicit blocker. Originally occupied shared masks remain
representable after a legal health edit.

`WorldReplayRecorder` owns its simulation and records admission ticks as well as
commands. It can begin at any valid moving checkpoint, bounds recording before
mutation and exports the initial checkpoint, admissions, terminal tick and full
terminal state hash. `replayWorld` reexecutes admission timing and verifies that
hash. It preserves pending future commands at the terminal checkpoint. Neither
saves nor replays embed game assets or immutable source definition tables.

Hard caps are 2,048 entities, 256 players, eight navigation grids, 16,384 additional
blocked cells, 16,384 aggregate remaining route cells and 256 queued commands.
The shared canonical guard additionally bounds combined state to 50,000 nodes,
depth 48 and 2 MiB. Commands are at most 10,000 future ticks away. A step advances
at most 128 ticks; there are at most 8,192 cell transitions per tick and 32,768
trace records per call. Fatal limits roll back **every tick in that call**, including
command consumption. Failed bounded route searches are ordinary visible outcomes,
not fatal transaction failures.

Replay spans are at most 10,000 ticks and 1,024 admission batches. A 16,777,216-unit
work cap counts three entity visits per tick, navigation expansions and cell
transitions; it is a logical budget, not elapsed time or exhaustive allocation
accounting. Recorder and replay use the same counter. World steps can accept a
lower remaining work budget and reject atomically. A final tick's bounded work
may execute before exhaustion is detected, but none of its state is published.
Worker termination remains the outer cancellation mechanism for synchronous work.

## Validation and remaining integration

Run `node --import tsx --test tests/sim/world.test.ts` and `npm run check`.
Twenty original core tests cover canonical models, integer velocity, obstacle detours,
shared starts, competing reservations, control replacement/stopping, ownership,
fair planning, malformed/mismatched saves, admission/replay timing and pending
orders. Moving checkpoint restores produce identical subsequent traces/state;
single-tick and batched advancement agree. A 1,024-actor synthetic workload proves
trace exhaustion rolls back a multi-tick call. These are public algorithm/state
tests, not a native mission or actual browser movement test.

The active content integration consumes
[typed definitions #113](https://github.com/lictl/WebRA2/issues/113) and
[terrain traversal #119](https://github.com/lictl/WebRA2/issues/119), accounting
for every supplied placement. Browser snapshot/orders then follow the
[placed-artwork UI #111](https://github.com/lictl/WebRA2/issues/111). Weapon/combat,
full trigger/team behavior and campaign progression remain required before
claiming a playable original mission.

## Opening-world content adapter

[world-content.ts](../packages/sim/src/world-content.ts) is original GPL-3.0-or-later
composition; it does not relicense the separable MIT core. Its
[notice](../packages/sim/WORLD_CONTENT_PROVENANCE.md) accompanies the build.
`compileWorldContent({mapBytes,rules,definitions,traversal,footprints})` requires genuine
entity-definition, traversal and base-footprint factory results, exact profile/mission identity,
matching footprint/definition fingerprints and identical ordered rule source pins. It owns/hashes the map bytes, recompiles
placements and staged construction, and checks every row/type/owner/raw-strength
join before producing a model. Rules byte authentication remains the verified
import pipeline's responsibility; metadata alone is not source authentication.

The adapter assigns entity ID `placementIndex+1` in the existing deterministic
placement order. Players retain construction house indices and literal names.
The development controller defaults to the unique exact map `Basic.Player` house
name, otherwise remains unselected. This explicit UI choice is not a native
campaign-player initialization claim. Every placement has a model entity and an
explicit mobile/stationary/passive/unavailable status with reasons. Unsupported
health remains null, unsupported motion remains stationary, and campaign readiness
remains false. No art readiness flag decides simulation capabilities.

Supported movement consumes the compiled positive scaled Speed and a matching
supported grid for walk/drive/hover/mech/ship labels. It still uses the explicit
15 Hz WebRA2 cell policy, with no acceleration, turning, crushing or special
MovementZone execution. Aircraft have no ground-blocking fallback. Smudges are
nonblocking; ground mobile actors use whole-cell anchors. Terrain and structures
use the ready native base masks from
[the foundation compiler](foundation-occupancy.md), translated by map anchor with
no facing rotation or clipping. Unknown required masks fail with a bounded source
row ID; unsupported candidate cells are never used. Empty foundations remain
nonblocking. The aggregate 16,384-cell adapter budget charges all translated mask
cells, including anchors, and the model owns extra cells by entity. Gates, wall
conversion, occupation flags and native lifecycle semantics remain separate work.

Six original pipeline tests check both profiles, all six placement families,
stable IDs/ownership/health, supported movement, moving restore/replay, source and
factory rejection, explicit player selection, native mask binding and lower
resource caps. A private
probe under ignored `local/world-content/` reuses actual verified profile/terrain
preparation and fresh entity compilation. It verifies all initial world coordinates
against the freshly compiled map placements and runs a supported player-unit order
selected by navigation, without a hardcoded mission objective.

| Private component run with base masks | RA2 opening | YR opening |
| --- | ---: | ---: |
| Accounted placements | 811 | 570 |
| Movable / stationary / passive / unavailable | 58 / 190 / 562 / 1 | 70 / 189 / 307 / 4 |
| Houses / default development player | 8 / 0 | 17 / 0 |
| Translated stationary base cells | 1,108 | 1,478 |
| Moving checkpoint progress | 7,680 | 10,240 |
| Restored and admission-replayed terminal tick | 122 | 122 |

Unavailable actors have unsupported starting terrain (1/2) or an unsupported
locomotor (0/2). All source hashes/row joins are verified by the composing pipeline;
continuous and restored traces/state and replay terminal hashes match. This is an
actual-content movement/state check, not an independent native movement oracle
or an actual browser test. Raw models, rows, selected commands and saves stay
private. The source/traversal/definition/footprint fingerprints and explicit adapter policy
feed the world model hash; the save contains none of those immutable asset tables.

The integrated component passes 611 public tests, strict types, 98-document/511-link
validation, publication/M0 guards and a 39-file code/license build from 76 approved
inputs. This is the component head before the browser world UI is integrated.

The following identities are historical policy-1 values. The
[selection identity correction](selection-identity.md) records policy-2 identities
and complete normal/reversed-selection checkpoint and replay comparisons.

| Historical private identity | RA2 opening | YR opening |
| --- | --- | --- |
| Adapter SHA256 | `987715d167adfdecd3061e68e7a1795836a1977497f77dc010ba197f8e8cfac0` | `8029afd078edf7899881df1c9a6c478f41fade7c57f9a27c93470e77139756fa` |
| World model SHA256 | `57bb08af8cdafefc5afb18d8d5f2019725f1fd45e31dbda994ea44218d70cda4` | `fd4126992c8c896f50766a8240aa69dd48e9d4a8e2ff444fb9f9cd5a020c3dff` |
| Replay terminal SHA256 | `5329f09996654a2576033f5fa66cae7a6e6b87ead718ce14dc1cd0506151966a` | `a0533054b8049c8577d333f10561fdb3d80ba91cf8b76b5ccf0e8620dbc4f818` |
