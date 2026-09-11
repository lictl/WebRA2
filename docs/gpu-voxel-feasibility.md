# GPU voxel precision experiment

[Issue234](https://github.com/lictl/WebRA2/issues/234) investigates the remaining
voxel layer before [product integration229](https://github.com/lictl/WebRA2/issues/229)
can use GPU composition for current mission views. This is a prototype, with no
production integration, GPU measurement or native rendering claim yet.

The initial `webra2-voxel-f32-ray-1` candidate owns decoded sparse xyz/color/normal
records, copied resolved palettes and model matrices. It prepares conservative
pixel boxes using the existing binary64 affine multiplication and inverse. The
candidate ray predicate then stores inverse coefficients as Float32 and rounds each
multiply, addition, subtraction and division to Float32. Slab intervals retain the
existing half-open parallel-axis rule and require `near > far`. Strictly greater
near depth wins; equal depth keeps lexical instance order followed by source voxel
ordinal. Transparent source indices, remapped transparent palette entries and
zero-alpha colors cannot win. Normals remain unused under the existing unlit policy.

These operations are an explicit CPU reference for the proposed GPU policy, not a
cross-driver GLSL arithmetic guarantee. The unchanged Float64 diagnostic is retained
alongside it. Seven original tests include 98,304 complete pixel comparisons of the
Float64 diagnostic against the existing cube renderer. A near-depth fixture
intentionally demonstrates a changed owner: a difference of 0.0000001 at depth11
collapses under Float32, so the earlier instance wins. This prevents an accidental
claim that all old depth and pick identities survive the numeric change.

A private original-only exploratory corpus currently contains60 pose/zoom/camera
cases and245,760 pixels. It found no mask, owner or RGBA differences,14,158 changed
depths, maximum absolute difference0.0017416558 and no changed comparisons against
the adjacent integer terrain depths. This preliminary corpus excludes the deliberate
near-tie case and is insufficient to choose the final policy. Boundary, overlapping
multipart and extreme admitted transform cases, an independently written oracle and
actual GPU comparisons remain required.

## Preparation and ownership

`createGpuVoxelScene` owns decoded geometry and palette values. The factory currently
accepts explicit decoded presentation records; it does not authenticate VXL/HVA
sources or claim complete body/turret/barrel selection. Production integration needs
a genuine source-atlas accessor and the existing complete-group selection adapter.
No arbitrary scene record grants simulation, replay or source authority.

`prepareGpuVoxelFrame` sorts instances, computes clipped boxes, and prepares16×16
screen-tile candidate lists before publishing a frame. `pickGpuVoxelFrame` evaluates
only the bounded candidates for the exact owned frame. Its optional Float64 mode is
for comparison with the prior renderer. Detached scene/frame accessors support a
future resident upload and explicit staging measurement; mutating those copies
cannot change a prior frame or pick.

Hard limits are256parts/palettes,1,048,576 resident and instantiated voxels,
4,096instances,1,280×720 total pixels with2048dimension maximum,64Mi conservative
pixel tests,8Mi tile-reference entries and4,096candidates in any one tile. All limits
are lower-only. Unsupported resource or candidate work fails the complete frame;
no partial body or silently omitted primitive is published.

The resident-byte count includes packed geometry, resolved palettes and matrix
scalar storage. The frame count conservatively reserves all instance boxes,
inverse coefficients, binary64 inverse scalar storage, tile counts/offsets/cursors
and candidate indices, including temporary typed arrays. These counters exclude
JavaScript object/Map/Set overhead, caller-owned input bytes and detached upload
copies. The renderer must separately account for those copies, GPU allocations and
replacement peaks. They are allocation accounting, not measured browser RSS.

## GPU choice and remaining gates

A candidate implementation can use an R32F maximum-depth pass followed by a stable
owner/color resolve, avoiding another quantization through normalized hardware
depth. It requires [EXT_color_buffer_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/)
and [EXT_float_blend](https://registry.khronos.org/webgl/extensions/EXT_float_blend/),
with explicit fallback when unavailable. A bounded tile-candidate shader is another
option; the experiment has not yet measured either one. Existing terrain/SHP depth
must remain unchanged and a voxel may replace its winner only at strictly greater
depth. Exact ties retain terrain/SHP.

Actual GPU arithmetic must be compared with the shared CPU predicate before relying
on CPU selection. If it differs, assess a bounded one-pixel owner/depth read only on
interaction, with separate latency measurements. Full-frame readback remains a
diagnostic operation, never normal presentation. Context loss/recovery, disposal,
resident transport, complete-group joins, old-policy difference counts and sustained
Chrome60FPS measurements are still outstanding. No gameplay, save or RNG code is
changed by this checkpoint.
