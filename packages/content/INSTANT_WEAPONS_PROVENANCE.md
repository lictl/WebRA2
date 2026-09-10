# Instant-weapon context provenance

[instant-weapons.ts](src/instant-weapons.ts) and its
[original synthetic tests](../../tests/content/instant-weapons.test.ts) are
GPL-3.0-or-later. The implementation is original TypeScript over statically
inspected behavior, using existing source-view/weapon-number code with its own
[provenance](WEAPON_DEFINITIONS_PROVENANCE.md). The already locked MIT
`@noble/hashes` 2.4.0 supplies hashing. No new dependency, native binary, decompiled
listing, original fixture or retail table is shipped. Coordinator-owned distribution
notices must include this component when it becomes reachable from a bundle.

Pinned primary interface hypotheses come from YRpp revision
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`:
[MapClass / TrajectoryHelper](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/MapClass.h),
[BulletClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/BulletClass.h),
[RulesClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h),
[InfantryTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/InfantryTypeClass.h).
No header implementation is copied. Names/addresses from headers are hypotheses;
actual branches, field offsets and constants were checked in both supplied images.
The [component report](../../docs/instant-weapons.md) distinguishes these observations
from the conservative rectangle and caller-occupancy policies.

The source images are `game.exe` (5,077,312 bytes), SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`, and
`gamemd.exe` (5,286,208 bytes), SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
All ranges below are PE-mapped file-backed byte ranges. End addresses are exclusive.
Code spans contain complete instructions; they are inspected spans, not assertions
of full function extents. Constructor prefixes preserve the register definitions
that establish fresh-object defaults. Cell-offset initializer prefixes establish
only the first zero entry. Data spans label the count, unit scale, rounding
constant and source-section names. Native saves/reused Rules state are not modeled.
Death/scheduling spans are YR-only evidence for retained limitations, not RA2 parity.

The ledger contains 39 ranges / 27,253 inspected bytes.

