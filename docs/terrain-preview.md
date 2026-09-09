# Verified terrain preview resources

[Issue #86](https://github.com/lictl/WebRA2/issues/86) prepares the selected
mission's real terrain sources for [the viewport work](https://github.com/lictl/WebRA2/issues/83).
It joins verified definition loading, geometry/object compilation, theater mappings,
PAL expansion and TMP slot validation. It renders no pixels and executes no mission.

`prepareTerrainPreview(catalog, request, options?)` takes a catalog created by
`inspectBrowserCatalog`, an explicit profile/engine version/mission path, a
`theaterIniPath`, a `palettePath`, and `variantPolicy: 'base-only'`. The caller chooses
those logical paths; the loader does not infer native theater/locale mount order.
The compiled mission determines the theater identifier and must agree with the
supported RA2/YR theater domain. Every result has `canStartCampaign: false` and
`assetSelection: 'unique-candidate-base-only'`.

## Selection and composition

The [definition loader](installation-profile.md) first resolves the ten required
roles using its versioned loose/patch policy. The preview then rereads the exact
selected mission identity and passes the same owned bytes to the independent
[geometry](scenario-terrain.md) and [object](scenario-objects.md) compilers. A
definition conflict cannot become a partially prepared preview.

The explicitly named theater INI and palette must each have one eligible, unblocked
catalog candidate. The INI compiles through [theater tile mapping](theater-tiles.md).
Every distinct tile/high-word/subtile reference resolves through that compiler;
the explicit base-only policy selects its base filename, including clear-sentinel
mapping. Unsupported high words, missing clear mappings and out-of-range references
fail. Replacement variants and native random choice remain unimplemented.

Each distinct base filename must also have exactly one eligible candidate. This
preview has no automatic priority rule for conflicting physical theater resources,
including a loose replacement alongside its archived original. It does not collapse
two copies merely because their sizes match. Broader explicit mod/source selection
is still required for launch compatibility. Filename hashes remain candidates,
not authenticated literal names. A physical member matching two required logical
paths fails, including collisions with any previously verified definition candidate.

Each full root identity must remain consistent throughout definition and preview
reads. Validated identity scalars are detached before further awaits. Expected
mission pins are never downgraded to discovery. The catalog verifies its source
reads, and the preview independently hashes owned returned member bytes before
parsing. A corrupt adapter cannot replace an already verified root hash or range.
Native typed-array accessors/copying protect the member snapshot boundary.

All selected TMP sources require 60×30 tile dimensions, a present requested slot
and its depth plane. The parser validates their index and plane ranges; decoding
and composition have separate renderer budgets. The 768-byte PAL must contain
six-bit components. Existing PAL expansion produces opaque RGBA using `RGB << 2`.
This is an explicit raw-palette preview, with no native lighting/remap inference.

The result carries definition/geometry/object/theater provenance, verified source
identities, owned TMP bytes, owned `paletteRgba`, and one
`{sourceRecord, assetId, subtile}` choice per terrain cell. Join by `sourceRecord`,
never by array position: geometry sorts cells into projected display order while
retaining the original packed-record IDs. Asset IDs follow sorted normalized paths.
Renderer callers pass `terrain`, `assets`, `choices`, `paletteRgba` and their explicit
projection policy to the scene API.

These are private on-device composition objects, not a public report or a worker
message schema. Definition catalogs include methods; do not blindly structured-clone
the entire result. A content/render worker should retain it and emit bounded viewport
pixels and player-facing metadata. Tile and palette arrays are owned mutable buffers;
later mutation cannot alter the immutable catalog or a future preparation result.
Do not publish retail source buffers, compiled tables or rendered images.

## Bounds and cancellation

| Preview bound, lowerable only | Maximum |
| --- | ---: |
| Unique complete-root bytes, including definition verification | 1 GiB |
| Selected base TMP files | 1,024 |
| Retained TMP source bytes | 128 MiB |
| Distinct tile/high-word/subtile references | 16,384 |
| Terrain cells / emitted choices | 130,816 |

The definition loader retains its separate 256-reference / 32 MiB candidate-byte
and 16 MiB member caps. The selected mission is bounded to 16 MiB, theater INI to
8 MiB, and palette to exactly 768 bytes. The TMP count/byte caps cover tile sources,
not definition/mission/INI/palette buffers or total RSS. Compiled tables, parser
metadata, native File backing storage and renderer allocations require additional
memory. No all-frame or all-cell pixel cache is allocated by this loader.

Definition root limits are applied before its reads. Additional roots are reserved
against the cumulative budget before discovery. All tile references, candidate
metadata and aggregate source/root budgets are checked before the first TMP read;
repeated cells reuse one selected source. Reads remain sequential. Callbacks expose
only phase/count/path and propagate errors. Failure returns no partial preview.

Give the catalog and preview the same AbortSignal for prompt cancellation of pending
native reads. A per-call signal alone checks before/after catalog operations.
Cancellation stops further work; a late native read is discarded. One preview per
catalog can run at a time, including reentrant callbacks. The caller coordinates
other direct catalog operations and owns final disposal.

The inspector now recognizes loose `.tem`, `.sno`, `.urb`, `.ubn`, `.des` and `.lun`
tile files for assets-only selections. Extension recognition does not decode a file
or certify its theater/profile compatibility. Executable siblings remain ignored;
no filesystem-serving or network endpoint was added.

## Evidence and reproduction

Original synthetic tests compose tiny genuine INI/LZO/LCW/TMP/PAL fixtures for both
profiles. They cover clear tiles, object/terrain joins, reordered packed records,
palette bytes, immutable provenance/owned buffers, bad slots/depth/dimensions,
missing/duplicate resources, wrong profiles and stale identities, cross-role/name
collisions, root hash consistency, aggregate preflight, cancellation and reentrancy.
A separate inspector table covers all six loose extensions and ignored executables.

The private full-selection probe uses the 438 supplied files as native file-backed
Blobs. For every base source and cell/slot choice it compares against the earlier
[independently checked theater closure](theater-tiles.md), joining normalized
logical filenames and original record IDs. No native game executable is run.

| Profile / selected mission | Cells / choices | Object rows | Base TMP files | TMP source bytes | Verified root/member bytes / attempts |
| --- | ---: | ---: | ---: | ---: | ---: |
| RA2 / `all01t.map` | 6,336 | 811 | 188 | 1,551,620 | 346,639,680 / 202 |
| YR / `all01umd.map` | 15,480 | 570 | 242 | 1,875,984 | 586,895,088 / 257 |

The explicit pairs are `urban.ini` / `isourb.pal` and `urbannmd.ini` / `isoubn.pal`.
Pinned EA editor [definition loading](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L404-L438)
and [palette initialization](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L4263-L4295)
support these candidate pairings; they do not prove universal native precedence or
lighting. Palette members were verified at `ra2.mix` offset 95,136 and `ra2md.mix`
offset 1,424, each 768 bytes. Their member SHA-256 values are
`b1f4c15b7b91130736b4dffeb189ca32621bf606afbc0b2d02eb5584b6921fe3` and
`1aa49468a9439a5cff3e5f66fae0678501e9dc3ef7a4d90f23127c38ad6e4676`.
Opaque RGBA hashes are respectively
`19edbb1edc25503fd22eed9aae8c0f24b40322119f07559d7011fa7c7f74a6ae` and
`0fe95719369071b61523cecc3c2a8f8ab670476406c800914efcbef56ade80e9`.
Definition fingerprints still match #79/#62. These results establish resource
preparation, not rendered alignment or a campaign playthrough.

Run `npm ci`, `node --import tsx --test tests/content/terrain-preview.test.ts
tests/vfs/browser-import.test.ts`, and `npm run check` on Node 24.20.0. The retained
private recipe is `node --import tsx local/terrain-preview/probe.mjs` from the root;
it writes counts/hashes under ignored `local/terrain-preview/` and reads the prior
closure in `local/worktrees/theater-tiles/local/theater-closure.json`. Missing retail
files or prior private evidence skip this separate gate, never pass it. Recreate
the closure with the linked component's documented recipe when needed.

The new composition/tests use the existing GPL-3.0-or-later component provenance;
PAL/TMP references and notices are already retained in the development bundle.
No dependency or retail content was added. Remaining rendering is explicitly listed:
replacement variants, native lighting/depth, overlays, objects and effects. UI
presentation, complete resource/mod selection, simulation and campaign interpretation
remain required downstream work.
