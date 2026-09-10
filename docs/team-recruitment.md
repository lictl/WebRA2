# Source CreateTeam recruitment and Flash

[Issue #175](https://github.com/lictl/WebRA2/issues/175) admits a bounded CreateTeam4
request by recruiting existing actors. It composes genuine source programs, world
content and the [source activation catalog](team-spawning.md), without replacing
recruitment with spawning. Source Flash50 is an independently saved dependency.
Original trigger-to-action admission, live combat/transport membership and browser
Flash presentation remain unimplemented here. Neither component makes a campaign
playability claim.

## Source authority and permanent capability limits

`compileTeamRecruitmentCatalog` requires a genuine TeamProgram and TeamActivationSource,
matching entity/team/world/profile identities, exact rules-layer pins and freshly
owned, rehashed mission bytes. Fresh placement compilation joins every model row,
type, owner and player. Physical rules bytes remain authenticated by the verified
import session upstream; this component does not rehash a caller's rules file.
Only literal CreateTeam4 frames with the activation compiler's precise outstanding
recruitment gate are consumed. Every instruction in each selected script must pass
program admission, including instructions after a jump or persistent Sleep.

The catalog retains all placed actors, including unsupported ones. Candidates are
ordinary mobile infantry/units with exact source section names, complete nonempty
ASCII placement rows within the native buffer bound, typed rank/Group/recruit flags,
no tag/bridge/follower context, and Guard/Sleep missions whose exact MissionControl
`Recruitable` field is known true. Fresh native MissionControl defaults are true;
missing source keys retain the prior stage. Repeated sections/keys and unrecognized
booleans stay unsupported. Rank is retained unchanged: the inspected ordinary
CanAdd/AddMember paths do not convert it to the TeamType's VeteranLevel.

TaskForce member order, exact type/house/player, effective Group, Recruiter,
Autocreate and AreTeamMembersRecruitable fields retain their origins and histories.
A source waypoint is required as the recruitment distance anchor. Native absent-
waypoint fallback is not guessed. Repeated TaskForce rows naming the same type are
unsupported because native first-matching-slot accounting is not equivalent to
summing quantities. Other unsupported source/template flags remain blocked by the
complete program/activation gates.

## Existing actor selection and ownership

`prepareTeamRecruitmentSelection` accepts a genuine catalog/context and a validated
current WorldSave. It returns `selected`, `unavailable`, `unsupported-source` or
`budget-exhausted`; failure never exposes a partial actor list. Selected members
must be alive, stationary, free of routes/goals and all queued commands, and
unclaimed by this controller. A is required unless Autocreate; Autocreate also
requires B. Group -2 accepts any group; other mismatches require Recruiter.

For actors not yet claimed, ordinary core move/stop completion changes live motion
state but does not reconstruct native MissionClass transitions; recruitment
continues to use the authenticated initial Guard/Sleep recruitability as an
explicit D03 movement-world policy. Release takes the separate conservative gate
described below.

The D03 policy fills the entire source TaskForce atomically, in literal slot order.
For each member it minimizes `65536 * (dx² + dy²) + groupPenalty`, where coordinates
are logical cell centers and the penalty is 12800 for a different effective Group,
including wildcard -2. Ties use stable entity IDs. Native selection uses physical
family-container order, actor XY coordinates and signed32 squared-distance arithmetic;
the inspected helper excludes Z. WebRA2 uses safe wide integers and stationary
whole-cell coordinates. Native incremental acquisition, priority stealing,
subcell/formation positions and absent-waypoint fallback are not reproduced.

`commitTeamRecruitmentSelection` recomputes the exact proposal against the pinned
world/context before appending a claim. `restoreTeamRecruitmentContext` reconstructs
source-bound, monotonic claim/release history. Claiming writes the effective Group
and B from AreTeamMembersRecruitable; release retains these mutations. Actor IDs,
health, rank and world count never change through recruitment. Claims persist across
save/replay and prevent a second team from taking the same actor. Finished/lost teams
release ownership at the completed tick boundary. Released actors accept unrelated
world commands, but automatic recruitment again is gated as
`released-mission-unverified`: native Liberate invokes further actor idle/mission
behavior whose result this slice does not invent. History space for eventual
releases is reserved when claims are admitted. Partial member loss stays visible in
the existing controller; this transaction does not recruit replacements into an
already active team or reproduce native continuous TaskForce replenishment.

## Flash and compound tick policy

`teamFlashInstruction`, `assignTeamFlashes`, `advanceTeamFlashes` and
`snapshotTeamFlashes` retain both the integer counter and the separate flashing bit.
Native first-entry Flash50 overwrites each member's counter, then sets StepCompleted.
An update with a positive counter decrements and assigns the post-decrement low bit;
a zero counter preserves the old bit. Consequently overwriting a running counter
with zero can leave the bit true. The component preserves this case; it does not infer
the bit from the remaining count. Negative wrap and arguments above one billion are
unsupported. The inspected bounded code uses no RNG; global Scenario RNG equivalence
is not claimed.

The shared program policy becomes `webra2-existing-team-cells-3`, with a pinned Flash
policy and saved actor Flash states outside the team instances. At each WebRA2 tick,
existing counters advance before instructions; an entry assignment therefore first
decays on the following tick. Flash completes one instruction, while Sleep remains
persistent and never advances a later line. Flash survives ordinary team release
and is restricted on restore to the actual source roster or authenticated historical
recruitment members. Native actor/team update ordering and deletion timing are not
claimed. Old program/roster saves do not silently migrate to this new policy.

`createTeamRecruitmentCheckpoint` starts from the genuine fresh movement world and
an empty recruitment controller. It does not import arbitrary prior native membership
or compose combat worlds. `admitTeamRecruitmentInput` admits selected source action IDs
and unrelated world commands atomically between ticks. Unsupported source requests
fail admission; unavailable actors cause an explicit saved retry every 15 ticks,
with bounded exhaustion. Due requests run by admission ID, then the existing team
controller and one world tick; terminal releases follow that completed tick.

Prepare saves the complete candidate checkpoint and outputs. Commit recomputes it;
a world/order/resource failure publishes no claims, cursor changes or world state.
The shared binding/migration proposal proves the exact single-event history append,
source member/birth/owner joins, untouched world/queues/cursors and terminal release
condition. It rejects competing orders, pending migration and fabricated releases.
`stepTeamRecruitmentWorld` and `replayTeamRecruitmentWorld` preserve all-call rollback.
Replay begins from the full initial checkpoint, including any initial records or
pending plan, and contains only subsequent admissions. Structural saves are not
cryptographic proof of historical gameplay; pending/live commits validate current
transitions. The outer admission API does not decide when a native trigger fires.

## Bounds and evidence

Defaults cap 16 MiB mission input, 256 actions, 2048 source actors, 64 members per
selection, 256 retained claim/release records and 524288 selection/source work units.
The genuine program further limits active teams/members. There are at most 64 queued
requests, 1024 retained requests/replay admission items, 10000 attempts and replay
ticks, 32768 trace items, and 16777216 reported batch/replay work units. Limits may
only be lowered. Canonical JSON/node/depth guards remain in force. Native helper calls,
extra standalone restore validation and JavaScript allocation costs are not wall-clock
measurements; input and reconstruction limits bound those independently.

Nineteen original tests cover both profiles, source/default/history/group/flag
policies, whole-force failure, stale and hostile plans, immutable claims, release
capacity, unavailable/dead/queued members, source move→Flash→Sleep, persistent later
lines, every-tick restore, pending replay, changed admissions and aggregate rollback.
The private proposed composition passed 942 public tests; the coordinator must apply
and independently review the shared patch and run the final integrated checks before
merge. These are original synthetic checks, separate from the private corpus.

The private opening probe authenticates map/rules/art/AI through the existing browser
catalog adapter. Of 29 RA2 action4 occurrences, 13 occurrences across three templates
have newly complete scripts, all Flash-only. Two lack the supported source waypoint;
the remaining 11 have no placed actors matching the exact required type and house,
and remain unavailable after two attempts over 16 ticks. Of 21 YR action4 occurrences,
one newly complete Flash-only template recruits five existing actors, executes
Flash120, releases at tick boundary 2 and retains the counter to expiry. Its 128
every-tick restores and pending replay match, with the original 570 actors unchanged.
No retail movement is inferred from these Flash-only scripts. The independent Python
raw-INI/source/selector/counter oracle checks 164465 assertions, 9491 repeated catalog
actor rows and 304 frames. Counts and source/hash pins are in the
[metadata census](analysis/team-recruitment-census.json).

Reproduction uses ignored private files in the author worktree:
`local/native175/{probe.py,ledger.py,oracle.py}`. In the isolated proposed integration
checkout, `node --import tsx local/probe175.mjs` writes `local/opening175/` using only
locally verified assets. Run `python3 <author>/local/native175/oracle.py
<integration>/local/opening175` for the separate raw-source oracle; run
`<private-capstone-python> local/native175/ledger.py` in the author worktree for the
56-row/10148-byte paired-image ledger. Raw sources, listings and runtime records
remain private. See [the provenance](../packages/sim/TEAM_RECRUITMENT_PROVENANCE.md).

The next integration must join CreateTeam4 and reinforcement7/80 source action
admissions to the trigger runtime, preserve shared team ownership, and carry Flash
snapshots into presentation. RA2's unavailable actors may depend on earlier source
reinforcement; this slice does not manufacture them. Attack/acquisition, additional
script opcodes, combat membership, transport and native release mission state remain
explicit later dependencies.
