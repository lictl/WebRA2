# M0 campaign ledger and first implementation slices

This ledger selects 38 faction campaign content identities from the battle-table
candidates and native MAPSEL transition evidence. It does not mark any mission
DECODES, RENDERS, PLAYABLE or VERIFIED. Every row is **INVENTORIED**.

Sources: [campaign census](campaign-census.json), [native profile report](native-profile-census.json),
[native evidence](native-profile-evidence.md). The original game was not executed.
Legacy Basic.NextScenario names do not determine the normal transition.

| Profile | Mission filename | Selected content SHA-256 | Normal MAPSEL next candidate | Distinct event / action / script IDs |
| --- | --- | --- | --- | ---: |
| ra2 | all01t.map | ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c | all02s.map | 14 / 32 / 14 |
| ra2 | all02s.map | 5ebd7a3aaa60215a6da1f63e87a53c4ebf8cb28378b09f7128953ab05e6425fc | all03u.map | 19 / 24 / 15 |
| ra2 | all03u.map | 186e317d4be77eaeec8e0b09e5c813f6ff95aa01e4e206f4b4c82178bf679a61 | all04u.map | 13 / 33 / 13 |
| ra2 | all04u.map | 09e52db16946a330c032e988679ef61ff7745670ddad5e9bfcf96f916d18d093 | all05s.map | 17 / 40 / 16 |
| ra2 | all05s.map | d09cebddc1f4009098dfa48b18bf4022e6e4d00801f1ca8efd99917f185bb225 | all06u.map | 10 / 31 / 14 |
| ra2 | all06u.map | 9e02b8fa4c570000c2bb34c9b0e702b143e2e93ae529faa36556e1f43af0f922 | all07t.map | 15 / 31 / 15 |
| ra2 | all07t.map | 3925c1211d86938a7137ff0df11cba85c59d3ae75742221d5e2d4d502d33c103 | all08u.map | 10 / 29 / 16 |
| ra2 | all08u.map | 71a119187bd8f78a1c7677636e20a18a258f24dc94add2ac2b108a3dae9df8ea | all09t.map | 12 / 35 / 20 |
| ra2 | all09t.map | 89a243ea0d9ccc802bd6e1d7da4d271d0077f86c3883802e27be7840364ac279 | all10s.map | 14 / 25 / 12 |
| ra2 | all10s.map | ac0ea14ec650256a014626db7c78135bb74168ba86d4eb863d987f04b07d1593 | all11t.map | 16 / 31 / 20 |
| ra2 | all11t.map | 08456515dd5e258f5a9ff73b8961491883eccaa3635a8f008dcb1f9369d43887 | all12s.map | 15 / 27 / 18 |
| ra2 | all12s.map | e6d31134742f8566a425a252113fa6b8e3f3eb178b00e34124deec4f7e11250b | EndOfGame=yes | 10 / 29 / 14 |
| ra2 | sov01t.map | 7f4492961d30b5799367aa840ba007932057b19a22a77f95475a18ca1407b99f | sov02t.map | 14 / 31 / 14 |
| ra2 | sov02t.map | ea3aff6876f7e81e76284a2c9b41ee693c71f0f27e1ae45542e8f5ea95c96ae7 | sov03u.map | 15 / 29 / 19 |
| ra2 | sov03u.map | a0ec1cd648f2b1f5cd122713d405b514634941977289080e22990021f8719c05 | sov04s.map | 17 / 34 / 9 |
| ra2 | sov04s.map | a0a95b26639cc1d4d916dea3a264a18e409bef3d2b84c245e67cd250defc2100 | sov05u.map | 11 / 27 / 13 |
| ra2 | sov05u.map | 31c6883ce678c0bcede293c571a610d355319a7cd729d45560183ced152a5629 | sov06t.map | 10 / 19 / 7 |
| ra2 | sov06t.map | bea4548cca589aa1caf6fbc4e69700f8b408d650b700b71c65242f0df9eeeb83 | sov07s.map | 13 / 25 / 18 |
| ra2 | sov07s.map | 0ad2fde5c76f17085065f7b43cb76045935774092b2498badc44fe91e7793171 | sov08u.map | 10 / 25 / 16 |
| ra2 | sov08u.map | 91817fa1585e631cd929b6356ccc29c99f1dfb8144c52cd225e3eeb924370b7e | sov09u.map | 9 / 22 / 14 |
| ra2 | sov09u.map | ef2dd5c5280d20f5759c02cebf860111280dc0f091c322f21b42eeae6b53c8b6 | sov10t.map | 10 / 21 / 10 |
| ra2 | sov10t.map | 5c3d8b26e05a0a73530630db8353637fa9ed7072144d5360e1ab994869428449 | sov11s.map | 13 / 35 / 12 |
| ra2 | sov11s.map | 2f51c08a063f3c4d648bd486672eacc50d3f32903aa14e9566bfd2030464fc7f | sov12s.map | 11 / 23 / 14 |
| ra2 | sov12s.map | f69c18a54ce5915c9cdc08c2f10113853bc8656cf3e5f1392a64818a700d2720 | EndOfGame=yes | 11 / 21 / 8 |
| yr | all01umd.map | dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0 | all02umd.map | 19 / 52 / 19 |
| yr | all02umd.map | e761d28ce43401308ca4532d65479b1cf4a309d74fd4f996fafa92a0a06f8b65 | all03umd.map | 19 / 39 / 20 |
| yr | all03umd.map | b84a2e689cc00f0be064ecbfcd385635ac037f28bf8f72c02b426a0e52ff1547 | all04dmd.map | 15 / 39 / 17 |
| yr | all04dmd.map | f1621a21e7221c1e475a52dccd4a04bb3125f8a095377c917e2122019f2157b2 | all05umd.map | 19 / 41 / 21 |
| yr | all05umd.map | 7ee8148ad4b0092b7970588d9b064ddd6b753fc7bfb352bcc043affeb72c6aed | all06umd.map | 14 / 27 / 19 |
| yr | all06umd.map | cfd2b50c5448fd84ab3647ff3a95f96b45e8dccd6a72b2601c0bb603cddeeb63 | all07smd.map | 14 / 31 / 12 |
| yr | all07smd.map | 0ec687c320382e4c02cf66eec0153b713e56c4449fab7d29b5a19b61bf10e4f3 | EndOfGame=yes | 13 / 31 / 14 |
| yr | sov01umd.map | 498b989a4b6f579dee0904a77f1fabf982c14786db21a46c41900fc8344ec72b | sov02smd.map | 17 / 49 / 16 |
| yr | sov02smd.map | 139a7f17a17cefc20d12c21e9221d94ff6e1e8894ac09ab716fc9f6975d5a665 | sov03umd.map | 17 / 31 / 21 |
| yr | sov03umd.map | df69d0f63f982823bb5818d3d49776028a719a2c20ced2526fab8f5cecb49fe6 | sov04dmd.map | 11 / 44 / 20 |
| yr | sov04dmd.map | 702bd788efbd08ae5b7591a1dfc240684e73faedace2ffaac68baefdfd0fb12a | sov05umd.map | 17 / 31 / 18 |
| yr | sov05umd.map | 22518e8b4a86331a9172048e10de13b45c2826ea4fdf4d2203b58994b897761b | sov06lmd.map | 13 / 32 / 11 |
| yr | sov06lmd.map | f55b65fd33a53dd03f61b48259d7732d260a4f97170e6dcf0767a61af82403a4 | sov07tmd.map | 13 / 24 / 8 |
| yr | sov07tmd.map | eacf89952cb6e8eacd762f97895a062e0b6bfa16c8f916b901c1e667def266d4 | EndOfGame=yes | 15 / 32 / 24 |

The selected `all02umd.map` content is the expandmd01 revision; its base alternative
remains in the source reports. Identical physical copies remain equivalent sources,
without inventing wildcard enumeration order. Extra training/demo and sov09t.map
candidates are not promoted into faction membership.

Opcode counts describe structurally framed occurrences, not implemented semantics.
Every event/action/script ID in the source rows remains unsupported by the engine.
The source census records occurrence counts and parameter widths; subsequent typed
parameter specs must preserve source lines and reject unresolved required operands.

For source verification, the input SHA-256 values used for this projection are:

- campaign-census.json: `cdbaafd772bfd9b4d983da1612de00da98fb75f11a4658f7d9a9653d48fbef32`
- native-profile-census.json: `1db8d8adf37dfa397f45f4517c378a8615ff8be82ab6344040bac7c9e76c8c01`
