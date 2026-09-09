# On-device mission terrain viewport

Issue [#92](https://github.com/lictl/WebRA2/issues/92) connects the verified
[terrain preparation](terrain-preview.md) and bounded
[CPU terrain scene](terrain-scene.md) to the application in
[PR #95](https://github.com/lictl/WebRA2/pull/95). The implementation and actual
browser checks below are complete; final exact-revision review precedes merge.
It displays terrain for the RA2/YR Allied openings. Objects, overlays, effects,
native lighting/depth, variant selection and mission execution remain incomplete.
The bright utility/filler colors are not patched away per mission.

Run `npm ci` and `npm start`, then choose **Terrain**, a profile, and local files
or a folder. The inspector and original practice/save interface remain separate
views. Changing views releases the terrain scene; selected File handles remain
only in memory until replaced or the page closes. No asset/image upload, storage,
export, executable launch or user-provided code occurs.

## Worker boundary

The explicitly bundled `/workers/terrain.js` owns scanning, verified root/member
reads, resource preparation, CPU scene construction and the current frame's picking
planes. It retains no whole prepared result after construction; CSF methods, asset
buffers and compiler tables are not transferred to the main thread. Assets project
to exact `{id, sha256, bytes}` renderer records, and choices preserve `sourceRecord`.
The catalog is disposed after preparation. The renderer retains its selected planes
and placement metadata; source snapshots are then collectible.

App-private protocol v1 uses monotonically increasing request IDs. `load` carries
native Files plus explicit folder-relative paths, the profile and bounded dimensions.
`render` carries camera/dimensions; `pick` names the displayed frame and output pixel.
Replies contain only bounded plain metadata and a transferred viewport RGBA buffer.
Main validation checks every nested field, dense arrays, scalar types, exact pixel
length/allocation counts, request/frame identity and stable profile/map identity.
A single acknowledged progress message is in flight; later progress replaces the
pending update. No prepared content object is blindly structured-cloned.

There is one outstanding operation. Camera/resize changes replace the desired
camera, rather than queueing jobs. An outdated render is discarded; a pick is never
accepted for another frame. Cancellation terminates the worker and ignores late
results. Retry creates a new worker from the retained local selection. A full load
has a 15-minute timeout; render/pick operations have 30 seconds. These are failure
bounds, not performance promises or guarantees of background execution. Cancel is
available during a long load or synchronous worker operation.

## Presentation and bounds

The explicit presentation is 60×30 tiles, elevation step 15, base variants, opaque
palette expansion by `RGB << 2` and the scene's versioned depth/tie policy. These
are WebRA2 baseline choices, not verified native semantics. Normal UI describes
these limitations; technical source/hash/policy diagnostics are in a details view.
No campaign start control is offered.

Canvas output is at most 960×640 (no device-pixel-ratio multiplication), with zoom
0.5, 1, 2 or 4. A maximum frame allocates 2,457,600 RGBA bytes plus equal-sized
depth and owner planes: 7,372,800 explicit pixel bytes. The prior worker frame is
released before rendering another. The transferred latest display buffer, browser
canvas backing storage, in-flight allocation overlap and garbage collection add
memory beyond that per-frame count; this is not a total RSS/hostile-codec guarantee.
The scene separately caps source snapshots at 128 MiB, decoded planes at 64 MiB,
1,024 assets and 130,816 cells. Preparation retains its 1 GiB unique-root budget
and catalog/hash read limits, described in the linked component reports.

Drag or arrow keys pan; wheel/buttons/select zoom; Home/reset restores the centered
view. Click or Enter/Inspect center selects a visible cell through worker picking.
Resizes coalesce and preserve the camera center. Main interface controls, states
and recovery text are original English/Traditional Chinese. Source names and raw
technical diagnostic codes remain optional details, populated with textContent.

## Validation

`node --import tsx --test tests/web-ui/terrain.test.ts` passes ten original
application tests: strict envelopes/buffers, progress backpressure, worker frame
ownership, cancellation/stale results, coalesced camera/picks, resize during load,
failed preparation/retry, profile/selection replacement, fast second-click marker admission and localized states.
The injected tiny pixel scene tests plumbing only; actual renderer/codec tests and
private browser images are separate gates. `npm run check` passes on tested source
`f352550f8fe153c37afab164d0101ab599a7325c`: strict types, 398 public tests,
71 Markdown files / 347 local links, publication and M0 metadata checks, and an
actual build with 28 code/license files from 66 inputs. Hosted checks also
[passed on that revision](https://github.com/lictl/WebRA2/actions/runs/34393832521).
The reviewer-identified fast second-click race was corrected before the final
browser runs: only an admitted pick can move the selection marker.

## Actual browser evidence

Observed on macOS on 2026-09-10 (Asia/Tokyo), with 438 files selected from the
supplied installation through native folder choosers. Browser dialogs label this
grant as an upload; the application reads the resulting Files locally and the
launcher receives no asset data. The following are actual UI/rendering checks,
not headless substitutions or retail mission playthroughs.

| Browser / version | Completed terrain and display | Camera, selection and locale |
| --- | --- | --- |
| Chrome 152.0.7977.83 | RA2 and YR; 6,336 / 15,480 cells and 188 / 242 tile sources. Both real images inspected. | RA2 center (56,56), right pan (61,56), 200% zoom, reset and keyboard left/Enter (55,57); YR center/direct canvas click (94,94). English and Traditional Chinese. |
| Firefox 151.0.1 | YR; 15,480 cells / 242 sources; actual terrain image inspected. | Center (94,94), right pan (96,92), 200% zoom, reset to (94,94). English and Traditional Chinese. |
| Safari 26.6.2 | RA2; 6,336 cells / 188 sources; actual terrain image inspected. | Center (56,56), right pan (61,56), 200% zoom, reset to (56,56). English and Traditional Chinese. |
| Edge 152.0.4191.66 | YR in a freshly restarted normal session; 15,480 cells / 242 sources; actual terrain image inspected. | Center (94,94), right pan (96,92), 200% zoom, reset to (94,94). English and Traditional Chinese. |

Every completed profile showed the expected verified mission/palette identity:

| Profile | Mission SHA-256 | Palette member SHA-256 |
| --- | --- | --- |
| RA2 | `ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c` | `b1f4c15b7b91130736b4dffeb189ca32621bf606afbc0b2d02eb5584b6921fe3` |
| YR | `dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0` | `1aa49468a9439a5cff3e5f66fae0678501e9dc3ef7a4d90f23127c38ad6e4676` |

The RA2/YR details showed 3.64 / 4.46 MiB decoded planes and 330.58 / 559.71 MiB
verified reads, matching the rounded values from the independently checked
preparation report. Chrome exposed a 958×639 canvas: 7,345,944 explicit RGBA/depth/
owner bytes (7.01 MiB). Safari and Edge displayed 7.01 MiB; Firefox displayed
6.96 MiB in its smaller viewport. Those latter values are UI-rounded observations,
not exact process-memory measurements. All remain below the per-frame cap above;
native canvas/storage/garbage-collector overhead was not separately measured.

UI-observed completion intervals were at most 16.328 seconds for Chrome YR,
21.067 seconds for Firefox YR, 86.246 seconds for Safari RA2, and 36.102 seconds
for fresh Edge YR. These include tool/native scheduling and gaps between checks;
they are coarse observed upper bounds, not controlled load benchmarks. An older
long-running Edge test session produced updated accessibility metadata while its
captured window retained stale initial paint. Raising/opening the window and
opening/cancelling the chooser did not establish fresh pixels. A normal quit and
relaunch fixed the display/menu behavior; no flags, settings, security rules or
permissions were changed. The earlier Edge RA2 metadata-only run is excluded from
the visual acceptance table, and restart does not establish the cause of that issue.

Chrome cancelled an active real archive scan, retained the 438-file selection and
successfully retried. Direct canvas clicking selected the visible YR center cell.
Navigation to Practice allowed an original scenario start and logical step; returning
to Terrain released its scene/display and retained only the selected Files for a
new load. The installation inspector still opened independently. Keyboard pan/Enter
was checked in Chrome; mouse pan buttons, zoom, reset and picking were checked in
all four. Drag-gesture and every shortcut/browser combination were not exhaustively
tested; lifecycle/protocol failures have the original synthetic coverage above.

The final browser runs used the same immutable localhost bundle:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `app.js` | 117,457 | `40cc27984f5128d77162ab91f28053291be3bc819734c7f812b8b81035e44446` |
| `workers/terrain.js` | 160,140 | `1025c182460570e8744615886dac6c4c7226169292352b10fe41afa0e1027f11` |
| `app.css` | 25,416 | `12e9c10ce6a9d7bd83dda23912ddfe2debb7de3d52f80a09ad5b3de1589ed5e4` |

Private metadata/manifests/check logs remain under repository-root
`local/terrain-viewport/`, including `browser-observations.json`,
`browser-versions.json`, `tested-manifest.json`, `check-marker.log` and
`requests-f352.jsonl`. The observed localhost log has 63 GET requests for page,
code, styles, chunks, terrain/simulation workers and a rejected favicon request;
no request body or asset/save path appears. This is a server-boundary observation,
not an audit of browser extensions/telemetry. The code-only launcher retains its
`connect-src 'none'` policy. Retail images were inspected privately; they are not
published in this report, the source tree, build outputs or CI artifacts.

No new dependency is added. The original app remains under its
[GPL provenance](../apps/web/PROVENANCE.md); the root-authored build/server route
and [renderer notice](../packages/render/PROVENANCE.md) are reviewed separately
from the application. Retail buffers and screenshots remain ignored local data.
