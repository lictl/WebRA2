# Saved ordinary infantry passage

[Issue180](https://github.com/lictl/WebRA2/issues/180) composes the genuine
[source catalog and occupancy helper](infantry-passage.md) with deterministic
world movement. This is an ordinary ground subset, not complete native locomotion,
mission execution or a completed browser campaign.

`bindInfantryPassageWorld(catalog, base)` accepts a genuine world, optionally after
`bindOrdinaryInfantryWorld`. The model factory independently compares the complete
original unbound model hash against both source authorities: all entities, health,
owners, navigation identities/costs, blockers, footprints and content identity.
A copied catalog, mismatching graph, modified actor or added blocker cannot grant
passage. The selected catalog SHA enters the new model hash. Rebinding rejects.
The original source combat bridge and its flat shot-context exclusions stay intact.

Only bound worlds use engine `webra2-world-7`, motion `webra2-cell-motion-2`, and a
rules identity combining the existing combat/motion policy with the passage policy.
Worlds without the new binding keep their exact old schemas, identities and behavior.
Cross-policy saves reject explicitly. No automatic migration is claimed.

## Movement and saved state

The optional sorted `WorldState.infantrySlots` contains exactly one
`{entityId,subcell,reservedSubcell}` row per supported actor. Slots2/3/4 initialize
from the source and remain present after retirement. The movement phase selects a
free slot in stable actor order before entering an edge, saves it throughout the
partial edge, and commits it on arrival. It retains the old anchor until arrival.
Queued goals reserve nothing. Unsupported actors keep whole-cell occupancy.

Navigation excludes only cells that the actual mover cannot enter under its
source-bound directed alliances and current claims. The existing graph and strict
diagonal corner rules remain. Shared source anchors retain only their exact source
exception. A fourth ordinary occupant, hostile/unknown relationship, static
foundation, unsupported slot or pending death blocks a new arrival. All original
entities and independent foundations remain in the model.

Stop cancels the reservation at the retained anchor. Mid-edge retargeting completes
the reserved edge before planning the replacement goal. These remain WebRA2 D03
choices, not a reproduction of native continuous Walk movement or Stop timing.
There is no random slot allocation or animation-driven simulation.

Pending death retains its last slot for validating an already settled shared cell,
while denying new entrants. If a new pending death blocks an incoming reservation,
the core cancels that partial edge at its retained anchor and retries its saved goal
after the normal delay. Existing settled survivors remain. Completion releases only
the deceased actor; no unrelated foundation or survivor is removed. This cancellation
is an explicit D03 choice. The world derives retired IDs only from its validated
health/death state; save data cannot supply a retirement permission list.

Restore validates the complete old motion/combat schema first, then slot coverage,
ordering, active-edge reservations, bounded sharing and directed incoming relations.
A possible arrival ordering for settled one-way sharing is structural validation,
not authenticated historical execution. Replays reproduce the whole versioned
checkpoint, including slots, pending shots, death and random state.

## Bounds and verification

The existing command/path/actor/trace bounds remain. Slot indexes are built lazily
for actual supported path queries or new edges. A tick caps additional index/query
work at262144 logical units, charged before its guarded work and included in
`WorldStep.work.entityVisits` for aggregate/replay limits. Each index charges
`entities*4 + routeEntries + blockedCells + footprintCells + slotRows*2`; queries
charge one plus examined claims. This is a deterministic work budget, not a CPU or
heap measurement. Fatal per-tick, aggregate, trace or validation failures roll back
all requested ticks, commands, slots and random state.

Seven original integration tests cover both profiles, whole-cell regression,
complete base authority, cross-policy saves, moving restore/replay, Stop/retarget,
concurrent reservations and capacity, directed/unknown alliances, hostile saves,
source-bound firing/death composition, pending death in settled sharing, incoming
cancellation and rollback. They use fabricated maps/rules, never retail fixtures.

Private original-opening route, save/replay and Chrome evidence are separate gates.
The source/helper census in [the earlier report](analysis/infantry-passage-census.json)
records its own flat-world baseline and does not imply browser acceptance of this
new bound model. Actual loader adoption, changed-slot presentation and original
player Chrome passage remain pending integration work.
