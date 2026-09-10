# Direct world controls

Issue [#149](https://github.com/lictl/WebRA2/issues/149) adds direct selection and
movement to the existing [voxel world preview](voxel-world-ui.md). This is an
application control component. It adds no native combat, formation, fog, mission
interpreter or victory behavior.

## Input and selection

Click selects a supported living unit owned by the current control house;
Shift-click toggles it. A left drag selects a rectangle, and Shift-drag adds its
units. Alt-left-drag and middle-drag pan instead. Right-click moves the selection
only when the retained displayed-frame pick identifies exposed terrain; objects
and background produce explicit feedback. The reviewed
[shared destination planner](team-destinations.md) assigns distinct nearby cells
under the named `webra2-nearest-distinct-cells-1` policy. This replaces the early
checkpoint's shared-cell orders, which could leave later units blocked behind
the first arrival. The existing movement engine owns actual movement and contention.

The selection is a sorted set of at most 64 authoritative entity IDs and never
enters simulation state. Exceeding the limit retains the prior selection and
reports the limit. Enemy, unknown, dead and unsupported movement actors cannot
receive orders. Missing artwork does not itself remove a supported world actor.
The ordinary control house remains the exact `Basic.Player` default. A clearly
labeled development chooser can change it, clearing the old selection.

Box selection uses whole-cell anchors projected by the retained verified terrain
locator, not colors, pixels or an inferred isometric inverse. Its inclusive pixel
rectangle selects anchors within the displayed viewport. This is a WebRA2 input
policy, not native sprite hit-box or visibility/fog behavior. The existing
frame-local object pick supplies click selection.

The compact HUD shows up to eight selected-unit health/order cards and an explicit
additional count. Selection rings are original UI overlays. Detailed source,
numeric destination and house/unit controls remain under development details;
the standard multiple-selection list provides a keyboard alternative. Persistence
controls remain available under their own details section. All new copy is English
and Traditional Chinese.

With viewport focus, S stops the selection and Escape clears it; Space retains
run/pause, M retains move-to-inspected-cell, and the existing camera keys remain.
Form input and Ctrl/Meta/Alt keyboard combinations are not intercepted. Pointer
gestures hold automatic stepping as UI interaction state; the existing bounded
catch-up scheduler resumes afterward. This changes no logical time or save field.
Replacement, restore, navigation and disposal invalidate interactions. A stale
pick cannot restore an escaped selection, and a rectangle cannot use older frame
anchors. Panning can consume newer camera frames within its unchanged world
revision. Hidden-page pause behavior remains intact.

## Private protocol and atomic orders

Private terrain wire version 5 adds `controlPoints` to each frame. There are at
most 2,048 points, bounded by the existing world actor cap: unique sorted entity
IDs, integer positions inside the returned viewport, and joins to living movable
actors in that frame's world snapshot. Strict record/array validation rejects
extra payloads, sparse arrays, unknown/dead actors and duplicate points. Existing
request/frame/model/revision checks reject obsolete envelopes and responses.

An app-private `world-orders` action contains a sorted unique nonempty list of at
most 64 entity IDs, the player, move/stop kind, optional move cell, and expected
world revision. The worker checks every actor's ownership, movement support and
current health before planning from its genuine model and validated current save.
Move candidates are ordered by squared distance to the requested cell, then y/x,
and actors by ID. The shared bounded policy checks current occupancy, in-flight
reservations, static footprints, reachability and prior assigned path/corner cells.
It does not reserve queued or other groups' future destinations, and it does not
promise global congestion freedom or native formations. A blocked or exhausted
plan returns no assignments; translated recovery text recommends another area
or a smaller selection, and no member is admitted.

Complete assignments become unchanged command envelopes at one `nextTick`,
with consecutive existing admission sequences in entity-ID order. One atomic
`WorldReplayRecorder.admitCommands` call validates aggregate queue, sequence and
replay limits before committing. Failure admits no member; success increments the
private revision once and renders once. Legacy single-order messages remain valid.

Group and equivalent exact individual-destination commands have the same canonical checkpoint and
terminal semantics. Their replay admission grouping and private UI revision can
differ. Neither grouping, selection nor projected control points changes durable
model identity. All prior source/codec/privacy and browser-local save bounds remain.
Stop skips destination planning. The legacy single-order diagnostic message
retains its exact requested cell; it does not silently acquire the group policy.

## Validation checkpoint

The initial `c12d3cef4d79392de8ed35c58520c8012bb7cd5a` checkpoint passes TypeScript
and all 703 public tests. Its [independent source review](https://github.com/lictl/WebRA2/pull/153#pullrequestreview-5162521482)
has no actionable finding and explicitly excludes the pending planner/browser gates.
After reviewed-main integration at `8f91686407af6c7942cd31c6d1e0d77c3c198cbc`,
all 758 tests pass; the build emits 46 code/license files from 107 approved inputs.
Document checks cover 117 files and 608 local links; publication checks cover 420
tracked paths. Eleven new original synthetic cases cover selection transitions and limits, live ownership,
projection and forged point metadata, stale wire/revision joins, exact group/single
save and replay equivalence, real aggregate queue and sequence overflow rollback,
gesture modes, keyboard focus/modifiers, localization and asynchronous disposal.
They use original fixtures and do not establish native gameplay compatibility.

Fresh private Node File-backed loads of all 438 selected files reproduce both
openings' prior model, initial image, single-order moving checkpoint and terminal
replay hashes. Strict version-5 frames pass, and retained object picks join two
visible owned actors to their verified whole-cell control points and selection
rectangle. These checks are private component evidence, not native browser tests.
The reproducible probe and factual output remain in ignored
`local/world-controls/preflight.mjs` and `preplanner-facts.json`.

Actual Chrome direct-pointer workflows and final private opening-world
group/save/replay comparisons remain pending. The owner unlocked the Mac after
native control reported failed automatic unlock; normal Chrome access is restored.
The owner's updated testing priority is Chrome during development, with full
Firefox/Edge/Safari end-to-end checks deferred until later completion. The shared
planner was independently reviewed and merged in
[PR #156](https://github.com/lictl/WebRA2/pull/156); final app integration tests
add real planner-budget/blockage recovery and explicit distinct-cell expectations.
The integrated app currently passes all 777 public tests, TypeScript, 121 document
files / 623 local links, 428 publication paths and the 48-output / 108-input build.
The preserved accepted viewport on port 4177 is unchanged. Safari's separate
automatic-running gate remains [#115](https://github.com/lictl/WebRA2/issues/115);
explicit-step checks must not be reported as automatic Run acceptance.
