# Native combat arithmetic provenance

[native-combat-numbers.ts](src/native-combat-numbers.ts) is original WebRA2 code,
Copyright 2026 WebRA2 contributors, **GPL-3.0-or-later**. The implementation uses
exact BigInt arithmetic to express the documented numerical stages; it contains
no copied native code, tables or game data. Original synthetic tests are MIT.
No new external implementation or dependency is adopted. Combined distributions
retain this notice, the [GPL text](../../LICENSES/GPL-3.0-or-later.txt) and applicable
corresponding source under [the distribution policy](../../docs/licensing.md).

This is a numerical component, not a source-authenticated actor capability. It
consumes caller-supplied factors and does not choose source defaults, countries,
difficulty, veteran abilities, commands, attack eligibility or death behavior.
The [component policy](../../docs/native-combat-numbers.md) specifies those limits.

## Pinned evidence

Static observations use the supplied Steam Traditional Chinese installation:

- `game.exe`, 5,077,312 bytes, SHA-256
  `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`.
- `gamemd.exe`, 5,286,208 bytes, SHA-256
  `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.

Historical build labels are unverified. PE mapping and Capstone 5.0.6 cover the
following 18 complete instruction spans / 2,331 bytes. These are selected code
intervals, not a claim that complete functions or all branch prerequisites have
been implemented. The two armor family selectors stop before their embedded
switch tables. Private disassembly, source payloads and scripts remain ignored in
`local/combat-modifiers/`. No retail program was executed.

| Profile | Arithmetic evidence | VA start–end (exclusive) | File offset | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| ra2 | positive firing multipliers | 0x6caba8–0x6cac65 | 2927528 | 189 | `6b137e1f989b6e607ad669667603f3d9fe41ef74052a1526507bac6ce6fa442c` |
| ra2 | armor adjustment and minimum | 0x6cdc40–0x6cdd23 | 2939968 | 227 | `e94f0fefe436eb196e040d00ac805f6edc7edd3226c28b14552299dc2b273534` |
| ra2 | zero spread verses and maximum | 0x47e1c0–0x47e2ad | 516544 | 237 | `fb9a8ffcee69e08a494f60939c7bc3f980e6362b9a7e917d14a359f2e26b400b` |
| ra2 | normal reload and veteran stage | 0x6c9cfe–0x6c9dac | 2923774 | 174 | `7aa7a241d6f5f62e2037e92f213912fc7aa107428e2b7f03237cec7a1a2580fc` |
| ra2 | country armor family selector | 0x4f58a0–0x4f5920 | 1005728 | 128 | `0d960aaa244f44d1c14371b153bb826e23da70f5f98f8b401961ebce1a574e31` |
| ra2 | CRT precision selection | 0x786d3f–0x786d51 | 3697983 | 18 | `7135ff9c1e93b0333b8c70520eaa28b03ee2aa1435de78eefa90f4666707e8f1` |
| ra2 | control mask mapping | 0x785152–0x7851a5 | 3690834 | 83 | `f12aa892a62eb1fe7798075218cd0029c2285ecc6b05f1fd2dc0a57b39ba0430` |
| ra2 | integer mode capture and conversion | 0x77f0f4–0x77f14d | 3666164 | 89 | `3a932e1747da885d7e9df2653e805c2119a751390cae8c66fda73682e188a4d4` |
| ra2 | startup rounding selection | 0x68e894–0x68e8ab | 2680980 | 23 | `fcc276dd2ad4a6f5aa438ce25f9c4f07cea0e4d91bfd7011963c8006853f0c3a` |
| yr | positive firing multipliers | 0x6fe32f–0x6fe3e3 | 3138351 | 180 | `7bf41441aae6eb018880ee9da9e703b281f4b07272abe06255ea1ad55936cfb0` |
| yr | armor adjustment and minimum | 0x701900–0x7019e3 | 3152128 | 227 | `2059691cf2a4f43b6b912ddf3edc0519ad48ba907fad38159b1ecdd21b1a1514` |
| yr | zero spread verses and maximum | 0x489180–0x48926d | 561536 | 237 | `07254fca878b07c43de371ae141a28d08cec8666b0e90b58ac43a36c6832d047` |
| yr | normal reload and veteran stage | 0x6fd09e–0x6fd150 | 3133598 | 178 | `74fd5b04023294127048c6f1e8afc4d0b0163ef07daf139f74ea7c5483737f6f` |
| yr | country armor family selector | 0x50bd30–0x50bdb0 | 1097008 | 128 | `30e0fefd532fa3336fdb763d943ff48177150f37cb5bc168f24d0d7d1a85efd3` |
| yr | CRT precision selection | 0x7ceaaf–0x7ceac1 | 3992239 | 18 | `a435c3502afdcc78f0cdb6eacc50f6ae8d22b36ffbb2807460a0e2dbf0b6f2cd` |
| yr | control mask mapping | 0x7cc052–0x7cc0a5 | 3981394 | 83 | `f12aa892a62eb1fe7798075218cd0029c2285ecc6b05f1fd2dc0a57b39ba0430` |
| yr | integer mode capture and conversion | 0x7c5ee4–0x7c5f3d | 3956452 | 89 | `d927f430d92cd08ecbc205183bac24a700d1d2582fe850dfcfa05bbb338331b3` |
| yr | startup rounding selection | 0x6bbfb7–0x6bbfce | 2867127 | 23 | `1cc17755e4de39a8845899a82b3cab88cce22a7eae2044c6477122bb41dedfdf` |

The metadata-only ledger SHA-256 is
`6a87950361526cb32d16a332e5be0535ac426297863034943497b814ac71d71b`.
Startup precision/control-word observations are also recorded in the reviewed
[weapon numerical provenance](../content/WEAPON_DEFINITIONS_PROVENANCE.md).
The [instant context evidence](../content/INSTANT_WEAPONS_PROVENANCE.md) establishes
the zero-spread Verses/MaxDamage stage; the
[random primitive](NATIVE_RANDOM_PROVENANCE.md) separately establishes normal
reload jitter. This module neither samples random state nor schedules shots.

## Interpretation

Positive ordinary firing multiplies the owner's current Firepower value by the
actor's current Firepower value, then multiplies the integer weapon damage and
converts to an integer. Applicable veteran/elite firepower modifies that converted
integer and converts again. A single final multiply-and-floor loses an observed
rounding boundary. Ability eligibility is a caller obligation, with factor one
representing an inactive stage.

The nonnegative, defenses-enabled ReceiveDamage prefix obtains a type-family
armor factor from the owner's country type, multiplies it by actor armor, divides
the incoming integer and converts. Applicable veteran armor divides that integer
and converts again. This prefix then enforces a minimum of one, including for a
zero input that actually reaches it. Later native branches can still cancel or
change damage. This is not a claim that a zero-damage weapon causes a hit.

For the nonnegative, active-warhead, zero-CellSpread GetTotalDamage path, radial
interpolation is skipped, then Verses multiplies the integer and converts before
the configured maximum is applied. Zero input and zero Verses produce zero in
this numerical helper. Negative damage/healing, scenario flags bypassing damage,
immunity, prone/derived-class adjustments and all nonzero spread are outside it.

The ordinary GetROF branch samples inclusive 0..2 jitter, multiplies weapon ROF by
owner ROF, adds that sample, converts to an integer, and applies an eligible
veteran ROF multiplier with another conversion. This helper takes the already
sampled integer; it cannot consume too few random words by reimplementing rejection.
Burst-delay branches, special weapons, occupation/transport and later profile-
specific adjustments are excluded. Neither a minimum one-tick delay nor a world
timer is added by the numerical helper; its valid result can be zero.

Every floating operation in this policy uses 53 significant bits and truncation
toward zero under the observed startup mode. Supported positive factors are
bounded to 1/65536 through 65536, with zero allowed only for multiplicative inputs.
Inputs and each integer conversion stay in the nonnegative signed32 domain.
Overflow, negative values, extreme/subnormal factors and later native control-word
changes are outside this bounded policy; they are not emulated or silently clamped.

A separate Python Fraction oracle generates 6,000 original cases, 24,000 integer
stage results, including adjacent binary64 factors and zero values. Packed
little-endian uint32 output SHA-256 is
`d2107ca719917930d6fa98684287dc002b117a5793ec520b07506e8a2f234402`.
The oracle retains exact rational operations and quantizes after each operation;
it does not use the TypeScript implementation or default floating-point rounding.
These arithmetic comparisons are distinct from live original-game validation.
Public fixtures retain the deterministic generator and independently generated
digest, plus explicit counterexamples where JavaScript's default rounding differs.
