# Optional GPU battlefield presentation

Status: WORKING under [#229](https://github.com/lictl/WebRA2/issues/229), integrated
in [PR231](https://github.com/lictl/WebRA2/pull/231). This is presentation work.
Mission authority and first-mission completion remain separate
[parent230](https://github.com/lictl/WebRA2/issues/230) gates.

## Behavior

The existing CPU view loads first. An explicit **Try GPU rendering** control asks
the retained terrain worker for a resident scene. Supported terrain and SHP still
artwork use the reviewed WebGL2 renderer; scenes with voxel artwork retain the
complete CPU path with a translated explanation. No layer is removed to obtain a
GPU result. Neither mode changes simulation, command, save or replay policies.

The main thread imports the bounded scene once, creates a fresh dedicated canvas,
and releases the transfer packet and initial object metadata from controller
state. A previous 2D canvas is never reused as a WebGL canvas. Keyboard handlers
and Return-to-map controls resolve the current canvas after a mode replacement.

Worker updates carry compact sprite placements, retirement IDs, a world snapshot
and unclipped world anchors. Camera changes coalesce into one animation callback
without another worker request. The presenter redraws when data or camera changes;
an idle 15 Hz world does not manufacture 60 duplicate submissions per second.

Each successful draw publishes its own presentation sequence, exact genuine GPU
frame and owned immutable world snapshot. Picking uses the CPU raster picker for
that frame, without GPU readback. A pending update or camera change disables picks
until its draw is published. Local camera sequences invalidate obsolete selection
gestures; ordinary pan gestures retain the existing interaction pause. Selection
markers and focus reproject the matching world anchors. Completed actors retire
their artwork; standing artwork remains during the supported pending death state.

Context loss or a draw failure invalidates picks and releases the presenter once.
The controller waits for an outstanding request to settle, synchronizes the latest
local camera back to the worker, and requests a CPU frame of the same current
world. Files and local checkpoints remain available. Replacing or leaving a scene
disposes its presenter and cancels its scheduled callback; stale callbacks cannot
change the next scene.

## Component checks

The first presenter checkpoint is `626443db5f34a189e8bfccf26538a47346d01876`;
the controller/view checkpoint is `6fec257` followed by the independently authored
worker descriptor/resource validation fixes. Tests use original fixtures, not
retail files or a claimed native execution oracle.

- Eight presenter cases use genuine scenes, frames, CPU picks and source-bound
  RA2/YR pending-death states with controlled renderer/scheduler interfaces.
- Five composed controller cases exercise the real worker protocol and resident
  import, SHP picking, local pan/focus, a deferred-tick context loss, camera resync,
  refusal, replacement, Stop, save, restore and replay equality with CPU mode.
- Mounted keyboard tests exercise the current canvas after replacement, form and
  modifier exclusions, durable replay cancellation, and Return-to-map focus.
- The first composed full check passed 1,336 public tests, five performance-tool
  tests and nine GPU-tool tests, types, document/publication/evidence checks, and
  a 77-output/152-input code-only build. After the worker validation fixes and
  SHP controller regression, 109 focused GPU tests passed. Final checks follow
  the final source/evidence revision.

## Browser gate still pending

Actual Chrome GPU lifecycle, native controls and sustained useful-frame cadence
have not yet been accepted for this product integration. The planned GPU workload
uses original terrain/SHP content, a real worker and the mounted battlefield UI.
It distinguishes animation-frame opportunities, useful submissions, asynchronous
GPU completion observations, worker ticks, input receipts and replay results.
The target is at least 60 FPS under continuous meaningful camera/scene changes;
idle redraw counts are reported separately.

Actual opening missions that include voxel layers exercise complete CPU fallback,
not a GPU or 60 FPS claim. Private files, screenshots, saves and raw evidence stay
under ignored `local/`. Prior [GPU experiment measurements](gpu-renderer-experiment.md)
remain a separate original diagnostic build and do not establish this product gate.

Full four-browser campaign acceptance, voxel/effect GPU support, animated native
artwork and physical scanout timing remain outside this checkpoint.

## Relevant boundaries

- [Resident scene contracts and transfer](gpu-transfer.md)
- [GPU provenance](../packages/render/GPU_PROVENANCE.md)
- [Presenter](../apps/web/src/gpu-viewport.ts) and
  [controller](../apps/web/src/terrain-controller.ts)
- [Frame protocol](../apps/web/src/gpu-protocol.ts)
- [Presenter tests](../tests/browser/gpu-viewport.test.ts) and
  [composed controller tests](../tests/browser/gpu-controller.test.ts)
