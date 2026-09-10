# Initial source waypoint execution

[Issue 193](https://github.com/lictl/WebRA2/issues/193) corrects a source admission gap:
RA2's alphabetic decoder can describe waypoint 101, but the inspected initial map
reader loads only keys 0 through 100. YR loads 0 through 701. Previously, a decoded
row could authorize script movement, reinforcement or recruitment even if that
profile never loaded its source index. Missing/zero values must not become a
synthetic destination.

`compileInitialWaypointSource({profile, source, bytes}, lowerLimits?)` owns and
SHA-256 verifies the mission bytes, then uses the bounded existing source/geometry
parsers. Its immutable result retains the broad waypoint metadata, origins, named
policy, maximum loaded index, reasons and digest. `resolveInitialWaypoint` accepts
only the genuine factory result. It requires an initially loaded index, a canonical
numeric key in exact `Waypoints`, a nonzero coordinate and the existing supported
map diamond. Duplicate keys/numeric aliases reject in the existing parser; repeated
exact sections and normalized header suffixes cannot grant execution. Retained
wrong-case/noncanonical rows remain metadata with unsupported status.
Only the byte-preserving ASCII-compatible source mode grants initial execution.
The general parsers still retain decoded UTF-16LE/UTF-8 BOM metadata, but these
encodings produce `source-encoding` diagnostics and cannot supply execution cells.

This helper does not create Scenario state or expose a dynamic fallback. A future
dynamic waypoint writer or imported native Scenario state needs separate
provenance and saved authority. A missing initial row is not filled from a team's
current position, an arbitrary caller coordinate or an adjacent cell.

## Consumers and identity

| Consumer | Execution check | Preserved boundary |
| --- | --- | --- |
| `compileTeamProgram` | Every script-3 line resolves through the authenticated initial table. | Whole scripts remain gated, including lines after persistent Sleep. Broad operand typing still describes 0–701 in both profiles. |
| `compileTeamActivationSource` | Action 7 resolves TeamType Waypoint; action 80 resolves its explicit encoded operand. | Unsupported plans retain source metadata but cannot become a spawn catalog. Action 4 still follows the separate recruitment compiler. |
| `compileTeamRecruitmentCatalog` | Requires an authenticated TeamType anchor, including when its script only Flashes or Sleeps. | No fallback to a current focus or actor position; existing availability, claim and source gates remain. |
| Spawn insertion/context and team execution | Consume the upstream genuine program/activation/catalog. | They do not reread an unchecked waypoint or accept a dynamic caller override. |
| ScenarioObjects, TeamDefinitions and alpha decoding | Unchanged metadata compilers. | Describing an operand or row is not permission to execute it. |
| Transport origin and other unsupported script contexts | Remain excluded by existing complete-team policy. | The separate native transport getter is recorded, not enabled. |
| Mission presentation cues | Independently addressed by [PR192](https://github.com/lictl/WebRA2/pull/192). | Its policy and source implementation are not changed here. |

All three changed compiler outputs include `initialWaypointsSha256`; the digest
includes `webra2-initial-source-waypoints-1`. Program/roster, spawn and recruitment
compound identities consequently change. Older compound saves/replays must not be
reinterpreted under these new gates. The base world model and standalone world
checkpoint schema are unchanged. No shared wire contract or application file changes.

Native evidence proves the source-reader bounds and consumer paths, not complete
native INI semantics, general map-cell validity, dynamic waypoint lifecycle or
native team formation. The supported unsigned coordinate/diamond restriction,
whole-cell movement and atomic recruitment/spawn policies remain explicit WebRA2
choices under D03. Native recruitment can use an existing focus when its TeamType
waypoint is absent; that context is outside the current bounded source recruitment.

## Bounds and verification

The helper accepts at most 16 MiB of owned mission bytes and 4,096 waypoint rows,
with 262,144 source-join work units and 16 MiB of canonical serialized output.
Limits may only be lowered. The reused INI/object parsers retain their separate
source row, section, token, character and diagnostic limits; the join work counter
is not a bound on all parser work or total RSS. Wrong profile/hash, forged factory
results, accessors, resizable/shared buffers and invalid counters cannot grant a
source location. Failure publishes no partial authority.
Input, source and limit fields are captured once from data-property descriptors;
later Proxy `get` traps cannot substitute a source pin or enlarge a validated cap.
Byte ownership uses intrinsic typed-array/ArrayBuffer accessors and rejects typed-array
proxies rather than reading replaceable buffer/length properties.

Nine original tests include all 702 numeric keys in each profile, explicit
0/100/101/701 execution boundaries, zero/missing values, aliases, repeated/exact-case
headers, malformed identity/shape/resource limits, complete-script rejection and
all three genuine adapters. Both profiles cover switching Proxy identities/limits,
intrinsic buffer ownership and retained BOM-decoded metadata without execution.
They preserve the old metadata result while rejecting
unsafe execution. Existing team/spawn/recruitment save/replay tests also pass.

A separate private comparison freshly prepares the source-selected Allied opening
in each profile, rehashes source roots/members and compares the previous admission
gates with current results. The
[metadata-only census](analysis/initial-waypoints-census.json) records exact source,
policy and evidence pins:

| Private opening result | RA2 | YR |
| --- | --- | --- |
| Source waypoint rows, all supported | 101 | 276 |
| Unique referenced script-3 steps, all source-resolved | 32 | 178 |
| Opening-declared team templates | 49 | 102 |
| Admitted complete templates | 6 | 8 |
| Supported action-7/80 source plans | 46 | 83 |
| Compiled spawn catalogs | 1 | 8 |
| Compiled recruitment catalogs / supported explicit anchors | 13 / 11 | 1 / 1 |
| Previously admitted templates, source actions or anchors newly blocked | 0 | 0 |

These are source/catalog counts, not successful recruitment availability,
reinforcement execution, original mission activation or campaign completion.
Other source constraints still reject many plans. The exact initial-table digest
changes derived policy identity even when admitted coverage is unchanged.

The independent Python oracle reads the pinned archive ranges directly and uses
no WebRA2 imports. It compares complete waypoint rows/origins/coordinates/hashes,
script and TeamType source operands, action references and recruitment anchors;
it also rereads the native reader loop and script dispatch. It passes 13,279
comparisons across five archive roots and 641 scoped references. Native review
reproduces 27 ranges/1,742 bytes. Private scripts and raw outputs remain ignored:

```sh
node --import tsx local/probe193.mjs
WAYPOINT_PYTHON=/Users/lucus/Projects/WebRA2/local/worktrees/theater-tiles/local/venv/bin/python
"$WAYPOINT_PYTHON" local/native193/ledger.py
"$WAYPOINT_PYTHON" local/native193/oracle.py
```

`WAYPOINT_PYTHON` points to the configured private Capstone 5.0.6 Python runtime;
the scripts and upstream local source files are not required by public CI. The
probe's copied baseline adapters explicitly target reviewed main
`44bbe8e10a1e786f22b6f6f66416f590b24836a0`. Recruitment's comparison uses current
genuine source/program inputs with the prior anchor logic, so it is a coverage
comparison and not a claim of byte-identical old compound hashes.

See the [component provenance](../packages/content/INITIAL_WAYPOINTS_PROVENANCE.md)
for paired addresses, exact range ledger, inherited licenses and scope.
