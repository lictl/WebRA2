# Team runtime provenance

The new team runtime and original fixtures are GPL-3.0-or-later. Existing world
simulation helpers retain their separate MIT notices. This component interprets
numeric mission scripts from user-supplied sources; it contains no retail rows,
assets or native listings. No bundled native program was executed.

Primary interface reference:
[YRpp at 61d0887](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2),
particularly [TeamClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamClass.h),
[ScriptClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScriptClass.h),
[TeamTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamTypeClass.h)
and [RulesClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h).
Headers locate fields and entry points; inspected native paths establish the scoped
control observations. The prior [typed-team evidence](../content/TEAM_DEFINITIONS_PROVENANCE.md)
separately covers source loading, declarations, references and operand decoding.

Native images are RA2 game.exe SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and YR gamemd.exe SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
The local probe rehashes the complete image before reading mapped PE ranges. Raw
listings and exploratory facts stay in ignored `local/native152/` in the team-runtime
worktree. The ledger below pins 20 ranges / 4,979 bytes. Code ranges were decoded through
complete instruction boundaries; the dispatch table is explicitly data.

The dispatch tables at RA2 `6B8768` / YR `6E9F74` select opcode 3's waypoint handler,
5's timer/guard branch and 6's cursor assignment. The move handlers at RA2 `6BAE60`
and YR `6EC7D0` resolve a scenario waypoint on entry, update team focus, consider a
candidate replacement cell, and run common member movement. Completion is set by
RA2 `6BA1A0` / YR `6EBAD0` only after member/context checks. It is not simply a
count of actors occupying a waypoint cell. Native Stray/RelaxedStray, regroup,
height, destination and aircraft paths are outside the current world policy.

The guard branch invokes RA2 `6B9F40` / YR `6EB870` before checking elapsed duration.
That member routine issues native mission/destination operations repeatedly; the
runtime must not replace it with an otherwise inert wait. Guard remains unsupported
until its acquisition dependencies are implemented. Jump stores argument minus two
and marks the step complete; the next enabled update increments the cursor before
reading the next action. The controller's one-update cadence is a WebRA2 scheduling
choice, not a claim about native global phase order.

Explicit existing-actor bindings bypass neither unsupported script instructions
nor source/reference checks. They do not claim native recruitment, assembly,
member-removal side effects or full mission admission. RNG neutrality, native
locomotor timing and campaign behavior remain unverified. [Focused report](../../docs/team-runtime.md).

## Native byte-range ledger

Offsets and sizes are decimal; virtual ranges use an exclusive end. These pins
identify inspected source bytes and do not claim a full native behavior proof.

