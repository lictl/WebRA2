# Opening transitive dependency candidates

Issue [#32](https://github.com/lictl/WebRA2/issues/32), under
[#18](https://github.com/lictl/WebRA2/issues/18) and M0. The
[metadata snapshot](dependency-candidates.json) extends the reviewed
[structural campaign graph](campaign-graph.md) through literal/transitive rule,
art, animation and sound references. It is an actionable candidate import manifest,
not an effective rules compiler or a gameplay compatibility result.

## Measured candidate inventory

The private pass verified **15 members / 3,810,446 bytes**, including both identical
RA2 opening copies, the YR opening, seven rules/AI/art candidates, three sound-table
candidates and two newly identified audio indexes. The shared reader verifies root
hashes, ranges and staleness; known member hashes use `read`, new members use
`discover` and record the derived SHA-256. No game program ran. No SHP/VXL/audio
payload was extracted, decoded or published by this slice.

| Candidate | Structural seeds | Transitive nodes / edges | Weapons / projectiles / warheads | Animations / voxel animations | Requested audio samples |
| --- | --- | --- | --- | --- | --- |
| `all01t.map` | 98 | 1,889 / 2,958 | 32 / 11 / 18 | 81 / 1 | 320 |
| `all01umd.map` | 252 | 3,763 / 10,811 | 166 / 40 / 81 | 109 / 2 | 670 |

The graph retains rulesmd and soundmd variants rather than doubling down on an
assumed load order. Counts are potential dependencies reachable from the prior
graph's declarations, not counts of active objects or required runtime features.
Native profile evidence is investigated separately in
[#31](https://github.com/lictl/WebRA2/issues/31); this report deliberately does not
apply that policy. Physical file lookup considers every supplied archive, including
possible sources from another profile, and returns no selected winner.

RA2 has 1,100 file-name requests with **494** matched physical candidates; YR has
1,845 with **711** matches. Most unmatched requests are optional alternatives:
835/1,458 requests respectively are optional probes, including theater variants,
voxel attachments and loose WAV alternatives to indexed BAG audio. Only one
non-optional file-name request per opening is unmatched (`canewy04.shp` /
`gtgcan.shp`); theater variants are separately retained. An absent base name therefore
does not establish a missing required asset. Palette `lib.pal` uses the editor's
explicit numeric-ID lookup and is labeled as such, not a filename-hash confirmation.

All **320/670** requested sound sample identifiers match at least one supplied
audio index. Index records contain **1,153** RA2-container and **2,285** YR-container
entries; all paired sample ranges fit their same-container BAG candidate. There are
no duplicate names in these two indexes. Raw codec flag values 6 and 12 are
reported without claiming codec support. Index-to-BAG pairing is a structural
candidate policy; it does not resolve native locale/profile/patch selection.

## Import manifest and requirement meanings

Each opening's `importManifest` provides required definition **groups** with exact
source hashes/ranges. One effective variant is eventually needed for each name;
all supplied variants were read to reproduce this census. The groups include the
mission, rules, AI, art and sound documents. The manifest also identifies indexed
audio containers, format needs, and external gates for locale and native profiles.
Identical opening copies remain available under `equivalentPhysicalSources`.

`fileRequests` is the candidate asset manifest: filename, status, classification,
and all matching physical identities with archive hash, member ID/ordinal, range,
root hash and hash family. No member payload hash is invented when the file body
was not read. Hash collisions/aliases and effective precedence are not resolved.
The explicit `lib.pal` numeric alias carries its separate source evidence.

Requirements classify an **edge locally**, not an entire mission:

- `required`: a supported literal structural relation, such as a weapon's declared
  projectile/warhead or an art record's selected file convention, assuming its owner
  is used and that definition is selected.
- `conditional`: activation, selection, production, transformation, sound,
  animation or prerequisite candidate; it may never be used during a playthrough.
- `optional`: a fallback/alternative file probe, auxiliary voxel probe or alternate
  cameo. Missing it alone is not evidence of broken campaign content.
- `unsupported`: a numeric operand or capability without recovered semantics.

The supported operand schema is in
[dependency-schema.ts](../../packages/content/src/dependency-schema.ts). It follows
primary/secondary/elite/indexed weapons; projectile and warhead; deploy/undeploy,
unloading, spawn, enslave and upgrade target; prerequisite groups and literal types;
weapon reports, object voices, animation lists and chains; particle systems and
particles; explicit/implicit images, building animation records, cameo/buildup/bib
files and explicit palettes. The prerequisite group mapping is a candidate
interpretation; alternatives and native defaults are not evaluated.

`opcodeOperands` preserves opening event/action/script IDs, occurrence counts and
parameter widths from the prior scanner, with source identity. Every operand is
explicitly classified unsupported until a typed behavioral schema is recovered.
Decoders still needed by the candidate manifest include SHP, VXL/HVA, palettes,
indexed audio samples, and cinematic streams. BIK/VQA direct-name requests are
alternative probes; VQA is not asserted to be required for these RA2/YR campaigns.
Packed map/theater data, CSF/fonts, opcode-generated assets, default/global rules
and runtime-created objects remain separate gates. `nativeDependencyClosureComplete`
stays false even when all literal candidate names match.

## Evidence and implementation boundary

[The pure compiler](../../packages/content/src/dependency-candidates.ts) consumes
explicit profile-tagged documents and deterministic file/sample resolver adapters.
It uses the existing graph's reachable source/line locations as seeds without
editing or replacing that graph. Section variants become different nodes. Cycles
are visited once and reported as back edges through iterative traversal; they are
not automatically runtime errors. Original symbols stay inside resolution; the
published projection contains asset identifiers, counts, typed fields and source
metadata, never original rows, display strings, cell data or rule values.

[The inventory adapter](../../packages/content/src/dependency-inventory.ts) validates
root/archive/member containment, hashes, ordinals and numeric ranges. It uses both
reviewed MIX filename hash families and retains every match. It cannot authenticate
a filename from a hash alone. A filename's effective profile is never inferred
from whichever match appears first. No loose-file universe is enumerated by this
adapter; native loose-file precedence and an importer catalog remain separate.

[The audio-index reader](../../packages/content/src/dependency-audio-index.ts)
supports bounded GABA v2 metadata: a 12-byte header and exact count of 36-byte
records. Each record retains a bounded ASCII identifier, offset, size, sample rate,
raw flags and chunk size. The CLI joins only same-archive BAG candidates and
rejects individual out-of-range pairings. It does not decode samples. Dollar-prefix
normalization in Sounds tokens is a candidate lookup with an explicit unverified
prefix diagnostic, not an implemented audio-control semantic.

New source/tests/CLI are GPL-3.0-or-later because they compose the GPL content/MIX
scanners and use XCC format evidence. All implementation and fixtures are original;
no YR++ implementation, binary offsets, retail rows or reference source bodies were
copied. YR++ is consulted as third-party reverse-engineering evidence, not adopted
as an engine dependency or represented as original Westwood source. Its pin does
not establish RA2/YR runtime behavior by itself. Shared notices remain in
[content provenance](../../packages/content/PROVENANCE.md) and
[licensing](../licensing.md).

| Interpretation | Pinned primary evidence |
| --- | --- |
| Object weapon, deploy, prerequisite, voice, debris and spawn fields | [YR++ TechnoTypeClass.h](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoTypeClass.h#L196) and local field occurrences |
| Weapon projectile/warhead/report/animation relations | [YR++ WeaponTypeClass.h, 60–73](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/WeaponTypeClass.h#L60) |
| Warhead animation/debris and projectile secondary weapon/trailer | [WarheadTypeClass.h](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/WarheadTypeClass.h#L69), [BulletTypeClass.h](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/BulletTypeClass.h#L98) |
| Animation, voxel debris and group fields | [AnimTypeClass.h](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/AnimTypeClass.h#L68), [VoxelAnimTypeClass.h](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/VoxelAnimTypeClass.h#L58), [RulesClass.h](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h#L383) |
| Type-name image default and explicit override | [EA editor MapData.cpp, 3643–3654](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/MapData.cpp#L3643) |
| SHP/theater and VXL/attachment candidates, building animation files | [EA Loading.cpp, 1189–1267](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L1189), [2122–2181](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L2122), [2644–2906](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L2644) |
| Named theater palettes and the special numeric palette request | [EA Loading.cpp, 4265–4363](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L4265) |
| GABA v2 framing, field widths and count validation | [XCC cc_structures.h, 79–96](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/cc_structures.h#L79), [audio_idx_file.h, 27–44](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/audio_idx_file.h#L27) |

HVA companions are an explicit file-convention candidate for voxel transforms;
the native animation-file selection remains unverified. Editor theater fallback
behavior is not automatically assigned to the native engine. The generated
schema is an observed candidate model with UNKNOWN behavioral confidence.

## Bounds and validation

Pure compilation caps: 40 documents, 500,000 section/entry records, 64 Mi code units,
25,000 nodes, 100,000 edges, 40,000 diagnostics, 80,000 file/sample matches and 128
tokens per reference. The reused structural compiler retains its tighter limits.
Inventory caps: 512 archives / 250,000 members. Audio-index caps: 4 MiB / 100,000
records. Before expanding index/BAG candidates, the CLI caps all parsed index
entries at 100,000 and cumulative pair attempts at 80,000, including out-of-range
pairs. The private pass uses 3,438 entries and pair attempts. CLI read caps are
128 reads / 64 MiB total / 16 MiB per member; each input JSON is
read with the shared bounded 4 MiB manifest loader. Source selection and read budget
are recorded directly in the report. Exceeding a cap fails rather than emitting a
silently complete result.

Nine new original synthetic tests cover transitive chains, cycles, rule variants,
list/scalar errors, prototype-shaped names, source/profile separation, graph limits,
MIX containment and explicit numeric aliases, every truncated audio-index length,
verified sound/index discovery, stale roots, private-payload omission and invalid
BAG pairings and duplicate-BAG fanout before expansion. These are parser/metadata
tests, not retail gameplay tests.

With Node 24.20.0 from repository root:

```sh
npm ci
npm run check
mkdir -p local/dependency-reproduction
node --import tsx tools/analysis/dependency-census.ts /absolute/path/to/game docs/analysis/campaign-census.json docs/analysis/mix-census.json > local/dependency-reproduction/dependency-candidates.json
cmp docs/analysis/dependency-candidates.json local/dependency-reproduction/dependency-candidates.json
```

The last two commands are the opt-in private metadata gate. Missing retail inputs
are a skipped gate. The snapshot records both input-manifest hashes and discovered
member hashes. The next integration applies reviewed native policy from #31 and
locale evidence from #33 to these candidate groups, preserving alternatives and
the unsupported format/opcode list for the first playable implementation slices.
