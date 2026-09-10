# One shared mission team transaction

This component of [issue210](https://github.com/lictl/WebRA2/issues/210) executes
explicit source action4/7/80 receipts against one world and one team ownership
history. It consumes the genuine [action-source catalog](mission-team-action-source.md).
It does not grant whole-mission authority, dispatch triggers itself, or enable the
current combat/infantry browser world.

## Source and ownership boundary

`compileMissionTeamRuntime` authenticates the source factory, all complete programs
and family catalogs. The coordinator's `unionTeamPrograms` joins their full
source/model/waypoint identities and exact overlapping templates under aggregate
limits. It does not manufacture subset programs. Unsupported action occurrences
remain rejected even when other occurrences can run. Full declaration diagnostics
remain on the original source catalog; `wholeSourceReady` is a separate root
admission requirement.

The new shared context has one append-only history of reinforcement constructors,
recruitment claims and releases. All claims share membership, actor IDs and order
ownership. Complete source TaskForce order governs selection. Reinforcement uses
source archetypes and distinct passable cells; recruitment considers only genuine
placed candidates with current availability, Group/A/B and mission eligibility.
Queued external commands exclude a recruitment candidate. Shortage retries do not
spawn replacement actors.

Constructed actors have explicitly new constructor row identities. They are not
inserted into placed-actor source catalogs. They share ownership and release history,
but cannot become recruitment candidates without evidence for their fresh native
mission/group state. Released actors accept unrelated external orders while remaining
`releasedMissionUnverified` for subsequent recruitment. The base factory refuses
combat and infantry-slot models; it cannot discard either adapter to gain admission.

## Transaction policy and API

`webra2-mission-team-transaction-1` is a WebRA2 policy under D03:

1. Root supplies only its own genuine VM effects as receipts with effect order,
   emission tick, instruction, tag binding, trigger and opcode. The runtime validates
   their exact source joins. Effect orders increase with gaps permitted; repeated
   invocations of the same instruction remain distinct requests.
2. Requests become due at emission tick plus one. Due requests and retries execute
   in receipt order against the same current world and claims. Whole-force selection
   and insertion are atomic; blocked requests retry after the configured 15-tick
   default, up to the saved bounded attempt limit.
3. The existing shared script interpreter prepares commands once. One
   `commitTeamTick` advances the candidate world once and verifies command receipts.
   Move, jump, Flash and persistent Sleep retain their reviewed policies. Terminal
   teams release at the completed tick boundary. Flash survives either family release.
4. The returned genuine world-step receipt lets root compose existing observations
   with this same tick. New actors gain no cell/object callback authority from their
   constructor rows. Root must explicitly gate unsupported combined contexts.

The public functions create/restore a checkpoint, admit receipts and unrelated core
commands, prepare/commit a pending candidate, step exactly one logical tick, and
replay admissions. `stepMissionTeamWorld` accepts an optional lower work budget.
The internal `missionTeamWorldStep` accepts only a genuine single-tick result and
returns the exact model/world-step pair. Copied metadata and replay aggregates cannot
impersonate that receipt.

The runtime owns the sole nested `team.world` save. Root integration must verify any
outer world representation against it. Prepared candidates publish no current state;
restoring pending bytes recomputes the candidate from the committed base. Source or
late command/work/trace failure publishes no new history, cursor, Flash or world.
Repeated speculative validation is not an additional committed logical tick.

## Bounds and save checks

Default bounds are 64 active teams, 256 active members, 64 actors per team, 256
retained history records, 256 constructed historical actors, 1,024 receipts, 64
pending requests and 10,000 attempts. The world retains its 2,048-entity cap.
History capacity reserves each active team's eventual release. Runtime caps are
lowered by the source catalog and union-program caps. Claim selection, insertion,
script work, world work, trace output and replay totals are bounded separately.

Inputs are descriptor-owned before use, with strict dense arrays, plain data records,
integer counters and bounded recursive JSON. Saves retain source/runtime identity,
ordered receipts, attempts/due ticks, exact claim/history joins, controllers, Flash,
commands and pending work. Finished releases reject source Sleep barriers and
nonterminating jump paths, plus completion earlier than the minimum finite-script
update count. Current constructed actors must also own an exclusive anchor: sequential
reuse of a historical birth cell cannot grant new initial-overlap permissions. Original
base-map overlap remains intact. These checks close structural-restore review findings; live migration
already required a terminal controller. Saves are structural validation, not
cryptographic authentication of every past world transition.

## Validation scope

Original fixtures cover both profiles and all three action families in a common
tick, repeated occurrences, contested recruitment, full-force shortage, shared IDs,
complete-program union, queued/external command ownership, release and Flash,
Move-to-Sleep, every-boundary restore, pending replay, source impersonation, hostile
descriptors and failures after candidate world execution. Budget regressions retain
identical outputs at a sufficient smaller bound and reject lower bounds before
committing. Native source interpretations are reused from the already reviewed
[reinforcement](team-spawning.md), [recruitment](team-recruitment.md),
[script](team-runtime.md) and [Sleep](team-sleep.md) components.

At worker checkpoint `5122bcb`, `npm run check` passes 1,176 public tests,
typechecks, 182 documents/914 local links, the 647-path publication guard and the
existing 72-file build. The 15 new worker tests and the coordinator's union/roster
fixtures are synthetic; these totals are not retail validation. After the coordinator planning-budget helper was integrated, all 118 focused team
and mission-team tests and typechecks pass with the remaining budget propagated
into script preparation. The final combined PR separately verifies VM integration.

Private installation checks use all438 selected on-device files, verified source
catalogs and explicit selected receipts. Both cases restore a prepared pending tick
and replay the complete transcript to the exact final checkpoint.

| Profile | Logical ticks | Actors before/after | Observed component outcome |
| --- | --- | --- | --- |
| RA2 | 200 | 811 / 812 | One source reinforcement, movement and persistent Sleep; no release |
| YR | 128 | 570 / 570 | Five existing actors recruited, Flash executed, team released and Flash expired |

RA2's final combined checkpoint hash is
`50d0143cce80f54672aa7e8d8704142fb95f289ee802e8751640d438d4bd5ce4`;
YR's is `08047f90a1f60ffac1c8d242a6a8c5ba4ed0f979031fb05308aeec6f8efe22f2`.
The final owned world hashes are
`ff4fc3c97ca2015920bcba1732e66b39a9a55828a12e21eea76238c7dffa3c36`
and `75af7288e8b83e244d5a43363b23c7eb6e8468f784fc43672b719ea48a778098`.
Both full source catalogs still have `wholeSourceReady=false`. These explicit
component receipts are not evidence that a native trigger has fired or that either
opening is playable. There is no new browser or native game execution claim.

The ignored reproduction script is `local/probe210-runtime-final.mjs` in the
team-transaction worktree; it imports that worktree's reviewed source, verifies the
installation again and writes only to `local/team210-final/`. Exact retail source
operands, geometry, actor IDs, saves and trace payloads stay there.

The new code and fixtures are original GPL-3.0-or-later; see the
[component notice](../packages/sim/MISSION_TEAM_RUNTIME_PROVENANCE.md). Existing
coordinator-authored union/roster/receipt helpers retain their component notices.
