# Mission ownership and house population

State: **WORKING — source/helper checkpoint for
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

The next coordinated diff must put current ownership in canonical WorldState and
WorldSave, version the affected engine policy, and consume it for player command
admission, hostility, slot allocation, combat, team claims, object/cell callbacks
and rendering snapshots. Source `definition.owner` remains initial identity.
Transfers must commit those consumers and the population transition atomically;
changing this ledger alone cannot execute a mission ownership action.

No shared engine or contract file has been edited in this worker checkpoint.
Root owns that integration until an explicit sim-path handoff. The complete
original mission remains gated by the other dependency groups in the audit.
