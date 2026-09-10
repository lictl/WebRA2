# Native combat actor initialization

Issue [#139](https://github.com/lictl/WebRA2/issues/139) adds source-bound initial
ammunition, immunity, conditional weapon controls and initial campaign alliances
for the combat adapter. Implementation validation is **WORKING**: eleven original
synthetic tests and strict types pass; fresh private raw-source/native comparison,
full checks and independent review remain before this slice is ready.

`compileCombatActors({definitions,rules,mission:{source,bytes}},limits?)` requires
genuine [entity definitions](entity-definitions.md), explicit ordered rules, and
owned mission bytes whose SHA-256 matches the supplied source and definitions.
It reconstructs the exact map source view and fresh placement/construction joins.
The caller still authenticates rules/art source bytes through the verified source
session; a declared hash or same-realm brand is not that authentication.

The immutable result records policy `webra2-combat-actors-1`, source pins, the entity
fingerprint, fields with raw origins/histories, complete placement rows and a sorted-key,
ordered-array canonical SHA-256. Limits count source occurrences, field reads,
history/raw-field retention, alliance tokens/pair work and serialized output.
They may only be lowered. Failure publishes no partial result.

`InitialAmmo` and `Ammo` start at -1 for techno families. Each exact field load uses
its current value as default; empty reads retain that value and preserve their
origin. Actor construction selects InitialAmmo when it is not exactly -1, otherwise
Ammo, without a capacity clamp at those assignments. Negative values below -1 and
ambiguous parser inputs remain unsupported. Terrain/smudge ammo is not applicable.
Reload/rearm and ammunition consumption belong to later runtime policy.

Immune and TypeImmune are separate flags. TurretCount, WeaponCount,
ClearAllWeapons, Gunner, IsChargeTurret and YR IsGattling remain separately typed;
the unknown WeaponCount constructor value is not fabricated. Ordinary, conditional,
cleared and unsupported slot modes prevent choosing an indexed or dynamic slot
without a consumer policy. Every loaded raw type field is also retained: this
bounded component does not classify all actor modifiers or prove weapon capability.

Initial map Allies uses comma-only tokenization and exact house names. It records
unsigned 32-bit masks and directed non-self pairs. Self ownership remains separate.
Unknown names, inner whitespace, truncation, index aliases and fallback-house
allocation make initial alliances unsupported; they never prove hostility. Pair
consumers must require `coverage.initialAlliancesComplete`. The interpretation is
limited to fresh campaign map-house initialization, where the initialization gate
is active and the game mode is campaign. It does not implement live diplomacy,
multiplayer initialization or campaign script changes.

`isCombatActors` recognizes only this module's immutable factory outputs. Native
execution, modifier closure, damage filtering and campaign playability remain false.
See [provenance](../packages/content/COMBAT_ACTORS_PROVENANCE.md).
