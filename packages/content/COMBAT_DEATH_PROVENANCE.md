# Combat death prerequisite provenance

The original compiler and original synthetic tests are GPL-3.0-or-later. They
reuse the project's GPL [source view](INI_SOURCE_PROVENANCE.md),
[actor initialization](COMBAT_ACTORS_PROVENANCE.md),
[entity](ENTITY_DEFINITIONS_PROVENANCE.md),
[weapon numeric helpers](WEAPON_DEFINITIONS_PROVENANCE.md) and
[animation graph](ANIMATION_EFFECTS_PROVENANCE.md). No new dependency, retail table,
binary code or third-party implementation body is distributed by this slice.
The coordinator owns the combined distribution notice and build manifest mapping.

Primary symbol/layout references use YRpp commit
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`:
[TechnoTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoTypeClass.h),
[InfantryTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/InfantryTypeClass.h),
[UnitTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/UnitTypeClass.h).
Headers provide research anchors, not proof of constructor/load/runtime behavior.
No header implementation is copied. Notably, the native key loads establish
MaxDebris/MinDebris offsets independently of header member names/order.

Read-only native static evidence pins Steam Traditional Chinese game.exe
(5,077,312 bytes), SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`, and
gamemd.exe (5,286,208 bytes), SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
No bundled program was executed. Capstone 5.0.6 was used privately after checking
each full source hash and mapping addresses through PE sections. Code spans below
end on complete decoded instructions; they are inspected evidence ranges, not
claims of complete functions or exhaustive native control-flow coverage. Virtual
table and constant rows are data. Raw listings and full private result payloads
stay under ignored `local/native155/`.

The constructor ranges establish the fresh false/zero/null/list defaults, modifier
1.0 and infantry/unit Organic true/false overrides. They include the tail vector
clear calls, whose vtable pointers and count-zero implementations are pinned
separately. Fresh Rules construction establishes its DeathWeapon null pointer;
this makes no claim about reused native Init state or imported native saves.
Type field loaders take incoming rules; the YR later EDI reload at `71473F` is
included, as are the integer-vector's separate decimal atoi path and 512-byte
buffer. Source-level numeric parser limitations reuse the reviewed weapon helpers,
including conservative float32 midpoint rejection and truncating float stores.

The runtime ranges establish conditional dry-path explosion/debris, explicit /
virtual normal / global death-weapon selection, the half-strength fallback
constant, custom infantry death-animation indexing and separate unit
passenger/survivor/animation paths. They do not establish complete weapon
allocation, effect closure, owner/team accounting, native default death sequences
or timing. Detailed conditions and the next runtime integration boundary are in
the [component report](../../docs/combat-death.md).

The metadata ledger contains 54 ranges / 53,615 bytes; canonical private ledger
SHA-256 is `1eee912efaf693924458c2c6d3ca102284d721c6326d7dcabd71ee6ee45fbdb4`.
Only factual offsets, sizes and hashes follow; there are no retail payload bytes.

