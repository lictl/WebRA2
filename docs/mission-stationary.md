# Stationary missions across ownership changes

Issue [247](https://github.com/lictl/WebRA2/issues/247) is a bounded dependency of
the [fixed-actor ownership composition](mission-team-ownership.md) and the
[first original mission](first-mission-closure.md). The source catalog and serialized
witness are implemented with paired static and private source checks. Independent
review and root runtime integration remain required.

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

The [paired native ledger](analysis/mission-stationary-native.json) pins 66 records
and 11,876 bytes from both complete executable hashes: 36 complete functions,
four constructor instructions, 22 pointers and four literals. MissionClass starts
current, suspended and queued missions at -1. The placed Infantry reader resolves
the exact mission name, queues it without an immediate-start request, then calls
NextMission after successful placement. Fresh campaign mode is explicit because
the RA2 reader has a separate non-campaign idle branch. The effective recruitment
selector reads current first, using queued only when current is -1.

The family vtable joins connect both owner routines to Infantry idle. Its no-target,
no-destination Guard/AreaGuard branch preserves the current mission; YR additionally
requests Guard during ordinary Infantry ownership change. That request still uses
the CanStart gate, so it cannot certify a prior Sleep actor. Foot locomotor/queued
destination branches and Unit special cases are retained as limitations. This
supports the bounded untouched-Guard policy, not a proof of every transitive
callback or autonomous MissionClass transition.

The [private-source census](analysis/mission-stationary-census.json) reads 438
selected files for each profile. A separate Python parser rehashed five archive
roots and eight direct members and checked 109,522 values against the TypeScript
projection. All 1,381 source actor identities, positions and initial mission fields
are included. Previously reviewed recruitment eligibility reasons remain upstream
dependencies. RA2 has 234 conditional actor/catalog rows covering 18 distinct
Guard actors; YR has 20 rows and 20 distinct actors. These are mission predicates,
not selected recruits. Both source Sleep controls remain non-recruitable, the
existing transfer gate remains false, and neither original program was activated.

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
lower work/length limits, 600 idle ticks, repeated transfer history followed by
queued commands, and pending projectile/live route reconstruction. Fifteen owned
source/witness tests plus two coordinator receipt tests pass. See the
[provenance notice](../packages/sim/MISSION_STATIONARY_PROVENANCE.md).
The complete checkpoint check passes 1,505 public tests, 14 tool tests, types,
218 Markdown files/1,130 links, 809 publication paths, M0 consistency and a
79-output/190-input engine build. These public tests use original fixtures.

Private Node 24.20.0 characterization on macOS arm64 used original overlapping
idle placements on a ten-cell fixture. One process measured 80 single-tick calls
(10 warmups, 70 samples) and ten restored-fork joins. These are inclusive local
characterizations, not isolated benchmarks, navigation throughput or browser
cadence. Independent stage medians are not additive.

| Actors | Live witness update median | Restored-fork update median / p95 | Restore 80 ticks | Logical restore work |
| --- | --- | --- | --- | --- |
| 2 | 0.005 ms | 0.064 / 0.144 ms | 81 ms | 565,982 |
| 64 | 0.013 ms | 0.444 / 0.745 ms | 517 ms | 4,198,276 |
| 256 | 0.032 ms | 1.541 / 1.732 ms | 1,920 ms | 15,563,812 |
| 1,024 | 0.041 ms | 9.662 / 81.659 ms | refused after 3,829 ms | exceeds 16,777,216 |

A separate two-actor, 1,800-tick journal restores exactly in 3,071 ms using
12,561,261 work, despite occupying one compressed journal row. All completed
restores matched the full world and witness; the 1,024-actor refusal is retained.
The earlier under-reserved restore measurements are obsolete and remain private
for comparison. This component does not yet establish scalable long-session
restoration for the original mission. Common-runtime integration must preserve
these resource refusals and address the replay cost before broader admission.

Private reproduction remains in the author's ignored `local/` directory:
`probe247.mjs` produces `stationary247/corpus`, `oracle247.py` independently checks
the raw source projection, and `native247/ledger.py` rehashes the pinned images and
regenerates the public metadata. `stationary247/cost.ts` reproduces the original
characterization; current and pre-correction facts are retained separately.
Native listings and source rows remain private.
