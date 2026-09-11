# Combined voxel viewport presenter

[Issue242](https://github.com/lictl/WebRA2/issues/242) remains in progress. The
presenter now connects the [complete voxel transport](gpu-voxel-product.md) to the
[combined renderer](gpu-combined-renderer.md). Original component tests and the
finite Chrome startup check below pass. Actual product input, imported scenes,
retirement/restoration, fallback and sustained cadence still require acceptance.

The main thread imports the complete geometry/palette data into a genuine scene,
then drops the transient transfer packet. It retains immutable group/source
metadata and the source-ground lookup. Every worker update validates current
actor position, complete membership and retirement before replacing pending state.
All body/turret/barrel instances use the same reviewed `voxelWorldProjection` as
the CPU path. Retirement rebuilds the complete layout; ordinary camera changes
reuse the captured layout and exact bounded preparation cache. No part is dropped
to fit a resource limit.

Startup coalesces camera and world updates without publishing a game frame. A
successful check loads the current complete scene and schedules one RAF. Disposal,
replacement, hidden startup or context loss aborts it; stale promise completion
cannot revive a presenter. The canvas stays hidden until the first game submission,
so original startup patterns do not appear as battlefield artwork. This is a
presentation lifetime, outside world commands, clocks, saves and replay identity.

Each successful game submission pins a local sequence, the corresponding combined
renderer sequence and immutable world revision. Voxel picking reads one current
winner pixel and resolves its complete part metadata. Pending camera/worker updates
do not alter the displayed pick. Stale gesture sequences return null without a
read. Ordinary draws perform no full-frame readback. Preparation, startup, context
or picking failures invalidate the whole combined presentation and request the
existing complete CPU fallback at the latest desired camera/current world.

The cold `gpu-world-selftest.ts` runner creates two original genuine scenes through
the normal import/frame factories: 1,024 total viewport pixels and 28 interaction
probes. Hand-authored expectations cover front/equal/behind terrain/SHP/voxel
ordering, palette transparency, lexical voxel ties, base signed-depth extrema,
admitted voxel ties and adjacent binary32 values near positive/negative1,048,000,
fractional negative depths, signed-zero ties, background alpha37 and the pixel15/16
candidate-bin boundary. Voxel projections at the base extrema±2,097,151 are not
admitted by the current factory; the test does not fabricate such frames.

Four cold draws include one identical redraw per scene for immediate default-
framebuffer verification with `preserveDrawingBuffer:false`. One asynchronous
zero-timeout fence at a time precedes diagnostic plane reads. Timers/fences are
released on success, timeout, abort or failure. A five-second total deadline may
only be lowered; it cannot preempt synchronous driver calls or browser scheduling.
This finite current-context screen is not universal GLSL arithmetic/coverage proof.

Original tests use controlled async renderers to check coalescing, cancellation,
hidden/lost startup, loss during scene load/picking, ownership, complete-group
retirement/restoration and exact shared projection. Real original worker/session
tests preserve movement, Stop, active save/restore/replay, current camera and retained
Files through CPU fallback/re-negotiation. Their GL doubles do not prove pixels;
structural retirement fixtures do not prove native death behavior.

The first actual Chrome startup check used backend03cb40e and startup9ef02dd at
composed `f8bd66880c4f2b1534b4e0b9979101b25e9bf58a`, frozen localhost4231. Both
scenes matched all expected full RGBA/kind/owner/depth planes, immediate default
framebuffer bytes and28 picks. `getError` returned0; disposed accounting returned
zero owned CPU/GPU bytes. Alpha was enabled, premultiplication/antialias/depth/stencil
disabled; `preserveDrawingBuffer:false`, product nonisolated headers. Native Chrome
tab selection and the Run button were observed. This was a cold correctness check,
without a quiet timing window; its349.8ms elapsed is not a performance benchmark.

Private evidence is under
`local/worktrees/gpu-voxel-presenter/local/gpu242/startup-1/`. Manifest SHA256:
`64c8261ecc16f028935afab683629ea2b2eb55c9925114d66e1c91fbae2feaf5`;
normalized result JSON:
`3db61f070d875ddd608eec59763cc75afa33ceff9ca590734a463c53b974e55c`.
Six console warnings identify an installed extension; three listener-channel errors
are page-attributed with no confirmed cause. They remain in the private observation.
No game program ran and no retail asset, sample or screenshot was published.

The next gate uses the actual product presenter and genuine imported sources:
complete combined artwork and displayed picking, controls, dense-scene whole-CPU
fallback, restored membership, context recovery and sustained60FPS with independent
15Hz simulation. The earlier synthetic [short voxel cadence](gpu-voxel-browser.md)
does not establish that product gate or an original playable mission.