| Profile | Evidence | VA–end (exclusive) | File offset | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| ra2 | integer-vector-parser | `0046b1b0–0046b369` | 438704 | 441 | `ce06f36e9d651eb00a66bedffb16ce29dc6b29248117d910b8bf61a8a1b6fb2c` |
| ra2 | vector-clear-2 | `0046cc80–0046ccaa` | 445568 | 42 | `b98bf2727679f6f6faca08c0b5f698439e05e80cb6c0892ceb28360fab255ea4` |
| ra2 | infantry-lethal-custom-animation | `004ffb70–004fff3b` | 1047408 | 971 | `6d730a6dc6dbdc38504e6257993d8c5c578b122527f22808530bb8c0ca0e2ffb` |
| ra2 | infantry-special-sequence-crash-continuation | `004fff3b–004fffaf` | 1048379 | 116 | `31e3ac0b859f5c86f1b6ab01c21eb95b5e442a065f584903288649b4f6b7863e` |
| ra2 | infantry-constructor | `00509b20–00509d5b` | 1088288 | 571 | `6812595e82c6b091b22114dd3254b602dd170d52342e685b90b12567a94f3a1b` |
| ra2 | infantry-field-loads | `0050a3c0–0050a66b` | 1090496 | 683 | `11e14bf440b6b2a4bd67aa97948d24a405e635e2f34041923ccfaf83bbbad578` |
| ra2 | vector-clear-1 | `0050b110–0050b13a` | 1093904 | 42 | `4f16b9da99017c23cce92beec9292a4f337964b44e7d616c3ae0e0bd0af9488e` |
| ra2 | fresh-rules-null-prefix | `00640b80–00641ced` | 2362240 | 4461 | `1892ded0f3ceff75b7afbd485cef2db5c4ca8ad63eaa4c069d4882f653aee91b` |
| ra2 | combat-damage-fallback-load | `006474d4–00647513` | 2389204 | 63 | `b0996136c2df21ffcc0fec13925e01635e62ecb0b853aa4008da9bb68d72ef79` |
| ra2 | vector-clear-0 | `00652af0–00652b1a` | 2435824 | 42 | `907f5fea50cb69e153e0d351dbfb6f119b67d31f191e95d58b3b4faeebdafed3` |
| ra2 | lethal-dry-debris | `006ce29a–006ce5d7` | 2941594 | 829 | `c9cc6866945d101ca5005f2780d6519329bf8fd33127e06bb05bda99c6e70706` |
| ra2 | conditional-death-explosion | `006ce5d7–006ce6ce` | 2942423 | 247 | `9c24cb14eef6f1cbd9bc316d115d4f76d3219f900e0ee77bd829adb5dcf42d2b` |
| ra2 | death-weapon-selection | `006d7e20–006d7f29` | 2981408 | 265 | `4b68575e563b7b321c0f85080cd62e11c9e500351d03e78cdd949349b42e5e1a` |
| ra2 | techno-constructor | `006d9b40–006da6d1` | 2988864 | 2961 | `6e2e3fae8910358dabef93ff9fcff458990cb56c66b10300f2eea7762af0dc15` |
| ra2 | techno-field-loads | `006daf60–006dd443` | 2994016 | 9443 | `6ed75a3c3c3b9407678ee6ec56841ac8c38c4499bcf431f9f9489fab42182631` |
| ra2 | unit-lethal-passengers-survivors | `006fca30–006fd0b8` | 3131952 | 1672 | `3cf4fa21250b7fe00c9576bf686ecd3d1b58ad5c5b960c41e27355988ebb962e` |
| ra2 | unit-explosion-destroy-animation | `006fd3a0–006fd5a0` | 3134368 | 512 | `a68146608c784652321cb336923782b4e9bea93803f81acab4ea1156fd1ce2c0` |
| ra2 | unit-constructor | `0070a600–0070a7d4` | 3188224 | 468 | `e0753ad63351f3e8a6b6d4555b71e5426e2404c731a31dbd8e6112f9b54a55ef` |
| ra2 | decimal-atoi | `00782d72–00782e08` | 3681650 | 150 | `cf0b6b9b902f56acbd320c0b17a0a3e041e0897be5815056412510bdf97bbc39` |
| ra2 | global-fallback-strength-multiplier | `0079a728–0079a730` | 3778344 | 8 | `4cfa5b42ca669328764e67cd9a34bb8f90b16ed7ca8d85e8443783d7ccce15ed` |
| ra2 | vector-clear-vtable-2 | `0079da00–0079da04` | 3791360 | 4 | `5e44e9bdeebf993f54cae60a8bfbcba802ae19d9467be8dfbca2e8cf4c91a3a0` |
| ra2 | class-load-or-damage-slot-0x7a3698 | `007a3698–007a369c` | 3815064 | 4 | `9589ec33e73b271090215e10a8beba012596044fd0fa4b19481783d1826ab7e2` |
| ra2 | class-load-or-damage-slot-0x7a3adc | `007a3adc–007a3ae0` | 3816156 | 4 | `96270e10682e6105c59a7159f44a414fc33e1b06f60e0f0c3ed3ca211d7dc439` |
| ra2 | vector-clear-vtable-1 | `007a3b48–007a3b4c` | 3816264 | 4 | `d25d138ed87dd8e8c425748b498c7b498da6d683d916663582a14ea865ec337e` |
| ra2 | combat-damage-section-pointer | `007a9044–007a9048` | 3838020 | 4 | `015decc5cd75d2f155a5fd2b56368ca537386bdd5fe3694ad6c5385f5fceaa4f` |
| ra2 | vector-clear-vtable-0 | `007a9104–007a9108` | 3838212 | 4 | `597f8b2c7d4024b0bdfb11ad208e9dbc46a618e0bc9cc13c3ce64ceabe525500` |
| ra2 | class-load-or-damage-slot-0x7adf50 | `007adf50–007adf54` | 3858256 | 4 | `fb06c404cb361c8322c0c098f957db7f0a60ad84214fe1cb26813c0c06d52896` |
| ra2 | combat-damage-section-name | `007eecd4–007eece1` | 4123860 | 13 | `c2a8bfd788194e175c15fe7af33726f476ef9c5c6d44fc62fa211302aff7cb61` |
| yr | integer-vector-parser | `00475d70–00475f29` | 482672 | 441 | `fc324b513ec2216886ec0d7be08382892a9d7b16d65b814ce72bb1a851595832` |
| yr | vector-clear-2 | `00477840–0047786a` | 489536 | 42 | `fc420980d6bd8578fa8569664a9bd9a6c20ac84c69bfcc7ca5791a00e5592353` |
| yr | infantry-lethal-custom-animation | `00517fa0–005184f7` | 1146784 | 1367 | `4510d1a8e70c3dfb702e6e191eea3eab489e45ef690fc012f40d0d96afefda95` |
| yr | infantry-special-sequence-crash-continuation | `005184f7–00518632` | 1148151 | 315 | `2b51a2864c1804c8ff1979b99ae2b4b26682d099c2e62baae1010374d78a7852` |
| yr | infantry-constructor | `005236a0–00523979` | 1193632 | 729 | `9ed046fbf7f47dad8d871658efaea1e0828ccc2c08a70e7674719d41a385219c` |
| yr | infantry-field-loads | `005240a0–005243ee` | 1196192 | 846 | `bd7b3bce0fa99da40764580c3d465252f9f23445dec1c1154126d2d3d0c77ee1` |
| yr | vector-clear-1 | `00524ed0–00524efa` | 1199824 | 42 | `e1633cf723d7755b4f7de079f30adcbc13642dc983cbea5c18059a90a5b8a40d` |
| yr | fresh-rules-null-prefix | `00665650–00666bb8` | 2512464 | 5480 | `a697cef7f321c40144881d957ac49783dc49bc77d5cbc4ff8930e55a683efe15` |
| yr | combat-damage-fallback-load | `0066c569–0066c5ae` | 2540905 | 69 | `c270f50fd9e00dc0aacf5193c677ecf8a657f50518be51f6a5d9da532daaf3c5` |
| yr | vector-clear-0 | `0067a410–0067a43a` | 2597904 | 42 | `c1ada037963661bd653545a2f608d08e6947a1b48cbb33283b476af95026edce` |
| yr | lethal-dry-debris | `0070222e–00702572` | 3154478 | 836 | `f1c31237e5e871e5e880f2cf3ee9d9301c9cee974f7ee952fded668faa9f6205` |
| yr | conditional-death-explosion | `00702572–00702672` | 3155314 | 256 | `bed825cb28e89dd3e1c10f86543e3fd026a38d86c38af9b6a76d8947de72a93f` |
| yr | death-weapon-selection | `0070d690–0070d799` | 3200656 | 265 | `fb36c0505e5c8a82b7d2f800f9f7d2a6795c0375b2795af68c94af08175967ae` |
| yr | techno-constructor | `00710af0–0071183e` | 3214064 | 3406 | `1bccde9137869da10ebab29c36b9df58bb3803c223f6f083488ddb38aa4784ac` |
| yr | techno-field-loads | `00712170–00715227` | 3219824 | 12471 | `cca8d0fed13b8852a43064dbb4a76ff16a07206a8a84d298289e774a44f96f8f` |
| yr | unit-lethal-passengers-survivors | `00737c90–0073838a` | 3374224 | 1786 | `b773be01063d5be17c3c9b3ddfc26cc087969e4f2178f0a0bd58cfd2bcd51097` |
| yr | unit-explosion-destroy-animation | `00738680–00738884` | 3376768 | 516 | `4a6dcf8dcc92202c400db88f3a270400e509b1e2e7bf142df1c9dbfa6ac1828e` |
| yr | unit-constructor | `007470d0–007472b7` | 3436752 | 487 | `cec269fdd3af3dfc84a8eb4f7447d33ea535f3fb30b157b1121f382ae6cf22af` |
| yr | decimal-atoi | `007c9b72–007c9c08` | 3971954 | 150 | `d6ad65951e66032e13a2401a62560c3eddd92e6ce15067a8cd916f09cece7b5f` |
| yr | global-fallback-strength-multiplier | `007e1738–007e1740` | 4069176 | 8 | `4cfa5b42ca669328764e67cd9a34bb8f90b16ed7ca8d85e8443783d7ccce15ed` |
| yr | vector-clear-vtable-2 | `007e4de4–007e4de8` | 4083172 | 4 | `c603c2e36e1e126606fa51548b762670bcb4b13623574868267378ee12e2296f` |
| yr | class-load-or-damage-slot-0x7eb674 | `007eb674–007eb678` | 4109940 | 4 | `30fd1fe13d5c52a05a9a7ed5fdec46d58e738888d1e2c6a5343a0c5a91e0f700` |
| yr | vector-clear-vtable-1 | `007eb6e0–007eb6e4` | 4110048 | 4 | `da0c7caf8ee817697291396ecc38b61547672dda0516192d0cc0d0e2e93406e3` |
| yr | combat-damage-section-pointer | `007f0c84–007f0c88` | 4131972 | 4 | `2c1ba53da03e500cb68f96d0ef4761bfb16915dfb60d5fc15ce2b5dde18f759d` |
| yr | vector-clear-vtable-0 | `007f0d48–007f0d4c` | 4132168 | 4 | `ebc3a6af48f19abd9d9e79d8846daef47ee3f595980da54eb67579a36ea69b81` |
| yr | combat-damage-section-name | `00839e8c–00839e99` | 4431500 | 13 | `c2a8bfd788194e175c15fe7af33726f476ef9c5c6d44fc62fa211302aff7cb61` |

