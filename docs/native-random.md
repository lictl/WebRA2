# Native Scenario random state

[#151](https://github.com/lictl/WebRA2/issues/151) adds a standalone deterministic
primitive for the identical random algorithm observed in the two pinned RA2/YR
images. It accepts an explicit uint32 seed and preserves complete logical state.
It is not attached to the world, original practice RNG or combat scheduling.
The [provenance notice](../packages/sim/NATIVE_RANDOM_PROVENANCE.md) identifies the
licensed source, native ranges, mathematical bound and independent comparisons.

## API

Import from [native-random.ts](../packages/sim/src/native-random.ts):

| Function | Result |
| --- | --- |
| `createNativeRandom(seed)` | Frozen factory state; explicit integer seed 0 through 0xffffffff, including high-bit seeds |
| `restoreNativeRandom(value)` | Validated, detached state from a complete logical save object |
| `isNativeRandomState(value)` | Factory-identity predicate; frozen lookalikes and proxy wrappers are not authenticated |
| `nextNativeRandomWord(state)` | Frozen `{value, drawCount, state}` with a uint32 word |
| `nextNativeReloadJitter(state)` | Frozen `{value, drawCount, state}` with value 0, 1 or 2 |

The logical save shape is `{policy, disabled, index1, index2, words}`. Policy is
`webra2-native-random-1`; `words` has exactly 250 uint32 integers, both indices are
0–249 and `index2 === (index1 + 103) % 250`. Guard `disabled` must be a boolean.
Normal JSON serialization is sufficient to export this logical state; restore
accepts the decoded object, not JSON text. Seed-only restores, extra fields,
symbols, non-finite/fractional numbers, negative zero, sparse words, typed arrays,
non-data/accessor fields and incorrect index separation fail explicitly.
Ordinary plain objects with the normal or null prototype are accepted. Restore
copies validated descriptor values; it does not evaluate field getters. JavaScript
proxies can run their own reflection traps, so this is data validation, not a
sandbox for arbitrary mod JavaScript. Failed reflection rejects without returning
a partially authenticated state. Operations on existing states accept only the
factory brand and do not invoke proxy traps.

All state/result objects and word arrays are frozen. Restore owns a separate copy;
edits to caller input cannot affect continuation. Draws create a new owned state
when active, leaving the previous state usable as a checkpoint. A true disabled
guard returns value zero, drawCount zero and the unchanged immutable state. Native
padding, a cumulative audit counter and session/profile labels are not algorithm
state. Both observed profiles use the same policy without an artificial difference
in their generated words.

## Arithmetic, work and persistence

Seed expansion performs exactly 250 × 4 rounds using explicit wrapped 32-bit
products and signed high-word shifts. Full words are returned unsigned; native
signed integers have the same bits. Active next-word calls advance the two indices
once and report drawCount one. Active jitter calls mask each word with 3 and retry
when the value is 3. The returned count includes rejected words. Modulo three and
one-draw substitutes change both the distribution and future state.

Each draw copies at most 250 words. Jitter mutates one private copy for at most 251
advances before returning. Strict index separation makes this bound sufficient for
every accepted restored state; the [proof](../packages/sim/NATIVE_RANDOM_PROVENANCE.md)
and extremal fixtures cover all rotations. A failed validation/operation cannot
modify an existing state. The API has fixed caps and no user-raised retry budget,
clock, entropy source, I/O or asynchronous work. Caller-owned raw inputs already
exist before validation; exact own-key checks may inspect their extra keys before
rejecting them. Accepted state size and algorithm work are fixed.

Save/replay consumers must preserve all words, both indices and the guard. They
must define when requests occur and retain each resulting state. Original native
seed selection and global call order are distinct concerns: render queries,
rejected commands, animations, actors and loading can otherwise change later
outcomes. The observed normal ROF draw is part of native firing, not a harmless
getter for a display. This component makes no native mission timing claim and
does not interpret original binary save layouts. Further scheduling integration is
tracked by [#132](https://github.com/lictl/WebRA2/issues/132) and
[#147](https://github.com/lictl/WebRA2/issues/147).

## Validation

Twelve original public tests cover 160,000 independently generated seeded samples
and state digests, all 250 extremal 251-draw rotations, rejection state advances,
disabled state, interleaved word/jitter save and structured-clone continuation,
owned/frozen results, zero/all-one states, wrapping indices and malformed inputs.
No retail file is needed for these tests:

```sh
npm ci
node --import tsx --test tests/sim/native-random.test.ts
npm run check
git diff --check
```

The separately labeled private check rehashes the native files/ranges, verifies
both source table copies and compares the implementation against separately
compiled licensed C++ and Python arithmetic. It matches 223,500 scalar values,
including every extremal final state. Scripts and raw observations remain in
ignored `local/native-rof-research/` in the author worktree:

```sh
python3 local/native-rof-research/vectors.py
# Use the private Python environment with Capstone 5.0.6:
python local/native-rof-research/ledger.py
node --import tsx local/native-rof-research/verify.ts
```

The private native range gate is separate from public tests and requires the
hash-pinned installation. Missing source files mean that gate is unavailable;
they do not make a campaign compatibility test pass. No retail program, game save,
asset payload, disassembly or screenshot is distributed.
