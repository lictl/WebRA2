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
and background produce explicit feedback. All group members share that cell.
The existing movement engine determines path availability and occupancy results.

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
current health before generating unchanged command envelopes at one `nextTick`,
with consecutive existing admission sequences in entity-ID order. One atomic
`WorldReplayRecorder.admitCommands` call validates aggregate queue, sequence and
replay limits before committing. Failure admits no member; success increments the
private revision once and renders once. Legacy single-order messages remain valid.

Group and equivalent single commands have the same canonical checkpoint and
terminal semantics. Their replay admission grouping and private UI revision can
differ. Neither grouping, selection nor projected control points changes durable
model identity. All prior source/codec/privacy and browser-local save bounds remain.

## Validation checkpoint

The checkpoint passes TypeScript and all 703 public tests; its build emits 43
code/license files from 104 approved inputs. Eleven new original synthetic cases cover selection transitions and limits, live ownership,
projection and forged point metadata, stale wire/revision joins, exact group/single
save and replay equivalence, real aggregate queue and sequence overflow rollback,
gesture modes, keyboard focus/modifiers, localization and asynchronous disposal.
They use original fixtures and do not establish native gameplay compatibility.

Actual four-browser direct-pointer workflows and fresh private opening-world
group/save/replay comparisons are pending at this implementation checkpoint.
The preserved accepted viewport on port 4177 is unchanged. Safari's separate
automatic-running gate remains [#115](https://github.com/lictl/WebRA2/issues/115);
explicit-step checks must not be reported as automatic Run acceptance.
