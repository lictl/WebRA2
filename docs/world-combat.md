# Authoritative world combat

[Issue #132](https://github.com/lictl/WebRA2/issues/132) extends the original
[world runtime](world-movement.md) with an optional privately branded combat model.
This is a reviewed core and source-preparation checkpoint. Initial private source
actor comparisons pass; executable native capability and browser attack integration
remain under132,145,146 and147. The original core
has an independent exact-head review at abcdfd0 in PR137.
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


## Source-bound direct weapon projection

The GPL composition factory `compileCombatWeapons({weapons})` requires a genuine
typed weapon graph and returns an immutable, privately branded result under
`webra2-standing-direct-weapons-1`. It binds the exact weapon/entity fingerprints
and ordered rule source identities. Each weapon remains explicitly ready for this
named subset or unsupported with ordered reasons; unresolved references never
become executable. A separate actor/world adapter must establish the required
initial slots, ammo, immunity, directed alliances and unmodified standing actors.

This first projection accepts positive damage, bounded positive reload, inclusive
integer ranges, nonnegative finite armor factors, an invisible instant projectile,
one shot, no splash and ordinary death modes. It rejects bursts, physical
trajectories, healing, special-effect flags, unknown gameplay fields, pending
allocation closure and unsupported numeric states. The broader pure core's
tracked/fixed-cell and burst policies are not thereby mapped to native content.

Audio, image and lighting directives retain exact source origins as deferred
presentation. Animation references, including Anim and AnimList, require separate
source-bound gameplay closure and block admission: animations may apply damage or
create actors, so they cannot be classified as presentation alone.
Prone damage and distance falloff do not apply within its standing, zero-spread
contract. Native rounding, projectile obstruction, firing animation delays,
veterancy, transport/garrison, deployment, cloak, rearm, target pursuit and special
death behavior remain outside this first runtime contract.

Seven original source-graph tests cover both profiles, exact numeric projection,
unsupported effects/unknown fields, source-preserving overrides, deferred origins,
genuine factory identity and lower bounds. The factory caps 1,024 weapons and
32,768 logical weapon/field/origin visits; existing canonical byte/node bounds also
apply before publication. Lower limits are accepted and no partial result is
published on failure.

A separately labeled private probe freshly hashes and reads the selected rules,
art and opening maps, compiles the entity and weapon graph, then applies this
policy. Both profiles currently yield zero admitted weapons (of 85/117); even
otherwise ordinary candidates have unverified animation/effect dependencies.
Every record carries explicit capability reasons; this count is neither
a playable-combat claim nor evidence of complete native weapon compatibility.
The source data and full projections remain ignored in
`local/combat-capabilities/`. Actor admission and a full source/world comparison
are the next dependency before browser attack controls.

## Initial placement admission

The internal `inspectCombatPlacement` composition helper retains source row rank,
AI group, bridge/follower state and independent recruitment flags for infantry and
units. Its caller must pass a freshly source-authenticated placement, such as the
combat-actor compiler's reconstructed `sourcePlacement`. It does not authenticate
arbitrary caller-created rows or execute their missions or AI flags.

Both native row readers use a 128-byte string buffer and comma tokenization. This
first policy therefore requires exactly 14 nonempty semantic tokens and at most
127 printable ASCII characters before the comment. It accepts only complete signed
decimal int32 tail values; ambiguous/truncated rows and native `atoi` prefix or
overflow cases remain unsupported. In particular, the INI reader's dollar/hex
syntax is not used by these placement-tail readers.

Only rank zero, ground/bridge flag zero and a unit follower index of `-1` enter the
ordinary-ground subset. Rank, group and recruitment values remain visible even
when they prevent admission. The two native rank setters multiply the integer by
0.01, then store binary64 in RA2 and binary32 in YR. Admitting only zero does not
claim to implement either profile's nonzero rank rounding or veterancy effects.
Structures, aircraft and passive objects require separate admission policies.

Four original fixture tests cover both profiles, independent flags, veterancy,
bridge/follower exclusion, decimal syntax, missing/empty/oversized tails and
comments, including a genuine Latin-1 nonbreaking-space prefix that must remain
unsupported. Only ASCII space/tab trimming precedes the printable-byte check.
The [static range ledger](analysis/combat-placement-native.json) pins
14 complete code/data ranges totaling 3,660 bytes in both full-hash-verified images.
No native program was executed. Private reproduction uses
`local/combat-placement/ledger.py`, the source-verified
`local/combat-capabilities/probe.ts` and the separate raw-INI projection in
`local/combat-placement/oracle.py`.

The independent private source comparison checks all 1,381 placement rows and
9,681 projected scalar leaves. Of the 59 RA2 infantry/unit rows, 45 meet this
placement subset and 14 have initial veterancy; all 74 YR rows meet this subset.
The remaining 1,248 rows are not applicable to this helper. These are placement
counts, not counts of executable combat actors. Other actor, weapon and world
requirements still apply. Canonical private projections have hashes
`25b306a521658cb0f6679225ca577c22f17063fec17d0c93b58bb4d7c261e2c5`
(RA2) and `1c4d36f8dbb8f61ba47786f92d21c40fc884cfb55370adc94bafc605db49deb7`
(YR); source rows and projections are not distributed.

## Combat roster and world identity

`compileCombatRoster({world,definitions,actors,weapons,capabilities})` joins five
privately branded compiler results. Every source/profile/definition fingerprint,
rule layer, house ID/index, source row, world entity ID, coordinate, owner and
known initial-health value must agree. Typed placements are sorted by row ID;
world entity IDs follow placement order. The adapter joins them by row ID rather
than assuming their array positions agree. Limits bound types, links, placements,
alliance pairs and logical work; aggregate canonical limits still apply.

The immutable roster retains armor, source-selected initial ammunition, immunity,
placement-tail facts and both ordered normal slots, including empty or unsupported
slots. It never drops an unsupported primary weapon to make a secondary appear to
be the original first choice. Unknown alliance initialization produces an explicit
unsupported status and no usable pair list. Complete initial alliances retain
directed owner IDs.

`initial-state-ready` describes only the named initial-state prerequisites. It is
independent of weapon-slot status and does not authorize execution. The roster
always has `canExecuteCombat: false`; source-bound type/country/house/difficulty
modifiers, animation effects, dynamic impact/obstruction, standing/subcell distance,
firing delay and death behavior still require completion before model attachment.
No world/model/save/replay identity is changed by preparing a roster.

Six original fixture tests cover both profiles, row ordering, scalar/slot joins,
initial rank/immunity/ammo/selector gates, directed and unresolved alliances,
forged and mismatched source results, immutable publication and lower bounds.
Private preparation lives under `local/combat-roster/`; the full source projections
remain private. This adapter introduces no new native behavior claim.

Fresh full-selection probes join all 811 RA2 and 570 YR placements. The initial
subset contains 44 and 69 rows respectively, with 33 and 150 directed alliance
pairs; all retail weapon slots remain non-executable under the current gates.
The previous world hashes remain exact. An independent composition oracle matches
38,067 projected scalar leaves, using separately reverified raw-INI actor and
entity projections (355,693 actor leaves and 17,108 entity fields), while treating
the previously reviewed world/navigation and weapon-capability results as inputs.
It does not independently reimplement those upstream semantics. The raw-source
oracles distinguish the selected-object source ID from the rule-layer map ID,
even where they refer to the same physical mission bytes.

Current roster fingerprints are
`a20e18b44e2bea2748a1c71d7e2a18fb44140895ca3515ddf2cb04628138aaa3`
(RA2) and `6e0aedcd73fcb05bc9cf41206a9b6e972f54ec18be1d1665040019b513fa89f0`
(YR). The comparison scripts are `local/combat-roster/probe.mjs`,
`local/combat-roster/oracle/{actor-oracle,entity-oracle}.py` and
`local/combat-roster/roster-oracle.py`. Reproduction inputs and results stay ignored.
