# Source-bound team runtime

[Issue #152](https://github.com/lictl/WebRA2/issues/152) adds an executable controller
for explicitly bound existing actors and complete source scripts containing moves
(opcode 3) and jumps (6). It composes the [typed team compiler](team-definitions.md)
with the [authoritative world](world-movement.md). This is a campaign foundation;
there is no spawning, trigger activation, recruitment, combat acquisition or full
mission admission. Every result retains `canStartCampaign: false`.

## Source and actor binding

`compileTeamProgram({teams, world, mission: {source, bytes}, teamIds}, lowerLimits?)`
requires genuine TeamDefinitions and WorldContent results, matching profiles,
mission and entity-definition hashes, and an owned, rehashed mission byte array.
It returns coverage plus a branded program only if every selected team and its
entire script is supported. Missing waypoints, unresolved owners/types, guard,
unknown operands, tag lifecycle or active unimplemented behavior flags block the
selection. It never executes a supported prefix then skips an unknown instruction.
The typed source compiler already rejects repeated consumed exact waypoint headers
and numeric aliases; waypoint spelling and inside-diamond coordinates are checked
again at admission. Semantic INI normalization retains its documented policy.

`bindTeamActors(program, [{id, teamId, actorIds}])` creates a branded roster with
stable instance IDs and sorted actor IDs. Every selected template needs an instance;
each instance must exactly satisfy its task-force type quantities. Actual mobile
infantry/unit placements must match source type, literal house and world player.
Actors cannot belong to multiple instances. Activation flags such as Autocreate,
Prebuild and recruitment are retained by the source fingerprint but not performed
by this explicit binding API. Existing-actor activation is a WebRA2 operation.

The program pins team, entity, mission, world and model hashes plus policy and limits;
the roster additionally hashes the exact actor bindings. SHA-256 uses the existing
integer-JSON canonical form: sorted UTF-16 object keys, retained array order,
no Unicode normalization, finite safe integers and no negative zero. Factory
brands remain process-local; reconstruct genuine sources and the roster before
restoring an exported checkpoint.

## Atomic execution and persistence

`createTeamCheckpoint`, `restoreTeamCheckpoint` and `prepareTeamTick` are in
[team-runtime.ts](../packages/sim/src/team-runtime.ts). The compound checkpoint
holds a complete WorldSave, team tick/start tick/order counter, per-instance active
members/cursor/phase, assigned cells, issue/retry times and an optional pending plan.
Restore accepts bounded objects, JSON text or UTF-8 bytes. It checks exact schemas,
identities, world validity, member/type bindings, source cursor rules, assignment
uniqueness/navigation/radius, authoritative world-goal correspondence and timer/counter
consistency. This is structural save
validation, not cryptographic authenticity or proof of every historical transition.

Preparation returns a bounded outbox and prospective team state pinned to the base
world/team hashes and tick. Neither committed state advances. Pending restore
recomputes the plan and compares its complete canonical contents, including orders,
events and work; editing an acknowledgement, destination or hash cannot commit it.

[team-runtime-world.ts](../packages/sim/src/team-runtime-world.ts) provides:

- `commitTeamTick(roster, checkpoint, workLimit?)`: restore an isolated world,
  allocate owner sequences from its admission cursors, admit the exact prepared
  commands, step once, and require exactly one matching core command receipt per
  commanded actor. Only then return the compound checkpoint.
- `stepTeamWorld(roster, checkpoint, ticks?, workLimit?)`: apply multiple candidate
  ticks, publishing nothing if any tick, receipt or aggregate resource check fails.
- `admitTeamWorldCommands`: admit unrelated external commands between compound
  ticks. Pending plans and commands competing for any roster actor are rejected,
  including future queued commands. Finished instances still own their bindings;
  release/recruitment is not implemented.
- `replayTeamWorld`: validate an initial compound checkpoint, external admission
  batches with their admission ticks, final tick and expected canonical state hash.
  Initial pending orders execute once; later batches contain only subsequent
  admissions. Replay accepts the same object/text/bytes formats as restore.

No caller callback, arbitrary acknowledgement or render observation can advance
the script. Failed preparation/admission/execution leaves caller-owned inputs
unchanged. The core chooses final command order; instance IDs order the outbox,
actor IDs order each instance, and saved owner sequences preserve admission identity.

## Execution policy and native limits

Policy `webra2-existing-team-cells-1` uses the current fixed-tick, whole-cell world.
One controller update occurs before one world tick. A new script cursor starts at
minus one. Advancing increments it; jump 6 records the source target minus one so
the next update increments to the target. This matches the observed native
argument-minus-two/cursor-increment relationship after translating to zero-based
compiled indices. The global cadence remains a WebRA2 choice.

Move 3 uses the [shared destination planner](team-destinations.md) around the exact
source waypoint, saving distinct per-member assignments. Completion requires every
surviving member at its assigned cell with null goal, zero edge progress and no
route. Arrival marks the step ready to advance on the next controller update.
A blocked assignment retries after 15 ticks, retaining the timer in saves. An
already issued order waits as long as necessary; timeout never implies success.
Authoritative zero-health members retire; losing every member yields `lost`, not
`finished` or victory. No native member-death side effects are claimed.

Assignment guarantees apply within each planner call, using current anchors,
footprints and in-flight reservations. Other instances and queued future orders
can still congest the same destination. The controller does not claim global
formation optimality, deadlock freedom or a fixed completion duration.

[Native evidence](../packages/sim/TEAM_RUNTIME_PROVENANCE.md) shows both waypoint
handlers and cursor transitions. Native move completion additionally consults
Stray/RelaxedStray, regroup, destination fallback, actor height, transport and
locomotor state. Those differences are explicit. Guard 5 invokes member mission
operations before testing its timer; an inert wait would omit acquisition behavior,
so guard remains unsupported. RNG neutrality, original frame timing, formation,
automatic membership, transport, team spawning and trigger lifetimes remain open.

## Bounds and checks

Lower-only program limits: 16 MiB mission bytes, 64 selected templates/instances,
256 total bound members, 3,200 instructions, 256 orders per tick, 1,089 candidate
cells and 262,144 counted work per preparation. The shared planner separately caps
64 members per instance, radius 16, path queries and expansions. A call runs at
most 128 ticks; replay spans at most 10,000 ticks with 1,024 admission batches and
1,024 total external commands. Returned orders plus team/world events share a
32,768-record cap; aggregate execution work is at most 16,777,216. Counters stop
at tick 1,000,000,000 and safe integer order/command identities.

Existing canonical parsing additionally caps 2 MiB, 50,000 nodes and depth 48.
Source compilers/world/navigation retain their own bounds. Counted work describes
controller/planner/world operations; repeated restore, canonical hashing and
source validation have separate structural caps. It is not a total CPU/RSS promise.
Resource failure returns no partial transaction or assignment.

Original public fixtures cover genuine both-profile source joins, typed waypoints
and compacted jumps, guarded/unsupported selections, duplicate headers, every-tick
compound restore, saved pending retry, cyclic jumps, bad schemas/sources/actors,
member loss, external admissions/replay, a destination occupied for 30 ticks then
released, retry timers with every reachable slot occupied, and all-call rollback.
The member-loss test is an explicitly constructed valid authoritative observation;
it does not claim retail damage execution. Shared planner tests remain the separately
reviewed [PR #156](https://github.com/lictl/WebRA2/pull/156) evidence.

## Private opening preflight and next mission work

The private probe re-imported both pinned openings through the current catalog and
terrain/content pipeline, authenticated source bytes, compiled native definitions,
traversal/footprints and world joins, then independently selected each opening team.
No retail program was executed and no rows/assets/listings are published.

| Metadata | RA2 opening | YR opening |
| --- | ---: | ---: |
| Compiled placement joins | 811 | 570 |
| Global plus mission team definitions | 152 | 265 |
| Mission-declared teams / distinct referenced scripts | 49 / 37 | 102 / 93 |
| Complete admitted move/jump team programs | 0 | 7 |
| Teams with only move/jump opcodes before behavior gates | 0 | 32 |
| Guard-gated selected teams | 7 | 9 |
| Raw script pairs checked independently | 86 | 373 |
| Raw event/action frames checked independently | 567 | 1,595 |
| Independent source/coverage assertions | 972 | 3,020 |

Map hashes remain RA2 `ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c`
and YR `dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0`.
The separate Python parser verifies exact source script references, ordered numeric
slots and operand pairs, variable event framing, eight-token action framing and
supported-step counts. It does not independently prove every typed property or
world join; those component oracles are recorded with their original components.

The next bounded campaign seam is source-defined spawning/reinforcement plus world
trigger binding. Actions 4/7/80 occur 29/25/21 times in RA2 and 21/47/36 in YR;
all these rows have a literal typed-team match in the second field after the opcode.
Their union references 33 RA2 teams/28 scripts and 91 YR teams/82 scripts. Literal
matching and [YRpp action names/locators](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TActionClass.h#L152)
identify research targets, not verified execution or complete operand schemas.

YR's seven already admitted templates can exercise spawn → move → compound save
once the source/world activation seam exists. RA2's smallest extra single-opcode
sets without other current team-flag gates are opcode 11 (three teams), 50 (three),
1 (two) and 0 (two). Establish their native dispatcher/context and implement only
the reachable required behavior; do not hardcode an opening rescue or call these
counts a complete mission dependency graph. Global/local variables, trigger repeats,
combat/acquisition, player goals and media remain part of the larger campaign work.

Private reproduction from this worktree with Node 24.20.0:

```sh
node --import tsx local/probe152.mjs
python3 local/opening152/oracle.py
/Users/lucus/Projects/WebRA2/local/worktrees/theater-tiles/local/venv/bin/python local/native152/ledger.py
```

Probe scripts, four verified INI inputs per profile, full projections and factual
summaries stay under ignored `local/`. The source probe reads root `game/` and writes
only `local/opening152/`; copied scripts must import the reviewer checkout.
