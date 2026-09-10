# Mission cue source and cursor provenance

The new `mission-cues.ts` and `mission-cue-types.ts` content modules, the standalone
simulation `mission-cues.ts`, and original fixtures are GPL-3.0-or-later.
Copyright 2026 WebRA2 contributors. No retail tables, media, strings or native
listings are embedded. Existing INI, ScenarioLogic, ScenarioObjects and CSF readers
retain their own provenance. Hashing uses the existing pinned noble dependency.
This is an original source-reference compiler and caller-driven cursor, not a
formal clean-room claim or a native playback implementation.

The paired [native ledger](../../docs/analysis/mission-cues-native.json) pins the
same Steam reference executable hashes as the existing mission runtime. Selected
spans confirm action dispatch, operand load modes and consumers for movie10,
text11, sound19, music20, speech21, camera48 and radar55. The strings used by audio
lookups select native loaded registries; movie10 reads an integer-indexed registry.
Their complete resource loaders and playback effects remain unimplemented here.

Primary layout references are pinned to YRpp
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`:

- [TActionClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TActionClass.h)
  provides investigation leads for action load/dispatch; each selected opcode is
  also checked against both actual native dispatch tables.
- [ScenarioClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScenarioClass.h),
  [RadarEventClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RadarEventClass.h)
  and [GeneralDefinitions](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h)
  supply layout/type leads, not a license for copying their implementations.
- [VocClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/VocClass.h)
  and [VoxClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/VoxClass.h)
  identify audio lookup leads. No YRpp license is asserted or code reused.

The existing [EA editor framing reference](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerActionsDlg.cpp)
remains secondary to paired native operand evidence for the new interpretation.
Eight comma tokens per action are parsed by the existing ScenarioLogic component.

## Confirmed static boundaries

Both native mode4 loaders copy at most31 bytes of a trimmed text label. Their
text action consumers resolve it through StringTable. The catalog owns the exact
profile CSF bytes and preserves missing/empty/conflicting lookup outcomes. Native
message delay, dynamic color and screen layout are pending; the cue carries text
rather than inventing those values.

Action final-token alpha decoding is shared: A through Z produce0 through25;
AA through ZZ produce26 through701. The native readers differ: RA2's initial
Scenario reader loads canonical decimal keys0 through100, YR's0 through701. Both
use zero/default to copy a global invalid-cell value; the compiler rejects that
case rather than asserting its initial contents or a later starting-waypoint
fallback. Positive source coordinates use remainder/division by1000 and the
existing inside-diamond ScenarioObjects gate. Longer, non-ASCII or ambiguous
aliases remain unsupported.

Camera48 passes the source waypoint through cell conversion, current map height
and bridge flags, then supplies its scalar to the viewport consumer. Those final
coordinates and camera timing are not reconstructed here. Radar55 passes the
source cell and integer type to RadarEvent creation, not trigger forcing. The
bounded reference family uses IDs0 through16, backed by the primary type layout,
inspected style region and both native type16 callers. Native dynamic coalescing,
style, duration and side effects are outside this catalog; the native consumer
itself does not provide a safe imported-index range check.

The [report](../../docs/mission-cues.md) separates reference closure from execution.
The standalone cursor has explicit WebRA2 caller order and bounds. It consumes no
RNG, performs no I/O and authenticates no trigger firing. Its events always state
`playbackAuthorized: false`. The coordinator must join catalog/mission/program
identity and genuine VM dispatch before any later consumer is admitted.

When these modules become reachable in a distributed bundle, include this notice
and the existing GPL/INI/CSF dependency notices in both bundle and source mapping.
Shared build/licensing integration belongs to the coordinator.
