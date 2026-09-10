# Animation-effect compiler provenance

The original [compiler](src/animation-effects.ts) and original synthetic
[tests](../../tests/content/animation-effects.test.ts) use GPL-3.0-or-later, consistent
with the accepted pinned primary references and content compilers. The existing
MIT `@noble/hashes` 2.4.0 provides canonical hashes. No new runtime dependency is
introduced. Shared license/build mapping is coordinator-owned and required at
integration. No game program, native listing, retail row or asset is distributed.

Primary symbol/layout references use GPL-3.0 YRpp commit
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`:
[AnimTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/AnimTypeClass.h),
[AnimClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/AnimClass.h),
[AbstractClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/AbstractClass.h),
[RulesClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h),
[WeaponTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/WeaponTypeClass.h) and
[WarheadTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/WarheadTypeClass.h).
Headers identify hypotheses; field labels alone do not establish native effects.
Existing [weapon numeric and source policies](WEAPON_DEFINITIONS_PROVENANCE.md) and
[exact retained source view](INI_SOURCE_PROVENANCE.md) remain explicit dependencies.

## Observations and implementation boundary

| Native observation | Implemented consequence | Limit |
| --- | --- | --- |
| Fresh initialization destroys animation-list entries, then the file loader registers Animations before General and type properties. Registry order follows source keys; allocation case-folds and retains the first name. | Initial registry spelling can establish the exact art lookup name. Source histories and later allocation phases remain distinct. | Other initializers, omitted external allocation paths and complete native array indices are unproven. Later/competing spellings are blocked. |
| The animation virtual property pass receives global art (RA2 `0x8397F0`, YR `0x887180`) and rereads list count. It precedes weapon/warhead property passes. | Scoped children created while loading can load immediately; later weapon roots cannot be retrospectively assigned an earlier art pass. | Multiple global-art source stages are unsupported; ordinary retained INI normalization is not full native parser compatibility. |
| Animation LoadFromINI slots resolve to RA2 `0x425690`, YR `0x427D00`; Update slots resolve to RA2 `0x421710`, YR `0x423AC0`. | Both images' constructor/read/update/start/midpoint paths were inspected, including profile-specific fields. | Static evidence is not an original-game run or general proof about all virtual callers. |
| Damage constructor double is 0. Ordinary Update compares it with the verified zero constant before accumulation/damage. Bouncer/extras and other modes have distinct paths. | Positive Damage is active; special modes and unresolved values block admission. | No damage cadence, negative-damage behavior or effect execution is implemented. |
| YR MakeInfantry defaults -1 and is tested before the create-infantry path; particle defaults are -1/0 and midpoint creates particles for enabled type/count. RA2 has no corresponding property reads. | YR fields are retained and gated. RA2 keys remain not-applicable with their raw histories. | Particle type allocation and infantry selection/runtime are not implemented. |
| Scorch/Crater midpoint branches call smudge/overlay routines; the combined case uses scenario RNG. Start/Update also contain tiberium, meteor/bouncer and special-mode branches. | Enabled flags remain unknown, not presentation-only. All five animation chain reference types are followed conservatively. | No claim that all smudges change movement, or that a statically active branch is always executed in a given instance. |
| The constructor compares against Rules.DropZoneAnim and invokes map reveal twice. Damage selection separately compares its warhead with LightningWarhead and can return WeatherConBoltExplosion. | Global identity hazards remain distinct from local animation fields and ordinary AnimList. | Water/bridge/height splash selection, actor death sequences, extra/attached instance state and other superweapon/ambient callers remain caller gates. |
| RA2 WeatherConBoltExplosion/DropZoneAnim read the AudioVisual section pointer and run after property dispatch. YR reads General before it. LightningWarhead uses General in both. Fresh constructors zero each selector. | Explicit profile namespace, phase and fresh-constructor defaults; absent/empty references retain and none clears. | No reused Rules object/original save pointer-state claim. |
| Weapon/warhead constructors initialize animation-vector count to zero; ReadString returns 0 for missing/empty and copies the previous vector. Nonempty comma-token lists replace, skipping null allocations. | Explicit retained histories and 127-character maximum supported source values. | No native truncation, malformed memory accesses or extended mod callbacks are emulated. |
| RandomRate is converted to reciprocal native delays; the ranged scenario RNG returns immediately for equal endpoints. | Only the disabled zero RandomRate pair is typed. Nonzero pairs/delays block proof. | Native presentation/audio scheduling and sound-engine RNG remain excluded; renderer timing cannot drive simulation. |

`presentation-only` is a bounded gameplay-effect eligibility classification under
this named policy, not a statement that an original instance mutates no native
state. It does not authorize ignoring actor death, splash or global override
contexts. Unknown keys/conversions, duplicates, missing art, aliases and cycles
remain visible; `nativeAllocationComplete`, `nativeExecutionVerified` and
`canStartCampaign` are always false.

## Private selected-source comparison

The six physical input pins are those already published in the
[entity source table](ENTITY_DEFINITIONS_PROVENANCE.md). The private probe rereads
full roots and members using `createVerifiedSourceReader`. Its Python oracle
independently parses those raw bytes and compares every output record/root field,
status, source history, allocation/load order, raw retained origin, edge and reason.
The reviewed weapon-policy-2 seed fingerprints are checked before use; the oracle
does not recompute weapon semantics. No TypeScript code is imported by Python.

| Profile | Animation compiler fingerprint | Independent whole projection SHA256 |
| --- | --- | --- |
| RA2 | `2693cb7c09119150f6f38c169003e9472978e1835123a94bfddd1d88337c226d` | `90c736f041222f1f55ecd485012ea8ee704491a9b64c1f4803ec21b8de861249` |
| YR | `73721551904bc1dec7ff1c1439e085514c136afcdde294c51cf85ab1140fff97` | `cd1a3101f23e798228250c7ea8f8cb50cb6993c749e8c4526f5d6f021376bf81` |

The comparison covers 120,951/149,749 scalar leaves (RA2/YR), including 15,030/18,330
field records. Rule-description strings are excluded from the raw-source projection;
compiler identity hashing still includes them. Full projections/raw source/decoded
native listings and scripts remain ignored in `local/`. The
[focused report](../../docs/animation-effects.md) gives exact reproduction commands,
classified-root counts, resource limits and exclusions.

## Pinned native metadata ledger

Private static analysis pins `game.exe` (5,077,312 bytes), SHA256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`,
and `gamemd.exe` (5,286,208 bytes), SHA256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
No retail executable was run. Code spans are PE-mapped, start at inspected
instruction boundaries and end after complete instructions; labeled data spans
are not disassembled. The 58 ranges total 53,042 bytes. The private ordered ledger
SHA256 is `2a2deb5ab63d8e5935b7f3734ea7bd5604d931508fb808e929dee2998b526b14`.
Offsets are decimal file offsets; VA endpoints are half-open. Reproduction uses
`local/native146/make-evidence.py` with the pinned private Capstone 5.0.6 environment.

