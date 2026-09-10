# Team spawning provenance

The original `src/team-spawn-*.ts` components and original synthetic fixtures/tests
are GPL-3.0-or-later. They compose the GPL source, typed team, entity and traversal
components with the separable MIT world core. Redistribution must preserve these
licenses and offer the corresponding source; game assets are not part of this
component or its distribution.

Source activation evidence is documented in
[TEAM_ACTIVATION_PROVENANCE](../content/TEAM_ACTIVATION_PROVENANCE.md).
The same [native range ledger](../../docs/analysis/team-spawning-native.json)
includes CreateObject vtable slots and constructor health assignments. The GPL
primary [YRpp InfantryTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/InfantryTypeClass.h),
[UnitTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/UnitTypeClass.h)
and [ObjectClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectClass.h)
identify class/layout clues. Both image assignments were inspected independently:
RA2 infantry `4FF941` and unit `6FA5EE`; YR infantry `517D51` and unit `7355BA`
copy type Strength into current and estimated health. The +8C CreateObject slots
call the respective constructors with the selected type and owner.

`webra2-waypoint-reinforcement-1` is explicit WebRA2 policy: ordinary supported
infantry/vehicles appear atomically in distinct passable cells around the source
waypoint, in TaskForce member order, then use the existing whole-cell team
controller. This does not reproduce native off-map entry, formation, passenger
assembly, cadence, formation readiness or constructor RNG consumption. Initial
rank/side effects and combat/lifecycle capability are not established by health
assignment. A compiled catalog is movement capability, not campaign readiness.

Only the catalog factory can authenticate the program/source/archetype relationship;
only validated source records can create a dynamic context. The existing team
adapter consumes this brand, verifies exact prefixes and preserves prior instances;
it cannot accept an arbitrary replacement model. There is no public
arbitrary-model branding function. Reconstructed records describe a structural save,
not an unforgeable history of past occupancy. Live insertions separately check
current anchors, active reservations and living foundation cells, and recompute
pending proposals before publishing the new model.

See [the focused report](../../docs/team-spawning.md) for limits and evidence scope.

The component-owned request/retry/compound replay is original WebRA2 policy. It
executes no native trigger conditions and makes no native Scenario RNG neutrality
claim. The pending checkpoint includes the complete candidate state and is verified
by recomputation; source requests and replay admissions remain separate from
already committed spawn records. A request exhausted by the finite retry policy
is retained as exhausted rather than interpreted as a completed team script.
