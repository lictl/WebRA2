# Ordinary human death in world transactions

The optional `ordinaryDeath` combat policy keeps lethal infantry in a saved dying
state until their configured sequence completes. Their ground anchor stays occupied,
then a corpse is selected from the complete configured vector and the anchor is
released. Movement, group destination planning, save/restore and replay use the same
pending state. This is engine integration of the reviewed death requirements, not
source campaign admission or rendering of the corpse assets.

Pass genuine `createOrdinaryDeathRules({actors, weapons})` output to
`createCombatModel` alongside the genuine ordinary numerical rules. The factory's
inputs are explicit engine parameters; a native source adapter must establish the
[ordinary human decision](combat-death.md), effective animation closure, exact source
joins and current execution context before constructing a retail model. No caller
claim or animation name authenticates that source evidence. Unsupported targets
remain in the world but cannot be damaged in this mode; the damageable target subset
may contain unarmed actors without granting unsupported attacks.

Each death actor specifies its stable ID, ordered nonempty `corpseAnimationIds`, and
`sequence11Ticks`/`sequence12Ticks`. Duplicates remain meaningful entries in the vector.
Each combat weapon specifies source `InfDeath`1 or2, selecting sequence11 or12. Rules
must cover every configured combat weapon, and death actors must be existing ground
combat actors. World binding additionally requires infantry with an owner, positive
initial health, a ground navigation binding, an occupied anchor and no static
foundation. These structural requirements do not replace native source eligibility.

The policy is `webra2-ordinary-death-combat-1`, save engine `webra2-world-4`. The
existing motion-only, synthetic combat and numerical-only save policies keep their
prior shapes and behavior. All rule fields participate in model identity; changing
candidate order, duration, source weapon or model requires a different save identity.

## Tick and occupancy contract

The world retains its command → navigation → movement order. In the combat phase:

1. Complete due deaths by completion tick then victim ID. Each consumes exactly
   one unsigned word from the same saved stream as reload sampling, chooses
   `word % candidateCount`, emits `corpse-selected` with the candidate index, then
   `destroyed` with the original attacker ID.
2. Resolve due impacts and fire in stable actor ID order, as in numerical combat.
   This mode admits instant single-shot weapons, so there are no stored flight impacts.
3. A lethal hit sets health0, clears victim movement, path reservations and combat
   orders, and appends the exact death record. Emit `dying` with attacker ID and
   `death-sequence` with11/12. No corpse word is consumed at lethal damage time.

Durations are positive explicit WebRA2 15 Hz tick counts, bounded to10000. A hit at
T with durationD completes during combat phase T+D. Because movement precedes
completion, the newly released anchor becomes available to navigation during T+D+1.
The group destination planner also excludes pending dying anchors. An actor killed
mid-edge returns to its logical anchor and releases its destination reservation;
this follows the existing WebRA2 cell-motion stop policy. Initial shared anchors
retain their existing counted occupancy; a completed actor releases only its share.

These are documented D03 playability choices, not native SHP frame cadence, native
subcell/locomotor handling or Scenario-wide random call ordering. The source terminal
path's unsigned word/modulo fact is recorded in the
[provenance notice](../packages/sim/ORDINARY_DEATH_PROVENANCE.md).

## Saved identity and attribution

`CombatState.deaths` is sorted by victim ID. Each record retains victim ID, attacker
ID, weapon ID, both immutable owner IDs, sequence, start tick, completion tick and
`corpseIndex`. A null index means the dying anchor is still reserved. A numeric index
means completion occurred; it resolves the animation ID through immutable rules.
Records remain in the save, even if the attacker's later orders change or the
attacker dies. Source row/type identities remain on the immutable world model.

Restore checks exact model/version, record uniqueness, source loadout and hostile
ownership, zero victim health, supported weapon/sequence/duration, complete pending
versus completed timing, candidate range and random count/cursor. A configured
initially alive victim with health0 must have a record. No future death state can be
injected into tick0. Structural save validation is not cryptographic authentication
or proof of all historical commands, damage or random words; replay supplies that
stronger deterministic comparison. The complete random ring is retained unchanged
by saves, with one stream shared by reload and corpse operations.

Attribution is data for future team/mission/house accounting; this component does not
award experience, update native kill counters or fire native trigger events. Those
systems must choose their intended lethal versus removal phase explicitly. The
`destroyed` event denotes terminal removal in this policy; `dying` denotes lethal
health loss. Corpse art currently remains a saved presentation reference.

## Bounds and verification

Rules cap2048 actors,1024 weapons,64 candidates per actor and4096 candidates in total.
At most one death record exists per admitted actor; the current immutable actor model
has no resurrection or ID reuse. Completion visits and draws count toward combat and
whole-world work, and event/JSON/state limits apply to the entire transaction. A
multi-tick work, trace or horizon failure publishes no partial deaths or RNG state.

Original tests in `tests/sim/ordinary-death.test.ts` cover both profiles/sequences,
blocked destinations and release timing, group planning, mid-edge cancellation,
unarmed targets, nonlethal progression, simultaneous deaths and reload ordering,
count1 RNG, record/owner/schema tampering, replay and atomic budget failure. Existing
numerical and synthetic combat tests remain regression coverage. Tests use invented
source-independent rules; no original mission playability or private live-combat
acceptance is claimed. The source compiler and current-world admission bridge remain
issues132/147; nonhuman, debris, explosions, active death effects, attached actors,
constructor/spawn combat, corpse rendering and full campaign behavior remain open.
