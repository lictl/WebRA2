# Mission ownership and house population

State: **WORKING — source/helper and initial world-8 checkpoint for
[issue233](https://github.com/lictl/WebRA2/issues/233)**, following the
[first-mission audit](https://github.com/lictl/WebRA2/pull/232). No engine, VM,
browser, campaign authority or serialized WorldState behavior changes yet.

`compileMissionHouseSource({bindings, definitions, rules, mission})` owns and
verifies mission bytes and joins genuine binding/type/world identities. It retains
every action14/36 and event9/10/11 occurrence, exact operands, source house
resolution, type contributions and original tag chains. Rule-layer hashes remain
upstream verified-source identities; an arbitrary hash label is not file access.

The original helper creates an immutable house ledger from one explicit
participation row per initial actor. Initial type, owner and tag come from source.
Births use monotonic IDs; removal retains tombstones. Registered and present
participation are separate, with no health-based inference. Changes are atomic,
work-bounded and serializable; every original fixture transition is restored and
replayed. Saved counters are retained and checked against the supported ordinary
participation invariant; a supplied historical total is never silently discarded.
Unsupported type contributions return an unsupported population query,
never an invented zero.

Action14 selects eligible tagged actors even when their current owners differ.
Action36 selects all existing actors of the caller's current house, including
ordinary registered actors temporarily absent from the map. YR powered buildings
retain the native second pass. Only changed owners are returned for downstream
order/target invalidation. The helper's stable entity-ID order is a WebRA2 policy;
native mutable-array history is not imported. Selector8997 uses explicit current
trigger-house context, not the initial source house. Dynamic tag reassignment and
unregistered ownership-change contexts remain unsupported.

RA2 population events use raw registered counts. YR events9/11 use stored
unit/infantry Counter totals while event10 still uses raw building count.
Insignificant, DontScore, deployable-building classification and ordinary
non-absorbed/non-technician lifecycle prerequisites remain explicit. YR's
asymmetric DontScore unit gain/loss path requires historical residuals and is
outside this helper; neither loaded opening registry contains that case.
See [the provenance record](../packages/sim/MISSION_HOUSE_PROVENANCE.md).

## Checkpoint validation and next integration

The opt-in world-8 checkpoint now binds the genuine source to the complete base
world hash. `WorldEntityDefinition.owner` remains initial source metadata;
`WorldState.entities[].owner` is current ownership. Saves retain lifecycle
boundaries, population totals and bounded source-instruction transfer history.
Restore reconstructs exact action selection and current owners from that history;
it rejects altered totals, omitted selected actors and unrecorded owner changes.
Old models omit ownership entirely and retain their former model/save hashes.

`WorldSimulation.transferOwnership` changes a detached candidate, clears the
transferred actors' movement/targets, cancels newly allied target orders and
affected logical projectile work, then validates the entire candidate before
commit. `housePopulation` reads the current source-bound counters. Private receipt
lookup binds an exact returned transaction to the model and before/after saves;
the caller must still authenticate mission instruction execution. Replay version2
records command admissions and transfers in one explicit ordered sequence,
including multiple operations at the same tick; version1 remains unchanged.

This checkpoint applies the existing WebRA2 world lifecycle: initially health-zero
actors are absent; ordinary pending human deaths retain registration/presence
until sequence completion. Tag selection excludes pending deaths, while house-wide
transfer can include them. Damage attribution preserves the owners at the damage
tick through subsequent captures. These are explicit D03 lifecycle decisions;
native limbo, absorption, technician conversion and imported native counter
history are not inferred. Eight new original world tests plus existing movement/combat/death/replay
cases pass 61 focused tests and type checking. These include exact minimum and
one-lower work limits, private receipt identity and current population queries.

Current-house source combat now composes the genuine bridge's retained house
modifier table. Campaign house firepower/ROF come from the selected difficulty;
the country's general Firepower/ROF fields are not incorrectly multiplied into
those values. Current country ArmorInfantryMult applies at damage time. Actor and
veterancy factors remain attached to the actor. Bounded preflight covers every
represented house and all positive damage/reload outcomes before enabling this
model. Saved reloads use the house at their shot tick, while existing cooldowns
survive capture. Death source/type/current-weapon eligibility still uses genuine
initial source identity; the resulting attribution joins validated current house
IDs separately. Later transfers never rewrite recorded death owners.

Three additional source-bound scenarios cover both profiles and transfer before
windup, during reload and after lethal damage, with every-boundary restore and
replay. Two numerical boundary cases compare all mixed-house source/target pairs
against the reviewed eager factor composition and exercise descriptor ownership,
invalid factors and overflow rejection. Together with the existing world/source
combat cases, all 84 focused tests and type checking pass.

Retained captured infantry subcell claims are the next active integration
increment. The model factory still refuses ownership plus shared-slot models
until those consumers are implemented. Team construction/recruitment ownership, compound
mission actions/events and browser exposure also remain pending. This checkpoint
does not admit an original mission or change the application's active model.

The new original source/state tests cover both profiles, exact operands, profile
counter differences, tag versus house selection, powered-building order,
construction/removal/absence/transfer, aircraft exclusion, current-trigger-house
selection, unsupported fields, descriptor ownership, bounded failure and
save/restore/replay. Type checking and all 14 focused tests pass. These are synthetic
checks, not original campaign execution.

The private source preparation rereads the 438-file on-device catalog. It retains
all 8 ownership/4 population occurrences in the RA2 opening and 26/12 in YR; all
operands resolve, with no source diagnostics. All 120/143 placed type contributions
are supported in these source preparations. The private source/native ledger,
independent raw-field census, full final checks and independent review are still
being completed. All game inputs and resulting source records remain ignored in
`local/`.

The coordinator has delegated the existing simulation ownership consumers to this
worker. The current checkpoint updates world model/state/replay and core hostility;
source `definition.owner` remains initial identity. Remaining current-house
combat, shared-slot, team and compound mission consumers are coordinated next.
Root retains the mission VM/bindings/compound world and shared configuration.
The complete original mission remains gated by the other dependency groups in
the audit.


For action36, the source-house invocation argument is the first house for the
firing TriggerType's owner-country, rebuilt by native FireActions. It is separate
from YR's current-trigger-house selector8997. The latter starts null; native
RegisterEvent retains the last non-null event house for an individually true or
already latched event, even if another predicate prevents the trigger from firing.
Force bypass retains it, and matching pointer detachment clears it. The component
invocation and saved receipt accept null and never replace it with house zero.
A null8997 target is not an admitted transfer. Compound execution must retain a
separate saved event/trigger-house context before enabling that selector.
