# Scenario placements and references

[Issue #72](https://github.com/lictl/WebRA2/issues/72) adds
[`compileScenarioObjects`](../packages/content/src/scenario-objects.ts), a pure,
bounded compiler for one caller-verified RA2 or YR map. It complements the
[terrain compiler](scenario-terrain.md). It does not allocate simulation entities,
resolve runtime object types, execute mission logic or claim campaign readiness.

The input is `{profile, source: {id, profile, sha256}, bytes}`. The caller must
verify the bytes and retain the physical source identity before supplying them;
the synchronous compiler validates identity shape, not the SHA-256 itself. A
cross-profile source fails before parsing. Output carries `webra2-objects-1`, the
[runtime INI policy](runtime-ini.md), source identity and immutable local tables.
It always reports `nativeBehaviorVerified: false` and unresolved runtime types.
`placementsComplete: true` means all rows in the six recognized placement sections
were retained, including unsupported tails; it is not complete scenario semantics.

## Stored fields and geometry

Each retained row has its original section/key spelling, line, source ID/hash, raw
right-hand side and comma tokens with whitespace preserved. Semantic token values
use the versioned INI comment/whitespace policy. Raw right-hand sides retain comments
as well. No numeric parse silently truncates a token or clamps its value.

The following zero-based prefixes are typed; subsequent tokens remain indexed
`unsupportedFields`. Common emitted arities are comparison evidence, not assumed
defaults: a shorter row containing the entire typed prefix or an extended row is
retained with a field-count diagnostic. A missing mandatory prefix field fails the
whole compilation instead of dropping the object.

| Section | Typed prefix | Common arity |
| --- | --- | ---: |
| Infantry | owner 0, type 1, strength 2, x/y 3/4, subcell 5, mission 6, facing 7, tag 8 | 14 |
| Units | owner 0, type 1, strength 2, x/y 3/4, facing 5, mission 6, tag 7 | 14 |
| Aircraft | same prefix as Units | 12 |
| Structures | owner 0, type 1, strength 2, x/y 3/4, facing 5, tag 6 | 17 |
| Terrain | packed coordinate in row key; type in value 0 | 1 |
| Smudge | type 0, x/y 1/2 | 4 |

Strength is retained as an integer from 0 through 256, not converted to hit points
or percentages. Facing remains an unsigned byte, with no direction transformation.
Infantry subcell remains a byte; values above 4 produce an unsupported diagnostic.
The compiler does not establish movement positions or occupation for any subcell.
Flags, veterancy, upgrades, deployment, smudge's final word and extended fields
remain raw tokens. Mission strings and tags are data, not scheduled behavior.

Coordinates use the same stored x/y axes as the terrain records. EA's editor uses
the opposite internal variable names; the compiler does not copy that transpose
into its output. Terrain keys and waypoint values encode `x + 1000*y`. Coordinates
must fit 0 through 511. `[Map]Size` must have zero origin, width/height 1 through
256 and sum no greater than 512; `[Basic]NewINIFormat` must be 4. These constraints
match the current bounded terrain policy rather than every hypothetical mod format.

The integer projection is column `x-y+width-1`, row `x+y-width-1`.
Diamond membership follows the independent editor predicate documented with terrain.
An outside-diamond object or waypoint remains present with a diagnostic. Duplicate
coordinates are retained because stacking/occupation is downstream. LocalSize,
structure footprints, elevation and pixel projection are not used to discard rows.

Unsigned decimal row IDs may have gaps and retain leading zeroes, but numeric
aliases such as `2` and `0002` in one section are rejected. Relevant repeated INI
keys, duplicate house names and duplicate team declarations also fail atomically.
Case matching follows the existing ASCII-folding policy; it is not native lookup
evidence. Identical repeated coordinates and repeated section headers with distinct
rows are separate from duplicate identities.

## Reference boundary

House declarations retain both their numbered row ID and declared name, plus every
field in the associated house section. Missing definitions remain diagnosed.
Placement owners, Basic.Player and Allies link only to declared house names.
Country fields remain separate external references; a country name is never
silently turned into a house. A resolved reference means a declaration exists in
this input, not that a playable runtime object or house has been constructed.

Tag declarations retain their complete raw rows. Placement tag references link by
identifier. The editor's `None` spelling and empty reference tokens mean no target
under this policy; an actual tag declaration named None makes that use unsupported
rather than silently selecting it. Other spellings are not invented aliases.
Missing target diagnostics mean no matching declaration in this map; they do not
prove that the original game would reject the installation or a selector token.

Waypoint declarations retain their numeric ID and packed/stored coordinates.
Declared TeamTypes' Waypoint and TransportWaypoint references support the editor's
emitted A–Z and AA–ZZ domain (0–701). Longer/lowercase/numeric encodings remain raw
unsupported references. Empty fields remain explicit no-target references; absent
fields receive no fabricated default. TransportWaypoint stays conditional on
UseTransportOrigin; its raw flag is retained, without evaluating team activation.
Missing team sections are diagnosed. Trigger/action/script waypoint operands and
native selector resolution are outside this component.

`uncompiledSections` reports counts of rows not retained in these tables, including
mission logic and other team fields. This accounting makes the scope visible; it
does not replace the original verified map or a future interpreter.

## Resource limits and source evidence

Hard caps are 16 MiB input, 100,000 input entries including overwritten occurrences,
32,768 objects, 256 houses, 4,096 waypoints, 8,192 tags/teams, 262,144 retained tokens,
64 fields per row, 4,096 characters per field, 8 MiB retained raw right-hand sides,
65,536 references and 8,192 diagnostics. Callers may lower caps. Counts and field
lengths are checked before token-list expansion; duplicate rows fail before their
tokens can hide overwritten placements. Existing INI byte/section/line limits also
apply. These are input/output bounds, not a process-memory measurement.

The original TypeScript and synthetic tests are **GPL-3.0-or-later**, composing the
existing GPL INI component. No external implementation body or retail row is copied
into the public tree. Preserve [component provenance](../packages/content/PROVENANCE.md),
[licensing](licensing.md) and [GPL text](../LICENSES/GPL-3.0-or-later.txt).
Interpretation uses pinned primary sources:

- EA FinalSun/FinalAlert2, Electronic Arts, authored by Matthias Wagner,
  revision `6abf0f557469baea73079c6bf6550709e2e3584e`, GPL-3.0-or-later:
  [MapData.cpp placement readers](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L1520-L1546),
  [structure fields](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L2211-L2227),
  [unit/aircraft fields](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L2658-L2693),
  and [smudge read/write](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L7262-L7324).
  [Infantry.cpp strength control](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Infantry.cpp#L98-L103),
  [Houses.cpp fields](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Houses.cpp#L232-L243),
  [player-house selection](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Houses.cpp#L139-L156),
  [TeamTypes.cpp encoding domain](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TeamTypes.cpp#L263-L301)
  and [conditional fields](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TeamTypes.cpp#L546-L567),
  [functions.cpp tag sentinel](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/functions.cpp#L1198-L1219).
- OpenRA contributors, GPL-3.0-or-later, revision
  `f3ec7f8e1593b482f85fd101652deb740c33dee6`:
  [ImportGen2MapCommand.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/UtilityCommands/ImportGen2MapCommand.cs#L208-L305)
  independently establishes stored coordinate order/packing and byte fields.
  Its type substitutions, owner substitutions, facing/health conversions and
  unknown-actor dropping are not adopted here.

These sources describe storage/editor behavior. Native runtime semantics remain
unverified; no original executable is run by this compiler or its probes.

## Validation and private reproduction

Use Node 24.20.0: `npm ci`, `npm run check`, or focused
`node --import tsx --test tests/content/scenario-objects.test.ts`.
Original fixtures cover all six shapes, raw provenance, aliases/gaps, missing and
external references, coordinate/range/format failures, unknown tails and subcells,
hostile prototype-shaped names, immutability, profile isolation and each resource cap.

A private 2026-09-10 probe rereads both selected opening members through the verified
source reader. A separate Python parser rereads/rechecks member SHA-256, parses the
rows independently and compares every retained raw row/token, every typed placement
field, house declaration and waypoint. It uses EA's separate diamond predicate.
Only aggregate counts/ranges and reproduction hashes are published:

| Aggregate | RA2 opening | YR opening |
| --- | ---: | ---: |
| Infantry / Units / Aircraft | 40 / 19 / 0 | 56 / 18 / 0 |
| Structures / Terrain / Smudge | 190 / 344 / 218 | 189 / 230 / 77 |
| Total placements | 811 | 570 |
| Houses / waypoints / tags | 8 / 101 / 128 | 17 / 276 / 132 |
| Stored x range / y range | 9–108 / 10–113 | 41–170 / 56–177 |
| Strength / facing / subcell range | 42–256 / 0–224 / 2–4 | 0–256 / 0–218 / 2–4 |
| Resolved house / tag / waypoint references | 291 / 50 / 40 | 431 / 130 / 88 |
| Explicit no-tag / external country references | 199 / 8 | 133 / 17 |
| Rows with unsupported trailing fields | 467 | 340 |

No placements or waypoints fall outside the diamond in these two inputs. Aircraft
has synthetic coverage only in this probe. The earlier campaign graph counted only
the four owner-bearing kinds; adding Terrain and Smudge explains the larger totals.
No original map placement, row value or display string is published here.

Inputs and physical pins are in [the reference profiles](analysis/m0-reference-profile.json).
Member SHA-256 is RA2 `ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c`
and YR `dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0`.
With source ID equal to the opening filename, complete JSON table SHA-256 is RA2
`3e1ef8a6e14a4fc5c90ff9186a6cb344ffcc6400c0814a5b2a4b98bfadd515c5` and YR
`045169199cf71b80ee121ceae36d46af7ac08905f047e1a93e5528b0fc8d5158`.
These are component reproduction hashes, not simulation/content readiness hashes.
Private code/results remain in the worker checkout's ignored `local/probe-objects.ts`,
`local/oracle-objects.py` and `local/object-probe-facts.json`.

Fresh-checkout reproduction, printing aggregate metadata only:

```sh
node --import tsx --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createVerifiedSourceReader } from './tools/analysis/verified-source.ts';
import { compileScenarioObjects } from './packages/content/src/scenario-objects.ts';
const reference = JSON.parse(await readFile('docs/analysis/m0-reference-profile.json', 'utf8'));
const reader = await createVerifiedSourceReader(process.env.WEBRA2_GAME_DIRECTORY ?? 'game');
try {
  for (const p of reference.profiles) {
    const group = p.requiredDefinitionGroups.find(g => g.filename === p.opening);
    const identity = group.equivalentSourceChoices[0];
    const table = compileScenarioObjects({ profile: p.profile,
      source: { id: p.opening, profile: p.profile, sha256: identity.sha256 },
      bytes: await reader.read(identity) });
    console.log(JSON.stringify({ profile: p.profile, placements: table.placements.length,
      sha256: createHash('sha256').update(JSON.stringify(table)).digest('hex') }));
  }
} finally { await reader.close(); }
JS
```

Missing retail inputs skip the private gate, not pass it. Rendering, occupation,
house runtime, object type resolution and the trigger/AI interpreter remain
separate implementation tasks.
