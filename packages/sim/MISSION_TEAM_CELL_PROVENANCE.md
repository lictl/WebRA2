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

The supplemental paired-image audit is being finalized for issue212. Already
inspected complete Unit constructor ranges are RA2 `6FA400..6FA7B4` and YR
`7353C0..735780` (end exclusive). They clear follower fields and copy type
Cloakable. Unit Put ranges `6FC940..6FCA28` and `737BA0..737C88` show why a zero
constructor cloak state alone is insufficient: a cloakable unit can enter state2
during placement. Walk/Drive bridge updates, rank CLOAK ability consumers and the
cell provider mask are additional context boundaries. No executable was run.

`webra2-independent-ground-team-cell-1` is an explicit limited world invariant,
not a proof that native autonomous behavior never changes those fields. It requires
the genuine retained flat traversal, no admitted overlay cells, known independent
Walk/Drive source types, no passenger capacity, no type/rank cloak capability and
no initial cloak provider. Dynamic transport, follower attachment, ownership,
crates, providers, other locomotors and native constructor RNG remain outside this
capability. Initial placement and future constructor checks remain separate.

The [focused report](../../docs/mission-team-cell-context.md) describes factory
identity, bounds and the distinction between validated save history and actual
transaction events. The supplemental native ledger and independent private source
comparison are pending at this implementation checkpoint; source integration must
not treat the checkpoint as completed native evidence or campaign acceptance.
