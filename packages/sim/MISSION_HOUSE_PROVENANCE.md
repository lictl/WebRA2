# Mission house source and population ledger provenance

The original TypeScript source in `src/mission-house-*.ts` and original tests are
licensed GPL-3.0-or-later. This is a source and ordinary world checkpoint for
[issue233](https://github.com/lictl/WebRA2/issues/233), not a complete native house
implementation. Its opt-in engine composition is described below; the browser
remains unconnected; ordered compound VM adoption is covered by the
[dispatch record](../../docs/mission-house-dispatch.md).

The implementation reuses the already reviewed source/identity components in
[entity definitions](../content/ENTITY_DEFINITIONS_PROVENANCE.md),
[combat actors](../content/COMBAT_ACTORS_PROVENANCE.md),
[mission bindings](MISSION_BINDINGS_PROVENANCE.md), and the original bounded
source-view, descriptor and canonical-hash helpers. No original game bytes,
listings, names, population data or screenshots are distributed as fixtures.
YRpp layout interfaces at the previously reviewed pin
`61d0887eb6040cfb36af16d592e9770ceae4dfb2` supplied research leads; those comments are
not proof of the RA2 behavior and no YRpp implementation was copied.

## Static image identity and inspected consumers

The read-only image SHA256 pins are RA2 game.exe
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and YR gamemd.exe
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
The installation build label remains unverified. Native executables were not run.

The ranges below are half-open inspected instruction blocks, not assertions about
complete function extents. The [machine-readable ledger](../../docs/analysis/mission-house-native.json)
pins 91 code/data records (60 complete instruction spans and 31 data spans),
24,134 summed bytes and 80 explicit key/store/pointer assertions. Range hashes
include overlapping inspected context where necessary; the byte sum is not a
unique-byte census. Both complete source images are rehashed before decoding.

| Evidence | RA2 virtual address | YR virtual address | Interpretation |
| --- | --- | --- | --- |
| Action14 | 0x6ae239–0x6ae2aa | 0x6e0aa0–0x6e0b53 | Scan Techno array, alive/on-map/not-limbo filters, tag contains firing trigger, virtual ownership change. |
| Action36 | 0x6ae2aa–0x6ae2ff | 0x6e0b60–0x6e0c94 | Match current owning house. YR defers Powered/PoweredSpecial buildings to a second pass. |
| First country house | 0x4ed760–0x4ed790 | 0x502d30–0x502d60 | First allocated house whose country index matches the operand. |
| Population consumer region | 0x6e6619–0x6e6705 | 0x71f069–0x71f218 | Events9/11 use raw registered unit/infantry counts in RA2, stored prerequisite Counter totals in YR. Event10 uses raw building count. Aircraft do not participate. |
| Raw registration gain | 0x4ea970–0x4eaae7 | 0x4ff700–0x4ff8cc | Both profiles skip Insignificant; YR also skips DontScore. |
| Raw registration loss | 0x4ea800–0x4ea93d | 0x4ff550–0x4ff6d3 | Complementary raw removal and type-counter changes; YR infantry has explicit absorption/count flags. |
| Building category | 0x4527e0–0x4527ff | 0x465d40–0x465d6e | RA2: non-null UndeploysInto and not ConstructionYard. YR: non-null UndeploysInto and 1×1 dimension table. YR raw registration additionally recognizes a ResourceGatherer undeploy target. |
| Core ownership change | 0x6cd940–0x6cdbe0 | 0x7014a0–0x701896 | Counter changes surround current owner assignment; targeting, missions, occupation, teams and other subsystems also change. This helper does not claim to implement that entire virtual method. |

YR Counter increment/decrement/get-total helpers are respectively
0x49fa00–0x49fa64, 0x49fa70–0x49fad4 and 0x49fb60–0x49fb64.
They maintain stored totals; they do not count health-positive objects on demand.
YR infantry gain checks the runtime technician flag and DontScore. Unit gain lacks
the DontScore check that its loss path has. Therefore DontScore unit types require
historical residual counters and are unsupported by this symmetric participation
ledger. Neither opening's currently loaded registry contains such a type.

Insignificant, DontScore, ConstructionYard, Powered, PoweredSpecial and
ResourceGatherer use incoming property-stage INI reads and fresh constructor
defaults. UndeploysInto retains its previous pointer on an absent/empty read and
recognizes the native none sentinels. This checkpoint resolves only exact retained
unit spelling; an unknown allocation or case-variant target does not supply a
fabricated ResourceGatherer value. Foundation dimensions come from genuine typed
definitions, not footprint bounding boxes.

## Boundaries

The helper requires explicit ordinary participation facts. It does not infer
registration, limbo, absorption, technicians, production, defeat reset, capture
animation, trigger-house mutation or native counter timing from health. Its
source catalog and transfer plans are same-realm capabilities, not authorization
for an arbitrary UI invocation. Current-trigger-house selector8997 requires
separate current VM context. Scenario multiplayer selectors remain unsupported.

Native counters can retain exceptional historical values and can become negative
outside the supported lifecycle. No imported native save is accepted. The new
ledger schema does not reinterpret old WorldSave hashes; canonical owner state,
engine policy/version, commands, alliances, slots, teams, combat and mission
transactions must be integrated and independently reviewed before use.


## Opt-in world ownership policy

`world-ownership.ts` and the coordinated world/combat/replay changes bind this
genuine source catalog to the complete unbound world identity. World-8 stores
current owner on each entity, explicit lifecycle boundaries, ordered transfers
and saved counters; initial definition ownership remains source metadata. Older
engine/model/save identities are preserved when the optional binding is absent.

The native ownership selectors and counter predicates above motivate this
composition; its transaction order and health lifecycle are explicit WebRA2 D03
policy. A pending human death remains registered/present until logical sequence
completion. Its damage-time owners stay recorded after later transfers. Current
command authority and hostility change atomically with the counter transition.
Shared infantry uses the current-house policy described below. Native limbo, technician conversion, capture
side effects and imported counter history are not implied.

The exact-result receipt proves a completed component transaction and its source,
model and before/after saves. It does not prove that a mission trigger executed;
the compound VM must authenticate instruction emission and caller house context.
Eight new original world cases plus legacy checks pass 61 focused tests and
type checking. The final static ledger accompanies this checkpoint; the focused report records
the separate raw projection and composed validation. Independent review remains
a merge gate.


Current-house numerical composition reuses the genuine retained bridge table and
the reviewed [house modifier](../content/COMBAT_MODIFIERS_PROVENANCE.md),
[veterancy](../content/COMBAT_VETERANCY_PROVENANCE.md) and
[native arithmetic](NATIVE_COMBAT_NUMBERS_PROVENANCE.md) evidence. The ownership
consumer above assigns the current house pointer without resetting the retained
ordinary actor factors; this bounded policy excludes the unmodeled capture and
status effects. Each future house factor combination is checked before the model
is published. Original actor/veterancy factors are preserved. Campaign house
firepower/reload and current-country infantry armor are selected independently,
matching their already reviewed consumers rather than multiplying every country
field. Saved schedules/deaths validate against historical owners at damage time.

The content death selector continues to authenticate original source/type/current
weapon eligibility. The bridge then binds its returned attribution to validated
current house IDs; it does not relabel the underlying placement or mutate an
earlier death. Five additional original source/numerical cases cover this seam,
including all mixed-house pairs and transferred pending deaths. The combined
focused world/source combat suite passes 84 tests and type checking.


Native FireActions passes its source House from TriggerType owner-country lookup
for each action: RA2 0x6ed830–0x6ed896 and YR 0x7265c0–0x726626. This is distinct
from YR Trigger+0x2c, initialized null at 0x725fb5. RegisterEvent
0x7264c0–0x7265bb copies a non-null TEvent+0x54 value after individual success or
an already latched predicate. It can update before whole-trigger success, and
force bypass skips that update loop. Detachment 0x726690–0x7266be clears a matching
house pointer. The event1/24/25/26/59 success branch 0x71f1bd–0x71f218 records the
observed object's virtual owning house. This source context requires independent
saved event/trigger state; a caller label or initial house is not equivalent.
The nullable world invocation preserves that absence. The bounded transfer helper
rejects a null8997 target instead of fabricating a target house.

## Current ownership and retained infantry slots

The independently reviewed [infantry passage evidence](INFANTRY_PASSAGE_PROVENANCE.md)
establishes ordinary subcells and directed mover-house admission. The ownership
consumer above supplies the mutable actor house; initial catalog ownership remains
source metadata. Current queries, group planning and generated team commands read
the validated current owner. This does not establish native team membership after
capture; that separate source/runtime integration remains pending.

Capture preserves settled anchors and cancels newly hostile incoming edges. A
group rendered hostile by capture receives a bounded saved claim referencing the
exact source transfer, a compatible pre-transfer owner order (or exact initial
source sharing) and distinct ordinary
subcells. Only surviving members at those cells/slots remain covered. Claims are
checked with full current occupancy and cannot replace static blockers or grant
retirement. Restoration checks structural possible history, not authenticated
historical execution; full replay provides the separate execution comparison.

The group is closed to new arrivals until it becomes allied or members separate.
Even a third house allied to each member cannot join while it remains closed.
This is a conservative D03 rule, not a claim about native mixed-owner cell-house
bookkeeping. Initial shared cohorts captured in place retain the same closed
marker; restoration rejects omission of that marker. Eight original tests cover
capture, reservations, group preflight,
pending/completed death, strict save rejection and replay in both profiles.
