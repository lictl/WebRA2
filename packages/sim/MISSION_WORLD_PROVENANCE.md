# Mission/world initialization and transactions

`src/mission-initial-flags.ts`, `src/mission-world.ts` and their original tests are
WebRA2 contributor work under GPL-3.0-or-later. No retail source bytes or native
listings are included. The paired static range metadata is in
[the native ledger](../../docs/analysis/mission-world-native.json).

The source initializer interprets hash-verified mission VariableNames using the
pinned RA2/YR local loader and constructor evidence: 50 globals and 50/100 locals,
zeroed constructor values, and optional comma-delimited local integer defaults.
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
