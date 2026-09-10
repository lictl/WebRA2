# Trigger forcing and deletion in the mission VM

[Issue182](https://github.com/lictl/WebRA2/issues/182) extends the explicit-binding
[mission interpreter](mission-logic-runtime.md) with named-target action12 deletion
and action22 forcing. Action55 is a radar event and remains unsupported. The first
triage confused these IDs; the actual dispatch tables and opening-source census
correct that assumption. Neither opening contains action22. The RA2 opening has
one action12 whose operand now passes this component's preflight. Both full opening
programs still reject unsupported required instructions and team integration.

## Native evidence and the implementation boundary

The [paired native ledger](analysis/mission-lifecycle-native.json) records34 selected
code/data ranges totaling3796 bytes from the two pinned images. Every selected code
range ends at a decoded instruction boundary. This includes both dispatch entries,
action12/22/53/54/55 slots and branches, named-target loaders, trigger constructors
and FireActions. The new YR constructor range ends at726133, including the full
three-byte return; the older component's726131 range stopped within that return.
No retail program ran, and listings remain private.

Both force branches iterate existing trigger instances of the named type and call
FireActions directly. They bypass event evaluation and the repeating-tag timer
reset in RegisterEvent. FireActions checks enabled/deleted state once on entry,
then follows the source-ordered action list; self-disable does not truncate that
already entered list. Force does not instantiate a missing tag, satisfy predicate
observations, or apply the once-tag removal path in RaiseEvent.

Deletion differs between profiles. RA2's action12 invokes the instance's scalar
destructor immediately; the pinned vtable slot and scalar-delete body show pointer
expiration, removal from global arrays and conditional deallocation. YR marks the
instance destroyed and appends it to a deferred list. The native host's pointer
expiration callbacks, shared instance allocation and cleanup phases are **not**
implemented by this component. They remain requirements of the source attachment
adapter. In particular, continued RA2 self-deletion execution is not established
as safe native behavior by the already entered FireActions loop.

The VM uses explicit caller-provided bindings as before, with a deliberate D03
policy: delete all active bound instances of the selected type using saved logical
tombstones; suppress later entry immediately; retain an already entered immutable
action list until return; deactivate a binding at the tick boundary when every
member is deleted. This models bounded control effects without emulating a native
freed pointer. It is not a claim of native RA2 destructor/attachment equivalence.
Native future attachment creation, reuse, deletion callbacks and general world
side effects still prevent campaign admission. Both nativeBehaviorVerified and
canStartCampaign remain false.

## Ordering and saved state

The new policy is `webra2-mission-poll-2`. Named selectors retain the existing
mode2 and minimum-three-character closure; missing or unsupported operands block
the whole program. Existing required unknown instructions are never skipped.
Targets use active bindings in stable binding-ID order and their existing compiled
chain order. That instance ordering remains D03, not native container-order proof.

Force records its invocation before nested effects, then visits each eligible
instance with a depth-first explicit stack. Nested effects complete before the
caller's next action. A forced instance increments `forced` without incrementing
its predicate-poll `fired` counter, resetting elapsed timers, modifying observations
or consuming a once tag. It can still fire later through ordinary polling.
Deleted or disabled instances cannot be entered. Difficulty remains enforced by
the existing enablement rules. Retained action lists complete under the D03 rule
above even if an action disables or deletes their instance.

Saves add `forced` and `deleted` per trigger. `destroyed` remains the visible
suppression state, caused by a normal once-tag fire or explicit deletion. Validation
checks the source program contains the corresponding target action before accepting
nonzero forced counts or deletion tombstones; counts, tag activity and destruction
states must agree. As before, structural save validation is not a proof that an
arbitrary edited state was historically reached. At tick0 the entire initial
blueprint must still match. Poll1 checkpoints reject by policy identity; there is
no silent migration or original Windows save import.

At most256 action/force frames can be active. Force-target lists share the bounded
instance index; nested execution does not recurse on the JavaScript call stack.
All invocation/target/action traversal is charged to existing work and effect
limits. A cycle, fanout overflow or later failure rolls back the complete requested
multi-tick call, including earlier flags, queued inputs, effects and counters.
No callback, I/O, renderer, clock or RNG enters the interpreter.

## Validation

Eight new original tests run both profiles: nested effect ordering and untouched
predicates/timers; multiple instances and disabled/difficulty/deleted targets;
self-disable; logical self/other deletion; bounded cycles; wide acyclic effect
exhaustion; every-boundary save/restore and pending-input replay; exact target
closure and the action55 distinction. The13 existing mission-runtime tests pass.
These are VM fixtures, not original-game observations.

A private source recompile rehashes the two opening-map byte snapshots, reproduces
the complete ScenarioLogic projections and compares opcode counts with interpreter
coverage. RA2 has130 trigger definitions and one supported action12 occurrence;
YR has334 definitions and no action12. Both have zero force22 occurrences. Their
40/11 radar55 occurrences remain unsupported, and both complete programs remain
unexecutable. No source rows, coordinates or localized text are published.

Private reproduction: `node --import tsx local/source182.mjs` and the pinned
Capstone5.0.6 Python with `local/ledger182.py`. The source snapshots originate from
the verified recruitment probe; this is not a fresh full-folder import or a native
playthrough. An independent exact-head review and public CI are required before
merge. Ground183, infantry passage180, campaign chooser179 and source trigger/world
activation remain parallel work.