| Profile | Role | Kind | VA start–end | File offset | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| ra2 | fresh-rules-defaults | code | `00640b80–006428c3` | 2362240 | 7491 | `68aa3308f9a52f28b686accf1b3ebc5066311645222cd78d58658f8efcd6a209` |
| ra2 | combat-maximum-load | code | `00647a16–00647a41` | 2390550 | 43 | `4d95cda7c4fb784f923488c4d55ece31491e482d8b564b0d23e0f63ff5b93dad` |
| ra2 | elevation-fields-load | code | `00647d40–00647dda` | 2391360 | 154 | `136d05971c0f93913a854c16b319b58da29d6eccbf2c50a0dbf0ce9df584d41e` |
| ra2 | readfile-elevation-call | code | `00643b1e–00643b2e` | 2374430 | 16 | `58c6eb7aa61a225813174785a413a85fbc3bee1c1d046beeaa182bd3a2aded1a` |
| ra2 | elevation-range-flag | code | `006c4c1a–006c4c34` | 2903066 | 26 | `f1233cecec9df8f5a8fb492e4238d71a9904d0b182c5f17b645abd0c45778111` |
| ra2 | flat-elevation-bonus | code | `006c48f0–006c4a61` | 2902256 | 369 | `cc36c404f4c7522fb0feb22046cd3b0b5820b18ad9dd8fabd89beb67afb947a0` |
| ra2 | linear-obstacle-helpers | code | `004bb890–004bbed9` | 768144 | 1609 | `0afb7c9946b4c14b1fd0062f843cc6522e88c3e98cb9eadf4590428c453c62b0` |
| ra2 | invisible-location-speed | code | `004618e9–004619fc` | 399593 | 275 | `f0754e364f9b5267adaa55a39e1932687b304492828210ab1c214e29624fabc4` |
| ra2 | ordinary-bullet-area-call | code | `00462550–004625a4` | 402768 | 84 | `cf554b0b99b073f555e5c34f29fe533b4873514f942f30b738a153ecb9d3a45d` |
| ra2 | damage-area-ground-occupants | code | `0047e2c0–0047eab6` | 516800 | 2038 | `0f1b1e430783d723c42981afd1ed17dd67d5e7ac6e065a5c250c4b0d4af8d763` |
| ra2 | total-damage-clamp | code | `0047e1c0–0047e2ad` | 516544 | 237 | `fb9a8ffcee69e08a494f60939c7bc3f980e6362b9a7e917d14a359f2e26b400b` |
| ra2 | damage-animation-selector | code | `0047f4d0–0047f600` | 521424 | 304 | `406abf4c7824b73e5f94dd769271e42c1f4d82da26473bd59b52e6c834a5d18a` |
| ra2 | zero-spread-cell-initializer | code | `005441e0–0054421e` | 1327584 | 62 | `6eccab13328a8f20d23ebe955787e01ce8697a01b58c26d330bc7d271abf36c2` |
| ra2 | section-label-data | data | `007eecb8–007eece1` | 4123832 | 41 | `cd679ad0c72cd4a203c6ec0bfa4304a26b4b7d4dca1e77e23b52a6a15ef6166c` |
| ra2 | section-pointer-data | data | `007a9044–007a9050` | 3838020 | 12 | `2d0f1cf31fb44d4023b9c0c8d6de94a9674dd88354baabfcea3cc1bde3020c60` |
| ra2 | zero-spread-count-data | data | `007a5908–007a590c` | 3823880 | 4 | `67abdd721024f0ff4e0b3f4c2fc13bc5bad42d0b7851d456d88d203d15aaa450` |
| ra2 | cell-units-data | data | `0079b0ac–0079b0b0` | 3780780 | 4 | `c65c6602640bff581e75467aa3d034c2cb7487f01511ad9eb50ea0b8d087ac15` |
| ra2 | spread-rounding-data | data | `0079dd78–0079dd80` | 3792248 | 8 | `af2597eaf11db0c07488aa1c4819a81ec7bcc2392002abd9428615cf91e9e366` |
| yr | fresh-rules-defaults | code | `00665650–00667825` | 2512464 | 8661 | `3f8cb9f1935cf24511e35eb46454cfd13483bf246d93c1222c0c2953a2993f52` |
| yr | combat-maximum-load | code | `0066ce2c–0066ce57` | 2543148 | 43 | `f548a7f5fb7e730746658dee7600df8a96534d6f57266c6ea9a308be48a90766` |
| yr | elevation-fields-load | code | `0066d150–0066d1ea` | 2543952 | 154 | `ee5383629c836be724aa369e4206721077139d2105aa4a71e58bb2bb784b67c4` |
| yr | readfile-elevation-call | code | `00668f43–00668f53` | 2527043 | 16 | `a9436f2b74c8883e838e4135eb6f4acb2c1014816046a99479ea869fce6fc283` |
| yr | elevation-range-flag | code | `006f72ef–006f730b` | 3109615 | 28 | `c362ceb96e55d91dcc53dd4ffeb47e88fde0be29d68420f5899091718afd5447` |
| yr | flat-elevation-bonus | code | `006f6f60–006f70d1` | 3108704 | 369 | `d41abd8184f42f96a677528549a3f88a17e93a8455ed655728db80deef60b5b9` |
| yr | linear-obstacle-helpers | code | `004cc100–004cc74c` | 835840 | 1612 | `b777126140b58a4486346a31077e00d8b2d0e8c69bbf2c4481769d5ba420123e` |
| yr | invisible-location-speed | code | `004688a9–00468992` | 428201 | 233 | `ba5b1167eb23cbb45e8f17ce1409c49ef046e07a3a408da7c88396972b1b7a3c` |
| yr | ordinary-bullet-area-call | code | `00469a3f–00469aa4` | 432703 | 101 | `7333a92d8c569ffb85fc78f83d541343fbc638930cb358624ae29620c449694b` |
| yr | damage-area-ground-occupants | code | `00489280–00489ad6` | 561792 | 2134 | `2d90adad413742e38fcff1675b321004d0a4b25db0c575620e28c24b4014c33c` |
| yr | total-damage-clamp | code | `00489180–0048926d` | 561536 | 237 | `07254fca878b07c43de371ae141a28d08cec8666b0e90b58ac43a36c6832d047` |
| yr | damage-animation-selector | code | `0048a4f0–0048a620` | 566512 | 304 | `2ac89b89fbed44857dda371797d934f05ed7de3072bf056fec5aa68689c06d3e` |
| yr | zero-spread-cell-initializer | code | `00561910–0056194e` | 1448208 | 62 | `d8ac42438d387767017ff7c44c3d62fbaacfb3153a1f0747c64a86277b2772bb` |
| yr | infantry-death-animation-root | code | `00518369–005184f7` | 1147753 | 398 | `9ebc2e9e50937608355183307d5df6948cec10b6bf732b789b862434d47c9732` |
| yr | bullet-ai-impact-dispatch | code | `00467f9b–00467fba` | 425883 | 31 | `764b434cc86e391c4cddc785001c6b8e3c98d664e35b6602c0dd59e38ebd162d` |
| yr | fire-detonation-call | code | `00469020–00469038` | 430112 | 24 | `d983d6eb0c58cab794daa64365640bb831075ef173334565a438c085ea3b4cea` |
| yr | section-label-data | data | `00839e70–00839e99` | 4431472 | 41 | `cd679ad0c72cd4a203c6ec0bfa4304a26b4b7d4dca1e77e23b52a6a15ef6166c` |
| yr | section-pointer-data | data | `007f0c84–007f0c90` | 4131972 | 12 | `6872381a640aa7b87b34fb259e5fe06031caacd8617a96c728fe28565c368c17` |
| yr | zero-spread-count-data | data | `007ed3d0–007ed3d4` | 4117456 | 4 | `67abdd721024f0ff4e0b3f4c2fc13bc5bad42d0b7851d456d88d203d15aaa450` |
| yr | cell-units-data | data | `007e2224–007e2228` | 4071972 | 4 | `c65c6602640bff581e75467aa3d034c2cb7487f01511ad9eb50ea0b8d087ac15` |
| yr | spread-rounding-data | data | `007e5160–007e5168` | 4084064 | 8 | `af2597eaf11db0c07488aa1c4819a81ec7bcc2392002abd9428615cf91e9e366` |
