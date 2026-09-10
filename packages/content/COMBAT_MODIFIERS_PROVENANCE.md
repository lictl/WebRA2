# Campaign house modifier provenance

[combat-modifiers.ts](src/combat-modifiers.ts) and its synthetic tests are original
WebRA2 code, Copyright 2026 WebRA2 contributors, **GPL-3.0-or-later**. No additional
external implementation or dependency is adopted. The compiler composes the reviewed
[actor initialization](COMBAT_ACTORS_PROVENANCE.md),
[scenario construction](CONSTRUCTION_PROVENANCE.md),
[retained INI view](INI_SOURCE_PROVENANCE.md) and
[weapon numerical reader](WEAPON_DEFINITIONS_PROVENANCE.md).
Distributions retain this notice, the [GPL text](../../LICENSES/GPL-3.0-or-later.txt)
and applicable corresponding source under [the licensing policy](../../docs/licensing.md).
No retail source rows, native bytes or disassembly are distributed.

The result is typed source state with explicit campaign difficulty application.
It is not an executable actor capability or a reconstruction of current dynamic
house/actor state. See [the component policy](../../docs/combat-modifiers.md).

## Native evidence

Static observations use the supplied Steam Traditional Chinese images:

- `game.exe`, 5,077,312 bytes, SHA-256
  `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`.
