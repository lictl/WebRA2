# Initial-world spatial sound targets and dispatch

Status: **WORKING** under [issue236](https://github.com/lictl/WebRA2/issues/236).
Source catalogs, bounded current-world target reads and ordered VM99/116 request
dispatch are implemented. Browser playback and complete original mission admission
remain unavailable. The [source report](mission-spatial-audio.md) distinguishes
object sound assignment from positional controller creation.

## Exact source and initial geometry

`compileMissionSpatialAudioSource` requires genuine binding, cue and audio-policy
catalogs. Mission/profile and exact cue references must agree. It retains the
traversal that created the original world and all binding/world/cue/audio hashes.
Each99/116 instruction preserves all operands, canonical waypoint, source geometry,
initial building/terrain candidates and unsupported reasons.99 retains the sound
registry ordinal;116 preserves its ignored numeric operand with no sound index.

The initial packed-map level is a signed byte. On flat cells, native scale104 and
truncation after adding0.5 produce XYZ: x*256+128, y*256+128,
trunc(signedLevel*104+0.5). Negative levels differ from naive signed multiplication
by one. Initial loading does not add TMP height. Ramps, nonempty overlays and extra
tile/ice state remain explicitly unsupported. The independently reviewed
[paired geometry metadata](mission-spatial-geometry.md) merged in
[PR239](https://github.com/lictl/WebRA2/pull/239) as `499cc9e`.

At most one initial building and one initial terrain object may occupy a selected
cell, including foundation cells. Current building presence precedes terrain,
then exact position. Multiple same-family candidates remain unsupported: entity
ID ordering does not prove native linked-list ordering. Mobile actors are never
substituted as attached sound recipients. Pending combat death retains occupancy;
authoritative removal releases it. Limbo, dynamic construction, terrain mutation
and native temporary enumeration gates remain separate work.

## Bounded current-world reads

The standalone `resolveMissionSpatialAudioTarget` owns caller descriptors under a
structural work budget and reserves ownership reconstruction before restoring that
exact snapshot. Review reproduced a flaw in its earlier scan-only accounting:
256 genuine transfers grew a three-actor save from1,524 to28,918 bytes, while the
old five-unit limit admitted roughly26ms restoration instead of the initial
sub-millisecond case. That local Node diagnostic was not a Chrome measurement.
The corrected reservation grows with saved data and history before reconstruction.

Private action dispatch calls `resolveMissionSpatialAudioInWorld` on its already
validated candidate. The core's authenticated `readWorldEntityPresence` reads
current actor state without serializing or revalidating history per sound. Copies,
proxies and subclasses cannot supply the world; public method overrides are
ignored. Immutable source/model joins may be cached, while the published logical
work reservation includes navigation bindings and blocked cells and stays independent
of cache warmth. Returned component data alone
does not prove that a trigger fired.

## Ordered request dispatch

The optional `spatialAudioSource` joins exact binding/cue/audio objects and all
instruction operands in the VM. A one-use private world context resolves each
99/116 target at its actual action boundary. Generic polling cannot substitute
arbitrary targets. House transfers and subsequent actions share that candidate.
The compound adapter publishes world, VM, cursor and requests only after all work
succeeds. Dynamic team worlds stay gated until their actor/lifetime joins exist.

Authenticated batches retain source instruction, binding, VM order, monotonic
sequence and current object or exact XYZ target.99 retains its sound ordinal;
116 has no sound index and never filters using its ignored operand. The saved
cursor avoids reissuing old requests on an ordinary resumed tick. These dispatched
requests carry `playbackAuthorized:false`. No public caller effect list can mint
a genuine batch. A cursor alone does not restore desired controller state, active
voices, sample queues or audible position.

The [paired controller assessment](mission-spatial-controller.md) preserves these
assignment, instance and playback distinctions. Next, consume these requests into saved object sound intent and distinct positional
controllers with explicit reconciliation timing. Native assignment, admission,
soft stop/decay and audible startup are separate operations. Same-definition
reuse, replacement, gain/admission failure, lifetime and browser output still need
tested consumers. Complete original mission authority remains null.

## Evidence and remaining acceptance

At source-only `6d16e75`, five original both-profile tests covered exact joins,
signed-level extrema/nonzero TMP height, building/terrain precedence, current
removal, ambiguous geometry, copied/stale sources and budget rollback. Full1,424
public +14 tool checks passed with210docs/1,091links, publication/M0 guards and
79 code/license outputs from188 inputs. These are earlier source-only results;
the expanded dispatch composition is undergoing its own full checks.

Fresh source-only compilation read438 files: RA2 supports27/27 spatial occurrences
(24 positional/3 object); YR supports106/116 (103 positional/3 object), with8 ramp
and2 overlay gates. Required diagnostics at that earlier stage remained185/399
after the separately composed house changes; no99/116 dispatch was then admitted.
The [aggregate census](analysis/mission-spatial-world-census.json) pins exact source
and projections. A separate Python audit makes3,974 comparisons over four rehashed
roots, including1,859 raw packed-map/selected-TMP checks. Foundation membership,
world ordering and audio choices are retained reviewed inputs; the oracle does
not independently reconstruct their upstream selection or native object order.
No source rows, coordinates, names, assets or native listings are published.

Independent source review added52 original cases/224 assertions and reproduced
the raw audit; it found the corrected history-accounting issue above. Final
exact-head review, updated source preparation and full dispatch validation remain
due. Neither synthetic tests nor successful decoding constitute an original
campaign playthrough.

Code: [source/resolver](../packages/sim/src/mission-spatial-audio-source.ts),
[source tests](../tests/sim/mission-spatial-audio-source.test.ts),
[dispatch tests](../tests/sim/mission-spatial-audio-dispatch.test.ts).

The expanded composition now passes1,444 public +14 tool checks, type checking,
211 document files/1,106 links, publication/M0 checks and79 code/license outputs
from189 inputs. The added source/controller documentation is validated separately.
The six dispatch tests cover positional/object targets, ordered house composition,
source refusals, cursor/one-use limits, every-boundary restore/replay and the
corrected long-history reservation. The core read seam adds six separate original
current-state/hostile-instance/lifetime tests. No browser playback was exercised.
