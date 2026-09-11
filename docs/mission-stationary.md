# Stationary missions across ownership changes

Issue [247](https://github.com/lictl/WebRA2/issues/247) is a bounded dependency of
the [fixed-actor ownership composition](mission-team-ownership.md) and the
[first original mission](first-mission-closure.md). This source checkpoint is
incomplete: a serialized witness and root runtime integration are still required.

The current ownership policy requires both Guard and Sleep to be recruitable
after any ownership transfer. Source Sleep can be non-recruitable while an
untouched Guard actor is still a possible recruit. The new
`compileMissionStationarySource({binding})` catalog identifies that conditional
Infantry Guard case, retains every upstream action and recruitment actor, and
keeps the complete genuine source accessible for later whole-program admission.
It does not change the existing gate or grant runtime authority.

A future live witness must originate from the exact initial source world and
consume genuine core operations. It must retain current/queued mission distinctions
and permanently invalidate the narrow certificate after commands, movement,
combat or team involvement. Restore must reconstruct its journal and compare the
actual world, so editing a saved stationary snapshot cannot manufacture a Guard
certificate. Sleep, Unit idle branches, active claims/capture, released teams and
dynamic constructors remain gated until their consumers are established.

The proposed core receipt hook is lazy: unused simulation paths must not perform
extra full-world hashes, copies or actor scans. Hash/restore work and journal
length will have explicit bounds and measured costs. No full native mission
scheduler, universal ownership transition or campaign completion is claimed.

The initial original tests cover both profiles, source controls and overrides,
retained unsupported rows/constructors, same-realm identity and descriptor capture,
and exact aggregate work rejection. See the
[provenance notice](../packages/sim/MISSION_STATIONARY_PROVENANCE.md).
