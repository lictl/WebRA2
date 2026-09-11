# Ordered mission house dispatch

Status: **WORKING** under [issue233](https://github.com/lictl/WebRA2/issues/233),
part of the [first playable mission](first-mission-closure.md). The current
checkpoint covers source-bound ownership actions14/36 and population events9/10/11
for fixed initial actors during scenario polling. Cell/object callback and dynamic
team composition remain explicit gates. It is not a completed original mission.

`MissionProgramOptions.houseSource` optionally retains the genuine source catalog.
The final optional argument to `prepareMissionBindings` binds that same source to
the exact original binding catalog. Every admitted occurrence matches its source
kind, trigger, opcode and all original parameters. Copied catalogs, cross-catalog
references and unsupported unrelated instructions cannot grant authority. Callers
that omit the option preserve their previous source/model/save shapes and hashes.

The compound model requires the matching genuine world-8 ownership binding and
the complete original base-world identity. This mode advances the world once,
then polls the mission using an opaque, one-use candidate-world context. A transfer
applies immediately: a later action or population predicate in that same poll sees
its new owners and counters. Returned effect lists are observations of this
execution; the engine does not apply ownership by replaying caller-supplied effects
after polling. A failed work, state or trace bound returns neither partial world
state nor partial mission state. The context owns a clone and releases it after
success or failure.

The action's source house comes from the first allocated house of the triggering
type's owner country. It is separate from YR's nullable event-derived trigger
house. The existing nullable component invocation preserves that distinction.
Selector8997 remains unsupported by this VM checkpoint until its saved event and
trigger state is implemented; neither an initial owner nor a firing actor is
substituted for it. The paired native interpretation is recorded in the
[house provenance](../packages/sim/MISSION_HOUSE_PROVENANCE.md).

Current-owner command/hostility and population behavior are WebRA2's documented
ownership policy. This does not claim all native capture animation, power,
factory, limbo, dynamic tag attachment or house defeat side effects. Those remain
part of the wider issue and mission integration work.

Five original miniature mission tests cover both profiles, same-poll transfer and
population, tagged actor selection, every restored/replayed boundary used in the
fixtures, exact aggregate-work rollback, copied/consumed contexts and the8997 gate.
The focused regression across mission logic, compound world, audio dispatch and
these tests passes40 cases plus type checking. The complete local check passes
1,410 public +14 tool tests, types,208 documents/1,076 links, publication/M0 guards
and79 code/license outputs from188 approved inputs. Fresh retail source census
and independent review remain pending. No retail executable
was run, no retail payload is in the fixtures, and no audible/browser-playability
claim follows from these component results.

Relevant code: [private context](../packages/sim/src/mission-action-world-context.ts),
[mission VM](../packages/sim/src/mission-logic.ts),
[compound world](../packages/sim/src/mission-world.ts), and
[original tests](../tests/sim/mission-house-dispatch.test.ts).
