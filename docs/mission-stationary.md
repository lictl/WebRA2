# Stationary missions across ownership changes

Issue [247](https://github.com/lictl/WebRA2/issues/247) is a bounded dependency of
the [fixed-actor ownership composition](mission-team-ownership.md) and the
[first original mission](first-mission-closure.md). This source checkpoint is
incomplete: the source catalog and serialized witness are implemented; independent
native/corpus checks and root runtime integration are still required.

The current ownership policy requires both Guard and Sleep to be recruitable
after any ownership transfer. Source Sleep can be non-recruitable while an
untouched Guard actor is still a possible recruit. The new
`compileMissionStationarySource({binding, initialization:'fresh-campaign'})` catalog identifies that conditional
Infantry Guard case, retains every upstream action and recruitment actor, and
keeps the complete genuine source accessible for later whole-program admission.
It does not change the existing gate or grant runtime authority.

`createMissionStationaryWitness` creates the exact fresh source world and a branded
live witness. `advanceMissionStationaryWitness` consumes only genuine successful
command, step and ownership-transfer returns. It retains current/queued mission
distinctions and permanently invalidates this narrow certificate after command
admission, movement, combat or team involvement. `observeMissionStationaryTeams`
consumes the genuine complete team context, including claims that only Flash and
release. `missionStationaryGuardCandidate` checks the additional mission predicate;
it cannot replace full-force, current-owner, active-claim or complete-source gates.

The D03 policy holds an untouched placed Infantry Guard at current mission 5 with
no queued mission (-1). It does not simulate autonomous Guard acquisition or the
native MissionClass timer. A placed Sleep starts at 0/-1; its mission after a
transfer remains unverified. Unit idle branches, active claims/capture, released
teams and dynamic constructors stay gated. A motionless actor cannot recreate a
lost Guard certificate.

Saving includes a bounded operation journal, exact source/world hashes and team
history. Restore replays the original core call boundaries and compares the
reconstructed actors, actual world and genuine complete team history. Repeated
identical step calls are compressed but replayed separately. Saved actor fields
are comparison data, never a caller-supplied certificate. Earlier witnesses and
frames remain immutable when an attempted update or restoration fails.

The core receipt hook is lazy: unused simulation paths retain constant-size owned
references without extra full-world hashes, copies or actor scans. A requested
observation scans the already owned before/after states. Uninterrupted instances
join by private boundary identity; restored forks request charged hashes instead.
Unchanged team histories reuse the genuine context hash and do not copy actors.
Queries use an indexed actor/action predicate. Only untrusted restore replays the
journal. Default limits are 4,096 journal rows, 20,000 operations, 4,096 commands,
10,000 ticks and the existing 16,777,216 logical work cap, all lowerable. Resource
limits can refuse a long restore even when its compressed journal is short.
Restore reserves the complete current save graph and ownership-history work
before each replay call, using the existing bounded owning-world helper. This
includes transfer history accumulated before later idle or command calls. The
same complete bound applies to the final caller-world comparison. This currently
performs additional validation during restore; the live path is unchanged.

Root integration must update the witness on a private candidate world, observe
its complete team context, then publish both atomically. A witness failure does
not undo a core operation already committed on some caller-owned world. The root
must discard that candidate and retain the prior published checkpoint. Optional
capability binding and compound saves/replay are not yet wired; this component
does not change existing source/program hashes or the blanket transfer gate.
No full native mission scheduler, universal ownership transition or campaign
completion is claimed.

The initial original tests cover both profiles, source controls and overrides,
retained unsupported rows/constructors, same-realm identity and descriptor capture,
and exact aggregate work rejection. Witness cases also cover receipt forgery,
skipped/reused operations, restored forks, edited journals, Flash-only history,
lower work/length limits and 600 idle ticks with exact reconstruction. See the
[provenance notice](../packages/sim/MISSION_STATIONARY_PROVENANCE.md).
