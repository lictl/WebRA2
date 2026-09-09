# Proposed deterministic boundary

Revision `m0-specs-1`; coordinator decision input for
[#8](https://github.com/lictl/WebRA2/issues/8). Everything in this document is
**proposed WebRA2 policy**, except explicitly cited platform facts. It does not
identify the original tick rate, RNG algorithm or simulation phase ordering.

## Values and command admission

Use nonnegative safe integers for ticks, player IDs, sequences and allocation
counters; reject overflow before mutation. JavaScript's maximum safe integer is
`9007199254740991`, so integer checks must include the safe range.
[ECMAScript Number.MAX_SAFE_INTEGER](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-number.max_safe_integer)
defines this platform limit; it says nothing about the game's numeric representation.
World coordinates, damage rounding and original 32-bit overflow remain separate
spec decisions. A `number` TypeScript annotation is not runtime validation.

Proposed `CommandEnvelope`: `schemaVersion`, `tick`, `playerId`, `sequence`, `kind`,
`payload`. The payload is a bounded JSON value with finite safe integers initially;
no functions, `undefined`, NaN/Infinity, unsafe integers, cycles or host handles.
Each command kind later supplies a typed payload validator and authorization checks.

The identity `(playerId, sequence)` is unique within a replay session. Sequence is
monotonic per player at admission; reordered transport can buffer before admission.
Sort admitted commands by numeric `(tick, playerId, sequence)`. Reject duplicate
identities, late commands (`tick < nextTick`), unknown kinds and invalid targets with
stable error codes; an exact retransmission may be recognized at a transport adapter,
but cannot execute twice. Bound commands per tick and future horizon in the selected
runtime configuration. UI receipt time and object-key insertion order are not ties.

Validation has two stages: structural/admission checks before enqueue, and gameplay
validation on authoritative state at execution. A target may die after admission.
Record the outcome of rejected gameplay commands in deterministic traces. The shell
assigns ticks at a controlled boundary; simulation never consults `Date`, performance
clocks, DOM, network arrival times or `Math.random`.

## A checkpoint names the next tick to run

`nextTick = 0` means initial state before tick 0. A checkpoint with `nextTick = N`
contains every authoritative effect through tick `N - 1` and none from tick `N`.
Saving is allowed only at this boundary. Finish a tick before producing a checkpoint;
never serialize halfway through action dispatch or wait for file I/O inside a tick.

The first synthetic kernel needs a versioned ordered phase list, but original
movement/combat/AI/trigger ordering is **UNKNOWN**. Freeze only a synthetic policy
until reference evidence exists. A later change in phase order changes
`simulationRulesVersion`, with an explicit migration or unsupported-version error.

Serializable scheduled work requires `dueTick`, deterministic `order`, `kind`,
`payload`, and optional stable owner/cancellation identity. `order` is allocated by
saved state, never a host callback. Specify whether newly scheduled same-tick work
joins the current phase or a later tick before enabling such behavior; do not let
array iteration accidentally choose it. Cancellation and missing owners have explicit
results. Persist the next entity/event allocation IDs and command admission cursors.

RNG state requires algorithm/version, stream identity, full state and any position
counter needed for replay. The initial seed alone cannot restore an advanced stream.
Use an explicitly named provisional algorithm for synthetic scenarios; do not label
it original-compatible. Presentation randomness uses a separate nonauthoritative
source and must not change simulation consumption. Specify and test bounded-integer
sampling as well as the generator recurrence when a real algorithm is selected.

## Save and replay envelope proposals

| Envelope | Fields and meaning |
| --- | --- |
| `ContentIdentity` | `profile` (`ra2`/`yr`), effective `manifestSha256`, `rulesSha256`, ordered `orderedModHashes`; resolved content hash covers mission dependencies and precedence |
| `SaveEnvelope` | `schemaVersion`, `engineVersion`, `simulationRulesVersion`, `contentIdentity`, `nextTick`, `state`, `queuedCommands`, `scheduledWork`, `rngStates` |
| `ReplayEnvelope` | Same version/content fields; `initialCheckpoint`, `commands`, `checkpoints` containing `{nextTick, stateSha256}` |

Field placement may be normalized in the coordinator contract. Do not save queues or
RNG twice in conflicting locations. `state` must include entities/ownership, counters,
terrain, houses/economy, diplomacy, visibility, mission variables/objectives, trigger
latches, script PCs/waits, team membership, allocation and command cursors. Campaign
progress and difficulty also affect outcomes. Compiled immutable content is referred
to by identity, not copied retail bytes. Pending presentation playback is separate;
the boundary between a durable mission media action and displayed playback needs a
deduplication policy so restoring does not replay an already-consumed trigger.

Check version and complete content identity before state mutation. Reject mismatches
atomically with an actionable error. Native Windows save import is a separate adapter.
Content hashing and persistence I/O happen outside simulation. A save envelope may
contain exported metadata; canonical state hashes exclude save display names,
timestamps, UI selection, GPU/audio objects and the hash field itself.

## Canonical hashes and acceptance probes

Choose and version one canonical encoding before comparing hashes. Proposed option:
SHA-256 over UTF-8 JCS of a defined authoritative-state projection with safe-integer
values. [RFC 8785 sections 3.1–3.2](https://www.rfc-editor.org/rfc/rfc8785#section-3)
specifies primitive serialization and recursive UTF-16 property ordering; arrays
retain order and strings are not normalized. Reject duplicate JSON keys and invalid
Unicode on ingestion. JavaScript object property enumeration plus ordinary
`JSON.stringify` is not a complete canonicalization implementation. If JCS is chosen,
use conformance vectors and record the implementation/dependency decision; none is
adopted here. Hashes prove equality of the defined projection, not original accuracy.

M1 must execute, rather than merely parse, these invariants:

- Different arrival/object insertion/render schedules produce identical accepted
  command order, tick state and canonical hashes.
- Uninterrupted execution, replay and save/restore at every chosen `nextTick` yield
  the same later authoritative state and events, including pending work and RNG.
- Invalid/late/duplicate commands and unsupported versions produce deterministic
  failures without partial mutation. Content profile/mod order mismatches reject.
- A save while a team waits, an event is due, a trigger has fired, or ownership has
  changed preserves each pending transition. Dead objects cannot leave host closures.
- Run the same vectors in the headless runtime and all four target browser families.
  Hash comparisons are WebRA2-to-WebRA2; compare original runs by observable events.

The [probe data](../../tests/fixtures/behavior/probes.json) supplies concrete command
ordering, scheduled-work, checkpoint and capability examples. No such invariant has
yet been executed by an engine in this slice.
