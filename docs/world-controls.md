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

## Validation

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

The shared planner was independently reviewed and merged in
[PR #156](https://github.com/lictl/WebRA2/pull/156). App integration at
`adbd0e7b694c9d39c9e164f4a44c107dd3344713` passes all 777 public tests, TypeScript,
121 document files / 623 local links, 428 publication paths and the 48-output /
108-input build. Its [independent coordinator review](https://github.com/lictl/WebRA2/pull/153#pullrequestreview-5162730133)
also reruns the complete private group probe with no finding. New cases exercise
real planner-budget/blockage recovery and explicit distinct-cell expectations.

The private `local/world-controls/group-probe.mjs` and `group-facts.json` use all
438 File-backed inputs, genuine source-bound models and the actual group worker
session. Both profiles preserve unchanged model identities, exact group versus
individual-command checkpoints, moving save/restore/continuation and replay.
The bounded observation reaches both assigned cells at tick90 RA2 and tick398 YR.
These are observed deterministic probe ticks, not native locomotion timings. Stop
and blocked-plan admission also pass. An earlier 302-tick observation bound was
insufficient for YR's second route; extending observation to 1026 ticks reached
its destination without changing planning or movement logic.

## Chrome interaction evidence

Actual Google Chrome **152.0.7977.83** on 2026-09-10 exercised the immutable
`adbd0e7` build at localhost4178, with all 438 files chosen through the native
folder picker. The exact 48-file manifest SHA-256 is
`69f1faee2c763a4c774ed89bbf97c249f350d66249093cf5d322c195d8c26394`.
The selected Files remain on-device. The browser observation contains 19 requests:
18 successful code/style GETs and one favicon404, with no declared request bodies; the launcher
serves no retail paths. This log covers requests reaching the local launcher,
with the existing `connect-src 'none'` app policy providing the network boundary.

Both openings pass direct click, plain rectangle selection, right-click exposed
terrain, distinct two-unit movement goals, Step/Run/Pause, compact health/order
HUD, local moving save/restore, replay verification and English/Traditional Chinese
copy. RA2 also exercises actual Shift-click removal/re-addition, S, a focused
numeric field's arrow-key behavior, canvas arrow-key panning and enemy rejection.
YR exercises Stop through its button, rejection of the RA2 checkpoint without
changing the world, load cancellation/retry and navigation from a running world.
Returning to the preview retains the file selection but clears the world/frame
and hides its controls. Both restores and Escape clear UI selection.

| Chrome case | RA2 | Yuri's Revenge |
| --- | --- | --- |
| Control house / actors | Explicit development house1 / 12,13 | Ordinary default house0 / 1,33 |
| Requested cell | 92,61 | 87,100 |
| Saved individual goals | 12→92,61; 13→91,61 | 1→86,100; 33→86,99 |
| Tick2 moving SHA-256 | `f873ecf33c7c950b44a5e8482199a54fa07dfa3b343f65635f4bda614d77adf4` | `b00029e96fef1533a12aca6f2ac7d2495db92b00153b608f1977e4d8aa7e1cfa` |
| Browser-local restore | Exact tick2 hash; selection empty | Exact tick2 hash; selection empty |
| Run paused observation | Tick334, both arrived, health125 each | Tick534, both arrived, health100 each |
| Verified replay terminal | `530fa8c6ccb415183eb9b8d1056cb5f1d4b6863dd3a6c2271802d9a2ece2b973` | `019739a36e804332719515304857e2aa10a835a2f6b0a0dbfb1d9489ee6172cb` |

Both Chrome queued and tick2 hashes exactly match the private component probe;
the later native pause ticks are different observations, not earliest arrival
measurements. A separate private `browser-state-probe.mjs` restores the moving
checkpoints and reproduces both actual tick334/534 browser terminal hashes,
arrived cells and queued/applied Stop hashes; `browser-state-probe-facts.json`
records these comparisons. The private metadata-only browser record is
`local/world-controls/browser-acceptance.json`; `tested-source.json`,
`tested-manifest.json`, `browser-request-snapshot.json` and the immutable
`browser-build/dist/` preserve its attribution. No retail images or saves are
published with this report.

The owner's updated development priority is Chrome, with full Firefox/Edge/Safari
end-to-end checks deferred until later completion. Actual Shift-drag, Alt-left-drag
and middle-drag combinations were not exercised: the available automation exposes
plain drag and click modifiers but no documented held-modifier drag. Their original
gesture tests pass; this is synthetic-only coverage. Export/import/reload and
memory/startup benchmarks were not repeated in this controls slice. Prior browser
world evidence remains separately scoped. The preserved accepted viewport on4177
is unchanged. Safari's separate automatic-running gate remains
[#115](https://github.com/lictl/WebRA2/issues/115). This component does not establish
native formations, global congestion freedom, attacks or a playable campaign.

Final integration with reviewed main `ec904eff30b59662b19607096cf6f282ea5abb21`
passes all 808 public tests, TypeScript, 127 documents / 656 local links, 444
publication paths, M0 checks and the 51-output / 108-input build. All 47 unaffected
files are byte-identical to the browser-tested manifest, including every runtime
JS, CSS and HTML file. Only the copied licensing overview changes and the reviewed
native-numbers, combat-modifiers and team-runtime component notices are added.
Independent HTTP reads verify every one
of the 48 frozen output hashes; those later audit requests are separate from the
19-request browser snapshot. Private `final-build-comparison.json`,
`final-manifest.json` and `http-artifact-audit.json` retain these checks. Final
manifest SHA-256: `1ca54c7254301eccba9e5b8f0342e5dba67add9d37b1809e2a35900d0a3f29bd`.
