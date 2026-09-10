# Initial object combat-event dispatch

[Issue204](https://github.com/lictl/WebRA2/issues/204) connects initial object tags
to authoritative damage and destruction. Source/native interpretation and the
mission VM integration are in progress. This checkpoint does not admit another
mission opcode or make an original mission playable.

## Retained health observations

The world privately retains each completed combat health application with its
tick, attacker, target, weapon, applied damage and before/after health. Zero damage
is distinguishable from a positive loss; missed impacts do not create a record.
These are engine facts, not native mission callback names.

Only the exact returned WorldStep and its genuine WorldModel can retrieve this
immutable record through worldStepCombatObservations. The records are kept outside
the mutable public trace object; copying or editing that trace cannot invent
observations. No external observation list is accepted by a world step. The compound
mission runtime will consume facts from its own private world simulation.

Public traces, model/save formats, numerical simulation work and the existing hit
algorithm retain their shapes and behavior. Each retained record corresponds to
one already bounded hit/trace operation; the private list is also capped at the
existing world trace limit. Whole-call rollback prevents publishing observations
or world state when a later tick fails. The list describes completed steps and
does not become another pending save queue.

Four original fixtures verify ordered multiple-attacker damage, lethal saturation,
missed/dead-target behavior, descriptor/brand boundaries, split/restore equivalence
and late transaction rollback. Existing combat/death/world regressions are checked
separately. Static native callbacks, actor-family routing, predicate latch behavior,
complete source joins and compound every-boundary replay remain required before
the complete issue can merge. Retail evidence stays ignored under local/.
