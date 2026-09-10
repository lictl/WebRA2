# Ordinary numerical world combat

[Issue164](https://github.com/lictl/WebRA2/issues/164) connects reviewed
[numerical stages](native-combat-numbers.md) and the
[native random primitive](native-random.md) to the existing [combat core](world-combat.md).
It is an executable numerical policy for original test worlds. It does not enable
retail attacks: authenticated actor/firing eligibility, dynamic impact/effect context
and ordinary death handling remain147/132/163. No original mission is playable.

## Model boundary

`createOrdinaryCombatRules` accepts an explicit uint32 seed, complete per-actor
house/current/veteran firepower, country/current/veteran armor and house/veteran
reload factors, plus complete weapon MaxDamage bindings. Zero is permitted for
firepower/reload coefficients; armor divisors must be positive. Nonzero factors
are within1/65536..65536. The factory owns/freeze its inputs; exact binary64 hex
strings enter the integer-only canonical engine identity while numeric values stay
privately owned. There is no implicit seed, source default or difficulty choice.

Pass the genuine result as `ordinary` to `createCombatModel`. The model factory
requires exact actor/weapon ID coverage, ground actors, instantaneous delivery and
Burst1. It checks every source-slot/target damage combination and every0/1/2 reload
outcome before publishing the model. Positive weapon damage that becomes zero at
the firepower stage is excluded because its native downstream branch is not proven.
Zero Verses remain supported and prevent ineffective targeting. Overflow rejects;
results are never silently saturated during numerical composition.

Damage follows reviewed firepower products/conversions, country/current armor
and veteran division/minimum, then Verses/conversion/MaxDamage. Actual health loss
is bounded by remaining health. This core policy still destroys immediately; the
source-authenticated death-sequence lifecycle is a separate next integration.
Factors are immutable for this model version; experience, crates, promotions,
prone/transport/occupation and special statuses cannot silently change them.

The new policy is `webra2-ordinary-numbers-combat-1`, engine`webra2-world-3`.
The original `webra2-cell-combat-1` mode and movement-only mode retain their
schema, rules, hashes and numerical behavior.

## Tick and save behavior

World commands/navigation/movement retain their existing phases. Eligible actors
fire in stable entity-ID order, at most once per actor per logical tick. On each
committed shot the shared explicit reload stream consumes the reviewed inclusive
0..2 sample, including rejected words, then applies the reviewed normal reload
arithmetic. Zero computed reload remains zero; a second shot still waits for the
next world update. This is a named WebRA2 ordering/cadence, not proof of original
global random-call order or animation timing.

A rejected order, out-of-range or ineffective target, empty ammunition, cooldown,
Stop or movement consumes no reload words. Stop/move clear targeting but retain
cooldown, ammo and random state. Each shot emits `reload-sampled` with the jitter
value in the bounded world trace. Random draws are charged as logical combat work;
validation/serialization cost is bounded separately and is not a CPU measurement.

Saves own all250 uint32 words, both indices and the total number of advances.
Restore checks the stream policy, index separation, disabled=false, draw-count
horizon/index and exact seeded state when no draw occurred. Nonzero saves receive
structural validation, not proof of every historical random draw. Replay executes
admissions and compares the complete final state hash. Wrong model/seed/version,
missing state, malformed ring and inconsistent cursors reject before publication.
Whole-step work/trace failures preserve the prior world and generator state.

## Bounds and evidence

Rules cap2048 actors,1024 weapons,131072 pair evaluations,1048576 model work units
and10000 reload ticks. Callers may lower limits only. The existing world canonical,
command, trace and step limits remain. Core combat also caps4096 shots and16384
logical operations per tick; native rejection is bounded by251 words per sample.

Eight original integration tests cover both profiles; staged damage/capping,
reload rejection vectors, zero reload, absent-shot cases, explicit actor ordering,
stop/restart, whole-ring save/replay, corrupt state, hostile records and model bounds.
The14 existing combat tests continue to cover the unchanged original policy. These
are synthetic execution checks, not retail gameplay validation. Numerical/native
static evidence belongs to the already reviewed primitive ledgers; no new retail
rows, native listings or assets are published.

The new composition module is original GPL-3.0-or-later code under the existing
[numerical provenance notice](../packages/sim/NATIVE_COMBAT_NUMBERS_PROVENANCE.md).
The core's original MIT files retain their license; combined distributions include
the GPL component notices, license and applicable corresponding source.
