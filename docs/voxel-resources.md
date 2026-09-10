# Verified voxel resources

Issue [#133](https://github.com/lictl/WebRA2/issues/133) adds a content component
between exact artwork/typed definitions and the existing [voxel rasterizer](voxel-render.md).
It does not change the browser application or simulation. The engine still cannot
play an original campaign.

`compileVoxelPlan({objects, artPlan, definitions, rules, art, policy:
'webra2-voxel-still-1'})` produces a branded, frozen plan. It reconstructs the
complete typed-definition and artwork fingerprints and requires equality with the
supplied genuine results. Existing compilers validate frozen source structure and
exact visited definition stages. `ScenarioObjects` remains a source-labelled
compiler input, not independently authenticated geometry. This component consumes
only stable row/type joins; callers still authenticate mission bytes in their
installation pipeline. Placement coordinates, facing and collision are not inferred.

The plan retains exact field origins and names body, turret, barrel, numbered turret
and conditional body alternatives. It follows prior-value retention across visited
rule sections and exact art lookup. This narrow numeric policy accepts ordinary
nonnegative decimal turret counts through 18; unsupported values remain explicit.
`IsGattling` is a YR-only gate. Non-unit voxel families, nonzero/unknown attachment
offsets, arctic selection and unresolved numbered/water/spawn model selection are
unsupported. Required resource flags express this component's closure requirement,
not an exhaustive native file-error policy.

`prepareVoxelPreview(catalog, plan, {signal?, onProgress?, anchors?, limits?})`
returns owned source bytes, palette buffers, a genuine voxel atlas, immutable
per-type/request bindings, stable plan placements, and metadata fingerprints.
Only a fully supported type exposes `stillPartIds`. Conditional models can have
ready resource bindings while their type remains unsupported; no partial still is
silently drawn. `isVoxelPlan` and `isVoxelPreview` accept only same-realm factory
results. These brands are not substitutes for content SHA-256 verification.

The resolver supports ordinary loose assets, direct numbered expansion archives,
RA2MD/RA2, and the selected CACHEMD/CACHE/LOCALMD/LOCAL containers. It snapshots
and checks archive ancestry before reading. A replacement container shadows all
lower copies, including files it omits. Unknown mounts or ambiguous container
identities stay unsupported. Tied highest-priority asset copies must have matching
size and verified SHA-256. The [native evidence](../packages/content/VOXEL_RESOURCES_PROVENANCE.md)
scopes this ordering to the ordinary bootstrap/file path; dynamic theater, language,
wildcard and extension mount compatibility are not claimed.

Every selected member is independently rehashed from an owned snapshot. Previously
verified root anchors enforce root continuity. A changed root/member identity or
malformed source rejects the operation; missing sources and incompatible section
counts/IDs are explicit binding statuses. HVA uses frame-major storage, frame zero
and matching VXL section IDs/ordinals. The HVA reader's skipped names are not used
as a guessed name-to-section join. The existing atlas independently snapshots and
preflights again before it decodes geometry.

Rendering remains an explicit unlit presentation policy using the rasterizer's
pinned OpenRA bounds/scale transform. Native loading evidence does not prove that
transform matches native rendering. Callers supply every `modelToView` matrix and
map model parts to object IDs. Palette index zero is transparent, original colors
are retained, and no house remap, normals lighting, shadow, animation, native facing
or moving attachment transform is applied. Source/palette buffers are private
caller-owned payloads; copying or mutating them cannot change the atlas geometry.
For the renderer's exact-field input, project palette metadata to
`{id, rgba, remap, transparentIndex}`. Never send payloads or complete prepared
results to public logging/CI.

Limits are lowerable only: 256 planned types/requests, 4,096 input placements,
1,024 resource references, 2,048 candidates, 256 assets/atlas parts, 16 MiB/member,
128 MiB attempted candidate sources and 1 GiB potential roots. Preflight limits
2,048 sections, 1,048,576 columns/voxels, 4,194,304 runs and 65,536 matrices.
Source byte budgets count candidates even when superseded. Owned source snapshots,
parser snapshots and atlas snapshots can coexist; the 128 MiB limit is not a total
process-memory claim. The inherited renderer limits projected samples separately.

Cancellation is checked around every asynchronous boundary and progress callback.
One preparation can run per catalog; callback failures and cancellation release
the guard. Cooperative tasks run between model preflights and before the synchronous
atlas call. This CPU work belongs in a worker; JavaScript cannot interrupt a
synchronous decoder mid-call. Catalog ownership/disposal remains with the caller.

## Validation

The component head passes 635 public synthetic tests, TypeScript, document links,
publication paths, M0 evidence consistency and the actual build. Twelve new
original tests cover naming/stages/profile identity, container precedence and
omission, missing/incompatible pairs, owned geometry/picking, metadata mutation,
budgets, cancellation, reentrancy and recovery. Hosted public checks pass.

Private fresh catalog preparations and the independent Python source oracle
account for both openings:

| Profile | Placed voxel rows / types | Requests / complete pairs / absent optional | Verified model assets / atlas parts | Still-ready types |
| --- | --- | --- | --- | --- |
| RA2 | 19 / 10 | 14 / 14 / 0 | 28 / 14 | 8 |
| YR | 18 / 5 | 17 / 13 / 4 | 26 / 13 | 4 |

All required pairs resolve. The two spawn-alternate types and one numbered turret
type retain explicit selection limitations; their source/model bindings are
prepared but they expose no partial still. The independent raw-source oracle
matches 80 field values/origins, all 31 naming requests and 37 row joins after
rehashing 60 physical ranges / 3,086,009 bytes across five roots. The resource
fingerprints are RA2
`e19ca364183b8f8af2c2b695c581a34fb57c3de6a0f184532a4ea1bc9703ac62`
and YR
`cf17f3ec0d3018aceb5cab7ff6bb01e3531862e79e6a19f4c0bd290e9de63d1b`.
These are **session/audit identities**, including catalog source handles and
candidate IDs. Even equivalent files selected in a different order can change
them. They must never bind simulation, replay or save compatibility. Consumers
need a separate logical content/policy digest that excludes ephemeral selection
handles; verified asset SHA-256 values and the atlas source metadata remain
available for that purpose.

A separate raw-span/forward-face oracle compares every one of 133,864 selected
voxel records and 27 HVA matrices. All 78 frames match 3,833,856 RGBA and ownership
pixels, with maximum depth error `2.1316282072803006e-14`. These cases cover every
available body/attachment/alternative and all 12 complete still types at two
caller-chosen headings. The private contact sheet was inspected: all models were
visible and supported body/turret/barrel composites aligned under the explicit
unlit transform policy. Images remain private. This is component evidence, not
browser or native-game execution, native visual equivalence or campaign acceptance.

```sh
npm ci
node --import tsx --test tests/content/voxel-*.test.ts
npm run check
git diff --check
```

Private reproduction in the issue worktree uses `local/prepare.mjs`,
`local/source-oracle.py`, `local/render-probe.ts` and `local/raster-oracle.py`.
Run them with Node 24/tsx and the local Python with Pillow; native metadata uses
the private Capstone 5.0.6 environment and `local/evidence.py`. Rebuild the private
prepared inputs before the source and raster checks. The scripts rehash actual
roots, keep outputs under `local/corpus` and `local/raster`, and emit aggregate
facts. Missing retail inputs skip that gate and do not pass it. No game programs,
retail models, source INIs, matrices, geometry or rendered pixels are distributed.
