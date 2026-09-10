# Mission audio resource references

Issue [#196](https://github.com/lictl/WebRA2/issues/196) resolves source resources
for mission sound19, music20 and speech21. It is separate from
[mission cues](mission-cues.md), source invocation under
[#195](https://github.com/lictl/WebRA2/issues/195), and browser playback.
No whole mission becomes supported and no audio is played.

## Component boundary

`compileMissionAudioPlan` takes a genuine `MissionCueCatalog`, explicit side0/1/2,
all provided registry/index sources with owned bytes and expected hashes, audio MIX
parent candidates, BAG ranges, and direct WAV candidates with expected hashes.
Paths are normalized flat import names; nested MIX ancestry and root identities
are explicit. Registry roles are restricted to the chosen profile's sound, EVA,
theme and audio index paths. Arbitrary source lists do not establish complete
native mount discovery: `scope` remains `provided-import-candidates`. A consumer
must supply its complete bounded import census and bind the result to its own
source mission and instruction identity before dispatch. None of these records
authorize an untrusted invocation to play media.

The compiler checks native case-preserved name CRC collisions and refuses ambiguous
source sections/keys. Registry allocation tables are indexed once per file.
The compiler owns descriptors, array slots, scalar identities and source byte
snapshots before processing. Plans and prepared catalogs are frozen and carry
same-module factory brands. JSON copies are useful metadata but cannot forge a
factory result. `prepareMissionAudioSamples` accepts that plan and explicit native
Blob handles. It rechecks selected registry/index source bytes against their hashes,
verifies each full containing root, then reads only bounded sample ranges with
`createBrowserVerifiedSession`. No network, filesystem path or media device is used.
`copyMissionAudioSample` returns an owned copy; mutation cannot affect another read.

A verified reference means the source identity and sample bytes are known, not that
native playback controls, queueing, timing, priority, volume or random/loop selection
are implemented. Every sound token remains ordered, including duplicates, and all
required alternatives must resolve before that binding gains reference status.
All definition fields and defaults remain available with original source line
numbers. Unmodeled playback semantics are retained separately.

Durable plan/catalog hashes exclude session `sourceId` handles. They preserve
profile, mission and cue hashes, side, candidate namespaces, root hashes/ranges,
source/index identities and sample identities. Changing candidate enumeration does
not change them; changing the declared import namespace can. They identify this
reference catalog, not a complete simulation/save model. Reconstruct the branded
catalog from source when loading persisted metadata.

## Native selection and unsupported cases

The [paired native ledger](analysis/mission-audio-native.json) and
[provenance](../packages/content/MISSION_AUDIO_PROVENANCE.md) establish the loaders.
Fresh registries enumerate source entries, allocate case-insensitively using the
first spelling, then read that exact section. Sound controls remain pending even
when their samples are verified. Sound tokens split on space/tab/newline, remove
all leading `$` and `#`, and resolve through the selected GABA v2 index. The native
index is sorted before binary search; the plan retains both physical source ordinal
and sorted index. Duplicate names have no invented winner.

RA2 uses AUDIO.MIX. YR chooses AUDIOMD.MIX when that archive exists; base AUDIO.MIX
members are then inactive alternatives. A missing selected-bank sample never falls
through into the inactive bank. Parent locators, descendant ranges and root identity
must agree. Missing parent candidates, unknown mounts and differing equal-tier
copies remain unsupported. YR's no-AUDIOMD fallback is not enabled by an omitted
candidate list. Within the evidenced game family, numbered expansions precede
bases and YR precedes the RA2 base. Within the language family, LANGMD precedes
LANGUAGE. Cross-family precedence remains unsupported; a successful loose-file
candidate precedes archive lookup.

EVA side strings become bounded eight-byte stems plus `.wav`; music uses its
bounded Sound stem plus `.wav`. Missing side strings stay missing. Both consumers
open WAV resources through CCFile; sound-bank samples remain separate. All raw
control fields are retained; native side ownership, queue decisions, arbitrary
external bank directories, dynamic mounts, controls and playback selection remain
outside this component. Movie10 remains under [media issue12](https://github.com/lictl/WebRA2/issues/12).

## Bounds and verification

Defaults permit512 total candidates,16MiB aggregate source bytes,4MiB per source,
65,536 source lines,8,192 registry entries,4,096 unique samples,16MiB per sample and
64MiB aggregate sample bytes. Names, line lengths, serialized output and parent
ranges are bounded. Limits can only be reduced. Preparation allows128 selected
roots,4,096 range attempts,1MiB chunks and an explicit8GiB total verification/read
budget. Native Blob snapshots and the existing verifier own cancellation and read
slots; no timer, wall clock or RNG controls reference selection.

`wholeBagMembersHashed` remains false. The complete containing root is hashed and
each used sample range has a hash; a full BAG member is neither allocated nor
claimed separately hashed. Compressed indexed samples retain their exact flags and native sample metadata;
encoded bits-per-sample remains null until a decoder policy is selected.
WAV header inspection accepts bounded PCM8/16 and
IMA-ADPCM metadata, with strict RIFF/chunk ranges. It is not waveform decoding.

Original fixtures exercise both profiles, sample alternatives, side selection,
registry ambiguity, allocation/string boundaries, sorted versus physical index,
parent mount exclusion, stale identities, byte ownership, hostile descriptors,
array/resource bounds and cancellation. Run:

```sh
node --import tsx --test tests/content/mission-audio.test.ts
npm run check
```

Private reproduction scripts are kept in
`local/worktrees/mission-audio/local/`. From that checkout:

```sh
node --import tsx local/probe196.mjs
python3 local/oracle196.py
python3 local/census196.py
/Users/lucus/Projects/WebRA2/local/worktrees/theater-tiles/local/venv/bin/python local/native196/ledger196.py
```

The probe obtains fresh438-file catalogs, rechecks mission/CSF and source identities,
verifies individual sample ranges, and writes private source/plan/catalog/sample
artifacts only under `local/corpus196/`. The separate Python oracle reparses raw
mission actions and registry/index bytes, independently rehashes roots and sample
ranges and compares every selected binding, control field, source line, index
projection, filename and header. The published [census](analysis/mission-audio-census.json)
contains only counts, pins and hashes. The independent oracle passes6,143
assertions and verifies seven complete root identities. Side0/1 close all57 RA2 and24 YR audio
occurrences; side2 YR closes15, preserving nine unavailable side stems. Neither
opening contains music20; music coverage is original synthetic evidence. No native
binary execution, listening test, browser playback or campaign completion is claimed.
