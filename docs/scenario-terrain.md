# Typed scenario terrain

Issue [#61](https://github.com/lictl/WebRA2/issues/61), parent
[#18](https://github.com/lictl/WebRA2/issues/18). The
[compiler](../packages/content/src/scenario-terrain.ts) turns one caller-verified
RA2/YR map into immutable terrain geometry. It composes
[runtime INI](runtime-ini.md) and [bounded map codecs](map-packs.md). This is not a
renderer, art resolver, pathfinding grid, object compiler or playable mission.

## API and acceptance boundary

`compileScenarioTerrain({profile, source: {id, profile, sha256}, bytes}, lowerLimits?)`
requires matching `ra2`/`yr` profiles and a caller-verified source. Source ID/hash
join to the runtime session's physical manifest; this synchronous compiler checks
identity shape, not byte hashes. It never selects archives or overlays a rules file.
The source identity remains separate from geometry readiness and native behavior.

The frozen result includes:

- `schemaVersion: 1`, `policy: 'webra2-terrain-1'`, the INI policy revision and source.
- `geometryComplete: true` only after exact count, unique coordinates, bounds and
  complete pack validation. `assetResolution: 'unresolved'` and
  `nativeBehaviorVerified: false` remain explicit.
- `size`, `localSize`, uppercase `theater`, `newINIFormat`, and source metadata lines.
- `cells` sorted by projected row then projected column, preserving source record
  ordinal, both tile words, subtile/elevation/ice bytes and joined overlay type/data.
- `overlays`, a sparse lossless representation of both full 512×512 byte grids:
  only the pair type 255/data 0 is omitted. Outside-diamond and empty-overlay data
  remain present. Records sort by underlying `x + 512*y` address.
- Pack codec, numeric row/line provenance, encoded/packed/decoded sizes, the observed
  terminal word, and bounded diagnostics. No raw Base64 or decoded buffers escape.

`ScenarioTerrainError` has a stable `code`, section, optional source line and record
ordinal (default -1). Missing metadata/packs, duplicate metadata/pack rows, malformed
Base64, codec failure or invalid geometry throw; no partial successful geometry is
returned. Lower-layer INI errors retain their own stable code/diagnostics. Unknown
tile IDs, extra words, ice bytes and overlay types are retained for later resolution.
Imported values must not be printed in public logs; project only aggregate metadata.

## Geometry and record policy

This first version requires `[Basic] NewINIFormat=4`; `[Map] Size`, `LocalSize` and
`Theater` are mandatory and duplicates are rejected. Rectangles require exactly four
nonnegative decimal integer fields. Size origin must be 0,0; width and height are
1–256 with width+height ≤512. LocalSize must have positive dimensions and fit inside
the Size rectangle. Nonzero map origins and other formats reject as unsupported.
These are explicit support/resource limits, not all native map limits.

Theater is an ASCII identifier. The names TEMPERATE, SNOW, URBAN, DESERT, NEWURBAN and
LUNAR are recognized as tokens; other names remain in the result with an unsupported
asset diagnostic. Recognition does not prove that theater assets exist in a profile.
LocalSize remains metadata. Native camera bounds, playable margins, height clipping
and renderer pixel projection are not inferred from it.

Let map width/height be W/H and stored cell coordinates be x/y. The integer
staggered lattice is:

```text
projectedColumn = x - y + W - 1
projectedRow    = x + y - W - 1
0 <= projectedColumn <= 2*W - 2
0 <= projectedRow < 2*H
projectedColumn and projectedRow have the same parity
```

The complete coordinate set contains `(2*W - 1)*H` cells, with stored coordinates
1–511. Exact count, membership and uniqueness establish complete coverage of this
version's diamond, including the staggered shorter rows. Elevation is retained
separately; it does not alter cell membership or the integer lattice.

Each little-endian terrain record occupies 11 bytes:

| Offset | Field | Treatment |
| --- | --- | --- |
| 0, 2 | x, y: uint16 | Validate geometry; do not transpose overlay addressing |
| 4 | tileIndex: uint16 | Preserve every value, including 65535; never replace with tile 0 |
| 6 | extraTileWord: uint16 | Preserve and diagnose nonzero values; interpretation is unresolved |
| 8 | subtile: uint8 | Preserve; tile-art range checks belong to art resolution |
| 9 | elevation: uint8 | Preserve; native height restrictions are not inferred |
| 10 | iceRaw: uint8 | Preserve and diagnose nonzero values; references describe an extra/zero byte, not established ice behavior |

`rawTileIndex = tileIndex + 65536*extraTileWord` preserves the whole uint32 bit pattern
without committing to a native 32-bit tile-index interpretation. A low word of 65535
produces `unresolved-clear-tile-sentinel`; it remains unchanged even when the high
word is nonzero. TMP/rules resolution must decide what to render or reject.

After exactly those records, this policy requires **four zero bytes** and EOF. This
is an observed terminal-word candidate, not a claim that it is TS `CELL_NONE`, a
native end opcode or a compression header. It occurs inside decompressed output.
An appended empty framed compression block still rejects in the codec.

Both overlays decode to exactly 262,144 bytes. Cell `(x,y)` selects byte
`x + 512*y` from each. Type 255 is the documented empty-overlay convention, but
nonzero associated data is preserved with a diagnostic. Data/type pairs outside the
terrain diamond also survive with a diagnostic. No overlay type is silently mapped
to a resource, actor or default sprite.

## Pack assembly and bounds

Each of IsoMapPack5, OverlayPack and OverlayDataPack must occur once and contain
numbered rows 1..N. Numeric order is independent of textual or lexicographic order;
original line locations remain attached. Duplicate keys cannot disappear behind
runtime INI's later-wins policy. Aliases such as 01, zero/non-numeric keys, gaps and
repeated pack sections reject. The runtime INI comment/ASCII-trim policy still
applies; inner whitespace in Base64 is invalid.

Assembly counts all selected row characters before concatenation. Base64 requires
the standard alphabet, complete quartets, terminal padding only and canonical unused
pad bits. Exact decoded byte length is checked before allocation. IsoMapPack5 uses
LZO; the two overlay packs use LCW. Each decoder receives the exact expected output
length as its allocation ceiling and must consume every input byte.

Hard maxima, which optional limits may only lower: 16 MiB source map, 8 MiB total
Base64 characters, 6 MiB total packed bytes, 65,536 total pack rows, 130,816 terrain
cells, 262,144 retained overlays and 1,024 diagnostics. An overlay consumes capacity
before object allocation even when it lies outside the terrain diamond. The INI
scanner/compiler and individual codec block/chunk limits also apply. Under the
geometry cap, terrain output is at most 1,438,980 bytes; the two overlay outputs add
524,288 bytes. JavaScript objects, text, INI provenance and intermediate arrays add
bounded memory beyond these byte buffers. No total-process memory claim follows.

This function is synchronous, contains no browser/Node I/O, and adds no dependency.
Worker scheduling/cancellation and source verification belong to the caller. The
result is deeply frozen, including nested provenance and sparse overlay records;
caller mutation of the original bytes cannot change it.

## Evidence and license

Original compiler and tests use **GPL-3.0-or-later**, composing the existing GPL
components. Preserve [map codec attribution](../packages/formats/MAP_PACK_PROVENANCE.md),
[content provenance](../packages/content/PROVENANCE.md) and
[GPL text](../LICENSES/GPL-3.0-or-later.txt). No implementation body, retail map or
geometry dump is copied into the repository.

- OpenRA revision `f3ec7f8e1593b482f85fd101652deb740c33dee6`, OpenRA contributors,
  GPL-3.0-or-later: [ImportGen2MapCommand.cs:109–141](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/UtilityCommands/ImportGen2MapCommand.cs#L109-L141)
  records the count, 11-byte layout and extra four bytes;
  [144–177](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/UtilityCommands/ImportGen2MapCommand.cs#L144-L177)
  gives overlay dimensions/addressing and lattice enumeration;
  [570–574](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/UtilityCommands/ImportGen2MapCommand.cs#L570-L574)
  gives coordinate conversion. Its unknown-tile fallback and commentary interpreting
  the final bytes as a header are **not** adopted. This compiler requires those
  bytes from the actual decompressed stream and preserves unknown tile fields.
- EA FinalSun/FinalAlert2 editor revision `6abf0f557469baea73079c6bf6550709e2e3584e`,
  GPL-3.0-or-later, Electronic Arts, authored by Matthias Wagner:
  [MapData.h:80–91](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.h#L80-L91)
  distinguishes the tile word and extra bytes;
  [MapData.cpp:3390–3428](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L3390-L3428)
  supplies a separate diamond-coordinate predicate and serialized field mapping.
  A private Python application of that predicate matches every coordinate in both
  supplied opening maps. Editor behavior does not prove native movement or clipping.
- XCC revision `6f91bf8b00d3acabb1be765118a37c0cb74e85ec`, GPL-3.0-or-later, Olaf van
  der Spek: [cc_structures.h:231–241](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/cc_structures.h#L231-L241)
  separately names a signed 16-bit tile plus extra bytes. WebRA2 retains unsigned
  raw bits and the extra word rather than silently discarding or reinterpreting them.

## Validation and private reproduction

Node 24.20.0 public commands: `npm ci`, `npm run check`, or focused
`node --import tsx --test tests/content/scenario-terrain.test.ts`. Original fixtures
exercise a hand-specified 3×2 diamond and a one-column map, numeric row reordering,
source isolation/immutability, metadata bounds, missing/duplicate/gapped packs,
canonical Base64, exact lengths/trailer, duplicate/invalid coordinates, complete
codec consumption, preserved unknown fields and retained-overlay budgets.

Private verification on 2026-09-10 re-reads the two opening members through the
verified-source adapter, then compiles them. Each field is compared to the previously
independently checked [codec outputs](map-packs.md). Sparse overlays reconstruct the
entire original output grids byte-for-byte, including unused data. The complete
coordinate sets match the separate EA editor predicate. No original game is run.

| Aggregate | RA2 `all01t.map` | YR `all01umd.map` |
| --- | ---: | ---: |
| Member bytes | 146,240 | 301,077 |
| Size width×height | 50×64 | 65×120 |
| LocalSize x,y,width,height | 2,6,46,52 | 12,5,47,100 |
| Theater / format | URBAN / 4 | NEWURBAN / 4 |
| Cells / retained overlays | 6,336 / 189 | 15,480 / 328 |
| Both stored coordinate ranges | 1–113 | 1–184 |
| Projected columns / rows | 0–98 / 0–127 | 0–128 / 0–239 |
| Elevation / subtile range | 2–6 / 0–61 | 0–12 / 0–27 |
| Low-word 65535 candidates | 505 | 2,152 |
| Nonzero extra tile words / ice bytes | 0 / 0 | 0 / 0 |
| Outside-diamond overlays / data with empty overlay | 0 / 24 | 0 / 0 |

Source member SHA-256: RA2
`ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c`;
YR `dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0`.
Physical identities are in [the reference profile](analysis/m0-reference-profile.json).
With source ID equal to opening filename, JSON table SHA-256 is RA2
`2231ae7ba7f916fcf3ea0ebe89d0bb2b4aab3c95d633f9cf4e5e54bb2d3e7964` and YR
`2811d68369a1b43abebe6903dcd1735b36295f0728baadd2bd60d54ac7fe6521`.
These are deterministic reproduction checks, not gameplay state or asset-readiness
fingerprints. Private scripts/results remain in the worker's ignored
`local/probe-terrain.ts` and `local/terrain-probe.json`.

Fresh-checkout reproduction, printing only aggregate metadata:

```sh
node --import tsx --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createVerifiedSourceReader } from './tools/analysis/verified-source.ts';
import { compileScenarioTerrain } from './packages/content/src/scenario-terrain.ts';
const reference = JSON.parse(await readFile('docs/analysis/m0-reference-profile.json', 'utf8'));
const reader = await createVerifiedSourceReader(process.env.WEBRA2_GAME_DIRECTORY ?? 'game');
try {
  for (const p of reference.profiles) {
    const group = p.requiredDefinitionGroups.find(g => g.filename === p.opening);
    const identity = group.equivalentSourceChoices[0];
    const table = compileScenarioTerrain({ profile: p.profile,
      source: { id: p.opening, profile: p.profile, sha256: identity.sha256 },
      bytes: await reader.read(identity) });
    console.log(JSON.stringify({ profile: p.profile, cells: table.cells.length,
      sha256: createHash('sha256').update(JSON.stringify(table)).digest('hex') }));
  }
} finally { await reader.close(); }
JS
```

Missing retail inputs skip this private gate, not pass it. TMP/subtile lookup,
unknown-field meanings, clear-tile selection, overlay assets, native LocalSize
clipping and renderer behavior remain explicit downstream work under #18.
