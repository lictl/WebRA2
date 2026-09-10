# Mission trigger runtime foundation

[Issue #91](https://github.com/lictl/WebRA2/issues/91) adds a headless interpreter
for a bounded subset of [compiled mission logic](scenario-logic.md). It interprets
original numeric instructions as data. No mission filename selects behavior, no
unsupported action is skipped, and no synthetic victory stands in for a campaign.
Both opening missions **fail executable preflight** with specific missing capabilities.

The interpreter is an original GPL-3.0-or-later component. Its
[provenance record](../packages/sim/MISSION_LOGIC_PROVENANCE.md) pins the primary
headers and native byte ranges used for operand and control evidence. No native
game program was executed. Evidence comes from the supplied YR executable; use of
these common instruction rules for RA2 is an explicit compatibility inference,
still requiring RA2 native/reference comparison. Overall native behavior is unverified.

## API and admission

`compileMissionProgram(logic, {contentIdentity, difficulty, timingPolicy}, digest)`
is asynchronous only for its injected SHA-256 adapter. It accepts the immutable
`ScenarioLogic` representation and snapshots the selected fields before awaiting
the digest. Accessors, malformed arrays, duplicate IDs and bad structural counts
reject; the entire retained INI and retail raw text are not copied into the runtime.
The caller must authenticate mission bytes and the supplied content identity first.

The result contains source/content identities, coverage counts and diagnostics.
`program` is null when required opcodes, operands, references or controls are
unsupported. Disabled triggers and difficulty-excluded triggers are still checked;
they are not a reason to omit unsupported capabilities. Team/task-force/script
definitions and compiler diagnostics conservatively prevent executable closure.
No automatic partial-mission execution or fallback is provided.

A successful program has `canExecuteTriggerSubset: true` on its compilation result.
`canStartCampaign: false` and `nativeBehaviorVerified: false` apply to every result.
Program objects are deeply frozen and branded by this compiler. Their SHA-256 covers
the normalized model, complete original instruction operand encodings (including
ignored fields), source/content identity, compiler/INI policies, difficulty and the
runtime/timing policies. A reconstructed plain object cannot authorize execution.

Use `MissionLogic.create(program, {bindings, globals, locals})` with explicit initial
arrays of 50 global and 100 local booleans. The initial mission timer is stopped at
zero. A binding supplies `{id, tagId, attachmentIds}`. Binding IDs are unique;
attachment IDs are nonempty, globally unique within the machine, and stable symbolic
IDs supplied by the entity/cell/scenario adapter. The caller decides which tags are
instantiated and which attachments share their state. Nothing here derives bindings
from placed objects, discovers scenario-global tags, or models ownership transfer.

Each binding owns its linked trigger instances. Multiple bindings may instantiate
the same tag type with independent state. Explicit sharing within a binding is
represented by its attachment list; object deletion/detachment and native allocation
policy are not implemented. This avoids guessing those policies from repeated IDs.

`enqueue(inputs)` admits a whole detached batch atomically. Inputs have exact fields
`{tick, sequence, kind, index, value}`: `kind` is `global` or `local`, `value` is boolean,
and `index` is within that flag array. This is a component-owned deterministic seam,
not a player-authorized gameplay command or a shared `CommandEnvelope` extension.
Sequences must be unique and greater than the saved admission cursor. Inputs sort
by execution tick then sequence; out-of-order arrival within a batch is harmless.
Late inputs and inputs beyond the future horizon reject before queue mutation.

## Supported operand schemas

Event records have three tokens: opcode, discriminator **0**, integer argument.
Four-token/other-discriminator forms are unsupported for this subset. Action records
have eight tokens. Mode **0** selects the integer in token 2; mode **2** selects a
named trigger in token 2. Here token numbers are zero-based within an instruction,
excluding the counted row's initial count. Action tokens 3–6 are parsed as bounded
signed integers but ignored by these opcodes; the final waypoint token is retained
in the fingerprint but not used. No coordinate/waypoint behavior is inferred.

Numeric arguments use strict signed decimal integers without exponent, fraction,
negative zero or leading-zero aliases, within signed 32-bit limits and the tighter
limits below. This is a deliberately narrower input policy than native `atoi`.
Validly framed out-of-subset operands become explicit diagnostics.

| Namespace / opcode | Implemented subset |
| --- | --- |
| Event 0 / 8 | Never / unconditional, respectively; numeric argument ignored |
| Event 13 | Shared trigger elapsed timer has reached zero |
| Event 14 | Mission timer is running and has reached zero; stopped-at-zero is false |
| Event 27 / 28 | Global flag set / clear, index 0–49 |
| Event 36 / 37 | Local flag set / clear, index 0–99 |
| Event 47 | Logical scenario frame divided by 15 has reached the argument |
| Action 12 / 22 | Named-trigger deletion / forced action invocation; see the lifecycle extension for ordering, bounds and native limitations |
| Action 0 | No state effect; still emits an ordered action record |
| Action 23 / 24 | Start / stop mission timer; stop retains remaining frames |
| Action 25 / 26 / 27 | Extend / shorten / set mission timer by argument × 15 frames; all three start it; shorten clamps to zero |
| Action 28 / 29 | Set / clear global flag |
| Action 53 / 54 | Enable / disable every currently bound instance of the named trigger |
| Action 56 / 57 | Set / clear local flag |
| Action 1 / 2 | Emit a typed outcome request with country-index operand 0–255; no terminal campaign result |

Time arguments are nonnegative and at most `floor(1,000,000,000 / 15)`. Named trigger
selectors shorter than three characters are unsupported: the native mode-2 loader
has a separate short numeric-index branch. Exact declared IDs are matched using the
compiler's ASCII case folding. Missing targets block the whole program.

The outcome instruction is an **effect-only capability**. Its native path involves
the player's country/house and additional victory/defeat acceptance behavior.
Consumers receive the stored opcode and country index; they must resolve the player
and campaign rules before changing a game outcome. The machine stores only the last
ordered request and emits every request. A UI must not equate that field with victory.
Team/combat/entity/media operations remain unsupported. Named trigger forcing22
and deletion12 are described in the [lifecycle extension](mission-trigger-lifecycle.md),
including explicit D03 ordering and the distinct native RA2/YR deletion paths.
Unknown operations are not silently emitted as generic effects.

## Trigger, tag and time policies

Policy `webra2-mission-poll-2` uses timing policy `yr-static-15-frame-1`. A logical tick
represents one frame-counter unit; the observed YR timer scaling is 15 units per
stored time argument. This does not assign real-world seconds, game-speed settings,
loading-frame offsets, render cadence or native global simulation phase ordering.

The supported native control paths establish these local rules:

- Trigger disabled `0` means enabled; difficulty `1` allows that level. Other control
  spellings and a nonzero transfer tail block preflight. Enable honors difficulty,
  resets elapsed timing, and cannot revive a destroyed instance. Disable preserves
  timer state. A self-disable action does not truncate later actions in the same list.
- Events are combined with AND. Native loading prepends event records but appends
  actions. The implementation preserves source action order and evaluates events
  in reverse source order. These supported polling predicates do **not** pass the
  native persistent-event latch gate. Their saved observations are last truth values,
  not accumulated occurrence latches. Occurrence-event latches remain unsupported.
- A trigger has one shared elapsed timer. Resetting visits the reversed event list;
  multiple elapsed records therefore finish with the first source elapsed argument.
  They do not create independent timers. Enable, repeating-fire preparation, and a
  matching flag's actual value change reset this timer. Assigning an unchanged flag
  does not reset it. Flag changes find triggers with the matching flag predicate.
- Tag mode **2** repeats: when all predicates pass, reset elapsed timing before
  executing actions. A persistent true zero-time predicate can fire on every poll.
  Tag mode **0** destroys each fired trigger and removes the binding after completing
  its linked traversal. Linked trigger construction reverses the declared attachment
  chain. Cycles and missing links reject; traversal never recurses unboundedly.
- Mode **1** depends on native attachment instance counts and removal behavior;
  it is unsupported. Object ownership changes, tag transfer, forced events and native
  tag creation/caching remain external integration requirements.

The **WebRA2 phase choice** is deliberately separate: for tick N, execute scheduled
flag inputs in `(tick, sequence)` order, then poll active bindings by UTF-16 binding
ID order and their compiled linked-instance order, then advance `nextTick`. Earlier
actions are visible to later instances in that pass. Each instance is polled at
most once per tick; forced action invocations bypass this predicate poll and use
a separate bounded counter. Cross-tag order and this polling cadence are not native evidence.
Applications schedule calls to `step`; wall clocks, rendering and unseeded RNG are absent.

## Save, effects and replay

`step(ticks = 1)` is a bounded transaction over the complete batch. It returns
`{nextTick, effects, work}`. Each effect has a saved monotonic order plus tick,
binding/trigger/instruction IDs, opcode, typed kind, value and optional target.
No effect callback runs inside a tick. The `work` count is a resource diagnostic,
not authoritative state. Errors, arithmetic overflow and work/output limits leave
the live machine and all pending inputs unchanged.

`save()` returns detached data; `saveText()` uses the existing
[integer canonical JSON encoding](simulation-foundation.md). `nextTick = N` means
all effects through N−1 are complete. The component-owned checkpoint stores version,
policy, program SHA-256 and content identity; flags; mission timer; each binding and
its active/attachment/instance state; enabled/destroyed/deleted state, polled/forced counts, shared timer
deadline and last observations; pending inputs and admission cursor; next effect
order and last outcome request. No host handles or raw retail rows are serialized.

`MissionLogic.restore(program, saveOrTextOrBytes)` checks the entire checkpoint before
creating an instance. It rejects content/policy/program mismatch, malformed/duplicate
JSON, noninteger wire numbers, invalid flag lengths, missing/reordered instances,
inconsistent once/repeating states, impossible initial states, future timer starts,
bad queue order/cursors and resource excess. It does not authenticate arbitrary save
edits or prove every well-formed state is historically reachable. No native save import.

`replayMission(program, documentOrTextOrBytes, digest)` takes schema version 1,
`initialCheckpoint`, ordered `admissions: [{nextTick, inputs}]`, `finalNextTick` and
ordered unique `checkpoints: [{nextTick, sha256}]`. Initial pending inputs are already
admitted and execute exactly once; admissions contain only subsequent batches.
At a boundary, all admission batches precede hash validation. Replay checks SHA-256
over the full canonical checkpoint, returns an isolated final simulation and ordered
effects, and reports the number of verified checkpoints. An empty checkpoint list
reports zero verification. Input data is detached before the first digest await.

Effect orders are the seam for consumer deduplication after restore. Presentation
acknowledgments and durable audio/video playback queues remain outside this component;
the caller must save those states together when that integration is implemented.
Replay recording/segment chaining and integration with the synthetic grid kernel
are not added here. No shared save/replay contract was changed.

## Bounds and verification

| Hard maximum | Value |
| --- | ---: |
| Trigger / tag definitions | 1,024 each |
| Total event/action instructions | 8,192 |
| Events / actions per trigger | 32 / 128 |
| Aggregate compiled tag-chain edges / runtime instances | 2,048 each |
| Explicit bindings / total attachments | 256 / 1,024 |
| Pending inputs / future horizon | 1,024 / 10,000 ticks |
| Single transaction ticks / counted work / returned effects | 1,024 / 131,072 / 32,768 |
| Nested action/force frames | 256 |
| Replay ticks / counted work / effects | 10,000 / 1,048,576 / 32,768 |
| Replay admitted inputs / batches / checkpoints | 1,024 each |
| Terminal logical tick | 1,000,000,000 |

Combined program fingerprints, checkpoints, replay documents, reports and returned
traces also obey the existing 2 MiB / 50,000-value / depth-48 canonical JSON limits;
these may reject before an individual count maximum. They are not a total RSS cap.
Definitions/rows and token counts are checked before their corresponding expansions,
chain/instance/attachment counts before allocation, and replay work/output across
all ticks. Native signed overflow, malformed native coercions and unbounded recursion
are not emulated. Long sessions need a new explicit checkpoint/replay segment.

On Node 24.20.0: `npm ci`,
`node --import tsx --test tests/sim/mission-logic.test.ts`, `npm run check`, and
`git diff --check`. Thirteen original tests cover each supported predicate/effect,
boundaries, repeated/disabled/difficulty behavior, linked/shared bindings, malformed
operands, fail-closed coverage, ownership across hashing, replay admission timing,
every-boundary restore equivalence, and transactional work/effect/queue failures.
This is a headless component gate; no browser presentation or native mission was run.

## Private opening coverage

The private probe rereads and verifies the selected opening root/member identities
from the [compiler report](scenario-logic.md), recompiles them, and evaluates every
event/action operand. The previous full compiler-output hashes reproduce exactly.
A separate Python parser reads the pinned raw map bytes, reframes the rows and
checks opcode/discriminator/operand validity and references without importing the
TypeScript code. It agrees on every supported occurrence and diagnostic ID.

| Metadata only | RA2 `all01t.map` | YR `all01umd.map` |
| --- | ---: | ---: |
| Supported event occurrences / total | 86 / 132 | 319 / 437 |
| Supported action operands / total | 116 / 435 | 748 / 1,158 |
| Of those actions, outcome requests only | 2 | 3 |
| Unsupported event / action occurrences | 46 / 319 | 118 / 410 |
| Triggers whose own instructions and controls pass | 8 / 130 | 74 / 334 |
| Raw event/action rows compared independently | 260 | 668 |
| Executable program returned / campaign ready | no / no | no / no |

No known-subset operand failed in these maps. Both still require team/task-force/
script interpreters as well as unsupported instructions, external bindings and
gameplay. The passing-trigger count is local syntax/control coverage, **not dependency
closure**: it cannot authorize execution of those triggers inside an incomplete mission.

Compact coverage-array SHA-256 values (UTF-8 JSON, no trailing newline) are
`5d6ca56454720aff9b5c29111cdb689eb80a9e613d8ad22a55569163749e5396` (RA2) and
`d6dc1d37ca6c90422ec47ee6ecc0fbac0f385709bb3cb26528190eaf74c69f77` (YR).
Private recipes are retained in the isolated mission-logic worktree as
`local/coverage.ts`, `local/coverage-oracle.py`, input/definition identity facts,
coverage facts and native range helpers. Run `node --import tsx local/coverage.ts`
then `python3 local/coverage-oracle.py` there; relative imports must resolve the
revision under review. Missing retail files skip this private gate, never pass it.
Only reviewed counts/hashes are public. Full compiler/coverage rows and native
listings remain ignored local research.

The next interpreter work is occurrence events and their native latches, explicit
tag/entity lifecycle, team/script execution, house/country resolution and gameplay
effects. Original-game comparison should eventually target repeat/reset behavior,
cross-tag ordering and mid-mission save/restore. No owner observation is essential
for this bounded implementation; none of those remaining gaps is waived.
