# Team construction and cell context provenance

The original `src/mission-team-cell-*.ts` components and their original synthetic
tests are GPL-3.0-or-later. They compose the existing GPL source, construction,
veterancy, team and cell-entry components with the separable MIT world core.
Redistribution must preserve these notices and provide corresponding source.
Retail data, native listings and private outputs are not distributed.

The component reuses the inspected source order and constructor dispatch in
[TEAM_SPAWN_PROVENANCE](TEAM_SPAWN_PROVENANCE.md), initial cell-entry consumers in
[MISSION_CELL_ENTRY_PROVENANCE](MISSION_CELL_ENTRY_PROVENANCE.md), type-stage
reconstruction in [COMBAT_ACTORS_PROVENANCE](../content/COMBAT_ACTORS_PROVENANCE.md),
the `Passengers` interpretation in
[COMBAT_DEATH_PROVENANCE](../content/COMBAT_DEATH_PROVENANCE.md), and the ability-list
parser in [COMBAT_VETERANCY_PROVENANCE](../content/COMBAT_VETERANCY_PROVENANCE.md).

Primary layout references at YRpp commit
`61d0887eb6040cfb36af16d592e9770ceae4dfb2` include
[ObjectClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectClass.h),
[FootClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/FootClass.h),
[TechnoClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoClass.h),
[UnitClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/UnitClass.h), and
[BuildingClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/BuildingClass.h).
They are locator/layout references, with no established license grant for that
pin and no code copied from them. This component's GPL license is WebRA2's own
license choice, not a claim about YRpp's license.

The supplemental [paired-image ledger](../../docs/analysis/mission-team-cell-native.json)
records 56 ranges/19,425 bytes: 48 complete instruction spans and 8 data spans.
The private PE/Capstone audit verifies both whole image hashes, range mappings,
actual Put vtable targets, source keys and 77 scalar/boundary assertions.
Inspected complete Unit constructor ranges are RA2 `6FA400..6FA7B4` and YR
`7353C0..735780` (end exclusive). They clear follower fields and copy type
Cloakable. Unit Put ranges `6FC940..6FCA28` and `737BA0..737C88` show why a zero
constructor cloak state alone is insufficient: a cloakable unit can enter state 2
during placement. Walk/Drive bridge updates, rank CLOAK ability consumers and the
cell provider mask are additional context boundaries. RA2 Put slots use +D4 while
YR uses +D8; the ledger verifies each actual table value. The paired event1 Foot
callers differ: RA2 contains a local cloak-state 2 exclusion, while the inspected
YR branch retains the bridge condition without that same local cloak check.
The component's uncloaked invariant is an explicit narrower shared policy, not a
claim of identical native branches. No executable was run.

`webra2-independent-ground-team-cell-1` is an explicit limited world invariant,
not a proof that native autonomous behavior never changes those fields. It requires
the genuine retained flat traversal, no admitted overlay cells, known independent
Walk/Drive source types, no passenger capacity, no type/rank cloak capability and
no initial cloak provider. Dynamic transport, follower attachment, ownership,
crates, providers, other locomotors and native constructor RNG remain outside this
capability. Initial placement and future constructor checks remain separate.

The [focused report](../../docs/mission-team-cell-context.md) describes factory
identity, bounds and the distinction between validated save history and actual
transaction events. The independent raw-field oracle checks 19,756 assertions
against eight verified members in five rehashed roots. Existing reviewed constructor
visit selection and world geometry are inputs to that oracle, not newly rederived
native behavior. Both complete opening capabilities remain false. Neither static
evidence nor deterministic WebRA2 component replay establishes native execution or
campaign acceptance.
