# Mission/world initialization and transactions

`src/mission-initial-flags.ts`, `src/mission-world.ts` and their original tests are
WebRA2 contributor work under GPL-3.0-or-later. No retail source bytes or native
listings are included. The paired static range metadata is in
[the native ledger](../../docs/analysis/mission-world-native.json).

The source initializer interprets hash-verified mission VariableNames using the
pinned RA2/YR local loader and constructor evidence: 50 globals and 50/100 locals,
zeroed constructor values, and optional comma-delimited local integer defaults.
Paired ReadString trim consumers compare unsigned bytes against0x20, preserving
high bytes. WebRA2 trims only ASCII space/tab padding and rejects other controls.
It conservatively rejects ambiguous source framing and unsafe indices. Global
variable names do not grant lookup authority to this numeric-only VM.

Starting a new campaign with zero globals and map-local defaults is the named
WebRA2 policy. Native carryover/reset sequencing between missions is unverified.
Continuation requires the complete existing compound checkpoint; this API cannot
reinitialize an old campaign from a partial flags array. The generic VM keeps its
100-slot local save shape; RA2's upper half is always false and cannot receive inputs.

The compound adapter authenticates the entire original world, source binding
authority and initial flags. Optional source combat/infantry adapters preserve that
base proof. Poll controls advance before one world tick as an explicit D03 policy.
Effects remain ordered data; outcomes remain requests. Physical event delivery,
native tag cleanup, teams, media, campaign progression and victory resolution are
not implemented here. Unsupported whole source programs cannot start.

See [the report](../../docs/mission-world.md) for bounds, save/replay semantics and
evidence limitations. Dependencies retain their existing component notices.

Source cue dispatch adds optional genuine catalog/program binding and private
compound request emission. It reuses the paired cue operand and VM lifecycle
evidence without asserting native screen timing or playback. The implementation
and original tests remain GPL-3.0-or-later; see the
[dispatch report](../../docs/mission-cue-dispatch.md) and existing
[cue notice](../../packages/content/MISSION_CUES_PROVENANCE.md).

The optional original source cell-entry adapter is documented in the
[cell dispatch report](../../docs/mission-cell-events.md). Its paired runtime
[range ledger](../../docs/analysis/mission-cell-dispatch-native.json) pins transient
event1 registration and tag invocation behavior. World-before-cell-before-poll
ordering is an explicit WebRA2 policy, with no native pointer mutation or generic
movement callback claim. Existing programs without the adapter retain their identities.

Initial object damage/destruction dispatch is original GPL-3.0-or-later work.
The [object event report](../../docs/mission-object-events.md) and
[source notice](MISSION_OBJECT_EVENT_PROVENANCE.md) record the paired callback
boundary and repeating death latch policy. Private health applications drive the
compound callback subsequence; public traces do not confer that authority.
The D03 world/cell/object/poll phase and logical tag lifetime remain explicit.

The optional mission team phase is original GPL-3.0-or-later composition. Its
source catalog, runtime and initial flags must share complete genuine authority.
The compound receives no caller team receipts: its private VM creates ordered
next-tick requests after the common team/world tick. A checkpoint retains matching
outer and nested world saves, VM effect order, queued requests, claims, controllers
and release/Flash history. Host commands and flags remain explicit; competing team
commands are refused. Initial actor catalogs alone cannot authorize dynamic callbacks. The optional
team-cell capability described below supplies a complete separate actor context;
object events and combat still require their own dynamic proof.
The policy is a WebRA2 scheduling choice, not native engine phase equivalence.
See [source](MISSION_TEAM_ACTION_PROVENANCE.md) and
[runtime provenance](MISSION_TEAM_RUNTIME_PROVENANCE.md).

The optional team-cell phase is original GPL-3.0-or-later composition. A genuine
source capability covers all required future constructors and the supported world
invariant. After the common runtime advances once, the adapter rebuilds source
actor context from its complete history, including released births, and derives
cell entries from the private successful movement receipt. It emits no entry for
placement, reservation or arrival without movement. Restore and replay reconstruct
context rather than accepting a saved actor lookup as authority. The additional
source/phase identity affects only models that opt into this capability. See the
[team-cell provenance](MISSION_TEAM_CELL_PROVENANCE.md) and
[compound report](../../docs/mission-team-cell-dispatch.md).
