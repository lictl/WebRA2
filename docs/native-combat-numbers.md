# Bounded native combat arithmetic

[#147](https://github.com/lictl/WebRA2/issues/147) adds four stateless numerical
stages used by ordinary native damage and reload paths. The implementation lives
in [native-combat-numbers.ts](../packages/sim/src/native-combat-numbers.ts), with
[provenance and native range evidence](../packages/sim/NATIVE_COMBAT_NUMBERS_PROVENANCE.md).
It is not attached to world combat and does not make a retail weapon executable.
Source-bound actor modifiers, firing/death capability and integration remain147,
[#155](https://github.com/lictl/WebRA2/issues/155) and
[#132](https://github.com/lictl/WebRA2/issues/132).

## API and stage boundaries

All functions take one exact plain data record and return a nonnegative integer.
They reject unsupported inputs with `NativeCombatNumberError`; `code` identifies
record/field, integer/factor or conversion-overflow failure. They have no mutable
state, asynchronous work, I/O, randomness, DOM or timing dependency.

| Function | Input fields | Numerical result |
| --- | --- | --- |
| `nativeFirepowerDamage` | damage, houseFirepower, actorFirepower, veteranCombat | Multiply house and actor factors, multiply positive damage, convert; apply veteran factor and convert |
| `nativeArmorAdjustedDamage` | damage, countryArmor, actorArmor, veteranArmor | Divide by the rounded country/actor product and convert; divide by veteran factor and convert; minimum one |
| `nativeZeroSpreadDamage` | damage, verse, maxDamage | Multiply nonnegative damage by Verses and convert; cap at MaxDamage |
| `nativeNormalReload` | rof, houseRof, jitter, veteranRof | Multiply ROF by house factor, add jitter and convert; apply veteran factor and convert |

Every multiply, divide and addition is rounded independently to53 significant
bits toward zero. Integer conversion also truncates toward zero. For example,
using the binary64 input0.58, `nativeZeroSpreadDamage({damage:100, verse:0.58,
maxDamage:100})` returns57. Ordinary JavaScript arithmetic can round an intermediate
upward and return58. Likewise, collapsing the two veteran stages into one expression
can change a result. Exact BigInt rational intermediates preserve these boundaries.

The API accepts binary64 numbers already chosen by source/runtime policy. It does
not parse decimal INI tokens, which have their own native reader/store semantics.
Neutral veteran factors must be explicitly supplied as one when the relevant
ability is inactive. Country armor means the observed type-family country factor,
not an assumption that a generic house Armor field is interchangeable. No default
country/difficulty selection is performed here.

These are separate stages, not an unconditional damage pipeline. The caller must
establish that the actor/weapon/context actually reaches each native branch.
In particular, armor's minimum-one prefix also maps zero to one if that prefix is
entered; this does not authorize a zero-damage weapon hit. Verses can subsequently
produce zero. Later immunity, prone/derived-class logic and death effects can still
change the result and must not be silently skipped.

Reload takes a supplied0..2 jitter value. The
[native random component](native-random.md) preserves every rejected draw, and the
world integration must define and save when sampling happens. Passing a value here
does not certify its provenance or native global call order. A zero reload result
is valid arithmetic; world scheduling must define how it is represented. Burst
intervals, occupied/open-topped/transport modifiers, special attacks and native
post-reload adjustments require separate capabilities.

## Bounds and data safety

`NATIVE_COMBAT_NUMBERS_POLICY` is `webra2-native-combat-numbers-1`.
`NATIVE_COMBAT_NUMBER_LIMITS` fixes integers to0..2147483647 and nonzero factors to
1/65536..65536. Fire damage and MaxDamage must be positive; other integer inputs
may be zero. Armor factors must be positive; firepower, Verses and ROF factors may
be zero. Jitter is exactly0,1 or2. Values outside these bounds fail explicitly.
These are WebRA2 admission limits, not a claim that original INI rules enforce them.

Products/quotients in the admitted domain stay normal binary64 values with bounded
exact rational work; they cannot encounter subnormal or exponent-overflow rounding.
Each operation has a fixed number of at-most-hundreds-of-bits BigInt operations.
An intermediate signed32 conversion overflow fails even if a later multiplier or
maximum could reduce the final value. Native indefinite/overflow conversion behavior
is outside this policy. Negative/healing values and changes to the observed startup
floating mode are also unsupported.

Inputs use exact own enumerable data descriptors with the ordinary or null object
prototype. Extra/missing fields, symbol keys, getters, coercible objects, strings,
BigInts, fractions in integer positions, negative zero, NaN and infinities reject.
Inputs are never changed and no caller-owned object is retained. Reflection traps
can execute on proxies; a thrown trap becomes a component error. This boundary is
validation of imported data, not a JavaScript execution sandbox.

## Validation

Seven original tests compare24,000 stage results against an independent Python
Fraction oracle; cover stage order, default-rounding counterexamples, zero/minimum/
maximum cases, signed32 and factor boundaries, intermediate overflow, malformed
records and ownership. Public checks require no game assets:

```sh
node --import tsx --test tests/sim/native-combat-numbers.test.ts
npm run check
```

Private `local/combat-modifiers/arithmetic-oracle.py` regenerates the original
rational vectors; `arithmetic-ledger.py` rehashes the pinned images and verifies18
complete native spans using Capstone5.0.6. Only metadata, original code and synthetic
fixtures are distributed. No original game run, campaign outcome, actor capability,
world save/replay integration or browser attack acceptance is claimed by this slice.
