# Opening-world adapter provenance

[world-content.ts](src/world-content.ts) and its
[original pipeline fixtures](../../tests/sim/world-content.test.ts) are original
GPL-3.0-or-later WebRA2 composition, Copyright 2026 WebRA2 contributors. They
consume the existing GPL exact-source, scenario-construction, entity-definition
and terrain-traversal components. Retain the
[content notice](../content/PROVENANCE.md),
[construction notice](../content/CONSTRUCTION_PROVENANCE.md),
[entity-definition notice](../content/ENTITY_DEFINITIONS_PROVENANCE.md),
[traversal notice](../content/TERRAIN_TRAVERSAL_PROVENANCE.md) and their pinned
primary references. No new external implementation or dependency is adopted.

The compiler directly consumes those reviewed typed results; it makes no further
original-game behavior claim from static addresses or visible artwork. Source
rehashing, stable joins, development-controller selection, explicit movement
eligibility and unsupported-state reporting are original WebRA2 choices. See
[the world policy and private component scope](../../docs/world-movement.md).
Native occupancy/locomotor/combat/campaign execution remains separately scoped.

The separable [world model](src/world-model.ts), [movement core](src/world.ts)
and [replay](src/world-replay.ts) remain original MIT implementations. Composition
with the GPL adapter does not relicense their separable source. The existing
MIT noble-hashes dependency retains [its notice](../vfs/HASH_PROVENANCE.md).
Combined distributions must retain the applicable notices, GPL text and
corresponding source/build material described in [licensing](../../docs/licensing.md).
No retail rule rows, map geometry, sprites, native bytes, saves or footage are
part of the public fixtures or browser output.
