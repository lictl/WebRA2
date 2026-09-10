# Source-bound combat composition provenance

[combat-weapons.ts](src/combat-weapons.ts) and its
[original fixtures](../../tests/sim/combat-weapons.test.ts) are original
GPL-3.0-or-later WebRA2 composition, Copyright 2026 WebRA2 contributors. They
consume the reviewed typed weapon graph; retain the
[weapon-definition notice](../content/WEAPON_DEFINITIONS_PROVENANCE.md),
[entity notice](../content/ENTITY_DEFINITIONS_PROVENANCE.md) and their pinned
primary references. No new external implementation or dependency is adopted.

The factory binds the input fingerprints and source histories, and produces an
explicit standing, invisible, single-shot direct-damage model. Its eligibility,
bounds, exact factor representation and omissions are original WebRA2 choices.
The reviewed native parser/default/load evidence belongs to the upstream typed
compiler; it does not establish native firing, target selection, damage rounding
or animation-side effects. See [the execution policy](../../docs/world-combat.md).
The result does not start a campaign or authenticate supplied source files.

The separable [combat model](src/combat-model.ts), [combat core](src/combat.ts),
[world](src/world.ts) and [replay](src/world-replay.ts) remain original MIT
implementations. Combined distributions retain this notice, upstream notices,
GPL text and corresponding source/build materials described in
[licensing](../../docs/licensing.md). Public tests contain original synthetic
rules and actors. No retail rules, geometry, assets, native bytes or saved state
are distributed.

The original GPL [placement admission helper](src/combat-placement.ts) and
[its fixtures](../../tests/sim/combat-placement.test.ts) consume the upstream
[scenario object contract](../content/src/scenario-objects.ts). Its new static
field/buffer/decimal/rank observations are pinned in the
[metadata-only ledger](../../docs/analysis/combat-placement-native.json) and
explained in [the placement policy](../../docs/world-combat.md#initial-placement-admission).
This helper reconstructs only the documented ordinary initial-state subset;
no assembly, retail placement data or external implementation is copied.
