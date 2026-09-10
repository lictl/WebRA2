# Terrain traversal provenance

`src/terrain-traversal.ts` and its original synthetic tests use
**GPL-3.0-or-later**, Copyright 2026 WebRA2 contributors. This is an original
bounded composition of the existing GPL scenario/INI/TMP components. It does not
incorporate decompiled game code or distribute a native executable. Retain the
[content notice](PROVENANCE.md), [INI source-view notice](INI_SOURCE_PROVENANCE.md),
[terrain report](../../docs/scenario-terrain.md), [TMP notice](../formats/TMP_PROVENANCE.md)
and their upstream copyright attributions. No new dependency is added; noble
hashes retain their existing MIT notice.

Primary reference revision `61d0887eb6040cfb36af16d592e9770ceae4dfb2` of Phobos
YRpp identifies the native addresses and enum labels:

- [GeneralDefinitions.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h#L691-L704):
  twelve LandType slots;
  [SpeedType](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h#L1093-L1103):
  eight movement slots plus `None=-1`.
- [RulesClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h#L190-L192):
  `Read_LandCharacteristics` at `0x674000`.
- [CCINIClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CCINIClass.h#L72-L77):
  `GetSection`, distinct from key count. Its
  [ReadDouble declaration](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CCINIClass.h#L109-L115)
  identifies the helper examined privately.

These header names/locators are factual research references, not copied
implementation or a claim about their distribution license. Both supplied native
images were independently hashed and the relevant file ranges checked statically
with Capstone 5.0.6. The RA2 counterpart and identical TMP mapping were established
from those bytes, not inferred from YR labels alone. Exact ranges and narrow
interpretations are in [the component report](../../docs/terrain-traversal.md).
All disassembly and raw observations remain ignored local research files.

The TMP byte positions come from the existing reader, whose pinned primary XCC
structure and format sources are listed in [TMP provenance](../formats/TMP_PROVENANCE.md).
This does not reinterpret its high reserved flag bits as movement flags. The
upstream format grants and existing GPL composition require GPL-compatible
combined distribution, corresponding source/build scripts, retained notices and
the [GPL text](../../LICENSES/GPL-3.0-or-later.txt). Game asset rights remain
separate. See the [distribution mapping](../../docs/licensing.md).

The decimal/float32 subset, canonical hashing, source validation, blocked-cell
policy and integer graph costs are original WebRA2 choices. The existing
entity-definition investigation independently identified the native CRT halfway
rounding gap; this compiler also rejects exact float32 midpoints. Percent and
exotic numeric boundary equivalence are not claimed. Public tests contain original
INI text, miniature compressed maps and constructed TMP headers/planes; none are
retail fixtures. Private comparison uses liblzo2 2.10 for map LZO and separate
Python LCW, raw TMP, INI, cost and edge implementations.

The original policy-2 [durable identity correction](../../docs/selection-identity.md)
excludes session-only file handles from the canonical hash while retaining physical
source checks. It adds no dependency and changes no native traversal interpretation.
