# Source-bound combat veterancy

[Issue147](https://github.com/lictl/WebRA2/issues/147) adds source ability lists and
selection of four inspected combat consumers. Use
[combat-veterancy.ts](../packages/content/src/combat-veterancy.ts);
[native evidence and licensing](../packages/content/COMBAT_VETERANCY_PROVENANCE.md)
records its scope. This is a composition input for attacks and death handling,
not executable combat by itself.

`compileCombatVeterancy({actors, rules}, lowerLimits?)` requires genuine immutable
CombatActors and an immutable retained INI table with matching profile and ordered
source pins. It checks every consumed type ability origin against the source view.
The upstream importer must authenticate physical rules bytes; a declared hash in
an arbitrary table is not physical-source proof. Source-bound actor allocation
already controls which type property visits are eligible.

The frozen branded result contains General VeteranCombat/Armor/ROF fields and each
type's separate veteran/elite ability sets, source origins and histories. Missing
or empty fields preserve current defaults. A nonempty ability list replaces the
whole set; comma-only tokens clear it, names compare using ASCII case folding,
and unknown names are ignored by the native helper. Inner token spaces are retained.
Unsupported buffers/values stay unknown and a later valid visit may replace them.
All18 identifiers remain data; non-Techno type families have not-applicable sets.

`selectCombatVeterancy(result, {typeId, veterancy})` consumes an explicit current
rank value. RA2 accepts finite binary64 values and YR requires exact binary32;
the interval is[-65536,65536], excluding negative zero. Veteran is[1,2), elite is
at least2, and negative/rookie values activate none of the covered abilities.
The caller must supply authoritative current state; this API cannot authenticate
experience or initialize a mission actor's rank from a map row.

Only FIREPOWER, STRONGER, ROF and EXPLODES are selected. Their inspected elite
consumers use veteran OR elite, while veteran consumers use the veteran list.
The result supplies `enabled` flags and `modifiers.combat/armor/rof`; inactive
factors equal one. An unknown factor or flag remains null when it can affect the
selected branch. Other ability consumers and promotion side effects are not
implemented. `canExecuteCombat` remains false on both results.

The selector does not inspect current actor firepower/armor, apply house modifiers,
choose weapon slots, schedule shots or perform damage/death. Compose it with
[house modifiers](combat-modifiers.md), [numerical stages](native-combat-numbers.md)
and complete runtime context. Decimal values outside the numerical stage's domain
remain visible here; parsed data is not numerical-domain admission.

Limits are lower-only:16,384 types,64 source stages,262,144 occurrences/field reads,
524,288 retained history/token entries,4,194,304 local work and32MiB serialized
result. Source validation separately caps nodes/characters/work; costs add rather
than constituting a total CPU/RSS promise. Reflection/accessor traps, mutable source
tables, fabricated brands, profile/source mismatch and raised/unknown limits reject.
No partial branded result is published. Simulation time, RNG, DOM and I/O do not
participate in these pure APIs.

Eight original tests cover both profiles' rank boundaries and storage precision,
list resets/defaults/commas/case, all18 list identities, unknown conditional values,
source joins, immutable ownership and lower budgets:

```sh
node --import tsx --test tests/content/combat-veterancy.test.ts
npm run check
```

Private reproduction uses `local/combat-modifiers/veterancy-probe.ts`,
`veterancy-oracle.py` and `veterancy-ledger.py`. The separate raw-value parser
compares67,602 scalars; type identities/allocation visits are previously verified
inputs to that oracle. Twenty-five native code spans and56 data records are
rehashed without executing retail programs. This evidence does not establish
original mission execution, native experience progression or full combat fidelity.
