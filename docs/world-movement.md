# Authoritative cell movement

[#120](https://github.com/lictl/WebRA2/issues/120) connects owned world entities to
the [navigation substrate](navigation.md), versioned commands and checkpoints.
The original MIT implementation is in
[world-model.ts](../packages/sim/src/world-model.ts),
[world.ts](../packages/sim/src/world.ts) and
[world-replay.ts](../packages/sim/src/world-replay.ts).

Current component scope is explicit WebRA2 cell movement on caller-supplied data.
The native typed-entity and terrain adapters are still being integrated. No
original campaign is playable, and this code does not change the existing
practice simulation or its saved-game policy.

## Model and interpretation boundary

`createWorldModel` takes content identity, mission/definition hashes, stable entity
IDs and source row/type joins, initial health, owners, navigation-class bindings
and explicit extra blocked cells. It owns/freeze-copies these values; grids must
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
footprints, acceleration, turning, transport and native collision fidelity need
their own interpreted model/policy. This whole-cell baseline makes those
limitations explicit rather than calling them original behavior.

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
Seventeen original tests cover canonical models, integer velocity, obstacle detours,
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
