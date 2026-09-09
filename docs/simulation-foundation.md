# Deterministic synthetic simulation foundation

Issue [#43](https://github.com/lictl/WebRA2/issues/43), M1. The
[pure TypeScript kernel](../packages/sim/src/index.ts) executes an original grid
scenario with movement, delayed combat and reinforcements. It establishes working
save/replay boundaries; it does **not** execute RA2/YR missions or recover native
tick rates, movement, combat, AI or trigger semantics. The accepted research
[determinism specification](specs/determinism.md) remains the compatibility guide.

The component and original tests use MIT. It imports only the original shared
contracts, adds no dependency, and has no DOM, filesystem, network, wall-clock,
rendering or unseeded-random dependency. UTF-8 encoding is a pure platform operation.
SHA-256 is injected asynchronously outside ticks; browser integration can supply
Web Crypto, while public Node tests use Node's cryptographic implementation.

## Versions and numeric policy

- Engine: `webra2-synthetic-1`; rules: `grid-xfirst-delayed-combat-1`.
- RNG: `webra2-lcg32-1`, a deliberately synthetic 32-bit linear congruential choice:
  `state = (1664525 * state + 1013904223) mod 2^32`. Integer multiplication uses
  `Math.imul`; the full state and draw count are saved, including a valid zero seed.
- Bounded sampling accepts 1–65,536, rejects values outside the largest complete
  multiple of the bound below 2^32, and caps retries at 64. Failed sampling leaves
  the supplied RNG state unchanged. This is not a native or cryptographic RNG claim.
- Coordinates, HP, IDs, orders, ticks and cursors are integers. No floating point
  position integration or host-time conversion occurs. Counters reject overflow.
- `nextTick = N` names the start of tick N, after all completed effects of N−1.
  External command admission can change its pending queue/cursors at that boundary.

There is no chosen tick-to-wall-time conversion in the kernel. The application
schedules calls to `step` and renders snapshots; render timing never changes a tick.
Future native phase or numeric changes require a new simulation rules version and
an explicit migration or unsupported-save response.

## Synthetic phase order

1. Execute current commands by `(tick, playerId, sequence)`. `move` takes
   `{entityId, x, y}`; `attack` takes `{entityId, targetId}`. Unknown kinds/fields,
   unsafe numbers and out-of-grid coordinates fail at admission. Missing entities,
   ownership, friendly/missing targets and Manhattan attack range above four cells
   produce deterministic gameplay rejection events at execution.
2. Resolve due scheduled work by `(dueTick, order)`. An accepted attack schedules
   an impact two ticks later. A live target receives `2 + random(4)` damage; a dead
   target consumes no draw. An already-launched impact survives attacker death.
   Reinforcements originate from scenario data, allocate the next stable entity ID,
   and fail observably if their cell is blocked/occupied or entity capacity is full.
   Every resolved work record increments the saved event counter, including misses.
   Newly created same-tick work and arbitrary callback closures are unsupported.
3. Move living entities in ascending stable ID order, one cell per tick, X before Y.
   A blocked unit retains its destination; no path search or swapping is attempted.
   Earlier IDs win contested occupancy. Movement can immediately use a cell freed
   by an earlier death or move; later entities cannot enter an occupied cell.
4. Advance `nextTick`. Return a detached trace in execution order and publish state
   only after validation succeeds.

Initial entity and reinforcement array order determines allocation IDs/order.
Obstacle input order is normalized by cell index. Entity IDs are never recycled.
These choices make ties and causal effects testable without describing them as
original-game behavior. Both `ra2` and `yr` content identities are accepted, but the
same explicitly synthetic rules apply to them until real profiles are implemented.

## API and transaction boundary

`Simulation.create(scenario, contentIdentity)` validates a detached configuration.
The scenario has width/height, blocked cells, initial owner/position/HP records,
dated reinforcement records, and seed. `Simulation.restore(saveOrTextOrBytes,
expectedContentIdentity)` constructs a new instance only after strict validation.
It never partially mutates an existing simulation.

`admitCommands(batch)` validates the complete detached batch before committing.
Sequences must exceed the saved admission cursor for each player; an exact retry
is a duplicate, even at a different execution tick. Within one batch, per-player
sequence comparison is independent of arrival order. Commands may target future
entities; existence and ownership are checked on execution. Commands earlier than
`nextTick` or beyond the configured future horizon reject. The return value is a
detached list in execution order, which may differ from admission sequence order.

`step(ticks = 1)` is one bounded transaction over all requested ticks. Internal
work/ID/RNG/counter/trace overflow aborts without changing any state, pending queue
or RNG. Gameplay rejections are ordinary trace results, distinct from fatal errors.
`save()` returns detached authoritative data, and `saveText()` returns its canonical
wire representation. Callers cannot alter live state through snapshots or commands.

The generic [SaveEnvelope](../packages/contracts/src/index.ts) is unchanged. Its
`state` contains grid/obstacles, living entities and destinations, allocation IDs,
admission cursors and resolved-event count. Queued commands, scheduled work and the
`simulation` RNG stream live in their existing envelope fields, once each. Exact
field sets, ordered/unique entity/work/cursor records, occupied cells, command
cursors, work ranges, versions and full expected content identity are validated.
Ordered mod hashes are significant. There is no old-save migration or native save
import. A well-formed source hash is an identity supplied by the content compiler,
not proof that this kernel authenticated the associated assets.

## Canonical bytes and replay admission times

The version-1 canonical encoding is an **integer-only JSON subset**, not a general
JCS implementation. It emits compact JSON, recursively sorts object keys by UTF-16
code units, preserves array order, uses JSON string escaping, performs no Unicode
normalization, and encodes UTF-8 without BOM or trailing newline. Numbers are safe
integers with no negative zero. Raw wire input rejects decimal/exponent lexemes,
including apparently integral values, rather than rounding or underflowing them.
The strict parser rejects duplicate decoded keys and malformed/unpaired Unicode.
Object inputs reject accessors, cycles, hidden/symbol fields, sparse arrays and
non-JSON host values. JSON property insertion order cannot affect canonical hashes.

`canonicalHash(save, digest)` covers the entire save envelope, including pending
commands, admission cursors, scheduled work, RNG and content/version identity.
It excludes no authoritative state and contains no display timestamp or UI state.
The injected adapter must return a lowercase SHA-256 hex string; the caller owns
the actual cryptographic implementation. Hash equality means equality of this
defined projection, not correctness against the original game.

`ReplayEnvelope.commands` carries execution ticks but no admission times. To
reproduce intermediate pending queues/cursors, the sim-owned `ReplayDocument`
wraps that unchanged envelope with `admissions: {nextTick, commandIndexes}[]` and
`finalNextTick`. Indexes cover the command list exactly once, in append order;
batch boundaries preserve admission transactions. The initial checkpoint's pending
commands are already admitted and are **not** duplicated in the new command list.
The document is a local extension point; it does not silently change shared types.

`ReplayRecorder` owns a private simulation initialized from a checkpoint. Use its
`admitCommands`, `step`, `save`, `checkpoint(digest)` and `document` methods. Record
a hash after all admissions for that tick boundary. A completed checkpoint forbids
further admission at the same tick; advance before admitting again. Hashing reserves
the recorder so racing calls cannot change the captured state. Failed hashing leaves
it reusable. Recording capacity is checked before committing a new admission.

`replay(documentOrTextOrBytes, expectedContent, digest)` validates the wrapper,
reconstructs the initial checkpoint, applies each subsequent admission at its saved
boundary, advances the logical kernel, and checks every declared checkpoint after
that boundary's admissions. It returns the final simulation, ordered events and
verified-checkpoint count. Duplicate command IDs, omitted/reordered admission
indexes, stale/invalid versions, content mismatches and wrong hashes reject.
Checkpoint lists may be empty; zero verified checkpoints is reported as zero,
never as successful cryptographic validation. Replay retains bounded trace output.

## Resource limits and verification

| Resource | Hard limit |
| --- | ---: |
| JSON input/canonical document | 2 MiB; 50,000 values; depth 48 |
| Grid / players / active entities | 128 × 128 / 16 / 256 |
| Pending commands / scheduled work | 4,096 / 1,024 |
| Future command/work horizon | 10,000 ticks |
| One step transaction | 1–1,024 ticks; 32,768 returned events |
| Replay segment | 100,000 ticks; 4,096 commands/admission batches/checkpoints; 32,768 returned events |
| Tick / HP | 1,000,000,000 / 10,000 |

Combined structures also obey the tighter JSON limits. A large initial checkpoint
reduces available replay-recording capacity. Start a new explicitly chained replay
segment from a checkpoint for longer sessions; segment chaining is not implemented
here. Limits reject explicitly, and the transaction tests cover command/work/trace
capacity and counter overflow. Cell occupancy uses a set rather than rescanning the
entire obstacle list for each moving entity.
The maximum tick value names a terminal checkpoint; executable commands/work must
fall below it. Work that would outlive this bound fails without partial advancement.

With Node 24.20.0 and the repository lockfile:

```sh
npm ci
node tools/run-tests.mjs tests/sim
npm run check
git diff --check
```

Eighteen original tests execute movement/combat/reinforcement outcomes, stable
occupancy ties, event ordering and misses, independent integer RNG vectors,
admission/property-order permutations, uninterrupted versus every-boundary restore,
interactive admission-aware replay, checkpoint races, source/version/Unicode/JSON
rejection and transactional resource failures. Synthetic metadata identities in
the test fixture are deliberately distinct from the installed game manifests.
No retail bytes are required or consumed. Cross-browser canonical trace evidence
is the next application-integration gate, followed by real compiled-content,
mission/AI and native behavior work; this slice alone is not a playable campaign.
