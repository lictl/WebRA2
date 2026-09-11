# Spatial mission sound and stop

Status: **WORKING** under [issue #236](https://github.com/lictl/WebRA2/issues/236),
part of [first-mission closure](first-mission-closure.md). The current source slice
extends the existing genuine [cue catalog](mission-cues.md) and
[audio reference/policy](mission-audio-policy.md) with an explicit `spatialAudio`
opt-in. It grants no new VM dispatch, campaign admission, sample-selection or
browser playback authority. Existing calls omit the option and preserve their
original catalog data and hashes.

## Selected native behavior

The paired [source ledger](analysis/mission-spatial-audio-native.json) records
selected spans from both pinned Steam images. Files were read statically; neither
executable was run. Complete instruction decoding is an integrity check for each
selected span, not evidence of a completed runtime implementation.

Action99 uses the mode7 sound registry lookup and the final alpha waypoint token.
The waypoint resolves through the current map cell and bridge height. When the native object-enumeration global is enabled, the consumer searches
the cell's object list for a building first and then a terrain object. The paired
RA2/YR global gate remains an explicit integration requirement. Units and infantry do not receive the attached custom-sound assignment.
A found object receives the sound index in its custom-sound field. Otherwise the
consumer creates a positional controller at the waypoint's exact world coordinates
with flag1. The source field is separate from the object's type-defined ambient
sound. Its initial value is -1, and ordinary object updates maintain its controller
using the object's current coordinates while the object is outside limbo.

Action116 resolves the **current** building/terrain object again. If one exists,
it writes -1 to that object's custom-sound field and stops its controller. Otherwise
it stops positional controllers whose flags intersect1 and whose x, y and z all
match the resolved coordinates. The first numeric value is loaded but is not used
to choose which sound to stop. The supported source subset accepts an ordinary
signed32-bit value; nonzero values occur in both supplied openings.

Consequently repeated object assignments replace desired object sound, whereas
position-only starts may create separate controllers. A building placed between
start and stop can change which controller the stop affects. Object destruction
cleans up both object controllers. Moving, deleting, restoring or reassigning a
controller cannot be approximated by a global stop-all operation.

## Current source API

`compileMissionCues({ ...input, spatialAudio: true })` includes99/116 and pins the
existing genuine initial-waypoint source. Every included location retains its
canonical waypoint, map x/y and the required current-object selection policy.
Invalid/missing/aliased/zero/outside/profile-unloaded locations stay unsupported.
Unexpected reserved operands and ambiguous input sections retain their rejection
boundaries. The option is part of catalog identity; a copied catalog grants no
factory authority.

Sound99 flows through the same verified registry, selected bank samples and
normalized definition fields as sound19, with its distinct spatial caller and
pending controller/listener state. Stop116 has no sound sample reference and does
not reinterpret its ignored numeric field as a registry lookup. The general
presentation cursor and mission VM have not gained authority to invoke either
operation in this source checkpoint.

## Source verification

Source checkpoint `b31de63c2797b8ecd1f62d1d838a86c6657527da` passes the complete
public check: 1,311 original tests plus14 tool checks, types,203 documents/1,046
local links,731 publication paths, M0 consistency and78 build outputs from145
approved inputs. No retail payload is part of that suite or build.

The fresh private438-file probe and [independent raw census](analysis/mission-spatial-audio-census.json)
verify26 RA2 and97 YR sound99 references plus1 RA2 and19 YR stop116 locations.
The separate Python census makes9,499 comparisons, including2,545 focused spatial
comparisons. All sound99 audio references are source-supported; stop116 remains a
location-only cue with no sample binding. Both opcodes remain unadmitted by the
mission VM. The existing sound19/EVA21 dispatch leaves197 RA2 /437 YR required
diagnostics, and both whole-mission authorities remain null. This is source
verification, with no native execution or browser playback claim.

## Required integration

- Bind locations to genuine mission/world terrain and object content, including
  current building/terrain membership, source list ordering and bridge/elevation
  coordinates. Multiple occupants must have a proven winner or remain unsupported.
- Preserve object sound assignment and positional controller lifetime in a bounded
  deterministic compound checkpoint. Only actual VM effects may issue requests;
  failed work/queue/state limits must roll back the whole transaction.
- Cover polling, force, cell/team callbacks, destruction, changed occupants,
  duplicate coordinate waypoints, repeated starts/stops and every save/replay
  boundary with original fixtures.
- Connect the genuine requests to the bounded browser output component. Listener
  pan/attenuation, shroud rules, stream clocks, sample selection and loop cursors
  remain separate from simulation RNG. Report native timing differences explicitly.
- Rerun the supplied opening source census and independent raw/native comparisons,
  then obtain an independent exact-head review. A supported source reference is
  not a completed mission or audible-playback test.

Private listings, source rows, samples and browser captures remain under ignored
`local/`. Public artifacts contain factual metadata and original fixtures only.
