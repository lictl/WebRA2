# Evidence and behavior record schema

Revision `m0-specs-1`; issue [#6](https://github.com/lictl/WebRA2/issues/6).
This is the research interchange proposal. It is separate from the runtime save
schema and does not prescribe implementation mechanics. The coordinator's compact
`EvidenceSummary` contract is a distinct index/projection for runtime consumers;
it does not replace this richer research record or satisfy its evidence requirements.

## One record, one falsifiable claim

Use plain JSON with the following required fields. Unknown values are `null` or an
explicit unresolved value; do not substitute a guessed filename, build or opcode.
IDs remain stable when a claim changes status. A materially different claim gets a
new record that links the superseded record.

| Field | Meaning / constraint |
| --- | --- |
| `id` | Unique stable string such as `FMT-EVENT-FRAMING-001` |
| `kind` | `format`, `runtime`, or `webra2-policy`; never present policy as original behavior |
| `claim` | One testable sentence with its scope, not a broad compatibility claim |
| `profiles` | Explicit array drawn from `ra2`, `yr`; split records when behavior differs |
| `buildIdentity` | Executable/content fingerprint or `null`; a storefront/version label alone is insufficient |
| `source` | Source object below; record source identity separately from interpretation |
| `observation` | What was actually read or measured; no inferred cause |
| `interpretation` | Consequence being proposed, with alternatives where applicable |
| `confidence` | `low`, `medium`, `high`; confidence in this claim, not whole-engine accuracy |
| `status` | `OBSERVED`, `SPECIFIED`, `IMPLEMENTED`, `VERIFIED`, `BLOCKED`, or `SUPERSEDED` |
| `probeIds` | IDs of original synthetic probes or explicit future test IDs |
| `runtimeVerification` | `{status: NOT_RUN|INCONCLUSIVE|PASS|FAIL, recipeId, evidenceRef}`; nullable references when absent |
| `limitations` | Nonempty statement of what this evidence cannot establish |

`source` requires `kind`, `uri`, `revision`, `locator`. Kinds are `public-source`,
`local-static`, `original-observation`, `webra2-test`, or `design-decision`.
Use a commit permalink and symbol/line span for public code; a source SHA-256 and
archive/member plus byte offset or INI section/key/occurrence for installed data.
For nested archives, retain the complete container chain. A filename alone is not
a source identity. Never upload the referred-to private data to make a link work.

For original observations, the private evidence index additionally records profile,
executable/mission/rules hashes, original save hash if used, difficulty, locale,
game speed, OS/wrappers, reproduction steps, input sequence, timebase, measurement
uncertainty, repetitions, observer, date and result. The public record may contain a
relative `local/...` evidence ID and hashes; omit personal machine paths and payloads.

## Status and confidence are independent

`OBSERVED` means the named source was inspected. `SPECIFIED` adds a falsifiable
behavior/format specification, inputs and expected results. `IMPLEMENTED` links an
implementation commit and test. `VERIFIED` additionally links successful validation
for the stated profile/build and scope. Original runtime claims require an original
observation or a documented, reviewed argument for an equivalent original reference.
Synthetic tests alone cannot promote an original runtime claim to `VERIFIED`.

A high-confidence editor-format observation may remain unverified against the game.
A renderer screenshot cannot verify simulation ordering. An original observation
at one speed/difficulty is not evidence for all settings. A failed result records
the counterexample and moves the affected compatibility claim out of VERIFIED;
retain earlier evidence instead of overwriting it. Contradictory sources stay visible.

## Behavior specification extension

Once an opcode or mechanic becomes implementable, attach these fields in its own
spec record, linked by evidence IDs:

| Field | Required content |
| --- | --- |
| Identity | Profile, opcode namespace (`event`, `action`, `script`, or mechanic), raw ID, spec version |
| Decode | Ordered raw parameters, per-field encoding/range, null/sentinel rules, source locator |
| Preconditions | Required entity/house/tag context, disabled/dead/missing target cases |
| Transition | State reads/writes, side-effect order, scheduled work and RNG consumption |
| Completion | Return/wait/repeat/cancel semantics, failure and unsupported diagnostics |
| Persistence | All authoritative fields required to resume the transition |
| Tests | Positive, negative and boundary cases; reference recipe, evidence and discrepancy links |

Keep format decoding and runtime semantics in separate records when confidence or
sources differ. A known event label with unknown parameters is not SPECIFIED.
An unknown required opcode blocks supported mission startup; a partial occurrence
census does not prove unused opcodes are safe to ignore.

Examples are in [evidence-records.json](../../tests/fixtures/behavior/evidence-records.json).
They deliberately contain editor-format observations and `NOT_RUN` runtime results.
