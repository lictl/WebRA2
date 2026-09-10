# Terrain traversal compiler

[Issue #119](https://github.com/lictl/WebRA2/issues/119) supplies explicit terrain
inputs for [navigation](navigation.md). `compileTerrainTraversal` verifies owned
map/TMP bytes and returns land factors, raw movement-relevant fields, blockers
and integer cost/exit records. It does not read rendered pixels. This is an
incomplete ground subset; native locomotors, ramps, bridges and object occupancy
are not implemented by this component.

## Input and ownership

```ts
compileTerrainTraversal({
  contentIdentity, terrain, mapBytes,
  rules: content.sourceViews.rules,
  assets: preview.assets,
  choices: preview.choices,
  movementClasses: [{ id: 'foot', speedType: 0 }],
}, lowerLimits);
```

The synchronous compiler is intended for a worker. It performs no filesystem,
network, DOM, wall-clock or asynchronous work. The caller supplies one explicit
profile and exact staged `IniSourceView`; this must be a same-realm factory view.
Its sole final map stage must match the map hash. The content identity and rules
source verification remain the caller's responsibility and are labeled
`factory-view-caller-identity`. A factory view preserves trusted structure, not
cryptographic authentication of arbitrary externally claimed rules bytes.

The required `mapBytes` snapshot is capped at 16 MiB, hashed against
`terrain.source.sha256` and recompiled through the existing terrain compiler.
Every consumed input cell field, dimensions, local rectangle and theater must
match. The recompiled terrain is authoritative; a source label cannot authorize
altered geometry. Source IDs/profiles, expected TMP member/root identities,
byte ranges, asset IDs, slot joins and class IDs are validated before payload
hashing. Assets must all be used. A repeated movement SpeedType must reuse its
class rather than allocate another identical graph. Source records must each
have one explicit choice; empty/out-of-range TMP slots fail, with no blank tile
fallback and no filename or replacement-variant guessing.

All TMP sources are copied and hashed before their indexes are parsed. Conflicting
identities for one root ID, overlapping physical ranges under the same full root
hash/size (including aliases with different source IDs), stale bytes and duplicate
choices fail. Header/index work is preflighted over every selected asset. The
result retains only frozen scalars, origins, arrays and metadata, with no pixel
planes, input byte buffers or mutable maps. `isTerrainTraversal` recognizes only
the same-realm owned result after all source, map geometry and output checks; a
serialized or shallow-copied object cannot acquire that factory brand. The result is engine data, **not a
publication sanitizer**: original rule strings, source identities and cell data
must remain on-device or in ignored private research outputs.

## Land and factor evidence

Both supplied native images use this TMP-header-byte-to-LandType table:

| TMP terrain code | LandType |
| --- | --- |
| 0, 13 | 0 Clear |
| 1, 2, 3, 4 | 8 Ice |
| 5 | 10 Tunnel |
| 6 | 9 Railroad |
| 7, 8, 15 | 3 Rock |
| 9 | 2 Water |
| 10 | 6 Beach |
| 11, 12 | 1 Road |
| 14 | 7 Rough |

Only this 16-code domain is supported. In particular, TMP code 11 is Road, not
LandType 11 Weeds. The native getter reads signed byte `header+0x29` and indexes
the table; the WebRA2 reader keeps the unsigned byte and rejects unsupported
codes without emulating unchecked native memory access. A YR caller stores the
getter result in the cell's LandType field. Missing native image/slot fallbacks
observed in that getter do not authorize WebRA2's missing-slot fallback.

The land table order is Clear, Road, Water, Rock, Wall, Tiberium, Beach, Rough,
Ice, Railroad, Tunnel, Weeds. SpeedType order is Foot 0, Track 1, Wheel 2, Hover 3,
Winged 4, Float 5, Amphibious 6, FloatBeach 7. MovementZone is separate.

Both pinned land loaders iterate twelve rows of 36 bytes. If the requested
section exists, seven named factors are read with default 1.0, capped above at
1.0 and stored as float32. Winged is set to 1.0 without consulting a Winged key.
An absent section leaves that row unchanged. The current compiler starts an
unseen row as unresolved; it does not claim a complete native startup table
initialization analysis. All twelve rows initialize from the selected supplied
rules in both opening probes, so this uncertainty does not block those cases.

`webra2-exact-staged-land-decimal-f32-1` consults exact section/key spellings at
successive retained stages. It records every explicit origin and each retained,
default, forced or unsupported step. A unique section resets omitted keys to 1;
an absent section retains prior values. Duplicate exact sections/consulted keys
are unsupported; a later unambiguous reset can establish a known value again.
This stage model does not prove the original parser's merged-object behavior,
CRC collision handling or duplicate policy.

The supported numeric grammar is a finite decimal with optional exponent and
trailing percent, at most 128 characters. The policy rounds the parsed value to
float32, applies a percent multiplier when present, caps above 1 and stores a
final float32. Exact float32 midpoints are unavailable because the pinned CRT's
software conversion differs from JavaScript's ties-to-even behavior. This is a
named WebRA2 numeric subset; percent/exotic boundary equivalence, overflow,
trailing junk and all original CRT grammar are not claimed. Invalid factors
remain unresolved, zero/negative factors impassable. Negative factors are
preserved in metadata rather than silently rewritten.

## Ground subset and navigation policy

A cell is unavailable when it has an unknown land code, nonzero TMP ramp/height,
an extra image plane, nonzero map extra-tile/ice field, any overlay (including
nonzero data with an empty overlay), or Ice/Tunnel land semantics. All raw fields
and blocker reasons remain visible. High reserved TMP flag bits are preserved;
they are not invented movement restrictions. Flags describing Z/color storage do
not by themselves imply locomotor behavior. Overlay replacement of native land,
bridge levels, ramp direction/height, tunnels and destructible terrain require
separate implementation. Objects and structures do not become occupied cells
from their artwork or rectangle size.

Each supported class uses `costScale=256`, with positive factor `f` converted to
`ceil(256/f)`. A cost above 65,535 is unavailable with a `costRange` count; it is
not silently clamped. Navigation consumes `256*cost` per cardinal step and
`362*cost` per diagonal step, using destination cost. This integer conversion is
a WebRA2 approximation, not native timing. Winged is explicitly unavailable in
the ground grid even though the land loader establishes its factor.

Exit bits 0–7 address `(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1)`
in map coordinates. A bit exists only when both cells are supported/passable and
have equal map elevation. A missing cell is not a route. Navigation additionally
requires its documented four directed cardinal permissions for diagonal corner
crossings. Output rows sort by `(y,x)`; classes sort by ASCII ID. The caller can
pass each class's `cells` and `id` directly to `createNavigationGrid` while keeping
world occupancy as a separate explicit input.

## Bounds, identity and verification

Defaults cap 130,816 cells, 1,024 TMP assets, 128 MiB total map/TMP source bytes,
65,536 total TMP index slots, eight unique SpeedTypes, 32,768 field lookups,
8,388,608 attempted graph checks and 1,046,528 class-cell outputs. Graph and
class-cell limits reserve the conservative full product before source work;
allocation counters report the work actually used. Canonical metadata is capped
at 128 MiB. Lower limits cannot increase any default. All lookup and output
loops are finite and bounded; there are no retained global caches.

The SHA-256 covers the named policies, caller content identity, map identity,
ordered rule layers, physical TMP identities, every factor history, cell/blocker
and class/cost/exit record. Internal canonical records use sorted UTF-16 object
keys, exact array order and ECMAScript finite-number JSON, each terminated by
LF. The header omits the three row collections and allocation counters; land and
cell records follow, then class metadata followed by its cells. Allocation
counters and lower-limit choices do not alter semantic identity. Policy
`webra2-flat-terrain-2` also excludes the import-session `root.sourceId` handle
from the hashed asset header: file-picker enumeration can change that handle.
The owned audit result still retains it and rejects conflicting roots within a
session. Logical asset IDs/paths, verified root size/hash and member offset/size/hash
remain bound. See [the save identity correction](selection-identity.md).
`allocations.outputBytes` counts exactly that canonical hash stream, not heap RSS
or the size of pretty-printed JSON.

Commands with Node 24.20.0:

```sh
node --import tsx --test tests/content/terrain-traversal.test.ts
npm run check
```

Twelve original tests cover both profiles, all 16 land-code mappings, exact case,
absent/current/default factors, duplicates, float boundaries, impassability,
directed masks and navigation, elevation/ramp/overlay/ice/extra boundaries,
malicious properties, source/profile/map/slot joins, physical aliases, resource
caps, immutable ownership, selection-order independence and byte-sensitive hashes. Private map/TMP/INI records
are absent from public tests.

The ignored private probe prepares both openings with the actual selected profile,
reads map bytes through their expected hash, and exports only to `local/traversal`.
A separate Python oracle independently rehashes five physical roots and their
selected ranges, reads raw INI fields/origins, decodes map LZO with liblzo2 2.10,
decodes LCW independently, reads TMP header fields, and rederives costs/exits.

| Private comparison | RA2 Allied opening | YR Allied opening |
| --- | --- | --- |
| Map cells / TMP assets | 6,336 / 188 | 15,480 / 242 |
| Map + TMP source bytes | 1,697,860 | 2,177,061 |
| All selected index slots | 738 | 903 |
| Known factors / recorded factor steps | 96 / 192 | 96 / 192 |
| Foot cells / raw-semantics-blocked cells | 4,479 / 737 | 7,263 / 1,928 |
| All eight class-cell records / directed edges | 26,273 / 191,868 | 61,328 / 454,822 |
| Full field/origin/cost/edge comparisons | Exact | Exact |

Historical policy-1 identities from that private comparison are
`ca4e33ecb18fad72c61fd8614375d7ad9c86514c0d0c9a2ba089e3706550bda0` (RA2) and
`903f4591ae800a8f5bd4952acf4bc5eae304e5c8a1cc434bba441bd39b3218f5` (YR).
Policy-2 identities are recorded in [the correction report](selection-identity.md).
This proves the stated compiler policy and private source joins; it does not
establish native route or mission playability. The next consumer is the
coordinator's authoritative world adapter, with independent entity speed,
MovementZone, occupancy and save/replay policies.

## Pinned native ranges

Source hashes: `game.exe`, 5,077,312 bytes,
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`;
`gamemd.exe`, 5,286,208 bytes,
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
Addresses below are virtual addresses; file offsets are hexadecimal.

| Image / observation | VA | File offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| RA2 land-factor loader | `0x64d610` | `0x24d610` / 566 | `c5bd06307bc7fa02ae29bcb3613ad87d9f1408ee5628b0e667a387e6db6b8a68` |
| YR land-factor loader | `0x674000` | `0x274000` / 566 | `fc3859b13d9603b1c05b5e4af8d16cf431d62d2292fa12addbe4e674d04e512f` |
| RA2 TMP land getter | `0x529300` | `0x129300` / 56 | `32e7c4e416d47f5b80ee243b1174283abcee7c23de90e2ae8131e0f92705916b` |
| YR TMP land getter | `0x544be0` | `0x144be0` / 56 | `eca9364704400542cc58c1e6131a1cc0ef6caf484f6a246bafeb4f59cd27f20d` |
| RA2 mapping table | `0x7de4ec` | `0x3de4ec` / 64 | `13faf45aafee467744ca04829122df61ec6073bc8276743cae1bd6a4e99e558e` |
| YR mapping table | `0x8288e4` | `0x4288e4` / 64 | `13faf45aafee467744ca04829122df61ec6073bc8276743cae1bd6a4e99e558e` |
| YR getter result → cell LandType | `0x47d83e` | `0x07d83e` / 11 | `15c6e6b69d67df6bef7e70cc8f93a1214e3d79867c67895cb631ce4dfa2e0f4c` |
| YR section lookup | `0x526810` | `0x126810` / 320 | `1164bd0b355636029c6bfefbaadcabd7589d381f21efc23724e516c3da55c9bb` |

These are bounded static observations, not execution traces or proof of all
callers. Raw disassembly, binary table dumps, rules, map data and oracle inputs remain
ignored local files. See [provenance](../packages/content/TERRAIN_TRAVERSAL_PROVENANCE.md)
for primary source pins and distribution notices.
