# Verified object still resources

[Issue #100](https://github.com/lictl/WebRA2/issues/100) adds a pure artwork plan and
on-device resource preparation for a later scene consumer. It does not start a
campaign, allocate native objects or select native animation/facing frames.
Both outputs explicitly retain `canStartCampaign: false` and
`nativeBehaviorVerified: false`.

## Plan and source policy

`compileObjectArt({objects, rules, art, theater, policy: 'webra2-object-still-1'})`
requires immutable outputs from the object/INI compilers, matching explicit profiles,
and exactly one map-rule layer with the object's source hash. The caller supplies
the theater from its verified terrain result. This function does not hash input
bytes or infer theater from filenames. The resulting plan is frozen and locally
branded; reconstructing JSON does not recreate a resource-loader capability.

The six placement families share stable case-folded type IDs and row-ID joins.
The plan retains selected/shadowed property origins. Rules `Image`, then one art
`Image`, choose a basename. Flags come from that original art definition; an art
alias does not recursively load another definition. The chosen frame is always
zero and means an explicitly requested still, not a standing pose. Sequence and
remap intent remain provenance only. Index zero is transparent and the palette
is unmodified. Voxel types remain explicit for a later compositor.

For a theater-marked SHP, try the requested theater extension. For a `NewTheater`
stem beginning G/N/C/Y, try its second character replaced with the requested
letter, then G. Finally try the unchanged `.shp` stem. No other theater is searched.
RA2 accepts temperate/snow/urban; YR additionally accepts new urban/desert/lunar.
Terrain, smudges, `Theater` or `TerrainPalette` use the theater iso palette; other
stills use its unit palette. Explicit `Palette` is a bounded prefix followed by the current theater suffix and
`.pal`, as observed in both pinned native palette loaders. A value with an explicit
extension is unsupported rather than silently stripping it.
Rectangular structure `Foundation` metadata is retained without placing the sprite.
Missing definitions, unsupported booleans/names/foundations and repeated consulted
fields within a layer produce reasons instead of a usable plan for that type.

The current general `RuntimeIni` view folds ASCII section/key case. Native
construction research found literal case-sensitive section/key CRC lookup in both
executables; [#103](https://github.com/lictl/WebRA2/issues/103) tracks the exact-case
view needed by other consumers. This still policy is not an effective native art
resolver, especially for mods with case-distinct definitions. Original inheritance,
allocation-time property loading and native duplicate-section rules are separate.

## On-device preparation

`prepareObjectPreview(catalog, plan, {signal, onProgress, limits, anchors})` uses
only the selected native File catalog. The caller owns its lifetime and cancellation;
one preparation may run per catalog at a time. Optional scene source identities
anchor already-verified root size/hash facts, captured before the first await.
They do not authenticate arbitrary member facts supplied by a caller.

The first path with candidates ends filename fallback, even if blocked, conflicting,
ambiguous or unsupported. Candidate and report-root fields are validated as primitive values and captured before
the first asynchronous discovery. Returned candidate metadata is frozen; later
caller mutation cannot change the checked budgets or identities. Loose
files rank 200; explicit profile expansion NN archives rank 1+NN; recognized base
roots rank zero. This finite policy deliberately does not invent nested archive
ordering. All highest-ranked copies must have identical verified size/hash.
Equivalent copies remain listed; physical path/offset/ID only select which identical
bytes to retain. Unsupported mounts and conflicting copies stay unresolved.

Discovery rechecks candidate root/member range, pins each root's size/hash, owns a
fixed byte snapshot and hashes the actual member bytes independently. Lower-ranked
candidates also consume budgets and receive verification when the resource is
eligible. A selected SHP passes aggregate index/pixel preflight and frame-zero decode;
a selected palette must be exactly 768 six-bit RGB bytes. Outputs own the SHP bytes
and 1,024-byte RGBA palettes; they contain player payloads and must never be sent to
a public report, server, CI artifact or repository. Resource metadata is separate.
A malformed/unsupported selected frame fails the whole preparation with its resource
path; cancellation/failure releases the overlap guard so retry can proceed.

The later [sprite compositor](sprite-layer.md) independently hashes selected sources
and owns decoded indices. Native placement anchors/depth, house remapping, animation,
shadows, lighting, attached artwork and voxel composition remain separate policies.

## Bounds and verification

Plan caps: 32,768 placements, 2,048 distinct placed types, 262,144 effective fields,
three million graph values, 96 Mi UTF-16 code units and depth 32. Immutable inputs
reject sparse arrays, cycles, accessors, symbols and hidden properties before joins.
Preparation caps: 8,192 references, 2,048 candidates, 1,024 SHP assets, 128 MiB
candidate source bytes, 1 GiB source roots, 65,536 indexed frame headers and 64 MiB
selected frame pixels. Per-SHP limits remain those of the decoder. Callers may lower
caps only. Palette input is bounded to 768 bytes per unique resource. Aggregate
source/root/reference limits precede discovery; index/pixel checks precede decoding.

Public original fixtures cover all six families and both profiles, image overrides
with provenance, filename fallback, source/profile isolation, owned mutable outputs,
equivalent duplicates, loose/expansion selection, unresolved conflicts/mounts,
corruption, decoder failure paths, cancellation/retry, metadata mutation across
asynchronous discovery, boxed scalar/getter rejection and allocation limits.

```sh
node --import tsx --test tests/content/object-art.test.ts tests/content/object-preview.test.ts
npm run check
```

Private `local/object-art/{probe,compile,prepare}.mjs` creates genuine File objects
from the read-only installation, inspects the catalog, loads the pinned opening
profile and compiles the plan. After the reviewed [SHP header fix](shp-runtime.md),
both complete preparations pass. The general native palette-prefix rule also
resolves the remaining RA2 palette without a hardcoded object name.

| Opening | Placed types / rows | Ready SHP types / unique assets | Voxel types | Palettes | Decoded frame-zero pixels | Indexed headers |
| --- | --- | --- | --- | --- | --- | --- |
| RA2 | 120 / 811 | 110 / 107 | 10 | 3 | 980,819 | 3,442 |
| YR | 143 / 570 | 138 / 131 | 5 | 2 | 1,597,457 | 3,594 |

The separate private Python `oracle.py` reads and hashes five original roots and
276 member ranges, parses raw INI definitions independently for this explicit
preview policy, and compares every type/placement join, candidate selection,
selected SHP frame index and palette RGBA byte. It matches all 238 selected frames
and 2,578,276 pixels. Canonical comparison projections are
`063bb06744acf8489ba8297529efc39a2fac46bcd25e37fd8768f36f49f41e61`
(RA2) and `15a7ff25a6bc2ad4ec4f330fa003b00557ebe0834f2fae6fe147065f80f5f510`
(YR). These checks verify still-resource preparation, not native placement,
case-sensitive allocation or campaign behavior. Missing retail files skip this
private gate; no source bytes, decoded pixels or original INI values are published.

The [component notice](../packages/content/OBJECT_ART_PROVENANCE.md) records source
attribution and separates editor observations from these WebRA2 preview choices.