| Profile / observation | VA range | File offset / bytes | SHA256 |
| --- | --- | --- | --- |
| RA2 / Animation constructor | `0x424e30–0x425133` | 151088 / 771 | `e00ae25ce6699fc1e1c335f04f97edafceaad738d94e2787556ed2bf9ba87b65` |
| RA2 / Animation property load | `0x425690–0x426134` | 153232 / 2724 | `07198644a96d6b19e51585838000377b1626494447a2bad90ef12cde17f5bdab` |
| RA2 / Animation FindOrAllocate | `0x4264a0–0x426523` | 156832 / 131 | `a7dc047dd4e63624b8c85cf4c5bb36b6e63fa5ac2a1fa677598614de9108aa4a` |
| RA2 / Animation registry | `0x64c080–0x64c0e6` | 2408576 / 102 | `937048409fa34662761865d4d268ddb37b6e078b1a419021cd5a99e8e513496c` |
| RA2 / Fresh list cleanup and initial ReadFile | `0x6433a0–0x6436dc` | 2372512 / 828 | `2058cfae1b99ee4c3ee9316b59f1fa0fd70a47fc917f222097bf4da738aa21b5` |
| RA2 / Registry General property AudioVisual ordering | `0x643a8e–0x643b3e` | 2374286 / 176 | `7a2540402e953f999bad3a0c465b392b405bbbcd5b1f4b59e7f3258db165f6f4` |
| RA2 / Animation then weapon property dispatch | `0x6522bd–0x6523fb` | 2433725 / 318 | `cc0912e913c16c32955ee8fe83fa48d927852b2ca5be0df90c7a4a8959e8e617` |
| RA2 / Fresh global selector defaults | `0x640b80–0x64277e` | 2362240 / 7166 | `b8e735b830711b2d217bfcfeddbccca1d6d44d83329c1ab312a16363cf16f60e` |
| RA2 / Weather animation AudioVisual read | `0x6461c2–0x646209` | 2384322 / 71 | `13e9f193b2ab7856abd868d9ef1ec8b0ec97ed7f296980a53ffce59c8019ec69` |
| RA2 / Drop zone AudioVisual read | `0x646522–0x646541` | 2385186 / 31 | `0d394d9599ac8ae5e8141afb7b8cc830c4fe699e234754098646f592c8672afa` |
| RA2 / Lightning General read | `0x64a9f7–0x64aa16` | 2402807 / 31 | `7099831d4a3e225d1a51890167bc23fc4d771c86d3014fcb8e3eb0b3eb0f5c81` |
| RA2 / AudioVisual animation reference helper | `0x653df0–0x653e39` | 2440688 / 73 | `17534bbd312e4302e3f90ee39e4850dd4d26b99682a3f8a58e5690153014682a` |
| RA2 / Weapon constructor including empty Anim vector | `0x732ea0–0x7330c4` | 3354272 / 548 | `5e81838a3d3a30c13762bb5bfd98ec63408bc9580a87f5b442f40555e1ee9d05` |
| RA2 / Warhead constructor including empty AnimList vector | `0x720100–0x720355` | 3277056 / 597 | `aceb1b84411b88734b4c7345f6097e261d1edba95815cd7086e02e302923de77` |
| RA2 / Weapon property load including animation list | `0x733220–0x7339b6` | 3355168 / 1942 | `93bdca9290e202f6b108048156dd6a381cdb5a5b8eb6286eb88e7d98a289b0ed` |
| RA2 / Warhead property load including animation list | `0x7204e0–0x720bc5` | 3278048 / 1765 | `86031fa1c4ae8b2f6d22ab09276aaf003c56afb607a7073686e7caf558d3823c` |
| RA2 / Animation instance constructor and DropZone identity | `0x420110–0x4208d3` | 131344 / 1987 | `f3d20aaa087bcba9163fc70ea2c3f5591c5b0aefdde3dfe8144106aaa28ff269` |
| RA2 / Animation Update effect gates | `0x421710–0x422539` | 136976 / 3625 | `e63209972c86aec164de221f91a7dbf9dd6c747412e648215119308f78b70f8e` |
| RA2 / Animation start chain reaction | `0x4226d0–0x4228eb` | 141008 / 539 | `2f7668f2f8459172ae63cdd08403256d5fcbffc6b0edefa096e3ad0c1ec3880e` |
| RA2 / Animation midpoint smudge effects | `0x4228f0–0x422b13` | 141552 / 547 | `28cfe3d8a023a16360ed112ae5269ad0de00e7c1048bff31b903b0e559744d30` |
| RA2 / Damage animation selector | `0x47f4d0–0x47f600` | 521424 / 304 | `406abf4c7824b73e5f94dd769271e42c1f4d82da26473bd59b52e6c834a5d18a` |
| RA2 / Ranged scenario RNG equal endpoints | `0x6388a0–0x63894d` | 2328736 / 173 | `491f7e640b1a946d48267acb7f314472d13bfdad51b53e850e3c99ceb2b76829` |
| RA2 / Animation load vtable data | `0x79c37c–0x79c380` | 3785596 / 4 | `4376a414110f9a1788c011983be6c712f97eceb020a35f4edebcf22b549d0282` |
| RA2 / Animation update vtable data | `0x79c0e0–0x79c0e4` | 3784928 / 4 | `ea27becb3d076ce4e818a09f2b7f09c240d3000f2f62c3e17f9303fd8fd8fd12` |
| RA2 / AudioVisual section pointer data | `0x7a903c–0x7a9040` | 3838012 / 4 | `fbd86e1694d8459ad2698b9e3a18c4b39657c95e4363903abd931d461729c531` |
| RA2 / AudioVisual section name data | `0x7eecf0–0x7eecfc` | 4123888 / 12 | `6353afe22eeb66a945409d38edebdcfcc21f3c24449fcbcbc54e83c4e1656c57` |
| RA2 / General section pointer data | `0x7a9058–0x7a905c` | 3838040 / 4 | `098feabdb727fc3512722060d0fae00a2d156f46ed605f52ae616ddf8799e016` |
| RA2 / General section name data | `0x7dbb78–0x7dbb80` | 4045688 / 8 | `de730606188d39069d9d0820cda25593bbf892ddf55c78f5500376566b5977c2` |
| RA2 / Comma list delimiter data | `0x7ce9c0–0x7ce9c2` | 3992000 / 2 | `d8fa32dd40b181d8250a4ecde2f2f17bd7bfdf2793278d06ea5afc647f3d5762` |
| RA2 / Positive damage zero threshold data | `0x79b610–0x79b618` | 3782160 / 8 | `af5570f5a1810b7af78caf4bc70a660f0df51e42baf91d4de5b2328de0e83dfc` |
| YR / Animation constructor | `0x427530–0x427850` | 161072 / 800 | `d02931a3de49972e5de623e3f2c135849aae9c2243018867d1a8e4b1f1853fee` |
| YR / Animation property load | `0x427d00–0x4287f6` | 163072 / 2806 | `be7c6ebc541ac8cffd92337a610dd6ebd281770ef3b250d8744097bf9b25c71d` |
| YR / Animation FindOrAllocate | `0x428b80–0x428c03` | 166784 / 131 | `9bcf347f44d69b9812fa248ffe1318d638a66ff25f7dbdb280e5a85e15e47e44` |
| YR / Next Spawns generic allocation helper | `0x428f70–0x428ff0` | 167792 / 128 | `35ea2ab4da4d1ef60985c757f11c05ba3d2e25a316f979898c7e89e2f428da5e` |
| YR / Animation registry | `0x6728b0–0x672916` | 2566320 / 102 | `543c7f604a0d789292c5fc78781a6562e431179299ceaf4d6b03bf2164ae757f` |
| YR / Fresh list cleanup and initial ReadFile | `0x6686c0–0x668a2c` | 2524864 / 876 | `66d9ac73fd94f6fd464b43fae2033483073a34de17b1c20428f3dca4d9881e0a` |
| YR / Registry General property ordering | `0x668e80–0x668f63` | 2526848 / 227 | `b5409275f898d639bdbf0d3819c5a8b51d419d3c7fbb08cbe0dcacc3f7bfcb60` |
| YR / Animation then weapon property dispatch | `0x679a5d–0x679b9b` | 2595421 / 318 | `7126200a9d46bfc649919c4cadd4b6a13d1258b850dfaea6c0775e2c6b257d80` |
| YR / Fresh global selector defaults | `0x665650–0x6676c8` | 2512464 / 8312 | `0ed53673bd3e36e2e5566edb6962bd50c7b1ea71c9cdfbfe82f49324a950b13e` |
| YR / Weather animation General read | `0x66df19–0x66df60` | 2547481 / 71 | `dd982b5547127c9624d7db3acdead80ec35716c4a60833dc320a0a0968a41376` |
| YR / Drop zone General read | `0x66e5d5–0x66e61d` | 2549205 / 72 | `0d1467355e8699a3b7e77a28d81d55a0925ee6e6344f112bdab1290eda1de34c` |
| YR / Lightning General read | `0x671053–0x671072` | 2560083 / 31 | `f6992e62fc2818acc3c02a5bf36ec3015d344eaea067d302e94820abf2b113ba` |
| YR / Weapon constructor including empty Anim vector | `0x771c70–0x771ef4` | 3611760 / 644 | `a7d4b7d5055438c55c981725d96796e60d31f6eed0f562b0f3a93f925cd0c040` |
| YR / Warhead constructor including empty AnimList vector | `0x75cec0–0x75d1b0` | 3526336 / 752 | `efe5a038a03f3c2e050a70fef3fdb45740133b7e2f46a9be6bd08f334a693380` |
| YR / Weapon property load including animation list | `0x772080–0x7729e5` | 3612800 / 2405 | `6d56033c1ed4af71b2afcc3dd3f8cfae7aade05bfd976b1b9a490c9bd31fc17b` |
| YR / Warhead property load including animation list | `0x75d3a0–0x75debe` | 3527584 / 2846 | `951e720f8b8dbcac4bfb95d4a2a81f7a9124d2ced148dfb61115ded68ae54c23` |
| YR / Animation instance constructor and DropZone identity | `0x421ea0–0x422712` | 138912 / 2162 | `8f9a4c0b74f62a97ca75fe67b86fe24995760a0bcbc73ec2362ee26d331226b3` |
| YR / Animation Update effect gates | `0x423ac0–0x424b4a` | 146112 / 4234 | `8247489612c284c6a30d9b31b273aab750b67e9e51901a598d37691e49418579` |
| YR / Animation start chain reaction | `0x424ce0–0x424eff` | 150752 / 543 | `e455aa6cb48cef8a96c82ada12f96c5bbcd07072be36985b11efb97a48b4c22c` |
| YR / Animation midpoint particle smudge effects | `0x424f00–0x425147` | 151296 / 583 | `cf1d48ffb603249e3a050bf9e3363ff266d3f1d1a94ee11a8ff78a3d01f365a9` |
| YR / Damage animation selector | `0x48a4f0–0x48a61d` | 566512 / 301 | `3d0897c973e9bc423ebe76705827daf2dfa6a9d15924f7a8cb4d696c4722131b` |
| YR / Ranged scenario RNG equal endpoints | `0x65c7e0–0x65c88d` | 2476000 / 173 | `491f7e640b1a946d48267acb7f314472d13bfdad51b53e850e3c99ceb2b76829` |
| YR / Animation load vtable data | `0x7e366c–0x7e3670` | 4077164 / 4 | `5c8c69c9edc4d2453719bf8b2ba9f35645ec92a4fbd8f5bf825b2b58b0b47056` |
| YR / Animation update vtable data | `0x7e33b0–0x7e33b4` | 4076464 / 4 | `5b26a7a49c0a6ea99a4caf763f307745ba79c52aaa26d4078cd0800327032b3e` |
| YR / General section pointer data | `0x7f0c9c–0x7f0ca0` | 4131996 / 4 | `67f0f446862123cb7bd1266f61c4de693058873c90beee546046cddbfddf4769` |
| YR / General section name data | `0x826278–0x826280` | 4350584 / 8 | `de730606188d39069d9d0820cda25593bbf892ddf55c78f5500376566b5977c2` |
| YR / Comma list delimiter data | `0x817f70–0x817f72` | 4292464 / 2 | `d8fa32dd40b181d8250a4ecde2f2f17bd7bfdf2793278d06ea5afc647f3d5762` |
| YR / Positive damage zero threshold data | `0x7e2800–0x7e2808` | 4073472 / 8 | `af5570f5a1810b7af78caf4bc70a660f0df51e42baf91d4de5b2328de0e83dfc` |
