# Ordinary actor death prerequisites

Issue [155](https://github.com/lictl/WebRA2/issues/155) adds a bounded, immutable
[compiler](../packages/content/src/combat-death.ts) for source prerequisites of
ground infantry/unit death. It complements the ordinary firing/impact
[animation component](animation-effects.md), [actor initialization](combat-actors.md)
and [weapon definitions](weapon-definitions.md). It does not execute death,
authorize damage, release occupancy, spawn survivors, consume RNG or select an
animation frame. `nativeExecutionVerified` and `canExecuteCombat` remain false.

```ts
const death = compileCombatDeath({ actors, definitions, weapons, effects, rules, art });
if (!isCombatDeath(death)) throw new Error('Expected an owned compiler result');
```

All four prerequisite components must be genuine same-realm factory results.
Their profile, entity/weapon fingerprints, rule/art source lists, mission identity,
type IDs and placement IDs must agree. The compiler reconstructs exact retained
INI source views and compares every visited type section against the genuine
actor's complete raw field history, including fields not interpreted here. It
consumes repeated visits in order rather than deduplicating them. Empty sections
do not change these fields. Source buffers remain the responsibility of the
verified preparation boundary; a `RuntimeIni` source label by itself does not
authenticate arbitrary source bytes. No mission geometry is accepted or inferred.

The result is deeply frozen and branded, with all placement/type joins retained.
Its canonical fingerprint includes source IDs and upstream audit fingerprints;
it is a preparation/audit identity, not a durable simulation/save identity.
Source origins contain private imported text and must stay on-device. Only the
aggregate facts and hash/offset ledger in this report are publication artifacts.

## Source and conditional results

| Output | Interpretation |
| --- | --- |
| `types[].status=typed-prerequisites` | All applicable source fields are parsed; this is not a safe-death admission |
| `unsupported` | An applicable field has an unmodeled parser input or dependent value |
| `not-applicable` | Structure, aircraft, terrain or smudge; this component makes no death claim for that family |
| `fields` | Value, source status, rule, origin and history for 18 named prerequisites; family-only fields stay not-applicable |
| `animationReferences` | Candidate names plus bounded graph reachability and explicit empty/active/unsupported/presentation-fields-only status |
| `weaponReference=record-present` | Exact spelling exists in the scoped weapon graph; external allocation and execution remain unproven |
| `branches` | Source conditions and live/native requirements, not callable effects or caller-supplied permission flags |
| `globalDeathWeapon` | Fresh Rules object's `[CombatDamage] DeathWeapon`, separate from type DeathWeapon |

Fields cover `Explodes`, `DeathWeapon`, `DeathWeaponDamageModifier`, `MaxDebris`,
`MinDebris`, `DebrisTypes`, `DebrisMaximums`, `DebrisAnims`, `Explosion`,
`DestroyAnim`, `Crewed`, `Passengers`, `Organic`, `Crashable`, and infantry-only
`Cyborg`, `NotHuman`, `DeathAnims`, `DeadBodies`. Defaults come from both pinned
native constructors, including subtype Organic overrides and vector clear calls.
No missing key is treated as evidence for an uninspected constructor default.

The incoming rules stage supplies these fields and animation names. AnimType
properties come from the global art context modeled by the existing effect
compiler. A known initial animation registration with matching spelling can be
reported as `presentation-fields-only` after bounded dependency traversal; that
classification is neither death-root allocation proof nor RNG-sequence neutrality.
Missing records, changed allocation spelling, unknown effect fields and cycles
stay explicit. Existing firing/impact closure is not silently extended to custom
DeathAnims or native default InfDeath sequences.

Missing/empty reads preserve the current value; nonempty comma lists replace.
Pointer lists discard supported `none`/`<none>` tokens. Identifier acceptance is a
conservative ASCII subset of at most 24 characters; list token whitespace, longer
identifiers and parser cases outside that subset remain unsupported. Scalar/name
and animation-vector reads are bounded to 127 characters. DebrisMaximums has a
511-character native buffer and uses decimal `atoi`, unlike the INI scalar
reader's supported hex syntax. The accepted decimal subset rejects overflow and
other unmodeled inputs. No native unsafe wrapping is reproduced.
DeathWeaponDamageModifier uses the existing conservative ReadDouble parser and
the native float32 store under the pinned truncation mode. For example, `10%`
stores `0.09999999403953552`, not JavaScript's nearest float32 value.

After each type property stage, native code clamps negative MinDebris to zero,
then raises MaxDebris to at least MinDebris. The derived maximum retains the
minimum's controlling origin/history; an unsupported minimum also makes that
maximum unknown. An earlier unknown value is not silently reset by a missing key.

## Native interpretation and next integration

The [provenance ledger](../packages/content/COMBAT_DEATH_PROVENANCE.md) pins both
images and 54 inspected ranges totaling 53,615 bytes. Static code inspection and
independent raw-source agreement are distinct from native gameplay observations.

- The lethal dry-path explosion branch requires type Explodes, active
  veteran/elite Explodes, or the current weapon's Suicide flag. A configured
  DeathWeapon alone does not trigger it. Live passengers may be destroyed before
  the selected death weapon runs.
- The death-weapon helper chooses explicit type DeathWeapon, then a virtual
  normal-weapon result, then global Rules DeathWeapon. Explicit/normal damage
  uses the type modifier; global fallback uses half the type Strength. It then
  adds the helper's integer argument before bullet creation/detonation. This is
  metadata evidence, not a new numerical or weapon execution implementation.
- MaxDebris independently gates debris work. Native code can create voxel debris,
  type animation debris or global animation debris, with shared Scenario RNG.
  Empty DebrisTypes or DebrisAnims does not establish absence of effects.
- Infantry custom DeathAnims uses the effective InfDeath index when in range and
  non-null, otherwise the first reference. Empty custom lists continue to native
  default/special sequence logic. Cyborg, NotHuman, jumpjet, water/crash, current
  sequence, killer and transport state require their own live context. DeadBodies
  is a typed source candidate; its runtime usage is not established here.
- Unit Explosion/DestroyAnim selection uses shared RNG even for a singleton
  list. Explodes/ability and ammunition affect the explosion choice. The helper
  also contains ore/bounty conditions between animation constructors, so its
  entire execution cannot be classified as presentation from animation fields.
- Unit survivor handling can follow an explicit live driver index even when
  Crewed is false. The other branch depends on Crewed, zero type passenger
  capacity, a death-call argument, global crew-escape probability and country/crew
  creation. Live passenger ejection, placement, health and RNG remain separate.

The next runtime evaluator must consume a genuine result plus the authenticated
current actor, warhead, damage outcome and complete world context. It should
evaluate inactive branches instead of rejecting every actor with conditional
metadata. Unknown occupants, passengers, drivers, owners, attached actors or
effects cannot be omitted to make a context eligible. The first useful subset is
ordinary human InfDeath sequences and source-bound unit Explosion effects, with
explicit lethal timing, owner/team accounting and occupancy release. Numerical
modifiers and native scheduling remain coordinator-owned issues
[147](https://github.com/lictl/WebRA2/issues/147) and
[132](https://github.com/lictl/WebRA2/issues/132). Reused native Rules objects,
original save import, special mutation/warping/crash paths and full actor death
remain unsupported. No essential human observation is currently required.

## Bounds and verification

Limits can only be lowered. Defaults are 64 stages, 262,144 source occurrences,
16,384 types, 32,768 placements, 524,288 copied history entries, 131,072 counted
references/graph expansion work, 32,768 diagnostics and 4,194,304 component work
units. Each source-view validation also has its own bounded work, 2,000,000 nodes
and 64 MiB character budget. Canonical encoding has a 64 MiB byte limit. These are
explicit work/allocation gates, not a measured peak-memory promise. Inputs reject
unknown outer keys, accessors, malformed frozen source records, elevated limits,
non-finite limits and negative zero; reflection failures propagate before output.
No DOM, filesystem, network, wall-clock, rendering or RNG dependency is introduced.

The original [11 synthetic tests](../tests/content/combat-death.test.ts) exercise
both profiles, genuine joins, exact source/history substitution, current-value
preservation, active and cyclic animation graphs, unknown root allocation,
decimal-vector/float-store boundaries, per-stage debris clamps, conditional weapon
and survivor requirements, malformed input, budgets and immutable output.

Private reproduction from the author/reviewer checkout, with Node 24.20.0:

```sh
node --import tsx local/probe155.ts
python3 local/native155/oracle.py
local-native-capstone-python local/native155/ledger.py
```

The final command denotes the private Capstone 5.0.6 Python environment; it is not
a product dependency. Scripts/retail bytes/listings stay ignored. `probe155.ts`
reads exact source members through the verified source reader and writes private
results. The separate Python parser rehashes each input, reconstructs raw type
fields and origins, independently applies numeric conversions/clamps, and checks
all placement joins against the genuine upstream actor identities. It does not
independently prove the entire native allocation graph or simulate death.

| Private opening | All types | Applicable ground types | Placements | Field records | Raw-source scalar comparisons |
| --- | --- | --- | --- | --- | --- |
| RA2 | 531 | 100 | 811 | 9,558 | Combined below |
| YR | 691 | 145 | 570 | 12,438 | 181,172 combined |

All applicable scalar/list fields parse in this corpus. Candidate animation
references include 53 RA2 / 77 YR unsupported closures and no newly proved death
root; most other references are empty. Among placed ground actors, none has type
Explodes, Crewed, Crashable or Cyborg true; 4 RA2 / 6 YR infantry are NotHuman,
3 / 10 ground actors have positive MaxDebris, and all 19 / 18 placed units have
Explosion references. No placed infantry has custom DeathAnims. These are source
facts, not live-state or gameplay admission.

Canonical independent field projections, including origins/history:

- RA2: `2c214d2d7b13e1e4a31711e96c92564c6e54c2c9d4257fc9e345324ce1a3e2b9`
- YR: `8c17b03311b7bc44f62311261deef11901182075093df176a794c7171a3e5621`

No browser or original-game execution is part of this standalone component gate.
