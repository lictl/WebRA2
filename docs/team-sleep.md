# Persistent source team Sleep

[Issue #169](https://github.com/lictl/WebRA2/issues/169) extends the
[source team controller](team-runtime.md) and [reinforcement runtime](team-spawning.md)
with script opcode 11, mission zero. Native handlers maintain the actor mission and
never set StepCompleted. The runtime retains a persistent Sleep phase; succeeding
entry stop orders cannot advance a later source line.

Only exact numeric `11,0` is admitted, with genuine team/world identity and freshly
hashed mission source. The source compiler still validates every instruction in the
selected script, including later lines unreachable through Sleep. Other mission
operands, unsupported team behavior and combat-bearing models remain rejected.
An explicit script jump can bypass a Sleep instruction; ordinary sequential flow
cannot cross it. No source path is hardcoded.

Entry stops every living bound actor once, including clearing in-flight movement at
its current authoritative cell. Held Sleep observations must remain stationary,
retain the entry tick and cursor, and retire dead members without manufacturing
script completion. All-member loss becomes `lost`, not `finished`. Limits are 50
source instructions and 64 members or stop orders per instance; existing aggregate
program, order, work and transaction bounds still apply. Competing scheduled orders
cannot take ownership of a controlled actor. A failed stop admission rolls back the
whole candidate transaction.

The component-owned program policy is `webra2-existing-team-cells-2`, with
`sleepPolicy: webra2-team-sleep-stationary-1` included in program identity and pending
plan hashing. Checkpoints retain Sleep using the existing cursor and `issuedAt`
fields. Restore validates both persistent state and control-flow reachability;
forged completion, later cursors, moving held actors and omitted pending stops fail.
Old program, roster and spawn catalog fingerprints are intentionally incompatible;
there is no automatic conversion of older saves.

Fourteen original tests cover both-profile move-to-Sleep with every-tick pending
restore, later-line barriers and explicit jumps, in-flight entry stop receipts,
partial/total member loss, source rejection, forged completion, scheduled order
ownership, compound rollback, blocked prior movement, dynamic birth/second insertion
and replay. Policy tests additionally cover malformed input, getters and bounds.
The implementation and proposed two-file runtime integration passed 891 public tests
in an isolated checkout before the subsequent reviewed-main/distribution integration;
that historical count is not the final PR's check total.

The private [source and runtime census](analysis/team-sleep-census.json) pins inputs
and reports nine source-bound reinforcement cases. A separate Python comparison
read 1,178 numeric script rows from raw AI/mission sources, checked the Sleep-only
coverage change across 151 opening templates, and confirmed unchanged typed source
and logic projections. It reuses the reviewed #160 baseline for other capability
gates; it is not an independent native actor simulation.

| Private selected opening | Complete admitted templates | Source reinforcement cases | Subsequent checkpoint restores | Pending-source replays |
| --- | --- | --- | --- | --- |
| RA2 | 3 newly admitted | 1 | 188 | 1 |
| YR | 7 unchanged | 8 | 312 | 8 |

The RA2 case inserts one source-defined actor, moves it to the source waypoint, enters
Sleep at tick 168 and retains the same cursor through `nextTick=189`. Exactly one
entry Stop is issued; 20 subsequent held ticks produce no orders or completion. The
other two newly admitted RA2 templates have no direct supported reinforcement action
in this selected source. YR gains no complete template from Sleep alone; the existing
eight cases retain identical final world saves and all 312 command/event trace frames
against the previous baseline. Program/catalog/compound hashes change with policy.
These are private source-driven WebRA2 checks, not an original-game or browser test.

[Native provenance](../packages/sim/TEAM_SLEEP_PROVENANCE.md) and the
[30-range ledger](analysis/team-sleep-native.json) pin 2,074 code/data bytes in both
images, including dispatch, queue/promotion, ordinary infantry/unit vtable targets and
the persistent mission handler. No native binary was executed. Private scripts and
listings remain in ignored `local/`.

For a reviewer with the owner installation, copy `probe169.mjs`, `oracle169.py` and
`ledger169.py` from the author's `local/proposal/evidence169/` into the review
checkout's `local/`. The probe imports that checkout's source and writes only
`local/opening169/`; the oracle compares the preserved reviewed #160 private baseline.
Create `local/team-next-opcodes/` before running the Capstone ledger reproducer.

```sh
node --import tsx local/probe169.mjs
python3 local/oracle169.py
# Use the configured Python environment containing Capstone 5.0.6:
python local/ledger169.py
```

Native Stray/RelaxedStray regrouping, mission queue phases, cadence and surrounding
actor AI remain different from the explicit D03 whole-cell stationary policy. The
component consumes no RNG and makes no claim about native RNG neutrality. Autonomous
acquisition/retaliation and live trigger dispatch require separate capabilities.
CreateTeam action 4 still needs recruitment; other script missions remain gated.
These changes do not establish campaign readiness.