## Ordinary human decision and removal evidence (#163)

The separate original `combat-death-runtime.ts` and its original fixtures use the
same GPL-3.0-or-later provenance. They also compose the project's reviewed
[combat veterancy](COMBAT_VETERANCY_PROVENANCE.md). No native table, disassembly or
unlicensed third-party implementation is copied into the distributed code.
Additional symbol/layout references at the same pinned YRpp commit are
[InfantryClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/InfantryClass.h),
[FootClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/FootClass.h)
and the [ILocomotion interface](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/Interfaces.h).
These name candidate fields/functions; the pinned retail paths below supply the
static interpretation. The interface declaration alone is not behavioral proof.

The inspected source loader uses RA2 AudioVisual / YR General for global
DeadBodies, with a freshly empty Rules vector and current-value reads. Type
DeadBodies remains incoming rules; AnimType properties remain global art.
JumpJet's fresh false stores and incoming current-default reads are in the full
constructor/load contexts already pinned above. New short spans identify the
particular instructions; they do not claim a separate callable function.

For ordinary human InfDeath1/2, the switch dispatch requests sequence11/12 and
returns the native dead damage result without immediate UnInit. The update path
keeps nonpositive Health for these sequences. The completion helper reads the
sequence's frame count, chooses a nonempty type DeadBodies list or the global
fallback, consumes one unsigned random word modulo count on the successful
allocation path, constructs the corpse animation, then calls UnInit. No empty
global-count guard is present on this path; that input remains unsupported.
Constructor failure and total native random-call order are outside the policy.