| Profile / purpose | Virtual range | File offset / bytes | SHA-256 |
| --- | --- | --- | --- |
| ra2 / dispatch-table (data) | `0x6b8768`–`0x6b8784` | 2852712 / 28 | `894ca87e5fa1640491a4fd265913b6f2419650208a1bdd659ff5624d584d7357` |
| ra2 / waypoint-dispatch (code) | `0x6b7f55`–`0x6b7f6e` | 2850645 / 25 | `caba29a0d0ac91a751a298f9fe8c494b58b614b6284c4be08d8d5448696f1575` |
| ra2 / waypoint-handler (code) | `0x6bae60`–`0x6bb020` | 2862688 / 448 | `383a1a4bafb8a74a74ccd38804cd571760ed687271dec91f807f9b4beeb8eddc` |
| ra2 / member-move-completion (code) | `0x6ba1a0`–`0x6ba5f9` | 2859424 / 1113 | `eb43e03dba41b9b3be7462adc6c82554e85a17c3caa885969f3f12e71d70d0cd` |
| ra2 / guard-dispatch (code) | `0x6b8135`–`0x6b8179` | 2851125 / 68 | `2ab455e406d0300ac318c1849c0dc9a0e952664f219ddd242fe692cd1d321b39` |
| ra2 / guard-members (code) | `0x6b9f40`–`0x6ba193` | 2858816 / 595 | `b942285b1428779c93a120346ec9e1fafb1e4d6eb5ce1077bc5d4dcc601d0cd7` |
| ra2 / jump-cursor (code) | `0x6b8215`–`0x6b8230` | 2851349 / 27 | `34db9dd3cdb56c9559ebf608bc6e3056418061f0327f76277be6e115827aa6dd` |
| ra2 / completed-step-advance (code) | `0x6b7cf4`–`0x6b7d4a` | 2850036 / 86 | `1520f5a66fc15f2dc677af180f1873413a2a64924309b42e42ee44e1683f1786` |
| ra2 / script-cursor-methods (code) | `0x668900`–`0x668935` | 2525440 / 53 | `b3dc8fc7f4d0d7a8d9b9731b0f45434ae9227e13336f80bd1bcb93c21b320e61` |
| ra2 / scenario-waypoint (code) | `0x663180`–`0x663194` | 2503040 / 20 | `0cd956f4deab1db719470213f5851ec65b780ba5331ba00f3e9cba0683886fda` |
| yr / dispatch-table (data) | `0x6e9f74`–`0x6e9f90` | 3055476 / 28 | `8ec6de7f30852586c0ba3ed40feeff3c64b8279132e99d16f8acce9589c35864` |
| yr / waypoint-dispatch (code) | `0x6e95ec`–`0x6e9605` | 3053036 / 25 | `7c8e90426d76ad86fb23443f73a4da5e449adc167f36506016bda3a35495f06c` |
| yr / waypoint-handler (code) | `0x6ec7d0`–`0x6ec997` | 3065808 / 455 | `21757139722bc7f54d795ce1cf0c8a2c319f342b08ebd595e3af2e84cfc0645a` |
| yr / member-move-completion (code) | `0x6ebad0`–`0x6ebf4b` | 3062480 / 1147 | `f9b20f3ce8e8f93468cc750052170b3aa160fca28c54a97373627a674ef5c0b5` |
| yr / guard-dispatch (code) | `0x6e97ce`–`0x6e9812` | 3053518 / 68 | `4dcdcae68babff832a3954496ce1ea1ceb6ccddcdca9f30a9ee4e6130c23e574` |
| yr / guard-members (code) | `0x6eb870`–`0x6ebacf` | 3061872 / 607 | `7d2416065de0c71d6dfe0a47c42ec418f200c461f63789f1e7647db75d362907` |
| yr / jump-cursor (code) | `0x6e98ae`–`0x6e98c9` | 3053742 / 27 | `cc94d1880a9db07538171596d5b631cc6d8820811885116fd355b430158087da` |
| yr / completed-step-advance (code) | `0x6e9364`–`0x6e93ba` | 3052388 / 86 | `7bef10fc3454e212a36921b9baa827dcbfc3f3f8ffd552930efbe7823e6c8afa` |
| yr / script-cursor-methods (code) | `0x691590`–`0x6915c5` | 2692496 / 53 | `b3dc8fc7f4d0d7a8d9b9731b0f45434ae9227e13336f80bd1bcb93c21b320e61` |
| yr / scenario-waypoint (code) | `0x68bcc0`–`0x68bcd4` | 2669760 / 20 | `0cd956f4deab1db719470213f5851ec65b780ba5331ba00f3e9cba0683886fda` |

The waypoint accessors read the indexed four-byte stored cell; the inspected handler
chooses focus and may replace an unusable destination. The common movement loops
read live members, native distance settings and actor context before setting the
completion byte. Guard calls its member routine on every poll before checking its
15-times-argument duration; that routine issues native Guard/destination operations.
The completed-step excerpt shows the call to cursor increment; the full surrounding
team lifetime remains outside this implementation.

For the next spawning slice only, pinned [TriggerAction identifiers](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h#L270)
and [TActionClass entry points](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TActionClass.h#L152)
locate CreateTeam, SpawnTeam and SpawnTeamAtWP. Their native semantics have not
been admitted by this component. No new dependency or copied implementation is
introduced by these header references.
