# Mission sound and EVA source-policy provenance

`src/mission-audio-policy.ts` and its original tests are GPL-3.0-or-later WebRA2
code. They compose the existing GPL mission cue/audio catalogs and reviewed
[weapon numeric helpers](WEAPON_DEFINITIONS_PROVENANCE.md). No new package,
retail code, binary table, sample, or disassembly listing is distributed.
Distribution includes this notice, the applicable upstream notices, GPL text,
and corresponding source/build instructions. This is static analysis with retained
provenance, not a formal clean-room claim.

The [paired native ledger](../../docs/analysis/mission-audio-policy-native.json)
pins both full supplied images. It contains 68 factual records, including 58
complete instruction spans, 17,151 inspected bytes and 186 structural/data checks.
Programs were never executed. Capstone 5.0.6 is a private analysis tool, not a
product dependency. A span identifies inspected evidence, not necessarily an
entire function or proof of all incoming runtime states.

Pinned primary interface/layout leads are the same YRpp revision as the
[reference component](MISSION_AUDIO_PROVENANCE.md):
[VocClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/VocClass.h),
[VoxClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/VoxClass.h),
[Audio](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/Audio.h),
[Randomizer](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/Randomizer.h)
and [Unsorted](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/Unsorted.h).
No implementation bodies were copied and no upstream GPL license is asserted for
these headers. Paired executable consumers, not enum labels alone, support the
limited source interpretations below.

- Actions 19 and 21 have explicit caller overrides. Sound is a global request;
  EVA supplies request Type 2 and priority override -1. The selected side and
  active definition/queue state remain caller/runtime concerns.
- Sound defaults are fresh process globals followed by the supported Defaults
  and named-definition reads. Priority's named fallback is NORMAL. Control token
  OR and Type's exclusive masks preserve token order. Native setters/selection
  distinguish attack, body and decay partitions, ALL/RANDOM precedence, loops,
  delay and frequency/volume randomization. Candidates are retained, never chosen.
- The state-machine prefix establishes EBX zero before the inspected startup
  branch. Available channels, clocks, controllers, queues and global audio RNG
  remain runtime inputs. Equal random endpoints do not consume an invented draw.
- Numeric input reuses the reviewed bounded binary32 reader, conservative halfway
  rejection, truncated percentage product and dword store under the pinned startup
  mode. Later thread/control-word mutations are outside this source policy.
- EVA's stored Volume, Type and Priority are distinguished from caller overrides.
  Text and Defaults are retained source fields, not claimed native playback
  controls. Consumption of the stored EVA Volume remains unproved.

The [component report](../../docs/mission-audio-policy.md) separates source readiness
from invocation, playback and campaign authority. All four authority/verification
flags stay false. The independent raw oracle uses Python parsing, binary packing
and rational arithmetic, not the TypeScript policy/numeric functions.
