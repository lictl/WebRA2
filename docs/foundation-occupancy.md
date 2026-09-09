# Static foundation occupancy geometry

Issue [#125](https://github.com/lictl/WebRA2/issues/125) adds
[`compileFoundationOccupancy`](../packages/content/src/foundation-occupancy.ts), a
bounded component that derives static base attachment cells from genuine
[typed entity definitions](entity-definitions.md). Both supplied native images
corroborate the cell lists and their relative anchor arithmetic. This is useful
input for a separately declared stationary occupancy policy; it is not a native
movement, placement-validation or complete blocking implementation.

## Contract

```ts
const masks = compileFoundationOccupancy({ definitions });
// definitions must be an actual isEntityDefinitions result from this module realm.
// Consumers accept only types whose status === 'ready'.
const type = masks.types.find(t => t.typeId === requestedTypeId);
```

The frozen result has policy `webra2-base-foundation-1`, an explicit profile,
`definitionsSha256`, the detached source identity, stable per-type order, a
canonical SHA-256, coverage and the remaining runtime work. Each type includes its
kind, foundation index, status, load evidence, reasons and frozen `{x,y}` cells.
`isFoundationOccupancy` recognizes only results owned by the module. Serialized
copies do not inherit this brand. The typed-definition fingerprint binds the
whole source/result identity; neither factory brand authenticates a remote file
or establishes native parser equivalence.

`ready` means **the static base attachment geometry is established**. Every result
also has `runtimeBlockingVerified:false` and `nativeExecutionVerified:false`.
For example, a type with `Gate=yes` can have a ready static mask while gate state,
wall conversion and actual traversal permissions remain unimplemented. No fields
are silently read from unrelated effective tables, and no placement winner is
selected.

The caller adds every cell to the placement's map-axis anchor. Native attachment
callers use `anchor.x + relative.x`, `anchor.y + relative.y`, without a facing
rotation on this path. The component does not translate, rotate, clip, wrap or
merge placements. The adapter owns absolute bounds, missing map cells, object
lifetime, death/removal, initial overlaps and per-object ownership. It must retain
overlapping occupants rather than let the last one win. In particular, an
unsupported candidate must not silently become free space or a usable blocker.

## Native geometry and load evidence

The building list contains 22 rows of 30 signed-short coordinate pairs. Rows are
selected by the parsed enum index with a 120-byte stride. For ordinary rows the
verified initialized coordinates form the corresponding rectangle in increasing
y then x order. The special refinery row contains eight cells with the east-middle
cell absent. The explicit empty row is a valid zero-cell mask. These facts were
established from initialized coordinate assignments, not inferred from the enum
width/height table or sprite dimensions.

Terrain uses a different 40-byte stride with ten pairs per row. Its first seven
rows match their building counterparts. Terrain index 7 is an initialized 4-by-2
mask even though the shared Foundation parser calls index 7 `3x5`. The output
preserves that actual terrain geometry. The remaining fourteen rows are
zero-filled and have no terminator within their row. They produce
`unsupported` / `unterminated-native-terrain-row` with no invented geometry. This
component does not replicate a native read into the following row or unrelated
memory.

Both type getters return the stored list pointer or an empty terminator when the
pointer is null. Constructors initialize the pointer to null; a successful
property load installs the selected list. Therefore enum zero by itself is
insufficient evidence that a live list was installed. A retained typed field
history/origin demonstrates a modeled property-stage visit. The terrain tree
strength fallback also demonstrates that visit when it has no explicit origin.
Absent either proof, the status is `unsupported` with
`foundation-pointer-initialization-unproven`; the known enum's candidate cells
remain visible for inspection. Unsupported typed Foundation values remain
unsupported.

Both images' accepted Object/Techno load regions have one true return and no edge
to their separate false exits. The false exit follows the preceding exact-section
gate, before the retained fields. After accepted base returns, the inspected
Building and Terrain paths have no early return, indirect jump or direct branch
escaping before the list-pointer assignment. The direct-branch counts are 36/41
for RA2/YR Building and two for each Terrain path. This supports the retained-field
load proof for the component's already modeled successful source stages. Native
allocation failures, non-returning errors, invalid external pointers, arbitrary
DLL modifications and unmodeled parser behavior are not established by this
control-flow audit.

`includesBib:false` records the base-list request. Both pinned type getters ignore
the supplied include-bib argument; the compiler does not append a bib rectangle.

## Runtime boundaries

The inspected attachment caller copies the base list, recognizes only the paired
`(32767,32767)` terminator, translates coordinates and attaches the object to each
cell. Subsequent occupation-bit behavior is separate: buildings mark a building
bit, while terrain chooses theater-specific subcell bits. A whole-cell stationary
blocker is consequently an explicit WebRA2 policy, not a claim that native terrain
blocks every locomotor or infantry subcell.

Native `AddOccupy` / `RemoveOccupy` pairs affect occupation-height counters after
base attachment. They do not replace the stored foundation list. Those counters,
`OccupyHeight`, gate state, wall-to-overlay / tile conversion, bridge altitude and
alternate flags, placement checks and extension foundations remain required
runtime work. No inferred override order or bounding-box fallback is implemented.
The two opening maps' ready geometry does not close these runtime behaviors.

## Bounds and identity

The hard limits are 16,384 types, 393,216 owned cells and 32 MiB of canonical
serialization; callers can lower them. Type count is checked before per-type
metadata allocation and exact aggregate cell count before cell allocation. Native
supported rows contain at most 24 cells. No unbounded lookup, payload cache, source
read, network request, timer or game execution occurs. Input and limit properties
must be plain data properties; accessors are rejected without invocation. The
module trusts only the deeply frozen, same-realm typed-definition result, and
returns no mutable lookup structure or shared writable cell array.

The digest covers the result excluding `sha256`, serialized with sorted object
keys, ordered arrays, JSON scalar spelling and UTF-8. It is incrementally hashed
with a byte cap. Limits do not change a successful result's hash. Type order is the
order supplied by the genuine typed compiler; source/profile changes are included
through the source identity and typed fingerprint.

## Verification

All 569 public tests, type checks, 93-document/470-link validation, publication and
M0 evidence guards, and the asset-free 36-file build passed at this checkpoint.
The ten focused original synthetic tests cover all 22 building shapes in both profiles,
terrain's index-7 difference and every unsupported later row, the refinery gap,
empty foundations, unsupported typed values, source Image selection, load proof,
map-axis translation examples, retained overlap, mobile-family exclusion, explicit
runtime boundaries, immutable identity, input accessors, caps and an independent
canonical serializer. They contain no extracted retail data.

Commands from the worktree, with the pinned Node toolchain on `PATH`:

```sh
node --import tsx --test tests/content/foundation-occupancy.test.ts
npm run check
```

The private probe independently verifies selected root/member hashes, compiles the
same rules/art/opening maps as #113, and compares the result to original Python
static propagation of the native initializer assignments. The propagation reads
PE bytes, uses Capstone 5.0.6 for instruction decoding and applies bounded scalar
assignment/call summaries. It never executes a game program. Constructor helper
clobbers and the empty element constructor are explicitly checked. Raw cell lists,
INI files, output placements and native listings stay in ignored `local/`.

| Measurement | RA2 opening | YR opening |
| --- | ---: | ---: |
| Native initialized coordinate slots compared | 880 | 880 |
| Typed output rows | 531 | 691 |
| Globally ready types | 367 | 483 |
| Globally unsupported types, all unplaced here | 9 | 5 |
| Other type families | 155 | 203 |
| All placement rows independently accounted for | 811 | 570 |
| Ready placed structures / terrain | 534 | 419 |
| Not-applicable mobile / smudge placements | 277 | 151 |
| Translated base attachment cells | 1,108 | 1,478 |
| Applicable overlap cells in these maps | 0 | 0 |
| Applicable cells outside coordinate range 0–511 | 0 | 0 |

The oracle obtains anchor coordinates from the original map tokens independently
of the TypeScript scenario projection. It checks every native-row-derived type
mask, all placement/status joins, all 2,586 translated cells and canonical output
digests. It also compares both images' 660 building and 220 terrain slots including
terminators and zero padding. The inherited #113 definition fingerprints remain
unchanged. This is independent agreement on the stated static policy, not an
original-game observation or a passing campaign test.

| Result | SHA-256 |
| --- | --- |
| RA2 foundation result | `5fdfbb1070309efe40fcc7f398570ab077fc5d177bbd2967ac370939d36e20a3` |
| YR foundation result | `5e517340a1b74b5da7a82c9bbbd855d176c7fbf215e9d2e3f03bcdd114b4a884` |

Exact image/source references and inspected byte ranges are recorded in
[provenance](../packages/content/FOUNDATION_OCCUPANCY_PROVENANCE.md). No private
output is part of the build or public CI.
