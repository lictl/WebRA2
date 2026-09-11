# Complete voxel viewport integration

[Issue242](https://github.com/lictl/WebRA2/issues/242) connects the reviewed
[voxel experiment](gpu-voxel-feasibility.md) to the existing game viewport.
This branch is **in progress**. Source transport is implemented; combined GPU
presentation, startup screening, displayed picking and actual Chrome product
acceptance remain separate dependencies. Do not merge the transport checkpoint
alone as a completed playable or GPU viewport feature.

`copyVoxelAtlasData` obtains complete selected geometry/poses from a genuine owned
CPU atlas. It copies each pose's geometry independently, reserves all numeric bytes
and work before copying, and keeps source metadata immutable. Defaults bound256
parts,1,048,576 selected voxels,8MiB copied numeric bytes and2,097,152 work units.
One work unit is charged per part, voxel and matrix coefficient. Byte counts
exclude JavaScript object overhead. Mutating an export cannot alter CPU rendering.

The existing verified ready-type adapter now captures one complete set of groups.
Both CPU rendering and GPU updates use the same current actor/source-cell and
retirement program. Body, turret and barrel parts remain a unit; unresolved or
conditional type plans retain their existing gates. Presentation remains the
explicit unlit still/frame-zero/facing-zero policy. No new animation, house-remap,
lighting, dynamic construction or native pixel-equivalence claim is made.

The existing `gpu-frame` message gains an optional version1 voxel extension.
An exact legacy message remains valid only when no voxel groups are rendered.
An extended message carries resident resources on renderer negotiation, then only
complete live group placements on later updates. Base object descriptors and
resources remain SHP-only. Counts distinguish objects from part instances.

Resident resources include source-ground descriptors, complete groups and immutable
part/source metadata alongside bounded copied geometry, matrices and palette planes.
The codec accepts actual fixed Uint8 storage, rejects accessors and malformed joins,
and captures metadata before asynchronous use. Source grounds are unique, bounded
to130,816 cells and indexed once. Each moved group's x/y must match the corresponding
world actor; its projected column/row/elevation must match the retained source cell.
These are presentation joins, not navigation or simulation authority.

The bridge retains metadata without geometry/palette buffers after transfer. Each
later update must retain the negotiated voxel extension, cover every live group
exactly once and account for all retired objects. Empty live membership is valid.
Explicit CPU fallback keeps the current world/camera. Re-negotiation requires the
same complete resource digest, including geometry/palette bytes and signed-zero
matrix identity; it receives fresh copies from the CPU atlas. No rendering input
changes a world save, command, RNG or replay.

Original tests cover genuine multipart source preparation, CPU/GPU group agreement,
movement, full retirement/restoration, hostile descriptors/storage, wrong source
ground, missing/duplicate actors, malformed negotiation, repeated source identity,
detached transferred planes, CPU fallback and active save/restore. These are headless
component/worker tests. No actual GPU product result or retail performance is claimed
by this checkpoint. Source and artifact publication remain code-only; retail input
stays under the owner's on-device import.

The remaining backend uses one context, genuine offscreen receipts and a combined
winner target. Display and picking must agree on the actual voxel depth, strict
base/voxel ordering and ties. A small original startup corpus screens each new
context before a game frame is published. Failure must invalidate combined picking
and use the complete CPU renderer at the latest desired camera. A finite corpus
does not prove universal GLSL arithmetic behavior. Chrome acceptance must measure
the complete viewport with an independent simulation and preserve explicit late
frames; the experiment's short74.5/s row is not sustained product evidence.
