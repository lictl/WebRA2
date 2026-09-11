# Recruitment with current ownership

[Issue233](https://github.com/lictl/WebRA2/issues/233) adds an optional fixed-actor
binding to the [common team transaction](mission-team-runtime.md). A genuine house
transfer can make a previously unclaimed placed actor eligible for source action4.
The resulting team executes the existing Move/Flash/Sleep program and releases its
members at the existing finished/lost boundary. Source constructors, mutable native
team detachment and whole mission dispatch remain separate gates.

## Source and current-state identities

`compileMissionTeamOwnedBinding({source, world})` requires genuine factories. The
house catalog must retain the exact same MissionBindings object as the team action
source. Removing the optional combat, infantry-passage and ownership capabilities
from the provided model must reproduce the entire original team source model,
including entities, navigation, static blockers and footprints. The returned binding
retains the complete provided model; it never rewrites definition.owner or builds a
smaller world from selected actors.

Every source team action remains represented in the binding. Action7/80 receives
`dynamic-ownership-constructor-required`: the placed ownership catalog cannot grant
constructor ownership/lifecycle state. Unsupported action4 source rows remain
unsupported. Unchanged actors retain the reviewed initial-mission gate. Changed actors require
both supported stationary MissionControl records to be recruitable; unresolved
post-transfer mission state is not repaired by assuming the initial mission
persists. The separate per-action `postTransferRecruitment` and whole binding
`allRequiredTransfersSupported` keep this limitation visible. A failed candidate
remains unavailable. `allRequiredActionsSupported` describes the action rows only. Root must still require the genuine source's complete declaration and
diagnostic closure for whole mission admission.

`compileMissionTeamRuntime(source, limits, binding)` includes the binding hash and
full world8 model hash in its identity. Omitting the third argument preserves the
existing runtime, program, roster, checkpoint and work identities. Old checkpoints
cannot be restored under the new binding. Equivalent independently reconstructed
sources can restore structurally identical saves, while copied or substituted
factory capabilities cannot authorize runtime creation.

## Transfers, claims and release

`transferMissionTeamOwnership(runtime, checkpoint, invocation, workLimit)` applies
the existing source-joined world transfer to a private candidate. It returns
`{checkpoint, result, work}` and advances no world tick. The invocation is an
explicit component input; it does not prove that a trigger fired. Parent mission
integration must supply its own exact ordered house action invocation.

Transfers occupy a separate admission item, `ownershipTransfers: [invocation]`,
with empty requests and commands. Replay preserves their order relative to other
admissions at the same tick. Pending team plans reject transfers. If a transfer
would change any currently claimed actor, the entire operation fails atomically;
no capture-as-death, implicit team detach or replacement recruitment is generated.
A no-op transfer does not falsely end a claim.

Recruitment retains the original type, placement, rank, source flag, Group and
full-force selection gates. Only the owner/house predicate uses the validated
current world8 owner. Live health, routes, goals, movement progress, queued commands
and common claims still decide current availability. Team command envelopes use the
current owner. Combat, seeded RNG, ordinary dying occupancy, infantry reservations
and population history remain in the same world checkpoint.

Each owned claim and release saves `ownershipRevision`, the exact validated world
transfer count at that boundary. The private reconstructed history records the
last actual owner-change revision for each actor. Tick alone is insufficient:
transfer→transfer-back at the same tick must not revive an earlier active claim.
The owned context and roster additionally pin the complete transfer-history hash;
a lower-level roster cannot be reused against a different ownership checkpoint.
An accepted transfer rebuilds that context without changing live team state.
Restore checks revision/time order, owner at claim and absence of any intervening
actual owner change during membership. Releases retain Group/member flags and
`releasedMissionUnverified`; later transfers are permitted, but automatic recruitment
again is still unsupported without the native post-release mission result.

The existing source-authorized death path can remove a team member normally.
Dying health-zero actors retain their ordinary occupancy until completion. Their
historical attacker/victim ownership is never remapped by a later transfer. Losing
the last member releases the team at the next existing controller boundary, without
changing the world's death or population phases.

## Native evidence and deliberate policy

This composition reuses the pinned
[recruitment ledger](analysis/team-recruitment-native.json) and
[house ledger](analysis/mission-house-native.json). Paired CanAdd spans
RA2 `6B8DC0..6B8FB0` and YR `6EA610..6EA862` consume current owner along with
mission/type/flags. AddMember spans `6B8CC0..6B8DBC` / `6EA500..6EA601` retain the
reviewed Group and recruitable-member mutations. These are exclusive endpoints.

The paired Foot owner wrappers are RA2 `4CA7D0..4CA811` and YR
`4DBED0..4DBFC5`. The YR wrapper calls Techno ownership first, then conditionally
calls the established Team.Liberate `6EA870` when its new-house byte predicate and
current team pointer permit it. The shorter inspected RA2 wrapper has no matching
explicit call. This difference does not establish a general native detach policy.
The implementation rejects active-member owner changes in both profiles pending
that broader policy. No new binary execution or native phase equivalence is claimed.

Full-force atomic acquisition, logical-cell selection scores, separate ordered
transfer admissions, revision-qualified saves, retained release restrictions and
one authoritative world update remain explicit D03 policies. Rules tables retain
their upstream verified-source boundary. This component does not authenticate
physical rules bytes or bypass the mission/source/compiler gates.

## Bounds and validation

Existing limits still cap source actors, common histories, requests, active teams,
member counts, trace output and replay duration. The owning world restore charges
input structure and strings before copying/parsing, reserves complete ownership
history reconstruction before it runs, and includes model entities, navigation,
blockers, footprint cells, lifecycle rows, transfer membership and slot-sharing
work. Context, migration and tick composition reserve additional existing full
restore passes before invoking those helpers. Per-instance destination planning and
world transitions retain their own returned work. This is a deterministic resource
policy, not a timing measurement or exhaustive allocation profiler.

Exact sufficient and one-lower budgets, long transfer histories, same-tick
change-back, copied capabilities, descriptor/get-trap boundaries and aggregate
replay failure are tested with original fixtures. Both profiles exercise the real
transfer→action4→Move→Flash→finished release path with restore at every boundary.
A separate original fixture uses the genuine standing-infantry combat bridge and
infantry-passage catalog: recruitment preserves movement, lethal hits, pending
occupancy, current-owner attribution, lost release, corpse RNG and full replay.

No original campaign has passed through this optional binding. Parent integration
must join the binding to its genuine whole mission, preserve source-order action
execution and pass the same current world into team/cell/object contexts. Dynamic
spawn ownership, active capture/detachment, 8997 event-derived Trigger.House,
automatic post-release recruitment and full first-mission admission remain open.

The final original suite adds eight tests. `npm run check` passes1,452 public
tests plus14 tool checks, type checking,213 documents/1,114 local links,
781 publication paths, M0 and79 build outputs/190 approved inputs. An isolated baseline comparison runs
16 unbound original models for256 ticks and compares608 complete source/runtime/
program/initial/admitted/pending/result/replay identities; every identity matches
merged base `d9345d844ce060d02d43d3ae5c22ed63e9e5a4a9`. The comparison digest is
`2a1dc707f59f717596473a45ab24ba269b74d9ee5632bc0b82a8142b9064b60f`.
Ten reused complete native spans totaling4,653 bytes were freshly rehashed against
both entire pinned images and decoded to their exact return endpoints;45 assertions
pass. No additional native implementation is inferred from these checks.

A separately labeled private probe rereads all438 selected on-device catalog files
and prepares both opening sources without altering their data. It runs four scoped
team ticks with world8 ownership, saved pending preparation, every-boundary restore
and full replay. The selected RA2 request remains queued with811 unchanged actors;
the YR source request recruits five of570 unchanged actors, executes its source
Flash and finishes release. Neither probe transfers a retail actor or invokes the
full mission VM. An independent raw parser rehashes five roots/eight members and
checks8,346 comparisons across1,381 original placement owners/types/coordinates and
the selected counter/release output. Existing source mobility, template admission
and native recruitment proofs remain inputs rather than being rederived by that
parser. The supplied Sleep control is not recruitable in either profile, so
`allRequiredTransfersSupported` stays false; resolving the native post-transfer
mission is necessary before this path can recruit those changed retail actors.

Private reproduction in the author worktree uses `local/probe-owned233.mjs`,
`local/oracle-owned233.py`, `local/native-owned233/verify.py` and
`local/legacy-owned233.mjs`. Outputs stay in ignored `local/owned233` and
`local/native-owned233`; only aggregate factual metadata is recorded here.
