# Native profile and campaign selection evidence

Issue [#31](https://github.com/lictl/WebRA2/issues/31), under
[#18](https://github.com/lictl/WebRA2/issues/18). This investigation supports a
specific installation proposal: select the `expandmd01.mix` copies of `rulesmd.ini`
and `all02umd.map`, retain their alternatives, and use the MAPSEL tables as campaign
transition evidence. It does not establish a universal native mount order or a
working campaign interpreter. No reference program was executed.

## Sources and method

The [locator manifest](native-profile-locators.json) pins both complete executables
and the reviewed byte spans. Addresses below are PE virtual addresses at the
recorded image base, not file offsets. Every span also has an absolute file offset,
size and SHA-256 in that manifest. `game.exe` is 5,077,312 bytes / SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`;
`gamemd.exe` is 5,286,208 bytes /
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
These identities describe the supplied Steam Traditional Chinese files; version
resource labels do not certify a particular historical retail patch.

Apple LLVM objdump 21.0.0 read bounded x86 spans. Disassembly, private source copies
and extracted table bytes stayed in ignored `local/native-profile-evidence/`.
Published artifacts contain factual locators, hashes, counts, schema controls and
candidate filenames only. The CLI rechecks full root/member hashes and unchanged
file metadata with the existing [verified reader](verified-source-reader.md).
Span hashes reproduce the inspected identity; they do not automatically prove a
human interpretation of the instructions.

Primary published address references guided targeted inspection:

- [YRpp MixFileClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/MixFileClass.h#L50),
  [GenericList](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GenericList.h#L6),
  [CCFileClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CCFileClass.h#L228)
  identify the bootstrap, constructor, list and file-class boundaries. The supplied
  YR bytes at those addresses were inspected; address labels alone were not accepted
  as proof. The files' SHA-256 values respectively are
  `e6173148439742a4d100d34dabca15a8301c0068d7a0a19b34038fa07d2a1c02`,
  `ca09ac196afab31390da7281185e1b895f98f92d5b445497209a7ff8fee7d95a`,
  `59852dc24458c318b10b62b1da134ad73b469d971fcd6f0a6c769ccdb7bde1bb`.
- [YRpp ScenarioClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScenarioClass.h#L90)
  locates continuation buffers and scenario control fields; SHA-256
  `6422bf651e374b57821e6e046da239fa3cacb821d5424725c8c4876c73dda2f0`.
- [Phobos map-selection hooks](https://github.com/Phobos-developers/Phobos/blob/c760aaeaa6700bb857bf9e311c8a0b35d5249d0e/src/Ext/Scenario/Hooks.Variables.cpp#L117)
  identify a native win-branch replacement and the call at `0x5add63`; source
  SHA-256 `1c822a88d39b4c1c88c795c3e0e1693464d7750185420ee5bd2a010c2e4f87b0`.
  Phobos deliberately changes this behavior. Its replacement body is not vanilla
  behavior evidence and was not translated into WebRA2.

All new TypeScript/tests in this slice are GPL-3.0-or-later because they compose the
existing GPL content scanners. They are original structural metadata tooling;
no native instruction sequence or upstream implementation body is included.
No new runtime or private analysis dependency was installed. Existing
[component provenance](../../packages/content/PROVENANCE.md) and
[distribution obligations](../licensing.md) remain applicable.

## Archive and loose-file selection

| Observation | RA2 address | YR address | Interpretation and confidence |
| --- | --- | --- | --- |
| Numbered expansion loop starts at 99, decrements through 00, tests raw file presence and constructs each present archive | `0x515ca9–0x515d7f` | `0x5301ba–0x530290` | High static confidence. RA2 uses `EXPAND%02d.MIX`; YR uses `EXPANDMD%02d.MIX`. |
| Base construction follows the loop | `0x515d90` | `0x53029e–0x5302d7` | RA2 opens RA2.MIX; YR opens RA2MD.MIX then RA2.MIX. |
| A successful MIX constructor inserts before the tail sentinel | `0x5954b2–0x5954d3` | `0x5b3de2–0x5b3e03` | With sentinel layout checked at YR `0x52ace0–0x52ad49`, earlier successful construction precedes later construction in the lookup list. |
| Lookup starts at the head, advances on failure and returns on the first matching numeric ID | `0x595ae1–0x595bb1` | `0x5b44a1–0x5b457d` | High static confidence for ordinary MIX ID lookup. This does not turn an ID/hash candidate into a recovered literal filename. |
| Read-open checks the loose/buffered filesystem path before trying MIX lookup | `0x469220–0x469349` | `0x473d10–0x473e4c` | High static confidence for this CCFile read path; writes and specialized asset loaders are separate. YR loose existence delegates through `0x431f10` to raw existence. |
| YR local definitions precede base local definitions; map wildcard construction follows expansion construction | — | `0x5303c8–0x530405`, `0x5307b0–0x530908` | Supports the two concrete conflicts below; does not establish wildcard order among several matching map archives. |

The supplied directory contains no loose `rulesmd.ini` or `all02umd.map`.
The full earlier MIX census finds two physical candidates for each logical name.
The verified source identities in [this report](native-profile-census.json) support:

| Filename | Proposed selected source | Selected SHA-256 | Retained alternative SHA-256 |
| --- | --- | --- | --- |
| rulesmd.ini | expandmd01.mix, ordinal 0, offset 2220316, size 743215 | `3d341ef8a13a4b5ab24af2eef48ac94931ac2bb87d950fe3330a07e2d25672ef` | `06761dd7f714e7d9400216ec3c06109ec5c1461f6a0727be7401eb9d8b0f6d05` |
| all02umd.map | expandmd01.mix, ordinal 8, offset 4347996, size 465788 | `e761d28ce43401308ca4532d65479b1cf4a309d74fd4f996fafa92a0a06f8b65` | `168ed42024991b6c2af4de0e5a667e9c2bf15767741efe99dac975721460b303` |

This is a supported static selection proposal for these identities, conditional on
ordinary successful initialization and absence of an earlier external override.
The CLI proposes those two sources explicitly; it does not implement a general
filename-derived ranking policy in the existing VFS. Language initialization,
wildcard enumeration order, external cache/local archives, dynamic theater/side
mounts and specialized lookup paths still prevent a universal priority claim.

## Native progression path and table facts

Both binaries read Basic continuation/control fields into scenario state. The win
paths inspect `OneTimeOnly`, then `EndOfGame`, and branch on `SkipMapSelect`:
RA2 `0x65dae9–0x65dbbf`; YR `0x6859ab–0x685a84`. When map selection is bypassed,
they pass a normal or alternative continuation buffer to a separate helper.
Otherwise they call the map-selection path. YR's published Phobos hook targets
exactly these native boundaries, providing an independent locator check.

The normal path calls `0x58f900` (RA2, call at `0x58f563`) or `0x5ae100` (YR,
call at `0x5add63`). Those paths obtain the current stage from the current scenario,
resolve a stage-choice target, and pass the target's scenario field onward.
The corresponding table loader opens `MAPSEL.INI` at RA2 `0x5b009a` and
`MAPSELMD.INI` at YR `0x5cef62`. YR table enumeration and Scenario-field reads
are pinned separately in the locator manifest. This establishes a runtime consumer
in native code; it is not a recorded execution of that consumer.

| Table | Root-relative range | SHA-256 | Structural result |
| --- | --- | --- | --- |
| MAPSEL.INI | ra2.mix, offset 119095600, size 7875 | `f4bcbb678d182c35a4331d69c92150a719d73fc0c95fae36cc52e65d74923982` | 27 stages, 25 choice links, two unclassified scenario references at lines 385/395 |
| MAPSELMD.INI | ra2md.mix, offset 7458896, size 5573 | `074ccccd9e156d586d0ed099ceab78b3d72384c808725d8b5bee2c9799691d52` | 15 stages, 13 choice links, no missing stage targets |

The census identifies explicit links from `all01t.map` to `all02s.map` and from
`all01umd.map` to `all02umd.map`. Both opening maps have `EndOfGame=no`,
`SkipMapSelect=no`, and `OneTimeOnly=no`; their legacy continuation strings therefore
do not establish the normal win transition. Four candidate final maps carry
`EndOfGame=yes`: `all12s.map`, `sov12s.map`, `all07smd.map`, `sov07tmd.map`.
The report keeps every source and line number, including the extra `sov09t.map`
and both second-YR-mission revisions. It does not make them all campaign members.

The structural scanner retains duplicate keys/target sections, missing links and
unknown filenames. It emits numeric stage ordinals and approved candidate filenames,
not stage names, display text, cinematic identifiers or source rows. Table edges
include empty entry stages and unclassified training-related rows; their counts
are not campaign mission counts. Choice activation, branch variables, loss/retry,
save/resume and score/media timing remain untested native behavior.

## Related checksum observation

The supplied YR image has constant-success stubs at `0x5b43e0–0x5b43e3` and
`0x5b43f0–0x5b43f5`, called in archive-cache contexts. Together with direct member
range reads in CCFile, this is evidence of a path that avoids loading/checking the
entire archive payload. It does not explain why the two RA2 movie trailers differ
from their payload hashes, prove the same path for every media loader, or close
[#11](https://github.com/lictl/WebRA2/issues/11). The tolerant import policy remains
an explicit WebRA2 policy, independently of this observation.

## Verification and next comparison

The private census reverified **48 physical reads / 22,405,216 bytes**: both images,
both map-selection tables, all 40 classified mission-content candidates with their
physical copies, and both rulesmd alternatives. Existing root hashes, ranges and
member hashes all matched. Public synthetic tests cover explicit choice edges,
duplicates, missing/invalid choices, privacy projection, controls without guessed
defaults, prototype-shaped names, resource limits, span mutation and range bounds.
The CLI copies validated fields across every input source/image/table boundary;
unknown extra fields never appear in the report. Malformed/sparse arrays, duplicate
physical identities, invalid profiles and unexpected arguments fail explicitly.
Synthetic CLI tests cover injected payload fields and stale sources. The stricter
projection reproduces the original reviewed real metadata without any byte changes.

Using Node 24.20.0 and locked dependencies from the repository root:

```sh
npm ci
node --import tsx --test tests/content/native-profile*.test.ts
node --import tsx tools/analysis/native-profile-census.ts /absolute/path/to/game docs/analysis/native-profile-locators.json docs/analysis/campaign-census.json > local/native-profile-census.json
cmp local/native-profile-census.json docs/analysis/native-profile-census.json
npm run check
git diff --check
```

Missing retail files skip the private gate; they do not pass it. The locator and
campaign-census input hashes are included in the generated report. Neither a byte
match nor the synthetic scanner tests claim an original-game playthrough.

No essential human observation is needed to adopt these two source pins and the
opening mission candidates for the next implementation slice. The coordinator can
combine this proposal with dependency/locale evidence while keeping #18 open for
its remaining gates. A later reference recipe is narrow: run each unmodified Allied
opening in the owner’s original game, record its win-to-second-mission transition,
and record the final mission's return/credits behavior. Keep recordings and saves
private. A separate isolated synthetic loose-versus-numbered-patch fixture is needed
only if a future loader conflict cannot be settled statically; do not modify the
reference installation or ask the owner to repeat already answered product choices.
