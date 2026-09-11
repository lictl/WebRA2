# Mission ownership and house population

State: **WORKING — ordinary world ownership and mission callback checkpoint for
[issue233](https://github.com/lictl/WebRA2/issues/233)**, following the
[first-mission audit](https://github.com/lictl/WebRA2/pull/232). The optional engine
policy changes current ownership and serialized WorldState. Source-ordered
compound VM actions, population predicates and initial actor callbacks are
composed; dynamic teams, browser exposure and whole-campaign admission remain
separate gates.

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

## World ownership and source consumers

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

Ownership now composes with genuine infantry slot catalogs. Movement queries and
group destination planning use validated current owners. A transfer cancels newly
hostile incoming reservations at their existing anchors. Existing settled infantry
keep their coordinates and subcells, including pending deaths. The slot-binding
adapter preserves ownership when it reconstructs the model; initial definitions
and all static blockers remain unchanged.

A hostile group created by capture retains a bounded saved claim tied to a genuine
transfer index, pre-transfer house compatibility (or exact initial source sharing),
exact cell/subcells and surviving
members. Claims shrink on departure or completed removal and cannot authorize
re-entry. Restore checks a structurally possible history; it does not prove that an
untrusted save replayed every historical movement. Complete current occupancy,
distinct slots, source archetypes, static blockers and transfer selection are
validated separately. These records grant no public actor-retirement permission.

Under this explicit D03 rule, a retained hostile group is closed to all new
arrivals, including a third house allied to every member. Incoming reservations
are canceled when a capture closes the cell. Existing actors may hold or leave;
normal admission resumes when the remaining group is allied or has fewer than two
members. Initial shared cohorts follow this same rule after capture; a restored
save cannot omit their closed marker to admit an invalid third-house edge.
This avoids inferring native mixed-owner cell bookkeeping. Eight original
tests cover both profiles, two/three-member groups, directed alliances, group
planning, forged claims, pending death, minimum budgets and complete replay.
The combined ownership, movement, source combat, passage and team-world regression
run passes 117 focused tests; type and documentation checks also pass. These are
original synthetic checks, not imported mission execution.

The [ordered mission integration](mission-house-dispatch.md) applies transfers
before later same-invocation predicates, including current entrant/attacker house
checks on genuine movement/health callbacks. Failed compound work publishes
neither VM nor world changes. Dynamic team construction/recruitment ownership,
YR8997 saved event-derived house and browser exposure remain pending under233.
This checkpoint does not admit an original mission or change the application's
active model.

The new original source/state tests cover both profiles, exact operands, profile
counter differences, tag versus house selection, powered-building order,
construction/removal/absence/transfer, aircraft exclusion, current-trigger-house
selection, unsupported fields, descriptor ownership, bounded failure and
save/restore/replay. Type checking and all 14 focused tests pass. These are synthetic
checks, not original campaign execution.

The private source preparation rereads the 438-file on-device catalog. It retains
all 8 ownership/4 population occurrences in the RA2 opening and 26/12 in YR; all
operands resolve, with no source diagnostics. All 120/143 placed type contributions
are supported in these source preparations. With the reviewed cue/audio/spatial,
cell, object and partial team sources, the exact house occurrence joins reduce
required diagnostics from 197 to 185 in RA2 and 437 to 399 in YR. Both complete
mission authorities remain null; unrelated unsupported declarations are preserved.
All game inputs and resulting source records remain ignored in `local/`.

The [metadata census](analysis/mission-house-census.json) records 58,158 independent
raw comparisons (25,045 RA2 and 33,113 YR), with five complete root hashes and
eight member hashes verified again. The Python oracle reparses original INI bytes
and compares seven field values/defaults/history across 1,222 types, population
categories, first-country-house selection, 1,381 initial actor joins and all 50
house instruction occurrences. Previously reviewed construction visit origins,
foundation dimensions, tag allocation and world row ordering are explicit inputs
to this oracle; those mechanisms are not independently reconstructed here.

The [native ledger](analysis/mission-house-native.json) contains 91 inspected
records: 60 complete instruction spans and 31 data spans, totaling 24,134 bytes
including overlapping context. It verifies 80 explicit key/store/dispatch
assertions and rehashes both complete executable images before static decoding.
No retail executable is run. The event9/10/11 and action14/36 dispatch tables bind
the opcode numbers to the inspected consumers; labels alone are not evidence.

Private reproduction in this worktree uses `local/probe233-final.mjs` (Node24 with
`--import tsx`), then `python3 local/oracle233.py`, and the existing Capstone
environment's Python with `local/native233/ledger233.py`. The probe writes
`local/mission233-final/`; the ledger writes only `local/native233/ledger-final.json`
and private listings. Public metadata is copied separately after review. No
private sample, extracted text, actor identifier or coordinate is published.

The final composed `npm run check` passes 1,427 public tests, five performance
harness tests and nine GPU harness tests, with type checking, 210 document files /
1,094 local links, 768 publication paths and the M0 metadata guard. The build emits
79 code/license outputs from 188 approved inputs. These public checks use original
fixtures; the source/native evidence above is separate. Browser ownership controls
and original mission execution have not been exercised by this change.

The coordinator has delegated the existing simulation ownership consumers to this
worker. The current checkpoint updates world model/state/replay and core hostility;
source `definition.owner` remains initial identity. Current-house combat and
shared-slot consumers and ordered initial-actor mission callbacks are implemented.
Dynamic team consumers remain coordinated follow-up work.
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
