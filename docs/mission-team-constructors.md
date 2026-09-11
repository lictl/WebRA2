# Team constructors with current ownership

[Issue245](https://github.com/lictl/WebRA2/issues/245), under
[ownership233](https://github.com/lictl/WebRA2/issues/233) and
[first mission230](https://github.com/lictl/WebRA2/issues/230), adds ordinary unit
construction to the source-bound shared team runtime. Actions7/80 can append
units, execute their supported scripts and release them while preserving the
world's current ownership, population, combat and infantry occupancy capabilities.
Whole-source closure and mission dispatch remain separate gates.

`compileMissionTeamConstructorSource({actions, houses, constructors})` requires
exactly joined genuine factories. Every source action, complete TaskForce order
and represented archetype remains visible. Unit construction requires the existing
placement/type prerequisites and supported house-count classifications. Infantry,
unknown population classifications, unsupported entry locomotors and nonempty or
unresolved team tags remain unsupported. The catalog never suppresses unrelated
source declarations or cell-entry invariant diagnostics.

`restoreMissionTeamConstructorHistory(source, births, workLimit)` owns bounded
records. Each birth pins the source action, team, common-history ordinal, instance
ID, birth tick, prior-transfer revision and complete member sequence. IDs append
above every original actor and never reuse a previous ID. Type, initial owner,
health and movement derive from the genuine source catalog. Original actors,
navigation, blockers and source capabilities cannot be replaced through this API.
A structural history is not proof of a trigger invocation or historical occupancy.

The optional `constructors` argument to `compileMissionTeamOwnedBinding` selects
`webra2-ordinary-unit-team-ownership-1`. It requires the matching genuine empty
construction history in the base model. Omitting the option preserves the existing
fixed-actor binding and save identities. The common runtime then derives each
current model from the complete saved history before accepting its world save.
Every birth records the preceding ownership transfer revision; tick numbers alone
cannot distinguish source actions at the same boundary.

The coordinator's `WorldSimulation.migrateConstruction` accepts a genuine prior
simulation and a genuine extended model. It proves the exact original actor and
birth prefix, current tick/revision, complete new definitions and unchanged
capability objects. Queued commands cannot gain source or target authority over a
future ID. Candidate creation, population insertion and final core validation are
atomic. Failed work limits or collisions leave the previous simulation unchanged.
The resulting strict `webra2-world-9` save cannot be restored under an old model or
created directly from a nonempty birth history.

`appendWorldOwnership` interleaves registration at exact saved transfer boundaries.
Born actors begin their owner history at that boundary; pre-birth owner queries
reject. Historical transfers retain their original selection and counters. An
active team member cannot be transferred until its native team-update policy is
modeled. A released unit can transfer through the genuine current world; it does
not become a placed recruitment candidate or acquire inferred mission state.

New units occupy whole cells, including movement reservations. Original infantry
slot permissions and combat objects are preserved, but the new unit receives
neither a slot nor a combat actor definition. Selection includes pending-death
anchors and all current actors. The source combat adapter preserves the complete
original source prefix and remains conservative about newly inserted occupants.

Budgets reserve descriptor snapshots, derived models, ownership reconstruction,
core migration, roster migration and pending recomputation before publication.
Returned work is a deterministic resource policy rather than a timing claim.
Restoring a pending result can cost more than an ordinary settled step while
producing identical state and events. Permanent IDs, atomic bounded placement,
request ordering and one script update per tick remain explicit D03 policies.

The proof composes reviewed [reinforcement](team-spawning.md),
[constructor prerequisites](mission-team-cell-context.md),
[recruitment](team-recruitment.md) and [house population](mission-house-state.md).
The [paired additional tag audit](analysis/mission-team-constructors-native.json)
reproduces eight complete-instruction spans (2,464 bytes) and 26 native checks.
It follows Object tag initialization, TeamType tag selection and Team.AddMember's conditional replacement. A source team with no tag
leaves the new actor's null tag intact in this supported path. No executable is run,
and no binary listings or original mission payloads are published. The
[license notice](../packages/sim/MISSION_TEAM_CONSTRUCTOR_PROVENANCE.md) records
source and distribution obligations.

The original fixtures cover action7/80 movement, Flash/release and Sleep;
same-tick births and ownership revisions; retained combat/slots; actual pending-death
anchor reservation; queued future IDs; exact work limits; source substitution;
atomic active-capture refusal; later births after release/transfer; and settled,
pending and full replay. Seven common-runtime suites complement the constructor,
world migration and original ownership regressions. The composed public validation
and final independent review are recorded below.

The [private census](analysis/mission-team-constructors-census.json) records two fresh
438-file selections. Each profile retains all source declarations: RA2 has75 team
action occurrences with1 constructor occurrence supported; YR has104 with2 supported.
Each exercised path constructs one ordinary unit. RA2 retains811 original actors,
reaches812 and enters Sleep by200ticks. YR retains570 original actors, reaches571
and is still moving at128ticks. All settled boundary restores and every16th pending
restore match. No initial actor is removed or repositioned by this probe.

The independent Python oracle reparses source bytes and compares147,517 items over
five complete verified roots/eight source members. It checks origins/history, raw
action operands, TaskForce expansion/order, type guards, count classification,
constructor identities, initial actor conservation and born ownership/population.
Reviewed allocation visits, navigation and prior factory admission statuses are
explicit inputs, not independently rediscovered native behavior. The paired
additional tag ledger reproduces8 spans/2,464bytes/26 assertions.

Both single long replay requests exceed the existing aggregate16,777,216 work cap:
RA2 rejects with `checkpoint-work` and YR with `tick-work`. They do not pass the
long replay gate. Fresh genuine factories separately replay the initial request
boundary, the actual birth boundary and a resumed boundary after200/128ticks;
all six bounded cases match exact checkpoints. Maximum replay work among those
cases is7,808,901. The public original eight-tick paths also replay in full. A
future larger mission replay must address the aggregate resource policy explicitly;
this component does not bypass it.

Private reproducible scripts are `local/probe-constructor245-runtime.mjs`,
`local/add-construction245.mjs`, `local/oracle245.py`,
`local/probe-constructor245-replay.mjs` and `local/native245/ledger245.py` in the
constructor author worktree. Their source imports are relative to that checkout;
raw game paths are read-only absolute paths. The native script uses the retained
Capstone Python environment and writes only ignored local listings/metadata. Public
census and ledger files contain hashes/counts/addresses rather than source payloads.

The preceding6470 runtime checkpoint passed1,508 public +14 tool tests, types,
218docs/1,135links,810publication paths,M0 and79code/license outputs/193inputs.
Sixteen legacy scenarios/256ticks retain all608 prior identities exactly. The final
evidence checkpoint composes coordinator-authored lazy stationary/construction
receipts and adds the pending-death regression. Its complete check passes1,512
public +14 tool tests, types,218docs/1,136links,812publication paths,M0 and
79code/license outputs/193inputs. The receipt is an opaque core transition, not a
mission invocation.

No browser, spawned-combat, dynamic trigger attachment, general constructor or
full-campaign claim follows from these tests. Current stationary Guard witnesses
remain fixed-model capabilities until the separately coordinated explicit migration
policy preserves initial actors' invalidation history and excludes every born unit.
