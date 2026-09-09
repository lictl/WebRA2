# Explicit profile resolution and precedence evidence

Issue [#22](https://github.com/lictl/WebRA2/issues/22), under
[#18](https://github.com/lictl/WebRA2/issues/18); 2026-09-09.
The [VFS component](../../packages/vfs/README.md) implements explicit ranked layers,
profile isolation and provenance-preserving lookup. The
[metadata projection](profile-census.json) deliberately leaves native precedence
unresolved. Neither artifact is a complete importer or a verified effective profile.

## Implemented WebRA2 policy

The caller declares RA2/YR scope for every layer and asset, and supplies each layer's
rank and evidence. Larger ranks win; equal-rank conflicting bytes or distinct name
candidates produce ambiguity. Exact byte duplicates keep all equivalent physical
sources. No filesystem enumeration, locale-sensitive sort or archive suffix chooses
a winner. Missing files and unverified hash-name candidates cannot pass a required
identity check. These are tested WebRA2 rules, not recovered native behavior.

Every retained candidate carries root/member hashes, byte bounds, member ordinal/ID,
source ID, original root spelling, profile scope, name evidence and rank evidence.
Source IDs must be globally unique. Impossible ranges, contradictory hashes/sizes,
duplicate identities, unsafe logical paths and inconsistent profile scopes fail
construction. CJK logical paths are supported. Physical handles and symlink-safe
filesystem access belong to future importer adapters; no asset bytes are read here.

An explicit configuration may rank base, patch, loose files and ordered mods as
`0`, `10`, `20`, `100`, `101`. Synthetic tests prove that chosen order and prove
that changing the declared ranks changes selection. The resolver does not generate
those ranks from filenames. It does not merge INI occurrences or choose map/rule
semantics; those are separate content interpretation responsibilities.

## Pinned primary-source observations

Inspected EA's GPL-3.0 mission editor revision
`6abf0f557469baea73079c6bf6550709e2e3584e`, `MissionEditor/Loading.cpp`,
SHA-256 `004b3cf81144f74d6ca9ddfab6c9e0f8fc4c596ada132d6556d772b25fe8755a`.
This is editor source, not the RA2/YR executable source. The confidence is high
about what the inspected code says; original-game runtime status remains unknown.
No editor source was translated into the resolver.

| Locator | Source observation | Implication and evidence still needed |
| --- | --- | --- |
| [InitMixFiles, lines 3685–3736](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L3685-L3736) | With its search option enabled, presence of `ra2md.mix` sets Yuri mode; numbered expansion archives are opened, and slot 100 represents `ra2md.mix`. | This editor auto-detection would defeat independent RA2 selection in a combined installation. WebRA2 requires explicit profiles. It does not establish native patch priority. |
| [FindFileInMix, lines 4062–4100](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L4062-L4100), [base fallback, lines 4178–4200](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L4178-L4200) | Searches external cache slots descending, then expansion slots descending and their explicitly named children, then base/language/local containers. | A concrete editor lookup implementation exists. Nested child order and slot 100 prevent treating this as a generic “larger patch number wins” proof for the games. |
| [INI loading, lines 789–803](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L789-L803), [archive fallback, lines 833–850](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L833-L850) | Under the search option, an INI in the game directory is read before archive fallback. | Evidence for the editor's loose INI path only. Native loose rules, asset classes and map-specific handling still need separate evidence. |
| [LoadStrings, lines 6247–6283](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L6247-L6283) | Selects `RA2.CSF` or `RA2MD.CSF`, attempts the game-directory file and then archive lookup. | Supports candidate string-file identities and a comparison recipe, not playable locale or native CSF precedence. |

The inspected editor enumerates `ecachemdNN.mix` in Yuri mode
([lines 3951–3970](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/Loading.cpp#L3951-L3970)).
The supplied Yuri executable contains a broader `ECACHE*.MIX` string, below.
Neither observation alone proves which wildcard, enumeration or comparison branch
runs. OpenRA/XCC format support is not native precedence evidence either.

## Targeted static executable evidence

Read the two supplied files without running them. The table lists byte offsets
from the start of each file and complete short null-terminated filename literals.
These observations only establish string presence; adjacent offsets do not establish
execution order, loop direction, mount order or Steam build identity.

- `game.exe`, 5,077,312 bytes, SHA-256
  `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`.
- `gamemd.exe`, 5,286,208 bytes, SHA-256
  `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.

| File | Byte offset | Filename literal |
| --- | ---: | --- |
| game.exe | 4045664 | `RULES.INI` |
| game.exe | 4046528 | `ELOCAL*.MIX` |
| game.exe | 4046540 | `ECACHE*.MIX` |
| game.exe | 4046600 | `RA2.MIX` |
| game.exe | 4046612 | `EXPAND%02d.MIX` |
| gamemd.exe | 4350560 | `RULESMD.INI` |
| gamemd.exe | 4351508 | `ELOCAL*.MIX` |
| gamemd.exe | 4351520 | `ECACHE*.MIX` |
| gamemd.exe | 4351604 | `RA2.MIX` |
| gamemd.exe | 4351612 | `RA2MD.MIX` |
| gamemd.exe | 4351628 | `EXPANDMD%02d.MIX` |

These are reviewed factual metadata, not decompiled code or payload extracts. A
repeat check can hash each file, seek to each offset and read the listed ASCII
literal plus a null terminator. Local research remains in ignored `local/`.

## Supplied-install candidate projection

The adapter joins [campaign census](campaign-census.json) source identities to the
[physical MIX census](mix-census.json) by root/archive hashes, exact member
ordinal/ID, byte offset and length. It trusts the campaign member SHA-256 from that
prior verified census; it does not re-read or re-hash current retail assets.
Input JSON hashes are retained in the output to identify exactly which snapshots
were projected. All physical roots deliberately receive rank zero.

It projects **62 physical source records**, mounts **55 candidate records**, and
keeps **7 unassigned** records visible. The unassigned records are the two training
maps, four copies of the two demo maps, and one unnamed map. Their prior census
does not assign a profile, so this slice does not invent one. Battle/progression
evidence may justify a later explicit assignment.

| Candidate profile | Requested definition/string + faction names | Single-content hash candidates | Ambiguous | Missing among these requests |
| --- | ---: | ---: | ---: | ---: |
| RA2 | 30 | 30 | 0 | 0 |
| YR | 20 | 18 | 2 | 0 |

Zero literal-confirmed identities are reported. The prior census resolved archive
names as hash candidates. There are 31 total RA2 path candidates because the extra
`sov09t.map` is retained separately from the faction Scenario request set; YR has
20 path candidates. This request set is six definition/string names plus the prior
faction filenames, not a full campaign dependency manifest. Missing graphics,
audio, unknown entries and unresolved locale policy are outside its zero-missing
count. Neither profile is declared verified or playable.

`all02umd.map` keeps both `expandmd01.mix/#8:b4e00d21` (465,788 bytes) and
`mapsmd03.mix/#4:b4e00d21` (465,825). `rulesmd.ini` keeps
`expandmd01.mix/#0:8218f9f4` (743,215) and
`ra2md.mix/#14:fbe0d09d/#4:8218f9f4` (742,958). Their different hashes appear in
`alternatives`, with `content: null`, `status: ambiguous`, and `content-conflict`.
Identical RA2 opening-map copies retain both physical sources under the same
candidate content hash; that is byte equivalence, not native source selection.

## Reproduction and validation

From the repository root, using Node 24.20.0 and the locked dependencies:

```sh
npm ci
node tools/run-tests.mjs tests/vfs
node --import tsx tools/analysis/profile-census.ts docs/analysis/campaign-census.json docs/analysis/mix-census.json > local/profile-census.json
cmp local/profile-census.json docs/analysis/profile-census.json
npm run check
git diff --check
```

Create ignored `local/` first if needed. The projection is reproducible from public
metadata alone; it is not another private retail decode run. The source observation
above was a separate read-only check against this installation. Tests cover chosen
rank order, profile isolation, equal-rank conflicts, exact copies, name collisions,
missing requirements, CJK/path rejection, contradictory provenance, resource caps,
immutability, report join failures, excluded data and input permutation. No game
payload is included in fixtures or report output.

The resolver uses only browser-standard ECMAScript operations and type-only imports.
This slice runs synthetic tests on Node; it does not claim a new four-browser import
test, file access implementation, storage measurement or renderer result. Existing
[browser feasibility evidence](browser-feasibility.md) remains separately scoped.

## Remaining effective-profile gate

[#18](https://github.com/lictl/WebRA2/issues/18) must establish native selection for
the two patch variants and any needed nested/theater/language/loose conflicts before
a profile claims original compatibility. A bounded original-game comparison can
use owner-created distinct sentinel replacements in isolated copied installations
to compare loose versus archive and two numbered patch layers, separately in RA2
and YR. The fixture needs an agreed observable property; filename presence alone
will not pass. Do not modify the reference installation or run its programs as
part of static analysis. No owner action is requested by this resolver slice.

The result may instead select a documented WebRA2 compatibility policy while
retaining native behavior as unverified. Per-file exceptions, semantic INI merging,
required dependency closure and playable locales need their own evidence before
M0/M1 release gates. [Component provenance](../../packages/vfs/PROVENANCE.md) records
the MIT implementation boundary and existing GPL distribution obligations.
