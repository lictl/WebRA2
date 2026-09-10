# Voxel world presentation component

Issue [#141](https://github.com/lictl/WebRA2/issues/141) adds verified, complete
voxel still groups to the [opening world UI](world-ui.md). The worker retains the
selected-file catalog through the existing voxel plan/resource preparation and
binds its verified root anchors to the terrain, content and SHP sources. It then
releases the catalog. Source bytes, geometry, palettes and pick planes stay in the
worker; the main thread receives bounded metadata and the final RGBA transfer.

The app uses the existing [voxel resources](voxel-resources.md) and CPU renderer.
This is a presentation component, not original mission execution or native
rendering fidelity. Conditional spawn/water/numbered-turret/offset cases keep their
whole group unavailable. HVA frame zero, fixed heading zero, unlit colors, index
zero transparency and unchanged palettes are explicit limitations. Simulation,
world model/save/replay identity and command behavior are unchanged. The resource
preparer's session/audit fingerprint never enters those identities.

## Projection and ownership

The named policy is `webra2-world-voxel-still-1`. For transformed model coordinates
`X,Y,Z`, cell projected column/row `C,R`, and elevation `E`, define
`Gx=C*30+30` and `Gy=R*15+15`. Scene coordinates and comparable depth are:

```text
x = Gx + 8*(X-Y)
y = Gy - 15*E + 4*(X+Y) - 8*Z
depth = Gy + 15 + 4*(X+Y) + 8*Z
```

Camera/zoom affect the first two rows only. Greater depth is nearer; exact ties
keep the existing terrain/SHP owner. The existing voxel renderer breaks internal
voxel ties by instance ID, then decoded voxel ordinal. The scale, anchor and depth
are WebRA2 preview choices, not measurements of native projection.

The compositor retains an owned one-byte-per-pixel winning mask, the genuine
voxel/base pick closures and frozen source descriptors for that exact frame.
Later snapshots, caller metadata mutation or RGBA transfer cannot relabel its
picks. World row joins use source placement ordinal and model entity IDs.

## Bounds and private protocol

Private wire version 4 rejects older envelopes and extends artwork/pick metadata
with SHP/voxel format, VXL/HVA hashes, section, role, frame and selected voxel
ordinal. Exact record/array validation rejects hidden payloads and wrong allocation
claims. Request/frame/revision/model joins and one acknowledged progress message
remain in force. The existing dedicated worker is terminated on cancellation,
replacement and navigation; it has no surviving decode job. Load timeout remains
15 minutes, render/pick timeout 30 seconds, without a background-execution promise.

The viewport is at most 960×640 pixels; voxel limits are 4,096 instances,
1,048,576 instance voxels and 67,108,864 raster samples. Owned voxel descriptions
are capped at 1,048,576 characters. The bounded 256-row artwork report counts
omitted rows/placements and shortened fields. Complete source preparation retains
its existing separate source/section/column/run/matrix limits.

Pixel accounting distinguishes the existing 16 bytes/pixel base planes from
17 additional bytes/pixel for voxel RGBA, Float64 depth, owner and mask. Projection
workspace (16 bytes/instance voxel), palettes and retained geometry are reported
separately. These are typed-buffer accounting bounds, not a claim about total JS
heap, garbage collection or browser process peak memory.

## Checkpoint validation

TypeScript and all 671 public synthetic tests pass. Six new tests exercise the
explicit projection, real original-cube rays, mixed depth/ties, frozen ownership,
malformed metadata, genuine prepared-resource joins, missing/conditional groups,
source ownership and unchanged save/replay state. Existing controller/worker tests
use v4; stale v3 replies still reject. Full checks include document, publication,
M0 metadata and a 42-file code/license build.

Private Node validation selected all 438 installation files. RA2 prepares 804/811
placements, including 12 voxel stills; seven conditional placements stay omitted.
YR prepares 569/570, including 17 voxel stills; one numbered-turret placement stays
omitted. Both durable model hashes and the prior moving/terminal save/replay hashes
match the accepted world component exactly. Full source payloads and images remain
under ignored `local/voxel-world-ui/`.

Independent Python corner calculations cover all 18 ready opening parts (12
ready types). At scale 8 their bounding boxes span 13.33–61.33 pixels wide and
9.33–50.33 high at zoom 1. Actual CPU raster occupied bounds span 13–60 by 9–41
pixels, so the declared scale remains reasonable relative to 60×30 cells. These
measurements establish the chosen preview size, not native calibration.

Independent full composition/pick comparison and actual four-browser acceptance
are pending at this checkpoint. Safari's automatic running remains tracked in
[#115](https://github.com/lictl/WebRA2/issues/115); explicit bounded steps can
validate presentation without overriding hidden-page pause behavior.
