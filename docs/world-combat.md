# Authoritative world combat

[Issue #132](https://github.com/lictl/WebRA2/issues/132) extends the original
[world runtime](world-movement.md) with an optional privately branded combat model.
This is a working component checkpoint. Native capability admission, private
opening comparisons, independent review and browser attack integration remain.
No original mission is playable.

## Model and orders

The original MIT `createCombatModel` factory owns sorted weapon, actor and directed
alliance records. `createWorldModel` verifies every actor's entity/health/ownership
join and binds the combat fingerprint. Movement-only model hashes and checkpoint
shapes remain unchanged. Combat worlds use engine `webra2-world-2` and simulation
policy `webra2-cell-combat-1`; they cannot restore movement-only checkpoints.

An actor binds a ground/air target layer, armor index, up to two ordered weapon
choices and initial ammunition (`-1` means unlimited). A weapon binds damage,
inclusive minimum/maximum Euclidean range in 256 units per logical cell, reload,
burst size/delay, allowed target layers, delivery and 11 exact armor factors.
Factors are canonical odd integer significands times powers of two, with a unique
zero representation. Damage uses BigInt multiplication/shift and rounds down to
whole health points, saturating at the world health bound. Binary64 source factors
can be converted without an additional precision loss. This is an explicit WebRA2
rule, not proof of native damage rounding or native armor/veterancy interactions.

`attack` uses the existing schema/tick/player/sequence envelope and payload
`{entityId,targetId}`. Due commands check ownership, live supported actors, distinct
enemy ownership, directed alliances, target layer and positive effective damage.
Invalid gameplay orders produce bounded events. Invalid envelopes reject atomically.
An accepted attack clears motion and holds the target. This first policy requires
an explicit move into range; it does not yet pursue, acquire targets automatically,
fire at terrain positions or provide force-fire. Stop/move clear targeting and
remaining burst shots while preserving cooldown and previously launched impacts.

## Tick and checkpoint behavior

Each tick applies commands, navigation and movement, then due impacts ordered by
due tick/impact ID, then firing by entity ID. A weapon is chosen in slot order from
eligible weapons currently in range. It emits at most one burst shot per tick;
subsequent shots wait the explicit burst delay and reload starts at the most recent
shot. Interrupted bursts retain that cooldown. Ammunition is consumed per shot;
automatic reload/rearm is not implemented.

Instant shots apply during firing; a destroyed later actor cannot fire that tick.
Tracked or fixed-cell shots schedule an impact after the ceiling of launch distance
divided by speed (at least one tick). Tracked impacts apply to a surviving target's
current logical cell; fixed-cell impacts miss if it left the original logical cell.
Shots survive source destruction. These are bounded logical policies without native
trajectories, facing, elevation, spread, splash, cover or animation timing.

Destruction clears motion/reservations and target/burst state. Static footprint
occupancy is rebuilt on the following tick, including within a multi-tick call.
The core keeps destroyed entities with zero health; wrecks, survivors, debris,
explosions, production and mission notifications are later consumers.

Saves contain target/weapon selection, cooldown, remaining burst/timing, ammunition,
monotonic impact IDs and every pending impact's source/target/weapon, launch/due
ticks and launch/aim cells. Restore validates canonical framing and model joins,
target legality, mutual exclusion of movement and targeting, ammo bounds, burst
clock relationships, reachable cooldown bounds, range and exact flight timing. Impact
order and unique IDs are checked. Replay records command admission timing and
verifies the complete terminal checkpoint including pending impacts.

## Bounds and validation

The component caps 1,024 weapons, 2,048 actor bindings, two slots, 4,096 pending
impacts, 64 shots per burst, 10,000 delay ticks, 4,096 shots and 16,384 charged
combat operations per tick. The existing aggregate canonical JSON limit also
applies; individual maxima need not fit simultaneously. Combat operations count
in the step's logical `transitions` work budget alongside movement transitions;
this is not an exhaustive CPU/allocation metric. Any fatal bound failure rolls
back the entire requested step, including health, ammunition, commands and impacts.

Fourteen original tests cover model identity/ownership, rational damage boundaries,
ownership/alliance/layer/immunity rejection, range endpoints, cooldowns/bursts/ammo,
stable competing fire, impact persistence and tracking, motion cancellation,
destruction/footprints, corrupted checkpoints, moving/firing restore/replay and
atomic resource exhaustion. The integrated component checkpoint passes 639 public
tests and strict types, document/publication/M0 guards and the code-only build.

These fixtures are original synthetic scenarios. Typed native weapon fields alone
do not establish executable capability. The next adapter must retain unsupported
special effects and source evidence explicitly, and compare both opening profiles
privately before this issue can close. No retail payload is included.
