# Mission house source and population ledger provenance

The original TypeScript source in `src/mission-house-*.ts` and original tests are
licensed GPL-3.0-or-later. This is a source/helper checkpoint for
[issue233](https://github.com/lictl/WebRA2/issues/233), not a complete native house
implementation. The module is not yet connected to the engine or browser.

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
complete function extents. The final machine-readable range ledger and independent
raw-field oracle remain acceptance work at this checkpoint.

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
