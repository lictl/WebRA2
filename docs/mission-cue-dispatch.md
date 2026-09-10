# Source-authorized mission cue requests

[Issue195](https://github.com/lictl/WebRA2/issues/195) joins the reviewed
[cue reference catalog](mission-cues.md), [source bindings](mission-bindings.md)
and [compound mission/world runtime](mission-world.md). Text11, camera48 and radar55
can now produce ordered requests from a complete supported source program. This
is not native presentation, media playback or complete campaign admission.

## Complete source joins

`prepareMissionBindings(catalog, cues?)` accepts an optional genuine cue catalog.
The private source logic is still compiled as a whole. Its profile and mission
hash must match the cue catalog, and each selected instruction must match its exact
owned source operands, ID, owning trigger and opcode. A separate immutable source
operand accessor supports this join; copied catalog metadata cannot replace it.
Missing or unresolved text/waypoints, media actions, unrelated unsupported events,
teams/scripts and omitted source instructions keep the complete authority null.
No original mission is filtered to a supported subset.

The VM records `presentation-request` effects in actual action order, including
nested forcing and the existing disabled/deleted/once/repeating semantics. Its
program fingerprint includes the selected cue catalog and
`webra2-source-cue-dispatch-1`. Native source operand evidence remains in the
[paired cue ledger](analysis/mission-cues-native.json); forcing/deletion behavior
retains the [existing lifecycle boundaries](mission-trigger-lifecycle.md).
No new claim is made about screen timing, camera movement, radar coalescing or
physical tag destruction.

Programs prepared without a cue catalog keep their previous program/model hashes,
checkpoint schema and output shape. Selecting a catalog changes those identities;
a checkpoint cannot be restored against different mission/CSF selection.

## Private dispatch, requests and continuation

The compound model obtains its cue catalog from the genuine prepared program.
`stepMissionWorld` advances the private VM and immediately converts only its emitted
presentation effects into source-bound requests. No exported function accepts an
arbitrary list of claimed VM effects as presentation authority. The earlier
caller-driven cursor remains a reference-ordering tool and is not promoted to this
role.

The optional `presentation` checkpoint contains the selected catalog fingerprint,
last processed tick and next sequence. Its clock must match the compound world/VM
clock; sequence values cannot exceed the VM's emitted effect counter, and initial
state requires sequence zero. Restore proves schema/source consistency, not the
historical authenticity of a user-edited noninitial checkpoint. As with the existing
world saves, valid changed state can describe a different continuation.

Each result's optional presentation batch records the model/catalog identities,
from/to ticks, complete resulting checkpoint hash and requests with their VM order,
binding/trigger/instruction IDs and catalog-owned payload. The pair of binding and
trigger IDs identifies the VM instance. `isMissionWorldPresentation(model, batch)`
checks process-local genuine batch identity; copying or JSON decoding the object
does not retain that identity. Future worker/renderer integration must carry its own
verified transport boundary rather than treating an arbitrary serialized batch as
authenticated.

`sourceDispatchVerified: true` states that this batch came from the source-bound
private VM step. `nativePresentationVerified: false` and each reference event's
`playbackAuthorized: false` remain: these are requests requiring separately
implemented consumers. They must not be directly wired to audio, movie or browser
I/O. Simulation performs no DOM, wall-clock, filesystem or network operations.

Admission, multi-tick stepping and replay retain compound atomic rollback. A late
world failure, cursor failure or output exhaustion publishes no caller checkpoint
or batch. The existing cursor caps1,024 requests per tick and1,000,000 lifetime
sequences. The compound call/replay additionally caps repeated text at1,048,576
UTF-16 units and requests at32,768; request count/text units charge the existing
bounded work counter. Other VM/world/parser limits continue to apply.

## Verification and remaining work

Seven new original tests cover both profiles, complete refusal without genuine
source references, exact operand changes, changed CSF identities, unsupported media,
process-local batch brands, actual nested force/enable/delete order, every-boundary
restore, grouped stepping, ordered replay, moving world commands, old checkpoint
shape and late payload/work rollback. These are generated fixtures, not native
screen or campaign tests.

A fresh private438-file read prepares both opening sources and independently
rehashes their selected profile CSF through the verified source reader. All75 RA2
and31 YR text/camera/radar occurrences are accepted as requests by the whole-program
compiler. Required diagnostics reduce from367 to292 for RA2 and531 to500 for YR;
both original authorities remain null. The [metadata census](analysis/mission-cue-dispatch-census.json)
contains only hashes/counts. Raw rows, strings, geometry and private projections
remain ignored locally.

Native presentation consumers, source audio/movie resource closure, physical events,
team activation, economy/production, broader unit behavior and complete original
mission objectives remain required work. The browser is unchanged by this slice.
