# Team activation source provenance

`src/team-activation.ts` and its original synthetic fixtures/tests are
GPL-3.0-or-later. They contain original bounded compilation informed by static
analysis of the owner's pinned RA2/YR images and the GPL primary interfaces in
[YRpp at 61d0887](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2),
particularly [TActionClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TActionClass.h),
[TeamTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamTypeClass.h),
[TaskForceClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TaskForceClass.h),
and [GeneralDefinitions](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h).
Header names alone do not establish execution behavior. Both executable images
were read without execution; raw listings and original source rows remain private.

The [range ledger](../../docs/analysis/team-spawning-native.json) pins each image,
PE-translated file offset, exclusive range endpoint and SHA-256. Code endpoints
were checked with Capstone 5.0.6; data ranges are explicitly classified. The
[existing team data provenance](TEAM_DEFINITIONS_PROVENANCE.md) separately covers
ordered team/script/TaskForce loading and the two-letter waypoint decoder.

| Observed path | RA2 VA | YR VA | Interpretation |
| --- | --- | --- | --- |
| Action source load | `6AD860` | `6DD5B0` | CSV mode 1 selects team; four numeric bound fields follow, then encoded waypoint |
| Team reference mode | `6AD8C7` | `6DD61F` | atoi result -1 means null; raw token length below 3 uses physical array index; longer names call FindOrAllocate |
| Literal team lookup | `6BFB10` | `6F1920` | Case-insensitive ID search, with implicit allocation when no existing non-sentinel name matches |
| Action 4 dispatch | `6AEC7D` | `6DEB57` | Increments initialization counter, calls CreateTeam with null owner override, decrements counter |
| Action 7/80 dispatch | `6AECD4` / `6AECF6` | `6DEBAE` / `6DEBD0` | Calls common reinforcement with -1 or the stored action waypoint; 80 requires a nonnull team and waypoint not -1 |
| Common reinforcement | `639970` | `65D8E0` | Requires nonempty TaskForce; may synthesize guard script for an empty script; generates actors before placement branches |
| Actor generator | `639DA0` | `65DD30` | Allocates team; iterates TaskForce quantities in source runtime order; calls each type's CreateObject with team owner; joins created members |

The compiler retains source origins and raw eight-token action frames. It admits
only existing literal team definitions, mode 1 and valid explicit/team waypoints.
Physical team indices are recorded as candidates and withheld because external
native allocations are not completely modeled. Mode 5 shares team lookup but writes
a different final integer field; it is retained as unsupported. Whitespace in
literal team/encoded waypoint operands is not silently removed. Unknown references,
malformed operands, duplicate consumed exact sections and unsupported source kinds
are surfaced or rejected. No action is executed by this content component.

Create Team remains a recruitment capability gap; reinforcement is not used as its
substitute. Missing/native-synthesized scripts, transports, droppods, special house
selectors, native placement/formation, trigger latch/repetition and Scenario RNG
sequencing are separate work. The source scanner's documented retained INI
normalization remains in effect; it is not a universal native parser.
