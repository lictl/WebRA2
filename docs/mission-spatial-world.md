# Initial-world spatial sound targets

Status: **WORKING** under [issue236](https://github.com/lictl/WebRA2/issues/236).
The source catalog and read-only target resolver are implemented. They do not
admit99/116 to the mission VM or start, stop or restore a browser voice. The
[spatial cue/source report](mission-spatial-audio.md) records the native caller
and distinguishes object assignment from positional controller creation.

`compileMissionSpatialAudioSource` requires genuine binding, cue and audio-policy
catalogs. Their mission/profile and exact cue references must agree. It retrieves
the genuine traversal that created the original world, retaining its identity
alongside the original binding/world/cue/audio hashes. Each99/116 record preserves
all source operands, the canonical waypoint, source geometry, initial building/
terrain candidates and any unsupported reason.99 retains the selected registry
ordinal;116 retains its ignored numeric operand and has no sound index.

The initial packed-map cell level is a signed byte. On flat cells, paired static
analysis reconstructs the initialized native scale104 and truncation after adding
0.5. The resulting positional coordinates are x*256+128, y*256+128 and
trunc(signedLevel*104+0.5). A negative level therefore differs from a naive signed
multiplication by one. The initial reader does not add TMP height. Dynamic tile
placement and slope/bridge height need their own paths; this component explicitly
rejects ramps, nonempty overlays and extra tile/ice state. The independently
reviewed [paired geometry metadata](mission-spatial-geometry.md) is merged in
[PR239](https://github.com/lictl/WebRA2/pull/239) as `499cc9e`.

The bounded object route requires at most one initial building and one initial
terrain object at a selected cell, including source foundation cells. It chooses
the current building before terrain, then falls back to exact positional
coordinates. Multiple candidates of either family remain unsupported because
entity ID ordering is not proof of native linked-list ordering. Mobile units and
infantry are never substituted as attached sound recipients.

`resolveMissionSpatialAudioTarget` checks the complete initial actor/navigation/
footprint model and restores the candidate world before resolving a target. It
uses the world's current occupancy lifetime: pending combat death retains an
object; health-zero removal releases it. Source rows remain immutable, and
ownership adapters may change current owners without replacing the original
model identity. This is an explicit ordinary initial-world policy with object
enumeration enabled during mission execution. Native temporary UI/load enumeration
gates, limbo, dynamic construction, terrain mutation and arbitrary actor insertion
remain outside it. A caller-supplied checkpoint or returned target is component
data, not proof that a trigger fired.

Five original tests cover both profiles, exact99/116 source joins, positive and
negative initial levels with nonzero TMP height, building/terrain precedence,
current removal fallback, ambiguous/unsupported geometry, copied/stale source
rejection and exact work-bound rollback. The removal fixture is a valid component
input, not a claimed native death or genuine mission callback. The focused tests
and type checking pass. Full composed checks pass1,424 public +14 tool tests,
210 documents/1,091 links, publication/M0 guards and79 code/license outputs from
188 approved inputs.

Fresh on-device compilation at `6d16e75` reads438 files. All27 RA2 spatial
occurrences obtain supported initial sources:24 positional and3 object targets.
YR supports106 of116:103 positional and3 object targets;8 ramp and2 overlay
occurrences remain gated. These counts do not admit the actions to the VM or
reduce its required diagnostics beyond the separately composed house changes
(185 RA2 /399 YR). Both whole-mission authorities remain null.

The [aggregate census](analysis/mission-spatial-world-census.json) pins the exact
source, projections and independent audit. A separate Python reader makes3,974
comparisons against four rehashed roots. It checks raw
packed-map and selected TMP bytes, then compares the retained initial model's
foundation membership and actual resolver targets. This audit reuses reviewed
upstream world/foundation and audio choices; it does not independently reconstruct
native object-list ordering or prove sound playback. No source rows, coordinates,
names, extracted assets or native listings are published. Independent agent
review of the new source/resolver remains pending.

Next, bind this source and private current-world resolution to actual ordered VM
invocations. Object sound assignment must stay distinct from starting a new voice.
Reusable-controller replacement, suppression, update timing, saved lifetime and
browser output require their own tested consumers before mission admission.

Code: [source and resolver](../packages/sim/src/mission-spatial-audio-source.ts),
[original tests](../tests/sim/mission-spatial-audio-source.test.ts).
