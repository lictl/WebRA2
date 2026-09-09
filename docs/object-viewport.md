# Placed-object mission preview

[Issue #111](https://github.com/lictl/WebRA2/issues/111) extends the existing
[terrain viewport](terrain-viewport.md) with source-verified, static SHP artwork
for placed infantry, vehicles, aircraft, buildings, scenery and ground marks.
The app calls this **Mission preview**. Mission logic is not running. Voxel types,
unresolved resources and unsupported placement plans remain explicitly unavailable;
there are no replacement icons or invented models.

## Preparation and ownership

The existing `/workers/terrain.js` dedicated worker reads selected files on-device.
One browser catalog loads the profile, opening map and terrain, then compiles
[`OBJECT_ART_POLICY`](object-art.md) (`webra2-object-still-2`) and prepares its
verified artwork. The preparation adapter receives frozen source anchors from
content, theater, palette and TMP members; conflicting identities fail closed.
The catalog is disposed after preparation. The retained scene owns selected
frame-zero indices, palettes, terrain planes and frozen placement descriptions.
Raw files, SHP buffers and palette arrays do not cross into the UI.

`terrain-scene-loader.ts` connects the catalog and content adapters;
`placed-still.ts` owns synchronous source-to-placement joins and presentation;
`object-protocol.ts` validates bounded public metadata. These are application
components, not changes to the deterministic simulation or shared contracts.

The app-private protocol is version **2**. Version 1 replies are rejected. Each
operation has an ID; each rendered frame has a separate ID. A render preserves
profile, map hash, content-manifest hash and presentation policy. A pick reports
only terrain or an object belonging to the displayed frame. A second pick is
not admitted while another operation is pending, and camera changes discard stale
selection results. Cancellation, profile changes, replacement and navigation
terminate the worker. The bridge retains the existing 15-minute load timeout
(source hashing included) and 30-second render/pick timeout. One acknowledged
progress message and one operation may be outstanding; camera changes coalesce.

## Explicit still-preview geometry

`webra2-placed-still-1` is a WebRA2 presentation choice. It does **not** assert
native anchors, depth sorting, lighting or facing. For a decoded map cell, let
`c` be its projected column, `r` its projected row and `e` its elevation. A
structure uses its compiled rectangular foundation `(w,h)`; other families use
`(1,1)`. Missing ground, outside-diamond placement or an unresolved structure
foundation leaves the placement unavailable.

| Value | Explicit formula |
| --- | --- |
| Ground center | `baseX = c*30+30`, `baseY = r*15+15` |
| Still anchor position | `x = baseX+(w-h)*15`, `y = baseY+floor((w+h-2)*15/2)-e*15` |
| Canvas anchor | `floor(canvasWidth/2)`, `floor(canvasHeight/2)` |
| Constant object depth | `baseY+15+(w+h-2)*15` |
| Depth ties | Object in front of terrain; lexicographically smaller stable object ID wins object ties |
| Source image | Frame zero, source index zero transparent, original palette, no remap |

Stable `object-N` IDs refer to the compiled placement order. They are local
preview identifiers. SHP rectangle offsets are applied by the sprite component.
There is no infantry subcell offset, direction choice, sequence animation,
shadow, house remap or per-mission patch. Terrain remains the documented base
variant with a 60×30 projection and elevation step 15. Overlays are still omitted.

## Bounds and interface

The scene allows at most 32,768 placements and uses the existing parser, verified
read, sprite and terrain budgets. Sprite source snapshots are capped at 128 MiB,
selected decoded sprite indices at 64 MiB, 1,024 assets, 4,096 selected frames,
65,536 indexed frames and 256 palettes. The canvas is at most 960×640. RGBA, depth,
terrain-owner and object-owner planes total 16 bytes per pixel (9,830,400 bytes
at maximum size). Only the exact `width*height*4` RGBA buffer is transferred.
These allocation counters do not measure browser process RSS or transient GC.

The metadata report admits 256 type rows and 262,144 retained string code units,
with at most eight reason strings per row. Omitted type, placement, prepared
placement and reason counts are explicit. Names/owners are shortened to 128 code
units with shortening counts; source paths have a 256-code-unit bound. All retained
object description strings have an additional aggregate 8 Mi-code-unit cap.
Strict validators reject sparse arrays, extra fields, boxed primitives, payload
objects, inconsistent totals and malformed buffers. Prepared object counts refer
to the whole mission, including objects outside the current camera or occluded.

English and original Traditional Chinese copy cover setup, progress, failure,
artwork availability and selected categories. Optional diagnostics retain source
paths/hashes, raw type/owner identifiers and unsupported-art reasons. The UI uses
text nodes and no retail text fixtures. Mouse and keyboard pan, zoom and picking
remain available; navigating to practice releases the preview worker. This slice
does not persist game assets or enable campaign-start buttons.

## Validation

Original miniature fixtures cover six object families, elevated rectangular
foundations, missing-ground/foundation omissions, transparent-pixel terrain
selection, palette/source ownership, exact frame picks, bounded omitted counts,
strict version-2 messages and both UI locales. The existing terrain controller,
worker lifecycle and fast second-click tests were migrated to the version-2 wire.

Commands from the repository with Node 24.20.0:

```sh
node --import tsx --test tests/browser/object-viewport.test.ts tests/web-ui/terrain.test.ts
npm run check
```

The implementation checkpoint passes all 502 public tests, type checking, docs,
publication/evidence checks and the 34-file code/license build. The private probe
reads the selected 438-file installation through the actual scene loader, then
compares a separately assembled scene against its exact RGBA result.

| Private opening | Prepared / placed objects | SHP sources | Visible objects at 100% / 50% |
| --- | --- | --- | --- |
| RA2 Allied opening | 792 / 811 | 107 | 118 / 455 |
| YR Allied opening | 552 / 570 | 131 | 73 / 227 |

The unavailable 19/18 placements use voxel artwork. No opening placement lacked
ground or a rectangular structure foundation. A private Python oracle verifies
root/member hashes, independently decodes all 238 selected SHP frames and five
palette selections, rederives every placement formula and compares RGBA, depth
and picked owners for all 2,457,600 pixels across two 960×640 views per opening.
All comparisons are exact. Its terrain background/depth is the existing tested
TypeScript renderer output; this is an independent **object composition** check,
not an independent terrain renderer or original-game oracle. Artwork identities
also agree with the earlier native-art source preparation evidence.

Final immutable build identity and four-browser UI acceptance remain pending in
this draft. No pending gate is a passing campaign test. Private outputs stay
under ignored `local/object-viewport/`; no retail imagery is published here.

See [object-art evidence](object-art.md), [sprite policy](sprite-layer.md),
[application provenance](../apps/web/PROVENANCE.md) and
[licensing](licensing.md) for the component boundaries and notices.
