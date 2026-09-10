# Fresh actor values and ordinary infantry firing sources

This bounded component under [#147](https://github.com/lictl/WebRA2/issues/147)
compiles fresh placed infantry/unit Armor, Firepower and explicit rank, plus
infantry firing-frame source visits. It is a prerequisite for combat, not a claim
that original weapons execute or campaigns are playable.

`compileCombatInitialRuntime` requires genuine actor/entity compiler results,
matching ordered rules/ART pins and reauthenticated mission bytes. It reconstructs
construction visits rather than reading only the final image name. Import sessions
remain responsible for verifying physical rules/ART bytes; source pins alone are
not cryptographic authentication of caller-created runtime tables. Returned source
facts and per-placement programs are frozen and factory-branded.

Fresh constructor Armor/Firepower are binary64 1 at RA2 actor +0x120/+0x128 and YR
+0x158/+0x160. The inspected Foot/Infantry/Unit constructor chains establish these
fresh values. This does not model later crate, ownership or special-state writers.

Fresh rank starts at zero, and infantry country/house initialization can promote
it. A later **explicit map rank token replaces that earlier value**: infantry
index9, unit index8. Decimal int32 is multiplied by the exact binary64 0.01
constant under the previously verified 53-bit/toward-zero startup policy. RA2
stores binary64 at +0x118; YR truncates to binary32 at +0x150. The compiler reuses
the reviewed numeric primitives from [weapon definitions](weapon-definitions.md).
It admits a strict decimal-token subset and finite rank magnitude at most 65536.
Missing/shifted fields, non-ASCII or over-127-byte row buffers, nondecimal tokens,
integer overflow and unsupported rank bounds remain unknown, with reasons; they
do not inherit an invented zero. This is initial-state data, not live rank loading.

Infantry FireUp/FireProne default to zero (RA2 type +0xB9C/+0xBA0; YR +0xE40/+0xE44).
YR additionally reads SecondaryFire/SecondaryProne (+0xE48/+0xE4C). Native reads use
the global ART table and exact current TypeImage, not a rules FireUp key. Each
exact rules Image visit selects the section; missing/empty ART integers preserve
current fields. The existing exact-name, last-ART-layer source policy is retained,
with duplicates rejected and loaded-at visits recorded. Invalid image state stays
unknown until a supported field read establishes a value again. Secondary/prone
fields are retained as data without blocking a valid standing-primary FireUp.

`createInfantryFiringProgram` admits only authenticated ready infantry placements
with Walk locomotor, ordinary normal-slot source mode and FireUp 0..65535. It
binds row ID, stable source placement index+1 actor ID and source/program hashes.
This source predicate is deliberately weaker than permission to shoot. The world
adapter must select and validate an actual weapon and all current actor/context
conditions. Units retain fresh factor/rank facts but cannot obtain this infantry
program. No new country/house modifier or veteran-ability execution is invented;
those source selectors remain in [combat modifiers](combat-modifiers.md) and
[combat veterancy](combat-veterancy.md).

The inspected normal standing path starts sequence4, marks a shot pending, checks
the selected FireUp animation value, calls GetFireError again, and only then
dispatches Fire. Failed revalidation and the Fire wrapper clear pending state.
Prone sequence8, deployment, alternate/secondary and special attack branches are
outside this initial timing contract.

Weapon rearm is separate: RA2 timer +0x244 (duration +0x24C), YR +0x2EC (duration
+0x2F4). The ordinary gate compares global frame minus start against duration and
returns rearm error3 while pending. Successful dispatch starts the GetROF-derived
timer. YR +0x1FC is ammunition refill, not this timer. Burst/special statuses and
full native animation cadence are not covered. The original
[scheduler policy](infantry-firing.md) makes the D03 logical-time deviation explicit.

## Evidence

Read-only source images are the supplied Steam Traditional Chinese installation;
no game program was executed. SHA-256 pins:

- RA2 `game.exe`: `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`.
- YR `gamemd.exe`: `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.

The private ledger rehashes both full images, maps each interval through PE sections
and requires complete x86 instruction coverage using Capstone 5.0.6. There are
30 selected code ranges totaling 3,987 bytes plus eight pinned data records.
Ledger file SHA-256:
`229ddc3abd14bd3d92622727a80a7a1b38808f369112c82a94333c64c7f08dcb`.
Exploratory unaligned call/immediate candidates were only research leads. Private
listings and source bytes remain in ignored local directories. Public facts below
are bounded observations, not a disassembly or formal clean-room claim.

| Profile | Observation | VA interval (end exclusive) | File offset / bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| ra2 | fresh-techno-factors | 0x6c0cd0–0x6c0d6c | 2886864 / 156 | `d3def51f20a753d706bef424ca723102dc5116ffecb2acd55591c49ae6b3158b` |
| ra2 | fresh-rank-zero | 0x713340–0x713350 | 3224384 / 16 | `9d20fb9737545d0eeb198c79dc5d325beabd6d570a4058d3f1e7f4a887df0403` |
| ra2 | foot-to-techno-constructor | 0x4c2930–0x4c293f | 796976 / 15 | `24c81e24d3351f76e10f7f9306ae4f1af0b62ed510455455b8f7367ca0a0b4d2` |
| ra2 | infantry-constructor-standing | 0x4ff640–0x4ff69a | 1046080 / 90 | `02ab87e69b7e41443054eea2ff30610618838d05bbc98117c3778f26a6912baf` |
| ra2 | unit-to-foot-constructor | 0x6fa400–0x6fa413 | 3122176 / 19 | `2b87d3861ef44874f41f5f89d6822ce772fa9058f737d622b8599cc0075fce32` |
| ra2 | infantry-country-house-promotion-before-map | 0x4ff8b0–0x4ff941 | 1046704 / 145 | `0011fb6376b476f03f35ccceb6b67435d264b21c48870047692795006e8e3f1a` |
| ra2 | placed-infantry-explicit-rank | 0x506b9e–0x506bc6 | 1076126 / 40 | `f214c901cfc2ad59fc785242f7ae09aa7037ba8d7be6b0be7d899211e09a8b04` |
| ra2 | placed-unit-explicit-rank | 0x706cee–0x706d15 | 3173614 / 39 | `fb8645d31e51c36e98bcbfc0a7ebe15c625c16bcee24306ea71feaec7e1ec399` |
| ra2 | rank-percent-store | 0x713590–0x71359f | 3224976 / 15 | `caaf367f1e5e647e79f349d214f69a67a1c33904fc5d6add5fe4e271b2224a1b` |
| ra2 | infantry-fire-frame-defaults | 0x509b20–0x509b62 | 1088288 / 66 | `430bf9df8f5a9338f4009ae41e3ec06cb664816c2e0a1ad016c3382894ee150a` |
| ra2 | infantry-global-art-fire-reads | 0x50a8bc–0x50a915 | 1091772 / 89 | `f95072b4c2861794b8fafe73aba5b2cfca388aa7e535f40d7660fa5cd7187e28` |
| ra2 | infantry-fire-animation-and-dispatch | 0x507530–0x5078a5 | 1078576 / 885 | `320843850c7d129400b725d810206dfda2f9926b819ada27a42eb45c8cf05593` |
| ra2 | infantry-fire-wrapper | 0x504f50–0x504fd0 | 1068880 / 128 | `2655f3bd2661d9358c7f7957b33e94229af2d5c00c62b8f7f4e81ceb5f2afd74` |
| ra2 | ordinary-rearm-gate | 0x6c9690–0x6c96c2 | 2922128 / 50 | `77d120cd3c0654b1ba5ac03fa0e96c3a8b58306f4444f757fca3c67d9f942c3e` |
| ra2 | ordinary-shot-starts-rearm | 0x6cb950–0x6cb99e | 2931024 / 78 | `6f8c1b2e922b5741fa30cb4e5bef44ca354369a22c2a6801162f5268d0315a21` |
| yr | fresh-techno-factors | 0x6f2b40–0x6f2c0a | 3091264 / 202 | `597600472c2dd266b24a666c309d6e4d0ac9014bcce4f1a3c377153e85cabee5` |
| yr | fresh-rank-zero | 0x74ff30–0x74ff39 | 3473200 / 9 | `cda72abcdbb1efdc80edc8549a889c40e93418986336d31914aa9a2d9e967cc7` |
| yr | foot-to-techno-constructor | 0x4d31e0–0x4d31ef | 864736 / 15 | `5e3a5a4a7309daa1cfb9796159bf2d009e414829ab00ef7b4282a06b7ecb6b4f` |
| yr | infantry-constructor-standing | 0x517a50–0x517aaa | 1145424 / 90 | `45dfb0e536fa6c9438f528f88682eb3c198aa4cedb9c24e9030ba6050cdfa310` |
| yr | unit-to-foot-constructor | 0x7353c0–0x7353d3 | 3363776 / 19 | `539dc0ef37053dc4813a8bc3a240982d915e19889ff0d9fc59880f4a9804d690` |
| yr | infantry-country-house-promotion-before-map | 0x517cc0–0x517d51 | 1146048 / 145 | `08d501e8346f6605a72e893452c99e0a19469073ce47bc0169811acd7556faf8` |
| yr | placed-infantry-explicit-rank | 0x51fd45–0x51fd6d | 1178949 / 40 | `6b78f56c894452f5276b53455a44aa1e012c3c0c79b7cb6026129de42478c08a` |
| yr | placed-unit-explicit-rank | 0x743486–0x7434ae | 3421318 / 40 | `8b4054ba8753c783dbdc0ae483b7673643a562dd12c2be320318852c23c6a7b4` |
| yr | rank-percent-store | 0x7500e0–0x7500ef | 3473632 / 15 | `ea8efdd2df7a22d9d0b946a0bccc5a43230105783dfe45f7eaa84ecbe7bf97c5` |
| yr | infantry-fire-frame-defaults | 0x5236a0–0x5236f9 | 1193632 / 89 | `ca6243d50512aa804a7a6282dc722ef6b527f1a909a89312c6f4a6b9f4f8af6f` |
| yr | infantry-global-art-fire-reads | 0x5246a7–0x52473a | 1197735 / 147 | `022ceb7a6a0a86db838ae4f3ebf113257e463331087b13aef3b36763cb21f38d` |
| yr | infantry-fire-animation-and-dispatch | 0x5206b0–0x520adf | 1181360 / 1071 | `6042dc0fbf3f6d4fb9afce32d7889388b682aca6b083d59a2ef04256178f7220` |
| yr | infantry-fire-wrapper | 0x51df60–0x51dfe3 | 1171296 / 131 | `08d1d365e829e8c9cb55e96b3c81bb036208198f783704636346deb4f03f271f` |
| yr | ordinary-rearm-gate | 0x6fc94f–0x6fc981 | 3131727 / 50 | `5067ab494bd7819f79372a21019a5ed85c9b4131fe8de613636ae65e676876a5` |
| yr | ordinary-shot-starts-rearm | 0x6ff274–0x6ff2d1 | 3142260 / 93 | `d16e5fd7e2cdcc04eb725c4ec1e2f25b7d35a71085f7f3c46564a1541c045786` |

The data records pin the 0.01 constants and exact FireUp/FireProne names in each
image, plus the two YR secondary names. Static source/frame checks do not prove
native execution cadence or every GetFireError gate. Those require further source
coverage and, where useful, owner-provided original observations.

Ten focused original source tests cover both profiles, decimal and storage
precision, staged Image/ART defaults, exact case, inactive alternate branches,
unknown active fields, source/memory boundaries and every lower resource limit.
The private value oracle rehashed five whole MIX roots and all six consumed
rules/ART/mission members. It independently reparsed raw INI fields, exact source
lines, Image/frame histories and every explicit placed-rank token. Previously
reviewed construction visits/type allocation and actor/entity prerequisites are
inputs to this oracle, not independently rediscovered here. It compared 24,766
scalar leaves, including all 96 program/placement joins and the one-shot checkpoint
hashes reconstructed in Python.

| Profile | Types / infantry types | Placements / fresh infantry-unit rows | Standing timing types / placed programs | Compared leaves |
| --- | --- | --- | --- | --- |
| RA2 | 531 / 45 | 811 / 59 | 41 / 40 | 11,889 |
| YR | 691 / 65 | 570 / 74 | 60 / 56 | 12,877 |

Source fingerprints are RA2
`7177fdf735e55d5878ca9fd66bbe7d2cb248643d683923c24789383c2a943652`
and YR `756d954d78ef148f042134badd166de8c17dea8adf5f79446ea6ae54da8d1357`.

Those PR168 fingerprints are historical. The source/world integration in
[PR174](https://github.com/lictl/WebRA2/pull/174) found that lexicographic actor
metadata ordering gave `infantry:2` a different actor ID than the verified numeric
scenario order. The compiler now derives IDs from its independently recompiled
scenario placements. Fourteen-row tests cover both profiles and reversed textual
row order. This corrects the existing declared source-index policy and changes
source/program fingerprints; numerical and ART values are unchanged. Current
whole-scene identity evidence belongs to the [bridge report](ordinary-infantry-bridge.md).
All 133 applicable placement ranks are known in these two openings. The private
96-program run used original opaque weapon IDs and explicit admitted decisions;
it establishes source/timing/save composition only, not native weapon selection or
live combat eligibility. No browser or original executable was run for this slice.

## Private reproduction

The ignored author probe is `local/combat-initial-runtime/probe.ts` in the isolated
worktree. It uses `createVerifiedSourceReader` against the original game folder,
rehashes the six pinned rules/ART/mission members, rebuilds genuine prerequisites,
and writes source results, construction-stage inputs and logical timing transcripts
only under its ignored `local/combat-initial-runtime/`. Root `local/native-art/`
contains the verified range metadata. The independent Python value oracle reads
raw INI bytes and the earlier verified construction visits, not compiler values.
The native ledger/helper are in root `local/combat-initial-runtime/`.

Validation: Node 24.20.0, real `npm ci`, all 847 public tests, type checking,
135-document / 688-link check, publication guard, M0 metadata consistency and the
53-file / 108-input code-only build passed. Twenty of these are new focused
source/timing tests. Retail validation is confined to the private read-only source
comparisons above. The modules are not yet imported by the app; shared distribution
integration belongs to the coordinator. The implementation adopts no new dependency. Its original GPL terms
are in [source provenance](../packages/content/COMBAT_INITIAL_RUNTIME_PROVENANCE.md)
and [scheduler provenance](../packages/sim/INFANTRY_FIRING_PROVENANCE.md).
