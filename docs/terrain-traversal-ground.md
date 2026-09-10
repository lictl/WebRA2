# Ordinary ground traversal

[Issue178](https://github.com/lictl/WebRA2/issues/178) extends the verified
[flat traversal](terrain-traversal.md) through ordinary ramps. The standalone
[`compileTerrainTraversalGround`](../packages/content/src/terrain-traversal-ground.ts)
accepts `{ base: TerrainTraversal }` and optional lower limits. `base` must be the
same-realm branded result of the existing compiler. Frozen copies, JSON metadata
and proxies around a genuine result are rejected. The base has already verified
map/TMP hashes, recompiled map geometry and joined explicit selected TMP slots and
source-view land factors. No second caller-supplied geometry or asset selector is
accepted here.

The frozen result includes the genuine `base`, `baseSha256`, source/content
identity, raw cells with both `baseBlockers` and current `blockers`, movement-class
rows, a new SHA-256 and resource counters. It has its own
`isTerrainTraversalGround` brand; it deliberately does not impersonate the older
flat compiler. `compileWorldContent` accepts either genuine graph and binds the
selected graph identity to navigation, models and saves. Rule/source authentication
still checks the immutable base. The source infantry bridge pins the selected
world graph but deliberately reads the base graph's flat cells for shot context;
a newly traversable ramp does not authorize an unverified shot. Neither compiler
can clear an entity's footprint or change alliances. Browser loader adoption and
infantry reservation integration remain separate work.

## Supported stage and explicit policy

The paired pinned native Foot height stage receives neighboring cells, a source
level and bridge context. In the ordinary nonbridge case, it accepts equal levels;
a difference of one is accepted when the **lower** endpoint has a nonzero slope
byte. A larger difference is rejected. A ramp only on the higher endpoint does not
suffice. Native Infantry and Unit virtual callers both use this shared stage before
later collision/land checks. This is a stage of admission, not a proof of every
locomotor or complete native pathfinding.

`webra2-ordinary-ground-1` applies that relation to the existing eight map-coordinate
neighbor directions. This graph supplies the packed map's floor level as the source level, not a current airborne/bridge actor height. The packed map's level byte supplies elevation; TMP image
height is not added to it. Native map loading stores level and slope in separate
cell fields; A value derived from TMP extra-image height is also stored separately; its full downstream semantics are unproved. For selected,
valid TMP slots in the no-overlay ordinary land path, the component removes only
the old blanket `ramp`, `tmp-height` and `extra-plane` exclusions. It retains the
original exclusions in every cell's audit metadata, including raw TMP flags and
height bytes. This does not assert that extra images have no other native uses.

Slope codes0–20 are the deliberately bounded published TS/RA2 domain. Unknown
codes remain `unsupported-ramp-code`; they are never masked or treated as flat.
Packed levels above127 remain `unsupported-signed-level`, because the native
crossing reads this field as a signed byte. Other original blockers remain: unknown
land, nonzero extra tile word, ice byte, overlay type/data, Ice and Tunnel land.
Bridge/overlay construction, ice, tunnels and specialized MovementZone/locomotor
rules are outside this policy.

Land factors and their source histories remain exactly those of `base`. Known
positive factors use the existing WebRA2 integer approximation
`costScale=256`, destination cost `ceil(256 / factor)`; zero/negative, unknown or
out-of-range costs remain unavailable. Winged classes remain unsupported. The
[directed navigation component](navigation.md) still applies its strict diagonal
corner and whole-cell occupancy checks. Continuous height, animation cadence and
native speed/path search are not inferred from the graph. Both
`traversalComplete` and `nativeBehaviorVerified` remain false.

## Identity, ownership and limits

The output shares only already immutable base metadata. New cell records,
blocker arrays, class rows and allocation counters are owned and frozen. Outer
inputs and limit values are captured through own enumerable data descriptors;
accessors are rejected and Proxy property `get` traps are not used to reread
validated scalars. Reflection failures propagate without publishing a result.

Limits are130,816 cells,8 classes,8,388,608 candidate edge checks,1,046,528 candidate
class rows and128MiB of logical output budget. Before graph/cell allocation, the
compiler reserves `8192 + cells*1536 + cells*classes*128` bytes. This conservative
logical envelope may reject a large request even if many cells would later be
blocked; it is not a measurement of JavaScript engine heap usage. Already owned
base/source memory is additional and governed by the base compiler's caps. Every
limit may be lowered but cannot be raised. `graphWork` counts actual eight-way
neighbor probes, `outputCells` counts emitted class rows, and `outputBytes` counts
the streamed semantic fingerprint input. No I/O, wall clock or RNG is used.

The fingerprint streams fixed-field UTF-8 JSON lines: policy/base SHA/unresolved
list, each source-record/blocker projection, then each class header and its ordered
rows. The base SHA already binds selected source bytes, raw cell fields, rules,
factor histories and logical class IDs. Import-session root handles stay in the
audit base but do not change the durable fingerprint. Limits and allocation
counters do not change semantics or identity. The new graph has a different policy
and identity from the flat graph even when all emitted rows happen to match.

## Validation and remaining route gate

Nine original synthetic tests cover both profiles, every supported slope byte in
both crossing directions, high-endpoint-only and multi-level rejection, distinct
image height, unknown bytes, every retained exclusion, exact land costs, Winged
handling, immutable authority, reflection boundaries, conservative caps,
selection-stable identity and navigation's diagonal/occupied-cell behavior.
Three additional both-profile integration tests cover genuine/forged world joins,
original static blockers, ramp movement, changed save identity, every selected
restore/replay boundary, and source-bound flat shots versus rejected ramp shots.

A private fresh438-file catalog run prepared both opening profiles using explicit
base-only physical TMP selections. An independent Python reader rehashed five
source roots and their member ranges, reparsed raw INIs/map packs/TMP fields,
reconstructed every factor history, cell and graph row, and reproduced both
fingerprints. Its LZO decompression uses liblzo2 2.10; its LCW and graph
interpretations are separate implementations. No retail program was executed.

| Profile | Map cells / TMP assets | Emitted class cells / directed edges | Ground SHA-256 |
| --- | --- | --- | --- |
| RA2 | 6,336 /188 | 26,793 /196,220 | `f63b74812033c15eb859111947e3b8206a785ecbe49cecccbca6a68b124341dd` |
| YR | 15,480 /242 | 68,108 /522,506 | `1e0c460c2ae6d8c9c5fb8704f54a3a140e64b64c001d1ac3a135c6c7abf09bd3` |

The default RA2 attacker's current90-cell component expands to701 under this
ground relation with all current occupancy preserved. It still reaches none of
24 currently supported firing cells. A separate diagnostic minimum-cut search
identifies one standing **allied** infantry cell on a prospective connection;
that actor is not an admitted combat target. The component does not move, remove
or attack it. [Issue180](https://github.com/lictl/WebRA2/issues/180) investigates
allied infantry passage or genuine team/mission movement. Issue178 remains an
open combined default-player playability gate; alternate-house combat and this
ground comparison do not establish an original campaign playthrough.

Private commands, run in this component's author/reviewer checkout:

```sh
node --import tsx local/ground/probe.mjs
node --import tsx local/ground/recompile.mjs
python3 local/ground/oracle.py
python3 local/ground/reachability.py
python3 local/native178/ledger.py  # requires the private Capstone5.0.6 environment
```

The first command reads the installation and saves ignored inputs; the second
recompiles their verified snapshots with the current source; the oracle rehashes
retail roots/ranges independently. Raw content, exact placement coordinates,
identifiers, disassembly and individual paths remain private. Public native
locators and provenance are in the
[component notice](../packages/content/TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md).
