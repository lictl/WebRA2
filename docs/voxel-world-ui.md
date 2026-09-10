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

## Component validation

TypeScript and all 672 public synthetic tests pass. Seven new tests exercise the
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

An independent Python raw-span VXL decoder, HVA transform, palette and forward-face
raster matched all 2,457,600 RGBA pixels and object/voxel-ordinal owners across
centered/focused views of both openings. It verified two retail roots and 32 member
ranges. This oracle composes against captured unchanged terrain/SHP planes; it
does not independently reconstruct those existing layers.

## Actual browser acceptance

On 2026-09-10, native browser controls and folder pickers selected all 438 local
files in each browser below. Both openings completed source verification and
reported the same prepared/unavailable counts above. Each case selected a ready
voxel tank, moved it one cell, saved while moving at tick 2, issued Stop and one
step, restored the moving checkpoint, then advanced 20 explicit steps to tick 22.
Centering and inspecting the moved tank returned its VXL/HVA source metadata;
current-replay verification returned the exact terminal state.

| Browser | Version | RA2 case | YR case |
| --- | --- | --- | --- |
| Chrome | 152.0.7977.83 | Passed | Passed |
| Firefox | 151.0.1 | Passed | Passed |
| Edge | 152.0.4191.66 | Passed | Passed |
| Safari | 26.6.2 (21624.5.1.11.3) | Passed with explicit steps | Passed with explicit steps |

RA2 entity 48 moved from `(55,18)` to `(55,17)`; YR entity 61 moved from
`(98,112)` to `(98,111)`. All four browsers showed these same state hashes:

| Profile | Moving save and restored tick 2 | Terminal and verified replay tick 22 |
| --- | --- | --- |
| RA2 | `9f59c50ef6e56e5b3d8e8d67bec5352593c0e9b4a4876de279f5cefff54f71ab` | `34e0e06ab097daf7459295ac15f50e9614f3e8873e2c686b45900cc94854c794` |
| YR | `bbff56c22bdbe2f327a258a31dedc6f887e8d941b43c30021702fd4e100f2c15` | `b1eb361e80dc739bc754d68f4bf6dc279852987d7f5b0eb18be7290578808ef5` |

The durable model hashes remain RA2
`fc6d08a841b9460777ec7f6eb46a924cfb45879e38cf9bcf70e31869a892033e`
and YR `eade1c1a47973815741a3a966947b225b5cc1baed963093b726498b6e844ab92`.
Every terminal pick reported the body source `gtnk.vxl` with SHA-256
`88b326908acb5c2a98860d8f65169e8745ae858c5cbfe98e0bb2f283f49a3b81`
and `gtnk.hva` with SHA-256
`4a15fc9c2633667812465c4b08f28cab5d595ae4f80eddbb77d1a9f9ed0480a4`.
The rendered view was also visually inspected in each browser. Screenshots and
retail source values were not added to the repository.

Each browser also retained the selected cell and logical tick through an English
to Traditional Chinese switch, cancelled a replacement YR load and successfully
retried it, and removed world controls/state on navigation to Installation. These
checks use local checkpoint save/restore, not a new file export/import or
page-reload persistence claim. Automatic Run was not retested in this slice;
Safari's automatic-running gate remains
[#115](https://github.com/lictl/WebRA2/issues/115). Explicit steps do not override
hidden-page pause behavior. No startup-time, RSS, full campaign or native
projection-fidelity conclusion follows from these cases.

All native runs used the immutable localhost port 4177 build from runtime commit
`7760ec446629393d3e17d652120ee85d7d0b3b3e`. The later test/document checkpoint
`43cfd77461e30759126e54bbd2e4877de4add783` has identical runtime outputs.
Manifest SHA-256 is
`30f28d08281eaa1b322b1dcb855c324189b3985582de33a2dcb4dc8beaf3adf0`;
all 42 files matched both the final build and actual HTTP responses. The launcher
recorded 89 pre-verification requests: GET requests for code/style/worker files
and the missing favicon, with no declared request bodies or asset routes. The
response CSP retains `connect-src 'none'`. This is launcher-side evidence, not a
process-wide network capture.

Private evidence is retained under ignored `local/voxel-world-ui/`:
`browser-acceptance.json` contains compact native observation facts and timestamps;
`browser-artifact-verification.json`, `tested-manifest.json` and `requests.jsonl`
retain build/HTTP facts. `composition-oracle-facts.json`, `composition-cases.json`,
`facts.json` and `acceptance-targets.json` retain separately labeled private Node
and Python results. The native tests used normal fresh tabs; Chrome's existing
extension-controlled picker limitation was avoided with a separate native tab,
and a sleeping Edge session was normally quit and reopened. No permission or
browser-setting changes were made.
