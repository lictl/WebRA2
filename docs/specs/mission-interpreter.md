# Mission interpreter evidence and unresolved semantics

Revision `m0-specs-1`; issue [#6](https://github.com/lictl/WebRA2/issues/6).
This specifies representation and experiments. It implements no original opcode and
does not infer runtime behavior from editor UI labels.

## Pinned primary source observations

The EA mission-editor repository was inspected at commit
`6abf0f557469baea73079c6bf6550709e2e3584e`. It is the editor, not the game simulation.
The [repository description and license](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/README.md)
identify GPL-3.0 source with separately licensed third-party material. This slice
records factual observations and links; it copies no implementation code, tables or
retail mission data. No runtime dependency or distribution-license change is made.

| Evidence ID | Observed editor behavior | Consequence for the parser; remaining limit |
| --- | --- | --- |
| `FMT-EVENT-FRAMING-001` | [GetEventParamStart, lines 78–99](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerEventsDlg.cpp#L78-L99) steps through counted event records using three tokens, or four when the record's discriminator is 2 | Preserve variable framing; a fixed triplet census can report false subsequent opcodes. Confirm against bounded real map members and both profiles before calling game format support verified |
| `FMT-TRIGGER-LINKS-001` | [UpdateDialog, lines 95–125](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerOptionsDlg.cpp#L95-L125) accesses trigger house/attachment/name/disabled/difficulty fields and a tag's trigger reference and type | Retain separate trigger/tag identities and raw fields. This does not prove latch ownership, attachment scheduling or repeat behavior |
| `FMT-SCRIPT-STEPS-001` | [OnSelchangeAction, lines 375–392](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/ScriptTypes.cpp#L375-L392) reads script steps by numbered key and distinguishes a step type and parameter | Preserve ordered step identity and raw tokens. Runtime wait/completion/interruption behavior remains unknown |

Structured records are in [evidence-records.json](../../tests/fixtures/behavior/evidence-records.json).
The variable-width example in probe `PROBE-08` uses invented opcodes; it is not a
copied map fragment and does not assert those IDs exist in RA2/YR.

## Decode before assigning semantics

For each effective mission, retain profile/build/content identity and source chain
(container hashes, member numeric ID, resolved name/confidence, member hash). Each
table row retains section, key, occurrence and original row order. Numbered script
keys require defined numeric ordering and diagnostics for duplicates/gaps; JavaScript
object insertion order is not an INI semantics specification.

The compiler has separate stages: bounded token framing; reference resolution;
profile-specific opcode schema validation; required-capability closure; typed runtime
tables. A decoded numeric opcode is an occurrence, not implemented behavior. Preserve
unknown parameter tokens in private diagnostic/round-trip data; public inventories
publish only reviewed structural metadata, not full original mission rows.

Suggested capability row:

```text
profile, opcodeNamespace, opcodeId, parameterSchemaVersion,
missionOccurrences[{missionId, sourceIdentity, section, key, occurrence}],
specEvidenceIds, implementationRef, syntheticTestRefs, originalRecipeRefs,
decodeStatus, semanticsStatus, unsupportedReason
```

`opcodeNamespace` separates events, actions and script instructions even when IDs
coincide. Unknown IDs, unknown required enum values and invalid references must
name the source row and fail supported-mission preflight. Do not silently coerce
missing parameters to zero or skip malformed later records. Cap row/count/token
lengths and linked/cyclic traversal; a cycle is not necessarily invalid until its
runtime meaning is known, but it must not hang validation.

## Authoritative concepts and save obligations

| Concept | State that must be represented explicitly |
| --- | --- |
| Trigger definition / instance | Stable definition and instance IDs; enabled/deleted flags, event observations/latches, execution count; determine scope of each from evidence |
| Tags and attachments | Tag identity/type and attachment object/cell context; references to triggers; model shared versus per-attachment state explicitly |
| Event predicate | Raw ID/parameters, house/entity context, observed truth/transition and any retained state; distinguish polling from edge/event consumption |
| Action | Ordered effect request, target resolution, completion/failure, scheduled identity; no nonserializable delayed closures |
| Team / task force | Template reference, stable instance, actual members, owner, recruitment and missing-member state |
| Script instance | Template reference, program counter, wait condition/deadline, current target, retry/interruption/cancellation state |
| Scenario / AI | Local/global variables, diplomacy, difficulty, objectives, outcome state, timers, AI choices and RNG state |

These are required modeling seams, not a claim that the original uses these classes
or exact state partitions. Keep source IDs distinct from runtime instance IDs.
Ownership changes, destruction and release can invalidate references in several
systems; define their transition order and preserve diagnostics instead of leaving
stale references to host objects. No special branch may recognize a mission filename
and directly advance an objective to compensate for missing interpreter behavior.

## Runtime questions with discriminating probes

| Unknown | Distinguishing alternatives | Probe / future recipe |
| --- | --- | --- |
| Persistent true predicates and repeat modes | Once; each false-to-true transition; every eligible evaluation | `PROBE-01` / `OBS-02` |
| Linked enable/disable/delete effects | Visible later in the same evaluation pass; visible next tick; traversal-order dependent | `PROBE-02` / `OBS-03` |
| Multiple objects sharing a tag | Latch shared by tag/trigger; separate per attachment; mixed event/action state | `PROBE-03` / `OBS-02` |
| Team waits during ownership change or member loss | Continue same script; reset/recruit; cancel/reassign, potentially profile-specific | `PROBE-04` / `OBS-04` |
| Pending actions around save | Resumed exactly once; duplicated or lost due to different boundary; native saves may expose additional state | `PROBE-06` / `OBS-05` |
| Tick/speed and RNG | Different scheduler cadence or streams can agree on one visible result | `PROBE-05` / `OBS-01`, `OBS-06` |

Do not select a candidate as original truth until the reference recipe discriminates
it. If two candidates produce the same observation, refine the probe. Original
recordings cannot directly reveal internal RNG state or exact per-tick order.
