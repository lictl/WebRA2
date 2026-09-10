# Native combat actor initialization

Issue [#139](https://github.com/lictl/WebRA2/issues/139) adds source-bound initial
ammunition, immunity, conditional weapon controls and initial campaign alliances
for the combat adapter. Thirteen original synthetic tests and separate private
raw-source/native comparisons cover this component. Independent review and shared
distribution notice integration remain required before merge. This is typed
initialization data; no original mission or complete combat behavior is playable
as a result of this compiler alone.

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
The defaults include a 16 MiB mission, 16,384 types, 32,768 placements, 256 houses,
524,288 retained raw fields, 32,768 alliance tokens, 65,536 candidate house pairs
and 64 MiB canonical output. Source-view and construction helpers retain their own
bounded input validation. Mission snapshots reject shared/resizable storage.

`InitialAmmo` and `Ammo` start at -1 for techno families. Each exact field load uses
its current value as default; empty reads retain that value and preserve their
origin. Actor construction selects InitialAmmo when it is not exactly -1, otherwise
Ammo, without a capacity clamp at those assignments. Negative values below -1 and
ambiguous parser inputs remain unsupported. Terrain/smudge ammo is not applicable.
Reload/rearm and ammunition consumption belong to later runtime policy.

Immune and TypeImmune are separate flags. SmudgeType overrides the ObjectType
Immune constructor default to true; an explicit later source load can change it.
TurretCount, WeaponCount,
ClearAllWeapons, Gunner, IsChargeTurret and YR IsGattling remain separately typed;
the unknown WeaponCount constructor value is not fabricated. Ordinary, conditional,
cleared and unsupported slot modes prevent choosing an indexed or dynamic slot
without a consumer policy. Every loaded raw type field is also retained: this
bounded component does not classify all actor modifiers or prove weapon capability.
`ClearAllWeapons` clears only the first two normal/elite slots. Any conditional or
unknown selector therefore takes priority over `cleared`; numbered slots beyond
those two must not be treated as an unarmed actor.

Initial map Allies uses comma-only tokenization and exact house names. It records
unsigned 32-bit masks and directed non-self pairs. Self ownership remains separate.
Unknown names, inner whitespace, truncation, index aliases and fallback-house
allocation make initial alliances unsupported; they never prove hostility. Pair
consumers must require `coverage.initialAlliancesComplete`. The interpretation is
limited to fresh campaign map-house initialization, where the initialization gate
is active and the game mode is campaign. It does not implement live diplomacy,
multiplayer initialization or campaign script changes.

Exact section and key names come from the retained-normalization
[source view](ini-source-view.md); duplicate consumed sections/keys are rejected.
This does not resolve every original INI parsing behavior. The compiler loads a
type only at its recorded definition stages, retains empty/overwritten field
histories, and retains all raw source fields for later capability decisions.
Placement row tails, rank, upgrades and other actor state are passed through;
an ordinary slot mode does not prove that a placed actor can use a runtime weapon.

`isCombatActors` recognizes only this module's immutable factory outputs. Native
execution, modifier closure, damage filtering and campaign playability remain false.
See [provenance](../packages/content/COMBAT_ACTORS_PROVENANCE.md).

## Verification and private reproduction

Public synthetic tests cover both profiles and all six placement families, signed
ammo selection without a clamp, exact staged histories, empty/unknown inputs,
conditional slot gates, directed/self/repeated alliances, unknown and case-sensitive
names, bit 31 and index aliases, source/brand mismatches, immutable detachment,
resource failures, duplicate sections and hostile prototype names. They do not
execute or validate retail gameplay.
The final component branch passes `npm run check`: 638 public tests, strict types,
103 Markdown files/539 local links, publication and M0 metadata checks, and the
40-file asset-free browser build. This compiler is not yet part of that app bundle.

The [metadata census](analysis/combat-actors-census.json) pins six selected source
members and the [native range ledger](analysis/combat-actors-native.json). Fresh
verified reads are compared against independent Python reconstruction of raw INI
registries, stages, fields, histories, house indices, alliance masks and full
placement records. That comparison covers 355,693 scalar leaves. A separate upstream
entity oracle checks 17,108 typed fields and 1,381 placement-health joins before the
combat projection is assessed. No TypeScript compiler runs inside either oracle.

| Selected opening | Types | Placements | Houses | Directed non-self pairs | Compared scalar leaves |
| --- | ---: | ---: | ---: | ---: | ---: |
| RA2 | 531 | 811 | 8 | 33 | 159,322 |
| YR | 691 | 570 | 17 | 150 | 196,371 |

For these selected inputs, construction identities and fresh-campaign initial
alliances resolve. RA2 has no placed actor with finite starting ammunition; YR has
eight. These are source-derived observations, not a full actor capability count.
The independent projection and compiler fingerprints are recorded in the census.

Private evidence is preserved in the author's ignored
`local/worktrees/combat-actors/local/`. From that worktree with Node 24.20.0:

```sh
node --import tsx --test tests/content/combat-actors.test.ts
npm run check
node --import tsx local/probe.ts
python3 local/entity-oracle.py
python3 local/actor-oracle.py
local_python=/Users/lucus/Projects/WebRA2/local/worktrees/theater-tiles/local/venv/bin/python
"$local_python" local/native139/ledger.py
git diff --check
```

The probe imports its containing worktree and uses the verified source reader with
the read-only root installation. Its `input-pins.json`, full projections and oracle
scripts remain private. For an isolated review, copy scripts into that checkout's
ignored `local/` and inspect their source/output paths; redirect the ledger's final
public output path to an ignored file when reviewing read-only. The metadata gate
in `npm run check` does not rerun this private corpus. Missing original files are a
skipped private check, never a passing campaign test.
