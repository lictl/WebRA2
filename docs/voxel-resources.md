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

## Validation checkpoint

Twelve original synthetic tests cover naming/stages/profile identity, container
precedence and omission, missing/incompatible pairs, owned geometry/picking,
metadata mutation, budgets, cancellation, reentrancy and recovery. Type checking
passes. Private fresh catalog preparation accounts for all 10 RA2 and five YR
opening voxel types. All named model resources resolve and pair; eight RA2 and four
YR types expose still bindings. The two spawn-alternate types and one numbered
turret type retain explicit selection limitations. This is component evidence,
not browser or native-game execution. Independent private source/geometry/raster
comparison and final full checks remain in progress at this checkpoint.

```sh
npm ci
node --import tsx --test tests/content/voxel-*.test.ts
npm run check
git diff --check
```

Private reproduction scripts and outputs live in ignored `local/` in the issue's
worktree; missing retail inputs skip that gate and do not pass it. No game programs,
retail models, source INIs, matrices, geometry or rendered pixels are distributed.
