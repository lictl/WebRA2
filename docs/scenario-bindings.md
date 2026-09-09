# Scenario definition bindings

[Issue #93](https://github.com/lictl/WebRA2/issues/93) adds
[bindScenarioObjects](../packages/content/src/scenario-bindings.ts), a structural
join between [compiled placements](scenario-objects.md) and the
[effective rules table](runtime-ini.md). Object rendering and simulation can share
stable definition references while unresolved native construction remains visible.

```ts
const bindings = bindScenarioObjects({
  objects: prepared.objects,
  rules: prepared.definitions.content.rules,
});
// Join bindings.placements to prepared.objects.placements by rowId.
// Join each typeId to bindings.types; inspect its status before use.
```

Inputs are the immutable compiler outputs from the same profile and map. Exactly
one `map` rules layer must match the placement source SHA-256; additional ordered
base/expansion/mod layers remain part of the effective rules table. The function
checks those identities but receives no source bytes to hash itself. The verified
[profile loader](installation-profile.md) and [terrain preparation](terrain-preview.md)
are the upstream byte-verification boundary. Arbitrary serialized wire records
must be validated/recompiled by their receiving boundary; freezing an object does
not establish authentic compiler provenance.

The policy `webra2-scenario-bindings-1` returns `canStartCampaign: false` and
`nativeBehaviorVerified: false`. A successful structural join does not prove a
native type instance, unit stat, house, diplomacy relation, asset choice or mission
can be created. No source files, global caches, entities or browser APIs are used.

## Type references and provenance

Each placed type is joined only against its corresponding effective registry:

| Placement family | Registry |
| --- | --- |
| Infantry | InfantryTypes |
| Units | VehicleTypes |
| Aircraft | AircraftTypes |
| Structures | BuildingTypes |
| Terrain | TerrainTypes |
| Smudge | SmudgeTypes |

ASCII case folding follows the existing INI/placement policy. Names with spaces or
prototype-shaped spellings are ordinary map keys; no property lookup interprets
them as JavaScript object properties. The type ID includes its placement family and
canonical name. Multiple effective registry rows naming the same type remain as
separate declaration alternatives. A matching effective section retains all its
selected entries and their shadowed origins, including map property overrides.
An empty declared section is present and has no invented defaults.

Statuses distinguish `resolved`, `undeclared`, `wrong-family` and `missing-section`.
A section with the right spelling is retained even when undeclared, but is not
promoted to a valid type. The output also records other registry families that
contain the same name. It does not assume cross-family declarations are aliases.

`shadowedRegistrations` retains each overwritten registry value's name and original
source/line/raw value. A malformed historical name is `null`, with its raw origin
still present. Historical entries are candidates only. They do not become effective
declarations simply because a native staged loader might have seen them earlier.
[Issue #94](https://github.com/lictl/WebRA2/issues/94) tracks that native construction
policy. This distinction matters for both supplied openings.

## Owner and country references

Scenario house declarations retain their row IDs, definition-presence flag and raw
mission fields. Effective `Countries` declarations have separate IDs and rule
sections. The binder does not create a house from a country name, inherit a
`ParentCountry`, or interpret alliance/side/color/owner numeric selectors.

Every placement owner retains both matching candidate IDs. Its status is `house`,
`country-only`, `ambiguous`, `missing`, `none` or `missing-house-section`. A literal
name matching both registries stays ambiguous. Terrain/smudge rows have no owner;
empty owner text also remains `none`. No magic `Neutral` or `None` owner is invented.

Each house's literal `Country` field is independently joined to the effective
country registry. Absent fields, missing country declarations and absent sections
remain distinct. A changed effective house Country value is `effective-conflict`
unless its ASCII-folded target is unchanged; the raw mission reference and any
candidate target remain available. This avoids silently applying an external mod's
house change while retaining incompatible raw scenario fields. Further effective
house assembly belongs to #94.

Types, countries, houses and placement joins have stable lexicographic IDs/order.
This ordering is a data join convention; it does not claim native entity allocation
or trigger execution order. Source placement order and coordinates remain in the
original placement table. Output metadata and all retained compiler properties are
frozen, including declaration alternatives and historical origins.

## Resource bounds

The whole input graph is checked before joins: plain frozen data containers, dense
arrays, no cycles/accessors/hidden keys, finite numbers, maximum depth 32, at most
2,000,000 visited values and 67,108,864 string/key UTF-16 code units. Already visited shared
containers are not traversed twice; strings are accounted at each visited value.
These are explicit structural budgets, not measured process memory. Per-call limits
may only lower the hard caps.

The join additionally permits 32,768 placements, 256 houses, 262,144 effective rule
entries and 16,384 active plus historical registry declarations. Type output is
limited to types used by placements; country output retains the effective country
registry. Shared frozen property objects are retained by reference, with bounded
new arrays and maps. The caller controls input/result lifetime. No unbounded
native inheritance walk or recursive type expansion occurs.

## Validation and private evidence

Run `node --import tsx --test tests/content/scenario-bindings.test.ts` and
`npm run check` with Node 24.20.0. Original fixtures cover both profiles and all six
families, override provenance, repeated/case-folded declarations, missing and
wrong-family references, house/country ambiguity, historical registry names,
effective country conflicts, stable joins, immutable inputs and resource bounds.

The private on-device probe reuses the verified full-installation preparation for
both pinned openings. A separate Python parser rehashes the selected rules/map
members, independently builds effective entries and historical registrations, and
compares every placed join plus selected/shadowed property provenance:

| Observation | RA2 opening | YR opening |
| --- | ---: | ---: |
| Placement joins compared | 811 | 570 |
| Distinct placed family/type IDs | 120 | 143 |
| Effective countries / scenario houses | 13 / 8 | 14 / 17 |
| Effective property/declaration comparisons | 2,207 | 2,805 |
| Historical registrations compared | 8 | 10 |
| Resolved / undeclared placed types | 119 / 1 | 140 / 3 |
| House / no-owner / ambiguous placement owners | 249 / 562 / 0 | 89 / 307 / 174 |
| Resolved / missing house-country references | 8 / 0 | 14 / 3 |

These unresolved counts are retained evidence, not successful gameplay closure.
The present rule sections and overwritten registry names require native loading
interpretation; owner-name precedence also remains open in #94. No runtime lookup
is guessed just to make the counts reach zero.

Private reproduction files live under ignored `local/scenario-bindings/`:
`probe.mjs`, `oracle.py`, selected rules/map bytes, full binding outputs and factual
summaries. Run the probe from the repository root, followed by the Python oracle.
Nothing from those payload files belongs in Git or public CI. The existing
[placement reference sources](scenario-objects.md) and
[content provenance](../packages/content/PROVENANCE.md) establish the input field
and registry reference context. This original structural join and its fixtures use
GPL-3.0-or-later consistently with the content component; no dependency was added.
