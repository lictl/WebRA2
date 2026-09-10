# Combat veterancy provenance

The original source compiler, four-consumer selector and fixtures are
GPL-3.0-or-later. This component contains functional ability identifiers and public
factual metadata; retail INI rows, executable bytes and native listings remain in
ignored local research. No bundled executable was run.

Pinned primary interface references are
[YRpp TechnoTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoTypeClass.h),
[TechnoClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoClass.h)
and [RulesClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h).
These supply field/interface names; the two pinned native images establish the
specific readers, defaults and consumer conditions below. Existing
[actor initialization](COMBAT_ACTORS_PROVENANCE.md) proves type/source property
visits, and [weapon numerical reads](WEAPON_DEFINITIONS_PROVENANCE.md) supplies the
separately reviewed decimal/percent reader. Header storage layouts are not applied
indiscriminately to both profiles.

RA2 game.exe SHA-256:
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`.
YR gamemd.exe SHA-256:
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
The private ledger verifies entire image hashes before PE mapping and requires
complete x86 instructions in all code intervals.

## Observations and admitted behavior

Both type constructors clear two independent 18-byte ability sets. Property reads
pass the current set as default to a 128-byte string reader. Missing/empty reads
retain it; nonempty reads clear every flag, then split commas only. Empty tokens
are skipped. The name lookup compares case-insensitively against 18 identities;
unrecognized tokens set no flag. Whitespace inside a comma token is not stripped
by this helper. The compiler admits printable ASCII strings up to127 characters;
longer or other character input is explicitly unsupported rather than guessed.

Fresh Rules constructors initialize VeteranCombat, VeteranArmor and VeteranROF to
one. Exact General property reads use their current double values as defaults.
The compiler retains field histories and unknown numerical values. Only selected
active consumers use these scalars; an inactive ability does not require its factor.

RA2 stores live Veterancy as binary64, while YR uses binary32. Both inspected
predicates select veteran for values at least1 and below2, and elite at least2.
Negative/rookie values activate none of the four covered consumers. The selector
accepts bounded finite current values, requires an exactly representable float32
for YR, and rejects negative zero. It does not round or accumulate experience.

For FIREPOWER, STRONGER, ROF and EXPLODES, veteran actors consult the veteran flag;
elite actors consult veteran OR elite. This union is established independently
in each of the four consumers. It is not a general execution rule for all18
abilities. The other flags are retained as source data only. Unknown flags remain
three-valued: a proven true branch can establish an OR result; otherwise unknown
cannot silently become false. The selector reports factors and effective flags,
not permission to fire or execute an explosion.

The native numerical stages are separately implemented by
[bounded combat arithmetic](../sim/NATIVE_COMBAT_NUMBERS_PROVENANCE.md). Current
actor firepower/armor, rank initialization/experience, firing authorization,
branch context, damage/death effects and world integration remain separate.

## Native evidence ledger

25 complete code spans total7,539 bytes. The private ledger additionally checks
56 data records: two pointer tables,36 ability strings, six rank constants and12
field/delimiter literals. The ledger SHA-256 is
`69a3058fecb425ecfcdc5627ca83ef73e005b5d44bc145da78c60c5fc7b02ed8`.
The long Rules intervals begin at constructor entry and retain the zero-register
initialization used by the later default stores. Comparison-prefix rows cover the
ASCII branch; non-ASCII input is excluded. Offsets/sizes are decimal.

| Profile | Evidence | VA range (exclusive end) | File offset / bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| ra2 | type ability constructor | `0x6d9b40–0x6d9bb3` | 2988864 / 115 | `ee85da4699f5ba06e3b41ab556b9bef18cdddb8646ccdcd48ab7a7a4dec8bc4c` |
| ra2 | type ability property reads | `0x6dd64f–0x6dd6cb` | 3003983 / 124 | `fb192cb619ac9ec75accbc7fa73e3e8adee0992c3997667eb85f36c4bec523a4` |
| ra2 | ability reader | `0x46ca80–0x46cb75` | 445056 / 245 | `50ac3ecddec19478ca18443315174b1b4854abcdbb7538d1b10de06fd5b33f56` |
| ra2 | ability name lookup | `0x713300–0x713335` | 3224320 / 53 | `77f45d6ddfc924dad8e0a57edeae4dbeb13876ae3a7f63918fe21e5479424d10` |
| ra2 | ASCII case comparison prefix | `0x781f20–0x781f73` | 3677984 / 83 | `4fd266dc9566f9a9fd782eb0534014e48f616a15fecbe09d36563de26bbd5da8` |
| ra2 | Rules constructor to veteran defaults | `0x640b80–0x6413b1` | 2362240 / 2097 | `ce16b7939a4f558698ddc14d080fc66f8a56d72208559fa312f4703455201732` |
| ra2 | General veteran factor reads | `0x648713–0x6487d6` | 2393875 / 195 | `39cab9a69691deaf8f3cd052803bccf47ee1ed61f20e027c9596917a155019ca` |
| ra2 | double rank predicates | `0x7133a0–0x713438` | 3224480 / 152 | `69bffa2dad770ed0246849d1be13d3041bba46cc9d1a11a5391c41bc37f2424e` |
| ra2 | firepower ability selection | `0x6cabcd–0x6cac65` | 2927565 / 152 | `97aee71bc21e290e82638c7bc56acfa501eb65c65325e54d6620e8c4e6645528` |
| ra2 | armor ability selection | `0x6cdca6–0x6cdd18` | 2940070 / 114 | `9cf3dd366a75acd517d3d16ab6907286ddf1bf0a28db122e129f967d2719d4fd` |
| ra2 | reload ability selection | `0x6c9cfe–0x6c9dac` | 2923774 / 174 | `7aa7a241d6f5f62e2037e92f213912fc7aa107428e2b7f03237cec7a1a2580fc` |
| ra2 | death explosion ability selection | `0x6ce5fe–0x6ce65a` | 2942462 / 92 | `32ab61a7c7f24d181721c91fd86b7d323bdb57d5fe377caf5c73e70b7eeebcf0` |
| yr | type ability constructor | `0x710af0–0x710b5e` | 3214064 / 110 | `bf1f19ffc4505c76953e28932311821bfe6f29404ac2d394931b07b8d0e278f3` |
| yr | type ability property reads | `0x71549a–0x71551e` | 3232922 / 132 | `f811031a034825426902012609b41db68b05bb37707a5e954c214e8ae4bf09f0` |
| yr | ability copy helper | `0x7179d0–0x717a21` | 3242448 / 81 | `6b86a0ecf479383ccec7d75a705ad047b582097374d6ea9671f5dd313959cc79` |
| yr | ability reader | `0x477640–0x477735` | 489024 / 245 | `76e76c1c6fd694e70414ae0b4f6ec34e5fcaab2ed7771088ed7041ecfa7a22ce` |
| yr | ability name lookup | `0x74fef0–0x74ff25` | 3473136 / 53 | `65f238866e4ae608613e6e82b0592f6cfe3df352601359922b1210e25447414d` |
| yr | ASCII case comparison prefix | `0x7c8d20–0x7c8d73` | 3968288 / 83 | `dc039f50cd66d642afa111cf40f0fb8e52e3442e9375a2228555028cc0a8556e` |
| yr | Rules constructor to veteran defaults | `0x665650–0x665f92` | 2512464 / 2370 | `dfaa6da2524f6428f8d53d973bf8e5df78f3b1b7b7e33be65ef5bc5a295472f5` |
| yr | General veteran factor reads | `0x66eeb6–0x66ef74` | 2551478 / 190 | `75b67c710b471dca66ef3868a200069afcd3d748aacfd8287f15a1292bf07210` |
| yr | float rank predicates | `0x74ff90–0x750028` | 3473296 / 152 | `022e06020ee0dd11fe585320385ac2d27f38d3d67779a45938ab5a9058c97758` |
| yr | firepower ability selection | `0x6fe354–0x6fe3e3` | 3138388 / 143 | `5676a796b2b01cd9717509c39351cd2b3668434aaec687b29307288ce72ad2c6` |
| yr | armor ability selection | `0x701966–0x7019d8` | 3152230 / 114 | `d4579df31d0dc7b4bb44596706ed31bb40dd2de91da3691f8c32483d633af085` |
| yr | reload ability selection | `0x6fd09e–0x6fd150` | 3133598 / 178 | `74fd5b04023294127048c6f1e8afc4d0b0163ef07daf139f74ea7c5483737f6f` |
| yr | death explosion ability selection | `0x702599–0x7025f5` | 3155353 / 92 | `0be289492b96f0a39217bff13a8a4116a3364b0bf604647a057f5fd880e41f5c` |

Private values and listings live in `local/combat-modifiers/`. The read-only probe
imports source bytes through verified physical-source readers. Its independent
Python value parser uses the separately reviewed construction identities/visit
stages as inputs, then reparses each consumed value directly from raw rules/map
bytes. It compares67,602 ability/numeric/selection/history scalars over531 RA2
and691 YR types, plus1,652/2,268 explicit rank selections. It does not independently
re-prove all upstream type allocation or original campaign behavior.

[API and limits](../../docs/combat-veterancy.md).
