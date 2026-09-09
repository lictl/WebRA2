# Staged scenario identity construction

Issue [#94](https://github.com/lictl/WebRA2/issues/94) adds
`assembleScenarioDefinitions({ objects, rules }, lowerLimits?)` in
[scenario-construction.ts](../packages/content/src/scenario-construction.ts).
It reconstructs six placed-type registries, countries and actual allocated houses
from explicit rules stages, then joins every placement to those identities.
The [structural binder](scenario-bindings.md) remains available as a separate
preview. Neither result starts a campaign or provides native unit statistics.

The component is original GPL-3.0-or-later code. Its bounded static interpretations,
executable pins and primary reference are in
[CONSTRUCTION_PROVENANCE.md](../packages/content/CONSTRUCTION_PROVENANCE.md).

## Interface and ownership

Inputs must be immutable outputs of the [runtime INI compiler](runtime-ini.md)
and [scenario object compiler](scenario-objects.md), with one matching profile.
Exactly one `map` stage must be last, and its source hash must match the objects'
mission source. Stage IDs/orders/hashes are retained. No filename or array position
selects archive precedence. The caller authenticates physical bytes and joins these
source hashes to its verified source catalog; this function is not a JSON loader.
Earlier explicit mod stages are caller policy, not proof of arbitrary native file
loading order.

The result and every retained object/array are frozen. It includes:

- `registries`: fixed family order infantry, unit, aircraft, structure, terrain,
  smudge; source-order allocated identities within each family. IDs retain the
  structural form `type:kind:canonical`, while first registered spelling is kept
  in `name`.
- `countries`: `country:canonical` identities, registration/allocation origins,
  current Name alias, and an explicit ParentCountry **ID reference**. The latter
  is not a native inheritance resolver.
- `houses`: source-line ordered mission declarations, allocation index and
  resolved country identity. When the mission has no house list, country-order
  fallback houses carry separate generated IDs.
- `placements`: one record per original placement, sorted by stable row ID;
  resolved type ID/index and literal owner house ID/index, or explicit missing,
  wrong-family or unsupported status. No placement is discarded.
- `diagnostics`, `identityComplete`, `indexScope`, and readiness flags.

`identityComplete` means this bounded construction model emitted no unsupported
identity diagnostic. It does **not** mean statistics, all native allocation paths,
object creation side effects, scripts, rendering or gameplay are complete.
`indexScope` is always `modeled-allocation-order`: additional native references may
allocate types outside the paths traced here, shifting global native indices.
Use canonical IDs to join consumers, not these indices as an original save ABI.
`nativeBehaviorVerified` and `canStartCampaign` are always false.

## Ordered construction policy

Policy `webra2-scenario-construction-1` uses the shared
[retained source view](ini-source-view.md) to reconstruct every stage from all
selected and shadowed INI origins. The extraction preserves the output policy and
private projection hashes; no allocation/property semantics change. Registry entry **line order**, rather than
numeric key sorting or final overwritten table rows, determines allocation order.
An overwritten key in a later stage does not delete an earlier allocated type.
A case-insensitive ID registration repeat retains the first allocation and its
original spelling; all registration origins remain visible.

For each stage, the component registers countries and the six type families,
visits four traced General building references in fixed order (`GDIGateOne`,
`GDIGateTwo`, `NodGateOne`, `NodGateTwo`), then records current-stage definition
sections for identities allocated by that point. Missing referenced gates can
therefore allocate building identities even without a BuildingTypes entry.
Earlier definition sections are never loaded retrospectively into a later type.

Definition fields preserve exact key spelling, semantic value, raw RHS and
selected/shadowed origins for sections actually visited at or after allocation.
These are raw section assignments, **not** native typed properties or a promise
that every key is consumed by the original engine. Each visit retains its section
line and all entry origins. Name updates after each country section visit.
ParentCountry defaults to that country's ID when its section exists but the key is
missing; if the whole section is absent, the prior identity field remains. Its raw
historical entry is still retained separately. No parent statistics are copied.

Native section/key lookup hashes unchanged name bytes. This view therefore
reconstructs **exact spelling** from retained origins, even though `webra2-ini-1`
folds its general table keys. Differently cased sections and keys remain separate;
case-insensitive type-ID lookup does not imply case-insensitive `[ID]` lookup.
The first allocated ID spelling determines the section visited. Exact repeated
consumed sections/keys reject because native duplicate/CRC collision tie behavior
is unverified. The rest of the runtime INI policy (including normalized whitespace
and comments) still applies; it is not a fully native parser. Other consumers need
[#103](https://github.com/lictl/WebRA2/issues/103) before claiming native case
semantics. CRC-collision resolution is not emulated here.

After rules stages, houses come from the **mission-only** Houses list and
mission-only `[house]Country` keys. Values in a base rules house section do not
supply this field. Missing or empty Country chooses index zero if a country exists.
A nonempty lookup scans countries in allocation order, testing each current Name
alias and ID case-insensitively; a missing ordinary name allocates a new country
with constructor identity, without retrospectively loading its definition.
No house list creates one house per existing country, named by country ID rather
than its Name alias.

Placement source sections must use the exact native six-family spelling; repeated
exact placement sections reject. Folded object-compiler rows cannot authorize a
differently cased native section. Placement owner lookup is case-sensitive against actual allocated house names.
Country IDs/aliases and arbitrary matching sections are not owner fallbacks.
Five placed-type families require existing case-insensitive type IDs. Terrain's
traced loader may allocate a missing type at placement time, retaining the source
origin and no retrospectively loaded definition fields. Terrain/smudge have no
owner field. This is identity construction only; no live entities are allocated.

## Bounds and unsupported input

Limits may only be lowered. Defaults are 64 stages, 262,144 combined section/entry
occurrences (including shadowed entries), 16,384 allocation/registration attempts,
65,536 definition visits, 262,144 retained field visits, 256 houses, 32,768
placements, 32,768 diagnostics and 4,194,304 semantic work units. The immutable
input graph is capped at 2,000,000 visited values/properties, depth 32 and
64 Mi UTF-16 units of keys/text. Empty/ignored registrations still consume input
and work limits; the registration-attempt limit counts supported nonempty calls,
including calls that find an existing ID. Field/definition limits count repeated
visits, not just final output entries. Failed construction returns no partial
result and never mutates its inputs.

Malformed joins, source/profile mismatches, exact duplicate consumed registry or
property keys/sections, invalid limits, accessors, mutable inputs, cycles and
budget exhaustion throw a `ScenarioConstructionError` with a stable code. The
shared source-view validator additionally bounds its own reconstruction/indexing
work at 4,194,304 units and checks each entry against the last preceding header;
its failures are translated to construction error codes. This is separate from
the construction interpreter's existing semantic work counter.
Unsupported IDs, truncation, special country selectors, unresolved owners/types
and unresolved parent references retain diagnostics/rows where possible.
Supported identifiers are narrow printable ASCII: type/new-country IDs at most
24 characters, house names at most 19 (the native list buffer has size 20),
existing country Name aliases at most 48. Unknown longer country input cannot
silently create a truncated ID. `none`/`<none>` registry values allocate nothing;
multiplayer selectors and random country selection are explicitly unsupported.
These restrictions do not imply support for all native byte encodings or mod
syntax. Exact source/header normalization differences belong to #103.

## Verification

Original synthetic tests cover both profiles, all six families, source-order
numeric keys, overwritten registrations, late allocation, fixed General field
order, raw field history, Name aliases, missing/empty/implicit Country, literal
owner matching, fallback houses, ParentCountry identity/reset behavior, late
terrain allocation, exact case distinctions, duplicate rejection, truncation,
source forgery, immutable ownership and resource caps.

Commands (Node 24.20.0):

```sh
npm ci
node --import tsx --test tests/content/scenario-construction.test.ts
npm run check
git diff --check
```

Private probe/oracle scripts and raw data remain ignored in the author's
`local/worktrees/scenario-construction/local/`. `probe.ts` independently obtains
the pinned rules/opening-map byte ranges through `createVerifiedSourceReader`,
then runs the three TypeScript compilers. `oracle.py` separately rehashes the
original roots/members, parses the raw INI in Python, reconstructs the staged
identities and compares all registry/country fields and their origin histories,
definition visits, allocation/registration origins, house countries/declaration
origins, indices and every placement join. The oracle does not use the compiled
INI table. It is a static data comparison, not execution of the original game.

```sh
node --import tsx local/probe.ts > local/probe.log
python3 local/oracle.py
```

| Pinned opening | Types across six families | Countries | Houses | Placements | Raw fields / field origins | Registration origins / definition visits |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RA2 `all01t.map` | 531 | 21 | 8 | 811 | 11,104 / 11,203 | 549 / 580 |
| YR `all01umd.map` | 691 | 17 | 17 | 570 | 15,682 / 15,771 | 709 / 736 |

Both private comparisons match exactly with no unsupported identity diagnostic.
RA2 has 810 registered placement types and one General-reference allocation;
YR has 570 registered types. Literal owner joins cover 249 and 263 placements;
562 and 307 are ownerless. Historical registry reconstruction resolves the three
previously absent YR placed-type registrations and preserves countries hidden by
later overwritten numeric keys. These counts do not establish mission readiness.

The canonical independent projection hashes (Python JSON with sorted object keys,
compact separators and ASCII escaping) are:

- RA2: `60dbc4dffda5cadc0563565b26db73a516aa249efb68f849c4016bd4ffa2ebf9`
- YR: `352e653780ae1d26926255948bdd9ba721db7d227cff5871965d12629b1056d0`

They cover complete compared objects, not only counts. Verified source pins are
listed in the provenance note; private assets are never necessary for public CI.
