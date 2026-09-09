# Entity definition provenance

[entity-definitions.ts](src/entity-definitions.ts) and its
[synthetic tests](../../tests/content/entity-definitions.test.ts) are original
GPL-3.0-or-later WebRA2 code. No proprietary body, extracted row or binary bytes
are copied into the component. It reuses the existing GPL construction/source-view
components and the already pinned MIT `@noble/hashes` 2.4.0 SHA-256 implementation;
no dependency or package version changes are introduced. See
[licensing](../../docs/licensing.md), [construction provenance](CONSTRUCTION_PROVENANCE.md)
and [the component policy](../../docs/entity-definitions.md).

## Primary references and method

Primary YRpp revision
[`61d0887eb6040cfb36af16d592e9770ceae4dfb2`](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2)
provides address/layout/enum hypotheses in
[ObjectTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectTypeClass.h),
[TechnoTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoTypeClass.h),
[BuildingTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/BuildingTypeClass.h),
[TerrainTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TerrainTypeClass.h),
[SmudgeTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/SmudgeTypeClass.h),
[RulesClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h),
[GeneralDefinitions.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h)
and [LocomotionClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/LocomotionClass.h).
Those GPL source references supply names, not proof of constructor/load behavior.
The supplied RA2 and YR executables independently corroborate the bounded policies
below. Locomotor GUID labels do not establish their movement implementation.

Private Python/Capstone 5.0.6 tooling verifies whole-image hashes, maps PE section
addresses, and inspects bounded x86 constructors, property loads, conversion helpers
and callers. Candidate immediate/call searches are followed by aligned inspection;
search hits alone are not evidence. Neither original executable is run. Listings,
native text, exact INI rows and reconstructed fields remain in ignored `local/`.
The Steam Traditional Chinese installation's historical build number remains
unverified; this evidence is scoped to these two hashes.

| Profile | File / bytes | SHA-256 |
| --- | --- | --- |
| RA2 | game.exe / 5,077,312 | `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df` |
| YR | gamemd.exe / 5,286,208 | `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600` |

## Claims and deliberate boundaries

| Evidence | Interpretation | Confidence / remaining validation |
| --- | --- | --- |
| Object/Techno constructors and subtype constructor arguments in both images; the corresponding exact source field loads preserve current defaults. | Strength/armor, speed class, movement zone, locomotor GUID, Crusher, two scalar sizes and weapon pointer defaults as documented in the component policy. | Static field/call-flow evidence. Country, difficulty, veterancy and later runtime modifiers are not inferred. |
| Both integer-reader tails distinguish dollar/trailing-h hex and otherwise call atoi; speed loads default -1 and clamp/scale positive values. | Bounded integer grammar and scaled 0–255 speed; -1 retains prior speed. | Both images inspected. Overflow, malformed suffixes and the full native permissive grammar are unsupported. |
| Startup sets abstract rounding mask/value 0x300, calls a control-word capture helper; mask mapping sets x87 RC bits to 0xC00. Integer conversion reloads that captured word before FISTP. | Truncation in the inspected speed and placement-health paths. | Both startup/capture/conversion paths inspected. No blanket claim about every later floating instruction or thread control word. |
| Both ReadDouble tails scan `%f` into a 32-bit slot, widen and optionally multiply 0.01; YR CRT dispatch uses a software rounding helper. | Float32 width is observed; component uses an explicit bounded WebRA2 policy and rejects float32 midpoints. | Full CRT decimal parsing/double-rounding and percentage last-bit parity are unverified. Synthetic precision/boundary tests protect the stated policy, not native execution identity. |
| Unit subtype loads test SpeedType -1, use Crusher to assign Track/Wheel, then reread SpeedType. | Staged unit initialization; later Crusher changes do not silently replace an established class. | Both subtype loads inspected. Locomotion/passability execution remains separate. |
| Enum-reader loop bounds and pointed tables differ for MovementZone (RA2 12/YR 13); both speed tables contain eight entries and armor tables eleven. | Profile-specific enum indices, not ordinal guesses from header ordering. | Native table bytes and loop bounds inspected in both images. Unknown names fail typed conversion instead of adopting native error fallbacks. |
| Type weapon loads branch on TurretCount/WeaponCount, address normal/elite arrays separately, then ClearAllWeapons zeros the first two normal/elite pointers. Arrays are initialized with RA2 15/YR 18 slots. | First-two normal slots use numbered or ordinary keys; source controls and pointer retention/clears are retained. | Both load/constructor paths inspected. Unestablished WeaponCount in numbered mode is unsupported; no fabricated constructor value. Other slots, elite loading, slot selection and weapon statistics are required runtime work. |
| Terrain constructor writes Strength -1/Armor wood; property load copies current Rules TreeStrength only when still -1. Rules constructor writes 25 and General load uses current value. | Sentinel-time tree strength copy, not continuous inheritance. | Both constructor/property/general paths inspected. Terrain entity health and other terrain stats remain separate. |
| Building Foundation calls use EDI=ImageFile then EBX=original type ID, both against the global art table. Second read defaults to the first result and stores only nonzero. Terrain has the ImageFile read alone. | Two-source building Foundation policy; enum-zero fallback must not replace the first nonzero result. | Both source-register paths and calls inspected. The 22-entry table includes special refinery shape; returned dimensions do not establish an occupancy mask. |
| All four mobile/structure placement-health callers scale by 1/256, convert, and compare strictly against max-3. Only mobile families apply minimum 1. | Typed placement health and literal construction-owner joins. | Both four-family paths inspected; independent raw-INI oracle and synthetic near-full/zero cases agree. Actual game runs and gameplay modifiers remain future evidence. |

