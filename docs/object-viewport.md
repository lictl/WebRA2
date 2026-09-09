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

The original implementation checkpoint passes 502 public tests. After integrating
main, the reviewed code at `74bc83d1014f0d6e2ab6beacf7ffcd81d7efbfc2` passes
548 public tests, type checking, docs/publication/evidence checks and the 35-file
code/license build. The private probe
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

The independent reviewer reproduced the actual loader outputs and all private
oracle comparisons in an isolated checkout. The [exact-head COMMENT review](https://github.com/lictl/WebRA2/pull/121#pullrequestreview-5160141495)
records no actionable code findings, with browser acceptance still pending at
that review checkpoint. [Hosted checks](https://github.com/lictl/WebRA2/actions/runs/34407612719)
also pass. Private outputs stay under ignored `local/object-viewport/`; no retail
imagery is published here.

## Actual browser evidence

Native folder selection on macOS used the same 438-file installation and frozen
localhost4174 bundle. Every browser completed cancellation/retry, camera pan and
50%/100% zoom, visible object selection, English/Traditional Chinese UI and
navigation to the original Practice screen. Returning releases the rendered scene
and retains the selected Files for a new load. These are actual UI checks, not
retail mission playthroughs.

| Browser | Completed opening previews | Selected visible building |
| --- | --- | --- |
| Chrome 152.0.7977.83 | RA2: 792 prepared / 19 unavailable; YR: 552 / 18 | RA2 (52,51), YR (82,82) |
| Firefox 151.0.1 | RA2: 792 / 19; YR: 552 / 18 | RA2 (52,51), YR (82,82) |
| Edge 152.0.4191.66 | RA2: 792 / 19; YR: 552 / 18 | RA2 (52,51), YR (82,82) |
| Safari 26.6.2 | RA2: 792 / 19; YR: 552 / 18 | RA2 (52,51), YR (82,82) |

The selected RA2 object is `object-199`, using `cunewy13.shp`, SHA-256
`dbacd860954065079fcdb233cde4cde0d1de3aa36ac7501710ac4e611c16a820`.
The YR selection is `object-142`, `cnnewy11.shp`, SHA-256
`14e7a04eeebd72dc012e2678783314c2fee4af167edbb4609796e1753c0a7b9e`.
The source identities agree with the private preparation; UI categories and
coordinates agree across the tested browsers. Visible images were inspected
privately. None are in the repository, output bundle or CI artifacts.

The UI showed 333.89 / 565.04 MiB verified reads and 107 / 131 SHP sources for
RA2/YR. Chrome exposed a 958×639 canvas (9,794,592 bytes in the four explicit
pixel planes). Rounded counters in the other browser UIs are allocation metadata,
not process-memory measurements. Chrome additionally exercised keyboard Home;
every shortcut and drag-gesture/browser combination was not exhaustively tested.

Completion was observed within 30 seconds per profile in Chrome, Firefox and
Edge, within 100 seconds for Safari RA2 and within 210 seconds for Safari YR.
These conservative rounded intervals include UI/tool scheduling and gaps between
checks; they are observation bounds, not controlled performance benchmarks. Safari camera work remained responsive but needed its
pending operation to finish before picking; the disabled control correctly
prevented a premature pick.

Chrome's automated tab did not open the native folder picker. A normal native
new tab did. Edge initially displayed a selected Sleeping blank tab; a normal
menu Quit/reopen restored rendering. No browser flags, security or settings were
changed. The causes of those UI-control states are not established. Safari's
static message-driven canvas updates pass independently of the separate
[persistent-media presentation issue](https://github.com/lictl/WebRA2/issues/115).

All 35 served code/license files independently match the retained build manifest
SHA-256 `cd6ce8b29e0787be9e53e70b3504d768ef80a722251373fd33f788a5bbe9b475`:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `app.js` | 124,543 | `a6f41bda3e987209b4f8598103662775a22fb8b1dc8224b495472926c9712f7c` |
| `workers/terrain.js` | 244,087 | `e729781fa689c6157650aba31d3427788c7fa9d344a58f490209a0898ee4bf17` |
| `app.css` | 26,489 | `d98377a8470e6b47e81639d22ef9acba475e737dd95ada3182dd8d9e14db38b1` |

The localhost browser request log contains 89 GET requests for page/code/styles/
chunks, the terrain worker and five rejected favicon requests. The separate
35-route code/license hash probe is excluded from that browser count. No request body or asset/save
path appears; the launcher retains `connect-src 'none'`. This is a localhost
server-boundary observation, not an audit of installed browser extensions or
telemetry. The original4173 acceptance server remains intact.

Private reproduction files include `probe.mjs`, `facts.json`, `oracle.py`,
`oracle-facts.json`, `browser-observations.json`, `browser-versions.json`,
`tested-manifest.json`, `served-facts.json`, `requests.jsonl` and check logs in
repository-root `local/object-viewport/`. The oracle consumes private extracts;
it is deliberately separate from public tests and cannot pass when those inputs
are absent.

See [object-art evidence](object-art.md), [sprite policy](sprite-layer.md),
[application provenance](../apps/web/PROVENANCE.md) and
[licensing](licensing.md) for the component boundaries and notices.
