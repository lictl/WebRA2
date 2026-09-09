# Opening campaign dependency evidence

Issue [#23](https://github.com/lictl/WebRA2/issues/23), under
[#18](https://github.com/lictl/WebRA2/issues/18). This slice compiles a bounded
structural graph for the proposed Allied openings `all01t.map` and `all01umd.map`.
It does not select an effective rules revision or establish a playable dependency
closure. The [generated metadata](campaign-graph.json) is reproducible from the
private Steam installation and the [earlier census](campaign-census.json).

## Observations

The verified reader checked **14 physical members / 3,449,092 bytes**, including
both identical RA2 opening copies, the YR opening, and all eleven definition
candidates. Root/member SHA-256, exact ranges and unchanged files were checked.
The two different `rulesmd.ini` candidates remain separate. Files were read only;
no game program ran and no original payload was written or uploaded.

| Candidate | Indexed nodes / edges | Reachable nodes | Placed objects | Teams / task forces / scripts | Trigger / event-row / action-row nodes |
| --- | --- | --- | --- | --- | --- |
| `all01t.map` | 3,006 / 2,931 | 1,010 | 249 | 49 / 29 / 38 | 130 / 130 / 130 |
| `all01umd.map` | 5,046 / 9,051 | 2,028 | 263 | 102 / 91 / 94 | 334 / 334 / 334 |

Reachability starts with every mission declaration and placement, including
definitions that native runtime may never activate. Definition candidates from
rules/AI/art are indexed but become reachable only through supported reference
edges. These counts are a conservative candidate inventory, not required gameplay
counts. Multiple rules definitions increase counts; they are not merged or ranked.

All 49 RA2 opening team owner fields and 130 trigger owner fields match declared
country identifiers rather than literal house identifiers. YR has 3 and 17 such
fields respectively without a literal house match. Country references are retained
as selector candidates; the graph does not fabricate missing houses or bind those
selectors to runtime houses. When both namespaces match, both candidates survive.
Editor source supports country selection, but its UI is not the native resolution
algorithm. Selector sentinels and bindings remain explicit unsupported capabilities.

There is one reachable unresolved placement-type reference in the RA2 candidate
subset and none in YR. Two RA2 / four YR explicit image references are unresolved
outside the currently reachable subset. Source indices and lines are included in
`unresolvedReferenceLocations`; a missing reference means no supplied candidate
definition matched, not that the installation is corrupt. One/three cyclic
components are found across the indexed RA2/YR graphs. Cycles can represent valid
alliances or linked definitions, so they are reported without a runtime-error claim.

## Pure graph boundary

[campaign-graph.ts](../../packages/content/src/campaign-graph.ts) accepts an explicit
profile, exactly one mission document, and caller-selected rules/AI/art candidates.
It has no filesystem, DOM, clock, network or RNG dependency. The Node-only
[CLI](../../tools/analysis/campaign-graph.ts) uses the shared
[verified source reader](../../tools/analysis/verified-source.ts); the pure API
validates identity shape but cannot verify that a supplied document matches a hash.

Nodes have opaque integer IDs, kind and source/line location. Edges have source,
target, schema relation and reference location. Original symbol names are used
only inside the resolver and are absent from its result. The result includes full
adjacency, reachable IDs, strongly connected components and structured diagnostics.
The public report projects this to counts, source identities, schema field names,
opcode IDs and selected unresolved locations. It excludes original rows, display
names, strings, cell coordinates, rule values and cinematic identifiers.

Source identity is `(rootFile, rootSha256, absoluteOffset, size, sha256)`. Duplicate
physical inputs or conflicting identities fail closed. Exact copies of the opening
map are all verified by the CLI and retained in `equivalentPhysicalSources`; one
copy supplies the same parsed graph. Different hashes of a definition remain
different nodes. Duplicate INI keys/sections and multiple matching nodes produce
diagnostics; there is no first/last-wins policy. ASCII case folding is a research
lookup policy, not proof of native locale-dependent comparison rules.

Bounds are 32 documents, 400,000 section/entry records, 64 Mi UTF-16 code units,
30,000 nodes, 150,000 edges, 50,000 diagnostics and 256 tokens per reference row.
Callers may lower these limits. The CLI additionally caps reads at 128 members /
64 MiB with the reader's default 16 MiB per member. Limits fail closed. Iterative
graph traversal handles deep graphs without recursive stack overflow. The existing
INI/opcode scanners retain their own byte/row limits and known parsing restrictions.

## Source evidence and provenance

New TypeScript, tests and CLI are GPL-3.0-or-later and compose the existing GPL
content scanners. Field interpretation was written from the following pinned
primary source references in EA's released FinalAlert editor, commit
`6abf0f557469baea73079c6bf6550709e2e3584e`, plus local structural observations.
No EA implementation body or retail row is copied into these files. See existing
[component provenance](../../packages/content/PROVENANCE.md) and
[distribution licensing](../licensing.md). These are storage/editor observations;
behavior confidence remains UNKNOWN until native comparisons verify it.

| Supported structural relation | Pinned primary evidence |
| --- | --- |
| Team → owner / script / task force / tag | [TeamTypes.cpp, 504–537](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TeamTypes.cpp#L504) |
| Task force numbered row → object type at token 1 | [TaskForce.cpp, 278–279](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TaskForce.cpp#L278) |
| House → country / allies; custom country → parent | [Houses.cpp, 232–243](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Houses.cpp#L232), [394–404](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Houses.cpp#L394) |
| Country/house selector distinction | [functions.cpp, 1263–1355](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/functions.cpp#L1263), [TeamTypes.cpp, 443](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TeamTypes.cpp#L443) |
| Trigger → owner / attached trigger; tag → trigger | [TriggerOptionsDlg.cpp, 95–125](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerOptionsDlg.cpp#L95) |
| Infantry / structure / unit / aircraft → owner, type, tag | [MapData.cpp, 1533–1541](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L1533), [2211–2217](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L2211), [2658–2689](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L2658) |
| AI trigger → primary/secondary team, owner selector, condition-type field | [MapData.cpp, 415–432](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L415) |
| Explicit object `Image` → art section candidate | [MapData.cpp, 3646–3654](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L3646) |
| Basic Intro/Brief/Win/Lose/Action/PostScore/PreMapSelect → cinematic identifier | [SingleplayerSettings.cpp, 95–126](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/SingleplayerSettings.cpp#L95) |

Trigger→event/action edges use matching row identifiers observed in the census;
the existing [opcode evidence](campaign-census.md) covers storage framing. Script,
event and action IDs are capability requirements with unknown runtime meaning.
AI condition-type references are conservative literal candidates; no condition
discriminator or activation semantics is interpreted. Placement parsing follows the
reference prefix only; it is not a production placement decoder.

## Campaign membership and progression

[campaign-tables.ts](../../packages/content/src/campaign-tables.ts) records Battles
membership locations, Scenario filename references and mission-table filename
sections. It matches their hashes against the bounded census candidate inventory.
Only opening map payloads are reverified here; other candidate hashes are inherited
metadata, not freshly verified map reads. Table-reference completeness is distinct
from native progression and mission dependency completeness.

| Table | References | Bounded candidate result |
| --- | --- | --- |
| RA2 battle | 28 | 24 profile candidates; four demo/training filenames have unclassified profiles |
| YR battle | 14 | All match candidates; one filename has two unselected hashes |
| RA2 mission | 101 filename sections | 24 profile matches, two unclassified matches, 75 absent from this candidate subset |
| YR mission | 24 filename sections | 14 filename matches including one variant; ten absent from this candidate subset |

Unclassified demo/training records are preserved separately from missing records.
Unmatched mission-table entries may be legacy/unused names or omissions of this
bounded inventory; they are not a list of required missing files. No chronology is
inferred from file names, table order, UI captions or matching keys. Both opening
maps contain legacy Basic continuation fields. These receive a diagnostic and no
progression edge. `nativeProgression` remains `unverified` and `progressionEdges`
stays empty. Effective progression still belongs to [#18](https://github.com/lictl/WebRA2/issues/18).

## Validation and reproduction

Public tests are original synthetic INI/files only. They cover references,
source/profile identity, duplicates/variants, 2,200-node cyclic traversal, limits,
malformed framing, hostile prototype-shaped names, privacy projection, explicit
country selectors, table membership, unclassified scenarios, missing candidates,
verified physical copies, changed source hashes and deterministic repeated reports.

From repository root using Node 24.20.0:

```sh
npm ci
npm run check
node --import tsx tools/analysis/campaign-graph.ts /absolute/path/to/game docs/analysis/campaign-census.json > /tmp/campaign-graph.json
cmp docs/analysis/campaign-graph.json /tmp/campaign-graph.json
```

The last two commands are a private-corpus metadata gate. Missing retail assets are
a skipped private gate, not a campaign test pass. The committed snapshot pins its
input-manifest SHA-256. The graph and report functions return only in-memory data;
normal CLI stdout is the reviewed metadata projection.

Remaining closure edges and next investigations are recorded in
[mission dependencies](mission-dependencies.md). No browser behavior, save/replay,
media playback, mission interpreter or original-game comparison is implemented by
this slice.
