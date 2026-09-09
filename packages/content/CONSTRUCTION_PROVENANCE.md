# Scenario construction provenance

[scenario-construction.ts](src/scenario-construction.ts) and its
[synthetic tests](../../tests/content/scenario-construction.test.ts) are original
GPL-3.0-or-later WebRA2 code. The immutable-input guard follows the existing
GPL component [scenario-bindings.ts](src/scenario-bindings.ts). No proprietary
implementation, extracted row, header body or binary bytes are copied into the
component. No new runtime dependency is adopted. See
[licensing](../../docs/licensing.md) and the [component scope](../../docs/scenario-construction.md).

## Primary reference and method

The pinned primary YRpp revision is
[`61d0887eb6040cfb36af16d592e9770ceae4dfb2`](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2).
[HouseClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/HouseClass.h),
[HouseTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/HouseTypeClass.h),
[AbstractTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/AbstractTypeClass.h),
[RulesClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h)
and [CCINIClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CCINIClass.h)
provide address/structure hypotheses. Local static caller and field inspection
corroborates the bounded interpretations below. Header labels alone do not prove
behavior: notably the RulesClass description of `Read_File` omits member-section
loads, while both supplied executable paths call the subsequent type-property
loader after registration. The native bytes take precedence for that observation.

Private Python 3.14.7 / Capstone 5.0.6 tooling reads PE section mappings and verifies
whole-executable SHA-256 before decoding bounded x86 ranges. Direct-call byte
searches are only candidates until their instruction alignment/caller path is
inspected. No bundled program is executed. Original bytes, strings and listings
remain ignored under `local/`; tables here contain factual locations/hashes only.
The Steam Traditional Chinese installation's upstream build remains unverified.

| Profile | File | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| RA2 | game.exe | 5,077,312 | `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df` |
| YR | gamemd.exe | 5,286,208 | `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600` |

## Interpretations and limits

