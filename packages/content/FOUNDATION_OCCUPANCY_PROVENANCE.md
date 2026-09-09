# Foundation occupancy provenance

[foundation-occupancy.ts](src/foundation-occupancy.ts) and its
[original synthetic tests](../../tests/content/foundation-occupancy.test.ts) are
GPL-3.0-or-later WebRA2 code. They consume the existing GPL
[typed definitions](ENTITY_DEFINITIONS_PROVENANCE.md), with the existing MIT
`@noble/hashes` 2.4.0 incremental SHA-256 implementation. No new dependency,
proprietary listing, retail byte fixture or extracted coordinate array is copied
into the public component. See [the policy](../../docs/foundation-occupancy.md)
and [distribution obligations](../../docs/licensing.md).

Primary [YRpp revision 61d0887](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2)
provides address/layout hypotheses in
[ObjectClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectClass.h),
[ObjectTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectTypeClass.h),
[BuildingTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/BuildingTypeClass.h),
[TerrainTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TerrainTypeClass.h)
and [CellClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CellClass.h).
Those symbols alone do not establish shapes or behavior. Private, bounded static
inspection independently corroborates the list initializers, pointer selection,
getter/caller arithmetic and load-return paths in both supplied native images.
The arrays occupy BSS and are initialized by code; PE file bytes at an equivalent
BSS address would not be the initialized table. Capstone 5.0.6 plus original
scalar propagation inspects those assignments without running the game. Private
listings and initialized coordinate arrays are deliberately not published.

| Profile | File / bytes | SHA-256 |
| --- | --- | --- |
| RA2 | game.exe / 5,077,312 | `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df` |
| YR | gamemd.exe / 5,286,208 | `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600` |

The two images have equal initialized coordinate slots: 660 building and 220
terrain slots each, including terminators and zero padding. Building lists are
selected at BSS `0x84ede8` / `0x89c900` (RA2/YR), stride 120. Terrain lists are
selected at `0xac0430` / `0xb0edc0`, stride 40. The model recreates verified regular
geometry and the refinery omission, preserving terrain's distinct index-7 row and
rejecting its unterminated later rows. These are factual format/geometry rules;
no renderer pixels or bounding boxes were used to infer occupancy.

Static base attachment is narrower than runtime blocking. The inspected map
callers add signed pair components to their supplied map anchor and recognize the
paired maximum-short terminator. The building type getters and terrain type
getters return stored pointers, ignoring the include-bib argument. Native
wall/tile conversion, gate behavior, bridge/subcell flags and occupation-height
counters remain separate. Source installation build metadata remains unverified;
claims are scoped to these hashes and the modeled source-stage policy.

