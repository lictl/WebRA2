# Source initialization and a shared mission/world clock

[Issue189](https://github.com/lictl/WebRA2/issues/189) joins genuine
[source tag bindings](mission-bindings.md), the [poll interpreter](mission-logic-runtime.md)
and the [world simulation](world-movement.md). A world is admitted only when the full
source program already passes preflight. Both original Allied openings still fail
that requirement; no original mission becomes playable through this component.

## Initial state

`compileMissionInitialFlags({bindings, bytes, initialization:'new-campaign'})` owns
and rehashes the source mission against its genuine binding catalog. It reads exact
`VariableNames` rows and retains their names, origins and explicit defaults. This
initializer has a separate immutable brand and source/catalog/world fingerprint.
Malformed or ambiguous rows leave `canInitialize` false; copied metadata cannot
grant permission to construct a mission.

The [paired ledger](analysis/mission-world-native.json) contains twelve selected code
ranges totaling1,115 bytes, each ending on complete decoded x86 instructions. In both
pinned images the constructor clears50 global values. It clears50 local values in
RA2 and100 in YR. The map-local loader clears names, enumerates at most the profile's
local capacity, parses each key as an index, and reads up to127 value bytes. It copies
the first comma token as the name and, if a second token exists, stores whether its
integer value is nonzero. An omitted value retains the existing slot value.
Paired ReadString consumers call byte trimming that preserves values above0x20.
The bounded parser trims ASCII space/tab only and rejects other control bytes;
it preserves0xA0 in names and counts it toward the39-byte limit.

The WebRA2 policy starts a **new campaign** with zero global/local storage before
applying those explicit map defaults. That is a deliberate D03 initialization choice
based on constructor state; it does not establish native carryover/reset order when
changing missions. Existing campaigns must restore their complete compound checkpoint.
No API imports unauthenticated continuation flags or resets an ongoing campaign using
this factory. Global names are irrelevant to the currently supported numeric operands;
named global lookup remains unsupported.

This bounded closure requires canonical indices, a nonempty name of at most39 bytes,
at most one signed int32 value and unambiguous byte-preserving source encoding. It
rejects repeated/case-mismatched sections, duplicate indices, excessive enumeration,
empty comma tokens, ambiguous padding, oversized names/rows and invalid integers.
It does not reproduce the native loader's out-of-range memory writes or strcpy
overflow. Both profiles retain the VM's100-element local save shape; RA2 positions
50–99 must remain false, and source instructions, pending inputs and restored state
cannot use them. Every unknown required mission instruction still blocks execution.

## Complete world identity and transactions

`compileMissionWorld({world, bindings, flags})` requires genuine authority from the
complete source preflight. It reconstructs the unbound model identity and checks
every entity, owner, health definition, footprint, blocker, navigation grid/cost and
content identity against the source binding world. An optional combat model must
have the existing genuine source bridge. Infantry passage keeps its own original
world proof. Adding a model adapter never substitutes a caller-supplied hash.

The named policy `webra2-mission-world-poll-1` pairs one mission state with one world
state at an equal `nextTick`. On each D03 tick it first applies due explicit flag
inputs and polls the VM's internal controls, then advances the world once. It returns
VM effects in their existing order and world events in their existing phase order.
Those two tick-indexed traces are separate; there is no claim of native global
callback order. Actions that only control flags, timers and explicit binding latches
remain internal to the VM. Outcome effects remain requests and do not set victory.
New unimplemented effect opcodes reject model compilation instead of disappearing.

Physical event observations, shared native reference expiration, dynamic tags,
team activation, production, media and campaign progression require further adapters.
Logical trigger deletion still uses the existing documented tombstone policy; world
objects do not gain a native pointer-cleanup lifecycle. Explicit host/test flag input
is a deterministic data interface, not a player permission or evidence of an actual
world event. Browser player orders have no flag-setting command through this change.

Creating, restoring, admitting commands/flags, stepping and replaying return owned
candidates. Failure does not mutate caller state. Saves pin the compound model,
source program, bindings, initial flags and final world model. Restoration also
checks the exact original attachment blueprint and the source initial flags at tick0,
so the generic VM's caller-selected bindings cannot be smuggled into a source save.
Nonzero-tick validation checks structural invariants rather than proving arbitrary
edited history. Ordinary world/VM formats are not silently migrated into this policy.

At most128 ticks,32768 combined trace rows and16777216 charged VM/world work units
are processed per request. Replays allow10000 ticks and1024 admitted commands/flag
inputs, sharing the work and trace caps. Each underlying parser/runtime also keeps its
existing limits. New source initialization adds16MiB bytes,4096 rows and262144
additional work units. No DOM, filesystem, networking, wall clock or callback occurs
inside a simulation transaction.

## Verification

Ten original tests cover both local capacities/defaults; malformed source and
forged authorities; source ownership and limits; complete model joins; pending
commands/flags; every-boundary restore; exact replay; whole-request rollback; forged
initial flags/attachments/clocks; explicit outcome requests; and source-bound ground
combat with infantry slots through completed death. These tests are miniature authored
missions, not original campaign runs.

A fresh private438-file import independently reproduces both source binding catalogs.
The [metadata census](analysis/mission-world-census.json) records2/62 local declarations
and one true initial local in each Allied opening. Both initializers have zero
diagnostics. A separate raw INI reader compares432 values/origins/hashes, including
both complete flag fingerprints. The full original programs remain unexecutable with
367/531 interpreter diagnostics. Raw source, names, native listings and snapshots
remain in ignored `local/bindings189/` and the preserved mission-world worktree.

The [provenance notice](../packages/sim/MISSION_WORLD_PROVENANCE.md) records licensing
and deliberate policy boundaries. Independent exact-head review, composed public
checks and hosted checks remain gates before merge.
