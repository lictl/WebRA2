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

The composed checkpoint passes 1,508 public tests plus14 tool tests, types,
218 documents/1,135 links,810 publication paths and M0 metadata; the product build
contains79 code/license outputs from193 approved inputs. These are public original
fixtures, not retail execution. Six new common-runtime suites cover action7/80 movement, Flash/release and Sleep; same-tick births and ownership
revisions; preserved combat/slots; queued future IDs; exact work limits; source
substitution; atomic active-capture refusal; and settled/pending save/replay.
The eight-range paired tag ledger reproduces independently from the pinned
images. Fresh private opening source/runtime and raw-oracle results remain a
separate evidence update before final review. A full private RA2 run already
reaches200ticks with one constructed unit and held Sleep; its single long replay
exceeds the existing aggregate work cap and is recorded as rejected, not passing. No browser, spawned-combat, dynamic trigger attachment, general constructor
or full-campaign claim follows from these tests.
