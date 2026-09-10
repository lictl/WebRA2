# Weapon definition provenance

The original TypeScript implementation in [weapon-definitions.ts](src/weapon-definitions.ts),
[weapon-numbers.ts](src/weapon-numbers.ts) and original synthetic
[tests](../../tests/content/weapon-definitions.test.ts) is GPL-3.0-or-later.
It uses the already pinned MIT `@noble/hashes` 2.4.0 for canonical identity.
No binary program, retail INI row, asset or native table is distributed.
Coordinator-owned license mappings must include these new paths when integrated.

## Primary references

Pinned GPL-3.0 YRpp headers at commit
`61d0887eb6040cfb36af16d592e9770ceae4dfb2` provide class layout/address hypotheses:
[WeaponTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/WeaponTypeClass.h),
[BulletTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/BulletTypeClass.h),
[WarheadTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/WarheadTypeClass.h),
[CCINIClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CCINIClass.h).
Header comments alone do not establish runtime behavior. Both supplied native
images were independently read, hash checked, PE-mapped and statically inspected;
no original executable was run. The shared exact source view and entity-link
policies have [their own provenance](ENTITY_DEFINITIONS_PROVENANCE.md).

## Observations and implemented scope

| Observation | Component consequence | Boundary |
| --- | --- | --- |
| Native weapon/projectile/warhead objects append to their own lists; FindOrAllocate rejects none selectors, compares IDs case-insensitively and preserves first spelling. Member-section lookups use that spelling. | Scoped allocation retains first names, raw origins and phase. Policy 2 admits the initial General weapon/projectile spelling proof below; other competing spellings remain unsupported. | All allocation sources and native indices are not established. |
| Per-source property dispatch visits weapons, projectiles, warheads, then CalculateSpeed; loop counts are re-read. Projectile airburst/shrapnel fields allocate weapons after their pass. | Late weapons wait for a later source layer; no retrospective section load. | Starts at genuine first-two normal-slot histories, Warheads registry and the General DropPodWeapon root. Elite, other numbered and implicit/special roots remain unmodeled. |
| Constructors initialize weapon Damage/ROF/Range/MinimumRange/Speed to 0 and Burst to 1; properties pass current state as defaults. Range uses ReadDouble default -1, scales 256 and converts to integer. Speed uses the same clamped-percent helper as entities. | Native integer units and explicit current-default rules. | No cadence, ammo, targeting or damage execution claim. |
| Projectile rules fields include AA/AG/ROT, motion and collision flags, numeric parameters and airburst/shrapnel references. Rotates/Flat are read from global art and an Image-selected section. | Rules fields are typed; Rotates/Flat are deliberately not typed from rules. | Full ObjectType/Image/art-dependent projectile state remains required. |
| Warhead construction fills 11 double Verses with 1; a present section supplies eleven 100% tokens as missing-key default, but empty ReadString returns 0. Percent Verses uses atoi; nonpercent uses atof. | Present-section missing resets are source-pinned; empty retains. Exact 11-token bounded policy with percent integer-prefix conversion and dyadic nonpercent subset. | Malformed lists are unsupported, not emulated native out-of-bounds reads. |
| CellSpread/CellInset/PercentAtMax store float32 after the float32-widen INI reader; ProneDamage/Verses store doubles. CRT initialization selects 53-bit precision; game startup sets/captures truncation mode; integer conversion restores captured mode when different. | Named startup-mode numeric policy, truncating dyadic products and float32 stores. | Full decimal parser, later control-word mutations and live cross-thread behavior are unverified. |
| Non-null projectile ROT=0 recalculates speed from range, gravity and binary constant 1.2, halving gravity for Floater. Both quantized sqrt tables are identical. | Positive bounded BigInt path regenerates the requested table mantissa mathematically. | Negative inputs, unsafe products and overflow are unsupported. This is not a ballistic flight simulation. |

Synthetic tests and the private parser/oracle exercise the bounded policy above;
they do not replace original-game behavior comparisons. See
[consumer semantics and limits](../../docs/weapon-definitions.md).

## Private source and comparison identity