The private input pins are the six sources in
[entity-definition provenance](ENTITY_DEFINITIONS_PROVENANCE.md#private-input-pins).
Its independently reviewed type identity/Foundation selection is reused, then
new independent Python checks compare every mask and original-map anchor
translation. No claim of original-runtime execution follows from this comparison.

## Inspected range fingerprints

Half-open ranges identify inspected code/table-pointer evidence. Some bounds are
focused regions within functions, not whole function declarations. Source file
offsets are checked through PE section mappings. No bytes or listings accompany
this metadata. Normal-return load auditing assumes successful calls; allocator
failure, arbitrary DLL hooks and non-returning native errors are outside its scope.

| Profile / evidence | VA start–end exclusive | File offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| RA2 / vector helper | `0x40aed0–0x40aefa` | 44752 / 42 | `432cef6e6e896601d640d904aceea20a89b8f6cae3c7d02815479cbf21d9bd63` |
| RA2 / exact section gate | `0x4107e0–0x410900` | 67552 / 288 | `48eb1196d9476cf984abe27489bab5b06488e61139b364e1e07a1fb329b163b5` |
| RA2 / cell pair constructor | `0x42ad30–0x42ad46` | 175408 / 22 | `f587c5ef77c25ad468d958d7b4fb0b689d67b427e960eeae90dca882f0f36fbe` |
| RA2 / building caller anchor | `0x43c4c5–0x43c4d5` | 246981 / 16 | `6c190345f494a56e7706f84085b6ef4fcb7fa16b4c47db381573cda65cfa3872` |
| RA2 / building initializer and entry | `0x454ee0–0x456015` | 347872 / 4405 | `6fcac545d25bd52fd4bf5a3de86944dd2789500fdf44d985ba3b32b46dca6f20` |
| RA2 / building getter | `0x4588c0–0x458913` | 362688 / 83 | `640b37b41cbd5b52a133effe0a8b276529774cc114072f5a960070bb408f7d1b` |
| RA2 / Building accepted-load path to pointer | `0x459a00–0x45ae0c` | 367104 / 5132 | `9fa4ce38123733f997e0297daa99efa3a6d2c7e2e74e9ab79bd8d77cec73462c` |
| RA2 / building list binding | `0x45adf1–0x45ae0c` | 372209 / 27 | `155c3f7e137d5d05993b641a1ce0e4df909c61aec88207930b9bccb29d2df120` |
| RA2 / empty element constructor | `0x45ecf0–0x45ecf1` | 388336 / 1 | `3ebe1b59762a1c8020c1efe3747dd07f0e30617ed60b4e6a5bee16b6ea421dd0` |
| RA2 / bounded cell list copy | `0x482e10–0x482e57` | 536080 / 71 | `d0cb5ff71bf0c06636d4933ff5528cdbf868a99025191dde2001c3fa8780854c` |
| RA2 / attachment list caller | `0x54ab70–0x54aca1` | 1354608 / 305 | `a2e99abcf2f14bd70524d903d925d842d2f7975848b0d6c8c8a8ed7032d7cd60` |
| RA2 / object getter delegation | `0x5d4470–0x5d44e5` | 1918064 / 117 | `5ec0bb0a25ab73879e30e0eb5a5769b54dfce6bad287fcce744fa7e6d664ddf7` |
| RA2 / Object property normal returns | `0x5d7810–0x5d7bcf` | 1931280 / 959 | `75b921e2f3392225f86c429b6254f2308c9e3e16b2cea0644f5ff6396fdf6e6e` |
| RA2 / Techno property normal returns | `0x6daf60–0x6de0d3` | 2994016 / 12659 | `0494f6b15a928671c69d4f28310efc4539401da44fbf1197ca4605b8702c2aa7` |
| RA2 / terrain initializer | `0x6e4d60–0x6e525d` | 3034464 / 1277 | `a665d1dff1560455d408fa712675ca735772313f571b8376265a445e75a40749` |
| RA2 / terrain getter | `0x6e55d0–0x6e561f` | 3036624 / 79 | `eb3970ef49a6c3124ca2f63c87a684b39ed388207b58bf44e62194ea920561c8` |
| RA2 / Terrain accepted-load path to pointer | `0x6e5630–0x6e5723` | 3036720 / 243 | `566418eaa2a1ef4578020d9027546594504cfdeb64183d9f180c145f66516d88` |
| RA2 / terrain list binding | `0x6e56e8–0x6e5723` | 3036904 / 59 | `cfb05c41c276b8f16de25b10de92568490c48db6c65d0a18181944c8e3072105` |
| RA2 / building getter vtable | `0x79d288–0x79d28c` | 3789448 / 4 | `fdbe1749c6fc3c6a91fdc3d26e6dc185aac8bb6dac538ad4f28ae859548db380` |
| RA2 / terrain getter vtable | `0x7ad670–0x7ad674` | 3855984 / 4 | `2e406f538671b0da9a385a425023e7b083e82a8071b91fe86efce958c8193f38` |
| RA2 / building initializer pointer | `0x7c9734–0x7c9738` | 3970868 / 4 | `37c001d110eb0dadc8f02f33ca52e4560da2e6e5435024692fb893fdf8d2ffaa` |
| RA2 / terrain initializer pointer | `0x7cbd64–0x7cbd68` | 3980644 / 4 | `cc7a6dfdd7f1d8983fbe42f4f2bd6a7536e1cf63b7275b45952f3f612094e8a0` |
| YR / vector helper | `0x4068f0–0x40691a` | 26864 / 42 | `432cef6e6e896601d640d904aceea20a89b8f6cae3c7d02815479cbf21d9bd63` |
| YR / exact section gate | `0x410a60–0x410b87` | 68192 / 295 | `fa7048f8e9a36901e578a7d143b8b61ebc6dacb24c5f29c0031ff8a2ee635f69` |
| YR / map coordinates from location | `0x41bea0–0x41bedd` | 114336 / 61 | `995f27a395cd57d2930b7df4d2fd341e5e27d5d4c0655c9c7d000bea8c97f2b6` |
| YR / cell pair constructor | `0x42d470–0x42d486` | 185456 / 22 | `f587c5ef77c25ad468d958d7b4fb0b689d67b427e960eeae90dca882f0f36fbe` |
| YR / ToTile branch | `0x43f1e9–0x43f249` | 258537 / 96 | `5694211c07b08aee1e24a61bac7fc6ed18664110d77ab74fcf3f8eab375771ea` |
| YR / wall overlay conversion | `0x43f5ef–0x43f658` | 259567 / 105 | `039a95e5ad3fa39272b182c73670ee60545da9c1535a1252d423fad4784e8321` |
| YR / building caller anchor | `0x43f686–0x43f696` | 259718 / 16 | `e1a9dd1b425aeed2b919af4600791f37f754881bc2fe5b9580d2b7b6895db368` |
| YR / map placement coordinate to Put | `0x44fbc1–0x44fbff` | 326593 / 62 | `039f051994c01cf874d1abdf3f213245e5dce0d9f16e6c848fd9b98d7f96247d` |
| YR / building occupation flags | `0x453d60–0x453db5` | 343392 / 85 | `de73d340865d3a227597ae4cb2716125cb694a1df6d4a0365600158bc810a4cf` |
| YR / building initializer and entry | `0x45b1b0–0x45c2e5` | 373168 / 4405 | `0d18f81811133d62619351c5cf23f0f6d82d54e4548591958d64a6db1f6cd08a` |
| YR / building null pointer | `0x45ddb5–0x45ddbb` | 384437 / 6 | `d818f98bc5d8a1db1b53aa4a1f9acbd3e66b05afc9b1e6aa464416053af089bf` |
| YR / building getter | `0x45ec20–0x45ec73` | 388128 / 83 | `b1bde6a4dc71a61f1207563d3d3eb09719ed24e0cd5ea82e038e447473c80a8f` |
| YR / Building accepted-load path to pointer | `0x45fe50–0x461547` | 392784 / 5879 | `b81ffc806d6437ba54cdbdca05aafb6ec4eed270969b9e50ff0834f3add5589e` |
| YR / building list binding | `0x46152c–0x461547` | 398636 / 27 | `d525a0b2e3262815d984f4f31939dd0bee08ee4f1b93b0b676445a41e1305aa3` |
| YR / empty element constructor | `0x465d80–0x465d81` | 417152 / 1 | `3ebe1b59762a1c8020c1efe3747dd07f0e30617ed60b4e6a5bee16b6ea421dd0` |
| YR / cell object attachment | `0x47e8a0–0x47ea89` | 518304 / 489 | `eb9ffd7283e75be8b62aa245ddef363ac3f8073d97508ee350d39903b5a9f198` |
| YR / bounded cell list copy | `0x48dee0–0x48df27` | 581344 / 71 | `d0cb5ff71bf0c06636d4933ff5528cdbf868a99025191dde2001c3fa8780854c` |
| YR / attachment list caller | `0x5683c0–0x568510` | 1475520 / 336 | `a2759398a27d61ed11573261abd98b704cedc37d433243b6957b3d54fb0e8fc1` |
| YR / height and add/remove counters | `0x568510–0x5687ec` | 1475856 / 732 | `df1d17cfc4da2fe4f783b3a138a78f6e8adf619a7d0b1a9a5e635ad1f9f0ad8e` |
| YR / object getter delegation | `0x5f5b90–0x5f5c05` | 2055056 / 117 | `c47ee7ec195ce4c4c5b9bcc7c02792485a42bf803ac366d4153b110508a42dcd` |
| YR / Object property normal returns | `0x5f92d0–0x5f96aa` | 2069200 / 986 | `0e03c5a69e81efb82686a57a1087cb7aef51d862cd53ed7e2e84bfd9dc14ea8c` |
| YR / Techno property normal returns | `0x712170–0x716141` | 3219824 / 16337 | `d36fd601a401741ee981a29eac09fa14923f47967de7c3453134a6933348a6b4` |
| YR / terrain theater occupation bits | `0x71c110–0x71c1a3` | 3260688 / 147 | `f0f766d69fdfe98a25c74055d368ed8b9495f0eee8edd4566c1bc8728320d3a3` |
| YR / terrain initializer | `0x71d580–0x71da7d` | 3265920 / 1277 | `42cc1f0f8767e340e94293a8344e43230605ff2385f0aef19cfcf01d7ca6c43d` |
| YR / terrain constructor | `0x71da80–0x71dbc0` | 3267200 / 320 | `939dec95b9cad07ed8ecf99bd843f099e8cd9c576c0ff86f72f5ce1488c0413d` |
| YR / terrain getter | `0x71de40–0x71de8f` | 3268160 / 79 | `ba5720d91fc5564f8746fe1ff1e4a2e3ced0d1d395de4e8bbebbc2154976e58e` |
| YR / Terrain accepted-load path to pointer | `0x71dea0–0x71df9c` | 3268256 / 252 | `8c060dce0672e23a8a8d0f41100b0c0482317aad539610651cba973c16def279` |
| YR / terrain list binding | `0x71df61–0x71df9c` | 3268449 / 59 | `71fcc7575829b08665dcaf2ffd78f293a3cb548154a4c417cdde9f395976f3e4` |
| YR / building getter vtable | `0x7e4600–0x7e4604` | 4081152 / 4 | `6b0c89d670d0abd30cd950603e5053845b13c0b783d24b93fdae2a9a8bca9c4f` |
| YR / terrain getter vtable | `0x7f54e8–0x7f54ec` | 4150504 / 4 | `379d7df594a04ce1e3f1c2b0084aa5d3cd7c19acd13d1b1ac42d1737449ca9d9` |
| YR / building initializer pointer | `0x8127ec–0x8127f0` | 4270060 / 4 | `098b0287e8b080f74fab874dd99322098fe8fe0c8a261d0d5bc4eab2339878a4` |
| YR / terrain initializer pointer | `0x81519c–0x8151a0` | 4280732 / 4 | `d4f0743c9b4edeb195d48a888488adcf6f56c4a90f63e86c2129c66e460439ee` |
