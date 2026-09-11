# Combined terrain, sprite and voxel GPU presentation

[Issue242](https://github.com/lictl/WebRA2/issues/242) adds one context and one
presentation owner over the existing terrain/SHP and bounded voxel renderers.
This component has original call, resource and lifecycle checks. Actual combined
Chrome output, startup self-test, product transport and campaign acceptance are
separate pending gates. It does not advance simulation or change source admission.

`GpuCombinedRenderer(context, lowerLimits)` accepts the dedicated caller-owned
WebGL2 context (alpha enabled, premultiplied alpha and antialiasing disabled).
`load(baseScene, voxelSceneOrNull)` authenticates both factory-owned scenes.
`draw(baseFrame, voxelFrameOrNull)` validates the exact scene pair and viewport
before either layer mutates. It returns a frozen generation/sequence receipt with
both genuine frames, dimensions, submitted state, draw counts and upload bytes.
The sequence increases across reload and restoration; no latest-frame substitution
is permitted. Failure clears the combined displayed receipt.

The two renderers expose internal `drawLayer` and `bindLayer` seams. Layer receipts
are accepted only by their original renderer, on its original context, at the
same generation, sequence, size and exact frame. They expose no texture or
framebuffer handles. Existing standalone `draw` calls retain their default-frame
composition and diagnostics. Two no-copy assertion exports authenticate existing
base scenes and frames; they cannot manufacture a factory identity.

The base passes still decide terrain ordering, sprite eligibility and same-depth
sprite ties. The combined winner shader then compares the actual winning base
integer against the voxel driver's actual binary32 depth. A voxel wins only when
its depth is strictly greater; equality, including positive versus negative zero,
keeps the base. Transparent or empty voxel output cannot cover the base. The base
range remains[-2097151,2097151]. Integer shifts construct its exact binary32 word,
then monotonic unsigned keys compare the words without mixed int/float conversion.
The voxel diagnostic range remains[-2097152,2097152], with current genuine factory
projection bounds additionally restricting which values can actually be rendered.

One integer winner pass writes RGBA8UI color and RGBA32UI information. Information
channels are kind, owner, depth word and validity. Kind0 is empty,1 terrain,2 SHP
object and3 voxel. Base depth words contain signed integer bits; voxel words contain
the actual shader float bits. A final delivery pass maps the selected byte color
to the default framebuffer, including background alpha. It makes no further
ordering decision. Normal draw performs no readback, finish or error getter.

`pick(sequence,x,y)` reads one information pixel from the displayed winner and
resolves it against the receipt's exact source frame. It returns a terrain/object
pick, a voxel pick with `kind: 'voxel'`, or null. Stale sequence or invalid coordinates
return null without a GPU read. `readback(sequence?)` is diagnostic only; it returns
top-left RGBA, kind, owner, depthWord and decoded Float64 depth planes with receipt
identity. Immediate default-framebuffer checks are separate from those diagnostics.

Nonfinite/out-of-range depth or inconsistent output writes an invalid shader
sentinel. Encountering it during picking or full diagnostics throws
`GpuCombinedRendererError` with `fallbackRequired: true`, marks the renderer failed
and invalidates every displayed pick. It never produces an invented base hit for
that pixel. Normal cadence does not read the entire frame to discover such faults;
a finite cold startup test and complete CPU fallback remain required at product
integration. The voxel clipping policy has no universal driver guarantee, and this
component does not claim that untested pixels or drivers are validated by a sample.

Context loss, failure and resize invalidate the receipt. Loss drops owned GPU and
copied resident resources while retaining genuine source references for explicit
`restore()` after native restoration. Restoration also retries failed state from
the last successfully loaded source pair. The next draw receives a new sequence.
`dispose()` is idempotent and cannot be reversed. Applications must switch the
whole latest state to CPU on failure; partial voxel groups are outside this API.

Default aggregate caps are256 MiB requested GPU allocation and256 MiB owned CPU
staging, with a2048 texture-side limit; all are lower-only. Each child retains its
own existing stricter limits. A genuine context-bound ledger has at most three
private participant tokens. Before each allocation, a participant checks its full
old-plus-candidate peak together with the other participants' committed resources.
The ledger also counts both resident copies, per-operation staging, combined
20bytes/pixel targets, and diagnostic scratch/results. Base target accounting
already reserves4bytes/pixel for the default framebuffer; it is counted once.
A full combined diagnostic reserves53bytes/pixel plus both resident copies; a
one-pixel pick reserves16bytes. Caller-retained source/frame planes and returned
copies are outside the renderer-owned counters. Driver/program overhead, allocator
metadata and actual GPU memory are not measured by these logical byte counts.

Original checks cover standalone call preservation, genuine identity, opaque
receipt clones/cross-context/staleness, scene and size mismatch before mutation,
sequence-pinned picks, signed words and zeros, invalid-driver fallback, resource
replacement peaks, diagnostic budgets, context restoration, null voxel layers and
disposal. The emitted integer comparator is independently compared with binary32
encoding for all4,194,303 base integers and adjacent/tie boundary values in a
JavaScript arithmetic harness. Actual shader boundary fixtures remain a separate
browser gate. No combined cadence, retail rendering or native behavior claim is
made by these tests. See [provenance](../packages/render/GPU_COMBINED_PROVENANCE.md).