The six selected physical source pins are exactly those in the
[entity provenance source table](ENTITY_DEFINITIONS_PROVENANCE.md): each profile's
rules, opening mission and art. The private probe rereads all full pinned roots and
member hashes. A separate Python raw-INI implementation reproduces the prior entity
projections before independently composing weapon properties and references.
No source rows or decoded payloads are published here.

| Profile | Weapon compiler fingerprint | Independent whole projection SHA256 |
| --- | --- | --- |
| RA2 | `f4ae3be7e032c0620f229ee1b470b978539c95fb1d00ab3dc42522f7de4bed82` | `3d0110e0fd2e67ef54ec3ad6807bcbcb15a8c2002bc9fd6e70f49a07d2d4a9f6` |
| YR | `1f68f5a7fb0d967971219103c77d1d1897a0b2747d0b83a1527f856629c5b28a` | `657cd9fe933a55a1883b634713de9dd4ab53304ad77985bacdd2b7d46c40970c` |

The projection includes every record identity, allocation/reference/load order,
all 19,650 typed field values/statuses/origins/histories and reset provenance.
The policy-2 projection additionally compares General root history, spelling proof
origins, record status, unsupported reasons and the complete descendant closure.
Python and JS integral floats are normalized before canonical comparison hashing.
RA2 has 194 records; YR has 263. Two negative-range speed cases per profile remain
unsupported. The initial prefix resolves one YR projectile case ambiguity and
38 previously propagated unsupported reference closures. Two own records and two
closures remain unsupported per profile. Each has two source-bound spelling proofs.
These counts concern selected static sources, not executable combat support.

Ignored scripts: `local/probe.ts`, `local/entity-oracle.py`,
`local/weapon-oracle.py`, `local/native126/{probe.py,make-evidence.py,sqrt-table.py}`.
The private comparison uses native table bytes, while runtime uses integer sqrt.
All 16,384 mathematically generated mantissas match each native table. The table
hash is `0a03bb84ceab037ab48004c1bfb0156279a21e7c6fbc6089a052118bfe31a248`.
Native tables and disassembly listings remain ignored, outside public artifacts.

## Policy 2 initial-prefix evidence (#140)

The same pinned images establish a narrower first-spelling proof than a complete
native allocation model. Both initializers destroy weapon/projectile entries until
their list counts are zero, then call the first file loader. Before the first
property dispatch, that loader registers types and calls General. General's
`DropPodWeapon` is the first weapon allocation on this path. Its weapon is visited
first, and that weapon's explicit initial `Projectile` read owns the first
projectile spelling. Later case-folded lookup returns the existing object; neither
lookup replaces its name. The already recorded constructor/property/FindOrAllocate
ranges establish the preserved spelling and exact source lookup.

The fresh Rules constructors clear the exact General pointer fields: RA2
`0x6411f2` writes zero to `this+0x4c4`; YR `0x665dd3` writes zero to
`this+0x5a4`. The complete entry-to-store prefixes below establish EBX=0 and
its unchanged value at each store. This justifies rule
`fresh-native-rules-constructor` for the null initial pointer. The subsequent
`Init` array cleanup does not itself establish a null existing pointer; reused
Rules objects and native saved pointer state are outside this compiler contract.

The complete General readers have only the absent-section exit before the root
read; no other direct branch skips it. The additional primary interface locator is
[RulesClass at the same YRpp pin](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h).
Its comments are not relied on as evidence of property dispatch; the actual native
callers and virtual passes were inspected. The audit separates later CombatDamage
DeathWeapon, SpecialWeapons projectile selectors, type property
readers, projectile children, superweapon properties and null-name COM factories.
A bounded executable-section scan found 12/14 direct weapon-allocator call sites
(RA2/YR), four direct projectile-allocator call sites in each image, and no direct
caller or stored absolute target for the alternate projectile index allocator.
This scan is a cross-check of the inspected fresh initialization path, not an
exhaustive proof about computed calls or extension/runtime behavior.

Only an explicit initial base/expansion General root receives evidence. Empty/null,
missing, case-mismatched section/key, later-source and noninitial root cases stay
unproven. Native General pointer history is preserved through empty reads, clears
and replacements. The first projectile proof applies only to that first weapon's
initial source pass. Unknown external allocations remain outside the API's scope;
`nativeAllocationComplete` remains false. Public original tests deliberately keep
unrelated warhead/weapon/projectile aliases unsupported and reject duplicate source
sections/keys. No original identifier is hardcoded as a winning projectile.