The virtual slot chain from Foot UnInit through Object UnInit and Infantry/Foot
Limbo reaches Walk `Mark_All_Occupation_Bits(false)`; Walk dispatches to the
infantry occupation-clear method. Both image-specific slot addresses are pinned
below. This supports retained owned Walk occupancy until explicit completion in
the limited standing, dry, non-bridge subset. It does not establish all native
mission cancellation, accounting, render-list cleanup or timing semantics.
The [public report](../../docs/combat-death.md) specifies those integration limits.

Private Capstone5.0.6 decoding checks complete instructions and PE mappings for
45 ranges / 5,774 bytes. The canonical ledger SHA-256 is
`b35e6d53ca42d80e6c0af4af5ae296df5326ac6d7a7f4d5da4d6faba76bb463e`.
The underlying binaries have the complete image identities in the first table
above. Only factual locators and hashes follow.

| Profile | Evidence | VA–end (exclusive) | File offset | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| ra2 | foot-limbo | `004c9bd0–004c9d06` | 826320 | 310 | `f127b8006e57ae19928c82cd737987d1f8a310345cf92222e27c0b4738395df6` |
| ra2 | foot-uninit | `004cce40–004cce6f` | 839232 | 47 | `431cd6fd0d80eb9888b5419f856d60fca1f13578e04514bbe31632b8f1f94954` |
| ra2 | human-death-sequences | `004fffaf–004fffcb` | 1048495 | 28 | `3d7199a8e4b7dbc22fc93bf52c048c352608c0c74077235623912412228ca14d` |
| ra2 | ordinary-lethal-return | `00500184–00500193` | 1048964 | 15 | `b977e67df4d14ae00b8a2fd96ddf6914dc6acc23bdcc81a402fb6e1db025097e` |
| ra2 | infdeath-switch | `00500328–00500344` | 1049384 | 28 | `de41924e816c6d767bf859f70e49da425a81e4d09515c189bf4ff9a2d0d4e524` |
| ra2 | health-zero-death-sequence-exception | `00502eb6–00502efe` | 1060534 | 72 | `82a5f96bcaaf6113c36de32b31281d919966370a476ccd18c2c43155b1e062d0` |
| ra2 | infantry-limbo | `00504f00–00504f4a` | 1068800 | 74 | `c3f407f612a4823139e1e0ded78b83581a3eacef107199f97b2907c956f51037` |
| ra2 | sequence-completion-and-corpse | `005078b0–00507b55` | 1079472 | 677 | `ad1f95523b19845f5358f8046742e4f07d5edbb86fa7c85548fa54fab7da1144` |
| ra2 | completion-switch | `00507b58–00507b8e` | 1080152 | 54 | `4369834cf9c2d5767fa7dc40e347f46dcf30ae8bee5d736d18b8a245a41b05d2` |
| ra2 | infantry-clear-occupation | `005084a0–00508529` | 1082528 | 137 | `4e1bfaeb312ee85bb77a012b5a9d735af83a95919e09eb07e266fb9189ad878e` |
| ra2 | object-uninit | `005d4e90–005d4f0c` | 1920656 | 124 | `c3cbd1febc4532051e9c90d6a98e709f478c13bd55f502284226f6a0faa8f3e6` |
| ra2 | global-corpse-fresh-vector | `00640b80–00640d45` | 2362240 | 453 | `3b3c4722f3faced5332f66da2a68878690239c5a2ee0bb2d82075be8f89fa68d` |
| ra2 | global-corpse-load | `00645cf6–00645dc2` | 2383094 | 204 | `4f3ef704e93fdf3f6fcc43e8f75f3abbb8e0736207ae22f5f6798d64769581ca` |
| ra2 | jumpjet-fresh-default | `006da4d1–006da4d7` | 2991313 | 6 | `e94c09c57d80bdee6890adb5253d61c98e21a4101d94906471217fe83d42f9bd` |
| ra2 | jumpjet-load | `006dd40f–006dd429` | 3003407 | 26 | `35b428cfc45f2ce1cd765d29b59026fd3aed7c369d750dffe31fe055ae37ce77` |
| ra2 | walk-unmark-dispatch | `0071fce0–0071fd26` | 3276000 | 70 | `23cb4cf81db35714cc58f24739ae49d6ae449f1cbf436f57f8905994ec80d537` |
| ra2 | infantry-slot-d0 | `007a3610–007a3614` | 3814928 | 4 | `7bfb5fe508278e666c4fbc6e610acde809cfcbfd64b1a9a65f807c90a5b20c3c` |
| ra2 | infantry-slot-ec | `007a362c–007a3630` | 3814956 | 4 | `62bafd9bfbc9c5dc5788be3494bff3310e40d3df860897deb262a5c3b7e1810a` |
| ra2 | infantry-slot-f0 | `007a3630–007a3634` | 3814960 | 4 | `3fc8d6ed71787d355cfd40da3e432d63c58e893a5f30fd90b6de617a610d8a76` |
| ra2 | global-corpse-section-pointer | `007a903c–007a9040` | 3838012 | 4 | `fbd86e1694d8459ad2698b9e3a18c4b39657c95e4363903abd931d461729c531` |
| ra2 | walk-interface-unmark-slot | `007aeb74–007aeb78` | 3861364 | 4 | `12f5af4afa4c52fbd68e0c2449cedd8bc41727dbcadd0281f3356146c7de25ca` |
| ra2 | global-corpse-section | `007eecf0–007eecfc` | 4123888 | 12 | `6353afe22eeb66a945409d38edebdcfcc21f3c24449fcbcbc54e83c4e1656c57` |
| yr | foot-damage-dead-return | `004d7330–004d74d9` | 881456 | 425 | `4735a840d6bf0403637ebeda3479b457e489fd911140814d0941e0f40a616838` |
| yr | foot-limbo | `004db260–004db3bb` | 897632 | 347 | `c485fce4b04c52de5d4d42195f9942b6140f8db642c6257392657370bd470ef8` |
| yr | foot-uninit | `004de5d0–004de612` | 910800 | 66 | `fc2791a0d9b98c8e5b3b00b29d59e9519205c4761f6343f701665e4c50cf3f77` |
| yr | human-death-sequences | `005185d5–00518647` | 1148373 | 114 | `4036a1415dcd22c0819d376dd54b7fb5bc8e9cca72406909d125cbffa618c8db` |
| yr | ordinary-lethal-return | `00518ba0–00518bb2` | 1149856 | 18 | `ac4a7c80ff3267db49821f0954a547b0e3ebdc0eee9f27404aac94bb5d95fdb8` |
| yr | infdeath-switch | `00518d58–00518d80` | 1150296 | 40 | `97b8a21584243d0cac4fcc8b30cd4b3001e1113d31a8b4b6e0ec753f3015c8f0` |
| yr | health-zero-death-sequence-exception | `0051bc57–0051bc9f` | 1162327 | 72 | `0259b6baee36cfa11f08274a617e6a3b3a6cd5f33757ef7dea5b907e49b40023` |
| yr | infantry-limbo | `0051df10–0051df5a` | 1171216 | 74 | `3af864ff28fe97fa2089f77d32712e4cd6e6d9438b52997ca0a12b9504932350` |
| yr | sequence-completion-and-corpse | `00520ae0–00520efc` | 1182432 | 1052 | `78bf804948710b14c7e8271066f90cb514ea12f0be79a6a01de196a20dedad15` |
| yr | completion-switch | `00520efc–00520f38` | 1183484 | 60 | `c12096ab6ce7bd2cdacd60bbf0cfe6f9cf07f27bc005d5495f8fba3a08ea2668` |
| yr | infantry-clear-occupation | `00521850–005218d9` | 1185872 | 137 | `0e830e45b6a399291f5c546129455068fbc290ae634120d96f19bb5e116ccbe9` |
| yr | object-uninit | `005f65f0–005f6682` | 2057712 | 146 | `c9304209dbc512aa38482632208f0de3a54cc2077aea6f607b7af8e126438a30` |
| yr | global-corpse-fresh-vector | `00665650–00665827` | 2512464 | 471 | `1f039407d6332b28c0af6a7af5a7a1a5aa0a26a082f6a09e8cbf3b80ed807847` |
| yr | global-corpse-load | `0066d98e–0066da90` | 2546062 | 258 | `f75e6e7d428c5267a13fc4ed59bd00669673c0f02dbc67a1eb7fa87292729b30` |
| yr | jumpjet-fresh-default | `00711601–00711607` | 3216897 | 6 | `79d38a2be5152ec0a0300126f179146eb08af0dad621106e07f4749923b973e6` |
| yr | jumpjet-load | `007151e5–00715206` | 3232229 | 33 | `2e916bf4fefce7bfe394e2106db596d8364e49b2b262caab7adfe70e48e5cef3` |
| yr | walk-unmark-dispatch | `0075ca30–0075ca76` | 3525168 | 70 | `7f34d508de287b90ae3396867f80ade4319249ee94537b9612060b5fe40e0d55` |
| yr | infantry-slot-d4 | `007eb12c–007eb130` | 4108588 | 4 | `45182155739435c63c3f05a2c7404b6c8068543b5de550f3caca31074132fde6` |
| yr | infantry-slot-f4 | `007eb14c–007eb150` | 4108620 | 4 | `23f21e89b22fb7dcae596b43410512063f4f967ea39d8c82addccf2453933424` |
| yr | infantry-slot-f8 | `007eb150–007eb154` | 4108624 | 4 | `392deb78834467354311127dbc81656cd4663d9e76fbad0db94c81bdb875fe6e` |
| yr | global-corpse-section-pointer | `007f0c9c–007f0ca0` | 4131996 | 4 | `67f0f446862123cb7bd1266f61c4de693058873c90beee546046cddbfddf4769` |
| yr | walk-interface-unmark-slot | `007f6a94–007f6a98` | 4156052 | 4 | `8ac66db879db7f3c0373356c6cdcc9df505f3ba886313b72acd62a8ea4584aa6` |
| yr | global-corpse-section | `00826278–00826280` | 4350584 | 8 | `de730606188d39069d9d0820cda25593bbf892ddf55c78f5500376566b5977c2` |
