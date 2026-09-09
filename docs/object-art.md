# Verified object still resources

[Issue #100](https://github.com/lictl/WebRA2/issues/100), followed by the exact-source
migration [#110](https://github.com/lictl/WebRA2/issues/110), adds a pure artwork plan and
on-device resource preparation for a later scene consumer. It does not start a
campaign, allocate native objects or select native animation/facing frames.
Both outputs explicitly retain `canStartCampaign: false` and
`nativeBehaviorVerified: false`.

## Plan and source policy

`compileObjectArt({objects, rules, art, theater, policy: 'webra2-object-still-2'})`
requires immutable outputs from the object/INI compilers, matching explicit profiles,
and exactly one map-rule layer with the object's source hash. The caller supplies
the theater from its verified terrain result. This function does not hash input
bytes or infer theater from filenames. The resulting plan is frozen and locally
branded; reconstructing JSON does not recreate a resource-loader capability.

The six placement families share stable case-folded type IDs and row-ID joins.
The planner constructs source stages using the reviewed native identity model.
`ImageFile` begins with the first allocated type spelling. Only an exact `Image`
key in a subsequently visited exact rule section changes that value; earlier
sections are not loaded retroactively for late registrations. Case-distinct rule
and art names remain distinct. Unresolved or never-loaded type definitions remain
unsupported.

Exact art lookups use the current ImageFile name. At each visited rule stage,
`Theater`, `NewTheater` and `Voxel` retain their previous flag values when the new
art definition omits that exact key. Their initial false values and current-value
reads model the inspected generic ObjectType path. Family-specific defaults and
other art properties still need their own native policies. A building art `Image`
redirect changes only its file stem; flags stay with the original definition.
Other families declaring that redirect are explicitly unsupported in this slice.

The plan records exact section/key names, source namespace, selected/shadowed
origins and the rule stages where art fields were consulted. Multiple art layers
use the explicit `exact-name-last-layer` policy; this does not claim native
populated-INI duplicate behavior. Repeated exact consulted sections or keys within
a layer are ambiguous even if their fields are disjoint. The general RuntimeIni
output remains unchanged alongside this source view.

Frame zero is an explicitly requested still, not a standing pose. Sequence and
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
sections or fields within a layer produce reasons instead of a usable plan for that type.

The plan pins `webra2-ini-source-view-1` and `webra2-scenario-construction-1`.
[Profile content policy 2](profile-content.md) includes those policies and this
artwork policy in its fingerprints, and exposes all eight exact source views
beside the existing tables. Earlier policy-1 fingerprints are deliberately
incompatible. [#103](https://github.com/lictl/WebRA2/issues/103) retains remaining
consumer and native parser work. Filename fallback, foundation metadata, frame
selection, family defaults and layered art remain explicit bounded presentation
choices; this is not full native artwork fidelity.

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
three million graph values, 96 Mi UTF-16 code units and depth 32. Indexed art
lookups/stage visits have a 4,194,304-unit work cap; source reconstruction and
native identity construction also enforce their own component limits. Immutable inputs
reject sparse arrays, cycles, accessors, symbols and hidden properties before joins.
Preparation caps: 8,192 references, 2,048 candidates, 1,024 SHP assets, 128 MiB
candidate source bytes, 1 GiB source roots, 65,536 indexed frame headers and 64 MiB
selected frame pixels. Per-SHP limits remain those of the decoder. Callers may lower
caps only. Palette input is bounded to 768 bytes per unique resource. Aggregate
source/root/reference limits precede discovery; index/pixel checks precede decoding.

Public original fixtures cover all six families and both profiles, image overrides
with provenance, exact-case names, first allocation/late registration, retained
flags across Image changes, building aliases and exact-layer ambiguity, filename fallback, source/profile isolation, owned mutable outputs,
equivalent duplicates, loose/expansion selection, unresolved conflicts/mounts,
corruption, decoder failure paths, cancellation/retry, metadata mutation across
asynchronous discovery, boxed scalar/getter rejection and allocation limits.

```sh
node --import tsx --test tests/content/object-art.test.ts tests/content/object-preview.test.ts
npm run check
```

Private policy-2 `local/native-art/prepare.mjs` (policy-1 evidence remains under
`local/object-art/`) creates genuine File objects
from the read-only installation, inspects the catalog, loads the pinned opening
profile and compiles the plan. After the reviewed [SHP header fix](shp-runtime.md),
both complete preparations pass. The general native palette-prefix rule also
resolves the remaining RA2 palette without a hardcoded object name.

| Opening | Placed types / rows | Ready SHP types / unique assets | Voxel types | Palettes | Decoded frame-zero pixels | Indexed headers |
| --- | --- | --- | --- | --- | --- | --- |
| RA2 | 120 / 811 | 110 / 107 | 10 | 3 | 980,819 | 3,442 |
| YR | 143 / 570 | 138 / 131 | 5 | 2 | 1,597,457 | 3,594 |

The separate private Python `local/native-art/oracle.py` reads and hashes five original roots and
276 member ranges, independently allocates type IDs and interprets exact raw INI source stages for
this explicit policy, and compares every type/placement join, candidate selection,
selected SHP frame index and palette RGBA byte. It matches all 238 selected frames
and 2,578,276 pixels. Canonical comparison projections are
`76717d950f45baecf759b19db1953ab6a44070dbac24e130aef601a26b3d72b9`
(RA2) and `5287b5678e9eaf58cf3e7c78d7a2c46713f6d1629416c3111dedad29ea141ea8`
(YR). These checks verify still-resource preparation, not native placement,
all native family defaults or campaign behavior. Missing retail files skip this
private gate; no source bytes, decoded pixels or original INI values are published.

The [component notice](../packages/content/OBJECT_ART_PROVENANCE.md) records source
attribution and separates editor observations from these WebRA2 preview choices.
