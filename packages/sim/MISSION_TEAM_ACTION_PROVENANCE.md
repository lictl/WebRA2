# Mission team action source provenance

`src/mission-team-action-source.ts` and its original synthetic tests are WebRA2
contributor work under **GPL-3.0-or-later**. They compose the existing GPL source,
team and mission factories. No new dependency, native implementation, game data or
listing is included. Preserve this notice, the GPL license text, corresponding
source, and the component notices referenced below when distributing this module.

This component adds source identity and coverage checks. It does not claim new
native action, allocation, scheduling or actor behavior. Its bounded support uses
the already reviewed paired evidence:

| Existing evidence | Scope reused |
| --- | --- |
| [Typed teams](../content/TEAM_DEFINITIONS_PROVENANCE.md), [ledger](../../docs/analysis/team-definitions-native.json) | Global/mission declaration and property phases, source references and exact field histories |
| [Action source](../content/TEAM_ACTIVATION_PROVENANCE.md), [ledger](../../docs/analysis/team-spawning-native.json) | Eight-token action frame; literal/physical/null team lookup; distinct action4 recruitment and7/80 reinforcement branches |
| [Recruitment](TEAM_RECRUITMENT_PROVENANCE.md), [ledger](../../docs/analysis/team-recruitment-native.json) | Existing-member capability and source gates; Flash50 preparation |
| [Team runtime](TEAM_RUNTIME_PROVENANCE.md), [Sleep ledger](../../docs/analysis/team-sleep-native.json) | Complete selected script3/6/11,0/50 programs; no skipping instructions after a jump or persistent Sleep |
| [Initial waypoints](../content/INITIAL_WAYPOINTS_PROVENANCE.md), [ledger](../../docs/analysis/initial-waypoints-native.json) | Profile-specific initial source waypoint presence and the action/script/recruitment consumers |
| [Mission bindings](MISSION_BINDINGS_PROVENANCE.md) | Factory-owned map logic and exact base-world source context |

The underlying primary layout references use YRpp at
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`. They are locator references, not a claim
that header names prove behavior or that YRpp has a particular license. No YRpp
implementation is adopted here. In particular, this notice does not repeat the
older action notice's unsupported characterization of those interfaces as GPL.

The five JSON ledgers above were freshly rehashed against the pinned complete
RA2/YR images, independently mapped through their PE section tables, and checked
for complete code endpoints with private Capstone5.0.6: **213 ledger rows / 32,064
bytes**, counting overlaps across existing ledgers. Their exact metadata file
hashes are in the [census](../../docs/analysis/mission-team-action-source-census.json).
The operand dispatch table in the typed-team ledger is data, not decoded code.
No retail binary was executed and no new native range is published by this slice.

The strict coverage rules are WebRA2 admission policy. Unrepresented global or
mission declarations, unknown fields, automatic flags and unrelated diagnostics
remain required. Complete programs can resolve only old operand diagnostics for
the same effective source rows. The literal-name resolution of the external
allocation warning does not prove the physical native allocation order; it leaves
`nativeAllocationComplete:false`. The full original diagnostics remain available
beside indexed resolution records. See the [report](../../docs/mission-team-action-source.md)
for exact inputs, bounds and separate private source evidence.
