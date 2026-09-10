# Team script runtime

[Issue #152](https://github.com/lictl/WebRA2/issues/152) implements an explicit
existing-actor controller over the [typed team compiler](team-definitions.md) and
[authoritative world](world-movement.md). Work is in progress. No native program is
executed and no original campaign is playable through this component yet.

The accepted boundary is a genuine TeamDefinitions result joined to genuine
WorldContent by profile, mission hash and entity-definition fingerprint. Owned
mission bytes are rehashed before reading source waypoint coordinates. Selected
team/task-force/script references and actual row/type/owner bindings are checked;
an arbitrary caller content identity or arrival boolean is not execution proof.

The pure controller prepares a bounded outbox and prospective team state at an
exact world/team checkpoint. A component-owned bridge executes commands on a cloned
WorldSimulation, verifies core command receipts, and returns both new checkpoints
together. No user callback or `ack=true` can advance the cursor. Failed admission,
execution or resource checks leave the caller's pair unchanged. Prepared orders
are saveable and retryable only after deterministic recomputation against their
pinned base state. The complete replay records external admission timing.

The admitted execution policy will use the current WebRA2 whole-cell world,
separately from native locomotor and formation behavior. Script 3's waypoint focus
and script 6's cursor arithmetic have native evidence in both supplied profiles.
Their update cadence, destination assignment and stationary-arrival policy remain
explicit WebRA2 choices. Native move completion additionally consults Stray and
RelaxedStray, regroup state, actor destination/height/transport state and destination
fallback. These are not claimed equivalent to the present world model.

Script 5 remains gated: native guard runs a member mission routine on every poll,
then checks its timer. Implementing only the duration would silently omit guard
acquisition behavior. Unsupported instructions prevent selected-script execution;
there is no generic completion fallback. Team recruitment, spawning, transports,
trigger activation and full native membership lifecycle remain separate work.

[Native evidence and provenance](../packages/sim/TEAM_RUNTIME_PROVENANCE.md).
Private source comparisons and original compound world/controller tests will be
recorded at the implementation checkpoint. No passing runtime checks are claimed
by this initial research checkpoint.
