# Initial cell-entry source authority

[Issue201](https://github.com/lictl/WebRA2/issues/201) authenticates event1 operands,
initial cell-to-shared-tag routes and the current world actor/house joins. The
[compiler](../packages/sim/src/mission-cell-entry-source.ts) takes only a genuine
`MissionBindingCatalog`; no event observations or replacement source fields are
accepted. `missionCellEntrySourceBindings` retrieves that same catalog. Copies,
JSON metadata and proxies around factory results do not carry this authority.

Event1's integer operand is a country allocation index. Paired native lookup scans
allocated houses in order and returns the first house whose type index matches.
The event compares the entrant's literal owner-house index to that first house;
a second house of the same country does not match. `-1` bypasses the selector but
still requires an entrant. The supported retained parameter form is exactly
`["0", integer]`; other modes, spellings and missing house references are retained
as unsupported. YR also writes the entrant house to the event instance on success;
RA2's paired path does not. The component retains the owner context and does not
mutate a native object or implement action consumers of that field.

`events` retains every event1 instruction and its original parameter tokens, row
origin, trigger ID and resolved selector. `cellReferences` retains every initial
source cell reference. `cells` is the supported coordinate index; any unresolved
reference contributes a whole-source diagnostic, preventing promotion by the VM.
Multiple cells pointing to one tag keep one shared `bindingId`. Scenario polling
comes only from `scenarioPollBindingIds`, not every cell tag. Source attachment
counts and the catalog's native-reference metadata remain separate from dispatch.

All model actors remain in `actors`. Ordinary mobile infantry and units with an
initial literal house join are supported under the current ground, uncloaked,
nontransport, fixed-owner world policy. A full 14-field source row, initial
OnBridge=0, and for units follower=-1 are required. Source mission, bridge, follower
and full origin remain in the audit row; rank/group/recruitment are not event1
selector operands. The source encoding must retain native bytes; decoded UTF-16
or UTF-8 BOM documents cannot grant source authority. Static or unavailable actors retain reasons
without poisoning otherwise valid event/cell source identity. The compound runtime
must reject an initially living movable actor without a supported route; it must
not silently omit its future arrival. Bridge layers, cloak transitions, capture,
transport, dynamic tags, dynamically spawned actors and changing ownership require
additional authenticated context. Walk arrival and class Foot update evidence
justify this bounded route, not native movement timing or every callback.

The compiler does not return an executable machine. Unknown unrelated events,
actions, teams and attachments remain subject to complete source/program preflight
in the existing VM. An event1-only source catalog cannot waive that gate.
`canStartCampaign` and `nativeBehaviorVerified` remain false.

Inputs and limits are captured through own enumerable data descriptors. All
expansion work is bounded before allocation or reference scans. Defaults permit
4,096 event1 records, 8,192 cells, 2,048 actors, 32,768 references, 262,144 work
units, 32,768 diagnostics and 16 MiB canonical serialized output. Existing genuine
source objects have their own upstream bounds. Limits may only be lowered and do
not change semantic fingerprints. New records are deeply frozen; source origins
and references are shared only from already immutable factory-owned objects.

Eleven original tests cover both profiles, shared tags, scenario memberships,
first-house versus same-country owner mismatch, wildcard and malformed operands,
unresolved references/types, stationary actors, brand/descriptor boundaries,
atomic limits, both BOM encodings, complete source rows, bridge/follower gates
and retained rank/mission fields. Runtime phase, rollback and save/replay
integration belongs to the coordinator's separate change; source tests alone do
not establish those behaviors.

A fresh private preparation read 438 selected files through the existing browser
catalog and source compilers. The [metadata census](analysis/mission-cell-entry-source-census.json)
contains hashes/counts only:

| Profile | Event1 references supported/total | Cell routes | Retained actors / ordinary mobile routes | Source scenario poll memberships |
| --- | --- | --- | --- | --- |
| RA2 | 18/18 | 180 | 811/58 | 86 |
| YR | 9/9 | 278 | 570/70 | 127 |

All observed selectors are specific first-country-house selectors; wildcard behavior
is covered by original fixtures. No initially living movable actor in this flat
source projection lacks route support. This census does not substitute for a fresh
compound check with another genuine world projection or a ground/slot extension.
The default VM preflight still returns null authority and 367/531 diagnostics
without the optional cue/cell adapters. Other required events/actions/scripts are
not filtered out to make these maps executable.

A separate Python oracle rehashes the selected complete archive roots and member
ranges, reparses the raw rules/mission INIs, reconstructs staged countries and
literal houses, native event/action attachment masks, shared groups, cell routes,
actor identity/owner/origins, every event1 selector and the complete source
fingerprints. It passes 55,976 assertions. Route status uses the already reviewed
genuine world mobility projection; this comparison does not independently repeat
terrain decoding or all typed-stat compiler evidence. The native ledger separately
rehashes 64 ranges/15,878 bytes from both full pinned executable images, checks
48 instruction-complete code ranges and validates vtable targets. No game program
was executed, and no retail rows/listings are public.

Private reproducible commands, run from this component or a reviewer checkout
with the private scripts copied into its ignored local directory:

```sh
node --import tsx local/probe201.mjs
python3 local/native201/oracle.py
python3 local/native201/ledger.py
```

The two Python commands use the private Capstone5.0.6 environment. The probe uses
relative imports into the current checkout and writes under `local/cell-entry201`;
its inputs remain under the read-only installation. The ledger generator writes
only factual public metadata and private listings. For a read-only review, compare
its generated ledger against the reviewed bytes before discarding that identical
regeneration. See [provenance](../packages/sim/MISSION_CELL_ENTRY_PROVENANCE.md).
