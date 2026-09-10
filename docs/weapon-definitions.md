# Typed weapon definitions

Issue [#126](https://github.com/lictl/WebRA2/issues/126) adds
[compileWeaponDefinitions](../packages/content/src/weapon-definitions.ts) and a
small [numeric helper](../packages/content/src/weapon-numbers.ts). Both profiles
use genuine [entity definitions](entity-definitions.md), whose first two normal
weapon slots are the starting references. This is a content compiler. It does not
fire weapons or establish that an opening campaign can execute.

```ts
const weapons = compileWeaponDefinitions({ definitions, rules });
if (!isWeaponDefinitions(weapons)) throw new Error('unowned definitions');
```

`definitions` must carry the same-module factory brand. Its ordered rules layer
identities must exactly match `rules`; the exact-case source view validates the
frozen rules structure. The result includes the entity fingerprint, all rules
source pins, component policy `webra2-weapon-definitions-2`, and its own canonical
SHA256. The current policy is `webra2-weapon-definitions-2`; it supersedes policy 1
after the allocation-prefix correction in [#140](https://github.com/lictl/WebRA2/issues/140).
Sorted object keys, ordered arrays, JSON scalar spelling and UTF-8 are
hashed incrementally. It exposes no mutable maps. Copies and JSON deserialization
do not recreate the brand; this API does not authenticate bytes or load saves.

## Records and support boundaries

`links` retains each entity's primary/secondary field and source history.
`weapons`, `projectiles` and `warheads` contain canonical case-folded IDs, first
allocated spellings, allocation phase/source origin, reference origins, successful
section-load stages and typed `fields`. Every field retains its selected origin,
raw source RHS and assignment history. `resets` records source identity and section
line when omitted `Verses` resets the eleven values. Unhandled section entries
remain in `unhandledFields` with raw origins; they are not interpreted as inactive.

`status` describes the record's own typed fields and required references.
`referenceClosure` propagates unsupported descendants through a bounded reverse
graph. Cycles remain data and do not recursively instantiate weapons. These flags
apply to the stated allocation scope, not to native behavior or combat readiness.
Consumers must interpret active special flags and all unhandled fields before
claiming a supported weapon capability. For example, a typed `MindControl=yes`
requires a mind-control runtime; it does not authorize ordinary damage substitution.

`coverage.rootLinksResolved` checks slot identities; `rootClosuresTyped` also
checks descendant support. `nativeAllocationComplete` is always false. No field
or record makes a complete native allocation-index claim.

## Staged load policy

The modeled roots are all retained first-two normal-slot histories, including
overwritten/cleared pointers, the ordered `[Warheads]` registry, and
`[General] DropPodWeapon`. Reconstruction starts from a fresh native Rules object;
`generalDropPodWeapon` starts as proven null under rule
`fresh-native-rules-constructor`. The field retains its current
pointer, explicit clears and assignment history. Empty and
`none`/`<none>` references are treated separately. Missing/empty property reads
retain state; nonempty null selectors clear pointer fields. Names over 24 ASCII
characters and unsupported selector syntax produce explicit unsupported references.

Within a rules layer, known warhead registry allocation precedes the General root,
which precedes normal entity links. Normal-slot root discovery uses stable source
line order; competing case spellings remain unsupported except for the narrow
initial-prefix proof below. Other native allocation paths are outside this scope.
The native property sequence is weapons, projectiles, warheads, then weapon
speed calculation. A weapon first created by `AirburstWeapon`/`ShrapnelWeapon`
during the projectile pass therefore waits until the next layer's weapon pass.
Earlier sections are never copied into that newly allocated object retrospectively.

Other normal/elite slots, special/general references, animation references and
implicit allocation paths remain outside the modeled roots. They can affect first
spelling and whether a definition existed in an earlier layer. Native indices and
global closure remain unverified even if every field in this subset is typed.
Unproven spelling conflicts and absent loaded sections remain unsupported.

### Initial allocation spelling evidence

Both pinned `Rules::Init` paths empty the weapon and projectile arrays before the
first `Read_File`. Its registry readers allocate types; `Read_General` then reads
`DropPodWeapon` before the object property passes. The first weapon it allocates
therefore owns its original name spelling. That first weapon's initial explicit
`Projectile` read similarly establishes the first projectile name. Native lookup
compares IDs without ASCII case, while property loading uses the retained first
spelling. Later references with a different case do not rename either object.

Policy 2 records nullable `spellingEvidence` on just those proven allocations:
`initial-general-weapon` or `initial-general-projectile`, with the General origin
and, for the projectile, its reference origin. Evidence requires an explicit valid
General root in the first full base/expansion source; missing, empty, cleared,
wrongly cased or later-only roots do not qualify. A different first-source kind
does not qualify. Reusing native `Init` on an existing Rules object and importing
native saved pointer state are outside this fresh reconstruction contract; the
array-reset prefix does not prove those existing pointers become null.
A later General replacement or a different projectile allocated
in a subsequent source cannot acquire this evidence. Every source hash and origin
participates in the result fingerprint. Proof never supplies a missing section,
renames an exact-case source lookup, or hides unknown fields.

The bounded native caller audit distinguishes the later CombatDamage DeathWeapon,
SpecialWeapons projectile references, normal/elite/death/occupy type slots,
superweapon references, projectile-created weapons and COM construction paths.
They do not precede the proven initial General prefix on this fresh initialization
path. They remain outside complete allocation reconstruction. This correction
does not certify restored native saves, extension loaders, arbitrary runtime
allocations, normal-slot ordering, or a complete native array index. All unrelated
case ambiguities keep their unsupported gate; `nativeAllocationComplete` stays false.

Exact section/key spelling is used. Repeated consumed sections or any repeated
key in a consumed definition section reject the input; no CRC tie policy is guessed.
The source view still retains `webra2-ini-1` whitespace/comment normalization.
See [source-view limits](ini-source-view.md) for that native parser boundary.

## Values and numeric policy

| Values | Stored representation and policy |
| --- | --- |
| Damage, ROF, Burst | Signed native integers. Defaults 0, 0, 1. No firing cadence or damage-application claim. |
| Range, MinimumRange | Native integer units, 256 per INI cell. ReadDouble default -1 preserves state; otherwise truncate scaled value. Negative distances can remain typed but derived speed rejects them. |
| configuredSpeed | State returned by the most recent explicit Speed read: -1/empty retains the current native speed state; other integers clamp 0..100, scale by 256/100, cap 255. This may differ from the post-pass speed. |
| speed | After projectile properties, ROT=0 replaces speed using the native quantized range/gravity calculation. Nonzero ROT preserves it. Missing projectile preserves it; unknown required values are unsupported. |
| Projectile fields | AA=false, AG=true, ROT=0, Acceleration=3, Cluster=1, Elasticity=0.75; evidenced motion/target flags and airburst/shrapnel links are retained. Flags do not implement trajectories. |
| Warhead fields | Eleven Verses factors default to 1. CellSpread/CellInset default 0, PercentAtMax/ProneDamage default 1. Spread/inset/percent store float32; ProneDamage and Verses store doubles. |
| Profile fields | YR-only fields are `not-applicable` in RA2; explicit such keys produce diagnostics. No YR rule leaks into RA2. |

The native warhead reader supplies an eleven-token 100% default string when a
present section omits `Verses`. This resets prior values. An explicitly empty key
returns no string and preserves state. This version accepts exactly eleven tokens
within the native 127-character payload; malformed/short/long lists are unsupported.
Percent tokens use an integer prefix (`25.9%` becomes 25%); nonpercent tokens use a
different native double parser. This component accepts exact dyadic nonpercent
values only until that parser's remaining decimal boundary is modeled.

INI decimal reads use the same conservative float32 parser subset as entity
definitions and reject exact float32 midpoints. Percent multiplication and float32
stores use the observed startup precision/rounding policy: 53-bit x87 precision
and truncation toward zero. The implementation uses exact integer arithmetic to
truncate the product of the two binary operands. This is a bounded compatibility
policy for the inspected load path, not proof that all later engine code/threads
preserve that control word. Full legacy decimal syntax and double rounding remain
unverified. Integer and numeric token lengths are bounded to 127 characters.

Native CalculateSpeed uses Range × General.Gravity × the binary double constant
1.2; Floater halves gravity. General.Gravity defaults to 3. The positive result is
truncated to float32, its mantissa indexes a quantized square-root table, and the
final float is truncated to an integer. Both pinned 16,384-word tables are identical
and independently match a mathematical integer-square-root construction. Runtime
code generates only the needed mantissa using BigInt; it ships no native table.
Negative inputs, unsafe intermediate integer products and signed-32 overflow are
unsupported. This helper is neither a projectile integrator nor a path speed rule.

## Resource and validation gates

Lower-only limits cover stages (64), source occurrences (262,144), records (8,192),
reference work (65,536), field reads (1,048,576), retained/copied history references
(524,288), diagnostics (32,768), source nodes (2,000,000), source characters and
canonical output (64 Mi each). Admission rejects accessor properties without
invocation. Source, reference, history and graph budgets are enforced before their
corresponding expansion. Failure cannot partially mutate compiler inputs.

Public original synthetic tests exercise both profiles, staged resets, empty/null
references, post-projectile speed, delayed allocations, historical links, case
ambiguity, repeated sections/keys, retained unknown fields, malformed numbers,
factory/source identity, immutable results and low budgets.

```sh
node --import tsx --test tests/content/weapon-definitions.test.ts
npm run check
```

Private probes run only from ignored `local/`, using verified physical bytes from
the same selected rules/map/art sources as the entity compiler. An independent
Python raw-INI parser first reproduces all 17,108 entity fields and 1,381 placement
joins, then seeds the weapon oracle from those independently derived slot histories.
The weapon oracle uses the pinned native sqrt table directly while TypeScript
generates mathematical entries. Whole weapon values, statuses, raw origins,
histories, reference order, allocation/load phases and reset origins are compared.
These are static data comparisons, not original-game execution or campaign tests.

| Opening content | Weapon / projectile / warhead records | Compared fields | Unsupported own records |
| --- | --- | --- | --- |
| RA2 Allied opening | 85 / 33 / 76 | 8,298 | 2 |
| YR Allied opening | 117 / 35 / 111 | 11,352 | 2 |

Both resolve their normal root-link identities. Two weapons per profile have
negative range inputs outside the supported calculated-speed domain. The initial
prefix supplies two source-bound spelling proofs per profile. In YR it resolves
one projectile ambiguity and the unsupported status formerly propagated to 38
referencing records. The independent raw-source oracle checks the new General
history, allocation order, proof origins and all own/descendant statuses as well
as the existing 19,650 fields. Both profiles retain two unsupported own records
and two unsupported closures. Neither claims a fully typed root closure. Special gameplay effects,
weapon selection and unhandled properties remain required even for typed records.
Exact content/result/range digests and references are in
[component provenance](../packages/content/WEAPON_DEFINITIONS_PROVENANCE.md).

Private reproduction, with original files locally present:

```sh
node --import tsx local/probe.ts
python3 local/entity-oracle.py
python3 local/weapon-oracle.py
python3 local/native140/evidence.py # requires private Capstone 5.0.6 environment
```

The ignored scripts and source bytes are intentionally absent from public CI.
Coordinator combat integration is the next consumer; it must explicitly choose
supported capabilities and its own versioned deterministic execution policy.