Fifteen additional code/data ranges total 40,221 bytes. Every code span ends at a
complete instruction; two data spans pin the General section pointers. The private
metadata ledger SHA256 is
`fe31d6dcea31fc247d6e59614c3019274df1d55bd78897308bf2160725b8ef04`.
The private `local/native140/evidence.py` verifies both whole-image hashes, PE
mappings, range hashes and instruction boundaries with Capstone 5.0.6; no native
program is executed. The raw-source oracle independently rehashes every retail
source and models this prefix before its existing reference allocation, without
reading compiler evidence as expected values.

| Profile / evidence | VA range | File offset / bytes | SHA256 |
| --- | --- | --- | --- |
| RA2 / Fresh Rules constructor through DropPodWeapon null store | `0x640b80–0x6411f8` | 2362240 / 1656 | `6373cca2eea206a9e6117a27775da2004d5725fdd2185ca2926e231075e7e6d5` |
| RA2 / Initial array reset and first file load | `0x6433a0–0x6436dc` | 2372512 / 828 | `2058cfae1b99ee4c3ee9316b59f1fa0fd70a47fc917f222097bf4da738aa21b5` |
| RA2 / File registration and General before properties | `0x6437f0–0x643afe` | 2373616 / 782 | `4e1a8514bd4167b8b681ef41fbc0b4a968093103e71cb028d42a4e0e9433e54f` |
| RA2 / General DropPodWeapon allocation | `0x6484e1–0x648520` | 2393313 / 63 | `e964436bdedf437aafdf742e553ce4ab36886279ec6250e8dbdfed2b6e6d7639` |
| RA2 / Complete General reader and section gate | `0x647f40–0x64b682` | 2391872 / 14146 | `2db2e54c7a458361f8fa060e9d5f2f1063901e520e44155ab203f371c13f4e7e` |
| RA2 / Later CombatDamage and SpecialWeapons calls | `0x643afe–0x643b3e` | 2374398 / 64 | `4a1ffe4af669414426921d5f386418c02f166264ebe232bb3d016813af10b238` |
| RA2 / Projectile first-name lookup allocation | `0x4650a0–0x465123` | 413856 / 131 | `4e50cf6f282699dca2188f0e7896b306459b66e804f34afec2821f63d6542a91` |
| RA2 / General section pointer | `0x7a9058–0x7a905c` | 3838040 / 4 | `098feabdb727fc3512722060d0fae00a2d156f46ed605f52ae616ddf8799e016` |
| YR / Fresh Rules constructor through DropPodWeapon null store | `0x665650–0x665dd9` | 2512464 / 1929 | `ce8c4091f008cb773f3e6330ec684ad01ee3f6ad6846c7e9f87d3e6434a2b55d` |
| YR / Initial array reset and first file load | `0x6686c0–0x668a2c` | 2524864 / 876 | `66d9ac73fd94f6fd464b43fae2033483073a34de17b1c20428f3dca4d9881e0a` |
| YR / File registration and General before properties | `0x668bf0–0x668ef5` | 2526192 / 773 | `4e8ae6bc432023dfd74f2b3a85327732cfb1afbe6944b100dcc58a9ac33731d1` |
| YR / General DropPodWeapon allocation | `0x66ec89–0x66ecc7` | 2550921 / 62 | `c5a8a7fabe2ac12181ff64d5df34ee9a0cfaccdf679d773b920fad87c5b99d12` |
| YR / Complete General reader and section gate | `0x66d530–0x671e99` | 2544944 / 18793 | `7562c49086fd7bb2c5e56fcf39b9db6f4727658a85ad8201e2af016aebd91374` |
| YR / Later CombatDamage and SpecialWeapons calls | `0x668ef5–0x668f63` | 2526965 / 110 | `6e79c584598434e69f39d96131cd5075f979dbb9749bfa3e5cc4599cd6479fcc` |
| YR / General section pointer | `0x7f0c9c–0x7f0ca0` | 4131996 / 4 | `67f0f446862123cb7bd1266f61c4de693058873c90beee546046cddbfddf4769` |

