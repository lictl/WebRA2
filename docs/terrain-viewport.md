# On-device mission terrain viewport

Issue [#92](https://github.com/lictl/WebRA2/issues/92) connects the verified
[terrain preparation](terrain-preview.md) and bounded
[CPU terrain scene](terrain-scene.md) to the application. This implementation is
in progress; actual browser evidence and independent review remain pending.
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

`node --import tsx --test tests/web-ui/terrain.test.ts` passes nine original
application tests: strict envelopes/buffers, progress backpressure, worker frame
ownership, cancellation/stale results, coalesced camera/picks, resize during load,
failed preparation/retry, profile/selection replacement and localized states.
The injected tiny pixel scene tests plumbing only; actual renderer/codec tests and
private browser images are separate gates. `npm run check` and the browser results
will be recorded at the committed tested revision before readiness.

No new dependency is added. The original app remains under its
[GPL provenance](../apps/web/PROVENANCE.md); the root-authored build/server route
and [renderer notice](../packages/render/PROVENANCE.md) are reviewed separately
from the application. Retail buffers and screenshots remain ignored local data.
