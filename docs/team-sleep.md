# Persistent source team Sleep

[Issue #169](https://github.com/lictl/WebRA2/issues/169) extends the
[source team controller](team-runtime.md) and [reinforcement runtime](team-spawning.md)
with script opcode 11, mission zero. Native handlers maintain the actor mission and
never set StepCompleted. The proposed integration retains a persistent Sleep phase;
later source script lines must not execute just because entry stop orders succeed.

The new bounded policy recognizes only numeric `11,0`, follows complete admitted
script control flow and prepares immutable stop/member state. An explicit script
jump may bypass a Sleep instruction; ordinary sequential flow cannot cross it.
All source instructions remain subject to full-script admission, including lines
after an unreachable Sleep barrier. Other mission operands stay unsupported.

Entry stops every living bound actor once. Subsequent Sleep observations must remain
stationary, retain the entry tick and cursor, and retire dead members without
manufacturing script completion. Limits are 50 source instructions and 64 members
or stop orders per instance; existing aggregate program/transaction bounds still
apply. Source-program identity must include the new policy before execution.

The new policy's original tests cover source recognition, script jumps/barriers,
entry/hold/loss, immutable results, malformed identities/ticks, getters and bounds.
The shared runtime patch and full source/compound validation are in progress in a
separate private proposal checkout; this checkpoint alone does not enable Sleep.

[Native provenance](../packages/sim/TEAM_SLEEP_PROVENANCE.md) and the
[30-range ledger](analysis/team-sleep-native.json) distinguish observed dispatch
from the explicit D03 whole-cell stop policy. No native binary was executed.
Private scripts/listings remain under ignored `local/team-next-opcodes/`.
Native regroup/queue timing, autonomous acquisition and campaign readiness remain
separate work. No mission path is hardcoded.
