# Typed entity definitions

[Issue #113](https://github.com/lictl/WebRA2/issues/113) adds
[compileEntityDefinitions](../packages/content/src/entity-definitions.ts) for the
next deterministic world adapter. It produces usable health, locomotion, armor,
size and first-two weapon-slot values from staged native type identities. It does
not instantiate entities, execute weapons or make either campaign playable.
The original compiler and synthetic tests are GPL-3.0-or-later; see
[provenance](../packages/content/ENTITY_DEFINITIONS_PROVENANCE.md).

## Input, output and identity

```ts
const definitions = compileEntityDefinitions({ objects, rules, art }, lowerLimits);
if (!isEntityDefinitions(definitions)) throw new Error('foreign definition result');
```

Inputs are immutable same-realm `ScenarioObjects` and `RuntimeIni` results for one
explicit profile. Source bytes must already be verified by the caller. The compiler
uses [staged construction](scenario-construction.md) and the
[retained exact source view](ini-source-view.md), including shadowed origins, instead
of reading final case-folded values. Construction decides type/house identities and
which rule stages load properties at or after allocation. The first allocated
spelling selects the exact property section; canonical `type:<kind>:<id>` identities
remain independent of section/key case.

The frozen result carries schema 1, `webra2-entity-definitions-1`, profile, mission
source, ordered rule/art pins, definitions, placement joins, diagnostics and coverage.
Each typed field contains `value`, `status`, `rule`, selected `origin` and chronological
`history`. Status is `default`, `explicit`, `derived`, `unsupported` or `not-applicable`.
A null weapon pointer can be a supported default or explicit clear; a null value is
not by itself a readiness test. Histories include retained defaults/ignored sentinels,
source-layer overrides and weapon-mode controls; a native repeated read may repeat
an origin. Types loaded without a matching section keep evidenced constructor values.

`definitions` contains the six constructed placement families. `placements` joins
`rowId`, `typeId`, literal house `ownerId`, raw 0–256 strength and derived
`initialHealth`. Neither ownership nor the mission filename is hardcoded.
`coverage.identityComplete` preserves construction's bounded identity claim;
it does not imply field, occupancy, inheritance or gameplay completeness.
`unsupportedFields` counts unsupported exposed fields, independently of diagnostic
count. Multiple rejected reads can affect one final field. `requiredRuntimeWork`
identifies remaining engine work; `nativeExecutionVerified` and `canStartCampaign`
are always false.

`isEntityDefinitions` recognizes only a factory result from this module instance,
using a private WeakSet. Copies, structured clones and lookalikes fail; recompile
owned inputs in another worker. This brand checks lifecycle and prevents a world
adapter from accepting an unvalidated projection; it cannot authenticate source
bytes or a claimed hash.

The SHA-256 fingerprint covers the entire result except its own fingerprint field:
policy, all source pins, fields, histories, diagnostics and remaining-work list.
Canonical encoding uses lexicographically sorted object keys, ordered arrays and
JSON scalar spelling encoded as UTF-8. Tokens feed the existing pinned SHA-256
implementation incrementally, without building one large JSON string. Even an
otherwise unused source change changes the pin and fingerprint. A save must pin
this identity alongside its world policy; this is not a complete asset manifest.

## Supported loading policy

| Field | Supported interpretation |
| --- | --- |
| `strength`, `armor` | Object constructor 0/0; terrain overrides -1/wood. Exact rule keys use current-value defaults per stage. Terrain's -1 strength copies that stage's current General TreeStrength, whose constructor is 25. This is a sentinel-time copy, not permanent inheritance. |
| `speed` | Techno constructor 0. Read integer with -1 meaning retain; otherwise clamp to 0–100, truncate `n * 256 / 100`, cap at 255. These are native scaled units, not cells per tick. |
| `speedType` | Constructor infantry/building Foot, aircraft Winged, unit -1. On a unit load, unresolved -1 becomes Track if Crusher, otherwise Wheel, followed by another explicit SpeedType read. A later Crusher change does not reset an assigned speed class. |
| `movementZone` | Constructor Normal. Separate enum from SpeedType. Both native tables have twelve common entries; only YR adds CrusherAll at 12. No crossing permission is inferred here. |
| `locomotor` | Techno constructor stores the Teleport CLSID. Valid recognized GUIDs retain their class label. Unknown valid GUIDs retain the GUID with unsupported status; no movement algorithm is synthesized. |
| `crusher` | Constructor false and staged bool read. This flag influences unit speed-class initialization; it is not a complete crushing rule. |
| `physicalSize`, `transportSize` | Native PhysicalSize/Size are distinct scalars, initially 2/1. The bounded float policy below applies. Neither is a cell occupancy/subcell mask. |
| `primary`, `secondary` | First two normal weapon slots. Ordinary loads read Primary/Secondary. Positive TurretCount selects Weapon1/Weapon2, when that numbered slot is within WeaponCount. Missing/empty strings retain the slot, none sentinels clear it, IDs use case-folded stable links. ClearAllWeapons clears both afterward. WeaponCount without an established explicit value in numbered mode is unsupported; supported capacities are RA2 15/YR 18. Slots beyond the first two, elite weapons and tactical selection need the weapon runtime. |
| `foundation` | Building and terrain default to native enum 0 (1x1). Terrain reads the exact current ImageFile art section. Buildings first read that section, then the exact original type-ID art section with the first result as default; the second result replaces only when nonzero. Thus a second 1x1 does not replace a first 2x2. The 22-entry table includes a distinct refinery shape and 0x0. `occupancyVerified` stays false. |
| `smudgeWidth`, `smudgeHeight` | Constructor 1/1 and staged integer reads. This implementation accepts dimensions 0–64; larger or negative values are explicitly unsupported. |
| placement `initialHealth` | Truncate `rawStrength * Strength / 256`; if strictly greater than `Strength - 3`, snap to full strength. Mobile infantry/unit/aircraft have minimum 1; structures do not. Negative/unresolved maximum health is unsupported. Terrain and smudge initial health is not supplied by this placement path. |

Foundation uses the same source-stage Image walk as the native ObjectType load:
initial first-allocated name, missing/empty retains current, nonempty exact Image
assignment updates it. Invalid/truncating names are unsupported. Image/property
section selection is independent of a later building file alias. Explicit art
layers are composed in given order by exact section/key; the compiler does not
invent native archive/patch precedence or stage a different art file per rules
layer. Repeated consumed exact art sections/keys fail, including empty repeats.
Unrelated repeated sections are retained but do not force an arbitrary winner.
Unknown Foundation labels are unsupported rather than silently adopting the native
parser's zero fallback; rectangular labels outside the native table are not accepted.

## Numeric boundary and limitations

Integer parsing accepts unambiguous signed decimal/fraction/exponent strings using
the native atoi leading-integer behavior, and `$hex`/`hexh` signed 32-bit forms.
For example the original synthetic `35.9` parses as 35 and `1e3` as 1. Empty,
overflowing and mixed-suffix values are unsupported. Boolean parsing accepts only
complete yes/true/1 and no/false/0 spellings; the native reader's wider first-character
behavior is deliberately not reproduced for arbitrary malformed values.

`bounded-float32-webra2` recognizes finite decimal/exponent literals with an optional
terminal percent sign, rounds through `Math.fround`, widens to a JS number and applies
0.01 for percent. Negative sizes and nonfinite results are unsupported. Inputs whose
JS numeric value lands exactly between adjacent float32 values are rejected: the
pinned CRT's software rounding path differs at halfway values, so ties-to-even must
not silently become a native claim. This also rejects decimal values rounded by JS
onto that boundary. Signed zero is canonicalized to zero.

The float32 storage width and percentage path are statically observed in both
images. Complete legacy decimal parsing, pathological decimal double-rounding and
last-bit percentage arithmetic equivalence are **unverified**; this explicit
WebRA2 numeric policy is pinned in the fingerprint. The private oracle establishes
implementation agreement for supplied literals, not an original-runtime execution
oracle. Native integer truncation has separate startup control-word/call evidence.

Foundation shapes, physical/transport sizes and locomotor labels are inputs for
future rules, not proof of collision occupancy or passability. Country/difficulty/
veterancy adjustments, terrain health construction, locomotor speed modifiers,
subcells, weapon/projectile/warhead statistics, elite slots and firing decisions
remain required. A world may consume independently supported health/movement fields
without interpreting `identityComplete` as campaign readiness. Inheritance beyond
the supported current-value loads stays outside this policy.

## Bounds and integrity

All limits can only decrease: 64 combined rule/art stages, 262,144 combined retained
section/entry occurrences, 16,384 types, 32,768 placements, 1,048,576 field reads,
32,768 diagnostics, 64 Mi retained UTF-16 units, 2,000,000 graph values/properties per upstream validation,
262,144 charged history references and 64 Mi canonical bytes. Each upstream view
first applies its own bounded graph validation; aggregate source caps then apply
before type-field expansion. No claimed arbitrary-size input is copied first.

Validation rejects cross-profile input before source processing, accessors without
invoking them, mutable/exotic provenance graphs, invalid source joins, ambiguous
consumed keys/sections and malformed placement token/strength projections. Indexed
source helpers avoid repeated full-section scans. Every duplicated history array
is charged before allocation; serialization checks remaining bytes before emitting
a token (conservative six bytes per UTF-16 unit for a string). Failure publishes no
partial result or factory handle. These are component limits, not a measured
aggregate browser heap budget.

## Verification and private comparison

With the repository's pinned Node 24.20.0 toolchain:

```sh
npm ci
node --import tsx --test tests/content/entity-definitions.test.ts
npm run check
```

Seventeen original synthetic tests cover both profiles and six families, staged
fields/defaults/aliases/exact case, late registration, size rounding and half-value
rejection, profile-specific enums, numbered weapon slots, clear/retain behavior,
Foundation source order, health snap/minimum boundaries, invalid values, all lower
limits, immutable input tampering, non-invoked getters, factory branding and an
independent Node-crypto canonical fingerprint.

Private reproduction remains under the author's ignored worktree `local/`:
`probe.ts`, `oracle.py`, `input-pins.json`, `facts.json`, per-profile result JSON and
`native113/selected-ranges.json`. The Node probe rereads verified roots/members,
compiles fresh rules/map/art inputs, and writes private projections. The independent
original Python oracle parses raw INI bytes and reconstructs staged allocation,
field conversions/defaults/weapon controls and literal placement joins without
importing the TypeScript implementation. It rehashes every root/member and both
original images, and independently reads both native Foundation tables. It compares
all fourteen field values, statuses, selected origins and complete histories plus
all definition/placement identities and initial-health projections; policy-label
strings are deliberately excluded from that independent projection.

```sh
node --import tsx local/probe.ts
python3 local/oracle.py
```

A reviewer can copy those original private scripts into their isolated checkout's
ignored `local/` and rerun against the reviewed source. The probe uses the previously
verified private `local/native-art/<profile>-prepared.json` only for selected physical
identities; all runtime imports resolve inside the review checkout. No original
binary is executed, no extracted asset is needed by public tests, and missing
private files mean a skipped private gate.

| Opening | Constructed types / placed types | Placements | Fields compared | Unsupported fields / placement health |
| --- | ---: | ---: | ---: | ---: |
| RA2 Allied opening | 531 / 120 | 811 | 7,434 | 1 / 0 |
| YR Allied opening | 691 / 143 | 570 | 9,674 | 1 / 0 |

Each profile's single unsupported field is an unplaced building Foundation label
outside the native enum. Its two load attempts produce two diagnostics. All exposed
fields for the placed types pass this compiler's bounded policy. This is not complete
weapon, placement or mission semantics.

Private full projection SHA-256: RA2
`5670d7896b5f8dcb7665a8bd5dcdcdd2ec7fb13b525a5fca4328c5ef8b7f2700`;
YR `9f078576141618ca4fc2336f572d55926e36f9cb7945f7e976ac54c9e30fdd92`.
Original rows, strings, native listings and asset bytes remain private.
