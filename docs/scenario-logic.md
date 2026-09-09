# Scenario logic compiler

Issue [#82](https://github.com/lictl/WebRA2/issues/82) adds an immutable,
raw-aware compiler for one selected RA2 or Yuri's Revenge mission. It prepares
data for the [mission interpreter](specs/mission-interpreter.md); it implements
no opcode, scheduler, native trigger latch, repeat rule or mission-specific path.
The [object compiler](scenario-objects.md) remains separate.

## API and represented data

`compileScenarioLogic({ profile, source: { id, profile, sha256 }, bytes }, lowerLimits?)`
in [scenario-logic.ts](../packages/content/src/scenario-logic.ts) accepts the same
explicit source/profile pattern as the other scenario compilers. Callers verify
the bytes and their hash first. This synchronous compiler validates identity syntax
and profile agreement; it does not independently authenticate a supplied hash.
The source must explicitly declare `[Basic] NewINIFormat=4`.

Output carries schema version 1, policy `webra2-logic-1`, source identity and the
complete frozen [RuntimeIni](runtime-ini.md) table. That table retains uncompiled
fields, original section/key spelling, selected and shadowed origins, line numbers,
raw RHS/comments and scanner diagnostics. It uses `webra2-ini-1`; native duplicate,
comment and merge equivalence remains unverified. Parsed logic rows additionally
retain untrimmed comma tokens before the first semicolon and trimmed semantic
values. All output records and arrays are frozen and detached from input bytes.
There are no typed-array outputs, DOM, filesystem, network, clock or RNG dependencies.

| Table | Structural interpretation |
| --- | --- |
| Triggers | Exactly eight fields. Owner selector, attached trigger, name, disabled/easy/medium/hard raw values and opaque tail. No flag conversion or invented default. |
| Events | Leading unsigned count, then three tokens per event, or four when the stored discriminator equals 2. Each instruction retains opcode, discriminator, token range and all parameters. |
| Actions | Leading unsigned count followed by exactly eight tokens per action. Unknown opcode parameters remain opaque. |
| Tags | Exactly three fields: raw type, name and trigger reference. Type is not an implemented repeat/latch policy. |
| TeamTypes | Numeric declaration keys point to named sections. Every field is retained, including empty and unknown properties; present House/Script/TaskForce/Tag fields generate structural references. |
| TaskForces | Numeric declarations plus all definition fields. Numeric member keys yield quantity/type pairs; other properties remain raw. Quantities are unsigned 0–65,535, never instantiated or summed into entities. |
| ScriptTypes | Numeric declarations plus all definition fields. Numeric step keys yield opcode/parameter pairs. Steps sort numerically, retain original IDs and diagnose gaps. Unknown nonnumeric properties remain with an opaque-property diagnostic. |

Counts and opcodes accept bounded unsigned decimal syntax; leading zeros remain in
raw tokens. Other numeric parameter meanings, signed values, sentinel values and
type enums are not inferred. Counted rows reject truncated/empty records, extra
tokens and invalid counts/opcodes/discriminators. A zero count requires exactly
one token. Script and task-force pairs require exactly two tokens. A bad record
rejects the entire compilation; no partial executable table is returned.

The declaration budget counts direct trigger/tag/event/action rows and named
team/force/script/house/country declarations together. Numeric declaration and
step keys may have gaps; aliases such as `1` and `01` reject. Named IDs use the
explicit INI ASCII case-fold policy; named identifiers are not converted to
numbers. Same-layer duplicates in parsed logic reject, even if the final value
would look valid. A named section claimed by multiple team/force/script declarations,
or a declaration targeting a reserved structural section, rejects as ambiguous.
Uncompiled/orphan fields remain raw-aware in `ini`, including their shadowed origins.

## References and execution boundary

Trigger rows link to event/action rows by their matching ID. Those rows also
retain an owner reference to the trigger. Tags link to triggers, teams link to
their present literal fields, and task-force members produce external object-type
requirements. A reference token index of `-1` means a join by row key, not an
operand read from the row. No event/action/script operand creates a guessed edge
based on its value or an editor label.

Resolved references identify a declared target. `missing-definition` distinguishes
a declaration without a section from a wholly missing target. Referenced named
sections without the appropriate declaration receive `undeclared` status,
`missing-declaration` diagnostics and an `orphanSections` raw-field summary; they
do not become typed definitions. Orphan definitions are not opcode-framed.
An empty declared section is distinct from an absent section.

Owner selectors retain both matching house and country declarations as candidates,
or remain external when neither is locally declared. Their binding is always
`house-country-unresolved`, even with one candidate; rule countries and native
country-to-house binding require another compiler/interpreter stage. Object types
remain external regardless of similarly named mission sections.

Only explicit empty values and source-supported optional attachment/tag spellings
are treated as absent references: `<none>` for attached triggers, `None` for optional
team tags. A matching declared sentinel name yields `unsupported` status instead
of silently choosing absence or a target. A missing property is not synthesized.

Trigger attachment cycles are retained and diagnosed with iterative, bounded graph
analysis. This neither executes them nor assigns native cycle behavior. Events,
actions and script opcodes each have separate capability namespaces, instruction
occurrences and `semantics: 'unimplemented'` / `operandSchema: 'unknown'` status.
`framingComplete: true` means only that the recognized structural records passed;
`executionReady: false`, `nativeBehaviorVerified: false` and
`capabilityClosure: 'incomplete-operand-schemas'` remain explicit, including for
the real missions below. Missing-reference diagnostics are not a campaign preflight.

## Bounds and failure behavior

| Default maximum, lowerable only | Value |
| --- | ---: |
| Input bytes / decoded text / retained parsed RHS characters | 16 MiB each |
| INI entries, including overwritten assignments | 100,000 |
| Total declarations | 8,192 |
| Total instructions plus task-force members | 65,536 |
| Instructions per counted row / numeric steps per definition | 4,096 |
| Total comma tokens / tokens per row | 524,288 / 32,769 |
| Characters per token | 4,096 |
| Reference records | 131,072 |
| Compiler diagnostics / distinct opcode capabilities | 16,384 each |

The existing INI scanner imposes additional limits. Wrong profiles fail before INI
parsing. Declaration counts are checked before their result arrays; comma counts
and token lengths before `split`; counted totals before instruction expansion;
numeric members/steps before list growth; references before adjacency construction.
Every retained raw string is also covered by INI byte/text limits. Token arrays
and trimmed values duplicate bounded text, so the table above does not assert a
16 MiB process-memory ceiling. The compiler retains the full INI table deliberately;
callers must budget its lifetime and avoid retaining obsolete mission snapshots.

## Primary evidence and licensing

New source and original synthetic tests are GPL-3.0-or-later, copyright 2026 WebRA2
contributors. They compose the existing GPL runtime INI compiler. This is an
original implementation from the following storage/editor observations, not copied
retail rows or an imported editor implementation. Preserve the EA Mission Editor
attribution: copyright 1999–2024 Electronic Arts, authored by Matthias Wagner.
No dependency or native executable execution was added. The coordinator owns the
shared [license mapping](licensing.md) and [content provenance](../packages/content/PROVENANCE.md).

All EA references are pinned to `6abf0f557469baea73079c6bf6550709e2e3584e`:

- [TriggerEventsDlg.cpp, GetEventParamStart](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerEventsDlg.cpp#L78-L99): counted three/four-token framing, selected by discriminator 2.
- [TriggerActionsDlg.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerActionsDlg.cpp#L98-L110): action offset advances by eight tokens.
- [TriggerOptionsDlg.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerOptionsDlg.cpp#L91-L125) and [functions.cpp, RepairTrigger](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/functions.cpp#L192-L202): owner/link/name and raw control positions, tag-to-trigger link, and presence of an eighth trigger field. WebRA2 does not apply the editor's repair defaults.
- [TeamTypes.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TeamTypes.cpp#L502-L545): named house/script/tag/task-force properties; [optional tag editing](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TeamTypes.cpp#L1214-L1227) removes an absent tag property.
- [TaskForce.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TaskForce.cpp#L270-L286) and [ScriptTypes.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/ScriptTypes.cpp#L375-L392): member quantity/type and numbered script opcode/parameter records.
- [functions.cpp, ListHouses](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/functions.cpp#L1263-L1355): house/country selector distinction. This is not native binding proof.

Trigger-to-event/action row joins are also observed in the
[mission census](analysis/campaign-census.md). Original evaluation order, disabled
and difficulty semantics, repeat/latch ownership, script waits, parameters and
save-state obligations remain in the interpreter evidence backlog. GPL source
rights do not confer rights to retail assets.

## Private opening-mission comparison

The [reference profile](analysis/m0-reference-profile.json) supplies these exact
source identities. Verified-source reads and an independent Python read both
checked complete root hashes and the member ranges, without executing game code.

| Profile | Root / offset / bytes | Member SHA-256 |
| --- | --- | --- |
| RA2 | MAPS01.MIX / 308 / 146,240 | `ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c` |
| YR | mapsmd03.mix / 260 / 301,077 | `dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0` |

Root SHA-256 values are respectively
`b9093c9ef7efc1d24c6259196fbe90c8b78a15d0af27c93c12e1c755e5196d74`
and `6c36a0af05e2e9f86967308c77cf90fae9976d920e320aad8b9e4aa2e99e86a3`.

| Compared structure | RA2 all01t | YR all01umd |
| --- | ---: | ---: |
| Trigger / tag rows | 130 / 128 | 334 / 132 |
| Event rows / event instructions | 130 / 132 | 334 / 437 |
| Three-token / four-token events | 132 / 0 | 410 / 27 |
| Action rows / action instructions | 130 / 435 | 334 / 1,158 |
| Teams / task forces / scripts | 49 / 29 / 38 | 102 / 91 / 94 |
| Task-force member rows / script steps | 37 / 88 | 99 / 375 |
| Independent raw INI entries / parsed logic rows compared | 4,583 / 2,370 | 8,974 / 5,421 |
| Reference records compared | 1,097 | 2,541 |
| Declared literal targets resolved | 753 | 1,874 |
| Explicit absent attachments | 128 | 132 |
| Owner-selector candidates / external object types | 179 / 37 | 436 / 99 |
| Distinct unimplemented opcode capabilities | 60 | 90 |

Neither input produced missing declared links, cycles, orphan sections or compiler
diagnostics. Those negative results describe these inputs only; owner binding,
object types and every opcode's runtime semantics remain unresolved. All trigger
rows have eight fields and tags three fields.

The separate standard-library Python parser rebuilt raw INI entries/origins,
counted event/action instructions, declarations, all definition fields, numeric
steps/member quantities and every literal reference independently. It compared
actual fields and parameters, not just totals. Complete compact `JSON.stringify`
compiler-output SHA-256 values (UTF-8, no final newline) are:

- RA2: `1325fca2e3c1100bbb660b42c981258d5205b3639ec8a4b1affc6d57e0af9501`.
- YR: `2c77ce71946a29e6e8724c4a5614932cb8b161fd4c046815106575581bd7ea06`.

Only hashes/counts/structural evidence are published. Full compiler tables contain
retail mission data and must remain on-device or under ignored `local/`, never in
GitHub discussions, packages, public fixtures or CI artifacts.

## Verification and next consumers

Use Node 24.20.0 and `npm ci`:

```sh
node --import tsx --test tests/content/scenario-logic.test.ts
npm run check
git diff --check
```

Twelve original synthetic tests cover framing and truncation, unknown operands,
quantities, numeric ordering/gaps, duplicate and aliased IDs, missing/undeclared
references, sentinel collisions, cyclic links, profile/format boundaries,
allocation limits, source detachment and immutable output.

For a private reproduction, use `createVerifiedSourceReader.read` with a pinned
identity above, then supply the exact filename (`all01t.map` or `all01umd.map`) as
the source ID. Compile and hash compact JSON only under ignored `local/`. Independently
parse the original INI without importing the TypeScript compiler; reconstruct the
documented structural tables and reference joins and compare all parameters and
origins. The worker retained reproducible `local/probe-shapes.ts`,
`local/compile-private.ts`, `local/oracle.py`, `local/compiled-facts.json` and
`local/oracle-facts.json` in its isolated worktree for the independent reviewer.
Private retail gates are separate from public synthetic tests.

The next interpreter stage must define profile-specific operand schemas and
supported capability preflight before executing anything. It must resolve external
types/owners, model serializable native-like trigger state and scheduling, and
validate behavior using the existing original-game comparison recipes. This
compiler does not authorize a claim of campaign playability.
