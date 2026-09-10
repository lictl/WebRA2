# Standing infantry firing in world transactions

The optional `infantryFiring` combat input attaches genuine
[initial firing programs](combat-initial-runtime.md) to the ordinary numerical/death
world. Each armed actor has exactly one primary weapon and one program. Unarmed
damageable targets have no firing program. The world checks actor ID, source row,
type and profile; a program's logical FireUp must be at most10000 ticks. Programs
provide source timing only. Full current-source actor, target, terrain, animation and
special-effect admission remains the source bridge under132/147; this component
alone does not authorize retail attacks or expose browser controls.

This selects policy `webra2-standing-infantry-combat-1`, engine `webra2-world-5`.
Immutable program data enters model identity. Other world policies keep their prior
shape and behavior. The runtime reuses the reviewed pure [firing scheduler](infantry-firing.md)
inside the same transaction as movement, reload sampling, ammo, damage and
[death completion](ordinary-death.md).

A held attack starts a windup when the actor is armed, alive, has ammo, has a legal
in-range target, and is ready to rearm. The source FireUp value is an explicit
WebRA2 logical delay: a begin atT becomes due atT+FireUp. Before the due shot, range,
life and target validity are checked again. Stop, move or a replacement accepted
attack cancels a pending attempt. A target leaving range cancels it; reentry starts
a new full windup. Cancelled attempts use no ammunition or random word. Each
accepted shot consumes ammo, samples the saved native reload stream, applies the
reviewed numerical damage and handles lethal death within the atomic world step.

The scheduler waits for the prior native ROF before beginning the next windup.
This means successful shots are separated by `max(1, nativeRof) + FireUp` logical
ticks in the uninterrupted case. ROF0 is retained as0 and FireUp0 may shoot on each
successive tick, at most once per actor per tick. This is D03 cadence, not native
frame-accurate animation or firing-loop equivalence. Actor sequencing, corpse versus
reload draw order, and movement phases retain the world policies already documented.

Each committed save includes one strict scheduler envelope per armed actor, sorted
by ID. Its tick equals `WorldSave.nextTick`; its last shot precedes that tick. The
pending attempt joins the current target/loadout and live stationary source, and
cooldown joins the scheduler's exact saved ROF. That ROF must be one of the current
three possible native reload outcomes. Finite ammunition equals initial ammo minus
saved shot count. Successful shots and completed corpses bound the minimum random
word count, while the full saved ring and cursor remain the numerical policy's
state. Structural restore is not historical authentication; exact replay checks the
recorded command history. Save/import wrappers parse bounded text into the world
save object before restore.

The existing scheduler attempt cap1048576, world actor/command/tick/work bounds,
trace and canonical JSON limits apply. Failure during any requested tick rolls back
all schedules, ammunition, health, death records and RNG. The model has no ammo
refill, promotion, runtime weapon switching or source reconfiguration in this slice.
Other special firing modes remain outside standing primary Walk infantry.

Six original tests in `tests/sim/infantry-world.test.ts` cover both profiles,
pending save/replay, Stop and reattack, range loss/reentry, zero delay/cooldown,
lethal completion rollback and malformed clock/ammo/target/model joins. They compose
genuine programs from invented INI fixtures with explicit numerical engine rules;
no original-world or browser combat acceptance is claimed. No new native ledger or
third-party dependency is adopted. Distribution retains the
[firing provenance notice](../packages/sim/INFANTRY_FIRING_PROVENANCE.md).
