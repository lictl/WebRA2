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
