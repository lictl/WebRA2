# Source infantry combat in the world and browser

Work on [issue132](https://github.com/lictl/WebRA2/issues/132) composes the
[source bridge](ordinary-infantry-bridge.md), [saved firing](infantry-world.md)
and [ordinary death lifecycle](ordinary-death.md). The new world6 policy executes
only supported standing Walk infantry primary shots against supported ordinary
human targets. Complete campaigns, general combat and native animation cadence
remain unfinished.

## Immutable authority and current state

`bindOrdinaryInfantryWorld` requires a genuine bridge and its original WorldModel.
The combat factory reconstructs and compares the complete unbound combat hash,
then stores only the source bridge fingerprint in the new canonical model. The
original genuine bridge remains in a private WeakMap. The world factory compares
the entire unbound world hash, including movement, placements, ownership,
foundations, terrain, content and source identities. A different model cannot
borrow this authority by copying properties or reusing a timing program.

The core derives current shot context from its owned world state before beginning
or resolving a shot. Pending attempts are rechecked every tick; moving targets,
terrain and impact occupancy can cancel them without consuming ammunition or RNG.
The last phase also cancels pending shots invalidated by a later actor's death
blocker. Restored pending shots must pass the same current-state check. Decisions
contain audit hashes, not tokens that permit a future shot without revalidation.
Context work is charged separately, with at most262144 units per tick or restore;
ordinary operation limits remain unchanged. A resource failure rolls back the
whole candidate transaction.

The bridge still rejects unsupported effects, elite current-weapon selection,
finite-ammo attackers and other unresolved actor behaviors. Target-only actors
receive damage and ordinary death state without being given an executable weapon.
Movement-only actors remain in occupancy and rendering. No UI field can grant
attack eligibility.

## Worker and controls

The terrain worker compiles all source prerequisites from the same verified
mission/rules/art objects. Development defaults explicitly use random seed0,
Normal index1 for every source house, and15 ticks for death sequences11/12. These
are D03 settings, not a claim about native campaign difficulty assignment, global
Scenario RNG order or animation frame timing.

The worker projects source roles and bounded current combat state alongside
existing movement snapshots. Source attack orders contain only player, selected
entity IDs, target ID and expected revision. Every selected actor must be owned,
living and supported; the complete selection is preflighted before any command
is recorded. Stale revisions or unsupported context leave the world and recording
unchanged. The core independently checks context again when executing.

Right-click an enemy or use the target selector and Attack button. Move into range
and stop first. English and Traditional Chinese messages distinguish range,
moving actors and unsupported context. The HUD reports preparation/attack state;
health and death completion come from authoritative snapshots. Pending deaths
retain standing artwork until completion; completed actors stop rendering and
picking. Native firing/death sequences and corpse artwork remain subsequent
presentation work. Save, restore and replay retain the full simulation state.

## Validation and remaining acceptance

Original source fixtures exercise model tampering, both-profile windup/death,
current terrain/occupancy rejection, moving-target cancellation on the due tick,
resource rollback and every-tick save/replay equivalence. Worker/controller tests
exercise identity-only orders, ownership, stale revisions, target-only refusal,
combat snapshots and bilingual feedback. Existing movement policies retain their
save schema and behavior.

Separate private source probes run real opening worlds through movement into
range, attack, ordinary death, pending restore and terminal replay. The RA2 probe
requires an explicit alternative development control house: the default player's
candidate did not find a legal attack position in24 bounded navigation queries.
The YR probe uses its default player. Both profiles also cancel a real pending
shot when the target receives a move order, with no RNG draw or damage. Independent
catalog sessions with reversed file order preserve all source bridge/program
identities despite changing transient root handles. These are private headless
checks; they do not establish native game or Chrome execution. Actual Chrome
acceptance is the next gate. Other browser end-to-end work remains deferred by D17.