| Observation | Bounded interpretation | Confidence and remaining test |
| --- | --- | --- |
| YR registry reader enumerates `GetEntryKey`; parser appends unique entry nodes in source order. Read_File registers countries/types before the later virtual property-load loop. RA2 has the corresponding registration/property-load sequence. | Stage-local source order allocates IDs; later overwritten numeric keys do not remove earlier types. Load only sections at/after allocation. | Static call/data-flow evidence. Runtime counters against original game remain future validation. All native implicit allocation paths are not enumerated. |
| Country FindOrAllocate compares ID case-insensitively, skipping none sentinels. Country FindIndexOfName checks current Name then ID per array entry. | First ID allocation persists; house Country aliases use first array match after final property load. | Both supplied functions inspected. Narrow printable ASCII avoids locale comparator/truncation ambiguity. |
| HouseType LoadFromINI calls AbstractType Name load first, then reads ParentCountry with ID as default when its section exists. | Name updates during each existing section visit. ParentCountry has a separate self-reset identity field; no inherited stats are synthesized. | Both profiles inspected. Full inheritance resolution and defaults are unsupported; returned parent target is a declared-ID link only. |
| Scenario loader passes its mission INI to map Read_File and HouseClass LoadFromINIList; rules Init receives the separate rules source. House list reads Country with default -1 and clamps that result to zero. ReadHouseType constructs an unknown nonempty country. | Mission-only House list/Country, missing or empty zero, nonempty unknown late allocation. No retrospective properties. | YR caller flow and both house/ReadHouseType functions inspected; RA2 local scenario call chain corroborates source reuse. No live scenario run. |
| House constructor copies country ID to its name; explicit house list overwrites that name. No list loops countries. FindIndexByName compares literal bytes at house-name offset. | Country-ID fallback house names, source-order explicit house indices; placed-owner lookup has no country alias fallback. | Both profile owner lookup and placement caller paths inspected; synthetic case/name collisions cover this model. |
| Five YR placed-type finders compare ID only; terrain placement calls its type FindOrAllocate instead. RA2 terrain follows the same allocation pattern. | Existing type identity for aircraft/building/infantry/unit/smudge; terrain may allocate at placement time. | Bounded static paths; future runtime entity creation remains unsupported. |
| Read_General invokes building FindOrAllocate for four gate references in a fixed field order before property loads. | These four literal paths participate in modeled structure allocation. | Both profiles inspected; other property/general references may allocate types and shift native indices. |
| Both CRC routines consume unchanged bytes; GetSection/ReadString hash literal section/key bytes. YR fresh-file parser preserves spelling and appends separate section CRC records. | Construction reconstructs exact section/key names from origins, independently of casefold entity IDs. | Both lookup/hash paths inspected. General RuntimeIni still folds; native duplicate/CRC-collision ties and alternate populated-INI parse semantics need [#103](https://github.com/lictl/WebRA2/issues/103). |

YR placement owner calls: aircraft `0x41B17D`, structures `0x44F8A8`, infantry
`0x51FB6D`, units `0x74330F` all target `0x50C170`. RA2 counterparts
`0x41A8A6`, `0x44AC03`, `0x5069C6`, `0x706B76` target `0x4F5B40`.
The literal name offsets are `+0x15FF4` and `+0x15EE0`, respectively.
YR five-family type finders are `0x41CAA0`, `0x45E7B0`, `0x523C90`,
`0x747370`, `0x6B5440`; terrain's late allocator is `0x71E2A0`.

Registry/native-parser ordering research also resides privately at the coordinator's
`local/native-bindings/ini-parser-ranges.json`: append writes `0x526199–0x5261D9`
and head traversal `0x526CC0`. Exact duplicate entries/sections are rejected by this
component rather than guessing native fast-parser ties. YR's random/multiplayer
country selectors and native fixed-buffer truncation are explicitly unsupported.

## Private source pins

The opening rules/maps are verified from the selected candidates in the
[campaign census](../../docs/analysis/campaign-census.json). Rows/strings remain
private; the independent comparison described in the component document rereads
and hashes every listed root and member.

| Profile / role | Root | Root SHA-256 | Absolute offset / size | Member SHA-256 |
| --- | --- | --- | --- | --- |
| RA2 rules | ra2.mix | `896a8b64f9f1bb8ad5e0bc64fc0b8ea8c84112494761ea1a43478d10c5ef9914` | 118552784 / 541915 | `fd1e95cea0306ea78049dc81c8cd816e18c28c496872a1ff02edd50bd082062f` |
| RA2 opening | MAPS01.MIX | `b9093c9ef7efc1d24c6259196fbe90c8b78a15d0af27c93c12e1c755e5196d74` | 308 / 146240 | `ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c` |
| YR rules | expandmd01.mix | `0c0a64e741bdecdc3843a0beb6bb1f58aa2df5b86eb3bc4a953821ec98f3d6ec` | 2220316 / 743215 | `3d341ef8a13a4b5ab24af2eef48ac94931ac2bb87d950fe3330a07e2d25672ef` |
| YR opening | mapsmd03.mix | `6c36a0af05e2e9f86967308c77cf90fae9976d920e320aad8b9e4aa2e99e86a3` | 260 / 301077 | `dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0` |

## Executable range fingerprints

Ranges are half-open virtual addresses. File offsets are independently mapped
through the supplied PE headers, not inferred from a presumed fixed image layout.
They identify inspected evidence, not code shipped with the project. Some rows are
bounded call-site slices rather than entire functions; the interpretation table
limits their claim accordingly.

| Profile | VA start–end exclusive | File offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| RA2 | `0x493fc0–0x494187` | 606144 / 455 | `a53b55bf131a9f100cd53944c5f9775f240ce567afb718d7897a621b143aee53` |
| RA2 | `0x50e9a0–0x50ea90` | 1108384 / 240 | `da41ffff8e4e41fcfebe4d9ae78e6ced99a151b38f7972340388eec06d04dbd5` |
| RA2 | `0x4fa350–0x4fa3d4` | 1024848 / 132 | `e198272bc50503ff8a354fd9f2cc9f9e3eb01372f6321274383b47207cae0641` |
| RA2 | `0x6437f0–0x643b06` | 2373616 / 790 | `85a13d022dbe57eafa84d0dfbff6e2b494d66155ec34e2bd0281f4156d88f08e` |
| RA2 | `0x652270–0x65229a` | 2433648 / 42 | `110f08d5447f27474d8c64bb0f0dc79ff74294a8395d2a653e53fdbea92066a5` |
| RA2 | `0x4f9550–0x4f9623` | 1021264 / 211 | `9e2f3fb7f84f84334c2d146af7e8084d9be014c4178810220bfe6898171349e0` |
| RA2 | `0x4107e0–0x410859` | 67552 / 121 | `7cc85c2167069193cb82847b6eafa9023d5e15cec503e1e37b696ace8284c13b` |
| RA2 | `0x4f94d0–0x4f9545` | 1021136 / 117 | `bad97c2c76deae29c82a4cb955eead5103b86601d96f571a29440836a5c1a380` |
| RA2 | `0x46aa00–0x46aaa1` | 436736 / 161 | `9c951ed420fc6a079b9fdd484b637ab5326fe08777f7e18e2c91c48c338ee867` |
| RA2 | `0x4eba20–0x4ebbad` | 965152 / 397 | `73604e4ec6072d7c44a0f168fc220cf54e389bd0f5528ea2f9017ec9917300cf` |
| RA2 | `0x65f3f6–0x65f475` | 2487286 / 127 | `0cc830f0eeec41db63d7a33aed3adc7a36d00c37425589ab42433ff0aea9dcf9` |
| RA2 | `0x4f5b40–0x4f5bde` | 1006400 / 158 | `6ac259b465eb3ce723148f9eadf3c821c6a6961131137de345b2b3ec36928b2b` |
| RA2 | `0x648bfa–0x648ce6` | 2395130 / 236 | `61e7547841940c6da4b4386f34b9d52dbe82d42d3c0375a6c7f03e1749d9ad2f` |
| RA2 | `0x6e4260–0x6e42c0` | 3031648 / 96 | `3b5819be916999eb8a7294a3cf947b0eeb1d2cf84e3e5e62eb8666f20b36ea9d` |
| RA2 | `0x6e5a20–0x6e5aa4` | 3037728 / 132 | `c117c35a8ce510331faf3f4db3fb53e784be184b04ad67eb4f5fccc49a6e0148` |
| YR | `0x4a1de0–0x4a1fa7` | 663008 / 455 | `1c1f517b2096e1ecda758cb6877e77e79a170028ab8568e99fe5327df785a62b` |
| YR | `0x526810–0x526849` | 1206288 / 57 | `ffa869356a71c9c248711033b5be15bea6716c569b3cd3bcf8689932089ee70f` |
| YR | `0x528a10–0x528b81` | 1214992 / 369 | `6027a7c4763efa87092a23b141ef1d879b7998371269aa4da547257c5aa3f03c` |
| YR | `0x525dea–0x525e25` | 1203690 / 59 | `ad2b89e2789204ec904ea93b9f7ba89b692564c9f286d373e09709f299ed3e12` |
| YR | `0x52624c–0x52626e` | 1204812 / 34 | `c5f0b9307fea388b97c8bf1fda6861318130d2c6fc3eb9be127f75479d92890d` |
| YR | `0x52630b–0x526368` | 1205003 / 93 | `8fce7caf1028151b8db8504357b5c14cba267be9d122e99495a6ebe9c152d097` |
| YR | `0x512680–0x512704` | 1123968 / 132 | `69539332e1738aaae3422683454cc59dd19d82a52ad7a367986d53806615aa0f` |
| YR | `0x668bf0–0x668f08` | 2526192 / 792 | `687a4c7a7e66cb66e02c4e544de49d0661793941382152685d3b1d3a973666f7` |
| YR | `0x679a10–0x679a3a` | 2595344 / 42 | `1615c9aed93668b1ef98669ba7f7c9be160077feea6d017a746213dfb1a74719` |
| YR | `0x511850–0x511943` | 1120336 / 243 | `67eb842fccc47088c5d8f57dc56381eea520b4f0e62fea14f905f72ea54573e2` |
| YR | `0x410a60–0x410b1a` | 68192 / 186 | `a21984ce3e89260621b404592a4087d6cc1f0860ac7898843aabdcebbdc05bfc` |
| YR | `0x5117d0–0x511845` | 1120208 / 117 | `83319e9b6f5e659f26b11e181fb862df30e24a29cc57216aef64f412d46230e0` |
| YR | `0x475540–0x475608` | 480576 / 200 | `0763100aa0d2bb66d9f6cf1b25614c9c8cd3f47da02931fbe8ee3f9ca7af2e2e` |
| YR | `0x5009b0–0x500b3d` | 1051056 / 397 | `c1b3cfc48a0401a89c826ce27ed05775fe43d0cdf998c70a27e0091451f77cf5` |
| YR | `0x687744–0x6877c2` | 2651972 / 126 | `a8059f489b05c2effb0f31597cf5c596a4ba848db816bec5236c8b2aa4e7431d` |
| YR | `0x4f62ba–0x4f6313` | 1008314 / 89 | `d0d0695ec14df99abea1fc9dfa80c3e375a4a606e73c3c82405e6571ed20cdfb` |
| YR | `0x50c170–0x50c20e` | 1098096 / 158 | `83f1f999d0253b376fd5123d0e2ed255586c2be250a37f93d46140536831adcc` |
| YR | `0x66f450–0x66f544` | 2552912 / 244 | `a05df539c22d2d0f0355c17b384bda903715e4864d61abe7cad59f64b62569a9` |
| YR | `0x71ca70–0x71cad7` | 3263088 / 103 | `13ffb92a988172c07d497d52a46c17e2e1e9268800bb3b3619472272f20f27de` |
| YR | `0x71e2a0–0x71e324` | 3269280 / 132 | `7140751d8e325717966543717345ec6651e182d7a5af86692c7be2ca68d77a5f` |
| YR | `0x41b110–0x41b182` | 110864 / 114 | `99d1d4aa7cdcaade07b18af3d5d61c3e67119d95858892203844c87e45ec8a94` |
| YR | `0x44f820–0x44f8ad` | 325664 / 141 | `4f351b4b878b86dd9cdd4e4b84216ee1451889ff22f03a41f8c3328ef32c1da3` |
| YR | `0x51fb00–0x51fb72` | 1178368 / 114 | `aa98a1e66580a76f5ad3f088ce3ec9230e2264eccd40d966b4599549bb5b25a0` |
| YR | `0x743270–0x743314` | 3420784 / 164 | `9df41b85e200fa1a25deac96cc2f0fe4fbc2adc8fd0b2961d927f27c895af0a3` |
| YR | `0x6b4c80–0x6b4cf2` | 2837632 / 114 | `20e7e0e84e7f158087fb9708fd8a947420af6b2e40914c2467771a05a0a1b11c` |
