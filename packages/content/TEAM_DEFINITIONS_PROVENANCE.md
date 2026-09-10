# Team definition compiler provenance

`src/team-definitions.ts`, `src/team-values.ts` and their original synthetic tests
are GPL-3.0-or-later. They implement bounded typed data compilation informed by
static analysis of the owner's pinned executables and primary interface references.
No native program was executed. Original INI records and disassembly remain private.

Primary reference: [YRpp at 61d0887](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2),
particularly [TeamTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamTypeClass.h),
[TaskForceClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TaskForceClass.h),
[ScriptTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScriptTypeClass.h)
and [ScriptClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScriptClass.h).
These provide interface/layout/address clues, not execution evidence. Native loader,
constructor and dispatch paths in both images are checked independently. The
construction/exact-source components retain their existing separate provenance.

The bounded research uses RA2 game.exe SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and YR gamemd.exe SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
The [55-range ledger](../../docs/analysis/team-definitions-native.json) records
12,925 bytes of inspected caller/constructor/property/dispatch evidence. The
[private aggregate comparison](../../docs/analysis/team-definitions-census.json)
pins source identities and independent projection hashes. Both executable files
are rehashed before any range is read.

| Native path | RA2 VA | YR VA |
| --- | --- | --- |
| Global/mission list call sequence | `65F63B` | `68797A` |
| TeamType constructor / property load | `6BE9B0` / `6BF330` | `6F06E0` / `6F1090` |
| TeamType list load | `6BFBA0` | `6F19B0` |
| TaskForce constructor / property load | `6B6850` / `6B6DF0` | `6E7E80` / `6E8420` |
| ScriptType property / list load | `668C10` / `668CE0` | `6918A0` / `691970` |
| Country read / first house by country | `46AA00` / `4ED760` | `475540` / `502D30` |
| Team waypoint decoder | `724A70` | `763690` |
| Script dispatcher table | `6B8768` | `6E9F74` |
| Current cursor assignment / increment | `668910` / `668920` | `6915A0` / `6915B0` |

The global AI file read and list caller use the same global INI object in each
image. Source list ordering is established from GetEntryKey and immediate virtual
property loads, not registry sorting or editor labels. Country FindIndex checks
Name then ID case-insensitively; missing countries are constructed directly and
Team House lookup may still return null. This path differs from generic type
FindOrAllocate's none sentinels. The compiler represents late identity allocation
without inferring country property inheritance or a new house.

Both dispatch tables identify the selected numeric operand handlers. Cursor
subtraction, packed-cell stride and guard multiplication are visible arithmetic;
completion paths explain the subsequent cursor increment. Runtime effects remain
unimplemented. Native scanf return/overflow/truncation cases are deliberately
outside the narrow supported text subset.

[Report and limits](../../docs/team-definitions.md). Native stage/default evidence
is deliberately separate from the unimplemented runtime behaviors. External allocation
paths, native parser duplicate ties, global AI overlays, inherited country fields,
truncated identifiers, unknown script semantics and malformed native scanf results
remain outside this component's supported execution capability.
