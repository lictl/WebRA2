# Fresh campaign team allocation source

[Issue213](https://github.com/lictl/WebRA2/issues/213) provides a bounded source
model for retained TeamType, ScriptType and TaskForce names and initial allocation
roots. The new component supplements
[the unchanged action-source catalog](mission-team-action-source.md).
It does not remove diagnostics from that catalog, schedule AI, construct teams,
execute script18, or authorize a mission.

`compileMissionTeamAllocationSource({source, rules, ai, mission,
initialization:'fresh-campaign'}, lowerLimits?)` requires a genuine action-source
catalog. `mission` contains the same source identity and owned bytes; the factory
copies and rehashes those bytes and reconstructs the map layer before accepting
its supplied table. The rules/AI tables are detached descriptor snapshots whose
profile/layer pins must match the genuine typed definitions. Each native Name
origin must additionally match the genuine retained definition history.

This is explicitly `owned-mission-and-pinned-upstream-tables` authentication.
Matching claimed rules/AI pins alone is not proof of their physical bytes:
`upstreamRulesAIBytesRequired:true` means a verified import session still must
supply those tables. Their complete contents have separate result hashes. The
factory brand proves this compilation and its exact source join, not native
runtime or byte authenticity beyond that boundary. No accessor returns an
arbitrary model, mutable index, or execution capability.
`missionTeamAllocationSourceActions(result)` returns the original genuine catalog;
JSON copies do not pass `isMissionTeamAllocationSource`.

## Names and source order

The [paired ledger](analysis/mission-team-allocation-native.json) establishes:

- A native Name starts as its first stored ID. Each actual definition load uses
  the exact stored ID section and current Name as its default. The component
  preserves every load, its raw origin, before/after values and retained states.
  It admits nonempty ASCII names of at most48 characters. Empty, non-ASCII,
  oversized or comment-dependent values remain unsupported; it does not invent
  truncation, locale or empty-record semantics. An uncertain earlier history is
  still retained after a later valid override.
- TeamType lookup compares **each allocation's ID, then its Name**, before moving
  to the next allocation. An earlier Name alias can beat a later exact ID. All
  matches and the first match are retained; this is distinct from generic
  ID-only FindOrAllocate. AI operands are admitted only within the observed
 23-character terminated input; broader event reference metadata is separate.
- Both profiles load global then mission teams, scripts and task forces before
  global then mission AI trigger rows. AI references therefore see final team
  Names, including mission overrides to global definitions. All Name histories
  remain available; no retrospective global-source-only lookup is used.

The native source-stage intervals are RA2 `65F63B–65F6A9` and YR
`68797A–6879E8`; exact ID/Name lookup is RA2 `6BF260–6BF2C1` and YR
`6F0FC0–6F1021`. The native pointer consumers include event discriminator1 and
both AI team fields. Name also reaches checksum and diagnostic code, so the
component does not classify it as inert or claim RNG/checksum neutrality.

## Allocation proof states

Every original declaration and diagnostic remains in the output. A separate,
source-indexed `diagnosticResolutions` array resolves only `unhandled-field:Name`
when every exact Name history is supported. Other metadata, unknown fields,
unrepresented programs and automatic behavior remain required. The previous
catalog's identities, diagnostics and `wholeSourceReady` are untouched.

The result records every explicit4/7/80 action; every global/mission AI load and
mission enable origin; current script18 initial-array candidates; positive or
unknown Autocreate/Prebuild/Recruiter templates; and named unmodeled native
allocation paths. Duplicate exact consumed sections/keys and same-stage aliases
reject deterministically. AI rows require18 nonempty comma fields within the
native511-character payload limit; malformed/reloaded-case-ambiguous rows remain
unsupported with their tokens. Unknown condition operands are retained and their
scheduler is not implemented. No declaration is dropped for lacking an incoming
explicit action.

Fresh AI objects start disabled. Global list loading enables them; mission enable
rows can change that state. The initial native ConditionMet gates can exclude an
AI row for disabled state, explicit global suppression or the selected campaign
difficulty. **IsForSkirmish does not exclude a row in campaign mode.** Missing
Basic suppression is retained as unknown rather than assigned a guessed default.
`proven-excluded-initial` is scoped to these initial conditions; it never proves
lifetime inactivity. House AI activation, future enable/disable paths, source
conditions, weighted Scenario RNG selection and native scheduling remain required.

Default house availability is recorded independently. Native House AI supplies
its current House to CreateTeam before the template Owner fallback, so a missing
default house cannot remove an AI allocation dependency. Script18 similarly
passes the current team's House while selecting an initial-array candidate; no
replacement, membership transfer or execution semantics are implemented here.
Dynamic/external allocations can require further source context. Root edges and
per-declaration reachability are evidence for a later compiler, not dispatch
permission. `nativeAllocationComplete`, `runtimeAuthority`,
`nativeExecutionVerified` and `canStartCampaign` remain false.

Limits are lowerable only:16MiB owned mission,64 aggregate stages,262,144 source
occurrences,32,768 aggregate typed and AI declarations,131,072 roots
and references,262,144 history/edge records,524,288 comma tokens,131,072 diagnostics,
4,194,304 work units,2,000,000 input traversal nodes,64Mi decoded characters and
64MiB canonical output. Budgets cover shadowed source, lookups and candidate
expansion. Each of the three nested exact INI views reserves one eighth of the
configured work cap before any view runs; unused view allowance is not refunded.
The compiler's own traversal and joins share the remaining five eighths plus
integer-division remainder. Thus independently counted nested work cannot reuse
the outer budget. Caller getters are not invoked; typed-array ownership uses intrinsic
accessors. No filesystem, clock, network, DOM or unseeded RNG enters the module.

## Validation and observed corpus

Ten original test cases exercise both profiles, default/retained/overridden
Names, alias precedence and source timing, fresh and overridden AI enable state,
difficulty/skirmish distinctions, missing houses, automatic and script18 roots,
whole-history unknowns, source mutations, descriptor ownership, factory brands,
canonical repeatability and lowerable aggregate limits. Run:

```sh
npm ci
node --import tsx --test tests/sim/mission-team-allocation-source.test.ts
npm run check
```

The private fresh438-file source preparation retains352/670 RA2/YR names,
113/165 AI trigger records and268/435 allocation roots. All observed Names are in
the admitted ASCII subset. At the selected middle difficulty111/68 AI records
fail an initial condition;2/97 remain conditional. All103/163 missing default
houses remain recorded. These are not counts of active teams or future AI
allocations. The new source-field resolution records352/670 Name diagnostics;
the unchanged prior action-source catalogs still have1,575/3,096 required
source diagnostics and neither has whole-source readiness.

A separate Python implementation reconstructs raw registry allocation order,
Name loads, per-entry ID/Name matching, AI rows, enable histories and initial
campaign gates from five rehashed archive roots/eight member reads. It passes
49,788 assertions, including exact origin and result-hash comparisons. The prior
independent raw action-source oracle still passes22,436 assertions. Existing
house/program/world implementations are reused inputs, not independently
reconstructed by these source checks. The native verifier rehashes both entire
executables and checks44 ranges/12,515 bytes, including38 complete instruction
spans, pointer targets and literals. The [census](analysis/mission-team-allocation-census.json)
contains only aggregate metadata and hashes.

Private reproduction is in ignored `local/worktrees/team-allocation-source`:

```sh
node --import tsx local/probe213.mjs
python3 local/oracle213.py
python3 local/oracle-source210.py
../theater-tiles/local/venv/bin/python local/native213/ledger213.py
```

For detached review, copy the scripts to the same ignored relative local paths;
the probe's relative imports must point to the review checkout. The native ledger
writer targets the public metadata file, so redirect it into reviewer local
before independent reproduction, then compare the complete generated JSON.
Raw inputs, expanded tables, native listings and oracle projections stay private.
The [GPL provenance notice](../packages/sim/MISSION_TEAM_ALLOCATION_PROVENANCE.md)
pins the primary references and distribution obligations.

The coordinator must separately agree and review any optional use of this proof
by the existing source catalog/VM. No in-place source policy change, diagnostic
reduction-as-playability claim, campaign inactivity assumption or broad AI
scheduler is included in this slice.