## Original numeric/property native range ledger

Images: RA2 `game.exe`, 5,077,312 bytes,
SHA256 `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`;
YR `gamemd.exe`, 5,286,208 bytes,
SHA256 `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
Addresses are virtual and ranges have exclusive ends. Offsets are raw file offsets.
The 53 ranges cover 148,769 bytes (including both 64 KiB mathematical lookup tables).
Their metadata-only private manifest SHA256 is
`be163b78151817ed2c0cc3120ce892b341e053a26a117591bcd9016fb9255818`.
These hashes identify inspected bytes, not verified native execution.

| Profile / evidence | VA range | File offset / bytes | SHA256 |
| --- | --- | --- | --- |
| RA2 / Weapon constructor | `0x732ea0–0x7330c4` | 3354272 / 548 | `5e81838a3d3a30c13762bb5bfd98ec63408bc9580a87f5b442f40555e1ee9d05` |
| RA2 / Weapon property load | `0x733220–0x7339b6` | 3355168 / 1942 | `93bdca9290e202f6b108048156dd6a381cdb5a5b8eb6286eb88e7d98a289b0ed` |
| RA2 / Projectile constructor | `0x4644e0–0x4646fe` | 410848 / 542 | `18e5b49d46cf17f090359aecb887a8cc3ec4100fc320b2f5300e67166552a336` |
| RA2 / Projectile property load | `0x464800–0x464d4d` | 411648 / 1357 | `bd0f0ae95e435b656be15380f4cdafb9fe22e1fdfba42009840b915eec942798` |
| RA2 / Warhead constructor | `0x720100–0x720355` | 3277056 / 597 | `aceb1b84411b88734b4c7345f6097e261d1edba95815cd7086e02e302923de77` |
| RA2 / Warhead property load and Verses | `0x7204e0–0x720bc5` | 3278048 / 1765 | `86031fa1c4ae8b2f6d22ab09276aaf003c56afb607a7073686e7caf558d3823c` |
| RA2 / Weapon FindOrAllocate | `0x733ea0–0x733f23` | 3358368 / 131 | `c0a37884991ef7b3151f46fb94d036439ce3d13131662e71fa4810de35c8f2f6` |
| RA2 / Warhead FindOrAllocate | `0x720f30–0x720fb3` | 3280688 / 131 | `c081bd5fe4234fcfb14fdc14c135518951fe010735cbc5e454889bf1754b6572` |
| RA2 / Weapon/projectile/warhead/speed dispatch | `0x652370–0x6523fb` | 2433904 / 139 | `9310eada83cc16eb8269ae77fc193638078b27ce0d75aa33a505c4ec663b0909` |
| RA2 / Range conversion | `0x469ae0–0x469b19` | 432864 / 57 | `e653508b99a64d77e70c3bd202190167811edda3a2f3ddcc061ae8f6941ea5c3` |
| RA2 / Configured speed conversion | `0x469cd0–0x469d26` | 433360 / 86 | `f0acb601aa62ba130781568b6d8a52b6fc136323369bf4a362581a53f7fe4a96` |
| RA2 / CalculateSpeed | `0x7339c0–0x733a1d` | 3357120 / 93 | `bf82f8d22e858e64ce924876dab19d9417660ce5b753f364557eaf3927fd3550` |
| RA2 / Ballistic speed | `0x47fb70–0x47fb99` | 523120 / 41 | `b5746e72acb56118586bd0f8afccb2e65e473457ebe9683f007c232e95b365b7` |
| RA2 / Floater gravity | `0x47fcd0–0x47fce2` | 523472 / 18 | `2376602b97de8be12366e497fba4efbd20d42950bcf3fbe5cad966e5a254499e` |
| RA2 / Quantized sqrt | `0x4ba410–0x4ba47e` | 762896 / 110 | `a3cea1432eaa47f218528bec4dfa90f3d27e9da80e0f721ae4350a59127c8fe4` |
| RA2 / Gravity constructor | `0x6425c3–0x6425cd` | 2368963 / 10 | `889b8c7d4035ee15d51b40c113f031e0dba8978a96394b548aa7c3dc81f24790` |
| RA2 / Gravity read | `0x646560–0x646580` | 2385248 / 32 | `797b48dfa6bc6748682869f5bb6c7d8d356a312acef9973013b7021d7467ef9e` |
| RA2 / CRT precision selection | `0x786d3f–0x786d51` | 3697983 / 18 | `7135ff9c1e93b0333b8c70520eaa28b03ee2aa1435de78eefa90f4666707e8f1` |
| RA2 / Control mask mapping | `0x785152–0x7851a5` | 3690834 / 83 | `f12aa892a62eb1fe7798075218cd0029c2285ecc6b05f1fd2dc0a57b39ba0430` |
| RA2 / Integer-mode capture/conversion | `0x77f0f4–0x77f14d` | 3666164 / 89 | `3a932e1747da885d7e9df2653e805c2119a751390cae8c66fda73682e188a4d4` |
| RA2 / Startup rounding selection | `0x68e894–0x68e8ab` | 2680980 / 23 | `fcc276dd2ad4a6f5aa438ce25f9c4f07cea0e4d91bfd7011963c8006853f0c3a` |
| RA2 / Quantized mantissa table | `0x817dfc–0x827dfc` | 4292092 / 65536 | `0a03bb84ceab037ab48004c1bfb0156279a21e7c6fbc6089a052118bfe31a248` |
| RA2 / Weapon LoadFromINI vtable slot | `0x7af4d4–0x7af4d8` | 3863764 / 4 | `3a2777626f8ad6d9e7921ef9bf3f2056617c73dd6b7fb5ae4b19cb8ddd87c181` |
| RA2 / Projectile LoadFromINI vtable slot | `0x79d624–0x79d628` | 3790372 / 4 | `e0e4fac0232642e2844b475cf021e6ce3bec4fb101d338115f3f5a4cf9714611` |
| RA2 / Warhead LoadFromINI vtable slot | `0x7aec6c–0x7aec70` | 3861612 / 4 | `b99b9b46ed15f452d3466fee330b262755d9fb1eece3bbf637a9ec03813a992b` |
| YR / Weapon constructor | `0x771c70–0x771ef4` | 3611760 / 644 | `a7d4b7d5055438c55c981725d96796e60d31f6eed0f562b0f3a93f925cd0c040` |
| YR / Weapon property load | `0x772080–0x7729e5` | 3612800 / 2405 | `6d56033c1ed4af71b2afcc3dd3f8cfae7aade05bfd976b1b9a490c9bd31fc17b` |
| YR / Projectile constructor | `0x46bbc0–0x46bdde` | 441280 / 542 | `d282ea75362a7f10ea24dcd932b92c4732f3bb25b909d5b2aa2a8ceb31730fdd` |
| YR / Projectile property load | `0x46bee0–0x46c436` | 442080 / 1366 | `25e95a2465754739c403511705e6a2e07d4aadbf700882a33c86a3f5de68bae4` |
| YR / Warhead constructor | `0x75cec0–0x75d1b0` | 3526336 / 752 | `efe5a038a03f3c2e050a70fef3fdb45740133b7e2f46a9be6bd08f334a693380` |
| YR / Warhead property load and Verses | `0x75d3a0–0x75debe` | 3527584 / 2846 | `951e720f8b8dbcac4bfb95d4a2a81f7a9124d2ced148dfb61115ded68ae54c23` |
| YR / Weapon FindOrAllocate | `0x772fa0–0x773023` | 3616672 / 131 | `5a950348471c9ded98f15da029a6115adcff43ff215b15effb2dd4f6b83c1522` |
| YR / Projectile FindOrAllocate | `0x46c790–0x46c813` | 444304 / 131 | `f8dc6166a3c069733bf55ad84fc9fd67d58f53ec7c6836e815170836e1815bf8` |
| YR / Warhead FindOrAllocate | `0x75e3b0–0x75e433` | 3531696 / 131 | `b1c1fa8030c6b9cab070595ad4b4c99667e16c81709de77c955d2a44f17006e3` |
| YR / Warhead registry allocation | `0x668d86–0x668de0` | 2526598 / 90 | `4734d204dab07ab67c6feab19d0f3a4c9b13ac7443911e2b95a6c27051785cf2` |
| YR / Weapon/projectile/warhead/speed dispatch | `0x679b10–0x679b9b` | 2595600 / 139 | `6b681ca8f942271fead27733245507f85ff58b42a259574c60c48e7ca1c07720` |
| YR / Range conversion | `0x474620–0x47465a` | 476704 / 58 | `b4a6382be418657abc846fb597353ae9fe5b29da0bd3404b89781baf405952fd` |
| YR / Configured speed conversion | `0x474810–0x474866` | 477200 / 86 | `fe814b0a3a18fb0d4837bb54dac07a04a38eb235cddea12071bcd26586b5e487` |
| YR / CalculateSpeed | `0x7729f0–0x772a4d` | 3615216 / 93 | `62546dd784a0da0f16a576d392ace01674f29c7cbbdd4a74d2a7d79d4e104760` |
| YR / Ballistic speed | `0x48ab90–0x48abb9` | 568208 / 41 | `a14a78c4178a85ba198aec0a7565c2594d8e69fd9b7d2dcdcf02d945551ded52` |
| YR / Floater gravity | `0x48acf0–0x48ad02` | 568560 / 18 | `580d05f16cd907eb01f3e759a28a6d5538ef39a977d7070c2df17c885e10e931` |
| YR / Quantized sqrt | `0x4cac40–0x4cacae` | 830528 / 110 | `666e0cd712fb1cc6eaeb74bfe9fd29fc0d2f491d8d42488a8d1c490820898387` |
| YR / Gravity constructor | `0x6674d6–0x6674e0` | 2520278 / 10 | `682332f68a2c74dea5dc68e5f4fd002dbd8fe230bdb2c5b34ea955ef4629b95b` |
| YR / Gravity read | `0x66b3c4–0x66b3e4` | 2536388 / 32 | `2e8f410dd0dc955d9ee8339df3053f04aed40aa31873619d02c18c1ef5ceefd3` |
| YR / CRT floating initialization | `0x7c8f46–0x7c8f5d` | 3968838 / 23 | `6c0b3f1508bd7ca0812d18055c0fa1ca7f7636e2ce31bc870fd967fb42322465` |
| YR / CRT precision selection | `0x7ceaaf–0x7ceac1` | 3992239 / 18 | `a435c3502afdcc78f0cdb6eacc50f6ae8d22b36ffbb2807460a0e2dbf0b6f2cd` |
| YR / Control mask mapping | `0x7cc052–0x7cc0a5` | 3981394 / 83 | `f12aa892a62eb1fe7798075218cd0029c2285ecc6b05f1fd2dc0a57b39ba0430` |
| YR / Integer-mode capture/conversion | `0x7c5ee4–0x7c5f3d` | 3956452 / 89 | `d927f430d92cd08ecbc205183bac24a700d1d2582fe850dfcfa05bbb338331b3` |
| YR / Startup rounding selection | `0x6bbfb7–0x6bbfce` | 2867127 / 23 | `1cc17755e4de39a8845899a82b3cab88cce22a7eae2044c6477122bb41dedfdf` |
| YR / Quantized mantissa table | `0x8650bc–0x8750bc` | 4608188 / 65536 | `0a03bb84ceab037ab48004c1bfb0156279a21e7c6fbc6089a052118bfe31a248` |
| YR / Weapon LoadFromINI vtable slot | `0x7f741c–0x7f7420` | 4158492 / 4 | `753c4c64f92c638159d6eae494fa90487f7da989d7c60d9235b34a47c6bf3934` |
| YR / Projectile LoadFromINI vtable slot | `0x7e49ac–0x7e49b0` | 4082092 / 4 | `019453081aa09a4444f2b64494b257f37ae783a77577bc8ef3b60d83d29f6958` |
| YR / Warhead LoadFromINI vtable slot | `0x7f6b94–0x7f6b98` | 4156308 / 4 | `3e8ed659c45e3d68188f4b7c1fe6e68168e57e52378348b712facbffa4389ed1` |
