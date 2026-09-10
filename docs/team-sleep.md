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

Fourteen original tests pass with the proposed shared runtime patch in an isolated
private checkout. They cover both-profile move-to-Sleep with every-tick pending
restore, later-line barriers and explicit jumps, in-flight entry stop receipts,
partial/total member loss, source rejection, forged completion, scheduled order
ownership, compound rollback, blocked prior movement, dynamic birth/second insertion
and replay. The standalone policy tests also cover malformed input, getters and bounds.
The shared patch and full private source validation await coordinator integration;
the new files alone do not enable Sleep.

[Native provenance](../packages/sim/TEAM_SLEEP_PROVENANCE.md) and the
[30-range ledger](analysis/team-sleep-native.json) distinguish observed dispatch
from the explicit D03 whole-cell stop policy. No native binary was executed.
Private scripts/listings remain under ignored `local/team-next-opcodes/`.
Native regroup/queue timing, autonomous acquisition and campaign readiness remain
separate work. No mission path is hardcoded.
