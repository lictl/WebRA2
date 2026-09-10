# Source mission team actions

[Issue210](https://github.com/lictl/WebRA2/issues/210) connects mission actions4/7/80
to a shared team/world transaction. This component authenticates its source
catalog. It does not dispatch an action, advance a world, create an actor, or grant
whole-mission execution permission. The existing mission VM and family schedulers
remain separate until the coordinator integrates them.

`compileMissionTeamActionSource({bindings, activation, programs, spawnCatalogs,
recruitmentCatalogs}, lowerLimits?)` accepts genuine `MissionBindingCatalog`,
`TeamActivationSource`, complete `TeamProgram` objects and family catalogs. The
binding accessor supplies its owned `ScenarioLogic` and base `WorldContent`.
Profile, mission/source IDs, rules-layer metadata, entity/team fingerprints,
initial-waypoint identity, complete base-world/model hashes and family action
identities must agree. A program or catalog copied from JSON has no authority.
Different genuine source worlds cannot be joined by matching only a mission hash.

The immutable result retains every original action4/7/80 occurrence, including
unsupported ones. Each row has `instructionId`, `triggerId`, source `rowId`,
ordinal, opcode, all seven normalized compiler operands, all eight raw tokens,
the original activation plan and its reasons, team/branch, and sorted catalog
candidates. A unique candidate supplies `programSha256` and `catalogSha256`.
Multiple matching catalogs remain visible as `ambiguous-family-catalog`; the
factory selects no winner. Repeated occurrences have separate instruction IDs.
Repeated execution of one occurrence still needs the VM's ordered effect identity.

`isMissionTeamActionSource` and `missionTeamActionSourceContext` expose a same-realm
brand and frozen genuine bindings/activation/definitions/world/logic/program and
family-catalog references. Caller input arrays are descriptor snapshots. Mutating
them afterward cannot alter the catalog or context. Duplicate program/catalog
hashes reject; identical shared templates may occur in distinct genuine programs,
but conflicting template content rejects. The factory does not manufacture union
programs or bypass the existing family selection rules.

`declarations.teams`, `.scripts` and `.taskForces` retain every typed global and
mission definition, including load histories, and each exact mission declaration
with all original fields and script rows. Required diagnostics cover unrepresented
definitions, unknown fields, unsupported values and unmodeled
Autocreate/Prebuild/Recruiter behavior. A selected program does not prove those
automatic behaviors inert. Unknown instructions after persistent Sleep or a jump
still block complete program preparation. Orphan sections and all binding, logic
and typed-source diagnostics remain visible.

Two bounded resolutions are explicit in `diagnosticResolutions`, indexed into the
unchanged `sourceDiagnostics.definitions` array:

- `complete-program-script` resolves an old `unsupported-script-operand` warning
  only when a genuine complete program covers the exact effective script and the
  warning's source origin matches an effective row. A warning from an earlier,
  overwritten row remains required. Unrelated warnings are never resolved.
- `literal-complete-declarations` resolves `external-allocation-paths-unmodeled`
  only when every declaration is covered, every action is supported with a literal
  nonnull team, references are resolved, no late country allocation is present,
  and automatic/unknown declaration behavior is absent. This bounded literal-name
  scope still reports `nativeAllocationComplete:false`.

`allActionsSupported`, `declarationsComplete` and `wholeSourceReady` are distinct.
The last additionally requires no required diagnostics. It is a source condition,
not runtime authority: `runtimeAuthority`, `nativeExecutionVerified` and
`canStartCampaign` remain false. The coordinator must compare its exact logic,
bindings and complete declaration arrays to this source before changing any VM
blanket rejection. Current actor capabilities, combat/infantry adapters, dynamic
membership, shared world tick, retries, execution receipts and saves/replay remain
downstream requirements. Unavailable recruitment is not replacement spawning.

Limits are lowerable only:256 programs,512 aggregate family catalogs,8,192
actions,32,768 declarations,131,072 loaded script rows,131,072 required diagnostics,
4,194,304 work units,2,000,000 metadata traversal nodes,32Mi decoded characters and
32MiB canonical serialized output. Dense own-index arrays, value descriptors,
source factory brands and aggregate counts are checked before publication.
Returned hashes include the chosen source/catalog metadata and program policies;
they do not authenticate arbitrary caller state or grant playback/dispatch access.

## Validation

Ten original test cases cover both profiles, exact4/7/80 operands and context,
missing/ambiguous catalogs, complete script/declaration coverage, automatic fields,
source-indexed diagnostic resolutions, earlier overwritten warnings, static
recruitment failure versus shortage, source impersonation, descriptor ownership,
canonical input ordering and lowered aggregate limits. Run:

```sh
npm ci
node --import tsx --test tests/sim/mission-team-action-source.test.ts
npm run check
```

The private fresh438-file selected-installation probe prepares both original
opening maps through the verified catalog, terrain/entity/world factories and
existing team compilers. It retains **75/104** RA2/YR actions and finds **12/9**
supported occurrences:11 recruitment+1 reinforcement for RA2,1+8 for YR. It uses
6/8 complete programs,1/8 spawn catalogs and13/1 recruitment catalogs. Two RA2
recruitment catalogs retain unsupported anchors. The source result preserves
152/265 team,90/182 script and110/223 TaskForce definitions. All declaration
closures remain unsupported; even represented retail definitions retain unhandled
Name fields whose native inertness is not established here. Required diagnostics
number **1,575/3,096**. Neither opening has `wholeSourceReady`.

A separate Python parser rehashes five complete source roots and eight selected
INI members, then independently checks raw action frames, global/mission registry
declarations, mission fields, retained warning/resolution origins and canonical
source hashes: **22,436 assertions**. It reuses the already reviewed typed-team and
world projections as inputs; it does not independently reconstruct those engines.
The [metadata census](analysis/mission-team-action-source-census.json) pins the
results and reused native-ledger hashes. All raw INIs, identities, source rows,
scripts and detailed projections remain in ignored `local/`.

Private reproduction in the author worktree `local/worktrees/team-action-source`:

```sh
node --import tsx local/probe210.mjs
python3 local/oracle210.py
../theater-tiles/local/venv/bin/python local/native210.py
```

For an isolated reviewer checkout, copy these three private scripts into its
ignored `local/`; relative TypeScript imports exercise the review revision. The
native script only reads existing public ledgers and writes an ignored result.
These checks establish source joins and selected prior evidence, not original
mission execution, successful recruitment, rendering or browser acceptance.
The [component notice](../packages/sim/MISSION_TEAM_ACTION_PROVENANCE.md) records
the exact reused evidence and GPL distribution obligations.
