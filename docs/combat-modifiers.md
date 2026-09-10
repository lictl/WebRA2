# Source-bound campaign house modifiers

[#147](https://github.com/lictl/WebRA2/issues/147) connects exact ordered rules and
mission sources to country and campaign difficulty modifiers. Import
`compileCombatModifiers` from
[combat-modifiers.ts](../packages/content/src/combat-modifiers.ts).
The [provenance notice](../packages/content/COMBAT_MODIFIERS_PROVENANCE.md) records
native defaults, readers, consumers and private checks.

The input is `{actors, rules, mission:{source,bytes}, houseDifficultyIndices}`.
`actors` must be a genuine immutable CombatActors result. The compiler owns and
rehashes mission bytes, validates retained INI source views, checks ordered rules
pins and the mission table, reconstructs country/house identities and joins them
to the actor result. Upstream verified source sessions must authenticate physical
rules assets; declared hashes in a caller-built INI table are not proof that the
physical rules bytes match those hashes.

`houseDifficultyIndices` supplies exactly one `{houseId,index}` per house, where
index is 0, 1 or 2. Entries may arrive in any order; duplicates, missing/unknown
houses, malformed entries and other indices reject. No user/AI classification is
guessed here. A later campaign settings adapter chooses and saves these indices.
Applying index one to every house is an explicit configuration, not an implicit
fallback or proof of all native difficulty-selection behavior.

The result is frozen, branded and canonically fingerprinted with source pins,
actor fingerprint and explicit indices. It contains countries, three difficulty
records and house fields. `isCombatModifiers` recognizes only factory results.
`canExecuteCombat` and `nativeExecutionVerified` remain false. This component
neither authorizes attacks nor changes the world model/save format.

## Field meaning and load order

| Output | Meaning |
| --- | --- |
| Country firepower, armor, rof | The country's own general doubles, each initially one; present property reads use current-value defaults |
| Country armorInfantry, armorUnits | Own type-family factors, initially one; native double read followed by truncating float32 store |
| Difficulty firepower, armor, rof | Exact Easy/Normal/Difficult fields; the key is FirePower, distinct from country Firepower |
| House firepower, storedArmor, rof | The selected difficulty fields copied by the native campaign branch |
| House countryArmorInfantry, countryArmorUnits | Separate family factors from the declared country object |

Missing country keys retain prior state. An existing difficulty section resets
missing and empty selected keys to one. A missing difficulty section preserves
prior state; before any section visit, the compiler retains an explicit unknown
instead of guessing fresh difficulty-constructor values. Every section visit is
recorded in `loadStages`; fields retain explicit source origins and ordered history,
including earlier values and empty occurrences. A section-default reset has null
active origin, its named default rule and the retained section-visit sequence.

Country allocation follows the reviewed construction order. A country allocated
late by a house reference does not retrospectively read earlier sections. Exact
section/key spelling is preserved; canonical country IDs do not make property
lookup case-insensitive. ParentCountry is returned as a declared reference only;
this compiler does not run a general inheritance resolver or infer current runtime
house/type replacement.

The source numerical reader retains native float32 input/widening, percent and
float-store policies from the weapon compiler. Unknown parser inputs become null
with `unsupported` status; subsequent valid explicit values can replace them.
Supported parsed negative/zero values remain visible as data. `unavailableFields`
identifies null fields only; it is not numerical-domain or executable-actor admission.
The [bounded combat arithmetic](native-combat-numbers.md) separately rejects values
outside its positive finite domain. Do not silently replace unknown fields with one.

Campaign house firepower/ROF are not multiplied by the general country fields in
this branch. The generic stored house Armor field is also distinct from the type-
family country armor consumed by the inspected ordinary ReceiveDamage prefix.
Actor armor/firepower, veteran/elite eligibility, special firing states, immunity,
prone/derived-class damage and death effects still require actual runtime context.
The explicit work list in the result identifies these integration prerequisites.

## Bounds and ownership

Policy is `webra2-campaign-house-modifiers-1`. Lower-only limits cap mission bytes
at 16 MiB, countries/houses at 256 each, placements at 32768, stages at 64, retained
occurrences/field reads/history entries at 262144, and serialized output at 32 MiB.
The local modifier loop has 4,194,304 work units; each upstream source-view and
construction pass independently uses its bounded work/node/character limits.
Their costs add; the modifier-loop counter is not a process-wide work/RSS measure.
No native execution, network access or asynchronous work occurs in the compiler.

The input boundary rejects extra/missing fields and accessor properties, sparse
choice arrays, unknown options, raised limits and mutable/fabricated actor results.
Mission input must be an ordinary Uint8Array over a fixed ArrayBuffer. Data is owned
or already factory-frozen before the result is exposed. No partial branded result
is returned after a failed source/limit check. Proxy reflection is not an arbitrary
JavaScript sandbox. Source failure, component budgets and unknown semantic values
remain distinguishable; valid-but-unmodeled data is retained when possible.

## Validation and remaining work

Eight original tests cover both profiles, explicit difficulty/country separation,
section resets versus current defaults, unknown initial difficulty, late allocation,
case-sensitive fields, declared parents, float/percent behavior, malformed values,
complete choices, source joins, detached results and lower-only bounds:

```sh
node --import tsx --test tests/content/combat-modifiers.test.ts
npm run check
```

Separate private probes compare 999 numerical fields against raw-source parsing
for both openings and all three supplied index configurations. Native mapping
checks verify 13 complete code spans and 18 field/section literals without running
the games. These checks do not constitute original campaign behavior validation.

Fresh/current actor modifiers, campaign difficulty selection and executable actor
composition remain147. Ordinary death prerequisites are
[#155](https://github.com/lictl/WebRA2/issues/155); authoritative native-source combat
and browser attack integration remain [#132](https://github.com/lictl/WebRA2/issues/132).
