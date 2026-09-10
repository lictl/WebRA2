# Source cell-entry dispatch

[Issue201](https://github.com/lictl/WebRA2/issues/201) connects initial cell tags to
successful authoritative movement. This component requires the genuine source
cell-entry catalog and whole mission preflight. It never removes unknown required
instructions to create a playable opening.

The optional source catalog is passed to `prepareMissionBindings` after the cue
catalog, or to the generic program compiler as its fifth argument. Every event1
instruction must match the genuine source trigger, exact operands and resolved
selector. All source event1 rows must remain represented. Unsupported selectors,
source identity diagnostics and other required unsupported operations keep authority
null. The catalog and phase policies are included in optional model identities;
ordinary programs and world models keep their previous shapes and hashes.

## Native entry and WebRA2 phases

The paired native entry code uses the event's country index to find the first house
with that country. The entrant must belong to that exact house. The -1 selector
admits any supported entrant. A different house of the same country does not match.
The source adapter records ordinary initial ground, uncloaked, nontransport and
unchanged-ownership context; dynamic cell tags and other native movement callbacks
remain unsupported.

The [runtime range ledger](analysis/mission-cell-dispatch-native.json) contains
16 selected code/data ranges totaling 2,014 bytes from the pinned RA2/YR images.
RegisterEvent examines the linked events in reverse source order, combines their
truth values and prepares repeat timers before firing actions. Although event1's
success path writes its persistence byte, the subsequent StateB gate returns false
for event1 in both profiles. It therefore does not accumulate an occurrence latch.
The existing supported polling predicates also remain transient observations.
A crossing before an elapsed predicate is due does not satisfy a later poll.

The named optional phase policy is
`webra2-world-cell-events-before-scenario-poll-1`. For each logical tick it:

1. Advances the authoritative world, including its existing command, navigation,
   movement and combat phases.
2. Applies due VM flag inputs, then delivers successful movement transitions in
   world trace order to their initial cell bindings.
3. Polls only source scenario-list bindings, then advances the mission clock.

This is an explicit D03 phase choice. It does not reproduce native callbacks
interleaved inside each object's update. Existing models without the optional
source catalog retain their prior VM-poll-before-world order. World and VM traces
remain separate ordered outputs. Cell delivery may invoke one repeating binding
multiple times in a tick; its counter is bounded separately from the tick count.

Each delivery uses the same reverse trigger chain, predicate evaluation and ordered
action invocation as polling. Force, enable/disable and logical deletion retain
their existing semantics. Once bindings become inactive under the existing D03
logical lifetime policy; no native pointer cleanup, ownership transfer or cell
attachment mutation is claimed. YR's native event/trigger house-pointer update is
not reproduced as pointer mutation. The currently admitted fixed-operand controls
and presentation requests do not consume that pointer; future owner-dependent
operations need a separate implementation.

## Authority, saves and limits

`MissionLogic.stepCellEntries` is an explicit generic data-input API for one VM
tick. Its input is not proof that an actor moved. The compound adapter never accepts
such a list from a caller: it creates entries from its own private world simulation's
`movement/moved` transitions and genuine source cell/actor joins. Picks, reserved
cells, progress and already-at-destination arrivals do not deliver events. Unsupported
initially alive movable actor contexts prevent compound model creation.

The VM bounds deliveries to 8,192 per call and charges source indexes, observation
validation and dispatch work under its existing work/output limits. Compound work,
trace and presentation payload limits apply across all requested ticks. Failures
publish neither a partial world nor a partially changed mission or cue cursor.

No pending delivery queue is needed: both clocks reach the same boundary after each
complete tick. Compound checkpoints pin source, program, bindings, flags and final
world identity, and retain the ordinary source blueprint and transient observations.
Generic mission replay accepts only flag inputs and therefore explicitly rejects
cell-enabled programs; use compound world replay to rederive the movement observations.
Noninitial edited saves remain structurally validated rather than historically proved.

## Validation status

Seven original both-profile runtime fixtures pass, together with seven initial
source fixtures and 31 existing binding/compound/cue tests (45 focused tests total).
They cover source joins, owner matching, shared cells, transient mixed predicates,
multiple entries, nested force/deletion, atomic failure and every-boundary
save/replay. Type checking passes. Fresh private source coverage, final source actor
context audit and exact-head independent review remain required before merge. No original campaign execution or browser acceptance is
claimed by this component.