- `gamemd.exe`, 5,286,208 bytes, SHA-256
  `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.

Historical build labels remain unverified. The following 13 complete instruction
spans cover 3,023 bytes, verified through PE mapping and Capstone 5.0.6. Selected
constructor/load intervals are not whole-function coverage. No retail program ran.

| Profile | Arithmetic evidence | VA start–end (exclusive) | File offset | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| ra2 | country constructor scalar defaults | 0x4f90f0–0x4f91fc | 1020144 | 268 | `4ec603ffa5efc69a6c7505fc40c213f7bb8ae8cfbee1e856804df34a839345c5` |
| ra2 | country current double reads | 0x4f9671–0x4f9722 | 1021553 | 177 | `2ee8dc827732c1eec1e55f4c5bbb13f76538db51c520c20767347b3e0bd4e8dc` |
| ra2 | country family float reads | 0x4f97ba–0x4f97fe | 1021882 | 68 | `f0412807735532e9a42f7bebd9acc0f1e4d2bfc36bbcef50220d32fcf65b8f1a` |
| ra2 | difficulty section dispatch | 0x64db10–0x64db55 | 2415376 | 69 | `7df5b178cbb186ca194f067c6571c8b5ad78f71672a0f9f87bfb80c96d34f2ad` |
| ra2 | difficulty existing section reset reads | 0x64db60–0x64dc8e | 2415456 | 302 | `a6fe2651225bcd6090ddf60272ecfa99ef0a6872003700f248bd64a121b363bd` |
| ra2 | ReadFile difficulty call | 0x643afe–0x643b06 | 2374398 | 8 | `bb02d17acffc35dd61124741985d3fe48cabb7a6aef4be8371f2471400e48a99` |
| ra2 | campaign and other mode house application | 0x4e2e40–0x4e30b6 | 929344 | 630 | `b844f56856e093bb2436e01a3f7659e45daf82ef95f7312c8d88042b503030d1` |
| yr | country constructor scalar defaults | 0x5113f0–0x5114fc | 1119216 | 268 | `c62fc24a18f8ecf0d692485cab450a736fe8de4223bb8c126edf994e5a63ceb5` |
| yr | country current double reads | 0x51197a–0x511a2b | 1120634 | 177 | `1b274e52835f4f13bba8a8d0347f3811c339434caf36fa40c8a684aac03b3862` |
| yr | country family float reads | 0x511ac3–0x511b07 | 1120963 | 68 | `be4dd2060a8352ec7c95f3d32f711b8836edca13446afbb509ddba479fac3c54` |
| yr | difficulty existing section reset reads | 0x66d270–0x66d39e | 2544240 | 302 | `bad4d9a688fda0e5b51e2754224df8f585d45d13e5b50f7134e2b31049eb6df9` |
| yr | ReadFile inline difficulty dispatch | 0x668ef5–0x668f2b | 2526965 | 54 | `fcf147ca43584306064cefd77c8d0ae8143a5fa7a3e7b27e024a3754f9665225` |
| yr | campaign and other mode house application | 0x4f6ec0–0x4f7138 | 1011392 | 632 | `a44b71ef8f4a521b51b267f9fe8d0168cb1cb8f993c25a674ffd1ddd99a9bf46` |

The private metadata ledger also verifies 18 null-terminated field/section literals
at the operands used by these readers. Exact field spellings are listed below;
this is metadata, not a published byte extraction. Combined ledger SHA-256:
`da30df3abddd31f88cd6731a52dbc9fe40259cbf6a85de2622377ccea24dca1b`.

| Reader field/section | RA2 VA | YR VA |
| --- | --- | --- |
| Country Firepower | 0x7d3810 | 0x81d9c0 |
| Armor | 0x7d3824 | 0x81d9d4 |
| ROF | 0x7dae30 | 0x825478 |
| ArmorInfantryMult | 0x7dadd4 | 0x82541c |
| ArmorUnitsMult | 0x7dadc4 | 0x82540c |
| Difficulty FirePower | 0x7f1b0c | 0x83b3f8 |
| Easy | 0x7ceaec | 0x818134 |
| Normal | 0x7d1b30 | 0x81bb60 |
| Difficult | 0x7f1ac8 | 0x83a0c4 |

Both country constructors initialize the three general doubles at +0xc8/+0xe0/
+0xe8 and the infantry/unit armor floats at +0x100/+0x104 to one. Country property
reads pass the current value as ReadDouble's default; the two family factors store
back to float32 under the observed truncation mode. These are the country's own
loaded properties. ParentCountry remains a declared identity reference inherited
from the construction component, not an instruction to synthesize inherited stats.
Current runtime country selection remains a separate prerequisite.

Difficulty indices 0/1/2 address Easy/Normal/Difficult in that order, with record
stride 0x50. A missing section leaves the record untouched. An existing section
reads FirePower, Armor and ROF with the constant default one, so omitted or empty
values reset those fields; they do not retain an earlier explicit value. The
compiler preserves unknown initial state until the first such section is visited.
RA2 ReadFile calls the three-section helper; YR inlines those three calls. Both
pass the incoming rules/map INI. Ordered source stages and country registration
visits come from the upstream reviewed construction policy.

House SetDifficulty branches on Session.GameMode. Its campaign branch (zero)
copies difficulty FirePower, Armor and ROF to house state. The other branch
multiplies those fields by the country's general counterparts. This compiler
implements only the campaign copy branch, with explicitly supplied per-house
indices. It does not choose indices from human/AI flags, assume parent-house state,
process original carryover or import a Windows save.

Generic firing consumes the house Firepower value, and ordinary GetROF consumes
house ROF. The reviewed
[arithmetic provenance](../sim/NATIVE_COMBAT_NUMBERS_PROVENANCE.md) separately pins
those consumers and the country family armor selector. Ordinary ReceiveDamage
uses the country's family armor factor multiplied by actor armor; this is distinct
from generic stored house Armor. No claim is made that house Armor is unused in
all native paths or that fresh actor factors always remain one.

## Separate checks

Private `local/combat-modifiers/house-probe.ts` revalidates the selected physical
rules/art/mission source pins, constructs genuine upstream results and compiles
all three explicit difficulty-index configurations for both openings. An
independent Python raw-INI pass reconstructs country registration/property visits,
name/ID house lookup, difficulty resets and numerical fields. It matches 999
numeric field comparisons: 462 RA2 and 537 YR, covering 21/17 countries and 8/17
houses over three configurations. All selected fields are present; that is a data
coverage result, not executable combat admission. The original tests independently
cover missing sections, malformed values, allocation timing, inherited-reference
boundaries, source guards and immutable results.

Private scripts and results stay ignored. Numerical field comparison does not
independently certify every upstream identity/provenance scalar; those bindings
retain their prior component reviews and are validated again at this boundary.
No actual original mission, dynamic actor state, browser combat or victory path
was tested by this source compiler.