The small supported Image walk depends on the separately reviewed
[construction](CONSTRUCTION_PROVENANCE.md) allocation/property order and retained
exact source spelling. It does not change `webra2-ini-1` normalization or resolve
native repeated-header/CRC ties. Repeated consumed source occurrences are rejected.
Art layer order is explicit caller policy; native filename/archive selection remains
the verified source adapter's responsibility.

## Private input pins

The selected rules and opening maps are the same four pins listed in
[construction provenance](CONSTRUCTION_PROVENANCE.md#private-source-pins).
The additional art sources are:

| Profile / root | Root SHA-256 | Offset / bytes | Member SHA-256 |
| --- | --- | --- | --- |
| RA2 / ra2.mix | `896a8b64f9f1bb8ad5e0bc64fc0b8ea8c84112494761ea1a43478d10c5ef9914` | 118306944 / 245825 | `b477f861063a9509e87b7836b78190204c73bea5ea5595a842c456f5920ea223` |
| YR / ra2md.mix | `69d886defad9114dd440a013b364c8c004e369b5221d1889957b49d00058559d` | 6378496 / 336535 | `e1f0378394313c04ebbd5073f47785ee3e46f1b3c62d65724e8f3c310ee7ba31` |

The private original Python oracle rehashes all six inputs and compares every
exposed field value/status/origin/history and placement projection, as described
in the [component report](../../docs/entity-definitions.md#verification-and-private-comparison).
This establishes agreement between independent implementations of the stated
policy on those inputs. It is not an original-runtime observation or proof of
campaign execution.

## Inspected range fingerprints

Ranges below are half-open byte regions at virtual addresses. They identify the
inspected constructor/load paths, focused callers and tables; they are not claims
that every instruction in a larger region is implemented. File offsets come from
PE section mappings. Some ends bound a byte region rather than a function boundary.
No native bytes or listings are distributed with this metadata.

| Profile / evidence | VA start–end exclusive | File offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| RA2 / Object constructor/load | `0x5d57f0–0x5d59d7` | 1923056 / 487 | `a8664353d80a13fd27f4e2d93cf2e80c8e1ae95393e9087899b124ed50ba9303` |
| RA2 / Object Image/Strength/Armor load | `0x5d7810–0x5d7a23` | 1931280 / 531 | `056740a1cbc87465df66457542fce9c59c1831e2e097499fef8e72d4f82f3459` |
| RA2 / Techno constructor fields/weapon initialization | `0x6d9b40–0x6da5da` | 2988864 / 2714 | `648a8a96a9c8f111afaa2ef6d191188da15f43ccfd1c82b6075a545d46d1e2cf` |
| RA2 / Techno source field loads | `0x6daf60–0x6de088` | 2994016 / 12584 | `c4b4d140145de97804d06fe3c0251a1cbe1d42d8e4f049e04212f5e9d1015769` |
| RA2 / Infantry constructor parameter | `0x509b20–0x509b42` | 1088288 / 34 | `6afe7a6cb9509e92e9a711c7a4f8d0339cb1c6b78cb3a5fa0f4a7b0a5a347921` |
| RA2 / Unit constructor parameter | `0x70a600–0x70a620` | 3188224 / 32 | `265e3f2f7db46427d40f326c6e171f66e0477236447245f761202f981c3ac355` |
| RA2 / Aircraft constructor parameter | `0x41bc90–0x41bcb0` | 113808 / 32 | `6cd41d810613ae8f353b268c876dcbc7f9cf1a4b95651d112ce5ac2178704ba2` |
| RA2 / Building constructor/default Foundation | `0x457ac0–0x457c2e` | 359104 / 366 | `88b86d410938c0bf0a0d42afdb9d6618c9cf5dda4997cf13a90bced79b53e06b` |
| RA2 / Unit SpeedType fallback/reread | `0x70abea–0x70ac28` | 3189738 / 62 | `0961011dbd82b071739a42f1284efecb22b77d47887690b862ceb5da60f88629` |
| RA2 / Terrain constructor | `0x6e5260–0x6e53a0` | 3035744 / 320 | `dc501256a762d02a810153f051cf9a4ff2d48e72c58b9693ec6bdb68fccb7f5f` |
| RA2 / Terrain property load | `0x6e5630–0x6e5710` | 3036720 / 224 | `2f98c5e6445a407a11a82e0eda66da973bd591eace22c0b7e6c326e04799dbdb` |
| RA2 / Smudge constructor | `0x687da0–0x687dcd` | 2653600 / 45 | `04339b4727d65c61a375d1abb2390f0603266b75c3026b3ffc293093bd2bb470` |
| RA2 / Smudge dimensions | `0x6881b0–0x68823b` | 2654640 / 139 | `5f4d36842f5a30d9c7410972377c940c48796d989ce20d4a368b7caf0d13fd7b` |
| RA2 / TreeStrength constructor | `0x641f4d–0x641f57` | 2367309 / 10 | `d6563f222e221a097cf43367e2dca5c37bb3bbb2528e0608267407c1f805632c` |
| RA2 / TreeStrength read | `0x64b5bd–0x64b5dc` | 2405821 / 31 | `74eb976662847aa83f1839f81ce6fcde1be93400db87cb760dd4829012c58f9c` |
| RA2 / Building ID path | `0x459f55–0x459f58` | 368469 / 3 | `c5bce903dc505f67195845cf116dbf63a15b1713cee2c8f04e6e3bcee9ae6aed` |
| RA2 / Building ImageFile and Foundation reads | `0x45a95e–0x45aac0` | 371038 / 354 | `27908d525806873ad802b6491a25f5d95b9284c73237e9c8490a5c9d7a9e9350` |
| RA2 / Foundation parser | `0x46a260–0x46a2c5` | 434784 / 101 | `5da868e44b70c24e7c6952b3207fdd4b36d320821101ae0e6268f2bf1d7d6eeb` |
| RA2 / MovementZone parser | `0x46a300–0x46a365` | 434944 / 101 | `0691e785e52a862055d1ff4b05fb74d53f01db91a12dcc844831c338014c3387` |
| RA2 / SpeedType parser | `0x482f20–0x482f59` | 536352 / 57 | `ae048bdb3a9db0e97aeb64c75debc4a3488cc2f776495ba76a60b84050954939` |
| RA2 / Armor parser | `0x46a8b0–0x46a8f3` | 436400 / 67 | `b2e5bbb47f81615a5142e50e95280279307c75999882fa45b16c9b0341af2a90` |
| RA2 / Integer conversion | `0x50d92f–0x50d9c3` | 1104175 / 148 | `40981e875aa84b5b9953d25bdbf333ae99df85e86fa6429c65937602e4c15663` |
| RA2 / Float32-widen/percentage read | `0x50e4d0–0x50e530` | 1107152 / 96 | `6c8a95ad5911be72f81f5a3f8345aaaecf6bf71e2b926711bfbfb1fb871c96eb` |
| RA2 / Startup integer rounding capture call | `0x68e894–0x68e8ab` | 2680980 / 23 | `fcc276dd2ad4a6f5aa438ce25f9c4f07cea0e4d91bfd7011963c8006853f0c3a` |
| RA2 / Integer rounding capture/conversion | `0x77f0f4–0x77f14d` | 3666164 / 89 | `3a932e1747da885d7e9df2653e805c2119a751390cae8c66fda73682e188a4d4` |
| RA2 / Control-word update | `0x785014–0x78505f` | 3690516 / 75 | `388958186f875444b393a87d6f7a2c546b1e69c9d124dd55f07050843a7631d0` |
| RA2 / Rounding mask mapping | `0x785152–0x78517f` | 3690834 / 45 | `fd21c66f46834c87572b0f013a54302232f4f340c8a3723f2d54ce9e3d91092e` |
| RA2 / Infantry placement health | `0x506cba–0x506d05` | 1076410 / 75 | `015a352d70ffe1065e8dc5eca2713344a3959b6d2ca523b5127606636fac1b04` |
| RA2 / Unit placement health | `0x706e3a–0x706e7a` | 3173946 / 64 | `59a6bf522d280f6946c08c42bcb94d1172b7819b88d59ec81f3a17f28887963b` |
| RA2 / Aircraft placement health | `0x41aad2–0x41ab15` | 109266 / 67 | `3ea7e657da887d227e6f5f3f7a1b7dfdbb3e9d2051d64c3572c93afeba3de6b0` |
| RA2 / Building placement health | `0x44aee1–0x44af2c` | 306913 / 75 | `c8039feb056cda338f64bdc1f52d032e9be09e674be9af380a313fbacf94479d` |
| RA2 / Foundation enum table | `0x7d19b8–0x7d1a68` | 4004280 / 176 | `66c75039f74a2db9e2e7887916f0c952e5b0cdba60fa0d25fd89ae683152a908` |
| RA2 / MovementZone enum table | `0x7d1a68–0x7d1a98` | 4004456 / 48 | `c83a4a48acd3b0878484333f247a2319390129cc7ae09e5ed35a3db3469d30d6` |
| RA2 / SpeedType enum table | `0x7d38a8–0x7d38c8` | 4012200 / 32 | `74628eba9274b93b16df6578c8ef6c6b56c6aabfcf6e6adcbf08c8bdbc766b8a` |
| RA2 / Armor enum table | `0x79de28–0x79de54` | 3792424 / 44 | `0d440ebc1856633c25ce8d55b768277e9cccf364874a2461e5c4476e822f2078` |
| YR / Object constructor/load | `0x5f7090–0x5f7277` | 2060432 / 487 | `2784f80070eb3b38f75b0f92ca65d12a5353f51eb393802919a64147de5f49a6` |
| YR / Object Image/Strength/Armor load | `0x5f92d0–0x5f94f3` | 2069200 / 547 | `8cc3a54a53dad294e14ef2a30ab0090d51fc407f69d614973b9d75f073f53ae3` |
| YR / Techno constructor fields/weapon initialization | `0x710af0–0x711710` | 3214064 / 3104 | `445c9c3bbf7f53d21db2d28268fa153842965a0988b16f7f3516a443c6ad1c21` |
| YR / Techno source field loads | `0x712170–0x716088` | 3219824 / 16152 | `fbcf57c809b36999310ed1ce713679927055d5def5e69b12662dc0efd6ac6af0` |
| YR / Infantry constructor parameter | `0x5236a0–0x5236c2` | 1193632 / 34 | `d2f81aaf2e82d5c4e92b64f7e7c9ca926b4db35465710db047c4408bfbc97a75` |
| YR / Unit constructor parameter | `0x7470d0–0x7470f0` | 3436752 / 32 | `00e35b1511f141b68413579fa6cbf9674525c8e91550b00557322e1714186970` |
| YR / Aircraft constructor parameter | `0x41c8b0–0x41c8d0` | 116912 / 32 | `bfb6bc9f31ae90d3b64c9ea3dfef0693712a9d18f005bc82985220d9effa6a49` |
| YR / Building constructor/default Foundation | `0x45dd90–0x45df1d` | 384400 / 397 | `df6b3d1157e5e0d1450fa5133a453dbef2b2bdb6eabdd80c3d2bf23c04e0c2ac` |
| YR / Unit SpeedType fallback/reread | `0x7476d3–0x747711` | 3438291 / 62 | `820d224220bdc4aee0f6b17ebe39ba772fa1552047e4856bbd675c093c60dd4e` |
| YR / Terrain constructor | `0x71da80–0x71dbc0` | 3267200 / 320 | `939dec95b9cad07ed8ecf99bd843f099e8cd9c576c0ff86f72f5ce1488c0413d` |
| YR / Terrain property load | `0x71dea0–0x71df87` | 3268256 / 231 | `e3fb8e4219faa2c244c73444e8da9ed84682f319a905488c46c4af6752d1283e` |
| YR / Smudge constructor | `0x6b5260–0x6b528d` | 2839136 / 45 | `b745592f3d5ecb0dd3133e83221ae0e64e36deab8c2b72a4ff91ee5901bbcaf3` |
| YR / Smudge dimensions | `0x6b56d0–0x6b5764` | 2840272 / 148 | `5f6e60928977fc3f45759fa05a5400d813346f6b9c557a16dd26b06804f67808` |
| YR / TreeStrength constructor | `0x666df8–0x666e02` | 2518520 / 10 | `04f9693a90a571f0f383872cb7b63faa93c102cd86f9158dd79de14665553a1f` |
| YR / TreeStrength read | `0x671dd2–0x671df1` | 2563538 / 31 | `0b88ab71eb16e0e5f572179b4c3f673e84aef43ce7785b711521a93405383720` |
| YR / Building ID path | `0x46049c–0x46049f` | 394396 / 3 | `c5bce903dc505f67195845cf116dbf63a15b1713cee2c8f04e6e3bcee9ae6aed` |
| YR / Building ImageFile and Foundation reads | `0x4610de–0x461260` | 397534 / 386 | `19cfa5385857cfd82d475e1cbce61537a5aa9633a2a6f2cbfc62ab19e8044de0` |
| YR / Foundation parser | `0x474da0–0x474e05` | 478624 / 101 | `ff0753a0745e832fbd781229e482af37dafddee6281a62a8a6442b89f353b2de` |
| YR / MovementZone parser | `0x474e40–0x474ea5` | 478784 / 101 | `666b73345405d163a7dc45d0c678ec16839acac5407a8e74218937a1f8ad12a4` |
| YR / SpeedType parser | `0x48dff0–0x48e029` | 581616 / 57 | `41161827ce95b9d90b7371a9cd03cba834cb13a56f3af73695244ca2c1595bb3` |
| YR / Armor parser | `0x4753f0–0x475433` | 480240 / 67 | `8455e66cab0f152ebbca5889fc6b97f9dbaf05db0d560c5e09c99cb5627b129a` |
| YR / Integer conversion | `0x527840–0x5278e2` | 1210432 / 162 | `923e05489ea4364fb3b2958da3803ae20b37523573255efb4814a363273c4c32` |
| YR / Float32-widen/percentage read | `0x528540–0x5285a0` | 1213760 / 96 | `8167a51e7e2f997617b97d45e99310441bccaac7fbf593749c4ad9b550d04a32` |
| YR / Startup integer rounding capture call | `0x6bbfb7–0x6bbfce` | 2867127 / 23 | `1cc17755e4de39a8845899a82b3cab88cce22a7eae2044c6477122bb41dedfdf` |
| YR / Integer rounding capture/conversion | `0x7c5ee4–0x7c5f3d` | 3956452 / 89 | `d927f430d92cd08ecbc205183bac24a700d1d2582fe850dfcfa05bbb338331b3` |
| YR / Control-word update | `0x7cbf14–0x7cbf5f` | 3981076 / 75 | `388958186f875444b393a87d6f7a2c546b1e69c9d124dd55f07050843a7631d0` |
| YR / Rounding mask mapping | `0x7cc052–0x7cc07f` | 3981394 / 45 | `fd21c66f46834c87572b0f013a54302232f4f340c8a3723f2d54ce9e3d91092e` |
| YR / Infantry placement health | `0x51fe5c–0x51fea9` | 1179228 / 77 | `37ea388f93c6e801cd92a0c72a7b88ba12aae8d2a44184a19939ee7569590c09` |
| YR / Unit placement health | `0x7435da–0x74361c` | 3421658 / 66 | `dbb0b879c637eadc667b2fd6dad62795bda6f7b9611b24a54d8e42365336faaf` |
| YR / Aircraft placement health | `0x41b3a5–0x41b3e7` | 111525 / 66 | `9cab23966ca99fa2c360ef2327b6ab43c56558566ee5cbc334b48b65e40a2e3e` |
| YR / Building placement health | `0x44fb67–0x44fbd5` | 326503 / 110 | `7cecddcac5f0420d6efafcf91b20256893c6657862941fc951d1e5f2a3493bbf` |
| YR / Foundation enum table | `0x81b9d8–0x81ba88` | 4307416 / 176 | `acf327e9a512f45eece4f60cae114497b7f495d49ec89b59fabb61a60aa6ff62` |
| YR / MovementZone enum table | `0x81ba88–0x81babc` | 4307592 / 52 | `40aaea43d62a7aed1697c8005856aa27ec389eb1e6deb44bdf7524185b311070` |
| YR / SpeedType enum table | `0x81da58–0x81da78` | 4315736 / 32 | `534ecdeb2d4bfc0ce772a0863f878c8d4d9f85f64dad0cb502842f52fcecea99` |
| YR / Armor enum table | `0x7e5210–0x7e523c` | 4084240 / 44 | `c4b50d77d107f104ca074bcbc74bf72eab8a5cbcf9e8451fad31e24805ca4f7a` |
| YR / sscanf float callback installation | `0x7c8f72–0x7c8f7c` | 3968882 / 10 | `4faf15d98ecf14f2209b454e81e75977cf9d762adeaf32f766737b0420678a9e` |
| YR / sscanf floating dispatch | `0x7d1b27–0x7d1b46` | 4004647 / 31 | `7de7ba04cd926a0f71dfe02d41e4b5a5b75a8ca502f61ab56a9905658cb24dec` |
| YR / Software float callback | `0x7cebe8–0x7cec26` | 3992552 / 62 | `2feb834938d53b35a9e31c267217665fc2966641aae0d637529d8e41051702be` |
| YR / Software float packing | `0x7d7d1c–0x7d7d49` | 4029724 / 45 | `b8965de75b10fb6e5a201e33d9b6020364dfc387579568c99e95d12fea70845a` |
| YR / Weapon ID allocator | `0x772fa0–0x773023` | 3616672 / 131 | `5a950348471c9ded98f15da029a6115adcff43ff215b15effb2dd4f6b83c1522` |
| YR / Boolean reader | `0x529759–0x5297a6` | 1218393 / 77 | `14317e8385167ce9e17a0dbdf14fb541f004c033e12756412523d62205d3fa7a` |
| YR / Software rounding guard/remainder | `0x7d78b5–0x7d79e0` | 4028597 / 299 | `e050f000074aa0f90f159d203b8de8672732d7916755cf03d92437bccca603c0` |
