# Source-bound mission cue references

[Issue188](https://github.com/lictl/WebRA2/issues/188) adds a bounded reference
catalog and an explicit caller-driven cursor. It covers every selected occurrence
of movie10, text11, sound19, music20, speech21, camera48 and radar55 in both opening
missions. This is not playback, source trigger dispatch, mission completion or
whole-campaign admission. Existing VM/world/browser APIs are unchanged.

`compileMissionCues` accepts an explicit profile, one mission path/source/byte
snapshot and either one already selected profile CSF or null. It detaches data
through own descriptors, checks fixed source roles and path forms, owns ordinary
nonshared byte buffers, rehashes every byte and recompiles ScenarioLogic and
ScenarioObjects. Only `ra2.csf` for RA2 and `ra2md.csf` for YR are accepted. It does
not select archives or layer precedence; the upstream verified catalog/installation
profile remains responsible for choosing those source identities. Hash equality
proves correspondence to the supplied expected identity, not publisher provenance.

The genuine frozen catalog retains each selected instruction identity, source row
ordinal, typed payload or explicit unsupported reasons, profile/source pins and
coverage. No private buffer or mutable Map escapes. Its fingerprint excludes the
source's session handle but includes profile, logical paths, selected bytes and
all interpreted references. Missing/ambiguous CSF labels never become placeholder
text. Selected unknown resource families are not silently removed.

## Reference payloads and limits

| Family | Catalog result | Remaining consumer requirements |
| --- | --- | --- |
| Text11, mode4 | Owned source label and resolved localized text; explicit empty-text sentinel | Native delay, dynamic color, layout and display lifetime |
| Camera48, mode0 | Source-loaded waypoint number/cell and uninterpreted native scalar | Current map/bridge height, viewport coordinate conversion and timing |
| Radar55, mode0 | Source-loaded waypoint cell and bounded native type ID | Native event coalescing, style, duration and rendering/control effects |
| Movie10, mode0 | Unsupported, retaining integer operand | Loaded movie-index table, verified member binding, decoder and lifecycle |
| Sound19, mode7 | Unsupported, retaining named operand | Loaded sound declaration/definition and sample/resource closure |
| Music20, mode8 | Unsupported, retaining named operand | Loaded theme definition and verified member closure |
| Speech21, mode6 | Unsupported, retaining named operand | Loaded EVA definition, side selector and verified speech resource closure |

A resolved reference is deliberately named `resolved-reference`, not executable.
All catalogs retain `playbackReady: false`, `nativeExecutionVerified: false` and
`canStartCampaign: false`. The media gaps remain related to
[media12](https://github.com/lictl/WebRA2/issues/12),
[profile/resource18](https://github.com/lictl/WebRA2/issues/18) and
[mission/gameplay132](https://github.com/lictl/WebRA2/issues/132).

The default caps are32MiB aggregate source bytes,16MiB per member,8192 selected
instructions,4096 UTF-16 units per text cue,1,048,576 aggregate resolved text units
and16MiB serialized catalog. Existing bounded parser limits also apply to all
retained input rows. Only lower limits are accepted. Repeated exact/case-aliased
consumed headers, unsupported INI encodings and conflicting source rows reject.
Integer suffix/overflow and unproved named aliases do not get coerced. Nonzero
reserved fields remain unsupported. Source text labels follow the native31-byte
storage rule; missing references and invalid controls remain visible per occurrence.

Paired native waypoint loading is narrower in RA2: indices0 through100 versus
YR0 through701. Alpha operands can express0 through701 in either executable,
so the compiler separately checks actual profile load membership. Zero source
coordinates, absent/default fallback, noncanonical numeric keys and positions
outside the bounded source diamond are not resolved. This does not change the
previous team components or claim later mutable Scenario waypoint parity.

## Explicit caller order and restore

The standalone simulation module exports `createMissionCueState`,
`restoreMissionCueState` and `appendMissionCues`. A genuine catalog and genuine
cursor are required; restoring a serialized cursor validates its exact schema and
catalog fingerprint. This is structural cursor validation, not proof that a caller
historically executed source triggers. Callers supply a nondecreasing tick and an
ordered list of instruction/instance IDs. Repeated invocations remain repeated;
there is no invented native deduplication. The catalog supplies the payload and
mission identity rather than accepting them in the command.

Every emitted event has `playbackAuthorized: false`, and the result has
`sourceDispatchVerified: false`. Arbitrary public invocations must never be wired
directly to a browser media consumer. The coordinator owns the later authoritative
mission/program/world/instruction join and dispatch.

At most1024 invocations and1,048,576 repeated text units can occur in a call.
The cursor caps total sequences at1,000,000 and ticks at1,000,000,000. Preflight
checks the entire batch before publishing events or a new cursor; a late unknown
or unsupported instruction, sparse/oversized array, decreasing tick or exhausted
budget leaves the old state unchanged. No queue, wall clock, RNG or I/O is hidden
in the cursor. JSON save/restore yields the same subsequent caller-driven events.

## Evidence

The [native ledger](analysis/mission-cues-native.json) contains67 inspected
code/data ranges totaling4,849 bytes from the pinned retail images. Every code
span ends at a complete decoded instruction boundary. This is static inspection;
no game executable ran. The [provenance](../packages/content/MISSION_CUES_PROVENANCE.md)
identifies primary references and the precise unresolved consumer boundaries.
Native movie10's YR wrapper additionally pauses/resumes host components around
playback; the catalog does not flatten this into an innocuous sound event.

The full check passes1,037 public tests, types,160 documents/800 local links,
publication/M0 gates and the existing65-output build. Eleven new original tests
cover both profiles, label storage, missing/ambiguous/empty
CSF, source role/hash/identity forgeries, immutable descriptor snapshots, profile
waypoint boundaries, unsupported media operands, lower limits, atomic ordering,
duplicate invocations, restore and repeated-text exhaustion. They are synthetic
fixtures and do not prove native playback.

Fresh private reads rehash four roots and four selected map/CSF members. A separate
Python oracle independently reparses action rows, decodes CSF complement strings
and projects native-loaded waypoint references. It compares21,426 framing/source/
reference assertions across all188 selected occurrences;106 references resolve.

| Profile | Text resolved | Camera resolved | Radar resolved | Selected unsupported media |
| --- | --- | --- | --- | --- |
| RA2 | 33/33 | 2/2 | 40/40 | 57 |
| YR | 11/11 | 9/9 | 11/11 | 25 |

The [metadata census](analysis/mission-cues-census.json) records hashes, counts and
reasons only. Runtime text, source rows, identifiers, coordinates and native
listings remain in ignored `local/`. This is a private source preparation and
caller-cursor replay, not a fresh full-folder import, original-game observation
or browser test. Full mission preflight remains unchanged and unsupported.

Private reproduction in the issue188 worktree:
`node --import tsx local/probe188.mjs`, `python3 local/oracle188.py`, and the pinned
Capstone5.0.6 Python running `local/native188/ledger188.py`. The source reader uses
previously reviewed chooser pins, then rehashes the actual current roots/ranges.
Independent review and appropriate shared-notice integration precede merge.
